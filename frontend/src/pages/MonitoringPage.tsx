import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Pause,
  Play,
  RefreshCcw,
  Wifi,
  type LucideIcon,
} from "lucide-react"
import type React from "react"
import { useEffect, useMemo, useState } from "react"

import { hostingApi, type HostingAccount, type MonitoringResponse } from "@/api/hosting"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type MonitorTab = "Resumen" | "Checks" | "Servicios" | "Incidentes" | "Alertas" | "Registros" | "Historial" | "SLA"
type LogsTab = "Web en vivo" | "Correo en vivo" | "Sistema"

const tabs: MonitorTab[] = ["Resumen", "Checks", "Servicios", "Incidentes", "Alertas", "Registros", "Historial", "SLA"]
const logTabs: LogsTab[] = ["Web en vivo", "Correo en vivo", "Sistema"]

export function MonitoringPage() {
  const [accounts, setAccounts] = useState<HostingAccount[]>([])
  const [accountId, setAccountId] = useState("")
  const [monitoring, setMonitoring] = useState<MonitoringResponse | null>(null)
  const [activeTab, setActiveTab] = useState<MonitorTab>("Resumen")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    hostingApi.accounts().then((page) => {
      const items = page.results
      setAccounts(items)
      setAccountId((current) => current || items[0]?.id || "")
    }).catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar las cuentas."))
  }, [])

  useEffect(() => {
    if (accountId) void loadMonitoring(false)
  }, [accountId])

  async function loadMonitoring(refresh: boolean) {
    if (!accountId) return
    setLoading(true)
    setError("")
    setNotice("")
    try {
      setMonitoring(await hostingApi.accountMonitoring(accountId, refresh))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar monitoreo.")
    } finally {
      setLoading(false)
    }
  }

  async function toggleCheck(id: number, enabled: boolean) {
    await hostingApi.updateMonitorCheck(id, { enabled })
    await loadMonitoring(false)
  }

  async function incidentAction(id: number, action: "ack" | "resolve") {
    if (action === "ack") await hostingApi.acknowledgeMonitorIncident(id)
    if (action === "resolve") await hostingApi.resolveMonitorIncident(id)
    await loadMonitoring(false)
  }

  async function testAlert(id: number) {
    setError("")
    setNotice("")
    try {
      await hostingApi.testMonitorAlert(id)
      setNotice("Prueba de alerta registrada correctamente.")
      await loadMonitoring(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo probar la alerta.")
    }
  }

  const selectedAccount = accounts.find((account) => account.id === accountId)
  const summary = monitoring?.summary
  const statusLabel = summary?.status === "operational" ? "Operativo" : summary?.status === "down" ? "Caido" : "Degradado"

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-4">
        <MonitorMetric icon={CheckCircle2} label="Estado general" value={statusLabel || "Sin datos"} detail={selectedAccount?.primary_domain || "Selecciona una cuenta"} tone="emerald" />
        <MonitorMetric icon={Wifi} label="Uptime" value={`${summary?.uptime_pct ?? 0}%`} detail="Ultimo snapshot" tone="blue" />
        <MonitorMetric icon={Clock3} label="Respuesta" value={`${summary?.response_ms ?? 0} ms`} detail="Actual" tone="indigo" />
        <MonitorMetric icon={AlertTriangle} label="Incidentes" value={String(summary?.incidents_open ?? 0)} detail="Abiertos o reconocidos" tone="amber" />
      </section>

      <section className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-base font-bold">Monitoreo</h2>
            <p className="text-xs text-slate-500">Disponibilidad, servicios, incidentes, alertas y registros en vivo.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setAccountId(event.target.value)} value={accountId}>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.primary_domain}</option>)}
            </select>
            <Button disabled={loading || !accountId} onClick={() => loadMonitoring(true)} size="sm" variant="outline">
              <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />Diagnosticar caida
            </Button>
          </div>
        </div>
        {error && <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div>}
        {notice && <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">{notice}</div>}
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
          <div className="flex flex-wrap gap-1">
            {tabs.map((tab) => (
              <button
                className={cn("h-8 rounded-md px-3 text-xs font-bold transition", activeTab === tab ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:bg-white hover:text-slate-900")}
                key={tab}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4">
          {!monitoring && <EmptyState text={loading ? "Consultando monitoreo real del nodo..." : "No hay datos de monitoreo todavia."} />}
          {monitoring && activeTab === "Resumen" && <OverviewTab monitoring={monitoring} />}
          {monitoring && activeTab === "Checks" && <ChecksTab monitoring={monitoring} onToggle={toggleCheck} />}
          {monitoring && activeTab === "Servicios" && <ServicesTab monitoring={monitoring} />}
          {monitoring && activeTab === "Incidentes" && <IncidentsTab monitoring={monitoring} onAction={incidentAction} />}
          {monitoring && activeTab === "Alertas" && <AlertsTab monitoring={monitoring} onTest={testAlert} />}
          {monitoring && activeTab === "Registros" && <LogsTabPanel monitoring={monitoring} />}
          {monitoring && activeTab === "Historial" && <HistoryTab monitoring={monitoring} />}
          {monitoring && activeTab === "SLA" && <SlaTab monitoring={monitoring} />}
        </div>
      </section>
    </div>
  )
}

function OverviewTab({ monitoring }: { monitoring: MonitoringResponse }) {
  const visibleChecks = monitoring.checks.slice(0, 6)
  const suggestions = useMemo(() => {
    const rows = monitoring.incidents.filter((incident) => incident.status !== "resolved").slice(0, 5).map((incident) => [incident.title, incident.severity])
    return rows.length ? rows : [["Sin incidentes activos", "OK"]]
  }, [monitoring.incidents])
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="grid gap-3 md:grid-cols-2">
        {visibleChecks.map((check) => <StatusCard detail={check.last_message || check.target} key={check.id} status={check.status} title={check.name} />)}
      </div>
      <SimplePanel title="Acciones sugeridas" rows={suggestions} />
    </div>
  )
}

function ChecksTab({ monitoring, onToggle }: { monitoring: MonitoringResponse; onToggle: (id: number, enabled: boolean) => void }) {
  return (
    <DataTable columns={["Check", "Destino", "Estado", "Tiempo", "Ultima revision", "Acciones"]}>
      {monitoring.checks.map((check) => (
        <tr className="h-[48px] hover:bg-slate-50" key={check.id}>
          <td className="px-3 py-2 font-semibold text-slate-800">{check.name}</td>
          <td className="px-3 py-2 text-slate-700">{check.target}</td>
          <td className="px-3 py-2"><StatusPill status={check.enabled ? check.status : "paused"} /></td>
          <td className="px-3 py-2 text-slate-700">{check.response_ms} ms</td>
          <td className="px-3 py-2 text-slate-700">{formatDate(check.last_checked_at)}</td>
          <td className="px-3 py-2">
            <Button onClick={() => onToggle(check.id, !check.enabled)} size="sm" variant="outline">{check.enabled ? "Pausar" : "Activar"}</Button>
          </td>
        </tr>
      ))}
    </DataTable>
  )
}

function ServicesTab({ monitoring }: { monitoring: MonitoringResponse }) {
  return (
    <DataTable columns={["Servicio", "Estado", "Proceso", "Nodo", "Ultimo cambio", "Unidad"]}>
      {monitoring.services.map((service, index) => (
        <tr className="h-[48px] hover:bg-slate-50" key={`${service.name}-${index}`}>
          <td className="px-3 py-2 font-semibold text-slate-800">{value(service.name)}</td>
          <td className="px-3 py-2"><StatusPill status={value(service.status)} /></td>
          <td className="px-3 py-2 text-slate-700">{value(service.process)}</td>
          <td className="px-3 py-2 text-slate-700">{value(service.node)}</td>
          <td className="px-3 py-2 text-slate-700">{value(service.last_change)}</td>
          <td className="px-3 py-2 text-slate-700">{value(service.unit)}</td>
        </tr>
      ))}
    </DataTable>
  )
}

function IncidentsTab({ monitoring, onAction }: { monitoring: MonitoringResponse; onAction: (id: number, action: "ack" | "resolve") => void }) {
  return (
    <DataTable columns={["Incidente", "Severidad", "Servicio", "Inicio", "Estado", "Detalle", "Acciones"]}>
      {monitoring.incidents.map((incident) => (
        <tr className="h-[48px] hover:bg-slate-50" key={incident.id}>
          <td className="px-3 py-2 font-semibold text-slate-800">{incident.title}</td>
          <td className="px-3 py-2 text-slate-700">{incident.severity}</td>
          <td className="px-3 py-2 text-slate-700">{incident.service || "-"}</td>
          <td className="px-3 py-2 text-slate-700">{formatDate(incident.started_at)}</td>
          <td className="px-3 py-2"><StatusPill status={incident.status} /></td>
          <td className="px-3 py-2 text-slate-700">{incident.detail || "-"}</td>
          <td className="px-3 py-2">
            <div className="flex gap-2">
              <Button disabled={incident.status === "resolved"} onClick={() => onAction(incident.id, "ack")} size="sm" variant="outline">Reconocer</Button>
              <Button disabled={incident.status === "resolved"} onClick={() => onAction(incident.id, "resolve")} size="sm" variant="outline">Resolver</Button>
            </div>
          </td>
        </tr>
      ))}
    </DataTable>
  )
}

function AlertsTab({ monitoring, onTest }: { monitoring: MonitoringResponse; onTest: (id: number) => void }) {
  return (
    <DataTable columns={["Canal", "Evento", "Umbral", "Estado", "Ultima prueba", "Acciones"]}>
      {monitoring.alerts.map((alert) => (
        <tr className="h-[48px] hover:bg-slate-50" key={alert.id}>
          <td className="px-3 py-2 font-semibold text-slate-800">{alert.channel}</td>
          <td className="px-3 py-2 text-slate-700">{alert.event}</td>
          <td className="px-3 py-2 text-slate-700">{alert.threshold || "-"}</td>
          <td className="px-3 py-2"><StatusPill status={alert.enabled ? "active" : "paused"} /></td>
          <td className="px-3 py-2 text-slate-700">{formatDate(alert.last_test_at)} {alert.last_test_status ? `(${alert.last_test_status})` : ""}</td>
          <td className="px-3 py-2"><Button onClick={() => onTest(alert.id)} size="sm" variant="outline">Probar</Button></td>
        </tr>
      ))}
    </DataTable>
  )
}

function LogsTabPanel({ monitoring }: { monitoring: MonitoringResponse }) {
  const [activeLog, setActiveLog] = useState<LogsTab>("Web en vivo")
  const [live, setLive] = useState(true)
  const webLogs = monitoring.logs.web || []
  const mailLogs = monitoring.logs.mail || []
  const systemLogs = monitoring.logs.system || []

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-4">
        <MiniStat label="Web" value={String(webLogs.length)} />
        <MiniStat label="Correo" value={String(mailLogs.length)} />
        <MiniStat label="Sistema" value={String(systemLogs.length)} />
        <MiniStat label="Errores" value={String(webLogs.filter((row) => Number(row.code || 0) >= 400).length)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 rounded-md bg-slate-100 p-1">
          {logTabs.map((tab) => (
            <button className={cn("h-8 rounded px-3 text-xs font-bold", activeLog === tab ? "bg-white text-blue-700 shadow-sm" : "text-slate-500")} key={tab} onClick={() => setActiveLog(tab)} type="button">
              {tab}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setLive((current) => !current)} size="sm" variant="outline">
            {live ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {live ? "Pausar en vivo" : "Reanudar"}
          </Button>
          <Button size="sm" variant="outline"><Download className="h-4 w-4" />Exportar</Button>
        </div>
      </div>
      {activeLog === "Web en vivo" && <PlainRows columns={["Hora", "Metodo", "Ruta / recurso", "Estado", "Codigo", "Explicacion"]} rows={webLogs.map((row) => [value(row.time), value(row.method), value(row.path), value(row.status), value(row.code), value(row.detail)])} />}
      {activeLog === "Correo en vivo" && <PlainRows columns={["Hora", "Origen", "Destino", "Direccion", "Estado", "Codigo", "Motivo claro"]} rows={mailLogs.map((row) => [value(row.time), value(row.from), value(row.to), value(row.direction), value(row.status), value(row.code), value(row.detail)])} />}
      {activeLog === "Sistema" && <PlainRows columns={["Hora", "Servicio", "Severidad", "Evento", "Accion sugerida"]} rows={systemLogs.map((row) => [value(row.time), value(row.service), value(row.severity), value(row.event), value(row.suggestion)])} />}
    </div>
  )
}

function HistoryTab({ monitoring }: { monitoring: MonitoringResponse }) {
  const rows = monitoring.history.map((row) => [formatDate(value(row.time)), value(row.status), `${value(row.response_ms)} ms`, `${value(row.incidents_open)} incidentes`])
  return <PlainRows columns={["Hora", "Estado", "Respuesta", "Incidentes"]} rows={rows} />
}

function SlaTab({ monitoring }: { monitoring: MonitoringResponse }) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <MiniStat label="Uptime mensual" value={`${value(monitoring.sla.uptime_pct || monitoring.summary.uptime_pct)}%`} />
      <MiniStat label="Tiempo fuera" value={`${value(monitoring.sla.downtime_minutes || 0)}m`} />
      <MiniStat label="Incidentes" value={value(monitoring.sla.incidents || monitoring.summary.incidents_open)} />
      <MiniStat label="MTTR" value={`${value(monitoring.sla.mttr_minutes || 0)}m`} />
    </div>
  )
}

function StatusCard({ title, detail, status }: { title: string; detail: string; status: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-900">{title}</div>
          <div className="mt-1 text-xs text-slate-500">{detail}</div>
        </div>
        <StatusIcon status={status} />
      </div>
    </div>
  )
}

function SimplePanel({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3 text-sm font-bold text-slate-900">{title}</div>
      <div className="space-y-2">
        {rows.map(([left, right]) => (
          <div className="flex justify-between rounded-md bg-slate-50 px-3 py-2 text-sm" key={left}>
            <span className="font-semibold text-slate-700">{left}</span>
            <span className="text-slate-500">{right}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DataTable({ columns, children }: { columns: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>{columns.map((column) => <th className="px-3 py-2" key={column}>{column}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">{children}</tbody>
      </table>
    </div>
  )
}

function PlainRows({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <DataTable columns={columns}>
      {rows.length === 0 && <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={columns.length}>Sin datos registrados.</td></tr>}
      {rows.map((row, index) => (
        <tr className="h-[48px] hover:bg-slate-50" key={index}>
          {row.map((cell, cellIndex) => <td className="px-3 py-2 text-slate-700" key={`${index}-${cellIndex}`}>{cell}</td>)}
        </tr>
      ))}
    </DataTable>
  )
}

function MonitorMetric({ icon: Icon, label, value, detail, tone }: { icon: LucideIcon; label: string; value: string; detail: string; tone: "emerald" | "blue" | "indigo" | "amber" }) {
  const toneClass = {
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    indigo: "bg-indigo-50 text-indigo-700",
  }[tone]

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className={cn("grid h-10 w-10 place-items-center rounded-lg", toneClass)}><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
          <div className="text-xl font-bold text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{detail}</div>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const normalized = String(status || "").toLowerCase()
  const good = ["ok", "active", "operational", "running", "resolved"].includes(normalized)
  const bad = ["failed", "down", "error", "inactive", "open"].includes(normalized)
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", good ? "bg-emerald-50 text-emerald-700" : bad ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>{status || "unknown"}</span>
}

function StatusIcon({ status }: { status: string }) {
  const normalized = String(status || "").toLowerCase()
  if (["ok", "active", "operational", "running"].includes(normalized)) return <CheckCircle2 className="h-5 w-5 text-emerald-600" />
  if (["failed", "down", "error"].includes(normalized)) return <AlertTriangle className="h-5 w-5 text-red-600" />
  return <AlertTriangle className="h-5 w-5 text-amber-600" />
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">{text}</div>
}

function value(input: unknown) {
  if (input === null || input === undefined || input === "") return "-"
  return String(input)
}

function formatDate(input?: string | null) {
  if (!input) return "-"
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return input
  return date.toLocaleString()
}
