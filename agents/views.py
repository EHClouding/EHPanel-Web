import logging
from html import escape
from datetime import timedelta

from django.conf import settings
from django.contrib.admin.views.decorators import staff_member_required
from django.http import HttpResponse
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from .models import AgentEvent, AgentJob, EnrollmentToken, Node
from .serializers import AgentEventSerializer, AgentJobSerializer, EnrollmentTokenSerializer, NodeSerializer

logger = logging.getLogger(__name__)


def is_admin_user(user):
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


def scoped_node_ids(user):
    if is_admin_user(user):
        return None
    if not user or not user.is_authenticated:
        return []
    from hosting.models import HostingAccount

    return list(
        HostingAccount.objects.filter(owner=user)
        .values_list("node_id", flat=True)
        .union(HostingAccount.objects.filter(reseller=user).values_list("node_id", flat=True))
    )


class NodeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Node.objects.all().order_by("hostname")
    serializer_class = NodeSerializer

    def get_permissions(self):
        if self.action == "service_action":
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def get_queryset(self):
        refresh_local_or_mark_stale_nodes()
        queryset = super().get_queryset()
        node_ids = scoped_node_ids(self.request.user)
        if node_ids is not None:
            queryset = queryset.filter(id__in=node_ids)
        return queryset

    @action(detail=True, methods=["post"], url_path="service-action")
    def service_action(self, request, pk=None):
        node = self.get_object()
        service = str(request.data.get("service") or "").strip()
        action_name = str(request.data.get("action") or "").strip()
        if not service or not action_name:
            return Response({"detail": "service and action are required."}, status=status.HTTP_400_BAD_REQUEST)
        payload = dict(request.data)
        payload["service"] = service
        payload["action"] = action_name
        job = AgentJob.objects.create(
            node=node,
            job_type=AgentJob.Type.SERVICE_ACTION,
            payload=payload,
        )
        dispatch_job_for_current_mode(job)
        return Response(AgentJobSerializer(job).data, status=status.HTTP_202_ACCEPTED)


class EnrollmentTokenViewSet(viewsets.ModelViewSet):
    queryset = EnrollmentToken.objects.all().order_by("-created_at")
    serializer_class = EnrollmentTokenSerializer
    permission_classes = [IsAdminUser]


class AgentEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AgentEvent.objects.select_related("node").all()
    serializer_class = AgentEventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        node_ids = scoped_node_ids(self.request.user)
        if node_ids is not None:
            queryset = queryset.filter(node_id__in=node_ids)
        params = getattr(self.request, "query_params", self.request.GET)
        node_id = params.get("node")
        msg_type = params.get("msg_type")
        if node_id:
            queryset = queryset.filter(node_id=node_id)
        if msg_type:
            queryset = queryset.filter(msg_type=msg_type)
        return queryset


class AgentJobViewSet(viewsets.ModelViewSet):
    queryset = AgentJob.objects.select_related("node").all()
    serializer_class = AgentJobSerializer

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def get_queryset(self):
        queryset = super().get_queryset()
        node_ids = scoped_node_ids(self.request.user)
        if node_ids is not None:
            queryset = queryset.filter(node_id__in=node_ids)
        params = getattr(self.request, "query_params", self.request.GET)
        node_id = params.get("node")
        status = params.get("status")
        job_type = params.get("job_type")
        if node_id:
            queryset = queryset.filter(node_id=node_id)
        if status:
            queryset = queryset.filter(status=status)
        if job_type:
            queryset = queryset.filter(job_type=job_type)
        return queryset

    def perform_create(self, serializer):
        job = serializer.save()
        dispatch_job_for_current_mode(job)

    @action(detail=True, methods=["post"], url_path="dispatch")
    def dispatch_action(self, _request, pk=None):
        job = self.get_object()
        dispatch_job_for_current_mode(job)
        return Response({"status": job.status, "job": str(job.id)}, status=status.HTTP_202_ACCEPTED)


class MailQueueViewSet(viewsets.ViewSet):
    def get_permissions(self):
        return [IsAdminUser()]

    def list(self, request):
        nodes = scoped_nodes_for_user(request.user)
        rows = []
        for node in nodes:
            rows.extend(mail_queue_rows_from_node(node))
        rows.sort(key=lambda item: item.get("time_sort") or "", reverse=True)
        return Response({"count": len(rows), "next": None, "previous": None, "results": rows[:500]})

    @action(detail=False, methods=["post"], url_path="refresh")
    def refresh(self, request):
        node_id = request.data.get("node")
        nodes = scoped_nodes_for_user(request.user)
        if node_id:
            nodes = nodes.filter(id=node_id)
        jobs = []
        for node in nodes:
            job = AgentJob.objects.create(
                node=node,
                job_type=AgentJob.Type.SERVICE_ACTION,
                payload={"service": "postfix", "action": "mail_queue"},
            )
            dispatch_job_for_current_mode(job)
            jobs.append(str(job.id))
        return Response({"queued": len(jobs), "jobs": jobs}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=["post"], url_path="retry")
    def retry(self, request):
        return self._queue_action(request, "retry_mail_queue")

    @action(detail=False, methods=["post"], url_path="release")
    def release(self, request):
        return self._queue_action(request, "release_mail_queue")

    def _queue_action(self, request, action_name):
        node_id = request.data.get("node")
        queue_id = str(request.data.get("queue_id") or "").strip()
        if not node_id or not queue_id:
            return Response({"detail": "node and queue_id are required."}, status=status.HTTP_400_BAD_REQUEST)
        node = scoped_nodes_for_user(request.user).filter(id=node_id).first()
        if not node:
            return Response({"detail": "Nodo no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        job = AgentJob.objects.create(
            node=node,
            job_type=AgentJob.Type.SERVICE_ACTION,
            payload={"service": "postfix", "action": action_name, "queue_id": queue_id},
        )
        dispatch_job_for_current_mode(job)
        return Response({"status": job.status, "job": str(job.id)}, status=status.HTTP_202_ACCEPTED)


def dispatch_job(job):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    correlation_id = f"job_{job.id}"
    try:
        async_to_sync(channel_layer.group_send)(
            node_group_name(job.node_id),
            {
                "type": "job.run",
                "correlation_id": correlation_id,
                "payload": {
                    "job_id": str(job.id),
                    "job_type": job.job_type,
                    "payload": job.payload,
                },
            },
        )
    except Exception:
        logger.exception("Unable to dispatch agent job %s", job.id)


def dispatch_job_for_current_mode(job):
    try:
        from hosting.local_provisioning import dispatch_or_execute_local

        return dispatch_or_execute_local(job)
    except Exception:
        logger.exception("Unable to dispatch job %s in current mode", job.id)
        return dispatch_job(job)


def node_group_name(node_id):
    return f"node_{str(node_id).replace('-', '_')}"


def scoped_nodes_for_user(user):
    node_ids = scoped_node_ids(user)
    queryset = Node.objects.all().order_by("hostname")
    if node_ids is not None:
        queryset = queryset.filter(id__in=node_ids)
    return queryset


def mail_queue_rows_from_node(node):
    rows = []
    sources = [
        extract_mail_queue_items(node.last_telemetry),
        extract_mail_queue_items(node.capabilities),
    ]
    latest_jobs = node.jobs.filter(job_type=AgentJob.Type.SERVICE_ACTION).order_by("-queued_at")[:25]
    for job in latest_jobs:
        payload = job.payload or {}
        if payload.get("action") in {"mail_queue", "list_mail_queue", "collect_mail_queue"}:
            sources.append(extract_mail_queue_items(job.result or {}))
    seen = set()
    for source in sources:
        for item in source:
            row = normalize_mail_queue_item(node, item)
            key = (row["node"], row["queue_id"], row["from"], row["to"])
            if key in seen:
                continue
            seen.add(key)
            rows.append(row)
    return rows


def extract_mail_queue_items(value):
    if not isinstance(value, dict):
        return []
    for key in ["mail_queue", "mailQueue", "postfix_queue", "queue", "items", "messages"]:
        raw = value.get(key)
        if isinstance(raw, list):
            return [item for item in raw if isinstance(item, dict)]
        if isinstance(raw, dict):
            nested = extract_mail_queue_items(raw)
            if nested:
                return nested
    return []


def normalize_mail_queue_item(node, item):
    queue_id = str(item.get("queue_id") or item.get("id") or item.get("queue") or item.get("message_id") or "")
    sender = str(item.get("from") or item.get("sender") or item.get("mail_from") or "")
    recipient = str(item.get("to") or item.get("recipient") or item.get("rcpt_to") or "")
    status_value = str(item.get("status") or item.get("state") or item.get("deferred") or "pending")
    direction = str(item.get("direction") or infer_mail_direction(sender, recipient))
    created_at = str(item.get("time") or item.get("created_at") or item.get("queued_at") or item.get("date") or "")
    reason = str(item.get("reason") or item.get("message") or item.get("error") or item.get("detail") or "")
    code = str(item.get("code") or item.get("dsn") or item.get("status_code") or "")
    account = mail_queue_account_label(sender, recipient)
    return {
        "id": f"{node.id}:{queue_id or sender}:{recipient}:{created_at}",
        "node": str(node.id),
        "node_hostname": node.hostname,
        "queue_id": queue_id,
        "direction": direction,
        "from": sender,
        "to": recipient,
        "account": account,
        "code": code or ("250" if normalize_mail_status(status_value) == "Entregado" else "N/D"),
        "status": normalize_mail_status(status_value),
        "explanation": reason or mail_status_explanation(status_value),
        "time": created_at or "N/D",
        "time_sort": created_at,
        "raw": item,
    }


def infer_mail_direction(sender, recipient):
    local_domains = [".ehclouding.com", ".ehclouding.net"]
    sender_local = any(sender.endswith(domain) for domain in local_domains)
    recipient_local = any(recipient.endswith(domain) for domain in local_domains)
    if recipient_local and not sender_local:
        return "Entrada"
    return "Salida"


def normalize_mail_status(value):
    raw = str(value or "").lower()
    if any(token in raw for token in ["sent", "delivered", "success", "active"]):
        return "Entregado"
    if any(token in raw for token in ["spam", "junk"]):
        return "Spam"
    if any(token in raw for token in ["bounce", "reject", "failed", "error"]):
        return "Rechazado"
    return "Pendiente"


def mail_status_explanation(value):
    status_value = normalize_mail_status(value)
    if status_value == "Entregado":
        return "El correo fue aceptado por el servidor destino."
    if status_value == "Spam":
        return "El mensaje fue clasificado como spam."
    if status_value == "Rechazado":
        return "La entrega fallo o fue rechazada por el servidor."
    return "El mensaje sigue pendiente en la cola del nodo."


def mail_queue_account_label(sender, recipient):
    try:
        from hosting.models import HostingMailbox

        emails = [email for email in [sender, recipient] if "@" in email]
        mailbox = HostingMailbox.objects.select_related("account").filter(email__in=emails).first()
        if mailbox:
            return mailbox.account.customer_name or mailbox.account.username or mailbox.account.primary_domain
    except Exception:
        logger.exception("Unable to resolve mail queue account label")
    return ""


def mark_stale_nodes_offline():
    timeout = timezone.now() - timedelta(seconds=settings.AGENT_HEARTBEAT_TIMEOUT_SECONDS)
    stale_nodes = Node.objects.filter(state=Node.State.ONLINE, last_seen_at__lt=timeout)
    for node in stale_nodes:
        capabilities = node.capabilities if isinstance(node.capabilities, dict) else {}
        if capabilities.get("local_panel"):
            continue
        node.state = Node.State.OFFLINE
        node.save(update_fields=["state", "updated_at"])


def refresh_local_or_mark_stale_nodes():
    try:
        from hosting.local_provisioning import is_local_provisioning_enabled

        if is_local_provisioning_enabled():
            from hosting.local_metrics import collect_node_telemetry

            collect_node_telemetry()
            return
    except Exception:
        logger.exception("Unable to refresh local node telemetry")
    mark_stale_nodes_offline()


@staff_member_required
def ops_dashboard(_request):
    refresh_local_or_mark_stale_nodes()
    nodes = list(Node.objects.all().order_by("hostname"))
    events = list(AgentEvent.objects.select_related("node").all()[:20])
    jobs = list(AgentJob.objects.select_related("node").all()[:20])
    now = timezone.now()

    node_cards = "\n".join(render_node(node, now) for node in nodes) or '<div class="empty">No nodes registered.</div>'
    event_rows = "\n".join(
        f"<tr><td>{event.created_at:%H:%M:%S}</td><td>{escape(event.node.hostname if event.node else '-')}</td><td>{escape(event.msg_type)}</td></tr>"
        for event in events
    ) or '<tr><td colspan="3">No events yet.</td></tr>'
    job_rows = "\n".join(
        f"<tr><td>{job.queued_at:%H:%M:%S}</td><td>{escape(job.node.hostname)}</td><td>{escape(job.job_type)}</td><td>{escape(job.status)}</td></tr>"
        for job in jobs
    ) or '<tr><td colspan="4">No jobs yet.</td></tr>'

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>EHPanel Web Ops</title>
  <style>
    :root {{ color-scheme: dark; --bg:#0b1020; --panel:#121a2e; --line:#27324d; --text:#e8edf7; --muted:#9aa7bd; --ok:#29d391; --warn:#f4b740; }}
    * {{ box-sizing:border-box; }}
    body {{ margin:0; font-family:Inter,Segoe UI,Arial,sans-serif; background:var(--bg); color:var(--text); }}
    header {{ padding:22px 28px; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center; }}
    h1 {{ margin:0; font-size:20px; letter-spacing:0; }}
    main {{ padding:24px 28px; display:grid; gap:18px; }}
    .grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:18px; }}
    .card {{ background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:18px; }}
    .top {{ display:flex; justify-content:space-between; gap:12px; align-items:start; }}
    .host {{ font-size:18px; font-weight:700; }}
    .muted {{ color:var(--muted); font-size:13px; }}
    .badge {{ padding:5px 9px; border-radius:999px; font-size:12px; font-weight:700; border:1px solid var(--line); }}
    .online {{ color:#06140e; background:var(--ok); border-color:var(--ok); }}
    .offline {{ color:#191103; background:var(--warn); border-color:var(--warn); }}
    .metrics {{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:16px 0; }}
    .metric {{ border:1px solid var(--line); border-radius:8px; padding:10px; }}
    .metric b {{ display:block; font-size:17px; margin-top:4px; }}
    .services {{ display:flex; flex-wrap:wrap; gap:7px; margin-top:12px; }}
    .svc {{ font-size:12px; color:var(--muted); border:1px solid var(--line); padding:5px 7px; border-radius:6px; }}
    table {{ width:100%; border-collapse:collapse; }}
    th,td {{ text-align:left; padding:10px 8px; border-bottom:1px solid var(--line); font-size:13px; }}
    th {{ color:var(--muted); font-weight:600; }}
    .empty {{ color:var(--muted); padding:24px; border:1px dashed var(--line); border-radius:8px; }}
  </style>
</head>
<body>
  <header>
    <h1>EHPanel Web Ops</h1>
    <div class="muted">{now:%Y-%m-%d %H:%M:%S %Z}</div>
  </header>
  <main>
    <section class="grid">{node_cards}</section>
    <section class="card">
      <div class="top"><div><div class="host">Agent jobs</div><div class="muted">Latest 20 orchestration jobs queued by the panel</div></div></div>
      <table><thead><tr><th>Time</th><th>Node</th><th>Job</th><th>Status</th></tr></thead><tbody>{job_rows}</tbody></table>
    </section>
    <section class="card">
      <div class="top"><div><div class="host">Agent events</div><div class="muted">Latest 20 messages persisted by the panel</div></div></div>
      <table><thead><tr><th>Time</th><th>Node</th><th>Message</th></tr></thead><tbody>{event_rows}</tbody></table>
    </section>
  </main>
</body>
</html>"""
    return HttpResponse(html)


def render_node(node, now):
    age = "never"
    if node.last_seen_at:
        age = f"{int((now - node.last_seen_at).total_seconds())}s ago"

    system = (node.last_telemetry or {}).get("system", {})
    services = (node.capabilities or {}).get("services", [])
    service_names = [str(service.get("name", "-")) for service in services[:24] if isinstance(service, dict)]
    service_tags = "\n".join(f'<span class="svc">{escape(name)}</span>' for name in service_names) or '<span class="svc">no services</span>'
    state_class = "online" if node.state == Node.State.ONLINE else "offline"

    return f"""
<article class="card">
  <div class="top">
    <div>
      <div class="host">{escape(node.hostname)}</div>
      <div class="muted">{escape(node.agent_type)} agent {escape(node.agent_version or '-')} | last seen {escape(age)}</div>
    </div>
    <span class="badge {state_class}">{escape(node.state)}</span>
  </div>
  <div class="metrics">
    <div class="metric"><span class="muted">CPU</span><b>{escape(str(system.get("cpu_pct", "-")))}%</b></div>
    <div class="metric"><span class="muted">RAM</span><b>{escape(str(system.get("ram_used_mb", "-")))}/{escape(str(system.get("ram_total_mb", "-")))} MB</b></div>
    <div class="metric"><span class="muted">Disk</span><b>{escape(str(system.get("disk_used_gb", "-")))}/{escape(str(system.get("disk_total_gb", "-")))} GB</b></div>
    <div class="metric"><span class="muted">Load</span><b>{escape(str(system.get("load_1m", "-")))}</b></div>
  </div>
  <div class="muted">Reported services</div>
  <div class="services">{service_tags}</div>
</article>"""
