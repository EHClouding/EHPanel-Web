import {
  Bot,
  CalendarDays,
  Download,
  FileKey2,
  Filter,
  KeyRound,
  LockKeyhole,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShieldHalf,
  Trash2,
} from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"

import { hostingApi, type CreateIpBlockPayload, type CreateSecurityScanPayload, type FileManagerItem, type HostingDomain, type HostingIpBlock, type HostingProtectedDirectory, type HostingSecurityScan, type HostingWafResponse, type WebProtectionResponse, type WebProtectionSettings } from "@/api/hosting"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SecurityTab = "Resumen" | "Certificados SSL" | "Protección Web" | "Directorios protegidos" | "Firewall / WAF" | "Bloqueos IP" | "Escaneo"
type CertificateKind = "Gratis" | "De pago"
type CertificateStatus = "Activo" | "Sin SSL" | "Pendiente" | "Expirado" | "Error"
type CertificateType = "Let's Encrypt" | "Wildcard" | "Personalizado" | "Sectigo DV"
type WafMode = "Desactivado" | "Monitoreo" | "Bloqueo"
type SslCertificate = {
  id: number
  domain: string
  kind: CertificateKind
  domainType: string
  type: CertificateType
  status: CertificateStatus
  issuer: string
  expiresAt: string
  autoRenew: boolean
  raw: HostingDomain
}

const tabs: SecurityTab[] = [
  "Resumen",
  "Certificados SSL",
  "Protección Web",
  "Directorios protegidos",
  "Firewall / WAF",
  "Bloqueos IP",
  "Escaneo",
]

const defaultWebProtection: WebProtectionSettings = {
  force_https: true,
  hsts_enabled: false,
  hsts_include_subdomains: false,
  hsts_preload: false,
  hotlink_protection: false,
  hotlink_allowed_domains: [],
  basic_bot_block: true,
  quick_rules: true,
  ai_diagnostics_mock: false,
}

export function SecurityPage() {
  const [activeTab, setActiveTab] = useState<SecurityTab>("Resumen")
  const [domains, setDomains] = useState<HostingDomain[]>([])
  const [certificateQuery, setCertificateQuery] = useState("")
  const [certificateKind, setCertificateKind] = useState<"Todos" | CertificateKind>("Todos")
  const [isCertificateOpen, setIsCertificateOpen] = useState(false)
  const [selectedCertificateDomainId, setSelectedCertificateDomainId] = useState<number | null>(null)
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false)
  const [isIpOpen, setIsIpOpen] = useState(false)
  const [isScanOpen, setIsScanOpen] = useState(false)
  const [isLoadingCertificates, setIsLoadingCertificates] = useState(true)
  const [isSavingCertificate, setIsSavingCertificate] = useState(false)
  const [selectedProtectionDomainId, setSelectedProtectionDomainId] = useState<number | null>(null)
  const [webProtection, setWebProtection] = useState<WebProtectionResponse | null>(null)
  const [isLoadingProtection, setIsLoadingProtection] = useState(false)
  const [isSavingProtection, setIsSavingProtection] = useState(false)
  const [protectedDirectories, setProtectedDirectories] = useState<HostingProtectedDirectory[]>([])
  const [isLoadingDirectories, setIsLoadingDirectories] = useState(false)
  const [isSavingDirectory, setIsSavingDirectory] = useState(false)
  const [passwordDirectory, setPasswordDirectory] = useState<HostingProtectedDirectory | null>(null)
  const [selectedWafDomainId, setSelectedWafDomainId] = useState<number | null>(null)
  const [waf, setWaf] = useState<HostingWafResponse | null>(null)
  const [wafSummaries, setWafSummaries] = useState<HostingWafResponse[]>([])
  const [isLoadingWaf, setIsLoadingWaf] = useState(false)
  const [isSavingWaf, setIsSavingWaf] = useState(false)
  const [ipBlockRows, setIpBlockRows] = useState<HostingIpBlock[]>([])
  const [editingIpBlock, setEditingIpBlock] = useState<HostingIpBlock | null>(null)
  const [isSavingIpBlock, setIsSavingIpBlock] = useState(false)
  const [scanRows, setScanRows] = useState<HostingSecurityScan[]>([])
  const [scanReport, setScanReport] = useState<HostingSecurityScan | null>(null)
  const [isSavingScan, setIsSavingScan] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const certificates = useMemo(() => domains.map(mapSslCertificate), [domains])

  const filteredCertificates = useMemo(
    () =>
      certificates.filter((certificate) => {
        const matchesQuery = `${certificate.domain} ${certificate.type} ${certificate.issuer}`
          .toLowerCase()
          .includes(certificateQuery.toLowerCase())
        const matchesKind = certificateKind === "Todos" || certificate.kind === certificateKind

        return matchesQuery && matchesKind
      }),
    [certificateKind, certificateQuery, certificates],
  )
  const activeCertificate = certificates.find((certificate) => certificate.status === "Activo")
  const expiringCertificate = activeCertificate?.expiresAt ? daysUntil(activeCertificate.expiresAt) : null

  const loadCertificates = async () => {
    setError("")
    setIsLoadingCertificates(true)

    try {
      const accountPage = await hostingApi.accounts()
      const accountId = accountPage.results[0]?.id ?? ""
      const domainPage = await hostingApi.domains(accountId ? { account: accountId } : undefined)
      setDomains(domainPage.results)
      setSelectedProtectionDomainId((current) => current ?? domainPage.results[0]?.id ?? null)
      setSelectedWafDomainId((current) => current ?? domainPage.results[0]?.id ?? null)
      const directoryPage = await hostingApi.protectedDirectories(accountId ? { account: accountId } : undefined)
      setProtectedDirectories(directoryPage.results)
      const blocksPage = await hostingApi.ipBlocks(accountId ? { account: accountId } : undefined)
      setIpBlockRows(blocksPage.results)
      const scansPage = await hostingApi.securityScans(accountId ? { account: accountId } : undefined)
      setScanRows(scansPage.results)
      const wafResults = await Promise.allSettled(domainPage.results.map((domain) => hostingApi.waf(domain.id)))
      setWafSummaries(wafResults.filter((result): result is PromiseFulfilledResult<HostingWafResponse> => result.status === "fulfilled").map((result) => result.value))
    } catch (loadError) {
      setError(readMessage(loadError))
    } finally {
      setIsLoadingCertificates(false)
    }
  }

  useEffect(() => {
    void loadCertificates()
  }, [])

  useEffect(() => {
    if (!selectedProtectionDomainId) return
    setIsLoadingProtection(true)
    hostingApi
      .webProtection(selectedProtectionDomainId)
      .then(setWebProtection)
      .catch((loadError) => setError(readMessage(loadError)))
      .finally(() => setIsLoadingProtection(false))
  }, [selectedProtectionDomainId])

  useEffect(() => {
    if (!selectedWafDomainId) return
    setIsLoadingWaf(true)
    hostingApi
      .waf(selectedWafDomainId)
      .then(setWaf)
      .catch((loadError) => setError(readMessage(loadError)))
      .finally(() => setIsLoadingWaf(false))
  }, [selectedWafDomainId])

  const saveWebProtection = async (settings: WebProtectionSettings) => {
    if (!selectedProtectionDomainId) return
    setError("")
    setMessage("")
    setIsSavingProtection(true)
    try {
      const response = await hostingApi.updateWebProtection(selectedProtectionDomainId, settings)
      setWebProtection(response)
      setDomains((current) => current.map((domain) => (domain.id === response.domain.id ? response.domain : domain)))
      setMessage(settings.ai_diagnostics_mock ? "Diagnostico IA guardado en modo mock." : `Proteccion web enviada al agente para ${response.domain.domain}.`)
    } catch (saveError) {
      setError(readMessage(saveError))
    } finally {
      setIsSavingProtection(false)
    }
  }

  const loadProtectedDirectories = async () => {
    setIsLoadingDirectories(true)
    try {
      const accountId = domains[0]?.account
      const page = await hostingApi.protectedDirectories(accountId ? { account: accountId } : undefined)
      setProtectedDirectories(page.results)
    } catch (loadError) {
      setError(readMessage(loadError))
    } finally {
      setIsLoadingDirectories(false)
    }
  }

  const loadIpBlocks = async () => {
    try {
      const accountId = domains[0]?.account
      const page = await hostingApi.ipBlocks(accountId ? { account: accountId } : undefined)
      setIpBlockRows(page.results)
    } catch (loadError) {
      setError(readMessage(loadError))
    }
  }

  const saveWaf = async (payload: Partial<NonNullable<HostingWafResponse["configuration"]>>) => {
    if (!selectedWafDomainId) return
    setError("")
    setMessage("")
    setIsSavingWaf(true)
    try {
      const response = await hostingApi.updateWaf(selectedWafDomainId, payload)
      setWaf(response)
      setWafSummaries((current) => {
        const next = current.filter((item) => item.domain.id !== response.domain.id)
        return [...next, response]
      })
      setMessage(`Configuracion WAF enviada al agente para ${response.domain.domain}.`)
    } catch (saveError) {
      setError(readMessage(saveError))
    } finally {
      setIsSavingWaf(false)
    }
  }

  const saveOverviewWebProtection = async (domain: HostingDomain | undefined, patch: Partial<WebProtectionSettings>) => {
    if (!domain) return
    setError("")
    setMessage("")
    try {
      const settings = { ...defaultWebProtection, ...(domain.web_protection ?? {}), ...patch }
      const response = await hostingApi.updateWebProtection(domain.id, settings)
      setDomains((current) => current.map((item) => (item.id === response.domain.id ? response.domain : item)))
      if (selectedProtectionDomainId === response.domain.id) setWebProtection(response)
      setMessage(`Proteccion web enviada al agente para ${response.domain.domain}.`)
    } catch (saveError) {
      setError(readMessage(saveError))
    }
  }

  const saveOverviewWaf = async (domain: HostingDomain | undefined) => {
    if (!domain) return
    setError("")
    setMessage("")
    try {
      const current = wafSummaries.find((item) => item.domain.id === domain.id)?.configuration
      const nextMode = current?.mode && current.mode !== "disabled" ? "disabled" : "block"
      const response = await hostingApi.updateWaf(domain.id, { mode: nextMode })
      setWafSummaries((items) => [...items.filter((item) => item.domain.id !== response.domain.id), response])
      if (selectedWafDomainId === response.domain.id) setWaf(response)
      setMessage(`WAF enviado al agente para ${response.domain.domain}.`)
    } catch (saveError) {
      setError(readMessage(saveError))
    }
  }

  const saveIpBlock = async (payload: CreateIpBlockPayload) => {
    setError("")
    setMessage("")
    setIsSavingIpBlock(true)
    try {
      if (editingIpBlock) {
        await hostingApi.updateIpBlock(editingIpBlock.id, payload)
        setMessage("Actualizacion de bloqueo IP enviada al agente.")
      } else {
        await hostingApi.createIpBlock(payload)
        setMessage("Bloqueo IP enviado al agente.")
      }
      setIsIpOpen(false)
      setEditingIpBlock(null)
      await loadIpBlocks()
    } catch (saveError) {
      setError(readMessage(saveError))
    } finally {
      setIsSavingIpBlock(false)
    }
  }

  const loadSecurityScans = async () => {
    try {
      const accountId = domains[0]?.account
      const page = await hostingApi.securityScans(accountId ? { account: accountId } : undefined)
      setScanRows(page.results)
    } catch (loadError) {
      setError(readMessage(loadError))
    }
  }

  const createSecurityScan = async (payload: CreateSecurityScanPayload) => {
    setError("")
    setMessage("")
    setIsSavingScan(true)
    try {
      await hostingApi.createSecurityScan(payload)
      setIsScanOpen(false)
      setMessage("Escaneo antivirus enviado al agente.")
      await loadSecurityScans()
    } catch (saveError) {
      setError(readMessage(saveError))
    } finally {
      setIsSavingScan(false)
    }
  }

  const retrySecurityScan = async (scan: HostingSecurityScan) => {
    setError("")
    setMessage("")
    try {
      await hostingApi.retrySecurityScan(scan.id)
      setMessage("Reintento de escaneo enviado al agente.")
      await loadSecurityScans()
    } catch (retryError) {
      setError(readMessage(retryError))
    }
  }

  const deleteIpBlock = async (item: HostingIpBlock) => {
    if (!window.confirm(`Eliminar el bloqueo de ${item.target}?\n\nAdvertencia: cuando el agente aplique el cambio, esa IP o rango volvera a tener acceso al dominio ${item.domain_name}.`)) return
    setError("")
    setMessage("")
    try {
      await hostingApi.deleteIpBlock(item.id)
      setMessage("Eliminacion de bloqueo IP enviada al agente.")
      await loadIpBlocks()
    } catch (deleteError) {
      setError(readMessage(deleteError))
    }
  }

  const createProtectedDirectory = async (payload: { domain: number; path: string; zone: string; username: string; password: string }) => {
    setError("")
    setMessage("")
    setIsSavingDirectory(true)
    try {
      await hostingApi.createProtectedDirectory({ ...payload, enabled: true })
      setIsDirectoryOpen(false)
      setMessage("Proteccion de directorio enviada al agente.")
      await loadProtectedDirectories()
    } catch (saveError) {
      setError(readMessage(saveError))
    } finally {
      setIsSavingDirectory(false)
    }
  }

  const toggleProtectedDirectory = async (item: HostingProtectedDirectory) => {
    setError("")
    setMessage("")
    try {
      await hostingApi.toggleProtectedDirectory(item.id)
      setMessage(`${item.enabled ? "Deshabilitar" : "Habilitar"} proteccion enviado al agente.`)
      await loadProtectedDirectories()
    } catch (toggleError) {
      setError(readMessage(toggleError))
    }
  }

  const changeProtectedPassword = async (id: number, password: string) => {
    setError("")
    setMessage("")
    try {
      await hostingApi.changeProtectedDirectoryPassword(id, password)
      setPasswordDirectory(null)
      setMessage("Cambio de contrasena enviado al agente.")
      await loadProtectedDirectories()
    } catch (passwordError) {
      setError(readMessage(passwordError))
    }
  }

  const deleteProtectedDirectory = async (item: HostingProtectedDirectory) => {
    if (!window.confirm(`Eliminar la proteccion de ${item.path}?\n\nEl directorio quedara accesible sin usuario y contrasena cuando el agente aplique el cambio.`)) return
    setError("")
    setMessage("")
    try {
      await hostingApi.deleteProtectedDirectory(item.id)
      setMessage("Eliminacion de proteccion enviada al agente.")
      await loadProtectedDirectories()
    } catch (deleteError) {
      setError(readMessage(deleteError))
    }
  }

  const issueCertificate = async (domainId: number, kind: CertificateKind) => {
    if (kind === "De pago") {
      setMessage("Los certificados de pago quedan pendientes para Billing/proveedor. Por ahora solo Let's Encrypt ejecuta emision real.")
      setSelectedCertificateDomainId(null)
      setIsCertificateOpen(false)
      return
    }

    setError("")
    setMessage("")
    setIsSavingCertificate(true)

    try {
      const target = domains.find((domain) => domain.id === domainId)
      const updated = await hostingApi.issueDomainSsl(domainId, {
        force_renewal: false,
        include_www: target?.domain_type !== "subdomain",
        staging: false,
      })
      setDomains((current) => current.map((domain) => (domain.id === updated.id ? updated : domain)))
      setMessage(`Emision SSL enviada al agente para ${updated.domain}.`)
      setSelectedCertificateDomainId(null)
      setIsCertificateOpen(false)
    } catch (issueError) {
      setError(readMessage(issueError))
    } finally {
      setIsSavingCertificate(false)
    }
  }

  const activateWebmailSsl = async (certificate: SslCertificate) => {
    setError("")
    setMessage("")
    setIsSavingCertificate(true)

    try {
      const response = await hostingApi.activateDomainWebmail(certificate.id, {
        force_renewal: true,
        issue_ssl: true,
        sync_dns: true,
      })
      setDomains((current) => current.map((domain) => (domain.id === response.domain.id ? response.domain : domain)))
      setMessage(`Activacion SSL de Webmail enviada para ${response.webmail_url}.`)
    } catch (webmailError) {
      setError(readMessage(webmailError))
    } finally {
      setIsSavingCertificate(false)
    }
  }

  const openAssignCertificate = (certificate: SslCertificate) => {
    setSelectedCertificateDomainId(certificate.id)
    setIsCertificateOpen(true)
  }

  const downloadCertificate = async (certificate: SslCertificate) => {
    setError("")
    setMessage("")

    try {
      const response = await hostingApi.downloadDomainSsl(certificate.id)
      const blob = new Blob([response.content], { type: "application/x-pem-file" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = response.filename
      anchor.click()
      URL.revokeObjectURL(url)
      setMessage(`Certificado descargado para ${certificate.domain}.`)
    } catch (downloadError) {
      setError(readMessage(downloadError))
    }
  }

  const deleteCertificate = async (certificate: SslCertificate) => {
    const confirmed = window.confirm(
      `Eliminar/desasignar el certificado SSL de ${certificate.domain}?\n\nEsto dejara el dominio sin certificado registrado en EHPanel, puede provocar advertencias HTTPS en navegadores y no elimina/revoca automaticamente archivos historicos de Let's Encrypt en el nodo. Podras emitir uno nuevo despues.`,
    )
    if (!confirmed) return

    setError("")
    setMessage("")

    try {
      const updated = await hostingApi.deleteDomainSsl(certificate.id)
      setDomains((current) => current.map((domain) => (domain.id === updated.id ? updated : domain)))
      setMessage(`SSL eliminado/desasignado para ${updated.domain}.`)
    } catch (deleteError) {
      setError(readMessage(deleteError))
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-4">
        <SecurityMetric icon={ShieldCheck} label="SSL principal" value={activeCertificate ? "Activo" : "Pendiente"} detail={activeCertificate?.domain ?? domains[0]?.domain ?? "Cuenta hosting"} tone={activeCertificate ? "emerald" : "amber"} />
        <SecurityMetric icon={CalendarDays} label="Expira" value={expiringCertificate === null ? "-" : `${expiringCertificate} días`} detail="Renovación automática" tone="blue" />
        <SecurityMetric icon={LockKeyhole} label="HTTPS" value={domains.some((domain) => domain.web_protection?.force_https) ? "Forzado" : "Pendiente"} detail={domains.some((domain) => domain.web_protection?.hsts_enabled) ? "HSTS activo" : "HSTS inactivo"} tone="indigo" />
        <SecurityMetric icon={ShieldHalf} label="Dominios" value={domains.length.toString()} detail={isLoadingCertificates ? "Sincronizando..." : `${domains.filter((domain) => domain.ssl_status === "active").length} con SSL activo`} tone="amber" />
      </section>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-base font-bold">SSL / Seguridad</h2>
            <p className="text-xs text-slate-500">Certificados, HTTPS, protección web y accesos protegidos.</p>
          </div>
          <Button size="sm" variant="outline">
            <Bot className="h-4 w-4" />
            Diagnosticar SSL
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
          {activeTab === "Resumen" && (
            <SecurityOverview
              directories={protectedDirectories}
              domains={domains}
              ipBlocks={ipBlockRows}
              onDirectoryOpen={() => setActiveTab("Directorios protegidos")}
              onScanOpen={() => setActiveTab("Escaneo")}
              onWafToggle={(domain) => void saveOverviewWaf(domain)}
              onWebProtectionToggle={(domain, patch) => void saveOverviewWebProtection(domain, patch)}
              scans={scanRows}
              wafSummaries={wafSummaries}
            />
          )}
          {activeTab === "Certificados SSL" && (
            <CertificatesTab
              certificateKind={certificateKind}
              certificateQuery={certificateQuery}
              certificates={filteredCertificates}
              isLoading={isLoadingCertificates}
              onAdd={() => {
                setSelectedCertificateDomainId(null)
                setIsCertificateOpen(true)
              }}
              onAssign={openAssignCertificate}
              onDelete={(certificate) => void deleteCertificate(certificate)}
              onDownload={(certificate) => void downloadCertificate(certificate)}
              onKindChange={setCertificateKind}
              onQueryChange={setCertificateQuery}
              onRenew={(certificate) => void issueCertificate(certificate.id, "Gratis")}
              onWebmailSsl={(certificate) => void activateWebmailSsl(certificate)}
            />
          )}
          {activeTab === "Protección Web" && (
            <WebProtectionPanel
              domains={domains}
              isLoading={isLoadingProtection}
              isSaving={isSavingProtection}
              onDomainChange={setSelectedProtectionDomainId}
              onSave={(settings) => void saveWebProtection(settings)}
              selectedDomainId={selectedProtectionDomainId}
              webProtection={webProtection}
            />
          )}
          {activeTab === "Directorios protegidos" && (
            <ProtectedDirectoriesTab directories={protectedDirectories} isLoading={isLoadingDirectories} onAdd={() => setIsDirectoryOpen(true)} onDelete={(item) => void deleteProtectedDirectory(item)} onPassword={setPasswordDirectory} onToggle={(item) => void toggleProtectedDirectory(item)} />
          )}
          {activeTab === "Firewall / WAF" && <WafTab domains={domains} isLoading={isLoadingWaf} isSaving={isSavingWaf} onDomainChange={setSelectedWafDomainId} onSave={(payload) => void saveWaf(payload)} selectedDomainId={selectedWafDomainId} waf={waf} />}
          {activeTab === "Bloqueos IP" && (
            <IpBlocksTab
              isLoading={isLoadingCertificates}
              onAdd={() => {
                setEditingIpBlock(null)
                setIsIpOpen(true)
              }}
              onDelete={(item) => void deleteIpBlock(item)}
              onEdit={(item) => {
                setEditingIpBlock(item)
                setIsIpOpen(true)
              }}
              rows={ipBlockRows}
            />
          )}
          {activeTab === "Escaneo" && <ScanTab onAdd={() => setIsScanOpen(true)} onReport={setScanReport} onRetry={(scan) => void retrySecurityScan(scan)} rows={scanRows} />}
        </div>
      </section>

      {isCertificateOpen && (
        <CertificateModal
          domains={domains}
          initialDomainId={selectedCertificateDomainId}
          isSaving={isSavingCertificate}
          onClose={() => {
            setSelectedCertificateDomainId(null)
            setIsCertificateOpen(false)
          }}
          onSubmit={issueCertificate}
        />
      )}
      {isDirectoryOpen && <DirectoryModal domains={domains} isSaving={isSavingDirectory} onClose={() => setIsDirectoryOpen(false)} onSubmit={(payload) => void createProtectedDirectory(payload)} />}
      {passwordDirectory && <PasswordModal directory={passwordDirectory} onClose={() => setPasswordDirectory(null)} onSubmit={(password) => void changeProtectedPassword(passwordDirectory.id, password)} />}
      {isIpOpen && (
        <IpBlockModal
          domains={domains}
          initial={editingIpBlock}
          isSaving={isSavingIpBlock}
          onClose={() => {
            setEditingIpBlock(null)
            setIsIpOpen(false)
          }}
          onSubmit={(payload) => void saveIpBlock(payload)}
        />
      )}
      {isScanOpen && <ScanRequestModal accounts={domains.length ? [{ id: domains[0].account, label: domains[0].account_domain, username: domains[0].account_username }] : []} isSaving={isSavingScan} onClose={() => setIsScanOpen(false)} onSubmit={(payload) => void createSecurityScan(payload)} />}
      {scanReport && <ScanReportModal onClose={() => setScanReport(null)} scan={scanReport} />}
    </div>
  )
}

function SecurityOverview({
  directories,
  domains,
  ipBlocks,
  onDirectoryOpen,
  onScanOpen,
  onWafToggle,
  onWebProtectionToggle,
  scans,
  wafSummaries,
}: {
  directories: HostingProtectedDirectory[]
  domains: HostingDomain[]
  ipBlocks: HostingIpBlock[]
  onDirectoryOpen: () => void
  onScanOpen: () => void
  onWafToggle: (domain: HostingDomain | undefined) => void
  onWebProtectionToggle: (domain: HostingDomain | undefined, patch: Partial<WebProtectionSettings>) => void
  scans: HostingSecurityScan[]
  wafSummaries: HostingWafResponse[]
}) {
  const primaryDomain = domains.find((domain) => domain.is_primary) ?? domains[0]
  const webSettings = primaryDomain?.web_protection ?? defaultWebProtection
  const activeSsl = domains.filter((domain) => domain.ssl_status === "active").length
  const failedSsl = domains.filter((domain) => domain.ssl_status === "failed").length
  const activeWaf = wafSummaries.filter((item) => item.configuration.mode !== "disabled" && item.configuration.status === "active").length
  const activeBlocks = ipBlocks.filter((item) => item.status === "active").length
  const activeDirectories = directories.filter((item) => item.status === "active").length
  const latestScan = scans[0]
  const threatScans = scans.filter((scan) => scan.status === "threat").length
  const failedScans = scans.filter((scan) => scan.status === "failed").length
  const alerts = [
    failedSsl > 0 ? { label: "SSL con error", detail: `${failedSsl} dominio(s) requieren revision`, tone: "amber" } : { label: "Certificados activos", detail: `${activeSsl}/${domains.length} dominio(s) con SSL`, tone: activeSsl === domains.length && domains.length ? "emerald" : "blue" },
    threatScans > 0 ? { label: "Amenaza detectada", detail: `${threatScans} escaneo(s) con archivos infectados`, tone: "amber" } : { label: "Ultimo escaneo", detail: latestScan ? `${scanStatusLabel(latestScan.status)} en ${latestScan.path}` : "Sin escaneos registrados", tone: latestScan?.status === "clean" ? "emerald" : "blue" },
    activeBlocks > 0 ? { label: "Bloqueos IP activos", detail: `${activeBlocks} IP/rango bloqueado(s)`, tone: "amber" } : { label: "Bloqueos IP", detail: "Sin bloqueos activos", tone: "emerald" },
    failedScans > 0 ? { label: "Escaneos fallidos", detail: `${failedScans} escaneo(s) requieren reintento`, tone: "amber" } : { label: "WAF", detail: `${activeWaf}/${domains.length} dominio(s) protegidos`, tone: activeWaf > 0 ? "emerald" : "blue" },
  ]

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="grid gap-3 md:grid-cols-2">
        <ToggleCard title="Forzar HTTPS" detail={`${primaryDomain?.domain ?? "Sin dominio"}: ${webSettings.force_https ? "redirige HTTP a HTTPS" : "sin redireccion forzada"}.`} enabled={webSettings.force_https} onToggle={() => onWebProtectionToggle(primaryDomain, { force_https: !webSettings.force_https })} />
        <ToggleCard title="HSTS" detail={webSettings.hsts_enabled ? (webSettings.hsts_include_subdomains ? "Activo con subdominios." : "Activo para el dominio.") : "Inactivo."} enabled={webSettings.hsts_enabled} onToggle={() => onWebProtectionToggle(primaryDomain, { hsts_enabled: !webSettings.hsts_enabled })} />
        <ToggleCard title="Proteccion hotlink" detail={webSettings.hotlink_protection ? "Bloquea recursos desde sitios externos." : "Sin bloqueo hotlink."} enabled={webSettings.hotlink_protection} onToggle={() => onWebProtectionToggle(primaryDomain, { hotlink_protection: !webSettings.hotlink_protection })} />
        <ToggleCard title="Bloqueo basico de bots" detail={webSettings.basic_bot_block ? "Filtra agentes conocidos de scraping." : "Filtro basico desactivado."} enabled={webSettings.basic_bot_block} onToggle={() => onWebProtectionToggle(primaryDomain, { basic_bot_block: !webSettings.basic_bot_block })} />
        <ToggleCard title="WAF / OWASP CRS" detail={`${activeWaf} dominio(s) con WAF activo o monitoreo aplicado.`} enabled={activeWaf > 0} onToggle={() => onWafToggle(primaryDomain)} />
        <ToggleCard title="Directorios protegidos" detail={`${activeDirectories} ruta(s) con acceso protegido.`} enabled={activeDirectories > 0} onToggle={onDirectoryOpen} />
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="mb-3 text-sm font-bold text-slate-900">Alertas recientes</div>
        <button className="mb-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-bold text-blue-700 hover:bg-blue-50" onClick={onScanOpen} type="button">
          Ver escaneos antivirus
        </button>
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div className="rounded-md border border-slate-200 bg-white p-3" key={alert.label}>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <span className={cn("h-2 w-2 rounded-full", alert.tone === "amber" ? "bg-amber-500" : alert.tone === "blue" ? "bg-blue-500" : "bg-emerald-500")} />
                {alert.label}
              </div>
              <div className="mt-1 text-xs text-slate-500">{alert.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CertificatesTab({
  certificates,
  isLoading,
  certificateQuery,
  certificateKind,
  onQueryChange,
  onKindChange,
  onAdd,
  onAssign,
  onDelete,
  onDownload,
  onRenew,
  onWebmailSsl,
}: {
  certificates: SslCertificate[]
  isLoading: boolean
  certificateQuery: string
  certificateKind: "Todos" | CertificateKind
  onQueryChange: (value: string) => void
  onKindChange: (value: "Todos" | CertificateKind) => void
  onAdd: () => void
  onAssign: (certificate: SslCertificate) => void
  onDelete: (certificate: SslCertificate) => void
  onDownload: (certificate: SslCertificate) => void
  onRenew: (certificate: SslCertificate) => void
  onWebmailSsl: (certificate: SslCertificate) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-8 min-w-[260px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-500">
          <Search className="h-4 w-4" />
          <input
            className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar dominio, emisor o tipo"
            value={certificateQuery}
          />
        </div>
        <div className="flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-600">
          <Filter className="h-4 w-4 text-slate-400" />
          <select className="h-full bg-transparent pr-5 text-xs font-semibold outline-none" onChange={(event) => onKindChange(event.target.value as "Todos" | CertificateKind)} value={certificateKind}>
            <option>Todos</option>
            <option>Gratis</option>
            <option>De pago</option>
          </select>
        </div>
        <Button onClick={onAdd} size="sm">
          <Plus className="h-4 w-4" />
          Emitir / asignar SSL
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Dominio</th>
              <th className="px-3 py-2">Clasificación</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Emisor</th>
              <th className="px-3 py-2">Expira</th>
              <th className="px-3 py-2">Auto-renovación</th>
              <th className="px-3 py-2 text-right">Operar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {certificates.map((certificate) => (
              <tr className="h-[52px] hover:bg-slate-50" key={certificate.id}>
                <td className="px-3 py-2 font-semibold text-slate-900">{certificate.domain}</td>
                <td className="px-3 py-2">
                  <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                    {certificate.domainType}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs font-bold text-slate-700">{certificate.kind} / {certificate.type}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={certificate.status} />
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{certificate.issuer}</td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-700">{certificate.expiresAt}</td>
                <td className="px-3 py-2 text-xs font-bold text-slate-700">{certificate.autoRenew ? "Activa" : "Inactiva"}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <IconAction icon={RefreshCcw} label="Renovar" onClick={() => onRenew(certificate)} />
                    <IconAction icon={ShieldCheck} label={certificateHasWebmailSsl(certificate) ? "Reemitir Webmail" : "SSL Webmail"} onClick={() => onWebmailSsl(certificate)} />
                    <IconAction icon={FileKey2} label="Asignar" onClick={() => onAssign(certificate)} />
                    <IconAction icon={Download} label="Descargar" onClick={() => onDownload(certificate)} />
                    <IconAction icon={Trash2} label="Eliminar" onClick={() => onDelete(certificate)} tone="danger" />
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && certificates.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-sm font-semibold text-slate-500" colSpan={8}>
                  No hay dominios reales para esta cuenta.
                </td>
              </tr>
            ) : null}
            {isLoading ? (
              <tr>
                <td className="px-3 py-8 text-center text-sm font-semibold text-slate-500" colSpan={8}>
                  Cargando certificados reales...
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function WebProtectionTab() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <ToggleCard title="Forzar HTTPS" detail="Redirección permanente 301." enabled />
      <ToggleCard title="HSTS" detail="Incluye subdominios y precarga." enabled />
      <ToggleCard title="Protección hotlink" detail="Bloquea recursos desde sitios externos." />
      <ToggleCard title="Bloqueo básico de bots" detail="Filtra agentes conocidos de scraping." enabled />
      <ToggleCard title="Reglas rápidas" detail="Cabeceras de seguridad recomendadas." enabled />
      <ToggleCard title="Diagnóstico IA" detail="Revisa errores SSL, mixed content y redirecciones." />
    </div>
  )
}

function WebProtectionPanel({
  domains,
  selectedDomainId,
  webProtection,
  isLoading,
  isSaving,
  onDomainChange,
  onSave,
}: {
  domains: HostingDomain[]
  selectedDomainId: number | null
  webProtection: WebProtectionResponse | null
  isLoading: boolean
  isSaving: boolean
  onDomainChange: (id: number) => void
  onSave: (settings: WebProtectionSettings) => void
}) {
  const selectedDomain = domains.find((domain) => domain.id === selectedDomainId) ?? domains[0]
  const settings = webProtection?.settings ?? selectedDomain?.web_protection ?? defaultWebProtection
  const mergedSettings = { ...defaultWebProtection, ...settings }
  const legacyPreview = false ? <WebProtectionTab /> : null
  const updateSetting = (key: keyof WebProtectionSettings, value: boolean | string[]) => {
    onSave({ ...mergedSettings, [key]: value })
  }

  if (!selectedDomain) {
    return <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">No hay dominios reales para configurar.</div>
  }

  return (
    <div className="space-y-3">
      {legacyPreview}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <div>
          <div className="text-sm font-bold text-slate-900">Dominio protegido</div>
          <div className="text-xs text-slate-500">
            {isLoading ? "Cargando configuracion..." : `Estado: ${webProtectionStatusLabel(webProtection?.status ?? selectedDomain.web_protection_status)}`}
          </div>
        </div>
        <select className="h-9 min-w-[240px] rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none" onChange={(event) => onDomainChange(Number(event.target.value))} value={selectedDomain.id}>
          {domains.map((domain) => (
            <option key={domain.id} value={domain.id}>{domain.domain}</option>
          ))}
        </select>
      </div>

      {selectedDomain.web_protection_error ? <Notice tone="error" text={selectedDomain.web_protection_error} /> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <ToggleCard disabled={isSaving} enabled={mergedSettings.force_https} onToggle={() => updateSetting("force_https", !mergedSettings.force_https)} title="Forzar HTTPS" detail="Redireccion permanente 301 cuando el SSL esta activo." />
        <ToggleCard disabled={isSaving} enabled={mergedSettings.hsts_enabled} onToggle={() => updateSetting("hsts_enabled", !mergedSettings.hsts_enabled)} title="HSTS" detail={mergedSettings.hsts_include_subdomains ? "Incluye subdominios." : "Navegacion segura persistente."} />
        <ToggleCard disabled={isSaving} enabled={mergedSettings.hotlink_protection} onToggle={() => updateSetting("hotlink_protection", !mergedSettings.hotlink_protection)} title="Proteccion hotlink" detail="Bloquea recursos desde sitios externos." />
        <ToggleCard disabled={isSaving} enabled={mergedSettings.basic_bot_block} onToggle={() => updateSetting("basic_bot_block", !mergedSettings.basic_bot_block)} title="Bloqueo basico de bots" detail="Filtra agentes conocidos de scraping." />
        <ToggleCard disabled={isSaving} enabled={mergedSettings.quick_rules} onToggle={() => updateSetting("quick_rules", !mergedSettings.quick_rules)} title="Reglas rapidas" detail="Cabeceras y bloqueo de dotfiles." />
        <ToggleCard disabled={isSaving} enabled={mergedSettings.ai_diagnostics_mock} onToggle={() => updateSetting("ai_diagnostics_mock", !mergedSettings.ai_diagnostics_mock)} title="Diagnostico IA" detail="Mock reservado para IA futura." />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-sm font-bold text-slate-900">Opciones avanzadas</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
              <input checked={mergedSettings.hsts_include_subdomains} disabled={isSaving || !mergedSettings.hsts_enabled} onChange={(event) => updateSetting("hsts_include_subdomains", event.target.checked)} type="checkbox" />
              HSTS incluir subdominios
            </label>
            <label className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              <input checked={mergedSettings.hsts_preload} disabled={isSaving || !mergedSettings.hsts_enabled} onChange={(event) => updateSetting("hsts_preload", event.target.checked)} type="checkbox" />
              HSTS preload
            </label>
            <label className="md:col-span-2">
              <span className="text-xs font-bold uppercase text-slate-500">Dominios permitidos para hotlink</span>
              <input className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none" defaultValue={(mergedSettings.hotlink_allowed_domains ?? []).join(", ")} disabled={isSaving} onBlur={(event) => updateSetting("hotlink_allowed_domains", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} placeholder="cdn.ejemplo.com, partner.com" />
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Bot className="h-4 w-4 text-blue-600" />
            Diagnostico IA
          </div>
          <div className="mt-2 text-xs text-slate-600">{webProtection?.ai_diagnostics.summary ?? "Mock preparado para IA futura."}</div>
          <div className="mt-3 space-y-2">
            {(webProtection?.ai_diagnostics.checks ?? []).map((check) => (
              <div className="rounded-md border border-slate-200 bg-white p-2" key={check.label}>
                <div className="text-xs font-bold text-slate-900">{check.label}</div>
                <div className="mt-1 text-xs text-slate-500">{check.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProtectedDirectoriesTab({
  directories,
  isLoading,
  onAdd,
  onDelete,
  onPassword,
  onToggle,
}: {
  directories: HostingProtectedDirectory[]
  isLoading: boolean
  onAdd: () => void
  onDelete: (item: HostingProtectedDirectory) => void
  onPassword: (item: HostingProtectedDirectory) => void
  onToggle: (item: HostingProtectedDirectory) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={onAdd} size="sm">
          <Plus className="h-4 w-4" />
          Proteger directorio
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Ruta</th>
              <th className="px-3 py-2">Nombre de zona</th>
              <th className="px-3 py-2">Usuarios autorizados</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Operar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {directories.map((directory) => (
              <tr className="h-[52px] hover:bg-slate-50" key={directory.id}>
                <td className="px-3 py-2 font-semibold text-slate-900">{directory.path}</td>
                <td className="px-3 py-2 text-xs text-slate-700">{directory.zone}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{directory.username}</td>
                <td className="px-3 py-2">
                  <span className={cn("rounded-md px-2 py-1 text-xs font-bold", protectedDirectoryStatusTone(directory))}>
                    {directory.enabled ? protectedDirectoryStatusLabel(directory.status) : "Desactivado"}
                  </span>
                  {directory.status === "failed" ? (
                    <div className="mt-1 max-w-[260px] text-[11px] font-semibold text-rose-700">
                      {protectedDirectoryErrorLabel(directory)}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <IconAction icon={KeyRound} label="Contraseña" onClick={() => onPassword(directory)} />
                    <IconAction icon={LockKeyhole} label={directory.enabled ? "Deshabilitar" : "Habilitar"} onClick={() => onToggle(directory)} />
                    <IconAction icon={Trash2} label="Eliminar" onClick={() => onDelete(directory)} tone="danger" />
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && directories.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-sm font-semibold text-slate-500" colSpan={5}>No hay directorios protegidos reales.</td>
              </tr>
            ) : null}
            {isLoading ? (
              <tr>
                <td className="px-3 py-8 text-center text-sm font-semibold text-slate-500" colSpan={5}>Cargando directorios protegidos...</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CertificateModal({
  domains,
  initialDomainId,
  isSaving,
  onClose,
  onSubmit,
}: {
  domains: HostingDomain[]
  initialDomainId: number | null
  isSaving: boolean
  onClose: () => void
  onSubmit: (domainId: number, kind: CertificateKind) => void
}) {
  const [domainId, setDomainId] = useState(initialDomainId?.toString() ?? domains[0]?.id.toString() ?? "")
  const [kind, setKind] = useState<CertificateKind>("Gratis")
  const selectedDomain = domains.find((domain) => String(domain.id) === domainId) ?? domains[0]
  const providerOptions = kind === "Gratis" ? ["Let's Encrypt"] : ["Sectigo DV", "Wildcard", "Personalizado"]

  return (
    <SecurityModal title="Emitir / asignar SSL" kicker="Certificado">
      <form onSubmit={(event) => { event.preventDefault(); if (selectedDomain) onSubmit(selectedDomain.id, kind) }}>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectInput label="Dominio" onChange={setDomainId} options={domains.map((domain) => [String(domain.id), domain.domain] as [string, string])} value={domainId} />
          <SelectInput disabled label="Clasificación" options={[domainTypeLabel(selectedDomain?.domain_type ?? "primary")]} />
          <SelectInput label="Tipo" onChange={(value) => setKind(value as CertificateKind)} options={["Gratis", "De pago"]} value={kind} />
          <SelectInput disabled label="Proveedor" options={providerOptions} value={providerOptions[0]} />
          <SelectInput disabled label="Auto-renovación" options={["Activa"]} />
        </div>
        <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
          <div className="font-bold">{kind === "Gratis" ? "Let's Encrypt" : "Certificado de pago"}</div>
          <div className="mt-1 text-violet-800">
            {kind === "Gratis"
              ? "Se emitirá por Certbot con webroot, Let's Encrypt y renovación automática del sistema."
              : "El flujo de pago queda pendiente: solicitar certificado, validar dominio/organización, cobrar desde Billing y asignar cuando el proveedor lo emita."}
          </div>
        </div>
        <ModalFooter disabled={!selectedDomain || isSaving} onClose={onClose} primary={kind === "Gratis" ? "Emitir Let's Encrypt" : "Guardar solicitud"} submit />
      </form>
    </SecurityModal>
  )
}

function DirectoryModal({
  domains,
  isSaving,
  onClose,
  onSubmit,
}: {
  domains: HostingDomain[]
  isSaving: boolean
  onClose: () => void
  onSubmit: (payload: { domain: number; path: string; zone: string; username: string; password: string }) => void
}) {
  const [domainId, setDomainId] = useState(domains[0]?.id.toString() ?? "")
  const [path, setPath] = useState("public_html")
  const [zone, setZone] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const selectedDomain = domains.find((domain) => String(domain.id) === domainId) ?? domains[0]

  return (
    <SecurityModal title="Proteger directorio" kicker="Contraseña">
      <form onSubmit={(event) => { event.preventDefault(); if (selectedDomain) onSubmit({ domain: selectedDomain.id, password, path, username, zone }) }}>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectInput label="Dominio" onChange={setDomainId} options={domains.map((domain) => [String(domain.id), domain.domain] as [string, string])} value={domainId} />
          <PathPicker accountId={selectedDomain?.account ?? ""} label="Ruta" onChange={setPath} value={path} />
          <TextInput label="Nombre de zona" onChange={setZone} placeholder="Administracion" value={zone} />
          <TextInput label="Usuario" onChange={setUsername} placeholder="admin_web" value={username} />
          <TextInput label="Contraseña" onChange={setPassword} placeholder="Contraseña segura" type="password" value={password} />
        </div>
        <ModalFooter disabled={isSaving || !selectedDomain || !path || !zone || !username || password.length < 8} onClose={onClose} primary="Crear protección" submit />
      </form>
    </SecurityModal>
  )
}

function PasswordModal({ directory, onClose, onSubmit }: { directory: HostingProtectedDirectory; onClose: () => void; onSubmit: (password: string) => void }) {
  const [password, setPassword] = useState("")
  return (
    <SecurityModal title="Cambiar contraseña" kicker={directory.path}>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(password) }}>
        <TextInput label="Nueva contraseña" onChange={setPassword} placeholder="Contraseña segura" type="password" value={password} />
        <ModalFooter disabled={password.length < 8} onClose={onClose} primary="Aplicar contraseña" submit />
      </form>
    </SecurityModal>
  )
}

function WafTab({
  domains,
  isLoading,
  isSaving,
  onDomainChange,
  onSave,
  selectedDomainId,
  waf,
}: {
  domains: HostingDomain[]
  isLoading: boolean
  isSaving: boolean
  onDomainChange: (id: number) => void
  onSave: (payload: Partial<NonNullable<HostingWafResponse["configuration"]>>) => void
  selectedDomainId: number | null
  waf: HostingWafResponse | null
}) {
  const config = waf?.configuration
  const mode = wafModeLabel(config?.mode ?? "monitor")
  const events = waf?.recent_events ?? []
  const rules = [
    { key: "owasp_crs", label: "OWASP Core Rules", active: config?.owasp_crs ?? true },
    { key: "wordpress_rules", label: "Protección WordPress", active: config?.wordpress_rules ?? true },
    { key: "block_xmlrpc", label: "Bloqueo XML-RPC", active: config?.block_xmlrpc ?? true },
    { key: "rate_limit_login", label: "Rate limit login", active: config?.rate_limit_login ?? true },
  ] as const

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-2 text-sm font-bold text-slate-900">Dominio</div>
          <SelectInput
            label="Dominio"
            onChange={(value) => onDomainChange(Number(value))}
            options={domains.map((domain) => [String(domain.id), domain.domain] as [string, string])}
            value={selectedDomainId?.toString() ?? ""}
          />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-sm font-bold text-slate-900">Estado WAF</div>
          <div className={cn("mt-2 flex items-center justify-between rounded-md px-3 py-2", config?.status === "failed" ? "bg-red-50 text-red-700" : config?.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
            <span className="text-sm font-bold">{isLoading ? "Cargando" : wafStatusLabel(config?.status)}</span>
            <ShieldHalf className="h-5 w-5" />
          </div>
          {config?.error ? <div className="mt-2 text-xs text-red-600">{config.error}</div> : null}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-2 text-sm font-bold text-slate-900">Modo</div>
          <div className="grid grid-cols-3 gap-1 rounded-md bg-slate-100 p-1">
            {(["Desactivado", "Monitoreo", "Bloqueo"] as WafMode[]).map((item) => (
              <button
                disabled={isSaving || !selectedDomainId}
                className={cn("h-8 rounded text-xs font-bold", mode === item ? "bg-white text-blue-700 shadow-sm" : "text-slate-500")}
                key={item}
                onClick={() => onSave({ mode: wafModeValue(item) })}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-2 text-sm font-bold text-slate-900">Reglas activas</div>
          <div className="space-y-2">
            {rules.map((rule) => (
              <ToggleCard
                detail={rule.active ? "Habilitada" : "Disponible"}
                disabled={isSaving || !selectedDomainId}
                enabled={rule.active}
                key={rule.label}
                onToggle={() => onSave({ [rule.key]: !rule.active })}
                title={rule.label}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex justify-end gap-2">
          <Button disabled={isSaving || !selectedDomainId} onClick={() => onSave({ mode: "block" })} size="sm">Activar</Button>
          <Button disabled={isSaving || !selectedDomainId} onClick={() => onSave({ mode: "monitor" })} size="sm" variant="outline">Configurar</Button>
          <Button disabled size="sm" variant="outline">Ver eventos</Button>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">IP origen</th>
                <th className="px-3 py-2">Regla</th>
                <th className="px-3 py-2">Acción</th>
                <th className="px-3 py-2">Ruta</th>
                <th className="px-3 py-2">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="px-3 py-2 font-semibold text-slate-900">{event.source}</td>
                  <td className="px-3 py-2 text-slate-700">{event.rule}</td>
                  <td className="px-3 py-2 text-slate-700">{event.action}{event.status ? ` (${event.status})` : ""}</td>
                  <td className="max-w-[260px] truncate px-3 py-2 text-xs text-slate-600">{event.method ? `${event.method} ` : ""}{event.path ?? "-"}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{event.date}</td>
                </tr>
              ))}
              {!events.length && (
                <tr>
                  <td className="px-3 py-6 text-center text-xs text-slate-500" colSpan={5}>Sin eventos WAF registrados desde el agente.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function IpBlocksTab({
  isLoading,
  onAdd,
  onDelete,
  onEdit,
  rows,
}: {
  isLoading: boolean
  onAdd: () => void
  onDelete: (item: HostingIpBlock) => void
  onEdit: (item: HostingIpBlock) => void
  rows: HostingIpBlock[]
}) {
  return (
    <CrudTable
      actionLabel="Agregar bloqueo"
      columns={["IP / rango", "Motivo", "Fecha", "Expira", "Estado", "Acciones"]}
      onAdd={onAdd}
      rows={(isLoading ? [] : rows).map((item) => [
        item.target,
        item.reason,
        formatDate(item.created_at),
        item.expires_on ? formatDate(item.expires_on) : "Permanente",
        <span className={cn("rounded-md px-2 py-1 text-xs font-bold", item.status === "active" ? "bg-red-50 text-red-700" : item.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600")}>{ipBlockStatusLabel(item.status)}</span>,
        <div className="flex justify-end gap-1"><IconAction icon={LockKeyhole} label="Editar" onClick={() => onEdit(item)} /><IconAction icon={Trash2} label="Eliminar" onClick={() => onDelete(item)} tone="danger" /></div>,
      ])}
    />
  )
}

function ScanTab({ onAdd, onReport, onRetry, rows }: { onAdd: () => void; onReport: (scan: HostingSecurityScan) => void; onRetry: (scan: HostingSecurityScan) => void; rows: HostingSecurityScan[] }) {
  return (
    <CrudTable
      actionLabel="Solicitar escaneo"
      columns={["Ruta", "Tipo", "Estado", "Archivos", "Progreso", "Fecha", "Acciones"]}
      onAdd={onAdd}
      rows={rows.map((item) => [
        item.path,
        scanTypeLabel(item.scan_type),
        <span className={cn("rounded-md px-2 py-1 text-xs font-bold", item.status === "clean" ? "bg-emerald-50 text-emerald-700" : item.status === "queued" || item.status === "running" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700")}>{scanStatusLabel(item.status)}</span>,
        item.files_scanned ? item.files_scanned.toLocaleString() : "En cola",
        <ProgressCell value={item.progress} />,
        formatDate(item.created_at),
        <div className="flex justify-end gap-1"><IconAction icon={Search} label="Ver reporte" onClick={() => onReport(item)} /><IconAction icon={RefreshCcw} label="Reintentar" onClick={() => onRetry(item)} /></div>,
      ])}
    />
  )
}

function CrudTable({ columns, rows, actionLabel, onAdd }: { columns: string[]; rows: (ReactNode | string)[][]; actionLabel: string; onAdd: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={onAdd} size="sm"><Plus className="h-4 w-4" />{actionLabel}</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>{columns.map((column) => <th className="px-3 py-2 last:text-right" key={column}>{column}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.map((row, index) => (
              <tr className="h-[52px] hover:bg-slate-50" key={index}>
                {row.map((cell, cellIndex) => <td className="px-3 py-2 text-sm text-slate-700 last:text-right" key={cellIndex}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function IpBlockModal({
  domains,
  initial,
  isSaving,
  onClose,
  onSubmit,
}: {
  domains: HostingDomain[]
  initial: HostingIpBlock | null
  isSaving: boolean
  onClose: () => void
  onSubmit: (payload: CreateIpBlockPayload) => void
}) {
  const [domainId, setDomainId] = useState(String(initial?.domain ?? domains[0]?.id ?? ""))
  const [target, setTarget] = useState(initial?.target ?? "")
  const [reason, setReason] = useState(initial?.reason ?? "")
  const [permanent, setPermanent] = useState(!initial?.expires_on)
  const [expiresOn, setExpiresOn] = useState(initial?.expires_on ?? "")
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const selectedDomain = domains.find((domain) => String(domain.id) === domainId) ?? domains[0]

  return (
    <SecurityModal title={initial ? "Editar bloqueo IP" : "Agregar bloqueo IP"} kicker="Firewall">
      <form onSubmit={(event) => { event.preventDefault(); if (selectedDomain) onSubmit({ domain: selectedDomain.id, enabled, expires_on: permanent ? null : expiresOn, reason, target }) }}>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectInput label="Dominio" onChange={setDomainId} options={domains.map((domain) => [String(domain.id), domain.domain] as [string, string])} value={domainId} />
          <TextInput label="IP / rango" onChange={setTarget} placeholder="203.0.113.44 o 198.51.100.0/24" value={target} />
          <TextInput label="Motivo" onChange={setReason} placeholder="Intentos de login" value={reason} />
          <TextInput disabled={permanent} label="Expira" onChange={setExpiresOn} placeholder="2026-05-16" type="date" value={expiresOn} />
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
            <input checked={permanent} onChange={(event) => setPermanent(event.target.checked)} type="checkbox" />
            Permanente
          </label>
          <SelectInput label="Estado" onChange={(value) => setEnabled(value === "active")} options={[["active", "Activado"], ["disabled", "Desactivado"]]} value={enabled ? "active" : "disabled"} />
        </div>
        <ModalFooter disabled={isSaving || !selectedDomain || !target || !reason || (!permanent && !expiresOn)} onClose={onClose} primary="Guardar bloqueo" submit />
      </form>
    </SecurityModal>
  )
}

function ScanRequestModal({
  accounts,
  isSaving,
  onClose,
  onSubmit,
}: {
  accounts: Array<{ id: string; label: string; username: string }>
  isSaving: boolean
  onClose: () => void
  onSubmit: (payload: CreateSecurityScanPayload) => void
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "")
  const [path, setPath] = useState("public_html")
  const [scanType, setScanType] = useState<CreateSecurityScanPayload["scan_type"]>("quick")

  return (
    <SecurityModal title="Solicitar escaneo antivirus" kicker="Escaneo">
      <form onSubmit={(event) => { event.preventDefault(); onSubmit({ account: accountId, path, scan_type: scanType }) }}>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectInput label="Cuenta" onChange={setAccountId} options={accounts.map((account) => [account.id, `${account.label} (${account.username})`] as [string, string])} value={accountId} />
          <SelectInput label="Tipo de escaneo" onChange={(value) => setScanType(value as CreateSecurityScanPayload["scan_type"])} options={[["full", "Antivirus completo"], ["quick", "Antivirus rapido"], ["manual", "Peticion manual"]]} value={scanType} />
          <div className="md:col-span-2">
            <PathPicker accountId={accountId} label="Ruta" onChange={setPath} value={path} />
          </div>
        </div>
        <ModalFooter disabled={isSaving || !accountId || !path} onClose={onClose} primary="Solicitar escaneo" submit />
      </form>
    </SecurityModal>
  )
}

function ScanReportModal({ onClose, scan }: { onClose: () => void; scan: HostingSecurityScan }) {
  const infected = scan.report?.infected_files ?? []
  return (
    <SecurityModal title="Informe de escaneo" kicker={scan.path}>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <ReportItem label="Estado" value={scanStatusLabel(scan.status)} />
          <ReportItem label="Tipo" value={scanTypeLabel(scan.scan_type)} />
          <ReportItem label="Archivos analizados" value={scan.files_scanned.toLocaleString()} />
          <ReportItem label="Archivos infectados" value={scan.infected_files.toLocaleString()} />
          <ReportItem label="Datos analizados" value={scan.data_scanned || "-"} />
          <ReportItem label="Duracion" value={scan.report?.duration_seconds ? `${scan.report.duration_seconds}s` : "-"} />
        </div>
        {scan.error_detail ? <Notice tone="error" text={`${scan.error_code || "ERROR"}: ${scan.error_detail}`} /> : null}
        <div>
          <div className="mb-2 text-sm font-bold text-slate-900">Archivos detectados</div>
          <div className="max-h-32 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            {infected.length ? infected.map((file) => <div key={file}>{file}</div>) : <div>No se registraron archivos infectados.</div>}
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-bold text-slate-900">Salida del motor antivirus</div>
          <pre className="max-h-48 overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100">{scan.output || "Sin salida registrada aun."}</pre>
        </div>
      </div>
      <ModalFooter onClose={onClose} primary="Cerrar" />
    </SecurityModal>
  )
}

function ReportItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-slate-900">{value}</div>
    </div>
  )
}

function ProgressCell({ value }: { value: number }) {
  const progress = Math.min(100, Math.max(0, value))
  return (
    <div className="min-w-[140px]">
      <div className="mb-1 flex justify-between text-[11px] font-bold text-slate-500">
        <span>{progress}%</span>
        <span>{100 - progress}% falta</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

function SecurityModal({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4">
      <div className="w-full max-w-xl rounded-lg bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="eh-kicker">{kicker}</div>
          <h3 className="mt-1 text-lg font-bold">{title}</h3>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

function ModalFooter({ disabled = false, onClose, primary, submit = false }: { disabled?: boolean; onClose: () => void; primary: string; submit?: boolean }) {
  return (
    <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
      <Button onClick={onClose} size="sm" type="button" variant="outline">
        Cancelar
      </Button>
      <Button disabled={disabled} onClick={submit ? undefined : onClose} size="sm" type={submit ? "submit" : "button"}>
        {primary}
      </Button>
    </div>
  )
}

function ToggleCard({ title, detail, enabled = false, disabled = false, onToggle }: { title: string; detail: string; enabled?: boolean; disabled?: boolean; onToggle?: () => void }) {
  return (
    <button className={cn("w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition", onToggle && "hover:border-blue-200 hover:bg-blue-50/30", disabled && "opacity-60")} disabled={disabled || !onToggle} onClick={onToggle} type="button">
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

function SecurityMetric({ icon: Icon, label, value, detail, tone }: { icon: typeof ShieldCheck; label: string; value: string; detail: string; tone: "emerald" | "blue" | "indigo" | "amber" }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    indigo: "bg-indigo-50 text-indigo-700",
    amber: "bg-amber-50 text-amber-700",
  }

  return (
    <div className="eh-card p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-1 text-lg font-bold text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{detail}</div>
        </div>
        <div className={cn("grid h-9 w-9 place-items-center rounded-md", tones[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: CertificateStatus }) {
  const className =
    status === "Activo"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Sin SSL"
        ? "bg-slate-100 text-slate-600"
      : status === "Pendiente"
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700"

  return <span className={cn("rounded-md px-2 py-1 text-xs font-bold", className)}>{status}</span>
}

function webProtectionStatusLabel(status?: string) {
  if (status === "active") return "Activa"
  if (status === "failed") return "Error"
  return "En proceso"
}

function protectedDirectoryStatusLabel(status: string) {
  if (status === "active") return "Activo"
  if (status === "failed") return "Error"
  if (status === "disabled") return "Desactivado"
  return "En proceso"
}

function protectedDirectoryStatusTone(directory: HostingProtectedDirectory) {
  if (!directory.enabled || directory.status === "disabled") return "bg-slate-100 text-slate-600"
  if (directory.status === "active") return "bg-emerald-50 text-emerald-700"
  if (directory.status === "failed") return "bg-rose-50 text-rose-700"
  return "bg-amber-50 text-amber-700"
}

function protectedDirectoryErrorLabel(directory: HostingProtectedDirectory) {
  if (directory.last_error_code === "PASSWORD_FILE_MISSING") return "Falta aplicar la contrasena. Usa el boton de llave para reenviarla."
  if (directory.last_error_code === "JOB_NOT_IMPLEMENTED") return "El agente anterior no soportaba esta accion. Reintenta con el boton de llave."
  return directory.last_error_detail || directory.last_error_code || "No se pudo aplicar la proteccion."
}

function parentPath(path: string) {
  const clean = path.trim().replace(/^\/+|\/+$/g, "")
  if (!clean) return "/"
  const parts = clean.split("/")
  parts.pop()
  return parts.length ? `/${parts.join("/")}` : "/"
}

function Notice({ text, tone }: { text: string; tone: "success" | "error" }) {
  return (
    <div className={cn("rounded-md border px-3 py-2 text-sm font-semibold", tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800")}>
      {text}
    </div>
  )
}

function IconAction({ icon: Icon, label, onClick, tone = "default" }: { icon: typeof RefreshCcw; label: string; onClick?: () => void; tone?: "default" | "danger" }) {
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

function TextInput({ disabled = false, label, onChange, placeholder, type = "text", value }: { disabled?: boolean; label: string; onChange: (value: string) => void; placeholder: string; type?: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>
      <input className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} />
    </label>
  )
}

function PathPicker({ accountId, label, onChange, value }: { accountId: string; label: string; onChange: (value: string) => void; value: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [path, setPath] = useState("/")
  const [items, setItems] = useState<FileManagerItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadPath = async (targetPath: string) => {
    if (!accountId) return
    setIsLoading(true)
    try {
      const response = await hostingApi.fileList(accountId, targetPath)
      const nextItems = response.items ?? response.result?.items ?? []
      setItems(nextItems.filter((item) => item.type === "dir"))
      setPath(response.path ?? response.result?.path ?? targetPath)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) void loadPath(path)
  }, [isOpen])

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>
      <div className="flex gap-1">
        <input className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" onChange={(event) => onChange(event.target.value)} value={value} />
        <Button onClick={() => setIsOpen((current) => !current)} size="sm" type="button" variant="outline">
          <Search className="h-4 w-4" />
        </Button>
      </div>
      {isOpen ? (
        <div className="mt-2 rounded-md border border-slate-200 bg-white p-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex gap-3">
              <button className="text-xs font-bold text-blue-700" onClick={() => { onChange("public_html"); setIsOpen(false) }} type="button">Usar raíz</button>
              <button className="text-xs font-bold text-blue-700" onClick={() => void loadPath(parentPath(path))} type="button">Subir</button>
            </div>
            <span className="truncate text-xs text-slate-500">{path}</span>
          </div>
          <div className="max-h-40 space-y-1 overflow-auto">
            {items.map((item) => (
              <button className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50" key={item.path} onClick={() => void loadPath(item.path)} type="button">
                <span>{item.name}</span>
                <span className="text-blue-600" onClick={(event) => { event.stopPropagation(); onChange(item.path.replace(/^\/+/, "")); setIsOpen(false) }}>Usar</span>
              </button>
            ))}
            {!isLoading && items.length === 0 ? <div className="px-2 py-2 text-xs text-slate-500">Sin carpetas.</div> : null}
            {isLoading ? <div className="px-2 py-2 text-xs text-slate-500">Cargando...</div> : null}
          </div>
        </div>
      ) : null}
    </label>
  )
}

function SelectInput({
  disabled = false,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean
  label: string
  onChange?: (value: string) => void
  options: string[] | Array<[string, string]>
  value?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>
      <select className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" disabled={disabled} onChange={(event) => onChange?.(event.target.value)} value={value}>
        {options.map((option) => (
          Array.isArray(option) ? <option key={option[0]} value={option[0]}>{option[1]}</option> : <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

function mapSslCertificate(domain: HostingDomain): SslCertificate {
  const issuer = domain.ssl_issuer || (domain.ssl_status === "active" ? "Let's Encrypt" : "Pendiente")
  const isPaid = Boolean(domain.ssl_issuer && !domain.ssl_issuer.toLowerCase().includes("let"))

  return {
    autoRenew: !isPaid,
    domain: domain.domain,
    domainType: domainTypeLabel(domain.domain_type),
    expiresAt: domain.ssl_expires_at ? domain.ssl_expires_at.slice(0, 10) : "Pendiente",
    id: domain.id,
    issuer,
    kind: isPaid ? "De pago" : "Gratis",
    raw: domain,
    status: mapCertificateStatus(domain),
    type: isPaid ? "Personalizado" : "Let's Encrypt",
  }
}

function certificateHasWebmailSsl(certificate: SslCertificate) {
  return (certificate.raw.ssl_domains || []).includes(`webmail.${certificate.domain}`)
}

function mapCertificateStatus(domain: HostingDomain): CertificateStatus {
  if (domain.ssl_status === "active") return "Activo"
  if (domain.ssl_status === "failed") return "Error"
  if (!domain.ssl_issuer && !domain.ssl_expires_at && !domain.ssl_cert_path) return "Sin SSL"
  return "Pendiente"
}

function domainTypeLabel(type: HostingDomain["domain_type"] | string) {
  if (type === "subdomain") return "Subdominio"
  if (type === "addon") return "Dominio adicional"
  if (type === "alias") return "Parqueado"
  return "Dominio principal"
}

function daysUntil(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86_400_000))
}

function wafModeLabel(value: "disabled" | "monitor" | "block"): WafMode {
  return value === "block" ? "Bloqueo" : value === "disabled" ? "Desactivado" : "Monitoreo"
}

function wafModeValue(value: WafMode): "disabled" | "monitor" | "block" {
  return value === "Bloqueo" ? "block" : value === "Desactivado" ? "disabled" : "monitor"
}

function wafStatusLabel(value?: string) {
  if (value === "failed") return "Error"
  if (value === "pending") return "En proceso"
  return "Activo"
}

function ipBlockStatusLabel(value: HostingIpBlock["status"]) {
  if (value === "active") return "Activado"
  if (value === "pending") return "En proceso"
  if (value === "disabled") return "Desactivado"
  if (value === "expired") return "Expirado"
  return "Error"
}

function scanStatusLabel(value: HostingSecurityScan["status"]) {
  if (value === "clean") return "Limpio"
  if (value === "queued") return "Pendiente"
  if (value === "running") return "En progreso"
  if (value === "threat") return "Amenaza"
  if (value === "canceled") return "Cancelado"
  return "Error"
}

function scanTypeLabel(value: HostingSecurityScan["scan_type"]) {
  if (value === "full") return "Antivirus completo"
  if (value === "manual") return "Peticion manual"
  return "Antivirus rapido"
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString().slice(0, 10)
}

function readMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar la operación."
}

