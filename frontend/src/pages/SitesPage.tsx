import {
  Archive,
  Code2,
  Database,
  ExternalLink,
  Files,
  GitBranch,
  Globe2,
  KeyRound,
  LockKeyhole,
  Mail,
  PlugZap,
  RefreshCcw,
  Search,
  ShieldCheck,
  Terminal,
  UserRoundCog,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { hostingApi, type HostingApplication, type SiteOverviewRow, type SitesOverviewResponse } from "@/api/hosting"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SiteRuntime = HostingApplication["type"] | "custom" | "unknown"
type ActionKey = "backup" | "check_updates" | "deploy" | "open_site" | "restart" | "wp_admin" | "wp_credentials" | "wp_login"

const runtimeMeta: Record<SiteRuntime, { label: string; tone: string; icon: LucideIcon }> = {
  custom: { icon: Globe2, label: "Custom", tone: "bg-slate-100 text-slate-700" },
  django: { icon: Code2, label: "Django", tone: "bg-emerald-50 text-emerald-700" },
  laravel: { icon: Code2, label: "Laravel", tone: "bg-red-50 text-red-700" },
  moodle: { icon: Globe2, label: "Moodle", tone: "bg-violet-50 text-violet-700" },
  nodejs: { icon: PlugZap, label: "Node.js", tone: "bg-lime-50 text-lime-700" },
  python: { icon: Code2, label: "Python", tone: "bg-blue-50 text-blue-700" },
  unknown: { icon: Search, label: "Sin detectar", tone: "bg-amber-50 text-amber-700" },
  wordpress: { icon: Globe2, label: "WordPress", tone: "bg-cyan-50 text-cyan-700" },
}

const emptyOverview: SitesOverviewResponse = {
  mail_events: [],
  overview: {
    active: 0,
    alerts: 0,
    apps: 0,
    diskPct: 0,
    diskSeries: [],
    diskUsed: 0,
    mailEvents: 0,
    mailRejected: 0,
    mailSeries: [],
    moodle: 0,
    requestSeries: [],
    requests: 0,
    total: 0,
    trafficPct: 0,
    trafficSeries: [],
    trafficUsed: 0,
    wordpress: 0,
  },
  sites: [],
}

export function SitesPage() {
  const [data, setData] = useState<SitesOverviewResponse>(emptyOverview)
  const [activeDomain, setActiveDomain] = useState("")
  const [isDetecting, setIsDetecting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [actionMessage, setActionMessage] = useState("")
  const [busyAction, setBusyAction] = useState("")
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")

  async function loadData() {
    setIsLoading(true)
    setError("")
    try {
      const response = await hostingApi.sitesOverview()
      setData(response)
      setActiveDomain((current) => current || response.sites[0]?.domain || "")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar los sitios.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const filteredSites = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase()
    if (!cleanQuery) return data.sites
    return data.sites.filter((site) =>
      [site.domain, site.account.username, site.account.customer_name, site.account.customer_email, site.app?.name, runtimeMeta[site.runtime]?.label]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(cleanQuery)),
    )
  }, [data.sites, query])

  const activeSite = filteredSites.find((site) => site.domain === activeDomain) ?? filteredSites[0] ?? null

  async function detectApps() {
    setIsDetecting(true)
    setError("")
    try {
      await hostingApi.detectApplications()
      await loadData()
      setActionMessage("Deteccion de aplicaciones ejecutada.")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo iniciar la deteccion de aplicaciones.")
    } finally {
      setIsDetecting(false)
    }
  }

  async function runAction(site: SiteOverviewRow, key: ActionKey) {
    const appId = site.app?.id
    const actionId = `${site.domain}:${key}`
    const quick = site.quick_actions.find((item) => item.key === key)
    setActionMessage("")
    if (quick?.url) {
      window.open(quick.url, "_blank")
      return
    }
    if (!appId) {
      setActionMessage("Esta accion requiere una aplicacion detectada.")
      return
    }
    setBusyAction(actionId)
    try {
      if (key === "restart") await hostingApi.restartApplication(appId)
      if (key === "deploy" || key === "check_updates") await hostingApi.checkApplicationUpdates(appId)
      if (key === "backup") await hostingApi.backupApplication(appId)
      if (key === "wp_login") {
        const response = await hostingApi.wordpressAutologin(appId)
        window.open(response.login_url, "_blank")
        setActionMessage(`Acceso temporal generado para ${response.login_user || "WordPress"}. Expira en pocos minutos.`)
        return
      }
      setActionMessage("Accion enviada al backend.")
      await loadData()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo ejecutar la accion.")
    } finally {
      setBusyAction("")
    }
  }

  return (
    <div className="space-y-4">
      <section className="eh-card overflow-hidden">
        <div className="grid gap-4 border-b border-slate-200 bg-white px-4 py-4 xl:grid-cols-[1fr_430px]">
          <div>
            <div className="eh-kicker">Centro de sitios</div>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950">Sitios web</h1>
                <p className="mt-1 max-w-3xl text-sm text-slate-500">
                  Vista operativa con salud, trafico, aplicaciones detectadas y eventos recientes por sitio.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={isDetecting || isLoading} onClick={() => void detectApps()} size="sm" variant="outline">
                  <RefreshCcw className={cn("h-4 w-4", isDetecting && "animate-spin")} />Detectar apps
                </Button>
                <Button disabled size="sm"><Globe2 className="h-4 w-4" />Nuevo dominio</Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <TopSignal label="Sitios" value={String(data.overview.total)} detail={isLoading ? "Sincronizando" : `${data.overview.active} activos`} />
            <TopSignal label="Apps" value={String(data.overview.apps)} detail={`${data.overview.wordpress} WordPress`} />
            <TopSignal label="Alertas" value={String(data.overview.alerts)} detail="Revisar salud" />
          </div>
        </div>

        {error ? <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
        {actionMessage ? <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">{actionMessage}</div> : null}

        <div className="grid gap-3 bg-slate-50 px-4 py-4 xl:grid-cols-4">
          <MetricPanel label="Disco usado" value={formatMb(data.overview.diskUsed)} detail={`${data.overview.diskPct}% del cupo`} series={data.overview.diskSeries} tone="blue" />
          <MetricPanel label="Trafico mensual" value={formatMb(data.overview.trafficUsed)} detail={`${data.overview.trafficPct}% del cupo`} series={data.overview.trafficSeries} tone="emerald" />
          <MetricPanel label="Requests" value={formatNumber(data.overview.requests)} detail="Ultimo snapshot" series={data.overview.requestSeries} tone="indigo" />
          <MetricPanel label="Correo" value={String(data.overview.mailEvents)} detail={`${data.overview.mailRejected} rechazados`} series={data.overview.mailSeries} tone="amber" />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          <div className="eh-card flex flex-wrap items-center gap-2 px-3 py-3">
            <div className="flex h-9 min-w-[280px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              <input
                className="h-full min-w-0 flex-1 bg-transparent outline-none"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar dominio, cliente, usuario o app..."
                value={query}
              />
            </div>
            <Button disabled={isLoading} onClick={() => void loadData()} size="sm" variant="outline">Actualizar</Button>
          </div>

          <div className="space-y-2">
            {filteredSites.map((site) => (
              <SiteCard
                active={activeSite?.domain === site.domain}
                key={site.domain}
                onSelect={() => setActiveDomain(site.domain)}
                site={site}
              />
            ))}
            {!isLoading && filteredSites.length === 0 ? (
              <div className="eh-card px-4 py-10 text-center text-sm font-semibold text-slate-500">No hay sitios para mostrar.</div>
            ) : null}
            {isLoading ? (
              <div className="eh-card px-4 py-10 text-center text-sm font-semibold text-slate-500">Cargando sitios reales...</div>
            ) : null}
          </div>
        </div>

        <aside className="space-y-4">
          {activeSite ? <SiteQuickPanel busyAction={busyAction} onAction={runAction} site={activeSite} /> : null}
          <MailLogPanel events={data.mail_events} />
        </aside>
      </section>
    </div>
  )
}

function SiteCard({ active, onSelect, site }: { active: boolean; onSelect: () => void; site: SiteOverviewRow }) {
  const meta = runtimeMeta[site.runtime]
  const Icon = meta.icon
  return (
    <button
      className={cn(
        "eh-card w-full overflow-hidden border text-left transition hover:border-blue-200 hover:shadow-md",
        active ? "border-blue-300 ring-2 ring-blue-100" : "border-transparent",
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="grid gap-3 px-4 py-3 xl:grid-cols-[1.35fr_170px_130px_130px_150px]">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-blue-50 text-blue-700"><Globe2 className="h-4 w-4" /></span>
            <div className="min-w-0">
              <div className="truncate text-base font-bold text-slate-950">{site.domain}</div>
              <div className="truncate text-xs font-semibold text-slate-500">{site.account.username} · {site.engine}</div>
            </div>
          </div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase text-slate-400">Aplicacion</div>
          <span className={cn("mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold", meta.tone)}>
            <Icon className="h-3.5 w-3.5" />{site.app?.name || meta.label}
          </span>
        </div>
        <ProgressMetric label="Disco" percent={site.disk.percent} value={formatMb(site.disk.used_mb)} />
        <ProgressMetric label="Trafico" percent={site.traffic.percent} value={formatMb(site.traffic.used_mb)} />
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase text-slate-400">
            <span>Actividad</span>
            <StatusDot status={site.health} />
          </div>
          <MiniLine data={site.traffic.hourly} tone={site.health === "danger" ? "red" : site.health === "warning" ? "amber" : "blue"} />
          <div className="mt-1 truncate text-[11px] font-semibold text-slate-500">{site.health_reason || "Sin incidencias recientes"}</div>
        </div>
      </div>
    </button>
  )
}

function SiteQuickPanel({ busyAction, onAction, site }: { busyAction: string; onAction: (site: SiteOverviewRow, key: ActionKey) => void; site: SiteOverviewRow }) {
  return (
    <div className="eh-card overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="eh-kicker">Vista rapida</div>
        <h2 className="mt-1 truncate text-lg font-bold text-slate-950">{site.domain}</h2>
        <p className="mt-1 text-xs text-slate-500">{site.document_root} · {site.account.node_hostname || site.account.node_public_ip || "Nodo no asignado"}</p>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2">
          <InfoPill label="Estado" value={statusLabel(site.status)} />
          <InfoPill label="Runtime" value={site.app?.name || runtimeMeta[site.runtime].label} />
          <InfoPill label="PHP" value={site.account.php_version || "N/D"} />
          <InfoPill label="SSL" value={sslLabel(site.security.ssl_status)} />
        </div>

        <div>
          <div className="mb-2 text-sm font-bold text-slate-900">Acciones de aplicacion</div>
          <div className="grid gap-2">
            {runtimeActions(site).map((action) => {
              const Icon = action.icon
              const actionId = `${site.domain}:${action.key}`
              return (
                <button
                  className={cn(
                    "flex h-10 items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-left text-sm font-semibold transition",
                    action.disabled ? "cursor-not-allowed text-slate-400" : "text-slate-800 hover:border-blue-200 hover:bg-blue-50",
                  )}
                  disabled={action.disabled || busyAction === actionId}
                  key={action.key}
                  onClick={() => onAction(site, action.key)}
                  type="button"
                >
                  <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-blue-700" />{action.label}</span>
                  {action.disabled ? <span className="text-xs text-slate-400">En desarrollo</span> : busyAction === actionId ? <RefreshCcw className="h-3.5 w-3.5 animate-spin text-slate-400" /> : <ExternalLink className="h-3.5 w-3.5 text-slate-400" />}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-bold text-slate-900">Ultimo log del sitio</div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            {site.http.recent_errors[0]?.raw ||
              site.http.recent_errors[0]?.url ||
              site.mail.events[0]?.detail ||
              "Sin errores HTTP o correo recientes en el ultimo snapshot."}
          </div>
        </div>
      </div>
    </div>
  )
}

function MailLogPanel({ events }: { events: SitesOverviewResponse["mail_events"] }) {
  return (
    <div className="eh-card overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="eh-kicker">Explorador de correos</div>
        <h2 className="mt-1 text-lg font-bold text-slate-950">Ultimos eventos</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {events.slice(0, 6).map((event, index) => (
          <div className="px-4 py-3" key={`${event.time}-${event.to}-${index}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="truncate text-sm font-bold text-slate-900">{event.to || event.from || "Evento de correo"}</div>
              <MailStatus status={event.status || event.direction || "ok"} />
            </div>
            <div className="mt-1 truncate text-xs text-slate-500">{event.detail || event.code || event.time || "Correo procesado"}</div>
          </div>
        ))}
        {events.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">Sin eventos de correo recientes.</div>
        ) : null}
      </div>
    </div>
  )
}

function runtimeActions(site: SiteOverviewRow): Array<{ disabled?: boolean; icon: LucideIcon; key: ActionKey; label: string }> {
  const quick = (key: ActionKey) => site.quick_actions.find((item) => item.key === key)
  if (site.runtime === "wordpress") {
    return [
      { disabled: !quick("open_site")?.enabled, icon: ExternalLink, key: "open_site", label: "Abrir sitio" },
      { disabled: !quick("wp_admin")?.enabled, icon: LockKeyhole, key: "wp_admin", label: "Acceder a wp-admin" },
      { disabled: !site.app, icon: UserRoundCog, key: "wp_login", label: "Login automatico WP" },
      { disabled: true, icon: KeyRound, key: "wp_credentials", label: "Editar credenciales WP" },
      { disabled: !site.app, icon: RefreshCcw, key: "check_updates", label: "Buscar actualizaciones" },
      { disabled: !site.app, icon: Archive, key: "backup", label: "Crear backup" },
    ]
  }
  if (site.runtime === "moodle") {
    return [
      { disabled: !quick("open_site")?.enabled, icon: ExternalLink, key: "open_site", label: "Abrir sitio" },
      { disabled: !site.app, icon: Database, key: "check_updates", label: "Verificar Moodle" },
      { disabled: !site.app, icon: Archive, key: "backup", label: "Crear backup" },
    ]
  }
  if (["nodejs", "python", "django", "laravel"].includes(site.runtime)) {
    return [
      { disabled: !quick("open_site")?.enabled, icon: ExternalLink, key: "open_site", label: "Abrir sitio" },
      { disabled: !site.app, icon: RefreshCcw, key: "restart", label: "Reiniciar servicio" },
      { disabled: !site.app, icon: Terminal, key: "check_updates", label: "Verificar runtime" },
      { disabled: !site.app, icon: GitBranch, key: "deploy", label: "Deploy update" },
      { disabled: !site.app, icon: Archive, key: "backup", label: "Crear backup" },
    ]
  }
  return [
    { disabled: !quick("open_site")?.enabled, icon: ExternalLink, key: "open_site", label: "Abrir sitio" },
    { disabled: true, icon: Files, key: "deploy", label: "Abrir archivos" },
    { disabled: true, icon: Database, key: "check_updates", label: "Bases de datos" },
    { disabled: true, icon: Mail, key: "backup", label: "Correo del dominio" },
    { disabled: true, icon: ShieldCheck, key: "restart", label: "Seguridad web" },
  ]
}

function TopSignal({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[11px] font-bold uppercase text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-950">{value}</div>
      <div className="text-xs text-slate-500">{detail}</div>
    </div>
  )
}

function MetricPanel({ detail, label, series, tone, value }: { detail: string; label: string; series: number[]; tone: "amber" | "blue" | "emerald" | "indigo"; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase text-slate-400">{label}</div>
          <div className="mt-1 text-xl font-bold text-slate-950">{value}</div>
          <div className="text-xs text-slate-500">{detail}</div>
        </div>
        <MiniLine data={series} tone={tone} />
      </div>
    </div>
  )
}

function ProgressMetric({ label, percent, value }: { label: string; percent: number; value: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase text-slate-400">
        <span>{label}</span>
        <span className="text-slate-700">{percent}%</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-200">
        <div className={cn("h-1.5 rounded-full", percent > 85 ? "bg-red-500" : percent > 70 ? "bg-amber-500" : "bg-blue-600")} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <div className="mt-1 text-xs font-semibold text-slate-700">{value}</div>
    </div>
  )
}

function MiniLine({ data, tone }: { data: number[]; tone: "amber" | "blue" | "emerald" | "indigo" | "red" }) {
  const color = {
    amber: "#d97706",
    blue: "#2563eb",
    emerald: "#059669",
    indigo: "#4f46e5",
    red: "#dc2626",
  }[tone]
  const points = sparklinePoints(data.length ? data : [0, 0, 0, 0, 0, 0], 96, 34)
  return (
    <svg aria-hidden="true" className="h-[34px] w-24 shrink-0 overflow-visible" viewBox="0 0 96 34">
      <path d={`M ${points}`} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
      <path d={`M ${points} L 96 34 L 0 34 Z`} fill={color} opacity="0.08" />
    </svg>
  )
}

function StatusDot({ status }: { status: SiteOverviewRow["health"] }) {
  const label = status === "danger" ? "Critico" : status === "warning" ? "Atencion" : "OK"
  const tone = status === "danger" ? "bg-red-500" : status === "warning" ? "bg-amber-500" : "bg-emerald-500"
  return <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600"><span className={cn("h-2 w-2 rounded-full", tone)} />{label}</span>
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-bold uppercase text-slate-400">{label}</div>
      <div className="mt-1 truncate text-sm font-bold text-slate-800">{value}</div>
    </div>
  )
}

function MailStatus({ status }: { status: string }) {
  const lowered = status.toLowerCase()
  const danger = lowered.includes("reject") || lowered.includes("fail") || lowered.includes("spam")
  const warning = lowered.includes("defer") || lowered.includes("warn")
  return (
    <span className={cn("rounded-full px-2 py-1 text-[11px] font-bold", danger ? "bg-red-50 text-red-700" : warning ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
      {danger ? "Revisar" : warning ? "Diferido" : "OK"}
    </span>
  )
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    active: "Activo",
    failed: "Error",
    pending: "Pendiente",
    provisioning: "Provisionando",
    suspended: "Suspendido",
  }
  return labels[value] || value || "Sin datos"
}

function sslLabel(value: string) {
  const labels: Record<string, string> = {
    active: "Activo",
    failed: "Error",
    pending: "Pendiente",
  }
  return labels[value] || value || "Sin datos"
}

function sparklinePoints(data: number[], width: number, height: number) {
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = Math.max(max - min, 1)
  return data
    .map((value, index) => {
      const x = data.length === 1 ? width : (index / (data.length - 1)) * width
      const y = height - ((value - min) / range) * (height - 4) - 2
      return `${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(" L ")
}

function formatMb(value: number) {
  if (value >= 1024) return `${(value / 1024).toFixed(1)} GB`
  if (value < 1 && value > 0) return `${Math.round(value * 1024)} KB`
  return `${Math.round(value)} MB`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-BO", { maximumFractionDigits: 0 }).format(value)
}
