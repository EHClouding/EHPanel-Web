import { Activity, Archive, Database, Globe2, HardDrive, Mail, ShieldCheck } from "lucide-react"
import { useEffect, useState } from "react"

import { hostingApi, type HomeDashboardSummary } from "@/api/hosting"
import { Button } from "@/components/ui/button"

const chartPrimary = "#2563eb"
const chartSecondary = "#0891b2"
const chartTrack = "#eef2f7"

type HomePageProps = {
  onNavigate?: (view: string) => void
}

type DashboardEvent = {
  label: string
  tone?: "amber" | "emerald" | "red"
}

const quickAccess = [
  { label: "Agregar dominio", view: "Dominios" },
  { label: "Crear correo", view: "Correos" },
  { label: "Abrir archivos", view: "Archivos" },
  { label: "Crear backup", view: "Backup" },
  { label: "Revisar SSL", view: "SSL / Seguridad" },
  { label: "Ver registros en vivo", view: "Monitoreo" },
]

export function HomePage({ onNavigate }: HomePageProps) {
  const [dashboard, setDashboard] = useState<HomeDashboardSummary>(() => emptyDashboard())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const loadDashboard = () => {
    setIsLoading(true)
    setError("")
    hostingApi.dashboardSummary()
      .then(setDashboard)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudo cargar el dashboard."))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  return (
    <div className="space-y-4">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryCard icon={Globe2} label="Sitios activos" value={String(dashboard.activeSites)} detail={`${dashboard.primarySites} principal`} />
        <SummaryCard icon={Mail} label="Correos" value={String(dashboard.totalCounts.mailboxes)} detail={`${dashboard.criticalMailboxes} buzones criticos`} />
        <SummaryCard icon={Database} label="Bases de datos" value={String(dashboard.totalCounts.databases)} detail={dashboard.databaseDetail} />
        <SummaryCard icon={ShieldCheck} label="SSL" value={dashboard.sslValue} detail={dashboard.sslDetail} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="eh-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-base font-bold text-slate-900">Sys Status</div>
            <Button disabled={isLoading} onClick={loadDashboard} size="sm" variant="outline">Actualizar</Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <RingMetric label="Funcionamiento estable" sub={dashboard.healthSub} value={dashboard.healthPct} />
            <RingMetric label="CPU usage" sub={`${dashboard.cpuLimitPct}% limite`} value={dashboard.cpuPct} />
            <RingMetric label="RAM usage" sub={dashboard.ramSub} value={dashboard.ramPct} />
          </div>
        </div>

        <div className="eh-card p-4">
          <div className="mb-4 text-base font-bold text-slate-900">Disk</div>
          <div className="grid gap-4 md:grid-cols-[1fr_130px]">
            <div className="grid gap-3 sm:grid-cols-2">
              <DiskItem label="/" value={`${dashboard.diskPct}%`} sub={`${formatMb(dashboard.diskUsed)} / ${formatMb(dashboard.diskQuota)}`} />
              <DiskItem label="/mail+db" value={`${dashboard.storagePct}%`} sub={`${formatMb(dashboard.storageUsed)} / ${formatMb(dashboard.diskQuota)}`} />
            </div>
            <MultiRing primary={dashboard.diskPct} secondary={dashboard.storagePct} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="eh-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-blue-700">Traffic</div>
              <div className="text-xs font-semibold text-slate-500">Net: All</div>
            </div>
            <Button disabled={isLoading} onClick={loadDashboard} size="sm" variant="outline">Ultimos minutos</Button>
          </div>
          <div className="mb-4 grid gap-2 rounded-lg bg-slate-100 p-3 sm:grid-cols-4">
            <TrafficStat label="Upstream" value={formatMb(dashboard.upstreamNow)} tone="primary" />
            <TrafficStat label="Downstream" value={formatMb(dashboard.downstreamNow)} tone="secondary" />
            <TrafficStat label="Total sent" value={formatMb(dashboard.totalSent)} />
            <TrafficStat label="Total received" value={formatMb(dashboard.totalReceived)} />
          </div>
          <TrafficChart values={dashboard.trafficValues} />
        </div>

        <div className="space-y-4">
          <div className="eh-card p-4">
            <div className="mb-3 text-sm font-bold text-slate-900">Alertas importantes</div>
            <div className="space-y-2">
              {dashboard.alerts.map((alert) => (
                <AlertItem key={alert.label} label={alert.label} tone={alert.tone ?? "emerald"} />
              ))}
            </div>
          </div>
          <div className="eh-card p-4">
            <div className="mb-3 text-sm font-bold text-slate-900">Accesos rapidos</div>
            <div className="grid gap-2">
              {quickAccess.map((item) => (
                <button
                  className="h-9 rounded-md border border-slate-200 px-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
                  key={item.label}
                  onClick={() => onNavigate?.(item.view)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <EventPanel events={dashboard.events} />
        <PlanPanel disk={dashboard.diskPct} mail={dashboard.mailPct} databases={dashboard.databasePct} backups={dashboard.backupPct} />
      </section>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, detail }: { icon: typeof Globe2; label: string; value: string; detail: string }) {
  return (
    <div className="eh-card p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{detail}</div>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-50 text-blue-700"><Icon className="h-4 w-4" /></div>
      </div>
    </div>
  )
}

function RingMetric({ value, label, sub }: { value: number; label: string; sub: string }) {
  return (
    <div className="grid place-items-center text-center">
      <div
        className="grid h-28 w-28 place-items-center rounded-full shadow-[inset_0_0_0_1px_rgba(37,99,235,0.04)]"
        style={{ background: `conic-gradient(${chartPrimary} ${value * 3.6}deg, ${chartTrack} 0deg)` }}
      >
        <div className="grid h-20 w-20 place-items-center rounded-full bg-white text-2xl font-bold text-slate-950">{value}%</div>
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-800">{label}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  )
}

function DiskItem({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="mb-2 rounded bg-slate-100 px-3 py-1 text-center text-xs font-bold text-slate-600">{label}</div>
      <div className="text-2xl font-bold text-blue-700">{value}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  )
}

function MultiRing({ primary, secondary }: { primary: number; secondary: number }) {
  return (
    <div
      className="grid h-32 w-32 place-items-center rounded-full"
      style={{
        background: `repeating-radial-gradient(circle, transparent 0 11px, #e8edf3 12px 18px), conic-gradient(${chartPrimary} 0 ${primary}%, transparent ${primary}% ${Math.min(primary + 6, 100)}%, ${chartSecondary} ${Math.min(primary + 6, 100)}% ${Math.min(primary + secondary, 100)}%, transparent ${Math.min(primary + secondary, 100)}%)`,
      }}
    >
      <div className="h-9 w-9 rounded-full bg-white" />
    </div>
  )
}

function TrafficStat({ label, value, tone = "slate" }: { label: string; value: string; tone?: "primary" | "secondary" | "slate" }) {
  const color = tone === "primary" ? "bg-blue-600" : tone === "secondary" ? "bg-cyan-600" : "bg-slate-400"
  return (
    <div>
      <div className="flex items-center gap-1 text-sm font-semibold text-slate-700"><span className={`h-2 w-2 rounded-full ${color}`} />{label}</div>
      <div className="mt-1 text-lg font-bold text-slate-900">{value}</div>
    </div>
  )
}

function TrafficChart({ values }: { values: Array<{ down: number; up: number }> }) {
  const upPoints = linePoints(values.map((point) => point.up), 620, 230)
  const downPoints = linePoints(values.map((point) => point.down), 620, 230)

  return (
    <div className="relative h-72 rounded-lg bg-white">
      <div className="absolute inset-x-8 inset-y-6 grid grid-rows-5">
        {Array.from({ length: 5 }).map((_, index) => <div className="border-t border-dashed border-slate-200" key={index} />)}
      </div>
      <svg className="absolute inset-x-8 bottom-8 top-6 h-[230px] w-[calc(100%-4rem)] overflow-visible" preserveAspectRatio="none" viewBox="0 0 620 230">
        <path d={`M ${downPoints} L 620 230 L 0 230 Z`} fill={chartSecondary} opacity="0.08" />
        <path d={`M ${upPoints}`} fill="none" stroke={chartPrimary} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        <path d={`M ${downPoints}`} fill="none" stroke={chartSecondary} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      </svg>
    </div>
  )
}

function AlertItem({ label, tone }: { label: string; tone: "amber" | "red" | "emerald" }) {
  const color = tone === "red" ? "bg-red-500" : tone === "amber" ? "bg-amber-500" : "bg-emerald-500"
  return <div className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"><span className={`h-2 w-2 rounded-full ${color}`} />{label}</div>
}

function EventPanel({ events }: { events: DashboardEvent[] }) {
  return (
    <div className="eh-card p-4">
      <div className="mb-3 text-sm font-bold text-slate-900">Ultimos eventos</div>
      <div className="space-y-2 text-sm">
        {events.map((event) => (
          <div className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2" key={event.label}><Activity className="h-4 w-4 text-blue-600" />{event.label}</div>
        ))}
      </div>
    </div>
  )
}

function PlanPanel({ backups, databases, disk, mail }: { backups: number; databases: number; disk: number; mail: number }) {
  return (
    <div className="eh-card p-4">
      <div className="mb-3 text-sm font-bold text-slate-900">Uso del plan</div>
      <div className="space-y-3">
        <PlanLine icon={HardDrive} label="Disco" value={disk} />
        <PlanLine icon={Mail} label="Correos" value={mail} />
        <PlanLine icon={Database} label="Bases de datos" value={databases} />
        <PlanLine icon={Archive} label="Backups" value={backups} />
      </div>
    </div>
  )
}

function PlanLine({ icon: Icon, label, value }: { icon: typeof HardDrive; label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm font-semibold text-slate-700"><span className="flex items-center gap-2"><Icon className="h-4 w-4 text-blue-600" />{label}</span><span>{value}%</span></div>
      <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.min(value, 100)}%` }} /></div>
    </div>
  )
}

function emptyDashboard(): HomeDashboardSummary {
  return {
    activeSites: 0,
    alerts: [{ label: "Cargando eventos reales del backend.", tone: "emerald" }],
    backupPct: 0,
    cpuLimitPct: 100,
    cpuPct: 0,
    criticalMailboxes: 0,
    databaseDetail: "0 MariaDB / 0 PostgreSQL",
    databasePct: 0,
    diskPct: 0,
    diskQuota: 0,
    diskUsed: 0,
    downstreamNow: 0,
    events: [{ label: "Esperando sincronizacion del backend.", tone: "emerald" }],
    healthPct: 0,
    healthSub: "0 cuenta(s) / 0 dominio(s)",
    mailPct: 0,
    primarySites: 0,
    ramPct: 0,
    ramSub: "0 MB / 0 MB",
    sslDetail: "Sin datos",
    sslValue: "Pendiente",
    storagePct: 0,
    storageUsed: 0,
    totalCounts: { accounts: 0, databases: 0, domains: 0, mailboxes: 0 },
    totalReceived: 0,
    totalSent: 0,
    trafficPct: 0,
    trafficValues: Array.from({ length: 9 }, () => ({ down: 0, up: 0 })),
    upstreamNow: 0,
  }
}

function linePoints(values: number[], width: number, height: number) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = Math.max(max - min, 1)
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width : (index / (values.length - 1)) * width
      const y = height - ((value - min) / range) * (height - 10) - 5
      return `${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(" L ")
}

function formatMb(value: number) {
  if (!value) return "0 MB"
  if (value >= 1024) return `${(value / 1024).toFixed(1)} GB`
  if (value < 1) return `${Math.round(value * 1024)} KB`
  return `${Math.round(value)} MB`
}
