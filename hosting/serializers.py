import ipaddress
import re

from django.utils import timezone
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import transaction

from agents.models import Node
from agents.serializers import AgentJobSerializer

from .models import ApiKeyCredential, AuditLog, BackupPolicy, BackupRestoreRun, BackupStorageDestination, DNSTemplateRecord, GlobalAnnouncement, GlobalConfiguration, GlobalNameserver, HostingAccount, HostingAccountExport, HostingAdvancedItem, HostingApplication, HostingApplicationBackup, HostingDatabase, HostingDatabaseGrant, HostingDatabaseUser, HostingDNSRecord, HostingDomain, HostingFtpUser, HostingIPBlock, HostingMailbox, HostingMonitorAlertRule, HostingMonitorCheck, HostingMonitorIncident, HostingMonitorSnapshot, HostingPerformanceAudit, HostingPlan, HostingProtectedDirectory, HostingResellerProfile, HostingSecurityScan, HostingWafConfiguration, MigrationAccount, MigrationLog, MigrationRun, MigrationSource, MigrationStep, ProvisioningRun, ProvisioningStep, ProvisioningTemplate, ResellerTeamMember, SupportTicket, SupportTicketAttachment, SupportTicketMessage
from .permissions import scoped_accounts, user_can_access_account
from .local_provisioning import ensure_local_node, is_local_provisioning_enabled
from .services import node_public_ip, provision_hosting_account


User = get_user_model()

OPENLITESPEED_SUPPORTED_PHP = {"8.3", "8.4", "8.5"}

DEFAULT_WEB_PROTECTION = {
    "force_https": True,
    "hsts_enabled": False,
    "hsts_include_subdomains": False,
    "hsts_preload": False,
    "hotlink_protection": False,
    "hotlink_allowed_domains": [],
    "basic_bot_block": True,
    "quick_rules": True,
    "ai_diagnostics_mock": False,
}


def _plan_limit_value(value):
    if value in [None, "", False]:
        return None
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"unlimited", "ilimitado", "ilimitada", "infinite", "infinito", "sin_limite", "sin limite"}:
            return None
        try:
            value = int(normalized)
        except ValueError:
            return None
    try:
        value = int(value)
    except (TypeError, ValueError):
        return None
    return None if value < 0 else value


def plan_feature_limit(plan, keys):
    features = plan.features if plan and isinstance(plan.features, dict) else {}
    for key in keys:
        if key in features:
            return _plan_limit_value(features.get(key))
    return None


def validate_web_engine_php(attrs, instance=None):
    web_engine = attrs.get("web_engine")
    php_version = attrs.get("php_version")
    if instance:
        web_engine = web_engine or instance.web_engine
        php_version = php_version or instance.php_version
    if web_engine == HostingAccount.WebEngine.OPENLITESPEED and php_version not in OPENLITESPEED_SUPPORTED_PHP:
        raise serializers.ValidationError({
            "php_version": "OpenLiteSpeed en este nodo tiene LSPHP 8.3, 8.4 y 8.5."
        })


def validate_plan_runtime(attrs, instance=None):
    plan = attrs.get("plan")
    web_engine = attrs.get("web_engine")
    php_version = attrs.get("php_version")
    if instance:
        plan = plan or instance.plan
        web_engine = web_engine or instance.web_engine
        php_version = php_version or instance.php_version
    if not plan:
        return
    if plan.allowed_web_engines and web_engine not in plan.allowed_web_engines:
        raise serializers.ValidationError({
            "web_engine": "El motor web seleccionado no esta permitido por el plan."
        })
    if plan.allowed_php_versions and php_version not in plan.allowed_php_versions:
        raise serializers.ValidationError({
            "php_version": "La version PHP seleccionada no esta permitida por el plan."
        })


class HostingPlanSerializer(serializers.ModelSerializer):
    allowed_web_engines = serializers.ListField(child=serializers.CharField(), required=False)
    allowed_php_versions = serializers.ListField(child=serializers.CharField(), required=False)
    features = serializers.DictField(required=False)

    class Meta:
        model = HostingPlan
        fields = "__all__"

    def validate_cpu_pct(self, value):
        if value > 400:
            raise serializers.ValidationError("El maximo permitido es 400% CPU (4 cores).")
        return value

    def validate_memory_mb(self, value):
        if value > 4096:
            raise serializers.ValidationError("El maximo permitido es 4096 MB (4 GB).")
        return value

    def validate_allowed_web_engines(self, value):
        allowed = {choice[0] for choice in HostingAccount.WebEngine.choices}
        invalid = [item for item in value if item not in allowed]
        if invalid:
            raise serializers.ValidationError(f"Motores no soportados: {', '.join(invalid)}")
        return value

    def validate_allowed_php_versions(self, value):
        valid = {"7.4", "8.0", "8.1", "8.2", "8.3", "8.4", "8.5"}
        invalid = [item for item in value if item not in valid]
        if invalid:
            raise serializers.ValidationError(f"Versiones PHP no soportadas: {', '.join(invalid)}")
        return value

    def validate(self, attrs):
        allowed_web_engines = attrs.get(
            "allowed_web_engines",
            self.instance.allowed_web_engines if self.instance else [],
        )
        allowed_php_versions = attrs.get(
            "allowed_php_versions",
            self.instance.allowed_php_versions if self.instance else [],
        )
        uses_openlitespeed = (
            is_local_provisioning_enabled()
            or not allowed_web_engines
            or HostingAccount.WebEngine.OPENLITESPEED in allowed_web_engines
        )
        invalid_for_openlitespeed = [
            version for version in allowed_php_versions if version not in OPENLITESPEED_SUPPORTED_PHP
        ]
        if uses_openlitespeed and invalid_for_openlitespeed:
            raise serializers.ValidationError({
                "allowed_php_versions": (
                    "OpenLiteSpeed en este nodo solo soporta LSPHP 8.3, 8.4 y 8.5. "
                    f"Quita: {', '.join(invalid_for_openlitespeed)}."
                )
            })
        return attrs


class GlobalConfigurationSerializer(serializers.ModelSerializer):
    default_node_hostname = serializers.CharField(source="default_node.hostname", read_only=True)

    class Meta:
        model = GlobalConfiguration
        fields = [
            "id",
            "key",
            "default_node",
            "default_node_hostname",
            "default_public_ip",
            "dns_defaults",
            "ssl_defaults",
            "mail_defaults",
            "paths",
            "policies",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "key", "default_node_hostname", "created_at", "updated_at"]


class ApiKeyCredentialSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    scopes_label = serializers.SerializerMethodField()

    class Meta:
        model = ApiKeyCredential
        fields = [
            "id",
            "name",
            "owner",
            "route",
            "key_prefix",
            "scopes",
            "scopes_label",
            "status",
            "status_label",
            "notes",
            "last_used_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "key_prefix", "scopes_label", "status_label", "last_used_at", "created_at", "updated_at"]

    def get_scopes_label(self, obj):
        scopes = obj.scopes if isinstance(obj.scopes, list) else []
        return ", ".join(str(scope) for scope in scopes) if scopes else "Sin permisos"

    def validate_scopes(self, value):
        if value is None:
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("Los permisos deben enviarse como lista.")
        return [str(item).strip() for item in value if str(item).strip()]


class HostingDomainSerializer(serializers.ModelSerializer):
    account = serializers.UUIDField(source="account_id", read_only=True)
    account_domain = serializers.CharField(source="account.primary_domain", read_only=True)
    account_username = serializers.CharField(source="account.username", read_only=True)
    node = serializers.UUIDField(source="account.node_id", read_only=True)
    node_hostname = serializers.CharField(source="account.node.hostname", read_only=True)

    class Meta:
        model = HostingDomain
        fields = [
            "id",
            "account",
            "account_domain",
            "account_username",
            "node",
            "node_hostname",
            "domain",
            "is_primary",
            "domain_type",
            "document_root",
            "dns_status",
            "ssl_status",
            "ssl_issuer",
            "ssl_expires_at",
            "ssl_domains",
            "ssl_cert_path",
            "ssl_privkey_path",
            "ssl_error_code",
            "ssl_error_detail",
            "web_protection",
            "web_protection_status",
            "web_protection_error",
            "dkim_selector",
            "dkim_txt",
            "dkim_status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "ssl_issuer",
            "ssl_expires_at",
            "ssl_domains",
            "ssl_cert_path",
            "ssl_privkey_path",
            "ssl_error_code",
            "ssl_error_detail",
            "web_protection_status",
            "web_protection_error",
            "dkim_selector",
            "dkim_txt",
            "dkim_status",
            "created_at",
            "updated_at",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["web_protection"] = {**DEFAULT_WEB_PROTECTION, **(instance.web_protection or {})}
        return data


class WebProtectionSerializer(serializers.Serializer):
    force_https = serializers.BooleanField(default=True)
    hsts_enabled = serializers.BooleanField(default=False)
    hsts_include_subdomains = serializers.BooleanField(default=False)
    hsts_preload = serializers.BooleanField(default=False)
    hotlink_protection = serializers.BooleanField(default=False)
    hotlink_allowed_domains = serializers.ListField(child=serializers.RegexField(r"^[A-Za-z0-9.-]+$"), required=False, max_length=20)
    basic_bot_block = serializers.BooleanField(default=True)
    quick_rules = serializers.BooleanField(default=True)
    ai_diagnostics_mock = serializers.BooleanField(default=False)

    def validate(self, attrs):
        current = self.context.get("current") or {}
        merged = {**DEFAULT_WEB_PROTECTION, **current, **attrs}
        if merged["hsts_preload"]:
            merged["hsts_enabled"] = True
            merged["hsts_include_subdomains"] = True
        cleaned_domains = []
        for domain in merged.get("hotlink_allowed_domains") or []:
            value = str(domain or "").strip().lower().strip(".")
            if value:
                cleaned_domains.append(value)
        merged["hotlink_allowed_domains"] = sorted(set(cleaned_domains))
        return merged


class HostingDNSRecordSerializer(serializers.ModelSerializer):
    domain_name = serializers.CharField(source="domain.domain", read_only=True)
    account = serializers.UUIDField(source="domain.account_id", read_only=True)
    node = serializers.UUIDField(source="domain.account.node_id", read_only=True)
    node_hostname = serializers.CharField(source="domain.account.node.hostname", read_only=True)
    type = serializers.CharField(source="record_type")

    class Meta:
        model = HostingDNSRecord
        fields = [
            "id",
            "domain",
            "domain_name",
            "account",
            "node",
            "node_hostname",
            "name",
            "type",
            "content",
            "ttl",
            "priority",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            allowed_accounts = scoped_accounts(HostingAccount.objects.all(), request.user)
            self.fields["domain"].queryset = HostingDomain.objects.filter(account__in=allowed_accounts)

    def validate_ttl(self, value):
        if value < 60 or value > 86400:
            raise serializers.ValidationError("TTL debe estar entre 60 y 86400 segundos.")
        return value

    def validate(self, attrs):
        record_type = attrs.get("record_type")
        if not record_type and self.instance:
            record_type = self.instance.record_type
        attrs["name"] = normalize_dns_record_name(attrs.get("name", self.instance.name if self.instance else "@"))
        attrs["content"] = normalize_dns_record_content(record_type, attrs.get("content", self.instance.content if self.instance else ""))
        if record_type in [HostingDNSRecord.RecordType.MX, HostingDNSRecord.RecordType.SRV, "MX", "SRV"]:
            attrs["priority"] = attrs.get("priority") if attrs.get("priority") is not None else 10
        else:
            attrs["priority"] = None
        return attrs


class HostingProtectedDirectorySerializer(serializers.ModelSerializer):
    domain_name = serializers.CharField(source="domain.domain", read_only=True)
    account = serializers.UUIDField(source="domain.account_id", read_only=True)
    account_username = serializers.CharField(source="domain.account.username", read_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=8, max_length=255)
    last_job_status = serializers.CharField(source="last_job.status", read_only=True, allow_null=True)
    last_error_code = serializers.CharField(source="last_job.error_code", read_only=True, allow_blank=True, allow_null=True)
    last_error_detail = serializers.CharField(source="last_job.error_detail", read_only=True, allow_blank=True, allow_null=True)

    class Meta:
        model = HostingProtectedDirectory
        fields = [
            "id",
            "domain",
            "domain_name",
            "account",
            "account_username",
            "path",
            "zone",
            "username",
            "password",
            "enabled",
            "status",
            "last_job_status",
            "last_error_code",
            "last_error_detail",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "domain_name", "account", "account_username", "status", "last_job_status", "last_error_code", "last_error_detail", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            allowed_accounts = scoped_accounts(HostingAccount.objects.all(), request.user)
            self.fields["domain"].queryset = HostingDomain.objects.filter(account__in=allowed_accounts)

    def validate_path(self, value):
        raw_path = str(value or "").strip()
        if raw_path in {"/", "."}:
            return "public_html"
        path = raw_path.strip("/")
        if not path:
            return "public_html"
        if path.startswith("/") or ".." in path.split("/"):
            raise serializers.ValidationError("La ruta debe ser relativa a la cuenta y no puede contener ..")
        return path

    def validate(self, attrs):
        request = self.context.get("request")
        domain = attrs.get("domain") or getattr(self.instance, "domain", None)
        if request and domain and not user_can_access_account(request.user, domain.account):
            raise serializers.ValidationError({"domain": "No tienes acceso a este dominio."})
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({"password": "La contrasena es requerida para crear la proteccion."})
        return attrs


class HostingWafConfigurationSerializer(serializers.ModelSerializer):
    domain_name = serializers.CharField(source="domain.domain", read_only=True)
    account = serializers.UUIDField(source="domain.account_id", read_only=True)
    account_username = serializers.CharField(source="domain.account.username", read_only=True)

    class Meta:
        model = HostingWafConfiguration
        fields = [
            "id",
            "domain",
            "domain_name",
            "account",
            "account_username",
            "mode",
            "owasp_crs",
            "wordpress_rules",
            "block_xmlrpc",
            "rate_limit_login",
            "status",
            "error",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "domain", "domain_name", "account", "account_username", "status", "error", "created_at", "updated_at"]


class HostingIPBlockSerializer(serializers.ModelSerializer):
    domain_name = serializers.CharField(source="domain.domain", read_only=True)
    account = serializers.UUIDField(source="domain.account_id", read_only=True)
    account_username = serializers.CharField(source="domain.account.username", read_only=True)
    source_label = serializers.SerializerMethodField()
    agent_hostname = serializers.CharField(source="last_job.node.hostname", read_only=True, allow_null=True)
    last_job_status = serializers.CharField(source="last_job.status", read_only=True, allow_null=True)

    class Meta:
        model = HostingIPBlock
        fields = [
            "id",
            "domain",
            "domain_name",
            "account",
            "account_username",
            "target",
            "source",
            "source_label",
            "reason",
            "expires_on",
            "enabled",
            "status",
            "agent_hostname",
            "last_job_status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "domain_name", "account", "account_username", "source_label", "status", "agent_hostname", "last_job_status", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            allowed_accounts = scoped_accounts(HostingAccount.objects.all(), request.user)
            self.fields["domain"].queryset = HostingDomain.objects.filter(account__in=allowed_accounts)

    def validate_target(self, value):
        target = str(value or "").strip()
        try:
            if "/" in target:
                return str(ipaddress.ip_network(target, strict=False))
            parsed = ipaddress.ip_address(target)
            return str(parsed)
        except ValueError as exc:
            raise serializers.ValidationError("Ingresa una IP valida o un rango CIDR valido.") from exc

    def validate(self, attrs):
        request = self.context.get("request")
        domain = attrs.get("domain") or getattr(self.instance, "domain", None)
        if request and domain and not user_can_access_account(request.user, domain.account):
            raise serializers.ValidationError({"domain": "No tienes acceso a este dominio."})
        expires_on = attrs.get("expires_on", getattr(self.instance, "expires_on", None))
        if attrs.get("enabled", getattr(self.instance, "enabled", True)) and expires_on and expires_on < timezone.localdate():
            attrs["status"] = HostingIPBlock.Status.EXPIRED
        return attrs

    def get_source_label(self, obj):
        labels = {
            HostingIPBlock.Source.ADMIN: "Administrador",
            HostingIPBlock.Source.WAF: "WAF / Firewall",
            HostingIPBlock.Source.MODSECURITY: "ModSecurity",
            HostingIPBlock.Source.ANTISPAM: "Anti-spam",
            HostingIPBlock.Source.AGENT: "Agente del nodo",
        }
        return labels.get(obj.source, obj.get_source_display())


class HostingSecurityScanSerializer(serializers.ModelSerializer):
    account_domain = serializers.CharField(source="account.primary_domain", read_only=True)
    account_username = serializers.CharField(source="account.username", read_only=True)
    node = serializers.UUIDField(source="account.node_id", read_only=True, allow_null=True)
    node_hostname = serializers.CharField(source="account.node.hostname", read_only=True, allow_null=True)
    job_status = serializers.CharField(source="last_job.status", read_only=True, allow_null=True)

    class Meta:
        model = HostingSecurityScan
        fields = [
            "id",
            "account",
            "account_domain",
            "account_username",
            "node",
            "node_hostname",
            "path",
            "scan_type",
            "status",
            "progress",
            "files_scanned",
            "infected_files",
            "data_scanned",
            "report",
            "output",
            "error_code",
            "error_detail",
            "job_status",
            "started_at",
            "finished_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "account_domain",
            "account_username",
            "node",
            "node_hostname",
            "status",
            "progress",
            "files_scanned",
            "infected_files",
            "data_scanned",
            "report",
            "output",
            "error_code",
            "error_detail",
            "job_status",
            "started_at",
            "finished_at",
            "created_at",
            "updated_at",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            self.fields["account"].queryset = scoped_accounts(HostingAccount.objects.all(), request.user)

    def validate_path(self, value):
        path = str(value or "").strip().strip("/")
        if not path:
            return "public_html"
        if path.startswith("/") or ".." in path.split("/"):
            raise serializers.ValidationError("La ruta debe ser relativa a la cuenta y no puede contener ..")
        return path


class HostingMonitorCheckSerializer(serializers.ModelSerializer):
    account_domain = serializers.CharField(source="account.primary_domain", read_only=True)
    account_username = serializers.CharField(source="account.username", read_only=True)

    class Meta:
        model = HostingMonitorCheck
        fields = [
            "id", "account", "account_domain", "account_username", "check_type", "name", "target",
            "interval_seconds", "enabled", "status", "response_ms", "last_checked_at",
            "last_message", "metadata", "created_at", "updated_at",
        ]
        read_only_fields = ["account_domain", "account_username", "status", "response_ms", "last_checked_at", "last_message", "metadata", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            self.fields["account"].queryset = scoped_accounts(HostingAccount.objects.all(), request.user)


class HostingMonitorIncidentSerializer(serializers.ModelSerializer):
    account_domain = serializers.CharField(source="account.primary_domain", read_only=True)
    account_username = serializers.CharField(source="account.username", read_only=True)

    class Meta:
        model = HostingMonitorIncident
        fields = [
            "id", "account", "account_domain", "account_username", "monitor_check", "title", "service",
            "severity", "status", "started_at", "acknowledged_at", "resolved_at", "detail",
            "metadata", "created_at", "updated_at",
        ]
        read_only_fields = ["account_domain", "account_username", "acknowledged_at", "resolved_at", "metadata", "created_at", "updated_at"]


class HostingMonitorAlertRuleSerializer(serializers.ModelSerializer):
    account_domain = serializers.CharField(source="account.primary_domain", read_only=True)
    account_username = serializers.CharField(source="account.username", read_only=True)

    class Meta:
        model = HostingMonitorAlertRule
        fields = [
            "id", "account", "account_domain", "account_username", "channel", "event", "threshold",
            "target", "enabled", "last_test_at", "last_test_status", "created_at", "updated_at",
        ]
        read_only_fields = ["account_domain", "account_username", "last_test_at", "last_test_status", "created_at", "updated_at"]


class HostingMonitorSnapshotSerializer(serializers.ModelSerializer):
    account_domain = serializers.CharField(source="account.primary_domain", read_only=True)
    account_username = serializers.CharField(source="account.username", read_only=True)

    class Meta:
        model = HostingMonitorSnapshot
        fields = "__all__"
        read_only_fields = ["account_domain", "account_username"]


class HostingAdvancedItemSerializer(serializers.ModelSerializer):
    account_domain = serializers.CharField(source="account.primary_domain", read_only=True)
    account_username = serializers.CharField(source="account.username", read_only=True)
    masked_config = serializers.SerializerMethodField()
    last_job_status = serializers.CharField(source="last_job.status", read_only=True, allow_null=True)
    last_error_code = serializers.CharField(source="last_job.error_code", read_only=True, allow_blank=True, allow_null=True)
    last_error_detail = serializers.CharField(source="last_job.error_detail", read_only=True, allow_blank=True, allow_null=True)

    class Meta:
        model = HostingAdvancedItem
        fields = [
            "id",
            "account",
            "account_domain",
            "account_username",
            "kind",
            "name",
            "config",
            "masked_config",
            "enabled",
            "status",
            "last_job_status",
            "last_error_code",
            "last_error_detail",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "account_domain",
            "account_username",
            "masked_config",
            "status",
            "last_job_status",
            "last_error_code",
            "last_error_detail",
            "created_at",
            "updated_at",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            self.fields["account"].queryset = scoped_accounts(HostingAccount.objects.all(), request.user)

    def get_masked_config(self, obj):
        sensitive_keys = {"secret", "token", "password", "private_key", "webhook_secret", "value"}
        data = obj.config if isinstance(obj.config, dict) else {}
        masked = {}
        for key, value in data.items():
            masked[key] = "********" if key in sensitive_keys and value else value
        return masked

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["config"] = data["masked_config"]
        return data

    def validate_config(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("La configuracion debe ser un objeto JSON.")
        if len(str(value)) > 12000:
            raise serializers.ValidationError("La configuracion es demasiado grande.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        account = attrs.get("account") or getattr(self.instance, "account", None)
        if request and account and not user_can_access_account(request.user, account):
            raise serializers.ValidationError({"account": "No tienes acceso a esta cuenta."})
        kind = attrs.get("kind") or getattr(self.instance, "kind", "")
        config = attrs.get("config", getattr(self.instance, "config", {}) or {})
        if kind == HostingAdvancedItem.Kind.VARIABLE and not config.get("key"):
            raise serializers.ValidationError({"config": "La variable requiere una clave."})
        if kind == HostingAdvancedItem.Kind.GIT_REPO and not config.get("repo_url"):
            raise serializers.ValidationError({"config": "El repositorio Git requiere una URL."})
        if kind == HostingAdvancedItem.Kind.WEBHOOK and not config.get("url"):
            raise serializers.ValidationError({"config": "El webhook requiere una URL."})
        return attrs


class HostingPerformanceAuditSerializer(serializers.ModelSerializer):
    job_status = serializers.CharField(source="job.status", read_only=True, allow_null=True)
    requested_by_username = serializers.CharField(source="requested_by.username", read_only=True, allow_null=True)

    class Meta:
        model = HostingPerformanceAudit
        fields = [
            "id",
            "account",
            "target_url",
            "duration_seconds",
            "samples",
            "status",
            "result",
            "error_code",
            "error_detail",
            "job",
            "job_status",
            "requested_by_username",
            "started_at",
            "finished_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class SupportTicketAttachmentSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicketAttachment
        fields = ["id", "original_name", "content_type", "size", "download_url", "created_at"]

    def get_download_url(self, obj):
        return f"/api/hosting/ticket-attachments/{obj.id}/download/"


class SupportTicketMessageSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.get_username", read_only=True)
    attachments = SupportTicketAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = SupportTicketMessage
        fields = ["id", "author_name", "author_type", "body", "is_internal", "attachments", "created_at"]


class SupportTicketSerializer(serializers.ModelSerializer):
    account_domain = serializers.CharField(source="account.primary_domain", read_only=True)
    account_username = serializers.CharField(source="account.username", read_only=True)
    requester_name = serializers.CharField(source="requester.get_username", read_only=True)
    display_id = serializers.CharField(read_only=True)
    messages = SupportTicketMessageSerializer(many=True, read_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            "id",
            "display_id",
            "ticket_number",
            "account",
            "account_domain",
            "account_username",
            "requester_name",
            "subject",
            "department",
            "priority",
            "status",
            "last_reply_at",
            "closed_at",
            "messages",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["display_id", "ticket_number", "account_domain", "account_username", "requester_name", "status", "last_reply_at", "closed_at", "messages", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            self.fields["account"].queryset = scoped_accounts(HostingAccount.objects.all(), request.user)


class GlobalAnnouncementSerializer(serializers.ModelSerializer):
    audience_label = serializers.CharField(source="get_audience_display", read_only=True)
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    author = serializers.CharField(source="created_by.get_username", read_only=True, allow_null=True)

    class Meta:
        model = GlobalAnnouncement
        fields = [
            "id",
            "title",
            "body",
            "audience",
            "audience_label",
            "priority",
            "priority_label",
            "status",
            "status_label",
            "publish_at",
            "expires_at",
            "author",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "audience_label", "priority_label", "status_label", "author", "created_at", "updated_at"]


class DNSTemplateRecordSerializer(serializers.ModelSerializer):
    type = serializers.CharField(source="record_type")

    class Meta:
        model = DNSTemplateRecord
        fields = ["id", "name", "type", "content", "ttl", "priority", "order", "is_active", "description", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        record_type = attrs.get("record_type")
        if not record_type and self.instance:
            record_type = self.instance.record_type
        attrs["name"] = normalize_dns_record_name(attrs.get("name", self.instance.name if self.instance else "@"))
        if record_type in [HostingDNSRecord.RecordType.MX, HostingDNSRecord.RecordType.SRV, "MX", "SRV"]:
            attrs["priority"] = attrs.get("priority") if attrs.get("priority") is not None else 10
        else:
            attrs["priority"] = None
        return attrs


class GlobalNameserverSerializer(serializers.ModelSerializer):
    node_hostname = serializers.CharField(source="node.hostname", read_only=True, allow_null=True)

    class Meta:
        model = GlobalNameserver
        fields = [
            "id",
            "hostname",
            "short_name",
            "ip_address",
            "node",
            "node_hostname",
            "role",
            "zone",
            "status",
            "sequence",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "node_hostname", "created_at", "updated_at"]


class ProvisioningTemplateSerializer(serializers.ModelSerializer):
    target_plan_name = serializers.CharField(source="target_plan.name", read_only=True, allow_null=True)
    action_count = serializers.SerializerMethodField()
    variable_count = serializers.SerializerMethodField()

    class Meta:
        model = ProvisioningTemplate
        fields = [
            "id",
            "name",
            "slug",
            "category",
            "description",
            "target_plan",
            "target_plan_name",
            "resources",
            "actions",
            "variables",
            "automation",
            "is_active",
            "usage_count",
            "last_used_at",
            "action_count",
            "variable_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "slug", "target_plan_name", "usage_count", "last_used_at", "action_count", "variable_count", "created_at", "updated_at"]

    def get_action_count(self, obj):
        return len(obj.actions or [])

    def get_variable_count(self, obj):
        return len(obj.variables or {})

    def validate_actions(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Las acciones deben enviarse como una lista.")
        return value

    def validate_resources(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Los recursos deben enviarse como un objeto.")
        return value

    def validate_variables(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Las variables deben enviarse como un objeto.")
        return value

    def validate_automation(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("La automatizacion debe enviarse como un objeto.")
        return value


def normalize_dns_record_name(name):
    name = str(name or "@").strip().lower().strip(".")
    return name or "@"


def normalize_database_identifier(account, value):
    prefix = str(account.username or "").strip().lower().replace("-", "_")
    identifier = str(value or "").strip().lower().replace("-", "_")
    identifier = "_".join(part for part in identifier.split("_") if part)
    if not prefix:
        return identifier[:64]
    if identifier == prefix or identifier.startswith(f"{prefix}_"):
        return identifier[:64]
    return f"{prefix}_{identifier}"[:64]


def normalize_dns_record_content(record_type, content):
    value = str(content or "").strip()
    if not value:
        raise serializers.ValidationError({"content": "El valor del registro es requerido."})
    if record_type in [HostingDNSRecord.RecordType.CNAME, HostingDNSRecord.RecordType.MX, HostingDNSRecord.RecordType.NS]:
        return value.rstrip(".") + "."
    if record_type == HostingDNSRecord.RecordType.SRV:
        parts = value.split()
        if len(parts) == 4:
            parts[3] = parts[3].rstrip(".") + "."
            return " ".join(parts)
        return value
    if record_type == HostingDNSRecord.RecordType.TXT:
        return value.strip('"')
    return value


class CreateDomainSerializer(serializers.Serializer):
    account = serializers.PrimaryKeyRelatedField(queryset=HostingAccount.objects.select_related("plan", "node").all())
    domain = serializers.RegexField(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$")
    public_ip = serializers.IPAddressField(protocol="IPv4", required=False)
    domain_type = serializers.ChoiceField(choices=HostingDomain.DomainType.choices, required=False)
    document_root = serializers.RegexField(
        r"^[A-Za-z0-9][A-Za-z0-9_./-]{0,180}$",
        required=False,
        allow_blank=True,
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            self.fields["account"].queryset = scoped_accounts(self.fields["account"].queryset, request.user)

    def validate(self, attrs):
        account = attrs["account"]
        request = self.context.get("request")
        if request and not user_can_access_account(request.user, account):
            raise serializers.ValidationError({"account": "No tienes acceso a esta cuenta hosting."})
        attrs["domain"] = attrs["domain"].lower().strip(".")
        attrs["domain_type"] = attrs.get("domain_type") or (
            HostingDomain.DomainType.SUBDOMAIN
            if attrs["domain"].endswith("." + account.primary_domain)
            else HostingDomain.DomainType.ALIAS
        )
        document_root = (attrs.get("document_root") or "").strip().strip("/")
        if not document_root:
            if attrs["domain_type"] == HostingDomain.DomainType.SUBDOMAIN:
                label = attrs["domain"][: -(len(account.primary_domain) + 1)].replace(".", "_")
                document_root = f"subdomains/{label or 'site'}"
            elif attrs["domain_type"] == HostingDomain.DomainType.ADDON:
                document_root = f"domains/{attrs['domain'].replace('.', '_')}"
            else:
                document_root = "public_html"
        if document_root.startswith("/") or ".." in document_root.split("/"):
            raise serializers.ValidationError({"document_root": "La carpeta debe ser relativa a la cuenta y no puede contener .."})
        attrs["document_root"] = document_root
        if HostingDomain.objects.filter(domain=attrs["domain"]).exists():
            raise serializers.ValidationError({"domain": "Ya existe ese dominio en EHPanel Web."})
        if account.plan:
            if attrs["domain_type"] == HostingDomain.DomainType.SUBDOMAIN:
                subdomain_limit = plan_feature_limit(
                    account.plan,
                    ["max_subdomains", "subdomains", "subdomain_limit", "subdomains_limit"],
                )
                if subdomain_limit is not None and account.domains.filter(domain_type=HostingDomain.DomainType.SUBDOMAIN).count() >= subdomain_limit:
                    raise serializers.ValidationError({"account": "La cuenta ya alcanzo el limite de subdominios del plan."})
            else:
                domain_limit = _plan_limit_value(account.plan.max_domains)
                extra_domains = account.domains.exclude(
                    domain_type__in=[HostingDomain.DomainType.PRIMARY, HostingDomain.DomainType.SUBDOMAIN]
                ).count()
                if domain_limit is not None and extra_domains >= domain_limit:
                    raise serializers.ValidationError({"account": "La cuenta ya alcanzo el limite de dominios del plan."})
        return attrs


class SyncDomainDNSSerializer(serializers.Serializer):
    public_ip = serializers.IPAddressField(protocol="IPv4", required=False)


class IssueDomainSSLSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    include_www = serializers.BooleanField(default=True)
    staging = serializers.BooleanField(default=False)
    force_renewal = serializers.BooleanField(default=False)


class ActivateDomainWebmailSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    sync_dns = serializers.BooleanField(default=True)
    issue_ssl = serializers.BooleanField(default=True)
    staging = serializers.BooleanField(default=False)
    force_renewal = serializers.BooleanField(default=False)


class HostingDatabaseSerializer(serializers.ModelSerializer):
    account = serializers.UUIDField(source="account_id", read_only=True)
    account_domain = serializers.CharField(source="account.primary_domain", read_only=True)
    account_username = serializers.CharField(source="account.username", read_only=True)
    node = serializers.UUIDField(source="account.node_id", read_only=True)
    node_hostname = serializers.CharField(source="account.node.hostname", read_only=True)
    grants = serializers.SerializerMethodField()

    class Meta:
        model = HostingDatabase
        fields = [
            "id",
            "account",
            "account_domain",
            "account_username",
            "node",
            "node_hostname",
            "engine",
            "name",
            "username",
            "size_mb",
            "size_status",
            "last_size_at",
            "status",
            "grants",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["size_mb", "size_status", "last_size_at", "created_at", "updated_at"]

    def get_grants(self, obj):
        grants = obj.grants.select_related("user").all()
        return [
            {
                "id": grant.id,
                "user": grant.user_id,
                "username": grant.user.username,
                "access": grant.access,
                "privileges": grant.privileges,
            }
            for grant in grants
        ]


class HostingDatabaseUserSerializer(serializers.ModelSerializer):
    account = serializers.UUIDField(source="account_id", read_only=True)
    account_domain = serializers.CharField(source="account.primary_domain", read_only=True)
    account_username = serializers.CharField(source="account.username", read_only=True)
    databases = serializers.SerializerMethodField()
    used_by_count = serializers.SerializerMethodField()

    class Meta:
        model = HostingDatabaseUser
        fields = [
            "id",
            "account",
            "account_domain",
            "account_username",
            "engine",
            "username",
            "access",
            "hosts",
            "status",
            "databases",
            "used_by_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "used_by_count", "databases"]

    def get_databases(self, obj):
        return [
            {"id": grant.database_id, "name": grant.database.name, "access": grant.access}
            for grant in obj.grants.select_related("database").all()
        ]

    def get_used_by_count(self, obj):
        return obj.grants.count()


class CreateDatabaseSerializer(serializers.Serializer):
    account = serializers.PrimaryKeyRelatedField(queryset=HostingAccount.objects.select_related("plan", "node").all())
    engine = serializers.ChoiceField(choices=HostingDatabase.Engine.choices, default=HostingDatabase.Engine.MARIADB)
    name = serializers.RegexField(r"^[A-Za-z][A-Za-z0-9_]{1,63}$")
    user_mode = serializers.ChoiceField(choices=["existing", "new"], default="new")
    database_user = serializers.PrimaryKeyRelatedField(queryset=HostingDatabaseUser.objects.select_related("account").all(), required=False, allow_null=True)
    username = serializers.RegexField(r"^[A-Za-z][A-Za-z0-9_]{1,63}$", required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8, max_length=255, required=False, allow_blank=True)
    access = serializers.ChoiceField(choices=HostingDatabaseUser.Access.choices, default=HostingDatabaseUser.Access.READ_WRITE)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            self.fields["account"].queryset = scoped_accounts(self.fields["account"].queryset, request.user)
            self.fields["database_user"].queryset = HostingDatabaseUser.objects.filter(account__in=scoped_accounts(HostingAccount.objects.all(), request.user))

    def validate(self, attrs):
        account = attrs["account"]
        request = self.context.get("request")
        if request and not user_can_access_account(request.user, account):
            raise serializers.ValidationError({"account": "No tienes acceso a esta cuenta hosting."})
        attrs["name"] = normalize_database_identifier(account, attrs["name"])
        if HostingDatabase.objects.filter(name=attrs["name"]).exists():
            raise serializers.ValidationError({"name": "Ya existe una base de datos con ese nombre."})
        if account.plan and account.databases.count() >= account.plan.max_databases:
            raise serializers.ValidationError({"account": "La cuenta ya alcanzo el limite de bases de datos del plan."})
        if attrs.get("user_mode") == "existing":
            database_user = attrs.get("database_user")
            if not database_user:
                raise serializers.ValidationError({"database_user": "Selecciona un usuario existente."})
            if database_user.account_id != account.id or database_user.engine != attrs["engine"]:
                raise serializers.ValidationError({"database_user": "El usuario no pertenece a esta cuenta o motor."})
            attrs["username"] = database_user.username
        else:
            username = normalize_database_identifier(account, attrs.get("username") or "")
            password = attrs.get("password") or ""
            if not username:
                raise serializers.ValidationError({"username": "El usuario es requerido."})
            if not password:
                raise serializers.ValidationError({"password": "La contrasena es requerida."})
            if HostingDatabaseUser.objects.filter(account=account, engine=attrs["engine"], username=username).exists():
                raise serializers.ValidationError({"username": "Ya existe un usuario con ese nombre para este motor."})
            attrs["username"] = username
        return attrs


class ChangeDatabasePasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, min_length=8, max_length=255)


class CreateDatabaseUserSerializer(serializers.Serializer):
    account = serializers.PrimaryKeyRelatedField(queryset=HostingAccount.objects.select_related("node").all())
    engine = serializers.ChoiceField(choices=HostingDatabase.Engine.choices, default=HostingDatabase.Engine.MARIADB)
    username = serializers.RegexField(r"^[A-Za-z][A-Za-z0-9_]{1,63}$")
    password = serializers.CharField(write_only=True, min_length=8, max_length=255)
    database = serializers.PrimaryKeyRelatedField(queryset=HostingDatabase.objects.select_related("account").all(), required=False, allow_null=True)
    access = serializers.ChoiceField(choices=HostingDatabaseUser.Access.choices, default=HostingDatabaseUser.Access.READ_WRITE)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            allowed = scoped_accounts(HostingAccount.objects.all(), request.user)
            self.fields["account"].queryset = scoped_accounts(self.fields["account"].queryset, request.user)
            self.fields["database"].queryset = HostingDatabase.objects.filter(account__in=allowed)

    def validate(self, attrs):
        account = attrs["account"]
        request = self.context.get("request")
        attrs["username"] = normalize_database_identifier(account, attrs["username"])
        if request and not user_can_access_account(request.user, account):
            raise serializers.ValidationError({"account": "No tienes acceso a esta cuenta hosting."})
        database = attrs.get("database")
        if database and (database.account_id != account.id or database.engine != attrs["engine"]):
            raise serializers.ValidationError({"database": "La base de datos no pertenece a la cuenta o motor seleccionado."})
        if HostingDatabaseUser.objects.filter(account=account, engine=attrs["engine"], username=attrs["username"]).exists():
            raise serializers.ValidationError({"username": "Ya existe un usuario con ese nombre para este motor."})
        return attrs


class UpdateDatabaseUserSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, min_length=8, max_length=255, required=False, allow_blank=True)
    access = serializers.ChoiceField(choices=HostingDatabaseUser.Access.choices, required=False)


class DatabaseCloneSerializer(serializers.Serializer):
    name = serializers.RegexField(r"^[A-Za-z][A-Za-z0-9_]{1,47}$")

    def validate_name(self, value):
        value = value.lower()
        if HostingDatabase.objects.filter(name=value).exists():
            raise serializers.ValidationError("Ya existe una base de datos con ese nombre.")
        return value


class DatabaseImportSerializer(serializers.Serializer):
    path = serializers.CharField(max_length=500)


class DatabaseSsoConsumeSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=160)
    manager = serializers.ChoiceField(choices=["phpmyadmin", "adminer"])


class HostingMailboxSerializer(serializers.ModelSerializer):
    account_domain = serializers.CharField(source="account.primary_domain", read_only=True)
    account_username = serializers.CharField(source="account.username", read_only=True)
    node = serializers.UUIDField(source="account.node_id", read_only=True)
    node_hostname = serializers.CharField(source="account.node.hostname", read_only=True)
    manual_config = serializers.SerializerMethodField()

    class Meta:
        model = HostingMailbox
        fields = [
            "id",
            "account",
            "account_domain",
            "account_username",
            "node",
            "node_hostname",
            "email",
            "quota_mb",
            "used_mb",
            "usage_status",
            "description",
            "outgoing_limit",
            "antispam_enabled",
            "antispam_settings",
            "autoresponder_enabled",
            "autoresponder_subject",
            "autoresponder_format",
            "autoresponder_encoding",
            "autoresponder_message",
            "autoresponder_redirect",
            "autoresponder_unique_limit",
            "autoresponder_schedule",
            "manual_config",
            "last_usage_at",
            "last_test_status",
            "last_test_recipient",
            "last_test_result",
            "last_test_at",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "used_mb",
            "usage_status",
            "manual_config",
            "last_usage_at",
            "last_test_status",
            "last_test_recipient",
            "last_test_result",
            "last_test_at",
            "status",
            "created_at",
            "updated_at",
        ]

    def get_manual_config(self, obj):
        domain = obj.email.split("@", 1)[1] if "@" in obj.email else obj.account.primary_domain
        host = f"mail.{domain}"
        return {
            "username": obj.email,
            "incoming_server": host,
            "outgoing_server": host,
            "smtp_ssl_port": 465,
            "smtp_plain_port": 587,
            "imap_ssl_port": 993,
            "imap_plain_port": 143,
            "pop3_ssl_port": 995,
            "pop3_plain_port": 110,
            "incoming_protocols": ["POP3", "IMAP"],
            "outgoing_protocols": ["SMTP"],
        }


class CreateMailboxSerializer(serializers.Serializer):
    account = serializers.PrimaryKeyRelatedField(queryset=HostingAccount.objects.select_related("plan", "node").all())
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, max_length=255)
    quota_mb = serializers.IntegerField(min_value=1, default=1024)
    description = serializers.CharField(max_length=255, required=False, allow_blank=True)
    outgoing_limit = serializers.IntegerField(min_value=1, default=150)
    antispam_enabled = serializers.BooleanField(default=True)
    antispam_settings = serializers.JSONField(required=False, default=dict)
    autoresponder_enabled = serializers.BooleanField(default=False)
    autoresponder_subject = serializers.CharField(max_length=160, required=False, allow_blank=True)
    autoresponder_format = serializers.ChoiceField(choices=["text", "html"], default="text")
    autoresponder_encoding = serializers.CharField(max_length=40, default="UTF-8")
    autoresponder_message = serializers.CharField(required=False, allow_blank=True)
    autoresponder_redirect = serializers.EmailField(required=False, allow_blank=True)
    autoresponder_unique_limit = serializers.IntegerField(min_value=1, default=1)
    autoresponder_schedule = serializers.BooleanField(default=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            self.fields["account"].queryset = scoped_accounts(self.fields["account"].queryset, request.user)

    def validate(self, attrs):
        account = attrs["account"]
        request = self.context.get("request")
        attrs["email"] = attrs["email"].lower()
        if request and not user_can_access_account(request.user, account):
            raise serializers.ValidationError({"account": "No tienes acceso a esta cuenta hosting."})
        if not attrs["email"].endswith(f"@{account.primary_domain}"):
            raise serializers.ValidationError({"email": f"El correo debe pertenecer a {account.primary_domain}."})
        if HostingMailbox.objects.filter(email=attrs["email"]).exists():
            raise serializers.ValidationError({"email": "Ya existe este buzon."})
        if account.plan and account.mailboxes.count() >= account.plan.max_mailboxes:
            raise serializers.ValidationError({"account": "La cuenta ya alcanzo el limite de buzones del plan."})
        return attrs


class UpdateMailboxSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, min_length=8, max_length=255, required=False, allow_blank=True)
    quota_mb = serializers.IntegerField(min_value=1, required=False)
    description = serializers.CharField(max_length=255, required=False, allow_blank=True)
    outgoing_limit = serializers.IntegerField(min_value=1, required=False)
    antispam_enabled = serializers.BooleanField(required=False)
    antispam_settings = serializers.JSONField(required=False)
    autoresponder_enabled = serializers.BooleanField(required=False)
    autoresponder_subject = serializers.CharField(max_length=160, required=False, allow_blank=True)
    autoresponder_format = serializers.ChoiceField(choices=["text", "html"], required=False)
    autoresponder_encoding = serializers.CharField(max_length=40, required=False)
    autoresponder_message = serializers.CharField(required=False, allow_blank=True)
    autoresponder_redirect = serializers.EmailField(required=False, allow_blank=True)
    autoresponder_unique_limit = serializers.IntegerField(min_value=1, required=False)
    autoresponder_schedule = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("No hay cambios para guardar.")
        return attrs


class MailboxSsoConsumeSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=160)


class HostingFtpUserSerializer(serializers.ModelSerializer):
    account_domain = serializers.CharField(source="account.primary_domain", read_only=True)
    account_username = serializers.CharField(source="account.username", read_only=True)
    absolute_root = serializers.CharField(read_only=True)
    node = serializers.UUIDField(source="account.node_id", read_only=True)
    node_hostname = serializers.CharField(source="account.node.hostname", read_only=True)

    class Meta:
        model = HostingFtpUser
        fields = [
            "id",
            "account",
            "account_domain",
            "account_username",
            "node",
            "node_hostname",
            "username",
            "root",
            "quota_mb",
            "absolute_root",
            "protocol",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "account_domain", "account_username", "node", "node_hostname", "absolute_root", "protocol", "status", "created_at", "updated_at"]


class CreateFtpUserSerializer(serializers.Serializer):
    account = serializers.PrimaryKeyRelatedField(queryset=HostingAccount.objects.select_related("plan", "node").all())
    username = serializers.RegexField(r"^[A-Za-z][A-Za-z0-9_]{2,47}$")
    password = serializers.CharField(write_only=True, min_length=8, max_length=255)
    root = serializers.RegexField(r"^[A-Za-z0-9][A-Za-z0-9_./-]{0,180}$", default="public_html")
    quota_mb = serializers.IntegerField(min_value=0, default=0)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            self.fields["account"].queryset = scoped_accounts(self.fields["account"].queryset, request.user)

    def validate(self, attrs):
        account = attrs["account"]
        request = self.context.get("request")
        if request and not user_can_access_account(request.user, account):
            raise serializers.ValidationError({"account": "No tienes acceso a esta cuenta hosting."})

        attrs["username"] = attrs["username"].lower()
        prefix = f"{account.username}_"
        if attrs["username"] == account.username:
            raise serializers.ValidationError({"username": "Ese usuario ya pertenece al acceso principal de la cuenta."})
        if not attrs["username"].startswith(prefix):
            raise serializers.ValidationError({"username": f"El usuario adicional debe iniciar con {prefix}"})
        if HostingAccount.objects.filter(username=attrs["username"]).exists() or HostingFtpUser.objects.filter(username=attrs["username"]).exists():
            raise serializers.ValidationError({"username": "Ya existe ese usuario FTP/FTPS."})

        root = attrs.get("root", "public_html").strip().strip("/")
        if not root or root.startswith("/") or ".." in root.split("/"):
            raise serializers.ValidationError({"root": "La carpeta debe ser relativa a la cuenta y no puede contener .."})
        attrs["root"] = root
        quota_mb = attrs.get("quota_mb", 0)
        if quota_mb and account.disk_mb and quota_mb > account.disk_mb:
            raise serializers.ValidationError({"quota_mb": "La cuota FTP no puede superar la cuota de disco de la cuenta."})
        return attrs


class UpdateFtpUserSerializer(serializers.Serializer):
    root = serializers.RegexField(r"^[A-Za-z0-9][A-Za-z0-9_./-]{0,180}$", required=False)
    password = serializers.CharField(write_only=True, min_length=8, max_length=255, required=False, allow_blank=True)
    quota_mb = serializers.IntegerField(min_value=0, required=False)

    def validate(self, attrs):
        root = attrs.get("root")
        if root is not None:
            root = root.strip().strip("/")
            if not root or root.startswith("/") or ".." in root.split("/"):
                raise serializers.ValidationError({"root": "La carpeta debe ser relativa a la cuenta y no puede contener .."})
            attrs["root"] = root
        if not attrs.get("root") and not attrs.get("password") and "quota_mb" not in attrs:
            raise serializers.ValidationError("Debes cambiar la carpeta, cuota o enviar una nueva contrasena.")
        return attrs


class HostingApplicationSerializer(serializers.ModelSerializer):
    type = serializers.CharField(source="app_type", read_only=True)
    domain_name = serializers.CharField(source="domain.domain", read_only=True)
    node = serializers.UUIDField(source="account.node_id", read_only=True)
    node_name = serializers.CharField(source="account.node.hostname", read_only=True)
    instance_id = serializers.CharField(source="metadata.instance_id", read_only=True)
    port = serializers.IntegerField(source="metadata.port", read_only=True, default=0)

    class Meta:
        model = HostingApplication
        fields = [
            "id",
            "name",
            "type",
            "account",
            "domain",
            "domain_name",
            "node",
            "node_name",
            "instance_id",
            "port",
            "status",
            "version",
            "install_path",
            "url",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class HostingApplicationBackupSerializer(serializers.ModelSerializer):
    app_name = serializers.CharField(source="app.name", read_only=True)
    domain_name = serializers.CharField(source="app.domain.domain", read_only=True)
    app_type = serializers.CharField(source="app.app_type", read_only=True)

    class Meta:
        model = HostingApplicationBackup
        fields = [
            "id",
            "app",
            "app_name",
            "app_type",
            "domain_name",
            "status",
            "archive_path",
            "filename",
            "size_bytes",
            "error_code",
            "error_detail",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class HostingAccountExportSerializer(serializers.ModelSerializer):
    account_domain = serializers.CharField(source="account.primary_domain", read_only=True)
    account_username = serializers.CharField(source="account.username", read_only=True)
    node_hostname = serializers.CharField(source="account.node.hostname", read_only=True, allow_null=True)
    job_status = serializers.CharField(source="last_job.status", read_only=True, allow_null=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = HostingAccountExport
        fields = [
            "id",
            "account",
            "account_domain",
            "account_username",
            "node_hostname",
            "status",
            "export_type",
            "include_files",
            "include_databases",
            "include_mail",
            "include_subdomains",
            "notes",
            "archive_path",
            "filename",
            "size_bytes",
            "result",
            "last_job",
            "job_status",
            "error_code",
            "error_detail",
            "download_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_download_url(self, obj):
        if obj.status != HostingAccountExport.Status.COMPLETED:
            return ""
        return f"/api/hosting/account-exports/{obj.id}/download/"


class CreateHostingAccountExportSerializer(serializers.Serializer):
    account = serializers.PrimaryKeyRelatedField(queryset=HostingAccount.objects.select_related("node").all())
    export_type = serializers.ChoiceField(choices=["full", "files_databases", "mail_only"], default="full")
    include_files = serializers.BooleanField(default=True)
    include_databases = serializers.BooleanField(default=True)
    include_mail = serializers.BooleanField(default=True)
    include_subdomains = serializers.BooleanField(default=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class BackupStorageDestinationSerializer(serializers.ModelSerializer):
    type_label = serializers.CharField(source="get_storage_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = BackupStorageDestination
        fields = [
            "id",
            "name",
            "storage_type",
            "type_label",
            "endpoint",
            "bucket",
            "path",
            "username",
            "secret",
            "capacity_gb",
            "used_bytes",
            "status",
            "status_label",
            "config",
            "last_test_at",
            "last_test_result",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {"secret": {"write_only": True, "required": False, "allow_blank": True}}
        read_only_fields = ["id", "type_label", "status_label", "used_bytes", "last_test_at", "last_test_result", "created_at", "updated_at"]


class BackupPolicySerializer(serializers.ModelSerializer):
    storage_name = serializers.CharField(source="storage.name", read_only=True, allow_null=True)
    type_label = serializers.CharField(source="get_policy_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    includes_label = serializers.SerializerMethodField()
    retention_label = serializers.SerializerMethodField()

    class Meta:
        model = BackupPolicy
        fields = [
            "id",
            "name",
            "policy_type",
            "type_label",
            "frequency",
            "include_files",
            "include_databases",
            "include_mail",
            "include_config",
            "full_account",
            "includes_label",
            "storage",
            "storage_name",
            "retention_days",
            "retention_copies",
            "retention_label",
            "status",
            "status_label",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "storage_name", "type_label", "status_label", "includes_label", "retention_label", "created_at", "updated_at"]

    def get_includes_label(self, obj):
        if obj.full_account:
            return "Cuenta completa"
        labels = []
        if obj.include_files:
            labels.append("Archivos")
        if obj.include_databases:
            labels.append("BD")
        if obj.include_mail:
            labels.append("Correo")
        if obj.include_config:
            labels.append("Config")
        return ", ".join(labels) or "N/D"

    def get_retention_label(self, obj):
        return f"{obj.retention_days} dias / {obj.retention_copies} copias"


class BackupRestoreRunSerializer(serializers.ModelSerializer):
    accounts_detail = serializers.SerializerMethodField()
    account_ids = serializers.PrimaryKeyRelatedField(source="accounts", queryset=HostingAccount.objects.all(), many=True, write_only=True, required=False)
    backup_label = serializers.CharField(source="backup.filename", read_only=True, allow_null=True)
    destination_node_hostname = serializers.CharField(source="destination_node.hostname", read_only=True, allow_null=True)
    job_status = serializers.CharField(source="last_job.status", read_only=True, allow_null=True)
    operator = serializers.CharField(source="created_by.get_username", read_only=True, allow_null=True)
    reseller_name = serializers.CharField(source="reseller.company_name", read_only=True, allow_null=True)

    class Meta:
        model = BackupRestoreRun
        fields = [
            "id",
            "accounts",
            "account_ids",
            "accounts_detail",
            "reseller",
            "reseller_name",
            "backup",
            "backup_label",
            "destination_node",
            "destination_node_hostname",
            "status",
            "restore_type",
            "include_files",
            "include_databases",
            "include_mail",
            "notes",
            "result",
            "last_job",
            "job_status",
            "error_code",
            "error_detail",
            "operator",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "accounts_detail", "backup_label", "destination_node_hostname", "result", "last_job", "job_status", "error_code", "error_detail", "operator", "created_at", "updated_at"]

    def get_accounts_detail(self, obj):
        return [{"id": str(account.id), "domain": account.primary_domain, "username": account.username, "node": account.node.hostname if account.node_id else ""} for account in obj.accounts.all()]

    def validate(self, attrs):
        accounts = attrs.get("accounts")
        if self.instance is not None and accounts is None:
            accounts = list(self.instance.accounts.all())
        if not accounts:
            raise serializers.ValidationError({"account_ids": "Selecciona al menos una cuenta para restaurar."})
        if not attrs.get("include_files", getattr(self.instance, "include_files", True)) and not attrs.get("include_databases", getattr(self.instance, "include_databases", True)) and not attrs.get("include_mail", getattr(self.instance, "include_mail", False)):
            raise serializers.ValidationError({"restore_type": "Selecciona al menos un componente para restaurar."})
        return attrs


class InstallWordPressSerializer(serializers.Serializer):
    domain = serializers.PrimaryKeyRelatedField(queryset=HostingDomain.objects.select_related("account", "account__node").all())
    site_title = serializers.CharField(max_length=120)
    db_name = serializers.RegexField(r"^[A-Za-z][A-Za-z0-9_]{1,47}$")
    db_user = serializers.RegexField(r"^[A-Za-z][A-Za-z0-9_]{1,47}$")
    db_password = serializers.CharField(write_only=True, min_length=8, max_length=255)
    admin_user = serializers.RegexField(r"^[A-Za-z0-9_.@-]{3,60}$")
    admin_password = serializers.CharField(write_only=True, min_length=10, max_length=255)
    admin_email = serializers.EmailField()
    table_prefix = serializers.RegexField(r"^[A-Za-z0-9_]{1,20}$", default="wp_")
    force = serializers.BooleanField(default=False)
    language = serializers.CharField(max_length=12, required=False, default="es_ES")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            allowed_accounts = scoped_accounts(HostingAccount.objects.all(), request.user)
            self.fields["domain"].queryset = HostingDomain.objects.filter(account__in=allowed_accounts)

    def validate(self, attrs):
        hosting_domain = attrs["domain"]
        request = self.context.get("request")
        if request and not user_can_access_account(request.user, hosting_domain.account):
            raise serializers.ValidationError({"domain": "No tienes acceso a este dominio."})
        if HostingApplication.objects.filter(domain=hosting_domain, app_type=HostingApplication.AppType.WORDPRESS).exists() and not attrs.get("force"):
            raise serializers.ValidationError({"domain": "Ya existe una instalacion WordPress registrada para este dominio."})
        attrs["db_name"] = attrs["db_name"].lower()
        attrs["db_user"] = attrs["db_user"].lower()
        if HostingDatabase.objects.filter(name=attrs["db_name"]).exists() and not attrs.get("force"):
            raise serializers.ValidationError({"db_name": "Ya existe una base de datos con ese nombre."})
        return attrs


class AppInstallSuggestionSerializer(serializers.Serializer):
    domain = serializers.PrimaryKeyRelatedField(queryset=HostingDomain.objects.select_related("account", "account__node").all())
    runtime = serializers.ChoiceField(choices=HostingApplication.AppType.choices)
    name = serializers.CharField(max_length=120, required=False, allow_blank=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            allowed_accounts = scoped_accounts(HostingAccount.objects.all(), request.user)
            self.fields["domain"].queryset = HostingDomain.objects.filter(account__in=allowed_accounts)

    def validate(self, attrs):
        hosting_domain = attrs["domain"]
        request = self.context.get("request")
        if request and not user_can_access_account(request.user, hosting_domain.account):
            raise serializers.ValidationError({"domain": "No tienes acceso a este dominio."})
        return attrs


class InstallCatalogAppSerializer(serializers.Serializer):
    runtime = serializers.ChoiceField(choices=HostingApplication.AppType.choices)
    domain = serializers.PrimaryKeyRelatedField(queryset=HostingDomain.objects.select_related("account", "account__node").all())
    name = serializers.CharField(max_length=120)
    instance_id = serializers.RegexField(r"^[a-z0-9][a-z0-9-]{1,48}$", required=False)
    port = serializers.IntegerField(min_value=1024, max_value=65535, required=False)
    working_dir = serializers.CharField(max_length=255, required=False, allow_blank=True)
    site_title = serializers.CharField(max_length=120, required=False, allow_blank=True)
    admin_user = serializers.RegexField(r"^[A-Za-z0-9_.@-]{3,60}$", required=False)
    admin_password = serializers.CharField(write_only=True, min_length=8, max_length=255, required=False)
    admin_email = serializers.EmailField(required=False)
    language = serializers.CharField(max_length=12, required=False, default="es_ES")
    table_prefix = serializers.RegexField(r"^[A-Za-z0-9_]{1,20}$", required=False, default="wp_")
    database_engine = serializers.ChoiceField(choices=HostingDatabase.Engine.choices, required=False)
    db_name = serializers.RegexField(r"^[A-Za-z][A-Za-z0-9_]{1,47}$", required=False)
    db_user = serializers.RegexField(r"^[A-Za-z][A-Za-z0-9_]{1,47}$", required=False)
    db_password = serializers.CharField(write_only=True, min_length=8, max_length=255, required=False)
    project_module = serializers.RegexField(r"^[A-Za-z_][A-Za-z0-9_]{1,48}$", required=False, default="ehpanelapp")
    django_version = serializers.CharField(max_length=40, required=False, allow_blank=True)
    workers = serializers.IntegerField(min_value=1, max_value=16, required=False, default=2)
    php_version = serializers.CharField(max_length=20, required=False, allow_blank=True)
    script = serializers.CharField(max_length=160, required=False, default="server.js")
    node_version = serializers.CharField(max_length=40, required=False, allow_blank=True)
    wsgi_module = serializers.CharField(max_length=120, required=False, default="app:application")
    create_database = serializers.BooleanField(required=False, default=True)
    force = serializers.BooleanField(default=False)
    security = serializers.DictField(required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            allowed_accounts = scoped_accounts(HostingAccount.objects.all(), request.user)
            self.fields["domain"].queryset = HostingDomain.objects.filter(account__in=allowed_accounts)

    def validate(self, attrs):
        hosting_domain = attrs["domain"]
        runtime = attrs["runtime"]
        request = self.context.get("request")
        if request and not user_can_access_account(request.user, hosting_domain.account):
            raise serializers.ValidationError({"domain": "No tienes acceso a este dominio."})
        if runtime in [HostingApplication.AppType.WORDPRESS, HostingApplication.AppType.MOODLE]:
            required = ["admin_user", "admin_password", "admin_email", "db_name", "db_user", "db_password"]
            missing = [field for field in required if not attrs.get(field)]
            if missing:
                app_label = "Moodle" if runtime == HostingApplication.AppType.MOODLE else "WordPress"
                raise serializers.ValidationError({field: f"Campo requerido para {app_label}." for field in missing})
            if runtime == HostingApplication.AppType.MOODLE:
                password = attrs.get("admin_password", "")
                if not (re.search(r"[a-z]", password) and re.search(r"[A-Z]", password) and re.search(r"\d", password) and re.search(r"[^A-Za-z0-9]", password)):
                    raise serializers.ValidationError({"admin_password": "Moodle requiere una contraseña con mayuscula, minuscula, numero y simbolo."})
            if HostingApplication.objects.filter(domain=hosting_domain, app_type=runtime).exists() and not attrs.get("force"):
                app_label = "Moodle" if runtime == HostingApplication.AppType.MOODLE else "WordPress"
                raise serializers.ValidationError({"domain": f"Ya existe una instalacion {app_label} registrada para este dominio."})
        elif runtime in [HostingApplication.AppType.DJANGO, HostingApplication.AppType.LARAVEL]:
            required = ["instance_id", "port", "working_dir", "db_name", "db_user", "db_password", "database_engine"]
            missing = [field for field in required if not attrs.get(field)]
            if missing:
                raise serializers.ValidationError({field: "Campo requerido para esta aplicacion." for field in missing})
        else:
            required = ["instance_id", "port", "working_dir"]
            missing = [field for field in required if not attrs.get(field)]
            if missing:
                raise serializers.ValidationError({field: "Campo requerido para esta aplicacion." for field in missing})
        if attrs.get("instance_id") and HostingApplication.objects.filter(metadata__instance_id=attrs["instance_id"]).exists():
            raise serializers.ValidationError({"instance_id": "Ya existe una aplicacion con ese instance ID."})
        for field in ["db_name", "db_user"]:
            if attrs.get(field):
                attrs[field] = attrs[field].lower()
        return attrs


class DeployPythonAppSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    domain = serializers.PrimaryKeyRelatedField(queryset=HostingDomain.objects.select_related("account", "account__node").all())
    instance_id = serializers.RegexField(r"^[a-z0-9][a-z0-9-]{1,48}$")
    port = serializers.IntegerField(min_value=1024, max_value=65535)
    working_dir = serializers.CharField(max_length=255)
    wsgi_module = serializers.CharField(max_length=120, default="app:application")
    workers = serializers.IntegerField(min_value=1, max_value=16, default=1)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            allowed_accounts = scoped_accounts(HostingAccount.objects.all(), request.user)
            self.fields["domain"].queryset = HostingDomain.objects.filter(account__in=allowed_accounts)

    def validate(self, attrs):
        hosting_domain = attrs["domain"]
        request = self.context.get("request")
        if request and not user_can_access_account(request.user, hosting_domain.account):
            raise serializers.ValidationError({"domain": "No tienes acceso a este dominio."})
        if HostingApplication.objects.filter(metadata__instance_id=attrs["instance_id"]).exists():
            raise serializers.ValidationError({"instance_id": "Ya existe una aplicacion con ese instance ID."})
        return attrs


class DeployNodeAppSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    domain = serializers.PrimaryKeyRelatedField(queryset=HostingDomain.objects.select_related("account", "account__node").all())
    instance_id = serializers.RegexField(r"^[a-z0-9][a-z0-9-]{1,48}$")
    port = serializers.IntegerField(min_value=1024, max_value=65535)
    working_dir = serializers.CharField(max_length=255)
    script = serializers.CharField(max_length=160, default="server.js")
    node_version = serializers.CharField(max_length=40, required=False, allow_blank=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            allowed_accounts = scoped_accounts(HostingAccount.objects.all(), request.user)
            self.fields["domain"].queryset = HostingDomain.objects.filter(account__in=allowed_accounts)

    def validate(self, attrs):
        hosting_domain = attrs["domain"]
        request = self.context.get("request")
        if request and not user_can_access_account(request.user, hosting_domain.account):
            raise serializers.ValidationError({"domain": "No tienes acceso a este dominio."})
        if HostingApplication.objects.filter(metadata__instance_id=attrs["instance_id"]).exists():
            raise serializers.ValidationError({"instance_id": "Ya existe una aplicacion con ese instance ID."})
        return attrs


class DeployDjangoAppSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    domain = serializers.PrimaryKeyRelatedField(queryset=HostingDomain.objects.select_related("account", "account__node").all())
    instance_id = serializers.RegexField(r"^[a-z0-9][a-z0-9-]{1,48}$")
    port = serializers.IntegerField(min_value=1024, max_value=65535)
    working_dir = serializers.CharField(max_length=255)
    project_module = serializers.RegexField(r"^[A-Za-z_][A-Za-z0-9_]{1,48}$", default="ehpanelapp")
    django_version = serializers.CharField(max_length=40, required=False, allow_blank=True)
    workers = serializers.IntegerField(min_value=1, max_value=16, default=2)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            allowed_accounts = scoped_accounts(HostingAccount.objects.all(), request.user)
            self.fields["domain"].queryset = HostingDomain.objects.filter(account__in=allowed_accounts)

    def validate(self, attrs):
        hosting_domain = attrs["domain"]
        request = self.context.get("request")
        if request and not user_can_access_account(request.user, hosting_domain.account):
            raise serializers.ValidationError({"domain": "No tienes acceso a este dominio."})
        if HostingApplication.objects.filter(metadata__instance_id=attrs["instance_id"]).exists():
            raise serializers.ValidationError({"instance_id": "Ya existe una aplicacion con ese instance ID."})
        return attrs


class DeployLaravelAppSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    domain = serializers.PrimaryKeyRelatedField(queryset=HostingDomain.objects.select_related("account", "account__node").all())
    instance_id = serializers.RegexField(r"^[a-z0-9][a-z0-9-]{1,48}$")
    port = serializers.IntegerField(min_value=1024, max_value=65535)
    working_dir = serializers.CharField(max_length=255)
    php_version = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            allowed_accounts = scoped_accounts(HostingAccount.objects.all(), request.user)
            self.fields["domain"].queryset = HostingDomain.objects.filter(account__in=allowed_accounts)

    def validate(self, attrs):
        hosting_domain = attrs["domain"]
        request = self.context.get("request")
        if request and not user_can_access_account(request.user, hosting_domain.account):
            raise serializers.ValidationError({"domain": "No tienes acceso a este dominio."})
        if HostingApplication.objects.filter(metadata__instance_id=attrs["instance_id"]).exists():
            raise serializers.ValidationError({"instance_id": "Ya existe una aplicacion con ese instance ID."})
        return attrs


class ChangeMailboxPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, min_length=8, max_length=255)


class SetMailboxQuotaSerializer(serializers.Serializer):
    quota_mb = serializers.IntegerField(min_value=10)


class TestMailboxDeliverySerializer(serializers.Serializer):
    to = serializers.EmailField()
    subject = serializers.CharField(max_length=160, required=False, allow_blank=True)


class ProvisioningStepSerializer(serializers.ModelSerializer):
    job = AgentJobSerializer(read_only=True)

    class Meta:
        model = ProvisioningStep
        fields = ["id", "name", "order", "job", "created_at"]


class ProvisioningRunSerializer(serializers.ModelSerializer):
    steps = ProvisioningStepSerializer(many=True, read_only=True)

    class Meta:
        model = ProvisioningRun
        fields = ["id", "status", "steps", "created_at", "updated_at"]


class HostingAccountSerializer(serializers.ModelSerializer):
    node_hostname = serializers.CharField(source="node.hostname", read_only=True)
    node_public_ip = serializers.SerializerMethodField()
    plan_name = serializers.CharField(source="plan.name", read_only=True, allow_null=True)
    owner_username = serializers.CharField(source="owner.username", read_only=True, allow_null=True)
    reseller_username = serializers.CharField(source="reseller.username", read_only=True, allow_null=True)
    domains = HostingDomainSerializer(many=True, read_only=True)
    databases = HostingDatabaseSerializer(many=True, read_only=True)
    mailboxes = HostingMailboxSerializer(many=True, read_only=True)
    provisioning_runs = ProvisioningRunSerializer(many=True, read_only=True)
    domains_count = serializers.SerializerMethodField()
    databases_count = serializers.SerializerMethodField()
    mailboxes_count = serializers.SerializerMethodField()
    latest_provisioning = serializers.SerializerMethodField()
    normalized_status = serializers.SerializerMethodField()

    class Meta:
        model = HostingAccount
        fields = [
            "id",
            "node",
            "node_hostname",
            "node_public_ip",
            "plan",
            "plan_name",
            "owner",
            "owner_username",
            "reseller",
            "reseller_username",
            "username",
            "primary_domain",
            "customer_name",
            "customer_email",
            "billing_client_id",
            "billing_service_id",
            "billing_synced_at",
            "billing_status",
            "billing_metadata",
            "status",
            "web_engine",
            "php_version",
            "disk_mb",
            "bandwidth_mb",
            "memory_mb",
            "cpu_pct",
            "last_usage",
            "last_usage_at",
            "domains",
            "databases",
            "mailboxes",
            "provisioning_runs",
            "domains_count",
            "databases_count",
            "mailboxes_count",
            "latest_provisioning",
            "normalized_status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "node",
            "node_hostname",
            "node_public_ip",
            "plan_name",
            "username",
            "primary_domain",
            "status",
            "owner_username",
            "reseller_username",
            "domains",
            "databases",
            "mailboxes",
            "provisioning_runs",
            "domains_count",
            "databases_count",
            "mailboxes_count",
            "latest_provisioning",
            "normalized_status",
            "billing_synced_at",
            "last_usage",
            "last_usage_at",
            "created_at",
            "updated_at",
        ]

    def get_node_public_ip(self, obj):
        return node_public_ip(obj.node)

    def get_domains_count(self, obj):
        return obj.domains.count()

    def get_databases_count(self, obj):
        return obj.databases.count()

    def get_mailboxes_count(self, obj):
        return obj.mailboxes.count()

    def get_latest_provisioning(self, obj):
        run = obj.provisioning_runs.all().first()
        if not run:
            return None
        steps = list(run.steps.all())
        failed_statuses = {"failed", "canceled", "expired"}
        active_statuses = {"running", "sent", "queued"}
        failed_step = next((step for step in steps if step.job.status in failed_statuses), None)
        active_step = next((step for step in steps if step.job.status in active_statuses), None)
        last_step = failed_step or active_step or (steps[-1] if steps else None)
        steps_success = sum(1 for step in steps if step.job.status == "success")
        steps_failed = sum(1 for step in steps if step.job.status in failed_statuses)
        steps_running = sum(1 for step in steps if step.job.status in active_statuses)
        progress_percent = round((steps_success / len(steps)) * 100) if steps else 0
        visual_status = run.status
        tone = "gray"
        if steps_failed:
            visual_status = "warning" if obj.status == HostingAccount.Status.ACTIVE else "failed"
            tone = "amber" if visual_status == "warning" else "red"
        elif steps_running:
            visual_status = "provisioning"
            tone = "blue"
        elif run.status == "success":
            tone = "green"
        return {
            "id": str(run.id),
            "status": run.status,
            "visual_status": visual_status,
            "tone": tone,
            "steps_total": len(steps),
            "steps_success": steps_success,
            "steps_failed": steps_failed,
            "steps_running": steps_running,
            "progress_percent": progress_percent,
            "last_step": last_step.name if last_step else "",
            "last_job_status": last_step.job.status if last_step else "",
            "error_code": last_step.job.error_code if last_step else "",
            "error_detail": last_step.job.error_detail if last_step else "",
            "can_retry": bool(steps_failed),
            "updated_at": run.updated_at,
        }

    def get_normalized_status(self, obj):
        summary = self.get_latest_provisioning(obj)
        if obj.status == HostingAccount.Status.SUSPENDED:
            return {"status": "suspended", "label": "Suspendido", "tone": "gray"}
        if obj.status == HostingAccount.Status.ACTIVE and summary and summary["steps_failed"]:
            return {"status": "active_warning", "label": "Activo con avisos", "tone": "amber"}
        if obj.status == HostingAccount.Status.ACTIVE:
            return {"status": "active", "label": "Activo", "tone": "green"}
        if obj.status == HostingAccount.Status.PROVISIONING:
            return {"status": "provisioning", "label": "Provisionando", "tone": "blue"}
        if obj.status == HostingAccount.Status.FAILED:
            return {"status": "failed", "label": "Fallido", "tone": "red"}
        if obj.status == HostingAccount.Status.PENDING:
            return {"status": "pending", "label": "Pendiente", "tone": "amber"}
        return {"status": obj.status, "label": obj.get_status_display(), "tone": "gray"}

    def validate(self, attrs):
        validate_web_engine_php(attrs, self.instance)
        validate_plan_runtime(attrs, self.instance)
        plan = attrs.get("plan")
        if plan:
            attrs["disk_mb"] = plan.disk_mb
            attrs["bandwidth_mb"] = plan.bandwidth_mb
            attrs["memory_mb"] = plan.memory_mb
            attrs["cpu_pct"] = plan.cpu_pct
        return attrs


class HostingResellerProfileSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    is_active = serializers.BooleanField(source="user.is_active", read_only=True)
    plan_name = serializers.CharField(source="plan.name", read_only=True, allow_null=True)
    primary_node_hostname = serializers.CharField(source="primary_node.hostname", read_only=True, allow_null=True)
    accounts_count = serializers.SerializerMethodField()
    active_accounts_count = serializers.SerializerMethodField()
    suspended_accounts_count = serializers.SerializerMethodField()
    disk_used_mb = serializers.SerializerMethodField()
    bandwidth_used_mb = serializers.SerializerMethodField()
    disk_pct = serializers.SerializerMethodField()
    bandwidth_pct = serializers.SerializerMethodField()

    class Meta:
        model = HostingResellerProfile
        fields = [
            "id",
            "user_id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "plan",
            "plan_name",
            "primary_node",
            "primary_node_hostname",
            "company_name",
            "panel_domain",
            "support_email",
            "brand_primary_color",
            "brand_accent_color",
            "ip_allowlist",
            "disk_mb",
            "bandwidth_mb",
            "max_accounts",
            "max_mailboxes",
            "max_databases",
            "max_domains",
            "status",
            "accounts_count",
            "active_accounts_count",
            "suspended_accounts_count",
            "disk_used_mb",
            "bandwidth_used_mb",
            "disk_pct",
            "bandwidth_pct",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def _accounts(self, obj):
        prefetched = getattr(obj, "accounts_for_summary", None)
        if prefetched is None:
            prefetched = getattr(obj.user, "accounts_for_summary", None)
        if prefetched is not None:
            return prefetched
        return list(obj.user.reseller_accounts.all())

    def get_accounts_count(self, obj):
        return len(self._accounts(obj))

    def get_active_accounts_count(self, obj):
        return len([account for account in self._accounts(obj) if account.status == HostingAccount.Status.ACTIVE])

    def get_suspended_accounts_count(self, obj):
        return len([account for account in self._accounts(obj) if account.status == HostingAccount.Status.SUSPENDED])

    def get_disk_used_mb(self, obj):
        return sum(read_usage_number(account.last_usage, ["disk_used_mb", "storage.total_mb"]) for account in self._accounts(obj))

    def get_bandwidth_used_mb(self, obj):
        return sum(read_usage_number(account.last_usage, ["bandwidth_used_mb", "bandwidth_mb"]) for account in self._accounts(obj))

    def get_disk_pct(self, obj):
        return percent(self.get_disk_used_mb(obj), obj.disk_mb)

    def get_bandwidth_pct(self, obj):
        return percent(self.get_bandwidth_used_mb(obj), obj.bandwidth_mb)


class CreateHostingResellerProfileSerializer(serializers.Serializer):
    company_name = serializers.CharField(max_length=160)
    username = serializers.RegexField(r"^[A-Za-z0-9_.-]{3,64}$")
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, max_length=255)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    panel_domain = serializers.CharField(max_length=255, required=False, allow_blank=True)
    plan = serializers.PrimaryKeyRelatedField(queryset=HostingPlan.objects.filter(is_active=True))
    primary_node = serializers.PrimaryKeyRelatedField(queryset=Node.objects.all(), required=False, allow_null=True)

    def validate_plan(self, value):
        if value.features.get("plan_scope") != "reseller":
            raise serializers.ValidationError("Debe seleccionar un plan revendedor.")
        return value

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con este username.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con este email.")
        return value

    def create(self, validated_data):
        plan = validated_data.pop("plan")
        primary_node = validated_data.pop("primary_node", None)
        password = validated_data.pop("password")
        panel_domain = validated_data.pop("panel_domain", "")
        company_name = validated_data.pop("company_name")
        with transaction.atomic():
            user = User(
                username=validated_data["username"],
                email=validated_data["email"],
                first_name=validated_data.get("first_name", ""),
                last_name=validated_data.get("last_name", ""),
                is_staff=False,
                is_superuser=False,
                is_active=True,
            )
            user.set_password(password)
            user.save()
            reseller_group, _created = Group.objects.get_or_create(name="reseller")
            user.groups.add(reseller_group)
            return HostingResellerProfile.objects.create(
                user=user,
                plan=plan,
                primary_node=primary_node,
                company_name=company_name,
                panel_domain=panel_domain,
                disk_mb=plan.disk_mb,
                bandwidth_mb=plan.bandwidth_mb,
                max_accounts=reseller_feature_number(plan, "reseller_clients"),
                max_mailboxes=plan.max_mailboxes,
                max_databases=plan.max_databases,
                max_domains=plan.max_domains,
            )


class ResellerBrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = HostingResellerProfile
        fields = ["company_name", "panel_domain", "support_email", "brand_primary_color", "brand_accent_color"]


class ResellerSecuritySerializer(serializers.ModelSerializer):
    class Meta:
        model = HostingResellerProfile
        fields = ["ip_allowlist"]


class ResellerTeamMemberSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    is_active = serializers.BooleanField(source="user.is_active", read_only=True)

    class Meta:
        model = ResellerTeamMember
        fields = [
            "id",
            "user_id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "role",
            "can_view_accounts",
            "can_manage_support",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "user_id", "username", "email", "first_name", "last_name", "is_active", "created_at", "updated_at"]


class CreateResellerTeamMemberSerializer(serializers.Serializer):
    username = serializers.RegexField(r"^[A-Za-z0-9_.-]{3,64}$")
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, max_length=255)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=ResellerTeamMember.Role.choices, default=ResellerTeamMember.Role.SUPPORT)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con este username.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con este email.")
        return value

    def create(self, validated_data):
        reseller = self.context["reseller"]
        password = validated_data.pop("password")
        role = validated_data.pop("role", ResellerTeamMember.Role.SUPPORT)
        with transaction.atomic():
            user = User(
                username=validated_data["username"],
                email=validated_data["email"],
                first_name=validated_data.get("first_name", ""),
                last_name=validated_data.get("last_name", ""),
                is_staff=False,
                is_superuser=False,
                is_active=True,
            )
            user.set_password(password)
            user.save()
            reseller_group, _created = Group.objects.get_or_create(name="reseller")
            user.groups.add(reseller_group)
            return ResellerTeamMember.objects.create(reseller=reseller, user=user, role=role)


class UpdateResellerTeamMemberSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=ResellerTeamMember.Role.choices, required=False)
    status = serializers.ChoiceField(choices=ResellerTeamMember.Status.choices, required=False)
    is_active = serializers.BooleanField(required=False)


class ChangeOwnPasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8, max_length=255)


def reseller_feature_number(plan, key):
    value = (plan.features or {}).get(key)
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return int(value)
        except ValueError:
            return 0
    return 0


def read_usage_number(value, keys):
    value = value or {}
    if not isinstance(value, dict):
        return 0
    for key in keys:
        current = value
        for part in key.split("."):
            if not isinstance(current, dict):
                current = None
                break
            current = current.get(part)
        if isinstance(current, (int, float)):
            return current
    return 0


def percent(used, total):
    if not used or not total:
        return 0
    return max(0, min(100, round((used / total) * 100)))


class MigrationSourceSerializer(serializers.ModelSerializer):
    provider_label = serializers.CharField(source="get_provider_display", read_only=True)
    secret = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = MigrationSource
        fields = [
            "id",
            "provider",
            "provider_label",
            "host",
            "port",
            "username",
            "auth_method",
            "secret",
            "status",
            "last_error",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "provider_label", "status", "last_error", "created_at", "updated_at"]

    def validate_provider(self, value):
        if value not in {MigrationSource.Provider.CPANEL, MigrationSource.Provider.PLESK}:
            raise serializers.ValidationError("Este origen queda en desarrollo. Por ahora se habilita cPanel/WHM y Plesk.")
        return value

    def validate_port(self, value):
        if value <= 0 or value > 65535:
            raise serializers.ValidationError("Puerto invalido.")
        return value


class MigrationStepSerializer(serializers.ModelSerializer):
    job_status = serializers.CharField(source="job.status", read_only=True, allow_null=True)

    class Meta:
        model = MigrationStep
        fields = ["id", "account", "key", "label", "order", "status", "progress_percent", "job", "job_status", "error_detail", "created_at", "updated_at"]
        read_only_fields = fields


class MigrationAccountSerializer(serializers.ModelSerializer):
    destination_domain = serializers.CharField(source="destination_account.primary_domain", read_only=True, allow_null=True)

    class Meta:
        model = MigrationAccount
        fields = [
            "id",
            "run",
            "source_username",
            "primary_domain",
            "customer_email",
            "status",
            "current_step",
            "progress_percent",
            "files_mb",
            "databases_count",
            "mailboxes_count",
            "subdomains_count",
            "detected",
            "destination_account",
            "destination_domain",
            "last_job",
            "error_code",
            "error_detail",
            "started_at",
            "finished_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class MigrationLogSerializer(serializers.ModelSerializer):
    account_domain = serializers.CharField(source="account.primary_domain", read_only=True, allow_null=True)

    class Meta:
        model = MigrationLog
        fields = ["id", "run", "account", "account_domain", "level", "message", "metadata", "created_at"]
        read_only_fields = fields


class MigrationRunSerializer(serializers.ModelSerializer):
    source = MigrationSourceSerializer(read_only=True)
    destination_node_hostname = serializers.CharField(source="destination_node.hostname", read_only=True)
    accounts = MigrationAccountSerializer(many=True, read_only=True)
    steps = MigrationStepSerializer(many=True, read_only=True)
    logs = serializers.SerializerMethodField()
    origin = serializers.SerializerMethodField()
    account_label = serializers.SerializerMethodField()

    class Meta:
        model = MigrationRun
        fields = [
            "id",
            "source",
            "destination_node",
            "destination_node_hostname",
            "mode",
            "priority",
            "migration_type",
            "concurrency",
            "status",
            "current_step",
            "progress_percent",
            "total_accounts",
            "completed_accounts",
            "failed_accounts",
            "selected_accounts",
            "options",
            "notes",
            "started_at",
            "finished_at",
            "created_at",
            "updated_at",
            "accounts",
            "steps",
            "logs",
            "origin",
            "account_label",
        ]
        read_only_fields = fields

    def get_logs(self, obj):
        return MigrationLogSerializer(obj.logs.all()[:20], many=True).data

    def get_origin(self, obj):
        return f"{obj.source.get_provider_display()} - {obj.source.host}"

    def get_account_label(self, obj):
        first = obj.accounts.all().first()
        if first:
            return first.primary_domain
        if obj.total_accounts:
            return f"{obj.total_accounts} cuentas detectadas"
        return obj.source.host


class CreateMigrationRunSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=MigrationSource.Provider.choices)
    host = serializers.CharField(max_length=255)
    port = serializers.IntegerField(min_value=1, max_value=65535, default=22)
    username = serializers.CharField(max_length=120)
    secret = serializers.CharField(write_only=True, required=False, allow_blank=True)
    auth_method = serializers.ChoiceField(choices=MigrationSource.AuthMethod.choices, default=MigrationSource.AuthMethod.PASSWORD)
    destination_node = serializers.PrimaryKeyRelatedField(queryset=Node.objects.all())
    migration_type = serializers.ChoiceField(choices=["full", "files_databases", "mail_only", "multiple_accounts", "server_full"], default="full")
    mode = serializers.ChoiceField(choices=MigrationRun.Mode.choices, default=MigrationRun.Mode.SELECT_AND_MIGRATE)
    priority = serializers.ChoiceField(choices=["low", "normal", "high"], default="normal")
    concurrency = serializers.IntegerField(min_value=1, max_value=5, default=1)
    selected_accounts = serializers.ListField(child=serializers.CharField(max_length=255), required=False, default=list)
    notes = serializers.CharField(required=False, allow_blank=True)
    preserve_mail_passwords = serializers.BooleanField(default=True)
    include_files = serializers.BooleanField(default=True)
    include_databases = serializers.BooleanField(default=True)
    include_mail = serializers.BooleanField(default=True)
    include_subdomains = serializers.BooleanField(default=True)

    def validate_provider(self, value):
        if value not in {MigrationSource.Provider.CPANEL, MigrationSource.Provider.PLESK}:
            raise serializers.ValidationError("Este origen queda en desarrollo. Por ahora se habilita cPanel/WHM y Plesk.")
        return value


class CreateImportRunSerializer(serializers.Serializer):
    IMPORT_SOURCE_CHOICES = ["file_upload", "remote_url"]
    PANEL_CHOICES = ["cpanel", "plesk", "directadmin", "ehpanel", "generic"]

    destination_node = serializers.PrimaryKeyRelatedField(queryset=Node.objects.all())
    import_source = serializers.ChoiceField(choices=IMPORT_SOURCE_CHOICES)
    panel_type = serializers.ChoiceField(choices=PANEL_CHOICES, default="cpanel")
    backup_url = serializers.URLField(required=False, allow_blank=True)
    backup_file = serializers.FileField(required=False, allow_empty_file=False)
    account_label = serializers.CharField(max_length=255, required=False, allow_blank=True)
    migration_type = serializers.ChoiceField(choices=["full", "files_databases", "mail_only"], default="full")
    priority = serializers.ChoiceField(choices=["low", "normal", "high"], default="normal")
    notes = serializers.CharField(required=False, allow_blank=True)
    preserve_mail_passwords = serializers.BooleanField(default=True)
    include_files = serializers.BooleanField(default=True)
    include_databases = serializers.BooleanField(default=True)
    include_mail = serializers.BooleanField(default=True)
    include_subdomains = serializers.BooleanField(default=True)

    def validate(self, attrs):
        source = attrs.get("import_source")
        if source == "remote_url" and not attrs.get("backup_url"):
            raise serializers.ValidationError({"backup_url": "La URL del backup es requerida."})
        if source == "file_upload" and not attrs.get("backup_file"):
            raise serializers.ValidationError({"backup_file": "Debes subir un archivo de backup."})
        return attrs


class StartMigrationRunSerializer(serializers.Serializer):
    selected_accounts = serializers.ListField(child=serializers.CharField(max_length=255), required=False, default=list)
    concurrency = serializers.IntegerField(min_value=1, max_value=5, required=False)


class ChangeAccountPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, min_length=8, max_length=255)


class AccountFilePathSerializer(serializers.Serializer):
    path = serializers.CharField(required=False, allow_blank=True, max_length=1024)


class AccountFileWriteSerializer(serializers.Serializer):
    path = serializers.CharField(max_length=1024)
    content = serializers.CharField(allow_blank=True, max_length=1024 * 1024)


class AccountFileDeleteSerializer(serializers.Serializer):
    path = serializers.CharField(max_length=1024)
    recursive = serializers.BooleanField(default=False)


class AccountFileMkdirSerializer(serializers.Serializer):
    path = serializers.CharField(max_length=1024)


class AccountFileChmodSerializer(serializers.Serializer):
    path = serializers.CharField(max_length=1024)
    mode = serializers.RegexField(r"^[0-7]{3,4}$")


class AccountFileCompressSerializer(serializers.Serializer):
    paths = serializers.ListField(child=serializers.CharField(max_length=1024), min_length=1, max_length=200)
    archive_name = serializers.RegexField(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,160}$")
    format = serializers.ChoiceField(choices=["zip", "tar.gz", "tar"])
    destination_path = serializers.CharField(required=False, allow_blank=True, max_length=1024)


class AccountFileExtractSerializer(serializers.Serializer):
    path = serializers.CharField(max_length=1024)
    destination_path = serializers.CharField(required=False, allow_blank=True, max_length=1024)
    format = serializers.ChoiceField(choices=["zip", "tar.gz", "tar"], required=False)


class AccountFileTransferSerializer(serializers.Serializer):
    path = serializers.CharField(max_length=1024)
    destination_path = serializers.CharField(max_length=1024)
    overwrite = serializers.BooleanField(default=True)


class AccountFileRenameSerializer(serializers.Serializer):
    path = serializers.CharField(max_length=1024)
    name = serializers.RegexField(r"^[^/\\]{1,255}$")
    overwrite = serializers.BooleanField(default=False)


class AccountFileImportUrlSerializer(serializers.Serializer):
    url = serializers.URLField()
    path = serializers.CharField(required=False, allow_blank=True, max_length=1024)
    overwrite = serializers.BooleanField(default=True)


class AccountFileUploadSerializer(serializers.Serializer):
    path = serializers.CharField(max_length=1024)
    overwrite = serializers.BooleanField(default=True)


class InitialDatabaseSerializer(serializers.Serializer):
    engine = serializers.ChoiceField(choices=HostingDatabase.Engine.choices, default=HostingDatabase.Engine.MARIADB)
    name = serializers.RegexField(r"^[A-Za-z0-9_]{1,64}$")
    username = serializers.RegexField(r"^[A-Za-z0-9_]{1,64}$")
    password = serializers.CharField(write_only=True, min_length=8, max_length=255)


class InitialMailboxSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, max_length=255)
    quota_mb = serializers.IntegerField(min_value=0, default=1024)


class ProvisionHostingAccountSerializer(serializers.ModelSerializer):
    node = serializers.PrimaryKeyRelatedField(queryset=Node.objects.all(), required=False, allow_null=True)
    account_password = serializers.CharField(write_only=True, min_length=8, max_length=255)
    public_ip = serializers.IPAddressField(write_only=True, required=False)
    ssl_email = serializers.EmailField(write_only=True, required=False, allow_blank=True)
    ssl_staging = serializers.BooleanField(write_only=True, default=False)
    ssl_force_renewal = serializers.BooleanField(write_only=True, default=False)
    dns_records = serializers.ListField(child=serializers.DictField(), write_only=True, required=False, default=list)
    database = InitialDatabaseSerializer(write_only=True, required=False)
    mailbox = InitialMailboxSerializer(write_only=True, required=False)

    class Meta:
        model = HostingAccount
        fields = [
            "id",
            "node",
            "plan",
            "owner",
            "reseller",
            "username",
            "account_password",
            "primary_domain",
            "customer_name",
            "customer_email",
            "web_engine",
            "php_version",
            "disk_mb",
            "bandwidth_mb",
            "memory_mb",
            "cpu_pct",
            "public_ip",
            "ssl_email",
            "ssl_staging",
            "ssl_force_renewal",
            "dns_records",
            "database",
            "mailbox",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        validate_web_engine_php(attrs)
        validate_plan_runtime(attrs)
        if not attrs.get("node") and not is_local_provisioning_enabled():
            raise serializers.ValidationError({"node": "El nodo es requerido cuando el provisionamiento no es local."})
        plan = attrs.get("plan")
        if plan:
            attrs.setdefault("disk_mb", plan.disk_mb)
            attrs.setdefault("bandwidth_mb", plan.bandwidth_mb)
            attrs.setdefault("memory_mb", plan.memory_mb)
            attrs.setdefault("cpu_pct", plan.cpu_pct)
        if not str(attrs.get("customer_email") or "").strip():
            raise serializers.ValidationError({"customer_email": "El correo principal es requerido para crear la credencial independiente del sitio."})
        username = attrs.get("username")
        if username:
            existing_user = User.objects.filter(username__iexact=username).first()
            if existing_user and (existing_user.is_staff or existing_user.is_superuser):
                raise serializers.ValidationError({"username": "Ese username ya pertenece a un usuario administrativo."})
        return attrs

    def create(self, validated_data):
        provision_options = {
            "public_ip": validated_data.pop("public_ip", ""),
            "account_password": validated_data.pop("account_password"),
            "ssl_email": validated_data.pop("ssl_email", ""),
            "ssl_staging": validated_data.pop("ssl_staging", False),
            "ssl_force_renewal": validated_data.pop("ssl_force_renewal", False),
            "dns_records": validated_data.pop("dns_records", []),
            "database": validated_data.pop("database", None),
            "mailbox": validated_data.pop("mailbox", None),
        }
        with transaction.atomic():
            request = self.context.get("request")
            if request and not (request.user.is_superuser or request.user.is_staff):
                if hasattr(request.user, "hosting_reseller_profile"):
                    validated_data["reseller"] = request.user
                else:
                    validated_data["owner"] = request.user
            if not validated_data.get("node") and is_local_provisioning_enabled():
                validated_data["node"] = ensure_local_node()
            account = HostingAccount.objects.create(**validated_data)
            provision_hosting_account(account, provision_options)
        return account


class AuditLogSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True, default="system")
    account_domain = serializers.CharField(source="account.primary_domain", read_only=True, allow_null=True)
    method = serializers.SerializerMethodField()
    path = serializers.SerializerMethodField()
    status_code = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "user",
            "user_username",
            "action",
            "method",
            "path",
            "status_code",
            "ip",
            "account",
            "account_domain",
            "target_type",
            "target_id",
            "target_label",
            "metadata",
            "created_at",
        ]

    def get_method(self, obj):
        return obj.metadata.get("method", "ACTION")

    def get_path(self, obj):
        return obj.metadata.get("path") or obj.target_label or obj.target_id or obj.action

    def get_status_code(self, obj):
        return obj.metadata.get("status_code", 200)
