import { FileText, MessageSquarePlus, Paperclip, Search, Send, Ticket, XCircle } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { hostingApi, type HostingAccount, type SupportTicket } from "@/api/hosting"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const maxFileSize = 10 * 1024 * 1024
const maxFiles = 5
const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".txt", ".log", ".csv", ".zip"]
const departments = [
  ["technical", "Soporte tecnico"],
  ["administration", "Administracion"],
  ["billing", "Facturacion"],
  ["security", "Abuso y seguridad"],
] as const
const priorities = [["low", "Baja"], ["medium", "Media"], ["high", "Alta"], ["urgent", "Urgente"]] as const

export function ClientTicketsPage() {
  const [accounts, setAccounts] = useState<HostingAccount[]>([])
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function loadTickets() {
    setLoading(true)
    setError("")
    try {
      const [accountPage, ticketPage] = await Promise.all([
        hostingApi.accounts(),
        hostingApi.tickets({ search, status: statusFilter }),
      ])
      setAccounts(accountPage.results)
      setTickets(ticketPage.results)
      setSelectedTicket((current) => current ? ticketPage.results.find((item) => item.id === current.id) || current : current)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los tickets.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTickets()
  }, [])

  const counts = useMemo(() => ({
    open: tickets.filter((ticket) => ticket.status !== "closed").length,
    answered: tickets.filter((ticket) => ticket.status === "answered").length,
    closed: tickets.filter((ticket) => ticket.status === "closed").length,
  }), [tickets])

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Ticket className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Cuenta</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Tickets</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Solicitudes del cliente hacia soporte. Puedes crear tickets, responder y adjuntar evidencias seguras.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreate(true)} size="sm">
            <MessageSquarePlus className="h-4 w-4" />
            Nuevo ticket
          </Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Metric label="Abiertos" value={String(counts.open)} />
        <Metric label="Respondidos" value={String(counts.answered)} />
        <Metric label="Cerrados" value={String(counts.closed)} />
      </section>

      <div className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex h-9 w-[320px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input className="h-full min-w-0 flex-1 bg-transparent outline-none" onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && loadTickets()} placeholder="Buscar ticket..." value={search} />
          </div>
          <div className="flex gap-2">
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="">Todos</option>
              <option value="open">Abiertos</option>
              <option value="answered">Respondidos</option>
              <option value="customer_reply">Respuesta cliente</option>
              <option value="closed">Cerrados</option>
            </select>
            <Button disabled={loading} onClick={loadTickets} size="sm" variant="outline">Filtrar</Button>
          </div>
        </div>
        {error && <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {["ID", "Asunto", "Cuenta", "Departamento", "Prioridad", "Estado", "Actualizado", "Acciones"].map((column) => (
                  <th className="px-4 py-2 font-bold" key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.length === 0 && <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={8}>No hay tickets registrados.</td></tr>}
              {tickets.map((ticket) => (
                <tr className="hover:bg-slate-50" key={ticket.id}>
                  <td className="px-4 py-3 font-semibold">{ticket.display_id}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{ticket.subject}</td>
                  <td className="px-4 py-3">{ticket.account_domain}</td>
                  <td className="px-4 py-3">{departmentLabel(ticket.department)}</td>
                  <td className="px-4 py-3">{priorityLabel(ticket.priority)}</td>
                  <td className="px-4 py-3"><StatusBadge state={ticket.status} /></td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(ticket.updated_at)}</td>
                  <td className="px-4 py-3 text-right"><Button onClick={() => setSelectedTicket(ticket)} size="sm" variant="outline">Ver</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate ? <CreateClientTicketModal accounts={accounts} onClose={() => setShowCreate(false)} onSaved={(ticket) => { setShowCreate(false); setSelectedTicket(ticket); void loadTickets() }} /> : null}
      {selectedTicket ? <TicketDetailModal onClose={() => setSelectedTicket(null)} onSaved={(ticket) => { setSelectedTicket(ticket); void loadTickets() }} ticket={selectedTicket} /> : null}
    </div>
  )
}

function CreateClientTicketModal({ accounts, onClose, onSaved }: { accounts: HostingAccount[]; onClose: () => void; onSaved: (ticket: SupportTicket) => void }) {
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [department, setDepartment] = useState("technical")
  const [priority, setPriority] = useState("medium")
  const [accountId, setAccountId] = useState(accounts[0]?.id || "")
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!accountId && accounts[0]?.id) setAccountId(accounts[0].id)
  }, [accounts, accountId])

  async function submit() {
    const validation = validateFiles(files)
    if (validation) {
      setError(validation)
      return
    }
    const form = new FormData()
    form.append("account", accountId)
    form.append("subject", subject)
    form.append("body", body)
    form.append("department", department)
    form.append("priority", priority)
    files.forEach((file) => form.append("attachments", file))
    setSaving(true)
    setError("")
    try {
      onSaved(await hostingApi.createTicket(form))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el ticket.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell onClose={onClose} title="Nuevo ticket al soporte">
      <div className="space-y-4 p-5">
        {error && <Alert text={error} />}
        <Field label="Asunto" onChange={setSubject} placeholder="Ej. Necesito revisar el correo ventas@dominio.com" value={subject} />
        <div className="grid gap-3 md:grid-cols-3">
          <SelectField label="Cuenta" onChange={setAccountId} options={accounts.map((account) => [account.id, account.primary_domain])} value={accountId} />
          <SelectField label="Prioridad" onChange={setPriority} options={priorities} value={priority} />
          <SelectField label="Departamento" onChange={setDepartment} options={departments} value={department} />
        </div>
        <TextArea label="Descripcion del ticket" onChange={setBody} placeholder="Describe la solicitud, dominio afectado, correo, hora aproximada y cualquier informacion util." value={body} />
        <AttachmentPicker files={files} onChange={setFiles} />
        <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-bold">Adjuntos permitidos</p>
          <p className="mt-1">Imagenes, PDF, TXT, LOG, CSV o ZIP. Maximo {maxFiles} archivos y 10 MB por archivo.</p>
        </div>
      </div>
      <ModalFooter onCancel={onClose} onSubmit={submit} saving={saving} submitLabel="Registrar ticket" />
    </ModalShell>
  )
}

function TicketDetailModal({ ticket, onClose, onSaved }: { ticket: SupportTicket; onClose: () => void; onSaved: (ticket: SupportTicket) => void }) {
  const [body, setBody] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function reply() {
    const validation = validateFiles(files)
    if (validation) {
      setError(validation)
      return
    }
    const form = new FormData()
    form.append("body", body)
    files.forEach((file) => form.append("attachments", file))
    setSaving(true)
    setError("")
    try {
      const updated = await hostingApi.replyTicket(ticket.id, form)
      setBody("")
      setFiles([])
      onSaved(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo responder el ticket.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell onClose={onClose} title={`${ticket.display_id} ${ticket.subject}`}>
      <div className="max-h-[72vh] space-y-4 overflow-y-auto p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <Meta label="Cuenta" value={ticket.account_domain} />
          <Meta label="Departamento" value={departmentLabel(ticket.department)} />
          <Meta label="Prioridad" value={priorityLabel(ticket.priority)} />
          <Meta label="Estado" value={statusLabel(ticket.status)} />
        </div>
        <div className="space-y-3">
          {ticket.messages.map((message) => (
            <div className={cn("rounded-lg border p-3", message.author_type === "customer" ? "border-blue-100 bg-blue-50" : "border-slate-200 bg-white")} key={message.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-bold text-slate-900">{message.author_name || authorLabel(message.author_type)}</div>
                <div className="text-xs text-slate-500">{formatDate(message.created_at)}</div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.body}</p>
              {message.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.attachments.map((attachment) => (
                    <a className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={attachment.download_url} key={attachment.id} rel="noreferrer" target="_blank">
                      <FileText className="h-3.5 w-3.5" />
                      {attachment.original_name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {ticket.status !== "closed" && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            {error && <Alert text={error} />}
            <TextArea label="Responder" onChange={setBody} placeholder="Escribe una respuesta clara para continuar el ticket." value={body} />
            <div className="mt-3"><AttachmentPicker files={files} onChange={setFiles} /></div>
            <div className="mt-3 flex justify-end">
              <Button disabled={saving || body.trim().length < 2} onClick={reply} size="sm"><Send className="h-4 w-4" />Responder</Button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  )
}

function AttachmentPicker({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-white p-3">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
        <Paperclip className="h-4 w-4" />
        Adjuntar archivos
        <input
          accept={allowedExtensions.join(",")}
          className="hidden"
          multiple
          onChange={(event) => onChange([...(event.target.files || [])].slice(0, maxFiles))}
          type="file"
        />
      </label>
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((file) => (
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm" key={`${file.name}-${file.size}`}>
              <span className="truncate font-semibold text-slate-700">{file.name}</span>
              <button className="text-slate-400 hover:text-red-600" onClick={() => onChange(files.filter((item) => item !== file))} type="button"><XCircle className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function validateFiles(files: File[]) {
  if (files.length > maxFiles) return `Puedes adjuntar hasta ${maxFiles} archivos.`
  for (const file of files) {
    const lower = file.name.toLowerCase()
    if (!allowedExtensions.some((extension) => lower.endsWith(extension))) return `Archivo no permitido: ${file.name}`
    if (file.size > maxFileSize) return `${file.name} supera 10 MB.`
  }
  return ""
}

function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[820px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalFooter({ onCancel, onSubmit, saving, submitLabel }: { onCancel: () => void; onSubmit: () => void; saving: boolean; submitLabel: string }) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
      <Button onClick={onCancel} size="sm" variant="outline">Cancelar</Button>
      <Button disabled={saving} onClick={onSubmit} size="sm">{saving ? "Guardando..." : submitLabel}</Button>
    </div>
  )
}

function Field({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      <input className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none placeholder:text-slate-400 focus:border-blue-500" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} />
    </label>
  )
}

function TextArea({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      <textarea className="h-36 w-full resize-none rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 outline-none placeholder:text-slate-400 focus:border-blue-500" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} />
    </label>
  )
}

function SelectField({ label, options, value, onChange }: { label: string; options: readonly (readonly [string, string])[]; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}
      </select>
    </label>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="eh-card p-3"><div className="text-xs font-bold uppercase text-slate-500">{label}</div><div className="mt-1 text-2xl font-bold text-slate-900">{value}</div></div>
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-slate-200 bg-white p-3"><div className="text-xs font-bold uppercase text-slate-500">{label}</div><div className="mt-1 text-sm font-bold text-slate-900">{value}</div></div>
}

function Alert({ text }: { text: string }) {
  return <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{text}</div>
}

function StatusBadge({ state }: { state: SupportTicket["status"] }) {
  return (
    <span className={cn("rounded-full px-2 py-1 text-xs font-bold", state === "open" && "bg-emerald-50 text-emerald-700", state === "answered" && "bg-blue-50 text-blue-700", state === "customer_reply" && "bg-amber-50 text-amber-700", state === "closed" && "bg-slate-100 text-slate-600")}>
      {statusLabel(state)}
    </span>
  )
}

function departmentLabel(value: string) {
  return departments.find(([key]) => key === value)?.[1] || value
}

function priorityLabel(value: string) {
  return priorities.find(([key]) => key === value)?.[1] || value
}

function statusLabel(value: SupportTicket["status"]) {
  return { answered: "Respondido", closed: "Cerrado", customer_reply: "Respuesta cliente", open: "Abierto" }[value] || value
}

function authorLabel(value: string) {
  return { customer: "Cliente", reseller: "Revendedor", staff: "Soporte", system: "Sistema" }[value as "customer"] || value
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
