import {
  Archive,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  Code2,
  Database,
  ExternalLink,
  Folder,
  FolderOpen,
  GitBranch,
  Globe2,
  Info,
  Layers3,
  Package,
  Play,
  RefreshCcw,
  Rocket,
  Search,
  ServerCog,
  Terminal,
  Trash2,
  X,
} from "lucide-react"
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react"

import { hostingApi, type AppCatalogItem, type AppInstallSuggestion, type FileManagerItem, type HostingApplication, type HostingApplicationBackup, type HostingDomain, type LaravelToolkitResult, type NodeToolkitResult, type PythonToolkitResult, type WordPressToolkitResult } from "@/api/hosting"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AppsTab = "Instaladas" | "Catálogo" | "EHPanel App's" | "Actualizaciones" | "Backups" | "Staging"
type RuntimeType = "WordPress" | "Django / Python" | "Node.js" | "Laravel" | "Moodle"

const tabs: AppsTab[] = ["Instaladas", "Catálogo", "EHPanel App's", "Actualizaciones", "Backups", "Staging"]

export function ApplicationsPage() {
  const [activeTab, setActiveTab] = useState<AppsTab>("Instaladas")
  const [selectedRuntime, setSelectedRuntime] = useState<RuntimeType>("WordPress")
  const [apps, setApps] = useState<HostingApplication[]>([])
  const [catalog, setCatalog] = useState<AppCatalogItem[]>([])
  const [domains, setDomains] = useState<HostingDomain[]>([])
  const [backups, setBackups] = useState<HostingApplicationBackup[]>([])
  const [installApp, setInstallApp] = useState<AppCatalogItem | null>(null)
  const [requirementsApp, setRequirementsApp] = useState<AppCatalogItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState("")

  const loadApps = async () => {
    setIsLoading(true)
    try {
      const [appsResponse, catalogResponse, backupsResponse, domainsResponse] = await Promise.all([
        hostingApi.applications(),
        hostingApi.appCatalog(),
        hostingApi.applicationBackups(),
        hostingApi.domains(),
      ])
      setApps(appsResponse.results)
      setCatalog(catalogResponse.apps)
      setBackups(backupsResponse)
      setDomains(domainsResponse.results)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadApps()
  }, [])

  const latestBackupByApp = useMemo(() => {
    const map = new Map<number, HostingApplicationBackup>()
    backups.forEach((backup) => {
      if (!map.has(backup.app)) map.set(backup.app, backup)
    })
    return map
  }, [backups])

  const runAction = async (action: () => Promise<unknown>, success: string) => {
    setMessage("")
    try {
      await action()
      setMessage(success)
      await loadApps()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la solicitud.")
    }
  }

  const appUpdates = apps.map((app) => ({ app, update: app.metadata?.updates as Record<string, unknown> | undefined }))

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-4">
        <AppMetric label="Apps instaladas" value={String(apps.length)} detail="Registradas o detectadas" icon={Package} />
        <AppMetric label="Actualizaciones" value={String(appUpdates.filter((item) => item.update?.update_available).length)} detail="Comprobadas por app" icon={RefreshCcw} />
        <AppMetric label="Backups app" value={String(backups.length)} detail="Copias de aplicaciones" icon={Archive} />
        <AppMetric label="Catálogo" value={String(catalog.length)} detail="Desde Server0" icon={GitBranch} />
      </section>
      {message ? <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{message}</div> : null}

      <section className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-base font-bold">Aplicaciones</h2>
            <p className="text-xs text-slate-500">Instalación, mantenimiento y despliegue de apps por tipo.</p>
          </div>
          <Button onClick={() => void runAction(() => hostingApi.detectApplications(), "Detección enviada al agente.")} size="sm">
            <Rocket className="h-4 w-4" />
            Detectar apps
          </Button>
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
          {activeTab === "Instaladas" && <InstalledAppsTable apps={apps} backups={latestBackupByApp} isLoading={isLoading} onBackup={(app) => void runAction(() => hostingApi.backupApplication(app.id), "Backup solicitado.")} onCheckUpdates={(app) => void runAction(() => hostingApi.checkApplicationUpdates(app.id), "Comprobación de actualizaciones enviada.")} onDelete={(app) => void runAction(() => hostingApi.deleteApplication(app.id), "Eliminación enviada.")} onRestart={(app) => void runAction(() => hostingApi.restartApplication(app.id), "Reinicio enviado.")} />}
          {activeTab === "Catálogo" && <CatalogGrid apps={catalog} onInstall={setInstallApp} onRequirements={setRequirementsApp} />}
          {activeTab === "EHPanel App's" && (
            <EHPanelApps apps={apps} onRefresh={loadApps} selectedRuntime={selectedRuntime} onSelectRuntime={setSelectedRuntime} />
          )}
          {activeTab === "Actualizaciones" && <UpdatesTable rows={appUpdates} onCheck={(app) => void runAction(() => hostingApi.checkApplicationUpdates(app.id), "Comprobación de actualizaciones enviada.")} onUpdate={(app) => void runAction(() => hostingApi.updateApplication(app.id), "ActualizaciÃ³n enviada.")} />}
          {activeTab === "Backups" && <AppBackupsTable backups={backups} onBackup={(appId) => { const app = apps.find((item) => item.id === appId); if (app) void runAction(() => hostingApi.backupApplication(app.id), "Backup solicitado.") }} />}
          {activeTab === "Staging" && <StagingPanel apps={apps} />}
        </div>
      </section>
      {installApp ? (
        <InstallAppModal
          app={installApp}
          domains={domains}
          onClose={() => setInstallApp(null)}
          onInstalled={() => void runAction(async () => undefined, "Instalación enviada al agente.")}
          onRefresh={loadApps}
        />
      ) : null}
      {requirementsApp ? <RequirementsModal app={requirementsApp} onClose={() => setRequirementsApp(null)} /> : null}
    </div>
  )
}

function InstalledAppsTable({
  apps,
  backups,
  isLoading,
  onBackup,
  onCheckUpdates,
  onDelete,
  onRestart,
}: {
  apps: HostingApplication[]
  backups: Map<number, HostingApplicationBackup>
  isLoading: boolean
  onBackup: (app: HostingApplication) => void
  onCheckUpdates: (app: HostingApplication) => void
  onDelete: (app: HostingApplication) => void
  onRestart: (app: HostingApplication) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex h-8 max-w-md items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-500">
        <Search className="h-4 w-4" />
        <input className="h-full min-w-0 flex-1 bg-transparent outline-none" placeholder="Buscar app, dominio o ruta" />
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Aplicación</th>
              <th className="px-3 py-2">Sitio / dominio</th>
              <th className="px-3 py-2">Ruta</th>
              <th className="px-3 py-2">VersiÃ³n</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">ActualizaciÃ³n</th>
              <th className="px-3 py-2">Backup</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {apps.map((app) => (
              <tr className="h-[54px] hover:bg-slate-50" key={app.name}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <AppIcon type={runtimeLabel(app.type)} />
                    <div>
                      <div className="font-bold text-slate-900">{app.name}</div>
                      <div className="text-xs text-slate-500">{runtimeLabel(app.type)}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-700">{app.domain_name}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{app.install_path}</td>
                <td className="px-3 py-2 text-xs font-bold text-slate-700">{app.version || "-"}</td>
                <td className="px-3 py-2"><StatusPill value={appStatusLabel(app.status)} /></td>
                <td className="px-3 py-2 text-xs text-slate-600">{updateLabel(app)}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{backupLabel(backups.get(app.id))}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <IconAction icon={ExternalLink} label="Abrir app" onClick={() => window.open(app.url, "_blank")} />
                    <IconAction icon={RefreshCcw} label="Comprobar updates" onClick={() => onCheckUpdates(app)} />
                    {app.type !== "wordpress" && app.type !== "moodle" ? <IconAction icon={Play} label="Reiniciar" onClick={() => onRestart(app)} /> : null}
                    <IconAction icon={Archive} label="Backup" onClick={() => onBackup(app)} />
                    <IconAction icon={Trash2} label="Eliminar" onClick={() => onDelete(app)} tone="danger" />
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && apps.length === 0 ? (
              <tr><td className="px-3 py-8 text-center text-sm font-semibold text-slate-500" colSpan={8}>No hay aplicaciones registradas. Usa Detectar apps para importar instalaciones manuales.</td></tr>
            ) : null}
            {isLoading ? (
              <tr><td className="px-3 py-8 text-center text-sm font-semibold text-slate-500" colSpan={8}>Cargando aplicaciones...</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CatalogGrid({ apps, onInstall, onRequirements }: { apps: AppCatalogItem[]; onInstall: (app: AppCatalogItem) => void; onRequirements: (app: AppCatalogItem) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {apps.map((app) => (
        <div className="rounded-lg border border-slate-200 bg-white p-3" key={app.slug}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">{app.name}</div>
              <div className="mt-1 text-xs font-semibold text-blue-700">{app.type}</div>
              <div className="mt-2 text-xs text-slate-500">{app.detail}</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-50 text-blue-700">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button onClick={() => onRequirements(app)} size="sm" variant="outline">Requisitos</Button>
            <Button onClick={() => onInstall(app)} size="sm">Instalar</Button>
          </div>
        </div>
      ))}
      {!apps.length ? <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">No hay aplicaciones publicadas en el Catálogo de Server0.</div> : null}
    </div>
  )
}

type InstallForm = {
  domain: string
  name: string
  instance_id: string
  port: string
  working_dir: string
  site_title: string
  admin_user: string
  admin_password: string
  admin_email: string
  language: string
  table_prefix: string
  database_engine: "mariadb" | "postgresql"
  db_name: string
  db_user: string
  db_password: string
  project_module: string
  django_version: string
  workers: string
  php_version: string
  script: string
  node_version: string
  wsgi_module: string
  force_https: boolean
  secure_permissions: boolean
  disable_debug: boolean
  auto_backup_after_install: boolean
}

function InstallAppModal({
  app,
  domains,
  onClose,
  onInstalled,
  onRefresh,
}: {
  app: AppCatalogItem
  domains: HostingDomain[]
  onClose: () => void
  onInstalled: () => void
  onRefresh: () => Promise<void>
}) {
  const [form, setForm] = useState<InstallForm>(() => emptyInstallForm(domains[0], app))
  const [showSuggested, setShowSuggested] = useState(false)
  const [showSecurity, setShowSecurity] = useState(true)
  const [folderPickerOpen, setFolderPickerOpen] = useState(false)
  const [phpVersions, setPhpVersions] = useState<string[]>(["8.3", "8.4", "8.5"])
  const [nodeVersions, setNodeVersions] = useState<string[]>(["system", "20", "22", "24"])
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const domainId = Number(form.domain || domains[0]?.id)
    if (!domainId) return
    let active = true
    setIsLoadingSuggestion(true)
    setError("")
    hostingApi.appInstallSuggestions({ domain: domainId, runtime: app.runtime, name: app.name })
      .then((suggestion) => {
        if (active) {
          setForm(formFromSuggestion(suggestion, app))
          setPhpVersions(suggestion.php_versions?.length ? suggestion.php_versions : ["8.3", "8.4", "8.5"])
          setNodeVersions(suggestion.node_versions?.length ? suggestion.node_versions : ["system", "20", "22", "24"])
        }
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "No se pudieron generar sugerencias.")
      })
      .finally(() => {
        if (active) setIsLoadingSuggestion(false)
      })
    return () => {
      active = false
    }
  }, [app, domains, form.domain])

  const update = (key: keyof InstallForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setError("")
    try {
      await hostingApi.installCatalogApp(payloadFromForm(app.runtime, form))
      await onRefresh()
      onInstalled()
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo iniciar la instalación.")
    } finally {
      setIsSaving(false)
    }
  }

  const installsInDocumentRoot = app.runtime === "wordpress" || app.runtime === "moodle"
  const needsRuntimePath = !installsInDocumentRoot
  const needsDatabase = app.runtime === "wordpress" || app.runtime === "moodle" || app.runtime === "django" || app.runtime === "laravel"
  const selectedDomain = domains.find((domain) => String(domain.id) === form.domain) ?? domains[0] ?? null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <div className="eh-kicker">Catálogo</div>
            <h3 className="text-lg font-bold text-slate-900">Instalar {app.name}</h3>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form className="max-h-[calc(92vh-64px)] overflow-y-auto p-4" onSubmit={submit}>
          {error ? <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <FormSelect label="Dominio" value={form.domain} onChange={(value) => update("domain", value)}>
              {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.domain}</option>)}
            </FormSelect>
            <FormInput label="Nombre de la app" value={form.name} onChange={(value) => update("name", value)} />
            {installsInDocumentRoot ? (
              <>
                <FormInput label="Titulo del sitio" value={form.site_title} onChange={(value) => update("site_title", value)} />
                <FormSelect label="Idioma" value={form.language} onChange={(value) => update("language", value)}>
                  {app.runtime === "moodle" ? (
                    <>
                      <option value="es">Español</option>
                      <option value="en">Inglés</option>
                    </>
                  ) : (
                    <>
                      <option value="es_ES">Español</option>
                      <option value="en_US">Inglés</option>
                    </>
                  )}
                </FormSelect>
                <FormInput label="Usuario administrador" value={form.admin_user} onChange={(value) => update("admin_user", value)} />
                <FormInput label="Email administrador" value={form.admin_email} onChange={(value) => update("admin_email", value)} />
                <FormInput label="Contraseña administrador" type="password" value={form.admin_password} onChange={(value) => update("admin_password", value)} />
                {app.runtime === "moodle" ? (
                  <FormSelect label="Versión PHP" value={form.php_version} onChange={(value) => update("php_version", value)}>
                    {phpVersions.map((version) => <option key={version} value={version}>{version}</option>)}
                  </FormSelect>
                ) : null}
              </>
            ) : null}
            {needsRuntimePath ? (
              <>
                <FormInput label="Instance ID" value={form.instance_id} onChange={(value) => update("instance_id", value)} />
                <FormInput label="Puerto interno" value={form.port} onChange={(value) => update("port", value)} />
                <BrowseInput
                  className="md:col-span-2"
                  label="Directorio de trabajo"
                  onBrowse={() => setFolderPickerOpen(true)}
                  onChange={(value) => update("working_dir", value)}
                  value={form.working_dir}
                />
              </>
            ) : null}
            {app.runtime === "django" ? (
              <>
                <FormInput label="Módulo Django" value={form.project_module} onChange={(value) => update("project_module", value)} />
                <FormInput label="Versión Django" value={form.django_version} onChange={(value) => update("django_version", value)} />
                <FormInput label="Workers" value={form.workers} onChange={(value) => update("workers", value)} />
              </>
            ) : null}
            {app.runtime === "laravel" ? (
              <FormSelect label="Versión PHP" value={form.php_version} onChange={(value) => update("php_version", value)}>
                {phpVersions.map((version) => <option key={version} value={version}>{version}</option>)}
              </FormSelect>
            ) : null}
            {app.runtime === "nodejs" ? (
              <>
                <FormInput label="Script de inicio" value={form.script} onChange={(value) => update("script", value)} />
                <FormSelect label="Versión Node" value={form.node_version || "system"} onChange={(value) => update("node_version", value === "system" ? "" : value)}>
                  {nodeVersions.map((version) => <option key={version} value={version}>{version === "system" ? "Sistema / default" : `Node ${version}`}</option>)}
                </FormSelect>
              </>
            ) : null}
            {app.runtime === "python" ? (
              <>
                <FormInput label="Módulo WSGI" value={form.wsgi_module} onChange={(value) => update("wsgi_module", value)} />
                <FormInput label="Workers" value={form.workers} onChange={(value) => update("workers", value)} />
              </>
            ) : null}
          </div>

          {needsDatabase ? (
            <CollapsibleSection isOpen={showSuggested} onToggle={() => setShowSuggested((value) => !value)} title="Datos sugeridos de base de datos">
              <div className="grid gap-3 md:grid-cols-2">
                {!installsInDocumentRoot ? (
                  <FormSelect label="Motor de base de datos" value={form.database_engine} onChange={(value) => update("database_engine", value)}>
                    <option value="mariadb">MariaDB</option>
                    <option value="postgresql">PostgreSQL</option>
                  </FormSelect>
                ) : null}
                <FormInput label="Base de datos" value={form.db_name} onChange={(value) => update("db_name", value)} />
                <FormInput label="Usuario BD" value={form.db_user} onChange={(value) => update("db_user", value)} />
                <FormInput label="Contraseña BD" type="password" value={form.db_password} onChange={(value) => update("db_password", value)} />
                {installsInDocumentRoot ? <FormInput label="Prefijo de tablas" value={form.table_prefix} onChange={(value) => update("table_prefix", value)} /> : null}
              </div>
            </CollapsibleSection>
          ) : null}

          <CollapsibleSection isOpen={showSecurity} onToggle={() => setShowSecurity((value) => !value)} title="Opciones de seguridad por defecto">
            <div className="grid gap-2 md:grid-cols-2">
              <CheckRow checked={form.force_https} label="Forzar HTTPS" onChange={(value) => update("force_https", value)} />
              <CheckRow checked={form.secure_permissions} label="Permisos seguros" onChange={(value) => update("secure_permissions", value)} />
              <CheckRow checked={form.disable_debug} label="Desactivar debug" onChange={(value) => update("disable_debug", value)} />
              <CheckRow checked={form.auto_backup_after_install} label="Crear backup al terminar" onChange={(value) => update("auto_backup_after_install", value)} />
            </div>
          </CollapsibleSection>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
            <div className="text-xs font-semibold text-slate-500">{isLoadingSuggestion ? "Generando sugerencias..." : "Los valores sugeridos se pueden editar antes de instalar."}</div>
            <div className="flex gap-2">
              <Button onClick={onClose} size="sm" type="button" variant="outline">Cancelar</Button>
              <Button disabled={isSaving || !form.domain || !form.name || isLoadingSuggestion} size="sm" type="submit">
                <Package className="h-4 w-4" />
                {isSaving ? "Instalando..." : "Instalar"}
              </Button>
            </div>
          </div>
        </form>
      </div>
      {folderPickerOpen && selectedDomain ? (
        <AppFolderPickerModal
          accountId={selectedDomain.account}
          accountUsername={selectedDomain.account_username}
          domain={selectedDomain.domain}
          onClose={() => setFolderPickerOpen(false)}
          onSelect={(path) => {
            update("working_dir", `/home/${selectedDomain.account_username}/${path.replace(/^\/+/, "")}`)
            setFolderPickerOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

function RequirementsModal({ app, onClose }: { app: AppCatalogItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="eh-kicker">Requisitos</div>
            <h3 className="text-lg font-bold text-slate-900">{app.name}</h3>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {(app.requirements?.length ? app.requirements : defaultRequirements(app.runtime)).map((item) => (
            <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" key={item}>
              <Info className="h-4 w-4 text-blue-600" />
              {item}
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={onClose} size="sm">Cerrar</Button>
        </div>
      </div>
    </div>
  )
}

function CollapsibleSection({ children, isOpen, onToggle, title }: { children: ReactNode; isOpen: boolean; onToggle: () => void; title: string }) {
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50">
      <button className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-bold text-slate-800" onClick={onToggle} type="button">
        {title}
        <ChevronDown className={cn("h-4 w-4 transition", isOpen ? "rotate-180" : "")} />
      </button>
      {isOpen ? <div className="border-t border-slate-200 p-3">{children}</div> : null}
    </div>
  )
}

function FormInput({ className, label, onChange, type = "text", value }: { className?: string; label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return (
    <label className={cn("grid gap-1 text-xs font-bold text-slate-600", className)}>
      {label}
      <input className="h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400" onChange={(event) => onChange(event.target.value)} type={type} value={value} />
    </label>
  )
}

function BrowseInput({ className, label, onBrowse, onChange, value }: { className?: string; label: string; onBrowse: () => void; onChange: (value: string) => void; value: string }) {
  return (
    <label className={cn("grid gap-1 text-xs font-bold text-slate-600", className)}>
      {label}
      <div className="flex h-9 overflow-hidden rounded-md border border-slate-200 bg-white focus-within:border-blue-400">
        <input className="min-w-0 flex-1 px-3 text-sm font-semibold text-slate-800 outline-none" onChange={(event) => onChange(event.target.value)} value={value} />
        <button className="grid h-9 w-9 place-items-center border-l border-slate-200 text-blue-700 hover:bg-blue-50" onClick={onBrowse} title="Explorar carpetas" type="button">
          <FolderOpen className="h-4 w-4" />
        </button>
      </div>
    </label>
  )
}

function AppFolderPickerModal({
  accountId,
  accountUsername,
  domain,
  onClose,
  onSelect,
}: {
  accountId: string
  accountUsername: string
  domain: string
  onClose: () => void
  onSelect: (path: string) => void
}) {
  const [currentPath, setCurrentPath] = useState("/")
  const [folders, setFolders] = useState<FileManagerItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true
    async function loadFolders() {
      setError("")
      setIsLoading(true)
      try {
        const response = await hostingApi.fileList(accountId, currentPath)
        const completed = await waitFolderResult(response.job, response)
        const items = extractFolderItems(completed).filter((item) => item.type === "dir")
        if (mounted) setFolders(items)
      } catch (loadError) {
        if (mounted) {
          setError(readMessage(loadError))
          setFolders([])
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    void loadFolders()
    return () => {
      mounted = false
    }
  }, [accountId, currentPath])

  const parentPath = currentPath === "/" ? "/" : normalizeFolderPath(currentPath.split("/").slice(0, -1).join("/") || "/")
  const relativeCurrent = toRelativeRoot(currentPath)

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 px-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="eh-kicker">{domain}</div>
            <h3 className="mt-1 truncate text-lg font-bold">Seleccionar carpeta de instalación</h3>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <div className="flex items-center gap-2">
            <Button disabled={currentPath === "/"} onClick={() => setCurrentPath(parentPath)} size="sm" type="button" variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Subir
            </Button>
            <div className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800">
              <span className="block truncate">/home/{accountUsername}/{relativeCurrent}</span>
            </div>
            <Button disabled={currentPath === "/"} onClick={() => onSelect(relativeCurrent)} size="sm" type="button">
              Usar actual
            </Button>
          </div>
        </div>
        <div className="max-h-[420px] overflow-auto px-5 py-4">
          {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
          {isLoading ? <div className="py-8 text-center text-sm font-semibold text-slate-500">Cargando carpetas...</div> : null}
          {!isLoading && !folders.length && !error ? <div className="py-8 text-center text-sm font-semibold text-slate-500">No hay carpetas en esta ruta.</div> : null}
          <div className="space-y-1">
            {folders.map((folder) => {
              const folderPath = normalizeFolderPath(folder.path)
              return (
                <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2" key={folderPath}>
                  <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setCurrentPath(folderPath)} type="button">
                    <Folder className="h-4 w-4 shrink-0 text-blue-600" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900">{folder.name}</span>
                      <span className="block truncate text-xs text-slate-500">/home/{accountUsername}/{toRelativeRoot(folderPath)}</span>
                    </span>
                  </button>
                  <Button onClick={() => onSelect(toRelativeRoot(folderPath))} size="sm" type="button" variant="outline">Usar</Button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function FormSelect({ children, label, onChange, value }: { children: ReactNode; label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="grid gap-1 text-xs font-bold text-slate-600">
      {label}
      <select className="h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400" onChange={(event) => onChange(event.target.value)} value={value}>
        {children}
      </select>
    </label>
  )
}

function CheckRow({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      {label}
    </label>
  )
}

function emptyInstallForm(domain: HostingDomain | undefined, app: AppCatalogItem): InstallForm {
  return {
    domain: domain ? String(domain.id) : "",
    name: app.name,
    instance_id: "",
    port: "",
    working_dir: "",
    site_title: app.name,
    admin_user: "admin",
    admin_password: "",
    admin_email: domain ? `admin@${domain.domain}` : "",
    language: app.runtime === "moodle" ? "es" : "es_ES",
    table_prefix: app.runtime === "moodle" ? "mdl_" : "wp_",
    database_engine: app.runtime === "django" ? "postgresql" : "mariadb",
    db_name: "",
    db_user: "",
    db_password: "",
    project_module: "ehpanelapp",
    django_version: "5.0.*",
    workers: app.runtime === "python" ? "1" : "2",
    php_version: "",
    script: "server.js",
    node_version: "",
    wsgi_module: "app:application",
    force_https: true,
    secure_permissions: true,
    disable_debug: true,
    auto_backup_after_install: false,
  }
}

function formFromSuggestion(suggestion: AppInstallSuggestion, app: AppCatalogItem): InstallForm {
  const siteSuggestion = app.runtime === "moodle" ? suggestion.moodle : suggestion.wordpress
  return {
    domain: String(suggestion.domain),
    name: suggestion.name || app.name,
    instance_id: suggestion.instance_id,
    port: String(suggestion.port),
    working_dir: suggestion.working_dir,
    site_title: siteSuggestion.site_title,
    admin_user: siteSuggestion.admin_user,
    admin_password: siteSuggestion.admin_password,
    admin_email: siteSuggestion.admin_email,
    language: siteSuggestion.language,
    table_prefix: siteSuggestion.table_prefix,
    database_engine: (app.runtime === "moodle" ? suggestion.moodle.database_engine : app.runtime === "django" ? suggestion.django.database_engine : suggestion.laravel.database_engine) || "mariadb",
    db_name: suggestion.database.database,
    db_user: suggestion.database.user,
    db_password: suggestion.database.password,
    project_module: suggestion.django.project_module,
    django_version: suggestion.django.django_version,
    workers: String(app.runtime === "python" ? suggestion.python.workers : suggestion.django.workers),
    php_version: app.runtime === "moodle" ? suggestion.moodle.php_version : suggestion.laravel.php_version,
    script: suggestion.nodejs.script,
    node_version: suggestion.nodejs.node_version,
    wsgi_module: suggestion.python.wsgi_module,
    force_https: suggestion.security.force_https,
    secure_permissions: suggestion.security.secure_permissions,
    disable_debug: suggestion.security.disable_debug,
    auto_backup_after_install: suggestion.security.auto_backup_after_install,
  }
}

function payloadFromForm(runtime: HostingApplication["type"], form: InstallForm) {
  const common = {
    runtime,
    domain: Number(form.domain),
    name: form.name,
    security: {
      force_https: form.force_https,
      secure_permissions: form.secure_permissions,
      disable_debug: form.disable_debug,
      auto_backup_after_install: form.auto_backup_after_install,
    },
  }
  if (runtime === "wordpress" || runtime === "moodle") {
    return {
      ...common,
      site_title: form.site_title,
      admin_user: form.admin_user,
      admin_password: form.admin_password,
      admin_email: form.admin_email,
      language: form.language,
      table_prefix: form.table_prefix,
      php_version: form.php_version,
      db_name: form.db_name,
      db_user: form.db_user,
      db_password: form.db_password,
    }
  }
  const runtimeCommon = {
    ...common,
    instance_id: form.instance_id,
    port: Number(form.port),
    working_dir: form.working_dir,
  }
  if (runtime === "django") {
    return {
      ...runtimeCommon,
      project_module: form.project_module,
      django_version: form.django_version,
      workers: Number(form.workers),
      database_engine: form.database_engine,
      db_name: form.db_name,
      db_user: form.db_user,
      db_password: form.db_password,
    }
  }
  if (runtime === "laravel") {
    return {
      ...runtimeCommon,
      php_version: form.php_version,
      database_engine: form.database_engine,
      db_name: form.db_name,
      db_user: form.db_user,
      db_password: form.db_password,
    }
  }
  if (runtime === "nodejs") return { ...runtimeCommon, script: form.script, node_version: form.node_version }
  return { ...runtimeCommon, wsgi_module: form.wsgi_module, workers: Number(form.workers) }
}

function defaultRequirements(runtime: HostingApplication["type"]) {
  if (runtime === "wordpress") return ["PHP", "MariaDB", "Acceso al document root"]
  if (runtime === "moodle") return ["PHP 8.3+", "MariaDB", "Cron cada 5 minutos", "moodledata fuera del webroot"]
  if (runtime === "laravel") return ["PHP", "Composer", "MariaDB o PostgreSQL"]
  if (runtime === "django") return ["Python", "venv/pip", "MariaDB o PostgreSQL"]
  if (runtime === "nodejs") return ["Node.js", "pnpm/npm", "Puerto interno disponible"]
  return ["Python", "venv/pip", "Puerto interno disponible"]
}

async function waitFolderResult(jobId: string, initial: { status: string; job: string; result?: unknown }) {
  if (initial.status === "success" || initial.status === "failed") return initial

  for (let index = 0; index < 8; index += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 800))
    const job = await hostingApi.job(jobId)
    if (job.status === "success") {
      return { status: "success", job: job.id, result: job.result }
    }
    if (job.status === "failed") {
      throw new Error(job.error_detail || job.error_code || "No se pudo listar las carpetas.")
    }
  }

  return initial
}

function extractFolderItems(response: { items?: FileManagerItem[]; result?: unknown }) {
  if (Array.isArray(response.items)) return response.items
  if (isObject(response.result) && Array.isArray(response.result.items)) return response.result.items as FileManagerItem[]
  return []
}

function normalizeFolderPath(path: string) {
  const value = path.trim()
  if (!value || value === ".") return "/"
  return value.startsWith("/") ? value : `/${value}`
}

function toRelativeRoot(path: string) {
  return normalizeFolderPath(path).replace(/^\/+/, "")
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar la operación."
}

function EHPanelApps({
  apps,
  onRefresh,
  selectedRuntime,
  onSelectRuntime,
}: {
  apps: HostingApplication[]
  onRefresh: () => Promise<void>
  selectedRuntime: RuntimeType
  onSelectRuntime: (runtime: RuntimeType) => void
}) {
  const runtimes: RuntimeType[] = ["WordPress", "Moodle", "Django / Python", "Node.js", "Laravel"]

  return (
    <div className="grid gap-4 xl:grid-cols-[230px_1fr]">
      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
        {runtimes.map((runtime) => (
          <button
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-bold transition",
              selectedRuntime === runtime ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-white hover:text-slate-900",
            )}
            key={runtime}
            onClick={() => onSelectRuntime(runtime)}
            type="button"
          >
            <AppSmallIcon type={runtime} />
            {runtime}
          </button>
        ))}
      </div>
      <RuntimePanel apps={apps} onRefresh={onRefresh} runtime={selectedRuntime} />
    </div>
  )
}

function RuntimePanel({ apps, onRefresh, runtime }: { apps: HostingApplication[]; onRefresh: () => Promise<void>; runtime: RuntimeType }) {
  if (runtime === "WordPress") return <WordPressToolkitPanel apps={apps.filter((app) => app.type === "wordpress")} onRefresh={onRefresh} />
  if (runtime === "Django / Python") return <PythonDjangoToolPanel apps={apps.filter((app) => app.type === "django" || app.type === "python")} onRefresh={onRefresh} />
  if (runtime === "Node.js") return <NodeToolPanel apps={apps.filter((app) => app.type === "nodejs")} onRefresh={onRefresh} />
  if (runtime === "Laravel") return <LaravelToolPanel apps={apps.filter((app) => app.type === "laravel")} onRefresh={onRefresh} />
  if (runtime === "Moodle") return <MoodleToolPanel apps={apps.filter((app) => app.type === "moodle")} />
  return null
}

function MoodleToolPanel({ apps }: { apps: HostingApplication[] }) {
  if (!apps.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500">
        No hay instalaciones Moodle registradas. Usa Detectar apps o instala Moodle desde el catálogo.
      </div>
    )
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {apps.map((app) => (
        <div className="rounded-lg border border-slate-200 bg-white p-4" key={app.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="eh-kicker">{app.domain_name}</div>
              <div className="mt-1 truncate text-base font-bold text-slate-900">{app.name}</div>
              <div className="mt-1 truncate text-xs font-semibold text-slate-500">{app.install_path}</div>
            </div>
            <StatusPill value={appStatusLabel(app.status)} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
            <div className="rounded-md bg-slate-50 p-2">
              <div className="text-slate-400">Versión</div>
              <div className="mt-1 text-slate-900">{app.version || String(app.metadata?.moodle_version || "-")}</div>
            </div>
            <div className="rounded-md bg-slate-50 p-2">
              <div className="text-slate-400">Cron</div>
              <div className="mt-1 truncate text-slate-900">{String(app.metadata?.cron_file || "Configurado al instalar")}</div>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button onClick={() => window.open(app.url, "_blank", "noopener,noreferrer")} size="sm" type="button" variant="outline">
              <ExternalLink className="h-4 w-4" />
              Abrir
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function PythonDjangoToolPanel({ apps, onRefresh }: { apps: HostingApplication[]; onRefresh: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState(apps[0]?.id ? String(apps[0].id) : "")
  const [toolkit, setToolkit] = useState<PythonToolkitResult | null>(null)
  const [repoUrl, setRepoUrl] = useState("")
  const [branch, setBranch] = useState("main")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const selected = apps.find((app) => String(app.id) === selectedId) ?? apps[0] ?? null
  const selectedGit = selected?.metadata?.git as { repo_url?: string; branch?: string } | undefined

  useEffect(() => {
    if (!selectedId && apps[0]?.id) setSelectedId(String(apps[0].id))
  }, [apps, selectedId])

  useEffect(() => {
    setRepoUrl(selectedGit?.repo_url || "")
    setBranch(selectedGit?.branch || "main")
  }, [selected?.id])

  const loadToolkit = async (app = selected) => {
    if (!app) return
    setIsLoading(true)
    setError("")
    setMessage("")
    try {
      const response = await hostingApi.pythonTool(app.id)
      setToolkit(response.result)
    } catch (reason) {
      setError(readMessage(reason))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (selected) void loadToolkit(selected)
  }, [selected?.id])

  const runPythonAction = async (payload: { action: string; repo_url?: string; branch?: string }, success: string) => {
    if (!selected) return
    setIsLoading(true)
    setError("")
    setMessage("")
    try {
      const response = await hostingApi.pythonToolAction(selected.id, payload)
      if (response.result && Object.keys(response.result).length) setToolkit(response.result)
      setMessage(success)
      await onRefresh()
    } catch (reason) {
      setError(readMessage(reason))
    } finally {
      setIsLoading(false)
    }
  }

  if (!apps.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
        No hay instalaciones Django/Python registradas. Usa Detectar apps o instala una app desde el catalogo.
      </div>
    )
  }

  const logs = toolkit?.logs ?? []
  const migrations = toolkit?.migrations ?? []
  const deployCheckOk = toolkit?.deploy_check_ok ?? toolkit?.check_ok

  return (
    <div className="space-y-4">
      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <div>
          <div className="eh-kicker">EHPanel App's</div>
          <div className="mt-1 text-lg font-bold text-slate-900">EHPanel Python Tool</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="h-9 rounded-md border border-slate-200 px-3 text-sm font-bold outline-none" onChange={(event) => setSelectedId(event.target.value)} value={selected ? String(selected.id) : ""}>
            {apps.map((app) => <option key={app.id} value={app.id}>{app.name} - {app.domain_name}</option>)}
          </select>
          <Button disabled={!selected || isLoading} onClick={() => selected && window.open(selected.url, "_blank")} size="sm" variant="outline"><ExternalLink className="h-4 w-4" />Sitio</Button>
          <Button disabled={!selected || isLoading} onClick={() => void loadToolkit()} size="sm"><RefreshCcw className="h-4 w-4" />Actualizar panel</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <WpMetric label="Runtime" value={toolkit?.runtime === "django" ? "Django" : "Python"} detail={toolkit?.python_version || selected?.version || "-"} />
        <WpMetric label="Django" value={toolkit?.django_version || "-"} detail={selected?.metadata?.project_module ? `Modulo ${String(selected.metadata.project_module)}` : "manage.py detectado"} />
        <WpMetric label="Servicio" value={toolkit?.service_status || selected?.status || "-"} detail={toolkit?.service_enabled || toolkit?.service_name || "-"} />
        <WpMetric label="Valkey" value={toolkit?.valkey_ok ? "Activo" : toolkit?.valkey_status || "-"} detail={toolkit?.valkey_ping || "Cache y broker preparado"} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-sm font-bold text-slate-900">Acciones rapidas</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button disabled={isLoading} onClick={() => selected && void hostingApi.backupApplication(selected.id).then(() => setMessage("Backup solicitado.")).then(onRefresh).catch((reason) => setError(readMessage(reason)))} size="sm" variant="outline"><Archive className="h-4 w-4" />Backup</Button>
            <Button disabled={isLoading} onClick={() => selected && void runPythonAction({ action: "restart_service" }, "Servicio reiniciado.")} size="sm" variant="outline"><Play className="h-4 w-4" />Reiniciar</Button>
            <Button disabled={isLoading} onClick={() => void runPythonAction({ action: "check_deploy" }, "Check de Django ejecutado.")} size="sm" variant="outline"><Search className="h-4 w-4" />Check deploy</Button>
            <Button disabled={isLoading || toolkit?.runtime !== "django"} onClick={() => void runPythonAction({ action: "migrate" }, "Migraciones aplicadas.")} size="sm" variant="outline"><Database className="h-4 w-4" />Migrate</Button>
            <Button disabled={isLoading || toolkit?.runtime !== "django"} onClick={() => void runPythonAction({ action: "collectstatic" }, "Archivos estaticos recolectados.")} size="sm" variant="outline"><FolderOpen className="h-4 w-4" />Collectstatic</Button>
            <Button disabled={isLoading} onClick={() => void runPythonAction({ action: "reinstall_requirements" }, "Dependencias reinstaladas.")} size="sm" variant="outline"><Package className="h-4 w-4" />Requirements</Button>
            <Button disabled={isLoading || toolkit?.runtime !== "django"} onClick={() => void runPythonAction({ action: "clear_sessions" }, "Sesiones vencidas limpiadas.")} size="sm" variant="outline"><Terminal className="h-4 w-4" />Clear sessions</Button>
            <Button disabled={isLoading} onClick={() => void runPythonAction({ action: "valkey_ping" }, "Valkey respondio correctamente.")} size="sm" variant="outline"><Rocket className="h-4 w-4" />Valkey ping</Button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-sm font-bold text-slate-900">Git / Deploy update</div>
          <div className="mt-3 grid gap-2">
            <input className="h-9 rounded-md border border-slate-200 px-3 text-sm outline-none" onChange={(event) => setRepoUrl(event.target.value)} placeholder="git@github.com:cliente/proyecto.git" value={repoUrl} />
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <input className="h-9 rounded-md border border-slate-200 px-3 text-sm outline-none" onChange={(event) => setBranch(event.target.value)} placeholder="main" value={branch} />
              <Button disabled={isLoading} onClick={() => void runPythonAction({ action: "git_save", repo_url: repoUrl, branch }, "Configuracion Git guardada.")} size="sm" variant="outline"><GitBranch className="h-4 w-4" />Guardar</Button>
              <Button disabled={isLoading} onClick={() => void runPythonAction({ action: "git_pull", repo_url: repoUrl, branch }, "Deploy update ejecutado.")} size="sm"><RefreshCcw className="h-4 w-4" />Deploy update</Button>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              Recomendado: deploy key por aplicacion o conexion GitHub App. No se debe pedir PAT personal al cliente para deploy automatico.
            </div>
            <div className="grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-3">
              <span>Git: {toolkit?.git_connected ? "conectado" : "no conectado"}</span>
              <span>Rama: {toolkit?.git_branch || branch || "-"}</span>
              <span>Cambios locales: {toolkit?.git_dirty ? "si" : "no"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-sm font-bold text-slate-900">Seguridad y entorno</div>
          <div className="mt-3 grid gap-2">
            <ToggleRow checked={deployCheckOk !== false} label="Django check --deploy sin errores criticos" onToggle={() => void runPythonAction({ action: "check_deploy" }, "Check de Django ejecutado.")} />
            <ToggleRow checked={Boolean(toolkit?.valkey_ok)} label="Valkey disponible para cache, sesiones o colas" onToggle={() => void runPythonAction({ action: "valkey_ping" }, "Valkey respondio correctamente.")} />
            <ToggleRow checked={toolkit?.service_status === "active"} label="Servicio systemd activo" onToggle={() => void runPythonAction({ action: "restart_service" }, "Servicio reiniciado.")} />
          </div>
        </div>
        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-950 p-3 text-white">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
          <div className="relative">
            <div className="eh-kicker text-blue-200">En desarrollo</div>
            <div className="mt-1 text-lg font-bold">EHPanel Python Prime</div>
            <div className="mt-2 text-sm text-slate-200">Plantillas Django, workers, Celery compatible con Valkey, configuraciones de rendimiento y packs premium.</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="eh-kicker text-blue-700">IA en desarrollo</div>
            <div className="mt-1 text-base font-bold text-slate-900">Sugerencias IA para Django/Python</div>
          </div>
          <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-blue-700">Mock</span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <AiSuggestion title="Seguridad" text="Revisar DEBUG, ALLOWED_HOSTS, CSRF_TRUSTED_ORIGINS, SECRET_KEY y permisos de .env antes de produccion." tone="warning" />
          <AiSuggestion title="Rendimiento" text="Usar Valkey para cache, sesiones o colas si el proyecto tiene trafico constante o tareas diferidas." tone="info" />
          <AiSuggestion title="Deploy" text="Conectar Git por deploy key o GitHub App para evitar PAT personales y habilitar webhook por rama." tone="info" />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-sm font-bold text-slate-900">Migraciones</div>
          <pre className="mt-2 max-h-44 overflow-auto rounded-md bg-white p-3 text-xs text-slate-600">{migrations.join("\n") || "Sin plan de migraciones disponible."}</pre>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-sm font-bold text-slate-900">Logs</div>
          <pre className="mt-2 max-h-44 overflow-auto rounded-md bg-white p-3 text-xs text-slate-600">{logs.join("\n") || "Sin logs disponibles."}</pre>
        </div>
      </div>
    </div>
  )
}

function NodeToolPanel({ apps, onRefresh }: { apps: HostingApplication[]; onRefresh: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState(apps[0]?.id ? String(apps[0].id) : "")
  const [toolkit, setToolkit] = useState<NodeToolkitResult | null>(null)
  const [repoUrl, setRepoUrl] = useState("")
  const [branch, setBranch] = useState("main")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const selected = apps.find((app) => String(app.id) === selectedId) ?? apps[0] ?? null
  const selectedGit = selected?.metadata?.git as { repo_url?: string; branch?: string } | undefined

  useEffect(() => {
    if (!selectedId && apps[0]?.id) setSelectedId(String(apps[0].id))
  }, [apps, selectedId])

  useEffect(() => {
    setRepoUrl(selectedGit?.repo_url || "")
    setBranch(selectedGit?.branch || "main")
  }, [selected?.id])

  const loadToolkit = async (app = selected) => {
    if (!app) return
    setIsLoading(true)
    setError("")
    setMessage("")
    try {
      const response = await hostingApi.nodeTool(app.id)
      setToolkit(response.result)
    } catch (reason) {
      setError(readMessage(reason))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (selected) void loadToolkit(selected)
  }, [selected?.id])

  const runNodeAction = async (payload: { action: string; repo_url?: string; branch?: string }, success: string) => {
    if (!selected) return
    setIsLoading(true)
    setError("")
    setMessage("")
    try {
      const response = await hostingApi.nodeToolAction(selected.id, payload)
      if (response.result && Object.keys(response.result).length) setToolkit(response.result)
      setMessage(success)
      await onRefresh()
    } catch (reason) {
      setError(readMessage(reason))
    } finally {
      setIsLoading(false)
    }
  }

  if (!apps.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
        No hay instalaciones Node.js registradas. Usa Detectar apps o instala Node.js desde el catalogo.
      </div>
    )
  }

  const logs = toolkit?.logs ?? []
  const scripts = toolkit?.scripts ?? []

  return (
    <div className="space-y-4">
      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <div>
          <div className="eh-kicker">EHPanel App's</div>
          <div className="mt-1 text-lg font-bold text-slate-900">EHPanel Node Tool</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="h-9 rounded-md border border-slate-200 px-3 text-sm font-bold outline-none" onChange={(event) => setSelectedId(event.target.value)} value={selected ? String(selected.id) : ""}>
            {apps.map((app) => <option key={app.id} value={app.id}>{app.name} - {app.domain_name}</option>)}
          </select>
          <Button disabled={!selected || isLoading} onClick={() => selected && window.open(selected.url, "_blank")} size="sm" variant="outline"><ExternalLink className="h-4 w-4" />Sitio</Button>
          <Button disabled={!selected || isLoading} onClick={() => void loadToolkit()} size="sm"><RefreshCcw className="h-4 w-4" />Actualizar panel</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <WpMetric label="Node.js" value={toolkit?.node_version || selected?.version || "-"} detail={toolkit?.package_name || "Runtime activo"} />
        <WpMetric label="pnpm" value={toolkit?.pnpm_version || toolkit?.package_manager || "-"} detail={toolkit?.lockfile || toolkit?.declared_package_manager || "Gestor seguro"} />
        <WpMetric label="Servicio" value={toolkit?.service_status || selected?.status || "-"} detail={toolkit?.service_enabled || toolkit?.service_name || "-"} />
        <WpMetric label="Valkey" value={toolkit?.valkey_ok ? "Activo" : toolkit?.valkey_status || "-"} detail={toolkit?.valkey_ping || "Cache, colas o sesiones"} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-sm font-bold text-slate-900">Acciones rapidas</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button disabled={isLoading} onClick={() => selected && void hostingApi.backupApplication(selected.id).then(() => setMessage("Backup solicitado.")).then(onRefresh).catch((reason) => setError(readMessage(reason)))} size="sm" variant="outline"><Archive className="h-4 w-4" />Backup</Button>
            <Button disabled={isLoading} onClick={() => void runNodeAction({ action: "restart_service" }, "Servicio reiniciado.")} size="sm" variant="outline"><Play className="h-4 w-4" />Reiniciar</Button>
            <Button disabled={isLoading} onClick={() => void runNodeAction({ action: "install_dependencies" }, "Dependencias instaladas con pnpm.")} size="sm" variant="outline"><Package className="h-4 w-4" />pnpm install</Button>
            <Button disabled={isLoading || !toolkit?.has_build_script} onClick={() => void runNodeAction({ action: "build" }, "Build ejecutado.")} size="sm" variant="outline"><Rocket className="h-4 w-4" />Build</Button>
            <Button disabled={isLoading} onClick={() => void runNodeAction({ action: "audit" }, "Auditoria pnpm ejecutada.")} size="sm" variant="outline"><Search className="h-4 w-4" />pnpm audit</Button>
            <Button disabled={isLoading} onClick={() => void runNodeAction({ action: "valkey_ping" }, "Valkey respondio correctamente.")} size="sm" variant="outline"><Terminal className="h-4 w-4" />Valkey ping</Button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-sm font-bold text-slate-900">Git / Deploy update</div>
          <div className="mt-3 grid gap-2">
            <input className="h-9 rounded-md border border-slate-200 px-3 text-sm outline-none" onChange={(event) => setRepoUrl(event.target.value)} placeholder="git@github.com:cliente/node-app.git" value={repoUrl} />
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <input className="h-9 rounded-md border border-slate-200 px-3 text-sm outline-none" onChange={(event) => setBranch(event.target.value)} placeholder="main" value={branch} />
              <Button disabled={isLoading} onClick={() => void runNodeAction({ action: "git_save", repo_url: repoUrl, branch }, "Configuracion Git guardada.")} size="sm" variant="outline"><GitBranch className="h-4 w-4" />Guardar</Button>
              <Button disabled={isLoading} onClick={() => void runNodeAction({ action: "git_pull", repo_url: repoUrl, branch }, "Deploy update ejecutado.")} size="sm"><RefreshCcw className="h-4 w-4" />Deploy update</Button>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              Node.js usa pnpm para instalar y auditar dependencias. Para repos privados conviene deploy key o GitHub App, no PAT personal.
            </div>
            <div className="grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-3">
              <span>Git: {toolkit?.git_connected ? "conectado" : "no conectado"}</span>
              <span>Rama: {toolkit?.git_branch || branch || "-"}</span>
              <span>Cambios locales: {toolkit?.git_dirty ? "si" : "no"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-sm font-bold text-slate-900">Scripts y paquete</div>
          <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
            <div className="rounded-md border border-slate-200 px-3 py-2">Paquete: {toolkit?.package_name || "-"} {toolkit?.package_version || ""}</div>
            <div className="rounded-md border border-slate-200 px-3 py-2">Start: {toolkit?.has_start_script ? "definido" : "no detectado"}</div>
            <div className="rounded-md border border-slate-200 px-3 py-2">Build: {toolkit?.has_build_script ? "definido" : "no detectado"}</div>
            <div className="rounded-md border border-slate-200 px-3 py-2">Scripts: {scripts.length ? scripts.join(", ") : "sin package.json"}</div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-950 p-3 text-white">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
          <div className="relative">
            <div className="eh-kicker text-blue-200">En desarrollo</div>
            <div className="mt-1 text-lg font-bold">EHPanel Node Prime</div>
            <div className="mt-2 text-sm text-slate-200">Plantillas Next/Nest/Express, workers, colas con Valkey, presets de seguridad y paquetes premium.</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="eh-kicker text-blue-700">IA en desarrollo</div>
            <div className="mt-1 text-base font-bold text-slate-900">Sugerencias IA para Node.js</div>
          </div>
          <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-blue-700">Mock</span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <AiSuggestion title="Dependencias" text="Mantener pnpm-lock.yaml y revisar pnpm audit antes de cada despliegue a produccion." tone="warning" />
          <AiSuggestion title="Proceso" text="Usar systemd por app con puerto interno, logs centralizados y reinicio automatico." tone="info" />
          <AiSuggestion title="Valkey" text="Usar Valkey para sesiones, cache o colas cuando el proyecto requiera workers o tareas asincronas." tone="info" />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-sm font-bold text-slate-900">Auditoria</div>
          <pre className="mt-2 max-h-44 overflow-auto rounded-md bg-white p-3 text-xs text-slate-600">{toolkit?.audit_output || "Ejecuta pnpm audit para cargar resultados."}</pre>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-sm font-bold text-slate-900">Logs</div>
          <pre className="mt-2 max-h-44 overflow-auto rounded-md bg-white p-3 text-xs text-slate-600">{logs.join("\n") || "Sin logs disponibles."}</pre>
        </div>
      </div>
    </div>
  )
}

function LaravelToolPanel({ apps, onRefresh }: { apps: HostingApplication[]; onRefresh: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState(apps[0]?.id ? String(apps[0].id) : "")
  const [toolkit, setToolkit] = useState<LaravelToolkitResult | null>(null)
  const [repoUrl, setRepoUrl] = useState("")
  const [branch, setBranch] = useState("main")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const selected = apps.find((app) => String(app.id) === selectedId) ?? apps[0] ?? null
  const selectedGit = selected?.metadata?.git as { repo_url?: string; branch?: string } | undefined

  useEffect(() => {
    if (!selectedId && apps[0]?.id) setSelectedId(String(apps[0].id))
  }, [apps, selectedId])

  useEffect(() => {
    setRepoUrl(selectedGit?.repo_url || "")
    setBranch(selectedGit?.branch || "main")
  }, [selected?.id])

  const loadToolkit = async (app = selected) => {
    if (!app) return
    setIsLoading(true)
    setError("")
    setMessage("")
    try {
      const response = await hostingApi.laravelTool(app.id)
      setToolkit(response.result)
    } catch (reason) {
      setError(readMessage(reason))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (selected) void loadToolkit(selected)
  }, [selected?.id])

  const runLaravelAction = async (payload: { action: string; repo_url?: string; branch?: string }, success: string) => {
    if (!selected) return
    setIsLoading(true)
    setError("")
    setMessage("")
    try {
      const response = await hostingApi.laravelToolAction(selected.id, payload)
      if (response.result && Object.keys(response.result).length) setToolkit(response.result)
      setMessage(success)
      await onRefresh()
    } catch (reason) {
      setError(readMessage(reason))
    } finally {
      setIsLoading(false)
    }
  }

  if (!apps.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
        No hay instalaciones Laravel registradas. Usa Detectar apps o instala Laravel desde el catalogo.
      </div>
    )
  }

  const logs = [...(toolkit?.laravel_log ?? []), ...(toolkit?.logs ?? [])].filter(Boolean)
  const migrations = toolkit?.migrations ?? []

  return (
    <div className="space-y-4">
      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <div>
          <div className="eh-kicker">EHPanel App's</div>
          <div className="mt-1 text-lg font-bold text-slate-900">EHPanel Laravel Tool</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="h-9 rounded-md border border-slate-200 px-3 text-sm font-bold outline-none" onChange={(event) => setSelectedId(event.target.value)} value={selected ? String(selected.id) : ""}>
            {apps.map((app) => <option key={app.id} value={app.id}>{app.name} - {app.domain_name}</option>)}
          </select>
          <Button disabled={!selected || isLoading} onClick={() => selected && window.open(selected.url, "_blank")} size="sm" variant="outline"><ExternalLink className="h-4 w-4" />Sitio</Button>
          <Button disabled={!selected || isLoading} onClick={() => void loadToolkit()} size="sm"><RefreshCcw className="h-4 w-4" />Actualizar panel</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <WpMetric label="Laravel" value={toolkit?.laravel_version || selected?.version || "-"} detail={toolkit?.package_name || "Framework PHP"} />
        <WpMetric label="PHP" value={toolkit?.php_version || "-"} detail={toolkit?.composer_version || "Composer"} />
        <WpMetric label="PHP-FPM" value={toolkit?.php_fpm_ok ? "OK" : toolkit?.service_status || "-"} detail={toolkit?.storage_linked ? "Storage link activo" : "Storage link pendiente"} />
        <WpMetric label="Valkey" value={toolkit?.valkey_ok ? "Activo" : toolkit?.valkey_status || "-"} detail={toolkit?.valkey_ping || "Cache, colas o sesiones"} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-sm font-bold text-slate-900">Acciones rapidas</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button disabled={isLoading} onClick={() => selected && void hostingApi.backupApplication(selected.id).then(() => setMessage("Backup solicitado.")).then(onRefresh).catch((reason) => setError(readMessage(reason)))} size="sm" variant="outline"><Archive className="h-4 w-4" />Backup</Button>
            <Button disabled={isLoading} onClick={() => void runLaravelAction({ action: "restart_service" }, "PHP-FPM recargado.")} size="sm" variant="outline"><Play className="h-4 w-4" />Reiniciar</Button>
            <Button disabled={isLoading} onClick={() => void runLaravelAction({ action: "composer_install" }, "Dependencias Composer instaladas.")} size="sm" variant="outline"><Package className="h-4 w-4" />Composer install</Button>
            <Button disabled={isLoading} onClick={() => void runLaravelAction({ action: "migrate" }, "Migraciones aplicadas.")} size="sm" variant="outline"><Database className="h-4 w-4" />Migrate</Button>
            <Button disabled={isLoading} onClick={() => void runLaravelAction({ action: "optimize" }, "Laravel optimizado.")} size="sm" variant="outline"><Rocket className="h-4 w-4" />Optimize</Button>
            <Button disabled={isLoading} onClick={() => void runLaravelAction({ action: "cache_clear" }, "Cache limpiada.")} size="sm" variant="outline"><RefreshCcw className="h-4 w-4" />Clear cache</Button>
            <Button disabled={isLoading} onClick={() => void runLaravelAction({ action: "storage_link" }, "Storage link actualizado.")} size="sm" variant="outline"><FolderOpen className="h-4 w-4" />Storage link</Button>
            <Button disabled={isLoading} onClick={() => void runLaravelAction({ action: "composer_audit" }, "Auditoria Composer ejecutada.")} size="sm" variant="outline"><Search className="h-4 w-4" />Audit</Button>
            <Button disabled={isLoading} onClick={() => void runLaravelAction({ action: "key_generate" }, "APP_KEY regenerada.")} size="sm" variant="outline"><Terminal className="h-4 w-4" />Key generate</Button>
            <Button disabled={isLoading} onClick={() => void runLaravelAction({ action: "valkey_ping" }, "Valkey respondio correctamente.")} size="sm" variant="outline"><ServerCog className="h-4 w-4" />Valkey ping</Button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-sm font-bold text-slate-900">Git / Deploy update</div>
          <div className="mt-3 grid gap-2">
            <input className="h-9 rounded-md border border-slate-200 px-3 text-sm outline-none" onChange={(event) => setRepoUrl(event.target.value)} placeholder="git@github.com:cliente/laravel-app.git" value={repoUrl} />
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <input className="h-9 rounded-md border border-slate-200 px-3 text-sm outline-none" onChange={(event) => setBranch(event.target.value)} placeholder="main" value={branch} />
              <Button disabled={isLoading} onClick={() => void runLaravelAction({ action: "git_save", repo_url: repoUrl, branch }, "Configuracion Git guardada.")} size="sm" variant="outline"><GitBranch className="h-4 w-4" />Guardar</Button>
              <Button disabled={isLoading} onClick={() => void runLaravelAction({ action: "git_pull", repo_url: repoUrl, branch }, "Deploy update ejecutado.")} size="sm"><RefreshCcw className="h-4 w-4" />Deploy update</Button>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              Laravel ejecuta composer install, migrate --force, optimize y recarga PHP-FPM despues del pull. Usa deploy key o GitHub App para privados.
            </div>
            <div className="grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-3">
              <span>Git: {toolkit?.git_connected ? "conectado" : "no conectado"}</span>
              <span>Rama: {toolkit?.git_branch || branch || "-"}</span>
              <span>Cambios locales: {toolkit?.git_dirty ? "si" : "no"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-sm font-bold text-slate-900">Entorno</div>
          <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
            <div className="rounded-md border border-slate-200 px-3 py-2">APP_ENV: {toolkit?.app_env || "-"}</div>
            <div className="rounded-md border border-slate-200 px-3 py-2">APP_DEBUG: {toolkit?.app_debug ? "true" : "false"}</div>
            <div className="rounded-md border border-slate-200 px-3 py-2">DB: {toolkit?.db_connection || "-"}</div>
            <div className="rounded-md border border-slate-200 px-3 py-2">Cache: {toolkit?.cache_store || "-"} · Queue: {toolkit?.queue_connection || "-"}</div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-950 p-3 text-white">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
          <div className="relative">
            <div className="eh-kicker text-blue-200">En desarrollo</div>
            <div className="mt-1 text-lg font-bold">EHPanel Laravel Prime</div>
            <div className="mt-2 text-sm text-slate-200">Starter kits, paquetes privados, presets de Horizon/queues con Valkey y plantillas premium.</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="eh-kicker text-blue-700">IA en desarrollo</div>
            <div className="mt-1 text-base font-bold text-slate-900">Sugerencias IA para Laravel</div>
          </div>
          <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-blue-700">Mock</span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <AiSuggestion title="Produccion" text="APP_DEBUG debe estar desactivado, APP_ENV en production y config/cache optimizadas." tone="warning" />
          <AiSuggestion title="Rendimiento" text="Usar Valkey para cache, sesiones o colas cuando el sitio requiera trabajos asincronos." tone="info" />
          <AiSuggestion title="Dependencias" text="Composer audit debe ejecutarse antes del deploy y composer.lock debe mantenerse versionado." tone="info" />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-sm font-bold text-slate-900">Migraciones</div>
          <pre className="mt-2 max-h-44 overflow-auto rounded-md bg-white p-3 text-xs text-slate-600">{migrations.join("\n") || "Sin estado de migraciones disponible."}</pre>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-sm font-bold text-slate-900">Auditoria</div>
          <pre className="mt-2 max-h-44 overflow-auto rounded-md bg-white p-3 text-xs text-slate-600">{toolkit?.audit_output || "Ejecuta Composer audit para cargar resultados."}</pre>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-sm font-bold text-slate-900">Logs</div>
          <pre className="mt-2 max-h-44 overflow-auto rounded-md bg-white p-3 text-xs text-slate-600">{logs.join("\n") || "Sin logs disponibles."}</pre>
        </div>
      </div>
    </div>
  )
}

function UpdatesTable({
  onCheck,
  onUpdate,
  rows,
}: {
  onCheck: (app: HostingApplication) => void
  onUpdate: (app: HostingApplication) => void
  rows: Array<{ app: HostingApplication; update?: Record<string, unknown> }>
}) {
  return (
    <SimpleTable
      columns={["App", "Instalada", "Disponible", "Estado", "Acciones"]}
      rows={rows.map(({ app, update }) => [
        app.name,
        app.version || "-",
        String(update?.latest_version || "-"),
        update?.update_available ? "Disponible" : update ? "Al dÃ­a" : "Sin comprobar",
        <div className="flex justify-end gap-1" key={app.id}>
          <IconAction icon={Search} label="Comprobar" onClick={() => onCheck(app)} />
          <IconAction icon={RefreshCcw} label="Actualizar" onClick={() => onUpdate(app)} />
        </div>,
      ])}
    />
  )
}

function WordPressToolkitPanel({ apps, onRefresh }: { apps: HostingApplication[]; onRefresh: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState(apps[0]?.id ? String(apps[0].id) : "")
  const [toolkit, setToolkit] = useState<WordPressToolkitResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const selected = apps.find((app) => String(app.id) === selectedId) ?? apps[0] ?? null

  useEffect(() => {
    if (!selectedId && apps[0]?.id) setSelectedId(String(apps[0].id))
  }, [apps, selectedId])

  const loadToolkit = async (app = selected) => {
    if (!app) return
    setIsLoading(true)
    setError("")
    setMessage("")
    try {
      const response = await hostingApi.wordpressToolkit(app.id)
      setToolkit(response.result)
    } catch (reason) {
      setError(readMessage(reason))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (selected) void loadToolkit(selected)
  }, [selected?.id])

  const runWpAction = async (payload: { action: string; target?: string; target_type?: string; value?: string }, success: string) => {
    if (!selected) return
    setIsLoading(true)
    setError("")
    setMessage("")
    try {
      const response = await hostingApi.wordpressToolkitAction(selected.id, payload)
      setToolkit(response.result)
      setMessage(success)
      await onRefresh()
    } catch (reason) {
      setError(readMessage(reason))
    } finally {
      setIsLoading(false)
    }
  }

  const plugins = toolkit?.plugins ?? []
  const themes = toolkit?.themes ?? []
  const admins = toolkit?.admin_users ?? []

  if (!apps.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
        No hay instalaciones WordPress registradas. Usa Detectar apps o instala WordPress desde el catálogo.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <div>
          <div className="eh-kicker">EHPanel App's</div>
          <div className="mt-1 text-lg font-bold text-slate-900">EHPanel WP Tool</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="h-9 rounded-md border border-slate-200 px-3 text-sm font-bold outline-none" onChange={(event) => setSelectedId(event.target.value)} value={selected ? String(selected.id) : ""}>
            {apps.map((app) => <option key={app.id} value={app.id}>{app.name} - {app.domain_name}</option>)}
          </select>
          <Button disabled={!selected || isLoading} onClick={() => selected && window.open(selected.url, "_blank")} size="sm" variant="outline"><ExternalLink className="h-4 w-4" />Sitio</Button>
          <Button disabled={!selected || isLoading} onClick={() => selected && window.open(`${selected.url.replace(/\/$/, "")}/wp-admin/`, "_blank")} size="sm" variant="outline"><Globe2 className="h-4 w-4" />Admin</Button>
          <Button disabled={!selected || isLoading} onClick={() => void loadToolkit()} size="sm"><RefreshCcw className="h-4 w-4" />Actualizar panel</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <WpMetric label="Versión WP" value={toolkit?.wp_version || selected?.version || "-"} detail="Core instalado" />
        <WpMetric label="Plugins" value={String(plugins.length)} detail={`${toolkit?.plugin_updates ?? 0} update(s)`} />
        <WpMetric label="Tema activo" value={toolkit?.active_theme || "-"} detail={`${toolkit?.theme_updates ?? 0} update(s) de temas`} />
        <WpMetric label="Estado" value={toolkit?.maintenance_mode ? "Mantenimiento" : "Activo"} detail={toolkit?.search_indexing ? "Indexación permitida" : "Indexación bloqueada"} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-sm font-bold text-slate-900">Acciones rápidas</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button disabled={isLoading} onClick={() => void hostingApi.backupApplication(selected!.id).then(() => setMessage("Backup solicitado.")).then(onRefresh).catch((reason) => setError(readMessage(reason)))} size="sm" variant="outline"><Archive className="h-4 w-4" />Backup</Button>
            <Button disabled={isLoading} onClick={() => void hostingApi.updateApplication(selected!.id).then(() => setMessage("Actualización WordPress enviada.")).then(onRefresh).catch((reason) => setError(readMessage(reason)))} size="sm" variant="outline"><RefreshCcw className="h-4 w-4" />Actualizar todo</Button>
            <Button disabled={isLoading} onClick={() => void runWpAction({ action: toolkit?.maintenance_mode ? "maintenance_off" : "maintenance_on" }, toolkit?.maintenance_mode ? "Modo mantenimiento desactivado." : "Modo mantenimiento activado.")} size="sm" variant="outline"><Terminal className="h-4 w-4" />Mantenimiento</Button>
            <Button disabled={isLoading} onClick={() => void runWpAction({ action: "cache_flush" }, "Caché limpiada.")} size="sm" variant="outline"><Rocket className="h-4 w-4" />Limpiar caché</Button>
            <Button disabled={isLoading} onClick={() => void runWpAction({ action: "integrity_check" }, "Integridad de WordPress comprobada.")} size="sm" variant="outline"><Search className="h-4 w-4" />Integridad</Button>
            <Button disabled={isLoading} onClick={() => void runWpAction({ action: "repair_filesystem" }, "Permisos de WordPress reparados.")} size="sm" variant="outline"><FolderOpen className="h-4 w-4" />Reparar permisos</Button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-sm font-bold text-slate-900">Seguridad y rendimiento</div>
          <div className="mt-3 grid gap-2">
            <ToggleRow checked={!toolkit?.debug_enabled} label="Depuración desactivada" onToggle={() => void runWpAction({ action: "set_debug", value: toolkit?.debug_enabled ? "disable" : "enable" }, "Depuración actualizada.")} />
            <ToggleRow checked={Boolean(toolkit?.search_indexing)} label="Indexación de buscadores" onToggle={() => void runWpAction({ action: "set_indexing", value: toolkit?.search_indexing ? "block" : "allow" }, "Indexación actualizada.")} />
            <ToggleRow checked={Boolean(toolkit?.wp_cron_disabled)} label="WP-Cron controlado por sistema" onToggle={() => void runWpAction({ action: "set_wp_cron", value: toolkit?.wp_cron_disabled ? "enable" : "disable" }, "Control de WP-Cron actualizado.")} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <WpItems title="Plugins" rows={plugins} kind="plugin" onAction={(payload) => runWpAction(payload, "Acción aplicada.")} />
        <WpItems title="Temas" rows={themes} kind="theme" onAction={(payload) => runWpAction(payload, "Acción aplicada.")} />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-sm font-bold text-slate-900">Administradores</div>
          <div className="mt-2 space-y-1">
            {admins.slice(0, 6).map((item) => <div className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700" key={String(item.ID || item.user_login)}>{String(item.user_login || "-")} · {String(item.user_email || "")}</div>)}
            {!admins.length ? <div className="text-sm font-semibold text-slate-500">Sin datos cargados.</div> : null}
          </div>
        </div>
        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-950 p-3 text-white">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
          <div className="relative">
            <div className="eh-kicker text-blue-200">En desarrollo</div>
            <div className="mt-1 text-lg font-bold">EHPanel WP Prime</div>
            <div className="mt-2 text-sm text-slate-200">Temas, plugins y packs exclusivos para clientes premium. Se conectará cuando tengas tu catálogo propio.</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="eh-kicker text-blue-700">IA en desarrollo</div>
            <div className="mt-1 text-base font-bold text-slate-900">Sugerencias IA para WordPress</div>
          </div>
          <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-blue-700">Mock</span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <AiSuggestion title="Rendimiento" text="WP-Cron debería ejecutarse desde cron del sistema si el sitio empieza a recibir tráfico constante." tone="warning" />
          <AiSuggestion title="Seguridad" text="Revisar administradores y activar doble factor cuando el módulo de usuarios avanzados esté disponible." tone="info" />
          <AiSuggestion title="Configuración" text="Validar memory_limit, upload_max_filesize y OPcache según el tipo de sitio y plugins instalados." tone="info" />
        </div>
        <pre className="mt-3 max-h-36 overflow-auto rounded-md bg-white p-3 text-xs leading-5 text-slate-600">
{`[IA MOCK] Analisis pendiente de conectar.
- Core WordPress: version y checksums disponibles.
- Plugins: analizar peso, frecuencia de actualizacion y riesgo.
- Temas: revisar tema activo, child theme y dependencias.
- PHP: sugerir limites segun consumo real.
- Base de datos: detectar tablas autoload pesadas y opciones obsoletas.`}
        </pre>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="text-sm font-bold text-slate-900">Registros WordPress</div>
        <pre className="mt-2 max-h-44 overflow-auto rounded-md bg-white p-3 text-xs text-slate-600">{(toolkit?.debug_log ?? []).join("\n") || "Sin debug.log disponible."}</pre>
      </div>
    </div>
  )
}

function AiSuggestion({ text, title, tone }: { text: string; title: string; tone: "info" | "warning" }) {
  return (
    <div className={cn("rounded-md border bg-white p-3", tone === "warning" ? "border-amber-200" : "border-blue-100")}>
      <div className={cn("text-xs font-bold uppercase tracking-wide", tone === "warning" ? "text-amber-700" : "text-blue-700")}>{title}</div>
      <div className="mt-1 text-sm font-semibold text-slate-700">{text}</div>
    </div>
  )
}

function WpMetric({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 truncate text-base font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{detail}</div>
    </div>
  )
}

function ToggleRow({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <button className="flex h-10 items-center justify-between rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={onToggle} type="button">
      {label}
      <span className={cn("h-5 w-9 rounded-full p-0.5 transition", checked ? "bg-blue-600" : "bg-slate-300")}>
        <span className={cn("block h-4 w-4 rounded-full bg-white transition", checked ? "translate-x-4" : "")} />
      </span>
    </button>
  )
}

function WpItems({ kind, onAction, rows, title }: { kind: "plugin" | "theme"; onAction: (payload: { action: string; target?: string; value?: string }) => Promise<void>; rows: Array<Record<string, unknown>>; title: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-sm font-bold text-slate-900">{title}</div>
      <div className="mt-2 max-h-80 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500">
            <tr><th className="py-2">Nombre</th><th>Estado</th><th>Versión</th><th className="text-right">Acción</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((item) => {
              const name = String(item.name || "")
              const status = String(item.status || "")
              const hasUpdate = String(item.update || "").toLowerCase() !== "none" && String(item.update || "")
              return (
                <tr key={name}>
                  <td className="py-2 font-bold text-slate-800">{String(item.title || name)}</td>
                  <td className="font-semibold text-slate-600">{status || "-"}</td>
                  <td className="font-semibold text-slate-600">{String(item.version || "-")}</td>
                  <td className="py-1">
                    <div className="flex justify-end gap-1">
                      {kind === "plugin" ? <IconAction icon={Play} label={status === "active" ? "Desactivar" : "Activar"} onClick={() => void onAction({ action: status === "active" ? "plugin_deactivate" : "plugin_activate", target: name })} /> : null}
                      {kind === "theme" && status !== "active" ? <IconAction icon={Play} label="Activar tema" onClick={() => void onAction({ action: "theme_activate", target: name })} /> : null}
                      {hasUpdate ? <IconAction icon={RefreshCcw} label="Actualizar" onClick={() => void onAction({ action: kind === "plugin" ? "plugin_update" : "theme_update", target: name })} /> : null}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!rows.length ? <tr><td className="py-6 text-center font-semibold text-slate-500" colSpan={4}>Sin datos cargados.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AppBackupsTable({ backups, onBackup }: { backups: HostingApplicationBackup[]; onBackup: (appId: number) => void }) {
  return (
    <SimpleTable
      columns={["App", "Sitio", "Fecha", "Tamaño", "Estado", "Acciones"]}
      rows={backups.map((backup) => [
        backup.app_name,
        backup.domain_name,
        formatDate(backup.created_at),
        formatBytes(backup.size_bytes),
        backupStatusLabel(backup.status),
        <IconAction icon={Archive} key={backup.id} label="Crear nueva copia" onClick={() => onBackup(backup.app)} />,
      ])}
    />
  )
}

function StagingPanel({ apps }: { apps: HostingApplication[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm font-bold text-slate-900">Crear staging</div>
        <div className="mt-2 text-xs text-slate-500">Clona archivos, base de datos y configuraciÃ³n en un subdominio protegido.</div>
        <div className="mt-4 grid gap-3">
          <select className="h-9 rounded-md border border-slate-200 px-3 text-sm outline-none">
            {apps.map((app) => <option key={app.id}>{app.name} - {app.domain_name}</option>)}
          </select>
          <input className="h-9 rounded-md border border-slate-200 px-3 text-sm outline-none" placeholder="staging.dominio.com" />
          <Button disabled size="sm"><Layers3 className="h-4 w-4" />Crear staging</Button>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-bold text-slate-900">Opciones</div>
        <div className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
          <label className="flex items-center gap-2"><input defaultChecked type="checkbox" />Copiar archivos</label>
          <label className="flex items-center gap-2"><input defaultChecked type="checkbox" />Copiar base de datos</label>
          <label className="flex items-center gap-2"><input defaultChecked type="checkbox" />Bloquear indexaciÃ³n</label>
          <label className="flex items-center gap-2"><input defaultChecked type="checkbox" />Proteger con contraseña</label>
        </div>
      </div>
    </div>
  )
}

function SimpleTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>{columns.map((column) => <th className="px-3 py-2" key={column}>{column}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {rows.map((row, index) => (
            <tr className="h-[48px] hover:bg-slate-50" key={index}>{row.map((cell, cellIndex) => <td className="px-3 py-2 text-slate-700 last:text-right" key={cellIndex}>{cell}</td>)}</tr>
          ))}
          {!rows.length ? <tr><td className="px-3 py-8 text-center text-sm font-semibold text-slate-500" colSpan={columns.length}>Sin registros.</td></tr> : null}
        </tbody>
      </table>
    </div>
  )
}

function AppMetric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Package }) {
  return (
    <div className="eh-card p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{detail}</div>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-50 text-blue-700">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

function AppIcon({ type }: { type: RuntimeType }) {
  return (
    <div className="grid h-8 w-8 place-items-center rounded-md bg-blue-50 text-blue-700">
      <AppSmallIcon type={type} />
    </div>
  )
}

function AppSmallIcon({ type }: { type: RuntimeType }) {
  if (type === "WordPress") return <Globe2 className="h-4 w-4" />
  if (type === "Moodle") return <BookOpen className="h-4 w-4" />
  if (type === "Django / Python") return <Code2 className="h-4 w-4" />
  if (type === "Node.js") return <ServerCog className="h-4 w-4" />
  return <Database className="h-4 w-4" />
}

function StatusPill({ value }: { value: string }) {
  return (
    <span className={cn("rounded-md px-2 py-1 text-xs font-bold", value === "Activo" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
      {value}
    </span>
  )
}

function runtimeLabel(type: HostingApplication["type"]): RuntimeType {
  if (type === "wordpress") return "WordPress"
  if (type === "moodle") return "Moodle"
  if (type === "django" || type === "python") return "Django / Python"
  if (type === "nodejs") return "Node.js"
  return "Laravel"
}

function appStatusLabel(status: HostingApplication["status"]) {
  if (status === "active") return "Activo"
  if (status === "stopped") return "Detenido"
  if (status === "installing") return "Instalando"
  if (status === "failed") return "Error"
  return "Pendiente"
}

function backupStatusLabel(status: HostingApplicationBackup["status"]) {
  if (status === "completed") return "Completado"
  if (status === "running") return "En proceso"
  if (status === "failed") return "Error"
  return "Pendiente"
}

function updateLabel(app: HostingApplication) {
  const update = app.metadata?.updates as Record<string, unknown> | undefined
  if (!update) return "Sin comprobar"
  if (update.update_available) return `${String(update.latest_version || "Nueva versiÃ³n")} disponible`
  return "Al dÃ­a"
}

function backupLabel(backup?: HostingApplicationBackup) {
  if (!backup) return "Sin backup"
  return `${backupStatusLabel(backup.status)} - ${formatDate(backup.created_at)}`
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" })
}

function formatBytes(value: number) {
  if (!value) return "-"
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(value / 1024))} KB`
}

function IconAction({ icon: Icon, label, onClick, tone = "default" }: { icon: typeof ExternalLink; label: string; onClick?: () => void; tone?: "default" | "danger" }) {
  return (
    <button
      aria-label={label}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-md transition",
        tone === "danger" ? "text-red-600 hover:bg-red-50" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

