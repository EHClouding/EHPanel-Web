import { Activity, CalendarDays, Database, Globe2, HardDrive, LifeBuoy, Mail, RefreshCcw, Server, ShieldCheck, UserRound } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { hostingApi, type AccountProfileResponse, type HostingAccount } from "@/api/hosting"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ProfilePage() {
  const [accounts, setAccounts] = useState<HostingAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState("")
  const [profile, setProfile] = useState<AccountProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) || accounts[0],
    [accounts, selectedAccountId],
  )

  async function loadAccounts() {
    setLoading(true)
    setError("")
    try {
      const page = await hostingApi.accounts()
      setAccounts(page.results)
      const accountId = selectedAccountId || page.results[0]?.id || ""
      setSelectedAccountId(accountId)
      if (accountId) {
        setProfile(await hostingApi.accountProfile(accountId))
      } else {
        setProfile(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el perfil.")
    } finally {
      setLoading(false)
    }
  }

  async function loadProfile(accountId: string) {
    if (!accountId) return
    setLoading(true)
    setError("")
    try {
      setSelectedAccountId(accountId)
      setProfile(await hostingApi.accountProfile(accountId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el perfil.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAccounts()
  }, [])

  if (loading && !profile) {
    return <ProfileSkeleton />
  }

  if (error && !profile) {
    return (
      <div className="eh-card p-5">
        <div className="text-sm font-bold text-red-700">{error}</div>
        <Button className="mt-3" onClick={() => void loadAccounts()} size="sm" variant="outline">
          <RefreshCcw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    )
  }

  if (!selectedAccount || !profile) {
    return <div className="eh-card p-5 text-sm text-slate-500">No hay una cuenta de hosting asignada a este usuario.</div>
  }

  const account = profile.account
  const status = account.normalized_status || statusFallback(account.status)
  const initials = initialsFrom(account.customer_name || account.primary_domain || account.username)

  return (
    <div className="space-y-4">
      <section className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-blue-600 text-lg font-black text-white">{initials}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold text-slate-900">{account.customer_name || account.primary_domain}</h1>
                <StatusBadge label={status.label} tone={status.tone} />
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
                <span>{account.primary_domain}</span>
                <span>Usuario: {account.username}</span>
                <span>Plan: {account.plan_name || "Sin plan asignado"}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {accounts.length > 1 ? (
              <select
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500"
                onChange={(event) => void loadProfile(event.target.value)}
                value={selectedAccount.id}
              >
                {accounts.map((item) => <option key={item.id} value={item.id}>{item.primary_domain}</option>)}
              </select>
            ) : null}
            <Button disabled={loading} onClick={() => void loadProfile(selectedAccount.id)} size="sm" variant="outline">
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard icon={UserRound} label="Cliente" value={account.customer_name || "No registrado"} detail={account.customer_email || "Sin correo de contacto"} />
          <InfoCard icon={CalendarDays} label="Alta en servidor" value={formatDate(account.created_at)} detail={`Actualizado ${formatDate(account.updated_at)}`} />
          <InfoCard icon={Server} label="Nodo asignado" value={profile.node.hostname || account.node_hostname || "-"} detail={`${profile.node.public_ip || account.node_public_ip || "IP no publicada"} · ${nodeStateLabel(profile.node.state)}`} />
          <InfoCard icon={ShieldCheck} label="Estado de cuenta" value={status.label} detail={`Motor ${engineLabel(account.web_engine)} · PHP ${account.php_version}`} />
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-3">
        <div className="eh-card p-4 xl:col-span-2">
          <SectionTitle title="Recursos" subtitle={`Ultima medicion: ${formatDate(profile.usage.last_usage_at)}`} />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <UsageBar icon={HardDrive} label="Disco" used={profile.usage.disk_used_mb} total={profile.usage.disk_quota_mb} unit="MB" />
            <UsageBar icon={Activity} label="Trafico" used={profile.usage.bandwidth_used_mb} total={profile.usage.bandwidth_quota_mb} unit="MB" />
            <UsageBar icon={Activity} label="Memoria" used={profile.usage.ram_used_mb} total={profile.usage.memory_limit_mb} unit="MB" />
            <UsageBar icon={Activity} label="CPU" used={profile.usage.cpu_pct} total={profile.usage.cpu_limit_pct} unit="%" />
          </div>
        </div>

        <div className="eh-card p-4">
          <SectionTitle title="Salud" subtitle="Resumen tecnico de la cuenta" />
          <div className="mt-4 space-y-2">
            <HealthLine label="SSL principal" value={sslLabel(profile.security.ssl_status, profile.security.ssl_expires_at)} />
            <HealthLine label="Proteccion web" value={stateLabel(profile.security.web_protection_status)} />
            <HealthLine label="WAF" value={profile.security.waf_mode ? `${wafModeLabel(profile.security.waf_mode)} · ${stateLabel(profile.security.waf_status || "")}` : "Sin configurar"} />
            <HealthLine label="Monitoreo" value={`${stateLabel(profile.monitoring.status)} · ${profile.monitoring.response_ms || 0} ms`} />
            <HealthLine label="Tickets abiertos" value={String(profile.services.open_tickets)} />
          </div>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-3">
        <div className="eh-card p-4 xl:col-span-2">
          <SectionTitle title="Servicios" subtitle="Inventario real asociado a la cuenta" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat icon={Globe2} label="Dominios" value={profile.services.domains} />
            <MiniStat icon={Mail} label="Correos" value={profile.services.mailboxes} />
            <MiniStat icon={Database} label="Bases de datos" value={profile.services.databases} />
            <MiniStat icon={Activity} label="Aplicaciones" value={profile.services.applications} />
            <MiniStat icon={Server} label="FTP/FTPS" value={profile.services.ftp_users} />
            <MiniStat icon={ShieldCheck} label="Directorios protegidos" value={profile.services.protected_directories} />
            <MiniStat icon={ShieldCheck} label="Bloqueos IP" value={profile.services.ip_blocks} />
            <MiniStat icon={LifeBuoy} label="Tickets" value={profile.services.open_tickets} />
          </div>
        </div>

        <div className="eh-card p-4">
          <SectionTitle title="Provisionamiento" subtitle="Ultimo proceso de alta" />
          {profile.provisioning ? (
            <div className="mt-4 space-y-2 text-sm">
              <HealthLine label="Estado" value={String(profile.provisioning.status || "-")} />
              <HealthLine label="Creado" value={formatDate(String(profile.provisioning.created_at || ""))} />
              <HealthLine label="Actualizado" value={formatDate(String(profile.provisioning.updated_at || ""))} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Sin historial de provisionamiento disponible.</p>
          )}
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <div className="eh-card p-4">
          <SectionTitle title="Aplicaciones recientes" subtitle="Detectadas o instaladas desde el panel" />
          <div className="mt-3 divide-y divide-slate-200">
            {profile.applications.length ? profile.applications.map((app) => (
              <div className="flex items-center justify-between gap-3 py-3" key={app.id}>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-900">{app.name}</div>
                  <div className="text-xs text-slate-500">{app.type} · {app.version || "Version no detectada"}</div>
                </div>
                <StatusBadge label={stateLabel(app.status)} tone={app.status === "active" ? "green" : app.status === "failed" ? "red" : "amber"} />
              </div>
            )) : <p className="py-3 text-sm text-slate-500">Sin aplicaciones registradas.</p>}
          </div>
        </div>

        <div className="eh-card p-4">
          <SectionTitle title="Tickets recientes" subtitle="Soporte asociado a esta cuenta" />
          <div className="mt-3 divide-y divide-slate-200">
            {profile.tickets.latest.length ? profile.tickets.latest.map((ticket) => (
              <div className="py-3" key={ticket.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-bold text-slate-900">{ticket.display_id} · {ticket.subject}</div>
                  <StatusBadge label={stateLabel(ticket.status)} tone={ticket.priority === "urgent" || ticket.priority === "high" ? "red" : "blue"} />
                </div>
                <div className="mt-1 text-xs text-slate-500">{formatDate(ticket.updated_at)}</div>
              </div>
            )) : <p className="py-3 text-sm text-slate-500">Sin tickets recientes.</p>}
          </div>
        </div>
      </section>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="eh-card h-40 animate-pulse bg-slate-100" />
      <div className="grid gap-3 xl:grid-cols-3">
        <div className="eh-card h-48 animate-pulse bg-slate-100 xl:col-span-2" />
        <div className="eh-card h-48 animate-pulse bg-slate-100" />
      </div>
    </div>
  )
}

function InfoCard({ icon: Icon, label, value, detail }: { icon: typeof UserRound; label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3 grid h-8 w-8 place-items-center rounded-md bg-blue-50 text-blue-700">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-bold text-slate-900">{value}</div>
      {detail ? <div className="mt-1 break-words text-xs text-slate-500">{detail}</div> : null}
    </div>
  )
}

function UsageBar({ icon: Icon, label, used, total, unit }: { icon: typeof Activity; label: string; used?: number; total?: number; unit: string }) {
  const percent = total && used !== undefined ? Math.min(100, Math.round((Number(used) / Number(total)) * 100)) : 0
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-slate-100 text-slate-600"><Icon className="h-4 w-4" /></div>
          <div>
            <div className="text-sm font-bold text-slate-900">{label}</div>
            <div className="text-xs text-slate-500">{formatNumber(used)} / {formatNumber(total)} {unit}</div>
          </div>
        </div>
        <div className="text-sm font-black text-slate-900">{percent}%</div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-100">
        <div className={cn("h-2 rounded-full", percent > 90 ? "bg-red-500" : percent > 75 ? "bg-amber-500" : "bg-blue-600")} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-black text-slate-900">{value}</div>
        </div>
        <div className="grid h-8 w-8 place-items-center rounded-md bg-blue-50 text-blue-700"><Icon className="h-4 w-4" /></div>
      </div>
    </div>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  )
}

function HealthLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-right text-sm font-bold text-slate-900">{value}</span>
    </div>
  )
}

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  const classes = {
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    gray: "bg-slate-100 text-slate-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
  }[tone] || "bg-slate-100 text-slate-700"
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-black", classes)}>{label}</span>
}

function initialsFrom(value: string) {
  const parts = value.replace(/[^A-Za-z0-9\s.-]/g, "").split(/[\s.-]+/).filter(Boolean)
  return (parts[0]?.[0] || "E").toUpperCase() + (parts[1]?.[0] || parts[0]?.[1] || "H").toUpperCase()
}

function formatDate(value?: string | null) {
  if (!value) return "No disponible"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No disponible"
  return date.toLocaleString("es-BO", { dateStyle: "medium", timeStyle: "short" })
}

function formatNumber(value?: number) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return "0"
  return new Intl.NumberFormat("es-BO", { maximumFractionDigits: 1 }).format(Number(value))
}

function statusFallback(value: string) {
  if (value === "active") return { status: "active", label: "Activo", tone: "green" }
  if (value === "failed") return { status: "failed", label: "Error", tone: "red" }
  if (value === "provisioning") return { status: "provisioning", label: "Provisionando", tone: "blue" }
  if (value === "suspended") return { status: "suspended", label: "Suspendido", tone: "gray" }
  return { status: value, label: stateLabel(value), tone: "amber" }
}

function stateLabel(value: string) {
  const labels: Record<string, string> = {
    active: "Activo",
    answered: "Respondido",
    block: "Bloqueo",
    clean: "Limpio",
    closed: "Cerrado",
    customer_reply: "Respuesta cliente",
    disabled: "Desactivado",
    failed: "Error",
    installing: "Instalando",
    monitor: "Monitoreo",
    ok: "Correcto",
    open: "Abierto",
    pending: "Pendiente",
    provisioning: "Provisionando",
    running: "En ejecucion",
    stopped: "Detenido",
    success: "Correcto",
    suspended: "Suspendido",
    unknown: "Sin datos",
    warning: "Advertencia",
  }
  return labels[value] || value || "Sin datos"
}

function nodeStateLabel(value: string) {
  return stateLabel(value === "online" ? "Activo" : value)
}

function engineLabel(value: string) {
  return value === "openlitespeed" ? "OpenLiteSpeed" : "Nginx + Apache"
}

function wafModeLabel(value: string) {
  if (value === "block") return "Bloqueo"
  if (value === "monitor") return "Monitoreo"
  if (value === "disabled") return "Desactivado"
  return value
}

function sslLabel(status: string, expiresAt?: string | null) {
  const statusText = stateLabel(status)
  return expiresAt ? `${statusText} · vence ${formatDate(expiresAt)}` : statusText
}
