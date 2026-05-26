import hashlib
import re
import secrets
import socket
import uuid
from datetime import timedelta

from django.conf import settings
from django import get_version as django_version
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status as drf_status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from agents.models import AgentJob, Node
from .local_provisioning import ensure_local_node, is_local_provisioning_enabled
from .models import ApiKeyCredential, AuditLog, GlobalConfiguration, HostingAccount, HostingPlan
from .services import change_account_password, node_public_ip, provision_hosting_account, queue_account_job, suspend_account, unsuspend_account


class BillingInternalTokenPermission(BasePermission):
    message = "Token interno de Billing invalido o no configurado."

    def has_permission(self, request, view):
        request.billing_auth = {"type": "none", "scopes": []}
        if self._has_legacy_token(request):
            request.billing_auth = {"type": "legacy-token", "scopes": ["billing:admin"]}
            return True

        credential = self._api_key_credential(request)
        if credential is None:
            return False
        if credential.route and not request.path.startswith(credential.route):
            self.message = "Clave API no autorizada para esta ruta."
            return False

        scopes = credential.scopes if isinstance(credential.scopes, list) else []
        required_scopes = self._required_scopes(request, view)
        if not self._has_required_scope(scopes, required_scopes):
            self.message = "Clave API sin scope requerido para esta accion."
            return False

        credential.last_used_at = timezone.now()
        credential.save(update_fields=["last_used_at", "updated_at"])
        request.billing_auth = {
            "type": "api-key",
            "credential_id": str(credential.id),
            "key_prefix": credential.key_prefix,
            "scopes": scopes,
        }
        return True

    def _has_legacy_token(self, request):
        expected = getattr(settings, "INTERNAL_BILLING_API_TOKEN", "") or getattr(settings, "BILLING_WEBHOOK_TOKEN", "")
        header = request.headers.get("Authorization", "")
        if not expected or not header.startswith("Bearer "):
            return False
        provided = header.removeprefix("Bearer ").strip()
        return secrets.compare_digest(provided, expected)

    def _api_key_credential(self, request):
        token = self._extract_api_key_token(request)
        if not token:
            return None
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        return (
            ApiKeyCredential.objects.select_related("created_by")
            .filter(key_hash=token_hash, status=ApiKeyCredential.Status.ACTIVE)
            .first()
        )

    def _extract_api_key_token(self, request):
        header = request.headers.get("Authorization", "").strip()
        if header.startswith("Bearer ehp_"):
            return header.removeprefix("Bearer ").strip()
        if header.startswith("Api-Key "):
            return header.removeprefix("Api-Key ").strip()
        token = request.headers.get("X-EHPanel-API-Key") or request.headers.get("X-EHPANEL-API-KEY")
        return token.strip() if isinstance(token, str) and token.strip() else ""

    def _required_scopes(self, request, view):
        action = getattr(view, "action", None)
        scope_map = getattr(view, "billing_scope_map", {}) or {}
        if action and action in scope_map:
            return tuple(scope_map[action])
        if hasattr(view, "billing_required_scopes"):
            return tuple(view.billing_required_scopes)
        return ("billing:read",) if request.method in ("GET", "HEAD", "OPTIONS") else ("billing:write",)

    def _has_required_scope(self, scopes, required_scopes):
        scope_set = {str(scope).strip() for scope in scopes if str(scope).strip()}
        if "billing:admin" in scope_set or "billing:*" in scope_set:
            return True
        if not required_scopes:
            return True
        if "billing:write" in scope_set or "write" in scope_set:
            return True
        if set(required_scopes) & scope_set:
            return True
        if any(scope.endswith(":read") for scope in required_scopes) and ({"billing:read", "read"} & scope_set):
            return True
        return False


TECHNICAL_TO_BILLING_STATUS = {
    HostingAccount.Status.ACTIVE: "active",
    HostingAccount.Status.PENDING: "pending",
    HostingAccount.Status.PROVISIONING: "pending",
    HostingAccount.Status.FAILED: "pending",
    HostingAccount.Status.SUSPENDED: "suspended",
    HostingAccount.Status.DELETED: "cancelled",
}

BILLING_TO_TECHNICAL_STATUS = {
    "activo": HostingAccount.Status.ACTIVE,
    "pendiente": HostingAccount.Status.PENDING,
    "suspendido": HostingAccount.Status.SUSPENDED,
    "vencido": HostingAccount.Status.SUSPENDED,
    "cancelado": HostingAccount.Status.SUSPENDED,
}


def account_public_status(account):
    if account.billing_status == "cancelado":
        return "cancelled"
    return TECHNICAL_TO_BILLING_STATUS.get(account.status, "pending")


def normalize_external_id(value):
    return str(value or "").strip()


def generated_username(domain):
    base = re.sub(r"[^a-z0-9]", "", str(domain).split(".")[0].lower())[:24] or "site"
    if not base[0].isalpha():
        base = f"u{base}"[:24]
    candidate = base
    suffix = 2
    while HostingAccount.objects.filter(username=candidate).exists():
        candidate = f"{base[: max(1, 24 - len(str(suffix)))]}{suffix}"
        suffix += 1
    return candidate


def normalize_username(value, domain):
    raw = re.sub(r"[^a-z0-9-]", "", str(value or "").strip().lower())[:32]
    if not raw or not raw[0].isalpha():
        raw = generated_username(domain)
    return raw


def generated_password():
    return f"{secrets.token_urlsafe(18)}Aa1!"


def first_available_node():
    if is_local_provisioning_enabled():
        return ensure_local_node()
    config = GlobalConfiguration.current()
    if config.default_node_id:
        return config.default_node
    return Node.objects.filter(state=Node.State.ONLINE).order_by("hostname").first() or Node.objects.exclude(state=Node.State.DISABLED).order_by("hostname").first()


def find_plan(identifier):
    value = str(identifier or "").strip()
    if not value:
        return None
    return HostingPlan.objects.filter(Q(slug__iexact=value) | Q(name__iexact=value), is_active=True).order_by("name").first()


def serialize_contract_plan(plan):
    return {
        "id": plan.slug,
        "name": plan.name,
        "status": "active" if plan.is_active else "inactive",
        "description": (plan.features or {}).get("description", ""),
        "limits": {
            "disk_mb": plan.disk_mb,
            "bandwidth_mb": plan.bandwidth_mb,
            "mailboxes": plan.max_mailboxes,
            "databases": plan.max_databases,
            "domains": plan.max_domains,
            "memory_mb": plan.memory_mb,
            "cpu_pct": plan.cpu_pct,
        },
    }


def datacenter_for_node(node):
    capabilities = node.capabilities if node and isinstance(node.capabilities, dict) else {}
    return capabilities.get("datacenter") or capabilities.get("location") or capabilities.get("region") or ""


def panel_url_for_request(request, account):
    base_url = getattr(settings, "PUBLIC_PANEL_URL", "") or request.build_absolute_uri("/").rstrip("/")
    return f"{base_url}/client/services/{account.id}"


def contract_account_response(request, account, status_value=None, message=""):
    account_status = status_value or ("provisioned" if account.status == HostingAccount.Status.ACTIVE else "queued")
    return {
        "ok": True,
        "status": account_status,
        "external_service_id": str(account.id),
        "domain": account.primary_domain,
        "username": account.username,
        "panel_url": panel_url_for_request(request, account),
        "login_url": (getattr(settings, "PUBLIC_PANEL_URL", "") or request.build_absolute_uri("/").rstrip("/")),
        "server": {
            "hostname": account.node.hostname if account.node_id else socket.gethostname(),
            "datacenter": datacenter_for_node(account.node),
        },
        "message": message or "Cuenta procesada correctamente",
    }


def billing_metadata(account, **updates):
    current = account.billing_metadata if isinstance(account.billing_metadata, dict) else {}
    return {**current, **updates}


def client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    remote_addr = request.META.get("REMOTE_ADDR") or None
    if forwarded_for and remote_addr in getattr(settings, "TRUSTED_PROXY_IPS", []):
        return forwarded_for.split(",")[0].strip() or None
    return remote_addr


def audit_billing_call(request, action, account=None, status_code=200, metadata=None):
    try:
        AuditLog.objects.create(
            user=request.user if request.user and request.user.is_authenticated else None,
            action=action,
            account=account,
            target_type="billing-api",
            target_id=str(account.id) if account else "",
            target_label=account.primary_domain if account else "EHPanel Billing",
            ip=client_ip(request),
            metadata={
                "method": request.method,
                "path": request.path,
                "status_code": status_code,
                "billing_auth": getattr(request, "billing_auth", {}),
                **(metadata or {}),
            },
        )
    except Exception:
        pass


def get_action_request_id(validated_data):
    return normalize_external_id(validated_data.get("request_id"))


def stored_action_request(account, request_id, action_name):
    if not request_id:
        return None
    metadata = account.billing_metadata if isinstance(account.billing_metadata, dict) else {}
    requests = metadata.get("action_requests") if isinstance(metadata.get("action_requests"), dict) else {}
    entry = requests.get(request_id)
    if not isinstance(entry, dict) or entry.get("action") != action_name:
        return None
    return entry


def remember_action_request(account, request_id, action_name, status_value, message):
    if not request_id:
        return
    metadata = account.billing_metadata if isinstance(account.billing_metadata, dict) else {}
    requests = metadata.get("action_requests") if isinstance(metadata.get("action_requests"), dict) else {}
    requests[request_id] = {
        "action": action_name,
        "status": status_value,
        "message": message,
        "processed_at": timezone.now().isoformat(),
    }
    if len(requests) > 100:
        requests = dict(list(requests.items())[-100:])
    account.billing_metadata = {**metadata, "action_requests": requests, "last_action": action_name}


class BillingHostingAccountSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    plan = serializers.SerializerMethodField()
    server = serializers.CharField(source="node.hostname", read_only=True)

    class Meta:
        model = HostingAccount
        fields = [
            "id",
            "customer_name",
            "customer_email",
            "primary_domain",
            "status",
            "plan",
            "server",
            "created_at",
            "updated_at",
            "billing_client_id",
            "billing_service_id",
        ]

    def get_status(self, obj):
        return account_public_status(obj)

    def get_plan(self, obj):
        if not obj.plan_id:
            return ""
        return obj.plan.slug or obj.plan.name


class BillingLinkSerializer(serializers.Serializer):
    billing_client_id = serializers.CharField(max_length=80)
    billing_service_id = serializers.CharField(max_length=80)


class BillingSyncStatusSerializer(serializers.Serializer):
    billing_status = serializers.ChoiceField(choices=["activo", "pendiente", "suspendido", "cancelado", "vencido"])
    reason = serializers.CharField(required=False, allow_blank=True, max_length=255)


class BillingSuspendSerializer(serializers.Serializer):
    request_id = serializers.CharField(required=False, allow_blank=True, max_length=160)
    reason = serializers.ChoiceField(choices=["payment_overdue", "manual", "cancelled"], required=False, default="manual")
    notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class BillingUnsuspendSerializer(serializers.Serializer):
    request_id = serializers.CharField(required=False, allow_blank=True, max_length=160)
    reason = serializers.ChoiceField(choices=["payment_received", "manual"], required=False, default="manual")
    notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class BillingProvisionSerializer(serializers.Serializer):
    billing_client_id = serializers.CharField(max_length=80)
    billing_service_id = serializers.CharField(max_length=80)
    domain = serializers.CharField(max_length=255)
    plan = serializers.CharField(max_length=120)
    customer_email = serializers.EmailField()


class ContractProvisionSerializer(serializers.Serializer):
    request_id = serializers.CharField(max_length=160)
    billing = serializers.DictField()
    client = serializers.DictField()
    service = serializers.DictField()
    metadata = serializers.DictField(required=False)

    def validate(self, attrs):
        service = attrs["service"]
        client = attrs["client"]
        billing = attrs["billing"]
        required_service = ["domain", "username", "password", "plan_id"]
        missing = [key for key in required_service if not str(service.get(key) or "").strip()]
        if missing:
            raise serializers.ValidationError({"service": f"Faltan campos: {', '.join(missing)}"})
        if not str(client.get("email") or "").strip():
            raise serializers.ValidationError({"client": "El email del cliente es requerido."})
        if not str(billing.get("service_id") or "").strip():
            raise serializers.ValidationError({"billing": "service_id es requerido."})
        return attrs


class ContractChangePasswordSerializer(serializers.Serializer):
    request_id = serializers.CharField(required=False, allow_blank=True, max_length=160)
    password = serializers.CharField(min_length=8, max_length=255)


class ContractChangePlanSerializer(serializers.Serializer):
    request_id = serializers.CharField(required=False, allow_blank=True, max_length=160)
    plan_id = serializers.CharField(max_length=120)
    plan_name = serializers.CharField(required=False, allow_blank=True, max_length=160)


class BillingHealthView(APIView):
    authentication_classes = []
    permission_classes = [BillingInternalTokenPermission]
    billing_required_scopes = ("billing:read",)

    def get(self, _request):
        return Response({
            "ok": True,
            "status": "ok",
            "service": "ehpanel-web",
            "billing_bridge": True,
            "version": getattr(settings, "APP_VERSION", "dev"),
            "django": django_version(),
            "environment": getattr(settings, "ENVIRONMENT", "production"),
            "hostname": socket.gethostname(),
            "server_time": timezone.now().isoformat(),
        })


class BillingPlansActiveView(APIView):
    authentication_classes = []
    permission_classes = [BillingInternalTokenPermission]
    billing_required_scopes = ("billing:read",)

    def get(self, _request):
        plans = HostingPlan.objects.filter(is_active=True).order_by("name")
        return Response({"plans": [serialize_contract_plan(plan) for plan in plans]})


class BillingServiceProvisionView(APIView):
    authentication_classes = []
    permission_classes = [BillingInternalTokenPermission]
    billing_required_scopes = ("billing:provision",)

    def post(self, request):
        serializer = ContractProvisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        request_id = normalize_external_id(payload["request_id"])
        billing = payload["billing"]
        client = payload["client"]
        service = payload["service"]
        metadata = payload.get("metadata") or {}
        billing_service_id = normalize_external_id(billing.get("service_id"))
        domain = str(service.get("domain") or "").strip().lower()
        username = normalize_username(service.get("username"), domain)
        password = str(service.get("password") or "").strip()
        plan = find_plan(service.get("plan_id") or service.get("plan_name"))
        if not plan:
            return Response(
                {"ok": False, "status": "failed", "error_code": "PLAN_NOT_FOUND", "detail": "El plan solicitado no existe en este panel", "retryable": False},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        account = HostingAccount.objects.filter(billing_metadata__request_id=request_id).first()
        if account is None:
            account = HostingAccount.objects.filter(billing_service_id=billing_service_id).first()
        if account is None:
            account = HostingAccount.objects.filter(primary_domain__iexact=domain).first()

        if account is None:
            node = first_available_node()
            if node is None:
                return Response(
                    {"ok": False, "status": "failed", "error_code": "NO_NODE_AVAILABLE", "detail": "No existe un nodo disponible para aprovisionar.", "retryable": True},
                    status=drf_status.HTTP_409_CONFLICT,
                )
            if HostingAccount.objects.filter(username__iexact=username).exists():
                return Response(
                    {"ok": False, "status": "failed", "error_code": "USERNAME_EXISTS", "detail": "El usuario solicitado ya existe en este panel", "retryable": False},
                    status=drf_status.HTTP_409_CONFLICT,
                )
            with transaction.atomic():
                account = HostingAccount.objects.create(
                    node=node,
                    plan=plan,
                    username=username,
                    primary_domain=domain,
                    customer_email=client["email"],
                    customer_name=client.get("name") or client["email"].split("@")[0],
                    web_engine=HostingAccount.WebEngine.OPENLITESPEED,
                    php_version="8.3",
                    disk_mb=plan.disk_mb,
                    bandwidth_mb=plan.bandwidth_mb,
                    memory_mb=plan.memory_mb,
                    cpu_pct=plan.cpu_pct,
                    billing_client_id=normalize_external_id(client.get("id")),
                    billing_service_id=billing_service_id,
                    billing_synced_at=timezone.now(),
                    billing_status="activo",
                    billing_metadata={"request_id": request_id, "billing": billing, "metadata": metadata, "addons": service.get("addons") or [], "last_action": "provision"},
                )
                provision_hosting_account(
                    account,
                    {
                        "account_password": password,
                        "public_ip": node_public_ip(node),
                        "ssl_email": client["email"],
                        "ssl_staging": metadata.get("environment") != "production",
                        "ssl_force_renewal": False,
                        "dns_records": [],
                    },
                )
            audit_billing_call(request, AuditLog.Action.ACCOUNT_CREATED, account, status_code=202, metadata={"request_id": request_id, "billing_service_id": billing_service_id})
            return Response(contract_account_response(request, account, status_value="queued", message="Provisionamiento en cola"), status=drf_status.HTTP_202_ACCEPTED)

        if account.billing_service_id and account.billing_service_id != billing_service_id:
            return Response(
                {"ok": False, "status": "failed", "error_code": "DOMAIN_ALREADY_LINKED", "detail": "El dominio ya pertenece a otro servicio Billing.", "retryable": False},
                status=drf_status.HTTP_409_CONFLICT,
            )
        account.plan = plan
        account.customer_email = client["email"]
        account.customer_name = client.get("name") or account.customer_name
        account.billing_client_id = normalize_external_id(client.get("id"))
        account.billing_service_id = billing_service_id
        account.billing_synced_at = timezone.now()
        account.billing_status = account.billing_status or "activo"
        account.billing_metadata = billing_metadata(account, request_id=request_id, billing=billing, metadata=metadata, addons=service.get("addons") or [], last_action="provision-idempotent")
        account.save(update_fields=["plan", "customer_email", "customer_name", "billing_client_id", "billing_service_id", "billing_synced_at", "billing_status", "billing_metadata", "updated_at"])
        audit_billing_call(request, AuditLog.Action.ACCOUNT_SYNCED, account, metadata={"request_id": request_id, "billing_service_id": billing_service_id, "idempotent": True})
        return Response(contract_account_response(request, account, status_value="provisioned" if account.status == HostingAccount.Status.ACTIVE else "queued", message="Orden ya procesada"))


class BillingServiceDetailView(APIView):
    authentication_classes = []
    permission_classes = [BillingInternalTokenPermission]
    billing_required_scopes = ("billing:read",)

    def get_account(self, external_service_id):
        lookup = normalize_external_id(external_service_id)
        query = Q(billing_service_id=lookup)
        try:
            query |= Q(pk=uuid.UUID(lookup))
        except (TypeError, ValueError):
            pass
        account = HostingAccount.objects.select_related("node", "plan").filter(query).first()
        if not account:
            from rest_framework.exceptions import NotFound

            raise NotFound("Cuenta hosting no encontrada.")
        return account

    def get(self, request, external_service_id):
        account = self.get_account(external_service_id)
        return Response(contract_account_response(request, account, status_value=account_public_status(account), message="Estado consultado"))

    def usage_payload(self, account):
        usage = account.last_usage if isinstance(account.last_usage, dict) else {}
        return {
            "disk": {"used_mb": usage.get("disk_used_mb", usage.get("disk_mb", 0)), "limit_mb": account.disk_mb},
            "bandwidth": {"used_mb": usage.get("bandwidth_used_mb", usage.get("bandwidth_mb", 0)), "limit_mb": account.bandwidth_mb},
            "mailboxes": {"used": account.mailboxes.count(), "limit": account.plan.max_mailboxes if account.plan else 0},
            "databases": {"used": account.databases.count(), "limit": account.plan.max_databases if account.plan else 0},
            "domains": {"used": account.domains.count(), "limit": account.plan.max_domains if account.plan else 0},
            "technical_status": account.status,
            "last_usage_at": account.last_usage_at.isoformat() if account.last_usage_at else "",
        }

    def post_action_response(self, request, account, status_value, message, request_id="", action_name=""):
        account.billing_synced_at = timezone.now()
        account.billing_metadata = billing_metadata(account, last_action=status_value)
        remember_action_request(account, request_id, action_name or status_value, status_value, message)
        account.save(update_fields=["billing_synced_at", "billing_metadata", "updated_at"])
        audit_billing_call(request, AuditLog.Action.ACCOUNT_UPDATED, account, status_code=202, metadata={"request_id": request_id, "billing_action": action_name or status_value})
        return Response(contract_account_response(request, account, status_value=status_value, message=message), status=drf_status.HTTP_202_ACCEPTED)

    def idempotent_action_response(self, request, account, request_id, action_name):
        entry = stored_action_request(account, request_id, action_name)
        if not entry:
            return None
        response = contract_account_response(request, account, status_value=entry.get("status"), message=entry.get("message", "Orden ya procesada"))
        response["idempotent"] = True
        response["request_id"] = request_id
        audit_billing_call(request, AuditLog.Action.ACCOUNT_SYNCED, account, metadata={"request_id": request_id, "billing_action": action_name, "idempotent": True})
        return Response(response)

    def suspend(self, request, external_service_id):
        account = self.get_account(external_service_id)
        serializer = BillingSuspendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_id = get_action_request_id(serializer.validated_data)
        existing = self.idempotent_action_response(request, account, request_id, "suspend")
        if existing:
            return existing
        if account.status != HostingAccount.Status.SUSPENDED:
            suspend_account(account)
        account.billing_status = "suspendido"
        account.save(update_fields=["billing_status", "updated_at"])
        return self.post_action_response(request, account, "suspended", "Cuenta suspendida", request_id=request_id, action_name="suspend")

    def unsuspend(self, request, external_service_id):
        account = self.get_account(external_service_id)
        serializer = BillingUnsuspendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_id = get_action_request_id(serializer.validated_data)
        existing = self.idempotent_action_response(request, account, request_id, "unsuspend")
        if existing:
            return existing
        if account.status == HostingAccount.Status.SUSPENDED:
            unsuspend_account(account)
        account.billing_status = "activo"
        account.save(update_fields=["billing_status", "updated_at"])
        return self.post_action_response(request, account, "active", "Cuenta reactivada", request_id=request_id, action_name="unsuspend")

    def terminate(self, request, external_service_id):
        account = self.get_account(external_service_id)
        serializer = BillingActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_id = get_action_request_id(serializer.validated_data)
        existing = self.idempotent_action_response(request, account, request_id, "terminate")
        if existing:
            return existing
        if account.status != HostingAccount.Status.DELETED:
            account.status = HostingAccount.Status.DELETED
            account.billing_status = "cancelado"
            account.save(update_fields=["status", "billing_status", "updated_at"])
            queue_account_job(account, AgentJob.Type.DELETE_ACCOUNT, {"username": account.username, "domain": account.primary_domain})
        return self.post_action_response(request, account, "terminated", "Cuenta terminada", request_id=request_id, action_name="terminate")

    def change_password(self, request, external_service_id):
        account = self.get_account(external_service_id)
        serializer = ContractChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_id = get_action_request_id(serializer.validated_data)
        existing = self.idempotent_action_response(request, account, request_id, "change-password")
        if existing:
            return existing
        change_account_password(account, serializer.validated_data["password"])
        return self.post_action_response(request, account, "password_changed", "Password enviado al panel", request_id=request_id, action_name="change-password")

    def change_plan(self, request, external_service_id):
        account = self.get_account(external_service_id)
        serializer = ContractChangePlanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_id = get_action_request_id(serializer.validated_data)
        existing = self.idempotent_action_response(request, account, request_id, "change-plan")
        if existing:
            return existing
        plan = find_plan(serializer.validated_data["plan_id"] or serializer.validated_data.get("plan_name"))
        if not plan:
            return Response(
                {"ok": False, "status": "failed", "error_code": "PLAN_NOT_FOUND", "detail": "El plan solicitado no existe en este panel", "retryable": False},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        account.plan = plan
        account.disk_mb = plan.disk_mb
        account.bandwidth_mb = plan.bandwidth_mb
        account.memory_mb = plan.memory_mb
        account.cpu_pct = plan.cpu_pct
        account.save(update_fields=["plan", "disk_mb", "bandwidth_mb", "memory_mb", "cpu_pct", "updated_at"])
        return self.post_action_response(request, account, "plan_changed", "Plan actualizado", request_id=request_id, action_name="change-plan")

    def usage(self, request, external_service_id):
        account = self.get_account(external_service_id)
        if is_local_provisioning_enabled() and account.status == HostingAccount.Status.ACTIVE:
            from .services import collect_account_usage

            collect_account_usage(account, wait=True)
            account.refresh_from_db()
        return Response({"ok": True, "status": "ok", "external_service_id": str(account.id), "usage": self.usage_payload(account)})

    def status_payload(self, request, account):
        latest_job = account.jobs.order_by("-queued_at").first() if hasattr(account, "jobs") else None
        payload = contract_account_response(request, account, status_value=account_public_status(account), message="Estado consultado")
        payload["billing"] = {
            "client_id": account.billing_client_id,
            "service_id": account.billing_service_id,
            "status": account.billing_status,
            "last_sync_at": account.billing_synced_at.isoformat() if account.billing_synced_at else "",
        }
        payload["technical"] = {
            "status": account.status,
            "plan": account.plan.slug if account.plan_id else "",
            "web_engine": account.web_engine,
            "php_version": account.php_version,
            "last_usage_at": account.last_usage_at.isoformat() if account.last_usage_at else "",
        }
        payload["latest_job"] = {
            "id": str(latest_job.id),
            "type": latest_job.job_type,
            "status": latest_job.status,
            "error_code": latest_job.error_code,
            "error_detail": latest_job.error_detail,
            "queued_at": latest_job.queued_at.isoformat() if latest_job.queued_at else "",
            "finished_at": latest_job.finished_at.isoformat() if latest_job.finished_at else "",
        } if latest_job else None
        return payload


class BillingServiceSuspendView(BillingServiceDetailView):
    billing_required_scopes = ("billing:suspend",)

    def post(self, request, external_service_id):
        return self.suspend(request, external_service_id)


class BillingServiceUnsuspendView(BillingServiceDetailView):
    billing_required_scopes = ("billing:suspend",)

    def post(self, request, external_service_id):
        return self.unsuspend(request, external_service_id)


class BillingServiceTerminateView(BillingServiceDetailView):
    billing_required_scopes = ("billing:terminate",)

    def post(self, request, external_service_id):
        return self.terminate(request, external_service_id)


class BillingServiceChangePasswordView(BillingServiceDetailView):
    billing_required_scopes = ("billing:write",)

    def post(self, request, external_service_id):
        return self.change_password(request, external_service_id)


class BillingServiceChangePlanView(BillingServiceDetailView):
    billing_required_scopes = ("billing:write",)

    def post(self, request, external_service_id):
        return self.change_plan(request, external_service_id)


class BillingServiceUsageView(BillingServiceDetailView):
    billing_required_scopes = ("billing:usage", "billing:read")

    def get(self, request, external_service_id):
        return self.usage(request, external_service_id)


class BillingServiceStatusView(BillingServiceDetailView):
    def get(self, request, external_service_id):
        account = self.get_account(external_service_id)
        return Response(self.status_payload(request, account))


class BillingActionSerializer(serializers.Serializer):
    request_id = serializers.CharField(required=False, allow_blank=True, max_length=160)


class BillingAuthCheckView(APIView):
    authentication_classes = []
    permission_classes = [BillingInternalTokenPermission]
    billing_required_scopes = ("billing:read",)

    def get(self, request):
        return Response({
            "ok": True,
            "status": "authorized",
            "service": "ehpanel-web",
            "auth": getattr(request, "billing_auth", {}),
            "server_time": timezone.now().isoformat(),
        })


class BillingNodeSummaryView(APIView):
    authentication_classes = []
    permission_classes = [BillingInternalTokenPermission]
    billing_required_scopes = ("billing:read", "billing:usage")

    def get(self, _request):
        since = timezone.now() - timedelta(hours=24)
        local_node = first_available_node()
        jobs = AgentJob.objects.filter(queued_at__gte=since)
        return Response({
            "ok": True,
            "status": "ok",
            "service": "ehpanel-web",
            "hostname": socket.gethostname(),
            "node": {
                "id": str(local_node.id) if local_node else "",
                "hostname": local_node.hostname if local_node else socket.gethostname(),
                "state": local_node.effective_state if local_node else "local",
                "last_seen_at": local_node.last_seen_at.isoformat() if local_node and local_node.last_seen_at else "",
                "telemetry": local_node.last_telemetry if local_node and isinstance(local_node.last_telemetry, dict) else {},
            },
            "accounts": {
                "total": HostingAccount.objects.count(),
                "active": HostingAccount.objects.filter(status=HostingAccount.Status.ACTIVE).count(),
                "pending": HostingAccount.objects.filter(status__in=[HostingAccount.Status.PENDING, HostingAccount.Status.PROVISIONING, HostingAccount.Status.FAILED]).count(),
                "suspended": HostingAccount.objects.filter(status=HostingAccount.Status.SUSPENDED).count(),
                "deleted": HostingAccount.objects.filter(status=HostingAccount.Status.DELETED).count(),
            },
            "plans": {
                "active": HostingPlan.objects.filter(is_active=True).count(),
            },
            "jobs_24h": {
                "total": jobs.count(),
                "queued": jobs.filter(status=AgentJob.Status.QUEUED).count(),
                "running": jobs.filter(status__in=[AgentJob.Status.SENT, AgentJob.Status.RUNNING]).count(),
                "success": jobs.filter(status=AgentJob.Status.SUCCESS).count(),
                "failed": jobs.filter(status__in=[AgentJob.Status.FAILED, AgentJob.Status.CANCELED, AgentJob.Status.EXPIRED]).count(),
            },
            "server_time": timezone.now().isoformat(),
        })


class BillingHostingAccountViewSet(viewsets.ViewSet):
    authentication_classes = []
    permission_classes = [BillingInternalTokenPermission]
    billing_scope_map = {
        "list": ("billing:read",),
        "retrieve": ("billing:read",),
        "link": ("billing:write",),
        "sync_status": ("billing:write",),
        "suspend": ("billing:suspend",),
        "unsuspend": ("billing:suspend",),
        "provision": ("billing:provision",),
    }

    def get_queryset(self):
        queryset = HostingAccount.objects.select_related("node", "plan").all()
        params = self.request.query_params
        email = params.get("email")
        domain = params.get("domain")
        status_filter = params.get("status")
        billing_client_id = params.get("billing_client_id")
        billing_service_id = params.get("billing_service_id")
        if email:
            queryset = queryset.filter(customer_email__icontains=email)
        if domain:
            queryset = queryset.filter(primary_domain__icontains=domain)
        if status_filter:
            if status_filter in {"cancelled", "cancelado"}:
                queryset = queryset.filter(Q(status=HostingAccount.Status.DELETED) | Q(billing_status="cancelado"))
            else:
                reverse_map = {
                    "active": [HostingAccount.Status.ACTIVE],
                    "activo": [HostingAccount.Status.ACTIVE],
                    "pending": [HostingAccount.Status.PENDING, HostingAccount.Status.PROVISIONING, HostingAccount.Status.FAILED],
                    "pendiente": [HostingAccount.Status.PENDING, HostingAccount.Status.PROVISIONING, HostingAccount.Status.FAILED],
                    "suspended": [HostingAccount.Status.SUSPENDED],
                    "suspendido": [HostingAccount.Status.SUSPENDED],
                    "vencido": [HostingAccount.Status.SUSPENDED],
                }
                queryset = queryset.filter(status__in=reverse_map.get(status_filter, [status_filter]))
        if billing_client_id:
            queryset = queryset.filter(billing_client_id=normalize_external_id(billing_client_id))
        if billing_service_id:
            queryset = queryset.filter(billing_service_id=normalize_external_id(billing_service_id))
        return queryset.order_by("primary_domain")

    def get_object(self):
        lookup = str(self.kwargs.get("pk") or "").strip()
        query = Q()
        try:
            query |= Q(pk=uuid.UUID(lookup))
        except (TypeError, ValueError):
            pass
        if lookup:
            query |= Q(billing_service_id=lookup)
        account = HostingAccount.objects.select_related("node", "plan").filter(query).first()
        if account is None:
            from rest_framework.exceptions import NotFound

            raise NotFound("Cuenta hosting no encontrada.")
        self.check_object_permissions(self.request, account)
        return account

    def list(self, _request):
        return Response(BillingHostingAccountSerializer(self.get_queryset(), many=True).data)

    def retrieve(self, _request, pk=None):
        return Response(BillingHostingAccountSerializer(self.get_object()).data)

    @action(detail=True, methods=["post"], url_path="link")
    def link(self, request, pk=None):
        account = self.get_object()
        serializer = BillingLinkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        billing_client_id = normalize_external_id(serializer.validated_data["billing_client_id"])
        billing_service_id = normalize_external_id(serializer.validated_data["billing_service_id"])
        conflict = HostingAccount.objects.filter(billing_service_id=billing_service_id).exclude(pk=account.pk).first()
        if conflict:
            return Response(
                {"detail": "billing_service_id ya esta vinculado a otra cuenta.", "account_id": str(conflict.id)},
                status=drf_status.HTTP_409_CONFLICT,
            )
        account.billing_client_id = billing_client_id
        account.billing_service_id = billing_service_id
        account.billing_synced_at = timezone.now()
        account.billing_metadata = billing_metadata(account, last_action="link")
        account.save(update_fields=["billing_client_id", "billing_service_id", "billing_synced_at", "billing_metadata", "updated_at"])
        return Response(BillingHostingAccountSerializer(account).data)

    @action(detail=True, methods=["post"], url_path="sync-status")
    def sync_status(self, request, pk=None):
        account = self.get_object()
        serializer = BillingSyncStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        billing_status = serializer.validated_data["billing_status"]
        reason = serializer.validated_data.get("reason", "")
        target_status = BILLING_TO_TECHNICAL_STATUS[billing_status]
        if target_status == HostingAccount.Status.SUSPENDED and account.status != HostingAccount.Status.SUSPENDED:
            suspend_account(account)
        elif target_status == HostingAccount.Status.ACTIVE and account.status == HostingAccount.Status.SUSPENDED:
            unsuspend_account(account)
        elif target_status in {HostingAccount.Status.PENDING, HostingAccount.Status.ACTIVE} and account.status not in {HostingAccount.Status.PROVISIONING, HostingAccount.Status.ACTIVE}:
            account.status = target_status
            account.save(update_fields=["status", "updated_at"])
        account.billing_status = billing_status
        account.billing_synced_at = timezone.now()
        account.billing_metadata = billing_metadata(account, last_action="sync-status", reason=reason)
        account.save(update_fields=["billing_status", "billing_synced_at", "billing_metadata", "updated_at"])
        return Response(BillingHostingAccountSerializer(account).data)

    @action(detail=True, methods=["post"], url_path="suspend")
    def suspend(self, request, pk=None):
        account = self.get_object()
        serializer = BillingSuspendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if account.status != HostingAccount.Status.SUSPENDED:
            suspend_account(account)
        account.billing_status = "suspendido" if serializer.validated_data["reason"] != "cancelled" else "cancelado"
        account.billing_synced_at = timezone.now()
        account.billing_metadata = billing_metadata(account, last_action="suspend", **serializer.validated_data)
        account.save(update_fields=["billing_status", "billing_synced_at", "billing_metadata", "updated_at"])
        return Response(BillingHostingAccountSerializer(account).data, status=drf_status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="unsuspend")
    def unsuspend(self, request, pk=None):
        account = self.get_object()
        serializer = BillingUnsuspendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if account.status == HostingAccount.Status.SUSPENDED:
            unsuspend_account(account)
        account.billing_status = "activo"
        account.billing_synced_at = timezone.now()
        account.billing_metadata = billing_metadata(account, last_action="unsuspend", **serializer.validated_data)
        account.save(update_fields=["billing_status", "billing_synced_at", "billing_metadata", "updated_at"])
        return Response(BillingHostingAccountSerializer(account).data, status=drf_status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="provision")
    def provision(self, request, pk=None):
        serializer = BillingProvisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        billing_client_id = normalize_external_id(data["billing_client_id"])
        billing_service_id = normalize_external_id(data["billing_service_id"])
        domain = str(data["domain"]).strip().lower()
        plan = find_plan(data["plan"])
        if not plan:
            return Response({"detail": "Plan hosting no encontrado o inactivo."}, status=drf_status.HTTP_400_BAD_REQUEST)

        account = HostingAccount.objects.filter(billing_service_id=billing_service_id).first()
        if account is None:
            account = HostingAccount.objects.filter(primary_domain__iexact=domain).first()
        if account is None:
            node = first_available_node()
            if node is None:
                return Response({"detail": "No existe un nodo disponible para aprovisionar."}, status=drf_status.HTTP_409_CONFLICT)
            with transaction.atomic():
                account = HostingAccount.objects.create(
                    node=node,
                    plan=plan,
                    username=generated_username(domain),
                    primary_domain=domain,
                    customer_email=data["customer_email"],
                    customer_name=data["customer_email"].split("@")[0],
                    web_engine=HostingAccount.WebEngine.OPENLITESPEED,
                    php_version="8.3",
                    disk_mb=plan.disk_mb,
                    bandwidth_mb=plan.bandwidth_mb,
                    memory_mb=plan.memory_mb,
                    cpu_pct=plan.cpu_pct,
                    billing_client_id=billing_client_id,
                    billing_service_id=billing_service_id,
                    billing_synced_at=timezone.now(),
                    billing_status="activo",
                    billing_metadata={"last_action": "provision", "source": "billing"},
                )
                provision_hosting_account(
                    account,
                    {
                        "account_password": generated_password(),
                        "public_ip": node_public_ip(node),
                        "ssl_email": data["customer_email"],
                        "ssl_staging": False,
                        "ssl_force_renewal": False,
                        "dns_records": [],
                    },
                )
            return Response(BillingHostingAccountSerializer(account).data, status=drf_status.HTTP_202_ACCEPTED)

        if account.billing_service_id and account.billing_service_id != billing_service_id:
            return Response({"detail": "El dominio ya pertenece a otro billing_service_id.", "account_id": str(account.id)}, status=drf_status.HTTP_409_CONFLICT)
        account.plan = plan
        account.customer_email = data["customer_email"]
        account.billing_client_id = billing_client_id
        account.billing_service_id = billing_service_id
        account.billing_synced_at = timezone.now()
        account.billing_status = account.billing_status or "activo"
        account.billing_metadata = billing_metadata(account, last_action="provision-idempotent", source="billing")
        account.save(update_fields=["plan", "customer_email", "billing_client_id", "billing_service_id", "billing_synced_at", "billing_status", "billing_metadata", "updated_at"])
        return Response(BillingHostingAccountSerializer(account).data)
