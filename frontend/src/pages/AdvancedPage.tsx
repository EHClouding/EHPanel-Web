import {
  Activity,
  Archive,
  Database,
  GitBranch,
  History,
  KeyRound,
  Plus,
  RefreshCcw,
  RotateCcw,
  Rocket,
  Search,
  Settings2,
  Terminal,
  Trash2,
  XCircle,
} from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"

import { hostingApi, type AdvancedSummaryResponse, type GitDeployDetection, type GitDeployLogs, type HostingAccount, type HostingAdvancedItem, type HostingAdvancedKind, type HostingApplicationBackup } from "@/api/hosting"
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

type FieldKind = "checkbox" | "select" | "textarea" | "text"

type AdvancedField = {
  help?: string
  key: string
  kind?: FieldKind
  label: string
  multiline?: boolean
  options?: Array<{ label: string; value: string }>
  placeholder: string
  secret?: boolean
  section?: string
}

const defaultGitDeployValues: Record<string, string> = {
  auto_deploy: "true",
  branch: "main",
  database_engine: "postgresql",
  frontend_dist: "dist",
  health_path: "/health",
  package_manager: "auto",
  port: "3001",
  proxy_routes: "/api/,/storage/",
  runtime: "auto",
  serve_frontend: "true",
  spa_fallback: "true",
  working_dir: "apps/app",
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
  const [gitActionLoading, setGitActionLoading] = useState("")
  const [gitLogs, setGitLogs] = useState<GitDeployLogs | null>(null)

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

  async function runGitDeployAction(item: HostingAdvancedItem, action: "deploy" | "rebuild" | "rollback" | "snapshot") {
    if (action === "rebuild" && !window.confirm(`Rebuild completo de "${item.name}"? Se reinstalaran dependencias y se volvera a compilar.`)) return
    if (action === "rollback" && !window.confirm(`Restaurar el frontend anterior de "${item.name}"? EHPanel guardara backup del estado actual antes de restaurar.`)) return
    if (action === "snapshot" && !window.confirm(`Crear snapshot de "${item.name}"? Se guardara version de app, frontend publicado y base de datos si EHPanel la detecta.`)) return
    setGitActionLoading(`${action}:${item.id}`)
    setError("")
    try {
      if (action === "deploy") await hostingApi.deployAdvancedItem(item.id)
      if (action === "rebuild") await hostingApi.rebuildAdvancedItem(item.id)
      if (action === "rollback") await hostingApi.rollbackAdvancedItem(item.id)
      if (action === "snapshot") await hostingApi.snapshotAdvancedItem(item.id)
      await loadSummary()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ejecutar la accion Git.")
    } finally {
      setGitActionLoading("")
    }
  }

  async function openGitLogs(item: HostingAdvancedItem) {
    setGitActionLoading(`logs:${item.id}`)
    setError("")
    try {
      setGitLogs(await hostingApi.advancedItemLogs(item.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los logs.")
    } finally {
      setGitActionLoading("")
    }
  }

  async function restoreGitSnapshot(item: HostingAdvancedItem, snapshot: HostingApplicationBackup) {
    const dbText = snapshot.metadata?.database && typeof snapshot.metadata.database === "object" && (snapshot.metadata.database as Record<string, unknown>).included ? " Incluye restauracion de base de datos." : ""
    if (!window.confirm(`Restaurar "${item.name}" al snapshot ${snapshot.filename || snapshot.id}?${dbText}`)) return
    setGitActionLoading(`restore:${item.id}`)
    setError("")
    try {
      await hostingApi.restoreAdvancedItemSnapshot(item.id, { backup_id: snapshot.id, restore_database: true })
      await loadSummary()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo restaurar el snapshot.")
    } finally {
      setGitActionLoading("")
    }
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
            <p className="text-xs text-slate-500">Deploy desde repositorio, cron, variables, claves, webhooks y configuracion tecnica del sitio.</p>
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
          ) : activeTab === "Git / Deploy" ? (
            <GitDeployTab
              actionLoading={gitActionLoading}
              items={items}
              loading={loading}
              onAdd={() => setModal("git_repo")}
              onDelete={deleteItem}
              onDeploy={(item) => void runGitDeployAction(item, "deploy")}
              onLogs={(item) => void openGitLogs(item)}
              onRebuild={(item) => void runGitDeployAction(item, "rebuild")}
              onRollback={(item) => void runGitDeployAction(item, "rollback")}
              onSnapshot={(item) => void runGitDeployAction(item, "snapshot")}
              onSnapshotRestore={(item, snapshot) => void restoreGitSnapshot(item, snapshot)}
              onToggle={toggleItem}
              search={search}
              setSearch={setSearch}
              summary={summary}
            />
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
      {gitLogs ? <GitDeployLogsModal logs={gitLogs} onClose={() => setGitLogs(null)} /> : null}
    </div>
  )
}

function GitDeployTab({
  actionLoading,
  items,
  loading,
  onAdd,
  onDelete,
  onDeploy,
  onLogs,
  onRebuild,
  onRollback,
  onSnapshot,
  onSnapshotRestore,
  onToggle,
  search,
  setSearch,
  summary,
}: {
  actionLoading: string
  items: HostingAdvancedItem[]
  loading: boolean
  onAdd: () => void
  onDelete: (item: HostingAdvancedItem) => void
  onDeploy: (item: HostingAdvancedItem) => void
  onLogs: (item: HostingAdvancedItem) => void
  onRebuild: (item: HostingAdvancedItem) => void
  onRollback: (item: HostingAdvancedItem) => void
  onSnapshot: (item: HostingAdvancedItem) => void
  onSnapshotRestore: (item: HostingAdvancedItem, snapshot: HostingApplicationBackup) => void
  onToggle: (item: HostingAdvancedItem) => void
  search: string
  setSearch: (value: string) => void
  summary: AdvancedSummaryResponse | null
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <WorkflowStep icon={GitBranch} label="Repositorio" text="URL publica, privada con PAT o SSH deploy key por cuenta." />
        <WorkflowStep icon={Database} label="Autoconfig" text="Ruta, env, PostgreSQL/MariaDB, comandos y frontend estatico." />
        <WorkflowStep icon={Rocket} label="Activacion" text="systemd, Nginx, proxy /api y health check en el dominio." />
      </div>
      <Toolbar actionLabel="Instalar desde Git" disabled={loading} onAction={onAdd} search={search} setSearch={setSearch} />
      {(summary?.apps_with_git || []).length ? (
        <SimpleTable
          columns={["Aplicacion", "Runtime", "Repositorio", "Branch", "Actualizado"]}
          emptyText="Sin apps instaladas desde Git."
          rows={(summary?.apps_with_git || []).map((app) => [
            String(app.app_name || app.app_id),
            String(app.app_type || "-"),
            String(app.repo_url || "-"),
            String(app.branch || "main"),
            formatDate(String(app.updated_at || "")),
          ])}
        />
      ) : null}
      <SimpleTable
        columns={["Nombre", "Detalle", "Estado", "Ultimo deploy", "Acciones"]}
        emptyText="Sin repositorios Git registrados."
        rows={items.map((item) => [
          item.name,
          <ConfigSummary item={item} />,
          <StatusBadge status={item.status} enabled={item.enabled} />,
          <GitDeployLastRun item={item} />,
          <GitDeployActions
            actionLoading={actionLoading}
            item={item}
            onDelete={onDelete}
            onDeploy={onDeploy}
            onLogs={onLogs}
            onRebuild={onRebuild}
            onRollback={onRollback}
            onSnapshot={onSnapshot}
            onToggle={onToggle}
          />,
        ])}
      />
      <GitDeploySnapshots items={items} snapshots={summary?.git_snapshots || []} onRestore={onSnapshotRestore} />
    </div>
  )
}

function GitDeployLastRun({ item }: { item: HostingAdvancedItem }) {
  const commit = item.last_git_commit ? `Commit ${item.last_git_commit}` : "Sin commit registrado"
  const backup = item.rollback_available ? "Rollback disponible" : "Sin backup previo"
  return (
    <div className="space-y-1 text-xs">
      <div className="font-bold text-slate-700">{commit}</div>
      <div className={cn("font-semibold", item.rollback_available ? "text-emerald-700" : "text-slate-500")}>{backup}</div>
      <div className="text-slate-500">{formatDate(item.updated_at)}</div>
    </div>
  )
}

function GitDeployActions({
  actionLoading,
  item,
  onDelete,
  onDeploy,
  onLogs,
  onRebuild,
  onRollback,
  onSnapshot,
  onToggle,
}: {
  actionLoading: string
  item: HostingAdvancedItem
  onDelete: (item: HostingAdvancedItem) => void
  onDeploy: (item: HostingAdvancedItem) => void
  onLogs: (item: HostingAdvancedItem) => void
  onRebuild: (item: HostingAdvancedItem) => void
  onRollback: (item: HostingAdvancedItem) => void
  onSnapshot: (item: HostingAdvancedItem) => void
  onToggle: (item: HostingAdvancedItem) => void
}) {
  const busy = actionLoading.endsWith(`:${item.id}`)
  return (
    <div className="flex min-w-[420px] flex-wrap justify-end gap-1.5">
      <Button disabled={busy || !item.enabled} onClick={() => onDeploy(item)} size="sm" title="Trae los cambios del branch y despliega" variant="outline">
        <RefreshCcw className="h-4 w-4" />
        Actualizar Git
      </Button>
      <Button disabled={busy || !item.enabled} onClick={() => onRebuild(item)} size="sm" title="Reinstala dependencias, recompila y publica de nuevo" variant="outline">
        <Rocket className="h-4 w-4" />
        Rebuild
      </Button>
      <Button disabled={busy || !item.enabled} onClick={() => onSnapshot(item)} size="sm" title="Guarda version de app, frontend y base de datos si se detecta" variant="outline">
        <Archive className="h-4 w-4" />
        Snapshot
      </Button>
      <Button disabled={busy} onClick={() => onLogs(item)} size="sm" title="Ver salida del ultimo job" variant="outline">
        <Terminal className="h-4 w-4" />
        Logs
      </Button>
      <Button disabled={busy || !item.rollback_available} onClick={() => onRollback(item)} size="sm" title="Restaura el frontend anterior respaldado por EHPanel" variant="outline">
        <RotateCcw className="h-4 w-4" />
        Restaurar frontend
      </Button>
      <Button disabled={busy} onClick={() => onToggle(item)} size="sm" title={item.enabled ? "Desactivar deploy" : "Activar deploy"} variant="outline">
        <Settings2 className="h-4 w-4" />
        {item.enabled ? "Desactivar" : "Activar"}
      </Button>
      <Button disabled={busy} onClick={() => onDelete(item)} size="sm" title="Eliminar configuracion Git" variant="outline">
        <Trash2 className="h-4 w-4" />
        Eliminar
      </Button>
    </div>
  )
}

function GitDeploySnapshots({ items, snapshots, onRestore }: { items: HostingAdvancedItem[]; snapshots: HostingApplicationBackup[]; onRestore: (item: HostingAdvancedItem, snapshot: HostingApplicationBackup) => void }) {
  const itemById = new Map(items.map((item) => [item.id, item]))
  const rows = snapshots.slice(0, 10).map((snapshot) => {
    const itemId = Number(snapshot.metadata?.advanced_item_id || 0)
    const item = itemById.get(itemId)
    const database = snapshot.metadata?.database && typeof snapshot.metadata.database === "object" ? snapshot.metadata.database as Record<string, unknown> : {}
    return [
      <div className="flex items-center gap-2" key={`name-${snapshot.id}`}>
        <History className="h-4 w-4 text-blue-700" />
        <div>
          <div className="font-bold text-slate-800">{item?.name || snapshot.app_name}</div>
          <div className="text-xs text-slate-500">{snapshotReason(snapshot.metadata?.snapshot_reason)} · {String(snapshot.metadata?.git_commit || "sin commit")}</div>
        </div>
      </div>,
      formatDate(snapshot.created_at),
      <SnapshotCoverage key={`coverage-${snapshot.id}`} app={Boolean(snapshot.metadata?.includes_app)} frontend={Boolean(snapshot.metadata?.includes_public)} database={Boolean(database.included)} />,
      formatBytes(snapshot.size_bytes),
      <StatusBadge enabled status={snapshot.status} />,
      item ? (
        <Button disabled={snapshot.status !== "completed"} key={`restore-${snapshot.id}`} onClick={() => onRestore(item, snapshot)} size="sm" title="Restaurar app, frontend y base de datos si el snapshot la incluye" variant="outline">
          <RotateCcw className="h-4 w-4" />
          Restaurar
        </Button>
      ) : "-",
    ]
  })
  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-black text-slate-900">Versiones de la app</h3>
        <p className="text-xs font-medium text-slate-500">EHPanel crea snapshots antes de actualizar o reconstruir. Tambien puedes crearlos manualmente con el boton Snapshot.</p>
      </div>
      <SimpleTable
        columns={["Snapshot", "Fecha", "Incluye", "Tamano", "Estado", "Acciones"]}
        emptyText="Aun no hay snapshots de apps Git."
        rows={rows}
      />
    </div>
  )
}

function SnapshotCoverage({ app, frontend, database }: { app: boolean; frontend: boolean; database: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      <CoveragePill active={app} label="App" />
      <CoveragePill active={frontend} label="Frontend" />
      <CoveragePill active={database} label="BD" />
    </div>
  )
}

function CoveragePill({ active, label }: { active: boolean; label: string }) {
  return <span className={cn("rounded-md px-2 py-1 text-xs font-black", active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{label}</span>
}

function snapshotReason(value: unknown) {
  const reason = String(value || "")
  if (reason === "before_deploy") return "Antes de actualizar"
  if (reason === "before_rebuild") return "Antes de rebuild"
  if (reason === "manual") return "Manual"
  return "Snapshot"
}

function WorkflowStep({ icon: Icon, label, text }: { icon: typeof GitBranch; label: string; text: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-50 text-blue-700"><Icon className="h-4 w-4" /></div>
        <div>
          <div className="text-sm font-bold text-slate-900">{label}</div>
          <div className="mt-1 text-xs font-medium leading-5 text-slate-500">{text}</div>
        </div>
      </div>
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

function GitDeployLogsModal({ logs, onClose }: { logs: GitDeployLogs; onClose: () => void }) {
  const job = logs.job
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="eh-kicker">Git / Deploy</div>
            <h3 className="mt-1 text-lg font-bold">Logs de {logs.item.name}</h3>
            <div className="mt-1 text-xs font-semibold text-slate-500">
              {job ? `${job.job_type} - ${job.status} - ${formatDate(job.updated_at || job.finished_at || job.queued_at || "")}` : "Sin job registrado"}
            </div>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {job?.error_detail ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{job.error_detail}</div> : null}
          <div className="grid gap-3 md:grid-cols-3">
            <LogFact label="Commit" value={logs.last_git_commit || "No registrado"} />
            <LogFact label="Rollback frontend" value={logs.rollback_available ? "Disponible" : "No disponible"} />
            <LogFact label="URL" value={logs.app?.url || logs.item.deployed_url || "-"} />
          </div>
          <div className="space-y-3">
            {logs.outputs.length ? logs.outputs.map((output, index) => (
              <div className="rounded-lg border border-slate-200 bg-slate-50" key={`${output.step || "step"}-${index}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
                  <div className="text-sm font-black text-slate-800">{output.step || `Paso ${index + 1}`}</div>
                  <StatusBadge enabled status={Number(output.returncode || 0) === 0 ? "active" : "failed"} />
                </div>
                <div className="grid gap-3 p-3 md:grid-cols-2">
                  <LogBlock label="stdout" value={output.stdout_tail || ""} />
                  <LogBlock label="stderr" value={output.stderr_tail || ""} />
                </div>
              </div>
            )) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm font-semibold text-slate-500">Este job no tiene salida detallada guardada.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function LogFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-bold text-slate-800" title={value}>{value}</div>
    </div>
  )
}

function LogBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</div>
      <pre className="max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">{value || "Sin salida"}</pre>
    </div>
  )
}

function AdvancedModal({ accountId, kind, onClose, onSaved }: { accountId: string; kind: HostingAdvancedKind; onClose: () => void; onSaved: () => void }) {
  const fields = fieldsForKind(kind)
  const [name, setName] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [values, setValues] = useState<Record<string, string>>(() => kind === "git_repo" ? defaultGitDeployValues : {})
  const [detection, setDetection] = useState<GitDeployDetection | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function detectGit() {
    if (kind !== "git_repo") return
    setDetecting(true)
    setError("")
    try {
      const result = await hostingApi.detectGitDeploy({
        account: accountId,
        auth_token: values.auth_token,
        branch: values.branch || "main",
        repo_url: values.repo_url,
      })
      setDetection(result)
      setValues({ ...values, ...result.config, auth_token: values.auth_token })
      if (!name.trim()) {
        const suggested = result.config.instance_id || result.config.repo_url || ""
        setName(String(suggested).replace(/[-_]/g, " "))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo detectar el repositorio.")
    } finally {
      setDetecting(false)
    }
  }

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
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="eh-kicker">Avanzado</div>
            <h3 className="mt-1 text-lg font-bold">Agregar {kindLabels[kind]}</h3>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Nombre visible</span>
            <input className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" onChange={(event) => setName(event.target.value)} placeholder="Nombre para identificar esta configuracion" value={name} />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            {kind === "git_repo" ? (
              <div className="md:col-span-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-900">Preflight Git</div>
                    <div className="text-xs font-medium text-slate-600">Detecta runtime, carpetas, comandos y variables antes de instalar.</div>
                  </div>
                  <Button disabled={detecting || !values.repo_url} onClick={() => void detectGit()} size="sm" type="button" variant="outline">
                    <Search className="h-4 w-4" />{detecting ? "Detectando..." : "Detectar"}
                  </Button>
                </div>
                {detection ? (
                  <div className="mt-3 grid gap-2 text-xs text-slate-700 md:grid-cols-2">
                    <div><span className="font-bold">Runtime:</span> {detection.detected_runtime}</div>
                    <div><span className="font-bold">Confianza:</span> {detection.confidence}</div>
                    {Object.entries(detection.summary || {}).filter(([, value]) => value).map(([key, value]) => (
                      <div key={key}><span className="font-bold">{labelKey(key)}:</span> {String(value)}</div>
                    ))}
                    {detection.warnings?.length ? (
                      <div className="md:col-span-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                        {detection.warnings.join(" ")}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {fields.map((field) => (
              <label className={cn("block", field.multiline ? "md:col-span-2" : "")} key={field.key}>
                <span className="mb-1.5 block text-xs font-bold text-slate-600">{field.label}</span>
                {field.kind === "select" ? (
                  <select className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} value={values[field.key] || ""}>
                    {(field.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ) : field.kind === "checkbox" ? (
                  <button className={cn("flex h-9 w-full items-center justify-between rounded-md border px-3 text-sm font-bold", values[field.key] === "true" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500")} onClick={() => setValues({ ...values, [field.key]: values[field.key] === "true" ? "false" : "true" })} type="button">
                    {values[field.key] === "true" ? "Activo" : "Inactivo"}
                  </button>
                ) : field.multiline || field.kind === "textarea" ? (
                  <textarea className="min-h-[120px] w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-blue-500" onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} placeholder={field.placeholder} value={values[field.key] || ""} />
                ) : (
                  <input className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} placeholder={field.placeholder} type={field.secret ? "password" : "text"} value={values[field.key] || ""} />
                )}
                {field.help ? <span className="mt-1 block text-[11px] font-medium leading-4 text-slate-500">{field.help}</span> : null}
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
          <Button disabled={saving} onClick={() => void save()} size="sm">{kind === "git_repo" ? "Guardar y desplegar" : "Guardar"}</Button>
        </div>
      </div>
    </div>
  )
}

function fieldsForKind(kind: HostingAdvancedKind) {
  const fields: Record<HostingAdvancedKind, AdvancedField[]> = {
    cron: [
      { key: "command", label: "Comando", placeholder: "php artisan schedule:run" },
      { key: "schedule", label: "Frecuencia", placeholder: "*/5 * * * *" },
      { key: "user", label: "Usuario", placeholder: "usuario de la cuenta" },
      { key: "working_dir", label: "Directorio", placeholder: "public_html" },
    ],
    git_repo: [
      { key: "auto_deploy", kind: "checkbox", label: "Instalar y activar", placeholder: "", help: "Clona, instala, construye, crea servicio y publica el dominio." },
      { key: "repo_url", label: "Repositorio Git", placeholder: "https://github.com/cliente/proyecto.git" },
      { key: "branch", label: "Branch", placeholder: "main" },
      { key: "auth_token", label: "Token PAT", placeholder: "github_pat_... / ghp_...", secret: true, help: "Se usa para este deploy y no se guarda en la configuracion avanzada." },
      { key: "runtime", kind: "select", label: "Runtime", options: [{ label: "Auto", value: "auto" }, { label: "Node / Express", value: "node" }, { label: "Django", value: "django" }], placeholder: "auto" },
      { key: "working_dir", label: "Ruta de instalacion", placeholder: "apps/starsystem", help: "Ruta relativa o absoluta dentro de la cuenta hosting." },
      { key: "instance_id", label: "ID app", placeholder: "starsystem" },
      { key: "port", label: "Puerto interno", placeholder: "3001" },
      { key: "backend_dir", label: "Directorio backend", placeholder: "backend" },
      { key: "frontend_dir", label: "Directorio frontend", placeholder: "frontend" },
      { key: "django_settings_module", label: "Django settings", placeholder: "config.settings.production", help: "Auto si manage.py lo declara." },
      { key: "project_module", label: "Modulo proyecto", placeholder: "config" },
      { key: "collectstatic", kind: "checkbox", label: "Collectstatic", placeholder: "" },
      { key: "workers", label: "Workers", placeholder: "2" },
      { key: "package_manager", kind: "select", label: "Package manager", options: [{ label: "Auto", value: "auto" }, { label: "npm", value: "npm" }, { label: "pnpm", value: "pnpm" }, { label: "yarn", value: "yarn" }], placeholder: "auto" },
      { key: "frontend_package_manager", kind: "select", label: "Frontend PM", options: [{ label: "Auto", value: "auto" }, { label: "npm", value: "npm" }, { label: "pnpm", value: "pnpm" }, { label: "yarn", value: "yarn" }], placeholder: "auto" },
      { key: "install_command", label: "Install backend", placeholder: "Auto segun lockfile", help: "Vacio = npm/pnpm/yarn detectado automaticamente." },
      { key: "build_command", label: "Build backend", placeholder: "Auto si existe script build", help: "Vacio = usa el script build si existe." },
      { key: "migrate_command", label: "Migracion", placeholder: "npx prisma migrate deploy" },
      { key: "collectstatic_command", label: "Collectstatic cmd", placeholder: ".venv/bin/python manage.py collectstatic --noinput" },
      { key: "seed_command", label: "Seed opcional", placeholder: "npm run seed" },
      { key: "start_command", label: "Start", placeholder: "Auto script start / node dist/app.js", help: "Vacio = usa script start si existe; si no, node dist/app.js." },
      { key: "frontend_install_command", label: "Install frontend", placeholder: "Auto segun lockfile", help: "Vacio = npm/pnpm/yarn detectado automaticamente." },
      { key: "frontend_build_command", label: "Build frontend", placeholder: "Auto si existe script build", help: "Vacio = usa el script build si existe." },
      { key: "frontend_dist", label: "Dist frontend", placeholder: "dist" },
      { key: "serve_frontend", kind: "checkbox", label: "Publicar frontend", placeholder: "" },
      { key: "spa_fallback", kind: "checkbox", label: "Fallback SPA", placeholder: "", help: "Hace que rutas como /login o /dashboard carguen index.html al refrescar." },
      { key: "proxy_routes", label: "Proxy backend", placeholder: "/api/,/storage/" },
      { key: "health_path", label: "Health check", placeholder: "/health" },
      { key: "database_engine", kind: "select", label: "Base de datos", options: [{ label: "PostgreSQL", value: "postgresql" }, { label: "MariaDB", value: "mariadb" }], placeholder: "postgresql" },
      { key: "db_name", label: "Nombre DB", placeholder: "starsystem_db" },
      { key: "db_user", label: "Usuario DB", placeholder: "starsystem_user" },
      { key: "db_password", label: "Password DB", placeholder: "Password seguro", secret: true, help: "Se usa para crear la DB y no se guarda en la configuracion avanzada." },
      { key: "env_vars", kind: "textarea", label: "Variables .env extra", placeholder: "APP_ENV=production\nJWT_SECRET=...\nJWT_REFRESH_SECRET=...", multiline: true },
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
    auto_deploy: "Auto deploy",
    auth_token: "PAT",
    apache_http: "Apache HTTP",
    apache_https: "Apache HTTPS",
    branch: "Branch",
    backend_dir: "Backend",
    build_command: "Build",
    code: "Tipo",
    command: "Comando",
    collectstatic: "Collectstatic",
    collectstatic_command: "Collectstatic",
    database_engine: "DB",
    deploy_command: "Deploy",
    django_settings_module: "Django settings",
    env_vars: "Env",
    event: "Evento",
    frontend_package_manager: "Frontend PM",
    frontend_dir: "Frontend",
    header: "Header",
    instance_id: "App ID",
    key: "Clave",
    nginx: "Nginx",
    package_manager: "PM",
    port: "Puerto",
    proxy_routes: "Proxy",
    repo_url: "Repo",
    runtime: "Runtime",
    schedule: "Frecuencia",
    scope: "Scope",
    serve_frontend: "Frontend",
    spa_fallback: "SPA fallback",
    source: "Origen",
    start_command: "Start",
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

function formatBytes(value?: number | null) {
  const bytes = Number(value || 0)
  if (!bytes) return "-"
  const units = ["B", "KB", "MB", "GB"]
  let size = bytes
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(index ? 1 : 0)} ${units[index]}`
}
