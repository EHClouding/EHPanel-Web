import {
  CheckCircle2,
  Copy,
  Database,
  Download,
  Filter,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  Wrench,
  XCircle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"

import { hostingApi, type DbAccess, type DbEngine, type HostingAccount, type HostingDatabase, type HostingDatabaseUser } from "@/api/hosting"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DbType = "MariaDB" | "PostgreSQL"
type DbStatus = "Activa" | "En proceso" | "Error"

const accessLabels: Record<DbAccess, string> = {
  admin: "Admin",
  read_only: "Solo lectura",
  read_write: "Lectura y escritura",
}

const engineLabels: Record<DbEngine, DbType> = {
  mariadb: "MariaDB",
  postgresql: "PostgreSQL",
}

export function DatabasesPage() {
  const [activeTab, setActiveTab] = useState<"databases" | "users">("databases")
  const [accounts, setAccounts] = useState<HostingAccount[]>([])
  const [databases, setDatabases] = useState<HostingDatabase[]>([])
  const [users, setUsers] = useState<HostingDatabaseUser[]>([])
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<"Todos" | DbType>("Todos")
  const [statusFilter, setStatusFilter] = useState<"Todos" | DbStatus>("Todos")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isUserOpen, setIsUserOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<HostingDatabaseUser | null>(null)
  const [cloneTarget, setCloneTarget] = useState<HostingDatabase | null>(null)
  const [importTarget, setImportTarget] = useState<HostingDatabase | null>(null)
  const [cloneName, setCloneName] = useState("")
  const [importPath, setImportPath] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    account: "",
    name: "",
    engine: "mariadb" as DbEngine,
    userMode: "new" as "new" | "existing",
    databaseUser: "",
    username: "",
    password: "",
    access: "read_write" as DbAccess,
  })
  const [userForm, setUserForm] = useState({
    account: "",
    engine: "mariadb" as DbEngine,
    username: "",
    password: "",
    database: "",
    access: "read_write" as DbAccess,
  })

  const selectedAccount = accounts.find((account) => account.id === form.account) ?? accounts[0]
  const accountPrefix = selectedAccount?.username ?? ""
  const databaseNamePreview = prefixedDatabaseIdentifier(accountPrefix, form.name || "app")
  const databaseUserPreview = prefixedDatabaseIdentifier(accountPrefix, form.username || "app_user")
  const userFormAccount = accounts.find((account) => account.id === userForm.account) ?? selectedAccount
  const standaloneUserPreview = prefixedDatabaseIdentifier(userFormAccount?.username ?? "", userForm.username || "app_user")

  const loadData = async () => {
    setLoading(true)
    try {
      const accountPage = await hostingApi.accounts()
      const loadedAccounts = accountPage.results
      const accountId = loadedAccounts[0]?.id ?? ""
      const [databasePage, userPage] = await Promise.all([
        hostingApi.databases(accountId ? { account: accountId } : undefined),
        hostingApi.databaseUsers(accountId ? { account: accountId } : undefined),
      ])
      setAccounts(loadedAccounts)
      setDatabases(databasePage.results)
      setUsers(userPage.results)
      setForm((current) => ({ ...current, account: current.account || accountId }))
      setUserForm((current) => ({ ...current, account: current.account || accountId }))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar las bases de datos.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const filteredDatabases = useMemo(() => {
    return databases.filter((database) => {
      const search = `${database.name} ${database.username} ${engineLabels[database.engine]}`.toLowerCase()
      const status = mapStatus(database.status)
      return (
        search.includes(query.toLowerCase()) &&
        (typeFilter === "Todos" || engineLabels[database.engine] === typeFilter) &&
        (statusFilter === "Todos" || status === statusFilter)
      )
    })
  }, [databases, query, statusFilter, typeFilter])

  const totalSize = databases.reduce((total, item) => total + item.size_mb, 0)
  const mariaDbCount = databases.filter((item) => item.engine === "mariadb").length
  const postgresCount = databases.filter((item) => item.engine === "postgresql").length

  const submitCreateDatabase = async () => {
    if (!form.account || !form.name.trim()) return
    setMessage("")
    try {
      await hostingApi.createDatabase({
        access: form.access,
        account: form.account,
        database_user: form.userMode === "existing" ? Number(form.databaseUser) : null,
        engine: form.engine,
        name: prefixedDatabaseIdentifier(accountPrefix, form.name),
        password: form.userMode === "new" ? form.password : "",
        user_mode: form.userMode,
        username: form.userMode === "new" ? prefixedDatabaseIdentifier(accountPrefix, form.username) : undefined,
      })
      setMessage("Base de datos creada.")
      setIsCreateOpen(false)
      setForm((current) => ({ ...current, name: "", username: "", password: "", databaseUser: "" }))
      await loadData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear la base de datos.")
    }
  }

  const openNewUser = () => {
    setEditingUser(null)
    setUserForm({
      account: selectedAccount?.id ?? "",
      database: databases[0]?.id.toString() ?? "",
      engine: databases[0]?.engine ?? "mariadb",
      username: "",
      password: "",
      access: "read_write",
    })
    setIsUserOpen(true)
  }

  const openEditUser = (user: HostingDatabaseUser) => {
    setEditingUser(user)
    setUserForm({
      account: user.account,
      database: user.databases[0]?.id.toString() ?? "",
      engine: user.engine,
      username: user.username,
      password: "",
      access: user.access,
    })
    setIsUserOpen(true)
  }

  const saveUser = async () => {
    try {
      if (editingUser) {
        await hostingApi.updateDatabaseUser(editingUser.id, { access: userForm.access, password: userForm.password || undefined })
        setMessage(userForm.password ? "Cambio de contrasena enviado al agente." : "Usuario actualizado.")
      } else {
        await hostingApi.createDatabaseUser({
          access: userForm.access,
          account: userForm.account,
          database: userForm.database ? Number(userForm.database) : null,
          engine: userForm.engine,
          password: userForm.password,
          username: prefixedDatabaseIdentifier(userFormAccount?.username ?? "", userForm.username),
        })
        setMessage("Usuario enviado al agente.")
      }
      setIsUserOpen(false)
      await loadData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el usuario.")
    }
  }

  const deleteUser = async (user: HostingDatabaseUser) => {
    let force = false
    if (user.used_by_count > 0) {
      force = window.confirm(`Este usuario esta asignado a ${user.used_by_count} base(s). Si lo eliminas, esas aplicaciones pueden quedar sin acceso. Continuar?`)
      if (!force) return
    }
    await hostingApi.deleteDatabaseUser(user.id, force)
    setMessage("Eliminacion de usuario enviada al agente.")
    await loadData()
  }

  const deleteDatabase = async (database: HostingDatabase) => {
    const confirmed = window.confirm(`Eliminar la base de datos ${database.name}? Esta accion enviara la eliminacion al agente y puede afectar aplicaciones que la usen.`)
    if (!confirmed) return
    await hostingApi.deleteDatabase(database.id)
    setMessage("Eliminacion de base de datos enviada al agente.")
    await loadData()
  }

  const openManager = async (database: HostingDatabase) => {
    const popup = window.open("about:blank", "_blank")
    if (popup) popup.opener = null
    try {
      const response = await hostingApi.databaseManagerUrl(database.id)
      if (popup) {
        popup.location.href = response.url
      } else {
        window.location.href = response.url
      }
    } catch (error) {
      popup?.close()
      setMessage(error instanceof Error ? error.message : "No se pudo generar el autologin.")
    }
  }

  const runClone = async () => {
    if (!cloneTarget || !cloneName.trim()) return
    await hostingApi.cloneDatabase(cloneTarget.id, cloneName.trim())
    setMessage("Clonacion enviada al agente.")
    setCloneTarget(null)
    setCloneName("")
    await loadData()
  }

  const runImport = async () => {
    if (!importTarget || !importPath.trim()) return
    await hostingApi.importDatabase(importTarget.id, importPath.trim())
    setMessage("Importacion enviada al agente.")
    setImportTarget(null)
    setImportPath("")
    await loadData()
  }

  const simpleAction = async (action: () => Promise<unknown>, label: string) => {
    await action()
    setMessage(label)
    await loadData()
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-3">
        <DbSummaryCard detail={`${databases.length} bases reales`} label="Bases de datos" value={databases.length.toString()} />
        <DbSummaryCard detail={`${mariaDbCount} MariaDB / ${postgresCount} PostgreSQL`} label="Motores" value="2" />
        <DbSummaryCard detail="Uso reportado por agente" label="Tamano total" value={formatSize(totalSize)} />
      </section>

      {message && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">{message}</div>
      )}

      <section className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-base font-bold">Bases de Datos</h2>
            <p className="text-xs text-slate-500">
              MariaDB y PostgreSQL asociados a {selectedAccount?.primary_domain ?? "la cuenta seleccionada"}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
              <TabButton active={activeTab === "databases"} onClick={() => setActiveTab("databases")}>
                Bases de datos
              </TabButton>
              <TabButton active={activeTab === "users"} onClick={() => setActiveTab("users")}>
                Usuarios
              </TabButton>
            </div>
            {activeTab === "databases" ? (
              <Button onClick={() => setIsCreateOpen(true)} size="sm">
                <Plus className="h-4 w-4" />
                Crear base de datos
              </Button>
            ) : (
              <Button onClick={openNewUser} size="sm">
                <Plus className="h-4 w-4" />
                Agregar usuario
              </Button>
            )}
          </div>
        </div>

        {activeTab === "databases" ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex h-8 min-w-[260px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-500">
                <Search className="h-4 w-4" />
                <input className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar BD, usuario o motor" value={query} />
              </div>
              <DbSelectFilter icon={Filter} onChange={(value) => setTypeFilter(value as "Todos" | DbType)} options={["Todos", "MariaDB", "PostgreSQL"]} value={typeFilter} />
              <DbSelectFilter icon={CheckCircle2} onChange={(value) => setStatusFilter(value as "Todos" | DbStatus)} options={["Todos", "Activa", "En proceso", "Error"]} value={statusFilter} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-10 px-4 py-2"><input className="h-4 w-4 rounded border-slate-300" type="checkbox" /></th>
                    <th className="px-2 py-2">Nombre BD</th>
                    <th className="px-2 py-2">Usuario BD</th>
                    <th className="px-2 py-2">Tipo</th>
                    <th className="px-2 py-2">phpMyAdmin / Adminer</th>
                    <th className="px-2 py-2">Estado</th>
                    <th className="px-2 py-2">Tamano</th>
                    <th className="px-2 py-2">Mantenimiento</th>
                    <th className="px-4 py-2 text-right">Operar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredDatabases.map((database) => (
                    <tr className="h-[52px] hover:bg-slate-50" key={database.id}>
                      <td className="px-4 py-2"><input className="h-4 w-4 rounded border-slate-300" type="checkbox" /></td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <div className="grid h-7 w-7 place-items-center rounded-md bg-blue-50 text-blue-600"><Database className="h-4 w-4" /></div>
                          <div>
                            <div className="font-semibold text-slate-900">{database.name}</div>
                            <div className="text-xs text-slate-500">Creada {formatDate(database.created_at)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-xs font-semibold text-slate-700">{database.username}</td>
                      <td className="px-2 py-2"><EngineBadge engine={database.engine} /></td>
                      <td className="px-2 py-2">
                        <Button onClick={() => void openManager(database)} size="sm" variant="outline">
                          {database.engine === "mariadb" ? "phpMyAdmin" : "Adminer"}
                        </Button>
                      </td>
                      <td className="px-2 py-2"><DbStatusBadge status={mapStatus(database.status)} /></td>
                      <td className="px-2 py-2 text-xs font-bold text-slate-800">{formatSize(database.size_mb)}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <SmallAction icon={Copy} label="Copiar BD" onClick={() => { setCloneTarget(database); setCloneName(`${database.name}_copy`) }} />
                          <SmallAction icon={Wrench} label="Verificar y reparar" onClick={() => void simpleAction(() => hostingApi.checkRepairDatabase(database.id), "Verificacion enviada al agente.")} />
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <SmallAction icon={Download} label="Exportar" onClick={() => void simpleAction(() => hostingApi.exportDatabase(database.id), "Exportacion enviada al agente.")} />
                          <SmallAction icon={Upload} label="Importar" onClick={() => setImportTarget(database)} />
                          <SmallAction icon={Trash2} label="Eliminar base de datos" onClick={() => void deleteDatabase(database)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && filteredDatabases.length === 0 && (
                    <tr><td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={9}>No hay bases de datos reales para esta cuenta.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <DatabaseUsersTable databases={databases} onDelete={(user) => void deleteUser(user)} onEdit={openEditUser} users={users} />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
          <div>{activeTab === "databases" ? `Total ${filteredDatabases.length} bases de datos` : `Total ${users.length} usuarios`}</div>
          <div className="flex items-center gap-2">
            <Button disabled size="sm" variant="outline">Anterior</Button>
            <span className="grid h-8 w-8 place-items-center rounded-md border border-blue-200 bg-blue-50 font-bold text-blue-700">1</span>
            <Button disabled size="sm" variant="outline">Siguiente</Button>
          </div>
        </div>
      </section>

      {isCreateOpen && (
        <Modal kicker="Nueva base de datos" title="Crear base de datos" onClose={() => setIsCreateOpen(false)}>
          <form className="space-y-4 px-5 py-4" onSubmit={(event) => { event.preventDefault(); void submitCreateDatabase() }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Nombre BD" onChange={(value) => setForm((current) => ({ ...current, name: value }))} placeholder={databaseNamePreview} value={form.name} />
              <SelectInput label="Tipo" onChange={(value) => setForm((current) => ({ ...current, engine: value as DbEngine, databaseUser: "" }))} options={[["mariadb", "MariaDB"], ["postgresql", "PostgreSQL"]]} value={form.engine} />
            </div>
            <SelectInput label="Asignar usuario" onChange={(value) => setForm((current) => ({ ...current, userMode: value as "new" | "existing" }))} options={[["new", "Crear usuario nuevo"], ["existing", "Usar usuario existente"]]} value={form.userMode} />
            {form.userMode === "existing" ? (
              <SelectInput label="Usuario existente" onChange={(value) => setForm((current) => ({ ...current, databaseUser: value }))} options={users.filter((user) => user.engine === form.engine).map((user) => [String(user.id), user.username])} value={form.databaseUser} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="Usuario BD" onChange={(value) => setForm((current) => ({ ...current, username: value }))} placeholder={databaseUserPreview} value={form.username} />
                <TextInput label="Contrasena" onChange={(value) => setForm((current) => ({ ...current, password: value }))} placeholder="Minimo 8 caracteres" type="password" value={form.password} />
              </div>
            )}
            <SelectInput label="Control de acceso" onChange={(value) => setForm((current) => ({ ...current, access: value as DbAccess }))} options={accessOptions()} value={form.access} />
            <ModalFooter disabled={!form.name.trim() || (form.userMode === "new" && (!form.username.trim() || form.password.length < 8)) || (form.userMode === "existing" && !form.databaseUser)} onCancel={() => setIsCreateOpen(false)} submitLabel="Crear base de datos" />
          </form>
        </Modal>
      )}

      {isUserOpen && (
        <Modal kicker={editingUser ? "Editar usuario" : "Nuevo usuario"} title={editingUser ? editingUser.username : "Agregar usuario BD"} onClose={() => setIsUserOpen(false)}>
          <form className="space-y-4 px-5 py-4" onSubmit={(event) => { event.preventDefault(); void saveUser() }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput disabled={Boolean(editingUser)} label="Nombre de usuario" onChange={(value) => setUserForm((current) => ({ ...current, username: value }))} placeholder={standaloneUserPreview} value={userForm.username} />
              <TextInput label="Contrasena" onChange={(value) => setUserForm((current) => ({ ...current, password: value }))} placeholder={editingUser ? "Dejar vacio para no cambiar" : "Nueva contrasena"} type="password" value={userForm.password} />
            </div>
            {!editingUser && (
              <>
                <SelectInput label="Motor" onChange={(value) => setUserForm((current) => ({ ...current, engine: value as DbEngine }))} options={[["mariadb", "MariaDB"], ["postgresql", "PostgreSQL"]]} value={userForm.engine} />
                <SelectInput label="Base de datos asignada" onChange={(value) => setUserForm((current) => ({ ...current, database: value }))} options={[["", "Sin asignar"], ...databases.filter((database) => database.engine === userForm.engine).map((database) => [String(database.id), database.name] as [string, string])]} value={userForm.database} />
              </>
            )}
            <SelectInput label="Control de acceso" onChange={(value) => setUserForm((current) => ({ ...current, access: value as DbAccess }))} options={accessOptions()} value={userForm.access} />
            <ModalFooter disabled={!userForm.username.trim() || (!editingUser && userForm.password.length < 8) || (Boolean(editingUser) && userForm.password.length > 0 && userForm.password.length < 8)} onCancel={() => setIsUserOpen(false)} submitLabel={editingUser ? "Guardar cambios" : "Agregar usuario"} />
          </form>
        </Modal>
      )}

      {cloneTarget && (
        <Modal kicker="Copiar base de datos" title={cloneTarget.name} onClose={() => setCloneTarget(null)}>
          <form className="space-y-4 px-5 py-4" onSubmit={(event) => { event.preventDefault(); void runClone() }}>
            <TextInput label="Nombre de la nueva BD" onChange={setCloneName} placeholder={`${cloneTarget.name}_copy`} value={cloneName} />
            <ModalFooter disabled={!cloneName.trim()} onCancel={() => setCloneTarget(null)} submitLabel="Copiar" />
          </form>
        </Modal>
      )}

      {importTarget && (
        <Modal kicker="Importar volcado" title={importTarget.name} onClose={() => setImportTarget(null)}>
          <form className="space-y-4 px-5 py-4" onSubmit={(event) => { event.preventDefault(); void runImport() }}>
            <TextInput label="Ruta del volcado" onChange={setImportPath} placeholder="/home/usuario/backups/databases/archivo.sql" value={importPath} />
            <ModalFooter disabled={!importPath.trim()} onCancel={() => setImportTarget(null)} submitLabel="Importar" />
          </form>
        </Modal>
      )}
    </div>
  )
}

function DatabaseUsersTable({ users, databases, onEdit, onDelete }: { users: HostingDatabaseUser[]; databases: HostingDatabase[]; onEdit: (user: HostingDatabaseUser) => void; onDelete: (user: HostingDatabaseUser) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-10 px-4 py-2"><input className="h-4 w-4 rounded border-slate-300" type="checkbox" /></th>
            <th className="px-2 py-2">Nombre</th>
            <th className="px-2 py-2">Base de datos asignada</th>
            <th className="px-2 py-2">Servidor</th>
            <th className="px-2 py-2">Control de acceso</th>
            <th className="px-4 py-2 text-right">Operar</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {users.map((user) => {
            const assignedNames = user.databases.map((database) => database.name).join(", ") || databases.find((database) => database.username === user.username)?.name || "Sin asignar"
            return (
              <tr className="h-[52px] hover:bg-slate-50" key={user.id}>
                <td className="px-4 py-2"><input className="h-4 w-4 rounded border-slate-300" type="checkbox" /></td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <div className="grid h-7 w-7 place-items-center rounded-md bg-blue-50 text-blue-600"><UserRound className="h-4 w-4" /></div>
                    <div>
                      <div className="font-semibold text-slate-900">{user.username}</div>
                      <div className="text-xs text-slate-500">Usuario BD #{user.id.toString().padStart(3, "0")}</div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2 text-xs font-semibold text-slate-700">{assignedNames}</td>
                <td className="px-2 py-2"><EngineBadge engine={user.engine} /></td>
                <td className="px-2 py-2 text-xs font-bold text-slate-700">{accessLabels[user.access]}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button className="h-8 rounded-md px-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50" onClick={() => onEdit(user)} type="button">Editar</button>
                    <button className="h-8 rounded-md px-2 text-xs font-bold text-red-600 transition hover:bg-red-50" onClick={() => onDelete(user)} type="button">Eliminar</button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return <button className={cn("h-8 rounded px-3 text-xs font-bold transition", active ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-900")} onClick={onClick} type="button">{children}</button>
}

function Modal({ kicker, title, children, onClose }: { kicker: string; title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div><div className="eh-kicker">{kicker}</div><h3 className="mt-1 text-lg font-bold">{title}</h3></div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button"><XCircle className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function TextInput({ disabled, label, onChange, placeholder, type = "text", value }: { disabled?: boolean; label: string; onChange: (value: string) => void; placeholder?: string; type?: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>
      <input className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} />
    </label>
  )
}

function SelectInput({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<[string, string]>; value: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>
      <select className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}
      </select>
    </label>
  )
}

function ModalFooter({ disabled, onCancel, submitLabel }: { disabled: boolean; onCancel: () => void; submitLabel: string }) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
      <Button onClick={onCancel} size="sm" type="button" variant="outline">Cancelar</Button>
      <Button disabled={disabled} size="sm" type="submit">{submitLabel}</Button>
    </div>
  )
}

function DbSummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="eh-card p-3"><div className="flex items-center justify-between"><div><div className="text-sm font-bold">{label}</div><div className="text-xs text-slate-500">{detail}</div></div><div className="text-2xl font-bold text-slate-900">{value}</div></div></div>
}

function DbSelectFilter({ icon: Icon, value, options, onChange }: { icon: typeof Filter; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-600">
      <Icon className="h-4 w-4 text-slate-400" />
      <select className="h-full bg-transparent pr-5 text-xs font-semibold outline-none" onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </div>
  )
}

function DbStatusBadge({ status }: { status: DbStatus }) {
  const className = status === "Activa" ? "bg-emerald-50 text-emerald-700" : status === "Error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold", className)}><ShieldCheck className="h-3.5 w-3.5" />{status}</span>
}

function EngineBadge({ engine }: { engine: DbEngine }) {
  return <span className={cn("rounded-md px-2 py-1 text-xs font-bold", engine === "mariadb" ? "bg-cyan-50 text-cyan-700" : "bg-indigo-50 text-indigo-700")}>{engineLabels[engine]}</span>
}

function SmallAction({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return <button aria-label={label} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" onClick={onClick} title={label} type="button"><Icon className="h-4 w-4" /></button>
}

function accessOptions(): Array<[DbAccess, string]> {
  return [["read_write", "Lectura y escritura"], ["read_only", "Solo lectura"], ["admin", "Admin"]]
}

function prefixedDatabaseIdentifier(prefix: string, value: string) {
  const cleanPrefix = sanitizeDatabaseIdentifier(prefix)
  const cleanValue = sanitizeDatabaseIdentifier(value)
  if (!cleanPrefix) return cleanValue
  if (!cleanValue) return cleanPrefix
  if (cleanValue === cleanPrefix || cleanValue.startsWith(`${cleanPrefix}_`)) return cleanValue
  return `${cleanPrefix}_${cleanValue}`.slice(0, 64)
}

function sanitizeDatabaseIdentifier(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function mapStatus(status: HostingDatabase["status"] | HostingDatabaseUser["status"]): DbStatus {
  if (status === "active") return "Activa"
  if (status === "failed") return "Error"
  return "En proceso"
}

function formatDate(value: string) {
  return value ? value.slice(0, 10) : "-"
}

function formatSize(sizeMb: number) {
  if (sizeMb >= 1024) return `${(sizeMb / 1024).toFixed(1)} GB`
  return `${Math.round(sizeMb)} MB`
}
