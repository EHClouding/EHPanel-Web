import { apiFetch } from "@/api/client"

type Page<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

type ListResponse<T> = T[] | Page<T>

function normalizePage<T>(data: ListResponse<T>): Page<T> {
  return Array.isArray(data) ? { count: data.length, next: null, previous: null, results: data } : data
}

export type AdminNode = {
  id: string
  hostname: string
  agent_type: string
  state: string
  effective_state: string
  is_stale: boolean
  agent_version: string
  os_name: string
  arch: string
  last_seen_at: string | null
  last_seen_age_seconds: number | null
  public_ip: string
  capabilities: Record<string, unknown>
  last_telemetry: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type AdminAgentJob = {
  id: string
  node: string
  node_hostname: string
  job_type: string
  status: "queued" | "sent" | "running" | "success" | "failed" | "canceled" | "expired"
  payload: Record<string, unknown>
  result: Record<string, unknown>
  error_code: string
  error_detail: string
  correlation_id: string
  queued_at: string
  sent_at: string | null
  started_at: string | null
  finished_at: string | null
  updated_at: string
}

export type AdminAgentEvent = {
  id: number
  node: string | null
  node_hostname: string
  msg_type: string
  msg_id: string
  payload: Record<string, unknown>
  created_at: string
}

export type AdminMailQueueItem = {
  id: string
  node: string
  node_hostname: string
  queue_id: string
  direction: string
  from: string
  to: string
  account: string
  code: string
  status: string
  explanation: string
  time: string
  raw: Record<string, unknown>
}

export type AdminEnrollmentToken = {
  id: number
  hostname: string
  agent_type: string
  token: string
  expires_at: string
  used_at: string | null
  node: string | null
  created_at: string
}

export type AdminAuditLog = {
  id: number
  user: number | null
  user_username: string
  action: string
  method: string
  path: string
  status_code: number
  ip: string | null
  account: string | null
  account_domain: string | null
  target_type: string
  target_id: string
  target_label: string
  metadata: Record<string, unknown>
  created_at: string
}

export type AdminUser = {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: "admin" | "moderator" | "technician" | "reseller" | "client"
  is_staff: boolean
  is_active: boolean
  date_joined: string
  company: string | null
  phone: string | null
}

export type AdminUserPayload = {
  username?: string
  email?: string
  first_name?: string
  last_name?: string
  role?: AdminUser["role"]
  password?: string
  is_active?: boolean
}

export type AdminRole = {
  id: number
  name: string
  description: string
  users_count: number
  permission_ids: number[]
  permissions_detail: Array<{ id: number; codename: string; name: string }>
  status: string
}

export type AdminPermission = {
  id: number
  name: string
  codename: string
  app: string
  model: string
  groups_enabled: string[]
}

export type AdminAccessSession = {
  id: number
  user: number
  username: string
  email: string
  ip_address: string | null
  location: string
  device: string
  role: string
  status: "active" | "closed" | "expired"
  status_label: string
  last_seen_at: string | null
  closed_at: string | null
  created_at: string
}

export type AdminAccessSecurity = {
  require_2fa_staff: boolean
  admin_ip_allowlist: string[]
  failed_login_limit: number
  failed_login_window_minutes: number
  session_timeout_hours: number
  alert_new_device: boolean
  critical_actions_owner_only: boolean
}

export const adminApi = {
  nodes: async () => normalizePage(await apiFetch<ListResponse<AdminNode>>("/agents/nodes/")),
  nodeEvents: async (node?: string) => {
    const suffix = node ? `?node=${encodeURIComponent(node)}` : ""
    return normalizePage(await apiFetch<ListResponse<AdminAgentEvent>>(`/agents/events/${suffix}`))
  },
  jobs: async (params?: { node?: string; status?: string; job_type?: string }) => {
    const search = new URLSearchParams()
    if (params?.node) search.set("node", params.node)
    if (params?.status) search.set("status", params.status)
    if (params?.job_type) search.set("job_type", params.job_type)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<AdminAgentJob>>(`/agents/jobs/${suffix}`))
  },
  dispatchJob: (id: string) =>
    apiFetch<{ status: AdminAgentJob["status"]; job: string }>(`/agents/jobs/${id}/dispatch/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),
  enrollmentTokens: async () => normalizePage(await apiFetch<ListResponse<AdminEnrollmentToken>>("/agents/enrollment-tokens/")),
  auditLogs: async (params?: { action?: string; search?: string }) => {
    const search = new URLSearchParams()
    if (params?.action) search.set("action", params.action)
    if (params?.search) search.set("search", params.search)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<AdminAuditLog>>(`/audit/${suffix}`))
  },
  users: async (params?: { role?: string; search?: string }) => {
    const search = new URLSearchParams()
    if (params?.role) search.set("role", params.role)
    if (params?.search) search.set("search", params.search)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<AdminUser>>(`/users/${suffix}`))
  },
  createUser: (payload: AdminUserPayload) =>
    apiFetch<AdminUser>("/users/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),
  updateUser: (id: number, payload: AdminUserPayload) =>
    apiFetch<AdminUser>(`/users/${id}/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),
  roles: async (params?: { search?: string }) => {
    const suffix = params?.search ? `?search=${encodeURIComponent(params.search)}` : ""
    return normalizePage(await apiFetch<ListResponse<AdminRole>>(`/roles/${suffix}`))
  },
  createRole: (payload: { name: string; permission_ids?: number[] }) =>
    apiFetch<AdminRole>("/roles/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),
  updateRole: (id: number, payload: { name?: string; permission_ids?: number[] }) =>
    apiFetch<AdminRole>(`/roles/${id}/`, {
      body: JSON.stringify(payload),
      method: "PATCH",
    }),
  duplicateRole: (id: number, name: string) =>
    apiFetch<AdminRole>(`/roles/${id}/duplicate/`, {
      body: JSON.stringify({ name }),
      method: "POST",
    }),
  permissions: async (params?: { search?: string }) => {
    const suffix = params?.search ? `?search=${encodeURIComponent(params.search)}` : ""
    return normalizePage(await apiFetch<ListResponse<AdminPermission>>(`/permissions/${suffix}`))
  },
  accessSessions: async (params?: { search?: string; status?: string }) => {
    const search = new URLSearchParams()
    if (params?.search) search.set("search", params.search)
    if (params?.status) search.set("status", params.status)
    const suffix = search.toString() ? `?${search.toString()}` : ""
    return normalizePage(await apiFetch<ListResponse<AdminAccessSession>>(`/access-sessions/${suffix}`))
  },
  closeAccessSession: (id: number) =>
    apiFetch<AdminAccessSession>(`/access-sessions/${id}/close/`, {
      body: JSON.stringify({}),
      method: "POST",
    }),
  accessSecurity: () => apiFetch<AdminAccessSecurity>("/access-security/"),
  saveAccessSecurity: (payload: AdminAccessSecurity) =>
    apiFetch<AdminAccessSecurity>("/access-security/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),
  createEnrollmentToken: (payload: { agent_type: string; expires_at: string; hostname: string }) =>
    apiFetch<AdminEnrollmentToken>("/agents/enrollment-tokens/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),
  serviceAction: (nodeId: string, payload: { action: string; service: string } & Record<string, unknown>) =>
    apiFetch<AdminAgentJob>(`/agents/nodes/${nodeId}/service-action/`, {
      body: JSON.stringify(payload),
      method: "POST",
    }),
  mailQueue: async () => normalizePage(await apiFetch<ListResponse<AdminMailQueueItem>>("/agents/mail-queue/")),
  refreshMailQueue: (node?: string) =>
    apiFetch<{ queued: number; jobs: string[] }>("/agents/mail-queue/refresh/", {
      body: JSON.stringify({ node }),
      method: "POST",
    }),
  retryMailQueue: (payload: { node: string; queue_id: string }) =>
    apiFetch<{ status: AdminAgentJob["status"]; job: string }>("/agents/mail-queue/retry/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),
  releaseMailQueue: (payload: { node: string; queue_id: string }) =>
    apiFetch<{ status: AdminAgentJob["status"]; job: string }>("/agents/mail-queue/release/", {
      body: JSON.stringify(payload),
      method: "POST",
    }),
}
