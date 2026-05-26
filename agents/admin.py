from django.contrib import admin

from .models import AgentEvent, AgentJob, EnrollmentToken, Node


@admin.register(Node)
class NodeAdmin(admin.ModelAdmin):
    list_display = ("hostname", "agent_type", "state", "agent_version", "last_seen_at")
    list_filter = ("agent_type", "state")
    search_fields = ("hostname",)
    readonly_fields = ("id", "created_at", "updated_at", "last_seen_at")


@admin.register(EnrollmentToken)
class EnrollmentTokenAdmin(admin.ModelAdmin):
    list_display = ("hostname", "agent_type", "expires_at", "used_at", "node")
    list_filter = ("agent_type", "used_at")
    search_fields = ("hostname", "token")
    readonly_fields = ("token", "created_at", "used_at", "node")


@admin.register(AgentEvent)
class AgentEventAdmin(admin.ModelAdmin):
    list_display = ("msg_type", "node", "msg_id", "created_at")
    list_filter = ("msg_type",)
    search_fields = ("msg_id", "node__hostname")
    readonly_fields = ("node", "msg_type", "msg_id", "payload", "created_at")


@admin.register(AgentJob)
class AgentJobAdmin(admin.ModelAdmin):
    list_display = ("job_type", "node", "status", "queued_at", "started_at", "finished_at")
    list_filter = ("job_type", "status")
    search_fields = ("node__hostname", "correlation_id", "error_code")
    readonly_fields = (
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
    )
