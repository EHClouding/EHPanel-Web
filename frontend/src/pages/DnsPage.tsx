import {
  CheckCircle2,
  Clock3,
  FileDown,
  Filter,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ServerCog,
  Trash2,
  XCircle,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react"

import { Button } from "@/components/ui/button"
import { hostingApi, type DnsRecordType, type HostingDnsRecord, type HostingDomain } from "@/api/hosting"
import { buildCloudflareZoneFile, downloadCloudflareZoneFile } from "@/lib/dns-zone-export"
import { cn } from "@/lib/utils"

type DnsStatus = "Activo" | "Sistema"
type DnsRecordView = HostingDnsRecord & {
  host: string
  value: string
  status: DnsStatus
  locked: boolean
}

type DnsFormState = {
  host: string
  ttl: string
  type: DnsRecordType
  value: string
  priority: string
  weight: string
  port: string
  target: string
  caaFlag: string
  caaTag: string
}

const defaultForm: DnsFormState = {
  host: "",
  ttl: "300",
  type: "A",
  value: "",
  priority: "10",
  weight: "1",
  port: "443",
  target: "",
  caaFlag: "0",
  caaTag: "issue",
}

const recordTypes: DnsRecordType[] = ["A", "AAAA", "CNAME", "MX", "NS", "SRV", "TXT", "CAA"]
const systemRecordNames = new Set([
  "@:A",
  "@:MX",
  "@:NS",
  "@:TXT",
  "www:A",
  "mail:A",
  "ftp:A",
  "webmail:A",
  "ipv4:A",
  "server:A",
  "ns1:A",
  "ns2:A",
  "autodiscover:CNAME",
  "autoconfig:CNAME",
  "_dmarc:TXT",
  "_domainkey:TXT",
  "_imaps._tcp:SRV",
  "_pop3s._tcp:SRV",
  "_submission._tcp:SRV",
  "_smtps._tcp:SRV",
])

export function DnsPage() {
  const [domains, setDomains] = useState<HostingDomain[]>([])
  const [selectedDomainId, setSelectedDomainId] = useState<number | null>(null)
  const [records, setRecords] = useState<DnsRecordView[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<"Todos" | DnsRecordType>("Todos")
  const [statusFilter, setStatusFilter] = useState<"Todos" | DnsStatus>("Todos")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingRecord, setEditingRecord] = useState<DnsRecordView | null>(null)
  const [error, setError] = useState("")
  const [form, setForm] = useState<DnsFormState>(defaultForm)

  const selectedDomain = useMemo(
    () => domains.find((domain) => domain.id === selectedDomainId) ?? domains[0] ?? null,
    [domains, selectedDomainId],
  )

  const loadRecords = useCallback(async (domainId: number) => {
    const data = await hostingApi.dnsRecords({ domain: domainId })
    setRecords(data.results.map(toDnsRecordView))
    setSelectedIds([])
  }, [])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const domainData = await hostingApi.domains()
      const nextDomains = domainData.results
      setDomains(nextDomains)
      const primary = nextDomains.find((domain) => domain.is_primary) ?? nextDomains[0] ?? null
      setSelectedDomainId((current) => current ?? primary?.id ?? null)
      if (primary) {
        await loadRecords(primary.id)
      } else {
        setRecords([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los registros DNS.")
    } finally {
      setIsLoading(false)
    }
  }, [loadRecords])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const search = `${record.host} ${record.type} ${record.value}`.toLowerCase()
      const matchesQuery = search.includes(query.toLowerCase())
      const matchesType = typeFilter === "Todos" || record.type === typeFilter
      const matchesStatus = statusFilter === "Todos" || record.status === statusFilter

      return matchesQuery && matchesType && matchesStatus
    })
  }, [query, records, statusFilter, typeFilter])

  const editableRecords = records.filter((record) => !record.locked)
  const selectedRecords = records.filter((record) => selectedIds.includes(record.id))
  const activeCount = records.length
  const editableCount = editableRecords.length
  const systemCount = records.filter((record) => record.locked).length
  const visibleRecordIds = filteredRecords.map((record) => record.id)
  const allVisibleSelected =
    visibleRecordIds.length > 0 && visibleRecordIds.every((id) => selectedIds.includes(id))

  const openCreateModal = () => {
    setEditingRecord(null)
    setForm(defaultForm)
    setIsCreateOpen(true)
  }

  const openEditModal = (record: DnsRecordView) => {
    setEditingRecord(record)
    setForm(recordToForm(record))
    setIsCreateOpen(true)
  }

  const closeRecordModal = () => {
    setIsCreateOpen(false)
    setEditingRecord(null)
    setForm(defaultForm)
  }

  const saveRecord = async () => {
    if (!selectedDomain || !isFormReady(form)) return

    const payload = buildRecordPayload(form)
    setIsSaving(true)
    setError("")
    try {
      const requestPayload = {
        domain: selectedDomain.id,
        name: form.host.trim() || "@",
        type: form.type,
        content: payload.content,
        ttl: Number(form.ttl) || 300,
        priority: payload.priority,
      }
      if (editingRecord) {
        await hostingApi.updateDnsRecord(editingRecord.id, requestPayload)
      } else {
        await hostingApi.createDnsRecord(requestPayload)
      }
      await loadRecords(selectedDomain.id)
      closeRecordModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el registro DNS.")
    } finally {
      setIsSaving(false)
    }
  }

  const resetTemplate = async () => {
    if (!selectedDomain) return
    if (!window.confirm("Se aplicara la plantilla base sin borrar subdominios ni registros personalizados. Continuar?")) return
    setIsSaving(true)
    setError("")
    try {
      await hostingApi.applyDnsTemplate(selectedDomain.id)
      await loadRecords(selectedDomain.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reestablecer la plantilla DNS.")
    } finally {
      setIsSaving(false)
    }
  }

  const deleteSelected = async () => {
    if (!selectedDomain || selectedRecords.length === 0) return
    if (!confirmDeleteRecords(selectedRecords)) return
    setIsSaving(true)
    setError("")
    try {
      await Promise.all(selectedRecords.map((record) => hostingApi.deleteDnsRecord(record.id)))
      await loadRecords(selectedDomain.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron eliminar los registros DNS.")
    } finally {
      setIsSaving(false)
    }
  }

  const deleteRecord = async (record: DnsRecordView) => {
    if (!selectedDomain) return
    if (!confirmDeleteRecords([record])) return
    setIsSaving(true)
    setError("")
    try {
      await hostingApi.deleteDnsRecord(record.id)
      await loadRecords(selectedDomain.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el registro DNS.")
    } finally {
      setIsSaving(false)
    }
  }

  const exportZone = async () => {
    if (!selectedDomain) return
    setError("")
    try {
      const recordPage = await hostingApi.dnsRecords({ domain: selectedDomain.id })
      const zoneText = buildCloudflareZoneFile(selectedDomain, recordPage.results)
      downloadCloudflareZoneFile(selectedDomain.domain, zoneText)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo exportar la zona DNS.")
    }
  }

  const toggleVisibleSelection = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !visibleRecordIds.includes(id)))
    } else {
      setSelectedIds((current) => Array.from(new Set([...current, ...visibleRecordIds])))
    }
  }

  const changeDomain = async (domainId: number) => {
    setSelectedDomainId(domainId)
    setIsLoading(true)
    setError("")
    try {
      await loadRecords(domainId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los registros DNS.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-3">
        <DnsSummaryCard label="Registros activos" value={activeCount.toString()} detail={`${records.length} registros totales`} />
        <DnsSummaryCard label="Editables" value={editableCount.toString()} detail="Registros administrables por el cliente" />
        <DnsSummaryCard label="Sistema" value={systemCount.toString()} detail="Protegidos por la plantilla base" />
      </section>

      <section className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-base font-bold">Zona DNS</h2>
            <p className="text-xs text-slate-500">
              {selectedDomain ? `Registros de ${selectedDomain.domain} sincronizados con el nodo.` : "No hay dominios disponibles."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {domains.length > 1 && (
              <select
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold outline-none"
                onChange={(event) => void changeDomain(Number(event.target.value))}
                value={selectedDomain?.id ?? ""}
              >
                {domains.map((domain) => (
                  <option key={domain.id} value={domain.id}>
                    {domain.domain}
                  </option>
                ))}
              </select>
            )}
            <Button disabled={!selectedDomain || isSaving} onClick={openCreateModal} size="sm">
              <Plus className="h-4 w-4" />
              Añadir registro
            </Button>
            <Button disabled={!selectedDomain || isSaving} onClick={resetTemplate} size="sm" variant="outline">
              <RefreshCcw className="h-4 w-4" />
              Reestablecer plantilla
            </Button>
            <Button disabled={!selectedDomain || isSaving} onClick={() => void exportZone()} size="sm" variant="outline">
              <FileDown className="h-4 w-4" />
              Exportar
            </Button>
            <Button disabled={selectedRecords.length === 0 || isSaving} onClick={deleteSelected} size="sm" variant="destructive">
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex h-8 min-w-[260px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input
              className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar host, tipo o valor"
              value={query}
            />
          </div>
          <DnsSelectFilter
            icon={Filter}
            onChange={(value) => setTypeFilter(value as "Todos" | DnsRecordType)}
            options={["Todos", ...recordTypes]}
            value={typeFilter}
          />
          <DnsSelectFilter
            icon={CheckCircle2}
            onChange={(value) => setStatusFilter(value as "Todos" | DnsStatus)}
            options={["Todos", "Activo", "Sistema"]}
            value={statusFilter}
          />
        </div>

        {error && <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">{error}</div>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-10 px-4 py-2">
                  <input
                    checked={allVisibleSelected}
                    className="h-4 w-4 rounded border-slate-300"
                    onChange={toggleVisibleSelection}
                    type="checkbox"
                  />
                </th>
                <th className="px-2 py-2">Host</th>
                <th className="px-2 py-2">TTL</th>
                <th className="px-2 py-2">Tipo de registro</th>
                <th className="px-2 py-2">Valor</th>
                <th className="px-2 py-2">Estado</th>
                <th className="px-4 py-2 text-right">Operar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-xs font-semibold text-slate-500" colSpan={7}>
                    Cargando registros DNS...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-xs font-semibold text-slate-500" colSpan={7}>
                    No hay registros DNS para mostrar.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr className="h-[50px] hover:bg-slate-50" key={record.id}>
                    <td className="px-4 py-2">
                      <input
                        checked={selectedIds.includes(record.id)}
                        className="h-4 w-4 rounded border-slate-300"
                        onChange={(event) =>
                          setSelectedIds((current) =>
                            event.target.checked ? [...current, record.id] : current.filter((id) => id !== record.id),
                          )
                        }
                        type="checkbox"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className="grid h-7 w-7 place-items-center rounded-md bg-blue-50 text-blue-600">
                          <ServerCog className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{record.host}</div>
                          <div className="text-xs text-slate-500">{record.domain_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <Clock3 className="h-3.5 w-3.5" />
                        {record.ttl}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-800">
                        {record.type}
                      </span>
                    </td>
                    <td className="max-w-[420px] px-2 py-2">
                      <div className="truncate text-xs font-medium text-slate-700">{record.value}</div>
                    </td>
                    <td className="px-2 py-2">
                      <DnsStatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          aria-label="Editar registro"
                          className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                          disabled={isSaving}
                          onClick={() => openEditModal(record)}
                          type="button"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          aria-label="Eliminar registro"
                          className={cn(
                            "grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-red-50 hover:text-red-600",
                            record.locked && "text-amber-600 hover:bg-amber-50 hover:text-red-600",
                          )}
                          disabled={isSaving}
                          onClick={() => void deleteRecord(record)}
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          aria-label="Mas opciones"
                          className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                          type="button"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
          <div>Total {filteredRecords.length} registros</div>
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

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
          <div className="w-full max-w-xl rounded-lg bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <div className="eh-kicker">{editingRecord ? "Editar DNS" : "Nuevo DNS"}</div>
                <h3 className="mt-1 text-lg font-bold">{editingRecord ? "Editar registro" : "Añadir registro"}</h3>
              </div>
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
                onClick={closeRecordModal}
                type="button"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>

            <form
              className="space-y-4 px-5 py-4"
              onSubmit={(event) => {
                event.preventDefault()
                void saveRecord()
              }}
            >
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <DnsTextInput
                  label="Host"
                  onChange={(value) => setForm((current) => ({ ...current, host: value }))}
                  placeholder="@, www, mail, _imaps._tcp"
                  value={form.host}
                />
                <DnsTextInput
                  label="TTL"
                  onChange={(value) => setForm((current) => ({ ...current, ttl: value }))}
                  type="number"
                  value={form.ttl}
                />
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">Tipo de registro</span>
                <select
                  className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as DnsRecordType }))}
                  value={form.type}
                >
                  {recordTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>

              <DnsRecordFields form={form} setForm={setForm} />

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                <Button onClick={closeRecordModal} size="sm" type="button" variant="outline">
                  Cancelar
                </Button>
                <Button disabled={!isFormReady(form) || isSaving} size="sm" type="submit">
                  {editingRecord ? "Guardar cambios" : "Añadir registro"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function toDnsRecordView(record: HostingDnsRecord): DnsRecordView {
  const host = record.name || "@"
  const status = isSystemRecord(record) ? "Sistema" : "Activo"
  return {
    ...record,
    host,
    value: formatRecordValue(record),
    status,
    locked: status === "Sistema",
  }
}

function isSystemRecord(record: HostingDnsRecord) {
  if (record.name.endsWith("._domainkey") && record.type === "TXT") return true
  return systemRecordNames.has(`${record.name}:${record.type}`)
}

function formatRecordValue(record: HostingDnsRecord) {
  if (record.type === "MX") return `${record.priority ?? 10} ${record.content}`
  return record.content
}

function confirmDeleteRecords(records: DnsRecordView[]) {
  const systemRecords = records.filter((record) => record.locked)
  if (systemRecords.length > 0) {
    const labels = systemRecords
      .slice(0, 6)
      .map((record) => `${record.host} ${record.type}`)
      .join(", ")
    const suffix = systemRecords.length > 6 ? ` y ${systemRecords.length - 6} mas` : ""
    return window.confirm(
      `ADVERTENCIA CRITICA\n\n` +
        `Estas intentando eliminar ${systemRecords.length} registro(s) de sistema: ${labels}${suffix}.\n\n` +
        `Esto puede romper DNS, correo, webmail, DKIM/SPF/DMARC, SSL o la resolucion del dominio.\n\n` +
        `Solo continua si sabes exactamente que este registro ya no debe existir.\n\n` +
        `Eliminar ${records.length} registro(s) seleccionado(s)?`,
    )
  }
  return window.confirm(`Eliminar ${records.length} registro(s) DNS seleccionado(s)?`)
}

function recordToForm(record: HostingDnsRecord): DnsFormState {
  const form = {
    ...defaultForm,
    host: record.name || "@",
    ttl: String(record.ttl || 300),
    type: record.type,
    value: record.content,
    priority: String(record.priority ?? 10),
  }

  if (record.type === "MX") {
    return { ...form, target: record.content, value: "" }
  }
  if (record.type === "SRV") {
    const [priority = "0", weight = "1", port = "443", ...targetParts] = record.content.split(/\s+/)
    return { ...form, priority, weight, port, target: targetParts.join(" "), value: "" }
  }
  if (record.type === "CAA") {
    const match = record.content.match(/^(\d+)\s+([A-Za-z0-9_-]+)\s+"?(.+?)"?$/)
    if (match) {
      return { ...form, caaFlag: match[1], caaTag: match[2], value: match[3] }
    }
  }
  return form
}

function buildRecordPayload(form: DnsFormState) {
  if (form.type === "MX") {
    return { content: form.target.trim(), priority: Number(form.priority) || 10 }
  }
  if (form.type === "SRV") {
    const priority = Number(form.priority) || 0
    const weight = Number(form.weight) || 0
    const port = Number(form.port) || 0
    return { content: `${priority} ${weight} ${port} ${form.target.trim()}`, priority: null }
  }
  if (form.type === "CAA") {
    return { content: `${Number(form.caaFlag) || 0} ${form.caaTag.trim() || "issue"} "${form.value.trim()}"`, priority: null }
  }
  return { content: form.value.trim(), priority: null }
}

function isFormReady(form: DnsFormState) {
  if (!form.host.trim()) return false
  if (Number(form.ttl) < 60) return false
  if (form.type === "MX") return Boolean(form.target.trim() && form.priority.trim())
  if (form.type === "SRV") return Boolean(form.target.trim() && form.priority.trim() && form.weight.trim() && form.port.trim())
  if (form.type === "CAA") return Boolean(form.value.trim() && form.caaTag.trim())
  return Boolean(form.value.trim())
}

function DnsRecordFields({
  form,
  setForm,
}: {
  form: DnsFormState
  setForm: Dispatch<SetStateAction<DnsFormState>>
}) {
  if (form.type === "MX") {
    return (
      <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
        <DnsTextInput label="Prioridad" onChange={(value) => setForm((current) => ({ ...current, priority: value }))} type="number" value={form.priority} />
        <DnsTextInput label="Servidor" onChange={(value) => setForm((current) => ({ ...current, target: value }))} placeholder="mail.dominio.com" value={form.target} />
      </div>
    )
  }

  if (form.type === "SRV") {
    return (
      <div className="grid gap-4 sm:grid-cols-4">
        <DnsTextInput label="Prioridad" onChange={(value) => setForm((current) => ({ ...current, priority: value }))} type="number" value={form.priority} />
        <DnsTextInput label="Peso" onChange={(value) => setForm((current) => ({ ...current, weight: value }))} type="number" value={form.weight} />
        <DnsTextInput label="Puerto" onChange={(value) => setForm((current) => ({ ...current, port: value }))} type="number" value={form.port} />
        <DnsTextInput label="Destino" onChange={(value) => setForm((current) => ({ ...current, target: value }))} placeholder="mail.dominio.com" value={form.target} />
      </div>
    )
  }

  if (form.type === "CAA") {
    return (
      <div className="grid gap-4 sm:grid-cols-[90px_140px_1fr]">
        <DnsTextInput label="Flag" onChange={(value) => setForm((current) => ({ ...current, caaFlag: value }))} type="number" value={form.caaFlag} />
        <DnsTextInput label="Tag" onChange={(value) => setForm((current) => ({ ...current, caaTag: value }))} placeholder="issue" value={form.caaTag} />
        <DnsTextInput label="Valor" onChange={(value) => setForm((current) => ({ ...current, value }))} placeholder="letsencrypt.org" value={form.value} />
      </div>
    )
  }

  const label =
    form.type === "A"
      ? "IPv4"
      : form.type === "AAAA"
        ? "IPv6"
        : form.type === "NS"
          ? "Nameserver"
          : form.type === "CNAME"
            ? "Destino"
            : "Valor"

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>
      <textarea
        className="min-h-20 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
        placeholder="192.0.2.24, dominio.com, v=spf1..."
        value={form.value}
      />
    </label>
  )
}

function DnsTextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>
      <input
        className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  )
}

function DnsSummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="eh-card p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold">{label}</div>
          <div className="text-xs text-slate-500">{detail}</div>
        </div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
      </div>
    </div>
  )
}

function DnsSelectFilter({
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
      <select
        className="h-full bg-transparent pr-5 text-xs font-semibold outline-none"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  )
}

function DnsStatusBadge({ status }: { status: DnsStatus }) {
  const className = status === "Activo" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"

  return <span className={cn("rounded-md px-2 py-1 text-xs font-bold", className)}>{status}</span>
}
