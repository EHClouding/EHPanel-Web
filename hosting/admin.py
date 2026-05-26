from django.contrib import admin

from .models import (
    AuditLog,
    DNSTemplateRecord,
    GlobalNameserver,
    HostingAccount,
    HostingDatabase,
    HostingDomain,
    HostingFtpUser,
    HostingMailbox,
    HostingPlan,
    HostingResellerProfile,
    MigrationAccount,
    MigrationLog,
    MigrationRun,
    MigrationSource,
    MigrationStep,
    ProvisioningRun,
    ProvisioningStep,
    ProvisioningTemplate,
)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "action", "account", "target_label", "ip")
    list_filter = ("action", "created_at")
    search_fields = ("user__username", "account__primary_domain", "target_label", "target_id")
    readonly_fields = ("created_at",)


@admin.register(DNSTemplateRecord)
class DNSTemplateRecordAdmin(admin.ModelAdmin):
    list_display = ("order", "name", "record_type", "content", "ttl", "priority", "is_active")
    list_filter = ("record_type", "is_active")
    search_fields = ("name", "content", "description")


@admin.register(GlobalNameserver)
class GlobalNameserverAdmin(admin.ModelAdmin):
    list_display = ("hostname", "short_name", "ip_address", "node", "role", "zone", "status", "sequence")
    list_filter = ("status", "role", "zone")
    search_fields = ("hostname", "short_name", "ip_address", "node__hostname", "zone")


@admin.register(ProvisioningTemplate)
class ProvisioningTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "target_plan", "is_active", "usage_count", "updated_at")
    list_filter = ("category", "is_active")
    search_fields = ("name", "slug", "description")
    readonly_fields = ("created_at", "updated_at", "last_used_at")


@admin.register(HostingPlan)
class HostingPlanAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "disk_mb", "bandwidth_mb", "max_domains", "max_databases", "max_mailboxes", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")


@admin.register(HostingResellerProfile)
class HostingResellerProfileAdmin(admin.ModelAdmin):
    list_display = ("company_name", "user", "plan", "primary_node", "max_accounts", "status", "created_at")
    list_filter = ("status", "plan", "primary_node")
    search_fields = ("company_name", "panel_domain", "user__username", "user__email")
    readonly_fields = ("created_at", "updated_at")


class HostingDomainInline(admin.TabularInline):
    model = HostingDomain
    extra = 0


class HostingDatabaseInline(admin.TabularInline):
    model = HostingDatabase
    extra = 0


class HostingMailboxInline(admin.TabularInline):
    model = HostingMailbox
    extra = 0


class HostingFtpUserInline(admin.TabularInline):
    model = HostingFtpUser
    extra = 0
    readonly_fields = ("created_at", "updated_at")


@admin.register(HostingMailbox)
class HostingMailboxAdmin(admin.ModelAdmin):
    list_display = ("email", "account", "quota_mb", "status", "created_at")
    list_filter = ("status", "account__node")
    search_fields = ("email", "account__primary_domain", "account__username")
    readonly_fields = ("created_at", "updated_at")


@admin.register(HostingFtpUser)
class HostingFtpUserAdmin(admin.ModelAdmin):
    list_display = ("username", "account", "root", "protocol", "status", "created_at")
    list_filter = ("status", "account__node")
    search_fields = ("username", "account__primary_domain", "account__username", "root")
    readonly_fields = ("created_at", "updated_at")


@admin.register(HostingAccount)
class HostingAccountAdmin(admin.ModelAdmin):
    list_display = ("primary_domain", "username", "node", "owner", "reseller", "status", "customer_email", "created_at")
    list_filter = ("status", "web_engine", "node", "owner", "reseller")
    search_fields = ("primary_domain", "username", "customer_email", "customer_name", "owner__username", "reseller__username")
    readonly_fields = ("id", "created_at", "updated_at")
    inlines = [HostingDomainInline, HostingDatabaseInline, HostingMailboxInline, HostingFtpUserInline]


class MigrationAccountInline(admin.TabularInline):
    model = MigrationAccount
    extra = 0
    readonly_fields = ("created_at", "updated_at")


class MigrationStepInline(admin.TabularInline):
    model = MigrationStep
    extra = 0
    readonly_fields = ("created_at", "updated_at")


@admin.register(MigrationSource)
class MigrationSourceAdmin(admin.ModelAdmin):
    list_display = ("provider", "host", "port", "username", "status", "created_at")
    list_filter = ("provider", "status")
    search_fields = ("host", "username")
    readonly_fields = ("created_at", "updated_at")


@admin.register(MigrationRun)
class MigrationRunAdmin(admin.ModelAdmin):
    list_display = ("source", "destination_node", "status", "progress_percent", "total_accounts", "completed_accounts", "failed_accounts", "created_at")
    list_filter = ("status", "source__provider", "destination_node")
    search_fields = ("source__host", "source__username", "destination_node__hostname")
    readonly_fields = ("created_at", "updated_at", "started_at", "finished_at")
    inlines = [MigrationAccountInline, MigrationStepInline]


@admin.register(MigrationAccount)
class MigrationAccountAdmin(admin.ModelAdmin):
    list_display = ("primary_domain", "run", "status", "progress_percent", "mailboxes_count", "databases_count", "subdomains_count")
    list_filter = ("status", "run__source__provider")
    search_fields = ("primary_domain", "source_username", "customer_email")
    readonly_fields = ("created_at", "updated_at", "started_at", "finished_at")


@admin.register(MigrationLog)
class MigrationLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "level", "run", "account", "message")
    list_filter = ("level", "created_at")
    search_fields = ("message", "run__source__host", "account__primary_domain")
    readonly_fields = ("created_at",)


@admin.register(ProvisioningRun)
class ProvisioningRunAdmin(admin.ModelAdmin):
    list_display = ("account", "status", "created_at", "updated_at")
    list_filter = ("status",)
    search_fields = ("account__primary_domain", "account__username")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(ProvisioningStep)
class ProvisioningStepAdmin(admin.ModelAdmin):
    list_display = ("run", "order", "name", "job")
    search_fields = ("run__account__primary_domain", "name", "job__id")
