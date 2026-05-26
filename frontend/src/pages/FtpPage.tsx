import {
  ArrowLeft,
  Edit3,
  Filter,
  Folder,
  FolderOpen,
  KeyRound,
  Plus,
  Power,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { hostingApi, type FileManagerItem, type HostingAccount, type HostingFtpUser, type SftpInfo } from "@/api/hosting"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type FtpAccount = {
  id: string
  accountId: string
  accountUsername: string
  ftpUserId?: number
  user: string
  root: string
  protocol: string
  status: string
  lastAccess: string
  ips: string
  quota: string
  quotaMb: number
  domain: string
  info?: SftpInfo
  isPrimary: boolean
}

export function FtpPage() {
  const [accounts, setAccounts] = useState<FtpAccount[]>([])
  const [query, setQuery] = useState("")
  const [editingAccount, setEditingAccount] = useState<FtpAccount | null>(null)
  const [editingFtpUser, setEditingFtpUser] = useState<FtpAccount | null>(null)
  const [configAccount, setConfigAccount] = useState<FtpAccount | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const loadAccounts = useCallback(async () => {
    setError("")
    setIsLoading(true)

    try {
      const page = await hostingApi.accounts()
      const ftpUsers = await hostingApi.ftpUsers()
      const primaryAccounts = await Promise.all(page.results.map(loadSftpAccount))
      const additionalAccounts = ftpUsers.results.map(mapFtpUser)
      setAccounts([...primaryAccounts, ...additionalAccounts])
    } catch (loadError) {
      setError(readMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(loadAccounts)
  }, [loadAccounts])

  const filteredAccounts = useMemo(
    () =>
      accounts.filter((account) =>
        `${account.user} ${account.root} ${account.domain}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [accounts, query],
  )
  const activeCount = accounts.filter((account) => account.status === "Activo").length

  async function openConfig(account: FtpAccount) {
    setError("")

    try {
      if (!account.isPrimary) {
        setConfigAccount(account)
        return
      }
      const info = account.info ?? (await hostingApi.sftpInfo(account.accountId))
      const nextAccount = { ...account, info, protocol: info.protocol, root: info.root, user: info.username }
      setConfigAccount(nextAccount)
      setAccounts((current) => current.map((item) => (item.accountId === account.accountId ? nextAccount : item)))
    } catch (configError) {
      setError(readMessage(configError))
    }
  }

  async function changePassword(account: FtpAccount, password: string) {
    setError("")
    setMessage("")

    try {
      const result = await hostingApi.changeSftpPassword(account.accountId, password)
      setMessage(`Cambio de contrasena enviado. Job ${result.job}`)
      setEditingAccount(null)
    } catch (passwordError) {
      setError(readMessage(passwordError))
    }
  }

  async function createUser(payload: { accountId: string; username: string; password: string; root: string; quotaMb: number }) {
    setError("")
    setMessage("")

    try {
      const ftpUser = await hostingApi.createFtpUser({
        account: payload.accountId,
        password: payload.password,
        quota_mb: payload.quotaMb,
        root: payload.root,
        username: payload.username,
      })
      setAccounts((current) => [...current, mapFtpUser(ftpUser)])
      setMessage(`Usuario FTP/FTPS ${ftpUser.username} creado y enviado al nodo.`)
      setIsCreateOpen(false)
    } catch (createError) {
      setError(readMessage(createError))
    }
  }

  async function updateUser(account: FtpAccount, payload: { password?: string; quotaMb: number; root: string }) {
    if (!account.ftpUserId) return
    setError("")
    setMessage("")

    try {
      const ftpUser = await hostingApi.updateFtpUser(account.ftpUserId, {
        password: payload.password || undefined,
        quota_mb: payload.quotaMb,
        root: payload.root,
      })
      const mapped = mapFtpUser(ftpUser)
      setAccounts((current) => current.map((item) => (item.id === account.id ? mapped : item)))
      setMessage(`Usuario FTP/FTPS ${ftpUser.username} actualizado${payload.password ? " y reenviado al nodo" : ""}.`)
      setEditingFtpUser(null)
    } catch (updateError) {
      setError(readMessage(updateError))
    }
  }

  async function deleteUser(account: FtpAccount) {
    if (!account.ftpUserId) {
      setMessage("El acceso principal se administra desde la cuenta hosting. Los usuarios adicionales si se pueden eliminar aqui.")
      return
    }
    setError("")
    setMessage("")

    try {
      const ftpUser = await hostingApi.deleteFtpUser(account.ftpUserId)
      const mapped = mapFtpUser(ftpUser)
      setAccounts((current) => current.map((item) => (item.id === account.id ? mapped : item)))
      setMessage(`Eliminacion de ${ftpUser.username} enviada al nodo.`)
    } catch (deleteError) {
      setError(readMessage(deleteError))
    }
  }

  async function toggleUserSuspension(account: FtpAccount) {
    if (!account.ftpUserId) {
      setMessage("El acceso principal se suspende desde la cuenta hosting. Los usuarios adicionales si se pueden suspender aqui.")
      return
    }
    setError("")
    setMessage("")

    try {
      const ftpUser =
        account.status === "Suspendido"
          ? await hostingApi.unsuspendFtpUser(account.ftpUserId)
          : await hostingApi.suspendFtpUser(account.ftpUserId)
      const mapped = mapFtpUser(ftpUser)
      setAccounts((current) => current.map((item) => (item.id === account.id ? mapped : item)))
      setMessage(`${account.status === "Suspendido" ? "Reactivacion" : "Suspension"} de ${ftpUser.username} enviada al nodo.`)
    } catch (suspendError) {
      setError(readMessage(suspendError))
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Usuarios" value={isLoading ? "..." : accounts.length.toString()} detail="FTP/FTPS principal" />
        <Metric label="Activos" value={activeCount.toString()} detail="Con acceso" />
        <Metric label="FTPS" value={accounts.length.toString()} detail="Recomendado" />
        <Metric label="Ultimo acceso" value="-" detail="No reportado por backend" />
      </section>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-base font-bold">FTP / FTPS</h2>
            <p className="text-xs text-slate-500">
              Acceso FTP/FTPS principal por cuenta hosting.{isLoading ? " Sincronizando..." : ""}
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} size="sm">
            <Plus className="h-4 w-4" />
            Crear usuario
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex h-8 min-w-[260px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input
              className="h-full min-w-0 flex-1 bg-transparent outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar usuario, dominio o ruta"
              value={query}
            />
          </div>
          <Button onClick={() => setMessage("Filtro por protocolo no es necesario hasta que existan multiples protocolos por usuario.")} size="sm" variant="outline">
            <Filter className="h-4 w-4" />
            Protocolo
          </Button>
          <Button onClick={() => setMessage("Todos los accesos mostrados corresponden a cuentas activas visibles para tu usuario.")} size="sm" variant="outline">
            <ShieldCheck className="h-4 w-4" />
            Estado
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Usuario</th>
                <th className="px-2 py-2">Ruta raiz</th>
                <th className="px-2 py-2">Protocolo</th>
                <th className="px-2 py-2">Estado</th>
                <th className="px-2 py-2">Ultimo acceso</th>
                <th className="px-2 py-2">IP permitidas</th>
                <th className="px-2 py-2">Cuota</th>
                <th className="px-4 py-2 text-right">Operar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredAccounts.map((account) => (
                <tr className="h-[54px] hover:bg-slate-50" key={account.id}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="grid h-7 w-7 place-items-center rounded-md bg-blue-50 text-blue-700">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <span>
                        <span className="block font-bold text-slate-900">{account.user}</span>
                        <span className="block text-xs text-slate-500">{account.domain}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs font-semibold text-slate-700">
                    <Folder className="mr-1 inline h-3.5 w-3.5" />
                    {account.root}
                  </td>
                  <td className="px-2 py-2 text-xs font-bold text-slate-700">{account.protocol}</td>
                  <td className="px-2 py-2">
                    <Status value={account.status} />
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-600">{account.lastAccess}</td>
                  <td className="px-2 py-2 text-xs text-slate-600">{account.ips}</td>
                  <td className="px-2 py-2 text-xs font-bold text-slate-700">{account.quota}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <IconAction
                        icon={Edit3}
                        label="Editar"
                        onClick={() =>
                          account.isPrimary
                            ? setMessage("El acceso principal se administra desde la cuenta hosting. Los usuarios adicionales si se pueden editar aqui.")
                            : setEditingFtpUser(account)
                        }
                      />
                      <IconAction icon={KeyRound} label="Cambiar contrasena" onClick={() => setEditingAccount(account)} />
                      <IconAction icon={Settings} label="Datos de configuracion" onClick={() => void openConfig(account)} />
                      <IconAction icon={Power} label={account.status === "Suspendido" ? "Reactivar" : "Suspender"} onClick={() => void toggleUserSuspension(account)} />
                      <IconAction icon={Trash2} label="Eliminar" onClick={() => void deleteUser(account)} tone="danger" />
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredAccounts.length && (
                <tr>
                  <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={8}>
                    {isLoading ? "Cargando accesos FTP/FTPS..." : "No hay accesos para mostrar."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editingAccount && (
        <PasswordModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSave={(password) => void changePassword(editingAccount, password)}
        />
      )}
      {isCreateOpen && (
        <CreateFtpUserModal
          accounts={accounts.filter((account) => account.isPrimary)}
          onClose={() => setIsCreateOpen(false)}
          onSave={(payload) => void createUser(payload)}
        />
      )}
      {editingFtpUser && (
        <EditFtpUserModal
          account={editingFtpUser}
          onClose={() => setEditingFtpUser(null)}
          onSave={(payload) => void updateUser(editingFtpUser, payload)}
        />
      )}
      {configAccount && <FtpConfigModal account={configAccount} onClose={() => setConfigAccount(null)} />}
    </div>
  )
}

function CreateFtpUserModal({
  accounts,
  onClose,
  onSave,
}: {
  accounts: FtpAccount[]
  onClose: () => void
  onSave: (payload: { accountId: string; username: string; password: string; root: string; quotaMb: number }) => void
}) {
  const firstAccount = accounts[0]
  const [accountId, setAccountId] = useState(firstAccount?.accountId ?? "")
  const selectedAccount = accounts.find((account) => account.accountId === accountId) ?? firstAccount
  const [suffix, setSuffix] = useState("")
  const [root, setRoot] = useState("public_html")
  const [quotaMb, setQuotaMb] = useState("1024")
  const [password, setPassword] = useState("")
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false)
  const username = selectedAccount && suffix ? `${selectedAccount.accountUsername}_${suffix.toLowerCase().replace(/[^a-z0-9_]/g, "")}` : ""
  const parsedQuotaMb = parseQuotaMb(quotaMb)
  const canSave = Boolean(selectedAccount && username && password.length >= 8 && root.trim() && parsedQuotaMb !== null)

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="eh-kicker">Crear usuario FTP/FTPS</div>
            <h3 className="mt-1 text-lg font-bold">{username || "Nuevo acceso"}</h3>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Cuenta hosting</span>
            <select
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
              onChange={(event) => setAccountId(event.target.value)}
              value={accountId}
            >
              {accounts.map((account) => (
                <option key={account.accountId} value={account.accountId}>
                  {account.domain} ({account.accountUsername})
                </option>
              ))}
            </select>
          </label>
          <Field label="Usuario" onChange={setSuffix} placeholder="deploy, admin, editor" value={suffix} />
          <InfoLine label="Usuario final" value={username || "-"} />
          <RootPickerField label="Carpeta raiz" onBrowse={() => setIsFolderPickerOpen(true)} onChange={setRoot} placeholder="public_html" value={root} />
          <Field label="Cuota de datos (MB)" onChange={setQuotaMb} placeholder="1024, 5120, 0 sin limite" type="number" value={quotaMb} />
          <Field label="Contrasena" onChange={setPassword} placeholder="Minimo 8 caracteres" type="password" value={password} />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">
            Cancelar
          </Button>
          <Button disabled={!canSave} onClick={() => selectedAccount && parsedQuotaMb !== null && onSave({ accountId: selectedAccount.accountId, password, quotaMb: parsedQuotaMb, root, username })} size="sm">
            Crear usuario
          </Button>
        </div>
      </div>
      {isFolderPickerOpen && selectedAccount ? (
        <FolderPickerModal
          account={selectedAccount}
          onClose={() => setIsFolderPickerOpen(false)}
          onSelect={(path) => {
            setRoot(path)
            setIsFolderPickerOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

function EditFtpUserModal({
  account,
  onClose,
  onSave,
}: {
  account: FtpAccount
  onClose: () => void
  onSave: (payload: { password?: string; quotaMb: number; root: string }) => void
}) {
  const relativeRoot = account.root.replace(`/home/${account.accountUsername}/`, "")
  const [root, setRoot] = useState(relativeRoot)
  const [quotaMb, setQuotaMb] = useState(account.quotaMb.toString())
  const [password, setPassword] = useState("")
  const parsedQuotaMb = parseQuotaMb(quotaMb)
  const canSave = Boolean(root.trim() && parsedQuotaMb !== null && (password.length === 0 || password.length >= 8))

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="eh-kicker">Editar usuario FTP/FTPS</div>
            <h3 className="mt-1 text-lg font-bold">{account.user}</h3>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4 px-5 py-4">
          <InfoLine label="Cuenta" value={`${account.domain} (${account.accountUsername})`} />
          <Field label="Carpeta raiz" onChange={setRoot} placeholder="public_html" value={root} />
          <Field label="Cuota de datos (MB)" onChange={setQuotaMb} placeholder="1024, 5120, 0 sin limite" type="number" value={quotaMb} />
          <Field label="Nueva contrasena" onChange={setPassword} placeholder="Opcional, minimo 8 caracteres" type="password" value={password} />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">
            Cancelar
          </Button>
          <Button disabled={!canSave} onClick={() => parsedQuotaMb !== null && onSave({ password: password || undefined, quotaMb: parsedQuotaMb, root })} size="sm">
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  )
}

function PasswordModal({
  account,
  onClose,
  onSave,
}: {
  account: FtpAccount
  onClose: () => void
  onSave: (password: string) => void
}) {
  const [password, setPassword] = useState("")

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="eh-kicker">Cambiar contrasena FTP/FTPS</div>
            <h3 className="mt-1 text-lg font-bold">{account.user}</h3>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4 px-5 py-4">
          <Field label="Nueva contrasena" onChange={setPassword} placeholder="Minimo 8 caracteres" type="password" value={password} />
          <RootDisplay root={account.root} />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">
            Cancelar
          </Button>
          <Button disabled={password.length < 8} onClick={() => onSave(password)} size="sm">
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  )
}

function RootDisplay({ root }: { root: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">Carpeta raiz</span>
      <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50">
        <input className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" readOnly value={root} />
        <span className="grid h-9 w-9 place-items-center border-l border-slate-200 text-blue-700">
          <FolderOpen className="h-4 w-4" />
        </span>
      </div>
    </label>
  )
}

function FtpConfigModal({ account, onClose }: { account: FtpAccount; onClose: () => void }) {
  const info = account.info

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="eh-kicker">Datos de configuracion</div>
            <h3 className="mt-1 text-lg font-bold">{account.user}</h3>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2 px-5 py-4 text-sm">
          <InfoLine label="Servidor" value={info?.host ?? account.domain} />
          <InfoLine label="Usuario" value={info?.username ?? account.user} />
          <InfoLine label="Protocolo" value={info?.protocol ?? account.protocol} />
          <InfoLine label="Puerto" value={(info?.port ?? 21).toString()} />
          <InfoLine label="Carpeta raiz" value={info?.root ?? account.root} />
          <InfoLine label="Web root" value={info?.webroot ?? "-"} />
          <InfoLine label="Comando" value={info?.command ?? "-"} />
          <InfoLine label="FTPS" value={info?.ftps ? `${info.ftps.host}:${info.ftps.port} ${info.ftps.protocol}` : "-"} />
          <InfoLine label="Aislamiento" value={info?.isolation ?? "-"} />
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  label: string
  onChange: (value: string) => void
  placeholder: string
  type?: string
  value: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>
      <input
        className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  )
}

function RootPickerField({
  label,
  onBrowse,
  onChange,
  placeholder,
  value,
}: {
  label: string
  onBrowse: () => void
  onChange: (value: string) => void
  placeholder: string
  value: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>
      <div className="flex h-9 overflow-hidden rounded-md border border-slate-200 bg-white focus-within:border-blue-500">
        <input
          className="min-w-0 flex-1 px-3 text-sm outline-none"
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          value={value}
        />
        <button
          className="grid h-9 w-9 place-items-center border-l border-slate-200 text-blue-700 transition hover:bg-blue-50"
          onClick={onBrowse}
          title="Explorar carpetas"
          type="button"
        >
          <FolderOpen className="h-4 w-4" />
        </button>
      </div>
    </label>
  )
}

function FolderPickerModal({
  account,
  onClose,
  onSelect,
}: {
  account: FtpAccount
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
        const response = await hostingApi.fileList(account.accountId, currentPath)
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
  }, [account.accountId, currentPath])

  const parentPath = currentPath === "/" ? "/" : normalizeFolderPath(currentPath.split("/").slice(0, -1).join("/") || "/")
  const canSelectCurrent = currentPath !== "/"

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 px-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="eh-kicker">{account.domain}</div>
            <h3 className="mt-1 truncate text-lg font-bold">Seleccionar carpeta raiz</h3>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <div className="flex items-center gap-2">
            <Button disabled={currentPath === "/"} onClick={() => setCurrentPath(parentPath)} size="sm" type="button" variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Subir
            </Button>
            <div className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800">
              <span className="block truncate">{currentPath}</span>
            </div>
            <Button disabled={!canSelectCurrent} onClick={() => onSelect(toRelativeRoot(currentPath))} size="sm" type="button">
              Usar actual
            </Button>
          </div>
        </div>

        <div className="max-h-[420px] overflow-auto px-5 py-4">
          {error ? <Notice tone="error" text={error} /> : null}
          {isLoading ? <div className="py-8 text-center text-sm font-semibold text-slate-500">Cargando carpetas...</div> : null}
          {!isLoading && !folders.length && !error ? (
            <div className="py-8 text-center text-sm font-semibold text-slate-500">No hay carpetas en esta ruta.</div>
          ) : null}
          <div className="space-y-1">
            {folders.map((folder) => {
              const folderPath = normalizeFolderPath(folder.path)

              return (
                <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2" key={folderPath}>
                  <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setCurrentPath(folderPath)} type="button">
                    <Folder className="h-4 w-4 shrink-0 text-blue-600" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900">{folder.name}</span>
                      <span className="block truncate text-xs text-slate-500">{folderPath}</span>
                    </span>
                  </button>
                  <Button onClick={() => onSelect(toRelativeRoot(folderPath))} size="sm" type="button" variant="outline">
                    Usar
                  </Button>
                </div>
              )
            })}
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

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="font-bold text-slate-500">{label}</span>
      <span className="break-words font-semibold text-slate-900">{value}</span>
    </div>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="eh-card p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{detail}</div>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-50 text-blue-700">
          <Server className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

function Status({ value }: { value: string }) {
  return (
    <span className={cn("rounded-md px-2 py-1 text-xs font-bold", value === "Activo" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>
      {value}
    </span>
  )
}

function IconAction({
  icon: Icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: typeof Edit3
  label: string
  onClick?: () => void
  tone?: "default" | "danger"
}) {
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

function Notice({ text, tone }: { text: string; tone: "success" | "error" }) {
  return (
    <div className={cn("rounded-md border px-3 py-2 text-sm font-semibold", tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800")}>
      {text}
    </div>
  )
}

async function loadSftpAccount(account: HostingAccount): Promise<FtpAccount> {
  try {
    const info = await hostingApi.sftpInfo(account.id)
    return {
      id: `primary-${account.id}`,
      accountId: account.id,
      accountUsername: account.username,
      domain: account.primary_domain,
      info,
      ips: "Todas",
      isPrimary: true,
      lastAccess: "-",
      protocol: info.protocol,
      quota: formatMb(account.disk_mb),
      quotaMb: account.disk_mb,
      root: info.root,
      status: account.status === "active" ? "Activo" : "Pendiente",
      user: info.username,
    }
  } catch {
    return {
      id: `primary-${account.id}`,
      accountId: account.id,
      accountUsername: account.username,
      domain: account.primary_domain,
      ips: "Todas",
      isPrimary: true,
      lastAccess: "-",
      protocol: "FTPES / explicit TLS",
      quota: formatMb(account.disk_mb),
      quotaMb: account.disk_mb,
      root: `/home/${account.username}`,
      status: account.status === "active" ? "Activo" : "Pendiente",
      user: account.username,
    }
  }
}

function mapFtpUser(user: HostingFtpUser): FtpAccount {
  const host = user.node_hostname || user.account_domain
  return {
    id: `ftp-${user.id}`,
    accountId: user.account,
    accountUsername: user.account_username,
    ftpUserId: user.id,
    domain: user.account_domain,
    info: {
      command: `ftpes://${user.username}@${host}:21`,
      host,
      ftps: {
        host,
        passive_ports: "30000-30100",
        port: 21,
        protocol: user.protocol,
      },
      isolation: "Cuenta FTP/FTPS aislada por la carpeta asignada; el panel no publica acceso por SSH.",
      port: 21,
      protocol: user.protocol,
      root: user.absolute_root,
      username: user.username,
      webroot: user.absolute_root,
    },
    ips: "Todas",
    isPrimary: false,
    lastAccess: "-",
    protocol: user.protocol,
    quota: user.quota_mb > 0 ? formatMb(user.quota_mb) : "Sin limite",
    quotaMb: user.quota_mb,
    root: user.absolute_root,
    status: user.status === "active" ? "Activo" : user.status === "failed" ? "Fallido" : user.status === "suspended" ? "Suspendido" : "Pendiente",
    user: user.username,
  }
}

function formatMb(value: number) {
  if (value >= 1024) return `${(value / 1024).toFixed(1)} GB`
  return `${Math.round(value)} MB`
}

function parseQuotaMb(value: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return null
  return parsed
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
  return error instanceof Error ? error.message : "No se pudo completar la operacion."
}

