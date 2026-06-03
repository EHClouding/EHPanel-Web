import secrets
import socket
import subprocess
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from agents.models import AgentJob, Node
from hosting.local_metrics import collect_node_telemetry
from hosting.models import HostingAccount, HostingPlan


def _bearer_token(request):
    header = request.headers.get("Authorization", "").strip()
    if not header.startswith("Bearer "):
        return ""
    return header.removeprefix("Bearer ").strip()


def _core_token_from_request(request):
    return (request.headers.get("X-API-Key") or _bearer_token(request)).strip()


def _core_auth_valid(api_user, api_key):
    expected_user = getattr(settings, "CORE_API_USER", "")
    expected_key = getattr(settings, "CORE_API_KEY", "")
    if not expected_user or not expected_key:
        return False
    return secrets.compare_digest(str(api_user or ""), expected_user) and secrets.compare_digest(str(api_key or ""), expected_key)


def _public_base_url(request):
    configured = getattr(settings, "PUBLIC_PANEL_URL", "").strip()
    if configured:
        return configured.rstrip("/")
    return request.build_absolute_uri("/").rstrip("/")


def core_connection_payload(request=None):
    base_url = _public_base_url(request) if request else getattr(settings, "PUBLIC_PANEL_URL", "").rstrip("/")
    if not base_url:
        hostname = getattr(settings, "LOCAL_PANEL_HOSTNAME", "") or socket.getfqdn() or socket.gethostname()
        base_url = f"https://{hostname}"
    return {
        "panel_type": "web",
        "service": "ehpanel-web",
        "hostname": getattr(settings, "LOCAL_PANEL_HOSTNAME", "") or socket.getfqdn() or socket.gethostname(),
        "api_url": f"{base_url}/api/v1/core",
        "wss_url": f"{base_url.replace('https://', 'wss://').replace('http://', 'ws://')}/ws/core/",
        "api_user": getattr(settings, "CORE_API_USER", ""),
        "version": getattr(settings, "APP_VERSION", "1.0.0"),
    }


class CoreApiPermission(BasePermission):
    message = "Credenciales Core invalidas o no configuradas."

    def has_permission(self, request, _view):
        api_user = request.headers.get("X-API-User", "").strip()
        api_key = _core_token_from_request(request)
        if not _core_auth_valid(api_user, api_key):
            return False
        request.core_auth = {"api_user": api_user}
        return True


def _node_status_payload(request):
    telemetry = collect_node_telemetry()
    services = telemetry.get("services") or []
    service_health = {
        item.get("name"): item.get("status")
        for item in services
        if isinstance(item, dict) and item.get("name")
    }
    accounts = HostingAccount.objects.count()
    active_accounts = HostingAccount.objects.filter(status=HostingAccount.Status.ACTIVE).count()
    pending_jobs = AgentJob.objects.filter(status=AgentJob.Status.QUEUED).count()
    return {
        "ok": True,
        "status": "online",
        "connection": core_connection_payload(request),
        "node": telemetry,
        "summary": {
            "accounts": accounts,
            "active_accounts": active_accounts,
            "plans": HostingPlan.objects.filter(is_active=True).count(),
            "pending_jobs": pending_jobs,
            "service_health": service_health,
        },
        "server_time": timezone.now().isoformat(),
    }


class CoreVerifyView(APIView):
    permission_classes = [CoreApiPermission]
    throttle_scope = "core"

    def get(self, request):
        payload = core_connection_payload(request)
        node = Node.objects.order_by("-last_seen_at", "-updated_at").first()
        return Response(
            {
                "ok": True,
                "status": "online",
                "panel_type": payload["panel_type"],
                "service": payload["service"],
                "hostname": payload["hostname"],
                "version": payload["version"],
                "api_url": payload["api_url"],
                "wss_url": payload["wss_url"],
                "node_state": node.state if node else "online",
                "server_time": timezone.now().isoformat(),
            }
        )

    def post(self, request):
        return self.get(request)


class CoreStatusView(APIView):
    permission_classes = [CoreApiPermission]
    throttle_scope = "core"

    def get(self, request):
        return Response(_node_status_payload(request))


class CoreDeployView(APIView):
    permission_classes = [CoreApiPermission]
    throttle_scope = "core"

    def post(self, request):
        payload = request.data if isinstance(request.data, dict) else {}
        action = str(payload.get("action") or "update").strip().lower()
        response = {
            "ok": True,
            "status": "accepted",
            "action": action,
            "deploy_enabled": bool(getattr(settings, "CORE_ALLOW_DEPLOY", False)),
            "requested_by": payload.get("requested_by") or "EHPanel Core",
            "server_time": timezone.now().isoformat(),
        }
        if not getattr(settings, "CORE_ALLOW_DEPLOY", False):
            response["message"] = "Deploy remoto recibido. Ejecucion deshabilitada en este nodo."
            return Response(response, status=202)

        script = str(getattr(settings, "CORE_DEPLOY_SCRIPT", "") or "").strip()
        if not script:
            response.update({"ok": False, "status": "error", "message": "CORE_DEPLOY_SCRIPT no configurado."})
            return Response(response, status=503)

        try:
            completed = subprocess.run(
                [script, action],
                text=True,
                capture_output=True,
                timeout=int(payload.get("timeout_seconds") or 900),
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            response.update({"ok": False, "status": "error", "message": str(exc)})
            return Response(response, status=503)

        response.update(
            {
                "status": "completed" if completed.returncode == 0 else "failed",
                "returncode": completed.returncode,
                "stdout_tail": completed.stdout[-4000:],
                "stderr_tail": completed.stderr[-4000:],
                "finished_at": (timezone.now() + timedelta(seconds=0)).isoformat(),
            }
        )
        return Response(response, status=200 if completed.returncode == 0 else 503)
