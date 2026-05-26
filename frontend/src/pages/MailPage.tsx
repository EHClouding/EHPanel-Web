import {
  CheckCircle2,
  Download,
  Edit3,
  Filter,
  Inbox,
  ExternalLink,
  Mail,
  MoreVertical,
  Plus,
  Power,
  Search,
  Settings,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"

import { hostingApi, type HostingAccount, type HostingMailbox } from "@/api/hosting"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type MailType = "Buzon" | "Reenvio"
type MailStatus = "Activo" | "Suspendido" | "En proceso" | "Error"

const emptyForm = {
  address: "",
  password: "",
  quotaGb: "5",
  outgoingLimit: "150",
  description: "",
  autoresponderEnabled: false,
  autoresponderSubject: "",
  autoresponderFormat: "Texto sin formato",
  autoresponderEncoding: "UTF-8",
  autoresponderMessage: "",
  autoresponderRedirect: "",
  autoresponderUniqueLimit: "1",
  autoresponderSchedule: false,
  antispamEnabled: true,
  spamAction: "Mover a carpeta spam",
  spamSubjectTag: "[SPAM]",
  spamSensitivity: "Media",
  whitelist: "",
  blacklist: "",
}

type MailForm = typeof emptyForm

export function MailPage() {
  const [accounts, setAccounts] = useState<HostingAccount[]>([])
  const [mailboxes, setMailboxes] = useState<HostingMailbox[]>([])
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<"Todos" | MailType>("Todos")
  const [statusFilter, setStatusFilter] = useState<"Todos" | MailStatus>("Todos")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<HostingMailbox | null>(null)
  const [configAccount, setConfigAccount] = useState<HostingMailbox | null>(null)
  const [antispamAccount, setAntispamAccount] = useState<HostingMailbox | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [form, setForm] = useState<MailForm>(emptyForm)

  const selectedAccount = accounts[0]

  const loadData = async () => {
    setLoading(true)
    try {
      const accountPage = await hostingApi.accounts()
      const loadedAccounts = accountPage.results
      const accountId = loadedAccounts[0]?.id ?? ""
      let loadedMailboxes: HostingMailbox[] = []
      if (accountId) {
        const syncResult = await hostingApi.syncMailboxes(accountId)
        loadedMailboxes = syncResult.results
      } else {
        const mailboxPage = await hostingApi.mailboxes()
        loadedMailboxes = mailboxPage.results
      }
      setAccounts(loadedAccounts)
      setMailboxes(loadedMailboxes)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar los correos.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const filteredAccounts = useMemo(() => {
    return mailboxes.filter((account) => {
      const search = `${account.email} ${mailName(account)} ${account.description}`.toLowerCase()
      const matchesQuery = search.includes(query.toLowerCase())
      const matchesType = typeFilter === "Todos" || typeFilter === "Buzon"
      const matchesStatus = statusFilter === "Todos" || mapStatus(account.status) === statusFilter

      return matchesQuery && matchesType && matchesStatus
    })
  }, [mailboxes, query, statusFilter, typeFilter])

  const saveAccount = async () => {
    if (!selectedAccount || !form.address.trim()) return
    setMessage("")
    try {
      const payload = formPayload(form)
      if (editingAccount) {
        const updated = await hostingApi.updateMailbox(editingAccount.id, payload)
        setMailboxes((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      } else {
        const created = await hostingApi.createMailbox({
          account: selectedAccount.id,
          email: form.address.trim().toLowerCase(),
          password: form.password,
          ...payload,
        })
        setMailboxes((current) => [...current, created])
      }
      setEditingAccount(null)
      setIsCreateOpen(false)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el correo.")
    }
  }

  const openCreate = () => {
    setEditingAccount(null)
    setForm({
      ...emptyForm,
      address: selectedAccount ? `@${selectedAccount.primary_domain}` : "",
    })
    setIsCreateOpen(true)
  }

  const openEdit = (account: HostingMailbox) => {
    const antispam = (account.antispam_settings || {}) as Record<string, string>
    setEditingAccount(account)
    setForm({
      address: account.email,
      password: "",
      quotaGb: Math.max(1, Math.round(account.quota_mb / 1024)).toString(),
      outgoingLimit: String(account.outgoing_limit || 150),
      description: account.description || "",
      autoresponderEnabled: account.autoresponder_enabled,
      autoresponderSubject: account.autoresponder_subject || "",
      autoresponderFormat: account.autoresponder_format === "html" ? "HTML" : "Texto sin formato",
      autoresponderEncoding: account.autoresponder_encoding || "UTF-8",
      autoresponderMessage: account.autoresponder_message || "",
      autoresponderRedirect: account.autoresponder_redirect || "",
      autoresponderUniqueLimit: String(account.autoresponder_unique_limit || 1),
      autoresponderSchedule: account.autoresponder_schedule,
      antispamEnabled: account.antispam_enabled,
      spamAction: antispam.action || "Mover a carpeta spam",
      spamSubjectTag: antispam.subject_tag || "[SPAM]",
      spamSensitivity: antispam.sensitivity || "Media",
      whitelist: antispam.whitelist || "",
      blacklist: antispam.blacklist || "",
    })
    setIsCreateOpen(true)
  }

  const toggleStatus = async (account: HostingMailbox) => {
    try {
      const updated =
        account.status === "suspended" ? await hostingApi.unsuspendMailbox(account.id) : await hostingApi.suspendMailbox(account.id)
      setMailboxes((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cambiar el estado.")
    }
  }

  const deleteAccount = async (account: HostingMailbox) => {
    if (!window.confirm(`Eliminar ${account.email}?`)) return
    const updated = await hostingApi.deleteMailbox(account.id)
    setMailboxes((current) => current.map((item) => (item.id === updated.id ? updated : item)))
  }

  const openWebmail = async (account: HostingMailbox) => {
    try {
      const response = await hostingApi.webmailUrl(account.id)
      window.open(response.url, "_blank")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo abrir webmail.")
    }
  }

  const saveAntispam = async (account: HostingMailbox, settings: AntispamForm) => {
    const updated = await hostingApi.updateMailbox(account.id, {
      antispam_enabled: settings.enabled,
      antispam_settings: {
        action: settings.action,
        subject_tag: settings.subjectTag,
        sensitivity: settings.sensitivity,
        whitelist: settings.whitelist,
        blacklist: settings.blacklist,
      },
    })
    setMailboxes((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    setAntispamAccount(null)
  }

  const averageUsage = mailboxes.length
    ? Math.round(mailboxes.reduce((total, item) => total + mailboxUsage(item), 0) / mailboxes.length)
    : 0

  return (
    <div className="space-y-4">
      {message && <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{message}</div>}
      <section className="grid gap-3 md:grid-cols-4">
        <MailSummary label="Cuentas" value={mailboxes.length.toString()} detail="Buzones y reenvios" />
        <MailSummary label="Activas" value={mailboxes.filter((item) => item.status === "active").length.toString()} detail="Operando ahora" />
        <MailSummary label="Antispam" value={mailboxes.filter((item) => item.antispam_enabled).length.toString()} detail="Proteccion habilitada" />
        <MailSummary label="Uso promedio" value={`${averageUsage}%`} detail="Espacio de buzon" />
      </section>

      <section className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-base font-bold">Correos</h2>
            <p className="text-xs text-slate-500">Buzones, reenvios y proteccion de {selectedAccount?.primary_domain || "la cuenta"}.</p>
          </div>
          <Button disabled={!selectedAccount} onClick={openCreate} size="sm">
            <Plus className="h-4 w-4" />
            Anadir correo
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex h-8 min-w-[260px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input
              className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar direccion, nombre o descripcion"
              value={query}
            />
          </div>
          <MailSelect icon={Filter} onChange={(value) => setTypeFilter(value as "Todos" | MailType)} options={["Todos", "Buzon", "Reenvio"]} value={typeFilter} />
          <MailSelect icon={CheckCircle2} onChange={(value) => setStatusFilter(value as "Todos" | MailStatus)} options={["Todos", "Activo", "Suspendido", "En proceso", "Error"]} value={statusFilter} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-10 px-4 py-2"><input className="h-4 w-4 rounded border-slate-300" type="checkbox" /></th>
                <th className="px-2 py-2">Direccion</th>
                <th className="px-2 py-2">Nombre</th>
                <th className="px-2 py-2">Uso</th>
                <th className="px-2 py-2">Descripcion</th>
                <th className="px-2 py-2">Tipo</th>
                <th className="px-2 py-2">Estado</th>
                <th className="px-4 py-2 text-right">Operar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading && (
                <tr><td className="px-4 py-6 text-sm font-semibold text-slate-500" colSpan={8}>Cargando correos...</td></tr>
              )}
              {!loading && filteredAccounts.length === 0 && (
                <tr><td className="px-4 py-6 text-sm font-semibold text-slate-500" colSpan={8}>No hay correos creados para esta cuenta.</td></tr>
              )}
              {filteredAccounts.map((account) => (
                <tr className="h-[54px] hover:bg-slate-50" key={account.id}>
                  <td className="px-4 py-2"><input className="h-4 w-4 rounded border-slate-300" type="checkbox" /></td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <div className="grid h-7 w-7 place-items-center rounded-md bg-blue-50 text-blue-600"><Mail className="h-4 w-4" /></div>
                      <div>
                        <div className="font-semibold text-slate-900">{account.email}</div>
                        <div className="text-xs text-slate-500">{account.outgoing_limit}/hora salientes</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs font-semibold text-slate-700">{mailName(account)}</td>
                  <td className="px-2 py-2">
                    <div className="w-36">
                      <div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-500">
                        <span>{mailboxUsage(account)}%</span>
                        <span>{Math.max(1, Math.round(account.quota_mb / 1024))} GB</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${mailboxUsage(account)}%` }} /></div>
                    </div>
                  </td>
                  <td className="max-w-[220px] px-2 py-2"><div className="truncate text-xs text-slate-600">{account.description || "Buzon de correo"}</div></td>
                  <td className="px-2 py-2"><span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700">Buzon</span></td>
                  <td className="px-2 py-2"><StatusBadge status={mapStatus(account.status)} /></td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton icon={Edit3} label="Editar" onClick={() => openEdit(account)} />
                      <IconButton icon={ExternalLink} label="Abrir webmail" onClick={() => void openWebmail(account)} />
                      <IconButton icon={Power} label={account.status === "suspended" ? "Activar" : "Suspender"} onClick={() => void toggleStatus(account)} />
                      <IconButton icon={ShieldAlert} label="Filtro antispam" onClick={() => setAntispamAccount(account)} />
                      <IconButton icon={Settings} label="Datos de configuracion" onClick={() => setConfigAccount(account)} />
                      <IconButton icon={Trash2} label="Eliminar" onClick={() => void deleteAccount(account)} tone="danger" />
                      <IconButton icon={MoreVertical} label="Mas opciones" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isCreateOpen && (
        <CreateMailModal
          form={form}
          mode={editingAccount ? "edit" : "create"}
          onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
          onClose={() => {
            setIsCreateOpen(false)
            setEditingAccount(null)
          }}
          onSave={saveAccount}
        />
      )}

      {configAccount && <MailConfigModal account={configAccount} onClose={() => setConfigAccount(null)} />}
      {antispamAccount && <AntispamModal account={antispamAccount} onClose={() => setAntispamAccount(null)} onSave={(settings) => void saveAntispam(antispamAccount, settings)} />}
    </div>
  )
}

type AntispamForm = {
  enabled: boolean
  action: string
  subjectTag: string
  sensitivity: string
  whitelist: string
  blacklist: string
}

function formPayload(form: MailForm) {
  const password = form.password.trim()
  const autoresponderFormat: "text" | "html" = form.autoresponderFormat === "HTML" ? "html" : "text"
  return {
    ...(password ? { password } : {}),
    quota_mb: Math.max(1, Number(form.quotaGb) || 1) * 1024,
    description: form.description.trim(),
    outgoing_limit: Number(form.outgoingLimit) || 150,
    antispam_enabled: form.antispamEnabled,
    antispam_settings: {
      action: form.spamAction,
      subject_tag: form.spamSubjectTag,
      sensitivity: form.spamSensitivity,
      whitelist: form.whitelist,
      blacklist: form.blacklist,
    },
    autoresponder_enabled: form.autoresponderEnabled,
    autoresponder_subject: form.autoresponderSubject,
    autoresponder_format: autoresponderFormat,
    autoresponder_encoding: form.autoresponderEncoding,
    autoresponder_message: form.autoresponderMessage,
    autoresponder_redirect: form.autoresponderRedirect,
    autoresponder_unique_limit: Number(form.autoresponderUniqueLimit) || 1,
    autoresponder_schedule: form.autoresponderSchedule,
  }
}

function mailName(account: HostingMailbox) {
  return account.email.split("@")[0] || account.email
}

function mailboxUsage(account: HostingMailbox) {
  if (!account.quota_mb) return 0
  return Math.min(100, Math.round((account.used_mb / account.quota_mb) * 100))
}

function mapStatus(status: HostingMailbox["status"]): MailStatus {
  if (status === "active") return "Activo"
  if (status === "suspended") return "Suspendido"
  if (status === "failed") return "Error"
  return "En proceso"
}

function StatusBadge({ status }: { status: MailStatus }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-1 text-xs font-bold",
        status === "Activo" && "bg-emerald-50 text-emerald-700",
        status === "Suspendido" && "bg-slate-100 text-slate-600",
        status === "En proceso" && "bg-blue-50 text-blue-700",
        status === "Error" && "bg-red-50 text-red-700",
      )}
    >
      {status}
    </span>
  )
}

function CreateMailModal({
  form,
  mode,
  onChange,
  onClose,
  onSave,
}: {
  form: MailForm
  mode: "create" | "edit"
  onChange: (patch: Partial<MailForm>) => void
  onClose: () => void
  onSave: () => void
}) {
  const [openSection, setOpenSection] = useState<"autoresponder" | "antispam" | null>(null)

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="eh-kicker">{mode === "edit" ? "Editar cuenta" : "Nueva cuenta"}</div>
            <h3 className="mt-1 text-lg font-bold">{mode === "edit" ? form.address : "Anadir correo"}</h3>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-132px)] overflow-y-auto px-5 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput disabled={mode === "edit"} label="Direccion" onChange={(value) => onChange({ address: value })} placeholder="nuevo@cliente-demo.com" value={form.address} />
            <FormInput label="Contrasena" onChange={(value) => onChange({ password: value })} placeholder={mode === "edit" ? "Solo si deseas cambiarla" : "Contrasena segura"} type="password" value={form.password} />
            <FormInput label="Tamano de buzon" onChange={(value) => onChange({ quotaGb: value })} placeholder="5" suffix="GB" value={form.quotaGb} />
            <FormInput label="Correos salientes por hora" onChange={(value) => onChange({ outgoingLimit: value })} placeholder="150" suffix="/hora" value={form.outgoingLimit} />
          </div>
          <div className="mt-4">
            <FormInput label="Descripcion" onChange={(value) => onChange({ description: value })} placeholder="Uso de esta cuenta" value={form.description} />
          </div>

          <div className="mt-5 space-y-3">
            <AdvancedSection icon={Inbox} open={openSection === "autoresponder"} title="Respuesta automatica" onToggle={() => setOpenSection(openSection === "autoresponder" ? null : "autoresponder")}>
              <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input checked={form.autoresponderEnabled} className="h-4 w-4 rounded border-slate-300" onChange={(event) => onChange({ autoresponderEnabled: event.target.checked })} type="checkbox" />
                Activar respuesta automatica
              </label>
              {form.autoresponderEnabled && (
                <div className="grid gap-4 md:grid-cols-2">
                  <FormInput label="Asunto" onChange={(value) => onChange({ autoresponderSubject: value })} placeholder="Estoy fuera de oficina" value={form.autoresponderSubject} />
                  <SelectInput label="Formato" onChange={(value) => onChange({ autoresponderFormat: value })} options={["Texto sin formato", "HTML"]} value={form.autoresponderFormat} />
                  <SelectInput label="Codificacion" onChange={(value) => onChange({ autoresponderEncoding: value })} options={["UTF-8", "ISO-8859-1"]} value={form.autoresponderEncoding} />
                  <FormInput label="Redireccionar a" onChange={(value) => onChange({ autoresponderRedirect: value })} placeholder="alterno@cliente-demo.com" value={form.autoresponderRedirect} />
                  <FormInput label="Envios por email unico" onChange={(value) => onChange({ autoresponderUniqueLimit: value })} placeholder="1" value={form.autoresponderUniqueLimit} />
                  <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-slate-700">
                    <input checked={form.autoresponderSchedule} className="h-4 w-4 rounded border-slate-300" onChange={(event) => onChange({ autoresponderSchedule: event.target.checked })} type="checkbox" />
                    Desactivar por horario
                  </label>
                  <label className="md:col-span-2">
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">Texto del mensaje</span>
                    <textarea className="min-h-24 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" onChange={(event) => onChange({ autoresponderMessage: event.target.value })} value={form.autoresponderMessage} />
                  </label>
                </div>
              )}
            </AdvancedSection>

            <AdvancedSection icon={ShieldAlert} open={openSection === "antispam"} title="Filtro antispam" onToggle={() => setOpenSection(openSection === "antispam" ? null : "antispam")}>
              <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input checked={form.antispamEnabled} className="h-4 w-4 rounded border-slate-300" onChange={(event) => onChange({ antispamEnabled: event.target.checked })} type="checkbox" />
                Activar filtro antispam
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <SelectInput label="Accion" onChange={(value) => onChange({ spamAction: value })} options={["Marcar como spam", "Eliminar o descartar mensajes", "Mover a carpeta spam"]} value={form.spamAction} />
                <SelectInput label="Sensibilidad" onChange={(value) => onChange({ spamSensitivity: value })} options={["Baja", "Media", "Alta", "Agresiva"]} value={form.spamSensitivity} />
                <FormInput label="Texto en asunto" onChange={(value) => onChange({ spamSubjectTag: value })} placeholder="[SPAM]" value={form.spamSubjectTag} />
                <FormInput label="Lista blanca" onChange={(value) => onChange({ whitelist: value })} placeholder="dominio.com, persona@email.com" value={form.whitelist} />
                <div className="md:col-span-2"><FormInput label="Lista negra" onChange={(value) => onChange({ blacklist: value })} placeholder="spam.com, abuse@email.com" value={form.blacklist} /></div>
              </div>
            </AdvancedSection>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button onClick={onClose} size="sm" type="button" variant="outline">Cancelar</Button>
          <Button disabled={!form.address.trim() || (mode === "create" && !form.password.trim())} onClick={onSave} size="sm" type="button">
            {mode === "edit" ? "Guardar cambios" : "Anadir correo"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function MailConfigModal({ account, onClose }: { account: HostingMailbox; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState("Deteccion automatica")
  const tabs = ["Deteccion automatica", "Thunderbird", "Gmail", "Outlook", "iOS Mail", "Configuracion manual"]

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="eh-kicker">Datos de configuracion</div>
            <h3 className="mt-1 text-lg font-bold">{account.email}</h3>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
          <div className="flex flex-wrap gap-1">
            {tabs.map((tab) => (
              <button className={cn("h-8 rounded-md px-3 text-xs font-bold transition", activeTab === tab ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:bg-white hover:text-slate-900")} key={tab} onClick={() => setActiveTab(tab)} type="button">
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[calc(92vh-150px)] overflow-y-auto px-5 py-4">
          {activeTab === "Deteccion automatica" && <AutodetectConfig account={account} />}
          {activeTab === "Thunderbird" && <ThunderbirdConfig account={account} />}
          {activeTab === "Gmail" && <GmailConfig account={account} />}
          {activeTab === "Outlook" && <OutlookConfig account={account} />}
          {activeTab === "iOS Mail" && <IosMailConfig account={account} />}
          {activeTab === "Configuracion manual" && <ManualMailConfig account={account} />}
          {!["Deteccion automatica", "Thunderbird", "Gmail", "Outlook", "iOS Mail", "Configuracion manual"].includes(activeTab) && (
            <div className="grid min-h-[260px] place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
              <div className="text-center">
                <div className="text-sm font-bold text-slate-800">{activeTab}</div>
                <div className="mt-1 text-xs text-slate-500">Contenido pendiente para esta pestana.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ThunderbirdConfig({ account }: { account: HostingMailbox }) {
  const domain = account.email.split("@")[1] || account.account_domain
  const config = account.manual_config
  const autoUrl = `https://autoconfig.${domain}/mail/config-v1.1.xml?emailaddress=${encodeURIComponent(account.email)}`

  return (
    <ClientConfigPanel
      account={account}
      description="Thunderbird puede detectar esta configuracion con autoconfig. Si no la detecta, usa los datos manuales de abajo."
      title="Thunderbird"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <InfoBlock label="Autoconfig URL" value={autoUrl} />
        <InfoBlock label="Usuario" value={config.username} />
        <InfoBlock label="Servidor IMAP" value={`${config.incoming_server}:993 SSL/TLS`} />
        <InfoBlock label="Servidor SMTP" value={`${config.outgoing_server}:587 STARTTLS`} />
      </div>
    </ClientConfigPanel>
  )
}

function GmailConfig({ account }: { account: HostingMailbox }) {
  const config = account.manual_config
  return (
    <ClientConfigPanel
      account={account}
      description="En Gmail agrega la cuenta como correo externo IMAP/SMTP. Gmail no consume todos los endpoints autodiscover de la misma forma que Outlook o Thunderbird."
      title="Gmail"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <InfoBlock label="Direccion de correo" value={account.email} />
        <InfoBlock label="Nombre de usuario" value={config.username} />
        <InfoBlock label="Servidor entrante IMAP" value={`${config.incoming_server}:993 SSL`} />
        <InfoBlock label="Servidor saliente SMTP" value={`${config.outgoing_server}:587 TLS`} />
        <InfoBlock label="Autenticacion SMTP" value="Requerida" />
        <InfoBlock label="POP3 opcional" value={`${config.incoming_server}:995 SSL`} />
      </div>
    </ClientConfigPanel>
  )
}

function OutlookConfig({ account }: { account: HostingMailbox }) {
  const domain = account.email.split("@")[1] || account.account_domain
  const config = account.manual_config
  const autodiscoverUrl = `https://autodiscover.${domain}/autodiscover/autodiscover.xml`

  return (
    <ClientConfigPanel
      account={account}
      description="Outlook debe consultar autodiscover del dominio. Si el cliente no lo detecta, usa IMAP/SMTP manual con estos valores."
      title="Outlook"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <InfoBlock label="Autodiscover URL" value={autodiscoverUrl} />
        <InfoBlock label="Usuario" value={config.username} />
        <InfoBlock label="Servidor IMAP" value={`${config.incoming_server}:993 SSL`} />
        <InfoBlock label="Servidor SMTP" value={`${config.outgoing_server}:587 STARTTLS`} />
      </div>
    </ClientConfigPanel>
  )
}

function IosMailConfig({ account }: { account: HostingMailbox }) {
  const config = account.manual_config
  return (
    <ClientConfigPanel
      account={account}
      description="Descarga el perfil de configuracion para Apple Mail. El dispositivo pedira la contrasena durante la instalacion."
      title="Perfil iOS/macOS"
    >
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mt-4">
          <Button onClick={() => window.open(hostingApi.mailboxMobileconfigUrl(account.email), "_blank")} size="sm" type="button">
            <Download className="h-4 w-4" />
            Descargar perfil
          </Button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <InfoBlock label="Cuenta" value={account.email} />
        <InfoBlock label="Servidor IMAP" value={`${config.incoming_server}:993 SSL`} />
        <InfoBlock label="Servidor SMTP" value={`${config.outgoing_server}:587 STARTTLS`} />
        <InfoBlock label="Usuario" value={config.username} />
      </div>
    </ClientConfigPanel>
  )
}

function ClientConfigPanel({ title, description, account, children }: { title: string; description: string; account: HostingMailbox; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <div className="font-bold text-slate-900">{title}</div>
        <div className="mt-1">{description}</div>
        <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-600 md:grid-cols-3">
          <span>Cuenta: {account.email}</span>
          <span>Entrada: IMAP 993</span>
          <span>Salida: SMTP 587</span>
        </div>
      </div>
      {children}
    </div>
  )
}

function AutodetectConfig({ account }: { account: HostingMailbox }) {
  const domain = account.email.split("@")[1] || account.account_domain
  const srvRecords = [
    { type: "SRV", service: "_imaps", protocol: "_tcp", port: "993", target: `mail.${domain}` },
    { type: "SRV", service: "_pop3s", protocol: "_tcp", port: "995", target: `mail.${domain}` },
    { type: "SRV", service: "_submission", protocol: "_tcp", port: "587", target: `mail.${domain}` },
    { type: "SRV", service: "_smtps", protocol: "_tcp", port: "465", target: `mail.${domain}` },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Los siguientes clientes de correo pueden configurarse automaticamente:</p>
        <div className="mt-2 grid gap-1 text-sm"><span>Mozilla Thunderbird</span><span>Gmail en Android</span><span>iOS Mail</span><span>Outlook con autodiscover cuando este habilitado</span></div>
      </div>
      <div className="space-y-3">
        <div className="text-sm font-bold text-slate-900">Configuracion automatica del cliente de correo:</div>
        <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
          <input className="h-4 w-4 rounded border-slate-300" defaultChecked type="checkbox" />
          Activar deteccion automatica de correo.
        </label>
        <p className="text-sm text-slate-600">Si no gestiona los registros DNS en EHPanel Web, cree manualmente los siguientes registros SRV en su proveedor de DNS:</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Servicio</th><th className="px-3 py-2">Protocolo</th><th className="px-3 py-2">Puerto</th><th className="px-3 py-2">Destino</th></tr></thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {srvRecords.map((record) => (
              <tr key={`${record.service}-${record.port}`}><td className="px-3 py-2 font-bold text-slate-800">{record.type}</td><td className="px-3 py-2 text-slate-700">{record.service}</td><td className="px-3 py-2 text-slate-700">{record.protocol}</td><td className="px-3 py-2 text-slate-700">{record.port}</td><td className="px-3 py-2 text-slate-700">{record.target}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ManualMailConfig({ account }: { account: HostingMailbox }) {
  const config = account.manual_config
  const ports = [
    { protocol: "SMTP", ssl: String(config.smtp_ssl_port), plain: String(config.smtp_plain_port) },
    { protocol: "IMAP", ssl: String(config.imap_ssl_port), plain: String(config.imap_plain_port) },
    { protocol: "POP3", ssl: String(config.pop3_ssl_port), plain: String(config.pop3_plain_port) },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <InfoBlock label="Nombre de usuario de servidor de correo" value={config.username} />
        <InfoBlock label="Servidor de correo saliente (requiere autenticacion)" value={config.outgoing_server} />
        <InfoBlock label="Servidor de correo entrante" value={config.incoming_server} />
        <InfoBlock label="Protocolos de correo saliente soportados" value={config.outgoing_protocols.join(", ")} />
        <InfoBlock label="Protocolos de correo entrante soportados" value={config.incoming_protocols.join(", ")} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {ports.map((item) => (
          <div className="rounded-lg border border-slate-200 bg-white p-3" key={item.protocol}>
            <div className="text-sm font-bold text-slate-900">{item.protocol}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md bg-emerald-50 p-2"><div className="text-[11px] font-bold uppercase text-emerald-700">Con SSL</div><div className="text-lg font-bold text-emerald-900">{item.ssl}</div></div>
              <div className="rounded-md bg-slate-100 p-2"><div className="text-[11px] font-bold uppercase text-slate-600">Sin SSL</div><div className="text-lg font-bold text-slate-900">{item.plain}</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AntispamModal({ account, onClose, onSave }: { account: HostingMailbox; onClose: () => void; onSave: (settings: AntispamForm) => void }) {
  const current = (account.antispam_settings || {}) as Record<string, string>
  const [form, setForm] = useState<AntispamForm>({
    enabled: account.antispam_enabled,
    action: current.action || "Mover a carpeta spam",
    subjectTag: current.subject_tag || "[SPAM]",
    sensitivity: current.sensitivity || "Media",
    whitelist: current.whitelist || "",
    blacklist: current.blacklist || "",
  })

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="eh-kicker">Filtro antispam</div>
            <h3 className="mt-1 text-lg font-bold">{account.email}</h3>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input checked={form.enabled} className="h-4 w-4 rounded border-slate-300" onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} type="checkbox" />
            Activar filtro antispam para este buzon
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectInput label="Accion" onChange={(value) => setForm((current) => ({ ...current, action: value }))} options={["Marcar como spam", "Eliminar o descartar mensajes", "Mover a carpeta spam"]} value={form.action} />
            <SelectInput label="Sensibilidad" onChange={(value) => setForm((current) => ({ ...current, sensitivity: value }))} options={["Baja", "Media", "Alta", "Agresiva"]} value={form.sensitivity} />
            <FormInput label="Texto en asunto" onChange={(value) => setForm((current) => ({ ...current, subjectTag: value }))} placeholder="[SPAM]" value={form.subjectTag} />
            <FormInput label="Lista blanca" onChange={(value) => setForm((current) => ({ ...current, whitelist: value }))} placeholder="dominio.com, persona@email.com" value={form.whitelist} />
            <div className="md:col-span-2">
              <FormInput label="Lista negra" onChange={(value) => setForm((current) => ({ ...current, blacklist: value }))} placeholder="spam.com, abuse@email.com" value={form.blacklist} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button onClick={onClose} size="sm" type="button" variant="outline">Cancelar</Button>
          <Button onClick={() => onSave(form)} size="sm" type="button">Guardar cambios</Button>
        </div>
      </div>
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-slate-900">{value}</div>
    </div>
  )
}

function MailSummary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="eh-card p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{detail}</div>
    </div>
  )
}

function MailSelect({ icon: Icon, value, options, onChange }: { icon: typeof Filter; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-600">
      <Icon className="h-4 w-4 text-slate-400" />
      <select className="h-full bg-transparent pr-5 text-xs font-semibold outline-none" onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </div>
  )
}

function AdvancedSection({ icon: Icon, title, open, onToggle, children }: { icon: typeof Inbox; title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200">
      <button className="flex w-full items-center justify-between px-3 py-2 text-left" onClick={onToggle} type="button">
        <span className="flex items-center gap-2 text-sm font-bold text-slate-800"><Icon className="h-4 w-4 text-blue-600" />{title}</span>
        <span className="text-xs font-bold text-blue-600">{open ? "Ocultar" : "Configurar"}</span>
      </button>
      {open && <div className="border-t border-slate-200 bg-slate-50/60 p-3">{children}</div>}
    </div>
  )
}

function FormInput({ label, value, onChange, placeholder, type = "text", suffix, disabled = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; suffix?: string; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>
      <div className="flex h-9 items-center rounded-md border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
        <input className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-500" disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} />
        {suffix && <span className="border-l border-slate-200 px-2 text-xs font-bold text-slate-500">{suffix}</span>}
      </div>
    </label>
  )
}

function SelectInput({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>
      <select className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  )
}

function IconButton({ icon: Icon, label, onClick, tone = "default" }: { icon: typeof Edit3; label: string; onClick?: () => void; tone?: "default" | "danger" }) {
  return (
    <button
      aria-label={label}
      className={cn("grid h-8 w-8 place-items-center rounded-md transition", tone === "danger" ? "text-red-600 hover:bg-red-50" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900")}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
