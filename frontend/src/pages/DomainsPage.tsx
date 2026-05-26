import {
  CalendarDays,
  CheckCircle2,
  Cloud,
  Copy,
  Folder,
  FolderOpen,
  ExternalLink,
  Filter,
  Globe2,
  MoreVertical,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { hostingApi, type FileManagerItem, type HostingAccount, type HostingDomain } from "@/api/hosting"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DomainType = "Principal" | "Adicional" | "Subdominio" | "Parqueado"
type DomainStatus = "Activo" | "Pendiente" | "Error"

type DomainRecord = {
  id: number
  account: string
  domain: string
  type: DomainType
  root: string
  addedAt: string
  status: DomainStatus
  ssl: "Activo" | "Pendiente" | "Error" | "No aplica"
  dns: "Sincronizado" | "Pendiente" | "Error" | "Externo" | "Cloudflare activo" | "Cloudflare inactivo"
  locked?: boolean
  raw: HostingDomain
}

export function DomainsPage() {
  const [domains, setDomains] = useState<DomainRecord[]>([])
  const [accounts, setAccounts] = useState<HostingAccount[]>([])
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<"Todos" | DomainType>("Todos")
  const [statusFilter, setStatusFilter] = useState<"Todos" | DomainStatus>("Todos")
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [detailDomain, setDetailDomain] = useState<DomainRecord | null>(null)
  const [actionDomain, setActionDomain] = useState<DomainRecord | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    account: "",
    domain: "",
    type: "Subdominio" as Exclude<DomainType, "Principal" | "Parqueado"> | "Parqueado",
    root: "",
  })
  const selectedAccount = accounts.find((account) => account.id === form.account) ?? accounts[0] ?? null
  const domainPlaceholder = form.type === "Subdominio" && selectedAccount ? `blog.${selectedAccount.primary_domain}` : selectedAccount?.primary_domain ?? "dominio.com"
  const rootPlaceholder = suggestedDocumentRoot(form.type, form.domain, selectedAccount?.primary_domain)

  const loadDomains = async () => {
    setError("")
    setIsLoading(true)

    try {
      const [domainPage, accountPage] = await Promise.all([hostingApi.domains(), hostingApi.accounts()])
      setDomains(domainPage.results.map(mapDomain))
      setAccounts(accountPage.results)
      setForm((current) => ({ ...current, account: current.account || accountPage.results[0]?.id || "" }))
    } catch (loadError) {
      setError(readMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadDomains())
  }, [])

  const filteredDomains = useMemo(() => {
    return domains.filter((item) => {
      const matchesQuery =
        item.domain.toLowerCase().includes(query.toLowerCase()) ||
        item.root.toLowerCase().includes(query.toLowerCase()) ||
        item.raw.account_domain.toLowerCase().includes(query.toLowerCase())
      const matchesType = typeFilter === "Todos" || item.type === typeFilter
      const matchesStatus = statusFilter === "Todos" || item.status === statusFilter

      return matchesQuery && matchesType && matchesStatus
    })
  }, [domains, query, statusFilter, typeFilter])

  const addDomain = async () => {
    if (!form.account || !form.domain.trim() || !form.root.trim()) return

    setError("")
    setMessage("")
    setIsSaving(true)

    try {
      await hostingApi.createDomain({
        account: form.account,
        document_root: form.root.trim().replace(/^\/+/, ""),
        domain: form.domain.trim(),
        domain_type: toApiDomainType(form.type),
      })
      setMessage("Dominio agregado y tarea de sincronizacion enviada.")
      setForm({ account: form.account, domain: "", type: "Subdominio", root: "" })
      setIsCreateOpen(false)
      await loadDomains()
    } catch (createError) {
      setError(readMessage(createError))
    } finally {
      setIsSaving(false)
    }
  }

  const removeDomain = async (item: DomainRecord) => {
    if (item.locked) return
    if (!window.confirm(`Eliminar ${item.domain}?`)) return

    setError("")
    setMessage("")

    try {
      await hostingApi.deleteDomain(item.id)
      setDomains((current) => current.filter((domain) => domain.id !== item.id))
      setSelectedIds((current) => current.filter((id) => id !== item.id))
      setMessage("Dominio eliminado.")
    } catch (deleteError) {
      setError(readMessage(deleteError))
    }
  }

  const syncDns = async (item: DomainRecord) => {
    setError("")
    setMessage("")

    try {
      const updated = await hostingApi.syncDomainDns(item.id)
      setDomains((current) => current.map((domain) => (domain.id === item.id ? mapDomain(updated) : domain)))
      setMessage(`Sincronizacion DNS enviada para ${item.domain}.`)
      setActionDomain(null)
    } catch (syncError) {
      setError(readMessage(syncError))
    }
  }

  const issueSsl = async (item: DomainRecord) => {
    setError("")
    setMessage("")

    try {
      const updated = await hostingApi.issueDomainSsl(item.id)
      setDomains((current) => current.map((domain) => (domain.id === item.id ? mapDomain(updated) : domain)))
      setMessage(`Emision SSL enviada para ${item.domain}.`)
      setActionDomain(null)
    } catch (sslError) {
      setError(readMessage(sslError))
    }
  }

  const activateWebmail = async (item: DomainRecord) => {
    setError("")
    setMessage("")

    try {
      const response = await hostingApi.activateDomainWebmail(item.id, { force_renewal: true })
      setDomains((current) => current.map((domain) => (domain.id === item.id ? mapDomain(response.domain) : domain)))
      setMessage(`Activacion de Webmail enviada para ${response.webmail_url}.`)
      setActionDomain(null)
    } catch (webmailError) {
      setError(readMessage(webmailError))
    }
  }

  const copyDomain = async (domain: string) => {
    await navigator.clipboard.writeText(domain)
    setMessage(`Dominio copiado: ${domain}`)
  }

  const toggleSelected = (id: number) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-3">
        {domainMetrics(domains).map((metric) => {
          const percentage = domains.length ? Math.round((metric.used / domains.length) * 100) : 0

          return (
            <div className="eh-card p-3" key={metric.label}>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold">{metric.label}</div>
                  <div className="text-xs text-slate-500">{metric.used} registrados en esta cuenta</div>
                </div>
                <div className="grid h-8 w-8 place-items-center rounded-md bg-blue-50 text-blue-600">
                  <Globe2 className="h-4 w-4" />
                </div>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-blue-600" style={{ width: `${percentage}%` }} />
              </div>
            </div>
          )
        })}
      </section>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-base font-bold">Dominios</h2>
            <p className="text-xs text-slate-500">
              Dominio principal, adicionales, subdominios y parqueados.{isLoading ? " Sincronizando..." : ""}
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} size="sm">
            <Plus className="h-4 w-4" />
            Agregar dominio
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex h-8 min-w-[260px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input
              className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar dominio o ruta"
              value={query}
            />
          </div>
          <SelectFilter
            icon={Filter}
            onChange={(value) => setTypeFilter(value as "Todos" | DomainType)}
            options={["Todos", "Principal", "Adicional", "Subdominio", "Parqueado"]}
            value={typeFilter}
          />
          <SelectFilter
            icon={CheckCircle2}
            onChange={(value) => setStatusFilter(value as "Todos" | DomainStatus)}
            options={["Todos", "Activo", "Pendiente", "Error"]}
            value={statusFilter}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-10 px-4 py-2">
                  <input
                    checked={filteredDomains.length > 0 && selectedIds.length === filteredDomains.filter((item) => !item.locked).length}
                    className="h-4 w-4 rounded border-slate-300"
                    onChange={(event) =>
                      setSelectedIds(event.target.checked ? filteredDomains.filter((item) => !item.locked).map((item) => item.id) : [])
                    }
                    type="checkbox"
                  />
                </th>
                <th className="px-2 py-2">Dominio</th>
                <th className="px-2 py-2">Tipo</th>
                <th className="px-2 py-2">Raiz / destino</th>
                <th className="px-2 py-2">Agregado</th>
                <th className="px-2 py-2">Estado</th>
                <th className="px-2 py-2">DNS</th>
                <th className="px-2 py-2">SSL</th>
                <th className="px-2 py-2">Detalle</th>
                <th className="px-4 py-2 text-right">Operar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredDomains.map((item) => (
                <tr className="h-[52px] hover:bg-slate-50" key={item.id}>
                  <td className="px-4 py-2">
                    <input
                      checked={selectedIds.includes(item.id)}
                      className="h-4 w-4 rounded border-slate-300"
                      disabled={item.locked}
                      onChange={() => toggleSelected(item.id)}
                      type="checkbox"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <div className="grid h-7 w-7 place-items-center rounded-md bg-slate-100 text-slate-600">
                        <Globe2 className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                          {item.domain}
                          {item.locked && (
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                              Principal
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">ID #{item.id.toString().padStart(4, "0")}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <span className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                      {item.type}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-600">{item.root}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {item.addedAt}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-2 py-2">
                    <DnsBadge dns={item.dns} />
                  </td>
                  <td className="px-2 py-2">
                    <SslBadge ssl={item.ssl} />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                      onClick={() => setDetailDomain(item)}
                      type="button"
                    >
                      Cargar
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <IconAction icon={ExternalLink} label="Abrir sitio" onClick={() => window.open(`https://${item.domain}`, "_blank")} />
                      <IconAction icon={Copy} label="Copiar dominio" onClick={() => void copyDomain(item.domain)} />
                      <button
                        aria-label="Eliminar dominio"
                        className={cn(
                          "grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-red-50 hover:text-red-600",
                          item.locked && "cursor-not-allowed opacity-35 hover:bg-transparent hover:text-slate-500",
                        )}
                        disabled={item.locked}
                        onClick={() => void removeDomain(item)}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <IconAction icon={MoreVertical} label="Mas opciones" onClick={() => setActionDomain(item)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
          <div>
            Total {filteredDomains.length} registros
            {selectedIds.length ? ` · ${selectedIds.length} seleccionados` : ""}
          </div>
          <div className="flex items-center gap-2">
            <Button disabled size="sm" variant="outline">
              Anterior
            </Button>
            <span className="grid h-8 w-8 place-items-center rounded-md border border-blue-200 bg-blue-50 font-bold text-blue-700">
              1
            </span>
            <Button disabled size="sm" variant="outline">
              Siguiente
            </Button>
          </div>
        </div>
      </section>

      {detailDomain && <DomainDetailModal domain={detailDomain} onClose={() => setDetailDomain(null)} />}

      {actionDomain && (
        <DomainActionsModal
          domain={actionDomain}
          onClose={() => setActionDomain(null)}
          onIssueSsl={() => void issueSsl(actionDomain)}
          onActivateWebmail={() => void activateWebmail(actionDomain)}
          onSyncDns={() => void syncDns(actionDomain)}
        />
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <div className="eh-kicker">Nuevo registro</div>
                <h3 className="mt-1 text-lg font-bold">Agregar dominio</h3>
              </div>
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
                onClick={() => setIsCreateOpen(false)}
                type="button"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>

            <form
              className="space-y-4 px-5 py-4"
              onSubmit={(event) => {
                event.preventDefault()
                void addDomain()
              }}
            >
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">Cuenta hosting</span>
                <select
                  className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  onChange={(event) => setForm((current) => ({ ...current, account: event.target.value }))}
                  value={form.account}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.primary_domain}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">Dominio</span>
                <input
                  className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  onChange={(event) => setForm((current) => ({ ...current, domain: event.target.value }))}
                  placeholder={domainPlaceholder}
                  value={form.domain}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">Tipo</span>
                  <select
                    className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as typeof form.type }))}
                    value={form.type}
                  >
                    <option>Subdominio</option>
                    <option>Adicional</option>
                    <option>Parqueado</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">Estado</span>
                  <input
                    className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500 outline-none"
                    readOnly
                    value="Se sincroniza al guardar"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">Raiz / destino</span>
                <div className="flex gap-2">
                  <input
                    className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    onChange={(event) => setForm((current) => ({ ...current, root: event.target.value }))}
                    placeholder={rootPlaceholder}
                    value={form.root}
                  />
                  <Button onClick={() => setIsDirectoryOpen(true)} size="sm" type="button" variant="outline">
                    <FolderOpen className="h-4 w-4" />
                    Explorar
                  </Button>
                </div>
              </label>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                <Button onClick={() => setIsCreateOpen(false)} size="sm" type="button" variant="outline">
                  Cancelar
                </Button>
                <Button disabled={isSaving || !form.account || !form.domain.trim() || !form.root.trim()} size="sm" type="submit">
                  {isSaving ? "Guardando..." : "Agregar dominio"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDirectoryOpen && (
        <DirectoryPicker
          accountId={form.account}
          accountLabel={selectedAccount?.primary_domain ?? "Cuenta hosting"}
          onClose={() => setIsDirectoryOpen(false)}
          onSelect={(path) => {
            setForm((current) => ({ ...current, root: path }))
            setIsDirectoryOpen(false)
          }}
        />
      )}
    </div>
  )
}

function DirectoryPicker({
  accountId,
  accountLabel,
  onClose,
  onSelect,
}: {
  accountId: string
  accountLabel: string
  onClose: () => void
  onSelect: (path: string) => void
}) {
  const [currentPath, setCurrentPath] = useState("/")
  const [folders, setFolders] = useState<FileManagerItem[]>([])
  const [directoryQuery, setDirectoryQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const filteredDirectories = folders.filter((item) =>
    `${item.name} ${item.path}`.toLowerCase().includes(directoryQuery.toLowerCase()),
  )
  const parentPath = currentPath === "/" ? "/" : normalizeDirectoryPath(currentPath.split("/").slice(0, -1).join("/") || "/")
  const canSelectCurrent = currentPath !== "/"

  useEffect(() => {
    let mounted = true

    async function loadFolders() {
      if (!accountId) {
        setFolders([])
        setIsLoading(false)
        return
      }
      setError("")
      setIsLoading(true)

      try {
        const response = await hostingApi.fileList(accountId, currentPath)
        const completed = await waitDirectoryResult(response.job, response)
        const items = extractDirectoryItems(completed).filter((item) => item.type === "dir")
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

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/55 px-4">
      <div className="w-full max-w-xl rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="eh-kicker">{accountLabel}</div>
            <h3 className="mt-1 text-lg font-bold">Seleccionar raiz</h3>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={currentPath === "/"} onClick={() => setCurrentPath(parentPath)} size="sm" type="button" variant="outline">
              Subir
            </Button>
            <div className="min-w-[180px] flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800">
              <span className="block truncate">{currentPath}</span>
            </div>
            <Button disabled={!canSelectCurrent} onClick={() => onSelect(toRelativeDirectory(currentPath))} size="sm" type="button">
              Usar actual
            </Button>
          </div>
          <div className="mt-2 flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input className="h-full min-w-0 flex-1 bg-transparent outline-none" onChange={(event) => setDirectoryQuery(event.target.value)} placeholder="Buscar carpeta" value={directoryQuery} />
          </div>
        </div>

        <div className="max-h-[330px] overflow-y-auto p-3">
          <div className="space-y-1">
            {error ? <Notice tone="error" text={error} /> : null}
            {isLoading ? <div className="py-8 text-center text-sm font-semibold text-slate-500">Cargando carpetas...</div> : null}
            {!isLoading && !filteredDirectories.length && !error ? (
              <div className="py-8 text-center text-sm font-semibold text-slate-500">No hay carpetas en esta ruta.</div>
            ) : null}
            {filteredDirectories.map((item) => (
              <div
                className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition hover:bg-blue-50"
                key={item.path}
              >
                <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setCurrentPath(normalizeDirectoryPath(item.path))} type="button">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-slate-100 text-slate-600">
                    <Folder className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-900">{item.name}</span>
                    <span className="block truncate text-xs text-slate-500">{normalizeDirectoryPath(item.path)}</span>
                  </span>
                </button>
                <button
                  className="text-xs font-bold text-blue-600"
                  onClick={(event) => {
                    event.stopPropagation()
                    onSelect(toRelativeDirectory(item.path))
                  }}
                  type="button"
                >
                  Usar
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-3">
          <Button onClick={onClose} size="sm" type="button" variant="outline">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}

function DomainDetailModal({ domain, onClose }: { domain: DomainRecord; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="eh-kicker">Detalle dominio</div>
            <h3 className="mt-1 text-lg font-bold">{domain.domain}</h3>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          <InfoLine label="Cuenta" value={domain.raw.account_domain || domain.account} />
          <InfoLine label="Usuario" value={domain.raw.account_username || "-"} />
          <InfoLine label="Servidor" value={domain.raw.node_hostname || "-"} />
          <InfoLine label="DNS" value={domain.raw.dns_status} />
          <InfoLine label="SSL" value={domain.raw.ssl_status} />
          <InfoLine label="Expira SSL" value={domain.raw.ssl_expires_at ? formatDate(domain.raw.ssl_expires_at) : "-"} />
        </div>
      </div>
    </div>
  )
}

function DomainActionsModal({
  domain,
  onClose,
  onIssueSsl,
  onActivateWebmail,
  onSyncDns,
}: {
  domain: DomainRecord
  onClose: () => void
  onIssueSsl: () => void
  onActivateWebmail: () => void
  onSyncDns: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="eh-kicker">Operaciones</div>
            <h3 className="mt-1 text-lg font-bold">{domain.domain}</h3>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-2">
          <Button onClick={onSyncDns} size="sm" variant="outline">
            <Cloud className="h-4 w-4" />
            Sincronizar DNS
          </Button>
          <Button onClick={onIssueSsl} size="sm" variant="outline">
            <ShieldCheck className="h-4 w-4" />
            Emitir SSL
          </Button>
          <Button onClick={onActivateWebmail} size="sm" variant="outline">
            <ExternalLink className="h-4 w-4" />
            Activar Webmail
          </Button>
        </div>
      </div>
    </div>
  )
}

function SelectFilter({
  icon: Icon,
  value,
  options,
  onChange,
}: {
  icon: typeof Filter
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-600">
      <Icon className="h-4 w-4 text-slate-400" />
      <select className="h-full bg-transparent pr-5 text-xs font-semibold outline-none" onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  )
}

function StatusBadge({ status }: { status: DomainStatus }) {
  const className =
    status === "Activo"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Pendiente"
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700"

  return <span className={cn("rounded-md px-2 py-1 text-xs font-bold", className)}>{status}</span>
}

function SslBadge({ ssl }: { ssl: DomainRecord["ssl"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold",
        ssl === "Activo" ? "bg-blue-50 text-blue-700" : ssl === "Error" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600",
      )}
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      {ssl}
    </span>
  )
}

function DnsBadge({ dns }: { dns: DomainRecord["dns"] }) {
  if (dns === "Cloudflare activo" || dns === "Cloudflare inactivo") {
    const active = dns === "Cloudflare activo"

    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold", active ? "bg-orange-50 text-orange-700" : "bg-slate-100 text-slate-500")}>
        <Cloud className={cn("h-3.5 w-3.5", active ? "fill-orange-200 text-orange-500" : "fill-slate-200 text-slate-400")} />
        Cloudflare
      </span>
    )
  }

  return (
    <span
      className={cn(
        "rounded-md px-2 py-1 text-xs font-bold",
        dns === "Sincronizado" ? "bg-emerald-50 text-emerald-700" : dns === "Error" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600",
      )}
    >
      {dns}
    </span>
  )
}

function IconAction({ icon: Icon, label, onClick }: { icon: typeof ExternalLink; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="text-slate-900">{value}</span>
    </div>
  )
}

function Notice({ text, tone }: { text: string; tone: "success" | "error" }) {
  return (
    <div className={cn("rounded-md border px-3 py-2 text-sm font-semibold", tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800")}>
      {text}
    </div>
  )
}

function domainMetrics(domains: DomainRecord[]) {
  return [
    { label: "Subdominios", used: domains.filter((domain) => domain.type === "Subdominio").length },
    { label: "Adicionales", used: domains.filter((domain) => domain.type === "Adicional").length },
    { label: "Parqueados", used: domains.filter((domain) => domain.type === "Parqueado").length },
  ]
}

async function waitDirectoryResult(
  jobId: string,
  initial: { job: string; result?: unknown; status: string; items?: FileManagerItem[] },
) {
  if (initial.status === "success" || initial.status === "failed" || Array.isArray(initial.items)) return initial

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 700))
    const job = await hostingApi.job(jobId)

    if (job.status === "success") {
      return { job: job.id, result: job.result, status: "success" }
    }

    if (job.status === "failed") {
      throw new Error(job.error_detail || job.error_code || "No se pudo listar las carpetas.")
    }
  }

  return initial
}

function extractDirectoryItems(response: { items?: FileManagerItem[]; result?: unknown }) {
  if (Array.isArray(response.items)) return response.items
  if (isRecord(response.result) && Array.isArray(response.result.items)) return response.result.items as FileManagerItem[]
  return []
}

function normalizeDirectoryPath(path: string) {
  const normalized = path.trim().replace(/\\/g, "/").replace(/\/+/g, "/")
  if (!normalized || normalized === ".") return "/"
  return normalized.startsWith("/") ? normalized : `/${normalized}`
}

function toRelativeDirectory(path: string) {
  return normalizeDirectoryPath(path).replace(/^\/+/, "")
}

function suggestedDocumentRoot(type: Exclude<DomainType, "Principal">, domain: string, primaryDomain?: string) {
  const cleanDomain = sanitizePathSegment(domain)
  const primary = primaryDomain ? primaryDomain.toLowerCase() : ""

  if (type === "Subdominio") {
    const subdomain = primary && cleanDomain.endsWith(`.${primary}`) ? cleanDomain.slice(0, -primary.length - 1) : cleanDomain
    return `subdomains/${sanitizePathSegment(subdomain) || "subdominio"}`
  }

  if (type === "Adicional") {
    return `domains/${sanitizePathSegment(cleanDomain).replace(/\./g, "_") || "nuevo_dominio"}`
  }

  return "public_html"
}

function sanitizePathSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/[^a-z0-9._-]/g, "")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function mapDomain(domain: HostingDomain): DomainRecord {
  return {
    account: domain.account,
    addedAt: formatDate(domain.created_at),
    dns: domain.dns_status === "active" ? "Sincronizado" : domain.dns_status === "failed" ? "Error" : "Pendiente",
    domain: domain.domain,
    id: domain.id,
    locked: domain.is_primary,
    raw: domain,
    root: domain.document_root ? `/${domain.document_root.replace(/^\/+/, "")}` : "/public_html",
    ssl: domain.ssl_status === "active" ? "Activo" : domain.ssl_status === "failed" ? "Error" : "Pendiente",
    status: domain.dns_status === "failed" || domain.ssl_status === "failed" ? "Error" : domain.dns_status === "active" ? "Activo" : "Pendiente",
    type: domain.is_primary ? "Principal" : domain.domain_type === "subdomain" ? "Subdominio" : domain.domain_type === "addon" ? "Adicional" : "Parqueado",
  }
}

function toApiDomainType(type: Exclude<DomainType, "Principal">): "alias" | "subdomain" | "addon" {
  if (type === "Subdominio") return "subdomain"
  if (type === "Adicional") return "addon"
  return "alias"
}

function formatDate(value: string) {
  return value ? value.slice(0, 10) : "-"
}

function readMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar la operacion."
}
