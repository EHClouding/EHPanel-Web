import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


class Node(models.Model):
    class State(models.TextChoices):
        PENDING = "pending", "Pending"
        ONLINE = "online", "Online"
        OFFLINE = "offline", "Offline"
        MAINTENANCE = "maintenance", "Maintenance"
        DISABLED = "disabled", "Disabled"

    class AgentType(models.TextChoices):
        WEB = "web", "Web"
        RADIO = "radio", "Radio"
        VIDEO = "video", "Video"
        SRT = "srt", "SRT"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hostname = models.CharField(max_length=255, unique=True)
    agent_type = models.CharField(max_length=20, choices=AgentType.choices, default=AgentType.WEB)
    state = models.CharField(max_length=20, choices=State.choices, default=State.PENDING)
    agent_version = models.CharField(max_length=50, blank=True)
    os_name = models.CharField(max_length=120, blank=True)
    arch = models.CharField(max_length=50, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    agent_secret = models.CharField(max_length=128, blank=True)
    capabilities = models.JSONField(default=dict, blank=True)
    last_telemetry = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def generate_agent_secret(cls):
        return "agent_" + secrets.token_urlsafe(48)

    def save(self, *args, **kwargs):
        if not self.agent_secret:
            self.agent_secret = self.generate_agent_secret()
        super().save(*args, **kwargs)

    def mark_online(self):
        self.state = self.State.ONLINE
        self.last_seen_at = timezone.now()
        self.save(update_fields=["state", "last_seen_at", "updated_at"])

    @property
    def is_stale(self):
        capabilities = self.capabilities if isinstance(self.capabilities, dict) else {}
        if capabilities.get("local_panel"):
            return False
        if self.state != self.State.ONLINE or not self.last_seen_at:
            return False
        timeout_at = timezone.now() - timedelta(seconds=settings.AGENT_HEARTBEAT_TIMEOUT_SECONDS)
        return self.last_seen_at < timeout_at

    @property
    def effective_state(self):
        return self.State.OFFLINE if self.is_stale else self.state

    def __str__(self):
        return f"{self.hostname} ({self.agent_type})"


class EnrollmentToken(models.Model):
    token = models.CharField(max_length=96, unique=True, default="", editable=False)
    hostname = models.CharField(max_length=255)
    agent_type = models.CharField(max_length=20, choices=Node.AgentType.choices, default=Node.AgentType.WEB)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    node = models.ForeignKey(Node, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def generate_token(cls):
        return "enroll_" + secrets.token_hex(32)

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = self.generate_token()
        super().save(*args, **kwargs)

    @property
    def is_valid(self):
        return self.used_at is None and self.expires_at > timezone.now()

    def consume(self, node):
        self.node = node
        self.used_at = timezone.now()
        self.save(update_fields=["node", "used_at"])

    def __str__(self):
        status = "used" if self.used_at else "unused"
        return f"{self.hostname} ({status})"


class AgentEvent(models.Model):
    node = models.ForeignKey(Node, null=True, blank=True, on_delete=models.SET_NULL)
    msg_type = models.CharField(max_length=80)
    msg_id = models.CharField(max_length=80, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class AgentJob(models.Model):
    class Type(models.TextChoices):
        CREATE_ACCOUNT = "create_account", "Create account"
        PROVISION_HOSTING = "provision_hosting", "Provision hosting"
        PROVISION_OPENLITESPEED_HOSTING = "provision_openlitespeed_hosting", "Provision OpenLiteSpeed hosting"
        DELETE_ACCOUNT = "delete_account", "Delete account"
        SUSPEND_ACCOUNT = "suspend_account", "Suspend account"
        UNSUSPEND_ACCOUNT = "unsuspend_account", "Unsuspend account"
        CREATE_DOMAIN = "create_domain", "Create domain"
        DELETE_DOMAIN = "delete_domain", "Delete domain"
        CREATE_PHP_POOL = "create_php_pool", "Create PHP-FPM pool"
        CREATE_DATABASE = "create_database", "Create database"
        DELETE_DATABASE = "delete_database", "Delete database"
        CHANGE_DATABASE_PASSWORD = "change_database_password", "Change database password"
        COLLECT_DATABASE_SIZE = "collect_database_size", "Collect database size"
        CREATE_DATABASE_USER = "create_database_user", "Create database user"
        DELETE_DATABASE_USER = "delete_database_user", "Delete database user"
        CLONE_DATABASE = "clone_database", "Clone database"
        CHECK_REPAIR_DATABASE = "check_repair_database", "Check and repair database"
        EXPORT_DATABASE = "export_database", "Export database"
        IMPORT_DATABASE = "import_database", "Import database"
        CREATE_DNS_ZONE = "create_dns_zone", "Create DNS zone"
        ISSUE_SSL = "issue_ssl", "Issue SSL certificate"
        CREATE_MAIL_DOMAIN = "create_mail_domain", "Create mail domain"
        CREATE_MAILBOX = "create_mailbox", "Create mailbox"
        CHANGE_MAILBOX_PASSWORD = "change_mailbox_password", "Change mailbox password"
        SUSPEND_MAILBOX = "suspend_mailbox", "Suspend mailbox"
        UNSUSPEND_MAILBOX = "unsuspend_mailbox", "Unsuspend mailbox"
        DELETE_MAILBOX = "delete_mailbox", "Delete mailbox"
        CREATE_MAIL_ALIAS = "create_mail_alias", "Create mail alias"
        DELETE_MAIL_ALIAS = "delete_mail_alias", "Delete mail alias"
        SET_MAILBOX_QUOTA = "set_mailbox_quota", "Set mailbox quota"
        LIST_MAILBOXES = "list_mailboxes", "List mailboxes"
        SET_MAILBOX_AUTORESPONDER = "set_mailbox_autoresponder", "Set mailbox autoresponder"
        SET_MAILBOX_ANTISPAM = "set_mailbox_antispam", "Set mailbox antispam"
        ENABLE_DKIM = "enable_dkim", "Enable DKIM"
        COLLECT_MAILBOX_USAGE = "collect_mailbox_usage", "Collect mailbox usage"
        TEST_MAIL_DELIVERY = "test_mail_delivery", "Test mail delivery"
        INSTALL_WORDPRESS = "install_wordpress", "Install WordPress"
        INSTALL_MOODLE = "install_moodle", "Install Moodle"
        UPDATE_WORDPRESS = "wordpress_update", "Update WordPress"
        DELETE_WORDPRESS = "wordpress_delete", "Delete WordPress"
        WORDPRESS_TOOLKIT = "wordpress_toolkit", "WordPress toolkit"
        PYTHON_TOOLKIT = "python_toolkit", "Python toolkit"
        DETECT_APPS = "detect_apps", "Detect applications"
        CHECK_APP_UPDATES = "check_app_updates", "Check app updates"
        BACKUP_APP = "backup_app", "Backup app"
        DELETE_APP = "delete_app", "Delete app"
        DEPLOY_PYTHON_APP = "deploy_python_app", "Deploy Python app"
        DEPLOY_DJANGO_APP = "deploy_django_app", "Deploy Django app"
        DEPLOY_NODE_APP = "deploy_node_app", "Deploy NodeJS app"
        NODE_TOOLKIT = "node_toolkit", "Node toolkit"
        DEPLOY_LARAVEL_APP = "deploy_laravel_app", "Deploy Laravel app"
        LARAVEL_TOOLKIT = "laravel_toolkit", "Laravel toolkit"
        APP_ACTION = "app_action", "App action"
        COLLECT_APP_LOGS = "collect_app_logs", "Collect app logs"
        COLLECT_ACCOUNT_USAGE = "collect_account_usage", "Collect account usage"
        COLLECT_ACCOUNT_MONITORING = "collect_account_monitoring", "Collect account monitoring"
        SECURITY_SCAN = "security_scan", "Security scan"
        APPLY_WEB_PROTECTION = "apply_web_protection", "Apply web protection"
        APPLY_PROTECTED_DIRECTORIES = "apply_protected_directories", "Apply protected directories"
        APPLY_WAF = "apply_waf", "Apply WAF"
        COLLECT_WAF_EVENTS = "collect_waf_events", "Collect WAF events"
        APPLY_IP_BLOCKS = "apply_ip_blocks", "Apply IP blocks"
        COLLECT_SOFTWARE_INFO = "collect_software_info", "Collect software info"
        APPLY_SOFTWARE_SETTINGS = "apply_software_settings", "Apply software settings"
        RUN_WEB_PERFORMANCE_AUDIT = "run_web_performance_audit", "Run web performance audit"
        CREATE_FTP_USER = "create_ftp_user", "Create FTP user"
        DELETE_FTP_USER = "delete_ftp_user", "Delete FTP user"
        SUSPEND_FTP_USER = "suspend_ftp_user", "Suspend FTP user"
        UNSUSPEND_FTP_USER = "unsuspend_ftp_user", "Unsuspend FTP user"
        CREATE_SFTP_USER = "create_sftp_user", "Create SFTP user"
        ROTATE_SFTP_PASSWORD = "rotate_sftp_password", "Rotate SFTP password"
        FILE_LIST = "file_list", "List account files"
        FILE_READ = "file_read", "Read account file"
        FILE_WRITE = "file_write", "Write account file"
        FILE_DELETE = "file_delete", "Delete account file"
        FILE_MKDIR = "file_mkdir", "Create account directory"
        FILE_CHMOD = "file_chmod", "Change account file mode"
        FILE_COMPRESS = "file_compress", "Compress account files"
        FILE_EXTRACT = "file_extract", "Extract account archive"
        FILE_UPLOAD = "file_upload", "Upload account file"
        FILE_IMPORT_URL = "file_import_url", "Import account file from URL"
        FILE_COPY = "file_copy", "Copy account file"
        FILE_MOVE = "file_move", "Move account file"
        FILE_DOWNLOAD = "file_download", "Prepare account file download"
        BACKUP_ACCOUNT = "backup_account", "Backup account"
        MIGRATION_DISCOVER = "migration_discover", "Discover migration source"
        MIGRATE_ACCOUNT = "migrate_account", "Migrate hosting account"
        SERVICE_ACTION = "service_action", "Service action"

    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        SENT = "sent", "Sent"
        RUNNING = "running", "Running"
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"
        CANCELED = "canceled", "Canceled"
        EXPIRED = "expired", "Expired"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    node = models.ForeignKey(Node, related_name="jobs", on_delete=models.CASCADE)
    job_type = models.CharField(max_length=80, choices=Type.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    payload = models.JSONField(default=dict, blank=True)
    result = models.JSONField(default=dict, blank=True)
    error_code = models.CharField(max_length=80, blank=True)
    error_detail = models.TextField(blank=True)
    correlation_id = models.CharField(max_length=80, blank=True)
    queued_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-queued_at"]
        indexes = [
            models.Index(fields=["node", "status"]),
            models.Index(fields=["job_type", "status"]),
            models.Index(fields=["correlation_id"]),
        ]

    def mark_sent(self, correlation_id):
        self.status = self.Status.SENT
        self.correlation_id = correlation_id
        self.sent_at = timezone.now()
        self.save(update_fields=["status", "correlation_id", "sent_at", "updated_at"])

    def mark_running(self):
        self.status = self.Status.RUNNING
        self.started_at = timezone.now()
        self.save(update_fields=["status", "started_at", "updated_at"])

    def mark_success(self, result=None):
        self.status = self.Status.SUCCESS
        self.result = result or {}
        self.finished_at = timezone.now()
        self.save(update_fields=["status", "result", "finished_at", "updated_at"])

    def mark_failed(self, code="", detail="", result=None):
        self.status = self.Status.FAILED
        self.error_code = code
        self.error_detail = detail
        self.result = result or {}
        self.finished_at = timezone.now()
        self.save(update_fields=["status", "error_code", "error_detail", "result", "finished_at", "updated_at"])

    def __str__(self):
        return f"{self.job_type} on {self.node.hostname} ({self.status})"
