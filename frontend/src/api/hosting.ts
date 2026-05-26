import { apiFetch, tokenStorage } from "@/api/client"

const BASE_URL = import.meta.env.VITE_API_URL ?? ""

type Page<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

type ListResponse<T> = T[] | Page<T>

export type HostingAccount = {
  id: string
  plan?: number | null
  plan_name?: string | null
  owner?: number | null
  owner_username?: string | null
  reseller?: number | null
  reseller_username?: string | null
  primary_domain: string
  customer_name?: string
  customer_email?: string
  billing_client_id?: string
  billing_service_id?: string
  billing_synced_at?: string | null
  billing_status?: string
  billing_metadata?: Record<string, unknown>
  username: string
  status: string
  web_engine: string
  php_version: string
  disk_mb: number
  bandwidth_mb: number
  memory_mb?: number
  cpu_pct?: number
  node_hostname?: string
  node_public_ip?: string
  last_usage?: AccountUsage | null
  domains?: HostingDomain[]
  databases?: HostingDatabase[]
  mailboxes?: HostingMailbox[]
  provisioning_runs?: ProvisioningRun[]
  domains_count?: number
  databases_count?: number
  mailboxes_count?: number
  latest_provisioning?: Record<string, unknown> | null
  normalized_status?: { status: string; label: string; tone: string }
  created_at?: string
  updated_at?: string
}

export type ProvisioningJob = {
  id: string
  node_hostname?: string
  job_type: string
  status: string
  payload?: Record<string, unknown>
  result?: Record<string, unknown>
  error_code?: string
  error_detail?: string
  queued_at?: string
  sent_at?: string | null
  started_at?: string | null
  finished_at?: string | null
  updated_at?: string
}

export type ProvisioningStep = {
  id: number
  name: string
  order: number
  job: ProvisioningJob
  created_at: string
}

export type ProvisioningRun = {
  id: string
  status: string
  steps: ProvisioningStep[]
  created_at: string
  updated_at: string
}

export type HostingPlan = {
  id: number
  name: string
  slug: string
  disk_mb: number
  bandwidth_mb: number
  memory_mb: number
  cpu_pct: number
  max_domains: number
  max_databases: number
  max_mailboxes: number
  allowed_web_engines: string[]
  allowed_php_versions: string[]
  features: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export type HostingPlanPayload = {
  allowed_web_engines?: string[]
  allowed_php_versions?: string[]
  name: string
  slug: string
  disk_mb: number
  bandwidth_mb: number
  memory_mb: number
  cpu_pct: number
  max_domains: number
  max_databases: number
  max_mailboxes: number
  features?: Record<string, unknown>
  is_active: boolean
}

export type ProvisionHostingAccountPayload = {
  account_password: string
  customer_email: string
  customer_name?: string
  database?: {
    engine: "mariadb" | "postgresql"
    name: string
    password: string
    username: string
  }
  dns_records?: Array<Record<string, unknown>>
  mailbox?: {
    email: string
    password: string
    quota_mb: number
  }
  node: string
  owner?: number | null
  php_version: string
  plan: number
  primary_domain: string
  public_ip?: string
  reseller?: number | null
  ssl_email?: string
  ssl_force_renewal?: boolean
  ssl_staging?: boolean
  username: string
  web_engine: string
}

export type HostingReseller = {
  id: number
  user_id: number
  username: string
  email: string
  first_name?: string
  last_name?: string
  is_active: boolean
  plan?: number | null
  plan_name?: string | null
  primary_node?: string | null
  primary_node_hostname?: string | null
  company_name: string
  panel_domain?: string
  support_email?: string
  brand_primary_color?: string
  brand_accent_color?: string
  ip_allowlist?: string[]
  disk_mb: number
  bandwidth_mb: number
  max_accounts: number
  max_mailboxes: number
  max_databases: number
  max_domains: number
  status: "active" | "suspended"
  accounts_count: number
  active_accounts_count: number
  suspended_accounts_count: number
  disk_used_mb: number
  bandwidth_used_mb: number
  disk_pct: number
  bandwidth_pct: number
  created_at: string
  updated_at: string
}

export type ResellerTeamMember = {
  id: number
  user_id: number
  username: string
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  role: "admin_reseller" | "support" | "commercial"
  can_view_accounts: boolean
  can_manage_support: boolean
  status: "active" | "suspended"
  created_at: string
  updated_at: string
}

export type CreateResellerTeamMemberPayload = {
  email: string
  first_name?: string
  last_name?: string
  password: string
  role: ResellerTeamMember["role"]
  username: string
}

export type ResellerSecurityResponse = {
  security: { ip_allowlist: string[] }
  sessions: Array<{ id: number; ip_address: string | null; device: string; role: string; status: string; last_seen_at: string | null; created_at: string }>
}

export type CreateHostingResellerPayload = {
  company_name: string
  email: string
  first_name?: string
  last_name?: string
  panel_domain?: string
  password: string
  plan: number
  primary_node?: string | null
  username: string
}

export type MigrationProvider = "cpanel" | "plesk" | "directadmin" | "backup_url" | "ehpanel"
export type MigrationStatus = "draft" | "discovering" | "analyzed" | "queued" | "running" | "paused" | "completed" | "failed" | "canceled"

export type MigrationSource = {
  id: number
  provider: MigrationProvider
  provider_label: string
  host: string
  port: number
  username: string
  auth_method: "password" | "ssh_key" | "api_token"
  status: string
  last_error?: string
  created_at: string
  updated_at: string
}

export type MigrationAccount = {
  id: number
  run: number
  source_username?: string
  primary_domain: string
  customer_email?: string
  status: string
  current_step?: string
  progress_percent: number
  files_mb: number
  databases_count: number
  mailboxes_count: number
  subdomains_count: number
  detected: Record<string, unknown>
  destination_account?: string | null
  destination_domain?: string | null
  error_code?: string
  error_detail?: string
  created_at: string
  updated_at: string
}

export type MigrationLog = {
  id: number
  run: number
  account?: number | null
  account_domain?: string | null
  level: string
  message: string
  metadata: Record<string, unknown>
  created_at: string
}

export type MigrationStep = {
  id: number
  account?: number | null
  key: string
  label: string
  order: number
  status: string
  progress_percent: number
  job?: string | null
  job_status?: string | null
  error_detail?: string
  created_at: string
  updated_at: string
}

export type MigrationRun = {
  id: number
  source: MigrationSource
  destination_node: string
  destination_node_hostname: string
  mode: "discover_only" | "select_and_migrate" | "auto_migrate_all"
  priority: string
  migration_type: string
  concurrency: number
  status: MigrationStatus
  current_step: string
  progress_percent: number
  total_accounts: number
  completed_accounts: number
  failed_accounts: number
  selected_accounts: string[]
  options: Record<string, unknown>
  notes?: string
  origin: string
  account_label: string
  accounts: MigrationAccount[]
  steps: MigrationStep[]
  logs: MigrationLog[]
  created_at: string
  updated_at: string
}

export type CreateMigrationRunPayload = {
  auth_method: "password" | "ssh_key" | "api_token"
  concurrency: number
  destination_node: string
  host: string
  include_databases: boolean
  include_files: boolean
  include_mail: boolean
  include_subdomains: boolean
  migration_type: string
  mode: "discover_only" | "select_and_migrate" | "auto_migrate_all"
  notes?: string
  port: number
  preserve_mail_passwords: boolean
  priority: string
  provider: MigrationProvider
  secret?: string
  selected_accounts?: string[]
  username: string
}

export type CreateImportRunPayload = {
  account_label?: string
  backup_file?: File | null
  backup_url?: string
  destination_node: string
  import_source: "file_upload" | "remote_url"
  include_databases: boolean
  include_files: boolean
  include_mail: boolean
  include_subdomains: boolean
  migration_type: string
  notes?: string
  panel_type: "cpanel" | "plesk" | "directadmin" | "ehpanel" | "generic"
  preserve_mail_passwords: boolean
  priority: string
}

export type HostingAccountExport = {
  id: number
  account: string
  account_domain: string
  account_username: string
  node_hostname?: string | null
  status: "queued" | "running" | "completed" | "failed"
  export_type: string
  include_files: boolean
  include_databases: boolean
  include_mail: boolean
  include_subdomains: boolean
  notes?: string
  archive_path?: string
  filename?: string
  size_bytes: number
  result: Record<string, unknown>
  last_job?: string | null
  job_status?: string | null
  error_code?: string
  error_detail?: string
  download_url: string
  created_at: string
  updated_at: string
}

export type CreateHostingAccountExportPayload = {
  account: string
  export_type: "full" | "files_databases" | "mail_only"
  include_files: boolean
  include_databases: boolean
  include_mail: boolean
  include_subdomains: boolean
  notes?: string
}

export type BackupStorageDestination = {
  id: number
  name: string
  storage_type: "local" | "s3" | "ftp" | "ehpanel_drive"
  type_label: string
  endpoint: string
  bucket: string
  path: string
  username: string
  capacity_gb: number
  used_bytes: number
  status: "active" | "paused" | "testing" | "failed"
  status_label: string
  config: Record<string, unknown>
  last_test_at?: string | null
  last_test_result: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type BackupStorageDestinationPayload = Partial<Omit<BackupStorageDestination, "id" | "type_label" | "status_label" | "used_bytes" | "last_test_at" | "last_test_result" | "created_at" | "updated_at">> & {
  name: string
  storage_type: BackupStorageDestination["storage_type"]
  secret?: string
}

export type BackupPolicy = {
  id: number
  name: string
  policy_type: "full" | "incremental" | "partial" | "realtime"
  type_label: string
  frequency: string
  include_files: boolean
  include_databases: boolean
  include_mail: boolean
  include_config: boolean
  full_account: boolean
  includes_label: string
  storage: number | null
  storage_name?: string | null
  retention_days: number
  retention_copies: number
  retention_label: string
  status: "active" | "paused"
  status_label: string
  notes: string
  created_at: string
  updated_at: string
}

export type BackupPolicyPayload = Omit<BackupPolicy, "id" | "type_label" | "status_label" | "includes_label" | "storage_name" | "retention_label" | "created_at" | "updated_at">

export type BackupRestoreRun = {
  id: number
  accounts: string[]
  accounts_detail: Array<{ id: string; domain: string; username: string; node: string }>
  reseller?: number | null
  reseller_name?: string | null
  backup?: number | null
  backup_label?: string | null
  destination_node?: string | null
  destination_node_hostname?: string | null
  status: "queued" | "running" | "completed" | "failed"
  restore_type: string
  include_files: boolean
  include_databases: boolean
  include_mail: boolean
  notes: string
  result: Record<string, unknown>
  last_job?: string | null
  job_status?: string | null
  error_code?: string
  error_detail?: string
  operator?: string | null
  created_at: string
  updated_at: string
}

export type BackupRestoreRunPayload = {
  account_ids: string[]
  backup?: number | null
  destination_node?: string | null
  include_databases: boolean
  include_files: boolean
  include_mail: boolean
  notes?: string
  reseller?: number | null
  restore_type: string
}

export type ProvisioningTemplateCategory = "hosting" | "reseller" | "migration" | "import" | "application"

export type ProvisioningTemplateAction = {
  key: string
  label: string
  enabled: boolean
  order: number
}

export type ProvisioningTemplate = {
  id: number
  name: string
  slug: string
  category: ProvisioningTemplateCategory
  description: string
  target_plan?: number | null
  target_plan_name?: string | null
  resources: Record<string, unknown>
  actions: ProvisioningTemplateAction[]
  variables: Record<string, unknown>
  automation: Record<string, unknown>
  is_active: boolean
  usage_count: number
  last_used_at?: string | null
  action_count: number
  variable_count: number
  created_at: string
  updated_at: string
}

export type ProvisioningTemplatePayload = {
  name: string
  category: ProvisioningTemplateCategory
  description?: string
  target_plan?: number | null
  resources: Record<string, unknown>
  actions: ProvisioningTemplateAction[]
  variables: Record<string, unknown>
  automation: Record<string, unknown>
  is_active: boolean
}

export type HostingConfiguration = {
  id: number
  key: string
  default_node?: number | null
  default_node_hostname?: string | null
  default_public_ip?: string | null
  dns_defaults: Record<string, unknown>
  ssl_defaults: Record<string, unknown>
  mail_defaults: Record<string, unknown>
  paths: Record<string, unknown>
  policies: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type BillingIntegrationStatus = {
  web_token_configured: boolean
  billing_api_configured: boolean
  billing_api_base: string
  linked_accounts: number
  unlinked_accounts: number
  total_accounts: number
  health: Record<string, unknown>
}

export type ApiKeyCredentialStatus = "active" | "paused" | "revoked" | "draft"

export type ApiKeyCredential = {
  id: number
  name: string
  owner: string
  route: string
  key_prefix: string
  scopes: string[]
  scopes_label: string
  status: ApiKeyCredentialStatus
  status_label: string
  notes: string
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export type ApiKeyCredentialPayload = {
  name: string
  owner?: string
  route?: string
  scopes?: string[]
  status?: ApiKeyCredentialStatus
  notes?: string
}

export type ApiKeyCredentialCreated = ApiKeyCredential & { api_key?: string }

export type AccountProfileResponse = {
  account: HostingAccount
  node: {
    hostname: string
    public_ip?: string
    state: string
    agent_version?: string
    os_name?: string
    arch?: string
    last_seen_at?: string | null
    last_seen_age_seconds?: number | null
  }
  usage: {
    disk_used_mb?: number
    disk_quota_mb?: number
    bandwidth_used_mb?: number
    bandwidth_quota_mb?: number
    ram_used_mb?: number
    memory_limit_mb?: number
    cpu_pct?: number
    cpu_limit_pct?: number
    last_usage_at?: string | null
  }
  services: {
    domains: number
    databases: number
    mailboxes: number
    applications: number
    ftp_users: number
    protected_directories: number
    ip_blocks: number
    open_tickets: number
  }
  security: {
    ssl_status: string
    ssl_issuer?: string
    ssl_expires_at?: string | null
    web_protection_status: string
    waf_status?: string
    waf_mode?: string
    last_scan_status?: string
    last_scan_at?: string | null
  }
  monitoring: {
    status: string
    uptime_pct: number
    response_ms: number
    incidents_open: number
    collected_at?: string | null
  }
  applications: Array<{ id: number; name: string; type: string; status: string; version?: string; url?: string; updated_at?: string }>
  tickets: {
    open: number
    latest: Array<{ id: number; display_id: string; subject: string; status: string; priority: string; updated_at: string }>
  }
  provisioning?: Record<string, unknown> | null
}

export type HostingAdvancedKind =
  | "git_repo"
  | "ssh_key"
  | "cron"
  | "variable"
  | "redirect"
  | "header"
  | "webhook"
  | "vhost_manual"

export type HostingAdvancedItem = {
  id: number
  account: string
  account_domain: string
  account_username: string
  kind: HostingAdvancedKind
  name: string
  config: Record<string, unknown>
  masked_config: Record<string, unknown>
  enabled: boolean
  status: "active" | "disabled" | "pending" | "failed"
  last_job_status?: AgentJob["status"] | null
  last_error_code?: string | null
  last_error_detail?: string | null
  created_at: string
  updated_at: string
}

export type AdvancedSummaryResponse = {
  account: HostingAccount
  counts: Record<HostingAdvancedKind, number>
  items: HostingAdvancedItem[]
  apps_with_git: Array<{ app_id: number; app_name: string; app_type: string; repo_url: string; branch: string; strategy?: string; updated_at?: string }>
  recent_jobs: AgentJob[]
  recent_audit: Array<Record<string, unknown>>
}

export type HomeDashboardSummary = {
  activeSites: number
  alerts: Array<{ label: string; tone?: "amber" | "emerald" | "red" }>
  backupPct: number
  cpuLimitPct: number
  cpuPct: number
  criticalMailboxes: number
  databaseDetail: string
  databasePct: number
  diskPct: number
  diskQuota: number
  diskUsed: number
  events: Array<{ label: string; tone?: "amber" | "emerald" | "red" }>
  healthPct: number
  healthSub: string
  mailPct: number
  primarySites: number
  ramPct: number
  ramSub: string
  sslDetail: string
  sslValue: string
  storagePct: number
  storageUsed: number
  totalReceived: number
  totalSent: number
  trafficValues: Array<{ down: number; up: number }>
  upstreamNow: number
  downstreamNow: number
  trafficPct: number
  totalCounts: {
    accounts: number
    domains: number
    mailboxes: number
    databases: number
  }
}

export type SiteOverviewRow = {
  account: HostingAccount
  app: HostingApplication | null
  apps_count: number
  domain: string
  document_root: string
  engine: string
  runtime: HostingApplication["type"] | "custom" | "unknown"
  status: string
  health: "ok" | "warning" | "danger"
  health_reason?: string
  disk: { used_mb: number; quota_mb: number; percent: number }
  traffic: { used_mb: number; quota_mb: number; percent: number; hourly: number[] }
  http: {
    requests: number
    unique_ips: number
    recent_errors: Array<{ raw?: string; status?: number; url?: string }>
  }
  mail: {
    sent: number
    received: number
    rejected: number
    spam: number
    events: Array<{ code?: string; detail?: string; direction?: string; from?: string; status?: string; time?: string; to?: string }>
  }
  security: {
    ssl_status: string
    ssl_expires_at?: string | null
    web_protection_status: string
  }
  quick_actions: Array<{ key: string; label: string; url?: string; enabled: boolean }>
}

export type SitesOverviewResponse = {
  overview: {
    total: number
    active: number
    apps: number
    wordpress: number
    moodle?: number
    alerts: number
    diskUsed: number
    diskPct: number
    trafficUsed: number
    trafficPct: number
    requests: number
    mailEvents: number
    mailRejected: number
    diskSeries: number[]
    trafficSeries: number[]
    requestSeries: number[]
    mailSeries: number[]
  }
  sites: SiteOverviewRow[]
  mail_events: SiteOverviewRow["mail"]["events"]
}

export type SupportTicketAttachment = {
  id: number
  original_name: string
  content_type: string
  size: number
  download_url: string
  created_at: string
}

export type SupportTicketMessage = {
  id: number
  author_name?: string
  author_type: "customer" | "reseller" | "staff" | "system"
  body: string
  is_internal: boolean
  attachments: SupportTicketAttachment[]
  created_at: string
}

export type SupportTicket = {
  id: number
  display_id: string
  ticket_number: number
  account: string
  account_domain: string
  account_username: string
  requester_name?: string
  subject: string
  department: "administration" | "technical" | "billing" | "security"
  priority: "low" | "medium" | "high" | "urgent"
  status: "open" | "answered" | "customer_reply" | "closed"
  last_reply_at?: string | null
  closed_at?: string | null
  messages: SupportTicketMessage[]
  created_at: string
  updated_at: string
}

export type GlobalAnnouncement = {
  id: number
  title: string
  body: string
  audience: "all" | "clients" | "resellers"
  audience_label: string
  priority: "low" | "medium" | "high" | "critical"
  priority_label: string
  status: "draft" | "published" | "scheduled" | "archived"
  status_label: string
  publish_at?: string | null
  expires_at?: string | null
  author?: string | null
  created_at: string
  updated_at: string
}

export type GlobalAnnouncementPayload = {
  title: string
  body?: string
  audience: GlobalAnnouncement["audience"]
  priority: GlobalAnnouncement["priority"]
  status: GlobalAnnouncement["status"]
  publish_at?: string | null
  expires_at?: string | null
}

export type AccountUsage = {
  disk_used_mb?: number
  disk_quota_mb?: number
  ram_used_mb?: number
  ram_used_bytes?: number
  memory_limit_mb?: number
  cpu_pct?: number
  cpu_limit_pct?: number
  processes?: number
  bandwidth_used_mb?: number
  bandwidth_bytes?: number
  bandwidth_mb?: number
  http?: {
    bytes_total?: number
    requests?: number
    unique_ips?: number
    status_counts?: Record<string, number>
    top_urls?: Array<{ url: string; requests: number }>
    recent_errors?: Array<{ url?: string; status?: number; raw?: string }>
    hourly?: number[]
  }
  storage?: {
    files_mb?: number
    mail_mb?: number
    tmp_mb?: number
    logs_mb?: number
    databases_mb?: number
    mailboxes_mb?: number
    backups_mb?: number
    total_mb?: number
  }
  mail?: {
    sent?: number
    received?: number
    rejected?: number
    deferred?: number
    spam?: number
    events?: Array<{
      time?: string
      direction?: string
      from?: string
      to?: string
      status?: string
      code?: string
      detail?: string
    }>
    warning?: string
  }
  resource_limits?: Record<string, unknown>
  quota?: Record<string, unknown>
  collected_at?: string
  warnings?: string[]
  software?: SoftwareInfo
}

export type AccountUsageResponse = {
  status: string
  job?: string
  usage: AccountUsage
  last_usage_at: string | null
  error_code?: string
  error_detail?: string
}

export type MonitoringResponse = {
  status: string
  job?: string | null
  error_code?: string
  error_detail?: string
  summary: {
    status: string
    uptime_pct: number
    response_ms: number
    incidents_open: number
    checks_failed: number
    checks_warning: number
    last_checked_at?: string | null
  }
  checks: Array<{
    id: number
    type: string
    name: string
    target: string
    status: string
    response_ms: number
    enabled: boolean
    last_checked_at?: string | null
    last_message?: string
  }>
  services: Array<Record<string, unknown>>
  incidents: Array<{
    id: number
    title: string
    severity: string
    service?: string
    status: string
    started_at?: string
    acknowledged_at?: string | null
    resolved_at?: string | null
    detail?: string
  }>
  alerts: Array<{
    id: number
    channel: string
    event: string
    threshold?: string
    target?: string
    enabled: boolean
    last_test_at?: string | null
    last_test_status?: string
  }>
  logs: {
    web?: Array<Record<string, unknown>>
    mail?: Array<Record<string, unknown>>
    system?: Array<Record<string, unknown>>
  }
  history: Array<Record<string, unknown>>
  sla: Record<string, unknown>
}

export type SoftwareInfo = {
  username?: string
  domain?: string
  web_engine?: string
  php_version?: string
  home_dir?: string
  public_dir?: string
  account_logs?: string
  php_fpm_pool?: string
  php_fpm_sock?: string
  collected_at?: string
  service_state?: Record<string, { active?: boolean; status?: string }>
  php_cli_version?: string
  php_ini?: string
  php_modules?: string[]
  php_ini_values?: Record<string, string>
  php_user_ini?: Record<string, string>
  php_fpm_values?: Record<string, string>
  apache_http_directives?: string
  apache_https_directives?: string
  nginx_directives?: string
  opcache?: { enabled?: boolean; cli?: boolean }
  composer_version?: string
  node_version?: string
  pnpm_version?: string
  python_version?: string
  nginx_check?: string
  php_fpm_check?: string
  valkey_ping?: string
  valkey_ok?: boolean
  public_dir_mode?: string
  recent_php_errors?: string[]
}

export type SoftwarePerformanceAudit = {
  id: number
  account: string
  target_url: string
  duration_seconds: number
  samples: number
  status: "queued" | "running" | "completed" | "failed"
  result: {
    summary?: Record<string, unknown>
    slow_requests?: Array<Record<string, unknown>>
    top_paths?: Array<Record<string, unknown>>
    processes?: Array<Record<string, unknown>>
    recent_errors?: string[]
    recommendations?: string[]
  }
  error_code?: string
  error_detail?: string
  job?: string | null
  job_status?: string | null
  requested_by_username?: string | null
  started_at?: string | null
  finished_at?: string | null
  created_at: string
  updated_at: string
}

export type SoftwarePerformanceAuditPayload = {
  target_url?: string
  duration_seconds?: number
  samples?: number
}

export type SoftwareSettingsPayload = {
  php_settings?: Record<string, string>
  php_extra_directives?: string
  php_fpm?: Record<string, string>
  apache_http_directives?: string
  apache_https_directives?: string
  nginx_directives?: string
  extensions?: Record<string, boolean>
}

export type HostingDomain = {
  id: number
  account: string
  account_domain: string
  account_username: string
  node?: string
  node_hostname?: string
  domain: string
  is_primary: boolean
  domain_type: "primary" | "alias" | "subdomain" | "addon"
  document_root: string
  dns_status: "pending" | "active" | "failed"
  ssl_status: "pending" | "active" | "failed"
  ssl_issuer?: string
  ssl_expires_at?: string | null
  ssl_domains?: string[]
  ssl_cert_path?: string
  ssl_error_code?: string
  ssl_error_detail?: string
  web_protection: WebProtectionSettings
  web_protection_status: "pending" | "active" | "failed"
  web_protection_error?: string
  created_at: string
  updated_at: string
}

export type WebProtectionSettings = {
  force_https: boolean
  hsts_enabled: boolean
  hsts_include_subdomains: boolean
  hsts_preload: boolean
  hotlink_protection: boolean
  hotlink_allowed_domains: string[]
  basic_bot_block: boolean
  quick_rules: boolean
  ai_diagnostics_mock: boolean
}

export type WebProtectionResponse = {
  domain: HostingDomain
  settings: WebProtectionSettings
  status: "pending" | "active" | "failed"
  error?: string
  job?: string | null
  ai_diagnostics: {
    mode: "mock"
    summary: string
    checks: { label: string; status: string; detail: string }[]
  }
}

export type DnsRecordType = "A" | "AAAA" | "CNAME" | "MX" | "NS" | "SRV" | "TXT" | "CAA"

export type HostingDnsRecord = {
  id: number
  domain: number
  domain_name: string
  account: string
  node?: string
  node_hostname?: string
  name: string
  type: DnsRecordType
  content: string
  ttl: number
  priority: number | null
  created_at: string
  updated_at: string
}

export type DnsTemplatePreviewRecord = {
  action: string
  content: string
  current?: HostingDnsRecord | null
  name: string
  priority: number | null
  record_type: DnsRecordType
  status: "new" | "update" | "same"
  template_id: number
  ttl: number
}

export type CreateDnsRecordPayload = {
  domain: number
  name: string
  type: DnsRecordType
  content: string
  ttl: number
  priority?: number | null
}

export type DnsTemplateRecord = {
  id: number
  name: string
  type: DnsRecordType
  content: string
  ttl: number
  priority: number | null
  order: number
  is_active: boolean
  description: string
  created_at: string
  updated_at: string
}

export type DnsTemplateRecordPayload = {
  name: string
  type: DnsRecordType
  content: string
  ttl: number
  priority?: number | null
  order: number
  is_active: boolean
  description?: string
}

export type GlobalNameserver = {
  id: number
  hostname: string
  short_name: string
  ip_address?: string | null
  node?: string | null
  node_hostname?: string | null
  role: string
  zone: string
  status: "active" | "review" | "inactive"
  sequence: number
  created_at: string
  updated_at: string
}

export type GlobalNameserverPayload = {
  hostname: string
  short_name?: string
  ip_address?: string | null
  node?: string | null
  role: string
  zone: string
  status: "active" | "review" | "inactive"
  sequence: number
}

export type CreateDomainPayload = {
  account: string
  domain: string
  domain_type: "alias" | "subdomain" | "addon"
  document_root: string
  public_ip?: string
}

export type AgentJob = {
  id: string
  node?: string
  node_hostname?: string
  job_type: string
  status: "queued" | "sent" | "running" | "success" | "failed" | "canceled" | "expired"
  payload?: Record<string, unknown>
  result: Record<string, unknown>
  error_code: string
  error_detail: string
  queued_at?: string
  sent_at?: string | null
  started_at?: string | null
  finished_at?: string | null
  updated_at?: string
}

export type FileManagerItem = {
  name: string
  path: string
  type: "file" | "dir"
  size: number
  mode: string
  modified: string
}

export type FileListResponse = {
  status: string
  job: string
  username?: string
  base?: string
  path?: string
  items?: FileManagerItem[]
  result?: {
    items?: FileManagerItem[]
    path?: string
  }
}

export type FileReadResponse = {
  status: string
  job: string
  path?: string
  content?: string
  size?: number
  mode?: string
  modified?: string
  result?: {
    content?: string
    path?: string
    size?: number
    mode?: string
    modified?: string
  }
}

export type FileCompressPayload = {
  paths: string[]
  archive_name: string
  format: "zip" | "tar.gz" | "tar"
  destination_path?: string
}

export type FileExtractPayload = {
  path: string
  destination_path?: string
  format?: "zip" | "tar.gz" | "tar"
}

export type FileTransferPayload = {
  path: string
  destination_path: string
  overwrite?: boolean
}

export type SftpInfo = {
  host: string
  port: number
  username: string
  root: string
  webroot: string
  protocol: string
  command: string
  ftps?: {
    host: string
    port: number
    protocol: string
    passive_ports: string
  }
  isolation: string
}

export type HostingFtpUser = {
  id: number
  account: string
  account_domain: string
  account_username: string
  node?: string
  node_hostname?: string
  username: string
  root: string
  absolute_root: string
  quota_mb: number
  protocol: string
  status: "pending" | "active" | "suspended" | "failed"
  created_at: string
  updated_at: string
}

export type HostingProtectedDirectory = {
  id: number
  domain: number
  domain_name: string
  account: string
  account_username: string
  path: string
  zone: string
  username: string
  enabled: boolean
  status: "pending" | "active" | "disabled" | "failed"
  last_job_status?: AgentJob["status"] | null
  last_error_code?: string | null
  last_error_detail?: string | null
  created_at: string
  updated_at: string
}

export type HostingWafConfiguration = {
  id: number
  domain: number
  domain_name: string
  account: string
  account_username: string
  mode: "disabled" | "monitor" | "block"
  owasp_crs: boolean
  wordpress_rules: boolean
  block_xmlrpc: boolean
  rate_limit_login: boolean
  status: "pending" | "active" | "failed"
  error: string
  created_at: string
  updated_at: string
}

export type HostingWafResponse = {
  domain: HostingDomain
  configuration: HostingWafConfiguration
  recent_events: Array<{ id: number; source: string; rule: string; action: string; date: string; method?: string; path?: string; status?: string; severity?: string }>
  job?: string | null
}

export type HostingIpBlock = {
  id: number
  domain: number
  domain_name: string
  account: string
  account_username: string
  target: string
  source: "admin" | "waf_firewall" | "modsecurity" | "antispam" | "agent"
  source_label: string
  reason: string
  expires_on: string | null
  enabled: boolean
  status: "pending" | "active" | "disabled" | "expired" | "failed"
  agent_hostname?: string | null
  last_job_status?: AgentJob["status"] | null
  created_at: string
  updated_at: string
}

export type HostingSecurityScan = {
  id: number
  account: string
  account_domain: string
  account_username: string
  node?: string | null
  node_hostname?: string | null
  path: string
  scan_type: "full" | "quick" | "manual"
  status: "queued" | "running" | "clean" | "threat" | "failed" | "canceled"
  progress: number
  files_scanned: number
  infected_files: number
  data_scanned: string
  report: {
    target?: string
    infected_files?: string[]
    duration_seconds?: number
    started_at?: string
    finished_at?: string
    remediation_log?: Array<Record<string, unknown>>
  }
  output: string
  error_code: string
  error_detail: string
  job_status?: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
}

export type CreateSecurityScanPayload = {
  account: string
  path: string
  scan_type: "full" | "quick" | "manual"
}

export type RemediateSecurityScanPayload = {
  action: "clean" | "quarantine" | "delete"
  targets?: string[]
}

export type CreateIpBlockPayload = {
  domain: number
  target: string
  source?: HostingIpBlock["source"]
  reason: string
  expires_on?: string | null
  enabled: boolean
}

export type CreateProtectedDirectoryPayload = {
  domain: number
  path: string
  zone: string
  username: string
  password: string
  enabled: boolean
}

export type HostingMailbox = {
  id: number
  account: string
  account_domain: string
  account_username: string
  node?: string
  node_hostname?: string
  email: string
  quota_mb: number
  used_mb: number
  usage_status: string
  description: string
  outgoing_limit: number
  antispam_enabled: boolean
  antispam_settings: Record<string, unknown>
  autoresponder_enabled: boolean
  autoresponder_subject: string
  autoresponder_format: "text" | "html"
  autoresponder_encoding: string
  autoresponder_message: string
  autoresponder_redirect: string
  autoresponder_unique_limit: number
  autoresponder_schedule: boolean
  manual_config: {
    username: string
    incoming_server: string
    outgoing_server: string
    smtp_ssl_port: number
    smtp_plain_port: number
    imap_ssl_port: number
    imap_plain_port: number
    pop3_ssl_port: number
    pop3_plain_port: number
    incoming_protocols: string[]
    outgoing_protocols: string[]
  }
  last_usage_at: string | null
  status: "pending" | "active" | "suspended" | "failed"
  created_at: string
  updated_at: string
}

export type CreateMailboxPayload = {
  account: string
  email: string
  password: string
  quota_mb: number
  description?: string
  outgoing_limit?: number
  antispam_enabled?: boolean
  antispam_settings?: Record<string, unknown>
  autoresponder_enabled?: boolean
  autoresponder_subject?: string
  autoresponder_format?: "text" | "html"
  autoresponder_encoding?: string
  autoresponder_message?: string
  autoresponder_redirect?: string
  autoresponder_unique_limit?: number
  autoresponder_schedule?: boolean
}

export type UpdateMailboxPayload = Partial<Omit<CreateMailboxPayload, "account" | "email">>

export type DbEngine = "mariadb" | "postgresql"
export type DbAccess = "read_only" | "read_write" | "admin"

export type HostingDatabase = {
  id: number
  account: string
  account_domain: string
  account_username: string
  node?: string
  node_hostname?: string
  engine: DbEngine
  name: string
  username: string
  size_mb: number
  size_status: string
  last_size_at: string | null
  status: "pending" | "active" | "failed"
  grants?: Array<{ id: number; user: number; username: string; access: DbAccess; privileges: string[] }>
  created_at: string
  updated_at: string
}

export type HostingDatabaseUser = {
  id: number
  account: string
  account_domain: string
  account_username: string
  engine: DbEngine
  username: string
  access: DbAccess
  hosts: string[]
  status: "pending" | "active" | "failed"
  used_by_count: number
  databases: Array<{ id: number; name: string; access: DbAccess }>
  created_at: string
  updated_at: string
}

export type CreateDatabasePayload = {
  account: string
  engine: DbEngine
  name: string
  user_mode: "existing" | "new"
  database_user?: number | null
  username?: string
  password?: string
  access: DbAccess
}

export type CreateDatabaseUserPayload = {
  account: string
  engine: DbEngine
  username: string
  password: string
  database?: number | null
  access: DbAccess
}

export type CreateFtpUserPayload = {
  account: string
  username: string
  password: string
  root: string
  quota_mb: number
}

export type UpdateFtpUserPayload = {
  password?: string
  root?: string
  quota_mb?: number
}

export type HostingApplication = {
  id: number
  name: string
  type: "wordpress" | "python" | "django" | "nodejs" | "laravel" | "moodle"
  account: string
  domain: number
  domain_name: string
  node?: string
  node_name?: string
  instance_id?: string
  port?: number
  status: "pending" | "installing" | "active" | "stopped" | "failed"
  version: string
  install_path: string
  url: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type AppCatalogItem = {
  slug: string
  name: string
  type: string
  runtime: HostingApplication["type"]
  detail: string
  status?: string
  requirements?: string[]
}

export type AppInstallSuggestion = {
  runtime: HostingApplication["type"]
  domain: number
  domain_name: string
  name: string
  instance_id: string
  port: number
  working_dir: string
  database: { database: string; user: string; password: string }
  php_versions: string[]
  node_versions: string[]
  wordpress: { site_title: string; admin_user: string; admin_password: string; admin_email: string; language: string; table_prefix: string }
  moodle: { site_title: string; site_shortname: string; admin_user: string; admin_password: string; admin_email: string; language: string; table_prefix: string; php_version: string; database_engine: "mariadb" | "postgresql" }
  django: { project_module: string; django_version: string; workers: number; database_engine: "mariadb" | "postgresql" }
  laravel: { php_version: string; database_engine: "mariadb" | "postgresql" }
  nodejs: { script: string; node_version: string; database_engine: "mariadb" | "postgresql"; create_database: boolean }
  python: { wsgi_module: string; workers: number; database_engine: "mariadb" | "postgresql"; create_database: boolean }
  security: { force_https: boolean; secure_permissions: boolean; disable_debug: boolean; auto_backup_after_install: boolean }
}

export type InstallCatalogAppPayload = Record<string, unknown>

export type HostingApplicationBackup = {
  id: number
  app: number
  app_name: string
  app_type: HostingApplication["type"]
  domain_name: string
  status: "pending" | "running" | "completed" | "failed"
  archive_path: string
  filename: string
  size_bytes: number
  error_code: string
  error_detail: string
  created_at: string
  updated_at: string
}

export type WordPressToolkitResult = {
  wp_version?: string
  plugins?: Array<Record<string, unknown>>
  themes?: Array<Record<string, unknown>>
  admin_users?: Array<Record<string, unknown>>
  plugin_updates?: number
  theme_updates?: number
  active_theme?: string
  search_indexing?: boolean
  maintenance_mode?: boolean
  debug_enabled?: boolean
  wp_cron_disabled?: boolean
  debug_log?: string[]
  integrity_ok?: boolean
  message?: string
}

export type PythonToolkitResult = {
  runtime?: "django" | "python" | string
  python_version?: string
  django_version?: string
  service_name?: string
  service_status?: string
  service_enabled?: string
  valkey_status?: string
  valkey_ping?: string
  valkey_ok?: boolean
  git_connected?: boolean
  git_branch?: string
  git_remote?: string
  git_dirty?: boolean
  deploy_check_ok?: boolean
  deploy_check_output?: string
  check_ok?: boolean
  check_output?: string
  migrations?: string[]
  logs?: string[]
  outputs?: string[]
  message?: string
  changed?: boolean
}

export type NodeToolkitResult = {
  runtime?: "nodejs" | string
  node_version?: string
  pnpm_version?: string
  corepack_version?: string
  package_manager?: string
  declared_package_manager?: string
  package_name?: string
  package_version?: string
  scripts?: string[]
  has_build_script?: boolean
  has_start_script?: boolean
  lockfile?: string
  node_modules?: boolean
  service_name?: string
  service_status?: string
  service_enabled?: string
  valkey_status?: string
  valkey_ping?: string
  valkey_ok?: boolean
  git_connected?: boolean
  git_branch?: string
  git_remote?: string
  git_dirty?: boolean
  audit_ok?: boolean
  audit_output?: string
  logs?: string[]
  outputs?: string[]
  message?: string
  changed?: boolean
}

export type LaravelToolkitResult = {
  runtime?: "laravel" | string
  php_version?: string
  composer_version?: string
  laravel_version?: string
  package_name?: string
  package_type?: string
  require_count?: number
  requires_laravel?: string
  app_env?: string
  app_debug?: boolean
  app_url?: string
  db_connection?: string
  cache_store?: string
  queue_connection?: string
  session_driver?: string
  vendor_installed?: boolean
  storage_linked?: boolean
  service_status?: string
  php_fpm_ok?: boolean
  php_fpm_check?: string
  valkey_status?: string
  valkey_ping?: string
  valkey_ok?: boolean
  git_connected?: boolean
  git_branch?: string
  git_remote?: string
  git_dirty?: boolean
  audit_ok?: boolean
  audit_output?: string
  about?: string[]
  migrations?: string[]
  laravel_log?: string[]
  logs?: string[]
  outputs?: string[]
  message?: string
  changed?: boolean
}

function normalizePage<T>(data: ListResponse<T>): Page<T> {
  return Array.isArray(data) ? { count: data.length, next: null, previous: null, results: data } : data
}

function promoteSelectedAccount(page: Page<HostingAccount>) {
  const selectedId = typeof window !== "undefined" ? window.sessionStorage.getItem("eh_admin_view_account") : null
  if (!selectedId) return page
  return {
    ...page,
    results: [...page.results].sort((left, right) => {
      if (left.id === selectedId) return -1
      if (right.id === selectedId) return 1
      return 0
    }),
  }
}

export const hostingApi = {
  plans: async () => normalizePage(await apiFetch<ListResponse<HostingPlan>>("/hosting/plans/")),

  createPlan: (payload: HostingPlanPayload) =>
    apiFetch<HostingPlan>("/hosting/plans/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  updatePlan: (id: number, payload: Partial<HostingPlanPayload>) =>
    apiFetch<HostingPlan>(`/hosting/plans/${id}/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  deletePlan: (id: number) =>
    apiFetch<void>(`/hosting/plans/${id}/`, {
      method: "DELETE",
    }),

  configuration: () => apiFetch<HostingConfiguration>("/hosting/configuration/"),

  billingIntegrationStatus: () => apiFetch<BillingIntegrationStatus>("/hosting/configuration/billing-integration/"),

  updateConfiguration: (payload: Partial<HostingConfiguration>) =>
    apiFetch<HostingConfiguration>("/hosting/configuration/default/", {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  notifyMaintenance: (payload: { bot_token?: string; chat_id?: string; task: Record<string, unknown> }) =>
    apiFetch<{ status: string; telegram: Record<string, unknown> }>("/hosting/configuration/maintenance-notify/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  apiKeys: async (params?: { search?: string; status?: ApiKeyCredentialStatus | "" }) => {
    const search = new URLSearchParams()
    if (params?.search) search.set("search", params.search)
    if (params?.status) search.set("status", params.status)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<ApiKeyCredential>>(`/hosting/api-keys/${suffix}`))
  },

  createApiKey: (payload: ApiKeyCredentialPayload) =>
    apiFetch<ApiKeyCredentialCreated>("/hosting/api-keys/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  updateApiKey: (id: number, payload: Partial<ApiKeyCredentialPayload>) =>
    apiFetch<ApiKeyCredential>(`/hosting/api-keys/${id}/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  rotateApiKey: (id: number) =>
    apiFetch<ApiKeyCredentialCreated>(`/hosting/api-keys/${id}/rotate/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  revokeApiKey: (id: number) =>
    apiFetch<ApiKeyCredential>(`/hosting/api-keys/${id}/revoke/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  pauseApiKey: (id: number) =>
    apiFetch<ApiKeyCredential>(`/hosting/api-keys/${id}/pause/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  activateApiKey: (id: number) =>
    apiFetch<ApiKeyCredential>(`/hosting/api-keys/${id}/activate/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  testApiKey: (id: number) =>
    apiFetch<ApiKeyCredential>(`/hosting/api-keys/${id}/test/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  accounts: async () => promoteSelectedAccount(normalizePage(await apiFetch<ListResponse<HostingAccount>>("/hosting/accounts/"))),

  provisionAccount: (payload: ProvisionHostingAccountPayload) =>
    apiFetch<HostingAccount>("/hosting/accounts/provision/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  dashboardSummary: () => apiFetch<HomeDashboardSummary>("/hosting/accounts/dashboard-summary/"),

  sitesOverview: () => apiFetch<SitesOverviewResponse>("/hosting/accounts/sites-overview/"),

  accountProfile: (id: string) => apiFetch<AccountProfileResponse>(`/hosting/accounts/${id}/profile/`),

  syncAccountStatus: (id: string) =>
    apiFetch<HostingAccount>(`/hosting/accounts/${id}/sync-status/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  retryFailedAccount: (id: string) =>
    apiFetch<{ retried: number; account: HostingAccount }>(`/hosting/accounts/${id}/retry-failed/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  suspendAccount: (id: string) =>
    apiFetch<HostingAccount>(`/hosting/accounts/${id}/suspend/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  unsuspendAccount: (id: string) =>
    apiFetch<HostingAccount>(`/hosting/accounts/${id}/unsuspend/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  resellers: async (params?: { search?: string; status?: string }) => {
    const search = new URLSearchParams()
    if (params?.search) search.set("search", params.search)
    if (params?.status) search.set("status", params.status)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<HostingReseller>>(`/hosting/resellers/${suffix}`))
  },

  resellerSelf: async () => {
    const page = normalizePage(await apiFetch<ListResponse<HostingReseller>>("/hosting/reseller-self/"))
    return page.results[0] ?? null
  },

  updateResellerSelf: (payload: Partial<Pick<HostingReseller, "brand_accent_color" | "brand_primary_color" | "company_name" | "panel_domain" | "support_email">>) =>
    apiFetch<HostingReseller>("/hosting/reseller-self/1/", {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  resellerTeam: async () => normalizePage(await apiFetch<ListResponse<ResellerTeamMember>>("/hosting/reseller-team/")),

  createResellerTeamMember: (payload: CreateResellerTeamMemberPayload) =>
    apiFetch<ResellerTeamMember>("/hosting/reseller-team/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  updateResellerTeamMember: (id: number, payload: Partial<Pick<ResellerTeamMember, "is_active" | "role" | "status">>) =>
    apiFetch<ResellerTeamMember>(`/hosting/reseller-team/${id}/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  resellerSecurity: () => apiFetch<ResellerSecurityResponse>("/hosting/reseller-security/"),

  updateResellerSecurity: (payload: { ip_allowlist: string[] }) =>
    apiFetch<{ ip_allowlist: string[] }>("/hosting/reseller-security/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  changeOwnPassword: (payload: { current_password: string; new_password: string }) =>
    apiFetch<{ ok: boolean }>("/hosting/reseller-security/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  closeOwnSession: (id: number) =>
    apiFetch<{ ok: boolean }>("/hosting/reseller-security/close-session/", {
      body: JSON.stringify({ id }),
      method: "POST",
    }),

  createReseller: (payload: CreateHostingResellerPayload) =>
    apiFetch<HostingReseller>("/hosting/resellers/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  suspendReseller: (id: number) =>
    apiFetch<HostingReseller>(`/hosting/resellers/${id}/suspend/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  unsuspendReseller: (id: number) =>
    apiFetch<HostingReseller>(`/hosting/resellers/${id}/unsuspend/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  migrationRuns: async (params?: { import_flow?: boolean; provider?: string; search?: string; status?: string }) => {
    const search = new URLSearchParams()
    if (params?.import_flow !== undefined) search.set("import_flow", params.import_flow ? "true" : "false")
    if (params?.search) search.set("search", params.search)
    if (params?.status) search.set("status", params.status)
    if (params?.provider) search.set("provider", params.provider)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<MigrationRun>>(`/hosting/migration-runs/${suffix}`))
  },

  createMigrationRun: (payload: CreateMigrationRunPayload) =>
    apiFetch<MigrationRun>("/hosting/migration-runs/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  createImportRun: (payload: CreateImportRunPayload) => {
    const data = new FormData()
    data.set("account_label", payload.account_label || "")
    data.set("backup_url", payload.backup_url || "")
    data.set("destination_node", payload.destination_node)
    data.set("import_source", payload.import_source)
    data.set("include_databases", String(payload.include_databases))
    data.set("include_files", String(payload.include_files))
    data.set("include_mail", String(payload.include_mail))
    data.set("include_subdomains", String(payload.include_subdomains))
    data.set("migration_type", payload.migration_type)
    data.set("notes", payload.notes || "")
    data.set("panel_type", payload.panel_type)
    data.set("preserve_mail_passwords", String(payload.preserve_mail_passwords))
    data.set("priority", payload.priority)
    if (payload.backup_file) data.set("backup_file", payload.backup_file)
    return apiFetch<MigrationRun>("/hosting/migration-runs/import-backup/", {
      body: data,
      method: "POST",
    })
  },

  accountExports: async (params?: { search?: string; status?: string }) => {
    const search = new URLSearchParams()
    if (params?.search) search.set("search", params.search)
    if (params?.status) search.set("status", params.status)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<HostingAccountExport>>(`/hosting/account-exports/${suffix}`))
  },

  createAccountExport: (payload: CreateHostingAccountExportPayload) =>
    apiFetch<HostingAccountExport>("/hosting/account-exports/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  downloadAccountExport: async (id: number) => {
    const headers = new Headers()
    const token = tokenStorage.getAccess()
    if (token) headers.set("Authorization", `Bearer ${token}`)
    const response = await fetch(`${BASE_URL}/api/hosting/account-exports/${id}/download/`, { headers })
    if (!response.ok) {
      let message = "No se pudo descargar la exportacion."
      try {
        const data = (await response.json()) as { detail?: string; node_path?: string }
        message = data.node_path ? `${data.detail || message} Ruta: ${data.node_path}` : data.detail || message
      } catch {
        message = await response.text()
      }
      throw new Error(message)
    }
    const disposition = response.headers.get("Content-Disposition") || ""
    const match = /filename="?([^";]+)"?/i.exec(disposition)
    return { blob: await response.blob(), filename: match?.[1] || `ehpanel-export-${id}.tar.gz` }
  },

  backupPolicies: async (params?: { search?: string; status?: string; type?: string }) => {
    const search = new URLSearchParams()
    if (params?.search) search.set("search", params.search)
    if (params?.status) search.set("status", params.status)
    if (params?.type) search.set("type", params.type)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<BackupPolicy>>(`/hosting/backup-policies/${suffix}`))
  },
  createBackupPolicy: (payload: BackupPolicyPayload) =>
    apiFetch<BackupPolicy>("/hosting/backup-policies/", { body: JSON.stringify(payload), method: "POST" }),
  updateBackupPolicy: (id: number, payload: Partial<BackupPolicyPayload>) =>
    apiFetch<BackupPolicy>(`/hosting/backup-policies/${id}/`, { body: JSON.stringify(payload), method: "PATCH" }),
  duplicateBackupPolicy: (id: number, name: string) =>
    apiFetch<BackupPolicy>(`/hosting/backup-policies/${id}/duplicate/`, { body: JSON.stringify({ name }), method: "POST" }),

  backupStorage: async (params?: { search?: string; status?: string; type?: string }) => {
    const search = new URLSearchParams()
    if (params?.search) search.set("search", params.search)
    if (params?.status) search.set("status", params.status)
    if (params?.type) search.set("type", params.type)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<BackupStorageDestination>>(`/hosting/backup-storage/${suffix}`))
  },
  createBackupStorage: (payload: BackupStorageDestinationPayload) =>
    apiFetch<BackupStorageDestination>("/hosting/backup-storage/", { body: JSON.stringify(payload), method: "POST" }),
  updateBackupStorage: (id: number, payload: Partial<BackupStorageDestinationPayload>) =>
    apiFetch<BackupStorageDestination>(`/hosting/backup-storage/${id}/`, { body: JSON.stringify(payload), method: "PATCH" }),
  testBackupStorage: (id: number) =>
    apiFetch<BackupStorageDestination>(`/hosting/backup-storage/${id}/test/`, { body: JSON.stringify({}), method: "POST" }),

  backupRestores: async (params?: { search?: string; status?: string; type?: string }) => {
    const search = new URLSearchParams()
    if (params?.search) search.set("search", params.search)
    if (params?.status) search.set("status", params.status)
    if (params?.type) search.set("type", params.type)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<BackupRestoreRun>>(`/hosting/backup-restores/${suffix}`))
  },
  createBackupRestore: (payload: BackupRestoreRunPayload) =>
    apiFetch<BackupRestoreRun>("/hosting/backup-restores/", { body: JSON.stringify(payload), method: "POST" }),
  retryBackupRestore: (id: number) =>
    apiFetch<BackupRestoreRun>(`/hosting/backup-restores/${id}/retry/`, { body: JSON.stringify({}), method: "POST" }),

  provisioningTemplates: async (params?: { search?: string; category?: string; is_active?: boolean }) => {
    const search = new URLSearchParams()
    if (params?.search) search.set("search", params.search)
    if (params?.category) search.set("category", params.category)
    if (typeof params?.is_active === "boolean") search.set("is_active", String(params.is_active))
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<ProvisioningTemplate>>(`/hosting/provisioning-templates/${suffix}`))
  },

  createProvisioningTemplate: (payload: ProvisioningTemplatePayload) =>
    apiFetch<ProvisioningTemplate>("/hosting/provisioning-templates/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  updateProvisioningTemplate: (id: number, payload: Partial<ProvisioningTemplatePayload>) =>
    apiFetch<ProvisioningTemplate>(`/hosting/provisioning-templates/${id}/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  deleteProvisioningTemplate: (id: number) =>
    apiFetch<void>(`/hosting/provisioning-templates/${id}/`, {
      method: "DELETE",
    }),

  duplicateProvisioningTemplate: (id: number, name: string) =>
    apiFetch<ProvisioningTemplate>(`/hosting/provisioning-templates/${id}/duplicate/`, {
      body: JSON.stringify({ name }),
      method: "POST",
    }),

  startMigrationRun: (id: number, payload: { concurrency?: number; selected_accounts?: string[] } = {}) =>
    apiFetch<{ queued: number; run: MigrationRun }>(`/hosting/migration-runs/${id}/start/`, {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  pauseMigrationRun: (id: number) =>
    apiFetch<MigrationRun>(`/hosting/migration-runs/${id}/pause/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  rediscoverMigrationRun: (id: number) =>
    apiFetch<{ job: string; run: MigrationRun }>(`/hosting/migration-runs/${id}/rediscover/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  advancedSummary: (id: string) => apiFetch<AdvancedSummaryResponse>(`/hosting/accounts/${id}/advanced-summary/`),

  advancedItems: async (params?: { account?: string; kind?: HostingAdvancedKind }) => {
    const search = new URLSearchParams()
    if (params?.account) search.set("account", params.account)
    if (params?.kind) search.set("kind", params.kind)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<HostingAdvancedItem>>(`/hosting/advanced-items/${suffix}`))
  },

  createAdvancedItem: (payload: Pick<HostingAdvancedItem, "account" | "kind" | "name" | "config" | "enabled">) =>
    apiFetch<HostingAdvancedItem>("/hosting/advanced-items/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  updateAdvancedItem: (id: number, payload: Partial<Pick<HostingAdvancedItem, "name" | "config" | "enabled">>) =>
    apiFetch<HostingAdvancedItem>(`/hosting/advanced-items/${id}/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  toggleAdvancedItem: (id: number) =>
    apiFetch<HostingAdvancedItem>(`/hosting/advanced-items/${id}/toggle/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  deleteAdvancedItem: (id: number) =>
    apiFetch<void>(`/hosting/advanced-items/${id}/`, {
      method: "DELETE",
    }),

  tickets: async (params?: { audience?: "clients" | "resellers"; search?: string; status?: string; account?: string }) => {
    const search = new URLSearchParams()
    if (params?.audience) search.set("audience", params.audience)
    if (params?.search) search.set("search", params.search)
    if (params?.status) search.set("status", params.status)
    if (params?.account) search.set("account", params.account)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<SupportTicket>>(`/hosting/tickets/${suffix}`))
  },

  createTicket: (payload: FormData) =>
    apiFetch<SupportTicket>("/hosting/tickets/", {
      body: payload,
      method: "POST",
    }),

  replyTicket: (id: number, payload: FormData) =>
    apiFetch<SupportTicket>(`/hosting/tickets/${id}/reply/`, {
      body: payload,
      method: "POST",
    }),

  closeTicket: (id: number) =>
    apiFetch<SupportTicket>(`/hosting/tickets/${id}/close/`, {
      body: new FormData(),
      method: "POST",
    }),

  setTicketStatus: (id: number, status: SupportTicket["status"]) =>
    apiFetch<SupportTicket>(`/hosting/tickets/${id}/set-status/`, {
      body: JSON.stringify({ status }),
      method: "POST",
    }),

  announcements: async (params?: { audience?: GlobalAnnouncement["audience"]; search?: string; status?: string; visible?: boolean }) => {
    const search = new URLSearchParams()
    if (params?.audience) search.set("audience", params.audience)
    if (params?.search) search.set("search", params.search)
    if (params?.status) search.set("status", params.status)
    if (params?.visible) search.set("visible", "1")
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<GlobalAnnouncement>>(`/hosting/announcements/${suffix}`))
  },

  createAnnouncement: (payload: GlobalAnnouncementPayload) =>
    apiFetch<GlobalAnnouncement>("/hosting/announcements/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  updateAnnouncement: (id: number, payload: Partial<GlobalAnnouncementPayload>) =>
    apiFetch<GlobalAnnouncement>(`/hosting/announcements/${id}/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  accountUsage: (id: string, refresh = false) =>
    apiFetch<AccountUsageResponse>(`/hosting/accounts/${id}/usage/${refresh ? "?refresh=1" : ""}`),

  accountMonitoring: (id: string, refresh = false) =>
    apiFetch<MonitoringResponse>(`/hosting/accounts/${id}/monitoring/${refresh ? "?refresh=1" : ""}`, {
      body: refresh ? JSON.stringify({}) : undefined,
      method: refresh ? "POST" : "GET",
    }),

  updateMonitorCheck: (id: number, payload: { enabled?: boolean; interval_seconds?: number; name?: string; target?: string }) =>
    apiFetch(`/hosting/monitor-checks/${id}/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  acknowledgeMonitorIncident: (id: number) =>
    apiFetch(`/hosting/monitor-incidents/${id}/acknowledge/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  resolveMonitorIncident: (id: number) =>
    apiFetch(`/hosting/monitor-incidents/${id}/resolve/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  testMonitorAlert: (id: number) =>
    apiFetch(`/hosting/monitor-alerts/${id}/test/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  updateAccount: (id: string, payload: Partial<Pick<HostingAccount, "web_engine" | "php_version">>) =>
    apiFetch<HostingAccount>(`/hosting/accounts/${id}/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  applyAccountSoftware: (id: string, payload: Partial<Pick<HostingAccount, "web_engine" | "php_version">>) =>
    apiFetch<HostingAccount>(`/hosting/accounts/${id}/apply-software/`, {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  accountSoftwareInfo: (id: string) =>
    apiFetch<{ job: string; status: AgentJob["status"]; result: SoftwareInfo }>(`/hosting/accounts/${id}/software-info/`),

  applySoftwareSettings: (id: string, payload: SoftwareSettingsPayload) =>
    apiFetch<{ job: string; status: AgentJob["status"]; result: Record<string, unknown> }>(`/hosting/accounts/${id}/software-settings/`, {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  restartOpenLiteSpeed: (id: string) =>
    apiFetch<{ job: string; status: AgentJob["status"]; result: Record<string, unknown> }>(`/hosting/accounts/${id}/openlitespeed/restart/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  softwarePerformanceAudits: (id: string) =>
    apiFetch<{ results: SoftwarePerformanceAudit[] }>(`/hosting/accounts/${id}/software-performance-audit/`),

  runSoftwarePerformanceAudit: (id: string, payload: SoftwarePerformanceAuditPayload) =>
    apiFetch<SoftwarePerformanceAudit>(`/hosting/accounts/${id}/software-performance-audit/`, {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  domains: async (params?: { account?: string; search?: string; status?: string }) => {
    const search = new URLSearchParams()
    if (params?.account) search.set("account", params.account)
    if (params?.search) search.set("search", params.search)
    if (params?.status) search.set("status", params.status)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<HostingDomain>>(`/hosting/domains/${suffix}`))
  },

  createDomain: (payload: CreateDomainPayload) =>
    apiFetch<HostingDomain>("/hosting/domains/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  deleteDomain: (id: number) =>
    apiFetch<void>(`/hosting/domains/${id}/`, {
      method: "DELETE",
    }),

  syncDomainDns: (id: number) =>
    apiFetch<HostingDomain>(`/hosting/domains/${id}/sync-dns/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  applyDnsTemplate: (id: number) =>
    apiFetch<{ status: string; job: string; domain: HostingDomain; preview: DnsTemplatePreviewRecord[] }>(`/hosting/domains/${id}/apply-dns-template/`, {
      body: JSON.stringify({ overwrite_records: [] }),
      method: "POST",
    }),

  dnsTemplatePreview: (id: number) =>
    apiFetch<{ domain: string; records: DnsTemplatePreviewRecord[] }>(`/hosting/domains/${id}/dns-template-preview/`),

  dnsRecords: async (params?: { domain?: number; search?: string; type?: string }) => {
    const search = new URLSearchParams()
    if (params?.domain) search.set("domain", String(params.domain))
    if (params?.search) search.set("search", params.search)
    if (params?.type) search.set("type", params.type)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<HostingDnsRecord>>(`/hosting/dns-records/${suffix}`))
  },

  createDnsRecord: (payload: CreateDnsRecordPayload) =>
    apiFetch<HostingDnsRecord>("/hosting/dns-records/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  updateDnsRecord: (id: number, payload: CreateDnsRecordPayload) =>
    apiFetch<HostingDnsRecord>(`/hosting/dns-records/${id}/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  deleteDnsRecord: (id: number) =>
    apiFetch<void>(`/hosting/dns-records/${id}/`, {
      method: "DELETE",
    }),

  dnsTemplateRecords: async (params?: { search?: string; type?: string; is_active?: boolean }) => {
    const search = new URLSearchParams()
    if (params?.search) search.set("search", params.search)
    if (params?.type) search.set("type", params.type)
    if (typeof params?.is_active === "boolean") search.set("is_active", String(params.is_active))
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<DnsTemplateRecord>>(`/hosting/dns-template-records/${suffix}`))
  },

  createDnsTemplateRecord: (payload: DnsTemplateRecordPayload) =>
    apiFetch<DnsTemplateRecord>("/hosting/dns-template-records/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  updateDnsTemplateRecord: (id: number, payload: DnsTemplateRecordPayload) =>
    apiFetch<DnsTemplateRecord>(`/hosting/dns-template-records/${id}/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  duplicateDnsTemplateRecord: (id: number) =>
    apiFetch<DnsTemplateRecord>(`/hosting/dns-template-records/${id}/duplicate/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  deleteDnsTemplateRecord: (id: number) =>
    apiFetch<void>(`/hosting/dns-template-records/${id}/`, {
      method: "DELETE",
    }),

  globalNameservers: async (params?: { search?: string; node?: string; status?: string; role?: string }) => {
    const search = new URLSearchParams()
    if (params?.search) search.set("search", params.search)
    if (params?.node) search.set("node", params.node)
    if (params?.status) search.set("status", params.status)
    if (params?.role) search.set("role", params.role)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<GlobalNameserver>>(`/hosting/global-nameservers/${suffix}`))
  },

  createGlobalNameserver: (payload: GlobalNameserverPayload) =>
    apiFetch<GlobalNameserver>("/hosting/global-nameservers/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  updateGlobalNameserver: (id: number, payload: GlobalNameserverPayload) =>
    apiFetch<GlobalNameserver>(`/hosting/global-nameservers/${id}/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  deleteGlobalNameserver: (id: number) =>
    apiFetch<void>(`/hosting/global-nameservers/${id}/`, {
      method: "DELETE",
    }),

  syncGlobalNameservers: () =>
    apiFetch<{ created: number; results: GlobalNameserver[] }>("/hosting/global-nameservers/sync-defaults/", {
      body: JSON.stringify({}),
      method: "POST",
    }),

  syncGlobalNameserverTemplate: (id: number) =>
    apiFetch<{ status: string }>(`/hosting/global-nameservers/${id}/sync-template/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  issueDomainSsl: (
    id: number,
    payload: { email?: string; force_renewal?: boolean; include_www?: boolean; staging?: boolean } = {},
  ) =>
    apiFetch<HostingDomain>(`/hosting/domains/${id}/issue-ssl/`, {
      body: JSON.stringify({
        email: payload.email ?? "",
        force_renewal: payload.force_renewal ?? false,
        include_www: payload.include_www ?? true,
        staging: payload.staging ?? false,
      }),
      method: "POST",
    }),

  activateDomainWebmail: (
    id: number,
    payload: { email?: string; force_renewal?: boolean; issue_ssl?: boolean; staging?: boolean; sync_dns?: boolean } = {},
  ) =>
    apiFetch<{ status: string; webmail_url: string; jobs: Record<string, string>; domain: HostingDomain }>(`/hosting/domains/${id}/activate-webmail/`, {
      body: JSON.stringify({
        email: payload.email ?? "",
        force_renewal: payload.force_renewal ?? false,
        issue_ssl: payload.issue_ssl ?? true,
        staging: payload.staging ?? false,
        sync_dns: payload.sync_dns ?? true,
      }),
      method: "POST",
    }),

  downloadDomainSsl: (id: number) =>
    apiFetch<{ content: string; filename: string }>(`/hosting/domains/${id}/download-ssl/`),

  deleteDomainSsl: (id: number) =>
    apiFetch<HostingDomain>(`/hosting/domains/${id}/delete-ssl/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  webProtection: (id: number) =>
    apiFetch<WebProtectionResponse>(`/hosting/domains/${id}/web-protection/`),

  updateWebProtection: (id: number, payload: WebProtectionSettings) =>
    apiFetch<WebProtectionResponse>(`/hosting/domains/${id}/web-protection/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  waf: (id: number) => apiFetch<HostingWafResponse>(`/hosting/domains/${id}/waf/`),

  updateWaf: (id: number, payload: Partial<Pick<HostingWafConfiguration, "block_xmlrpc" | "mode" | "owasp_crs" | "rate_limit_login" | "wordpress_rules">>) =>
    apiFetch<HostingWafResponse>(`/hosting/domains/${id}/waf/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  fileList: (accountId: string, path = "/") =>
    apiFetch<FileListResponse>(`/hosting/accounts/${accountId}/files/?path=${encodeURIComponent(path)}`),

  fileRead: (accountId: string, path: string) =>
    apiFetch<FileReadResponse>(`/hosting/accounts/${accountId}/files/read/?path=${encodeURIComponent(path)}`),

  fileWrite: (accountId: string, path: string, content: string) =>
    apiFetch<FileReadResponse>(`/hosting/accounts/${accountId}/files/write/`, {
      body: JSON.stringify({ content, path }),
      method: "POST",
    }),

  fileUpload: (accountId: string, path: string, file: File, overwrite = true) => {
    const data = new FormData()
    data.set("file", file)
    data.set("path", path)
    data.set("overwrite", String(overwrite))
    return apiFetch<FileListResponse>(`/hosting/accounts/${accountId}/files/upload/`, {
      body: data,
      method: "POST",
    })
  },

  fileImportUrl: (accountId: string, url: string, path: string, overwrite = true) =>
    apiFetch<FileListResponse>(`/hosting/accounts/${accountId}/files/import-url/`, {
      body: JSON.stringify({ overwrite, path, url }),
      method: "POST",
    }),

  fileDelete: (accountId: string, path: string, recursive = false) =>
    apiFetch<FileListResponse>(`/hosting/accounts/${accountId}/files/delete/`, {
      body: JSON.stringify({ path, recursive }),
      method: "POST",
    }),

  fileCopy: (accountId: string, payload: FileTransferPayload) =>
    apiFetch<FileListResponse>(`/hosting/accounts/${accountId}/files/copy/`, {
      body: JSON.stringify({ overwrite: true, ...payload }),
      method: "POST",
    }),

  fileMove: (accountId: string, payload: FileTransferPayload) =>
    apiFetch<FileListResponse>(`/hosting/accounts/${accountId}/files/move/`, {
      body: JSON.stringify({ overwrite: true, ...payload }),
      method: "POST",
    }),

  fileRename: (accountId: string, path: string, name: string, overwrite = false) =>
    apiFetch<FileListResponse>(`/hosting/accounts/${accountId}/files/rename/`, {
      body: JSON.stringify({ name, overwrite, path }),
      method: "POST",
    }),

  fileDownload: async (accountId: string, path: string) => {
    const token = tokenStorage.getAccess()
    const response = await fetch(`${BASE_URL}/api/hosting/accounts/${accountId}/files/download/?path=${encodeURIComponent(path)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!response.ok) {
      const detail = await response.text()
      throw new Error(detail || `Error HTTP ${response.status}`)
    }
    return response.blob()
  },

  fileMkdir: (accountId: string, path: string) =>
    apiFetch<FileListResponse>(`/hosting/accounts/${accountId}/files/mkdir/`, {
      body: JSON.stringify({ path }),
      method: "POST",
    }),

  fileChmod: (accountId: string, path: string, mode: string) =>
    apiFetch<FileListResponse>(`/hosting/accounts/${accountId}/files/chmod/`, {
      body: JSON.stringify({ mode, path }),
      method: "POST",
    }),

  fileCompress: (accountId: string, payload: FileCompressPayload) =>
    apiFetch<FileListResponse>(`/hosting/accounts/${accountId}/files/compress/`, {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  fileExtract: (accountId: string, payload: FileExtractPayload) =>
    apiFetch<FileListResponse>(`/hosting/accounts/${accountId}/files/extract/`, {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  sftpInfo: (accountId: string) => apiFetch<SftpInfo>(`/hosting/accounts/${accountId}/sftp-info/`),

  changeSftpPassword: (accountId: string, password: string) =>
    apiFetch<{ status: string; job: string }>(`/hosting/accounts/${accountId}/sftp-password/`, {
      body: JSON.stringify({ password }),
      method: "POST",
    }),

  ftpUsers: async () => normalizePage(await apiFetch<ListResponse<HostingFtpUser>>("/hosting/ftp-users/")),

  protectedDirectories: async (params?: { account?: string; domain?: number }) => {
    const search = new URLSearchParams()
    if (params?.account) search.set("account", params.account)
    if (params?.domain) search.set("domain", String(params.domain))
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<HostingProtectedDirectory>>(`/hosting/protected-directories/${suffix}`))
  },

  createProtectedDirectory: (payload: CreateProtectedDirectoryPayload) =>
    apiFetch<HostingProtectedDirectory>("/hosting/protected-directories/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  updateProtectedDirectory: (id: number, payload: Partial<CreateProtectedDirectoryPayload>) =>
    apiFetch<HostingProtectedDirectory>(`/hosting/protected-directories/${id}/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  toggleProtectedDirectory: (id: number) =>
    apiFetch<HostingProtectedDirectory>(`/hosting/protected-directories/${id}/toggle/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  changeProtectedDirectoryPassword: (id: number, password: string) =>
    apiFetch<HostingProtectedDirectory>(`/hosting/protected-directories/${id}/password/`, {
      body: JSON.stringify({ password }),
      method: "POST",
    }),

  deleteProtectedDirectory: (id: number) =>
    apiFetch<void>(`/hosting/protected-directories/${id}/`, {
      method: "DELETE",
    }),

  ipBlocks: async (params?: { account?: string; domain?: number }) => {
    const search = new URLSearchParams()
    if (params?.account) search.set("account", params.account)
    if (params?.domain) search.set("domain", String(params.domain))
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<HostingIpBlock>>(`/hosting/ip-blocks/${suffix}`))
  },

  createIpBlock: (payload: CreateIpBlockPayload) =>
    apiFetch<HostingIpBlock>("/hosting/ip-blocks/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  updateIpBlock: (id: number, payload: Partial<CreateIpBlockPayload>) =>
    apiFetch<HostingIpBlock>(`/hosting/ip-blocks/${id}/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  deleteIpBlock: (id: number) =>
    apiFetch<void>(`/hosting/ip-blocks/${id}/`, {
      method: "DELETE",
    }),

  securityScans: async (params?: { account?: string; status?: string }) => {
    const search = new URLSearchParams()
    if (params?.account) search.set("account", params.account)
    if (params?.status) search.set("status", params.status)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<HostingSecurityScan>>(`/hosting/security-scans/${suffix}`))
  },

  createSecurityScan: (payload: CreateSecurityScanPayload) =>
    apiFetch<HostingSecurityScan>("/hosting/security-scans/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  retrySecurityScan: (id: number) =>
    apiFetch<HostingSecurityScan>(`/hosting/security-scans/${id}/retry/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  remediateSecurityScan: (id: number, payload: RemediateSecurityScanPayload) =>
    apiFetch<HostingSecurityScan>(`/hosting/security-scans/${id}/remediate/`, {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  mailboxes: async (params?: { account?: string; search?: string; status?: string }) => {
    const search = new URLSearchParams()
    if (params?.account) search.set("account", params.account)
    if (params?.search) search.set("search", params.search)
    if (params?.status) search.set("status", params.status)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<HostingMailbox>>(`/hosting/mailboxes/${suffix}`))
  },

  syncMailboxes: (accountId: string) =>
    apiFetch<{ status: string; job: string; results: HostingMailbox[] }>("/hosting/mailboxes/sync/", {
      body: JSON.stringify({ account: accountId }),
      method: "POST",
    }),

  createMailbox: (payload: CreateMailboxPayload) =>
    apiFetch<HostingMailbox>("/hosting/mailboxes/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  updateMailbox: (id: number, payload: UpdateMailboxPayload) =>
    apiFetch<HostingMailbox>(`/hosting/mailboxes/${id}/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  deleteMailbox: (id: number) =>
    apiFetch<HostingMailbox>(`/hosting/mailboxes/${id}/`, {
      method: "DELETE",
    }),

  suspendMailbox: (id: number) =>
    apiFetch<HostingMailbox>(`/hosting/mailboxes/${id}/suspend/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  unsuspendMailbox: (id: number) =>
    apiFetch<HostingMailbox>(`/hosting/mailboxes/${id}/unsuspend/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  webmailUrl: (id: number) => apiFetch<{ url: string }>(`/hosting/mailboxes/${id}/webmail-url/`, { body: JSON.stringify({}), method: "POST" }),

  mailboxMobileconfigUrl: (email: string) => `/mail/mobileconfig/?email=${encodeURIComponent(email)}`,

  databases: async (params?: { account?: string; search?: string; engine?: string; status?: string }) => {
    const search = new URLSearchParams()
    if (params?.account) search.set("account", params.account)
    if (params?.search) search.set("search", params.search)
    if (params?.engine) search.set("engine", params.engine)
    if (params?.status) search.set("status", params.status)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<HostingDatabase>>(`/hosting/databases/${suffix}`))
  },

  createDatabase: (payload: CreateDatabasePayload) =>
    apiFetch<HostingDatabase>("/hosting/databases/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  databaseManagerUrl: (id: number) => apiFetch<{ manager: string; url: string }>(`/hosting/databases/${id}/manager-url/`),

  cloneDatabase: (id: number, name: string) =>
    apiFetch<HostingDatabase>(`/hosting/databases/${id}/clone/`, {
      body: JSON.stringify({ name }),
      method: "POST",
    }),

  checkRepairDatabase: (id: number) =>
    apiFetch<{ status: string; job: string }>(`/hosting/databases/${id}/check-repair/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  refreshDatabaseSize: (id: number) =>
    apiFetch<HostingDatabase>(`/hosting/databases/${id}/refresh-size/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  deleteDatabase: (id: number) =>
    apiFetch<HostingDatabase>(`/hosting/databases/${id}/`, {
      method: "DELETE",
    }),

  exportDatabase: (id: number) =>
    apiFetch<{ status: string; job: string }>(`/hosting/databases/${id}/export/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),

  importDatabase: (id: number, path: string) =>
    apiFetch<{ status: string; job: string }>(`/hosting/databases/${id}/import/`, {
      body: JSON.stringify({ path }),
      method: "POST",
    }),

  databaseUsers: async (params?: { account?: string; search?: string; engine?: string }) => {
    const search = new URLSearchParams()
    if (params?.account) search.set("account", params.account)
    if (params?.search) search.set("search", params.search)
    if (params?.engine) search.set("engine", params.engine)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<HostingDatabaseUser>>(`/hosting/database-users/${suffix}`))
  },

  createDatabaseUser: (payload: CreateDatabaseUserPayload) =>
    apiFetch<HostingDatabaseUser>("/hosting/database-users/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  updateDatabaseUser: (id: number, payload: { password?: string; access?: DbAccess }) =>
    apiFetch<HostingDatabaseUser>(`/hosting/database-users/${id}/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  deleteDatabaseUser: (id: number, force = false) =>
    apiFetch<HostingDatabaseUser>(`/hosting/database-users/${id}/${force ? "?force=true" : ""}`, {
      method: "DELETE",
    }),

  createFtpUser: (payload: CreateFtpUserPayload) =>
    apiFetch<HostingFtpUser>("/hosting/ftp-users/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  updateFtpUser: (id: number, payload: UpdateFtpUserPayload) =>
    apiFetch<HostingFtpUser>(`/hosting/ftp-users/${id}/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),

  deleteFtpUser: (id: number) =>
    apiFetch<HostingFtpUser>(`/hosting/ftp-users/${id}/`, {
      method: "DELETE",
    }),

  suspendFtpUser: (id: number) =>
    apiFetch<HostingFtpUser>(`/hosting/ftp-users/${id}/suspend/`, {
      method: "POST",
    }),

  unsuspendFtpUser: (id: number) =>
    apiFetch<HostingFtpUser>(`/hosting/ftp-users/${id}/unsuspend/`, {
      method: "POST",
    }),

  applications: async () => normalizePage(await apiFetch<ListResponse<HostingApplication>>("/hosting/apps/")),

  appCatalog: () => apiFetch<{ apps: AppCatalogItem[] }>("/hosting/apps/catalog/"),

  appInstallSuggestions: (payload: { domain: number; runtime: HostingApplication["type"]; name?: string }) =>
    apiFetch<AppInstallSuggestion>("/hosting/apps/install-suggestions/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  installCatalogApp: (payload: InstallCatalogAppPayload) =>
    apiFetch<HostingApplication>("/hosting/apps/install/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  detectApplications: (account?: string) =>
    apiFetch<{ results: HostingApplication[] }>("/hosting/apps/detect/", {
      body: JSON.stringify(account ? { account } : {}),
      method: "POST",
    }),

  startApplication: (id: number) =>
    apiFetch<HostingApplication>(`/hosting/apps/${id}/start/`, { body: JSON.stringify({}), method: "POST" }),

  stopApplication: (id: number) =>
    apiFetch<HostingApplication>(`/hosting/apps/${id}/stop/`, { body: JSON.stringify({}), method: "POST" }),

  restartApplication: (id: number) =>
    apiFetch<HostingApplication>(`/hosting/apps/${id}/restart/`, { body: JSON.stringify({}), method: "POST" }),

  updateApplication: (id: number) =>
    apiFetch<HostingApplication>(`/hosting/apps/${id}/update/`, { body: JSON.stringify({}), method: "POST" }),

  deleteApplication: (id: number) =>
    apiFetch<HostingApplication>(`/hosting/apps/${id}/`, { method: "DELETE" }),

  checkApplicationUpdates: (id: number) =>
    apiFetch<HostingApplication>(`/hosting/apps/${id}/check-updates/`, { body: JSON.stringify({}), method: "POST" }),

  backupApplication: (id: number) =>
    apiFetch<HostingApplicationBackup>(`/hosting/apps/${id}/backup/`, { body: JSON.stringify({}), method: "POST" }),

  wordpressToolkit: (id: number) =>
    apiFetch<{ job: string; status: string; result: WordPressToolkitResult }>(`/hosting/apps/${id}/wordpress-toolkit/`),

  wordpressToolkitAction: (id: number, payload: { action: string; target?: string; target_type?: string; value?: string }) =>
    apiFetch<{ job: string; status: string; result: WordPressToolkitResult }>(`/hosting/apps/${id}/wordpress-toolkit/`, {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  wordpressAutologin: (id: number, payload: { user?: string } = {}) =>
    apiFetch<{ expires_at: string; job: string; login_url: string; login_user: string; status: string }>(`/hosting/apps/${id}/wordpress-autologin/`, {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  pythonTool: (id: number) =>
    apiFetch<{ job: string; status: string; result: PythonToolkitResult }>(`/hosting/apps/${id}/python-tool/`),

  pythonToolAction: (id: number, payload: { action: string; repo_url?: string; branch?: string }) =>
    apiFetch<{ job: string; status: string; result: PythonToolkitResult }>(`/hosting/apps/${id}/python-tool/`, {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  nodeTool: (id: number) =>
    apiFetch<{ job: string; status: string; result: NodeToolkitResult }>(`/hosting/apps/${id}/node-tool/`),

  nodeToolAction: (id: number, payload: { action: string; repo_url?: string; branch?: string }) =>
    apiFetch<{ job: string; status: string; result: NodeToolkitResult }>(`/hosting/apps/${id}/node-tool/`, {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  laravelTool: (id: number) =>
    apiFetch<{ job: string; status: string; result: LaravelToolkitResult }>(`/hosting/apps/${id}/laravel-tool/`),

  laravelToolAction: (id: number, payload: { action: string; repo_url?: string; branch?: string }) =>
    apiFetch<{ job: string; status: string; result: LaravelToolkitResult }>(`/hosting/apps/${id}/laravel-tool/`, {
      body: JSON.stringify(payload),
      method: "POST",
    }),

  applicationBackups: () => apiFetch<HostingApplicationBackup[]>("/hosting/apps/backups/"),

  job: (id: string) => apiFetch<AgentJob>(`/agents/jobs/${id}/`),
}
