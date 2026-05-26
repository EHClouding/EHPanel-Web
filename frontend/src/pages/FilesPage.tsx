import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calculator,
  Code2,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  File,
  FileArchive,
  FileCode2,
  Folder,
  FolderOpen,
  Globe2,
  KeyRound,
  MoreVertical,
  MoveRight,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { hostingApi, type FileManagerItem, type HostingAccount } from "@/api/hosting"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type FileKind = "folder" | "html" | "php" | "css" | "image" | "archive" | "file"

type FileEntry = {
  id: number
  name: string
  kind: FileKind
  path: string
  size: string
  rawSize: number
  modifiedAt: string
  permissions: string
}

type FileOperation =
  | "compress"
  | "extract"
  | "permissions"
  | "htmlEditor"
  | "codeEditor"
  | "preview"
type SortField = "name" | "kind" | "rawSize" | "modifiedAt"
type SortDirection = "asc" | "desc"
type ArchiveFormat = "zip" | "tar.gz" | "tar"

export function FilesPage() {
  const [accounts, setAccounts] = useState<HostingAccount[]>([])
  const [accountId, setAccountId] = useState("")
  const [currentPath, setCurrentPath] = useState("/")
  const [files, setFiles] = useState<FileEntry[]>([])
  const [query, setQuery] = useState("")
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [quickAction, setQuickAction] = useState<"url" | "file" | "folder" | null>(null)
  const [quickValue, setQuickValue] = useState("")
  const [operation, setOperation] = useState<FileOperation | null>(null)
  const [editorContent, setEditorContent] = useState("")
  const [chmodValue, setChmodValue] = useState("644")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [isLoading, setIsLoading] = useState(true)
  const [showOpenLiteSpeedApply, setShowOpenLiteSpeedApply] = useState(false)
  const [isApplyingOpenLiteSpeed, setIsApplyingOpenLiteSpeed] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)

  const activeAccount = accounts.find((account) => account.id === accountId) ?? null
  const filteredFiles = useMemo(() => {
    const visible = files.filter((entry) => `${entry.name} ${entry.kind}`.toLowerCase().includes(query.toLowerCase()))
    return sortFileEntries(visible, sortField, sortDirection)
  }, [files, query, sortDirection, sortField])
  const selectedFiles = files.filter((entry) => selectedPaths.includes(entry.path))
  const selectedFile = selectedFiles[0] ?? null
  const selectedArchive = selectedFiles.find((entry) => entry.kind === "archive") ?? selectedFile
  const hasArchiveSelected = selectedFiles.some((entry) => entry.kind === "archive")
  const folderItems = files.filter((entry) => entry.kind === "folder")
  const folderUsage = formatBytes(files.reduce((sum, entry) => sum + entry.rawSize, 0))

  const loadFiles = useCallback(async (targetAccountId = accountId, path = currentPath) => {
    if (!targetAccountId) return

    setError("")
    setMessage("")
    setIsLoading(true)

    try {
      const response = await hostingApi.fileList(targetAccountId, path)
      const completed = await waitFileResult(response.job, response)
      const items = extractItems(completed)
      setFiles(items.map(mapFileItem))
      setSelectedPaths([])

      if (completed.status !== "success") {
        setMessage(`Listado en proceso. Job ${completed.job}`)
      }
    } catch (loadError) {
      setError(readMessage(loadError))
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [accountId, currentPath])

  useEffect(() => {
    void Promise.resolve().then(async () => {
      try {
        const page = await hostingApi.accounts()
        setAccounts(page.results)
        setAccountId(page.results[0]?.id ?? "")
      } catch (loadError) {
        setError(readMessage(loadError))
        setIsLoading(false)
      }
    })
  }, [])

  useEffect(() => {
    if (!accountId) return
    void Promise.resolve().then(() => loadFiles(accountId, currentPath))
  }, [accountId, currentPath, loadFiles])

  const openFolder = (entry: FileEntry) => {
    if (entry.kind !== "folder") return
    setCurrentPath(normalizePath(entry.path))
  }

  const toggleSelection = (path: string) => {
    setSelectedPaths((current) => (current.includes(path) ? current.filter((item) => item !== path) : [...current, path]))
  }
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setSortField(field)
    setSortDirection(field === "rawSize" || field === "modifiedAt" ? "desc" : "asc")
  }

  const handleCreateFolder = async () => {
    if (!quickValue.trim()) return
    await runFileMutation(() => hostingApi.fileMkdir(accountId, joinPath(currentPath, quickValue.trim())), "Carpeta creada.")
    setQuickAction(null)
    setQuickValue("")
  }

  const handleCreateFile = async () => {
    if (!quickValue.trim()) return
    await runFileMutation(() => hostingApi.fileWrite(accountId, joinPath(currentPath, quickValue.trim()), ""), "Archivo creado.")
    setQuickAction(null)
    setQuickValue("")
  }

  const handleUploadFiles = async (fileList: FileList | null, preserveRelativePath = false) => {
    const items = Array.from(fileList ?? [])
    if (!items.length) return
    const hasHtaccess = items.some((item) => {
      const relativePath = preserveRelativePath ? String(item.webkitRelativePath || item.name) : item.name
      return isHtaccessPath(relativePath)
    })
    setError("")
    setMessage("")

    try {
      for (const item of items) {
        const relativePath = preserveRelativePath ? String(item.webkitRelativePath || item.name) : item.name
        await hostingApi.fileUpload(accountId, joinPath(currentPath, relativePath), item)
      }
      await loadFiles(accountId, currentPath)
      if (hasHtaccess && activeAccount?.web_engine === "openlitespeed") {
        setShowOpenLiteSpeedApply(true)
        setMessage(`${items.length === 1 ? "Archivo cargado" : `${items.length} archivos cargados`}. Reinicia OpenLiteSpeed para aplicar cambios .htaccess.`)
      } else {
        setMessage(items.length === 1 ? "Archivo cargado." : `${items.length} archivos cargados.`)
      }
    } catch (uploadError) {
      setError(readMessage(uploadError))
    }
  }

  const handleImportUrl = async () => {
    if (!quickValue.trim()) return
    await runFileMutation(() => hostingApi.fileImportUrl(accountId, quickValue.trim(), currentPath), "Archivo importado.")
    setQuickAction(null)
    setQuickValue("")
  }

  const handleDelete = async () => {
    if (!selectedFile) return
    if (!window.confirm(`Eliminar ${selectedFile.name}?`)) return
    await runFileMutation(() => hostingApi.fileDelete(accountId, selectedFile.path, selectedFile.kind === "folder"), "Elemento eliminado.")
  }

  const handleChmod = async () => {
    if (!selectedFile) return
    await runFileMutation(() => hostingApi.fileChmod(accountId, selectedFile.path, chmodValue), "Permisos actualizados.")
    setOperation(null)
  }

  const handleSaveFile = async () => {
    if (!selectedFile) return
    const needsOpenLiteSpeedApply = isHtaccessPath(selectedFile.path) && activeAccount?.web_engine === "openlitespeed"
    await runFileMutation(
      () => hostingApi.fileWrite(accountId, selectedFile.path, editorContent),
      needsOpenLiteSpeedApply ? "Archivo guardado. Reinicia OpenLiteSpeed para aplicar cambios .htaccess." : "Archivo guardado.",
      () => {
        if (needsOpenLiteSpeedApply) setShowOpenLiteSpeedApply(true)
      },
    )
    setOperation(null)
  }
  const handleCopy = async () => {
    if (!selectedFile) return
    const destination = window.prompt("Copiar a ruta:", selectedFile.path)
    if (!destination) return
    await runFileMutation(() => hostingApi.fileCopy(accountId, { destination_path: destination, path: selectedFile.path }), "Elemento copiado.")
  }
  const handleMove = async () => {
    if (!selectedFile) return
    const destination = window.prompt("Mover a ruta:", selectedFile.path)
    if (!destination) return
    await runFileMutation(() => hostingApi.fileMove(accountId, { destination_path: destination, path: selectedFile.path }), "Elemento movido.")
  }
  const handleRename = async () => {
    if (!selectedFile) return
    const name = window.prompt("Nuevo nombre:", selectedFile.name)
    if (!name || name === selectedFile.name) return
    await runFileMutation(() => hostingApi.fileRename(accountId, selectedFile.path, name), "Elemento renombrado.")
  }
  const handleDownload = async (targetFile = selectedFile) => {
    if (!targetFile || targetFile.kind === "folder") return
    try {
      const blob = await hostingApi.fileDownload(accountId, targetFile.path)
      downloadBlob(targetFile.name, blob)
    } catch (downloadError) {
      setError(readMessage(downloadError))
    }
  }
  const handleCompress = async (payload: { archiveName: string; destinationPath: string; format: ArchiveFormat }) => {
    if (!selectedFiles.length) return
    await runFileMutation(
      () =>
        hostingApi.fileCompress(accountId, {
          archive_name: payload.archiveName,
          destination_path: payload.destinationPath,
          format: payload.format,
          paths: selectedFiles.map((entry) => entry.path),
        }),
      "Archivo comprimido creado.",
    )
    setOperation(null)
  }
  const handleExtract = async (payload: { destinationPath: string; format?: ArchiveFormat }) => {
    if (!selectedArchive) return
    await runFileMutation(
      () =>
        hostingApi.fileExtract(accountId, {
          destination_path: payload.destinationPath,
          format: payload.format,
          path: selectedArchive.path,
        }),
      "Archivo extraido.",
    )
    setOperation(null)
  }

  const applyOpenLiteSpeedChanges = async () => {
    if (!accountId) return
    setIsApplyingOpenLiteSpeed(true)
    setError("")
    setMessage("")
    try {
      await hostingApi.restartOpenLiteSpeed(accountId)
      setShowOpenLiteSpeedApply(false)
      setMessage("OpenLiteSpeed reiniciado. Los cambios .htaccess ya fueron aplicados.")
    } catch (applyError) {
      setError(readMessage(applyError))
    } finally {
      setIsApplyingOpenLiteSpeed(false)
    }
  }

  const runFileMutation = async (operationHandler: () => Promise<{ job: string; status: string }>, successMessage: string, afterComplete?: () => void) => {
    setError("")
    setMessage("")

    try {
      const response = await operationHandler()
      const completed = await waitFileResult(response.job, response)
      await loadFiles(accountId, currentPath)
      setMessage(completed.status === "success" ? successMessage : `${successMessage} Job ${completed.job} en proceso.`)
      afterComplete?.()
    } catch (mutationError) {
      setError(readMessage(mutationError))
    }
  }

  const openOperation = async (mode: FileOperation, targetFile = selectedFile) => {
    if (!targetFile && mode !== "compress") return
    setError("")
    setMessage("")
    if (targetFile) {
      setSelectedPaths([targetFile.path])
    }
    setOperation(mode)

    if ((mode === "codeEditor" || mode === "htmlEditor" || mode === "preview") && targetFile) {
      try {
        const response = await hostingApi.fileRead(accountId, targetFile.path)
        const completed = await waitFileResult(response.job, response)
        setEditorContent(extractContent(completed))
      } catch (readError) {
        setEditorContent("")
        setError(readMessage(readError))
      }
    }

    if (mode === "permissions" && targetFile) {
      setChmodValue(targetFile.permissions || "644")
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-4">
        <FileSummary label="Ruta actual" value={currentPath} detail={activeAccount?.primary_domain ?? "Cuenta hosting"} />
        <FileSummary label="Elementos" value={isLoading ? "..." : files.length.toString()} detail="Archivos y carpetas" />
        <FileSummary
          label="Seleccionado"
          value={selectedFiles.length ? selectedFiles.length.toString() : "-"}
          detail={selectedFile ? selectedFile.name : "Sin seleccion"}
        />
        <FileSummary label="Uso carpeta" value={folderUsage} detail="Suma del listado actual" />
      </section>

      {message ? <Notice tone="success" text={message} /> : null}
      {showOpenLiteSpeedApply ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          <span>Hay cambios .htaccess pendientes de aplicar en OpenLiteSpeed.</span>
          <Button disabled={isApplyingOpenLiteSpeed} onClick={() => void applyOpenLiteSpeedChanges()} size="sm" variant="outline">
            <RotateCcw className="h-4 w-4" />
            {isApplyingOpenLiteSpeed ? "Reiniciando" : "Aplicar cambios"}
          </Button>
        </div>
      ) : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-base font-bold">Archivos</h2>
            <p className="text-xs text-slate-500">
              Explorador real para {activeAccount?.primary_domain ?? "cuenta hosting"}.{isLoading ? " Sincronizando..." : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="hidden"
              multiple
              onChange={(event) => {
                void handleUploadFiles(event.target.files)
                event.target.value = ""
              }}
              ref={fileInputRef}
              type="file"
            />
            <input
              className="hidden"
              multiple
              onChange={(event) => {
                void handleUploadFiles(event.target.files, true)
                event.target.value = ""
              }}
              ref={(node) => {
                folderInputRef.current = node
                node?.setAttribute("webkitdirectory", "")
                node?.setAttribute("directory", "")
              }}
              type="file"
            />
            <Button onClick={() => fileInputRef.current?.click()} size="sm">
              <Upload className="h-4 w-4" />
              Cargar archivos
            </Button>
            <Button onClick={() => folderInputRef.current?.click()} size="sm" variant="outline">
              <FolderOpen className="h-4 w-4" />
              Cargar directorio
            </Button>
            <QuickCreate
              active={quickAction === "url"}
              buttonIcon={ExternalLink}
              buttonLabel="Importar URL"
              inputLabel="URL"
              onClose={() => setQuickAction(null)}
              onOpen={() => {
                setQuickValue("")
                setQuickAction("url")
              }}
              onSubmit={() => void handleImportUrl()}
              placeholder="https://example.com/archivo.zip"
              value={quickValue}
              onChange={setQuickValue}
            />
            <QuickCreate
              active={quickAction === "file"}
              buttonIcon={Plus}
              buttonLabel="Crear archivo"
              inputLabel="Nombre"
              onClose={() => setQuickAction(null)}
              onOpen={() => {
                setQuickValue("")
                setQuickAction("file")
              }}
              onSubmit={() => void handleCreateFile()}
              placeholder="index.html"
              value={quickValue}
              onChange={setQuickValue}
            />
            <QuickCreate
              active={quickAction === "folder"}
              buttonIcon={Folder}
              buttonLabel="Crear carpeta"
              inputLabel="Nombre"
              onClose={() => setQuickAction(null)}
              onOpen={() => {
                setQuickValue("")
                setQuickAction("folder")
              }}
              onSubmit={() => void handleCreateFolder()}
              placeholder="nueva-carpeta"
              value={quickValue}
              onChange={setQuickValue}
            />
          </div>
        </div>

        <div className="grid min-h-[560px] lg:grid-cols-[270px_1fr]">
          <aside className="border-r border-slate-200 bg-slate-50">
            <div className="space-y-2 border-b border-slate-200 px-3 py-3">
              <select
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none"
                onChange={(event) => {
                  setAccountId(event.target.value)
                  setCurrentPath("/")
                }}
                value={accountId}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.primary_domain}
                  </option>
                ))}
              </select>
              <div className="flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-500">
                <Search className="h-4 w-4" />
                <input className="min-w-0 flex-1 bg-transparent outline-none" placeholder="Buscar carpeta" />
              </div>
            </div>
            <div className="p-2">
              <TreeNode currentPath={currentPath} label="/" path="/" onSelect={setCurrentPath} />
              {folderItems.map((entry) => (
                <TreeNode currentPath={currentPath} key={entry.path} label={entry.name} path={entry.path} onSelect={setCurrentPath} />
              ))}
            </div>
          </aside>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Ruta</div>
                <div className="truncate text-sm font-bold text-slate-900">{currentPath}</div>
              </div>
              <div className="flex h-8 min-w-[260px] items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-500">
                <Search className="h-4 w-4" />
                <input
                  className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar archivo o carpeta"
                  value={query}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-4 py-2">
              <ActionButton disabled={!selectedFile} icon={Copy} label="Copiar" onClick={() => void handleCopy()} />
              <ActionButton disabled={!selectedFile} icon={MoveRight} label="Mover" onClick={() => void handleMove()} />
              <ActionButton disabled={!hasArchiveSelected} icon={FileArchive} label="Extraer" onClick={() => openOperation("extract")} />
              <ActionButton disabled={!selectedFiles.length} icon={Archive} label="Comprimir" onClick={() => openOperation("compress")} />
              <ActionButton disabled={!selectedFile} icon={Calculator} label="Calcular tamano" onClick={() => setMessage("Tamano calculado con el listado actual.")} />
              <ActionButton disabled={!selectedFile} icon={KeyRound} label="Permisos" onClick={() => openOperation("permissions")} />
              <ActionButton disabled={!selectedFile} icon={Edit3} label="Renombrar" onClick={() => void handleRename()} />
              <ActionButton
                disabled={!selectedFile || selectedFile.kind !== "html"}
                icon={Code2}
                label="Editor HTML"
                onClick={() => openOperation("htmlEditor")}
              />
              <ActionButton
                disabled={!selectedFile || selectedFile.kind === "folder"}
                icon={FileCode2}
                label="Editor de Codigo"
                onClick={() => openOperation("codeEditor")}
              />
              <ActionButton disabled={!selectedFile || selectedFile.kind === "folder"} icon={Eye} label="Ver" onClick={() => openOperation("preview")} />
              <ActionButton disabled={!selectedFile || selectedFile.kind === "folder"} icon={Download} label="Descargar" onClick={() => void handleDownload()} />
              <ActionButton disabled={!selectedFile} icon={Trash2} label="Eliminar" onClick={() => void handleDelete()} tone="danger" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-10 px-4 py-2">
                      <input
                        checked={filteredFiles.length > 0 && selectedPaths.length === filteredFiles.length}
                        className="h-4 w-4 rounded border-slate-300"
                        onChange={(event) => setSelectedPaths(event.target.checked ? filteredFiles.map((entry) => entry.path) : [])}
                        type="checkbox"
                      />
                    </th>
                    <SortableHeader activeField={sortField} direction={sortDirection} field="name" label="Nombre" onSort={toggleSort} />
                    <SortableHeader activeField={sortField} direction={sortDirection} field="kind" label="Tipo" onSort={toggleSort} />
                    <SortableHeader activeField={sortField} direction={sortDirection} field="rawSize" label="Tamano" onSort={toggleSort} />
                    <SortableHeader activeField={sortField} direction={sortDirection} field="modifiedAt" label="Modificado" onSort={toggleSort} />
                    <th className="px-2 py-2">Permisos</th>
                    <th className="px-4 py-2 text-right">Operar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredFiles.map((entry) => (
                    <tr
                      className={cn("h-[50px] cursor-pointer hover:bg-slate-50", selectedPaths.includes(entry.path) && "bg-blue-50/70")}
                      key={entry.path}
                      onClick={() => setSelectedPaths([entry.path])}
                    >
                      <td className="px-4 py-2">
                        <input
                          checked={selectedPaths.includes(entry.path)}
                          className="h-4 w-4 rounded border-slate-300"
                          onChange={() => toggleSelection(entry.path)}
                          onClick={(event) => event.stopPropagation()}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <button className="flex min-w-0 items-center gap-2 text-left" onDoubleClick={() => openFolder(entry)} type="button">
                          <FileIcon kind={entry.kind} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-slate-900">{entry.name}</span>
                            <span className="block truncate text-xs text-slate-500">{entry.path}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700">
                          {kindLabel(entry.kind)}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-xs font-bold text-slate-700">{entry.size}</td>
                      <td className="px-2 py-2 text-xs text-slate-600">{entry.modifiedAt}</td>
                      <td className="px-2 py-2 text-xs font-bold text-slate-700">{entry.permissions}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <IconAction
                            icon={Eye}
                            label="Ver"
                            onClick={() => {
                              void openOperation("preview", entry)
                            }}
                          />
                          <IconAction icon={Download} label="Descargar" onClick={() => void handleDownload(entry)} />
                          <IconAction icon={MoreVertical} label="Mas opciones" onClick={() => setMessage("Usa la barra de acciones superior para operar este archivo.")} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filteredFiles.length && (
                    <tr>
                      <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={7}>
                        {isLoading ? "Cargando archivos..." : "No hay elementos en esta ruta."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {operation && (
        <FileOperationModal
          chmodValue={chmodValue}
          currentPath={currentPath}
          editorContent={editorContent}
          file={operation === "extract" ? selectedArchive : selectedFile}
          files={selectedFiles}
          mode={operation}
          onChangeChmod={setChmodValue}
          onChangeContent={setEditorContent}
          onClose={() => setOperation(null)}
          onCompress={(payload) => void handleCompress(payload)}
          onExtract={(payload) => void handleExtract(payload)}
          onSaveChmod={() => void handleChmod()}
          onSaveFile={() => void handleSaveFile()}
        />
      )}
    </div>
  )
}

function TreeNode({ currentPath, label, path, onSelect }: { label: string; path: string; currentPath: string; onSelect: (path: string) => void }) {
  const active = currentPath === path

  return (
    <button
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-semibold transition",
        active ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-white",
      )}
      onClick={() => onSelect(path)}
      type="button"
    >
      <Folder className={cn("h-4 w-4", active ? "text-white" : "text-blue-600")} />
      <span className="truncate">{label}</span>
    </button>
  )
}

function SortableHeader({
  activeField,
  direction,
  field,
  label,
  onSort,
}: {
  activeField: SortField
  direction: SortDirection
  field: SortField
  label: string
  onSort: (field: SortField) => void
}) {
  const active = activeField === field
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <th className="px-2 py-2">
      <button
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[11px] font-bold uppercase tracking-wide transition",
          active ? "text-slate-900" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
        )}
        onClick={() => onSort(field)}
        type="button"
      >
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    </th>
  )
}

function FileSummary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="eh-card p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 truncate text-lg font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{detail}</div>
    </div>
  )
}

function QuickCreate({
  active,
  buttonIcon: ButtonIcon,
  buttonLabel,
  inputLabel,
  placeholder,
  value,
  onChange,
  onOpen,
  onClose,
  onSubmit,
}: {
  active: boolean
  buttonIcon: typeof ExternalLink
  buttonLabel: string
  inputLabel: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  onOpen: () => void
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <div className="relative">
      <Button onClick={active ? onClose : onOpen} size="sm" variant="outline">
        <ButtonIcon className="h-4 w-4" />
        {buttonLabel}
      </Button>
      {active && (
        <div className="absolute right-0 top-10 z-30 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-600">{inputLabel}</span>
            <input
              autoFocus
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => onChange(event.target.value)}
              placeholder={placeholder}
              value={value}
            />
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <Button onClick={onClose} size="sm" type="button" variant="outline">
              Cancelar
            </Button>
            <Button disabled={!value.trim()} onClick={onSubmit} size="sm" type="button">
              Guardar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function FileOperationModal({
  chmodValue,
  currentPath,
  editorContent,
  file,
  files,
  mode,
  onChangeChmod,
  onChangeContent,
  onClose,
  onCompress,
  onExtract,
  onSaveChmod,
  onSaveFile,
}: {
  chmodValue: string
  currentPath: string
  editorContent: string
  file: FileEntry | null
  files: FileEntry[]
  mode: FileOperation
  onChangeChmod: (value: string) => void
  onChangeContent: (value: string) => void
  onClose: () => void
  onCompress: (payload: { archiveName: string; destinationPath: string; format: ArchiveFormat }) => void
  onExtract: (payload: { destinationPath: string; format?: ArchiveFormat }) => void
  onSaveChmod: () => void
  onSaveFile: () => void
}) {
  const titleByMode: Record<FileOperation, string> = {
    compress: "Comprimir archivos",
    extract: "Extraer archivo",
    permissions: "Cambiar permisos",
    htmlEditor: "Editor HTML visual",
    codeEditor: "Editor de codigo",
    preview: "Ver archivo",
  }
  const editable = mode === "htmlEditor" || mode === "codeEditor"
  const [archiveName, setArchiveName] = useState(defaultArchiveName(files, file))
  const [archiveFormat, setArchiveFormat] = useState<ArchiveFormat>(inferArchiveFormat(file?.name) ?? "zip")
  const [destinationPath, setDestinationPath] = useState(currentPath)

  const canCompress = archiveName.trim().length > 0 && destinationPath.trim().length > 0 && files.length > 0
  const canExtract = Boolean(file && destinationPath.trim())

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
      <div className={cn("w-full rounded-lg bg-white shadow-2xl", editable || mode === "preview" ? "max-w-5xl" : "max-w-lg")}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="eh-kicker">{currentPath}</div>
            <h3 className="mt-1 text-lg font-bold">{titleByMode[mode]}</h3>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        {mode === "permissions" && (
          <div className="space-y-4 px-5 py-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-900">{file?.name}</div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">Valor numerico</span>
              <input
                className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => onChangeChmod(event.target.value)}
                value={chmodValue}
              />
            </label>
          </div>
        )}

        {editable && (
          <div className="px-5 py-4">
            <div className="mb-2 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-sm font-bold text-slate-800">{file?.path}</div>
              <div className="text-xs font-semibold text-slate-500">UTF-8</div>
            </div>
            <textarea
              className="min-h-[460px] w-full resize-none rounded-md border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100 outline-none focus:border-blue-500"
              onChange={(event) => onChangeContent(event.target.value)}
              value={editorContent}
            />
          </div>
        )}

        {mode === "preview" && (
          <pre className="mx-5 my-4 max-h-[520px] overflow-auto rounded-md border border-slate-200 bg-slate-950 p-4 text-xs leading-5 text-slate-100">
            {editorContent || "Sin contenido para mostrar."}
          </pre>
        )}

        {mode === "compress" && (
          <div className="space-y-4 px-5 py-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="font-bold text-slate-900">{files.length} elemento(s) seleccionados</div>
              <div className="mt-1 truncate text-xs text-slate-500">{files.map((item) => item.name).join(", ")}</div>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">Nombre</span>
              <input
                className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setArchiveName(event.target.value)}
                placeholder="backup"
                value={archiveName}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">Formato</span>
              <select
                className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setArchiveFormat(event.target.value as ArchiveFormat)}
                value={archiveFormat}
              >
                <option value="zip">zip</option>
                <option value="tar.gz">tar.gz</option>
                <option value="tar">tar</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">Guardar en</span>
              <input
                className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setDestinationPath(event.target.value)}
                value={destinationPath}
              />
            </label>
          </div>
        )}

        {mode === "extract" && (
          <div className="space-y-4 px-5 py-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="font-bold text-slate-900">{file?.name}</div>
              <div className="mt-1 truncate text-xs text-slate-500">{file?.path}</div>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">Extraer en</span>
              <input
                className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setDestinationPath(event.target.value)}
                value={destinationPath}
              />
            </label>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button onClick={onClose} size="sm" type="button" variant="outline">
            Cancelar
          </Button>
          {mode === "permissions" ? (
            <Button onClick={onSaveChmod} size="sm" type="button">
              Aplicar
            </Button>
          ) : mode === "compress" ? (
            <Button disabled={!canCompress} onClick={() => onCompress({ archiveName, destinationPath, format: archiveFormat })} size="sm" type="button">
              Comprimir
            </Button>
          ) : mode === "extract" ? (
            <Button disabled={!canExtract} onClick={() => onExtract({ destinationPath, format: inferArchiveFormat(file?.name) })} size="sm" type="button">
              Extraer
            </Button>
          ) : editable ? (
            <Button onClick={onSaveFile} size="sm" type="button">
              Guardar
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ActionButton({
  icon: Icon,
  label,
  disabled,
  onClick,
  tone = "default",
}: {
  icon: typeof Copy
  label: string
  disabled?: boolean
  onClick?: () => void
  tone?: "default" | "danger"
}) {
  return (
    <button
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-bold transition",
        tone === "danger" ? "border-red-100 text-red-600 hover:bg-red-50" : "border-slate-200 text-slate-700 hover:bg-slate-50",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
      )}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function FileIcon({ kind }: { kind: FileKind }) {
  const className = "h-4 w-4"

  if (kind === "folder") {
    return (
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-600">
        <Folder className={className} />
      </span>
    )
  }

  if (kind === "html" || kind === "php" || kind === "css") {
    return (
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700">
        <FileCode2 className={className} />
      </span>
    )
  }

  if (kind === "archive") {
    return (
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-amber-50 text-amber-700">
        <Archive className={className} />
      </span>
    )
  }

  if (kind === "image") {
    return (
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-cyan-50 text-cyan-700">
        <Globe2 className={className} />
      </span>
    )
  }

  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600">
      <File className={className} />
    </span>
  )
}

function kindLabel(kind: FileKind) {
  const labels: Record<FileKind, string> = {
    folder: "Carpeta",
    html: "HTML",
    php: "PHP",
    css: "CSS",
    image: "Imagen",
    archive: "Comprimido",
    file: "Archivo",
  }

  return labels[kind]
}

function sortFileEntries(entries: FileEntry[], field: SortField, direction: SortDirection) {
  const multiplier = direction === "asc" ? 1 : -1

  return [...entries].sort((left, right) => {
    const kindOrder = fileKindOrder(left.kind) - fileKindOrder(right.kind)
    let result: number

    if (field === "name") {
      result = left.name.localeCompare(right.name, "es", { numeric: true, sensitivity: "base" })
    } else if (field === "kind") {
      result = kindOrder || left.name.localeCompare(right.name, "es", { numeric: true, sensitivity: "base" })
    } else if (field === "rawSize") {
      result = left.rawSize - right.rawSize || left.name.localeCompare(right.name, "es", { numeric: true, sensitivity: "base" })
    } else {
      result = modifiedTimestamp(left.modifiedAt) - modifiedTimestamp(right.modifiedAt) || left.name.localeCompare(right.name, "es", { numeric: true, sensitivity: "base" })
    }

    return result * multiplier
  })
}

function fileKindOrder(kind: FileKind) {
  const order: Record<FileKind, number> = {
    folder: 0,
    html: 1,
    php: 2,
    css: 3,
    image: 4,
    archive: 5,
    file: 6,
  }

  return order[kind]
}

function modifiedTimestamp(value: string) {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function defaultArchiveName(files: FileEntry[], file: FileEntry | null) {
  if (files.length === 1) return stripArchiveExtension(files[0].name)
  if (file) return stripArchiveExtension(file.name)
  return "archivos"
}

function inferArchiveFormat(name?: string | null): ArchiveFormat | undefined {
  const lower = (name || "").toLowerCase()
  if (lower.endsWith(".zip")) return "zip"
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return "tar.gz"
  if (lower.endsWith(".tar")) return "tar"
  return undefined
}

function stripArchiveExtension(name: string) {
  return name.replace(/\.tar\.gz$/i, "").replace(/\.tgz$/i, "").replace(/\.(zip|tar)$/i, "") || "archivos"
}

function IconAction({ icon: Icon, label, onClick }: { icon: typeof Eye; label: string; onClick?: () => void }) {
  return (
    <button
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
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

async function waitFileResult(jobId: string, initial: { status: string; job: string; result?: unknown }) {
  if (initial.status === "success" || initial.status === "failed") return initial

  for (let index = 0; index < 8; index += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 800))
    const job = await hostingApi.job(jobId)
    if (job.status === "success") {
      return { status: "success", job: job.id, result: job.result }
    }
    if (job.status === "failed") {
      throw new Error(job.error_detail || job.error_code || "La operacion de archivos fallo.")
    }
  }

  return initial
}

function extractItems(response: { items?: FileManagerItem[]; result?: unknown }) {
  if (Array.isArray(response.items)) return response.items
  if (isObject(response.result) && Array.isArray(response.result.items)) return response.result.items as FileManagerItem[]
  return []
}

function extractContent(response: { content?: string; result?: unknown }) {
  if (typeof response.content === "string") return response.content
  if (isObject(response.result) && typeof response.result.content === "string") return response.result.content
  return ""
}

function mapFileItem(item: FileManagerItem, index: number): FileEntry {
  const kind = item.type === "dir" ? "folder" : inferKind(item.name)
  return {
    id: index + 1,
    kind,
    modifiedAt: item.modified || "-",
    name: item.name,
    path: normalizePath(item.path),
    permissions: item.mode || "-",
    rawSize: Number(item.size || 0),
    size: kind === "folder" ? "-" : formatBytes(Number(item.size || 0)),
  }
}

function inferKind(name: string): FileKind {
  const lower = name.toLowerCase()
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html"
  if (lower.endsWith(".php")) return "php"
  if (lower.endsWith(".css")) return "css"
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/.test(lower)) return "image"
  if (/\.(zip|tar|gz|tgz|rar|7z)$/.test(lower)) return "archive"
  return "file"
}

function normalizePath(path: string) {
  const value = path.trim()
  if (!value || value === ".") return "/"
  return value.startsWith("/") ? value : `/${value}`
}

function joinPath(base: string, name: string) {
  const cleanName = name.trim().replace(/^\/+/, "")
  return base === "/" ? `/${cleanName}` : `${base.replace(/\/+$/, "")}/${cleanName}`
}

function isHtaccessPath(path: string) {
  return path.split(/[\\/]/).pop()?.toLowerCase() === ".htaccess"
}

function formatBytes(value: number) {
  if (!value) return "0 B"
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${value} B`
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar la operacion."
}
