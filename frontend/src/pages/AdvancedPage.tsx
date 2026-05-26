import {
  Activity,
  GitBranch,
  KeyRound,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  Terminal,
  Trash2,
  XCircle,
} from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"

import { hostingApi, type AdvancedSummaryResponse, type HostingAccount, type HostingAdvancedItem, type HostingAdvancedKind } from "@/api/hosting"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AdvancedTab =
  | "Git / Deploy"
  | "SSH Keys"
  | "Cron Jobs"
  | "Variables"
  | "Redirecciones"
  | "Headers"
  | "Webhooks"
  | "Jobs"
  | "VHost Manual"

type ModalKind = Exclude<HostingAdvancedKind, "vhost_manual"> | "vhost_manual" | null

const tabs: AdvancedTab[] = ["Git / Deploy", "SSH Keys", "Cron Jobs", "Variables", "Redirecciones", "Headers", "Webhooks", "Jobs", "VHost Manual"]

const tabKind: Partial<Record<AdvancedTab, HostingAdvancedKind>> = {
  "Git / Deploy": "git_repo",
  "SSH Keys": "ssh_key",
  "Cron Jobs": "cron",
  Variables: "variable",
  Redirecciones: "redirect",
  Headers: "header",
  Webhooks: "webhook",
  "VHost Manual": "vhost_manual",
}

const kindLabels: Record<HostingAdvancedKind, string> = {
  cron: "Cron",
  git_repo: "Repositorio Git",
  header: "Header",
  redirect: "Redireccion",
  ssh_key: "Clave SSH",
  variable: "Variable",
  vhost_manual: "VHost manual",
  webhook: "Webhook",
}

export function AdvancedPage() {
  const [activeTab, setActiveTab] = useState<AdvancedTab>("Git / Deploy")
  const [accounts, setAccounts] = useState<HostingAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState("")
  const [summary, setSummary] = useState<AdvancedSummaryResponse | null>(null)
  const [modal, setModal] = useState<ModalKind>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

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
      if (accountId) setSummary(await hostingApi.advancedSummary(accountId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar Avanzado.")
    } finally {
      setLoading(false)
    }
  }

  async function loadSummary(accountId = selectedAccount?.id || selectedAccountId) {
    if (!accountId) return
    setLoading(true)
    setError("")
    try {
      setSelectedAccountId(accountId)
      setSummary(await hostingApi.advancedSummary(accountId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar Avanzado.")
    } finally {
      setLoading(false)
    }
  }

  async function toggleItem(item: HostingAdvancedItem) {
    await hostingApi.toggleAdvancedItem(item.id)
    await loadSummary()
  }

  async function deleteItem(item: HostingAdvancedItem) {
    if (!window.confirm(`Eliminar ${kindLabels[item.kind]} "${item.name}"?`)) return
    await hostingApi.deleteAdvancedItem(item.id)
    await loadSummary()
  }

  useEffect(() => {
    void loadAccounts()
  }, [])

  const items = (summary?.items || []).filter((item) => {
    const kind = tabKind[activeTab]
    if (kind && item.kind !== kind) return false
    if (!search.trim()) return true
    const haystack = `${item.name} ${JSON.stringify(item.masked_config || item.config)}`.toLowerCase()
    return haystack.includes(search.trim().toLowerCase())
  })

  const currentKind = tabKind[activeTab]

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-4">
        <Metric icon={GitBranch} label="Repos" value={String(summary?.counts.git_repo || 0)} detail={`${summary?.apps_with_git.length || 0} apps con Git`} />
        <Metric icon={Terminal} label="Cron" value={String(summary?.counts.cron || 0)} detail="Definidos por cuenta" />
        <Metric icon={KeyRound} label="SSH Keys" value={String(summary?.counts.ssh_key || 0)} detail="Registradas en el panel" />
        <Metric icon={Activity} label="Jobs" value={String(summary?.recent_jobs.length || 0)} detail="Relacionados recientes" />
      </section>

      <section className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-base font-bold">Avanzado</h2>
            <p className="text-xs text-slate-500">Git, cron, variables, claves, webhooks y configuracion tecnica del sitio.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {accounts.length > 1 ? (
              <select
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500"
                onChange={(event) => void loadSummary(event.target.value)}
                value={selectedAccount?.id || ""}
              >
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.primary_domain}</option>)}
              </select>
            ) : null}
            <Button disabled={loading} onClick={() => void loadSummary()} size="sm" variant="outline">
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
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
        </div>

        <div className="p-4">
          {error ? <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}

          {activeTab === "Jobs" ? (
            <JobsTab summary={summary} />
          ) : activeTab === "VHost Manual" ? (
            <VhostManualTab items={items} onAdd={() => setModal("vhost_manual")} onDelete={deleteItem} onToggle={toggleItem} search={search} setSearch={setSearch} />
          ) : (
            <ItemsTab
              items={items}
              kind={currentKind || "git_repo"}
              loading={loading}
              onAdd={() => setModal(currentKind || null)}
              onDelete={deleteItem}
              onToggle={toggleItem}
              search={search}
              setSearch={setSearch}
              summary={summary}
            />
          )}
        </div>
      </section>

      {modal && selectedAccount ? (
        <AdvancedModal
          accountId={selectedAccount.id}
          kind={modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            void loadSummary()
          }}
        />
      ) : null}
    </div>
  )
}

function ItemsTab({
  items,
  kind,
  loading,
  onAdd,
  onDelete,
  onToggle,
  search,
  setSearch,
  summary,
}: {
  items: HostingAdvancedItem[]
  kind: HostingAdvancedKind
  loading: boolean
  onAdd: () => void
  onDelete: (item: HostingAdvancedItem) => void
  onToggle: (item: HostingAdvancedItem) => void
  search: string
  setSearch: (value: string) => void
  summary: AdvancedSummaryResponse | null
}) {
  const appGitRows = kind === "git_repo" ? summary?.apps_with_git || [] : []

  return (
    <div className="space-y-3">
      <Toolbar actionLabel={`Agregar ${kindLabels[kind]}`} disabled={loading} onAction={onAdd} search={search} setSearch={setSearch} />
      {kind === "git_repo" && appGitRows.length ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
          Hay {appGitRows.length} aplicacion(es) con Git guardado desde EHPanel App's. Esta tabla muestra configuraciones avanzadas adicionales por cuenta.
        </div>
      ) : null}
      <SimpleTable
        columns={["Nombre", "Detalle", "Estado", "Actualizado", "Acciones"]}
        emptyText={`Sin ${kindLabels[kind].toLowerCase()} registrados.`}
        rows={items.map((item) => [
          item.name,
          <ConfigSummary item={item} />,
          <StatusBadge status={item.status} enabled={item.enabled} />,
          formatDate(item.updated_at),
          <Actions item={item} onDelete={onDelete} onToggle={onToggle} />,
        ])}
      />
    </div>
  )
}

function VhostManualTab({ items, onAdd, onDelete, onToggle, search, setSearch }: { items: HostingAdvancedItem[]; onAdd: () => void; onDelete: (item: HostingAdvancedItem) => void; onToggle: (item: HostingAdvancedItem) => void; search: string; setSearch: (value: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Zona avanzada. Estos bloques se guardan por cuenta para revision y aplicacion controlada; no se muestran secretos ni rutas internas del nodo.
      </div>
      <Toolbar actionLabel="Agregar vhost manual" onAction={onAdd} search={search} setSearch={setSearch} />
      <SimpleTable
        columns={["Nombre", "Directivas", "Estado", "Actualizado", "Acciones"]}
        emptyText="Sin directivas manuales registradas."
        rows={items.map((item) => [
          item.name,
          <ConfigSummary item={item} />,
          <StatusBadge status={item.status} enabled={item.enabled} />,
          formatDate(item.updated_at),
          <Actions item={item} onDelete={onDelete} onToggle={onToggle} />,
        ])}
      />
    </div>
  )
}

function JobsTab({ summary }: { summary: AdvancedSummaryResponse | null }) {
  return (
    <div className="space-y-3">
      <SimpleTable
        columns={["Job", "Tipo", "Estado", "Inicio", "Fin", "Detalle"]}
        emptyText="Sin jobs recientes relacionados."
        rows={(summary?.recent_jobs || []).map((job) => [
          job.id.slice(0, 8),
          job.job_type,
          <StatusBadge enabled status={job.status} />,
          formatDate(job.queued_at),
          formatDate(job.finished_at),
          job.error_detail || job.error_code || "Sin errores",
        ])}
      />
      <SimpleTable
        columns={["Fecha", "Accion", "Usuario", "Detalle"]}
        emptyText="Sin auditoria reciente."
        rows={(summary?.recent_audit || []).map((entry) => [
          formatDate(String(entry.created_at || "")),
          String(entry.action || ""),
          String(entry.user_username || "system"),
          String(entry.target_label || entry.path || ""),
        ])}
      />
    </div>
  )
}

function Toolbar({ actionLabel, disabled, onAction, search, setSearch }: { actionLabel: string; disabled?: boolean; onAction?: () => void; search: string; setSearch: (value: string) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex h-8 min-w-[260px] items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-500">
        <Search className="h-4 w-4" />
        <input className="h-full min-w-0 flex-1 bg-transparent outline-none" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" value={search} />
      </div>
      <Button disabled={disabled} onClick={onAction} size="sm">
        <Plus className="h-4 w-4" />
        {actionLabel}
      </Button>
    </div>
  )
}

function SimpleTable({ columns, rows, emptyText }: { columns: string[]; rows: (string | ReactNode)[][]; emptyText: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>{columns.map((column) => <th className="px-3 py-2 last:text-right" key={column}>{column}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {rows.length ? rows.map((row, index) => (
            <tr className="h-[52px] hover:bg-slate-50" key={index}>
              {row.map((cell, cellIndex) => <td className="max-w-[340px] px-3 py-2 text-slate-700 last:text-right" key={cellIndex}>{cell}</td>)}
            </tr>
          )) : (
            <tr><td className="px-3 py-6 text-center text-sm text-slate-500" colSpan={columns.length}>{emptyText}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Actions({ item, onDelete, onToggle }: { item: HostingAdvancedItem; onDelete: (item: HostingAdvancedItem) => void; onToggle: (item: HostingAdvancedItem) => void }) {
  return (
    <div className="flex justify-end gap-1">
      <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" onClick={() => onToggle(item)} title={item.enabled ? "Desactivar" : "Activar"} type="button">
        <Settings2 className="h-4 w-4" />
      </button>
      <button className="grid h-8 w-8 place-items-center rounded-md text-red-500 transition hover:bg-red-50 hover:text-red-700" onClick={() => onDelete(item)} title="Eliminar" type="button">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function ConfigSummary({ item }: { item: HostingAdvancedItem }) {
  const config = item.masked_config || item.config || {}
  const pieces = Object.entries(config)
    .filter(([, value]) => value !== "" && value !== null && value !== undefined)
    .slice(0, 4)
    .map(([key, value]) => `${labelKey(key)}: ${String(value)}`)
  return <div className="line-clamp-2 text-xs text-slate-600">{pieces.join(" · ") || "Sin detalle adicional"}</div>
}

function AdvancedModal({ accountId, kind, onClose, onSaved }: { accountId: string; kind: HostingAdvancedKind; onClose: () => void; onSaved: () => void }) {
  const fields = fieldsForKind(kind)
  const [name, setName] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function save() {
    setSaving(true)
    setError("")
    try {
      await hostingApi.createAdvancedItem({
        account: accountId,
        config: values,
        enabled,
        kind,
        name: name.trim() || values.key || values.repo_url || values.command || kindLabels[kind],
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="eh-kicker">Avanzado</div>
            <h3 className="mt-1 text-lg font-bold">Agregar {kindLabels[kind]}</h3>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Nombre visible</span>
            <input className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" onChange={(event) => setName(event.target.value)} placeholder="Nombre para identificar esta configuracion" value={name} />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map((field) => (
              <label className={cn("block", field.multiline ? "md:col-span-2" : "")} key={field.key}>
                <span className="mb-1.5 block text-xs font-bold text-slate-600">{field.label}</span>
                {field.multiline ? (
                  <textarea className="min-h-[120px] w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-blue-500" onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} placeholder={field.placeholder} value={values[field.key] || ""} />
                ) : (
                  <input className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} placeholder={field.placeholder} type={field.secret ? "password" : "text"} value={values[field.key] || ""} />
                )}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            <input checked={enabled} onChange={(event) => setEnabled(event.target.checked)} type="checkbox" />
            Activo
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button disabled={saving} onClick={onClose} size="sm" variant="outline">Cancelar</Button>
          <Button disabled={saving} onClick={() => void save()} size="sm">Guardar</Button>
        </div>
      </div>
    </div>
  )
}

function fieldsForKind(kind: HostingAdvancedKind) {
  const fields: Record<HostingAdvancedKind, Array<{ key: string; label: string; placeholder: string; secret?: boolean; multiline?: boolean }>> = {
    cron: [
      { key: "command", label: "Comando", placeholder: "php artisan schedule:run" },
      { key: "schedule", label: "Frecuencia", placeholder: "*/5 * * * *" },
      { key: "user", label: "Usuario", placeholder: "usuario de la cuenta" },
      { key: "working_dir", label: "Directorio", placeholder: "public_html" },
    ],
    git_repo: [
      { key: "repo_url", label: "Repositorio Git", placeholder: "https://github.com/cliente/proyecto.git" },
      { key: "branch", label: "Branch", placeholder: "main" },
      { key: "build_command", label: "Comando build", placeholder: "pnpm install && pnpm build" },
      { key: "deploy_command", label: "Comando deploy", placeholder: "rsync -a dist/ public_html/" },
      { key: "webhook_secret", label: "Webhook secret", placeholder: "Secreto firmado", secret: true },
    ],
    header: [
      { key: "header", label: "Header", placeholder: "X-Frame-Options" },
      { key: "value", label: "Valor", placeholder: "SAMEORIGIN" },
      { key: "scope", label: "Scope", placeholder: "Dominio / ruta / app" },
    ],
    redirect: [
      { key: "source", label: "Origen", placeholder: "/old" },
      { key: "target", label: "Destino", placeholder: "/new" },
      { key: "code", label: "Tipo", placeholder: "301 / 302 / proxy" },
      { key: "conditions", label: "Condiciones", placeholder: "Solo GET" },
    ],
    ssh_key: [
      { key: "key_type", label: "Tipo", placeholder: "Deploy key / Autorizada" },
      { key: "fingerprint", label: "Fingerprint", placeholder: "SHA256:..." },
      { key: "public_key", label: "Clave publica", placeholder: "ssh-ed25519 ...", multiline: true },
    ],
    variable: [
      { key: "key", label: "Nombre", placeholder: "APP_ENV" },
      { key: "value", label: "Valor", placeholder: "production", secret: true },
      { key: "scope", label: "Scope", placeholder: "sitio / app / deploy" },
    ],
    vhost_manual: [
      { key: "apache_http", label: "Apache HTTP", placeholder: "Directivas HTTP", multiline: true },
      { key: "apache_https", label: "Apache HTTPS", placeholder: "Directivas HTTPS", multiline: true },
      { key: "nginx", label: "Nginx", placeholder: "Directivas Nginx", multiline: true },
      { key: "php_fpm", label: "PHP-FPM", placeholder: "Directivas PHP-FPM", multiline: true },
    ],
    webhook: [
      { key: "event", label: "Evento", placeholder: "deploy.completed" },
      { key: "url", label: "URL", placeholder: "https://hooks.cliente.com/deploy" },
      { key: "secret", label: "Secret", placeholder: "Secreto de firma", secret: true },
    ],
  }
  return fields[kind]
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof GitBranch; label: string; value: string; detail: string }) {
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

function StatusBadge({ enabled, status }: { enabled: boolean; status: string }) {
  const label = !enabled ? "Desactivado" : statusLabel(status)
  const tone = !enabled ? "bg-slate-100 text-slate-600" : status === "active" || status === "success" ? "bg-emerald-50 text-emerald-700" : status === "failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-black", tone)}>{label}</span>
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    active: "Activo",
    canceled: "Cancelado",
    disabled: "Desactivado",
    expired: "Expirado",
    failed: "Error",
    pending: "Pendiente",
    queued: "En cola",
    running: "En ejecucion",
    sent: "Enviado",
    success: "Correcto",
  }
  return labels[value] || value || "Sin datos"
}

function labelKey(key: string) {
  const labels: Record<string, string> = {
    apache_http: "Apache HTTP",
    apache_https: "Apache HTTPS",
    branch: "Branch",
    build_command: "Build",
    code: "Tipo",
    command: "Comando",
    deploy_command: "Deploy",
    event: "Evento",
    header: "Header",
    key: "Clave",
    nginx: "Nginx",
    repo_url: "Repo",
    schedule: "Frecuencia",
    scope: "Scope",
    source: "Origen",
    target: "Destino",
    url: "URL",
    user: "Usuario",
    value: "Valor",
    working_dir: "Directorio",
  }
  return labels[key] || key
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("es-BO", { dateStyle: "medium", timeStyle: "short" })
}
