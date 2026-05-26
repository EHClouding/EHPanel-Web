import {
  Archive,
  CalendarDays,
  Cloud,
  Database,
  Download,
  FileArchive,
  Files,
  HardDrive,
  Mail,
  MoreVertical,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type BackupType = "Completo" | "Parcial" | "Archivos" | "Base de datos" | "Correos"
type BackupStatus = "Completado" | "En proceso" | "Fallido"

const backups = [
  { id: "BKP-1048", type: "Completo" as BackupType, scope: "Sitio completo", storage: "EHCloud Storage / backups", date: "2026-05-10 01:10", size: "14.6 GB", status: "Completado" as BackupStatus, notify: "admin@cliente-demo.com" },
  { id: "BKP-1047", type: "Base de datos" as BackupType, scope: "cliente_wp, cliente_store", storage: "Local /backups/db", date: "2026-05-09 03:00", size: "3.1 GB", status: "Completado" as BackupStatus, notify: "No" },
  { id: "BKP-1046", type: "Archivos" as BackupType, scope: "/public_html", storage: "S3 externo / ehpanel-clientes", date: "2026-05-08 01:10", size: "8.8 GB", status: "Completado" as BackupStatus, notify: "admin@cliente-demo.com" },
  { id: "BKP-1045", type: "Correos" as BackupType, scope: "3 buzones", storage: "EHCloud Storage / mail", date: "2026-05-07 01:10", size: "2.7 GB", status: "Fallido" as BackupStatus, notify: "admin@cliente-demo.com" },
]

export function BackupPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [restoreBackup, setRestoreBackup] = useState<(typeof backups)[number] | null>(null)

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-4">
        <BackupMetric icon={Archive} label="Backups" value="24" detail="Últimos 30 días" />
        <BackupMetric icon={HardDrive} label="Almacenado" value="48.2 GB" detail="3 destinos" />
        <BackupMetric icon={CalendarDays} label="Programados" value="3" detail="Diario / semanal" />
        <BackupMetric icon={Cloud} label="Último" value="Hoy" detail="Completo correcto" />
      </section>

      <section className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-base font-bold">Backup</h2>
            <p className="text-xs text-slate-500">Historial, restauración y tareas de copias de seguridad.</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} size="sm"><Plus className="h-4 w-4" />Crear tarea</Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex h-8 min-w-[260px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input className="h-full min-w-0 flex-1 bg-transparent outline-none" placeholder="Buscar backup, destino o alcance" />
          </div>
          <Button size="sm" variant="outline">Tipo</Button>
          <Button size="sm" variant="outline">Estado</Button>
          <Button size="sm" variant="outline">Rango</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Backup</th>
                <th className="px-2 py-2">Tipo</th>
                <th className="px-2 py-2">Alcance</th>
                <th className="px-2 py-2">Alojado en</th>
                <th className="px-2 py-2">Fecha</th>
                <th className="px-2 py-2">Tamaño</th>
                <th className="px-2 py-2">Notificación</th>
                <th className="px-2 py-2">Estado</th>
                <th className="px-4 py-2 text-right">Operar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {backups.map((backup) => (
                <tr className="h-[54px] hover:bg-slate-50" key={backup.id}>
                  <td className="px-4 py-2 font-bold text-slate-900">{backup.id}</td>
                  <td className="px-2 py-2"><TypeBadge type={backup.type} /></td>
                  <td className="px-2 py-2 text-xs font-semibold text-slate-700">{backup.scope}</td>
                  <td className="px-2 py-2 text-xs text-slate-600">{backup.storage}</td>
                  <td className="px-2 py-2 text-xs text-slate-600">{backup.date}</td>
                  <td className="px-2 py-2 text-xs font-bold text-slate-800">{backup.size}</td>
                  <td className="px-2 py-2 text-xs text-slate-600">{backup.notify}</td>
                  <td className="px-2 py-2"><StatusBadge status={backup.status} /></td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <IconAction icon={RefreshCcw} label="Restaurar" onClick={() => setRestoreBackup(backup)} />
                      <IconAction icon={Download} label="Descargar" />
                      <IconAction icon={Trash2} label="Eliminar" tone="danger" />
                      <IconAction icon={MoreVertical} label="Más opciones" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isCreateOpen && <BackupTaskModal onClose={() => setIsCreateOpen(false)} />}
      {restoreBackup && <RestoreModal backup={restoreBackup} onClose={() => setRestoreBackup(null)} />}
    </div>
  )
}

function BackupTaskModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="eh-kicker">Nueva tarea</div>
            <h3 className="mt-1 text-lg font-bold">Crear copia de seguridad</h3>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button"><XCircle className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
          <SelectField label="Tipo de backup" options={["Completo", "Parcial", "Archivos", "Base de datos", "Correos"]} />
          <SelectField label="Frecuencia" options={["Una vez", "Diario", "Semanal", "Mensual"]} />
          <Field label="Alcance" placeholder="/public_html, cliente_wp, todos los correos" />
          <SelectField label="Destino" options={["EHCloud Storage", "Local /backups", "S3 externo", "FTP remoto"]} />
          <Field label="Retención" placeholder="30 días o 10 copias" />
          <Field label="Notificar por correo" placeholder="admin@cliente-demo.com" />
        </div>
        <div className="border-t border-slate-200 px-5 py-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input className="h-4 w-4 rounded border-slate-300" defaultChecked type="checkbox" />
            Ejecutar verificación de integridad al finalizar
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">Cancelar</Button>
          <Button onClick={onClose} size="sm">Crear tarea</Button>
        </div>
      </div>
    </div>
  )
}

function RestoreModal({ backup, onClose }: { backup: (typeof backups)[number]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="eh-kicker">Restaurar backup</div>
          <h3 className="mt-1 text-lg font-bold">{backup.id}</h3>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm">
          <InfoLine label="Tipo" value={backup.type} />
          <InfoLine label="Alcance" value={backup.scope} />
          <InfoLine label="Origen" value={backup.storage} />
          <SelectField label="Restaurar en" options={["Ubicación original", "Carpeta temporal", "Staging"]} />
          <label className="flex items-center gap-2 font-semibold text-slate-700">
            <input className="h-4 w-4 rounded border-slate-300" defaultChecked type="checkbox" />
            Crear backup de seguridad antes de restaurar
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">Cancelar</Button>
          <Button onClick={onClose} size="sm">Restaurar</Button>
        </div>
      </div>
    </div>
  )
}

function BackupMetric({ icon: Icon, label, value, detail }: { icon: typeof Archive; label: string; value: string; detail: string }) {
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

function TypeBadge({ type }: { type: BackupType }) {
  const icons = {
    Completo: Archive,
    Parcial: FileArchive,
    Archivos: Files,
    "Base de datos": Database,
    Correos: Mail,
  }
  const Icon = icons[type]

  return <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700"><Icon className="h-3.5 w-3.5" />{type}</span>
}

function StatusBadge({ status }: { status: BackupStatus }) {
  return <span className={cn("rounded-md px-2 py-1 text-xs font-bold", status === "Completado" ? "bg-emerald-50 text-emerald-700" : status === "En proceso" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700")}>{status}</span>
}

function Field({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>
      <input className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" placeholder={placeholder} />
    </label>
  )
}

function SelectField({ label, options }: { label: string; options: string[] }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>
      <select className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[90px_1fr] gap-3 rounded-md bg-slate-50 px-3 py-2"><span className="font-bold text-slate-500">{label}</span><span className="font-semibold text-slate-900">{value}</span></div>
}

function IconAction({ icon: Icon, label, onClick, tone = "default" }: { icon: typeof RefreshCcw; label: string; onClick?: () => void; tone?: "default" | "danger" }) {
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
