from rest_framework import serializers
from django.conf import settings
from django.utils import timezone

from .models import AgentEvent, AgentJob, EnrollmentToken, Node


class NodeSerializer(serializers.ModelSerializer):
    effective_state = serializers.CharField(read_only=True)
    is_stale = serializers.BooleanField(read_only=True)
    last_seen_age_seconds = serializers.SerializerMethodField()
    public_ip = serializers.SerializerMethodField()

    class Meta:
        model = Node
        fields = [
            "id",
            "hostname",
            "agent_type",
            "state",
            "effective_state",
            "is_stale",
            "agent_version",
            "os_name",
            "arch",
            "last_seen_at",
            "last_seen_age_seconds",
            "public_ip",
            "capabilities",
            "last_telemetry",
            "created_at",
            "updated_at",
        ]

    def get_last_seen_age_seconds(self, obj):
        if not obj.last_seen_at:
            return None
        return max(0, int((timezone.now() - obj.last_seen_at).total_seconds()))

    def get_public_ip(self, obj):
        configured = settings.NODE_PUBLIC_IPS.get(obj.hostname, "")
        if configured:
            return configured
        capabilities = obj.capabilities if isinstance(obj.capabilities, dict) else {}
        telemetry = obj.last_telemetry if isinstance(obj.last_telemetry, dict) else {}
        return capabilities.get("public_ip") or telemetry.get("public_ip") or ""


class EnrollmentTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnrollmentToken
        fields = ["id", "hostname", "agent_type", "token", "expires_at", "used_at", "node", "created_at"]
        read_only_fields = ["token", "used_at", "node", "created_at"]


class AgentEventSerializer(serializers.ModelSerializer):
    node_hostname = serializers.CharField(source="node.hostname", read_only=True, default="")

    class Meta:
        model = AgentEvent
        fields = ["id", "node", "node_hostname", "msg_type", "msg_id", "payload", "created_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["payload"] = redact_job_payload(data.get("payload") or {})
        return data


class AgentJobSerializer(serializers.ModelSerializer):
    node_hostname = serializers.CharField(source="node.hostname", read_only=True)

    class Meta:
        model = AgentJob
        fields = [
            "id",
            "node",
            "node_hostname",
            "job_type",
            "status",
            "payload",
            "result",
            "error_code",
            "error_detail",
            "correlation_id",
            "queued_at",
            "sent_at",
            "started_at",
            "finished_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "result",
            "error_code",
            "error_detail",
            "correlation_id",
            "queued_at",
            "sent_at",
            "started_at",
            "finished_at",
            "updated_at",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not (user and user.is_authenticated and (user.is_staff or user.is_superuser)):
            data["payload"] = redact_job_payload(data.get("payload") or {})
        return data


def redact_job_payload(value):
    if isinstance(value, list):
        return [redact_job_payload(item) for item in value]
    if not isinstance(value, dict):
        return value
    redacted = {}
    for key, raw in value.items():
        normalized = str(key).lower()
        if any(part in normalized for part in ("password", "secret", "token", "private_key", "auth_secret")):
            redacted[key] = "********" if raw else raw
        else:
            redacted[key] = redact_job_payload(raw)
    return redacted
