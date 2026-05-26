import { apiFetch, tokenStorage } from "@/api/client"

export type UserRole = "admin" | "reseller" | "client"

export type CurrentUser = {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: UserRole | "technician"
  is_staff: boolean
  is_active: boolean
}

type TokenResponse = {
  access: string
  refresh: string
  user: CurrentUser
}

export const authApi = {
  async login(username: string, password: string) {
    const data = await apiFetch<TokenResponse>("/auth/token/", {
      auth: false,
      body: JSON.stringify({ password, username }),
      method: "POST",
      retry: false,
    })
    tokenStorage.setTokens(data.access, data.refresh)
    return data.user
  },

  me: () => apiFetch<CurrentUser>("/auth/me/"),

  async impersonate(userId: number) {
    const currentAccess = tokenStorage.getAccess()
    const currentRefresh = tokenStorage.getRefresh()
    const data = await apiFetch<TokenResponse>(`/users/${userId}/impersonate/`, {
      body: JSON.stringify({}),
      method: "POST",
    })
    if (currentAccess && currentRefresh) {
      sessionStorage.setItem("eh_admin_original_access", currentAccess)
      sessionStorage.setItem("eh_admin_original_refresh", currentRefresh)
    }
    tokenStorage.setTokens(data.access, data.refresh)
    sessionStorage.setItem("eh_admin_impersonating", "1")
    return data.user
  },

  restoreAdminSession() {
    const access = sessionStorage.getItem("eh_admin_original_access")
    const refresh = sessionStorage.getItem("eh_admin_original_refresh")
    sessionStorage.removeItem("eh_admin_original_access")
    sessionStorage.removeItem("eh_admin_original_refresh")
    sessionStorage.removeItem("eh_admin_impersonating")
    sessionStorage.removeItem("eh_admin_view_reseller")
    if (access && refresh) {
      tokenStorage.setTokens(access, refresh)
    }
  },

  logout: () => tokenStorage.clear(),
}

export function normalizeRole(user: CurrentUser): UserRole {
  if (user.role === "admin" || user.is_staff) return "admin"
  if (user.role === "reseller") return "reseller"
  return "client"
}
