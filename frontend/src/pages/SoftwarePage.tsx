import {
  Activity,
  CheckCircle2,
  Code2,
  Gauge,
  Play,
  RotateCcw,
  Save,
  Search,
  ServerCog,
  Sparkles,
} from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"

import { hostingApi, type HostingAccount, type SoftwareInfo, type SoftwarePerformanceAudit } from "@/api/hosting"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SoftwareTab = "Runtime Web" | "PHP" | "PHP-FPM" | "Apache / Nginx" | "OpenLiteSpeed" | "Rendimiento Web" | "Extensiones"

const tabs: SoftwareTab[] = ["Runtime Web", "PHP", "PHP-FPM", "Apache / Nginx", "OpenLiteSpeed", "Rendimiento Web", "Extensiones"]
const phpVersions = ["8.5", "8.4", "8.3", "8.2", "8.1", "8.0", "7.4"]
const commonExtensions = [
  "bcmath",
  "bz2",
  "calendar",
  "curl",
  "exif",
  "ffi",
  "fileinfo",
  "ftp",
  "gd",
  "gettext",
  "gmp",
  "iconv",
  "imagick",
  "imap",
  "intl",
  "ldap",
  "mbstring",
  "mysqli",
  "opcache",
  "pcntl",
  "pdo",
  "pdo_mysql",
  "pdo_pgsql",
  "pgsql",
  "phar",
  "posix",
  "redis",
  "shmop",
  "soap",
  "sockets",
  "sodium",
  "sysvmsg",
  "sysvsem",
  "sysvshm",
  "tidy",
  "tokenizer",
  "xml",
  "xmlreader",
  "xmlwriter",
  "xsl",
  "zip",
]
const phpSettingKeys = ["include_path", "session.save_path", "mail.force_extra_parameters", "open_basedir", "error_reporting", "display_errors", "log_errors", "allow_url_fopen", "file_uploads", "short_open_tag", "memory_limit", "max_execution_time", "max_input_time", "post_max_size", "upload_max_filesize", "max_file_uploads", "date.timezone"]
const phpFpmKeys = ["pm.max_children", "pm.max_requests", "pm.start_servers", "pm.min_spare_servers", "pm.max_spare_servers"]

export function SoftwarePage() {
  const [accounts, setAccounts] = useState<HostingAccount[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [activeTab, setActiveTab] = useState<SoftwareTab>("Runtime Web")
  const [software, setSoftware] = useState<SoftwareInfo | null>(null)
  const [webEngine, setWebEngine] = useState("nginx_apache")
  const [phpVersion, setPhpVersion] = useState("8.3")
  const [phpSettings, setPhpSettings] = useState<Record<string, string>>({})
  const [phpExtraDirectives, setPhpExtraDirectives] = useState("")
  const [phpFpmSettings, setPhpFpmSettings] = useState<Record<string, string>>({})
  const [apacheHttpDirectives, setApacheHttpDirectives] = useState("")
  const [apacheHttpsDirectives, setApacheHttpsDirectives] = useState("")
  const [nginxDirectives, setNginxDirectives] = useState("")
  const [extensionState, setExtensionState] = useState<Record<string, boolean>>({})
  const [extensionChanges, setExtensionChanges] = useState<Record<string, boolean>>({})
  const [performanceAudits, setPerformanceAudits] = useState<SoftwarePerformanceAudit[]>([])
  const [performanceTarget, setPerformanceTarget] = useState("/")
  const [performanceDuration, setPerformanceDuration] = useState(15)
  const [performanceSamples, setPerformanceSamples] = useState(6)
  const [performanceBusy, setPerformanceBusy] = useState(false)
  const [showAiModal, setShowAiModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isRestartingOpenLiteSpeed, setIsRestartingOpenLiteSpeed] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const selected = accounts.find((account) => account.id === selectedId) ?? accounts[0] ?? null

  const loadAccounts = async () => {
    setIsLoading(true)
    setError("")
    try {
      const page = await hostingApi.accounts()
      setAccounts(page.results)
      const account = page.results.find((item) => item.id === selectedId) ?? page.results[0]
      if (account) {
        setSelectedId(account.id)
        setWebEngine(account.web_engine || "nginx_apache")
        setPhpVersion(account.php_version || "8.3")
        setPerformanceTarget(`https://${account.primary_domain}/`)
      }
    } catch (reason) {
      setError(readMessage(reason))
    } finally {
      setIsLoading(false)
    }
  }

  const loadSoftware = async (account = selected) => {
    if (!account) return
    setIsLoading(true)
    setError("")
    try {
      const response = await hostingApi.accountSoftwareInfo(account.id)
      setSoftware(response.result)
    } catch (reason) {
      setError(readMessage(reason))
    } finally {
      setIsLoading(false)
    }
  }

  const loadPerformanceAudits = async (account = selected) => {
    if (!account) return
    try {
      const response = await hostingApi.softwarePerformanceAudits(account.id)
      setPerformanceAudits(response.results)
    } catch {
      setPerformanceAudits([])
    }
  }

  useEffect(() => {
    void loadAccounts()
  }, [])

  useEffect(() => {
    if (!selected) return
    setWebEngine(selected.web_engine || "nginx_apache")
    setPhpVersion(selected.php_version || "8.3")
    setPerformanceTarget(`https://${selected.primary_domain}/`)
    setSoftware((selected.last_usage?.software as SoftwareInfo | undefined) ?? null)
    void loadSoftware(selected)
    void loadPerformanceAudits(selected)
  }, [selected?.id])

  useEffect(() => {
    if (!software) return
    const mergedPhp = { ...(software.php_ini_values ?? {}), ...(software.php_user_ini ?? {}) }
    setPhpSettings(Object.fromEntries(phpSettingKeys.map((key) => [key, mergedPhp[key] ?? ""])))
    setPhpFpmSettings(Object.fromEntries(phpFpmKeys.map((key) => [key, software.php_fpm_values?.[key] ?? ""])))
    setApacheHttpDirectives(software.apache_http_directives ?? "")
    setApacheHttpsDirectives(software.apache_https_directives ?? "")
    setNginxDirectives(software.nginx_directives ?? "")
    const lower = new Set((software.php_modules ?? []).map((item) => item.toLowerCase()))
    setExtensionState(Object.fromEntries(commonExtensions.map((extension) => [extension, lower.has(extension.toLowerCase())])))
    setExtensionChanges({})
  }, [software])

  const saveChanges = async () => {
    if (!selected) return
    setIsLoading(true)
    setError("")
    setMessage("")
    try {
      await hostingApi.updateAccount(selected.id, { php_version: phpVersion, web_engine: webEngine })
      setMessage("Configuracion guardada en la cuenta.")
      await loadAccounts()
    } catch (reason) {
      setError(readMessage(reason))
    } finally {
      setIsLoading(false)
    }
  }

  const applySoftware = async () => {
    if (!selected) return
    setIsLoading(true)
    setError("")
    setMessage("")
    try {
      await hostingApi.applyAccountSoftware(selected.id, { php_version: phpVersion, web_engine: webEngine })
      setMessage("Aplicacion de software enviada al agente.")
      await loadAccounts()
    } catch (reason) {
      setError(readMessage(reason))
    } finally {
      setIsLoading(false)
    }
  }

  const applySettings = async () => {
    if (!selected) return
    setIsLoading(true)
    setError("")
    setMessage("")
    try {
      await hostingApi.applySoftwareSettings(selected.id, {
        apache_http_directives: apacheHttpDirectives,
        apache_https_directives: apacheHttpsDirectives,
        extensions: extensionChanges,
        nginx_directives: nginxDirectives,
        php_extra_directives: phpExtraDirectives,
        php_fpm: phpFpmSettings,
        php_settings: phpSettings,
      })
      setMessage("Ajustes de software aplicados en el nodo.")
      await loadSoftware(selected)
    } catch (reason) {
      setError(readMessage(reason))
    } finally {
      setIsLoading(false)
    }
  }

  const runPerformanceAudit = async () => {
    if (!selected) return
    setPerformanceBusy(true)
    setError("")
    setMessage("")
    try {
      const audit = await hostingApi.runSoftwarePerformanceAudit(selected.id, {
        duration_seconds: performanceDuration,
        samples: performanceSamples,
        target_url: performanceTarget,
      })
      setPerformanceAudits((current) => [audit, ...current.filter((item) => item.id !== audit.id)].slice(0, 10))
      setMessage("Auditoria de rendimiento completada.")
      await loadSoftware(selected)
    } catch (reason) {
      setError(readMessage(reason))
    } finally {
      setPerformanceBusy(false)
    }
  }

  const restartOpenLiteSpeed = async () => {
    if (!selected) return
    setIsRestartingOpenLiteSpeed(true)
    setError("")
    setMessage("")
    try {
      await hostingApi.restartOpenLiteSpeed(selected.id)
      setMessage("OpenLiteSpeed reiniciado en el nodo.")
      await loadSoftware(selected)
    } catch (reason) {
      setError(readMessage(reason))
    } finally {
      setIsRestartingOpenLiteSpeed(false)
    }
  }

  const serviceState = software?.service_state ?? {}
  const opcacheEnabled = Boolean(software?.opcache?.enabled)

  return (
    <div className="space-y-4">
      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <SoftwareMetric icon={ServerCog} label="Motor web" value={engineLabel(webEngine)} detail={serviceLabel(serviceState, webEngine === "openlitespeed" ? "lshttpd" : "nginx")} />
        <SoftwareMetric icon={Code2} label="PHP" value={phpVersion} detail="Version configurada por cuenta" />
        <SoftwareMetric icon={Gauge} label="OPcache" value={opcacheEnabled ? "Activo" : "Inactivo"} detail={software?.php_ini || "PHP CLI"} />
        <SoftwareMetric icon={Activity} label="Valkey" value={software?.valkey_ok ? "Activo" : serviceLabel(serviceState, "valkey")} detail={software?.valkey_ping || "Cache y colas"} />
      </section>

      <section className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-base font-bold">Software</h2>
            <p className="text-xs text-slate-500">Runtime web, PHP, FPM, cache, extensiones y diagnostico de rendimiento.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="h-9 rounded-md border border-slate-200 px-3 text-sm font-bold outline-none" onChange={(event) => setSelectedId(event.target.value)} value={selected?.id || ""}>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.primary_domain}</option>)}
            </select>
            <Button disabled={!selected || isLoading} onClick={() => void loadSoftware()} size="sm" variant="outline"><CheckCircle2 className="h-4 w-4" />Validar configuracion</Button>
            <Button disabled={!selected || isLoading} onClick={() => void saveChanges()} size="sm" variant="outline"><Save className="h-4 w-4" />Guardar</Button>
            <Button disabled={!selected || isLoading} onClick={() => void applySettings()} size="sm" variant="outline"><Save className="h-4 w-4" />Aplicar ajustes</Button>
            <Button disabled={!selected || isLoading} onClick={() => void applySoftware()} size="sm"><Play className="h-4 w-4" />Aplicar en nodo</Button>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
          <div className="flex flex-wrap gap-1">
            {tabs.map((tab) => (
              <button
                className={cn("h-8 rounded-md px-3 text-xs font-bold transition", activeTab === tab ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:bg-white hover:text-slate-900")}
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
          {activeTab === "Runtime Web" && <RuntimeWebTab account={selected} serviceState={serviceState} value={webEngine} onChange={setWebEngine} />}
          {activeTab === "PHP" && <PhpTab extraDirectives={phpExtraDirectives} onAi={() => setShowAiModal(true)} onExtraDirectives={setPhpExtraDirectives} onPhpSetting={(key, value) => setPhpSettings((current) => ({ ...current, [key]: value }))} phpSettings={phpSettings} phpVersion={phpVersion} software={software} onPhpVersion={setPhpVersion} />}
          {activeTab === "PHP-FPM" && <PhpFpmTab account={selected} onValue={(key, value) => setPhpFpmSettings((current) => ({ ...current, [key]: value }))} settings={phpFpmSettings} software={software} />}
          {activeTab === "Apache / Nginx" && <ApacheNginxTab account={selected} apacheHttp={apacheHttpDirectives} apacheHttps={apacheHttpsDirectives} nginx={nginxDirectives} onApacheHttp={setApacheHttpDirectives} onApacheHttps={setApacheHttpsDirectives} onNginx={setNginxDirectives} software={software} />}
          {activeTab === "OpenLiteSpeed" && <OpenLiteSpeedTab account={selected} onPhpVersion={setPhpVersion} onRestart={restartOpenLiteSpeed} phpVersion={phpVersion} restarting={isRestartingOpenLiteSpeed} serviceState={serviceState} />}
          {activeTab === "Rendimiento Web" && (
            <WebPerformanceTab
              audits={performanceAudits}
              duration={performanceDuration}
              onDuration={setPerformanceDuration}
              onRun={runPerformanceAudit}
              onSamples={setPerformanceSamples}
              onTarget={setPerformanceTarget}
              running={performanceBusy}
              samples={performanceSamples}
              software={software}
              target={performanceTarget}
            />
          )}
          {activeTab === "Extensiones" && <ExtensionsTab values={extensionState} onToggle={(extension) => {
            setExtensionState((current) => {
              const nextValue = !current[extension]
              setExtensionChanges((changes) => ({ ...changes, [extension]: nextValue }))
              return { ...current, [extension]: nextValue }
            })
          }} modules={software?.php_modules ?? []} />}
        </div>
      </section>
      {showAiModal ? <InfoModal onClose={() => setShowAiModal(false)} title="Sugerencia IA">Funcion en desarrollo.</InfoModal> : null}
    </div>
  )
}

function RuntimeWebTab({ account, onChange, serviceState, value }: { account: HostingAccount | null; onChange: (value: string) => void; serviceState: SoftwareInfo["service_state"]; value: string }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="text-sm font-bold text-slate-900">Motor web por cuenta</div>
        <div className="mt-3 space-y-2">
          {[
            ["nginx_apache", "Nginx + Apache"],
            ["openlitespeed", "OpenLiteSpeed"],
          ].map(([engine, label]) => (
            <label className="flex h-10 items-center justify-between rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700" key={engine}>
              <span>{label}</span>
              <input checked={value === engine} name="engine" onChange={() => onChange(engine)} type="radio" />
            </label>
          ))}
        </div>
        <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
          Cuenta: {account?.username || "-"} · Dominio: {account?.primary_domain || "-"}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ToggleCard title="Nginx" detail={serviceLabel(serviceState, "nginx")} enabled={isServiceActive(serviceState, "nginx")} />
        <ToggleCard title="Apache HTTP" detail={serviceLabel(serviceState, "httpd")} enabled={isServiceActive(serviceState, "httpd")} />
        <ToggleCard title="OpenLiteSpeed" detail={serviceLabel(serviceState, "lshttpd")} enabled={isServiceActive(serviceState, "lshttpd")} />
        <ToggleCard title="Logs por cuenta" detail="/var/log/ehpanel/hosting/{usuario}" enabled />
      </div>
    </div>
  )
}

function PhpTab({ extraDirectives, onAi, onExtraDirectives, onPhpSetting, onPhpVersion, phpSettings, phpVersion, software }: { extraDirectives: string; onAi: () => void; onExtraDirectives: (value: string) => void; onPhpSetting: (key: string, value: string) => void; onPhpVersion: (value: string) => void; phpSettings: Record<string, string>; phpVersion: string; software: SoftwareInfo | null }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid flex-1 gap-4 md:grid-cols-3">
        <SelectControl label="Version PHP de la cuenta" onChange={onPhpVersion} options={phpVersions} value={phpVersion} />
        <ReadOnlyControl label="PHP CLI real" value={software?.php_cli_version || "-"} />
        <ReadOnlyControl label="php.ini cargado" value={software?.php_ini || "-"} />
        </div>
        <Button onClick={onAi} size="sm" variant="outline"><Sparkles className="h-4 w-4" />Sugerencia IA</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {phpSettingKeys.map((name) => <TextControl key={name} label={name} onChange={(value) => onPhpSetting(name, value)} value={phpSettings[name] || ""} />)}
      </div>
      <TextAreaControl label="Directivas PHP adicionales (.user.ini)" onChange={onExtraDirectives} value={extraDirectives} />
      <div className="grid gap-3 md:grid-cols-3">
        <ToggleCard title="OPcache" detail="Cache de bytecode PHP." enabled={Boolean(software?.opcache?.enabled)} />
        <ToggleCard title="display_errors" detail={phpSettings.display_errors || "-"} enabled={["1", "On", "on", "true"].includes(phpSettings.display_errors || "")} />
        <ToggleCard title="log_errors" detail={phpSettings.log_errors || "-"} enabled={["1", "On", "on", "true"].includes(phpSettings.log_errors || "")} />
      </div>
    </div>
  )
}

function PhpFpmTab({ account, onValue, settings, software }: { account: HostingAccount | null; onValue: (key: string, value: string) => void; settings: Record<string, string>; software: SoftwareInfo | null }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <ReadOnlyControl label="Pool" value={software?.php_fpm_pool || "-"} />
      <ReadOnlyControl label="Socket" value={software?.php_fpm_sock || "-"} />
      <ReadOnlyControl label="Memoria cuenta" value={`${account?.memory_mb ?? "-"} MB`} />
      <ReadOnlyControl label="CPU cuenta" value={`${account?.cpu_pct ?? "-"}%`} />
      {phpFpmKeys.map((key) => <TextControl key={key} label={key} onChange={(value) => onValue(key, value)} value={settings[key] || ""} />)}
      <ReadOnlyControl label="php-fpm -t" value={software?.php_fpm_check || "-"} wide />
      <ToggleCard title="Pool dedicado" detail={account?.username || "-"} enabled={Boolean(account)} />
      <ToggleCard title="Public dir" detail={software?.public_dir_mode ? `Modo ${software.public_dir_mode}` : software?.public_dir || "-"} enabled={Boolean(software?.public_dir)} />
      <ToggleCard title="Slowlog" detail="Se activara cuando agreguemos captura fina por request." />
    </div>
  )
}

function ApacheNginxTab({ account, apacheHttp, apacheHttps, nginx, onApacheHttp, onApacheHttps, onNginx, software }: { account: HostingAccount | null; apacheHttp: string; apacheHttps: string; nginx: string; onApacheHttp: (value: string) => void; onApacheHttps: (value: string) => void; onNginx: (value: string) => void; software: SoftwareInfo | null }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <TextAreaControl label="Directivas adicionales Apache HTTP" onChange={onApacheHttp} value={apacheHttp} />
        <TextAreaControl label="Directivas adicionales Apache HTTPS" onChange={onApacheHttps} value={apacheHttps} />
        <TextAreaControl label="Directivas adicionales Nginx" onChange={onNginx} value={nginx} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
      <ConfigPanel
        title="Estado Nginx"
        lines={[software?.nginx_check || "Sin validacion cargada.", `Dominio: ${account?.primary_domain || "-"}`, `Document root: ${account?.domains?.find((domain) => domain.is_primary)?.document_root || software?.public_dir || "-"}`]}
      />
      <ConfigPanel
        title="Estado Apache / PHP-FPM"
        lines={[software?.php_fpm_check || "Sin validacion cargada.", `Pool: ${software?.php_fpm_pool || "-"}`, `Socket: ${software?.php_fpm_sock || "-"}`]}
      />
      </div>
    </div>
  )
}

function OpenLiteSpeedTab({ account, onPhpVersion, onRestart, phpVersion, restarting, serviceState }: { account: HostingAccount | null; onPhpVersion: (value: string) => void; onRestart: () => void; phpVersion: string; restarting: boolean; serviceState: SoftwareInfo["service_state"] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <ToggleCard title="OpenLiteSpeed" detail={serviceLabel(serviceState, "lshttpd")} enabled={isServiceActive(serviceState, "lshttpd")} />
      <ToggleCard title="Modo de cuenta" detail={account?.web_engine === "openlitespeed" ? "Seleccionado" : "No seleccionado"} enabled={account?.web_engine === "openlitespeed"} />
      <ReadOnlyControl label="Dominio" value={account?.primary_domain || "-"} />
      <SelectControl label="PHP cuenta" onChange={onPhpVersion} options={phpVersions.filter((version) => ["8.5", "8.4", "8.3"].includes(version))} value={phpVersion} />
      <ReadOnlyControl label="Nodo" value={account?.node_hostname || "-"} />
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="text-sm font-bold text-slate-900">Aplicar cambios .htaccess</div>
        <div className="mt-1 text-xs text-slate-500">Reinicia OpenLiteSpeed cuando el sitio lo requiera.</div>
        <Button className="mt-3" disabled={!account || account.web_engine !== "openlitespeed" || restarting} onClick={() => void onRestart()} size="sm" variant="outline">
          <RotateCcw className="h-4 w-4" />
          {restarting ? "Reiniciando" : "Reiniciar OpenLiteSpeed"}
        </Button>
      </div>
    </div>
  )
}

function WebPerformanceTab({
  audits,
  duration,
  onDuration,
  onRun,
  onSamples,
  onTarget,
  running,
  samples,
  software,
  target,
}: {
  audits: SoftwarePerformanceAudit[]
  duration: number
  onDuration: (value: number) => void
  onRun: () => void
  onSamples: (value: number) => void
  onTarget: (value: string) => void
  running: boolean
  samples: number
  software: SoftwareInfo | null
  target: string
}) {
  const logs = software?.recent_php_errors ?? []
  const latest = audits[0]
  const summary = latest?.result?.summary ?? {}
  const recommendations = latest?.result?.recommendations ?? []
  const slowRequests = latest?.result?.slow_requests ?? []
  const topPaths = latest?.result?.top_paths ?? []
  const processes = latest?.result?.processes ?? []
  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="grid gap-3 md:grid-cols-[1fr_130px_130px_auto]">
            <label className="text-xs font-bold uppercase text-slate-500">
              URL
              <input className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none" onChange={(event) => onTarget(event.target.value)} value={target} />
            </label>
            <label className="text-xs font-bold uppercase text-slate-500">
              Duracion
              <input className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none" max={60} min={5} onChange={(event) => onDuration(Number(event.target.value) || 15)} type="number" value={duration} />
            </label>
            <label className="text-xs font-bold uppercase text-slate-500">
              Muestras
              <input className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none" max={30} min={1} onChange={(event) => onSamples(Number(event.target.value) || 6)} type="number" value={samples} />
            </label>
            <div className="flex items-end">
              <Button disabled={running} onClick={() => void onRun()} size="sm"><Search className="h-4 w-4" />{running ? "Auditando" : "Iniciar auditoria"}</Button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 xl:grid-cols-1">
          <MiniMetric label="TTFB" value={`${value(summary.avg_ttfb_ms)} ms`} />
          <MiniMetric label="Total" value={`${value(summary.avg_total_ms)} ms`} />
          <MiniMetric label="Max" value={`${value(summary.max_total_ms)} ms`} />
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <DataPanel title="URLs / muestras lentas" rows={slowRequests.map((row) => [value(row.index), `${value(row.total_ms)} ms`, `${value(row.ttfb_ms)} ms`, value(row.code)])} columns={["#", "Total", "TTFB", "Codigo"]} />
        <DataPanel title="Rutas con mas actividad o errores" rows={topPaths.map((row) => [value(row.path), value(row.hits), value(row.errors), value(row.bytes)])} columns={["Ruta", "Hits", "Errores", "Bytes"]} />
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <DataPanel title="Procesos observados" rows={processes.map((row) => [value(row.pid), value(row.command), `${value(row.cpu_pct)}%`, `${value(row.rss_kb)} KB`])} columns={["PID", "Proceso", "CPU", "RSS"]} />
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-2 text-sm font-bold text-slate-900">Recomendaciones</div>
          <div className="space-y-2">
            {recommendations.length ? recommendations.map((item, index) => <div className="rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600" key={`${item}-${index}`}>{String(item)}</div>) : <div className="rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">Sin auditoria ejecutada.</div>}
          </div>
        </div>
      </div>
      <pre className="max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-slate-100">{logs.join("\n") || "Sin errores PHP recientes."}</pre>
    </div>
  )
}

function DataPanel({ columns, rows, title }: { columns: string[]; rows: Array<Array<ReactNode>>; title: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-2 text-sm font-bold text-slate-900">{title}</div>
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>{columns.map((column) => <th className="px-3 py-2 font-bold" key={column}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row, index) => (
              <tr className="border-t border-slate-100" key={index}>{row.map((cell, cellIndex) => <td className="px-3 py-2 font-semibold text-slate-700" key={cellIndex}>{cell}</td>)}</tr>
            )) : <tr><td className="px-3 py-4 text-sm font-semibold text-slate-500" colSpan={columns.length}>Sin datos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-black text-slate-900">{value}</div>
    </div>
  )
}

function ExtensionsTab({ modules, onToggle, values }: { modules: string[]; onToggle: (extension: string) => void; values: Record<string, boolean> }) {
  const lower = new Set(modules.map((item) => item.toLowerCase()))
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
      {commonExtensions.map((extension) => (
        <ToggleCard clickable detail={lower.has(extension.toLowerCase()) ? "Extension PHP detectada" : "Se instalara al aplicar ajustes"} enabled={Boolean(values[extension])} key={extension} onToggle={() => onToggle(extension)} title={extension === "redis" ? "redis/phpredis" : extension} />
      ))}
      {modules.filter((item) => !commonExtensions.includes(item.toLowerCase())).slice(0, 30).map((extension) => (
        <ToggleCard detail="Modulo instalado" enabled key={extension} title={extension} />
      ))}
    </div>
  )
}

function ConfigPanel({ lines, title }: { lines: string[]; title: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3 text-sm font-bold text-slate-900">{title}</div>
      <pre className="min-h-[180px] w-full overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3 font-mono text-xs text-slate-100">{lines.join("\n")}</pre>
    </div>
  )
}

function SoftwareMetric({ icon: Icon, label, value, detail }: { icon: typeof ServerCog; label: string; value: string; detail: string }) {
  return (
    <div className="eh-card p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-1 text-lg font-bold text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{detail}</div>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-50 text-blue-700">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

function ToggleCard({ clickable = false, title, detail, enabled = false, onToggle }: { clickable?: boolean; title: string; detail: string; enabled?: boolean; onToggle?: () => void }) {
  return (
    <button className={cn("w-full rounded-lg border border-slate-200 bg-white p-3 text-left", clickable && "hover:border-blue-300 hover:bg-blue-50/30")} disabled={!clickable} onClick={onToggle} type="button">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-900">{title}</div>
          <div className="mt-1 text-xs text-slate-500">{detail}</div>
        </div>
        <span className={cn("h-5 w-9 rounded-full p-0.5", enabled ? "bg-blue-600" : "bg-slate-200")}>
          <span className={cn("block h-4 w-4 rounded-full bg-white transition", enabled && "translate-x-4")} />
        </span>
      </div>
    </button>
  )
}

function TextControl({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block rounded-lg border border-slate-200 bg-white p-3">
      <span className="mb-1.5 block text-xs font-bold text-slate-500">{label}</span>
      <input className="h-8 w-full rounded-md border border-slate-200 px-2 text-sm font-semibold outline-none focus:border-blue-500" onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  )
}

function TextAreaControl({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block rounded-lg border border-slate-200 bg-white p-3">
      <span className="mb-1.5 block text-xs font-bold text-slate-500">{label}</span>
      <textarea className="min-h-32 w-full resize-y rounded-md border border-slate-200 p-2 font-mono text-xs outline-none focus:border-blue-500" onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  )
}

function ReadOnlyControl({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <label className={cn("block rounded-lg border border-slate-200 bg-white p-3", wide && "md:col-span-2 xl:col-span-4")}>
      <span className="mb-1.5 block text-xs font-bold text-slate-500">{label}</span>
      <input className="h-8 w-full rounded-md border border-slate-200 px-2 text-sm font-semibold outline-none" readOnly value={value} />
    </label>
  )
}

function InfoModal({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="text-base font-bold text-slate-900">{title}</div>
          <button className="rounded-md border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={onClose} type="button">Cerrar</button>
        </div>
        <div className="mt-3 text-sm font-semibold text-slate-600">{children}</div>
      </div>
    </div>
  )
}

function SelectControl({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[]; value: string }) {
  return (
    <label className="block rounded-lg border border-slate-200 bg-white p-3">
      <span className="mb-1.5 block text-xs font-bold text-slate-500">{label}</span>
      <select className="h-8 w-full rounded-md border border-slate-200 px-2 text-sm font-semibold outline-none focus:border-blue-500" onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  )
}

function engineLabel(value: string) {
  return value === "openlitespeed" ? "OpenLiteSpeed" : "Nginx + Apache"
}

function isServiceActive(state: SoftwareInfo["service_state"], service: string) {
  return Boolean(state?.[service]?.active)
}

function serviceLabel(state: SoftwareInfo["service_state"], service: string) {
  return state?.[service]?.status || "Sin datos"
}

function value(input: unknown) {
  if (input === null || input === undefined || input === "") return "-"
  return String(input)
}

function readMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "No se pudo completar la solicitud."
}
