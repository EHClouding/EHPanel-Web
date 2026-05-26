import { useCallback, useEffect, useState } from "react"

import { authApi, normalizeRole, type UserRole } from "@/api/auth"
import { SESSION_EXPIRED_EVENT } from "@/api/client"
import { AdminLayout } from "@/components/shell/AdminLayout"
import { ClientLayout } from "@/components/shell/ClientLayout"
import { ResellerLayout } from "@/components/shell/ResellerLayout"
import { LoginPage } from "@/pages/LoginPage"

export default function App() {
  const [activeRole, setActiveRole] = useState<UserRole>("client")
  const [authState, setAuthState] = useState<"checking" | "guest" | "ready">("checking")

  useEffect(() => {
    authApi
      .me()
      .then((user) => {
        const role = normalizeRole(user)
        setActiveRole(
          role === "admin" && sessionStorage.getItem("eh_admin_view_account")
            ? "client"
            : role === "admin" && sessionStorage.getItem("eh_admin_view_reseller")
              ? "reseller"
              : role,
        )
        setAuthState("ready")
      })
      .catch(() => setAuthState("guest"))
  }, [])

  const logout = useCallback(() => {
    authApi.logout()
    sessionStorage.removeItem("eh_admin_view_account")
    sessionStorage.removeItem("eh_admin_view_reseller")
    sessionStorage.removeItem("eh_admin_original_access")
    sessionStorage.removeItem("eh_admin_original_refresh")
    sessionStorage.removeItem("eh_admin_impersonating")
    setAuthState("guest")
  }, [])

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, logout)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, logout)
  }, [logout])

  if (authState === "checking") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#08111f] text-white">
        <div className="rounded-lg border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold">
          Cargando EHPanel Web...
        </div>
      </main>
    )
  }

  if (authState === "guest") {
    return (
      <LoginPage
        onLogin={async ({ password, username }) => {
          const user = await authApi.login(username, password)
          setActiveRole(normalizeRole(user))
          setAuthState("ready")
        }}
      />
    )
  }

  if (activeRole === "reseller") {
    return <ResellerLayout onLogout={logout} />
  }

  if (activeRole === "admin") {
    return <AdminLayout onLogout={logout} />
  }

  return <ClientLayout onLogout={logout} />
}
