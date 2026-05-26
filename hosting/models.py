import uuid

from django.conf import settings
from django.db import models
from django.utils.text import slugify
from django.utils import timezone

from agents.models import AgentJob, Node


class HostingPlan(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=120, unique=True)
    disk_mb = models.PositiveIntegerField(default=10240)
    bandwidth_mb = models.PositiveIntegerField(default=102400)
    memory_mb = models.PositiveIntegerField(default=1024)
    cpu_pct = models.PositiveIntegerField(default=100)
    max_domains = models.PositiveIntegerField(default=1)
    max_databases = models.PositiveIntegerField(default=5)
    max_mailboxes = models.PositiveIntegerField(default=10)
    allowed_web_engines = models.JSONField(default=list, blank=True)
    allowed_php_versions = models.JSONField(default=list, blank=True)
    features = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class GlobalConfiguration(models.Model):
    key = models.CharField(max_length=80, unique=True, default="default")
    default_node = models.ForeignKey(Node, null=True, blank=True, on_delete=models.SET_NULL)
    default_public_ip = models.GenericIPAddressField(null=True, blank=True)
    dns_defaults = models.JSONField(default=dict, blank=True)
    ssl_defaults = models.JSONField(default=dict, blank=True)
    mail_defaults = models.JSONField(default=dict, blank=True)
    paths = models.JSONField(default=dict, blank=True)
    policies = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Global configuration"
        verbose_name_plural = "Global configuration"

    @classmethod
    def current(cls):
        obj, _created = cls.objects.get_or_create(key="default")
        return obj

    def __str__(self):
        return self.key


class ApiKeyCredential(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"
        REVOKED = "revoked", "Revoked"
        DRAFT = "draft", "Draft"

    name = models.CharField(max_length=140)
    owner = models.CharField(max_length=140, default="Sistema")
    route = models.CharField(max_length=255, default="/api/")
    key_prefix = models.CharField(max_length=32, db_index=True)
    key_hash = models.CharField(max_length=64, unique=True)
    scopes = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    notes = models.TextField(blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "owner"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.key_prefix})"


class GlobalNameserver(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        REVIEW = "review", "Review"
        INACTIVE = "inactive", "Inactive"

    hostname = models.CharField(max_length=255, unique=True)
    short_name = models.CharField(max_length=30, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    node = models.ForeignKey(Node, null=True, blank=True, related_name="global_nameservers", on_delete=models.SET_NULL)
    role = models.CharField(max_length=60, default="Primario")
    zone = models.CharField(max_length=255, default="ehclouding.com")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    sequence = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sequence", "hostname"]
        indexes = [
            models.Index(fields=["node", "status"]),
            models.Index(fields=["sequence"]),
            models.Index(fields=["zone"]),
        ]

    def save(self, *args, **kwargs):
        if not self.short_name and self.sequence:
            self.short_name = f"NS{self.sequence}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.hostname


class ProvisioningTemplate(models.Model):
    class Category(models.TextChoices):
        HOSTING = "hosting", "Hosting account"
        RESELLER = "reseller", "Reseller"
        MIGRATION = "migration", "Migration"
        IMPORT = "import", "Import"
        APPLICATION = "application", "Application"

    name = models.CharField(max_length=140, unique=True)
    slug = models.SlugField(max_length=150, unique=True, blank=True)
    category = models.CharField(max_length=30, choices=Category.choices, default=Category.HOSTING)
    description = models.TextField(blank=True)
    target_plan = models.ForeignKey(HostingPlan, null=True, blank=True, on_delete=models.SET_NULL)
    resources = models.JSONField(default=dict, blank=True)
    actions = models.JSONField(default=list, blank=True)
    variables = models.JSONField(default=dict, blank=True)
    automation = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    usage_count = models.PositiveIntegerField(default=0)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["category", "is_active"]),
            models.Index(fields=["slug"]),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name) or "plantilla"
            slug = base_slug
            counter = 2
            while ProvisioningTemplate.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class HostingAccount(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROVISIONING = "provisioning", "Provisioning"
        ACTIVE = "active", "Active"
        FAILED = "failed", "Failed"
        SUSPENDED = "suspended", "Suspended"
        DELETED = "deleted", "Deleted"

    class WebEngine(models.TextChoices):
        NGINX_APACHE = "nginx_apache", "Nginx + Apache"
        OPENLITESPEED = "openlitespeed", "OpenLiteSpeed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    node = models.ForeignKey(Node, related_name="hosting_accounts", on_delete=models.PROTECT)
    plan = models.ForeignKey(HostingPlan, null=True, blank=True, on_delete=models.SET_NULL)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="hosting_accounts",
        on_delete=models.SET_NULL,
    )
    reseller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="reseller_accounts",
        on_delete=models.SET_NULL,
    )
    username = models.SlugField(max_length=32, unique=True)
    primary_domain = models.CharField(max_length=255, unique=True)
    customer_name = models.CharField(max_length=160, blank=True)
    customer_email = models.EmailField(blank=True)
    billing_client_id = models.CharField(max_length=80, blank=True, db_index=True)
    billing_service_id = models.CharField(max_length=80, blank=True, db_index=True)
    billing_synced_at = models.DateTimeField(null=True, blank=True)
    billing_status = models.CharField(max_length=40, blank=True)
    billing_metadata = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    web_engine = models.CharField(max_length=30, choices=WebEngine.choices, default=WebEngine.NGINX_APACHE)
    php_version = models.CharField(max_length=10, default="8.3")
    disk_mb = models.PositiveIntegerField(default=10240)
    bandwidth_mb = models.PositiveIntegerField(default=102400)
    memory_mb = models.PositiveIntegerField(default=1024)
    cpu_pct = models.PositiveIntegerField(default=100)
    last_usage = models.JSONField(default=dict, blank=True)
    last_usage_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["primary_domain"]
        indexes = [
            models.Index(fields=["node", "status"]),
            models.Index(fields=["owner", "status"]),
            models.Index(fields=["reseller", "status"]),
            models.Index(fields=["customer_email"]),
        ]

    def __str__(self):
        return f"{self.primary_domain} ({self.username})"


class HostingResellerProfile(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        related_name="hosting_reseller_profile",
        on_delete=models.CASCADE,
    )
    plan = models.ForeignKey(HostingPlan, null=True, blank=True, on_delete=models.SET_NULL)
    primary_node = models.ForeignKey(Node, null=True, blank=True, on_delete=models.SET_NULL)
    company_name = models.CharField(max_length=160, blank=True)
    panel_domain = models.CharField(max_length=255, blank=True)
    support_email = models.EmailField(blank=True)
    brand_primary_color = models.CharField(max_length=20, blank=True, default="#2563eb")
    brand_accent_color = models.CharField(max_length=20, blank=True, default="#0891b2")
    ip_allowlist = models.JSONField(default=list, blank=True)
    disk_mb = models.PositiveIntegerField(default=0)
    bandwidth_mb = models.PositiveIntegerField(default=0)
    max_accounts = models.PositiveIntegerField(default=0)
    max_mailboxes = models.PositiveIntegerField(default=0)
    max_databases = models.PositiveIntegerField(default=0)
    max_domains = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["company_name", "user__username"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["primary_node"]),
        ]

    def __str__(self):
        return self.company_name or self.user.get_username()


class ResellerTeamMember(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin_reseller", "Administrador reseller"
        SUPPORT = "support", "Soporte"
        COMMERCIAL = "commercial", "Comercial"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"

    reseller = models.ForeignKey(HostingResellerProfile, related_name="team_members", on_delete=models.CASCADE)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, related_name="reseller_team_membership", on_delete=models.CASCADE)
    role = models.CharField(max_length=30, choices=Role.choices, default=Role.SUPPORT)
    can_view_accounts = models.BooleanField(default=True)
    can_manage_support = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["user__username"]
        indexes = [models.Index(fields=["reseller", "status"])]

    def __str__(self):
        return f"{self.user.get_username()} -> {self.reseller}"


class MigrationSource(models.Model):
    class Provider(models.TextChoices):
        CPANEL = "cpanel", "cPanel / WHM"
        PLESK = "plesk", "Plesk"
        DIRECTADMIN = "directadmin", "DirectAdmin"
        BACKUP_URL = "backup_url", "Backup URL"
        EHPANEL = "ehpanel", "EHPanel Web"

    class AuthMethod(models.TextChoices):
        PASSWORD = "password", "SSH password"
        SSH_KEY = "ssh_key", "SSH key"
        API_TOKEN = "api_token", "API token"

    provider = models.CharField(max_length=30, choices=Provider.choices)
    host = models.CharField(max_length=255)
    port = models.PositiveIntegerField(default=22)
    username = models.CharField(max_length=120)
    auth_method = models.CharField(max_length=30, choices=AuthMethod.choices, default=AuthMethod.PASSWORD)
    encrypted_secret = models.TextField(blank=True)
    status = models.CharField(max_length=30, default="ready")
    last_error = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["provider", "host"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.get_provider_display()} {self.username}@{self.host}"


class MigrationRun(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        DISCOVERING = "discovering", "Discovering"
        ANALYZED = "analyzed", "Analyzed"
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        PAUSED = "paused", "Paused"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        CANCELED = "canceled", "Canceled"

    class Mode(models.TextChoices):
        DISCOVER_ONLY = "discover_only", "Discover only"
        SELECT_AND_MIGRATE = "select_and_migrate", "Select and migrate"
        AUTO_MIGRATE_ALL = "auto_migrate_all", "Auto migrate all"

    source = models.ForeignKey(MigrationSource, related_name="runs", on_delete=models.PROTECT)
    destination_node = models.ForeignKey(Node, related_name="migration_runs", on_delete=models.PROTECT)
    mode = models.CharField(max_length=40, choices=Mode.choices, default=Mode.SELECT_AND_MIGRATE)
    priority = models.CharField(max_length=20, default="normal")
    migration_type = models.CharField(max_length=40, default="full")
    concurrency = models.PositiveSmallIntegerField(default=1)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.DRAFT)
    current_step = models.CharField(max_length=160, blank=True)
    progress_percent = models.PositiveSmallIntegerField(default=0)
    total_accounts = models.PositiveIntegerField(default=0)
    completed_accounts = models.PositiveIntegerField(default=0)
    failed_accounts = models.PositiveIntegerField(default=0)
    selected_accounts = models.JSONField(default=list, blank=True)
    options = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["destination_node", "status"]),
        ]

    def __str__(self):
        return f"Migration {self.source} -> {self.destination_node.hostname}"


class MigrationAccount(models.Model):
    class Status(models.TextChoices):
        DETECTED = "detected", "Detected"
        SELECTED = "selected", "Selected"
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        SKIPPED = "skipped", "Skipped"

    run = models.ForeignKey(MigrationRun, related_name="accounts", on_delete=models.CASCADE)
    source_username = models.CharField(max_length=120, blank=True)
    primary_domain = models.CharField(max_length=255)
    customer_email = models.EmailField(blank=True)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.DETECTED)
    current_step = models.CharField(max_length=160, blank=True)
    progress_percent = models.PositiveSmallIntegerField(default=0)
    files_mb = models.PositiveIntegerField(default=0)
    databases_count = models.PositiveIntegerField(default=0)
    mailboxes_count = models.PositiveIntegerField(default=0)
    subdomains_count = models.PositiveIntegerField(default=0)
    detected = models.JSONField(default=dict, blank=True)
    destination_account = models.ForeignKey(HostingAccount, null=True, blank=True, on_delete=models.SET_NULL)
    last_job = models.ForeignKey(AgentJob, null=True, blank=True, on_delete=models.SET_NULL)
    error_code = models.CharField(max_length=80, blank=True)
    error_detail = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["primary_domain"]
        unique_together = [("run", "primary_domain")]
        indexes = [
            models.Index(fields=["run", "status"]),
            models.Index(fields=["primary_domain"]),
        ]

    def __str__(self):
        return self.primary_domain


class MigrationStep(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        SKIPPED = "skipped", "Skipped"

    run = models.ForeignKey(MigrationRun, related_name="steps", on_delete=models.CASCADE)
    account = models.ForeignKey(MigrationAccount, null=True, blank=True, related_name="steps", on_delete=models.CASCADE)
    key = models.CharField(max_length=80)
    label = models.CharField(max_length=160)
    order = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING)
    progress_percent = models.PositiveSmallIntegerField(default=0)
    job = models.ForeignKey(AgentJob, null=True, blank=True, on_delete=models.SET_NULL)
    error_detail = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "created_at"]
        indexes = [
            models.Index(fields=["run", "status"]),
            models.Index(fields=["account", "status"]),
        ]

    def __str__(self):
        return self.label


class MigrationLog(models.Model):
    run = models.ForeignKey(MigrationRun, related_name="logs", on_delete=models.CASCADE)
    account = models.ForeignKey(MigrationAccount, null=True, blank=True, related_name="logs", on_delete=models.CASCADE)
    level = models.CharField(max_length=20, default="info")
    message = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["run", "created_at"]),
            models.Index(fields=["account", "created_at"]),
            models.Index(fields=["level"]),
        ]


class HostingDomain(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        FAILED = "failed", "Failed"

    class DomainType(models.TextChoices):
        PRIMARY = "primary", "Primary"
        ALIAS = "alias", "Alias"
        SUBDOMAIN = "subdomain", "Subdomain"
        ADDON = "addon", "Addon"

    account = models.ForeignKey(HostingAccount, related_name="domains", on_delete=models.CASCADE)
    domain = models.CharField(max_length=255, unique=True)
    is_primary = models.BooleanField(default=False)
    domain_type = models.CharField(max_length=20, choices=DomainType.choices, default=DomainType.ALIAS)
    document_root = models.CharField(max_length=255, blank=True)
    dns_status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    ssl_status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    ssl_issuer = models.CharField(max_length=120, blank=True)
    ssl_expires_at = models.DateTimeField(null=True, blank=True)
    ssl_domains = models.JSONField(default=list, blank=True)
    ssl_cert_path = models.CharField(max_length=255, blank=True)
    ssl_privkey_path = models.CharField(max_length=255, blank=True)
    ssl_error_code = models.CharField(max_length=80, blank=True)
    ssl_error_detail = models.TextField(blank=True)
    web_protection = models.JSONField(default=dict, blank=True)
    web_protection_status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    web_protection_error = models.TextField(blank=True)
    web_protection_last_job = models.ForeignKey(AgentJob, null=True, blank=True, on_delete=models.SET_NULL, related_name="web_protection_domains")
    dkim_selector = models.CharField(max_length=64, default="ehpanel")
    dkim_txt = models.TextField(blank=True)
    dkim_status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["domain"]

    def __str__(self):
        return self.domain


class HostingDNSRecord(models.Model):
    class RecordType(models.TextChoices):
        A = "A", "A"
        AAAA = "AAAA", "AAAA"
        CNAME = "CNAME", "CNAME"
        MX = "MX", "MX"
        NS = "NS", "NS"
        SRV = "SRV", "SRV"
        TXT = "TXT", "TXT"
        CAA = "CAA", "CAA"

    domain = models.ForeignKey(HostingDomain, related_name="records", on_delete=models.CASCADE)
    name = models.CharField(max_length=255, default="@")
    record_type = models.CharField(max_length=10, choices=RecordType.choices)
    content = models.TextField()
    ttl = models.PositiveIntegerField(default=300)
    priority = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["domain__domain", "name", "record_type"]
        unique_together = [("domain", "name", "record_type", "content")]
        indexes = [
            models.Index(fields=["domain", "record_type"]),
        ]

    def __str__(self):
        return f"{self.domain.domain} {self.name} {self.record_type}"


class DNSTemplateRecord(models.Model):
    name = models.CharField(max_length=255)
    record_type = models.CharField(max_length=10, choices=HostingDNSRecord.RecordType.choices)
    content = models.TextField()
    ttl = models.PositiveIntegerField(default=300)
    priority = models.PositiveIntegerField(null=True, blank=True)
    order = models.PositiveIntegerField(default=100)
    is_active = models.BooleanField(default=True)
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "name", "record_type"]
        unique_together = [("name", "record_type", "content")]
        indexes = [
            models.Index(fields=["is_active", "order"]),
        ]

    def __str__(self):
        return f"{self.name} {self.record_type}"


class HostingDatabase(models.Model):
    class Engine(models.TextChoices):
        MARIADB = "mariadb", "MariaDB"
        POSTGRESQL = "postgresql", "PostgreSQL"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        FAILED = "failed", "Failed"

    account = models.ForeignKey(HostingAccount, related_name="databases", on_delete=models.CASCADE)
    engine = models.CharField(max_length=20, choices=Engine.choices, default=Engine.MARIADB)
    name = models.CharField(max_length=64, unique=True)
    username = models.CharField(max_length=64)
    size_mb = models.PositiveIntegerField(default=0)
    size_status = models.CharField(max_length=20, default="unknown")
    last_size_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.engine}:{self.name}"


class HostingDatabaseUser(models.Model):
    class Access(models.TextChoices):
        READ_ONLY = "read_only", "Solo lectura"
        READ_WRITE = "read_write", "Lectura y escritura"
        ADMIN = "admin", "Admin"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        FAILED = "failed", "Failed"

    account = models.ForeignKey(HostingAccount, related_name="database_users", on_delete=models.CASCADE)
    engine = models.CharField(max_length=20, choices=HostingDatabase.Engine.choices, default=HostingDatabase.Engine.MARIADB)
    username = models.CharField(max_length=64)
    access = models.CharField(max_length=20, choices=Access.choices, default=Access.READ_WRITE)
    hosts = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    last_job = models.ForeignKey(AgentJob, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["username"]
        constraints = [
            models.UniqueConstraint(fields=["account", "engine", "username"], name="unique_hosting_database_user_per_account_engine"),
        ]

    def __str__(self):
        return f"{self.engine}:{self.username}"


class HostingDatabaseGrant(models.Model):
    database = models.ForeignKey(HostingDatabase, related_name="grants", on_delete=models.CASCADE)
    user = models.ForeignKey(HostingDatabaseUser, related_name="grants", on_delete=models.CASCADE)
    access = models.CharField(max_length=20, choices=HostingDatabaseUser.Access.choices, default=HostingDatabaseUser.Access.READ_WRITE)
    privileges = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["database__name", "user__username"]
        constraints = [
            models.UniqueConstraint(fields=["database", "user"], name="unique_hosting_database_grant"),
        ]

    def __str__(self):
        return f"{self.user.username} -> {self.database.name}"


class HostingDatabaseCredential(models.Model):
    user = models.OneToOneField(HostingDatabaseUser, related_name="credential", on_delete=models.CASCADE)
    encrypted_password = models.TextField()
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"credential:{self.user.username}"


class HostingDatabaseSsoToken(models.Model):
    manager = models.CharField(max_length=20)
    token_hash = models.CharField(max_length=64, unique=True)
    database = models.ForeignKey(HostingDatabase, related_name="sso_tokens", on_delete=models.CASCADE)
    user = models.ForeignKey(HostingDatabaseUser, related_name="sso_tokens", on_delete=models.CASCADE)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.manager}:{self.database.name}:{self.user.username}"


class HostingMailbox(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"
        FAILED = "failed", "Failed"

    account = models.ForeignKey(HostingAccount, related_name="mailboxes", on_delete=models.CASCADE)
    email = models.EmailField(unique=True)
    quota_mb = models.PositiveIntegerField(default=1024)
    used_mb = models.PositiveIntegerField(default=0)
    usage_status = models.CharField(max_length=20, default="unknown")
    description = models.CharField(max_length=255, blank=True)
    outgoing_limit = models.PositiveIntegerField(default=150)
    antispam_enabled = models.BooleanField(default=True)
    antispam_settings = models.JSONField(default=dict, blank=True)
    autoresponder_enabled = models.BooleanField(default=False)
    autoresponder_subject = models.CharField(max_length=160, blank=True)
    autoresponder_format = models.CharField(max_length=20, default="text")
    autoresponder_encoding = models.CharField(max_length=40, default="UTF-8")
    autoresponder_message = models.TextField(blank=True)
    autoresponder_redirect = models.EmailField(blank=True)
    autoresponder_unique_limit = models.PositiveIntegerField(default=1)
    autoresponder_schedule = models.BooleanField(default=False)
    last_usage_at = models.DateTimeField(null=True, blank=True)
    last_test_status = models.CharField(max_length=20, blank=True)
    last_test_recipient = models.EmailField(blank=True)
    last_test_result = models.JSONField(default=dict, blank=True)
    last_test_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["email"]

    def __str__(self):
        return self.email


class HostingMailboxCredential(models.Model):
    mailbox = models.OneToOneField(HostingMailbox, related_name="credential", on_delete=models.CASCADE)
    encrypted_password = models.TextField()
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"credential:{self.mailbox.email}"


class HostingMailboxSsoToken(models.Model):
    token_hash = models.CharField(max_length=64, unique=True)
    mailbox = models.ForeignKey(HostingMailbox, related_name="sso_tokens", on_delete=models.CASCADE)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"webmail:{self.mailbox.email}"


class HostingFtpUser(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"
        FAILED = "failed", "Failed"

    account = models.ForeignKey(HostingAccount, related_name="ftp_users", on_delete=models.CASCADE)
    username = models.SlugField(max_length=64, unique=True)
    root = models.CharField(max_length=255, default="public_html")
    quota_mb = models.PositiveIntegerField(default=0)
    protocol = models.CharField(max_length=40, default="FTPES / explicit TLS")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    last_job = models.ForeignKey(AgentJob, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["account__primary_domain", "username"]
        indexes = [
            models.Index(fields=["account", "status"]),
        ]

    @property
    def absolute_root(self):
        return f"/home/{self.account.username}/{self.root.strip('/')}"

    def __str__(self):
        return f"{self.username} ({self.account.primary_domain})"


class HostingProtectedDirectory(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        DISABLED = "disabled", "Disabled"
        FAILED = "failed", "Failed"

    domain = models.ForeignKey(HostingDomain, related_name="protected_directories", on_delete=models.CASCADE)
    path = models.CharField(max_length=255)
    zone = models.CharField(max_length=120)
    username = models.SlugField(max_length=64)
    enabled = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    last_job = models.ForeignKey(AgentJob, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["domain__domain", "path"]
        unique_together = [("domain", "path")]
        indexes = [models.Index(fields=["domain", "status"])]

    @property
    def account(self):
        return self.domain.account

    def __str__(self):
        return f"{self.domain.domain}:{self.path}"


class HostingWafConfiguration(models.Model):
    class Mode(models.TextChoices):
        DISABLED = "disabled", "Disabled"
        MONITOR = "monitor", "Monitor"
        BLOCK = "block", "Block"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        FAILED = "failed", "Failed"

    domain = models.OneToOneField(HostingDomain, related_name="waf_configuration", on_delete=models.CASCADE)
    mode = models.CharField(max_length=20, choices=Mode.choices, default=Mode.MONITOR)
    owasp_crs = models.BooleanField(default=True)
    wordpress_rules = models.BooleanField(default=True)
    block_xmlrpc = models.BooleanField(default=True)
    rate_limit_login = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    error = models.TextField(blank=True)
    last_job = models.ForeignKey(AgentJob, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["domain__domain"]

    @property
    def account(self):
        return self.domain.account

    def __str__(self):
        return f"{self.domain.domain}:{self.mode}"


class HostingIPBlock(models.Model):
    class Source(models.TextChoices):
        ADMIN = "admin", "Administrator"
        WAF = "waf_firewall", "WAF / Firewall"
        MODSECURITY = "modsecurity", "ModSecurity"
        ANTISPAM = "antispam", "Anti-spam"
        AGENT = "agent", "Node agent"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        DISABLED = "disabled", "Disabled"
        EXPIRED = "expired", "Expired"
        FAILED = "failed", "Failed"

    domain = models.ForeignKey(HostingDomain, related_name="ip_blocks", on_delete=models.CASCADE)
    target = models.CharField(max_length=64)
    source = models.CharField(max_length=30, choices=Source.choices, default=Source.WAF)
    reason = models.CharField(max_length=255)
    expires_on = models.DateField(null=True, blank=True)
    enabled = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    last_job = models.ForeignKey(AgentJob, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["domain__domain", "-created_at"]
        unique_together = [("domain", "target")]
        indexes = [models.Index(fields=["domain", "status"])]

    @property
    def account(self):
        return self.domain.account

    def __str__(self):
        return f"{self.domain.domain}:{self.target}"


class HostingSecurityScan(models.Model):
    class ScanType(models.TextChoices):
        FULL = "full", "Full"
        QUICK = "quick", "Quick"
        MANUAL = "manual", "Manual"

    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        CLEAN = "clean", "Clean"
        THREAT = "threat", "Threat"
        FAILED = "failed", "Failed"
        CANCELED = "canceled", "Canceled"

    account = models.ForeignKey(HostingAccount, related_name="security_scans", on_delete=models.CASCADE)
    path = models.CharField(max_length=1024, default="public_html")
    scan_type = models.CharField(max_length=20, choices=ScanType.choices, default=ScanType.QUICK)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    progress = models.PositiveSmallIntegerField(default=0)
    files_scanned = models.PositiveIntegerField(default=0)
    infected_files = models.PositiveIntegerField(default=0)
    data_scanned = models.CharField(max_length=80, blank=True)
    report = models.JSONField(default=dict, blank=True)
    output = models.TextField(blank=True)
    error_code = models.CharField(max_length=80, blank=True)
    error_detail = models.TextField(blank=True)
    last_job = models.ForeignKey(AgentJob, null=True, blank=True, on_delete=models.SET_NULL)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["account", "status"]),
            models.Index(fields=["scan_type", "created_at"]),
        ]

    def __str__(self):
        return f"{self.account.primary_domain}:{self.path}:{self.scan_type}"


class HostingMonitorCheck(models.Model):
    class CheckType(models.TextChoices):
        HTTP = "http", "HTTP"
        DNS = "dns", "DNS"
        SSL = "ssl", "SSL"
        SMTP = "smtp", "SMTP"
        WEBMAIL = "webmail", "Webmail"
        SERVICE = "service", "Service"

    class Status(models.TextChoices):
        OK = "ok", "OK"
        WARNING = "warning", "Warning"
        FAILED = "failed", "Failed"
        PAUSED = "paused", "Paused"
        UNKNOWN = "unknown", "Unknown"

    account = models.ForeignKey(HostingAccount, related_name="monitor_checks", on_delete=models.CASCADE)
    check_type = models.CharField(max_length=20, choices=CheckType.choices)
    name = models.CharField(max_length=120)
    target = models.CharField(max_length=255)
    interval_seconds = models.PositiveIntegerField(default=60)
    enabled = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UNKNOWN)
    response_ms = models.PositiveIntegerField(default=0)
    last_checked_at = models.DateTimeField(null=True, blank=True)
    last_message = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["account__primary_domain", "check_type", "name"]
        unique_together = [("account", "check_type", "target")]
        indexes = [models.Index(fields=["account", "status"])]

    def __str__(self):
        return f"{self.account.primary_domain}:{self.check_type}:{self.target}"


class HostingMonitorIncident(models.Model):
    class Severity(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        ACKNOWLEDGED = "acknowledged", "Acknowledged"
        RESOLVED = "resolved", "Resolved"

    account = models.ForeignKey(HostingAccount, related_name="monitor_incidents", on_delete=models.CASCADE)
    monitor_check = models.ForeignKey(HostingMonitorCheck, null=True, blank=True, related_name="incidents", on_delete=models.SET_NULL)
    title = models.CharField(max_length=160)
    service = models.CharField(max_length=80, blank=True)
    severity = models.CharField(max_length=20, choices=Severity.choices, default=Severity.MEDIUM)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    started_at = models.DateTimeField(default=timezone.now)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    detail = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [models.Index(fields=["account", "status"]), models.Index(fields=["severity", "started_at"])]

    def __str__(self):
        return f"{self.account.primary_domain}:{self.title}"


class HostingMonitorAlertRule(models.Model):
    class Channel(models.TextChoices):
        EMAIL = "email", "Email"
        TELEGRAM = "telegram", "Telegram"
        WEBHOOK = "webhook", "Webhook"
        PANEL = "panel", "Panel"

    account = models.ForeignKey(HostingAccount, related_name="monitor_alert_rules", on_delete=models.CASCADE)
    channel = models.CharField(max_length=20, choices=Channel.choices, default=Channel.EMAIL)
    event = models.CharField(max_length=80)
    threshold = models.CharField(max_length=120, blank=True)
    target = models.CharField(max_length=255, blank=True)
    enabled = models.BooleanField(default=True)
    last_test_at = models.DateTimeField(null=True, blank=True)
    last_test_status = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["account__primary_domain", "channel", "event"]
        indexes = [models.Index(fields=["account", "enabled"])]

    def __str__(self):
        return f"{self.account.primary_domain}:{self.channel}:{self.event}"


class HostingMonitorSnapshot(models.Model):
    account = models.ForeignKey(HostingAccount, related_name="monitor_snapshots", on_delete=models.CASCADE)
    status = models.CharField(max_length=20, default="unknown")
    uptime_pct = models.FloatField(default=0)
    response_ms = models.PositiveIntegerField(default=0)
    incidents_open = models.PositiveIntegerField(default=0)
    services = models.JSONField(default=list, blank=True)
    checks = models.JSONField(default=list, blank=True)
    logs = models.JSONField(default=dict, blank=True)
    sla = models.JSONField(default=dict, blank=True)
    collected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-collected_at"]
        indexes = [models.Index(fields=["account", "collected_at"])]

    def __str__(self):
        return f"{self.account.primary_domain}:{self.collected_at:%Y-%m-%d %H:%M:%S}"


class HostingAdvancedItem(models.Model):
    class Kind(models.TextChoices):
        GIT_REPO = "git_repo", "Git repository"
        SSH_KEY = "ssh_key", "SSH key"
        CRON = "cron", "Cron job"
        VARIABLE = "variable", "Environment variable"
        REDIRECT = "redirect", "Redirect"
        HEADER = "header", "Header"
        WEBHOOK = "webhook", "Webhook"
        VHOST_MANUAL = "vhost_manual", "Manual vhost"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        DISABLED = "disabled", "Disabled"
        PENDING = "pending", "Pending"
        FAILED = "failed", "Failed"

    account = models.ForeignKey(HostingAccount, related_name="advanced_items", on_delete=models.CASCADE)
    kind = models.CharField(max_length=30, choices=Kind.choices)
    name = models.CharField(max_length=160)
    config = models.JSONField(default=dict, blank=True)
    enabled = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    last_job = models.ForeignKey(AgentJob, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["kind", "name"]
        indexes = [
            models.Index(fields=["account", "kind"]),
            models.Index(fields=["account", "status"]),
        ]

    def __str__(self):
        return f"{self.account.primary_domain}:{self.kind}:{self.name}"


class SupportTicket(models.Model):
    class Department(models.TextChoices):
        ADMINISTRATION = "administration", "Administracion"
        TECHNICAL = "technical", "Soporte tecnico"
        BILLING = "billing", "Facturacion"
        SECURITY = "security", "Abuso y seguridad"

    class Priority(models.TextChoices):
        LOW = "low", "Baja"
        MEDIUM = "medium", "Media"
        HIGH = "high", "Alta"
        URGENT = "urgent", "Urgente"

    class Status(models.TextChoices):
        OPEN = "open", "Abierto"
        ANSWERED = "answered", "Respondido"
        CUSTOMER_REPLY = "customer_reply", "Respuesta cliente"
        CLOSED = "closed", "Cerrado"

    account = models.ForeignKey(HostingAccount, related_name="support_tickets", on_delete=models.CASCADE)
    requester = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, related_name="support_tickets", on_delete=models.SET_NULL)
    subject = models.CharField(max_length=180)
    department = models.CharField(max_length=30, choices=Department.choices, default=Department.TECHNICAL)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.OPEN)
    ticket_number = models.PositiveIntegerField(unique=True, null=True, blank=True)
    last_reply_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["account", "status"]),
            models.Index(fields=["requester", "created_at"]),
            models.Index(fields=["department", "priority"]),
        ]

    @property
    def display_id(self):
        return f"#{self.ticket_number or self.id}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.ticket_number is None:
            type(self).objects.filter(pk=self.pk, ticket_number__isnull=True).update(ticket_number=1200 + self.pk)
            self.ticket_number = 1200 + self.pk

    def __str__(self):
        return f"{self.display_id} {self.subject}"


class SupportTicketMessage(models.Model):
    class AuthorType(models.TextChoices):
        CUSTOMER = "customer", "Cliente"
        RESELLER = "reseller", "Revendedor"
        STAFF = "staff", "Staff"
        SYSTEM = "system", "Sistema"

    ticket = models.ForeignKey(SupportTicket, related_name="messages", on_delete=models.CASCADE)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, related_name="support_ticket_messages", on_delete=models.SET_NULL)
    author_type = models.CharField(max_length=20, choices=AuthorType.choices, default=AuthorType.CUSTOMER)
    body = models.TextField()
    is_internal = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.ticket.display_id}:{self.author_type}:{self.created_at:%Y-%m-%d %H:%M}"


def support_attachment_upload_to(instance, filename):
    safe_name = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in filename).strip("._") or "attachment"
    return f"support/tickets/{instance.message.ticket_id}/{uuid.uuid4().hex}_{safe_name[:120]}"


class SupportTicketAttachment(models.Model):
    message = models.ForeignKey(SupportTicketMessage, related_name="attachments", on_delete=models.CASCADE)
    file = models.FileField(upload_to=support_attachment_upload_to)
    original_name = models.CharField(max_length=180)
    content_type = models.CharField(max_length=120)
    size = models.PositiveBigIntegerField(default=0)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return self.original_name


class GlobalAnnouncement(models.Model):
    class Audience(models.TextChoices):
        ALL = "all", "Todos"
        CLIENTS = "clients", "Clientes"
        RESELLERS = "resellers", "Revendedores"

    class Priority(models.TextChoices):
        LOW = "low", "Baja"
        MEDIUM = "medium", "Media"
        HIGH = "high", "Alta"
        CRITICAL = "critical", "Critica"

    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        PUBLISHED = "published", "Publicado"
        SCHEDULED = "scheduled", "Programado"
        ARCHIVED = "archived", "Archivado"

    title = models.CharField(max_length=180)
    body = models.TextField(blank=True)
    audience = models.CharField(max_length=20, choices=Audience.choices, default=Audience.ALL)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    publish_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-publish_at", "-created_at"]
        indexes = [
            models.Index(fields=["audience", "status"]),
            models.Index(fields=["publish_at", "expires_at"]),
        ]

    def __str__(self):
        return self.title


class AccessSession(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Activa"
        CLOSED = "closed", "Cerrada"
        EXPIRED = "expired", "Expirada"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="access_sessions", on_delete=models.CASCADE)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    device = models.CharField(max_length=180, blank=True)
    location = models.CharField(max_length=120, blank=True)
    role = models.CharField(max_length=40, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    refresh_jti = models.CharField(max_length=80, blank=True, db_index=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_seen_at", "-created_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["ip_address", "status"]),
        ]

    def __str__(self):
        return f"{self.user_id}:{self.ip_address}:{self.status}"


class HostingApplication(models.Model):
    class AppType(models.TextChoices):
        WORDPRESS = "wordpress", "WordPress"
        PYTHON = "python", "Python"
        DJANGO = "django", "Django"
        NODEJS = "nodejs", "Node.js"
        LARAVEL = "laravel", "Laravel"
        MOODLE = "moodle", "Moodle"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        INSTALLING = "installing", "Installing"
        ACTIVE = "active", "Active"
        STOPPED = "stopped", "Stopped"
        FAILED = "failed", "Failed"

    account = models.ForeignKey(HostingAccount, related_name="applications", on_delete=models.CASCADE)
    domain = models.ForeignKey(HostingDomain, related_name="applications", on_delete=models.PROTECT)
    app_type = models.CharField(max_length=30, choices=AppType.choices, default=AppType.WORDPRESS)
    name = models.CharField(max_length=120)
    install_path = models.CharField(max_length=255)
    url = models.URLField(max_length=255)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    version = models.CharField(max_length=40, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    last_job = models.ForeignKey(AgentJob, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("domain", "app_type")]
        indexes = [
            models.Index(fields=["account", "app_type", "status"]),
            models.Index(fields=["domain", "app_type"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.app_type})"


class HostingApplicationBackup(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    app = models.ForeignKey(HostingApplication, related_name="backups", on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    archive_path = models.CharField(max_length=500, blank=True)
    filename = models.CharField(max_length=180, blank=True)
    size_bytes = models.BigIntegerField(default=0)
    last_job = models.ForeignKey(AgentJob, null=True, blank=True, on_delete=models.SET_NULL)
    error_code = models.CharField(max_length=80, blank=True)
    error_detail = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["app", "status"])]

    def __str__(self):
        return f"{self.app.name}:{self.status}"


class HostingAccountExport(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    account = models.ForeignKey(HostingAccount, related_name="exports", on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    export_type = models.CharField(max_length=40, default="full")
    include_files = models.BooleanField(default=True)
    include_databases = models.BooleanField(default=True)
    include_mail = models.BooleanField(default=True)
    include_subdomains = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    archive_path = models.CharField(max_length=500, blank=True)
    filename = models.CharField(max_length=180, blank=True)
    size_bytes = models.BigIntegerField(default=0)
    result = models.JSONField(default=dict, blank=True)
    last_job = models.ForeignKey(AgentJob, null=True, blank=True, on_delete=models.SET_NULL)
    error_code = models.CharField(max_length=80, blank=True)
    error_detail = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["account", "status"]),
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self):
        return f"{self.account.primary_domain}:{self.status}"


class BackupStorageDestination(models.Model):
    class Type(models.TextChoices):
        LOCAL = "local", "Local"
        S3 = "s3", "S3 compatible"
        FTP = "ftp", "FTP externo"
        EHPANEL_DRIVE = "ehpanel_drive", "EHPanel Drive"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"
        TESTING = "testing", "Testing"
        FAILED = "failed", "Failed"

    name = models.CharField(max_length=140)
    storage_type = models.CharField(max_length=30, choices=Type.choices, default=Type.LOCAL)
    endpoint = models.CharField(max_length=255, blank=True)
    bucket = models.CharField(max_length=160, blank=True)
    path = models.CharField(max_length=500, blank=True)
    username = models.CharField(max_length=160, blank=True)
    secret = models.TextField(blank=True)
    capacity_gb = models.PositiveIntegerField(default=0)
    used_bytes = models.BigIntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    config = models.JSONField(default=dict, blank=True)
    last_test_at = models.DateTimeField(null=True, blank=True)
    last_test_result = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["storage_type", "status"])]

    def __str__(self):
        return f"{self.name} ({self.storage_type})"


class BackupPolicy(models.Model):
    class PolicyType(models.TextChoices):
        FULL = "full", "Full"
        INCREMENTAL = "incremental", "Incremental"
        PARTIAL = "partial", "Partial"
        REALTIME = "realtime", "Realtime"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"

    name = models.CharField(max_length=160)
    policy_type = models.CharField(max_length=30, choices=PolicyType.choices, default=PolicyType.INCREMENTAL)
    frequency = models.CharField(max_length=120, default="daily_02")
    include_files = models.BooleanField(default=True)
    include_databases = models.BooleanField(default=True)
    include_mail = models.BooleanField(default=True)
    include_config = models.BooleanField(default=True)
    full_account = models.BooleanField(default=True)
    storage = models.ForeignKey(BackupStorageDestination, null=True, blank=True, related_name="policies", on_delete=models.SET_NULL)
    retention_days = models.PositiveIntegerField(default=30)
    retention_copies = models.PositiveIntegerField(default=14)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["policy_type", "status"])]

    def __str__(self):
        return self.name


class BackupRestoreRun(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    accounts = models.ManyToManyField(HostingAccount, related_name="backup_restores", blank=True)
    reseller = models.ForeignKey(HostingResellerProfile, null=True, blank=True, related_name="backup_restores", on_delete=models.SET_NULL)
    backup = models.ForeignKey(HostingAccountExport, null=True, blank=True, related_name="restore_runs", on_delete=models.SET_NULL)
    destination_node = models.ForeignKey(Node, null=True, blank=True, related_name="backup_restores", on_delete=models.SET_NULL)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    restore_type = models.CharField(max_length=40, default="full")
    include_files = models.BooleanField(default=True)
    include_databases = models.BooleanField(default=True)
    include_mail = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    result = models.JSONField(default=dict, blank=True)
    last_job = models.ForeignKey(AgentJob, null=True, blank=True, on_delete=models.SET_NULL)
    error_code = models.CharField(max_length=80, blank=True)
    error_detail = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "created_at"])]

    def __str__(self):
        return f"Restore {self.id}:{self.status}"


class ProvisioningRun(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.ForeignKey(HostingAccount, related_name="provisioning_runs", on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.account.primary_domain} ({self.status})"

    def sync_from_jobs(self):
        steps = list(self.steps.select_related("job"))
        if not steps:
            return self.status

        failed_statuses = {
            AgentJob.Status.FAILED,
            AgentJob.Status.CANCELED,
            AgentJob.Status.EXPIRED,
        }
        active_statuses = {
            AgentJob.Status.QUEUED,
            AgentJob.Status.SENT,
            AgentJob.Status.RUNNING,
        }
        core_steps = {"provision_hosting", "create_dns_zone", "create_mail_domain"}
        failed_steps = [step for step in steps if step.job.status in failed_statuses]
        active_steps = [step for step in steps if step.job.status in active_statuses]

        if failed_steps:
            self.status = self.Status.FAILED
            has_core_failure = any(step.name in core_steps for step in failed_steps)
            has_provision_success = any(
                step.name == "provision_hosting" and step.job.status == AgentJob.Status.SUCCESS
                for step in steps
            )
            if has_core_failure or not has_provision_success:
                self.account.status = HostingAccount.Status.FAILED
            elif self.account.status != HostingAccount.Status.SUSPENDED:
                self.account.status = HostingAccount.Status.ACTIVE
        elif all(step.job.status == AgentJob.Status.SUCCESS for step in steps):
            self.status = self.Status.SUCCESS
            self.account.status = HostingAccount.Status.ACTIVE
            self.account.domains.update(dns_status=HostingDomain.Status.ACTIVE, ssl_status=HostingDomain.Status.ACTIVE)
            self.account.databases.update(status=HostingDatabase.Status.ACTIVE)
            self.account.mailboxes.update(status=HostingMailbox.Status.ACTIVE)
        elif active_steps:
            self.status = self.Status.RUNNING
            self.account.status = HostingAccount.Status.PROVISIONING
        else:
            self.status = self.Status.QUEUED
            self.account.status = HostingAccount.Status.PROVISIONING

        self.save(update_fields=["status", "updated_at"])
        self.account.save(update_fields=["status", "updated_at"])
        return self.status


class ProvisioningStep(models.Model):
    run = models.ForeignKey(ProvisioningRun, related_name="steps", on_delete=models.CASCADE)
    job = models.OneToOneField(AgentJob, related_name="provisioning_step", on_delete=models.CASCADE)
    name = models.CharField(max_length=80)
    order = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order"]
        unique_together = [("run", "name")]

    def __str__(self):
        return f"{self.name}: {self.job.status}"


class HostingPerformanceAudit(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    account = models.ForeignKey(HostingAccount, related_name="performance_audits", on_delete=models.CASCADE)
    job = models.ForeignKey(AgentJob, null=True, blank=True, on_delete=models.SET_NULL)
    target_url = models.URLField(max_length=500)
    duration_seconds = models.PositiveIntegerField(default=15)
    samples = models.PositiveIntegerField(default=6)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    result = models.JSONField(default=dict, blank=True)
    error_code = models.CharField(max_length=80, blank=True)
    error_detail = models.TextField(blank=True)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["account", "status"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.account.primary_domain}:{self.status}:{self.target_url}"


class AuditLog(models.Model):
    class Action(models.TextChoices):
        ACCOUNT_CREATED = "account.created", "Account created"
        ACCOUNT_UPDATED = "account.updated", "Account updated"
        ACCOUNT_PASSWORD_CHANGED = "account.password_changed", "Account password changed"
        ACCOUNT_SYNCED = "account.synced", "Account synced"
        ACCOUNT_RETRY_FAILED = "account.retry_failed", "Account retry failed"
        PROVISIONING_STEP_RETRIED = "provisioning.step_retried", "Provisioning step retried"
        USER_CREATED = "user.created", "User created"
        USER_UPDATED = "user.updated", "User updated"
        USER_IMPERSONATED = "user.impersonated", "User impersonated"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=80, choices=Action.choices)
    account = models.ForeignKey(HostingAccount, null=True, blank=True, related_name="audit_logs", on_delete=models.SET_NULL)
    target_type = models.CharField(max_length=80, blank=True)
    target_id = models.CharField(max_length=80, blank=True)
    target_label = models.CharField(max_length=255, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["action", "created_at"]),
            models.Index(fields=["account", "created_at"]),
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self):
        actor = self.user.username if self.user_id else "system"
        return f"{self.action} by {actor} on {self.target_label or self.target_id}"
