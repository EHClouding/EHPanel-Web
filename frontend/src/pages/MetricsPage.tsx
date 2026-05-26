import {
  Activity,
  BarChart3,
  Clock3,
  Download,
  FilePieChart,
  Globe2,
  HardDrive,
  RefreshCcw,
  Search,
  Server,
  TrendingUp,
  Wifi,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { hostingApi, type AccountUsage, type HostingAccount } from "@/api/hosting"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type MetricsTab = "Resumen" | "Tráfico" | "Recursos" | "HTTP" | "Almacenamiento" | "Correo" | "Reportes"

const tabs: MetricsTab[] = ["Resumen", "Tráfico", "Recursos", "HTTP", "Almacenamiento", "Correo", "Reportes"]

export function MetricsPage() {
  const [activeTab, setActiveTab] = useState<MetricsTab>("Resumen")
  const [accounts, setAccounts] = useState<HostingAccount[]>([])
  const [accountId, setAccountId] = useState("")
  const [usage, setUsage] = useState<AccountUsage>({})
  const [lastUsageAt, setLastUsageAt] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) ?? accounts[0],
    [accountId, accounts],
  )

  useEffect(() => {
    let mounted = true
    hostingApi.accounts()
      .then((page) => {
        if (!mounted) return
        setAccounts(page.results)
        const first = page.results[0]
        if (first) {
          setAccountId(first.id)
          setUsage(first.last_usage ?? {})
          setLastUsageAt(null)
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar las cuentas."))
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!selectedAccount) return
    setUsage(selectedAccount.last_usage ?? {})
    setLastUsageAt(null)
    void loadUsage(selectedAccount.id, false)
  }, [selectedAccount?.id])

  const http = usage.http ?? {}
  const storage = usage.storage ?? {}
  const statusCounts = http.status_counts ?? {}
  const errors = Number(statusCounts["4xx"] ?? 0) + Number(statusCounts["5xx"] ?? 0)
  const diskPct = percent(usage.disk_used_mb, usage.disk_quota_mb)
  const ramPct = percent(usage.ram_used_mb, usage.memory_limit_mb)

  async function loadUsage(id = selectedAccount?.id, refresh = true) {
    if (!id) return
    setLoading(true)
    setError("")
    try {
      const response = await hostingApi.accountUsage(id, refresh)
      setUsage(response.usage ?? {})
      setLastUsageAt(response.last_usage_at)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la solicitud.")
    } finally {
      setLoading(false)
    }
  }

  function exportCsv(reportName = "metricas") {
    const rows = [
      ["Cuenta", selectedAccount?.primary_domain ?? ""],
      ["Usuario", selectedAccount?.username ?? ""],
      ["Recolectado", usage.collected_at ?? lastUsageAt ?? ""],
      ["Visitas IP únicas", String(http.unique_ips ?? 0)],
      ["Requests", String(http.requests ?? 0)],
      ["Transferencia MB", String(usage.bandwidth_used_mb ?? 0)],
      ["CPU %", String(usage.cpu_pct ?? 0)],
      ["RAM MB", String(usage.ram_used_mb ?? 0)],
      ["Disco MB", String(usage.disk_used_mb ?? 0)],
      ["Errores 4xx/5xx", String(errors)],
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `${reportName}-${selectedAccount?.username ?? "cuenta"}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const topUrls = filterRows(
    (http.top_urls ?? []).map((row) => [row.url || "/", formatNumber(row.requests), "Requests"]),
    query,
  )
  const recentErrors = filterRows(
    (http.recent_errors ?? []).map((row) => [row.url || "/", String(row.status ?? ""), row.raw || ""]),
    query,
  )

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 min-w-[300px] items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-500 shadow-panel">
            <Search className="h-4 w-4" />
            <input
              className="h-full min-w-0 flex-1 bg-transparent outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtrar métrica, URL o recurso"
              value={query}
            />
          </div>
          <select
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-panel outline-none"
            onChange={(event) => setAccountId(event.target.value)}
            value={selectedAccount?.id ?? ""}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.primary_domain} · {account.username}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button disabled={loading || !selectedAccount} onClick={() => loadUsage(undefined, true)} size="sm" variant="outline">
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            Actualizar
          </Button>
          <Button disabled={!selectedAccount} onClick={() => exportCsv()} size="sm" variant="outline">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </section>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div>}

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard icon={Globe2} label="Visitas IP únicas" value={formatNumber(http.unique_ips)} detail="Desde access.log" />
        <MetricCard icon={Wifi} label="Requests" value={formatNumber(http.requests)} detail="HTTP total" />
        <MetricCard icon={TrendingUp} label="Transferencia" value={formatMb(usage.bandwidth_used_mb)} detail={limitText(usage.bandwidth_mb)} />
        <MetricCard icon={Clock3} label="Resp. prom." value="N/D" detail="Requiere request_time en Nginx" muted />
        <MetricCard icon={Server} label="CPU actual" value={`${formatNumber(usage.cpu_pct)}%`} detail={limitText(usage.cpu_limit_pct, "% límite")} />
        <MetricCard icon={Activity} label="RAM actual" value={formatMb(usage.ram_used_mb)} detail={`${ramPct}% del límite`} />
        <MetricCard icon={BarChart3} label="Errores 4xx/5xx" value={formatNumber(errors)} detail="Desde access.log" good={errors === 0} />
        <MetricCard icon={HardDrive} label="Disco" value={`${diskPct}%`} detail={`${formatMb(usage.disk_used_mb)} / ${formatMb(usage.disk_quota_mb)}`} />
      </section>

      <section className="eh-card overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {tabs.map((tab) => (
                <button
                  className={cn(
                    "h-8 rounded-md px-3 text-xs font-bold transition",
                    activeTab === tab ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:bg-white hover:text-slate-900",
                  )}
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  type="button"
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="text-xs font-semibold text-slate-500">{usage.collected_at ? `Recolectado: ${formatDate(usage.collected_at)}` : "Sin recolección reciente"}</div>
          </div>
        </div>
        <div className="p-4">
          {!selectedAccount ? (
            <EmptyState text="No hay cuentas hosting disponibles para medir." />
          ) : (
            <>
              {activeTab === "Resumen" && <SummaryTab topUrls={topUrls} recentErrors={recentErrors} usage={usage} />}
              {activeTab === "Tráfico" && <TrafficTab usage={usage} />}
              {activeTab === "Recursos" && <ResourcesTab account={selectedAccount} usage={usage} />}
              {activeTab === "HTTP" && <HttpTab recentErrors={recentErrors} statusCounts={statusCounts} />}
              {activeTab === "Almacenamiento" && <StorageTab account={selectedAccount} storage={storage} />}
              {activeTab === "Correo" && <MailTab account={selectedAccount} storage={storage} usage={usage} />}
              {activeTab === "Reportes" && <ReportsTab onExport={exportCsv} />}
            </>
          )}
        </div>
      </section>
    </div>
  )
}

function SummaryTab({ topUrls, recentErrors, usage }: { topUrls: string[][]; recentErrors: string[][]; usage: AccountUsage }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <ChartPanel title="Requests por hora" values={usage.http?.hourly ?? []} />
      <div className="space-y-3">
        <CompactList empty="Sin URLs registradas." title="Top URLs" rows={topUrls} />
        <CompactList empty="Sin errores recientes." title="Errores recientes" rows={recentErrors.map(([url, status]) => [url, status])} />
      </div>
    </div>
  )
}

function TrafficTab({ usage }: { usage: AccountUsage }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartPanel title="Requests por hora" values={usage.http?.hourly ?? []} />
      <DataTable
        columns={["Métrica", "Valor", "Origen"]}
        rows={[
          ["Transferencia", formatMb(usage.bandwidth_used_mb), "Access logs"],
          ["Bytes HTTP", formatBytes(usage.http?.bytes_total), "Access logs"],
          ["Requests", formatNumber(usage.http?.requests), "Access logs"],
          ["IPs únicas", formatNumber(usage.http?.unique_ips), "Access logs"],
        ]}
      />
    </div>
  )
}

function ResourcesTab({ account, usage }: { account: HostingAccount; usage: AccountUsage }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <ResourceGauge label="CPU" value={percent(usage.cpu_pct, usage.cpu_limit_pct)} limit={`${formatNumber(usage.cpu_limit_pct ?? account.cpu_pct)}%`} />
      <ResourceGauge label="RAM" value={percent(usage.ram_used_mb, usage.memory_limit_mb)} limit={formatMb(usage.memory_limit_mb ?? account.memory_mb)} />
      <ResourceGauge label="Disco" value={percent(usage.disk_used_mb, usage.disk_quota_mb)} limit={formatMb(usage.disk_quota_mb ?? account.disk_mb)} />
      <ResourceGauge label="Transferencia" value={percent(usage.bandwidth_used_mb, usage.bandwidth_mb)} limit={formatMb(usage.bandwidth_mb ?? account.bandwidth_mb)} />
      <ResourceGauge label="Procesos" value={Math.min(Number(usage.processes ?? 0), 100)} limit={`${formatNumber(usage.processes)} activos`} />
      <ResourceGauge label="Logs" value={percent(usage.storage?.logs_mb, usage.disk_quota_mb)} limit={formatMb(usage.storage?.logs_mb)} />
    </div>
  )
}

function HttpTab({ recentErrors, statusCounts }: { recentErrors: string[][]; statusCounts: Record<string, number> }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <CompactList
        title="Códigos HTTP"
        rows={[
          ["2xx", formatNumber(statusCounts["2xx"])],
          ["3xx", formatNumber(statusCounts["3xx"])],
          ["4xx", formatNumber(statusCounts["4xx"])],
          ["5xx", formatNumber(statusCounts["5xx"])],
        ]}
      />
      <DataTable columns={["URL", "Código", "Línea"]} empty="Sin errores HTTP registrados." rows={recentErrors} />
    </div>
  )
}

function StorageTab({ account, storage }: { account: HostingAccount; storage: AccountUsage["storage"] }) {
  return (
    <DataTable
      columns={["Área", "Uso", "Detalle", "Fuente"]}
      rows={[
        ["Archivos", formatMb(storage?.files_mb), "public_html", "Nodo"],
        ["Bases de datos", formatMb(storage?.databases_mb), `${account.databases?.length ?? account.databases_count ?? 0} BD`, "Panel"],
        ["Correos", formatMb(storage?.mailboxes_mb ?? storage?.mail_mb), `${account.mailboxes?.length ?? account.mailboxes_count ?? 0} buzones`, "Panel/Nodo"],
        ["Backups", formatMb(storage?.backups_mb), "Backups de aplicaciones", "Panel"],
        ["Temporales", formatMb(storage?.tmp_mb), "/tmp de la cuenta", "Nodo"],
        ["Logs", formatMb(storage?.logs_mb), "Logs de hosting", "Nodo"],
      ]}
    />
  )
}

function MailTab({ account, storage, usage }: { account: HostingAccount; storage: AccountUsage["storage"]; usage: AccountUsage }) {
  const mailboxRows = (account.mailboxes ?? []).map((mailbox) => [
    mailbox.email,
    formatMb(mailbox.used_mb),
    mailbox.quota_mb ? `${percent(mailbox.used_mb, mailbox.quota_mb)}% de ${formatMb(mailbox.quota_mb)}` : "Sin cuota",
    mailbox.status,
  ])
  const mail = usage.mail ?? {}
  const mailEventRows = (mail.events ?? []).map((event) => [
    event.time ? formatDate(event.time) : "",
    event.direction || "",
    event.from || "",
    event.to || "",
    event.status || "En proceso",
    event.code || "Sin código",
    event.detail || "",
  ])
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <CompactList
          title="Resumen de correo"
          rows={[
            ["Buzones", String(account.mailboxes?.length ?? account.mailboxes_count ?? 0)],
            ["Uso total", formatMb(storage?.mailboxes_mb ?? storage?.mail_mb)],
            ["Enviados", formatNumber(mail.sent)],
            ["Recibidos", formatNumber(mail.received)],
            ["Rechazados", formatNumber(mail.rejected)],
            ["Spam", formatNumber(mail.spam)],
          ]}
        />
        <DataTable columns={["Buzón", "Uso", "Cuota", "Estado"]} empty="Sin buzones registrados." rows={mailboxRows} />
      </div>
      <DataTable
        columns={["Fecha", "Tipo", "De", "Para", "Estado", "Código", "Detalle"]}
        empty={mail.warning ? `No se pudo leer el log de correo: ${mail.warning}` : "Sin eventos de correo registrados para este dominio."}
        rows={mailEventRows}
      />
    </div>
  )
}

function ReportsTab({ onExport }: { onExport: (reportName?: string) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {["Resumen ejecutivo", "Consumo de recursos", "Errores HTTP", "Correo", "Almacenamiento", "Comparativo mensual"].map((report) => (
        <div className="rounded-lg border border-slate-200 bg-white p-3" key={report}>
          <FilePieChart className="mb-3 h-5 w-5 text-blue-600" />
          <div className="text-sm font-bold text-slate-900">{report}</div>
          <div className="mt-1 text-xs text-slate-500">Exportación CSV con datos reales actuales.</div>
          <Button className="mt-3" onClick={() => onExport(report.toLowerCase().replaceAll(" ", "-"))} size="sm" variant="outline">
            Generar
          </Button>
        </div>
      ))}
    </div>
  )
}

function ChartPanel({ title, values }: { title: string; values: number[] }) {
  const max = Math.max(...values, 1)
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-bold text-slate-900">{title}</div>
        <div className="text-xs font-semibold text-slate-500">Real</div>
      </div>
      <div className="flex h-56 items-end gap-2 rounded-md bg-slate-50 p-3">
        {values.length ? (
          values.map((value, index) => (
            <div className="flex flex-1 items-end" key={`${value}-${index}`}>
              <div className="w-full rounded-t bg-blue-600/85" style={{ height: `${Math.max(4, (value / max) * 100)}%` }} title={`${index}:00 · ${value}`} />
            </div>
          ))
        ) : (
          <div className="grid h-full w-full place-items-center text-sm font-semibold text-slate-500">Sin datos de tráfico.</div>
        )}
      </div>
    </div>
  )
}

function CompactList({ title, rows, empty = "Sin datos." }: { title: string; rows: string[][]; empty?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 text-sm font-bold text-slate-900">{title}</div>
      <div className="space-y-2">
        {rows.length ? rows.map(([label, value]) => (
          <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm" key={`${label}-${value}`}>
            <span className="truncate font-semibold text-slate-700">{label}</span>
            <span className="shrink-0 font-bold text-slate-900">{value}</span>
          </div>
        )) : <div className="rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500">{empty}</div>}
      </div>
    </div>
  )
}

function ResourceGauge({ label, value, limit }: { label: string; value: number; limit: string }) {
  const normalized = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-slate-900">{label}</div>
          <div className="text-xs text-slate-500">Límite: {limit}</div>
        </div>
        <div className="text-lg font-bold text-slate-900">{normalized}%</div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-100">
        <div className={cn("h-2 rounded-full", normalized >= 90 ? "bg-red-600" : normalized >= 75 ? "bg-amber-500" : "bg-blue-600")} style={{ width: `${normalized}%` }} />
      </div>
    </div>
  )
}

function DataTable({ columns, rows, empty = "Sin datos." }: { columns: string[]; rows: string[][]; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>{columns.map((column) => <th className="px-3 py-2" key={column}>{column}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {rows.length ? rows.map((row) => (
            <tr className="h-[46px] hover:bg-slate-50" key={row.join("-")}>
              {row.map((cell, index) => <td className="max-w-[420px] truncate px-3 py-2 text-slate-700" key={`${cell}-${index}`} title={cell}>{cell}</td>)}
            </tr>
          )) : (
            <tr>
              <td className="px-3 py-8 text-center text-sm font-semibold text-slate-500" colSpan={columns.length}>{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, detail, good = false, muted = false }: { icon: typeof Globe2; label: string; value: string; detail: string; good?: boolean; muted?: boolean }) {
  return (
    <div className="eh-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
          <div className={cn("mt-1 text-2xl font-bold", muted ? "text-slate-500" : "text-slate-900")}>{value}</div>
          <div className={cn("mt-1 truncate text-xs font-bold", good ? "text-emerald-600" : "text-blue-600")}>{detail}</div>
        </div>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-700">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm font-semibold text-slate-500">{text}</div>
}

function percent(value?: number, limit?: number) {
  if (!value || !limit || limit <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((value / limit) * 100)))
}

function formatNumber(value?: number) {
  return new Intl.NumberFormat("es-BO", { maximumFractionDigits: 1 }).format(Number(value ?? 0))
}

function formatMb(value?: number) {
  const amount = Number(value ?? 0)
  if (amount >= 1024) return `${formatNumber(amount / 1024)} GB`
  return `${formatNumber(amount)} MB`
}

function formatBytes(value?: number) {
  return formatMb(Number(value ?? 0) / 1024 / 1024)
}

function limitText(value?: number, suffix = "MB límite") {
  if (!value) return "Sin límite definido"
  return `${formatNumber(value)} ${suffix}`
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" })
}

function filterRows(rows: string[][], query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return rows
  return rows.filter((row) => row.join(" ").toLowerCase().includes(needle))
}
