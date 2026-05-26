import {
  Activity,
  Archive,
  Bell,
  Boxes,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Cloud,
  Code2,
  Database,
  DatabaseBackup,
  Edit3,
  Eye,
  FileDown,
  FileText,
  Gauge,
  Globe2,
  HardDrive,
  Import,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  Package,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Ticket,
  Trash2,
  UserCog,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { FormEvent, ReactNode } from "react"
import { useEffect, useState } from "react"

import { adminApi, type AdminAccessSecurity, type AdminAccessSession, type AdminAgentEvent, type AdminAgentJob, type AdminAuditLog, type AdminEnrollmentToken, type AdminMailQueueItem, type AdminNode, type AdminPermission, type AdminRole, type AdminUser } from "@/api/admin"
import { authApi } from "@/api/auth"
import { hostingApi, type AccountProfileResponse, type ApiKeyCredential, type ApiKeyCredentialCreated, type ApiKeyCredentialPayload, type ApiKeyCredentialStatus, type BackupPolicy, type BackupPolicyPayload, type BackupRestoreRun, type BackupRestoreRunPayload, type BackupStorageDestination, type BackupStorageDestinationPayload, type BillingIntegrationStatus, type CreateHostingAccountExportPayload, type CreateHostingResellerPayload, type CreateImportRunPayload, type CreateIpBlockPayload, type CreateMigrationRunPayload, type CreateSecurityScanPayload, type DnsRecordType, type DnsTemplatePreviewRecord, type DnsTemplateRecord, type DnsTemplateRecordPayload, type GlobalAnnouncement, type GlobalAnnouncementPayload, type GlobalNameserver, type GlobalNameserverPayload, type HomeDashboardSummary, type HostingAccount, type HostingAccountExport, type HostingConfiguration, type HostingDnsRecord, type HostingDomain, type HostingIpBlock, type HostingMailbox, type HostingPlan, type HostingPlanPayload, type HostingReseller, type HostingSecurityScan, type HostingWafResponse, type MigrationProvider, type MigrationRun, type ProvisionHostingAccountPayload, type ProvisioningTemplate, type ProvisioningTemplateAction, type ProvisioningTemplateCategory, type ProvisioningTemplatePayload, type RemediateSecurityScanPayload, type SupportTicket } from "@/api/hosting"
import { Button } from "@/components/ui/button"
import { buildCloudflareZoneFile, downloadCloudflareZoneFile } from "@/lib/dns-zone-export"
import { cn } from "@/lib/utils"

type AdminLayoutProps = {
  onLogout: () => void
}

type AdminMenuItem = {
  label: string
  icon: LucideIcon
}

const adminMenuSections: Array<{ label: string; items: AdminMenuItem[] }> = [
  { label: "Inicio", items: [{ label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Infraestructura",
    items: [
      { label: "Servidores/Nodos", icon: Server },
      { label: "Servicios del sistema", icon: Settings2 },
      { label: "Estado de recursos", icon: Gauge },
      { label: "Mantenimiento", icon: HardDrive },
    ],
  },
  {
    label: "Clientes",
    items: [
      { label: "Cuentas de hosting", icon: Globe2 },
      { label: "Revendedores", icon: Users },
      { label: "Migraciones", icon: Import },
    ],
  },
  {
    label: "Planes y paquetes",
    items: [
      { label: "Planes cliente", icon: Package },
      { label: "Planes revendedor", icon: Boxes },
      { label: "Limites globales", icon: Gauge },
      { label: "Add-ons", icon: Package },
    ],
  },
  {
    label: "Provisionamiento",
    items: [
      { label: "Cola de tareas", icon: ClipboardList },
      { label: "Importaciones", icon: Import },
      { label: "Exportaciones", icon: FileDown },
      { label: "Plantillas", icon: FileText },
    ],
  },
  {
    label: "Dominios y DNS",
    items: [
      { label: "DNS global", icon: Cloud },
      { label: "Nameservers", icon: Server },
      { label: "Zonas DNS", icon: Settings2 },
    ],
  },
  {
    label: "SSL y seguridad web",
    items: [
      { label: "SSL global", icon: ShieldCheck },
      { label: "SSL de clientes", icon: ShieldCheck },
      { label: "WAF / Firewall", icon: ShieldCheck },
      { label: "Bloqueos IP", icon: KeyRound },
      { label: "Escaneo antivirus", icon: Search },
    ],
  },
  {
    label: "Correo",
    items: [
      { label: "Cuentas de correo", icon: Mail },
      { label: "Cola de correo", icon: ClipboardList },
      { label: "Entregabilidad", icon: Gauge },
      { label: "Reputacion SMTP", icon: ShieldCheck },
      { label: "Antispam", icon: ShieldCheck },
    ],
  },
  {
    label: "Backups",
    items: [
      { label: "Politicas globales", icon: DatabaseBackup },
      { label: "Backups por cliente", icon: Archive },
      { label: "Backups por revendedor", icon: DatabaseBackup },
      { label: "Almacenamientos", icon: HardDrive },
      { label: "EHPanel Drive", icon: Cloud },
      { label: "Restauraciones", icon: Archive },
    ],
  },
  {
    label: "Soporte",
    items: [
      { label: "Tickets revendedores", icon: Ticket },
      { label: "Tickets clientes", icon: Ticket },
      { label: "Base de conocimiento", icon: FileText },
      { label: "Anuncios globales", icon: Megaphone },
    ],
  },
  {
    label: "Logs",
    items: [
      { label: "Logs del sistema", icon: FileText },
      { label: "Logs del panel", icon: ClipboardList },
      { label: "Logs de correo", icon: Mail },
      { label: "Logs de backups", icon: DatabaseBackup },
      { label: "Logs de seguridad", icon: ShieldCheck },
      { label: "Descargas de logs", icon: FileDown },
    ],
  },
  {
    label: "Usuarios y permisos",
    items: [
      { label: "Administradores", icon: UserCog },
      { label: "Roles", icon: Users },
      { label: "Permisos", icon: KeyRound },
      { label: "Sesiones activas", icon: ShieldCheck },
      { label: "Seguridad de acceso", icon: ShieldCheck },
    ],
  },
  {
    label: "Configuracion",
    items: [
      { label: "Parametros globales", icon: Settings2 },
      { label: "Motor web", icon: Server },
      { label: "Versiones PHP", icon: Code2 },
      { label: "Integraciones", icon: Boxes },
      { label: "Notificaciones", icon: Bell },
      { label: "API / claves", icon: KeyRound },
    ],
  },
]

export function AdminLayout({ onLogout }: AdminLayoutProps) {
  const [activeView, setActiveView] = useState("Dashboard")

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[238px] flex-col border-r border-slate-950/40 bg-sidebar text-white shadow-xl">
        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="relative mt-1">
              <span className="absolute inline-flex h-3 w-3 animate-status-pulse rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full border border-emerald-200 bg-emerald-500 shadow-[0_0_14px_rgba(34,197,94,0.85)]" />
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-bold leading-5">EHPanel Web</div>
              <div className="text-[11px] font-medium text-sidebar-muted">by EHClouding</div>
              <div className="mt-2 truncate text-xs font-semibold text-blue-300">Administrador</div>
            </div>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {adminMenuSections.map((section) => (
            <div className="mb-4" key={section.label}>
              <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-muted">
                {section.label}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <AdminSidebarButton
                    active={activeView === item.label}
                    icon={item.icon}
                    key={`${section.label}-${item.label}`}
                    label={item.label}
                    onClick={() => setActiveView(item.label)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            onClick={onLogout}
            type="button"
          >
            <LogOut className="h-4 w-4 text-sidebar-muted" />
            Cerrar sesion
          </button>
        </div>
      </aside>

      <div style={{ marginLeft: 238, width: "calc(100% - 238px)" }}>
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Button size="sm" variant="outline">
              Admin global
              <ChevronDown className="h-4 w-4" />
            </Button>
            <div className="hidden h-8 w-[380px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 xl:flex">
              <Search className="h-4 w-4" />
              Buscar servidor, cliente, revendedor, dominio...
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline">
              <CircleHelp className="h-4 w-4" />
              Manuales
            </Button>
            <Button aria-label="Notificaciones" size="icon" variant="ghost">
              <Bell className="h-4 w-4" />
            </Button>
            <div className="ml-1 hidden items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 md:flex">
              <div className="grid h-6 w-6 place-items-center rounded bg-blue-600 text-xs font-bold text-white">AD</div>
              <div className="text-xs">
                <div className="font-semibold leading-4">Administrador</div>
                <div className="text-slate-500">Acceso temporal</div>
              </div>
            </div>
          </div>
        </header>

        <main className="px-5 py-5">
          {activeView === "Dashboard" ? (
            <AdminDashboardPage />
          ) : activeView === "Servidores/Nodos" ? (
            <AdminServersPageReal />
          ) : activeView === "Servicios del sistema" ? (
            <AdminSystemServicesPage />
          ) : activeView === "Estado de recursos" ? (
            <AdminResourceStatusPage />
          ) : activeView === "Mantenimiento" ? (
            <AdminMaintenancePage />
          ) : activeView === "Cuentas de hosting" ? (
            <AdminHostingAccountsPage />
          ) : activeView === "Revendedores" ? (
            <AdminResellersPage />
          ) : activeView === "Migraciones" ? (
            <AdminMigrationsPage />
          ) : activeView === "Planes cliente" ? (
            <AdminClientPlansPage />
          ) : activeView === "Planes revendedor" ? (
            <AdminResellerPlansPage />
          ) : activeView === "Limites globales" ? (
            <AdminGlobalLimitsPage />
          ) : activeView === "Add-ons" ? (
            <AdminAddOnsPage />
          ) : activeView === "Cola de tareas" ? (
            <AdminTaskQueuePage />
          ) : activeView === "Importaciones" ? (
            <AdminImportsPage />
          ) : activeView === "Exportaciones" ? (
            <AdminExportsPage />
          ) : activeView === "Plantillas" ? (
            <AdminProvisioningTemplatesPage />
          ) : activeView === "DNS global" ? (
            <AdminGlobalDnsPage />
          ) : activeView === "Nameservers" ? (
            <AdminNameserversPage />
          ) : activeView === "Zonas DNS" ? (
            <AdminDnsZonesPage />
          ) : activeView === "SSL global" ? (
            <AdminGlobalSslPage />
          ) : activeView === "SSL de clientes" ? (
            <AdminClientSslPage />
          ) : activeView === "WAF / Firewall" ? (
            <AdminWafFirewallPage />
          ) : activeView === "Bloqueos IP" ? (
            <AdminIpBlocksPage />
          ) : activeView === "Escaneo antivirus" ? (
            <AdminAntivirusScanPage />
          ) : activeView === "Cuentas de correo" ? (
            <AdminMailAccountsPage />
          ) : activeView === "Cola de correo" ? (
            <AdminMailQueuePage />
          ) : activeView === "Entregabilidad" ? (
            <AdminMailDeliverabilityPage />
          ) : activeView === "Reputacion SMTP" ? (
            <AdminSmtpReputationPage />
          ) : activeView === "Antispam" ? (
            <AdminAntispamPage />
          ) : activeView === "Politicas globales" ? (
            <AdminBackupPoliciesPage />
          ) : activeView === "Backups por cliente" ? (
            <AdminClientBackupsPage />
          ) : activeView === "Backups por revendedor" ? (
            <AdminResellerBackupsPage />
          ) : activeView === "Almacenamientos" ? (
            <AdminBackupStoragePage />
          ) : activeView === "EHPanel Drive" ? (
            <AdminDevelopmentPage
              icon={Cloud}
              kicker="Backups"
              title="EHPanel Drive"
              description="Modulo en desarrollo. Aqui se administrara el almacenamiento propio para backups, exportaciones y archivos del ecosistema EHPanel."
            />
          ) : activeView === "Restauraciones" ? (
            <AdminBackupRestoresPage />
          ) : activeView === "Tickets revendedores" ? (
            <AdminSupportTicketsPage audience="revendedores" />
          ) : activeView === "Tickets clientes" ? (
            <AdminSupportTicketsPage audience="clientes" />
          ) : activeView === "Base de conocimiento" ? (
            <AdminKnowledgeBasePage />
          ) : activeView === "Anuncios globales" ? (
            <AdminGlobalAnnouncementsPage />
          ) : activeView === "Logs del sistema" ? (
            <AdminSystemLogsPageReal />
          ) : activeView === "Logs del panel" ? (
            <AdminPanelLogsPageReal />
          ) : activeView === "Logs de correo" ? (
            <AdminMailLogsPageReal />
          ) : activeView === "Logs de backups" ? (
            <AdminBackupLogsPageReal />
          ) : activeView === "Logs de seguridad" ? (
            <AdminSecurityLogsPageReal />
          ) : activeView === "Descargas de logs" ? (
            <AdminLogDownloadsPageReal />
          ) : activeView === "Administradores" ? (
            <AdminAdministratorsPage />
          ) : activeView === "Roles" ? (
            <AdminRolesPage />
          ) : activeView === "Permisos" ? (
            <AdminPermissionsPage />
          ) : activeView === "Sesiones activas" ? (
            <AdminActiveSessionsPage />
          ) : activeView === "Seguridad de acceso" ? (
            <AdminAccessSecurityPage />
          ) : activeView === "Parametros globales" ? (
            <AdminGlobalSettingsPage />
          ) : activeView === "Motor web" ? (
            <AdminWebEnginePage />
          ) : activeView === "Versiones PHP" ? (
            <AdminPhpVersionsPage />
          ) : activeView === "Integraciones" ? (
            <AdminIntegrationsPage />
          ) : activeView === "Notificaciones" ? (
            <AdminNotificationsPage />
          ) : activeView === "API / claves" ? (
            <AdminApiKeysPage />
          ) : (
            <AdminCanvas activeView={activeView} />
          )}
        </main>
      </div>
    </div>
  )
}

type AdminDashboardState = {
  accounts: HostingAccount[]
  backups: BackupPolicy[]
  domains: HostingDomain[]
  jobs: AdminAgentJob[]
  mailboxes: HostingMailbox[]
  mailQueue: AdminMailQueueItem[]
  nodes: AdminNode[]
  resellers: HostingReseller[]
  restores: BackupRestoreRun[]
  scans: HostingSecurityScan[]
  summary: HomeDashboardSummary
  tickets: SupportTicket[]
  blocks: HostingIpBlock[]
}

function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardState | null>(null)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const load = () => {
    setIsLoading(true)
    Promise.all([
      hostingApi.dashboardSummary(),
      adminApi.nodes(),
      adminApi.jobs(),
      adminApi.mailQueue(),
      hostingApi.accounts(),
      hostingApi.resellers(),
      hostingApi.domains(),
      hostingApi.backupPolicies(),
      hostingApi.backupRestores(),
      hostingApi.securityScans(),
      hostingApi.tickets(),
      hostingApi.mailboxes(),
      hostingApi.ipBlocks(),
    ])
      .then(([summary, nodes, jobs, mailQueue, accounts, resellers, domains, backups, restores, scans, tickets, mailboxes, blocks]) => {
        setData({
          accounts: accounts.results,
          backups: backups.results,
          blocks: blocks.results,
          domains: domains.results,
          jobs: jobs.results,
          mailboxes: mailboxes.results,
          mailQueue: mailQueue.results,
          nodes: nodes.results,
          resellers: resellers.results,
          restores: restores.results,
          scans: scans.results,
          summary,
          tickets: tickets.results,
        })
        setError("")
      })
      .catch((reason) => setError(readAdminError(reason, "No se pudo cargar el dashboard admin.")))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 30000)
    return () => window.clearInterval(timer)
  }, [])

  const summary = data?.summary
  const nodes = data?.nodes ?? []
  const primaryNode = nodes.find((node) => node.hostname === "web-01.ehclouding.com") ?? nodes[0] ?? null
  const activeNodes = nodes.filter((node) => node.effective_state === "online" || node.state === "online").length
  const failedJobs = data?.jobs.filter((job) => job.status === "failed" || job.status === "expired").length ?? 0
  const runningJobs = data?.jobs.filter((job) => job.status === "queued" || job.status === "sent" || job.status === "running").length ?? 0
  const activeAccounts = data?.accounts.filter((account) => account.status === "active").length ?? summary?.totalCounts.accounts ?? 0
  const activeResellers = data?.resellers.filter((reseller) => reseller.status === "active").length ?? 0
  const sslActive = data?.domains.filter((domain) => domain.ssl_status === "active").length ?? 0
  const sslFailed = data?.domains.filter((domain) => domain.ssl_status === "failed").length ?? 0
  const sslRenew = data?.domains.filter((domain) => {
    const expiresAt = domain.ssl_expires_at
    const remaining = typeof expiresAt === "string" ? daysUntil(expiresAt) : null
    return domain.ssl_status === "active" && remaining !== null && remaining <= 30
  }).length ?? 0
  const webProtected = data?.domains.filter((domain) => domain.web_protection_status === "active").length ?? 0
  const backupActive = data?.backups.filter((policy) => policy.status === "active").length ?? 0
  const backupFailed = data?.restores.filter((restore) => restore.status === "failed").length ?? 0
  const mailRejected = data?.mailQueue.filter((item) => ["deferred", "failed", "bounced", "rejected"].some((word) => `${item.status} ${item.code}`.toLowerCase().includes(word))).length ?? 0
  const mailHealthyPct = data?.mailQueue.length ? Math.max(0, 100 - Math.round((mailRejected / data.mailQueue.length) * 100)) : summary?.mailPct ?? 100
  const securityIssues = (data?.scans.filter((scan) => scan.status === "threat" || scan.status === "failed").length ?? 0) + (data?.blocks.filter((block) => block.status === "active" || block.status === "failed").length ?? 0)
  const openTickets = data?.tickets.filter((ticket) => ticket.status !== "closed").length ?? 0
  const cpuPct = primaryNode ? dashboardNodePercent(primaryNode, ["cpu_pct", "cpu_usage_pct", "cpu_percent", "cpu"], [], []) ?? summary?.cpuPct ?? 0 : summary?.cpuPct ?? 0
  const ramPct = primaryNode ? dashboardNodePercent(primaryNode, ["memory_used_mb", "ram_used_mb", "mem_used_mb"], ["memory_total_mb", "ram_total_mb", "mem_total_mb"], ["memory_pct", "ram_pct", "mem_pct"]) ?? summary?.ramPct ?? 0 : summary?.ramPct ?? 0
  const diskPct = primaryNode ? dashboardNodePercent(primaryNode, ["disk_used_mb", "storage_used_mb"], ["disk_total_mb", "storage_total_mb"], ["disk_pct", "storage_pct"]) ?? summary?.diskPct ?? 0 : summary?.diskPct ?? 0
  const inMbps = sumNodeNumbers(nodes, ["bandwidth_in_mbps", "network_in_mbps", "net_in_mbps", "rx_mbps", "traffic_in_mbps"])
  const outMbps = sumNodeNumbers(nodes, ["bandwidth_out_mbps", "network_out_mbps", "net_out_mbps", "tx_mbps", "traffic_out_mbps"])
  const trafficSeries = dashboardTrafficSeries(summary, nodes)
  const trafficPeak = Math.max(inMbps, outMbps, ...trafficSeries, 0)
  const panelSubtitle = primaryNode
    ? `${primaryNode.os_name || "SO N/D"} · ${primaryNode.public_ip || "IP N/D"} · ${activeNodes}/${nodes.length} nodo(s) online`
    : "Sin nodos registrados"

  return (
    <div className="space-y-4">
      <AdminDashboardHeader isLoading={isLoading} onRefresh={load} />
      {error ? <BackupMessage message={error} /> : null}
      <section className="grid gap-3 xl:grid-cols-4">
        <AdminSignalCard detail={`${data?.domains.length ?? summary?.totalCounts.domains ?? 0} dominios`} label="Cuentas hosting" value={String(data?.accounts.length ?? summary?.totalCounts.accounts ?? 0)} />
        <AdminSignalCard detail={`${activeResellers} activos`} label="Revendedores" value={String(data?.resellers.length ?? 0)} />
        <AdminSignalCard detail={`${formatMbps(inMbps)} IN / ${formatMbps(outMbps)} OUT`} label="Trafico actual" value={formatMbps(inMbps + outMbps)} />
        <AdminSignalCard detail={`${failedJobs} jobs con error, ${openTickets} tickets`} label="Alertas abiertas" value={String(failedJobs + sslFailed + backupFailed + securityIssues + openTickets)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="eh-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="eh-kicker">Servidor del panel</div>
              <h2 className="mt-1 font-bold">{primaryNode?.hostname || "Nodo no disponible"}</h2>
              <p className="mt-1 text-sm text-slate-500">{panelSubtitle}</p>
            </div>
            <NodeStatusPill state={primaryNode?.effective_state || primaryNode?.state || "offline"} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <AdminDashboardGauge detail={dashboardCpuDetail(primaryNode)} label="CPU" value={cpuPct} />
            <AdminDashboardGauge detail={dashboardMemoryDetail(primaryNode)} label="Memoria" value={ramPct} />
            <AdminDashboardGauge detail={dashboardDiskDetail(primaryNode)} label="Disco" value={diskPct} />
          </div>
        </div>

        <div className="eh-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="eh-kicker">Transferencia del panel</div>
              <h2 className="mt-1 font-bold">Trafico y ancho de banda</h2>
              <p className="mt-1 text-sm text-slate-500">Datos consolidados desde telemetria de nodos y resumen de hosting.</p>
            </div>
            <MiniLineChart values={trafficSeries} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <AdminDashboardBar label="Entrada actual" value={trafficPercent(inMbps, trafficPeak)} valueLabel={formatMbps(inMbps)} />
            <AdminDashboardBar label="Salida actual" value={trafficPercent(outMbps, trafficPeak)} valueLabel={formatMbps(outMbps)} />
            <AdminDashboardBar label="Transferencia mes" value={summary?.trafficPct ?? 0} valueLabel={`${formatMb((summary?.totalReceived ?? 0) + (summary?.totalSent ?? 0))} usados`} />
            <AdminDashboardBar label="Pico 24h" value={trafficPercent(trafficPeak, trafficPeak)} valueLabel={formatMbps(trafficPeak)} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="eh-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="font-bold">Resumen operativo</h2>
              <p className="mt-1 text-sm text-slate-500">Cuentas, revendedores y consumo real del ecosistema.</p>
            </div>
            <Button onClick={load} size="sm" variant="outline">Actualizar</Button>
          </div>
          <div className="grid gap-0 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="p-4">
              <AdminDashboardBar label="Cuentas activas" value={percent(activeAccounts, data?.accounts.length || summary?.totalCounts.accounts || 0)} valueLabel={`${activeAccounts} / ${data?.accounts.length ?? summary?.totalCounts.accounts ?? 0}`} />
              <AdminDashboardBar label="Revendedores activos" value={percent(activeResellers, data?.resellers.length || 0)} valueLabel={`${activeResellers} / ${data?.resellers.length ?? 0}`} />
              <AdminDashboardBar label="Backups cubiertos" value={summary?.backupPct ?? percent(backupActive, data?.backups.length || 0)} valueLabel={`${backupActive} politicas activas`} />
            </div>
            <div className="p-4">
              <AdminDashboardBar label="SSL clientes" value={percent(sslActive, data?.domains.length || 0)} valueLabel={`${sslActive} protegidos`} />
              <AdminDashboardBar label="Correo saludable" value={mailHealthyPct} valueLabel={`${mailRejected} rechazados`} />
              <AdminDashboardBar label="WAF/proteccion web" value={percent(webProtected, data?.domains.length || 0)} valueLabel={`${webProtected} dominios`} />
            </div>
          </div>
        </div>

        <div className="eh-card p-4">
          <div className="eh-kicker">Eventos importantes</div>
          <h2 className="mt-1 font-bold">Atencion requerida</h2>
          <div className="mt-4 space-y-2">
            <AdminStatus label="SSL por renovar" value={`${sslRenew} dominios`} />
            <AdminStatus label="SSL con error" value={`${sslFailed} dominios`} />
            <AdminStatus label="Backups/restores fallidos" value={`${backupFailed} eventos`} />
            <AdminStatus label="Cola correo" value={`${mailRejected} rechazados`} />
            <AdminStatus label="Seguridad" value={`${securityIssues} senales`} />
            <AdminStatus label="Jobs activos" value={`${runningJobs} en cola/ejecucion`} />
          </div>
        </div>
      </section>
    </div>
  )
}

function AdminSignalCard({ detail, label, value }: { detail: string; label: string; value: string }) {
  return <div className="eh-card p-4"><div className="eh-kicker">{label}</div><div className="mt-2 text-2xl font-bold">{value}</div><div className="mt-1 text-sm text-slate-500">{detail}</div></div>
}

function AdminDashboardHeader({ isLoading, onRefresh }: { isLoading: boolean; onRefresh: () => void }) {
  return (
    <section className="eh-card px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <div className="eh-kicker">Administrador</div>
                  <h1 className="mt-1 text-xl font-bold tracking-tight">Dashboard admin</h1>
                  <p className="mt-1 max-w-3xl text-sm text-slate-500">
                    Resumen del servidor donde corre el panel, cuentas, revendedores, transferencia, seguridad y operaciones globales.
                  </p>
                </div>
              </div>
              <Button onClick={onRefresh} size="sm" type="button" variant="outline">{isLoading ? "Actualizando" : "Actualizar metricas"}</Button>
            </div>
          </section>
  )
}

function AdminDashboardGauge({ detail, label, value }: { detail: string; label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-3">
        <MiniGauge tone={value > 75 ? "amber" : "blue"} value={value} />
        <div>
          <div className="text-sm font-bold text-slate-900">{label}</div>
          <div className="mt-1 text-xs text-slate-500">{detail}</div>
        </div>
      </div>
    </div>
  )
}

function AdminDashboardBar({ label, value, valueLabel }: { label: string; value: number; valueLabel: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
        <span>{label}</span>
        <span className="text-slate-800">{valueLabel}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-200">
        <div className={cn("h-1.5 rounded-full", value > 85 ? "bg-amber-500" : "bg-blue-600")} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function NodeStatusPill({ state }: { state: string }) {
  const label = state === "online" ? "Operativo" : state === "pending" ? "Pendiente" : "Offline"
  return <AdminStatusBadge status={label === "Operativo" ? "Activo" : label} />
}

function dashboardNodeValue(node: AdminNode | null, keys: string[]) {
  if (!node) return null
  const telemetry = node.last_telemetry || {}
  const capabilities = node.capabilities || {}
  const system = isRecord(telemetry.system) ? telemetry.system : {}
  const capSystem = isRecord(capabilities.system) ? capabilities.system : {}
  for (const source of [telemetry, system, capabilities, capSystem]) {
    for (const key of keys) {
      const value = source[key]
      if (typeof value === "number" && Number.isFinite(value)) return value
      if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value)
    }
  }
  return null
}

function dashboardNodePercent(node: AdminNode | null, usedKeys: string[], totalKeys: string[], percentKeys: string[]) {
  const direct = dashboardNodeValue(node, [...percentKeys, ...usedKeys.filter((key) => key.includes("pct") || key.includes("percent"))])
  if (direct !== null) return Math.max(0, Math.min(100, Math.round(direct)))
  const used = dashboardNodeValue(node, usedKeys)
  const total = dashboardNodeValue(node, totalKeys)
  if (used === null || total === null || total <= 0) return null
  return Math.max(0, Math.min(100, Math.round((used / total) * 100)))
}

function dashboardCpuDetail(node: AdminNode | null) {
  const cores = dashboardNodeValue(node, ["cpu_cores", "vcpus", "logical_cpus", "cpu_count", "cores"])
  const load = dashboardNodeValue(node, ["load_1", "load1", "system_load"])
  if (cores) return load ? `Load ${Math.round(load * 100) / 100} / ${cores} vCPU` : `${cores} vCPU`
  return node ? "Telemetria CPU" : "Sin nodo"
}

function dashboardMemoryDetail(node: AdminNode | null) {
  const used = dashboardNodeValue(node, ["memory_used_mb", "ram_used_mb", "mem_used_mb"])
  const total = dashboardNodeValue(node, ["memory_total_mb", "ram_total_mb", "mem_total_mb"])
  if (used !== null || total !== null) return `${formatMb(Math.round(used || 0))} / ${formatMb(Math.round(total || 0))}`
  return node ? "Telemetria memoria" : "Sin nodo"
}

function dashboardDiskDetail(node: AdminNode | null) {
  const used = dashboardNodeValue(node, ["disk_used_mb", "storage_used_mb"])
  const total = dashboardNodeValue(node, ["disk_total_mb", "storage_total_mb"])
  if (used !== null || total !== null) return `${formatMb(Math.round(used || 0))} / ${formatMb(Math.round(total || 0))}`
  return node ? "Telemetria disco" : "Sin nodo"
}

function sumNodeNumbers(nodes: AdminNode[], keys: string[]) {
  return Math.round(nodes.reduce((total, node) => total + (dashboardNodeValue(node, keys) || 0), 0))
}

function dashboardTrafficSeries(summary: HomeDashboardSummary | undefined, nodes: AdminNode[]) {
  const summaryValues = summary?.trafficValues?.map((item) => Math.max(Number(item.down) || 0, Number(item.up) || 0)).filter((value) => value > 0) || []
  if (summaryValues.length) return summaryValues.slice(-24)
  const values = nodes.flatMap((node) => nodeSeries(node, ["traffic_history", "network_history", "bandwidth_history"], null))
  return values.length ? values.slice(-24) : [0]
}

function trafficPercent(value: number, peak: number) {
  if (!peak) return 0
  return Math.max(0, Math.min(100, Math.round((value / peak) * 100)))
}

function AdminCanvas({ activeView }: { activeView: string }) {
  return (
    <section className="eh-card px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eh-kicker">Administrador</div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">{activeView}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Lienzo base listo para construir esta seccion del panel administrador.
          </p>
        </div>
        <Button size="sm" variant="outline">Acciones</Button>
      </div>
    </section>
  )
}

function AdminServersPageReal() {
  const [nodes, setNodes] = useState<AdminNode[]>([])
  const [selectedNode, setSelectedNode] = useState<AdminNode | null>(null)
  const [events, setEvents] = useState<AdminAgentEvent[]>([])
  const [jobs, setJobs] = useState<AdminAgentJob[]>([])
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [showEnrollment, setShowEnrollment] = useState(false)
  const [detailNode, setDetailNode] = useState<AdminNode | null>(null)
  const [serviceBusy, setServiceBusy] = useState("")

  const loadNodes = () => {
    setIsLoading(true)
    adminApi
      .nodes()
      .then((page) => {
        setNodes(page.results)
        setSelectedNode((current) => {
          if (current) return page.results.find((node) => node.id === current.id) ?? current
          return page.results.find((node) => node.hostname === "web-01.ehclouding.com") ?? page.results[0] ?? null
        })
        setError("")
      })
      .catch((reason) => setError(readAdminError(reason, "No se pudieron cargar los nodos.")))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    void Promise.resolve().then(loadNodes)
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.resolve().then(() => {
      if (!selectedNode) {
        if (!cancelled) {
          setEvents([])
          setJobs([])
        }
        return
      }
      setIsDetailLoading(true)
      Promise.all([adminApi.nodeEvents(selectedNode.id), adminApi.jobs({ node: selectedNode.id })])
        .then(([eventPage, jobPage]) => {
          if (cancelled) return
          setEvents(eventPage.results.slice(0, 8))
          setJobs(jobPage.results.slice(0, 8))
          setError("")
        })
        .catch((reason) => {
          if (!cancelled) setError(readAdminError(reason, "No se pudo cargar el detalle del nodo."))
        })
        .finally(() => {
          if (!cancelled) setIsDetailLoading(false)
        })
    })
    return () => {
      cancelled = true
    }
  }, [selectedNode])

  const filteredNodes = nodes.filter((node) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return [node.hostname, node.public_ip, node.os_name, node.agent_type, node.agent_version].some((value) => value?.toLowerCase().includes(term))
  })
  const onlineNodes = nodes.filter((node) => node.effective_state === "online" || node.state === "online")
  const staleNodes = nodes.filter((node) => node.is_stale)
  const avgLoad = averageNodeLoadReal(nodes)

  const sendServiceAction = async (service: string, action: string) => {
    if (!selectedNode) return
    setServiceBusy(`${service}:${action}`)
    setMessage("")
    try {
      const job = await adminApi.serviceAction(selectedNode.id, { action, service })
      setMessage(`Job enviado al agente: ${jobTypeLabel(job.job_type)} (${jobStatusLabel(job.status)})`)
      const jobPage = await adminApi.jobs({ node: selectedNode.id })
      setJobs(jobPage.results.slice(0, 8))
    } catch (reason) {
      setError(readAdminError(reason, "No se pudo enviar la accion al agente."))
    } finally {
      setServiceBusy("")
    }
  }

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Infraestructura</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Servidores/Nodos</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Nodos reales conectados por EHPanel Agent. Para alta nueva se genera un token y el agente registra el hostname definitivo.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowEnrollment(true)} size="sm">
            <Server className="h-4 w-4" />
            Registrar nodo
          </Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Nodos registrados" value={String(nodes.length)} detail={isLoading ? "Sincronizando..." : `${onlineNodes.length} online`} />
        <AdminMetric label="Tipos de agente" value={String(new Set(nodes.map((node) => node.agent_type)).size)} detail="web, radio, video o srt" />
        <AdminMetric label="Carga promedio" value={avgLoad === null ? "N/D" : `${avgLoad}%`} detail="Desde telemetry.report" />
        <AdminMetric label="Heartbeat" value={String(nodes.length - staleNodes.length)} detail={staleNodes.length ? `${staleNodes.length} sin respuesta` : "Sin stale nodes"} />
      </section>

      <section className="grid gap-4 2xl:grid-cols-[1fr_420px]">
        <div className="eh-card overflow-hidden">
          {error ? <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
          {message ? <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">{message}</div> : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <label className="flex h-9 w-[380px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              <input
                className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar hostname, IP, sistema..."
                value={search}
              />
            </label>
            <div className="flex gap-2">
              <Button disabled={isLoading} onClick={loadNodes} size="sm" variant="outline">Actualizar</Button>
              <Button onClick={() => setSearch("web-01.ehclouding.com")} size="sm" variant="outline">web-01</Button>
            </div>
          </div>

          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {["Hostname", "IP publica", "Sistema", "Tipo", "Carga", "Estado", "Agente", "Acciones"].map((column) => (
                  <th className="px-4 py-2 font-bold" key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredNodes.map((node) => (
                <tr className={cn("hover:bg-slate-50", selectedNode?.id === node.id && "bg-blue-50/60")} key={node.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{node.hostname}</td>
                  <td className="px-4 py-3 font-mono text-xs">{node.public_ip || "N/D"}</td>
                  <td className="px-4 py-3">{node.os_name || "N/D"}</td>
                  <td className="px-4 py-3">{agentTypeLabel(node.agent_type)}</td>
                  <td className="px-4 py-3">{nodeLoadLabelReal(node)}</td>
                  <td className="px-4 py-3"><AdminStatusBadge status={nodeStatusLabel(node)} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{node.agent_version || "Sin version"} - {node.arch || "arch N/D"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        onClick={() => {
                          setSelectedNode(node)
                          setDetailNode(node)
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <Eye className="h-4 w-4" />Ver
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredNodes.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={8}>
                    {nodes.length === 0 ? "No hay nodos registrados todavia." : "No hay nodos con ese filtro."}
                  </td>
                </tr>
              ) : null}
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={8}>Cargando nodos reales...</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <AdminNodeDetailPanel
          events={events}
          isLoading={isDetailLoading}
          jobs={jobs}
          node={selectedNode}
          onServiceAction={sendServiceAction}
          serviceBusy={serviceBusy}
        />
      </section>

      {showEnrollment ? (
        <AdminEnrollmentModal
          onClose={() => setShowEnrollment(false)}
          onCreated={(token) => {
            setMessage(`Token creado para ${token.hostname}. Instala o reinicia el agente para que aparezca online.`)
            loadNodes()
          }}
        />
      ) : null}
      {detailNode ? (
        <AdminNodeDetailModal
          events={selectedNode?.id === detailNode.id ? events : []}
          jobs={selectedNode?.id === detailNode.id ? jobs : []}
          node={detailNode}
          onClose={() => setDetailNode(null)}
        />
      ) : null}
    </div>
  )
}

function AdminNodeDetailPanel({
  events,
  isLoading,
  jobs,
  node,
  onServiceAction,
  serviceBusy,
}: {
  events: AdminAgentEvent[]
  isLoading: boolean
  jobs: AdminAgentJob[]
  node: AdminNode | null
  onServiceAction: (service: string, action: string) => void
  serviceBusy: string
}) {
  const [service, setService] = useState("lsws")
  const [action, setAction] = useState("restart")
  const serviceOptions = node ? nodeServiceOptions(node) : []

  useEffect(() => {
    if (serviceOptions.length && !serviceOptions.includes(service)) {
      setService(serviceOptions[0])
    }
  }, [node?.id])

  if (!node) {
    return (
      <aside className="eh-card p-4">
        <div className="eh-kicker">Detalle del nodo</div>
        <p className="mt-2 text-sm font-semibold text-slate-500">Selecciona un nodo para ver telemetria, eventos y jobs.</p>
      </aside>
    )
  }

  const services = nodeServices(node)
  const telemetry = [
    ["CPU", nodeLoadLabelReal(node)],
    ["vCPU / hilos", cpuTopologyLabel(node)],
    ["RAM", ramLabel(node)],
    ["Disco", diskLabel(node)],
    ["Load", textTelemetry(node, ["load_1m", "load"])],
  ]

  return (
    <aside className="space-y-4">
      <div className="eh-card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="eh-kicker">Nodo seleccionado</div>
              <h2 className="mt-1 truncate text-lg font-bold text-slate-950">{node.hostname}</h2>
              <p className="mt-1 text-xs text-slate-500">{node.public_ip || "IP N/D"} - {node.os_name || "SO N/D"}</p>
            </div>
            <AdminStatusBadge status={nodeStatusLabel(node)} />
          </div>
        </div>
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-2">
            <InfoBox label="Agente" value={node.agent_version || "Sin version"} />
            <InfoBox label="Arquitectura" value={node.arch || "N/D"} />
            <InfoBox label="Tipo" value={agentTypeLabel(node.agent_type)} />
            <InfoBox label="Heartbeat" value={lastSeenLabel(node)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {telemetry.map(([label, value]) => <InfoBox key={label} label={label} value={value} />)}
          </div>
          <div>
            <div className="mb-2 text-sm font-bold text-slate-900">Servicios reportados</div>
            <div className="flex flex-wrap gap-2">
              {services.length ? services.map((item) => (
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700" key={item}>{item}</span>
              )) : <span className="text-sm font-semibold text-slate-500">Sin capabilities.report todavia.</span>}
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 text-sm font-bold text-slate-900">Accion de servicio</div>
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <select className="h-9 rounded-md border border-slate-200 px-3 text-sm outline-none" onChange={(event) => setService(event.target.value)} value={service}>
                {serviceOptions.map((item) => (
                  <option key={item} value={item}>{serviceLabel(item)}</option>
                ))}
              </select>
              <select className="h-9 rounded-md border border-slate-200 px-3 text-sm outline-none" onChange={(event) => setAction(event.target.value)} value={action}>
                <option value="restart">restart</option>
                <option value="reload">reload</option>
                <option value="start">start</option>
                <option value="stop">stop</option>
                <option value="status">status</option>
              </select>
              <Button disabled={!service || !action || Boolean(serviceBusy)} onClick={() => onServiceAction(service, action)} size="sm">
                {serviceBusy ? "Enviando" : "Enviar"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="eh-card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-bold text-slate-900">Eventos recientes</div>
        </div>
        <div className="divide-y divide-slate-100">
          {isLoading ? <div className="px-4 py-4 text-sm font-semibold text-slate-500">Cargando eventos...</div> : null}
          {!isLoading && events.length === 0 ? <div className="px-4 py-4 text-sm font-semibold text-slate-500">Sin eventos para este nodo.</div> : null}
          {events.map((event) => (
            <div className="px-4 py-3" key={event.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900">{event.msg_type}</span>
                <span className="text-xs text-slate-500">{formatDateTime(event.created_at)}</span>
              </div>
              <p className="mt-1 truncate text-xs text-slate-500">{eventSummary(event)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="eh-card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-bold text-slate-900">Jobs recientes</div>
        </div>
        <div className="divide-y divide-slate-100">
          {!isLoading && jobs.length === 0 ? <div className="px-4 py-4 text-sm font-semibold text-slate-500">Sin jobs para este nodo.</div> : null}
          {jobs.map((job) => (
            <div className="px-4 py-3" key={job.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900">{jobTypeLabel(job.job_type)}</span>
                <AdminStatusBadge status={jobStatusLabel(job.status)} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(job.queued_at)} - {job.error_detail || jobAccountLabel(job)}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

function AdminNodeDetailModal({
  events,
  jobs,
  node,
  onClose,
}: {
  events: AdminAgentEvent[]
  jobs: AdminAgentJob[]
  node: AdminNode
  onClose: () => void
}) {
  const cpu = nodeTelemetryNumber(node, ["cpu_pct", "cpu_percent", "load_pct"])
  const ramPct = nodeUsagePercent(node, ["ram_used_mb", "memory_used_mb"], ["ram_total_mb", "memory_total_mb"], ["ram_pct", "memory_pct"])
  const diskPct = nodeUsagePercent(node, ["disk_used_gb"], ["disk_total_gb"], ["disk_pct"])
  const inbound = nodeTelemetryNumber(node, ["traffic_in_mb", "network_rx_mb", "rx_mb", "bytes_recv_mb"])
  const outbound = nodeTelemetryNumber(node, ["traffic_out_mb", "network_tx_mb", "tx_mb", "bytes_sent_mb"])
  const charts = [
    { label: "CPU", detail: cpu === null ? "N/D" : `${cpu}%`, values: nodeSeries(node, ["cpu_history", "cpu_pct_history"], cpu), tone: "blue" },
    { label: "Memoria", detail: ramPct === null ? ramLabel(node) : `${ramPct}%`, values: nodeSeries(node, ["ram_history", "memory_history"], ramPct), tone: "emerald" },
    { label: "Disco", detail: diskPct === null ? diskLabel(node) : `${diskPct}%`, values: nodeSeries(node, ["disk_history", "disk_pct_history"], diskPct), tone: "amber" },
    { label: "Trafico", detail: trafficLabel(inbound, outbound), values: nodeSeries(node, ["traffic_history", "network_history"], inbound ?? outbound), tone: "violet" },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="flex max-h-[92vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="eh-kicker">Detalle del servidor</div>
            <h3 className="mt-1 truncate text-xl font-bold text-slate-950">{node.hostname}</h3>
            <p className="mt-1 text-sm text-slate-500">{node.public_ip || "IP N/D"} - {node.os_name || "SO N/D"} - {agentTypeLabel(node.agent_type)}</p>
          </div>
          <div className="flex items-center gap-2">
            <AdminStatusBadge status={nodeStatusLabel(node)} />
            <button className="rounded-md px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          <section className="grid gap-3 md:grid-cols-4">
            <InfoBox label="Heartbeat" value={lastSeenLabel(node)} />
            <InfoBox label="Agente" value={node.agent_version || "Sin version"} />
            <InfoBox label="Arquitectura" value={node.arch || "N/D"} />
            <InfoBox label="CPU" value={cpuTopologyLabel(node)} />
            <InfoBox label="Load" value={textTelemetry(node, ["load_1m", "load"])} />
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-4">
            {charts.map((chart) => (
              <AdminNodeLineChart detail={chart.detail} key={chart.label} label={chart.label} tone={chart.tone} values={chart.values} />
            ))}
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">Consumo de recursos</div>
                  <p className="mt-1 text-xs text-slate-500">Ultima telemetria reportada por el agente.</p>
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{formatDateTime(node.updated_at)}</span>
              </div>
              <div className="space-y-3">
                <UsageBar label="CPU" value={cpu} valueLabel={cpu === null ? "N/D" : `${cpu}%`} />
                <UsageBar label="vCPU / hilos" value={null} valueLabel={cpuTopologyLabel(node)} />
                <UsageBar label="Memoria" value={ramPct} valueLabel={ramLabel(node)} />
                <UsageBar label="Disco" value={diskPct} valueLabel={diskLabel(node)} />
                <UsageBar label="Trafico IN/OUT" value={null} valueLabel={trafficLabel(inbound, outbound)} />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <div className="text-sm font-bold text-slate-900">Servicios disponibles</div>
              <p className="mt-1 text-xs text-slate-500">Estos servicios alimentan el selector de acciones del panel derecho.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {nodeServiceOptions(node).map((service) => (
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700" key={service}>{serviceLabel(service)}</span>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-900">Eventos recientes</div>
              <div className="divide-y divide-slate-100">
                {events.length === 0 ? <div className="px-4 py-4 text-sm font-semibold text-slate-500">Sin eventos cargados para este nodo.</div> : null}
                {events.slice(0, 6).map((event) => (
                  <div className="px-4 py-3" key={event.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">{event.msg_type}</span>
                      <span className="text-xs text-slate-500">{formatDateTime(event.created_at)}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">{eventSummary(event)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-900">Jobs recientes</div>
              <div className="divide-y divide-slate-100">
                {jobs.length === 0 ? <div className="px-4 py-4 text-sm font-semibold text-slate-500">Sin jobs cargados para este nodo.</div> : null}
                {jobs.slice(0, 6).map((job) => (
                  <div className="px-4 py-3" key={job.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">{jobTypeLabel(job.job_type)}</span>
                      <AdminStatusBadge status={jobStatusLabel(job.status)} />
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">{job.error_detail || jobAccountLabel(job)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function AdminEnrollmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: (token: AdminEnrollmentToken) => void }) {
  const [hostname, setHostname] = useState("web-01.ehclouding.com")
  const [agentType, setAgentType] = useState("web")
  const [ttl, setTtl] = useState(24)
  const [token, setToken] = useState<AdminEnrollmentToken | null>(null)
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const createToken = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError("")
    try {
      const created = await adminApi.createEnrollmentToken({
        agent_type: agentType,
        expires_at: new Date(Date.now() + ttl * 60 * 60 * 1000).toISOString(),
        hostname,
      })
      setToken(created)
      onCreated(created)
    } catch (reason) {
      setError(readAdminError(reason, "No se pudo crear el token de enrollment."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[780px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Registrar nodo por enrollment</h3>
            <p className="mt-1 text-sm text-slate-500">Usar hostnames definitivos bajo ehclouding.com.</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>
        <form onSubmit={(event) => void createToken(event)}>
          <div className="space-y-4 p-5">
            {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
            <div className="grid gap-3 md:grid-cols-[1fr_150px_130px]">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Hostname</span>
                <input className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none" onChange={(event) => setHostname(event.target.value)} required value={hostname} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Tipo</span>
                <select className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none" onChange={(event) => setAgentType(event.target.value)} value={agentType}>
                  <option value="web">web</option>
                  <option value="radio">radio</option>
                  <option value="video">video</option>
                  <option value="srt">srt</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">TTL horas</span>
                <input className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none" min={1} onChange={(event) => setTtl(Number(event.target.value))} type="number" value={ttl} />
              </label>
            </div>
            {token ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <div className="text-sm font-bold text-emerald-900">Token generado</div>
                <div className="mt-2 break-all rounded-md bg-white p-2 font-mono text-xs text-slate-800">{token.token}</div>
                <p className="mt-2 text-xs font-semibold text-emerald-800">Configura el agente con este token y endpoint WSS del panel. Al conectarse, el nodo aparecera como {token.hostname}.</p>
              </div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            <Button onClick={onClose} size="sm" type="button" variant="outline">Cerrar</Button>
            <Button disabled={isSaving || !hostname.endsWith(".ehclouding.com")} size="sm" type="submit">
              {isSaving ? "Generando..." : "Generar token"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-bold uppercase text-slate-400">{label}</div>
      <div className="mt-1 truncate text-sm font-bold text-slate-800">{value}</div>
    </div>
  )
}

function AdminNodeLineChart({ detail, label, tone, values }: { detail: string; label: string; tone: string; values: number[] }) {
  const color = tone === "emerald" ? "#059669" : tone === "amber" ? "#d97706" : tone === "violet" ? "#7c3aed" : "#2563eb"
  const points = chartPoints(values)
  const areaPoints = points ? `0,70 ${points} 180,70` : ""

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
          <div className="mt-1 text-xl font-bold text-slate-950">{detail}</div>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">Linea</span>
      </div>
      <svg aria-label={`${label} historico`} className="mt-4 h-[86px] w-full" preserveAspectRatio="none" role="img" viewBox="0 0 180 70">
        <line stroke="#e2e8f0" strokeWidth="1" x1="0" x2="180" y1="18" y2="18" />
        <line stroke="#e2e8f0" strokeWidth="1" x1="0" x2="180" y1="46" y2="46" />
        {points ? <polygon fill={color} opacity="0.08" points={areaPoints} /> : null}
        {points ? <polyline fill="none" points={points} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" /> : null}
      </svg>
      <div className="mt-2 text-xs font-semibold text-slate-500">{values.length > 1 ? `${values.length} muestras` : "Ultima muestra disponible"}</div>
    </div>
  )
}

function UsageBar({ label, value, valueLabel }: { label: string; value: number | null; valueLabel: string }) {
  const width = value === null ? 0 : Math.min(100, Math.max(0, value))
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="font-bold text-slate-700">{label}</span>
        <span className="font-semibold text-slate-500">{valueLabel}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function averageNodeLoadReal(nodes: AdminNode[]) {
  const values = nodes.map((node) => nodeTelemetryNumber(node, ["cpu_pct", "cpu_percent", "load_pct"])).filter((value): value is number => value !== null)
  if (!values.length) return null
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length)
}

function nodeLoadLabelReal(node: AdminNode) {
  const cpu = nodeTelemetryNumber(node, ["cpu_pct", "cpu_percent", "load_pct"])
  return cpu === null ? "N/D" : `${cpu}%`
}

function cpuTopologyLabel(node: AdminNode) {
  const threads = nodeTelemetryNumber(node, ["cpu_threads", "cpu_count", "vcpus", "cpu_cores"])
  const physicalCores = nodeTelemetryNumber(node, ["cpu_physical_cores", "physical_cores"])
  const sockets = nodeTelemetryNumber(node, ["cpu_sockets", "sockets"])
  if (threads === null && physicalCores === null) return "N/D"
  if (physicalCores !== null && threads !== null && physicalCores > 0 && physicalCores !== threads) {
    const socketLabel = sockets !== null && sockets > 1 ? ` / ${sockets} CPU` : ""
    return `${physicalCores} cores / ${threads} hilos${socketLabel}`
  }
  if (threads !== null) return `${threads} vCPU`
  return `${physicalCores} cores`
}

function ramLabel(node: AdminNode) {
  const used = nodeTelemetryNumber(node, ["ram_used_mb", "memory_used_mb"])
  const total = nodeTelemetryNumber(node, ["ram_total_mb", "memory_total_mb"])
  if (used === null && total === null) return "N/D"
  if (used !== null && total !== null) return `${used}/${total} MB`
  return `${used ?? total} MB`
}

function diskLabel(node: AdminNode) {
  const used = nodeTelemetryNumber(node, ["disk_used_gb"])
  const total = nodeTelemetryNumber(node, ["disk_total_gb"])
  if (used === null && total === null) return "N/D"
  if (used !== null && total !== null) return `${used}/${total} GB`
  return `${used ?? total} GB`
}

function textTelemetry(node: AdminNode, keys: string[]) {
  const value = nodeTelemetryValue(node, keys)
  if (typeof value === "number") return String(Math.round(value * 100) / 100)
  if (typeof value === "string" && value) return value
  return "N/D"
}

function nodeTelemetryNumber(node: AdminNode, keys: string[]) {
  const value = nodeTelemetryValue(node, keys)
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null
}

function nodeTelemetryValue(node: AdminNode, keys: string[]) {
  const telemetry = node.last_telemetry as Record<string, unknown>
  const system = typeof telemetry.system === "object" && telemetry.system !== null ? telemetry.system as Record<string, unknown> : {}
  for (const source of [telemetry, system]) {
    for (const key of keys) {
      const value = source[key]
      if (typeof value === "number" || typeof value === "string") return value
    }
  }
  return null
}

function nodeUsagePercent(node: AdminNode, usedKeys: string[], totalKeys: string[], percentKeys: string[]) {
  const percent = nodeTelemetryNumber(node, percentKeys)
  if (percent !== null) return Math.min(100, Math.max(0, percent))
  const used = nodeTelemetryNumber(node, usedKeys)
  const total = nodeTelemetryNumber(node, totalKeys)
  if (used === null || total === null || total <= 0) return null
  return Math.round((used / total) * 100)
}

function nodeTelemetryArray(node: AdminNode, keys: string[]) {
  const telemetry = node.last_telemetry as Record<string, unknown>
  const system = typeof telemetry.system === "object" && telemetry.system !== null ? telemetry.system as Record<string, unknown> : {}
  for (const source of [telemetry, system]) {
    for (const key of keys) {
      const value = source[key]
      if (Array.isArray(value)) {
        const numbers = value
          .map((item) => {
            if (typeof item === "number") return item
            if (typeof item === "object" && item !== null && "value" in item) {
              const nested = (item as { value?: unknown }).value
              return typeof nested === "number" ? nested : null
            }
            return null
          })
          .filter((item): item is number => item !== null && Number.isFinite(item))
        if (numbers.length) return numbers
      }
    }
  }
  return []
}

function nodeSeries(node: AdminNode, keys: string[], fallback: number | null) {
  const series = nodeTelemetryArray(node, keys)
  if (series.length) return series.slice(-24)
  return fallback === null ? [] : [fallback]
}

function chartPoints(values: number[]) {
  if (!values.length) return ""
  const normalized = values.length === 1 ? [values[0], values[0]] : values
  const min = Math.min(...normalized)
  const max = Math.max(...normalized)
  const span = max - min || 1
  return normalized
    .map((value, index) => {
      const x = normalized.length === 1 ? 90 : (index / (normalized.length - 1)) * 180
      const y = 62 - ((value - min) / span) * 54
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`
    })
    .join(" ")
}

function nodeServices(node: AdminNode) {
  const raw = node.capabilities.services
  if (!Array.isArray(raw)) return []
  return raw
    .map((service) => {
      if (typeof service === "string") return service
      if (typeof service === "object" && service !== null && "name" in service) {
        const name = (service as { name?: unknown }).name
        return typeof name === "string" ? name : ""
      }
      return ""
    })
    .filter(Boolean)
    .slice(0, 24)
}

function nodeServiceOptions(node: AdminNode) {
  const reported = nodeServices(node)
  const fallback = node.agent_type === "web"
    ? ["lshttpd", "php-fpm", "mariadb", "redis", "valkey", "postfix", "dovecot", "ehpanel-agent"]
    : ["lshttpd", "redis", "valkey", "ehpanel-agent"]
  return Array.from(new Set((reported.length ? reported : fallback).map((item) => item.trim()).filter(Boolean))).slice(0, 32)
}

function serviceLabel(service: string) {
  const labels: Record<string, string> = {
    "ehpanel-agent": "EHPanel Agent",
    "lshttpd": "OpenLiteSpeed",
    "lsws": "OpenLiteSpeed",
    "mariadb": "MariaDB",
    "nginx": "Nginx",
    "php-fpm": "PHP-FPM",
    "postfix": "Postfix",
    "redis": "Redis",
    "valkey": "Valkey",
    "dovecot": "Dovecot",
  }
  return labels[service.toLowerCase()] ?? service
}

function trafficLabel(inbound: number | null, outbound: number | null) {
  if (inbound === null && outbound === null) return "N/D"
  const input = inbound === null ? "IN N/D" : `IN ${inbound} MB`
  const output = outbound === null ? "OUT N/D" : `OUT ${outbound} MB`
  return `${input} / ${output}`
}

function lastSeenLabel(node: AdminNode) {
  if (node.last_seen_age_seconds !== null && node.last_seen_age_seconds !== undefined) {
    if (node.last_seen_age_seconds < 60) return `${node.last_seen_age_seconds}s`
    return `${Math.round(node.last_seen_age_seconds / 60)} min`
  }
  return node.last_seen_at ? formatDateTime(node.last_seen_at) : "Sin heartbeat"
}

function eventSummary(event: AdminAgentEvent) {
  const keys = ["hostname", "node_state", "agent_version", "job_id", "error_code", "detail"]
  for (const key of keys) {
    const value = event.payload[key]
    if (typeof value === "string" && value) return `${key}: ${value}`
  }
  return event.msg_id || "Evento recibido del agente"
}

function AdminServersPage() {
  const [nodes, setNodes] = useState<AdminNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedServer, setSelectedServer] = useState<AdminNode | null>(null)
  const [modalMode, setModalMode] = useState<"create" | "view" | "edit" | "delete" | null>(null)

  useEffect(() => {
    adminApi
      .nodes()
      .then((page) => {
        setNodes(page.results)
        setError("")
      })
      .catch((reason) => setError(readAdminError(reason, "No se pudieron cargar los nodos.")))
      .finally(() => setIsLoading(false))
  }, [])

  const openModal = (server: AdminNode, mode: "view" | "edit" | "delete") => {
    setSelectedServer(server)
    setModalMode(mode)
  }

  const onlineNodes = nodes.filter((node) => node.effective_state === "online" || node.state === "online")
  const staleNodes = nodes.filter((node) => node.is_stale)
  const avgLoad = averageNodeLoad(nodes)
  const agentVersions = new Set(nodes.map((node) => node.agent_version).filter(Boolean)).size

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Infraestructura</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Servidores/Nodos</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Inventario base de nodos administrados por EHPanel Web con informacion de conexion, ubicacion y estado operativo.
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              setSelectedServer(null)
              setModalMode("create")
            }}
            disabled
            size="sm"
          >
            <Server className="h-4 w-4" />
            Nuevo nodo
          </Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Nodos registrados" value={String(nodes.length)} detail={isLoading ? "Sincronizando..." : `${onlineNodes.length} online`} />
        <AdminMetric label="Tipos de agente" value={String(new Set(nodes.map((node) => node.agent_type)).size)} detail="Desde backend" />
        <AdminMetric label="Carga promedio" value={avgLoad === null ? "N/D" : `${avgLoad}%`} detail="Telemetry reportada" />
        <AdminMetric label="Agentes" value={String(agentVersions)} detail={staleNodes.length ? `${staleNodes.length} sin heartbeat` : "Heartbeat vigente"} />
      </section>

      <div className="eh-card overflow-hidden">
        {error ? <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex h-9 w-[380px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            Buscar hostname, IP, data center...
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">Estado</Button>
            <Button size="sm" variant="outline">Data center</Button>
            <Button size="sm" variant="outline">Rol</Button>
          </div>
        </div>

        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["Hostname / nombre", "IP", "Data center", "Rol", "Carga", "Estado", "Agente", "Acciones"].map((column) => (
                <th className="px-4 py-2 font-bold" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {nodes.map((server) => (
              <tr className="hover:bg-slate-50" key={server.id}>
                <td className="px-4 py-3 font-semibold text-slate-900">{server.hostname}</td>
                <td className="px-4 py-3 font-mono text-xs">{server.public_ip || "N/D"}</td>
                <td className="px-4 py-3">{server.os_name || "N/D"}</td>
                <td className="px-4 py-3">{agentTypeLabel(server.agent_type)}</td>
                <td className="px-4 py-3">{nodeLoadLabel(server)}</td>
                <td className="px-4 py-3"><AdminStatusBadge status={nodeStatusLabel(server)} /></td>
                <td className="px-4 py-3 text-xs text-slate-500">{server.agent_version || "Sin version"} Â· {server.arch || "arch N/D"}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button onClick={() => openModal(server, "view")} size="sm" variant="outline"><Eye className="h-4 w-4" />Ver</Button>
                    <Button disabled onClick={() => openModal(server, "edit")} size="sm" variant="outline"><Edit3 className="h-4 w-4" />Editar</Button>
                    <Button className="text-red-600 hover:text-red-700" disabled onClick={() => openModal(server, "delete")} size="sm" variant="outline"><Trash2 className="h-4 w-4" />Eliminar</Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && nodes.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={8}>No hay nodos registrados todavia.</td>
              </tr>
            ) : null}
            {isLoading ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={8}>Cargando nodos reales...</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {modalMode ? (
        <AdminServerModal mode={modalMode} onClose={() => setModalMode(null)} server={selectedServer} />
      ) : null}
    </div>
  )
}

void AdminServersPage

function AdminMetric({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="eh-card p-4">
      <div className="eh-kicker">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{detail}</div>
    </div>
  )
}

function AdminStatusBadge({ status }: { status: string }) {
  const tone =
    status === "Online" || status === "Activo" || status === "Completada"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Offline" || status === "Fallido" || status === "Error"
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-700"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{status}</span>
}

function readAdminError(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback
}

function agentTypeLabel(value: string) {
  const labels: Record<string, string> = {
    backup: "Backups",
    mail: "Correo",
    web: "Web hosting",
  }
  return labels[value] ?? value.toUpperCase() ?? "N/D"
}

function nodeStatusLabel(node: AdminNode) {
  const state = node.effective_state || node.state
  if (state === "online") return "Online"
  if (state === "offline") return "Offline"
  if (state === "pending") return "Pendiente"
  if (node.is_stale) return "Sin heartbeat"
  return state || "N/D"
}

function nodeLoadLabel(node: AdminNode) {
  const cpu = numericTelemetry(node, ["cpu_pct", "cpu_percent", "load_pct"])
  return cpu === null ? "N/D" : `${cpu}%`
}

function averageNodeLoad(nodes: AdminNode[]) {
  const values = nodes.map((node) => numericTelemetry(node, ["cpu_pct", "cpu_percent", "load_pct"])).filter((value): value is number => value !== null)
  if (!values.length) return null
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length)
}

function numericTelemetry(node: AdminNode, keys: string[]) {
  for (const key of keys) {
    const value = node.last_telemetry[key]
    if (typeof value === "number" && Number.isFinite(value)) return Math.round(value)
  }
  return null
}

function jobStatusLabel(status: AdminAgentJob["status"]) {
  const labels: Record<AdminAgentJob["status"], string> = {
    canceled: "Cancelada",
    expired: "Expirada",
    failed: "Fallida",
    queued: "En cola",
    running: "En progreso",
    sent: "Enviada",
    success: "Completada",
  }
  return labels[status]
}

function jobProgress(status: AdminAgentJob["status"]) {
  if (status === "success") return 100
  if (status === "running") return 65
  if (status === "sent") return 35
  if (status === "queued") return 10
  return 0
}

function jobTypeLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function jobModuleLabel(value: string) {
  if (value.includes("migration") || value.includes("migrate")) return "Migraciones"
  if (value.includes("mail")) return "Correo"
  if (value.includes("database")) return "Bases de datos"
  if (value.includes("dns")) return "DNS"
  if (value.includes("ssl")) return "SSL"
  if (value.includes("backup")) return "Backups"
  if (value.includes("file")) return "Archivos"
  if (value.includes("app") || value.includes("wordpress") || value.includes("node") || value.includes("python") || value.includes("laravel")) return "Aplicaciones"
  if (value.includes("security") || value.includes("waf")) return "Seguridad"
  if (value.includes("service") || value.includes("software")) return "Sistema"
  return "Provisionamiento"
}

function jobAccountLabel(job: AdminAgentJob) {
  const payload = job.payload
  const candidates = [payload.domain, payload.primary_domain, payload.account, payload.username, payload.email, payload.path]
  const value = candidates.find((item) => typeof item === "string" && item.length > 0)
  return typeof value === "string" ? value : "Sistema"
}

function formatDateTime(value: string | null) {
  if (!value) return "N/D"
  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value))
}

function formatTime(value: string | null) {
  if (!value) return "--:--"
  return new Intl.DateTimeFormat("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function AdminServerModal({
  mode,
  onClose,
  server,
}: {
  mode: "create" | "view" | "edit" | "delete"
  onClose: () => void
  server: AdminNode | null
}) {
  const title =
    mode === "create"
      ? "Nuevo servidor/nodo"
      : mode === "view"
        ? "Ver servidor/nodo"
        : mode === "edit"
          ? "Editar servidor/nodo"
          : "Eliminar servidor/nodo"
  const node = server ?? {
    agent_type: "",
    arch: "",
    capabilities: {},
    created_at: "",
    effective_state: "",
    hostname: "",
    id: "",
    is_stale: false,
    last_seen_age_seconds: null,
    last_seen_at: null,
    last_telemetry: {},
    os_name: "",
    public_ip: "",
    status: "",
    state: "",
    agent_version: "",
    updated_at: "",
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[720px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{node.hostname || "Registro nuevo"}</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>

        {mode === "delete" ? (
          <div className="p-5">
            <div className="rounded-md border border-red-100 bg-red-50 p-4 text-sm text-red-900">
              <p className="font-bold">Confirmar eliminacion</p>
              <p className="mt-1">Esta accion eliminaria el nodo del inventario admin. En produccion debe validar que no tenga cuentas activas.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <AdminField label="Hostname / nombre" readonly={mode === "view"} value={node.hostname} />
            <AdminField label="IP principal" readonly={mode === "view"} value={node.public_ip || "N/D"} />
            <AdminField label="Sistema operativo" readonly={mode === "view"} value={node.os_name || "N/D"} />
            <AdminField label="Rol" readonly={mode === "view"} value={agentTypeLabel(node.agent_type)} />
            <AdminField label="Estado" readonly={mode === "view"} value={nodeStatusLabel(node)} />
            <AdminField label="Agente" readonly={mode === "view"} value={node.agent_version || "Sin version"} />
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">Cancelar</Button>
          <Button className={mode === "delete" ? "bg-red-600 hover:bg-red-700" : ""} onClick={onClose} size="sm">
            {mode === "delete" ? "Eliminar" : mode === "edit" || mode === "create" ? "Guardar cambios" : "Cerrar"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function AdminField({ label, readonly = true, value }: { label: string; readonly?: boolean; value: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      <input
        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500 disabled:bg-slate-50"
        defaultValue={value}
        disabled={readonly}
      />
    </label>
  )
}

function AdminSystemServicesPage() {
  const [nodes, setNodes] = useState<AdminNode[]>([])
  const [selected, setSelected] = useState<{ node: AdminNode; service: SystemServiceRow } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [serviceBusy, setServiceBusy] = useState("")

  const loadServices = () => {
    setIsLoading(true)
    setMessage("")
    adminApi.nodes()
      .then((page) => setNodes(page.results))
      .catch((error: Error) => setMessage(error.message || "No se pudieron cargar los servicios del sistema."))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadServices()
  }, [])

  const serviceNodes = nodes.map((node) => ({ node, services: systemServiceRows(node) }))
  const allServices = serviceNodes.flatMap((item) => item.services)
  const activeCount = allServices.filter((service) => service.status === "Activo").length
  const problemCount = allServices.filter((service) => service.status === "Problemas").length
  const inactiveCount = allServices.filter((service) => service.status === "Inactivo").length

  const sendServiceAction = async (node: AdminNode, service: SystemServiceRow, action: string) => {
    setServiceBusy(`${node.id}:${service.name}:${action}`)
    setMessage("")
    try {
      await adminApi.serviceAction(node.id, { action, service: service.serviceKey || service.name })
      setMessage(`Orden ${action} enviada a ${service.name} en ${node.hostname}.`)
      loadServices()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo enviar la accion al agente.")
    } finally {
      setServiceBusy("")
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className={cn("rounded-lg border px-4 py-3 text-sm font-semibold", message.includes("No se") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
          {message}
        </div>
      ) : null}
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Infraestructura</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Servicios del sistema</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Vista por nodo de los servicios activos, detenidos o con problemas. DiseÃ±ado para revisar salud operativa sin saturar la pantalla.
              </p>
            </div>
          </div>
          <Button disabled={isLoading} onClick={loadServices} size="sm" variant="outline">{isLoading ? "Actualizando" : "Actualizar estado"}</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Servicios activos" value={activeCount.toLocaleString()} detail="Reportados por agentes" />
        <AdminMetric label="Con problemas" value={problemCount.toLocaleString()} detail="Estado failed/error/warning" />
        <AdminMetric label="Inactivos" value={inactiveCount.toLocaleString()} detail="Detenidos o deshabilitados" />
        <AdminMetric label="Nodos revisados" value={nodes.length.toLocaleString()} detail="Fuente real: agentes" />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {serviceNodes.map(({ node, services }) => (
          <div className="eh-card overflow-hidden" key={node.id}>
            <div className="border-b border-slate-200 bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-slate-900">{node.hostname}</h3>
                  <p className="mt-1 font-mono text-xs text-slate-500">{node.public_ip || node.os_name || "IP N/D"}</p>
                </div>
                <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{systemServicesSummary(services)}</span>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {services.map((service) => (
                <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3" key={`${node.hostname}-${service.name}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-slate-800">{service.name}</span>
                      <ServiceStatusBadge status={service.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{service.detail} - {service.port}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div className="font-bold text-slate-700">{service.uptime}</div>
                    <button className="mt-1 font-bold text-blue-700" onClick={() => setSelected({ node, service })} type="button">Ver</button>
                  </div>
                </div>
              ))}
              {!isLoading && services.length === 0 ? (
                <div className="px-4 py-4 text-sm font-semibold text-slate-500">El agente no ha reportado servicios para este nodo.</div>
              ) : null}
              {isLoading ? <div className="px-4 py-4 text-sm font-semibold text-slate-500">Cargando servicios...</div> : null}
            </div>
          </div>
        ))}
        {!isLoading && serviceNodes.length === 0 ? (
          <div className="eh-card p-4 text-sm font-semibold text-slate-500">No hay nodos registrados para mostrar servicios.</div>
        ) : null}
      </section>
      {selected ? (
        <SystemServiceDetailModal
          busy={serviceBusy.startsWith(`${selected.node.id}:${selected.service.name}`)}
          node={selected.node}
          onAction={(action) => void sendServiceAction(selected.node, selected.service, action)}
          onClose={() => setSelected(null)}
          service={selected.service}
        />
      ) : null}
    </div>
  )
}

function ServiceStatusBadge({ status }: { status: string }) {
  const tone =
    status === "Activo"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Inactivo"
        ? "bg-slate-100 text-slate-600"
        : "bg-orange-50 text-orange-700"

  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", tone)}>{status}</span>
}

type SystemServiceRow = {
  detail: string
  name: string
  port: string
  raw: Record<string, unknown>
  serviceKey: string
  status: string
  uptime: string
}

function SystemServiceDetailModal({
  busy,
  node,
  onAction,
  onClose,
  service,
}: {
  busy: boolean
  node: AdminNode
  onAction: (action: string) => void
  onClose: () => void
  service: SystemServiceRow
}) {
  return (
    <AdminModalFrame kicker={node.hostname} onClose={onClose} title={service.name}>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <AdminStatus label="Estado" value={service.status} />
          <AdminStatus label="Uptime" value={service.uptime} />
          <AdminStatus label="Puerto" value={service.port} />
          <AdminStatus label="Nodo" value={node.public_ip || node.hostname} />
        </div>
        <div>
          <div className="mb-2 text-sm font-bold text-slate-900">Detalle reportado</div>
          <pre className="max-h-64 overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(service.raw, null, 2)}</pre>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {["status", "reload", "restart", "start", "stop"].map((action) => (
            <Button disabled={busy} key={action} onClick={() => onAction(action)} size="sm" type="button" variant={action === "stop" ? "outline" : "default"}>
              {busy ? "Enviando" : action}
            </Button>
          ))}
        </div>
      </div>
    </AdminModalFrame>
  )
}

function systemServiceRows(node: AdminNode): SystemServiceRow[] {
  const rawServices = Array.isArray(node.capabilities?.services)
    ? node.capabilities.services
    : Array.isArray(node.last_telemetry?.services)
      ? node.last_telemetry.services
      : []
  return rawServices
    .map((raw) => normalizeSystemService(raw))
    .filter((service): service is SystemServiceRow => Boolean(service))
}

function normalizeSystemService(raw: unknown): SystemServiceRow | null {
  if (typeof raw === "string") {
    return {
      detail: "Servicio reportado por el agente",
      name: serviceLabel(raw),
      port: "N/D",
      raw: { name: raw },
      serviceKey: raw,
      status: "Activo",
      uptime: "Reportado",
    }
  }
  if (!raw || typeof raw !== "object") return null
  const item = raw as Record<string, unknown>
  const nameValue = textFromUnknown(item.name) || textFromUnknown(item.service) || textFromUnknown(item.unit)
  if (!nameValue) return null
  const status = systemServiceStatus(item)
  return {
    detail: textFromUnknown(item.detail) || textFromUnknown(item.description) || textFromUnknown(item.message) || "Servicio del sistema",
    name: serviceLabel(nameValue),
    port: textFromUnknown(item.port) || textFromUnknown(item.ports) || textFromUnknown(item.listen) || "N/D",
    raw: item,
    serviceKey: textFromUnknown(item.service) || textFromUnknown(item.name) || nameValue,
    status,
    uptime: textFromUnknown(item.uptime) || textFromUnknown(item.uptime_human) || textFromUnknown(item.active_since) || (status === "Activo" ? "Activo" : "Revisar"),
  }
}

function textFromUnknown(value: unknown) {
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  if (Array.isArray(value)) return value.join("/")
  if (typeof value === "boolean") return value ? "true" : "false"
  return ""
}

function systemServiceStatus(item: Record<string, unknown>) {
  if (typeof item.active === "boolean") return item.active ? "Activo" : "Inactivo"
  const raw = [item.status, item.process, item.state, item.enabled].map(textFromUnknown).join(" ").toLowerCase()
  if (raw.includes("failed") || raw.includes("error") || raw.includes("warning") || raw.includes("degraded")) return "Problemas"
  if (raw.includes("inactive") || raw.includes("stopped") || raw.includes("dead") || raw.includes("disabled")) return "Inactivo"
  if (raw.includes("active") || raw.includes("running") || raw.includes("ok") || raw.includes("enabled")) return "Activo"
  return raw.trim() ? "Problemas" : "Activo"
}

function systemServicesSummary(services: SystemServiceRow[]) {
  if (!services.length) return "Sin reporte"
  const active = services.filter((service) => service.status === "Activo").length
  const problems = services.filter((service) => service.status === "Problemas").length
  const inactive = services.filter((service) => service.status === "Inactivo").length
  const parts = [`${active} activos`]
  if (problems) parts.push(`${problems} problemas`)
  if (inactive) parts.push(`${inactive} inactivos`)
  return parts.join(" / ")
}

function AdminResourceStatusPage() {
  const [nodes, setNodes] = useState<AdminNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState("")

  const loadResources = () => {
    setIsLoading(true)
    setMessage("")
    adminApi.nodes()
      .then((page) => setNodes(page.results))
      .catch((error: Error) => setMessage(error.message || "No se pudo cargar el estado de recursos."))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadResources()
  }, [])

  const rows = nodes.map(resourceStatusRow)
  const cpuAverage = averageResource(rows.map((row) => row.cpu))
  const memoryAverage = averageResource(rows.map((row) => row.memory))
  const diskAverage = averageResource(rows.map((row) => row.disk))
  const bandwidthPeak = peakBandwidth(rows)

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div>
      ) : null}
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Infraestructura</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Estado de recursos</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Lectura cruda por servidor de CPU, memoria, disco y ancho de banda para operacion diaria.
              </p>
            </div>
          </div>
          <Button disabled={isLoading} onClick={loadResources} size="sm" variant="outline">{isLoading ? "Actualizando" : "Actualizar recursos"}</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="CPU promedio" value={cpuAverage === null ? "N/D" : `${cpuAverage}%`} detail={`${nodes.length} nodos registrados`} />
        <AdminMetric label="Memoria promedio" value={memoryAverage === null ? "N/D" : `${memoryAverage}%`} detail="Uso real reportado" />
        <AdminMetric label="Disco promedio" value={diskAverage === null ? "N/D" : `${diskAverage}%`} detail={`${rows.filter((row) => row.disk >= 60).length} nodos sobre 60%`} />
        <AdminMetric label="Pico ancho banda" value={bandwidthPeak.value} detail={bandwidthPeak.detail} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {rows.map((node) => (
          <div className="eh-card p-4" key={node.hostname}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{node.hostname}</h3>
                <p className="mt-1 font-mono text-xs text-slate-500">{node.ip}</p>
              </div>
              <div className="flex gap-2">
                <Button disabled size="sm" variant="outline">Procesos</Button>
                <Button disabled size="sm" variant="outline">Detalles</Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ResourceRing label="CPU" sub={node.cpuSub} value={node.cpu} />
              <ResourceRing label="Memoria" sub={node.memorySub} value={node.memory} />
              <ResourceRing label="Disco" sub={node.diskSub} value={node.disk} />
              <BandwidthBlock bandwidth={node.bandwidth} />
            </div>
          </div>
        ))}
        {!isLoading && rows.length === 0 ? (
          <div className="eh-card p-4 text-sm font-semibold text-slate-500">No hay servidores registrados para mostrar recursos.</div>
        ) : null}
        {isLoading ? <div className="eh-card p-4 text-sm font-semibold text-slate-500">Cargando recursos reales...</div> : null}
      </section>
    </div>
  )
}

type ResourceStatusRow = {
  bandwidth: { in: string; out: string; value: number }
  bandwidthInMbps: number | null
  bandwidthOutMbps: number | null
  cpu: number
  cpuSub: string
  disk: number
  diskSub: string
  hostname: string
  ip: string
  memory: number
  memorySub: string
}

function resourceStatusRow(node: AdminNode): ResourceStatusRow {
  const cpu = nodeTelemetryNumber(node, ["cpu_pct", "cpu_percent", "load_pct"])
  const memory = nodeUsagePercent(node, ["ram_used_mb", "memory_used_mb"], ["ram_total_mb", "memory_total_mb"], ["ram_pct", "memory_pct"])
  const disk = nodeUsagePercent(node, ["disk_used_gb", "disk_used_mb"], ["disk_total_gb", "disk_total_mb"], ["disk_pct", "storage_pct"])
  const bandwidthIn = nodeTelemetryNumber(node, ["bandwidth_in_mbps", "network_in_mbps", "net_in_mbps", "rx_mbps", "traffic_in_mbps"])
  const bandwidthOut = nodeTelemetryNumber(node, ["bandwidth_out_mbps", "network_out_mbps", "net_out_mbps", "tx_mbps", "traffic_out_mbps"])
  const bandwidthPct = resourceBandwidthPercent(node, bandwidthIn, bandwidthOut)
  return {
    bandwidth: {
      in: bandwidthIn === null ? "N/D" : formatMbps(bandwidthIn),
      out: bandwidthOut === null ? "N/D" : formatMbps(bandwidthOut),
      value: bandwidthPct,
    },
    bandwidthInMbps: bandwidthIn,
    bandwidthOutMbps: bandwidthOut,
    cpu: cpu ?? 0,
    cpuSub: resourceCpuSub(node),
    disk: disk ?? 0,
    diskSub: disk === null ? diskLabel(node) : `${disk}% volumen principal`,
    hostname: node.hostname,
    ip: node.public_ip || node.os_name || "IP N/D",
    memory: memory ?? 0,
    memorySub: memory === null ? ramLabel(node) : `${memory}% RAM usada`,
  }
}

function resourceCpuSub(node: AdminNode) {
  const load1 = textTelemetry(node, ["load_1m", "load1"])
  const load5 = textTelemetry(node, ["load_5m", "load5"])
  const load15 = textTelemetry(node, ["load_15m", "load15"])
  if ([load1, load5, load15].some((value) => value !== "N/D")) return `Load ${load1} / ${load5} / ${load15}`
  return `CPU ${cpuTopologyLabel(node)}`
}

function resourceBandwidthPercent(node: AdminNode, inbound: number | null, outbound: number | null) {
  const percent = nodeTelemetryNumber(node, ["bandwidth_pct", "network_pct", "traffic_pct"])
  if (percent !== null) return Math.min(100, Math.max(0, percent))
  const capacity = nodeTelemetryNumber(node, ["bandwidth_capacity_mbps", "network_capacity_mbps", "link_speed_mbps"])
  const peak = Math.max(inbound ?? 0, outbound ?? 0)
  if (capacity && capacity > 0) return Math.min(100, Math.round((peak / capacity) * 100))
  return peak ? Math.min(100, Math.max(1, Math.round(peak / 10))) : 0
}

function averageResource(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0)
  if (!valid.length) return null
  return Math.round(valid.reduce((total, value) => total + value, 0) / valid.length)
}

function peakBandwidth(rows: ResourceStatusRow[]) {
  let peak: { hostname: string; label: string; mbps: number } | null = null
  for (const row of rows) {
    const candidates = [
      { hostname: row.hostname, label: "entrada", mbps: row.bandwidthInMbps ?? 0 },
      { hostname: row.hostname, label: "salida", mbps: row.bandwidthOutMbps ?? 0 },
    ]
    for (const candidate of candidates) {
      if (!peak || candidate.mbps > peak.mbps) peak = candidate
    }
  }
  if (!peak || peak.mbps <= 0) return { detail: "Sin telemetria de red", value: "N/D" }
  return { detail: `${peak.hostname} ${peak.label}`, value: formatMbps(peak.mbps) }
}

function formatMbps(value: number) {
  if (value >= 1000) return `${Math.round((value / 1000) * 10) / 10} Gbps`
  return `${Math.round(value)} Mbps`
}

function ResourceRing({ label, sub, value }: { label: string; sub: string; value: number }) {
  const color = value >= 80 ? "#f97316" : value >= 65 ? "#0891b2" : "#2563eb"
  return (
    <div className="grid place-items-center rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
      <div className="grid h-28 w-28 place-items-center rounded-full" style={{ background: `conic-gradient(${color} ${value * 3.6}deg, #e8eef7 0deg)` }}>
        <div className="grid h-20 w-20 place-items-center rounded-full bg-white">
          <span className="text-2xl font-bold">{value}%</span>
        </div>
      </div>
      <p className="mt-3 text-sm font-bold">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  )
}

function BandwidthBlock({ bandwidth }: { bandwidth: { in: string; out: string; value: number } }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold">Ancho de banda</p>
          <p className="mt-1 text-xs text-slate-500">Entrada / salida actual</p>
        </div>
        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{bandwidth.value}%</span>
      </div>
      <div className="mt-4 space-y-3">
        <BandwidthLine label="Entrada" value={bandwidth.in} percent={Math.min(bandwidth.value, 100)} tone="bg-blue-600" />
        <BandwidthLine label="Salida" value={bandwidth.out} percent={Math.min(bandwidth.value + 8, 100)} tone="bg-cyan-600" />
      </div>
    </div>
  )
}

function BandwidthLine({ label, percent, tone, value }: { label: string; percent: number; tone: string; value: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200">
        <div className={cn("h-2 rounded-full", tone)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function AdminMaintenancePage() {
  const [configuration, setConfiguration] = useState<HostingConfiguration | null>(null)
  const [nodes, setNodes] = useState<AdminNode[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null)
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showTelegramModal, setShowTelegramModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")

  const loadMaintenance = () => {
    setIsLoading(true)
    setMessage("")
    Promise.all([hostingApi.configuration(), adminApi.nodes()])
      .then(([config, nodePage]) => {
        setConfiguration(config)
        setNodes(nodePage.results)
      })
      .catch((error: Error) => setMessage(error.message || "No se pudo cargar mantenimiento."))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadMaintenance()
  }, [])

  const maintenance = normalizeMaintenanceConfig(configuration?.policies)
  const tasks = maintenance.tasks
  const filteredTasks = tasks.filter((task) => {
    const haystack = [task.hostname, task.type, task.impact, task.reason, task.status, task.difficulty].join(" ").toLowerCase()
    const matchesSearch = !query.trim() || haystack.includes(query.trim().toLowerCase())
    const matchesStatus = !statusFilter || task.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const saveMaintenance = async (nextMaintenance: MaintenanceConfig, success: string) => {
    if (!configuration) return
    setIsSaving(true)
    setMessage("")
    try {
      const saved = await hostingApi.updateConfiguration({
        policies: {
          ...configuration.policies,
          maintenance: nextMaintenance,
        },
      })
      setConfiguration(saved)
      setMessage(success)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar mantenimiento.")
    } finally {
      setIsSaving(false)
    }
  }

  const saveTask = async (task: MaintenanceTask) => {
    const exists = tasks.some((item) => item.id === task.id)
    const nextTasks = exists ? tasks.map((item) => (item.id === task.id ? task : item)) : [task, ...tasks]
    await saveMaintenance({ ...maintenance, tasks: nextTasks }, exists ? "Mantenimiento actualizado." : "Mantenimiento programado.")
    setShowTaskModal(false)
    setEditingTask(null)
  }

  const notifyTask = async (task: MaintenanceTask) => {
    setIsSaving(true)
    setMessage("")
    try {
      await hostingApi.notifyMaintenance({ task })
      const nextTask = { ...task, notified_at: new Date().toISOString() }
      const nextTasks = tasks.map((item) => (item.id === task.id ? nextTask : item))
      await saveMaintenance({ ...maintenance, tasks: nextTasks }, "Notificacion Telegram enviada.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo enviar Telegram.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className={cn("rounded-lg border px-4 py-3 text-sm font-semibold", message.includes("No se") || message.includes("Falta") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
          {message}
        </div>
      ) : null}
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Infraestructura</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Mantenimiento</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Servidores en mantenimiento, dados de baja o prÃ³ximos a revisiÃ³n tÃ©cnica programada.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowTelegramModal(true)} size="sm" variant="outline">Configurar Telegram</Button>
            <Button onClick={() => { setEditingTask(null); setShowTaskModal(true) }} size="sm">Programar mantenimiento</Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="En mantenimiento" value={String(tasks.filter((task) => task.status === "En mantenimiento").length)} detail={firstTaskHost(tasks, "En mantenimiento")} />
        <AdminMetric label="Programados" value={String(tasks.filter((task) => task.status === "Programado").length)} detail="Proximos mantenimientos" />
        <AdminMetric label="Requieren revision" value={String(tasks.filter((task) => task.status === "Requiere revision").length)} detail={firstTaskHost(tasks, "Requiere revision")} />
        <AdminMetric label="Dados de baja" value={String(tasks.filter((task) => task.status === "Dado de baja").length)} detail="Sin servicio activo" />
      </section>

      <div className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex h-9 w-[380px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar servidor, motivo o impacto..." value={query} />
          </div>
          <div className="flex gap-2">
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="">Estado</option>
              {maintenanceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <Button disabled={isLoading} onClick={loadMaintenance} size="sm" variant="outline">Actualizar</Button>
          </div>
        </div>

        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["Servidor", "Estado", "Fecha / hora", "Ventana", "Impacto", "Motivo", "Acciones"].map((column) => (
                <th className="px-4 py-2 font-bold" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTasks.map((row) => (
              <tr className="hover:bg-slate-50" key={row.id}>
                <td className="px-4 py-3 font-semibold text-slate-900">{row.hostname}</td>
                <td className="px-4 py-3"><MaintenanceStatusBadge status={row.status} /></td>
                <td className="px-4 py-3">{formatDateTime(row.scheduled_at)}</td>
                <td className="px-4 py-3">{row.duration_label}</td>
                <td className="px-4 py-3">{row.impact}</td>
                <td className="max-w-[320px] px-4 py-3 leading-5 text-slate-600">{row.reason}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button onClick={() => setSelectedTask(row)} size="sm" variant="outline">Ver</Button>
                    <Button onClick={() => { setEditingTask(row); setShowTaskModal(true) }} size="sm" variant="outline">Editar</Button>
                    <Button disabled={isSaving} onClick={() => void notifyTask(row)} size="sm" variant="outline">Notificar</Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && filteredTasks.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={7}>No hay mantenimientos registrados con esos filtros.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {showTaskModal ? (
        <MaintenanceTaskModal
          nodes={nodes}
          onClose={() => { setShowTaskModal(false); setEditingTask(null) }}
          onSave={(task) => void saveTask(task)}
          task={editingTask}
        />
      ) : null}
      {selectedTask ? <MaintenanceViewModal onClose={() => setSelectedTask(null)} task={selectedTask} /> : null}
      {showTelegramModal ? (
        <MaintenanceTelegramModal
          config={maintenance}
          isSaving={isSaving}
          onClose={() => setShowTelegramModal(false)}
          onSave={(nextConfig) => void saveMaintenance(nextConfig, "Configuracion Telegram guardada.").then(() => setShowTelegramModal(false))}
        />
      ) : null}
    </div>
  )
}

function MaintenanceStatusBadge({ status }: { status: string }) {
  const tone =
    status === "En mantenimiento"
      ? "bg-orange-50 text-orange-700"
      : status === "Dado de baja"
        ? "bg-slate-100 text-slate-600"
        : status === "Requiere revision"
          ? "bg-red-50 text-red-700"
          : "bg-blue-50 text-blue-700"

  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{status}</span>
}

type MaintenanceTask = {
  created_at: string
  difficulty: string
  duration_label: string
  duration_minutes: number
  hostname: string
  id: string
  impact: string
  node_id: string
  notified_at?: string
  reason: string
  scheduled_at: string
  status: string
  type: string
  updated_at: string
}

type MaintenanceTelegramConfig = {
  bot_token: string
  chat_id: string
  enabled: boolean
  frequency: string
  lead_times: string[]
}

type MaintenanceConfig = {
  tasks: MaintenanceTask[]
  telegram: MaintenanceTelegramConfig
}

const maintenanceStatuses = ["Programado", "En mantenimiento", "Requiere revision", "Dado de baja", "Finalizado"]
const maintenanceTypes = ["Revision general", "Actualizacion de agente", "Kernel / reboot controlado", "Storage / backups", "Correo / antispam", "Seguridad / firewall", "Red / conectividad"]
const maintenanceDifficulties = ["Baja", "Media", "Alta", "Critica"]
const telegramLeadTimes = [
  ["7d", "7 dias antes"],
  ["3d", "3 dias antes"],
  ["1d", "1 dia antes"],
  ["12h", "12 horas antes"],
  ["6h", "6 horas antes"],
] as const

function MaintenanceTaskModal({
  nodes,
  onClose,
  onSave,
  task,
}: {
  nodes: AdminNode[]
  onClose: () => void
  onSave: (task: MaintenanceTask) => void
  task: MaintenanceTask | null
}) {
  const firstNode = nodes[0]
  const [nodeId, setNodeId] = useState(task?.node_id || firstNode?.id || "")
  const [type, setType] = useState(task?.type || maintenanceTypes[0])
  const [scheduledAt, setScheduledAt] = useState(toDatetimeLocal(task?.scheduled_at))
  const [duration, setDuration] = useState(String(task?.duration_minutes || 60))
  const [status, setStatus] = useState(task?.status || "Programado")
  const [difficulty, setDifficulty] = useState(task?.difficulty || "Media")
  const [impact, setImpact] = useState(task?.impact || "")
  const [reason, setReason] = useState(task?.reason || "")
  const selectedNode = nodes.find((node) => node.id === nodeId) || firstNode

  return (
    <AdminModalFrame kicker="Infraestructura" onClose={onClose} title={task ? "Editar mantenimiento" : "Programar mantenimiento"}>
      <form onSubmit={(event) => {
        event.preventDefault()
        if (!selectedNode) return
        const now = new Date().toISOString()
        const minutes = Math.max(1, Number(duration) || 60)
        onSave({
          created_at: task?.created_at || now,
          difficulty,
          duration_label: maintenanceDurationLabel(minutes),
          duration_minutes: minutes,
          hostname: selectedNode.hostname,
          id: task?.id || `mnt-${Date.now()}`,
          impact,
          node_id: selectedNode.id,
          notified_at: task?.notified_at,
          reason,
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : now,
          status,
          type,
          updated_at: now,
        })
      }}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">
            Servidor
            <select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold" onChange={(event) => setNodeId(event.target.value)} value={nodeId}>
              {nodes.map((node) => <option key={node.id} value={node.id}>{node.hostname}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700">
            Tipo
            <select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold" onChange={(event) => setType(event.target.value)} value={type}>
              {maintenanceTypes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700">
            Fecha y hora
            <input className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold" onChange={(event) => setScheduledAt(event.target.value)} type="datetime-local" value={scheduledAt} />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Duracion estimada
            <input className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold" min={1} onChange={(event) => setDuration(event.target.value)} type="number" value={duration} />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Estado inicial
            <select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold" onChange={(event) => setStatus(event.target.value)} value={status}>
              {maintenanceStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700">
            Dificultad
            <select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold" onChange={(event) => setDifficulty(event.target.value)} value={difficulty}>
              {maintenanceDifficulties.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700 md:col-span-2">
            Impacto
            <input className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold" onChange={(event) => setImpact(event.target.value)} placeholder="Clientes afectados, correo, backups, web..." value={impact} />
          </label>
          <label className="text-sm font-bold text-slate-700 md:col-span-2">
            Motivo
            <textarea className="mt-1 min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold" onChange={(event) => setReason(event.target.value)} placeholder="Detalle de la revision o trabajo programado" value={reason} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">Cancelar</Button>
          <Button disabled={!selectedNode || !scheduledAt || !impact || !reason} type="submit">Guardar</Button>
        </div>
      </form>
    </AdminModalFrame>
  )
}

function MaintenanceViewModal({ onClose, task }: { onClose: () => void; task: MaintenanceTask }) {
  return (
    <AdminModalFrame kicker="Mantenimiento" onClose={onClose} title={task.hostname}>
      <div className="grid gap-3 md:grid-cols-2">
        <AdminStatus label="Estado" value={task.status} />
        <AdminStatus label="Tipo" value={task.type} />
        <AdminStatus label="Fecha" value={formatDateTime(task.scheduled_at)} />
        <AdminStatus label="Ventana" value={task.duration_label} />
        <AdminStatus label="Dificultad" value={task.difficulty} />
        <AdminStatus label="Ultima notificacion" value={task.notified_at ? formatDateTime(task.notified_at) : "Sin enviar"} />
      </div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-bold uppercase text-slate-500">Impacto</div>
        <div className="mt-1 text-sm font-semibold text-slate-800">{task.impact}</div>
      </div>
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-bold uppercase text-slate-500">Motivo</div>
        <div className="mt-1 text-sm font-semibold text-slate-800">{task.reason}</div>
      </div>
    </AdminModalFrame>
  )
}

function MaintenanceTelegramModal({
  config,
  isSaving,
  onClose,
  onSave,
}: {
  config: MaintenanceConfig
  isSaving: boolean
  onClose: () => void
  onSave: (config: MaintenanceConfig) => void
}) {
  const [enabled, setEnabled] = useState(config.telegram.enabled)
  const [botToken, setBotToken] = useState(config.telegram.bot_token)
  const [chatId, setChatId] = useState(config.telegram.chat_id)
  const [frequency, setFrequency] = useState(config.telegram.frequency || "once")
  const [leadTimes, setLeadTimes] = useState<string[]>(config.telegram.lead_times.length ? config.telegram.lead_times : ["7d", "3d", "1d", "12h", "6h"])

  const toggleLeadTime = (value: string) => {
    setLeadTimes((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  return (
    <AdminModalFrame kicker="Telegram" onClose={onClose} title="Configurar avisos de mantenimiento">
      <form onSubmit={(event) => {
        event.preventDefault()
        onSave({
          ...config,
          telegram: {
            bot_token: botToken,
            chat_id: chatId,
            enabled,
            frequency,
            lead_times: leadTimes,
          },
        })
      }}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
            <input checked={enabled} onChange={(event) => setEnabled(event.target.checked)} type="checkbox" />
            Activar avisos Telegram
          </label>
          <label className="text-sm font-bold text-slate-700">
            Frecuencia
            <select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold" onChange={(event) => setFrequency(event.target.value)} value={frequency}>
              <option value="once">Una vez por anticipacion</option>
              <option value="daily">Diario mientras falte aviso</option>
              <option value="manual">Solo manual</option>
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700">
            Bot token
            <input className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold" onChange={(event) => setBotToken(event.target.value)} placeholder="123456:ABC..." type="password" value={botToken} />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Chat ID / grupo
            <input className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold" onChange={(event) => setChatId(event.target.value)} placeholder="-1001234567890" value={chatId} />
          </label>
          <div className="md:col-span-2">
            <div className="mb-2 text-sm font-bold text-slate-700">Anticipacion</div>
            <div className="flex flex-wrap gap-2">
              {telegramLeadTimes.map(([value, label]) => (
                <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700" key={value}>
                  <input checked={leadTimes.includes(value)} onChange={() => toggleLeadTime(value)} type="checkbox" />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          El aviso incluye servidor, tipo de mantenimiento, fecha, duracion, estado, dificultad, impacto y motivo.
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">Cancelar</Button>
          <Button disabled={isSaving || !botToken || !chatId || !leadTimes.length} type="submit">Guardar Telegram</Button>
        </div>
      </form>
    </AdminModalFrame>
  )
}

function normalizeMaintenanceConfig(policies?: Record<string, unknown>): MaintenanceConfig {
  const rawMaintenance = policies && isRecord(policies.maintenance) ? policies.maintenance : {}
  const rawTelegram = isRecord(rawMaintenance.telegram) ? rawMaintenance.telegram : {}
  const rawTasks = Array.isArray(rawMaintenance.tasks) ? rawMaintenance.tasks : []
  return {
    tasks: rawTasks.map(normalizeMaintenanceTask).filter((task): task is MaintenanceTask => Boolean(task)),
    telegram: {
      bot_token: String(rawTelegram.bot_token || ""),
      chat_id: String(rawTelegram.chat_id || ""),
      enabled: Boolean(rawTelegram.enabled),
      frequency: String(rawTelegram.frequency || "once"),
      lead_times: Array.isArray(rawTelegram.lead_times) ? rawTelegram.lead_times.map(String) : ["7d", "3d", "1d", "12h", "6h"],
    },
  }
}

function normalizeMaintenanceTask(raw: unknown): MaintenanceTask | null {
  if (!isRecord(raw)) return null
  const id = String(raw.id || "")
  const hostname = String(raw.hostname || "")
  if (!id || !hostname) return null
  return {
    created_at: String(raw.created_at || raw.updated_at || new Date().toISOString()),
    difficulty: String(raw.difficulty || "Media"),
    duration_label: String(raw.duration_label || maintenanceDurationLabel(Number(raw.duration_minutes) || 60)),
    duration_minutes: Number(raw.duration_minutes) || 60,
    hostname,
    id,
    impact: String(raw.impact || ""),
    node_id: String(raw.node_id || ""),
    notified_at: raw.notified_at ? String(raw.notified_at) : undefined,
    reason: String(raw.reason || ""),
    scheduled_at: String(raw.scheduled_at || new Date().toISOString()),
    status: String(raw.status || "Programado"),
    type: String(raw.type || maintenanceTypes[0]),
    updated_at: String(raw.updated_at || raw.created_at || new Date().toISOString()),
  }
}

function maintenanceDurationLabel(minutes: number) {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest ? `${hours} h ${rest} min` : `${hours} hora${hours === 1 ? "" : "s"}`
  }
  return `${minutes} min`
}

function toDatetimeLocal(value?: string) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

function firstTaskHost(tasks: MaintenanceTask[], status: string) {
  return tasks.find((task) => task.status === status)?.hostname || "Sin registros"
}

function AdminHostingAccountsPage() {
  const [accounts, setAccounts] = useState<HostingAccount[]>([])
  const [plans, setPlans] = useState<HostingPlan[]>([])
  const [nodes, setNodes] = useState<AdminNode[]>([])
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [viewingAccount, setViewingAccount] = useState<HostingAccount | null>(null)

  const loadAccounts = () => {
    setIsLoading(true)
    Promise.all([hostingApi.accounts(), hostingApi.plans(), adminApi.nodes()])
      .then(([accountPage, planPage, nodePage]) => {
        setAccounts(accountPage.results)
        setPlans(planPage.results.filter((plan) => plan.features?.plan_scope !== "reseller"))
        setNodes(nodePage.results.filter((node) => node.agent_type === "web" || node.capabilities?.web === true || node.hostname.startsWith("web-")))
        setError("")
      })
      .catch((reason) => setError(readAdminError(reason, "No se pudieron cargar las cuentas de hosting.")))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  const filteredAccounts = accounts.filter((account) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return [
      account.customer_name,
      account.customer_email,
      account.primary_domain,
      account.username,
      account.plan_name,
      account.node_hostname,
      account.reseller_username,
      account.owner_username,
      account.status,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term))
  })

  const activeCount = accounts.filter((account) => account.status === "active").length
  const suspendedCount = accounts.filter((account) => account.status === "suspended").length
  const pendingCount = accounts.filter((account) => ["pending", "provisioning"].includes(account.status)).length

  const toggleSuspendAccount = async (account: HostingAccount) => {
    const suspend = account.status !== "suspended"
    if (!window.confirm(`${suspend ? "Suspender" : "Reactivar"} la cuenta ${account.primary_domain}?`)) return
    try {
      const updated = suspend ? await hostingApi.suspendAccount(account.id) : await hostingApi.unsuspendAccount(account.id)
      setAccounts((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setMessage(`${suspend ? "Suspension enviada" : "Reactivacion enviada"}: ${account.primary_domain}`)
    } catch (reason) {
      setError(readAdminError(reason, suspend ? "No se pudo suspender la cuenta." : "No se pudo reactivar la cuenta."))
    }
  }

  const viewAsClient = (account: HostingAccount) => {
    window.sessionStorage.setItem("eh_admin_view_account", account.id)
    window.location.assign("/")
  }

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Globe2 className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Clientes</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Cuentas de hosting</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Cuentas creadas o intervenidas por el admin principal y el staff administrativo. No reemplaza la creacion propia del revendedor.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreateModal(true)} size="sm">Nueva cuenta admin</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Cuentas admin" value={String(accounts.length)} detail={isLoading ? "Sincronizando..." : "Directas o staff"} />
        <AdminMetric label="Activas" value={String(activeCount)} detail="Operando normal" />
        <AdminMetric label="Suspendidas" value={String(suspendedCount)} detail="Requiere revision" />
        <AdminMetric label="Pendientes" value={String(pendingCount)} detail="Alta o provisionamiento" />
      </section>

      <div className="eh-card overflow-hidden">
        {error ? <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
        {message ? <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">{message}</div> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <label className="flex h-9 w-[380px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input
              className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente, dominio, nodo o staff..."
              value={search}
            />
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">Estado</Button>
            <Button disabled={isLoading} onClick={loadAccounts} size="sm" variant="outline">Nodo</Button>
            <Button size="sm" variant="outline">Creado por</Button>
          </div>
        </div>

        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["Cliente", "Dominio", "Plan", "Nodo", "Revendedor", "Creado por", "Estado", "Disco", "Trafico", "Acciones"].map((column) => (
                <th className="px-4 py-2 font-bold" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAccounts.map((account) => (
              <tr className="hover:bg-slate-50" key={account.id}>
                <td className="px-4 py-3 font-semibold text-slate-900">{account.customer_name || account.username}</td>
                <td className="px-4 py-3 text-blue-700">{account.primary_domain}</td>
                <td className="px-4 py-3">{account.plan_name || "Sin plan"}</td>
                <td className="px-4 py-3">{account.node_hostname || "N/D"}</td>
                <td className="px-4 py-3">{account.reseller_username || "Sin revendedor"}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{account.owner_username || "Admin"}</td>
                <td className="px-4 py-3"><AdminAccountStatusBadge status={accountStatusLabel(account.status)} /></td>
                <td className="px-4 py-3"><AdminMiniBar value={accountUsagePct(account, "disk")} /></td>
                <td className="px-4 py-3"><AdminMiniBar value={accountUsagePct(account, "traffic")} /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button onClick={() => setViewingAccount(account)} size="sm" variant="outline">Ver</Button>
                    <Button onClick={() => viewAsClient(account)} size="sm" variant="outline">Ver como Cliente</Button>
                    <Button onClick={() => void toggleSuspendAccount(account)} size="sm" variant="outline">{account.status === "suspended" ? "Reactivar" : "Suspender"}</Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && filteredAccounts.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={10}>
                  {accounts.length === 0 ? "No hay cuentas de hosting creadas." : "No hay cuentas con ese filtro."}
                </td>
              </tr>
            ) : null}
            {isLoading ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={10}>Cargando cuentas reales...</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {showCreateModal ? (
        <CreateAdminHostingAccountModal
          nodes={nodes}
          onClose={() => setShowCreateModal(false)}
          onCreated={(account) => {
            setMessage(`Cuenta creada y enviada al agente: ${account.primary_domain}`)
            setShowCreateModal(false)
            loadAccounts()
          }}
          plans={plans}
        />
      ) : null}
      {viewingAccount ? <HostingAccountDetailModal account={viewingAccount} onClose={() => setViewingAccount(null)} onUpdated={(updated) => setAccounts((current) => current.map((item) => (item.id === updated.id ? updated : item)))} /> : null}
    </div>
  )
}

function AdminAccountStatusBadge({ status }: { status: string }) {
  const tone =
    status === "Activa"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Suspendida"
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-700"

  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{status}</span>
}

function CreateAdminHostingAccountModal({
  nodes,
  onClose,
  onCreated,
  plans,
}: {
  nodes: AdminNode[]
  onClose: () => void
  onCreated: (account: HostingAccount) => void
  plans: HostingPlan[]
}) {
  const firstPlan = plans[0]
  const firstNode = nodes[0]
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [username, setUsername] = useState("")
  const [domain, setDomain] = useState("")
  const [planId, setPlanId] = useState(firstPlan ? String(firstPlan.id) : "")
  const [nodeId, setNodeId] = useState(firstNode?.id ?? "")
  const [password, setPassword] = useState(generateHostingPassword())
  const [createMailbox, setCreateMailbox] = useState(true)
  const [createDatabase, setCreateDatabase] = useState(false)
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const selectedPlan = plans.find((plan) => String(plan.id) === planId) ?? firstPlan
  const selectedNode = nodes.find((node) => node.id === nodeId) ?? firstNode

  useEffect(() => {
    if (!planId && firstPlan) setPlanId(String(firstPlan.id))
    if (!nodeId && firstNode) setNodeId(firstNode.id)
  }, [firstNode?.id, firstPlan?.id, nodeId, planId])

  const submit = async () => {
    if (!selectedPlan || !selectedNode) {
      setError("Debe existir un plan cliente y un nodo web disponible.")
      return
    }
    if (!customerEmail.trim() || !username.trim() || !domain.trim() || password.length < 8) {
      setError("Completa correo, dominio, usuario y contrasena de al menos 8 caracteres.")
      return
    }
    setIsSaving(true)
    setError("")
    try {
      const cleanUsername = username.trim().toLowerCase()
      const cleanDomain = domain.trim().toLowerCase()
      const payload: ProvisionHostingAccountPayload = {
        account_password: password,
        customer_email: customerEmail.trim(),
        customer_name: customerName.trim(),
        node: selectedNode.id,
        php_version: selectedPlan.allowed_php_versions?.[0] ?? "8.3",
        plan: selectedPlan.id,
        primary_domain: cleanDomain,
        ssl_email: customerEmail.trim(),
        username: cleanUsername,
        web_engine: selectedPlan.allowed_web_engines?.[0] ?? "openlitespeed",
      }
      if (createMailbox) payload.mailbox = { email: `admin@${cleanDomain}`, password, quota_mb: 1024 }
      if (createDatabase) payload.database = { engine: "mariadb", name: `${cleanUsername}_db`, password, username: `${cleanUsername}_dbu` }
      const account = await hostingApi.provisionAccount(payload)
      onCreated(account)
    } catch (reason) {
      setError(readAdminError(reason, "No se pudo crear la cuenta de hosting."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[980px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Nueva cuenta de hosting admin</h3>
            <p className="mt-1 text-sm text-slate-500">Alta de cuenta directa creada por el administrador o staff EHClouding.</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>

        {error ? <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700">{error}</div> : null}

        <div className="p-5">
          <section className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Datos del cliente</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <PlanTextInput label="Nombre del cliente" onChange={setCustomerName} value={customerName} />
                <PlanTextInput label="Correo del cliente" onChange={setCustomerEmail} value={customerEmail} />
                <PlanTextInput label="Usuario del sistema" onChange={(value) => setUsername(value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} value={username} />
                <PlanTextInput label="Dominio principal" onChange={setDomain} value={domain} />
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Asignar a revendedor</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500">
                    <option>Sin revendedor / cuenta directa</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Estado inicial</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500">
                    <option>Pendiente / provisionamiento</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Provisionamiento</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Plan</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => setPlanId(event.target.value)} value={planId}>
                    {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Nodo</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => setNodeId(event.target.value)} value={nodeId}>
                    {nodes.map((node) => <option key={node.id} value={node.id}>{node.hostname}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Contrasena temporal</span>
                  <div className="grid grid-cols-[1fr_92px] gap-2">
                    <input className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => setPassword(event.target.value)} type="text" value={password} />
                    <Button onClick={() => setPassword(generateHostingPassword())} size="sm" type="button" variant="outline">Generar</Button>
                  </div>
                </label>
                <PlanTextInput disabled label="Disco" onChange={() => undefined} value={selectedPlan ? formatPlanStorage(selectedPlan.disk_mb) : ""} />
                <PlanTextInput disabled label="Trafico" onChange={() => undefined} value={selectedPlan ? formatPlanStorage(selectedPlan.bandwidth_mb) : ""} />
                <PlanTextInput disabled label="Correos" onChange={() => undefined} value={selectedPlan ? formatPlanLimit(selectedPlan.max_mailboxes) : ""} />
                <PlanTextInput disabled label="Bases de datos" onChange={() => undefined} value={selectedPlan ? formatPlanLimit(selectedPlan.max_databases) : ""} />
                <PlanTextInput disabled label="Dominios" onChange={() => undefined} value={selectedPlan ? formatPlanLimit(selectedPlan.max_domains) : ""} />
                <PlanTextInput disabled label="CPU / Memoria" onChange={() => undefined} value={selectedPlan ? `${formatPlanCpu(selectedPlan.cpu_pct)} / ${formatPlanMemory(selectedPlan.memory_mb)}` : ""} />
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Opciones iniciales</p>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <AdminCheckbox checked readOnly label="Crear zona DNS" />
                <AdminCheckbox checked readOnly label="Emitir SSL gratuito" />
                <AdminCheckbox checked={createMailbox} label="Crear buzon principal" onChange={setCreateMailbox} />
                <AdminCheckbox checked={createDatabase} label="Crear base de datos inicial" onChange={setCreateDatabase} />
              </div>
            </div>
          </section>

          <aside className="hidden">
            <div className="eh-kicker">Opciones iniciales</div>
            <h4 className="mt-1 text-lg font-bold">Alta de hosting</h4>
            <div className="mt-4 space-y-2">
              {["Crear zona DNS", "Emitir SSL gratuito", "Crear buzÃ³n principal", "Activar backup inicial", "Enviar bienvenida"].map((option, index) => (
                <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold" key={option}>
                  <input type="checkbox" defaultChecked={index < 2} className="h-4 w-4" />
                  {option}
                </label>
              ))}
            </div>
          </aside>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">Cancelar</Button>
          <Button disabled={isSaving || !selectedPlan || !selectedNode} onClick={() => void submit()} size="sm">{isSaving ? "Creando..." : "Crear cuenta"}</Button>
        </div>
      </div>
    </div>
  )
}

function HostingAccountDetailModal({ account, onClose, onUpdated }: { account: HostingAccount; onClose: () => void; onUpdated?: (account: HostingAccount) => void }) {
  const [profile, setProfile] = useState<AccountProfileResponse | null>(null)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isActionBusy, setIsActionBusy] = useState(false)

  const loadProfile = () => {
    setIsLoading(true)
    hostingApi
      .accountProfile(account.id)
      .then((data) => {
        setProfile(data)
        setError("")
        onUpdated?.(data.account)
      })
      .catch((reason) => setError(readAdminError(reason, "No se pudo cargar el perfil de la cuenta.")))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id])

  const displayAccount = profile?.account ?? account
  const usage = profile?.usage
  const diskPct = usage ? percent(usage.disk_used_mb, usage.disk_quota_mb) : accountUsagePct(displayAccount, "disk")
  const trafficPct = usage ? percent(usage.bandwidth_used_mb, usage.bandwidth_quota_mb) : accountUsagePct(displayAccount, "traffic")
  const memoryPct = usage ? percent(usage.ram_used_mb, usage.memory_limit_mb) : 0
  const cpuPct = Math.min(Number(usage?.cpu_pct ?? 0), 100)
  const latestRun = displayAccount.provisioning_runs?.[0]
  const failedSteps = latestRun?.steps.filter((step) => ["failed", "canceled", "expired"].includes(step.job.status)) ?? []

  const syncProvisioning = async () => {
    setIsActionBusy(true)
    setError("")
    setMessage("")
    try {
      const updated = await hostingApi.syncAccountStatus(displayAccount.id)
      onUpdated?.(updated)
      setMessage("Estado sincronizado desde los jobs del agente.")
      loadProfile()
    } catch (reason) {
      setError(readAdminError(reason, "No se pudo sincronizar el provisionamiento."))
    } finally {
      setIsActionBusy(false)
    }
  }

  const retryFailedProvisioning = async () => {
    setIsActionBusy(true)
    setError("")
    setMessage("")
    try {
      const response = await hostingApi.retryFailedAccount(displayAccount.id)
      onUpdated?.(response.account)
      setMessage(`Reintento enviado: ${response.retried} paso(s) fallido(s).`)
      loadProfile()
    } catch (reason) {
      setError(readAdminError(reason, "No se pudieron reintentar los jobs fallidos."))
    } finally {
      setIsActionBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[900px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">{account.primary_domain}</h3>
            <p className="mt-1 text-sm text-slate-500">{account.customer_name || account.username} Â· {account.node_hostname || "Nodo N/D"}</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>

        {error ? <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
        {message ? <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-2 text-sm font-semibold text-emerald-700">{message}</div> : null}

        <div className="max-h-[78vh] space-y-4 overflow-auto p-5">
          <section className="grid gap-3 md:grid-cols-4">
            <AdminMetric label="Estado" value={accountStatusLabel(displayAccount.status)} detail={isLoading ? "Cargando..." : "Cuenta hosting"} />
            <AdminMetric label="Dominios" value={String(profile?.services.domains ?? displayAccount.domains_count ?? 0)} detail="Asignados" />
            <AdminMetric label="Bases de datos" value={String(profile?.services.databases ?? displayAccount.databases_count ?? 0)} detail="Creadas" />
            <AdminMetric label="Correos" value={String(profile?.services.mailboxes ?? displayAccount.mailboxes_count ?? 0)} detail="Buzones" />
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <AccountUsageCard label="Disco" value={diskPct} detail={`${formatMb(usage?.disk_used_mb)} / ${formatMb(usage?.disk_quota_mb ?? displayAccount.disk_mb)}`} />
            <AccountUsageCard label="Trafico" value={trafficPct} detail={`${formatMb(usage?.bandwidth_used_mb)} / ${formatMb(usage?.bandwidth_quota_mb ?? displayAccount.bandwidth_mb)}`} />
            <AccountUsageCard label="Memoria" value={memoryPct} detail={`${formatMb(usage?.ram_used_mb)} / ${formatMb(usage?.memory_limit_mb ?? displayAccount.memory_mb ?? 0)}`} />
            <AccountUsageCard label="CPU" value={cpuPct} detail={`${cpuPct || 0}% usado / limite ${displayAccount.cpu_pct ?? 100}%`} />
          </section>

          <section className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold">Provisionamiento</p>
              <div className="flex gap-2">
                <Button disabled={isActionBusy} onClick={() => void syncProvisioning()} size="sm" type="button" variant="outline">Sincronizar</Button>
                <Button disabled={isActionBusy || failedSteps.length === 0} onClick={() => void retryFailedProvisioning()} size="sm" type="button">Reintentar fallidos</Button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
              <AdminStatus label="Plan" value={displayAccount.plan_name || "Sin plan"} />
              <AdminStatus label="Usuario" value={displayAccount.username} />
              <AdminStatus label="SSL" value={profile?.security.ssl_status || "N/D"} />
              <AdminStatus label="Proceso" value={latestRun ? `${latestRun.status} - ${latestRun.steps.length} pasos` : "Sin proceso"} />
            </div>
            {latestRun ? (
              <div className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-white">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-slate-50 uppercase text-slate-500">
                    <tr>{["Paso", "Job", "Estado", "Error real", "Actualizado"].map((column) => <th className="px-3 py-2 font-bold" key={column}>{column}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {latestRun.steps.map((step) => (
                      <tr key={step.id}>
                        <td className="px-3 py-2 font-semibold text-slate-900">{step.order}. {provisioningStepLabel(step.name)}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{step.job.job_type}</td>
                        <td className="px-3 py-2"><span className={cn("rounded-full px-2 py-1 font-bold", provisioningJobTone(step.job.status))}>{provisioningJobLabel(step.job.status)}</span></td>
                        <td className="max-w-[300px] px-3 py-2 text-slate-600">
                          {step.job.error_code || step.job.error_detail ? (
                            <div>
                              <div className="font-bold text-red-700">{step.job.error_code || "error"}</div>
                              <div className="mt-1 whitespace-pre-wrap break-words">{step.job.error_detail || "Sin detalle del agente."}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">Sin error reportado</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{step.job.updated_at ? formatDateTime(step.job.updated_at) : "N/D"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">Esta cuenta no tiene un proceso de provisionamiento registrado. Revisa si se creo por una ruta antigua o si la orden no llego al backend.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function AccountUsageCard({ detail, label, value }: { detail: string; label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-slate-900">{label}</span>
        <span className="font-semibold text-blue-700">{value}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-200">
        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} />
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-500">{detail}</p>
    </div>
  )
}

function provisioningStepLabel(step: string) {
  const labels: Record<string, string> = {
    create_database: "Crear base de datos",
    create_dns_zone: "Crear zona DNS",
    create_mail_domain: "Crear dominio de correo",
    create_mailbox: "Crear buzon",
    enable_sftp: "Crear acceso SFTP",
    issue_ssl: "Emitir SSL",
    provision_hosting: "Crear hosting",
  }
  return labels[step] || step
}

function provisioningJobLabel(status: string) {
  const labels: Record<string, string> = {
    canceled: "Cancelado",
    expired: "Expirado",
    failed: "Fallido",
    queued: "En cola",
    running: "Ejecutando",
    sent: "Enviado",
    success: "Correcto",
  }
  return labels[status] || status
}

function provisioningJobTone(status: string) {
  if (status === "success") return "bg-emerald-50 text-emerald-700"
  if (["failed", "canceled", "expired"].includes(status)) return "bg-red-50 text-red-700"
  if (["running", "sent", "queued"].includes(status)) return "bg-blue-50 text-blue-700"
  return "bg-slate-100 text-slate-600"
}

function AdminCheckbox({ checked, label, onChange, readOnly }: { checked: boolean; label: string; onChange?: (checked: boolean) => void; readOnly?: boolean }) {
  return (
    <label className="mt-2 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">
      <input checked={checked} className="h-4 w-4" disabled={readOnly} onChange={(event) => onChange?.(event.target.checked)} type="checkbox" />
      {label}
    </label>
  )
}

function generateHostingPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%"
  return Array.from({ length: 14 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")
}

function accountStatusLabel(status: string) {
  if (status === "active") return "Activa"
  if (status === "suspended") return "Suspendida"
  if (status === "failed") return "Fallida"
  if (status === "provisioning") return "Provisionando"
  return "Pendiente"
}

function accountUsagePct(account: HostingAccount, kind: "disk" | "traffic") {
  const usage = account.last_usage ?? {}
  if (kind === "disk") {
    return percent(readUsageNumber(usage, ["disk_used_mb", "storage.total_mb"]), account.disk_mb)
  }
  return percent(readUsageNumber(usage, ["bandwidth_used_mb"]), account.bandwidth_mb)
}

function readUsageNumber(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const parts = key.split(".")
    let current: unknown = value
    for (const part of parts) current = isRecord(current) ? current[part] : undefined
    if (typeof current === "number") return current
  }
  return 0
}

function percent(used?: number, total?: number) {
  if (!used || !total) return 0
  return Math.max(0, Math.min(100, Math.round((used / total) * 100)))
}

function formatMb(value?: number) {
  if (!value) return "0 MB"
  return formatPlanStorage(value)
}

function AdminMiniBar({ value }: { value: number }) {
  return (
    <div className="w-24">
      <div className="mb-1 text-xs font-semibold text-slate-500">{value}%</div>
      <div className="h-1.5 rounded-full bg-slate-200">
        <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function AdminResellersPage() {
  const [resellers, setResellers] = useState<HostingReseller[]>([])
  const [plans, setPlans] = useState<HostingPlan[]>([])
  const [nodes, setNodes] = useState<AdminNode[]>([])
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [viewingReseller, setViewingReseller] = useState<HostingReseller | null>(null)

  const loadResellers = () => {
    setIsLoading(true)
    Promise.all([hostingApi.resellers(), hostingApi.plans(), adminApi.nodes()])
      .then(([resellerPage, planPage, nodePage]) => {
        setResellers(resellerPage.results)
        setPlans(planPage.results.filter((plan) => plan.features?.plan_scope === "reseller"))
        setNodes(nodePage.results)
        setError("")
      })
      .catch((reason) => setError(readAdminError(reason, "No se pudieron cargar los revendedores.")))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadResellers()
  }, [])

  const filteredResellers = resellers.filter((reseller) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return [reseller.company_name, reseller.username, reseller.email, reseller.plan_name, reseller.primary_node_hostname, reseller.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term))
  })

  const activeCount = resellers.filter((reseller) => reseller.status === "active" && reseller.is_active).length
  const totalAllowed = resellers.reduce((total, reseller) => total + (reseller.max_accounts || 0), 0)
  const totalCreated = resellers.reduce((total, reseller) => total + reseller.accounts_count, 0)
  const usedNodes = new Set(resellers.map((reseller) => reseller.primary_node_hostname).filter(Boolean)).size
  const highUsageCount = resellers.filter((reseller) => reseller.disk_pct >= 80 || reseller.bandwidth_pct >= 80).length

  const toggleResellerStatus = async (reseller: HostingReseller) => {
    const suspend = reseller.status !== "suspended"
    if (!window.confirm(`${suspend ? "Suspender" : "Reactivar"} el revendedor ${reseller.company_name || reseller.username}?`)) return
    try {
      const updated = suspend ? await hostingApi.suspendReseller(reseller.id) : await hostingApi.unsuspendReseller(reseller.id)
      setResellers((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setMessage(`${suspend ? "Revendedor suspendido" : "Revendedor reactivado"}: ${updated.company_name || updated.username}`)
    } catch (reason) {
      setError(readAdminError(reason, suspend ? "No se pudo suspender el revendedor." : "No se pudo reactivar el revendedor."))
    }
  }

  const viewAsReseller = async (reseller: HostingReseller) => {
    try {
      await authApi.impersonate(reseller.user_id)
      window.sessionStorage.setItem("eh_admin_view_reseller", String(reseller.user_id))
      window.location.assign("/")
    } catch (reason) {
      setError(readAdminError(reason, "No se pudo entrar como revendedor."))
    }
  }

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Clientes</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Revendedores</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Administracion global de cuentas revendedor, cupos asignados, recursos usados y distribucion por nodos.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreateModal(true)} size="sm">
            <Users className="h-4 w-4" />
            Anadir revendedor
          </Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Revendedores" value={String(resellers.length)} detail={`${activeCount} activos`} />
        <AdminMetric label="Cuentas permitidas" value={totalAllowed ? String(totalAllowed) : "Ilimitado"} detail={`${totalCreated} creadas`} />
        <AdminMetric label="Nodos usados" value={String(usedNodes)} detail="Asignacion principal" />
        <AdminMetric label="En observacion" value={String(highUsageCount)} detail="Consumo alto" />
      </section>

      <div className="eh-card overflow-hidden">
        {error ? <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
        {message ? <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">{message}</div> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <label className="flex h-9 w-[380px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input
              className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar revendedor, plan, correo..."
              value={search}
            />
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">Estado</Button>
            <Button disabled={isLoading} onClick={loadResellers} size="sm" variant="outline">Sincronizar</Button>
            <Button size="sm" variant="outline">Nodos</Button>
          </div>
        </div>

        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["Revendedor", "Contacto", "Plan", "Cuentas", "Disco", "Trafico", "Nodos", "Estado", "Acciones"].map((column) => (
                <th className="px-4 py-2 font-bold" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredResellers.map((reseller) => (
              <tr className="hover:bg-slate-50" key={reseller.id}>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900">{reseller.company_name || reseller.username}</div>
                  <div className="mt-1 text-xs text-slate-500">{reseller.username}</div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{reseller.email}</td>
                <td className="px-4 py-3">{reseller.plan_name || "Sin plan"}</td>
                <td className="px-4 py-3 font-semibold">{reseller.accounts_count} / {formatPlanLimit(reseller.max_accounts)}</td>
                <td className="px-4 py-3"><AdminMiniBar value={reseller.disk_pct} /></td>
                <td className="px-4 py-3"><AdminMiniBar value={reseller.bandwidth_pct} /></td>
                <td className="px-4 py-3">{reseller.primary_node_hostname || "Automatica"}</td>
                <td className="px-4 py-3"><AdminAccountStatusBadge status={reseller.status === "active" && reseller.is_active ? "Activa" : "Suspendida"} /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button onClick={() => setViewingReseller(reseller)} size="sm" variant="outline">Ver</Button>
                    <Button onClick={() => void viewAsReseller(reseller)} size="sm" variant="outline">Ver como Revendedor</Button>
                    <Button onClick={() => void toggleResellerStatus(reseller)} size="sm" variant="outline">
                      {reseller.status === "suspended" || !reseller.is_active ? "Reactivar" : "Suspender"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && filteredResellers.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={9}>
                  {resellers.length === 0 ? "No hay revendedores creados." : "No hay revendedores con ese filtro."}
                </td>
              </tr>
            ) : null}
            {isLoading ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={9}>Cargando revendedores reales...</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showCreateModal ? (
        <CreateAdminResellerModal
          nodes={nodes}
          onClose={() => setShowCreateModal(false)}
          onSaved={(reseller) => {
            setMessage(`Revendedor creado: ${reseller.company_name || reseller.username}`)
            setShowCreateModal(false)
            loadResellers()
          }}
          plans={plans}
        />
      ) : null}
      {viewingReseller ? <AdminResellerDetailModal onClose={() => setViewingReseller(null)} reseller={viewingReseller} /> : null}
    </div>
  )
}

function CreateAdminResellerModal({
  nodes,
  onClose,
  onSaved,
  plans,
}: {
  nodes: AdminNode[]
  onClose: () => void
  onSaved: (reseller: HostingReseller) => void
  plans: HostingPlan[]
}) {
  const firstPlan = plans[0]
  const firstNode = nodes[0]
  const [form, setForm] = useState({
    company_name: "",
    email: "",
    first_name: "",
    last_name: "",
    panel_domain: "",
    password: generateHostingPassword(),
    plan: firstPlan ? String(firstPlan.id) : "",
    primary_node: firstNode ? firstNode.id : "",
    username: "",
  })
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const selectedPlan = plans.find((plan) => String(plan.id) === form.plan)

  useEffect(() => {
    setForm((current) => ({
      ...current,
      plan: current.plan || (firstPlan ? String(firstPlan.id) : ""),
      primary_node: current.primary_node || (firstNode ? firstNode.id : ""),
    }))
  }, [firstNode, firstPlan])

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async () => {
    if (!form.company_name.trim() || !form.username.trim() || !form.email.trim() || !form.plan) {
      setError("Nombre comercial, usuario, correo y plan son obligatorios.")
      return
    }
    const payload: CreateHostingResellerPayload = {
      company_name: form.company_name.trim(),
      email: form.email.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      panel_domain: form.panel_domain.trim(),
      password: form.password,
      plan: Number(form.plan),
      primary_node: form.primary_node || null,
      username: form.username.trim(),
    }
    setIsSaving(true)
    setError("")
    try {
      onSaved(await hostingApi.createReseller(payload))
    } catch (reason) {
      setError(readAdminError(reason, "No se pudo crear el revendedor."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[860px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Anadir revendedor</h3>
            <p className="mt-1 text-sm text-slate-500">Alta real de usuario revendedor con plan, nodo principal y recursos bloqueados por plan.</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>

        {error ? <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700">{error}</div> : null}

        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_270px]">
          <section className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <PlanTextInput label="Nombre comercial" onChange={(value) => update("company_name", value)} value={form.company_name} />
              <PlanTextInput label="Usuario revendedor" onChange={(value) => update("username", value)} value={form.username} />
              <PlanTextInput label="Correo principal" onChange={(value) => update("email", value)} value={form.email} />
              <PlanTextInput label="Dominio del panel" onChange={(value) => update("panel_domain", value)} value={form.panel_domain} />
              <PlanTextInput label="Nombre contacto" onChange={(value) => update("first_name", value)} value={form.first_name} />
              <PlanTextInput label="Apellido contacto" onChange={(value) => update("last_name", value)} value={form.last_name} />
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Plan revendedor</span>
                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("plan", event.target.value)} value={form.plan}>
                  {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Nodo principal</span>
                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("primary_node", event.target.value)} value={form.primary_node}>
                  <option value="">Distribucion automatica</option>
                  {nodes.map((node) => <option key={node.id} value={node.id}>{node.hostname}</option>)}
                </select>
              </label>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Recursos asignados</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <AdminField label="Cuentas permitidas" readonly value={selectedPlan ? formatPlanLimit(resellerFeatureNumber(selectedPlan, "reseller_clients")) : "N/D"} />
                <AdminField label="Disco total" readonly value={selectedPlan ? formatPlanStorage(selectedPlan.disk_mb) : "N/D"} />
                <AdminField label="Trafico mensual" readonly value={selectedPlan ? formatPlanStorage(selectedPlan.bandwidth_mb) : "N/D"} />
                <AdminField label="Correos totales" readonly value={selectedPlan ? formatPlanLimit(selectedPlan.max_mailboxes) : "N/D"} />
                <AdminField label="Bases de datos" readonly value={selectedPlan ? formatPlanLimit(selectedPlan.max_databases) : "N/D"} />
                <AdminField label="Dominios" readonly value={selectedPlan ? formatPlanLimit(selectedPlan.max_domains) : "N/D"} />
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <div className="grid gap-3 md:grid-cols-[1fr_140px]">
                <PlanTextInput label="Contrasena inicial" onChange={(value) => update("password", value)} value={form.password} />
                <Button className="mt-5" onClick={() => update("password", generateHostingPassword())} size="sm" type="button" variant="outline">Generar</Button>
              </div>
            </div>
          </section>

          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="eh-kicker">Resumen inicial</div>
            <h4 className="mt-1 text-lg font-bold">Cuenta revendedor</h4>
            <div className="mt-4 space-y-2">
              <AdminStatus label="Tipo" value="Revendedor" />
              <AdminStatus label="Estado" value="Activo" />
              <AdminStatus label="Distribucion" value={nodes.find((node) => node.id === form.primary_node)?.hostname || "Automatica"} />
              <AdminStatus label="Panel" value={form.panel_domain || "White label opcional"} />
            </div>
          </aside>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">Cancelar</Button>
          <Button disabled={isSaving || plans.length === 0} onClick={() => void submit()} size="sm">{isSaving ? "Creando..." : "Crear revendedor"}</Button>
        </div>
      </div>
    </div>
  )
}

function AdminResellerDetailModal({ onClose, reseller }: { onClose: () => void; reseller: HostingReseller }) {
  const accountsPct = percent(reseller.accounts_count, reseller.max_accounts)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[900px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">{reseller.company_name || reseller.username}</h3>
            <p className="mt-1 text-sm text-slate-500">{reseller.plan_name || "Sin plan"} - {reseller.email}</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>
        <div className="grid gap-4 p-5 xl:grid-cols-[1fr_300px]">
          <section className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <AccountUsageCard detail={`${reseller.accounts_count} / ${formatPlanLimit(reseller.max_accounts)} creadas`} label="Cuentas" value={accountsPct} />
              <AccountUsageCard detail={`${formatMb(reseller.disk_used_mb)} de ${formatMb(reseller.disk_mb)}`} label="Disco" value={reseller.disk_pct} />
              <AccountUsageCard detail={`${formatMb(reseller.bandwidth_used_mb)} de ${formatMb(reseller.bandwidth_mb)}`} label="Trafico" value={reseller.bandwidth_pct} />
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="eh-kicker">Tendencia rapida</div>
              <svg className="mt-4 h-[150px] w-full" preserveAspectRatio="none" viewBox="0 0 420 150">
                <polyline fill="none" points={`0,${130 - reseller.disk_pct} 90,${118 - reseller.disk_pct / 1.8} 180,${120 - reseller.bandwidth_pct / 2} 300,${112 - reseller.bandwidth_pct / 1.6} 420,${125 - accountsPct / 2}`} stroke="#2563eb" strokeLinecap="round" strokeWidth="4" />
                <polyline fill="none" points={`0,${132 - accountsPct / 2} 90,${126 - accountsPct / 1.7} 180,${118 - reseller.disk_pct / 2} 300,${124 - reseller.bandwidth_pct / 2.2} 420,${116 - reseller.disk_pct / 1.8}`} stroke="#10b981" strokeLinecap="round" strokeWidth="3" />
              </svg>
            </div>
          </section>
          <aside className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="eh-kicker">Detalle</div>
            <div className="mt-3 space-y-2">
              <AdminStatus label="Usuario" value={reseller.username} />
              <AdminStatus label="Estado" value={reseller.status === "active" && reseller.is_active ? "Activo" : "Suspendido"} />
              <AdminStatus label="Nodo principal" value={reseller.primary_node_hostname || "Automatica"} />
              <AdminStatus label="Panel" value={reseller.panel_domain || "Sin white label"} />
              <AdminStatus label="Cuentas activas" value={String(reseller.active_accounts_count)} />
              <AdminStatus label="Suspendidas" value={String(reseller.suspended_accounts_count)} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

const adminResellersMock = [
  {
    accounts: "54 / 80",
    contact: "admin@revendedor-demo.com",
    disk: 57,
    name: "Revendedor Demo SRL",
    nodes: "2 nodos",
    plan: "Reseller Business 80",
    status: "Activo",
    traffic: 56,
  },
  {
    accounts: "18 / 30",
    contact: "soporte@hostingnorte.com",
    disk: 41,
    name: "Hosting Norte",
    nodes: "1 nodo",
    plan: "Reseller Starter 30",
    status: "Activo",
    traffic: 33,
  },
  {
    accounts: "92 / 120",
    contact: "ops@agenciacloud.net",
    disk: 78,
    name: "Agencia Cloud",
    nodes: "3 nodos",
    plan: "Reseller Pro 120",
    status: "Observacion",
    traffic: 72,
  },
  {
    accounts: "0 / 20",
    contact: "admin@legacyhost.net",
    disk: 0,
    name: "Legacy Host",
    nodes: "0 nodos",
    plan: "Reseller Starter 20",
    status: "Suspendido",
    traffic: 0,
  },
]

function AdminResellersMockPage() {
  const [showCreateModal, setShowCreateModal] = useState(false)

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Clientes</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Revendedores</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Administracion global de cuentas revendedor, cupos asignados, recursos usados y distribucion por nodos.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreateModal(true)} size="sm">
            <Users className="h-4 w-4" />
            AÃ±adir revendedor
          </Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Revendedores" value="4" detail="3 activos" />
        <AdminMetric label="Cuentas permitidas" value="250" detail="164 creadas" />
        <AdminMetric label="Nodos usados" value="6" detail="Distribuidos" />
        <AdminMetric label="En observacion" value="1" detail="Consumo alto" />
      </section>

      <div className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex h-9 w-[380px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            Buscar revendedor, plan, correo...
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">Estado</Button>
            <Button size="sm" variant="outline">Plan</Button>
            <Button size="sm" variant="outline">Nodos</Button>
          </div>
        </div>

        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["Revendedor", "Contacto", "Plan", "Cuentas", "Disco", "Trafico", "Nodos", "Estado", "Acciones"].map((column) => (
                <th className="px-4 py-2 font-bold" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {adminResellersMock.map((reseller) => (
              <tr className="hover:bg-slate-50" key={reseller.name}>
                <td className="px-4 py-3 font-semibold text-slate-900">{reseller.name}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{reseller.contact}</td>
                <td className="px-4 py-3">{reseller.plan}</td>
                <td className="px-4 py-3 font-semibold">{reseller.accounts}</td>
                <td className="px-4 py-3"><AdminMiniBar value={reseller.disk} /></td>
                <td className="px-4 py-3"><AdminMiniBar value={reseller.traffic} /></td>
                <td className="px-4 py-3">{reseller.nodes}</td>
                <td className="px-4 py-3"><AdminAccountStatusBadge status={reseller.status === "Observacion" ? "Pendiente" : reseller.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline">Ver</Button>
                    <Button size="sm" variant="outline">Editar</Button>
                    <Button size="sm" variant="outline">Suspender</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal ? <CreateAdminResellerMockModal onClose={() => setShowCreateModal(false)} /> : null}
    </div>
  )
}

function CreateAdminResellerMockModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[860px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">AÃ±adir revendedor</h3>
            <p className="mt-1 text-sm text-slate-500">Alta mock para crear una cuenta de hosting tipo revendedor con cupos y recursos asignados.</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_270px]">
          <section className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <AdminField label="Nombre comercial" readonly={false} value="" />
              <AdminField label="Usuario revendedor" readonly={false} value="" />
              <AdminField label="Correo principal" readonly={false} value="" />
              <AdminField label="Dominio del panel" readonly={false} value="" />
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Plan revendedor</span>
                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500">
                  <option>Reseller Starter 30</option>
                  <option>Reseller Business 80</option>
                  <option>Reseller Pro 120</option>
                  <option>Plan personalizado</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Nodo principal</span>
                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500">
                  <option>node-miami-01</option>
                  <option>node-dallas-02</option>
                  <option>Distribucion automatica</option>
                </select>
              </label>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Recursos asignados</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <AdminField label="Cuentas permitidas" readonly={false} value="" />
                <AdminField label="Disco total" readonly={false} value="" />
                <AdminField label="Trafico mensual" readonly={false} value="" />
                <AdminField label="Correos totales" readonly={false} value="" />
                <AdminField label="Bases de datos" readonly={false} value="" />
                <AdminField label="Dominios" readonly={false} value="" />
              </div>
            </div>
          </section>

          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="eh-kicker">Resumen inicial</div>
            <h4 className="mt-1 text-lg font-bold">Cuenta revendedor</h4>
            <div className="mt-4 space-y-2">
              <AdminStatus label="Tipo" value="Revendedor" />
              <AdminStatus label="Estado" value="Activo" />
              <AdminStatus label="Distribucion" value="Nodo o automatica" />
              <AdminStatus label="Panel" value="White label opcional" />
            </div>
          </aside>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">Cancelar</Button>
          <Button onClick={onClose} size="sm">Crear revendedor</Button>
        </div>
      </div>
    </div>
  )
}

void AdminResellersMockPage

const adminMigrations = [
  {
    account: "cliente-demo.com",
    currentStep: "Restaurando bases de datos",
    destination: "node-miami-01",
    origin: "cPanel externo - 203.0.113.80",
    progress: 74,
    status: "En proceso",
    type: "Cuenta completa",
  },
  {
    account: "tiendasol.com",
    currentStep: "Copiando archivos",
    destination: "node-dallas-02",
    origin: "Plesk externo - backup URL",
    progress: 42,
    status: "En proceso",
    type: "Archivos + correo",
  },
  {
    account: "agencianorte.net",
    currentStep: "Validacion final",
    destination: "node-miami-01",
    origin: "Servidor interno legacy-node-03",
    progress: 92,
    status: "Verificando",
    type: "Servidor interno",
  },
  {
    account: "legalrivera.bo",
    currentStep: "Esperando credenciales",
    destination: "node-sp-01",
    origin: "DirectAdmin externo",
    progress: 10,
    status: "Pausada",
    type: "Cuenta completa",
  },
]

function AdminMigrationsPage() {
  const [migrations, setMigrations] = useState<MigrationRun[]>([])
  const [nodes, setNodes] = useState<AdminNode[]>([])
  const [selectedMigration, setSelectedMigration] = useState<MigrationRun | null>(null)
  const [showCreateMigration, setShowCreateMigration] = useState(false)
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const loadMigrations = () => {
    setIsLoading(true)
    Promise.all([hostingApi.migrationRuns({ import_flow: false, ...(search ? { search } : {}) }), adminApi.nodes()])
      .then(([migrationPage, nodePage]) => {
        setMigrations(migrationPage.results)
        setNodes(nodePage.results)
        setSelectedMigration((current) => migrationPage.results.find((item) => item.id === current?.id) ?? migrationPage.results[0] ?? null)
        setError("")
      })
      .catch((reason) => setError(readAdminError(reason, "No se pudieron cargar las migraciones.")))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadMigrations()
    const timer = window.setInterval(loadMigrations, 10000)
    return () => window.clearInterval(timer)
  }, [])

  const visibleMigrations = migrations.filter((migration) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return [
      migration.account_label,
      migration.origin,
      migration.destination_node_hostname,
      migration.current_step,
      migration.status,
      migration.source.provider_label,
    ].some((value) => String(value).toLowerCase().includes(term))
  })
  const activeCount = migrations.filter((migration) => ["discovering", "queued", "running"].includes(migration.status)).length
  const verifyingCount = migrations.filter((migration) => migration.current_step.toLowerCase().includes("verificar")).length
  const pausedCount = migrations.filter((migration) => migration.status === "paused").length
  const averageProgress = migrations.length ? Math.round(migrations.reduce((total, migration) => total + migration.progress_percent, 0) / migrations.length) : 0

  const activeMigration = selectedMigration ?? visibleMigrations[0]
  const detailSteps = migrationStepsForRun(activeMigration)

  const pauseMigration = async () => {
    if (!activeMigration) return
    try {
      const updated = await hostingApi.pauseMigrationRun(activeMigration.id)
      setMessage(`Migracion pausada: ${updated.account_label}`)
      loadMigrations()
    } catch (reason) {
      setError(readAdminError(reason, "No se pudo pausar la migracion."))
    }
  }

  const retryMigration = async () => {
    if (!activeMigration) return
    try {
      if (activeMigration.status === "analyzed") {
        const response = await hostingApi.startMigrationRun(activeMigration.id, { concurrency: activeMigration.concurrency })
        setMessage(`${response.queued} cuentas enviadas a migracion.`)
      } else {
        await hostingApi.rediscoverMigrationRun(activeMigration.id)
        setMessage("Analisis reenviado al agente.")
      }
      loadMigrations()
    } catch (reason) {
      setError(readAdminError(reason, "No se pudo reintentar la migracion."))
    }
  }

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Import className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Clientes</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Migraciones</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Seguimiento de importaciones desde paneles externos o servidores internos hacia nodos EHPanel.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreateMigration(true)} size="sm">Nueva migracion</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="En proceso" value={String(activeCount)} detail={isLoading ? "Sincronizando..." : "Discovery o copia"} />
        <AdminMetric label="Verificando" value={String(verifyingCount)} detail="Revision final" />
        <AdminMetric label="Pausadas" value={String(pausedCount)} detail="Detenidas por admin" />
        <AdminMetric label="Promedio progreso" value={`${averageProgress}%`} detail={`${migrations.length} tareas`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="eh-card overflow-hidden">
          {error ? <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
          {message ? <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">{message}</div> : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <label className="flex h-9 w-[360px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              <input
                className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") loadMigrations()
                }}
                placeholder="Buscar cuenta, origen o destino..."
                value={search}
              />
            </label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">Estado</Button>
              <Button disabled={isLoading} onClick={loadMigrations} size="sm" variant="outline">Sincronizar</Button>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {visibleMigrations.map((migration) => (
              <button
                className={cn("block w-full px-4 py-3 text-left hover:bg-slate-50", activeMigration?.id === migration.id && "bg-blue-50")}
                key={migration.id}
                onClick={() => setSelectedMigration(migration)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{migration.account_label}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {migration.origin} {" -> "} {migration.destination_node_hostname}
                    </p>
                  </div>
                  <MigrationStatusBadge status={migrationStatusLabel(migration.status)} />
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
                    <span>{migration.current_step || "Preparando"}</span>
                    <span>{migration.progress_percent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-blue-600" style={{ width: `${migration.progress_percent}%` }} />
                  </div>
                </div>
              </button>
            ))}
            {!isLoading && visibleMigrations.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">No hay migraciones reales registradas.</div>
            ) : null}
            {isLoading ? <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">Cargando migraciones reales...</div> : null}
          </div>
        </div>

        <div className="eh-card p-4">
          {activeMigration ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="eh-kicker">Detalle</div>
                  <h3 className="mt-1 text-lg font-bold">{activeMigration.account_label}</h3>
                  <p className="mt-1 text-sm text-slate-500">{migrationTypeLabel(activeMigration.migration_type)}</p>
                </div>
                <MigrationStatusBadge status={migrationStatusLabel(activeMigration.status)} />
              </div>

              <div className="mt-4 grid gap-2">
                <AdminStatus label="Origen" value={activeMigration.origin} />
                <AdminStatus label="Destino" value={activeMigration.destination_node_hostname} />
                <AdminStatus label="Paso actual" value={activeMigration.current_step || "Preparando"} />
                <AdminStatus label="Progreso" value={`${activeMigration.progress_percent}%`} />
                <AdminStatus label="Concurrencia" value={`${activeMigration.concurrency} cuenta(s)`} />
              </div>

              <div className="mt-5">
                <h4 className="text-sm font-bold">Pasos de migracion</h4>
                <div className="mt-3 space-y-2">
                  {detailSteps.map((step, index) => (
                    <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2" key={step.label}>
                      <div className={cn("grid h-6 w-6 place-items-center rounded-full text-xs font-bold", step.done ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500")}>
                        {index + 1}
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-bold">Cuentas</p>
                <p className="mt-1 text-xs text-slate-500">
                  {activeMigration.completed_accounts} completadas / {activeMigration.failed_accounts} fallidas / {activeMigration.total_accounts} detectadas
                </p>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button disabled={activeMigration.status === "completed"} onClick={() => void pauseMigration()} size="sm" variant="outline">Pausar</Button>
                <Button onClick={() => void retryMigration()} size="sm" variant="outline">Reintentar paso</Button>
                <Button onClick={() => setMessage(activeMigration.logs[0]?.message || "Sin logs recientes.")} size="sm">Ver logs</Button>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-sm font-semibold text-slate-500">Selecciona o crea una migracion.</div>
          )}
        </div>
      </section>

      {showCreateMigration && (
        <CreateAdminMigrationModal
          nodes={nodes}
          onClose={() => setShowCreateMigration(false)}
          onSaved={(migration) => {
            setMessage(`Migracion creada: ${migration.origin}`)
            setShowCreateMigration(false)
            loadMigrations()
          }}
        />
      )}
    </div>
  )
}

function CreateAdminMigrationModal({ nodes, onClose, onSaved }: { nodes: AdminNode[]; onClose: () => void; onSaved: (migration: MigrationRun) => void }) {
  const [form, setForm] = useState({
    provider: "cpanel" as MigrationProvider,
    destination_node: nodes[0]?.id ?? "",
    host: "",
    username: "",
    secret: "",
    port: "22",
    migration_type: "full",
    mode: "select_and_migrate",
    priority: "normal",
    concurrency: "1",
    notes: "",
    preserve_mail_passwords: true,
  })
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setForm((current) => ({ ...current, destination_node: current.destination_node || nodes[0]?.id || "" }))
  }, [nodes])

  const update = (key: keyof typeof form, value: string | boolean | MigrationProvider) => setForm((current) => ({ ...current, [key]: value }))
  const providerEnabled = form.provider === "cpanel" || form.provider === "plesk"

  const submit = async () => {
    if (!providerEnabled) {
      setError("Ese origen queda en desarrollo. Por ahora se habilita cPanel/WHM y Plesk.")
      return
    }
    if (!form.destination_node || !form.host.trim() || !form.username.trim()) {
      setError("Origen, destino, host y usuario son obligatorios.")
      return
    }
    const payload: CreateMigrationRunPayload = {
      auth_method: "password",
      concurrency: Math.max(1, Math.min(5, numberFromText(form.concurrency, 1))),
      destination_node: form.destination_node,
      host: form.host.trim(),
      include_databases: form.migration_type !== "mail_only",
      include_files: form.migration_type !== "mail_only",
      include_mail: form.migration_type !== "files_databases",
      include_subdomains: true,
      migration_type: form.migration_type,
      mode: form.mode as CreateMigrationRunPayload["mode"],
      notes: form.notes,
      port: numberFromText(form.port, 22),
      preserve_mail_passwords: form.preserve_mail_passwords,
      priority: form.priority,
      provider: form.provider,
      secret: form.secret,
      username: form.username.trim(),
    }
    setIsSaving(true)
    setError("")
    try {
      onSaved(await hostingApi.createMigrationRun(payload))
    } catch (reason) {
      setError(readAdminError(reason, "No se pudo crear la migracion."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[920px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Nueva migracion</h3>
            <p className="mt-1 text-sm text-slate-500">Importar cuentas desde otro panel, un backup remoto o un servidor interno EHPanel.</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>
        {error ? <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700">{error}</div> : null}

        <div className="p-5">
          <section className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Origen y destino</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Origen</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("provider", event.target.value as MigrationProvider)} value={form.provider}>
                    <option value="cpanel">cPanel / WHM</option>
                    <option value="plesk">Plesk</option>
                    <option value="directadmin">DirectAdmin - en desarrollo</option>
                    <option value="backup_url">Backup URL - en desarrollo</option>
                    <option value="ehpanel">Servidor interno EHPanel - en desarrollo</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Servidor destino</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("destination_node", event.target.value)} value={form.destination_node}>
                    {nodes.map((node) => <option key={node.id} value={node.id}>{node.hostname}</option>)}
                  </select>
                </label>
                <MigrationTextInput label="IP / Host / URL origen" onChange={(value) => update("host", value)} value={form.host} />
                <MigrationTextInput label="Usuario o token" onChange={(value) => update("username", value)} value={form.username} />
                <MigrationTextInput label="Clave / API key" onChange={(value) => update("secret", value)} type="password" value={form.secret} />
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Tipo de migracion</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("migration_type", event.target.value)} value={form.migration_type}>
                    <option value="full">Cuenta completa</option>
                    <option value="files_databases">Archivos + bases de datos</option>
                    <option value="mail_only">Correos solamente</option>
                    <option value="multiple_accounts">Multiples cuentas</option>
                    <option value="server_full">Servidor completo</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Proceso de importacion</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Modo</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("mode", event.target.value)} value={form.mode}>
                    <option value="select_and_migrate">Detectar cuentas y restaurar una por una</option>
                    <option value="auto_migrate_all">Restaurar todas automaticamente</option>
                    <option value="discover_only">Solo analizar y generar reporte</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Prioridad</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("priority", event.target.value)} value={form.priority}>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                    <option value="low">Baja / segundo plano</option>
                  </select>
                </label>
                <MigrationTextInput label="Concurrencia maxima" onChange={(value) => update("concurrency", value)} type="number" value={form.concurrency} />
                <MigrationTextInput label="Puerto SSH/API" onChange={(value) => update("port", value)} type="number" value={form.port} />
                <label className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                  Preservar claves de correo si el hash es compatible
                  <input checked={form.preserve_mail_passwords} className="h-4 w-4" onChange={(event) => update("preserve_mail_passwords", event.target.checked)} type="checkbox" />
                </label>
                <label className="md:col-span-2">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Notas de la migracion</span>
                  <textarea
                    className="min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-blue-500"
                    onChange={(event) => update("notes", event.target.value)}
                    placeholder="Credenciales temporales, rutas especiales, cuentas que se deben omitir..."
                    value={form.notes}
                  />
                </label>
              </div>
            </div>
          </section>

          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="eh-kicker">Flujo previsto</div>
            <h4 className="mt-1 text-lg font-bold">Pasos que se mostraran</h4>
            <div className="mt-4 space-y-2">
              {migrationDefaultSteps.map((step, index) => (
                <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold" key={step}>
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{index + 1}</span>
                  {step}
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">Cancelar</Button>
          <Button disabled={isSaving || nodes.length === 0} onClick={() => void submit()} size="sm">{isSaving ? "Analizando..." : "Analizar origen"}</Button>
        </div>
      </div>
    </div>
  )
}

function MigrationTextInput({ label, onChange, type = "text", value }: { label: string; onChange: (value: string) => void; type?: "number" | "password" | "text"; value: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      <input
        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500"
        min={type === "number" ? 1 : undefined}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  )
}

const migrationDefaultSteps = ["Conectar origen", "Analizar cuentas detectadas", "Seleccionar cuentas a restaurar", "Copiar archivos", "Migrar bases y correos", "Verificar destino"]

function migrationStepsForRun(run?: MigrationRun | null) {
  if (!run) return migrationDefaultSteps.map((label) => ({ done: false, label }))
  if (run.steps.length) return run.steps.map((step) => ({ done: ["completed", "skipped"].includes(step.status), label: step.label }))
  return migrationDefaultSteps.map((label, index) => ({ done: run.progress_percent >= [10, 25, 35, 55, 80, 100][index], label }))
}

function migrationStatusLabel(status: string) {
  if (status === "discovering") return "En proceso"
  if (status === "running" || status === "queued") return "En proceso"
  if (status === "analyzed") return "Verificando"
  if (status === "paused") return "Pausada"
  if (status === "completed") return "Completada"
  if (status === "failed") return "Fallido"
  return "Pendiente"
}

function migrationTypeLabel(type: string) {
  if (type === "files_databases") return "Archivos + bases de datos"
  if (type === "mail_only") return "Correos solamente"
  if (type === "multiple_accounts") return "Multiples cuentas"
  if (type === "server_full") return "Servidor completo"
  return "Cuenta completa"
}

function AdminImportsPage() {
  const [imports, setImports] = useState<MigrationRun[]>([])
  const [nodes, setNodes] = useState<AdminNode[]>([])
  const [selectedImport, setSelectedImport] = useState<MigrationRun | null>(null)
  const [showCreateImport, setShowCreateImport] = useState(false)
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState("")

  const loadImports = () => {
    setIsLoading(true)
    Promise.all([hostingApi.migrationRuns({ import_flow: true, search: search.trim() || undefined }), adminApi.nodes()])
      .then(([importPage, nodePage]) => {
        setImports(importPage.results)
        setNodes(nodePage.results)
        setSelectedImport((current) => importPage.results.find((item) => item.id === current?.id) ?? importPage.results[0] ?? null)
        setMessage("")
      })
      .catch((reason) => setMessage(readAdminError(reason, "No se pudieron cargar las importaciones.")))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadImports()
    const timer = window.setInterval(loadImports, 10000)
    return () => window.clearInterval(timer)
  }, [])

  const activeImport = selectedImport ?? imports[0]
  const queued = imports.filter((item) => ["draft", "analyzed", "queued"].includes(item.status)).length
  const running = imports.filter((item) => item.status === "running" || item.status === "discovering").length
  const completed = imports.filter((item) => item.status === "completed").length

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Import className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Backups externos</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Importaciones</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Restauracion desde backups de cPanel, Plesk, DirectAdmin, EHPanel u otro panel. Este flujo es por archivo o URL, no servidor-a-servidor.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreateImport(true)} size="sm">Nueva importacion</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Importaciones" value={String(imports.length)} detail={isLoading ? "Sincronizando..." : "Backups registrados"} />
        <AdminMetric label="Pendientes" value={String(queued)} detail="Esperando analisis" />
        <AdminMetric label="En proceso" value={String(running)} detail="Analisis o restauracion" />
        <AdminMetric label="Completadas" value={String(completed)} detail="Finalizadas" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[390px_1fr]">
        <div className="eh-card overflow-hidden">
          {message ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">{message}</div> : null}
          <div className="border-b border-slate-200 p-3">
            <div className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              <input
                className="h-full flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") loadImports()
                }}
                placeholder="Buscar dominio, URL, archivo o nodo..."
                value={search}
              />
              <button className="text-xs font-bold text-blue-700" onClick={loadImports} type="button">Buscar</button>
            </div>
          </div>
          <div className="max-h-[680px] divide-y divide-slate-100 overflow-auto">
            {imports.map((item) => (
              <button className={cn("block w-full px-4 py-3 text-left hover:bg-slate-50", activeImport?.id === item.id && "bg-blue-50")} key={item.id} onClick={() => setSelectedImport(item)} type="button">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900">{item.account_label}</div>
                    <div className="mt-1 text-xs text-slate-500">{importSourceLabel(item)} Â· {item.destination_node_hostname}</div>
                  </div>
                  <MigrationStatusBadge status={migrationStatusLabel(item.status)} />
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-slate-200">
                  <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${item.progress_percent}%` }} />
                </div>
              </button>
            ))}
            {!isLoading && imports.length === 0 ? <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">No hay importaciones registradas.</div> : null}
            {isLoading ? <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">Cargando importaciones...</div> : null}
          </div>
        </div>

        {activeImport ? (
          <div className="eh-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="eh-kicker">{importPanelLabel(activeImport)}</div>
                <h3 className="mt-1 text-lg font-bold">{activeImport.account_label}</h3>
                <p className="mt-1 text-sm text-slate-500">{importSourceLabel(activeImport)}</p>
              </div>
              <MigrationStatusBadge status={migrationStatusLabel(activeImport.status)} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <AdminStatus label="Destino" value={activeImport.destination_node_hostname} />
              <AdminStatus label="Paso actual" value={activeImport.current_step || "Registrada"} />
              <AdminStatus label="Progreso" value={`${activeImport.progress_percent}%`} />
              <AdminStatus label="Tipo" value={migrationTypeLabel(activeImport.migration_type)} />
            </div>
            <div className="mt-5 rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3 font-bold">Proceso de importacion</div>
              <div className="grid gap-3 p-4 md:grid-cols-2">
                {migrationStepsForRun(activeImport).map((step) => (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={step.label}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{step.label}</span>
                      <span className={cn("rounded-full px-2 py-1 text-xs font-bold", step.done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>{step.done ? "Listo" : "Pendiente"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3 font-bold">Logs recientes</div>
              <div className="divide-y divide-slate-100">
                {activeImport.logs.length ? activeImport.logs.map((log) => (
                  <div className="px-4 py-3 text-sm" key={log.id}>
                    <div className="font-semibold text-slate-900">{log.message}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatDateTime(log.created_at)} Â· {log.level}</div>
                  </div>
                )) : <div className="px-4 py-6 text-center text-sm font-semibold text-slate-500">Sin logs todavia.</div>}
              </div>
            </div>
          </div>
        ) : (
          <div className="eh-card p-8 text-center text-sm font-semibold text-slate-500">Selecciona una importacion.</div>
        )}
      </section>

      {showCreateImport ? (
        <CreateAdminImportModal
          nodes={nodes}
          onClose={() => setShowCreateImport(false)}
          onSaved={(created) => {
            setShowCreateImport(false)
            setImports((current) => [created, ...current])
            setSelectedImport(created)
          }}
        />
      ) : null}
    </div>
  )
}

function CreateAdminImportModal({ nodes, onClose, onSaved }: { nodes: AdminNode[]; onClose: () => void; onSaved: (importRun: MigrationRun) => void }) {
  const [form, setForm] = useState({
    account_label: "",
    backup_url: "",
    destination_node: nodes[0]?.id || "",
    import_source: "file_upload" as CreateImportRunPayload["import_source"],
    include_databases: true,
    include_files: true,
    include_mail: true,
    include_subdomains: true,
    migration_type: "full",
    notes: "",
    panel_type: "cpanel" as CreateImportRunPayload["panel_type"],
    preserve_mail_passwords: true,
    priority: "normal",
  })
  const [backupFile, setBackupFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const update = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setError("")
    try {
      onSaved(await hostingApi.createImportRun({ ...form, backup_file: backupFile }))
    } catch (reason) {
      setError(readAdminError(reason, "No se pudo crear la importacion."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <form className="w-full max-w-[900px] overflow-hidden rounded-lg bg-white shadow-2xl" onSubmit={(event) => void submit(event)}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Nueva importacion</h3>
            <p className="mt-1 text-sm text-slate-500">Carga un backup desde tu PC o desde una URL remota.</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>
        {error ? <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700">{error}</div> : null}

        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_280px]">
          <section className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Origen del backup</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Tipo de panel</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("panel_type", event.target.value)} value={form.panel_type}>
                    <option value="cpanel">cPanel / WHM</option>
                    <option value="plesk">Plesk</option>
                    <option value="directadmin">DirectAdmin</option>
                    <option value="ehpanel">EHPanel Web</option>
                    <option value="generic">Backup generico</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Metodo</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("import_source", event.target.value)} value={form.import_source}>
                    <option value="file_upload">Subir archivo desde PC</option>
                    <option value="remote_url">Usar URL remota</option>
                  </select>
                </label>
                {form.import_source === "file_upload" ? (
                  <label className="block md:col-span-2">
                    <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Archivo backup</span>
                    <input className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => setBackupFile(event.target.files?.[0] || null)} type="file" />
                  </label>
                ) : (
                  <MigrationTextInput label="URL del backup" onChange={(value) => update("backup_url", value)} value={form.backup_url} />
                )}
                <MigrationTextInput label="Dominio o etiqueta" onChange={(value) => update("account_label", value)} value={form.account_label} />
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Nodo destino</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("destination_node", event.target.value)} value={form.destination_node}>
                    <option value="">Seleccionar nodo</option>
                    {nodes.map((node) => <option key={node.id} value={node.id}>{node.hostname}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Contenido a restaurar</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Tipo</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("migration_type", event.target.value)} value={form.migration_type}>
                    <option value="full">Completa</option>
                    <option value="files_databases">Archivos y bases</option>
                    <option value="mail_only">Solo correo</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Prioridad</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("priority", event.target.value)} value={form.priority}>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                    <option value="low">Baja</option>
                  </select>
                </label>
                {[
                  ["include_files", "Archivos"],
                  ["include_databases", "Bases de datos"],
                  ["include_mail", "Correos"],
                  ["include_subdomains", "Subdominios"],
                  ["preserve_mail_passwords", "Preservar claves de correo si el backup lo permite"],
                ].map(([key, label]) => (
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700" key={key}>
                    <input checked={Boolean(form[key as keyof typeof form])} onChange={(event) => update(key as keyof typeof form, event.target.checked)} type="checkbox" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </section>

          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="eh-kicker">Notas</div>
            <h4 className="mt-1 text-lg font-bold">Restauracion desde backup</h4>
            <textarea className="mt-4 min-h-36 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("notes", event.target.value)} placeholder="Origen, fecha del backup, observaciones..." value={form.notes} />
            <p className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
              Esto registra el backup y lo deja listo para analisis/restauracion. Los SSL y configuraciones extra no se importan.
            </p>
          </aside>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm" type="button" variant="outline">Cancelar</Button>
          <Button disabled={isSaving || !form.destination_node} size="sm" type="submit">{isSaving ? "Guardando..." : "Crear importacion"}</Button>
        </div>
      </form>
    </div>
  )
}

function importPanelLabel(run: MigrationRun) {
  const panel = typeof run.options?.panel_type === "string" ? run.options.panel_type : run.source.username
  if (panel === "cpanel") return "cPanel / WHM"
  if (panel === "plesk") return "Plesk"
  if (panel === "directadmin") return "DirectAdmin"
  if (panel === "ehpanel") return "EHPanel Web"
  return "Backup generico"
}

function importSourceLabel(run: MigrationRun) {
  const source = typeof run.options?.import_source === "string" ? run.options.import_source : ""
  const artifact = isRecord(run.options?.artifact) ? run.options.artifact : {}
  if (source === "file_upload") return `Archivo: ${String(artifact.file_name || run.source.host).replace("uploaded:", "")}`
  return `URL: ${String(artifact.backup_url || run.source.host)}`
}

function AdminExportsPage() {
  const [exports, setExports] = useState<HostingAccountExport[]>([])
  const [accounts, setAccounts] = useState<HostingAccount[]>([])
  const [selectedExport, setSelectedExport] = useState<HostingAccountExport | null>(null)
  const [showCreateExport, setShowCreateExport] = useState(false)
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const loadExports = () => {
    setIsLoading(true)
    Promise.all([hostingApi.accountExports({ search: search.trim() || undefined }), hostingApi.accounts()])
      .then(([exportPage, accountPage]) => {
        setExports(exportPage.results)
        setAccounts(accountPage.results)
        setSelectedExport((current) => exportPage.results.find((item) => item.id === current?.id) ?? exportPage.results[0] ?? null)
        setMessage("")
      })
      .catch((reason) => setMessage(readAdminError(reason, "No se pudieron cargar las exportaciones.")))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadExports()
    const timer = window.setInterval(loadExports, 10000)
    return () => window.clearInterval(timer)
  }, [])

  const activeExport = selectedExport ?? exports[0]
  const queued = exports.filter((item) => item.status === "queued").length
  const running = exports.filter((item) => item.status === "running").length
  const completed = exports.filter((item) => item.status === "completed").length

  const downloadExport = async (item: HostingAccountExport) => {
    setDownloadingId(item.id)
    setMessage("")
    try {
      const response = await hostingApi.downloadAccountExport(item.id)
      const url = URL.createObjectURL(response.blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = response.filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudo descargar la exportacion."))
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <FileDown className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Backups salientes</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Exportaciones</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Genera copias descargables de cuentas EHPanel con archivos, bases de datos, correos y subdominios.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreateExport(true)} size="sm">Nueva exportacion</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Exportaciones" value={String(exports.length)} detail={isLoading ? "Sincronizando..." : "Copias registradas"} />
        <AdminMetric label="Pendientes" value={String(queued)} detail="Esperando agente" />
        <AdminMetric label="En proceso" value={String(running)} detail="Generando archivo" />
        <AdminMetric label="Completadas" value={String(completed)} detail="Listas para descargar" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[390px_1fr]">
        <div className="eh-card overflow-hidden">
          {message ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">{message}</div> : null}
          <div className="border-b border-slate-200 p-3">
            <div className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              <input
                className="h-full flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") loadExports()
                }}
                placeholder="Buscar dominio, usuario, nodo o archivo..."
                value={search}
              />
              <button className="text-xs font-bold text-blue-700" onClick={loadExports} type="button">Buscar</button>
            </div>
          </div>
          <div className="max-h-[680px] divide-y divide-slate-100 overflow-auto">
            {exports.map((item) => (
              <button className={cn("block w-full px-4 py-3 text-left hover:bg-slate-50", activeExport?.id === item.id && "bg-blue-50")} key={item.id} onClick={() => setSelectedExport(item)} type="button">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900">{item.account_domain}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.account_username} Â· {item.node_hostname || "Nodo N/D"}</div>
                  </div>
                  <AdminStatusBadge status={accountExportStatusLabel(item.status)} />
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-slate-200">
                  <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${accountExportProgress(item.status)}%` }} />
                </div>
              </button>
            ))}
            {!isLoading && exports.length === 0 ? <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">No hay exportaciones registradas.</div> : null}
            {isLoading ? <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">Cargando exportaciones...</div> : null}
          </div>
        </div>

        {activeExport ? (
          <div className="eh-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="eh-kicker">{accountExportTypeLabel(activeExport.export_type)}</div>
                <h3 className="mt-1 text-lg font-bold">{activeExport.account_domain}</h3>
                <p className="mt-1 text-sm text-slate-500">{activeExport.account_username} Â· {activeExport.node_hostname || "Nodo N/D"}</p>
              </div>
              <div className="flex items-center gap-2">
                <AdminStatusBadge status={accountExportStatusLabel(activeExport.status)} />
                <Button
                  disabled={activeExport.status !== "completed" || downloadingId === activeExport.id}
                  onClick={() => void downloadExport(activeExport)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {downloadingId === activeExport.id ? "Descargando..." : "Descargar"}
                </Button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <AdminStatus label="Contenido" value={accountExportIncludesLabel(activeExport)} />
              <AdminStatus label="Tamano" value={formatBytes(activeExport.size_bytes)} />
              <AdminStatus label="Archivo" value={activeExport.filename || "Pendiente"} />
              <AdminStatus label="Creada" value={formatDateTime(activeExport.created_at)} />
            </div>
            <div className="mt-5 rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3 font-bold">Estado de generacion</div>
              <div className="grid gap-3 p-4 md:grid-cols-2">
                {accountExportSteps(activeExport).map((step) => (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={step.label}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{step.label}</span>
                      <span className={cn("rounded-full px-2 py-1 text-xs font-bold", step.done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>{step.done ? "Listo" : "Pendiente"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3 font-bold">Detalles del archivo</div>
              <div className="grid gap-2 p-4">
                <AdminStatus label="Ruta reportada" value={activeExport.archive_path || "Pendiente"} />
                <AdminStatus label="Job agente" value={activeExport.last_job ? String(activeExport.last_job) : "N/D"} />
                <AdminStatus label="Estado job" value={activeExport.job_status || "N/D"} />
                {activeExport.error_detail ? <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{activeExport.error_detail}</div> : null}
                {activeExport.notes ? <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{activeExport.notes}</div> : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="eh-card p-8 text-center text-sm font-semibold text-slate-500">Selecciona una exportacion.</div>
        )}
      </section>

      {showCreateExport ? (
        <CreateAdminExportModal
          accounts={accounts}
          onClose={() => setShowCreateExport(false)}
          onSaved={(created) => {
            setShowCreateExport(false)
            setExports((current) => [created, ...current])
            setSelectedExport(created)
          }}
        />
      ) : null}
    </div>
  )
}

function CreateAdminExportModal({ accounts, onClose, onSaved }: { accounts: HostingAccount[]; onClose: () => void; onSaved: (item: HostingAccountExport) => void }) {
  const [form, setForm] = useState<CreateHostingAccountExportPayload>({
    account: accounts[0]?.id || "",
    export_type: "full",
    include_files: true,
    include_databases: true,
    include_mail: true,
    include_subdomains: true,
    notes: "",
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  const update = <K extends keyof CreateHostingAccountExportPayload>(key: K, value: CreateHostingAccountExportPayload[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setError("")
    try {
      onSaved(await hostingApi.createAccountExport(form))
    } catch (reason) {
      setError(readAdminError(reason, "No se pudo crear la exportacion."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <form className="w-full max-w-[780px] overflow-hidden rounded-lg bg-white shadow-2xl" onSubmit={(event) => void submit(event)}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Nueva exportacion</h3>
            <p className="mt-1 text-sm text-slate-500">Genera un backup completo o parcial de una cuenta existente.</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>
        {error ? <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700">{error}</div> : null}

        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_260px]">
          <section className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Cuenta origen</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Cuenta de hosting</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("account", event.target.value)} value={form.account}>
                    <option value="">Seleccionar cuenta</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.primary_domain} Â· {account.username} Â· {account.node_hostname || "Nodo N/D"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Tipo de exportacion</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("export_type", event.target.value as CreateHostingAccountExportPayload["export_type"])} value={form.export_type}>
                    <option value="full">Completa</option>
                    <option value="files_databases">Archivos y bases</option>
                    <option value="mail_only">Solo correo</option>
                  </select>
                </label>
                {([
                  ["include_files", "Archivos"],
                  ["include_databases", "Bases de datos"],
                  ["include_mail", "Correos"],
                  ["include_subdomains", "Subdominios"],
                ] as Array<[keyof Pick<CreateHostingAccountExportPayload, "include_files" | "include_databases" | "include_mail" | "include_subdomains">, string]>).map(([key, label]) => (
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700" key={key}>
                    <input checked={Boolean(form[key])} onChange={(event) => update(key, event.target.checked)} type="checkbox" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </section>

          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="eh-kicker">Notas</div>
            <h4 className="mt-1 text-lg font-bold">Archivo descargable</h4>
            <textarea className="mt-4 min-h-36 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("notes", event.target.value)} placeholder="Motivo, cliente, observaciones..." value={form.notes || ""} />
            <p className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
              El agente genera el paquete en el nodo de la cuenta. Cuando termine, el panel habilita la descarga si el archivo esta disponible para el backend.
            </p>
          </aside>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm" type="button" variant="outline">Cancelar</Button>
          <Button disabled={isSaving || !form.account} size="sm" type="submit">{isSaving ? "Guardando..." : "Crear exportacion"}</Button>
        </div>
      </form>
    </div>
  )
}

function accountExportStatusLabel(status: string) {
  if (status === "completed") return "Completada"
  if (status === "failed") return "Fallido"
  if (status === "running") return "En proceso"
  return "Pendiente"
}

function accountExportTypeLabel(type: string) {
  if (type === "files_databases") return "Archivos + bases de datos"
  if (type === "mail_only") return "Correos solamente"
  return "Cuenta completa"
}

function accountExportIncludesLabel(item: HostingAccountExport) {
  const parts = [
    item.include_files ? "Archivos" : "",
    item.include_databases ? "Bases" : "",
    item.include_mail ? "Correos" : "",
    item.include_subdomains ? "Subdominios" : "",
  ].filter(Boolean)
  return parts.length ? parts.join(", ") : "N/D"
}

function accountExportProgress(status: string) {
  if (status === "completed") return 100
  if (status === "running") return 65
  if (status === "failed") return 0
  return 15
}

function accountExportSteps(item: HostingAccountExport) {
  return [
    { label: "Registrar solicitud", done: true },
    { label: "Enviar tarea al agente", done: Boolean(item.last_job) },
    { label: "Generar paquete", done: ["completed", "failed"].includes(item.status) },
    { label: "Habilitar descarga", done: item.status === "completed" },
  ]
}

function formatBytes(value?: number | null) {
  const bytes = Number(value || 0)
  if (!bytes) return "N/D"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let size = bytes
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

const provisioningTemplateActions: ProvisioningTemplateAction[] = [
  { key: "create_account", label: "Crear cuenta", enabled: true, order: 1 },
  { key: "create_dns_zone", label: "DNS", enabled: true, order: 2 },
  { key: "issue_ssl", label: "SSL", enabled: true, order: 3 },
  { key: "install_wordpress", label: "WordPress", enabled: true, order: 4 },
  { key: "install_moodle", label: "Moodle", enabled: false, order: 5 },
  { key: "create_admin_mail", label: "Correo admin", enabled: true, order: 6 },
  { key: "initial_backup", label: "Backup inicial", enabled: true, order: 7 },
  { key: "enable_waf", label: "WAF", enabled: false, order: 8 },
]

type ProvisioningTemplateFormState = {
  category: ProvisioningTemplateCategory
  description: string
  disk_mb: string
  install_php: string
  is_active: boolean
  memory_mb: string
  name: string
  target_plan: string
  variables: string
  web_engine: string
  actions: Record<string, boolean>
}

function AdminProvisioningTemplatesPage() {
  const [templates, setTemplates] = useState<ProvisioningTemplate[]>([])
  const [plans, setPlans] = useState<HostingPlan[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<ProvisioningTemplate | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<ProvisioningTemplate | null>(null)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState("")

  const loadTemplates = () => {
    setIsLoading(true)
    Promise.all([
      hostingApi.provisioningTemplates({ search: search.trim() || undefined, category: category || undefined }),
      hostingApi.plans(),
    ])
      .then(([templatePage, planPage]) => {
        setTemplates(templatePage.results)
        setPlans(planPage.results)
        setSelectedTemplate((current) => templatePage.results.find((item) => item.id === current?.id) ?? templatePage.results[0] ?? null)
        setMessage("")
      })
      .catch((reason) => setMessage(readAdminError(reason, "No se pudieron cargar las plantillas.")))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  const activeTemplate = selectedTemplate ?? templates[0]
  const activeCount = templates.filter((item) => item.is_active).length
  const automationCount = templates.reduce((total, item) => total + item.actions.filter((action) => action.enabled).length, 0)
  const usedCount = templates.reduce((total, item) => total + item.usage_count, 0)

  const removeTemplate = async (template: ProvisioningTemplate) => {
    if (!window.confirm(`Eliminar la plantilla ${template.name}?`)) return
    try {
      await hostingApi.deleteProvisioningTemplate(template.id)
      setTemplates((current) => current.filter((item) => item.id !== template.id))
      setSelectedTemplate((current) => current?.id === template.id ? null : current)
      setMessage("")
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudo eliminar la plantilla."))
    }
  }

  const duplicateTemplate = async (template: ProvisioningTemplate) => {
    const name = window.prompt("Nuevo nombre para la plantilla duplicada", `${template.name} copia`)
    if (!name?.trim()) return
    try {
      const created = await hostingApi.duplicateProvisioningTemplate(template.id, name.trim())
      setTemplates((current) => [created, ...current])
      setSelectedTemplate(created)
      setMessage("")
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudo duplicar la plantilla."))
    }
  }

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Provisionamiento</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Plantillas de Provisionamiento</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Recetas reutilizables para altas, migraciones e importaciones con recursos, acciones automaticas y variables controladas.
              </p>
            </div>
          </div>
          <Button onClick={() => { setEditingTemplate(null); setShowTemplateModal(true) }} size="sm">Nueva plantilla</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Plantillas" value={String(templates.length)} detail={isLoading ? "Sincronizando..." : "Registradas"} />
        <AdminMetric label="Activas" value={String(activeCount)} detail="Disponibles para operar" />
        <AdminMetric label="Automatizaciones" value={String(automationCount)} detail="Acciones habilitadas" />
        <AdminMetric label="Usos" value={String(usedCount)} detail="Aplicaciones registradas" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[390px_1fr]">
        <div className="eh-card overflow-hidden">
          {message ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">{message}</div> : null}
          <div className="space-y-3 border-b border-slate-200 p-3">
            <div className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              <input
                className="h-full flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") loadTemplates()
                }}
                placeholder="Buscar plantilla, plan o descripcion..."
                value={search}
              />
              <button className="text-xs font-bold text-blue-700" onClick={loadTemplates} type="button">Buscar</button>
            </div>
            <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => setCategory(event.target.value)} value={category}>
              <option value="">Todas las categorias</option>
              <option value="hosting">Hosting</option>
              <option value="reseller">Revendedor</option>
              <option value="migration">Migracion</option>
              <option value="import">Importacion</option>
              <option value="application">Aplicacion</option>
            </select>
          </div>
          <div className="max-h-[680px] divide-y divide-slate-100 overflow-auto">
            {templates.map((template) => (
              <button className={cn("block w-full px-4 py-3 text-left hover:bg-slate-50", activeTemplate?.id === template.id && "bg-blue-50")} key={template.id} onClick={() => setSelectedTemplate(template)} type="button">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900">{template.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{provisioningCategoryLabel(template.category)} Â· {template.target_plan_name || "Sin plan fijo"}</div>
                  </div>
                  <AdminStatusBadge status={template.is_active ? "Activo" : "Pausado"} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {template.actions.filter((action) => action.enabled).slice(0, 4).map((action) => (
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200" key={action.key}>{action.label}</span>
                  ))}
                </div>
              </button>
            ))}
            {!isLoading && templates.length === 0 ? <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">No hay plantillas registradas.</div> : null}
            {isLoading ? <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">Cargando plantillas...</div> : null}
          </div>
        </div>

        {activeTemplate ? (
          <div className="eh-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="eh-kicker">{provisioningCategoryLabel(activeTemplate.category)}</div>
                <h3 className="mt-1 text-lg font-bold">{activeTemplate.name}</h3>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">{activeTemplate.description || "Sin descripcion."}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AdminStatusBadge status={activeTemplate.is_active ? "Activo" : "Pausado"} />
                <Button onClick={() => duplicateTemplate(activeTemplate)} size="sm" type="button" variant="outline">Duplicar</Button>
                <Button onClick={() => { setEditingTemplate(activeTemplate); setShowTemplateModal(true) }} size="sm" type="button" variant="outline">Editar</Button>
                <Button onClick={() => removeTemplate(activeTemplate)} size="sm" type="button" variant="outline">Eliminar</Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <AdminStatus label="Plan base" value={activeTemplate.target_plan_name || "Manual"} />
              <AdminStatus label="Acciones" value={String(activeTemplate.action_count)} />
              <AdminStatus label="Variables" value={String(activeTemplate.variable_count)} />
              <AdminStatus label="Ultima edicion" value={formatDateTime(activeTemplate.updated_at)} />
            </div>

            <div className="mt-5 rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3 font-bold">Flujo automatico</div>
              <div className="flex flex-wrap gap-2 p-4">
                {[...activeTemplate.actions].sort((a, b) => a.order - b.order).map((action, index) => (
                  <div className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold", action.enabled ? "border-blue-100 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-400")} key={action.key}>
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-xs font-bold">{index + 1}</span>
                    {action.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_320px]">
              <div className="rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 px-4 py-3 font-bold">Recursos y automatizacion</div>
                <div className="grid gap-2 p-4 md:grid-cols-2">
                  <AdminStatus label="Disco" value={formatTemplateResource(activeTemplate.resources.disk_mb, "MB")} />
                  <AdminStatus label="Memoria" value={formatTemplateResource(activeTemplate.resources.memory_mb, "MB")} />
                  <AdminStatus label="PHP" value={String(activeTemplate.resources.php_version || "N/D")} />
                  <AdminStatus label="Motor web" value={String(activeTemplate.resources.web_engine || "N/D")} />
                  <AdminStatus label="Backup inicial" value={Boolean(activeTemplate.automation.initial_backup) ? "Si" : "No"} />
                  <AdminStatus label="WAF" value={Boolean(activeTemplate.automation.enable_waf) ? "Si" : "No"} />
                </div>
              </div>
              <div className="rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 px-4 py-3 font-bold">Variables</div>
                <div className="space-y-2 p-4">
                  {Object.entries(activeTemplate.variables || {}).length ? Object.entries(activeTemplate.variables).map(([key, value]) => (
                    <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm" key={key}>
                      <span className="font-bold text-slate-700">{key}</span>
                      <span className="text-slate-500">{String(value)}</span>
                    </div>
                  )) : <div className="text-sm font-semibold text-slate-500">Sin variables configuradas.</div>}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="eh-card p-8 text-center text-sm font-semibold text-slate-500">Selecciona una plantilla.</div>
        )}
      </section>

      {showTemplateModal ? (
        <ProvisioningTemplateModal
          onClose={() => setShowTemplateModal(false)}
          onSaved={(saved) => {
            setShowTemplateModal(false)
            setEditingTemplate(null)
            setTemplates((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current])
            setSelectedTemplate(saved)
          }}
          plans={plans}
          template={editingTemplate}
        />
      ) : null}
    </div>
  )
}

function ProvisioningTemplateModal({ onClose, onSaved, plans, template }: { onClose: () => void; onSaved: (template: ProvisioningTemplate) => void; plans: HostingPlan[]; template: ProvisioningTemplate | null }) {
  const [form, setForm] = useState<ProvisioningTemplateFormState>(() => provisioningTemplateInitialForm(template))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  const update = <K extends keyof ProvisioningTemplateFormState>(key: K, value: ProvisioningTemplateFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }
  const toggleAction = (key: string, enabled: boolean) => {
    setForm((current) => ({ ...current, actions: { ...current.actions, [key]: enabled } }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setError("")
    try {
      const payload = provisioningTemplatePayload(form)
      const saved = template ? await hostingApi.updateProvisioningTemplate(template.id, payload) : await hostingApi.createProvisioningTemplate(payload)
      onSaved(saved)
    } catch (reason) {
      setError(readAdminError(reason, "No se pudo guardar la plantilla."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <form className="w-full max-w-[980px] overflow-hidden rounded-lg bg-white shadow-2xl" onSubmit={(event) => void submit(event)}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">{template ? "Editar plantilla" : "Nueva plantilla"}</h3>
            <p className="mt-1 text-sm text-slate-500">Define recursos, acciones y variables reutilizables.</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>
        {error ? <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_300px]">
          <section className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Datos base</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <TemplateTextInput label="Nombre" onChange={(value) => update("name", value)} value={form.name} />
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Categoria</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("category", event.target.value as ProvisioningTemplateCategory)} value={form.category}>
                    <option value="hosting">Hosting</option>
                    <option value="reseller">Revendedor</option>
                    <option value="migration">Migracion</option>
                    <option value="import">Importacion</option>
                    <option value="application">Aplicacion</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Plan base</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("target_plan", event.target.value)} value={form.target_plan}>
                    <option value="">Sin plan fijo</option>
                    {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 pt-6 text-sm font-semibold text-slate-700">
                  <input checked={form.is_active} onChange={(event) => update("is_active", event.target.checked)} type="checkbox" />
                  Activa
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Descripcion</span>
                  <textarea className="min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("description", event.target.value)} value={form.description} />
                </label>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Recursos</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <TemplateTextInput label="Disco MB" onChange={(value) => update("disk_mb", value)} value={form.disk_mb} />
                <TemplateTextInput label="Memoria MB" onChange={(value) => update("memory_mb", value)} value={form.memory_mb} />
                <TemplateTextInput label="PHP" onChange={(value) => update("install_php", value)} value={form.install_php} />
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Motor web</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("web_engine", event.target.value)} value={form.web_engine}>
                    <option value="nginx_apache">Nginx + Apache</option>
                    <option value="openlitespeed">OpenLiteSpeed</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="eh-kicker">Acciones</div>
              <div className="mt-3 space-y-2">
                {provisioningTemplateActions.map((action) => (
                  <label className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm font-semibold ring-1 ring-slate-200" key={action.key}>
                    <span>{action.label}</span>
                    <input checked={Boolean(form.actions[action.key])} onChange={(event) => toggleAction(action.key, event.target.checked)} type="checkbox" />
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="eh-kicker">Variables</div>
              <textarea className="mt-3 min-h-36 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("variables", event.target.value)} placeholder="site_title=Mi sitio&#10;admin_email=admin@dominio.com" value={form.variables} />
              <p className="mt-2 text-xs text-slate-500">Una variable por linea usando clave=valor.</p>
            </div>
          </aside>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm" type="button" variant="outline">Cancelar</Button>
          <Button disabled={isSaving || !form.name.trim()} size="sm" type="submit">{isSaving ? "Guardando..." : "Guardar plantilla"}</Button>
        </div>
      </form>
    </div>
  )
}

function TemplateTextInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      <input className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  )
}

function provisioningTemplateInitialForm(template: ProvisioningTemplate | null): ProvisioningTemplateFormState {
  const actionState = Object.fromEntries(provisioningTemplateActions.map((action) => [action.key, template ? Boolean(template.actions.find((item) => item.key === action.key)?.enabled) : action.enabled]))
  return {
    actions: actionState,
    category: template?.category || "hosting",
    description: template?.description || "",
    disk_mb: String(template?.resources.disk_mb || ""),
    install_php: String(template?.resources.php_version || "8.3"),
    is_active: template?.is_active ?? true,
    memory_mb: String(template?.resources.memory_mb || ""),
    name: template?.name || "",
    target_plan: template?.target_plan ? String(template.target_plan) : "",
    variables: variablesToText(template?.variables || {}),
    web_engine: String(template?.resources.web_engine || "openlitespeed"),
  }
}

function provisioningTemplatePayload(form: ProvisioningTemplateFormState): ProvisioningTemplatePayload {
  return {
    actions: provisioningTemplateActions.map((action) => ({ ...action, enabled: Boolean(form.actions[action.key]) })),
    automation: {
      enable_waf: Boolean(form.actions.enable_waf),
      initial_backup: Boolean(form.actions.initial_backup),
      install_moodle: Boolean(form.actions.install_moodle),
      install_wordpress: Boolean(form.actions.install_wordpress),
    },
    category: form.category,
    description: form.description,
    is_active: form.is_active,
    name: form.name.trim(),
    resources: {
      disk_mb: Number(form.disk_mb) || 0,
      memory_mb: Number(form.memory_mb) || 0,
      php_version: form.install_php.trim() || "8.3",
      web_engine: form.web_engine,
    },
    target_plan: form.target_plan ? Number(form.target_plan) : null,
    variables: variablesFromText(form.variables),
  }
}

function variablesFromText(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((result, line) => {
      const [key, ...rest] = line.split("=")
      if (key.trim()) result[key.trim()] = rest.join("=").trim()
      return result
    }, {})
}

function variablesToText(value: Record<string, unknown>) {
  return Object.entries(value).map(([key, item]) => `${key}=${String(item)}`).join("\n")
}

function provisioningCategoryLabel(categoryValue: string) {
  if (categoryValue === "reseller") return "Revendedor"
  if (categoryValue === "migration") return "Migracion"
  if (categoryValue === "import") return "Importacion"
  if (categoryValue === "application") return "Aplicacion"
  return "Hosting"
}

function formatTemplateResource(value: unknown, unit: string) {
  const numberValue = Number(value || 0)
  if (!numberValue) return "N/D"
  return `${numberValue.toLocaleString("es-BO")} ${unit}`
}

function AdminMigrationsMockPage() {
  const [selectedMigration, setSelectedMigration] = useState(adminMigrations[0])
  const [showCreateMigration, setShowCreateMigration] = useState(false)
  const steps = [
    { label: "Conectar origen", done: selectedMigration.progress >= 10 },
    { label: "Analizar cuenta", done: selectedMigration.progress >= 25 },
    { label: "Copiar archivos", done: selectedMigration.progress >= 45 },
    { label: "Migrar correos", done: selectedMigration.progress >= 60 },
    { label: "Restaurar bases", done: selectedMigration.progress >= 75 },
    { label: "Verificar destino", done: selectedMigration.progress >= 90 },
  ]

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Import className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Clientes</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Migraciones</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Seguimiento de importaciones desde paneles externos o servidores internos hacia nodos EHPanel.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreateMigration(true)} size="sm">Nueva migracion</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="En proceso" value="2" detail="Copiando datos" />
        <AdminMetric label="Verificando" value="1" detail="Revision final" />
        <AdminMetric label="Pausadas" value="1" detail="Faltan credenciales" />
        <AdminMetric label="Promedio progreso" value="55%" detail="4 tareas activas" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="eh-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex h-9 w-[360px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              Buscar cuenta, origen o destino...
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">Estado</Button>
              <Button size="sm" variant="outline">Tipo</Button>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {adminMigrations.map((migration) => (
              <button
                className={cn("block w-full px-4 py-3 text-left hover:bg-slate-50", selectedMigration.account === migration.account && "bg-blue-50")}
                key={migration.account}
                onClick={() => setSelectedMigration(migration)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{migration.account}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {migration.origin} {" -> "} {migration.destination}
                    </p>
                  </div>
                  <MigrationStatusBadge status={migration.status} />
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
                    <span>{migration.currentStep}</span>
                    <span>{migration.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-blue-600" style={{ width: `${migration.progress}%` }} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="eh-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="eh-kicker">Detalle</div>
              <h3 className="mt-1 text-lg font-bold">{selectedMigration.account}</h3>
              <p className="mt-1 text-sm text-slate-500">{selectedMigration.type}</p>
            </div>
            <MigrationStatusBadge status={selectedMigration.status} />
          </div>

          <div className="mt-4 grid gap-2">
            <AdminStatus label="Origen" value={selectedMigration.origin} />
            <AdminStatus label="Destino" value={selectedMigration.destination} />
            <AdminStatus label="Paso actual" value={selectedMigration.currentStep} />
            <AdminStatus label="Progreso" value={`${selectedMigration.progress}%`} />
          </div>

          <div className="mt-5">
            <h4 className="text-sm font-bold">Pasos de migracion</h4>
            <div className="mt-3 space-y-2">
              {steps.map((step, index) => (
                <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2" key={step.label}>
                  <div className={cn("grid h-6 w-6 place-items-center rounded-full text-xs font-bold", step.done ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500")}>
                    {index + 1}
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{step.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button size="sm" variant="outline">Pausar</Button>
            <Button size="sm" variant="outline">Reintentar paso</Button>
            <Button size="sm">Ver logs</Button>
          </div>
        </div>
      </section>

      {showCreateMigration && <CreateAdminMigrationMockModal onClose={() => setShowCreateMigration(false)} />}
    </div>
  )
}

function CreateAdminMigrationMockModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[920px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Nueva migracion</h3>
            <p className="mt-1 text-sm text-slate-500">Importar cuentas desde otro panel, un backup remoto o un servidor interno EHPanel.</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>

        <div className="p-5">
          <section className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Origen y destino</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Origen</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500">
                    <option>cPanel / WHM</option>
                    <option>Plesk</option>
                    <option>DirectAdmin</option>
                    <option>Backup URL</option>
                    <option>Servidor interno EHPanel</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Servidor destino</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500">
                    <option>node-miami-01</option>
                    <option>node-dallas-02</option>
                    <option>node-sp-01</option>
                    <option>Asignacion automatica</option>
                  </select>
                </label>
                <AdminField label="IP / Host / URL origen" readonly={false} value="" />
                <AdminField label="Usuario o token" readonly={false} value="" />
                <AdminField label="Clave / API key" readonly={false} value="" />
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Tipo de migracion</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500">
                    <option>Cuenta completa</option>
                    <option>Archivos + bases de datos</option>
                    <option>Correos solamente</option>
                    <option>Multiples cuentas</option>
                    <option>Servidor completo</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Proceso de importacion</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Modo</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500">
                    <option>Detectar cuentas y restaurar una por una</option>
                    <option>Restaurar todas automaticamente</option>
                    <option>Solo analizar y generar reporte</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Prioridad</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500">
                    <option>Normal</option>
                    <option>Alta</option>
                    <option>Baja / segundo plano</option>
                  </select>
                </label>
                <label className="md:col-span-2">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Notas de la migracion</span>
                  <textarea
                    className="min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-blue-500"
                    placeholder="Credenciales temporales, rutas especiales, cuentas que se deben omitir..."
                  />
                </label>
              </div>
            </div>
          </section>

          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="eh-kicker">Flujo previsto</div>
            <h4 className="mt-1 text-lg font-bold">Pasos que se mostraran</h4>
            <div className="mt-4 space-y-2">
              {[
                "Conectar con el origen",
                "Analizar cuentas detectadas",
                "Seleccionar cuentas a restaurar",
                "Copiar archivos",
                "Migrar bases y correos",
                "Verificar sitio en destino",
              ].map((step, index) => (
                <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold" key={step}>
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{index + 1}</span>
                  {step}
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">Cancelar</Button>
          <Button onClick={onClose} size="sm">Analizar origen</Button>
        </div>
      </div>
    </div>
  )
}

function MigrationStatusBadge({ status }: { status: string }) {
  const tone =
    status === "En proceso"
      ? "bg-blue-50 text-blue-700"
      : status === "Verificando"
        ? "bg-cyan-50 text-cyan-700"
        : "bg-amber-50 text-amber-700"

  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{status}</span>
}

void AdminMigrationsMockPage

function AdminClientPlansPage() {
  const [plans, setPlans] = useState<HostingPlan[]>([])
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [editingPlan, setEditingPlan] = useState<HostingPlan | null>(null)
  const [showCreatePlan, setShowCreatePlan] = useState(false)
  const [duplicatingPlan, setDuplicatingPlan] = useState<HostingPlan | null>(null)

  const loadPlans = () => {
    setIsLoading(true)
    hostingApi
      .plans()
      .then((page) => {
        setPlans(page.results.filter((plan) => plan.features?.plan_scope !== "reseller"))
        setError("")
      })
      .catch((reason) => setError(readAdminError(reason, "No se pudieron cargar los planes cliente.")))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadPlans()
  }, [])

  const filteredPlans = plans.filter((plan) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return [
      plan.name,
      formatPlanStorage(plan.disk_mb),
      formatPlanStorage(plan.bandwidth_mb),
      formatPlanLimit(plan.max_mailboxes),
      formatPlanLimit(plan.max_databases),
      formatPlanLimit(plan.max_domains),
      formatPlanLimit(planFeatureNumber(plan, "max_subdomains")),
      formatPlanCpu(plan.cpu_pct),
      formatPlanMemory(plan.memory_mb),
      plan.is_active ? "activo" : "borrador",
    ].some((value) => value.toLowerCase().includes(term))
  })

  const activeCount = plans.filter((plan) => plan.is_active).length
  const draftCount = plans.length - activeCount
  const maxCpu = plans.length ? Math.max(...plans.map((plan) => plan.cpu_pct)) : 0
  const maxMemory = plans.length ? Math.max(...plans.map((plan) => plan.memory_mb)) : 0

  const deletePlan = async (plan: HostingPlan) => {
    if (!window.confirm(`Eliminar el plan ${plan.name}?`)) return
    try {
      await hostingApi.deletePlan(plan.id)
      setMessage(`Plan eliminado: ${plan.name}`)
      loadPlans()
    } catch (reason) {
      setError(readAdminError(reason, "No se pudo eliminar el plan."))
    }
  }

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Planes y paquetes</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Planes cliente</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Catalogo de planes que se asignan a cuentas de hosting cliente, con cupos, limites y recursos de ejecucion.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreatePlan(true)} size="sm">AÃ±adir plan</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Planes activos" value={String(activeCount)} detail={isLoading ? "Sincronizando..." : "Disponibles para alta"} />
        <AdminMetric label="Borradores" value={String(draftCount)} detail="Pendiente publicar" />
        <AdminMetric label="CPU maximo" value={maxCpu ? formatPlanCpu(maxCpu) : "N/D"} detail="Tope global 400%" />
        <AdminMetric label="Memoria max." value={maxMemory ? formatPlanMemory(maxMemory) : "N/D"} detail="Tope global 4 GB" />
      </section>

      <div className="eh-card overflow-hidden">
        {error ? <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
        {message ? <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">{message}</div> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <label className="flex h-9 w-[360px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input
              className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar plan, recurso o limite..."
              value={search}
            />
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">Estado</Button>
            <Button disabled={isLoading} onClick={loadPlans} size="sm" variant="outline">Recursos</Button>
            <Button size="sm" variant="outline">Exportar</Button>
          </div>
        </div>

        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["Plan", "Disco", "Ancho banda", "Correos", "BD", "Dominios", "Subdominios", "CPU", "Memoria", "Estado", "Acciones"].map((column) => (
                <th className="px-4 py-2 font-bold" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPlans.map((plan) => (
              <tr className="hover:bg-slate-50" key={plan.name}>
                <td className="px-4 py-3 font-semibold text-slate-900">{plan.name}</td>
                <td className="px-4 py-3">{formatPlanStorage(plan.disk_mb)}</td>
                <td className="px-4 py-3">{formatPlanStorage(plan.bandwidth_mb)}</td>
                <td className="px-4 py-3"><PlanLimitBadge value={formatPlanLimit(plan.max_mailboxes)} /></td>
                <td className="px-4 py-3"><PlanLimitBadge value={formatPlanLimit(plan.max_databases)} /></td>
                <td className="px-4 py-3"><PlanLimitBadge value={formatPlanLimit(plan.max_domains)} /></td>
                <td className="px-4 py-3"><PlanLimitBadge value={formatPlanLimit(planFeatureNumber(plan, "max_subdomains"))} /></td>
                <td className="px-4 py-3 font-semibold text-blue-700">{formatPlanCpu(plan.cpu_pct)}</td>
                <td className="px-4 py-3 font-semibold">{formatPlanMemory(plan.memory_mb)}</td>
                <td className="px-4 py-3"><AdminAccountStatusBadge status={plan.is_active ? "Activa" : "Pendiente"} /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button onClick={() => setEditingPlan(plan)} size="sm" variant="outline">Editar</Button>
                    <Button onClick={() => setDuplicatingPlan(plan)} size="sm" variant="outline">Duplicar</Button>
                    <Button onClick={() => void deletePlan(plan)} size="sm" variant="outline">Eliminar</Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && filteredPlans.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={11}>
                  {plans.length === 0 ? "No hay planes cliente creados." : "No hay planes con ese filtro."}
                </td>
              </tr>
            ) : null}
            {isLoading ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={11}>Cargando planes reales...</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showCreatePlan ? (
        <ClientPlanModal
          mode="create"
          onClose={() => setShowCreatePlan(false)}
          onSaved={(plan) => {
            setMessage(`Plan creado: ${plan.name}`)
            setShowCreatePlan(false)
            loadPlans()
          }}
        />
      ) : null}
      {editingPlan ? (
        <ClientPlanModal
          mode="edit"
          onClose={() => setEditingPlan(null)}
          onSaved={(plan) => {
            setMessage(`Plan actualizado: ${plan.name}`)
            setEditingPlan(null)
            loadPlans()
          }}
          plan={editingPlan}
        />
      ) : null}
      {duplicatingPlan ? (
        <DuplicateClientPlanModal
          onClose={() => setDuplicatingPlan(null)}
          onSaved={(plan) => {
            setMessage(`Plan duplicado: ${plan.name}`)
            setDuplicatingPlan(null)
            loadPlans()
          }}
          plan={duplicatingPlan}
        />
      ) : null}
    </div>
  )
}

function PlanLimitBadge({ value }: { value: string }) {
  const unlimited = value === "Ilimitado"
  return (
    <span className={cn("rounded-full px-2 py-1 text-xs font-bold", unlimited ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700")}>
      {value}
    </span>
  )
}

function PlanLimitField({
  defaultValue,
  label,
  onChange,
  disabled = false,
  unlimited = false,
  value,
}: {
  defaultValue?: string
  disabled?: boolean
  label: string
  onChange?: (value: string, unlimited: boolean) => void
  unlimited?: boolean
  value?: string
}) {
  const fieldValue = value ?? defaultValue ?? ""
  return (
    <div>
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      <div className="grid grid-cols-[1fr_112px] gap-2">
        <input
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
          disabled={disabled || unlimited}
          min={0}
          onChange={(event) => onChange?.(event.target.value, unlimited)}
          type="number"
          value={fieldValue}
        />
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm font-medium outline-none focus:border-blue-500"
          disabled={disabled}
          onChange={(event) => onChange?.(fieldValue, event.target.value === "Ilimitado")}
          value={unlimited ? "Ilimitado" : "Limitado"}
        >
          <option value="Limitado">Limitado</option>
          <option value="Ilimitado">Ilimitado</option>
        </select>
      </div>
    </div>
  )
}

type PlanFormState = {
  bandwidthGb: string
  bandwidthUnlimited: boolean
  cpuPct: string
  cronJobs: string
  cronJobsUnlimited: boolean
  databases: string
  databasesUnlimited: boolean
  diskGb: string
  domains: string
  domainsUnlimited: boolean
  emails: string
  emailsUnlimited: boolean
  ftpUsers: string
  ftpUsersUnlimited: boolean
  memoryMb: string
  name: string
  status: "Activo" | "Borrador" | "Oculto"
  subdomains: string
  subdomainsUnlimited: boolean
}

function ClientPlanModal({
  mode,
  onClose,
  onSaved,
  plan,
}: {
  mode: "create" | "edit"
  onClose: () => void
  onSaved: (plan: HostingPlan) => void
  plan?: HostingPlan
}) {
  const [form, setForm] = useState<PlanFormState>(() => planToForm(plan))
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const title = mode === "edit" ? "Editar plan cliente" : "AÃ±adir plan cliente"

  const savePlan = async () => {
    setIsSaving(true)
    setError("")
    try {
      const payload = planFormToPayload(form, plan)
      const saved = mode === "edit" && plan ? await hostingApi.updatePlan(plan.id, payload) : await hostingApi.createPlan(payload)
      onSaved(saved)
    } catch (reason) {
      setError(readAdminError(reason, mode === "edit" ? "No se pudo actualizar el plan." : "No se pudo crear el plan."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[940px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">Definir limites de hosting, correo, bases de datos y recursos de ejecucion para cuentas cliente.</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>

        {error ? <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700">{error}</div> : null}

        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_300px]">
          <section className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Datos generales</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <PlanTextInput label="Nombre del plan" onChange={(name) => setForm((current) => ({ ...current, name }))} value={form.name} />
                <PlanTextInput label="Espacio asignado" onChange={(diskGb) => setForm((current) => ({ ...current, diskGb }))} suffix="GB" type="number" value={form.diskGb} />
                <PlanTextInput disabled={form.bandwidthUnlimited} label="Ancho de banda" onChange={(bandwidthGb) => setForm((current) => ({ ...current, bandwidthGb }))} suffix="GB" type="number" value={form.bandwidthGb} />
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Limites del plan</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <PlanLimitField label="Correos" onChange={(emails, emailsUnlimited) => setForm((current) => ({ ...current, emails, emailsUnlimited }))} unlimited={form.emailsUnlimited} value={form.emails} />
                <PlanLimitField label="Bases de datos" onChange={(databases, databasesUnlimited) => setForm((current) => ({ ...current, databases, databasesUnlimited }))} unlimited={form.databasesUnlimited} value={form.databases} />
                <PlanLimitField label="Dominios" onChange={(domains, domainsUnlimited) => setForm((current) => ({ ...current, domains, domainsUnlimited }))} unlimited={form.domainsUnlimited} value={form.domains} />
                <PlanSubdomainsField onChange={(subdomains, subdomainsUnlimited) => setForm((current) => ({ ...current, subdomains, subdomainsUnlimited }))} unlimited={form.subdomainsUnlimited} value={form.subdomains} />
                <PlanLimitField label="Cuentas FTP/SFTP" onChange={(ftpUsers, ftpUsersUnlimited) => setForm((current) => ({ ...current, ftpUsers, ftpUsersUnlimited }))} unlimited={form.ftpUsersUnlimited} value={form.ftpUsers} />
                <PlanLimitField label="Tareas cron" onChange={(cronJobs, cronJobsUnlimited) => setForm((current) => ({ ...current, cronJobs, cronJobsUnlimited }))} unlimited={form.cronJobsUnlimited} value={form.cronJobs} />
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Recursos de ejecucion</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">CPU asignado</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => setForm((current) => ({ ...current, cpuPct: event.target.value }))} value={form.cpuPct}>
                    <option value="50">50% - medio core</option>
                    <option value="75">75%</option>
                    <option value="100">100% - 1 core</option>
                    <option value="200">200% - 2 cores</option>
                    <option value="300">300% - 3 cores</option>
                    <option value="400">400% - 4 cores</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Memoria asignada</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => setForm((current) => ({ ...current, memoryMb: event.target.value }))} value={form.memoryMb}>
                    <option value="512">512 MB</option>
                    <option value="1024">1 GB</option>
                    <option value="2048">2 GB</option>
                    <option value="3072">3 GB</option>
                    <option value="4096">4 GB</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Estado</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as PlanFormState["status"] }))} value={form.status}>
                    <option value="Activo">Activo</option>
                    <option value="Borrador">Borrador</option>
                    <option value="Oculto">Oculto</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="eh-kicker">Referencia</div>
            <h4 className="mt-1 text-lg font-bold">Escala de recursos</h4>
            <div className="mt-4 space-y-2 text-sm">
              <AdminStatus label="100% CPU" value="1 core virtual" />
              <AdminStatus label="200% CPU" value="2 cores virtuales" />
              <AdminStatus label="400% CPU" value="4 cores maximo" />
              <AdminStatus label="Ilimitado" value="Sin cupo fijo" />
              <AdminStatus label="Memoria" value="Maximo 4 GB" />
            </div>
            <p className="mt-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
              Estos limites se aplicaran al crear cuentas nuevas. Las cuentas existentes podran sincronizarse luego desde acciones masivas.
            </p>
          </aside>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">Cancelar</Button>
          <Button disabled={isSaving} onClick={() => void savePlan()} size="sm">{isSaving ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Crear plan"}</Button>
        </div>
      </div>
    </div>
  )
}

function DuplicateClientPlanModal({
  onClose,
  onSaved,
  plan,
}: {
  onClose: () => void
  onSaved: (plan: HostingPlan) => void
  plan: HostingPlan
}) {
  const [name, setName] = useState(`${plan.name} copia`)
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const duplicatePlan = async () => {
    setIsSaving(true)
    setError("")
    try {
      const saved = await hostingApi.createPlan(duplicatePlanPayload(plan, name))
      onSaved(saved)
    } catch (reason) {
      setError(readAdminError(reason, "No se pudo duplicar el plan."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[460px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Duplicar plan</h3>
            <p className="mt-1 text-sm text-slate-500">Copiar recursos y limites de {plan.name}.</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>

        {error ? <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700">{error}</div> : null}

        <div className="p-5">
          <PlanTextInput label="Nuevo nombre" onChange={setName} value={name} />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">Cancelar</Button>
          <Button disabled={isSaving} onClick={() => void duplicatePlan()} size="sm">{isSaving ? "Duplicando..." : "Duplicar plan"}</Button>
        </div>
      </div>
    </div>
  )
}

function PlanTextInput({
  disabled,
  label,
  onChange,
  suffix,
  type = "text",
  value,
}: {
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  suffix?: string
  type?: "number" | "text"
  value: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      <div className="flex h-10 overflow-hidden rounded-md border border-slate-200 bg-white focus-within:border-blue-500">
        <input
          className="min-w-0 flex-1 bg-transparent px-3 text-sm font-medium outline-none disabled:bg-slate-100 disabled:text-slate-400"
          disabled={disabled}
          min={type === "number" ? 0 : undefined}
          onChange={(event) => onChange(event.target.value)}
          type={type}
          value={value}
        />
        {suffix ? <span className="grid min-w-12 place-items-center border-l border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-500">{suffix}</span> : null}
      </div>
    </label>
  )
}

function planToForm(plan?: HostingPlan): PlanFormState {
  const features = plan?.features ?? {}
  return {
    bandwidthGb: plan ? String(Math.max(0, Math.round(plan.bandwidth_mb / 1024))) : "200",
    bandwidthUnlimited: Boolean(features.bandwidth_unlimited),
    cpuPct: String(Math.min(plan?.cpu_pct ?? 100, 400)),
    cronJobs: String(planFeatureNumber(plan, "cron_jobs") || 10),
    cronJobsUnlimited: Boolean(features.cron_jobs_unlimited),
    databases: String(plan?.max_databases ?? 5),
    databasesUnlimited: (plan?.max_databases ?? 1) <= 0,
    diskGb: plan ? String(Math.max(0, Math.round(plan.disk_mb / 1024))) : "20",
    domains: String(plan?.max_domains ?? 1),
    domainsUnlimited: (plan?.max_domains ?? 1) <= 0,
    emails: String(plan?.max_mailboxes ?? 25),
    emailsUnlimited: (plan?.max_mailboxes ?? 1) <= 0,
    ftpUsers: String(planFeatureNumber(plan, "ftp_users") || 5),
    ftpUsersUnlimited: Boolean(features.ftp_users_unlimited),
    memoryMb: String(Math.min(plan?.memory_mb ?? 1024, 4096)),
    name: plan?.name ?? "",
    status: plan?.is_active === false ? "Borrador" : "Activo",
    subdomains: String(planFeatureNumber(plan, "max_subdomains") || 10),
    subdomainsUnlimited: Boolean(features.max_subdomains_unlimited),
  }
}

function planFormToPayload(form: PlanFormState, currentPlan?: HostingPlan): HostingPlanPayload {
  const name = form.name.trim()
  if (!name) throw new Error("El nombre del plan es obligatorio.")

  const diskGb = numberFromText(form.diskGb, 20)
  const bandwidthGb = form.bandwidthUnlimited ? 0 : numberFromText(form.bandwidthGb, 200)
  const cpuPct = Math.min(numberFromText(form.cpuPct, 100), 400)
  const memoryMb = Math.min(numberFromText(form.memoryMb, 1024), 4096)

  return {
    allowed_php_versions: currentPlan?.allowed_php_versions ?? ["8.3", "8.4", "8.5"],
    allowed_web_engines: currentPlan?.allowed_web_engines ?? ["openlitespeed"],
    bandwidth_mb: bandwidthGb * 1024,
    cpu_pct: cpuPct,
    disk_mb: diskGb * 1024,
    features: {
      ...(currentPlan?.features ?? {}),
      bandwidth_unlimited: form.bandwidthUnlimited,
      cron_jobs: form.cronJobsUnlimited ? -1 : numberFromText(form.cronJobs, 10),
      cron_jobs_unlimited: form.cronJobsUnlimited,
      ftp_users: form.ftpUsersUnlimited ? -1 : numberFromText(form.ftpUsers, 5),
      ftp_users_unlimited: form.ftpUsersUnlimited,
      max_subdomains: form.subdomainsUnlimited ? -1 : numberFromText(form.subdomains, 10),
      max_subdomains_unlimited: form.subdomainsUnlimited,
      plan_scope: "client",
    },
    is_active: form.status === "Activo",
    max_databases: form.databasesUnlimited ? 0 : numberFromText(form.databases, 5),
    max_domains: form.domainsUnlimited ? 0 : numberFromText(form.domains, 1),
    max_mailboxes: form.emailsUnlimited ? 0 : numberFromText(form.emails, 25),
    memory_mb: memoryMb,
    name,
    slug: currentPlan?.slug && currentPlan.name === name ? currentPlan.slug : slugifyPlanName(name),
  }
}

function duplicatePlanPayload(plan: HostingPlan, name: string): HostingPlanPayload {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error("El nuevo nombre del plan es obligatorio.")
  return {
    allowed_php_versions: plan.allowed_php_versions,
    allowed_web_engines: plan.allowed_web_engines,
    bandwidth_mb: plan.bandwidth_mb,
    cpu_pct: Math.min(plan.cpu_pct, 400),
    disk_mb: plan.disk_mb,
    features: plan.features,
    is_active: plan.is_active,
    max_databases: plan.max_databases,
    max_domains: plan.max_domains,
    max_mailboxes: plan.max_mailboxes,
    memory_mb: Math.min(plan.memory_mb, 4096),
    name: trimmedName,
    slug: slugifyPlanName(trimmedName),
  }
}

function numberFromText(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function slugifyPlanName(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || `plan-${Date.now()}`
}

function formatPlanStorage(value: number) {
  if (value <= 0) return "Ilimitado"
  if (value >= 1024) return `${Math.round(value / 1024)} GB`
  return `${value} MB`
}

function formatPlanLimit(value: number) {
  return value <= 0 ? "Ilimitado" : String(value)
}

function formatPlanCpu(value: number) {
  const capped = Math.min(value, 400)
  const cores = capped / 100
  return `${capped}% (${cores % 1 === 0 ? cores : cores.toFixed(1)} core${cores === 1 ? "" : "s"})`
}

function formatPlanMemory(value: number) {
  const capped = Math.min(value, 4096)
  if (capped >= 1024) return `${Number((capped / 1024).toFixed(1))} GB`
  return `${capped} MB`
}

function planFeatureNumber(plan: HostingPlan | undefined, key: string) {
  const value = plan?.features?.[key]
  if (typeof value === "number") return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function AdminResellerPlansPage() {
  const [plans, setPlans] = useState<HostingPlan[]>([])
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [editingPlan, setEditingPlan] = useState<HostingPlan | null>(null)
  const [showCreatePlan, setShowCreatePlan] = useState(false)
  const [duplicatingPlan, setDuplicatingPlan] = useState<HostingPlan | null>(null)

  const loadPlans = () => {
    setIsLoading(true)
    hostingApi
      .plans()
      .then((page) => {
        setPlans(page.results.filter((plan) => plan.features?.plan_scope === "reseller"))
        setError("")
      })
      .catch((reason) => setError(readAdminError(reason, "No se pudieron cargar los planes revendedor.")))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadPlans()
  }, [])

  const filteredPlans = plans.filter((plan) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return [
      plan.name,
      formatPlanLimit(resellerFeatureNumber(plan, "reseller_clients")),
      formatPlanStorage(plan.disk_mb),
      formatPlanStorage(plan.bandwidth_mb),
      formatPlanLimit(plan.max_mailboxes),
      formatPlanLimit(plan.max_databases),
      formatPlanLimit(plan.max_domains),
      formatPlanLimit(planFeatureNumber(plan, "max_subdomains")),
      resellerNodesLabel(plan),
      plan.is_active ? "activo" : "borrador",
    ].some((value) => value.toLowerCase().includes(term))
  })

  const activeCount = plans.filter((plan) => plan.is_active).length
  const maxClients = plans.length ? Math.max(...plans.map((plan) => resellerFeatureNumber(plan, "reseller_clients"))) : 0
  const maxDisk = plans.length ? Math.max(...plans.map((plan) => plan.disk_mb)) : 0
  const multiNodeCount = plans.filter((plan) => resellerNodesLabel(plan).toLowerCase().includes("multi")).length

  const deletePlan = async (plan: HostingPlan) => {
    if (!window.confirm(`Eliminar el plan ${plan.name}?`)) return
    try {
      await hostingApi.deletePlan(plan.id)
      setMessage(`Plan eliminado: ${plan.name}`)
      loadPlans()
    } catch (reason) {
      setError(readAdminError(reason, "No se pudo eliminar el plan."))
    }
  }

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Planes y paquetes</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Planes revendedor</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Paquetes comerciales para revendedores, con cupos globales que luego podran distribuir entre sus clientes.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreatePlan(true)} size="sm">Anadir plan</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Planes activos" value={String(activeCount)} detail={isLoading ? "Sincronizando..." : "Disponibles para vender"} />
        <AdminMetric label="Clientes max." value={maxClients ? formatPlanLimit(maxClients) : "N/D"} detail="Plan superior" />
        <AdminMetric label="Disco max." value={maxDisk ? formatPlanStorage(maxDisk) : "N/D"} detail="Bolsa total" />
        <AdminMetric label="Nodos" value={String(multiNodeCount)} detail="Planes multi nodo" />
      </section>

      <div className="eh-card overflow-hidden">
        {error ? <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
        {message ? <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">{message}</div> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <label className="flex h-9 w-[380px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input
              className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar plan revendedor, cupo o recurso..."
              value={search}
            />
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">Estado</Button>
            <Button disabled={isLoading} onClick={loadPlans} size="sm" variant="outline">Capacidad</Button>
            <Button size="sm" variant="outline">Exportar</Button>
          </div>
        </div>

        <table className="w-full min-w-[1240px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["Plan", "Clientes", "Disco total", "Ancho banda", "Correos", "BD", "Dominios", "Subdominios", "Nodos", "Estado", "Acciones"].map((column) => (
                <th className="px-4 py-2 font-bold" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPlans.map((plan) => (
              <tr className="hover:bg-slate-50" key={plan.name}>
                <td className="px-4 py-3 font-semibold text-slate-900">{plan.name}</td>
                <td className="px-4 py-3"><PlanLimitBadge value={formatPlanLimit(resellerFeatureNumber(plan, "reseller_clients"))} /></td>
                <td className="px-4 py-3 font-semibold">{formatPlanStorage(plan.disk_mb)}</td>
                <td className="px-4 py-3">{formatPlanStorage(plan.bandwidth_mb)}</td>
                <td className="px-4 py-3"><PlanLimitBadge value={formatPlanLimit(plan.max_mailboxes)} /></td>
                <td className="px-4 py-3"><PlanLimitBadge value={formatPlanLimit(plan.max_databases)} /></td>
                <td className="px-4 py-3"><PlanLimitBadge value={formatPlanLimit(plan.max_domains)} /></td>
                <td className="px-4 py-3"><PlanLimitBadge value={formatPlanLimit(planFeatureNumber(plan, "max_subdomains"))} /></td>
                <td className="px-4 py-3 text-blue-700">{resellerNodesLabel(plan)}</td>
                <td className="px-4 py-3"><AdminAccountStatusBadge status={plan.is_active ? "Activa" : "Pendiente"} /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button onClick={() => setEditingPlan(plan)} size="sm" variant="outline">Editar</Button>
                    <Button onClick={() => setDuplicatingPlan(plan)} size="sm" variant="outline">Duplicar</Button>
                    <Button onClick={() => void deletePlan(plan)} size="sm" variant="outline">Eliminar</Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && filteredPlans.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={11}>
                  {plans.length === 0 ? "No hay planes revendedor creados." : "No hay planes con ese filtro."}
                </td>
              </tr>
            ) : null}
            {isLoading ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={11}>Cargando planes reales...</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showCreatePlan ? (
        <ResellerPlanModal
          mode="create"
          onClose={() => setShowCreatePlan(false)}
          onSaved={(plan) => {
            setMessage(`Plan creado: ${plan.name}`)
            setShowCreatePlan(false)
            loadPlans()
          }}
        />
      ) : null}
      {editingPlan ? (
        <ResellerPlanModal
          mode="edit"
          onClose={() => setEditingPlan(null)}
          onSaved={(plan) => {
            setMessage(`Plan actualizado: ${plan.name}`)
            setEditingPlan(null)
            loadPlans()
          }}
          plan={editingPlan}
        />
      ) : null}
      {duplicatingPlan ? (
        <DuplicateClientPlanModal
          onClose={() => setDuplicatingPlan(null)}
          onSaved={(plan) => {
            setMessage(`Plan duplicado: ${plan.name}`)
            setDuplicatingPlan(null)
            loadPlans()
          }}
          plan={duplicatingPlan}
        />
      ) : null}
    </div>
  )
}

type ResellerPlanFormState = {
  bandwidthGb: string
  bandwidthUnlimited: boolean
  clients: string
  clientsUnlimited: boolean
  databases: string
  databasesUnlimited: boolean
  diskGb: string
  domains: string
  domainsUnlimited: boolean
  emails: string
  emailsUnlimited: boolean
  ftpUsers: string
  ftpUsersUnlimited: boolean
  name: string
  nodes: string
  overbooking: string
  status: "Activo" | "Borrador" | "Oculto"
  subdomains: string
  subdomainsUnlimited: boolean
}

function ResellerPlanModal({
  mode,
  onClose,
  onSaved,
  plan,
}: {
  mode: "create" | "edit"
  onClose: () => void
  onSaved: (plan: HostingPlan) => void
  plan?: HostingPlan
}) {
  const [form, setForm] = useState<ResellerPlanFormState>(() => resellerPlanToForm(plan))
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const resourcesLocked = mode === "edit"
  const title = mode === "edit" ? "Editar plan revendedor" : "Anadir plan revendedor"

  const savePlan = async () => {
    setIsSaving(true)
    setError("")
    try {
      const payload = resellerPlanFormToPayload(form, plan, resourcesLocked)
      const saved = mode === "edit" && plan ? await hostingApi.updatePlan(plan.id, payload) : await hostingApi.createPlan(payload)
      onSaved(saved)
    } catch (reason) {
      setError(readAdminError(reason, mode === "edit" ? "No se pudo actualizar el plan." : "No se pudo crear el plan."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[960px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">Definir la bolsa total de recursos que un revendedor podra vender y repartir entre sus clientes.</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>

        {error ? <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700">{error}</div> : null}

        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_300px]">
          <section className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Datos generales</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <PlanTextInput label="Nombre del plan" onChange={(name) => setForm((current) => ({ ...current, name }))} value={form.name} />
                <PlanTextInput disabled={resourcesLocked} label="Espacio total" onChange={(diskGb) => setForm((current) => ({ ...current, diskGb }))} suffix="GB" type="number" value={form.diskGb} />
                <PlanTextInput disabled={resourcesLocked || form.bandwidthUnlimited} label="Ancho de banda total" onChange={(bandwidthGb) => setForm((current) => ({ ...current, bandwidthGb }))} suffix="GB" type="number" value={form.bandwidthGb} />
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Cupos que puede ofrecer</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <PlanLimitField disabled={resourcesLocked} label="Clientes maximos" onChange={(clients, clientsUnlimited) => setForm((current) => ({ ...current, clients, clientsUnlimited }))} unlimited={form.clientsUnlimited} value={form.clients} />
                <PlanLimitField disabled={resourcesLocked} label="Correos maximos" onChange={(emails, emailsUnlimited) => setForm((current) => ({ ...current, emails, emailsUnlimited }))} unlimited={form.emailsUnlimited} value={form.emails} />
                <PlanLimitField disabled={resourcesLocked} label="Bases de datos" onChange={(databases, databasesUnlimited) => setForm((current) => ({ ...current, databases, databasesUnlimited }))} unlimited={form.databasesUnlimited} value={form.databases} />
                <PlanLimitField disabled={resourcesLocked} label="Dominios" onChange={(domains, domainsUnlimited) => setForm((current) => ({ ...current, domains, domainsUnlimited }))} unlimited={form.domainsUnlimited} value={form.domains} />
                <PlanSubdomainsField disabled={resourcesLocked} onChange={(subdomains, subdomainsUnlimited) => setForm((current) => ({ ...current, subdomains, subdomainsUnlimited }))} unlimited={form.subdomainsUnlimited} value={form.subdomains} />
                <PlanLimitField disabled={resourcesLocked} label="Cuentas FTP/SFTP" onChange={(ftpUsers, ftpUsersUnlimited) => setForm((current) => ({ ...current, ftpUsers, ftpUsersUnlimited }))} unlimited={form.ftpUsersUnlimited} value={form.ftpUsers} />
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Alcance operativo</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Asignacion de nodos</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => setForm((current) => ({ ...current, nodes: event.target.value }))} value={form.nodes}>
                    <option value="1 nodo fijo">1 nodo fijo</option>
                    <option value="2 nodos permitidos">2 nodos permitidos</option>
                    <option value="Multi nodo">Multi nodo</option>
                    <option value="Asignacion automatica">Asignacion automatica</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Sobreventa</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => setForm((current) => ({ ...current, overbooking: event.target.value }))} value={form.overbooking}>
                    <option value="No permitir">No permitir</option>
                    <option value="Permitir solo disco">Permitir solo disco</option>
                    <option value="Permitir disco y trafico">Permitir disco y trafico</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Estado</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ResellerPlanFormState["status"] }))} value={form.status}>
                    <option value="Activo">Activo</option>
                    <option value="Borrador">Borrador</option>
                    <option value="Oculto">Oculto</option>
                  </select>
                </label>
              </div>
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">Cancelar</Button>
          <Button disabled={isSaving} onClick={() => void savePlan()} size="sm">{isSaving ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Crear plan"}</Button>
        </div>
      </div>
    </div>
  )
}

function PlanSubdomainsField({
  disabled,
  onChange,
  unlimited,
  value,
}: {
  disabled?: boolean
  onChange: (value: string, unlimited: boolean) => void
  unlimited: boolean
  value: string
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Subdominios</span>
      <div className="grid grid-cols-[140px_1fr] gap-2">
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm font-medium outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
          disabled={disabled}
          onChange={(event) => onChange(value, event.target.value === "Ilimitado")}
          value={unlimited ? "Ilimitado" : "Manual"}
        >
          <option value="Manual">Valor manual</option>
          <option value="Ilimitado">Ilimitado</option>
        </select>
        <input
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
          disabled={disabled || unlimited}
          min={0}
          onChange={(event) => onChange(event.target.value, unlimited)}
          type="number"
          value={value}
        />
      </div>
    </div>
  )
}

function resellerPlanToForm(plan?: HostingPlan): ResellerPlanFormState {
  const features = plan?.features ?? {}
  return {
    bandwidthGb: plan ? String(Math.max(0, Math.round(plan.bandwidth_mb / 1024))) : "2048",
    bandwidthUnlimited: Boolean(features.bandwidth_unlimited),
    clients: String(resellerFeatureNumber(plan, "reseller_clients") || 25),
    clientsUnlimited: Boolean(features.reseller_clients_unlimited),
    databases: String(plan?.max_databases ?? 250),
    databasesUnlimited: (plan?.max_databases ?? 1) <= 0,
    diskGb: plan ? String(Math.max(0, Math.round(plan.disk_mb / 1024))) : "500",
    domains: String(plan?.max_domains ?? 100),
    domainsUnlimited: (plan?.max_domains ?? 1) <= 0,
    emails: String(plan?.max_mailboxes ?? 500),
    emailsUnlimited: (plan?.max_mailboxes ?? 1) <= 0,
    ftpUsers: String(resellerFeatureNumber(plan, "ftp_users") || 100),
    ftpUsersUnlimited: Boolean(features.ftp_users_unlimited),
    name: plan?.name ?? "",
    nodes: resellerNodesLabel(plan) || "1 nodo fijo",
    overbooking: typeof features.overbooking === "string" ? features.overbooking : "No permitir",
    status: plan?.is_active === false ? "Borrador" : "Activo",
    subdomains: String(planFeatureNumber(plan, "max_subdomains") || 100),
    subdomainsUnlimited: Boolean(features.max_subdomains_unlimited),
  }
}

function resellerPlanFormToPayload(form: ResellerPlanFormState, currentPlan?: HostingPlan, resourcesLocked = false): HostingPlanPayload {
  const name = form.name.trim()
  if (!name) throw new Error("El nombre del plan es obligatorio.")

  if (resourcesLocked && currentPlan) {
    return {
      allowed_php_versions: currentPlan.allowed_php_versions,
      allowed_web_engines: currentPlan.allowed_web_engines,
      bandwidth_mb: currentPlan.bandwidth_mb,
      cpu_pct: currentPlan.cpu_pct,
      disk_mb: currentPlan.disk_mb,
      features: {
        ...(currentPlan.features ?? {}),
        nodes: form.nodes,
        overbooking: form.overbooking,
        plan_scope: "reseller",
      },
      is_active: form.status === "Activo",
      max_databases: currentPlan.max_databases,
      max_domains: currentPlan.max_domains,
      max_mailboxes: currentPlan.max_mailboxes,
      memory_mb: currentPlan.memory_mb,
      name,
      slug: currentPlan.slug && currentPlan.name === name ? currentPlan.slug : slugifyPlanName(name),
    }
  }

  const diskGb = numberFromText(form.diskGb, 500)
  const bandwidthGb = form.bandwidthUnlimited ? 0 : numberFromText(form.bandwidthGb, 2048)

  return {
    allowed_php_versions: currentPlan?.allowed_php_versions ?? ["8.3", "8.4", "8.5"],
    allowed_web_engines: currentPlan?.allowed_web_engines ?? ["openlitespeed"],
    bandwidth_mb: bandwidthGb * 1024,
    cpu_pct: currentPlan?.cpu_pct ?? 100,
    disk_mb: diskGb * 1024,
    features: {
      ...(currentPlan?.features ?? {}),
      bandwidth_unlimited: form.bandwidthUnlimited,
      ftp_users: form.ftpUsersUnlimited ? -1 : numberFromText(form.ftpUsers, 100),
      ftp_users_unlimited: form.ftpUsersUnlimited,
      max_subdomains: form.subdomainsUnlimited ? -1 : numberFromText(form.subdomains, 100),
      max_subdomains_unlimited: form.subdomainsUnlimited,
      nodes: form.nodes,
      overbooking: form.overbooking,
      plan_scope: "reseller",
      reseller_clients: form.clientsUnlimited ? 0 : numberFromText(form.clients, 25),
      reseller_clients_unlimited: form.clientsUnlimited,
    },
    is_active: form.status === "Activo",
    max_databases: form.databasesUnlimited ? 0 : numberFromText(form.databases, 250),
    max_domains: form.domainsUnlimited ? 0 : numberFromText(form.domains, 100),
    max_mailboxes: form.emailsUnlimited ? 0 : numberFromText(form.emails, 500),
    memory_mb: currentPlan?.memory_mb ?? 1024,
    name,
    slug: currentPlan?.slug && currentPlan.name === name ? currentPlan.slug : slugifyPlanName(name),
  }
}

function resellerFeatureNumber(plan: HostingPlan | undefined, key: string) {
  return planFeatureNumber(plan, key)
}

function resellerNodesLabel(plan: HostingPlan | undefined) {
  const value = plan?.features?.nodes
  return typeof value === "string" && value.trim() ? value : "1 nodo fijo"
}

function AdminGlobalLimitsPage() {
  const [configuration, setConfiguration] = useState<HostingConfiguration | null>(null)
  const [plans, setPlans] = useState<HostingPlan[]>([])
  const [profiles, setProfiles] = useState<GlobalLimitProfile[]>([])
  const [defaultBandwidthMbps, setDefaultBandwidthMbps] = useState("20")
  const [defaultDbConnections, setDefaultDbConnections] = useState("300")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingProfile, setEditingProfile] = useState<GlobalLimitProfile | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)

  const loadGlobalLimits = () => {
    setIsLoading(true)
    Promise.all([hostingApi.configuration(), hostingApi.plans()])
      .then(([config, plansPage]) => {
        const policies = normalizeGlobalLimitPolicies(config.policies)
        setConfiguration(config)
        setPlans(plansPage.results)
        setProfiles(policies.profiles)
        setDefaultBandwidthMbps(String(policies.default_bandwidth_mbps))
        setDefaultDbConnections(String(policies.default_db_connections))
        setError("")
      })
      .catch((reason) => setError(readAdminError(reason, "No se pudieron cargar los limites globales.")))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadGlobalLimits()
  }, [])

  const savePolicies = async (nextProfiles = profiles) => {
    if (!configuration) return
    setIsSaving(true)
    setError("")
    try {
      const nextPolicies = buildGlobalLimitPolicies(configuration.policies, {
        default_bandwidth_mbps: numberFromText(defaultBandwidthMbps, 20),
        default_db_connections: numberFromText(defaultDbConnections, 300),
        profiles: nextProfiles,
      })
      const saved = await hostingApi.updateConfiguration({ policies: nextPolicies })
      const policies = normalizeGlobalLimitPolicies(saved.policies)
      setConfiguration(saved)
      setProfiles(policies.profiles)
      setDefaultBandwidthMbps(String(policies.default_bandwidth_mbps))
      setDefaultDbConnections(String(policies.default_db_connections))
      setMessage("Limites globales guardados.")
    } catch (reason) {
      setError(readAdminError(reason, "No se pudieron guardar los limites globales."))
    } finally {
      setIsSaving(false)
    }
  }

  const saveProfile = (profile: GlobalLimitProfile) => {
    const nextProfiles = profiles.some((item) => item.id === profile.id)
      ? profiles.map((item) => (item.id === profile.id ? profile : item))
      : [...profiles, profile]
    setProfiles(nextProfiles)
    setShowProfileModal(false)
    setEditingProfile(null)
    void savePolicies(nextProfiles)
  }

  const deleteProfile = (profile: GlobalLimitProfile) => {
    if (!window.confirm(`Eliminar el perfil de ${profile.plan_name}?`)) return
    const nextProfiles = profiles.filter((item) => item.id !== profile.id)
    setProfiles(nextProfiles)
    void savePolicies(nextProfiles)
  }

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Planes y paquetes</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Limites globales</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Limites generales de uso para evitar saturacion del nodo. El ancho de banda es velocidad maxima en Mbps, no transferencia mensual.
              </p>
            </div>
          </div>
          <Button disabled={isLoading || isSaving} onClick={() => void savePolicies()} size="sm">{isSaving ? "Guardando..." : "Guardar cambios"}</Button>
        </div>
      </section>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">{message}</div> : null}

      <section className="grid gap-3 xl:grid-cols-3">
        <div className="eh-card p-4">
          <div className="eh-kicker">Ancho de banda por defecto</div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <div className="text-3xl font-bold text-slate-900">{defaultBandwidthMbps || "20"} Mbps</div>
              <p className="mt-1 text-sm text-slate-500">Velocidad maxima global</p>
            </div>
            <Activity className="h-8 w-8 text-blue-700" />
          </div>
          <PlanTextInput label="Mbps" onChange={setDefaultBandwidthMbps} type="number" value={defaultBandwidthMbps} />
        </div>

        <div className="eh-card p-4">
          <div className="eh-kicker">Conexiones DB por defecto</div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <div className="text-3xl font-bold text-slate-900">{defaultDbConnections || "300"}</div>
              <p className="mt-1 text-sm text-slate-500">Max user connections</p>
            </div>
            <Database className="h-8 w-8 text-blue-700" />
          </div>
          <PlanTextInput label="Conexiones" onChange={setDefaultDbConnections} type="number" value={defaultDbConnections} />
        </div>

        <div className="eh-card p-4">
          <div className="eh-kicker">Perfiles por plan</div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <div className="text-3xl font-bold text-slate-900">{profiles.length}</div>
              <p className="mt-1 text-sm text-slate-500">Reglas especificas creadas</p>
            </div>
            <Gauge className="h-8 w-8 text-blue-700" />
          </div>
          <Button className="mt-4 w-full" disabled={isLoading} onClick={() => setShowProfileModal(true)} size="sm" variant="outline">Nuevo perfil</Button>
        </div>
      </section>

      <section>
        <div className="eh-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="font-bold">Perfiles de limites</h2>
              <p className="mt-1 text-sm text-slate-500">Reglas especificas vinculadas a planes cliente o revendedor existentes.</p>
            </div>
            <Button disabled={isLoading} onClick={() => setShowProfileModal(true)} size="sm" variant="outline">Nuevo perfil</Button>
          </div>
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {["Plan", "Tipo", "Ancho banda", "Conexiones DB", "Estado", "Acciones"].map((column) => (
                  <th className="px-4 py-2 font-bold" key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.map((profile) => (
                <tr className="hover:bg-slate-50" key={profile.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{profile.plan_name}</td>
                  <td className="px-4 py-3 text-slate-600">{profile.plan_scope === "reseller" ? "Revendedor" : "Cliente"}</td>
                  <td className="px-4 py-3 font-semibold text-blue-700">{profile.bandwidth_mbps} Mbps</td>
                  <td className="px-4 py-3">{profile.db_connections}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{profile.enabled ? "Activo" : "Inactivo"}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button onClick={() => setEditingProfile(profile)} size="sm" variant="outline">Editar</Button>
                      <Button onClick={() => deleteProfile(profile)} size="sm" variant="outline">Eliminar</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && profiles.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={6}>No hay perfiles de limites creados.</td>
                </tr>
              ) : null}
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={6}>Cargando limites reales...</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {showProfileModal || editingProfile ? (
        <GlobalLimitProfileModal
          defaultBandwidthMbps={numberFromText(defaultBandwidthMbps, 20)}
          defaultDbConnections={numberFromText(defaultDbConnections, 300)}
          onClose={() => {
            setShowProfileModal(false)
            setEditingProfile(null)
          }}
          onSave={saveProfile}
          plans={plans}
          profile={editingProfile}
        />
      ) : null}
    </div>
  )
}

type GlobalLimitProfile = {
  bandwidth_mbps: number
  db_connections: number
  enabled: boolean
  id: string
  plan_id: number
  plan_name: string
  plan_scope: "client" | "reseller"
}

type GlobalLimitPolicies = {
  default_bandwidth_mbps: number
  default_db_connections: number
  profiles: GlobalLimitProfile[]
}

function GlobalLimitProfileModal({
  defaultBandwidthMbps,
  defaultDbConnections,
  onClose,
  onSave,
  plans,
  profile,
}: {
  defaultBandwidthMbps: number
  defaultDbConnections: number
  onClose: () => void
  onSave: (profile: GlobalLimitProfile) => void
  plans: HostingPlan[]
  profile: GlobalLimitProfile | null
}) {
  const firstPlan = plans[0]
  const [planId, setPlanId] = useState(String(profile?.plan_id ?? firstPlan?.id ?? ""))
  const [bandwidthMbps, setBandwidthMbps] = useState(String(profile?.bandwidth_mbps ?? defaultBandwidthMbps))
  const [dbConnections, setDbConnections] = useState(String(profile?.db_connections ?? defaultDbConnections))
  const [enabled, setEnabled] = useState(profile?.enabled ?? true)
  const [error, setError] = useState("")

  const selectedPlan = plans.find((plan) => String(plan.id) === planId)

  const submit = () => {
    if (!selectedPlan) {
      setError("Debe seleccionar un plan.")
      return
    }
    const bandwidth = numberFromText(bandwidthMbps, defaultBandwidthMbps)
    const connections = numberFromText(dbConnections, defaultDbConnections)
    if (bandwidth <= 0) {
      setError("El ancho de banda debe ser mayor a 0 Mbps.")
      return
    }
    if (connections <= 0) {
      setError("Las conexiones a base de datos deben ser mayores a 0.")
      return
    }
    onSave({
      bandwidth_mbps: bandwidth,
      db_connections: connections,
      enabled,
      id: profile?.id ?? `profile-${Date.now()}`,
      plan_id: selectedPlan.id,
      plan_name: selectedPlan.name,
      plan_scope: selectedPlan.features?.plan_scope === "reseller" ? "reseller" : "client",
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[620px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">{profile ? "Editar perfil de limite" : "Nuevo perfil de limite"}</h3>
            <p className="mt-1 text-sm text-slate-500">Vincular un plan existente con limites de velocidad y conexiones de base de datos.</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>

        {error ? <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700">{error}</div> : null}

        <div className="space-y-4 p-5">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Plan</span>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500"
              onChange={(event) => setPlanId(event.target.value)}
              value={planId}
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} - {plan.features?.plan_scope === "reseller" ? "Revendedor" : "Cliente"}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <PlanTextInput label="Ancho de banda usado" onChange={setBandwidthMbps} suffix="Mbps" type="number" value={bandwidthMbps} />
            <PlanTextInput label="Conexiones DB" onChange={setDbConnections} type="number" value={dbConnections} />
          </div>

          <label className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            Perfil activo
            <input checked={enabled} className="h-4 w-4" onChange={(event) => setEnabled(event.target.checked)} type="checkbox" />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">Cancelar</Button>
          <Button disabled={plans.length === 0} onClick={submit} size="sm">Guardar perfil</Button>
        </div>
      </div>
    </div>
  )
}

function normalizeGlobalLimitPolicies(policies: Record<string, unknown>): GlobalLimitPolicies {
  const raw = isRecord(policies.global_limits) ? policies.global_limits : {}
  const rawProfiles = Array.isArray(raw.profiles) ? raw.profiles : []
  return {
    default_bandwidth_mbps: numberFromUnknown(raw.default_bandwidth_mbps, 20),
    default_db_connections: numberFromUnknown(raw.default_db_connections, 300),
    profiles: rawProfiles.map(normalizeGlobalLimitProfile).filter((profile): profile is GlobalLimitProfile => Boolean(profile)),
  }
}

function normalizeGlobalLimitProfile(value: unknown): GlobalLimitProfile | null {
  if (!isRecord(value)) return null
  const planId = numberFromUnknown(value.plan_id, 0)
  const planName = typeof value.plan_name === "string" ? value.plan_name : ""
  if (!planId || !planName) return null
  return {
    bandwidth_mbps: numberFromUnknown(value.bandwidth_mbps, 20),
    db_connections: numberFromUnknown(value.db_connections, 300),
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    id: typeof value.id === "string" ? value.id : `profile-${planId}`,
    plan_id: planId,
    plan_name: planName,
    plan_scope: value.plan_scope === "reseller" ? "reseller" : "client",
  }
}

function buildGlobalLimitPolicies(currentPolicies: Record<string, unknown>, limits: GlobalLimitPolicies) {
  return {
    ...currentPolicies,
    global_limits: limits,
  }
}

function numberFromUnknown(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function AdminAddOnsPage() {
  return (
    <section className="eh-card px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
          <Package className="h-5 w-5" />
        </div>
        <div>
          <div className="eh-kicker">Planes y paquetes</div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">Add-ons</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Modulo en desarrollo. Aqui se configuraran complementos comerciales como recursos extra, servicios adicionales y ampliaciones por cuenta.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-blue-700 shadow-sm">
          <Boxes className="h-6 w-6" />
        </div>
        <h2 className="mt-3 text-lg font-bold text-slate-900">En desarrollo</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
          Esta seccion queda reservada para definir add-ons cuando cerremos la estructura comercial del panel.
        </p>
      </div>
    </section>
  )
}

function AdminTaskQueuePage() {
  const [jobs, setJobs] = useState<AdminAgentJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDispatching, setIsDispatching] = useState("")
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [moduleFilter, setModuleFilter] = useState("all")
  const [selectedJob, setSelectedJob] = useState<AdminAgentJob | null>(null)

  const loadJobs = () => {
    setIsLoading(true)
    adminApi
      .jobs()
      .then((page) => {
        setJobs(page.results)
        setError("")
      })
      .catch((reason) => setError(readAdminError(reason, "No se pudo cargar la cola de tareas.")))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadJobs()
    const timer = window.setInterval(loadJobs, 10000)
    return () => window.clearInterval(timer)
  }, [])

  const dispatchJob = async (job: AdminAgentJob) => {
    setIsDispatching(job.id)
    setError("")
    try {
      await adminApi.dispatchJob(job.id)
      loadJobs()
    } catch (reason) {
      setError(readAdminError(reason, "No se pudo ejecutar la tarea."))
    } finally {
      setIsDispatching("")
    }
  }

  const queuedCount = jobs.filter((job) => job.status === "queued" || job.status === "sent").length
  const runningCount = jobs.filter((job) => job.status === "running").length
  const failedCount = jobs.filter((job) => job.status === "failed" || job.status === "expired").length
  const nextJob = jobs.find((job) => job.status === "queued" || job.status === "sent" || job.status === "running")
  const filteredJobs = jobs.filter((job) => {
    if (statusFilter !== "all" && job.status !== statusFilter) return false
    if (moduleFilter !== "all" && jobModuleLabel(job.job_type) !== moduleFilter) return false
    const term = search.trim().toLowerCase()
    if (!term) return true
    return jobSearchText(job).includes(term)
  })
  const activeCount = jobs.filter((job) => ["queued", "sent", "running"].includes(job.status)).length
  const lastFinished = jobs.find((job) => job.finished_at)

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Agentes</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Cola de tareas</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Jobs reales enviados a los agentes de nodos. Esta vista muestra cola, ejecucion, resultado y errores del backend.
              </p>
            </div>
          </div>
          <Button disabled={isLoading} onClick={loadJobs} size="sm" variant="outline">Actualizar</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="En cola" value={String(queuedCount)} detail={isLoading ? "Sincronizando..." : "Pendientes o enviadas"} />
        <AdminMetric label="Siguiente activa" value={nextJob ? jobTypeLabel(nextJob.job_type) : "N/D"} detail={nextJob ? `${jobStatusLabel(nextJob.status)} Â· ${formatDateTime(nextJob.queued_at)}` : "Sin jobs activos"} />
        <AdminMetric label="En progreso" value={String(runningCount)} detail="Ejecutandose ahora" />
        <AdminMetric label="Fallidas" value={String(failedCount)} detail="Requieren revision" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_330px]">
        <div className="eh-card overflow-hidden">
          {error ? <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex h-9 w-[380px] max-w-full items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              <input
                className="h-full flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar tarea, cuenta, nodo, error..."
                value={search}
              />
            </div>
            <div className="flex gap-2">
              <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                <option value="all">Todos los estados</option>
                <option value="queued">En cola</option>
                <option value="sent">Enviada</option>
                <option value="running">En progreso</option>
                <option value="success">Completada</option>
                <option value="failed">Fallida</option>
                <option value="expired">Expirada</option>
                <option value="canceled">Cancelada</option>
              </select>
              <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500" onChange={(event) => setModuleFilter(event.target.value)} value={moduleFilter}>
                <option value="all">Todos los modulos</option>
                {["Provisionamiento", "Migraciones", "Correo", "Bases de datos", "DNS", "SSL", "Backups", "Archivos", "Aplicaciones", "Seguridad", "Sistema"].map((module) => (
                  <option key={module} value={module}>{module}</option>
                ))}
              </select>
            </div>
          </div>

          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {["Orden", "Tarea", "Cuenta", "Modulo", "Nodo", "Ejecucion", "Estado", "Progreso", "Acciones"].map((column) => (
                  <th className="px-4 py-2 font-bold" key={column}>{column}</th>
                ))}
              </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
              {filteredJobs.map((task, index) => (
                <tr className="hover:bg-slate-50" key={task.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{index + 1}</span>
                      <span className="text-xs font-semibold text-slate-500">{formatTime(task.queued_at)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{jobTypeLabel(task.job_type)}</span>
                      {task.status === "failed" || task.status === "expired" ? <TaskPriorityBadge priority="Alta" /> : null}
                    </div>
                    <div className="mt-1 max-w-[240px] truncate text-xs text-slate-500">{task.error_detail || jobResultSummary(task)}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{jobAccountLabel(task)}</td>
                  <td className="px-4 py-3">{jobModuleLabel(task.job_type)}</td>
                  <td className="px-4 py-3 text-blue-700">{task.node_hostname || task.node}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{formatDateTime(task.started_at || task.sent_at || task.queued_at)}</div>
                    <div className="text-xs text-slate-500">{jobTimelineLabel(task)}</div>
                  </td>
                  <td className="px-4 py-3"><TaskStatusBadge status={jobStatusLabel(task.status)} /></td>
                  <td className="px-4 py-3">
                    <div className="w-28">
                      <div className="mb-1 text-xs font-semibold text-slate-500">{jobProgress(task.status)}%</div>
                      <div className="h-1.5 rounded-full bg-slate-200">
                        <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${jobProgress(task.status)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button onClick={() => setSelectedJob(task)} size="sm" variant="outline">Ver</Button>
                      <Button disabled={isDispatching === task.id || !jobIsDispatchable(task)} onClick={() => void dispatchJob(task)} size="sm" variant="outline">
                        {isDispatching === task.id ? "Enviando" : task.status === "failed" || task.status === "expired" ? "Reintentar" : "Ejecutar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredJobs.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={9}>{jobs.length ? "No hay tareas con esos filtros." : "No hay tareas registradas todavia."}</td>
                </tr>
              ) : null}
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={9}>Cargando cola real de agentes...</td>
                </tr>
              ) : null}
          </tbody>
        </table>
      </div>

        <aside className="eh-card p-4">
          <div className="eh-kicker">Estado real</div>
          <h3 className="mt-1 text-lg font-bold">Despacho por agente</h3>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Cada fila nace como un `AgentJob` en Django, se envia por WebSocket al agente del nodo y vuelve con estado, resultado o error.
          </p>
          <div className="mt-4 space-y-2">
            <AdminStatus label="Vista" value={`${filteredJobs.length} de ${jobs.length}`} />
            <AdminStatus label="Activas" value={String(activeCount)} />
            <AdminStatus label="Ultima finalizada" value={lastFinished ? formatDateTime(lastFinished.finished_at) : "N/D"} />
            <AdminStatus label="Refresco" value="Cada 10 s" />
          </div>
        </aside>
      </section>
      {selectedJob ? <AdminJobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} onDispatch={dispatchJob} isDispatching={isDispatching === selectedJob.id} /> : null}
    </div>
  )
}

function AdminJobDetailModal({
  isDispatching,
  job,
  onClose,
  onDispatch,
}: {
  isDispatching: boolean
  job: AdminAgentJob
  onClose: () => void
  onDispatch: (job: AdminAgentJob) => Promise<void>
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[920px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">{jobTypeLabel(job.job_type)}</h3>
            <p className="mt-1 text-sm text-slate-500">{job.node_hostname || job.node} Â· {job.id}</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_280px]">
          <section className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Datos del job</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <AdminField label="Estado" value={jobStatusLabel(job.status)} />
                <AdminField label="Modulo" value={jobModuleLabel(job.job_type)} />
                <AdminField label="Cuenta / dominio" value={jobAccountLabel(job)} />
                <AdminField label="Creada" value={formatDateTime(job.queued_at)} />
                <AdminField label="Enviada" value={formatDateTime(job.sent_at)} />
                <AdminField label="Finalizada" value={formatDateTime(job.finished_at)} />
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Payload enviado al agente</p>
              <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">{jsonPreview(redactSensitive(job.payload))}</pre>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Resultado / error</p>
              <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">{jsonPreview(job.status === "failed" ? { error_code: job.error_code, error_detail: job.error_detail, result: job.result } : job.result)}</pre>
            </div>
          </section>

          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="eh-kicker">Linea de tiempo</div>
            <h4 className="mt-1 text-lg font-bold">Ejecucion</h4>
            <div className="mt-4 space-y-2">
              <AdminStatus label="Queued" value={formatDateTime(job.queued_at)} />
              <AdminStatus label="Sent" value={formatDateTime(job.sent_at)} />
              <AdminStatus label="Running" value={formatDateTime(job.started_at)} />
              <AdminStatus label="Finished" value={formatDateTime(job.finished_at)} />
              <AdminStatus label="Duracion" value={jobDurationLabel(job)} />
            </div>
            {job.error_detail ? (
              <p className="mt-4 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{job.error_detail}</p>
            ) : null}
          </aside>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">Cancelar</Button>
          <Button disabled={isDispatching || !jobIsDispatchable(job)} onClick={() => void onDispatch(job)} size="sm">
            {isDispatching ? "Enviando" : job.status === "failed" || job.status === "expired" ? "Reintentar" : "Ejecutar"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function TaskStatusBadge({ status }: { status: string }) {
  const tone =
    status === "En progreso"
      ? "bg-blue-50 text-blue-700"
      : status === "En espera" || status === "En cola" || status === "Enviada"
        ? "bg-amber-50 text-amber-700"
        : status === "Fallida" || status === "Expirada"
          ? "bg-red-50 text-red-700"
          : status === "Completada"
            ? "bg-emerald-50 text-emerald-700"
            : "bg-slate-100 text-slate-700"

  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{status}</span>
}

function TaskPriorityBadge({ priority }: { priority: string }) {
  const tone = priority === "Alta" ? "bg-red-50 text-red-700" : priority === "Baja" ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", tone)}>{priority}</span>
}

function jobSearchText(job: AdminAgentJob) {
  return [
    job.id,
    job.node,
    job.node_hostname,
    job.job_type,
    job.status,
    jobAccountLabel(job),
    jobModuleLabel(job.job_type),
    job.error_code,
    job.error_detail,
    JSON.stringify(redactSensitive(job.payload)),
    JSON.stringify(job.result),
  ]
    .join(" ")
    .toLowerCase()
}

function jobIsDispatchable(job: AdminAgentJob) {
  return ["queued", "sent", "failed", "expired"].includes(job.status)
}

function jobTimelineLabel(job: AdminAgentJob) {
  if (job.finished_at) return `Finalizada ${formatDateTime(job.finished_at)}`
  if (job.started_at) return `Inicio ${formatDateTime(job.started_at)}`
  if (job.sent_at) return `Enviada ${formatDateTime(job.sent_at)}`
  return "Pendiente de envio"
}

function jobDurationLabel(job: AdminAgentJob) {
  const start = job.started_at || job.sent_at || job.queued_at
  const end = job.finished_at || (job.status === "running" ? new Date().toISOString() : null)
  if (!start || !end) return "N/D"
  const diff = Math.max(0, new Date(end).getTime() - new Date(start).getTime())
  const seconds = Math.round(diff / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes < 60) return `${minutes}m ${rest}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function jobResultSummary(job: AdminAgentJob) {
  if (job.status === "queued") return "Esperando envio al agente"
  if (job.status === "sent") return "Enviado, esperando confirmacion"
  if (job.status === "running") return "Ejecutandose en el nodo"
  const result = job.result || {}
  const keys = Object.keys(result).filter((key) => !["outputs", "output"].includes(key))
  return keys.length ? keys.slice(0, 3).join(", ") : "Sin resultado resumido"
}

function jsonPreview(value: unknown) {
  if (value === undefined || value === null || (isRecord(value) && Object.keys(value).length === 0)) {
    return "{}"
  }
  return JSON.stringify(value, null, 2)
}

function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item))
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, raw]) => {
      const normalized = key.toLowerCase()
      if (["password", "secret", "token", "private_key", "auth_secret"].some((part) => normalized.includes(part))) {
        return [key, raw ? "********" : raw]
      }
      return [key, redactSensitive(raw)]
    }),
  )
}

function AdminGlobalDnsPage() {
  const [records, setRecords] = useState<DnsTemplateRecord[]>([])
  const [config, setConfig] = useState<HostingConfiguration | null>(null)
  const [editingRecord, setEditingRecord] = useState<DnsTemplateRecord | null>(null)
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState("")

  const loadDnsTemplate = () => {
    setIsLoading(true)
    Promise.all([
      hostingApi.dnsTemplateRecords({
        is_active: statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined,
        search: search.trim() || undefined,
        type: typeFilter || undefined,
      }),
      hostingApi.configuration(),
    ])
      .then(([recordPage, configuration]) => {
        setRecords(recordPage.results)
        setConfig(configuration)
        setMessage("")
      })
      .catch((reason) => setMessage(readAdminError(reason, "No se pudo cargar la plantilla DNS global.")))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadDnsTemplate()
  }, [])

  const activeRecords = records.filter((record) => record.is_active)
  const typeCount = new Set(activeRecords.map((record) => record.type)).size
  const baseTtl = records.length ? Math.round(records.reduce((total, record) => total + record.ttl, 0) / records.length) : 0
  const dnsDefaults = config?.dns_defaults || {}

  const openCreateRecord = () => {
    setEditingRecord(null)
    setShowRecordModal(true)
  }

  const openEditRecord = (record: DnsTemplateRecord) => {
    setEditingRecord(record)
    setShowRecordModal(true)
  }

  const duplicateRecord = async (record: DnsTemplateRecord) => {
    try {
      const created = await hostingApi.duplicateDnsTemplateRecord(record.id)
      setRecords((current) => [...current, created].sort((a, b) => a.order - b.order))
      setMessage("")
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudo duplicar el registro."))
    }
  }

  const deleteRecord = async (record: DnsTemplateRecord) => {
    if (!window.confirm(`Eliminar el registro ${record.name} ${record.type}?`)) return
    try {
      await hostingApi.deleteDnsTemplateRecord(record.id)
      setRecords((current) => current.filter((item) => item.id !== record.id))
      setMessage("")
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudo eliminar el registro."))
    }
  }

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Dominios y DNS</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">DNS global</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Zona DNS base del servidor principal, usada para nameservers, correo, autodiscovery y registros globales del panel.
              </p>
            </div>
          </div>
          <Button onClick={openCreateRecord} size="sm">Anadir registro</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Servidor principal" value={String(config?.default_node_hostname || "N/D")} detail={String(config?.default_public_ip || "Sin IP principal")} />
        <AdminMetric label="Registros activos" value={String(activeRecords.length)} detail={`${records.length} en plantilla`} />
        <AdminMetric label="Tipos DNS" value={String(typeCount)} detail="A, AAAA, CNAME, MX, NS, SRV, TXT, CAA" />
        <AdminMetric label="TTL promedio" value={baseTtl ? String(baseTtl) : "N/D"} detail="Segundos" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_330px]">
        <div className="eh-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex h-9 w-[400px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              <input
                className="h-full flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") loadDnsTemplate()
                }}
                placeholder="Buscar host, tipo, valor o descripcion..."
                value={search}
              />
              <button className="text-xs font-bold text-blue-700" onClick={loadDnsTemplate} type="button">Buscar</button>
            </div>
            <div className="flex gap-2">
              <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none" onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
                <option value="">Tipo</option>
                {dnsRecordTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                <option value="">Estado</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
              <Button onClick={loadDnsTemplate} size="sm" variant="outline">Aplicar</Button>
            </div>
          </div>
          {message ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">{message}</div> : null}

          <table className="w-full min-w-[1160px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {["Host", "Tipo", "TTL", "Prioridad", "Valor", "Orden", "Estado", "Acciones"].map((column) => (
                  <th className="px-4 py-2 font-bold" key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => (
                <tr className="hover:bg-slate-50" key={record.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{record.name}</td>
                  <td className="px-4 py-3"><DnsTypeBadge type={record.type} /></td>
                  <td className="px-4 py-3">{record.ttl}</td>
                  <td className="px-4 py-3">{record.priority ?? "-"}</td>
                  <td className="max-w-[420px] truncate px-4 py-3 text-slate-600">{record.content}</td>
                  <td className="px-4 py-3">{record.order}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-1 text-xs font-bold", record.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>{record.is_active ? "Activo" : "Inactivo"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button onClick={() => openEditRecord(record)} size="sm" variant="outline">Editar</Button>
                      <Button onClick={() => void duplicateRecord(record)} size="sm" variant="outline">Duplicar</Button>
                      <Button onClick={() => void deleteRecord(record)} size="sm" variant="outline">Eliminar</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && records.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={8}>No hay registros en la plantilla DNS global.</td>
                </tr>
              ) : null}
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={8}>Cargando plantilla DNS...</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <aside className="eh-card p-4">
          <div className="eh-kicker">DNS del servidor</div>
          <h3 className="mt-1 text-lg font-bold">Parametros globales</h3>
          <div className="mt-4 space-y-2">
            <AdminStatus label="Nodo principal" value={String(config?.default_node_hostname || "N/D")} />
            <AdminStatus label="IPv4 principal" value={String(config?.default_public_ip || "N/D")} />
            <AdminStatus label="NS primario" value={String(dnsDefaults.primary_ns || dnsDefaults.ns1 || "N/D")} />
            <AdminStatus label="NS secundario" value={String(dnsDefaults.secondary_ns || dnsDefaults.ns2 || "N/D")} />
            <AdminStatus label="Servidor correo" value={String(dnsDefaults.mail_host || "mail")} />
            <AdminStatus label="TTL por defecto" value={String(dnsDefaults.ttl || baseTtl || "N/D")} />
          </div>
          <p className="mt-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
            Esta plantilla se usa como base al aplicar DNS en dominios de clientes. Los tokens como {"{domain}"} o {"{ip}"} se resuelven durante el aprovisionamiento.
          </p>
        </aside>
      </section>
      {showRecordModal ? (
        <DnsTemplateRecordModal
          onClose={() => setShowRecordModal(false)}
          onSaved={(saved) => {
            setShowRecordModal(false)
            setEditingRecord(null)
            setRecords((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved].sort((a, b) => a.order - b.order))
          }}
          record={editingRecord}
        />
      ) : null}
    </div>
  )
}

function DnsTypeBadge({ type }: { type: string }) {
  const tone =
    type === "TXT"
      ? "bg-amber-50 text-amber-700"
      : type === "MX" || type === "SRV"
        ? "bg-blue-50 text-blue-700"
        : type === "CNAME"
          ? "bg-cyan-50 text-cyan-700"
          : "bg-slate-100 text-slate-700"

  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{type}</span>
}

const dnsRecordTypes: DnsRecordType[] = ["A", "AAAA", "CNAME", "MX", "NS", "SRV", "TXT", "CAA"]

type DnsTemplateRecordFormState = {
  caa_flag: string
  caa_tag: string
  caa_value: string
  content: string
  description: string
  is_active: boolean
  name: string
  order: string
  priority: string
  srv_port: string
  srv_target: string
  srv_weight: string
  ttl: string
  type: DnsRecordType
}

function DnsTemplateRecordModal({ onClose, onSaved, record }: { onClose: () => void; onSaved: (record: DnsTemplateRecord) => void; record: DnsTemplateRecord | null }) {
  const [form, setForm] = useState<DnsTemplateRecordFormState>(() => dnsTemplateInitialForm(record))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  const update = <K extends keyof DnsTemplateRecordFormState>(key: K, value: DnsTemplateRecordFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setError("")
    try {
      const payload = dnsTemplatePayload(form)
      const saved = record ? await hostingApi.updateDnsTemplateRecord(record.id, payload) : await hostingApi.createDnsTemplateRecord(payload)
      onSaved(saved)
    } catch (reason) {
      setError(readAdminError(reason, "No se pudo guardar el registro DNS."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <form className="w-full max-w-[820px] overflow-hidden rounded-lg bg-white shadow-2xl" onSubmit={(event) => void submit(event)}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">{record ? "Editar registro DNS" : "Anadir registro DNS"}</h3>
            <p className="mt-1 text-sm text-slate-500">Define un registro de la plantilla global que se aplicara en dominios nuevos.</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>
        {error ? <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_260px]">
          <section className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Registro</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Tipo</span>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("type", event.target.value as DnsRecordType)} value={form.type}>
                    {dnsRecordTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <DnsTemplateInput label={dnsHostLabel(form.type)} onChange={(value) => update("name", value)} value={form.name} />
                <DnsTemplateInput label="TTL" onChange={(value) => update("ttl", value)} value={form.ttl} />
                <DnsTemplateInput label="Orden" onChange={(value) => update("order", value)} value={form.order} />
                {form.type === "MX" ? (
                  <>
                    <DnsTemplateInput label="Prioridad" onChange={(value) => update("priority", value)} value={form.priority} />
                    <DnsTemplateInput label="Servidor MX" onChange={(value) => update("content", value)} value={form.content} />
                  </>
                ) : form.type === "SRV" ? (
                  <>
                    <DnsTemplateInput label="Prioridad" onChange={(value) => update("priority", value)} value={form.priority} />
                    <DnsTemplateInput label="Peso" onChange={(value) => update("srv_weight", value)} value={form.srv_weight} />
                    <DnsTemplateInput label="Puerto" onChange={(value) => update("srv_port", value)} value={form.srv_port} />
                    <DnsTemplateInput label="Destino" onChange={(value) => update("srv_target", value)} value={form.srv_target} />
                  </>
                ) : form.type === "CAA" ? (
                  <>
                    <DnsTemplateInput label="Flag" onChange={(value) => update("caa_flag", value)} value={form.caa_flag} />
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Tag</span>
                      <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("caa_tag", event.target.value)} value={form.caa_tag}>
                        <option value="issue">issue</option>
                        <option value="issuewild">issuewild</option>
                        <option value="iodef">iodef</option>
                      </select>
                    </label>
                    <label className="block md:col-span-2">
                      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Valor CAA</span>
                      <input className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("caa_value", event.target.value)} value={form.caa_value} />
                    </label>
                  </>
                ) : (
                  <label className="block md:col-span-2">
                    <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{dnsValueLabel(form.type)}</span>
                    <textarea className="min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("content", event.target.value)} value={form.content} />
                  </label>
                )}
                <label className="flex items-center gap-2 pt-6 text-sm font-semibold text-slate-700">
                  <input checked={form.is_active} onChange={(event) => update("is_active", event.target.checked)} type="checkbox" />
                  Activo
                </label>
              </div>
            </div>
          </section>
          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="eh-kicker">Parametros</div>
            <h4 className="mt-1 text-lg font-bold">{form.type}</h4>
            <textarea className="mt-4 min-h-28 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("description", event.target.value)} placeholder="Descripcion interna..." value={form.description} />
            <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
              <p className="font-bold">Contenido resultante</p>
              <p className="mt-1 break-words">{dnsTemplatePayload(form).content || "Pendiente"}</p>
            </div>
            <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-500">
              Puedes usar tokens: {"{domain}"}, {"{ip}"}, {"{mail_host}"}, {"{dkim_txt}"}.
            </div>
          </aside>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm" type="button" variant="outline">Cancelar</Button>
          <Button disabled={isSaving || !form.name.trim()} size="sm" type="submit">{isSaving ? "Guardando..." : "Guardar registro"}</Button>
        </div>
      </form>
    </div>
  )
}

function DnsTemplateInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      <input className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  )
}

function dnsTemplateInitialForm(record: DnsTemplateRecord | null): DnsTemplateRecordFormState {
  const parsedSrv = record?.type === "SRV" ? parseSrvContent(record.content) : { port: "", target: "", weight: "0" }
  const parsedCaa = record?.type === "CAA" ? parseCaaContent(record.content) : { flag: "0", tag: "issue", value: "letsencrypt.org" }
  return {
    caa_flag: parsedCaa.flag,
    caa_tag: parsedCaa.tag,
    caa_value: parsedCaa.value,
    content: record && !["SRV", "CAA"].includes(record.type) ? record.content : "",
    description: record?.description || "",
    is_active: record?.is_active ?? true,
    name: record?.name || "@",
    order: String(record?.order ?? 100),
    priority: String(record?.priority ?? (record?.type === "MX" || record?.type === "SRV" ? 10 : "")),
    srv_port: parsedSrv.port,
    srv_target: parsedSrv.target,
    srv_weight: parsedSrv.weight,
    ttl: String(record?.ttl ?? 300),
    type: record?.type || "A",
  }
}

function dnsTemplatePayload(form: DnsTemplateRecordFormState): DnsTemplateRecordPayload {
  const type = form.type
  const content =
    type === "SRV"
      ? `${Number(form.srv_weight) || 0} ${Number(form.srv_port) || 0} ${form.srv_target.trim()}`
      : type === "CAA"
        ? `${Number(form.caa_flag) || 0} ${form.caa_tag.trim() || "issue"} "${form.caa_value.trim()}"`
        : form.content.trim()
  return {
    content,
    description: form.description,
    is_active: form.is_active,
    name: form.name.trim() || "@",
    order: Number(form.order) || 100,
    priority: type === "MX" || type === "SRV" ? Number(form.priority) || 0 : null,
    ttl: Number(form.ttl) || 300,
    type,
  }
}

function parseSrvContent(content: string) {
  const [weight = "0", port = "", ...target] = String(content || "").split(/\s+/)
  return { port, target: target.join(" "), weight }
}

function parseCaaContent(content: string) {
  const match = String(content || "").match(/^(\d+)\s+(\S+)\s+"?(.+?)"?$/)
  return { flag: match?.[1] || "0", tag: match?.[2] || "issue", value: match?.[3] || "" }
}

function dnsHostLabel(type: DnsRecordType) {
  if (type === "SRV") return "Servicio / host"
  if (type === "CAA") return "Host"
  return "Host"
}

function dnsValueLabel(type: DnsRecordType) {
  if (type === "A") return "IPv4"
  if (type === "AAAA") return "IPv6"
  if (type === "CNAME") return "Destino CNAME"
  if (type === "NS") return "Nameserver"
  if (type === "TXT") return "Texto"
  return "Valor"
}

function AdminNameserversPage() {
  const [showCreateNameserver, setShowCreateNameserver] = useState(false)
  const [editingNameserver, setEditingNameserver] = useState<GlobalNameserver | null>(null)
  const [viewingNameserver, setViewingNameserver] = useState<GlobalNameserver | null>(null)
  const [nameservers, setNameservers] = useState<GlobalNameserver[]>([])
  const [nodes, setNodes] = useState<AdminNode[]>([])
  const [config, setConfig] = useState<HostingConfiguration | null>(null)
  const [search, setSearch] = useState("")
  const [nodeFilter, setNodeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState("")

  const loadNameservers = () => {
    setIsLoading(true)
    Promise.all([
      hostingApi.globalNameservers({ node: nodeFilter || undefined, role: roleFilter || undefined, search: search.trim() || undefined, status: statusFilter || undefined }),
      adminApi.nodes(),
      hostingApi.configuration(),
    ])
      .then(([nameserverPage, nodePage, configuration]) => {
        setNameservers(nameserverPage.results)
        setNodes(nodePage.results)
        setConfig(configuration)
        setMessage("")
      })
      .catch((reason) => setMessage(readAdminError(reason, "No se pudieron cargar los nameservers.")))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadNameservers()
  }, [])

  const activeCount = nameservers.filter((ns) => ns.status === "active").length
  const reviewCount = nameservers.filter((ns) => ns.status === "review").length
  const nodeCount = new Set(nameservers.map((ns) => ns.node).filter(Boolean)).size
  const roles = Array.from(new Set(nameservers.map((ns) => ns.role).filter(Boolean)))

  const syncDefaults = async () => {
    try {
      const result = await hostingApi.syncGlobalNameservers()
      setNameservers(result.results)
      setMessage(result.created ? `${result.created} nameservers creados desde nodos.` : "Nameservers sincronizados con nodos.")
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudieron sincronizar los nameservers."))
    }
  }

  const deleteNameserver = async (ns: GlobalNameserver) => {
    if (!window.confirm(`Eliminar ${ns.hostname}?`)) return
    try {
      await hostingApi.deleteGlobalNameserver(ns.id)
      setNameservers((current) => current.filter((item) => item.id !== ns.id))
      setMessage("")
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudo eliminar el nameserver."))
    }
  }

  const testNameserver = async (ns: GlobalNameserver) => {
    try {
      await hostingApi.syncGlobalNameserverTemplate(ns.id)
      setMessage(`${ns.hostname} sincronizado con la plantilla DNS global.`)
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudo probar o sincronizar el nameserver."))
    }
  }

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Dominios y DNS</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Nameservers</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Relacion entre nameservers globales y nodos DNS. Permite ver que NS pertenece a cada servidor o replica.
              </p>
            </div>
          </div>
          <Button onClick={() => { setEditingNameserver(null); setShowCreateNameserver(true) }} size="sm">AÃ±adir nameserver</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Nameservers" value={String(nameservers.length)} detail={isLoading ? "Sincronizando..." : "Configurados"} />
        <AdminMetric label="Nodos DNS" value={String(nodeCount)} detail="Con NS asignados" />
        <AdminMetric label="Activos" value={String(activeCount)} detail="Disponibles en plantilla" />
        <AdminMetric label="En revision" value={String(reviewCount)} detail="Requieren IP o prueba" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_330px]">
        <div className="eh-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex h-9 w-[400px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              <input
                className="h-full flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") loadNameservers()
                }}
                placeholder="Buscar NS, IP, nodo o zona..."
                value={search}
              />
              <button className="text-xs font-bold text-blue-700" onClick={loadNameservers} type="button">Buscar</button>
            </div>
            <div className="flex gap-2">
              <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none" onChange={(event) => setNodeFilter(event.target.value)} value={nodeFilter}>
                <option value="">Nodo</option>
                {nodes.map((node) => <option key={node.id} value={node.id}>{node.hostname}</option>)}
              </select>
              <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                <option value="">Estado</option>
                <option value="active">Activo</option>
                <option value="review">En revision</option>
                <option value="inactive">Inactivo</option>
              </select>
              <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none" onChange={(event) => setRoleFilter(event.target.value)} value={roleFilter}>
                <option value="">Rol</option>
                {roles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
              <Button onClick={() => void syncDefaults()} size="sm" variant="outline">Sincronizar</Button>
            </div>
          </div>
          {message ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">{message}</div> : null}

          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {["Nameserver", "IP", "Nodo / servidor", "Rol", "Zona", "Estado", "Acciones"].map((column) => (
                  <th className="px-4 py-2 font-bold" key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nameservers.map((ns) => (
                <tr className="hover:bg-slate-50" key={ns.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{ns.hostname}</td>
                  <td className="px-4 py-3">{ns.ip_address || "IP N/D"}</td>
                  <td className="px-4 py-3 text-blue-700">{ns.node_hostname || "Sin nodo"}</td>
                  <td className="px-4 py-3">{ns.role}</td>
                  <td className="px-4 py-3">{ns.zone}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-1 text-xs font-bold", ns.status === "active" ? "bg-emerald-50 text-emerald-700" : ns.status === "review" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600")}>
                      {nameserverStatusLabel(ns.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button onClick={() => setViewingNameserver(ns)} size="sm" variant="outline">Ver</Button>
                      <Button onClick={() => { setEditingNameserver(ns); setShowCreateNameserver(true) }} size="sm" variant="outline">Editar</Button>
                      <Button onClick={() => void testNameserver(ns)} size="sm" variant="outline">Probar</Button>
                      <Button onClick={() => void deleteNameserver(ns)} size="sm" variant="outline">Eliminar</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && nameservers.length === 0 ? (
                <tr><td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={7}>No hay nameservers registrados.</td></tr>
              ) : null}
              {isLoading ? (
                <tr><td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={7}>Cargando nameservers...</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <aside className="eh-card p-4">
          <div className="eh-kicker">Distribucion</div>
          <h3 className="mt-1 text-lg font-bold">NS por nodo</h3>
          <div className="mt-4 space-y-2">
            {nameserverNodeGroups(nameservers).map((group) => (
              <AdminStatus key={group.node} label={group.node} value={group.labels} />
            ))}
            {!nameservers.length ? <AdminStatus label="Nodos" value="Sin asignar" /> : null}
            <AdminStatus label="Zona base" value={String(config?.dns_defaults?.base_domain || nameservers[0]?.zone || "ehclouding.com")} />
          </div>
          <p className="mt-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
            Cada nameserver activo sincroniza registros NS y A en la plantilla DNS global. Si agregas un nodo web nuevo, usa Sincronizar para crear el siguiente par NS.
          </p>
        </aside>
      </section>
      {showCreateNameserver ? (
        <CreateNameserverModal
          nodes={nodes}
          onClose={() => { setShowCreateNameserver(false); setEditingNameserver(null) }}
          onSaved={(saved) => {
            setShowCreateNameserver(false)
            setEditingNameserver(null)
            setNameservers((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved].sort((a, b) => a.sequence - b.sequence))
          }}
          record={editingNameserver}
          zone={String(config?.dns_defaults?.base_domain || nameservers[0]?.zone || "ehclouding.com")}
        />
      ) : null}
      {viewingNameserver ? <NameserverViewModal nameserver={viewingNameserver} onClose={() => setViewingNameserver(null)} /> : null}
    </div>
  )
}

function CreateNameserverModal({ nodes, onClose, onSaved, record, zone }: { nodes: AdminNode[]; onClose: () => void; onSaved: (nameserver: GlobalNameserver) => void; record: GlobalNameserver | null; zone: string }) {
  const [form, setForm] = useState(() => nameserverInitialForm(record, nodes, zone))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const selectedNode = nodes.find((node) => node.id === form.node)

  useEffect(() => {
    if (!selectedNode || form.ip_address || record) return
    update("ip_address", selectedNode.public_ip || "")
  }, [form.node])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setError("")
    try {
      const payload = nameserverPayload(form)
      onSaved(record ? await hostingApi.updateGlobalNameserver(record.id, payload) : await hostingApi.createGlobalNameserver(payload))
    } catch (reason) {
      setError(readAdminError(reason, "No se pudo guardar el nameserver."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <form className="w-full max-w-[680px] overflow-hidden rounded-lg bg-white shadow-2xl" onSubmit={(event) => void submit(event)}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">{record ? "Editar nameserver" : "Añadir nameserver"}</h3>
            <p className="mt-1 text-sm text-slate-500">Registrar un NS global y asignarlo a un nodo DNS del sistema.</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>
        {error ? <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
        <div className="p-5">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-bold">Datos del nameserver</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <NameserverInput label="Name Server / Hostname" onChange={(value) => update("hostname", value)} value={form.hostname} />
              <NameserverInput label="NS corto" onChange={(value) => update("short_name", value)} value={form.short_name} />
              <NameserverInput label="IP asignada" onChange={(value) => update("ip_address", value)} value={form.ip_address} />
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Nodo</span>
                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("node", event.target.value)} value={form.node}>
                  <option value="">Sin nodo</option>
                  {nodes.map((node) => <option key={node.id} value={node.id}>{node.hostname}</option>)}
                </select>
              </label>
              <NameserverInput label="Rol" onChange={(value) => update("role", value)} value={form.role} />
              <NameserverInput label="Zona" onChange={(value) => update("zone", value)} value={form.zone} />
              <NameserverInput label="Secuencia" onChange={(value) => update("sequence", value)} value={form.sequence} />
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Estado</span>
                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("status", event.target.value)} value={form.status}>
                  <option value="active">Activo</option>
                  <option value="review">En revision</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm" type="button" variant="outline">Cancelar</Button>
          <Button disabled={isSaving || !form.hostname.trim()} size="sm" type="submit">{isSaving ? "Guardando..." : "Guardar nameserver"}</Button>
        </div>
      </form>
    </div>
  )
}

function NameserverInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      <input className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  )
}

function NameserverViewModal({ nameserver, onClose }: { nameserver: GlobalNameserver; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[560px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">{nameserver.hostname}</h3>
            <p className="mt-1 text-sm text-slate-500">{nameserver.node_hostname || "Sin nodo"} · {nameserver.zone}</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>
        <div className="space-y-2 p-5">
          <AdminStatus label="IP" value={nameserver.ip_address || "N/D"} />
          <AdminStatus label="Rol" value={nameserver.role} />
          <AdminStatus label="Estado" value={nameserverStatusLabel(nameserver.status)} />
          <AdminStatus label="Registro NS" value={`${nameserver.zone}. NS ${nameserver.hostname}.`} />
          <AdminStatus label="Registro A" value={`${nameserver.short_name.toLowerCase()} A ${nameserver.ip_address || "N/D"}`} />
        </div>
      </div>
    </div>
  )
}

function nameserverInitialForm(record: GlobalNameserver | null, nodes: AdminNode[], zone: string) {
  const sequence = record?.sequence || 1
  const node = record?.node || nodes[0]?.id || ""
  const nodeInfo = nodes.find((item) => item.id === node)
  return {
    hostname: record?.hostname || `ns${sequence}.${zone}`,
    ip_address: record?.ip_address || nodeInfo?.public_ip || "",
    node,
    role: record?.role || (sequence % 2 === 1 ? "Primario" : "Secundario"),
    sequence: String(sequence),
    short_name: record?.short_name || `NS${sequence}`,
    status: record?.status || (nodeInfo?.public_ip ? "active" : "review"),
    zone: record?.zone || zone,
  }
}

function nameserverPayload(form: ReturnType<typeof nameserverInitialForm>): GlobalNameserverPayload {
  return {
    hostname: form.hostname.trim(),
    ip_address: form.ip_address.trim() || null,
    node: form.node || null,
    role: form.role.trim() || "Primario",
    sequence: Number(form.sequence) || 1,
    short_name: form.short_name.trim(),
    status: form.status as GlobalNameserverPayload["status"],
    zone: form.zone.trim() || "ehclouding.com",
  }
}

function nameserverStatusLabel(status: string) {
  if (status === "active") return "Activo"
  if (status === "review") return "En revision"
  return "Inactivo"
}

function nameserverNodeGroups(nameservers: GlobalNameserver[]) {
  const groups = new Map<string, string[]>()
  nameservers.forEach((ns) => {
    const key = ns.node_hostname || "Sin nodo"
    groups.set(key, [...(groups.get(key) || []), ns.short_name || `NS${ns.sequence}`])
  })
  return Array.from(groups.entries()).map(([node, labels]) => ({ labels: labels.join(", "), node }))
}

function AdminDnsZonesPage() {
  const [domains, setDomains] = useState<HostingDomain[]>([])
  const [records, setRecords] = useState<HostingDnsRecord[]>([])
  const [nameservers, setNameservers] = useState<GlobalNameserver[]>([])
  const [preview, setPreview] = useState<DnsTemplatePreviewRecord[]>([])
  const [selectedDomain, setSelectedDomain] = useState<HostingDomain | null>(null)
  const [search, setSearch] = useState("")
  const [nodeFilter, setNodeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [detailModalDomain, setDetailModalDomain] = useState<HostingDomain | null>(null)
  const [detailModalRecords, setDetailModalRecords] = useState<HostingDnsRecord[]>([])
  const [isDetailModalLoading, setIsDetailModalLoading] = useState(false)
  const [message, setMessage] = useState("")

  const loadZones = () => {
    setIsLoading(true)
    Promise.all([
      hostingApi.domains({ search: search.trim() || undefined, status: statusFilter || undefined }),
      hostingApi.globalNameservers(),
    ])
      .then(([domainPage, nameserverPage]) => {
        let rows = domainPage.results
        if (nodeFilter) rows = rows.filter((domain) => domain.node === nodeFilter || domain.node_hostname === nodeFilter)
        setDomains(rows)
        setNameservers(nameserverPage.results.filter((ns) => ns.status === "active"))
        setSelectedDomain((current) => rows.find((domain) => domain.id === current?.id) ?? rows[0] ?? null)
        setMessage("")
      })
      .catch((reason) => setMessage(readAdminError(reason, "No se pudieron cargar las zonas DNS.")))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadZones()
  }, [])

  useEffect(() => {
    if (!selectedDomain) {
      setRecords([])
      setPreview([])
      return
    }
    setIsDetailLoading(true)
    Promise.all([hostingApi.dnsRecords({ domain: selectedDomain.id, type: typeFilter || undefined }), hostingApi.dnsTemplatePreview(selectedDomain.id)])
      .then(([recordPage, previewData]) => {
        setRecords(recordPage.results)
        setPreview(previewData.records)
      })
      .catch((reason) => setMessage(readAdminError(reason, "No se pudo cargar el detalle DNS.")))
      .finally(() => setIsDetailLoading(false))
  }, [selectedDomain?.id, typeFilter])

  const syncedCount = domains.filter((domain) => domain.dns_status === "active").length
  const pendingCount = domains.filter((domain) => domain.dns_status === "pending").length
  const failedCount = domains.filter((domain) => domain.dns_status === "failed").length
  const customizedCount = selectedDomain && records.length ? 1 : 0
  const detailModalTypeCounts = dnsRecordTypes.map((type) => ({
    count: detailModalRecords.filter((record) => record.type === type).length,
    type,
  })).filter((item) => item.count > 0)

  const selectZone = (domain: HostingDomain) => {
    if (selectedDomain?.id !== domain.id) {
      setRecords([])
      setPreview([])
    }
    setSelectedDomain(domain)
  }

  const openZoneDetail = async (domain: HostingDomain) => {
    selectZone(domain)
    setDetailModalDomain(domain)
    setIsDetailModalLoading(true)
    try {
      const recordPage = await hostingApi.dnsRecords({ domain: domain.id })
      setDetailModalRecords(recordPage.results)
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudo cargar el detalle completo DNS."))
      setDetailModalRecords([])
    } finally {
      setIsDetailModalLoading(false)
    }
  }

  const syncZone = async (domain: HostingDomain) => {
    try {
      const updated = await hostingApi.syncDomainDns(domain.id)
      setDomains((current) => current.map((item) => item.id === updated.id ? updated : item))
      setSelectedDomain(updated)
      setMessage(`Sincronizacion DNS enviada para ${domain.domain}.`)
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudo sincronizar la zona."))
    }
  }

  const compareZone = async (domain: HostingDomain) => {
    try {
      const previewData = await hostingApi.dnsTemplatePreview(domain.id)
      setSelectedDomain(domain)
      setPreview(previewData.records)
      setMessage(`Comparacion con plantilla cargada para ${domain.domain}.`)
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudo comparar con la plantilla."))
    }
  }

  const applyTemplate = async (domain: HostingDomain) => {
    try {
      const response = await hostingApi.applyDnsTemplate(domain.id)
      setSelectedDomain(response.domain)
      setDomains((current) => current.map((item) => item.id === response.domain.id ? response.domain : item))
      setPreview(response.preview || [])
      setMessage(`Plantilla DNS aplicada a ${domain.domain}.`)
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudo aplicar la plantilla DNS."))
    }
  }

  const exportZone = async (domain: HostingDomain | null) => {
    if (!domain) return
    try {
      const recordPage = selectedDomain?.id === domain.id && !typeFilter ? { results: records } : await hostingApi.dnsRecords({ domain: domain.id })
      const zoneText = buildCloudflareZoneFile(domain, recordPage.results)
      downloadCloudflareZoneFile(domain.domain, zoneText)
      setMessage(`Zona ${domain.domain} exportada en formato BIND compatible con Cloudflare.`)
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudo exportar la zona DNS."))
    }
  }

  const selectedNameservers = nameservers.slice(0, 2)

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Dominios y DNS</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Zonas DNS</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">Zonas efectivas por dominio, cliente y nodo, conectadas a cuentas de hosting y a la plantilla DNS global.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!selectedDomain} onClick={() => selectedDomain && void syncZone(selectedDomain)} size="sm" variant="outline">Sincronizar seleccionada</Button>
            <Button disabled={!selectedDomain} onClick={() => void exportZone(selectedDomain)} size="sm">Exportar zona</Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Zonas activas" value={String(syncedCount)} detail={`${domains.length} zonas registradas`} />
        <AdminMetric label="Pendientes" value={String(pendingCount)} detail="Esperando sincronizacion" />
        <AdminMetric label="Con errores" value={String(failedCount)} detail="Requieren revision" />
        <AdminMetric label="Personalizadas" value={String(customizedCount)} detail="Difieren de plantilla" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="eh-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex h-9 w-[410px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              <input className="h-full flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") loadZones() }} placeholder="Buscar dominio o cuenta..." value={search} />
              <button className="text-xs font-bold text-blue-700" onClick={loadZones} type="button">Buscar</button>
            </div>
            <div className="flex gap-2">
              <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none" onChange={(event) => setNodeFilter(event.target.value)} value={nodeFilter}>
                <option value="">Nodo</option>
                {Array.from(new Set(domains.map((domain) => domain.node_hostname).filter(Boolean))).map((node) => <option key={node} value={node}>{node}</option>)}
              </select>
              <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                <option value="">Estado</option>
                <option value="dns_failed">Error DNS</option>
                <option value="ssl_failed">Error SSL</option>
              </select>
              <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none" onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
                <option value="">Tipo</option>
                {dnsRecordTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <Button onClick={loadZones} size="sm" variant="outline">Aplicar</Button>
            </div>
          </div>
          {message ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">{message}</div> : null}
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>{["Dominio", "Cuenta", "Nodo", "Registros", "Plantilla", "Estado", "Ultima sync", "Acciones"].map((column) => <th className="px-4 py-2 font-bold" key={column}>{column}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {domains.map((domain) => (
                <tr
                  className={cn("cursor-pointer hover:bg-slate-50", selectedDomain?.id === domain.id && "bg-blue-50")}
                  key={domain.id}
                  onClick={() => selectZone(domain)}
                >
                  <td className="px-4 py-3 font-semibold text-slate-900">{domain.domain}</td>
                  <td className="px-4 py-3">{domain.account_username || domain.account_domain}</td>
                  <td className="px-4 py-3 text-blue-700">{domain.node_hostname || "Nodo N/D"}</td>
                  <td className="px-4 py-3">{selectedDomain?.id === domain.id ? records.length : "Ver"}</td>
                  <td className="px-4 py-3">{zoneTemplateLabel(domain, selectedDomain, preview)}</td>
                  <td className="px-4 py-3"><AdminStatusBadge status={dnsZoneStatusLabel(domain)} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(domain.updated_at || null)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                      <Button onClick={() => void openZoneDetail(domain)} size="sm" variant="outline">Ver</Button>
                      <Button onClick={() => void syncZone(domain)} size="sm" variant="outline">Sincronizar</Button>
                      <Button onClick={() => void compareZone(domain)} size="sm" variant="outline">Comparar</Button>
                      <Button onClick={() => void exportZone(domain)} size="sm" variant="outline">Exportar</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && domains.length === 0 ? <tr><td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={8}>No hay zonas DNS registradas.</td></tr> : null}
              {isLoading ? <tr><td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={8}>Cargando zonas DNS...</td></tr> : null}
            </tbody>
          </table>
        </div>

        <aside className="eh-card p-4">
          {selectedDomain ? (
            <>
              <div className="eh-kicker">Detalle de zona</div>
              <h3 className="mt-1 text-lg font-bold">{selectedDomain.domain}</h3>
              <p className="mt-1 text-sm text-slate-500">{selectedDomain.account_username || selectedDomain.account_domain} · {selectedDomain.node_hostname || "Nodo N/D"}</p>
              <div className="mt-4 space-y-2">
                <AdminStatus label="NS asignados" value={selectedNameservers.map((ns) => ns.hostname).join(", ") || "N/D"} />
                <AdminStatus label="IP principal" value={mainZoneIp(records) || "N/D"} />
                <AdminStatus label="DNSSEC" value="Desactivado" />
                <AdminStatus label="Plantilla" value={preview.length ? "Default EHClouding" : "Sin comparar"} />
                <AdminStatus label="Estado DNS" value={dnsZoneStatusLabel(selectedDomain)} />
              </div>
              <div className="mt-5 rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 px-3 py-2 text-sm font-bold">Registros</div>
                <div className="max-h-72 divide-y divide-slate-100 overflow-auto">
                  {records.slice(0, 8).map((record) => (
                    <div className="px-3 py-2 text-sm" key={record.id}>
                      <div className="flex items-center justify-between gap-2"><span className="font-bold text-slate-900">{record.name}</span><DnsTypeBadge type={record.type} /></div>
                      <p className="mt-1 truncate text-xs text-slate-500">{record.priority ?? ""} {record.content}</p>
                    </div>
                  ))}
                  {!isDetailLoading && records.length === 0 ? <div className="px-3 py-6 text-center text-sm font-semibold text-slate-500">Sin registros cargados.</div> : null}
                  {isDetailLoading ? <div className="px-3 py-6 text-center text-sm font-semibold text-slate-500">Cargando registros...</div> : null}
                </div>
              </div>
              <div className="mt-5 rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 px-3 py-2 text-sm font-bold">Comparacion con plantilla</div>
                <div className="space-y-2 p-3">
                  <AdminStatus label="Nuevos" value={String(preview.filter((item) => item.status === "new").length)} />
                  <AdminStatus label="Actualizar" value={String(preview.filter((item) => item.status === "update").length)} />
                  <AdminStatus label="Iguales" value={String(preview.filter((item) => item.status === "same").length)} />
                </div>
                <div className="border-t border-slate-200 p-3"><Button onClick={() => void applyTemplate(selectedDomain)} size="sm" type="button" variant="outline">Aplicar plantilla</Button></div>
              </div>
            </>
          ) : <div className="p-8 text-center text-sm font-semibold text-slate-500">Selecciona una zona DNS.</div>}
        </aside>
      </section>

      {detailModalDomain ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <div className="eh-kicker">Detalle completo DNS</div>
                <h3 className="mt-1 text-xl font-bold text-slate-900">{detailModalDomain.domain}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {detailModalDomain.account_username || detailModalDomain.account_domain} · {detailModalDomain.node_hostname || "Nodo N/D"}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button onClick={() => void exportZone(detailModalDomain)} size="sm" variant="outline">Exportar Cloudflare</Button>
                <Button onClick={() => void syncZone(detailModalDomain)} size="sm" variant="outline">Sincronizar</Button>
                <Button onClick={() => setDetailModalDomain(null)} size="sm">Cerrar</Button>
              </div>
            </div>

            <div className="max-h-[calc(90vh-84px)] overflow-auto p-5">
              <div className="grid gap-3 md:grid-cols-4">
                <AdminMetric label="Registros" value={String(detailModalRecords.length)} detail={isDetailModalLoading ? "Cargando detalle" : "Zona completa"} />
                <AdminMetric label="IP principal" value={mainZoneIp(detailModalRecords) || "N/D"} detail="Registro A principal" />
                <AdminMetric label="Estado DNS" value={dnsZoneStatusLabel(detailModalDomain)} detail={formatDateTime(detailModalDomain.updated_at || null)} />
                <AdminMetric label="Plantilla" value={zoneTemplateLabel(detailModalDomain, selectedDomain, preview)} detail="Comparacion actual" />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <div className="text-sm font-bold text-slate-900">Registros de la zona</div>
                      <div className="text-xs text-slate-500">Lista completa cargada desde backend.</div>
                    </div>
                    {isDetailModalLoading ? <span className="text-xs font-bold text-blue-700">Cargando...</span> : null}
                  </div>
                  <div className="max-h-[420px] overflow-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          {["Host", "TTL", "Tipo", "Prioridad", "Valor"].map((column) => (
                            <th className="px-4 py-2 font-bold" key={column}>{column}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailModalRecords.map((record) => (
                          <tr key={record.id}>
                            <td className="px-4 py-2 font-semibold text-slate-900">{record.name || "@"}</td>
                            <td className="px-4 py-2 text-slate-600">{record.ttl}</td>
                            <td className="px-4 py-2"><DnsTypeBadge type={record.type} /></td>
                            <td className="px-4 py-2 text-slate-600">{record.priority ?? "N/D"}</td>
                            <td className="max-w-[360px] px-4 py-2 text-xs font-medium text-slate-600">{record.content}</td>
                          </tr>
                        ))}
                        {!isDetailModalLoading && detailModalRecords.length === 0 ? (
                          <tr><td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={5}>Sin registros DNS cargados.</td></tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="text-sm font-bold text-slate-900">Resumen operativo</div>
                    <div className="mt-3 space-y-2">
                      <AdminStatus label="NS asignados" value={selectedNameservers.map((ns) => ns.hostname).join(", ") || "N/D"} />
                      <AdminStatus label="Nodo" value={detailModalDomain.node_hostname || "N/D"} />
                      <AdminStatus label="Cuenta" value={detailModalDomain.account_username || detailModalDomain.account_domain || "N/D"} />
                      <AdminStatus label="DNSSEC" value="Desactivado" />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="text-sm font-bold text-slate-900">Tipos de registro</div>
                    <div className="mt-3 space-y-2">
                      {detailModalTypeCounts.map((item) => (
                        <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2" key={item.type}>
                          <DnsTypeBadge type={item.type} />
                          <span className="text-sm font-bold text-slate-900">{item.count}</span>
                        </div>
                      ))}
                      {!detailModalTypeCounts.length ? <div className="text-sm font-semibold text-slate-500">Sin registros para agrupar.</div> : null}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="text-sm font-bold text-slate-900">Comparacion con plantilla</div>
                    <div className="mt-3 space-y-2">
                      <AdminStatus label="Nuevos" value={String(preview.filter((item) => item.status === "new").length)} />
                      <AdminStatus label="Actualizar" value={String(preview.filter((item) => item.status === "update").length)} />
                      <AdminStatus label="Iguales" value={String(preview.filter((item) => item.status === "same").length)} />
                    </div>
                    <Button className="mt-3 w-full" onClick={() => void applyTemplate(detailModalDomain)} size="sm" type="button" variant="outline">Aplicar plantilla</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function dnsZoneStatusLabel(domain: HostingDomain) {
  if (domain.dns_status === "active") return "Completada"
  if (domain.dns_status === "failed") return "Fallido"
  return "Pendiente"
}

function zoneTemplateLabel(domain: HostingDomain, selected: HostingDomain | null, preview: DnsTemplatePreviewRecord[]) {
  if (domain.id !== selected?.id) return "Default EHClouding"
  return preview.some((item) => item.status === "update" || item.status === "new") ? "Personalizada" : "Default EHClouding"
}

function mainZoneIp(records: HostingDnsRecord[]) {
  return records.find((record) => record.type === "A" && record.name === "@")?.content || records.find((record) => record.type === "A")?.content || ""
}

type GlobalSslRow = {
  domain: HostingDomain
  expires: string
  issuer: string
  node: string
  remainingDays: number | null
  service: string
  status: string
  type: string
}

function AdminGlobalSslPage() {
  const [showCreateSsl, setShowCreateSsl] = useState(false)
  const [domains, setDomains] = useState<HostingDomain[]>([])
  const [selectedRow, setSelectedRow] = useState<GlobalSslRow | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [nodeFilter, setNodeFilter] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")

  const loadSslDomains = () => {
    setIsLoading(true)
    setMessage("")
    hostingApi.domains({ search: search.trim() || undefined, status: statusFilter || undefined })
      .then((page) => {
        let rows = page.results
        if (nodeFilter) rows = rows.filter((domain) => domain.node === nodeFilter || domain.node_hostname === nodeFilter)
        setDomains(rows)
      })
      .catch((reason) => setMessage(readAdminError(reason, "No se pudieron cargar los certificados SSL.")))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadSslDomains()
  }, [])

  const sslRows = domains.map(toGlobalSslRow)
  const activeRows = sslRows.filter((row) => row.status === "Activo")
  const renewalRows = sslRows.filter((row) => row.status === "Por renovar")
  const pendingRows = sslRows.filter((row) => row.status === "Pendiente" || row.status === "Sin SSL" || row.status === "Error")
  const uniqueNodes = Array.from(new Set(domains.map((domain) => domain.node_hostname).filter(Boolean)))

  const updateDomain = (updated: HostingDomain) => {
    setDomains((current) => current.map((domain) => domain.id === updated.id ? updated : domain))
    setSelectedRow((current) => current?.domain.id === updated.id ? toGlobalSslRow(updated) : current)
  }

  const issueSsl = async (domain: HostingDomain, forceRenewal = false) => {
    setIsSaving(true)
    setMessage("")
    try {
      const updated = await hostingApi.issueDomainSsl(domain.id, {
        email: "",
        force_renewal: forceRenewal,
        include_www: domain.domain_type !== "subdomain",
        staging: false,
      })
      updateDomain(updated)
      setMessage(`Emision SSL enviada al agente para ${updated.domain}.`)
      setShowCreateSsl(false)
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudo emitir el certificado SSL."))
    } finally {
      setIsSaving(false)
    }
  }

  const issuePendingSsl = async () => {
    if (pendingRows.length === 0) {
      setMessage("No hay dominios pendientes o con error para emitir SSL.")
      return
    }
    if (!window.confirm(`Enviar emision SSL para ${pendingRows.length} dominio(s) pendiente(s) o con error?`)) return
    setIsSaving(true)
    setMessage("")
    let queued = 0
    let failed = 0
    for (const row of pendingRows) {
      try {
        const updated = await hostingApi.issueDomainSsl(row.domain.id, {
          email: "",
          force_renewal: row.status === "Error",
          include_www: row.domain.domain_type !== "subdomain",
          staging: false,
        })
        updateDomain(updated)
        queued += 1
      } catch {
        failed += 1
      }
    }
    setIsSaving(false)
    setMessage(`Emision SSL global enviada: ${queued} en cola${failed ? `, ${failed} con error` : ""}.`)
  }

  const downloadSsl = async (row: GlobalSslRow) => {
    setIsSaving(true)
    setMessage("")
    try {
      const response = await hostingApi.downloadDomainSsl(row.domain.id)
      const blob = new Blob([response.content], { type: "application/x-pem-file;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = response.filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setMessage(`Certificado descargado para ${row.domain.domain}.`)
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudo descargar el certificado SSL."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">SSL y seguridad web</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">SSL global</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Inventario real de certificados registrados en EHPanel, incluyendo dominios del panel, complementos y cuentas de hosting.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={isSaving} onClick={() => void issuePendingSsl()} size="sm" variant="outline">Emitir pendientes</Button>
            <Button disabled={isSaving || domains.length === 0} onClick={() => setShowCreateSsl(true)} size="sm">Emitir / asignar SSL</Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Certificados" value={String(sslRows.length)} detail="Dominios registrados" />
        <AdminMetric label="Activos" value={String(activeRows.length)} detail="Sin accion requerida" />
        <AdminMetric label="Por renovar" value={String(renewalRows.length)} detail="Menos de 45 dias" />
        <AdminMetric label="Pendientes/error" value={String(pendingRows.length)} detail="Requieren emision" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_330px]">
        <div className="eh-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex h-9 w-[400px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              <input className="h-full flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") loadSslDomains() }} placeholder="Buscar servicio, dominio, emisor o nodo..." value={search} />
              <button className="text-xs font-bold text-blue-700" onClick={loadSslDomains} type="button">Buscar</button>
            </div>
            <div className="flex gap-2">
              <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                <option value="">Estado</option>
                <option value="ssl_failed">Error SSL</option>
              </select>
              <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none" onChange={(event) => setNodeFilter(event.target.value)} value={nodeFilter}>
                <option value="">Nodo</option>
                {uniqueNodes.map((node) => <option key={node} value={node}>{node}</option>)}
              </select>
              <Button onClick={loadSslDomains} size="sm" variant="outline">Aplicar</Button>
            </div>
          </div>
          {message ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">{message}</div> : null}

          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {["Servicio", "Dominio", "Tipo", "Emisor", "Nodo", "Vence", "Estado", "Acciones"].map((column) => (
                  <th className="px-4 py-2 font-bold" key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sslRows.map((ssl) => (
                <tr className={cn("cursor-pointer hover:bg-slate-50", selectedRow?.domain.id === ssl.domain.id && "bg-blue-50")} key={`${ssl.service}-${ssl.domain.domain}`} onClick={() => setSelectedRow(ssl)}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{ssl.service}</td>
                  <td className="px-4 py-3 text-blue-700">{ssl.domain.domain}</td>
                  <td className="px-4 py-3"><SslTypeBadge type={ssl.type} /></td>
                  <td className="px-4 py-3">{ssl.issuer}</td>
                  <td className="px-4 py-3">{ssl.node}</td>
                  <td className="px-4 py-3 font-semibold">{ssl.expires}</td>
                  <td className="px-4 py-3"><SslStatusBadge status={ssl.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                      <Button onClick={() => setSelectedRow(ssl)} size="sm" variant="outline">Ver</Button>
                      <Button disabled={isSaving} onClick={() => void issueSsl(ssl.domain, true)} size="sm" variant="outline">Renovar</Button>
                      <Button disabled={isSaving} onClick={() => void downloadSsl(ssl)} size="sm" variant="outline">Descargar</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && sslRows.length === 0 ? <tr><td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={8}>No hay dominios con SSL registrados.</td></tr> : null}
              {isLoading ? <tr><td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={8}>Cargando certificados reales...</td></tr> : null}
            </tbody>
          </table>
        </div>

        <aside className="eh-card p-4">
          <div className="eh-kicker">Vista rapida</div>
          <h3 className="mt-1 text-lg font-bold">{selectedRow?.domain.domain || "Selecciona un certificado"}</h3>
          {selectedRow ? (
            <div className="mt-4 space-y-2">
              <AdminStatus label="Servicio" value={selectedRow.service} />
              <AdminStatus label="Estado" value={selectedRow.status} />
              <AdminStatus label="Emisor" value={selectedRow.issuer} />
              <AdminStatus label="Nodo" value={selectedRow.node} />
              <AdminStatus label="Vence" value={selectedRow.expires} />
              <AdminStatus label="Ruta cert" value={selectedRow.domain.ssl_cert_path || "N/D"} />
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm font-semibold text-slate-500">Haz clic en una fila para ver el detalle.</div>
          )}
          <p className="mt-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
            Webmail y otros complementos deben aparecer aqui cuando su dominio exista registrado en EHPanel. Drive puede quedar separado si se administra como producto propio del ecosistema.
          </p>
        </aside>
      </section>

      {showCreateSsl ? (
        <CreateGlobalSslModal
          domains={domains}
          isSaving={isSaving}
          onClose={() => setShowCreateSsl(false)}
          onSubmit={(domain, forceRenewal) => void issueSsl(domain, forceRenewal)}
        />
      ) : null}
    </div>
  )
}

function CreateGlobalSslModal({
  domains,
  isSaving,
  onClose,
  onSubmit,
}: {
  domains: HostingDomain[]
  isSaving: boolean
  onClose: () => void
  onSubmit: (domain: HostingDomain, forceRenewal: boolean) => void
}) {
  const [domainId, setDomainId] = useState(domains[0]?.id ?? 0)
  const [forceRenewal, setForceRenewal] = useState(false)
  const selectedDomain = domains.find((domain) => domain.id === domainId) ?? domains[0] ?? null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[760px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Emitir / asignar SSL global</h3>
            <p className="mt-1 text-sm text-slate-500">Certificado para servicios internos del panel y nodos asociados.</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>

        <div className="p-5">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-bold">Datos del certificado</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Dominio real</span>
                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => setDomainId(Number(event.target.value))} value={selectedDomain?.id ?? ""}>
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.id}>{domain.domain}</option>
                  ))}
                </select>
              </label>
              <AdminField label="Servicio detectado" readonly value={selectedDomain ? detectGlobalSslService(selectedDomain) : "N/D"} />
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Tipo</span>
                <input className="h-10 w-full rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-700" readOnly value="Gratuito - Let's Encrypt" />
              </label>
              <AdminField label="Nodo" readonly value={selectedDomain?.node_hostname || "Nodo N/D"} />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input checked={forceRenewal} className="h-4 w-4" onChange={(event) => setForceRenewal(event.target.checked)} type="checkbox" />
              Forzar renovacion si ya existe certificado
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">Cancelar</Button>
          <Button disabled={!selectedDomain || isSaving} onClick={() => selectedDomain && onSubmit(selectedDomain, forceRenewal)} size="sm">{isSaving ? "Enviando..." : "Emitir SSL"}</Button>
        </div>
      </div>
    </div>
  )
}

function SslStatusBadge({ status }: { status: string }) {
  const tone = status === "Activo" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{status}</span>
}

function SslTypeBadge({ type }: { type: string }) {
  const tone = type === "Pago" ? "bg-purple-50 text-purple-700" : type === "Interno" ? "bg-slate-100 text-slate-700" : "bg-blue-50 text-blue-700"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{type}</span>
}

function toGlobalSslRow(domain: HostingDomain): GlobalSslRow {
  const remainingDays = domain.ssl_expires_at ? daysUntil(domain.ssl_expires_at) : null
  const status =
    domain.ssl_status === "failed"
      ? "Error"
      : domain.ssl_status === "active" && remainingDays !== null && remainingDays <= 45
        ? "Por renovar"
        : domain.ssl_status === "active"
          ? "Activo"
          : domain.ssl_issuer || domain.ssl_cert_path || domain.ssl_expires_at
            ? "Pendiente"
            : "Sin SSL"

  return {
    domain,
    expires: domain.ssl_expires_at ? formatDateTime(domain.ssl_expires_at) : "Pendiente",
    issuer: domain.ssl_issuer || (domain.ssl_status === "active" ? "Let's Encrypt" : "Pendiente"),
    node: domain.node_hostname || "Nodo N/D",
    remainingDays,
    service: detectGlobalSslService(domain),
    status,
    type: detectGlobalSslType(domain),
  }
}

function detectGlobalSslService(domain: HostingDomain) {
  const value = `${domain.domain} ${domain.account_username} ${domain.account_domain}`.toLowerCase()
  if (value.includes("webmail")) return "EHPanel Webmail"
  if (value.includes("drive")) return "EHPanel Drive"
  if (value.includes("api")) return "API interna"
  if (value.includes("agent")) return "Agente de nodos"
  if (value.includes("panel")) return "EHPanel Web"
  return domain.is_primary ? "Cuenta principal" : domain.domain_type === "subdomain" ? "Subdominio" : "Dominio hosting"
}

function detectGlobalSslType(domain: HostingDomain) {
  const issuer = (domain.ssl_issuer || "").toLowerCase()
  if (!issuer && domain.ssl_status !== "active") return "No asignado"
  if (issuer.includes("sectigo") || issuer.includes("digicert") || issuer.includes("comodoca") || issuer.includes("comodo")) return "Pago"
  if (issuer.includes("ehpanel") || issuer.includes("internal")) return "Interno"
  return "Gratuito"
}

function daysUntil(value: string) {
  const expiresAt = new Date(value).getTime()
  if (Number.isNaN(expiresAt)) return null
  return Math.ceil((expiresAt - Date.now()) / 86400000)
}

type ClientSslRow = {
  account?: HostingAccount
  accountId: string
  client: string
  domainCount: number
  domainObjects: HostingDomain[]
  domains: string[]
  expires: string
  remaining: number
  reseller: string
  sslStatus: string
  sslType: string
  targetDomain: HostingDomain
}

function AdminClientSslPage() {
  const [domains, setDomains] = useState<HostingDomain[]>([])
  const [accounts, setAccounts] = useState<HostingAccount[]>([])
  const [query, setQuery] = useState("")
  const [selectedRow, setSelectedRow] = useState<ClientSslRow | null>(null)
  const [issueRow, setIssueRow] = useState<ClientSslRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")

  const loadClientSsl = () => {
    setIsLoading(true)
    setMessage("")
    Promise.all([hostingApi.domains(), hostingApi.accounts()])
      .then(([domainPage, accountPage]) => {
        setDomains(domainPage.results)
        setAccounts(accountPage.results)
      })
      .catch((reason) => setMessage(readAdminError(reason, "No se pudieron cargar los SSL de clientes.")))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadClientSsl()
  }, [])

  const clientSslRows = buildClientSslRows(domains, accounts).filter((row) => {
    const haystack = `${row.client} ${row.reseller} ${row.sslStatus} ${row.sslType} ${row.domains.join(" ")}`.toLowerCase()
    return haystack.includes(query.toLowerCase())
  })
  const activeRows = clientSslRows.filter((row) => row.sslStatus === "Activo")
  const renewalRows = clientSslRows.filter((row) => row.sslStatus === "Por renovar")
  const withoutSslRows = clientSslRows.filter((row) => row.sslStatus === "Sin SSL" || row.sslStatus === "Error")

  const updateDomain = (updated: HostingDomain) => {
    setDomains((current) => current.map((domain) => domain.id === updated.id ? updated : domain))
  }

  const issueClientSsl = async (domain: HostingDomain, forceRenewal = false) => {
    setIsSaving(true)
    setMessage("")
    try {
      const updated = await hostingApi.issueDomainSsl(domain.id, {
        email: "",
        force_renewal: forceRenewal,
        include_www: domain.domain_type !== "subdomain",
        staging: false,
      })
      updateDomain(updated)
      setIssueRow(null)
      setMessage(`Emision SSL enviada al agente para ${updated.domain}.`)
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudo emitir o renovar el SSL del cliente."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">SSL y seguridad web</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">SSL de clientes</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Resumen por cliente del estado SSL en sus dominios y subdominios asignados.
              </p>
            </div>
          </div>
          <Button disabled={isSaving || clientSslRows.length === 0} onClick={() => setIssueRow(clientSslRows[0] ?? null)} size="sm">Emitir SSL cliente</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Clientes revisados" value={String(clientSslRows.length)} detail="Con dominios activos" />
        <AdminMetric label="SSL activos" value={String(activeRows.length)} detail="Sin accion requerida" />
        <AdminMetric label="Por renovar" value={String(renewalRows.length)} detail="Menos de 30 dias" />
        <AdminMetric label="Sin SSL" value={String(withoutSslRows.length)} detail="Pendiente emitir" />
      </section>

      <div className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex h-9 w-[420px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input className="h-full flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, dominio, revendedor o estado..." value={query} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">Estado</Button>
            <Button size="sm" variant="outline">Tipo</Button>
            <Button size="sm" variant="outline">Vencimiento</Button>
          </div>
        </div>
        {message ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">{message}</div> : null}

        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["Cliente", "Revendedor", "Dominios", "Lista de dominios", "SSL", "Tipo", "Tiempo restante", "Vence", "Acciones"].map((column) => (
                <th className="px-4 py-2 font-bold" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clientSslRows.map((row) => (
              <tr className="hover:bg-slate-50" key={row.client}>
                <td className="px-4 py-3 font-semibold text-slate-900">{row.client}</td>
                <td className="px-4 py-3 text-slate-600">{row.reseller}</td>
                <td className="px-4 py-3 font-semibold">{row.domainCount}</td>
                <td className="max-w-[320px] px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {row.domains.slice(0, 3).map((domain) => (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700" key={domain}>{domain}</span>
                    ))}
                    {row.domains.length > 3 ? <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">+{row.domains.length - 3}</span> : null}
                  </div>
                </td>
                <td className="px-4 py-3"><ClientSslStatusBadge status={row.sslStatus} /></td>
                <td className="px-4 py-3"><SslTypeBadge type={row.sslType} /></td>
                <td className="px-4 py-3">
                  <div className="w-32">
                    <div className="mb-1 text-xs font-semibold text-slate-500">{row.remaining}%</div>
                    <div className="h-1.5 rounded-full bg-slate-200">
                      <div
                        className={cn("h-1.5 rounded-full", row.remaining < 30 ? "bg-amber-500" : "bg-blue-600")}
                        style={{ width: `${row.remaining}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold">{row.expires}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button onClick={() => setSelectedRow(row)} size="sm" variant="outline">Ver</Button>
                    <Button disabled={isSaving} onClick={() => void issueClientSsl(row.targetDomain, true)} size="sm" variant="outline">Renovar</Button>
                    <Button disabled={isSaving} onClick={() => setIssueRow(row)} size="sm" variant="outline">Asignar</Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && clientSslRows.length === 0 ? <tr><td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={9}>No hay SSL de clientes para mostrar.</td></tr> : null}
            {isLoading ? <tr><td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={9}>Cargando SSL reales de clientes...</td></tr> : null}
          </tbody>
        </table>
      </div>

      {selectedRow ? <ClientSslDetailModal onClose={() => setSelectedRow(null)} row={selectedRow} /> : null}
      {issueRow ? (
        <ClientSslIssueModal
          isSaving={isSaving}
          onClose={() => setIssueRow(null)}
          onSubmit={(domain, forceRenewal) => void issueClientSsl(domain, forceRenewal)}
          row={issueRow}
        />
      ) : null}
    </div>
  )
}

function ClientSslDetailModal({ onClose, row }: { onClose: () => void; row: ClientSslRow }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[920px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Detalle SSL del cliente</h3>
            <p className="mt-1 text-sm text-slate-500">{row.client} · {row.reseller}</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>
        <div className="p-5">
          <section className="grid gap-3 md:grid-cols-4">
            <AdminMetric label="Dominios" value={String(row.domainCount)} detail="Incluye subdominios" />
            <AdminMetric label="Estado" value={row.sslStatus} detail="Resumen de cuenta" />
            <AdminMetric label="Vence" value={row.expires} detail="Fecha mas cercana" />
            <AdminMetric label="Mail SSL" value={clientMailSslLabel(row)} detail="mail.* o SAN mail" />
          </section>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {["Dominio", "Tipo", "SSL", "Emisor", "Vence", "Nodo", "Mail"].map((column) => <th className="px-4 py-2 font-bold" key={column}>{column}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {row.domainObjects.map((domain) => {
                  const sslRow = toGlobalSslRow(domain)
                  return (
                    <tr key={domain.id}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{domain.domain}</td>
                      <td className="px-4 py-3">{domain.domain_type}</td>
                      <td className="px-4 py-3"><ClientSslStatusBadge status={sslRow.status} /></td>
                      <td className="px-4 py-3">{sslRow.issuer}</td>
                      <td className="px-4 py-3">{sslRow.expires}</td>
                      <td className="px-4 py-3">{sslRow.node}</td>
                      <td className="px-4 py-3">{domainHasMailSsl(domain, row.domainObjects) ? "Protegido" : "N/D"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm">Cerrar</Button>
        </div>
      </div>
    </div>
  )
}

function ClientSslIssueModal({
  isSaving,
  onClose,
  onSubmit,
  row,
}: {
  isSaving: boolean
  onClose: () => void
  onSubmit: (domain: HostingDomain, forceRenewal: boolean) => void
  row: ClientSslRow
}) {
  const [domainId, setDomainId] = useState(row.targetDomain.id)
  const [forceRenewal, setForceRenewal] = useState(row.sslStatus === "Por renovar" || row.sslStatus === "Error")
  const selectedDomain = row.domainObjects.find((domain) => domain.id === domainId) ?? row.targetDomain
  const selectedSsl = toGlobalSslRow(selectedDomain)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[760px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Emitir SSL cliente</h3>
            <p className="mt-1 text-sm text-slate-500">{row.client} · operacion manual desde administracion</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>
        <div className="p-5">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-bold">Seleccion de dominio</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Dominio / subdominio</span>
                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => setDomainId(Number(event.target.value))} value={selectedDomain.id}>
                  {row.domainObjects.map((domain) => (
                    <option key={domain.id} value={domain.id}>{domain.domain}</option>
                  ))}
                </select>
              </label>
              <AdminField label="Estado actual" readonly value={selectedSsl.status} />
              <AdminField label="Emisor" readonly value={selectedSsl.issuer} />
              <AdminField label="Vence" readonly value={selectedSsl.expires} />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input checked={forceRenewal} className="h-4 w-4" onChange={(event) => setForceRenewal(event.target.checked)} type="checkbox" />
              Solicitar renovacion forzada si ya existe certificado
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">Cancelar</Button>
          <Button disabled={isSaving} onClick={() => onSubmit(selectedDomain, forceRenewal)} size="sm">{isSaving ? "Enviando..." : "Emitir / renovar"}</Button>
        </div>
      </div>
    </div>
  )
}

function ClientSslStatusBadge({ status }: { status: string }) {
  const tone =
    status === "Activo"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Por renovar"
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700"

  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{status}</span>
}

function buildClientSslRows(domains: HostingDomain[], accounts: HostingAccount[]): ClientSslRow[] {
  const accountMap = new Map(accounts.map((account) => [account.id, account]))
  const groups = new Map<string, HostingDomain[]>()
  for (const domain of domains) {
    const key = domain.account || domain.account_domain || domain.domain
    groups.set(key, [...(groups.get(key) || []), domain])
  }

  return Array.from(groups.entries()).map(([accountId, groupDomains]) => {
    const account = accountMap.get(accountId)
    const orderedDomains = [...groupDomains].sort((left, right) => Number(right.is_primary) - Number(left.is_primary) || left.domain.localeCompare(right.domain))
    const sslRows = orderedDomains.map(toGlobalSslRow)
    const targetDomain = pickClientSslTargetDomain(orderedDomains)
    const minRemaining = sslRows.reduce<number | null>((current, row) => {
      if (row.remainingDays === null) return current
      return current === null ? row.remainingDays : Math.min(current, row.remainingDays)
    }, null)
    const primaryStatus = clientSslStatus(orderedDomains)

    return {
      account,
      accountId,
      client: account?.customer_name || account?.owner_username || orderedDomains[0]?.account_username || account?.username || orderedDomains[0]?.account_domain || "Cliente N/D",
      domainCount: orderedDomains.length,
      domainObjects: orderedDomains,
      domains: orderedDomains.map((domain) => domain.domain),
      expires: clientSslExpires(orderedDomains),
      remaining: minRemaining === null ? 0 : Math.max(0, Math.min(100, Math.round((minRemaining / 90) * 100))),
      reseller: account?.reseller_username || "Sin revendedor",
      sslStatus: primaryStatus,
      sslType: clientSslType(orderedDomains),
      targetDomain,
    }
  }).sort((left, right) => left.client.localeCompare(right.client))
}

function clientSslStatus(domains: HostingDomain[]) {
  const rows = domains.map(toGlobalSslRow)
  if (rows.some((row) => row.status === "Error")) return "Error"
  if (rows.some((row) => row.status === "Sin SSL" || row.status === "Pendiente")) return "Sin SSL"
  if (rows.some((row) => row.status === "Por renovar" || (row.remainingDays !== null && row.remainingDays <= 30))) return "Por renovar"
  return "Activo"
}

function clientSslType(domains: HostingDomain[]) {
  const types = new Set(domains.map((domain) => detectGlobalSslType(domain)))
  if (types.has("No asignado")) return "No asignado"
  if (types.size > 1) return "Mixto"
  return Array.from(types)[0] || "No asignado"
}

function clientSslExpires(domains: HostingDomain[]) {
  const dates = domains
    .map((domain) => domain.ssl_expires_at)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())
  return dates[0] ? formatDateTime(dates[0]) : "Pendiente"
}

function pickClientSslTargetDomain(domains: HostingDomain[]) {
  return [...domains].sort((left, right) => clientSslPriority(left) - clientSslPriority(right))[0] || domains[0]
}

function clientSslPriority(domain: HostingDomain) {
  if (domain.ssl_status === "failed") return 0
  if (domain.ssl_status !== "active") return 1
  const remaining = domain.ssl_expires_at ? daysUntil(domain.ssl_expires_at) : null
  if (remaining !== null && remaining <= 30) return 2
  return domain.is_primary ? 3 : 4
}

function clientMailSslLabel(row: ClientSslRow) {
  return row.domainObjects.some((domain) => domainHasMailSsl(domain, row.domainObjects)) ? "Protegido" : "N/D"
}

function domainHasMailSsl(domain: HostingDomain, domains: HostingDomain[]) {
  const mailHost = `mail.${domain.domain}`
  const sslDomains = Array.isArray(domain.ssl_domains) ? domain.ssl_domains : []
  return sslDomains.includes(mailHost) || sslDomains.includes(`*.${domain.domain}`) || domains.some((item) => item.domain === mailHost && item.ssl_status === "active")
}

type AdminWafRuleRow = {
  action: string
  category: string
  hits: number
  id: string
  severity: string
  status: string
}

type AdminWafEventRow = {
  action: string
  client: string
  date: string
  ip: string
  reason: string
  rule: string
  severity: string
}

function AdminWafFirewallPage() {
  const [activeTab, setActiveTab] = useState("Politicas")
  const [wafRows, setWafRows] = useState<HostingWafResponse[]>([])
  const [ipBlocks, setIpBlocks] = useState<HostingIpBlock[]>([])
  const [selectedDomainId, setSelectedDomainId] = useState<number | null>(null)
  const [query, setQuery] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const tabs = ["Politicas", "Reglas", "ModSecurity", "Eventos", "Parametros"]

  const selectedWaf = wafRows.find((row) => row.domain.id === selectedDomainId) ?? wafRows[0] ?? null
  const filteredWafRows = wafRows.filter((row) => {
    const haystack = `${row.domain.domain} ${row.domain.account_username} ${row.configuration.mode} ${row.configuration.status}`.toLowerCase()
    return haystack.includes(query.toLowerCase())
  })
  const eventRows = wafRows.flatMap(toAdminWafEvents).filter((event) => `${event.client} ${event.ip} ${event.rule} ${event.action}`.toLowerCase().includes(query.toLowerCase()))
  const ruleRows = buildAdminWafRuleRows(wafRows)
  const protectedCount = wafRows.filter((row) => row.configuration.mode !== "disabled" && row.configuration.status === "active").length
  const blockModeCount = wafRows.filter((row) => row.configuration.mode === "block").length
  const failedCount = wafRows.filter((row) => row.configuration.status === "failed").length
  const activeIpBlocks = ipBlocks.filter((block) => block.enabled && block.status !== "expired" && block.status !== "disabled")

  const loadWafData = async () => {
    setIsLoading(true)
    setMessage("")
    try {
      const [domainPage, ipBlockPage] = await Promise.all([hostingApi.domains(), hostingApi.ipBlocks()])
      setIpBlocks(ipBlockPage.results)
      const results = await Promise.allSettled(domainPage.results.map((domain) => hostingApi.waf(domain.id)))
      const rows = results.filter((result): result is PromiseFulfilledResult<HostingWafResponse> => result.status === "fulfilled").map((result) => result.value)
      setWafRows(rows)
      setSelectedDomainId((current) => current ?? rows[0]?.domain.id ?? null)
      const failedLoads = results.length - rows.length
      if (failedLoads) setMessage(`${failedLoads} dominio(s) no devolvieron configuracion WAF.`)
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudieron cargar los datos WAF reales."))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadWafData()
  }, [])

  const updateWaf = async (domainId: number, payload: Partial<HostingWafResponse["configuration"]>) => {
    setIsSaving(true)
    setMessage("")
    try {
      const response = await hostingApi.updateWaf(domainId, payload)
      setWafRows((current) => [...current.filter((row) => row.domain.id !== response.domain.id), response].sort((left, right) => left.domain.domain.localeCompare(right.domain.domain)))
      setSelectedDomainId(response.domain.id)
      setMessage(`Politica WAF enviada al agente para ${response.domain.domain}.`)
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudo actualizar la politica WAF."))
    } finally {
      setIsSaving(false)
    }
  }

  const applyAll = async () => {
    if (!window.confirm(`Aplicar modo bloqueo WAF a ${wafRows.length} dominio(s)?`)) return
    setIsSaving(true)
    let applied = 0
    let failed = 0
    for (const row of wafRows) {
      try {
        const response = await hostingApi.updateWaf(row.domain.id, { mode: "block" })
        setWafRows((current) => [...current.filter((item) => item.domain.id !== response.domain.id), response].sort((left, right) => left.domain.domain.localeCompare(right.domain.domain)))
        applied += 1
      } catch {
        failed += 1
      }
    }
    setIsSaving(false)
    setMessage(`Aplicacion WAF global enviada: ${applied} dominio(s)${failed ? `, ${failed} con error` : ""}.`)
  }

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">SSL y seguridad web</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">WAF / Firewall</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Centro global de seguridad web para politicas WAF, ModSecurity, reglas, eventos y parametros de proteccion.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button disabled={isLoading} onClick={() => void loadWafData()} size="sm" variant="outline">Actualizar reglas</Button>
            <Button disabled={isSaving || wafRows.length === 0} onClick={() => void applyAll()} size="sm">Nueva politica</Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-5">
        <AdminMetric label="WAF global" value={blockModeCount ? "Bloqueo" : protectedCount ? "Monitoreo" : "Inactivo"} detail="Politica efectiva" />
        <AdminMetric label="ModSecurity" value={protectedCount ? "Activo" : "Pendiente"} detail="Motor instalado en nodo" />
        <AdminMetric label="Reglas activas" value={String(ruleRows.filter((rule) => rule.status === "Activa").length)} detail="OWASP + propias" />
        <AdminMetric label="Bloqueos 24h" value={String(eventRows.length)} detail="Eventos desde agente" />
        <AdminMetric label="Dominios protegidos" value={String(protectedCount)} detail={`${wafRows.length} dominios revisados`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_330px]">
        <div className="eh-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex rounded-md border border-slate-200 bg-slate-50 p-1">
              {tabs.map((tab) => (
                <button
                  className={cn("h-8 rounded px-3 text-sm font-semibold text-slate-600", activeTab === tab && "bg-white text-blue-700 shadow-sm")}
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  type="button"
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="flex h-9 w-[300px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              <input className="h-full flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar politica, regla, IP o dominio..." value={query} />
            </div>
          </div>
          {message ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">{message}</div> : null}

          {activeTab === "Politicas" ? (
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {["Politica", "Alcance", "Modo", "Nivel", "ModSecurity", "Estado", "Acciones"].map((column) => (
                    <th className="px-4 py-2 font-bold" key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWafRows.map((policy) => (
                  <tr className={cn("cursor-pointer hover:bg-slate-50", selectedDomainId === policy.domain.id && "bg-blue-50")} key={policy.configuration.id} onClick={() => setSelectedDomainId(policy.domain.id)}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{policy.domain.domain}</td>
                    <td className="px-4 py-3">{policy.domain.account_username || policy.domain.account_domain}</td>
                    <td className="px-4 py-3"><WafModeBadge mode={wafModeLabelAdmin(policy.configuration.mode)} /></td>
                    <td className="px-4 py-3">{wafLevelLabel(policy)}</td>
                    <td className="px-4 py-3"><MoxStatusBadge status={policy.configuration.mode === "disabled" ? "Inactivo" : "Activo"} /></td>
                    <td className="px-4 py-3"><WafStateBadge status={wafStatusLabelAdmin(policy.configuration.status)} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                        <Button disabled={isSaving} onClick={() => void updateWaf(policy.domain.id, { mode: policy.configuration.mode === "block" ? "monitor" : "block" })} size="sm" variant="outline">Editar</Button>
                        <Button disabled={isSaving} onClick={() => void updateWaf(policy.domain.id, duplicateWafPayload(policy))} size="sm" variant="outline">Duplicar</Button>
                        <Button disabled={isSaving} onClick={() => void updateWaf(policy.domain.id, { mode: "block" })} size="sm" variant="outline">Aplicar</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && filteredWafRows.length === 0 ? <tr><td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={7}>No hay politicas WAF reales para mostrar.</td></tr> : null}
                {isLoading ? <tr><td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={7}>Cargando WAF real desde backend...</td></tr> : null}
              </tbody>
            </table>
          ) : activeTab === "Reglas" ? (
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {["ID", "Categoria", "Severidad", "Accion", "Activaciones", "Estado", "Acciones"].map((column) => (
                    <th className="px-4 py-2 font-bold" key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ruleRows.map((rule) => (
                  <tr className="hover:bg-slate-50" key={rule.id}>
                    <td className="px-4 py-3 font-semibold text-blue-700">{rule.id}</td>
                    <td className="px-4 py-3">{rule.category}</td>
                    <td className="px-4 py-3"><SeverityBadge severity={rule.severity} /></td>
                    <td className="px-4 py-3">{rule.action}</td>
                    <td className="px-4 py-3 font-semibold">{rule.hits}</td>
                    <td className="px-4 py-3"><WafStateBadge status={rule.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button disabled={!selectedWaf} onClick={() => selectedWaf && setSelectedDomainId(selectedWaf.domain.id)} size="sm" variant="outline">Ver</Button>
                        <Button disabled={!selectedWaf || isSaving} onClick={() => selectedWaf && void updateWaf(selectedWaf.domain.id, ruleToPayload(selectedWaf, rule))} size="sm" variant="outline">Configurar</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!ruleRows.length ? <tr><td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={7}>Sin reglas WAF configuradas.</td></tr> : null}
              </tbody>
            </table>
          ) : activeTab === "ModSecurity" ? (
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["Motor", protectedCount ? "Activo" : "Pendiente"],
                ["Modo", blockModeCount ? "Bloqueo" : protectedCount ? "Monitoreo" : "Desactivado"],
                ["Sensibilidad", wafRows.some((row) => row.configuration.owasp_crs && row.configuration.wordpress_rules) ? "Alta" : "Media"],
                ["Proteccion login", wafRows.some((row) => row.configuration.rate_limit_login) ? "Activa" : "Inactiva"],
                ["WordPress XML-RPC", wafRows.some((row) => row.configuration.block_xmlrpc) ? "Limitado" : "Permitido"],
                ["Reputacion IP", activeIpBlocks.length ? "Bloqueo automatico" : "Sin bloqueos activos"],
              ].map(([label, value]) => (
                <AdminStatus key={label} label={label} value={value} />
              ))}
              <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-3 text-sm leading-6 text-blue-700 md:col-span-2 xl:col-span-3">
                ModSecurity usa las reglas aplicadas al nodo por dominio. La reputacion IP y fuerza bruta se reflejan desde eventos WAF y bloqueos activos registrados en EHPanel.
              </div>
            </div>
          ) : activeTab === "Eventos" ? (
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {["Hora", "Dominio / cliente", "IP", "Regla", "Severidad", "Accion", "Explicacion"].map((column) => (
                    <th className="px-4 py-2 font-bold" key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {eventRows.map((event) => (
                  <tr className="hover:bg-slate-50" key={`${event.date}-${event.ip}-${event.rule}`}>
                    <td className="px-4 py-3 font-semibold">{event.date}</td>
                    <td className="px-4 py-3 text-blue-700">{event.client}</td>
                    <td className="px-4 py-3">{event.ip}</td>
                    <td className="px-4 py-3">{event.rule}</td>
                    <td className="px-4 py-3"><SeverityBadge severity={event.severity} /></td>
                    <td className="px-4 py-3">{event.action}</td>
                    <td className="max-w-[360px] px-4 py-3 text-slate-600">{event.reason}</td>
                  </tr>
                ))}
                {!isLoading && eventRows.length === 0 ? <tr><td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={7}>Sin eventos WAF reales registrados desde el agente.</td></tr> : null}
                {isLoading ? <tr><td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={7}>Consultando eventos WAF...</td></tr> : null}
              </tbody>
            </table>
          ) : (
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["Dominio seleccionado", selectedWaf?.domain.domain || "N/D"],
                ["Modo nuevos dominios", selectedWaf ? wafModeLabelAdmin(selectedWaf.configuration.mode) : "N/D"],
                ["OWASP CRS", selectedWaf?.configuration.owasp_crs ? "Activo" : "Inactivo"],
                ["Reglas WordPress", selectedWaf?.configuration.wordpress_rules ? "Activas" : "Inactivas"],
                ["Rate limit login", selectedWaf?.configuration.rate_limit_login ? "Activo" : "Inactivo"],
                ["Bloqueo XML-RPC", selectedWaf?.configuration.block_xmlrpc ? "Activo" : "Inactivo"],
              ].map(([label, value]) => (
                <AdminStatus key={label} label={label} value={value} />
              ))}
              <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-3">
                <Button disabled={!selectedWaf || isSaving} onClick={() => selectedWaf && void updateWaf(selectedWaf.domain.id, { owasp_crs: !selectedWaf.configuration.owasp_crs })} size="sm" variant="outline">Editar OWASP</Button>
                <Button disabled={!selectedWaf || isSaving} onClick={() => selectedWaf && void updateWaf(selectedWaf.domain.id, { wordpress_rules: !selectedWaf.configuration.wordpress_rules })} size="sm" variant="outline">Editar WordPress</Button>
                <Button disabled={!selectedWaf || isSaving} onClick={() => selectedWaf && void updateWaf(selectedWaf.domain.id, { rate_limit_login: !selectedWaf.configuration.rate_limit_login })} size="sm" variant="outline">Editar login</Button>
                <Button disabled={!selectedWaf || isSaving} onClick={() => selectedWaf && void updateWaf(selectedWaf.domain.id, { block_xmlrpc: !selectedWaf.configuration.block_xmlrpc })} size="sm" variant="outline">Editar XML-RPC</Button>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="eh-card p-4">
            <div className="eh-kicker">Bloqueos IP</div>
            <h3 className="mt-1 text-lg font-bold">Acceso rapido</h3>
            <div className="mt-4 space-y-2">
              <AdminStatus label="Temporales" value={`${activeIpBlocks.filter((block) => block.expires_on).length} activos`} />
              <AdminStatus label="Permanentes" value={`${activeIpBlocks.filter((block) => !block.expires_on).length} activos`} />
              <AdminStatus label="Origen mayor" value="ModSecurity" />
            </div>
            <Button className="mt-4 w-full" size="sm" variant="outline">Ver bloqueos IP</Button>
          </div>

          <div className="eh-card p-4">
            <div className="eh-kicker">Salud WAF</div>
            <h3 className="mt-1 text-lg font-bold">Operacion normal</h3>
            <div className="mt-4 space-y-3">
              <SecuritySignal label="Reglas sincronizadas" value={wafRows.length ? Math.round((wafRows.filter((row) => row.configuration.status === "active").length / wafRows.length) * 100) : 0} />
              <SecuritySignal label="Eventos clasificados" value={eventRows.length ? 100 : 0} />
              <SecuritySignal label="Con errores" value={wafRows.length ? Math.round((failedCount / wafRows.length) * 100) : 0} inverse />
            </div>
          </div>
        </aside>
      </section>
    </div>
  )
}

function toAdminWafEvents(row: HostingWafResponse): AdminWafEventRow[] {
  return row.recent_events.map((event) => ({
    action: event.action || event.status || "Registrado",
    client: row.domain.domain,
    date: event.date || row.configuration.updated_at,
    ip: event.source || "N/D",
    reason: [event.method, event.path].filter(Boolean).join(" ") || event.status || "Evento WAF registrado por el agente.",
    rule: event.rule || "ModSecurity",
    severity: event.severity || inferWafSeverity(event.rule || event.action || ""),
  }))
}

function buildAdminWafRuleRows(rows: HostingWafResponse[]): AdminWafRuleRow[] {
  const eventCounts = new Map<string, number>()
  for (const row of rows) {
    for (const event of row.recent_events) {
      const key = event.rule || "ModSecurity"
      eventCounts.set(key, (eventCounts.get(key) || 0) + 1)
    }
  }

  const baseRules: AdminWafRuleRow[] = [
    { action: "Bloquear", category: "OWASP Core Rules", hits: rows.filter((row) => row.configuration.owasp_crs).length, id: "OWASP-CRS", severity: "Alta", status: rows.some((row) => row.configuration.owasp_crs) ? "Activa" : "Inactiva" },
    { action: "Bloquear", category: "WordPress", hits: rows.filter((row) => row.configuration.wordpress_rules).length, id: "WP-RULES", severity: "Media", status: rows.some((row) => row.configuration.wordpress_rules) ? "Activa" : "Inactiva" },
    { action: "Bloquear", category: "XML-RPC", hits: rows.filter((row) => row.configuration.block_xmlrpc).length, id: "WP-XMLRPC", severity: "Alta", status: rows.some((row) => row.configuration.block_xmlrpc) ? "Activa" : "Inactiva" },
    { action: "Limitar", category: "Login", hits: rows.filter((row) => row.configuration.rate_limit_login).length, id: "LOGIN-RATE", severity: "Media", status: rows.some((row) => row.configuration.rate_limit_login) ? "Activa" : "Inactiva" },
  ]

  const eventRules = Array.from(eventCounts.entries()).map(([id, hits]) => ({
    action: "Evento",
    category: id.includes("942") ? "SQL Injection" : id.includes("941") ? "XSS" : "ModSecurity",
    hits,
    id,
    severity: inferWafSeverity(id),
    status: "Activa",
  }))
  return [...baseRules, ...eventRules]
}

function ruleToPayload(row: HostingWafResponse, rule: AdminWafRuleRow) {
  if (rule.id === "OWASP-CRS") return { owasp_crs: !row.configuration.owasp_crs }
  if (rule.id === "WP-RULES") return { wordpress_rules: !row.configuration.wordpress_rules }
  if (rule.id === "WP-XMLRPC") return { block_xmlrpc: !row.configuration.block_xmlrpc }
  if (rule.id === "LOGIN-RATE") return { rate_limit_login: !row.configuration.rate_limit_login }
  return { mode: row.configuration.mode === "disabled" ? "monitor" : row.configuration.mode }
}

function duplicateWafPayload(row: HostingWafResponse) {
  return {
    block_xmlrpc: row.configuration.block_xmlrpc,
    mode: "monitor" as const,
    owasp_crs: row.configuration.owasp_crs,
    rate_limit_login: row.configuration.rate_limit_login,
    wordpress_rules: row.configuration.wordpress_rules,
  }
}

function wafModeLabelAdmin(mode: HostingWafResponse["configuration"]["mode"]) {
  if (mode === "block") return "Bloqueo"
  if (mode === "monitor") return "Monitoreo"
  return "Desactivado"
}

function wafStatusLabelAdmin(status: HostingWafResponse["configuration"]["status"]) {
  if (status === "active") return "Activo"
  if (status === "failed") return "Error"
  return "Pendiente"
}

function wafLevelLabel(row: HostingWafResponse) {
  const activeRules = [row.configuration.owasp_crs, row.configuration.wordpress_rules, row.configuration.block_xmlrpc, row.configuration.rate_limit_login].filter(Boolean).length
  if (row.configuration.mode === "block" && activeRules >= 3) return "Alto"
  if (row.configuration.mode === "disabled") return "Bajo"
  return "Medio"
}

function inferWafSeverity(value: string) {
  const normalized = value.toLowerCase()
  if (normalized.includes("942") || normalized.includes("941") || normalized.includes("sql") || normalized.includes("xss") || normalized.includes("xmlrpc")) return "Alta"
  return "Media"
}

function SecuritySignal({ inverse, label, value }: { inverse?: boolean; label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-bold text-slate-500">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-200">
        <div className={cn("h-1.5 rounded-full", inverse ? "bg-amber-500" : "bg-blue-600")} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function WafModeBadge({ mode }: { mode: string }) {
  const tone = mode === "Bloqueo" ? "bg-blue-50 text-blue-700" : mode === "Monitoreo" ? "bg-cyan-50 text-cyan-700" : "bg-slate-100 text-slate-700"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{mode}</span>
}

function WafStateBadge({ status }: { status: string }) {
  const tone = status === "Activo" || status === "Activa" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{status}</span>
}

function MoxStatusBadge({ status }: { status: string }) {
  const tone = status === "Activo" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{status}</span>
}

function SeverityBadge({ severity }: { severity: string }) {
  const tone = severity === "Alta" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{severity}</span>
}

function AdminIpBlocksPage() {
  const [blocks, setBlocks] = useState<HostingIpBlock[]>([])
  const [domains, setDomains] = useState<HostingDomain[]>([])
  const [query, setQuery] = useState("")
  const [selectedBlock, setSelectedBlock] = useState<HostingIpBlock | null>(null)
  const [showCreateBlock, setShowCreateBlock] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")

  const loadBlocks = () => {
    setIsLoading(true)
    setMessage("")
    Promise.all([hostingApi.ipBlocks(), hostingApi.domains()])
      .then(([blockPage, domainPage]) => {
        setBlocks(blockPage.results)
        setDomains(domainPage.results)
      })
      .catch((reason) => setMessage(readAdminError(reason, "No se pudieron cargar los bloqueos IP.")))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadBlocks()
  }, [])

  const filteredBlocks = blocks.filter((block) => `${block.target} ${block.reason} ${block.source_label} ${block.domain_name} ${block.agent_hostname || ""}`.toLowerCase().includes(query.toLowerCase()))
  const activeBlocks = blocks.filter((block) => block.enabled && block.status !== "expired" && block.status !== "disabled")
  const temporaryBlocks = activeBlocks.filter((block) => block.expires_on)
  const permanentBlocks = activeBlocks.filter((block) => !block.expires_on)
  const mainSource = mostCommonSource(activeBlocks)

  const deleteBlock = async (block: HostingIpBlock) => {
    if (!window.confirm(`Eliminar el bloqueo de ${block.target}?`)) return
    setIsSaving(true)
    setMessage("")
    try {
      await hostingApi.deleteIpBlock(block.id)
      setBlocks((current) => current.filter((item) => item.id !== block.id))
      setMessage(`Bloqueo eliminado y sincronizacion enviada para ${block.domain_name}.`)
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudo eliminar el bloqueo IP."))
    } finally {
      setIsSaving(false)
    }
  }

  const createBlock = async (payload: CreateIpBlockPayload) => {
    setIsSaving(true)
    setMessage("")
    try {
      const item = await hostingApi.createIpBlock(payload)
      setBlocks((current) => [item, ...current.filter((block) => block.id !== item.id)])
      setShowCreateBlock(false)
      setMessage(`Bloqueo creado y enviado al agente para ${item.domain_name}.`)
    } catch (reason) {
      setMessage(readAdminError(reason, "No se pudo crear el bloqueo IP."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">SSL y seguridad web</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Bloqueos IP</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Registro de IPs y rangos bloqueados por reglas WAF, ModSecurity, correo o acciones manuales.
              </p>
            </div>
          </div>
          <Button disabled={isSaving || domains.length === 0} onClick={() => setShowCreateBlock(true)} size="sm">Bloquear IP</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Bloqueos activos" value={String(activeBlocks.length)} detail="IPs y rangos" />
        <AdminMetric label="Temporales" value={String(temporaryBlocks.length)} detail="Con expiracion" />
        <AdminMetric label="Permanentes" value={String(permanentBlocks.length)} detail="Manual o reincidente" />
        <AdminMetric label="Origen principal" value={mainSource} detail="Bloqueos activos" />
      </section>

      <div className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex h-9 w-[420px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input className="h-full flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar IP, rango, motivo u origen..." value={query} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">Tipo</Button>
            <Button size="sm" variant="outline">Estado</Button>
            <Button size="sm" variant="outline">Origen</Button>
          </div>
        </div>
        {message ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">{message}</div> : null}

        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["IP / rango", "Tipo", "Desde", "Duracion", "Origen", "Motivo", "Estado", "Acciones"].map((column) => (
                <th className="px-4 py-2 font-bold" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredBlocks.map((row) => (
              <tr className="hover:bg-slate-50" key={row.id}>
                <td className="px-4 py-3 font-semibold text-slate-900">{row.target}</td>
                <td className="px-4 py-3"><IpTypeBadge type={detectIpTargetType(row.target)} /></td>
                <td className="px-4 py-3">{formatDateTime(row.created_at)}</td>
                <td className="px-4 py-3">{ipBlockDuration(row)}</td>
                <td className="px-4 py-3 text-blue-700">{ipBlockSourceLabel(row)}</td>
                <td className="max-w-[320px] px-4 py-3 text-slate-600">{row.reason}</td>
                <td className="px-4 py-3"><IpBlockStatusBadge status={ipBlockStatusLabel(row)} /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button onClick={() => setSelectedBlock(row)} size="sm" variant="outline">Ver IP</Button>
                    <Button disabled={isSaving} onClick={() => void deleteBlock(row)} size="sm" variant="outline">Eliminar</Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && filteredBlocks.length === 0 ? <tr><td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={8}>No hay bloqueos IP registrados.</td></tr> : null}
            {isLoading ? <tr><td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={8}>Cargando bloqueos reales...</td></tr> : null}
          </tbody>
        </table>
      </div>

      {selectedBlock ? <IpBlockDetailModal block={selectedBlock} onClose={() => setSelectedBlock(null)} /> : null}
      {showCreateBlock ? <CreateIpBlockModal domains={domains} isSaving={isSaving} onClose={() => setShowCreateBlock(false)} onSubmit={(payload) => void createBlock(payload)} /> : null}
    </div>
  )
}

type IpLookupResult = {
  as?: { asn?: number; name?: string; route?: string; type?: string }
  city?: string
  connection?: { asn?: number; isp?: string; org?: string }
  country?: string
  ip?: string
  isp?: string
  org?: string
  region?: string
  success?: boolean
  type?: string
}

function IpBlockDetailModal({ block, onClose }: { block: HostingIpBlock; onClose: () => void }) {
  const [lookup, setLookup] = useState<IpLookupResult | null>(null)
  const [lookupError, setLookupError] = useState("")
  const isSingleIp = !block.target.includes("/")

  useEffect(() => {
    if (!isSingleIp) {
      setLookupError("La consulta externa solo se realiza para IP individual, no para rangos CIDR.")
      return
    }
    setLookupError("")
    fetch(`https://ipwho.is/${encodeURIComponent(block.target)}`)
      .then((response) => response.json())
      .then((data: IpLookupResult) => {
        if (data.success === false) {
          setLookupError("El servicio externo no devolvio informacion para esta IP.")
        } else {
          setLookup(data)
        }
      })
      .catch(() => setLookupError("No se pudo consultar ipwho.is desde el navegador."))
  }, [block.target, isSingleIp])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[820px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Detalle de IP bloqueada</h3>
            <p className="mt-1 text-sm text-slate-500">{block.target} · {block.domain_name}</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-bold">Registro EHPanel</p>
            <div className="mt-3 space-y-2">
              <AdminStatus label="Tipo" value={detectIpTargetType(block.target)} />
              <AdminStatus label="Origen" value={ipBlockSourceLabel(block)} />
              <AdminStatus label="Agente" value={block.agent_hostname || "N/D"} />
              <AdminStatus label="Estado job" value={block.last_job_status || "N/D"} />
              <AdminStatus label="Duracion" value={ipBlockDuration(block)} />
              <AdminStatus label="Estado" value={ipBlockStatusLabel(block)} />
            </div>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-sm font-bold">Consulta externa IP</p>
            <p className="mt-1 text-xs text-slate-500">Fuente gratuita: ipwho.is, sin API key.</p>
            <div className="mt-3 space-y-2">
              <AdminStatus label="IP" value={lookup?.ip || block.target} />
              <AdminStatus label="Pais" value={[lookup?.country, lookup?.region, lookup?.city].filter(Boolean).join(", ") || "N/D"} />
              <AdminStatus label="ISP" value={lookup?.connection?.isp || lookup?.isp || "N/D"} />
              <AdminStatus label="Org" value={lookup?.connection?.org || lookup?.org || lookup?.as?.name || "N/D"} />
              <AdminStatus label="ASN" value={String(lookup?.connection?.asn || lookup?.as?.asn || "N/D")} />
              <AdminStatus label="Red" value={lookup?.as?.route || lookup?.type || "N/D"} />
            </div>
            {lookupError ? <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">{lookupError}</p> : null}
          </div>
          <div className="rounded-md border border-slate-200 p-3 md:col-span-2">
            <p className="text-sm font-bold">Motivo</p>
            <p className="mt-2 text-sm text-slate-600">{block.reason}</p>
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm">Cerrar</Button>
        </div>
      </div>
    </div>
  )
}

function CreateIpBlockModal({
  domains,
  isSaving,
  onClose,
  onSubmit,
}: {
  domains: HostingDomain[]
  isSaving: boolean
  onClose: () => void
  onSubmit: (payload: CreateIpBlockPayload) => void
}) {
  const [domainId, setDomainId] = useState(domains[0]?.id ?? 0)
  const [target, setTarget] = useState("")
  const [duration, setDuration] = useState("4h")
  const [reason, setReason] = useState("")
  const detectedType = target.trim() ? detectIpTargetType(target.trim()) : "Pendiente"
  const createdAt = new Date()
  const expiresOn = expirationDateFromDuration(duration, createdAt)
  const isValid = Boolean(domainId && reason.trim() && isIpTargetSyntax(target.trim()))

  const submit = () => {
    if (!isValid) return
    onSubmit({
      domain: domainId,
      enabled: true,
      expires_on: expiresOn,
      reason: reason.trim(),
      source: "admin",
      target: target.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-[820px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Bloquear IP</h3>
            <p className="mt-1 text-sm text-slate-500">Origen fijo: Administrador. Se aplicara mediante el agente del nodo del dominio.</p>
          </div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Dominio / nodo</span>
              <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => setDomainId(Number(event.target.value))} value={domainId}>
                {domains.map((domain) => (
                  <option key={domain.id} value={domain.id}>{domain.domain} · {domain.node_hostname || "Nodo N/D"}</option>
                ))}
              </select>
            </label>
            <AdminTextInput label="IP o rango CIDR" onChange={setTarget} placeholder="198.51.100.24 o 198.51.100.0/24" value={target} />
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Duracion</span>
              <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => setDuration(event.target.value)} value={duration}>
                {[
                  ["15m", "15 minutos"],
                  ["30m", "30 minutos"],
                  ["1h", "1 hora"],
                  ["4h", "4 horas"],
                  ["1d", "1 dia"],
                  ["7d", "1 semana"],
                  ["30d", "1 mes"],
                  ["365d", "1 ano"],
                  ["permanent", "Permanente"],
                ].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Motivo</span>
              <textarea className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" onChange={(event) => setReason(event.target.value)} placeholder="Motivo del bloqueo manual..." value={reason} />
            </label>
          </div>
          <aside className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-bold">Previsualizacion</p>
            <div className="mt-3 space-y-2">
              <AdminStatus label="Tipo detectado" value={detectedType} />
              <AdminStatus label="Origen" value="Administrador" />
              <AdminStatus label="Creado" value={formatDateTime(createdAt.toISOString())} />
              <AdminStatus label="Expira" value={expiresOn || "Permanente"} />
              <AdminStatus label="Sintaxis" value={target.trim() ? isIpTargetSyntax(target.trim()) ? "Valida" : "Invalida" : "Pendiente"} />
            </div>
          </aside>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">Cancelar</Button>
          <Button disabled={!isValid || isSaving} onClick={submit} size="sm">{isSaving ? "Guardando..." : "Crear bloqueo"}</Button>
        </div>
      </div>
    </div>
  )
}

function IpBlockStatusBadge({ status }: { status: string }) {
  const tone = status === "Permanente" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{status}</span>
}

function IpTypeBadge({ type }: { type: string }) {
  const tone = type.includes("IPv6") ? "bg-cyan-50 text-cyan-700" : type.includes("Rango") ? "bg-purple-50 text-purple-700" : "bg-slate-100 text-slate-700"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{type}</span>
}

function AdminTextInput({ label, onChange, placeholder, value }: { label: string; onChange: (value: string) => void; placeholder?: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      <input className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} />
    </label>
  )
}

function detectIpTargetType(target: string) {
  const value = target.trim()
  if (value.includes("/")) return value.includes(":") ? "Rango IPv6" : "Rango IPv4"
  return value.includes(":") ? "IPv6" : "IPv4"
}

function isIpTargetSyntax(target: string) {
  if (!target) return false
  if (target.includes("/")) {
    const [address, prefix] = target.split("/")
    const mask = Number(prefix)
    if (!Number.isInteger(mask)) return false
    if (address.includes(":")) return isBasicIpv6(address) && mask >= 0 && mask <= 128
    return isBasicIpv4(address) && mask >= 0 && mask <= 32
  }
  return target.includes(":") ? isBasicIpv6(target) : isBasicIpv4(target)
}

function isBasicIpv4(value: string) {
  const parts = value.split(".")
  return parts.length === 4 && parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255)
}

function isBasicIpv6(value: string) {
  return /^[0-9a-f:]+$/i.test(value) && value.includes(":") && value.length >= 2
}

function expirationDateFromDuration(duration: string, start: Date) {
  if (duration === "permanent") return null
  const match = /^(\d+)([mhd])$/.exec(duration)
  if (!match) return null
  const amount = Number(match[1])
  const unit = match[2]
  const expires = new Date(start)
  if (unit === "m") expires.setMinutes(expires.getMinutes() + amount)
  if (unit === "h") expires.setHours(expires.getHours() + amount)
  if (unit === "d") expires.setDate(expires.getDate() + amount)
  return expires.toISOString().slice(0, 10)
}

function ipBlockDuration(block: HostingIpBlock) {
  if (!block.expires_on) return "Permanente"
  return block.expires_on
}

function ipBlockStatusLabel(block: HostingIpBlock) {
  if (!block.enabled || block.status === "disabled") return "Desactivado"
  if (block.status === "expired") return "Expirado"
  if (block.status === "failed") return "Error"
  return block.expires_on ? "Temporal" : "Permanente"
}

function ipBlockSourceLabel(block: HostingIpBlock) {
  if (block.source_label) return block.source_label
  if (block.source === "admin") return "Administrador"
  if (block.source === "modsecurity") return "ModSecurity"
  if (block.source === "antispam") return "Anti-spam"
  if (block.source === "agent") return "Agente"
  return "WAF / Firewall"
}

function mostCommonSource(blocks: HostingIpBlock[]) {
  if (!blocks.length) return "N/D"
  const counts = new Map<string, number>()
  for (const block of blocks) {
    const label = ipBlockSourceLabel(block)
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || "N/D"
}

function AdminMailAccountsPage() {
  const [mailboxes, setMailboxes] = useState<HostingMailbox[]>([])
  const [accounts, setAccounts] = useState<HostingAccount[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [accountFilter, setAccountFilter] = useState("")
  const [sortBy, setSortBy] = useState("used_desc")
  const [selectedMailbox, setSelectedMailbox] = useState<HostingMailbox | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")

  const loadMailboxes = () => {
    setIsLoading(true)
    setMessage("")
    Promise.all([hostingApi.mailboxes({ status: statusFilter || undefined }), hostingApi.accounts()])
      .then(([mailboxPage, accountPage]) => {
        setMailboxes(mailboxPage.results)
        setAccounts(accountPage.results)
      })
      .catch((error: Error) => setMessage(error.message || "No se pudieron cargar las cuentas de correo."))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadMailboxes()
  }, [statusFilter])

  const accountMap = new Map(accounts.map((account) => [account.id, account]))
  const rows = mailboxes
    .filter((mailbox) => {
      const account = accountMap.get(mailbox.account)
      const haystack = [
        mailbox.email,
        mailbox.account_domain,
        mailbox.account_username,
        mailbox.node_hostname,
        account?.customer_name,
        account?.customer_email,
        account?.reseller_username,
        mailbox.status,
      ].join(" ").toLowerCase()
      const matchesSearch = !query.trim() || haystack.includes(query.trim().toLowerCase())
      const matchesAccount = !accountFilter || mailbox.account === accountFilter
      return matchesSearch && matchesAccount
    })
    .sort((left, right) => sortMailboxes(left, right, sortBy, accountMap))

  const activeCount = mailboxes.filter((mailbox) => mailbox.status === "active").length
  const suspendedCount = mailboxes.filter((mailbox) => mailbox.status === "suspended").length
  const nearLimitCount = mailboxes.filter((mailbox) => mailboxQuotaPct(mailbox) >= 85).length

  const suspendMailbox = async (mailbox: HostingMailbox) => {
    setIsSaving(true)
    setMessage("")
    try {
      const updated = mailbox.status === "suspended" ? await hostingApi.unsuspendMailbox(mailbox.id) : await hostingApi.suspendMailbox(mailbox.id)
      setMailboxes((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setMessage(mailbox.status === "suspended" ? "Reactivacion enviada al agente." : "Suspension enviada al agente.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cambiar el estado del correo.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className={cn("rounded-lg border px-4 py-3 text-sm font-semibold", message.includes("No se") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
          {message}
        </div>
      ) : null}
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Correo</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Cuentas de correo</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Inventario global de buzones y reenvios creados por clientes y revendedores, con limites de envio y uso actual.
              </p>
            </div>
          </div>
          <Button disabled={isLoading} onClick={loadMailboxes} size="sm" variant="outline">{isLoading ? "Actualizando" : "Actualizar"}</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Cuentas correo" value={mailboxes.length.toLocaleString()} detail="Buzones reales" />
        <AdminMetric label="Activas" value={activeCount.toLocaleString()} detail="Operando normal" />
        <AdminMetric label="Cerca del limite" value={nearLimitCount.toLocaleString()} detail="Uso de buzon sobre 85%" />
        <AdminMetric label="Suspendidas" value={suspendedCount.toLocaleString()} detail="Suspendidas por agente" />
      </section>

      <div className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex h-9 w-[430px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar correo, cliente, dominio o revendedor..." value={query} />
          </div>
          <div className="flex gap-2">
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="">Estado</option>
              <option value="active">Activa</option>
              <option value="pending">Pendiente</option>
              <option value="suspended">Suspendida</option>
              <option value="failed">Error</option>
            </select>
            <select className="h-9 max-w-[220px] rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setAccountFilter(event.target.value)} value={accountFilter}>
              <option value="">Cliente</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.customer_name || account.username || account.primary_domain}</option>)}
            </select>
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
              <option value="used_desc">Mayor uso</option>
              <option value="quota_desc">Mayor limite</option>
              <option value="client_asc">Cliente A-Z</option>
              <option value="email_asc">Correo A-Z</option>
            </select>
          </div>
        </div>

        <table className="w-full min-w-[1280px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["Direccion", "Cliente", "Pertenece a", "Dominio", "Tipo", "Uso buzon", "Limite hora", "Limite dia", "Estado", "Acciones"].map((column) => (
                <th className="px-4 py-2 font-bold" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((mailbox) => {
              const account = accountMap.get(mailbox.account)
              return (
              <tr className="hover:bg-slate-50" key={mailbox.id}>
                <td className="px-4 py-3 font-semibold text-slate-900">{mailbox.email}</td>
                <td className="px-4 py-3">{account?.customer_name || mailbox.account_username}</td>
                <td className="px-4 py-3 text-slate-600">{account?.reseller_username || account?.owner_username || "Sin revendedor"}</td>
                <td className="px-4 py-3 text-blue-700">{mailbox.account_domain}</td>
                <td className="px-4 py-3"><MailAccountTypeBadge type="Buzon" /></td>
                <td className="px-4 py-3">{formatMailboxQuota(mailbox)}</td>
                <td className="px-4 py-3">
                  <MailLimitBar limit={mailbox.outgoing_limit || 0} used={mailboxDailyUsed(mailbox, "hour")} />
                </td>
                <td className="px-4 py-3">
                  <MailLimitBar limit={(mailbox.outgoing_limit || 0) * 24} used={mailboxDailyUsed(mailbox, "day")} />
                </td>
                <td className="px-4 py-3"><MailAccountStatusBadge status={mailboxStatusLabel(mailbox.status)} /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button onClick={() => setSelectedMailbox(mailbox)} size="sm" variant="outline">Ver</Button>
                    <Button disabled={isSaving || mailbox.status === "pending"} onClick={() => void suspendMailbox(mailbox)} size="sm" variant="outline">{mailbox.status === "suspended" ? "Reactivar" : "Suspender"}</Button>
                  </div>
                </td>
              </tr>
              )
            })}
            {!isLoading && rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={10}>No hay cuentas de correo con esos filtros.</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          <span>Mostrando {rows.length.toLocaleString()} de {mailboxes.length.toLocaleString()} cuentas</span>
          <div className="flex items-center gap-2">
            <Button disabled size="sm" variant="outline">Anterior</Button>
            <span className="font-semibold text-slate-800">Pagina 1</span>
            <Button disabled size="sm" variant="outline">Siguiente</Button>
          </div>
        </div>
      </div>
      {selectedMailbox ? (
        <AdminMailboxDetailModal
          account={accountMap.get(selectedMailbox.account)}
          mailbox={selectedMailbox}
          onClose={() => setSelectedMailbox(null)}
          onSuspend={() => void suspendMailbox(selectedMailbox)}
        />
      ) : null}
    </div>
  )
}

function AdminMailboxDetailModal({
  account,
  mailbox,
  onClose,
  onSuspend,
}: {
  account?: HostingAccount
  mailbox: HostingMailbox
  onClose: () => void
  onSuspend: () => void
}) {
  return (
    <AdminModalFrame kicker="Cuenta de correo" onClose={onClose} title={mailbox.email}>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <AdminStatus label="Estado" value={mailboxStatusLabel(mailbox.status)} />
          <AdminStatus label="Cliente" value={account?.customer_name || mailbox.account_username || "N/D"} />
          <AdminStatus label="Dominio" value={mailbox.account_domain || "N/D"} />
          <AdminStatus label="Pertenece a" value={account?.reseller_username || account?.owner_username || "Sin revendedor"} />
          <AdminStatus label="Nodo" value={mailbox.node_hostname || account?.node_hostname || "N/D"} />
          <AdminStatus label="Uso buzon" value={formatMailboxQuota(mailbox)} />
          <AdminStatus label="Limite salida hora" value={mailbox.outgoing_limit ? `${mailbox.outgoing_limit}/h` : "N/D"} />
          <AdminStatus label="Antispam" value={mailbox.antispam_enabled ? "Activo" : "Inactivo"} />
          <AdminStatus label="Autorespuesta" value={mailbox.autoresponder_enabled ? "Activa" : "Inactiva"} />
          <AdminStatus label="Ultimo uso" value={mailbox.last_usage_at ? formatDateTime(mailbox.last_usage_at) : "Sin medicion"} />
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-bold uppercase text-slate-500">Configuracion manual</div>
          <div className="mt-2 grid gap-2 text-sm font-semibold text-slate-700 md:grid-cols-2">
            <span>IMAP SSL: {mailbox.manual_config?.incoming_server || "N/D"}:{mailbox.manual_config?.imap_ssl_port || "N/D"}</span>
            <span>SMTP SSL: {mailbox.manual_config?.outgoing_server || "N/D"}:{mailbox.manual_config?.smtp_ssl_port || "N/D"}</span>
            <span>POP3 SSL: {mailbox.manual_config?.incoming_server || "N/D"}:{mailbox.manual_config?.pop3_ssl_port || "N/D"}</span>
            <span>Usuario: {mailbox.manual_config?.username || mailbox.email}</span>
          </div>
        </div>
        {mailbox.description ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">{mailbox.description}</div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">Cerrar</Button>
          <Button disabled={mailbox.status === "pending"} onClick={onSuspend} type="button">{mailbox.status === "suspended" ? "Reactivar" : "Suspender"}</Button>
        </div>
      </div>
    </AdminModalFrame>
  )
}

function sortMailboxes(left: HostingMailbox, right: HostingMailbox, sortBy: string, accounts: Map<string, HostingAccount>) {
  if (sortBy === "quota_desc") return right.quota_mb - left.quota_mb
  if (sortBy === "client_asc") {
    const leftAccount = accounts.get(left.account)
    const rightAccount = accounts.get(right.account)
    return (leftAccount?.customer_name || left.account_username || "").localeCompare(rightAccount?.customer_name || right.account_username || "")
  }
  if (sortBy === "email_asc") return left.email.localeCompare(right.email)
  return right.used_mb - left.used_mb
}

function formatMailboxQuota(mailbox: HostingMailbox) {
  return `${formatMailboxStorage(mailbox.used_mb)} / ${formatMailboxStorage(mailbox.quota_mb)}`
}

function formatMailboxStorage(valueMb: number) {
  if (!Number.isFinite(valueMb)) return "0 MB"
  if (valueMb >= 1024) return `${Math.round((valueMb / 1024) * 10) / 10} GB`
  return `${Math.round(valueMb)} MB`
}

function mailboxQuotaPct(mailbox: HostingMailbox) {
  if (!mailbox.quota_mb) return 0
  return Math.min(100, Math.round((mailbox.used_mb / mailbox.quota_mb) * 100))
}

function mailboxStatusLabel(status: HostingMailbox["status"]) {
  if (status === "active") return "Activa"
  if (status === "suspended") return "Suspendida"
  if (status === "pending") return "Pendiente"
  return "Error"
}

function mailboxDailyUsed(mailbox: HostingMailbox, period: "day" | "hour") {
  const settings = mailbox.antispam_settings || {}
  const keys = period === "hour" ? ["sent_hour", "hourly_used", "outgoing_hour_used"] : ["sent_today", "daily_used", "outgoing_day_used"]
  for (const key of keys) {
    const value = settings[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value)
  }
  return 0
}

function MailLimitBar({ limit, used }: { limit: number; used: number }) {
  const percent = limit > 0 ? Math.round((used / limit) * 100) : 0
  return (
    <div className="w-28">
      <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
        <span>{limit > 0 ? `${used}/${limit}` : "N/D"}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-200">
        <div className={cn("h-1.5 rounded-full", percent >= 85 ? "bg-amber-500" : "bg-blue-600")} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function MailAccountStatusBadge({ status }: { status: string }) {
  const tone =
    status === "Activa"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Suspendida"
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-700"

  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{status}</span>
}

function MailAccountTypeBadge({ type }: { type: string }) {
  const tone = type === "Buzon" ? "bg-blue-50 text-blue-700" : "bg-cyan-50 text-cyan-700"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{type}</span>
}

function AdminMailQueuePage() {
  const [rows, setRows] = useState<AdminMailQueueItem[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [directionFilter, setDirectionFilter] = useState("")
  const [selected, setSelected] = useState<AdminMailQueueItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")

  const loadQueue = () => {
    setIsLoading(true)
    setMessage("")
    adminApi.mailQueue()
      .then((page) => setRows(page.results))
      .catch((error: Error) => setMessage(error.message || "No se pudo cargar la cola de correo."))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadQueue()
  }, [])

  const refreshQueue = async () => {
    setIsSaving(true)
    setMessage("")
    try {
      const result = await adminApi.refreshMailQueue()
      setMessage(`Solicitud de lectura enviada a ${result.queued} nodo(s).`)
      loadQueue()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo solicitar la cola a los nodos.")
    } finally {
      setIsSaving(false)
    }
  }

  const queueAction = async (row: AdminMailQueueItem, action: "retry" | "release") => {
    if (!row.queue_id) {
      setMessage("Este correo no tiene ID de cola para operar.")
      return
    }
    setIsSaving(true)
    setMessage("")
    try {
      if (action === "retry") await adminApi.retryMailQueue({ node: row.node, queue_id: row.queue_id })
      else await adminApi.releaseMailQueue({ node: row.node, queue_id: row.queue_id })
      setMessage(action === "retry" ? "Reintento enviado al agente." : "Liberacion/cancelacion enviada al agente.")
      loadQueue()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo ejecutar la accion.")
    } finally {
      setIsSaving(false)
    }
  }

  const filteredRows = rows.filter((row) => {
    const haystack = [row.from, row.to, row.account, row.code, row.status, row.explanation, row.node_hostname, row.queue_id].join(" ").toLowerCase()
    const matchesSearch = !query.trim() || haystack.includes(query.trim().toLowerCase())
    const matchesStatus = !statusFilter || row.status === statusFilter
    const matchesDirection = !directionFilter || row.direction === directionFilter
    return matchesSearch && matchesStatus && matchesDirection
  })
  const delivered = rows.filter((row) => row.status === "Entregado").length
  const rejected = rows.filter((row) => row.status === "Rechazado").length
  const spam = rows.filter((row) => row.status === "Spam").length

  return (
    <div className="space-y-4">
      {message ? (
        <div className={cn("rounded-lg border px-4 py-3 text-sm font-semibold", message.includes("No se") || message.includes("no tiene") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
          {message}
        </div>
      ) : null}
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Correo</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Cola de correo</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Explorador de correos entrantes y salientes con estado, codigo y explicacion clara para soporte.
              </p>
            </div>
          </div>
          <Button disabled={isSaving || isLoading} onClick={() => void refreshQueue()} size="sm">{isSaving ? "Enviando" : "Actualizar cola"}</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Procesados hoy" value={rows.length.toLocaleString()} detail="Entrada y salida" />
        <AdminMetric label="Entregados" value={delivered.toLocaleString()} detail={rows.length ? `${Math.round((delivered / rows.length) * 100)}% correcto` : "Sin datos"} />
        <AdminMetric label="Rechazados" value={rejected.toLocaleString()} detail="Autenticacion, politicas" />
        <AdminMetric label="Spam / rebotes" value={spam.toLocaleString()} detail="Revisar reputacion" />
      </section>

      <div className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex h-9 w-[430px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar correo, cliente, codigo o estado..." value={query} />
          </div>
          <div className="flex gap-2">
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setDirectionFilter(event.target.value)} value={directionFilter}>
              <option value="">Direccion</option>
              <option value="Entrada">Entrada</option>
              <option value="Salida">Salida</option>
            </select>
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="">Estado</option>
              <option value="Entregado">Entregado</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Rechazado">Rechazado</option>
              <option value="Spam">Spam</option>
            </select>
            <Button disabled={isLoading} onClick={loadQueue} size="sm" variant="outline">Recargar</Button>
          </div>
        </div>

        <table className="w-full min-w-[1220px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["Hora", "Direccion", "De", "Para", "Cliente", "Codigo", "Estado", "Explicacion", "Acciones"].map((column) => (
                <th className="px-4 py-2 font-bold" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.map((row) => (
              <tr className="hover:bg-slate-50" key={row.id}>
                <td className="px-4 py-3 font-semibold">{row.time}</td>
                <td className="px-4 py-3"><MailDirectionBadge direction={row.direction} /></td>
                <td className="px-4 py-3 text-slate-700">{row.from}</td>
                <td className="px-4 py-3 text-blue-700">{row.to}</td>
                <td className="px-4 py-3">{row.account}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{row.code}</span></td>
                <td className="px-4 py-3"><MailStatusBadge status={row.status} /></td>
                <td className="max-w-[360px] px-4 py-3 text-slate-600">{row.explanation}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button onClick={() => setSelected(row)} size="sm" variant="outline">Ver</Button>
                    <Button disabled={isSaving || !row.queue_id || row.status === "Entregado"} onClick={() => void queueAction(row, "retry")} size="sm" variant="outline">Reintentar</Button>
                    <Button disabled={isSaving || !row.queue_id || row.status === "Entregado"} onClick={() => void queueAction(row, "release")} size="sm" variant="outline">Liberar</Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && filteredRows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={9}>No hay correos en cola con esos filtros.</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          <span>Mostrando {filteredRows.length.toLocaleString()} de {rows.length.toLocaleString()} eventos</span>
          <div className="flex items-center gap-2">
            <Button disabled size="sm" variant="outline">Anterior</Button>
            <span className="font-semibold text-slate-800">Pagina 1</span>
            <Button disabled size="sm" variant="outline">Siguiente</Button>
          </div>
        </div>
      </div>
      {selected ? <AdminMailQueueDetailModal item={selected} onClose={() => setSelected(null)} onRelease={() => void queueAction(selected, "release")} onRetry={() => void queueAction(selected, "retry")} /> : null}
    </div>
  )
}

function AdminMailQueueDetailModal({
  item,
  onClose,
  onRelease,
  onRetry,
}: {
  item: AdminMailQueueItem
  onClose: () => void
  onRelease: () => void
  onRetry: () => void
}) {
  return (
    <AdminModalFrame kicker={item.node_hostname} onClose={onClose} title={item.queue_id || item.to || item.from}>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <AdminStatus label="Estado" value={item.status} />
          <AdminStatus label="Direccion" value={item.direction} />
          <AdminStatus label="Codigo" value={item.code || "N/D"} />
          <AdminStatus label="Queue ID" value={item.queue_id || "N/D"} />
          <AdminStatus label="De" value={item.from || "N/D"} />
          <AdminStatus label="Para" value={item.to || "N/D"} />
          <AdminStatus label="Cliente" value={item.account || "N/D"} />
          <AdminStatus label="Hora" value={item.time || "N/D"} />
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-bold uppercase text-slate-500">Explicacion</div>
          <div className="mt-1 text-sm font-semibold text-slate-800">{item.explanation || "Sin detalle reportado por el nodo."}</div>
        </div>
        <div>
          <div className="mb-2 text-sm font-bold text-slate-900">Datos crudos del nodo</div>
          <pre className="max-h-64 overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(item.raw, null, 2)}</pre>
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">Cerrar</Button>
          <Button disabled={!item.queue_id || item.status === "Entregado"} onClick={onRetry} type="button" variant="outline">Reintentar</Button>
          <Button disabled={!item.queue_id || item.status === "Entregado"} onClick={onRelease} type="button">Liberar</Button>
        </div>
      </div>
    </AdminModalFrame>
  )
}

function MailDirectionBadge({ direction }: { direction: string }) {
  const tone = direction === "Entrada" ? "bg-cyan-50 text-cyan-700" : "bg-blue-50 text-blue-700"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{direction}</span>
}

function MailStatusBadge({ status }: { status: string }) {
  const tone =
    status === "Entregado"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Pendiente"
        ? "bg-amber-50 text-amber-700"
        : status === "Spam"
          ? "bg-purple-50 text-purple-700"
          : "bg-red-50 text-red-700"

  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{status}</span>
}

function AdminAntivirusScanPage() {
  const [scans, setScans] = useState<HostingSecurityScan[]>([])
  const [domains, setDomains] = useState<HostingDomain[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [riskFilter, setRiskFilter] = useState("")
  const [nodeFilter, setNodeFilter] = useState("")
  const [selectedScan, setSelectedScan] = useState<HostingSecurityScan | null>(null)
  const [cleaningScan, setCleaningScan] = useState<HostingSecurityScan | null>(null)
  const [showCreateScan, setShowCreateScan] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")

  const loadData = () => {
    setIsLoading(true)
    Promise.all([hostingApi.securityScans({ status: statusFilter || undefined }), hostingApi.domains()])
      .then(([scanPage, domainPage]) => {
        setScans(scanPage.results)
        setDomains(domainPage.results)
      })
      .catch((error: Error) => setMessage(error.message || "No se pudieron cargar los escaneos antivirus."))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [statusFilter])

  const createScan = async (payload: CreateSecurityScanPayload) => {
    setIsSaving(true)
    setMessage("")
    try {
      const scan = await hostingApi.createSecurityScan(payload)
      setScans((current) => [scan, ...current])
      setShowCreateScan(false)
      setMessage("Escaneo antivirus enviado al agente.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el escaneo antivirus.")
    } finally {
      setIsSaving(false)
    }
  }

  const retryScan = async (scan: HostingSecurityScan) => {
    setIsSaving(true)
    setMessage("")
    try {
      const updated = await hostingApi.retrySecurityScan(scan.id)
      setScans((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setMessage("Reescaneo enviado al agente.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo reenviar el escaneo.")
    } finally {
      setIsSaving(false)
    }
  }

  const remediateScan = async (scan: HostingSecurityScan, payload: RemediateSecurityScanPayload) => {
    setIsSaving(true)
    setMessage("")
    try {
      const updated = await hostingApi.remediateSecurityScan(scan.id, payload)
      setScans((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setCleaningScan(null)
      setSelectedScan(updated)
      setMessage("Orden de limpieza enviada al agente y registrada en el reporte.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo enviar la limpieza.")
    } finally {
      setIsSaving(false)
    }
  }

  const nodes = Array.from(new Set(scans.map((scan) => scan.node_hostname || "").filter(Boolean)))
  const filteredScans = scans.filter((scan) => {
    const haystack = [scan.account_domain, scan.account_username, scan.node_hostname, scan.path, scan.output, scan.error_detail].join(" ").toLowerCase()
    const matchesSearch = !query.trim() || haystack.includes(query.trim().toLowerCase())
    const matchesRisk = !riskFilter || antivirusRisk(scan) === riskFilter
    const matchesNode = !nodeFilter || scan.node_hostname === nodeFilter
    return matchesSearch && matchesRisk && matchesNode
  })
  const completed24h = scans.filter((scan) => isWithinLastHours(scan.finished_at || scan.updated_at, 24)).length
  const running = scans.filter((scan) => scan.status === "running").length
  const queued = scans.filter((scan) => scan.status === "queued").length
  const threats = scans.reduce((total, scan) => total + scan.infected_files, 0)
  const affectedAccounts = new Set(scans.filter((scan) => scan.infected_files > 0).map((scan) => scan.account)).size
  const cleanRate = scans.length ? Math.round((scans.filter((scan) => scan.status === "clean").length / scans.length) * 100) : 100

  return (
    <div className="space-y-4">
      {message ? (
        <div className={cn("rounded-lg border px-4 py-3 text-sm font-semibold", message.includes("No se") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
          {message}
        </div>
      ) : null}
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">SSL y seguridad web</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Escaneo antivirus</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Estado global del antivirus, escaneos recientes y cuentas con amenazas detectadas o pendientes de revision.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreateScan(true)} size="sm">Nuevo escaneo</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <div className="eh-card p-4">
          <div className="eh-kicker">Motor antivirus</div>
          <div className="mt-3 flex items-center gap-4">
            <MiniGauge value={cleanRate} tone="blue" />
            <div>
              <div className="text-2xl font-bold text-slate-900">{cleanRate >= 85 ? "Saludable" : "Revisar"}</div>
              <p className="mt-1 text-sm text-slate-500">Historial real de escaneos y Rspamd</p>
            </div>
          </div>
        </div>
        <div className="eh-card p-4">
          <div className="eh-kicker">Escaneos 24h</div>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <div className="text-2xl font-bold">{completed24h.toLocaleString()}</div>
              <p className="mt-1 text-sm text-slate-500">{scans.filter((scan) => scan.status === "clean").length.toLocaleString()} limpios</p>
            </div>
            <MiniLineChart />
          </div>
        </div>
        <div className="eh-card p-4">
          <div className="eh-kicker">Amenazas</div>
          <div className="mt-3 flex items-center gap-4">
            <MiniGauge value={Math.min(100, threats ? Math.max(15, threats * 10) : 0)} tone="amber" />
            <div>
              <div className="text-2xl font-bold text-slate-900">{threats.toLocaleString()}</div>
              <p className="mt-1 text-sm text-slate-500">{affectedAccounts.toLocaleString()} cuentas afectadas</p>
            </div>
          </div>
        </div>
        <div className="eh-card p-4">
          <div className="eh-kicker">Cola de escaneo</div>
          <div className="mt-2 text-2xl font-bold">{(queued + running).toLocaleString()}</div>
          <p className="mt-1 text-sm text-slate-500">{running} en proceso, {queued} en cola</p>
          <div className="mt-3 h-1.5 rounded-full bg-slate-200">
            <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(5, scans[0]?.progress ?? 0))}%` }} />
          </div>
        </div>
      </section>

      <div className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex h-9 w-[430px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cuenta, dominio, nodo o amenaza..." value={query} />
          </div>
          <div className="flex gap-2">
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="">Estado</option>
              <option value="clean">Limpio</option>
              <option value="threat">Infectado</option>
              <option value="running">En analisis</option>
              <option value="queued">Pendiente</option>
              <option value="failed">Fallido</option>
            </select>
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setRiskFilter(event.target.value)} value={riskFilter}>
              <option value="">Riesgo</option>
              <option value="Alto">Alto</option>
              <option value="Medio">Medio</option>
              <option value="Bajo">Bajo</option>
              <option value="Pendiente">Pendiente</option>
            </select>
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setNodeFilter(event.target.value)} value={nodeFilter}>
              <option value="">Nodo</option>
              {nodes.map((node) => <option key={node} value={node}>{node}</option>)}
            </select>
            <Button disabled={isLoading} onClick={loadData} size="sm" variant="outline">Actualizar</Button>
          </div>
        </div>

        <table className="w-full min-w-[1220px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["Cuenta", "Dominio", "Nodo", "Ultimo escaneo", "Estado", "Archivos", "Amenazas", "Riesgo", "Recomendacion", "Acciones"].map((column) => (
                <th className="px-4 py-2 font-bold" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredScans.map((row) => (
              <tr className="hover:bg-slate-50" key={row.id}>
                <td className="px-4 py-3 font-semibold text-slate-900">{row.account_username || row.account_domain}</td>
                <td className="px-4 py-3 text-blue-700">{row.account_domain}</td>
                <td className="px-4 py-3">{row.node_hostname || "N/D"}</td>
                <td className="px-4 py-3">{formatDateTime(row.finished_at || row.updated_at)}</td>
                <td className="px-4 py-3"><AntivirusStatusBadge status={antivirusStatusLabel(row.status)} /></td>
                <td className="px-4 py-3 font-semibold">{row.files_scanned ? row.files_scanned.toLocaleString() : "En cola"}</td>
                <td className="px-4 py-3">{row.infected_files.toLocaleString()}</td>
                <td className="px-4 py-3"><RiskBadge risk={antivirusRisk(row)} /></td>
                <td className="px-4 py-3 text-slate-600">{antivirusRecommendation(row)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {row.status === "threat" ? (
                      <>
                        <Button disabled={isSaving} onClick={() => setCleaningScan(row)} size="sm" variant="outline">Limpiar</Button>
                        <Button onClick={() => setSelectedScan(row)} size="sm" variant="outline">Reporte</Button>
                        <Button disabled={isSaving} onClick={() => void retryScan(row)} size="sm" variant="outline">Reescanear</Button>
                      </>
                    ) : row.status === "queued" || row.status === "running" ? (
                      <>
                        <Button onClick={() => setSelectedScan(row)} size="sm" variant="outline">Reporte</Button>
                        <Button disabled size="sm" variant="outline">{row.progress}%</Button>
                      </>
                    ) : (
                      <>
                        <Button onClick={() => setSelectedScan(row)} size="sm" variant="outline">Reporte</Button>
                        <Button disabled={isSaving} onClick={() => void retryScan(row)} size="sm" variant="outline">Reescanear</Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && filteredScans.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={10}>No hay escaneos registrados con esos filtros.</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          <span>Mostrando {filteredScans.length.toLocaleString()} de {scans.length.toLocaleString()} escaneos historicos</span>
          <div className="flex items-center gap-2">
            <Button disabled size="sm" variant="outline">Anterior</Button>
            <span className="font-semibold text-slate-800">Pagina 1</span>
            <Button disabled size="sm" variant="outline">Siguiente</Button>
          </div>
        </div>
      </div>
      {showCreateScan ? <AdminAntivirusScanModal domains={domains} isSaving={isSaving} onClose={() => setShowCreateScan(false)} onSubmit={(payload) => void createScan(payload)} /> : null}
      {selectedScan ? <AdminAntivirusReportModal onClean={selectedScan.status === "threat" ? () => setCleaningScan(selectedScan) : undefined} onClose={() => setSelectedScan(null)} onRetry={() => void retryScan(selectedScan)} scan={selectedScan} /> : null}
      {cleaningScan ? <AdminAntivirusCleanModal isSaving={isSaving} onClose={() => setCleaningScan(null)} onSubmit={(payload) => void remediateScan(cleaningScan, payload)} scan={cleaningScan} /> : null}
    </div>
  )
}

function AdminAntivirusScanModal({
  domains,
  isSaving,
  onClose,
  onSubmit,
}: {
  domains: HostingDomain[]
  isSaving: boolean
  onClose: () => void
  onSubmit: (payload: CreateSecurityScanPayload) => void
}) {
  const [domainId, setDomainId] = useState(String(domains[0]?.id ?? ""))
  const [scope, setScope] = useState("files")
  const selectedDomain = domains.find((domain) => String(domain.id) === domainId) ?? domains[0]
  const payload = antivirusScanPayload(selectedDomain, scope)

  return (
    <AdminModalFrame onClose={onClose} title="Nuevo escaneo antivirus" kicker="Seguridad web">
      <form onSubmit={(event) => { event.preventDefault(); if (payload) onSubmit(payload) }}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">
            Dominio
            <select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold" onChange={(event) => setDomainId(event.target.value)} value={domainId}>
              {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.domain}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700">
            Tipo de escaneo
            <select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold" onChange={(event) => setScope(event.target.value)} value={scope}>
              <option value="files">Archivos web</option>
              <option value="database">Base de datos</option>
              <option value="mail">Correos y Rspamd</option>
              <option value="full">Toda la cuenta</option>
            </select>
          </label>
          <AdminStatus label="Cliente" value={selectedDomain?.account_username || selectedDomain?.account_domain || "N/D"} />
          <AdminStatus label="Nodo" value={selectedDomain?.node_hostname || "N/D"} />
          <AdminStatus label="Ruta objetivo" value={payload?.path || "N/D"} />
          <AdminStatus label="Motor" value={scope === "mail" ? "Antivirus + Rspamd" : "Antivirus del nodo"} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">Cancelar</Button>
          <Button disabled={isSaving || !payload} type="submit">Enviar escaneo</Button>
        </div>
      </form>
    </AdminModalFrame>
  )
}

function AdminAntivirusReportModal({
  onClean,
  onClose,
  onRetry,
  scan,
}: {
  onClean?: () => void
  onClose: () => void
  onRetry: () => void
  scan: HostingSecurityScan
}) {
  const infected = scan.report?.infected_files ?? []
  const remediationLog = scan.report?.remediation_log ?? []
  return (
    <AdminModalFrame onClose={onClose} title="Reporte de escaneo" kicker={scan.account_domain || scan.path}>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <AdminStatus label="Estado" value={antivirusStatusLabel(scan.status)} />
          <AdminStatus label="Riesgo" value={antivirusRisk(scan)} />
          <AdminStatus label="Tipo" value={antivirusScanTypeLabel(scan.scan_type, scan.path)} />
          <AdminStatus label="Archivos analizados" value={scan.files_scanned.toLocaleString()} />
          <AdminStatus label="Amenazas" value={scan.infected_files.toLocaleString()} />
          <AdminStatus label="Duracion" value={scan.report?.duration_seconds ? `${scan.report.duration_seconds}s` : "N/D"} />
        </div>
        {scan.error_detail ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{scan.error_code || "ERROR"}: {scan.error_detail}</div> : null}
        <div>
          <div className="mb-2 text-sm font-bold text-slate-900">Detectados</div>
          <div className="max-h-32 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            {infected.length ? infected.map((file) => <div key={file}>{file}</div>) : <div>No se registraron archivos infectados.</div>}
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-bold text-slate-900">Registro de limpieza</div>
          <div className="max-h-32 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            {remediationLog.length ? remediationLog.map((item, index) => <div key={index}>{String(item.action || "accion")} - {String(item.status || "registrado")} - {String(item.queued_at || item.finished_at || "")}</div>) : <div>Sin acciones de limpieza registradas.</div>}
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-bold text-slate-900">Salida del motor</div>
          <pre className="max-h-48 overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100">{scan.output || "Sin salida registrada aun."}</pre>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        {onClean ? <Button onClick={onClean} type="button" variant="outline">Limpiar</Button> : null}
        <Button disabled={scan.status === "queued" || scan.status === "running"} onClick={onRetry} type="button" variant="outline">Reescanear</Button>
        <Button onClick={onClose} type="button">Cerrar</Button>
      </div>
    </AdminModalFrame>
  )
}

function AdminAntivirusCleanModal({
  isSaving,
  onClose,
  onSubmit,
  scan,
}: {
  isSaving: boolean
  onClose: () => void
  onSubmit: (payload: RemediateSecurityScanPayload) => void
  scan: HostingSecurityScan
}) {
  const infected = scan.report?.infected_files ?? []
  const [action, setAction] = useState<RemediateSecurityScanPayload["action"]>(infected.length > 3 ? "quarantine" : "clean")
  return (
    <AdminModalFrame onClose={onClose} title="Limpiar amenazas" kicker={scan.account_domain}>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit({ action, targets: infected }) }}>
        <div className="grid gap-3 md:grid-cols-2">
          <AdminStatus label="Cuenta" value={scan.account_username || scan.account_domain} />
          <AdminStatus label="Amenazas" value={scan.infected_files.toLocaleString()} />
          <label className="text-sm font-bold text-slate-700 md:col-span-2">
            Accion recomendada
            <select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold" onChange={(event) => setAction(event.target.value as RemediateSecurityScanPayload["action"])} value={action}>
              <option value="clean">Limpiar codigo infectado</option>
              <option value="quarantine">Mover a cuarentena</option>
              <option value="delete">Eliminar archivo</option>
            </select>
          </label>
        </div>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          La orden se enviara al agente del nodo. El resultado quedara agregado al reporte historico del escaneo.
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">Cancelar</Button>
          <Button disabled={isSaving} type="submit">Enviar limpieza</Button>
        </div>
      </form>
    </AdminModalFrame>
  )
}

function AdminModalFrame({ children, kicker, onClose, title }: { children: ReactNode; kicker: string; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 py-8">
      <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="eh-kicker">{kicker}</div>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{title}</h2>
          </div>
          <Button onClick={onClose} size="sm" type="button" variant="outline">Cerrar</Button>
        </div>
        {children}
      </div>
    </div>
  )
}

function antivirusScanPayload(domain: HostingDomain | undefined, scope: string): CreateSecurityScanPayload | null {
  if (!domain) return null
  if (scope === "full") return { account: domain.account, path: ".", scan_type: "full" }
  if (scope === "database") return { account: domain.account, path: "databases", scan_type: "manual" }
  if (scope === "mail") return { account: domain.account, path: "mail", scan_type: "manual" }
  return { account: domain.account, path: domain.document_root || "public_html", scan_type: "quick" }
}

function antivirusStatusLabel(status: HostingSecurityScan["status"]) {
  const labels: Record<HostingSecurityScan["status"], string> = {
    canceled: "Cancelado",
    clean: "Limpio",
    failed: "Fallido",
    queued: "Pendiente",
    running: "En analisis",
    threat: "Infectado",
  }
  return labels[status] || status
}

function antivirusScanTypeLabel(scanType: HostingSecurityScan["scan_type"], path: string) {
  if (path === "mail") return "Correos y Rspamd"
  if (path === "databases") return "Base de datos"
  if (scanType === "full") return "Toda la cuenta"
  if (scanType === "quick") return "Archivos web"
  return "Manual"
}

function antivirusRisk(scan: HostingSecurityScan) {
  if (scan.status === "queued" || scan.status === "running") return "Pendiente"
  if (scan.infected_files >= 5) return "Alto"
  if (scan.infected_files > 0) return "Medio"
  if (scan.status === "failed") return "Medio"
  return "Bajo"
}

function antivirusRecommendation(scan: HostingSecurityScan) {
  if (scan.status === "threat") return scan.infected_files >= 5 ? "Cuarentena o eliminacion" : "Limpiar y reescanear"
  if (scan.status === "running") return "Analizando"
  if (scan.status === "queued") return "Esperando agente"
  if (scan.status === "failed") return "Revisar error y reescanear"
  return "Ver reporte"
}

function isWithinLastHours(value: string | null, hours: number) {
  if (!value) return false
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return false
  return Date.now() - time <= hours * 60 * 60 * 1000
}

function MiniGauge({ tone, value }: { tone: "amber" | "blue"; value: number }) {
  const color = tone === "amber" ? "#f59e0b" : "#2563eb"
  return (
    <div
      className="grid h-20 w-20 place-items-center rounded-full"
      style={{ background: `conic-gradient(${color} ${value * 3.6}deg, #e2e8f0 0deg)` }}
    >
      <div className="grid h-14 w-14 place-items-center rounded-full bg-white text-sm font-bold text-slate-900">{value}%</div>
    </div>
  )
}

function MiniLineChart({ values = [] }: { values?: number[] }) {
  const numbers = values.filter((value) => Number.isFinite(value))
  const points = numbers.length
    ? numbers.map((value, index) => {
      const normalized = numbers.length === 1 ? [value, value] : numbers
      const min = Math.min(...normalized)
      const max = Math.max(...normalized)
      const span = max - min || 1
      const x = 4 + (index / Math.max(1, numbers.length - 1)) * 104
      const y = 55 - ((value - min) / span) * 47
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`
    }).join(" ")
    : ""
  return (
    <svg aria-hidden="true" className="h-16 w-28" viewBox="0 0 112 64">
      <path d="M4 55 H108" stroke="#e2e8f0" strokeWidth="1" />
      {points ? (
        <>
          <polyline fill="none" points={points} stroke="#2563eb" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          <polygon fill="#dbeafe" opacity="0.75" points={`4,55 ${points} 108,55`} />
        </>
      ) : (
        <>
          <path d="M4 42 C18 24 28 31 38 20 S62 25 72 14 S94 20 108 8" fill="none" stroke="#2563eb" strokeLinecap="round" strokeWidth="3" />
          <path d="M4 42 C18 24 28 31 38 20 S62 25 72 14 S94 20 108 8 L108 55 L4 55 Z" fill="#dbeafe" opacity="0.75" />
        </>
      )}
    </svg>
  )
}

function AntivirusStatusBadge({ status }: { status: string }) {
  const tone =
    status === "Limpio"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Infectado"
        ? "bg-red-50 text-red-700"
        : status === "En analisis"
          ? "bg-blue-50 text-blue-700"
          : "bg-amber-50 text-amber-700"

  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{status}</span>
}

function RiskBadge({ risk }: { risk: string }) {
  const tone =
    risk === "Alto"
      ? "bg-red-50 text-red-700"
      : risk === "Medio"
        ? "bg-amber-50 text-amber-700"
        : risk === "Pendiente"
          ? "bg-slate-100 text-slate-700"
          : "bg-emerald-50 text-emerald-700"

  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{risk}</span>
}

function AdminMailDeliverabilityPage() {
  const [domains, setDomains] = useState<HostingDomain[]>([])
  const [dnsRecords, setDnsRecords] = useState<HostingDnsRecord[]>([])
  const [mailboxes, setMailboxes] = useState<HostingMailbox[]>([])
  const [queueRows, setQueueRows] = useState<AdminMailQueueItem[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [providerFilter, setProviderFilter] = useState("")
  const [selectedRow, setSelectedRow] = useState<DeliverabilityRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")

  const loadDeliverability = () => {
    setIsLoading(true)
    setMessage("")
    Promise.all([hostingApi.domains(), hostingApi.dnsRecords(), hostingApi.mailboxes(), adminApi.mailQueue()])
      .then(([domainPage, dnsPage, mailboxPage, queuePage]) => {
        setDomains(domainPage.results)
        setDnsRecords(dnsPage.results)
        setMailboxes(mailboxPage.results)
        setQueueRows(queuePage.results)
      })
      .catch((error: Error) => setMessage(error.message || "No se pudo cargar entregabilidad."))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadDeliverability()
  }, [])

  const rows = domains.map((domain) => buildDeliverabilityRow(domain, dnsRecords, mailboxes, queueRows))
  const providers = Array.from(new Set(rows.map((row) => row.provider).filter(Boolean)))
  const filteredRows = rows.filter((row) => {
    const haystack = [row.domain.domain, row.provider, row.issue, row.status, row.accountLabel, row.node].join(" ").toLowerCase()
    const matchesSearch = !query.trim() || haystack.includes(query.trim().toLowerCase())
    const matchesStatus = !statusFilter || row.status === statusFilter
    const matchesProvider = !providerFilter || row.provider === providerFilter
    return matchesSearch && matchesStatus && matchesProvider
  })
  const totalMessages = rows.reduce((total, row) => total + row.total, 0)
  const deliveredTotal = rows.reduce((total, row) => total + row.deliveredCount, 0)
  const rejectedTotal = rows.reduce((total, row) => total + row.rejectedCount, 0)
  const spamTotal = rows.reduce((total, row) => total + row.spamCount, 0)
  const deliveryPct = totalMessages ? Math.round((deliveredTotal / totalMessages) * 1000) / 10 : 100

  const correctDns = async (row: DeliverabilityRow) => {
    setIsSaving(true)
    setMessage("")
    try {
      await hostingApi.applyDnsTemplate(row.domain.id)
      setMessage(`Plantilla DNS aplicada a ${row.domain.domain}.`)
      loadDeliverability()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo aplicar la plantilla DNS.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className={cn("rounded-lg border px-4 py-3 text-sm font-semibold", message.includes("No se") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
          {message}
        </div>
      ) : null}
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Correo</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Entregabilidad</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Salud de entrega por dominio y proveedor, con causas claras cuando los correos no llegan bien.
              </p>
            </div>
          </div>
          <Button disabled={isLoading} onClick={loadDeliverability} size="sm">{isLoading ? "Actualizando" : "Ejecutar diagnostico"}</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <div className="eh-card p-4">
          <div className="eh-kicker">Entrega global</div>
          <div className="mt-3 flex items-center gap-4">
            <MiniGauge value={Math.round(deliveryPct)} tone="blue" />
            <div>
              <div className="text-2xl font-bold">{deliveryPct}%</div>
              <p className="mt-1 text-sm text-slate-500">Correos aceptados</p>
            </div>
          </div>
        </div>
        <div className="eh-card p-4">
          <div className="eh-kicker">Tendencia 24h</div>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <div className="text-2xl font-bold">{totalMessages.toLocaleString()}</div>
              <p className="mt-1 text-sm text-slate-500">Mensajes procesados</p>
            </div>
            <MiniLineChart />
          </div>
        </div>
        <AdminMetric label="Rebotes" value={rejectedTotal.toLocaleString()} detail="Temporales y permanentes" />
        <AdminMetric label="A spam" value={spamTotal.toLocaleString()} detail="Reputacion o contenido" />
      </section>

      <div className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex h-9 w-[430px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar dominio, proveedor o problema..." value={query} />
          </div>
          <div className="flex gap-2">
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="">Estado</option>
              <option value="Saludable">Saludable</option>
              <option value="Advertencia">Advertencia</option>
              <option value="Riesgo">Riesgo</option>
            </select>
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setProviderFilter(event.target.value)} value={providerFilter}>
              <option value="">Proveedor</option>
              {providers.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
            </select>
            <Button disabled={isLoading} onClick={loadDeliverability} size="sm" variant="outline">SPF/DKIM/DMARC</Button>
          </div>
        </div>

        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["Dominio", "Proveedor", "Entregados", "Rechazados", "Spam", "Rebotes", "Estado", "Explicacion", "Acciones"].map((column) => (
                <th className="px-4 py-2 font-bold" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.map((row) => (
              <tr className="hover:bg-slate-50" key={`${row.domain.id}-${row.provider}`}>
                <td className="px-4 py-3 font-semibold text-blue-700">{row.domain.domain}</td>
                <td className="px-4 py-3">{row.provider}</td>
                <td className="px-4 py-3 font-semibold">{row.delivered}</td>
                <td className="px-4 py-3">{row.rejectedCount}</td>
                <td className="px-4 py-3">{row.spamCount}</td>
                <td className="px-4 py-3">{row.bouncedCount}</td>
                <td className="px-4 py-3"><MailHealthBadge status={row.status} /></td>
                <td className="max-w-[360px] px-4 py-3 text-slate-600">{row.issue}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button onClick={() => setSelectedRow(row)} size="sm" variant="outline">Ver</Button>
                    <Button disabled={isSaving} onClick={() => void correctDns(row)} size="sm" variant="outline">Corregir DNS</Button>
                    <Button onClick={() => setSelectedRow(row)} size="sm" variant="outline">Reporte</Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && filteredRows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={9}>No hay dominios con datos de entregabilidad para esos filtros.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {selectedRow ? <DeliverabilityDetailModal onClose={() => setSelectedRow(null)} row={selectedRow} /> : null}
    </div>
  )
}

type DeliverabilityRow = {
  accountLabel: string
  bouncedCount: number
  delivered: string
  deliveredCount: number
  dns: { dkim: boolean; dmarc: boolean; spf: boolean }
  domain: HostingDomain
  issue: string
  mailboxes: number
  node: string
  provider: string
  queue: AdminMailQueueItem[]
  rejectedCount: number
  spamCount: number
  status: string
  total: number
}

function DeliverabilityDetailModal({ onClose, row }: { onClose: () => void; row: DeliverabilityRow }) {
  return (
    <AdminModalFrame kicker="Entregabilidad" onClose={onClose} title={row.domain.domain}>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <AdminStatus label="Estado" value={row.status} />
          <AdminStatus label="Proveedor" value={row.provider} />
          <AdminStatus label="Entrega" value={row.delivered} />
          <AdminStatus label="Rechazados" value={String(row.rejectedCount)} />
          <AdminStatus label="Spam" value={String(row.spamCount)} />
          <AdminStatus label="Buzones" value={String(row.mailboxes)} />
          <AdminStatus label="SPF" value={row.dns.spf ? "OK" : "Falta"} />
          <AdminStatus label="DKIM" value={row.dns.dkim ? "OK" : "Falta"} />
          <AdminStatus label="DMARC" value={row.dns.dmarc ? "OK" : "Falta"} />
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-bold uppercase text-slate-500">Diagnostico</div>
          <div className="mt-1 text-sm font-semibold text-slate-800">{row.issue}</div>
        </div>
        <div>
          <div className="mb-2 text-sm font-bold text-slate-900">Eventos recientes</div>
          <div className="max-h-64 overflow-auto rounded-md border border-slate-200">
            {row.queue.slice(0, 10).map((item) => (
              <div className="border-b border-slate-100 px-3 py-2 text-sm last:border-b-0" key={item.id}>
                <div className="font-semibold text-slate-800">{item.from || "N/D"} {"->"} {item.to || "N/D"}</div>
                <div className="mt-1 text-xs text-slate-500">{item.status} · {item.code || "N/D"} · {item.explanation}</div>
              </div>
            ))}
            {!row.queue.length ? <div className="px-3 py-4 text-sm font-semibold text-slate-500">Sin eventos de cola para este dominio.</div> : null}
          </div>
        </div>
      </div>
    </AdminModalFrame>
  )
}

function buildDeliverabilityRow(domain: HostingDomain, records: HostingDnsRecord[], mailboxes: HostingMailbox[], queueRows: AdminMailQueueItem[]): DeliverabilityRow {
  const domainRecords = records.filter((record) => record.domain === domain.id || record.domain_name === domain.domain)
  const domainMailboxes = mailboxes.filter((mailbox) => mailbox.account === domain.account || mailbox.account_domain === domain.domain || mailbox.email.endsWith(`@${domain.domain}`))
  const domainQueue = queueRows.filter((row) => emailBelongsToDomain(row.from, domain.domain) || emailBelongsToDomain(row.to, domain.domain))
  const deliveredCount = domainQueue.filter((row) => row.status === "Entregado").length
  const rejectedCount = domainQueue.filter((row) => row.status === "Rechazado").length
  const spamCount = domainQueue.filter((row) => row.status === "Spam").length
  const bouncedCount = domainQueue.filter((row) => row.explanation.toLowerCase().includes("bounce") || row.explanation.toLowerCase().includes("rebote") || row.status === "Rechazado").length
  const total = domainQueue.length
  const deliveredPct = total ? Math.round((deliveredCount / total) * 1000) / 10 : 100
  const dns = {
    dkim: domainRecords.some((record) => record.type === "TXT" && (record.name.includes("_domainkey") || record.content.toLowerCase().includes("dkim"))),
    dmarc: domainRecords.some((record) => record.type === "TXT" && (record.name.toLowerCase().includes("_dmarc") || record.content.toLowerCase().includes("dmarc"))),
    spf: domainRecords.some((record) => record.type === "TXT" && record.content.toLowerCase().includes("v=spf1")),
  }
  const status = deliverabilityStatus(deliveredPct, rejectedCount, spamCount, dns)
  return {
    accountLabel: domain.account_username || domain.account_domain,
    bouncedCount,
    delivered: `${deliveredPct}%`,
    deliveredCount,
    dns,
    domain,
    issue: deliverabilityIssue(status, rejectedCount, spamCount, dns),
    mailboxes: domainMailboxes.length,
    node: domain.node_hostname || "N/D",
    provider: deliverabilityProvider(domainQueue),
    queue: domainQueue,
    rejectedCount,
    spamCount,
    status,
    total,
  }
}

function emailBelongsToDomain(value: string, domain: string) {
  return value.toLowerCase().endsWith(`@${domain.toLowerCase()}`)
}

function deliverabilityStatus(deliveredPct: number, rejected: number, spam: number, dns: { dkim: boolean; dmarc: boolean; spf: boolean }) {
  const missingDns = [dns.spf, dns.dkim, dns.dmarc].filter((item) => !item).length
  if (deliveredPct < 90 || rejected >= 10 || spam >= 10 || missingDns >= 2) return "Riesgo"
  if (deliveredPct < 97 || rejected > 0 || spam > 0 || missingDns > 0) return "Advertencia"
  return "Saludable"
}

function deliverabilityIssue(status: string, rejected: number, spam: number, dns: { dkim: boolean; dmarc: boolean; spf: boolean }) {
  const missing = [
    !dns.spf ? "SPF" : "",
    !dns.dkim ? "DKIM" : "",
    !dns.dmarc ? "DMARC" : "",
  ].filter(Boolean)
  if (missing.length) return `Faltan registros ${missing.join(", ")}.`
  if (status === "Riesgo") return "Dominio con rechazos o spam elevados; revisar reputacion y cola."
  if (rejected || spam) return "Hay rechazos, rebotes o clasificacion spam recientes."
  return "Sin problemas relevantes."
}

function deliverabilityProvider(rows: AdminMailQueueItem[]) {
  const providers = rows.map((row) => providerFromEmail(row.direction === "Salida" ? row.to : row.from)).filter(Boolean)
  if (!providers.length) return "Mixto"
  const counts = new Map<string, number>()
  providers.forEach((provider) => counts.set(provider, (counts.get(provider) || 0) + 1))
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || "Mixto"
}

function providerFromEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() || ""
  if (!domain) return ""
  if (domain.includes("gmail") || domain.includes("googlemail")) return "Gmail"
  if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live") || domain.includes("microsoft")) return "Outlook"
  if (domain.includes("yahoo")) return "Yahoo"
  return "Corporativos"
}

function AdminSmtpReputationPage() {
  const [nodes, setNodes] = useState<AdminNode[]>([])
  const [queueRows, setQueueRows] = useState<AdminMailQueueItem[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [nodeFilter, setNodeFilter] = useState("")
  const [providerFilter, setProviderFilter] = useState("")
  const [selectedRow, setSelectedRow] = useState<SmtpReputationRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")

  const loadSmtpReputation = () => {
    setIsLoading(true)
    setMessage("")
    Promise.all([adminApi.nodes(), adminApi.mailQueue()])
      .then(([nodePage, queuePage]) => {
        setNodes(nodePage.results)
        setQueueRows(queuePage.results)
      })
      .catch((error: Error) => setMessage(error.message || "No se pudo cargar la reputacion SMTP."))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadSmtpReputation()
  }, [])

  const rows = nodes.map((node) => buildSmtpReputationRow(node, queueRows))
  const providers = Array.from(new Set(rows.flatMap((row) => row.providerDetails.map((provider) => provider.provider))))
  const filteredRows = rows.filter((row) => {
    const haystack = [row.ip, row.node, row.providers, row.status, row.issue].join(" ").toLowerCase()
    const matchesSearch = !query.trim() || haystack.includes(query.trim().toLowerCase())
    const matchesStatus = !statusFilter || row.status === statusFilter
    const matchesNode = !nodeFilter || row.nodeId === nodeFilter
    const matchesProvider = !providerFilter || row.providerDetails.some((provider) => provider.provider === providerFilter)
    return matchesSearch && matchesStatus && matchesNode && matchesProvider
  })
  const averageReputation = rows.length ? Math.round(rows.reduce((total, row) => total + row.reputation, 0) / rows.length) : 100
  const blacklistRiskCount = rows.filter((row) => row.blacklistSignals > 0).length
  const complaintRate = rows.length ? Math.round((rows.reduce((total, row) => total + row.complaintRate, 0) / rows.length) * 100) / 100 : 0

  const refreshBlacklists = async () => {
    setIsSaving(true)
    setMessage("")
    try {
      await adminApi.refreshMailQueue()
      loadSmtpReputation()
      setMessage("Revision solicitada. La reputacion se recalcula con la cola y rebotes reales del agente.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo solicitar la revision.")
    } finally {
      setIsSaving(false)
    }
  }

  const sendSmtpAction = async (row: SmtpReputationRow, action: "smtp_limit_outbound" | "smtp_warmup_mode") => {
    setIsSaving(true)
    setMessage("")
    try {
      await adminApi.serviceAction(row.nodeId, { action, service: "postfix" })
      setMessage(action === "smtp_limit_outbound" ? `Limitacion SMTP enviada a ${row.node}.` : `Calentamiento SMTP enviado a ${row.node}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo enviar la accion al agente.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className={cn("rounded-lg border px-4 py-3 text-sm font-semibold", message.includes("No se") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
          {message}
        </div>
      ) : null}
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Correo</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Reputacion SMTP</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Estado de las IPs de salida SMTP, volumen enviado, rebotes, quejas y aceptacion por proveedor.
              </p>
            </div>
          </div>
          <Button disabled={isLoading || isSaving} onClick={() => void refreshBlacklists()} size="sm">{isSaving ? "Solicitando" : "Revisar blacklists"}</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <div className="eh-card p-4">
          <div className="eh-kicker">Reputacion media</div>
          <div className="mt-3 flex items-center gap-4">
            <MiniGauge value={averageReputation} tone="blue" />
            <div>
              <div className="text-2xl font-bold">{averageReputation}%</div>
              <p className="mt-1 text-sm text-slate-500">{smtpReputationSummary(averageReputation)}</p>
            </div>
          </div>
        </div>
        <AdminMetric label="IPs SMTP" value={String(rows.length)} detail="Salidas activas" />
        <AdminMetric label="Blacklists" value={String(blacklistRiskCount)} detail={blacklistRiskCount ? "Senales en rebotes" : "Sin listados criticos"} />
        <AdminMetric label="Quejas" value={`${complaintRate}%`} detail="Estimado por rechazos/spam" />
      </section>

      <div className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex h-9 w-[430px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar IP, nodo, proveedor o estado..." value={query} />
          </div>
          <div className="flex gap-2">
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="">Estado</option>
              <option value="Buena">Buena</option>
              <option value="Advertencia">Advertencia</option>
              <option value="Riesgo">Riesgo</option>
              <option value="Sin datos">Sin datos</option>
            </select>
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setNodeFilter(event.target.value)} value={nodeFilter}>
              <option value="">Nodo</option>
              {nodes.map((node) => <option key={node.id} value={node.id}>{node.hostname}</option>)}
            </select>
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setProviderFilter(event.target.value)} value={providerFilter}>
              <option value="">Proveedor</option>
              {providers.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
            </select>
          </div>
        </div>

        <table className="w-full min-w-[1140px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["IP SMTP", "Nodo", "Reputacion", "Enviados 24h", "Rebotes", "Quejas", "Proveedor", "Estado", "Acciones"].map((column) => (
                <th className="px-4 py-2 font-bold" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.map((row) => (
              <tr className="hover:bg-slate-50" key={row.ip}>
                <td className="px-4 py-3 font-semibold text-slate-900">{row.ip}</td>
                <td className="px-4 py-3 text-blue-700">{row.node}</td>
                <td className="px-4 py-3"><ReputationBar value={row.reputation} /></td>
                <td className="px-4 py-3 font-semibold">{row.sent}</td>
                <td className="px-4 py-3">{row.bounces}</td>
                <td className="px-4 py-3">{row.complaints}</td>
                <td className="max-w-[260px] px-4 py-3 text-slate-600">{row.providers}</td>
                <td className="px-4 py-3"><MailHealthBadge status={row.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button onClick={() => setSelectedRow(row)} size="sm" variant="outline">Ver</Button>
                    <Button disabled={isSaving} onClick={() => void sendSmtpAction(row, "smtp_limit_outbound")} size="sm" variant="outline">Limitar</Button>
                    <Button disabled={isSaving} onClick={() => void sendSmtpAction(row, "smtp_warmup_mode")} size="sm" variant="outline">Calentar</Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && filteredRows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={9}>No hay nodos SMTP para esos filtros.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {selectedRow ? <SmtpReputationDetailModal onClose={() => setSelectedRow(null)} row={selectedRow} /> : null}
    </div>
  )
}

type SmtpProviderDetail = {
  blacklist: number
  delivered: number
  provider: string
  rejected: number
  spam: number
  total: number
}

type SmtpReputationRow = {
  blacklistSignals: number
  bounces: string
  complaintRate: number
  complaints: string
  ip: string
  issue: string
  node: string
  nodeId: string
  providerDetails: SmtpProviderDetail[]
  providers: string
  queue: AdminMailQueueItem[]
  reputation: number
  sent: string
  status: string
}

function SmtpReputationDetailModal({ onClose, row }: { onClose: () => void; row: SmtpReputationRow }) {
  return (
    <AdminModalFrame kicker="Reputacion SMTP" onClose={onClose} title={row.node}>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <AdminStatus label="IP SMTP" value={row.ip} />
          <AdminStatus label="Estado" value={row.status} />
          <AdminStatus label="Score" value={`${row.reputation}%`} />
          <AdminStatus label="Enviados" value={row.sent} />
          <AdminStatus label="Rebotes" value={row.bounces} />
          <AdminStatus label="Senales blacklist" value={String(row.blacklistSignals)} />
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-bold uppercase text-slate-500">Diagnostico</div>
          <div className="mt-1 text-sm font-semibold text-slate-800">{row.issue}</div>
        </div>
        <div className="rounded-md border border-slate-200">
          <div className="grid grid-cols-5 bg-slate-50 px-3 py-2 text-xs font-bold uppercase text-slate-500">
            <span>Proveedor</span>
            <span>Total</span>
            <span>Rechazos</span>
            <span>Spam</span>
            <span>Blacklist</span>
          </div>
          {row.providerDetails.map((provider) => (
            <div className="grid grid-cols-5 border-t border-slate-100 px-3 py-2 text-sm" key={provider.provider}>
              <span className="font-semibold text-slate-900">{provider.provider}</span>
              <span>{provider.total}</span>
              <span>{provider.rejected}</span>
              <span>{provider.spam}</span>
              <span>{provider.blacklist}</span>
            </div>
          ))}
          {!row.providerDetails.length ? <div className="px-3 py-4 text-sm font-semibold text-slate-500">Sin eventos SMTP recientes para este nodo.</div> : null}
        </div>
        <div>
          <div className="mb-2 text-sm font-bold text-slate-900">Rechazos y rebotes recientes</div>
          <div className="max-h-56 overflow-auto rounded-md border border-slate-200">
            {row.queue.filter((item) => item.status !== "Entregado").slice(0, 8).map((item) => (
              <div className="border-b border-slate-100 px-3 py-2 text-sm last:border-b-0" key={item.id}>
                <div className="font-semibold text-slate-800">{providerFromEmail(item.to)} - {item.code || "N/D"} - {item.status}</div>
                <div className="mt-1 text-xs text-slate-500">{item.explanation || item.to || item.queue_id}</div>
              </div>
            ))}
            {!row.queue.filter((item) => item.status !== "Entregado").length ? <div className="px-3 py-4 text-sm font-semibold text-slate-500">Sin rebotes ni rechazos recientes.</div> : null}
          </div>
        </div>
      </div>
    </AdminModalFrame>
  )
}

function buildSmtpReputationRow(node: AdminNode, queueRows: AdminMailQueueItem[]): SmtpReputationRow {
  const nodeQueue = queueRows.filter((row) => row.node === node.id || row.node_hostname === node.hostname).filter((row) => row.direction !== "Entrada")
  const sent = nodeQueue.length
  const rejected = nodeQueue.filter((row) => row.status === "Rechazado").length
  const spam = nodeQueue.filter((row) => row.status === "Spam").length
  const blacklistSignals = nodeQueue.filter((row) => smtpBlacklistSignal(row)).length
  const bounceRate = sent ? Math.round((rejected / sent) * 1000) / 10 : 0
  const complaintRate = sent ? Math.round(((spam + blacklistSignals) / sent) * 1000) / 10 : 0
  const reputation = smtpReputationScore(sent, rejected, spam, blacklistSignals)
  const providerDetails = buildSmtpProviderDetails(nodeQueue)
  return {
    blacklistSignals,
    bounces: `${bounceRate}%`,
    complaintRate,
    complaints: `${complaintRate}%`,
    ip: smtpNodeIp(node),
    issue: smtpIssueLabel(providerDetails, reputation, sent),
    node: node.hostname,
    nodeId: node.id,
    providerDetails,
    providers: smtpProvidersLabel(providerDetails),
    queue: nodeQueue,
    reputation,
    sent: sent.toLocaleString(),
    status: sent ? smtpReputationStatus(reputation, blacklistSignals) : "Sin datos",
  }
}

function buildSmtpProviderDetails(rows: AdminMailQueueItem[]) {
  const map = new Map<string, SmtpProviderDetail>()
  rows.forEach((row) => {
    const provider = providerFromEmail(row.to) || "Corporativos"
    const current = map.get(provider) || { blacklist: 0, delivered: 0, provider, rejected: 0, spam: 0, total: 0 }
    current.total += 1
    if (row.status === "Entregado") current.delivered += 1
    if (row.status === "Rechazado") current.rejected += 1
    if (row.status === "Spam") current.spam += 1
    if (smtpBlacklistSignal(row)) current.blacklist += 1
    map.set(provider, current)
  })
  return Array.from(map.values()).sort((left, right) => (right.rejected + right.spam + right.blacklist) - (left.rejected + left.spam + left.blacklist))
}

function smtpBlacklistSignal(row: AdminMailQueueItem) {
  const haystack = `${row.code} ${row.status} ${row.explanation}`.toLowerCase()
  return haystack.includes("blacklist") || haystack.includes("blocked") || haystack.includes("block list") || haystack.includes("rbl") || haystack.includes("dnsbl") || haystack.includes("spamhaus") || haystack.includes("barracuda") || haystack.includes("listed") || haystack.includes("lista negra")
}

function smtpNodeIp(node: AdminNode) {
  const capabilities = node.capabilities || {}
  const telemetry = node.last_telemetry || {}
  return String(capabilities.smtp_public_ip || capabilities.mail_public_ip || telemetry.smtp_public_ip || telemetry.public_ip || node.public_ip || "N/D")
}

function smtpProvidersLabel(providers: SmtpProviderDetail[]) {
  if (!providers.length) return "Sin eventos SMTP recientes"
  return providers.slice(0, 3).map((provider) => {
    if (provider.blacklist) return `${provider.provider} posible blacklist`
    if (provider.rejected) return `${provider.provider} rechaza ${provider.rejected}`
    if (provider.spam) return `${provider.provider} spam ${provider.spam}`
    return `${provider.provider} OK`
  }).join(", ")
}

function smtpIssueLabel(providers: SmtpProviderDetail[], reputation: number, sent: number) {
  if (!sent) return "Sin eventos de cola SMTP recientes para calcular reputacion."
  const critical = providers.find((provider) => provider.blacklist > 0 || provider.rejected >= 5 || provider.spam >= 5)
  if (critical?.blacklist) return `${critical.provider} devuelve senales de bloqueo o blacklist en rebotes SMTP.`
  if (critical?.rejected) return `${critical.provider} concentra rechazos recientes; revisar codigos SMTP y reputacion de IP.`
  if (critical?.spam) return `${critical.provider} concentra clasificacion spam; revisar contenido, DKIM y calentamiento.`
  if (reputation < 80) return "Hay rechazos o spam suficientes para bajar la reputacion del nodo."
  return "Sin conflictos relevantes por proveedor externo."
}

function smtpReputationScore(sent: number, rejected: number, spam: number, blacklistSignals: number) {
  if (!sent) return 100
  const rejectedRate = rejected / sent
  const spamRate = spam / sent
  const blacklistRate = blacklistSignals / sent
  return Math.max(0, Math.round(100 - rejectedRate * 220 - spamRate * 180 - blacklistRate * 300))
}

function smtpReputationStatus(reputation: number, blacklistSignals: number) {
  if (blacklistSignals || reputation < 60) return "Riesgo"
  if (reputation < 80) return "Advertencia"
  return "Buena"
}

function smtpReputationSummary(value: number) {
  if (value < 60) return "Riesgo operativo"
  if (value < 80) return "Aceptable, con alertas"
  return "Buena reputacion"
}

function ReputationBar({ value }: { value: number }) {
  return (
    <div className="w-32">
      <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
        <span>{value}%</span>
        <span>score</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-200">
        <div className={cn("h-1.5 rounded-full", value < 60 ? "bg-red-500" : value < 80 ? "bg-amber-500" : "bg-blue-600")} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function MailHealthBadge({ status }: { status: string }) {
  const tone =
    status === "Saludable" || status === "Buena"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Riesgo"
        ? "bg-red-50 text-red-700"
        : status === "Calentando"
          ? "bg-blue-50 text-blue-700"
          : "bg-amber-50 text-amber-700"

  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{status}</span>
}

function AdminAntispamPage() {
  const [nodes, setNodes] = useState<AdminNode[]>([])
  const [domains, setDomains] = useState<HostingDomain[]>([])
  const [dnsRecords, setDnsRecords] = useState<HostingDnsRecord[]>([])
  const [mailboxes, setMailboxes] = useState<HostingMailbox[]>([])
  const [queueRows, setQueueRows] = useState<AdminMailQueueItem[]>([])
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const [selectedRule, setSelectedRule] = useState<AntispamRuleRow | null>(null)
  const [editingRule, setEditingRule] = useState<AntispamRuleRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")

  const loadAntispam = () => {
    setIsLoading(true)
    setMessage("")
    Promise.all([
      adminApi.nodes(),
      adminApi.mailQueue(),
      hostingApi.domains(),
      hostingApi.dnsRecords(),
      hostingApi.mailboxes(),
    ])
      .then(([nodePage, queuePage, domainPage, dnsPage, mailboxPage]) => {
        setNodes(nodePage.results)
        setQueueRows(queuePage.results)
        setDomains(domainPage.results)
        setDnsRecords(dnsPage.results)
        setMailboxes(mailboxPage.results)
      })
      .catch((error: Error) => setMessage(error.message || "No se pudo cargar Antispam."))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadAntispam()
  }, [])

  const rules = buildAntispamRules({ dnsRecords, domains, mailboxes, nodes, queueRows })
  const filteredRules = rules.filter((rule) => {
    const haystack = [rule.name, rule.type, rule.action, rule.recommendation, rule.status].join(" ").toLowerCase()
    return (!query.trim() || haystack.includes(query.trim().toLowerCase()))
      && (!typeFilter || rule.type === typeFilter)
      && (!statusFilter || rule.status === statusFilter)
      && (!actionFilter || rule.action === actionFilter)
  })
  const spamBlocked = queueRows.filter((row) => row.status === "Spam" || antispamRejectSignal(row)).length
  const markedSpam = queueRows.filter((row) => row.status === "Spam").length
  const falsePositivePct = spamBlocked ? Math.round((queueRows.filter((row) => row.status === "Entregado" && antispamFalsePositiveSignal(row)).length / spamBlocked) * 1000) / 10 : 0
  const activeNodes = nodes.filter((node) => antispamNodeHealthy(node)).length
  const dnsblLists = antispamDnsblLists(nodes)
  const authIssues = rules.filter((rule) => rule.type === "Autenticacion" && rule.hitsCount > 0).length

  const refreshRules = async () => {
    setIsSaving(true)
    setMessage("")
    try {
      await Promise.all(nodes.map((node) => adminApi.serviceAction(node.id, { action: "antispam_status", service: "rspamd" })))
      loadAntispam()
      setMessage("Revision antispam solicitada a los nodos.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar reglas.")
    } finally {
      setIsSaving(false)
    }
  }

  const sendRuleAction = async (rule: AntispamRuleRow, action: "pause_antispam_rule" | "configure_antispam_rule", values?: Partial<AntispamRuleRow>) => {
    setIsSaving(true)
    setMessage("")
    try {
      const targetNodes = rule.nodeId ? nodes.filter((node) => node.id === rule.nodeId) : nodes
      await Promise.all(targetNodes.map((node) => adminApi.serviceAction(node.id, {
        action,
        rule_action: values?.action || rule.action,
        rule_name: rule.name,
        rule_score: values?.score || rule.score,
        rule_status: values?.status || rule.status,
        rule_type: rule.type,
        service: "rspamd",
      })))
      setMessage(action === "pause_antispam_rule" ? `Pausa enviada para ${rule.name}.` : `Configuracion enviada para ${rule.name}.`)
      setEditingRule(null)
      loadAntispam()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo enviar la accion antispam.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className={cn("rounded-lg border px-4 py-3 text-sm font-semibold", message.includes("No se") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
          {message}
        </div>
      ) : null}
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Correo</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Antispam</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Estado de Rspamd, reglas antispam, volumen bloqueado y acciones sugeridas para proteger buzones.
              </p>
            </div>
          </div>
          <Button disabled={isLoading || isSaving} onClick={() => void refreshRules()} size="sm">{isSaving ? "Actualizando" : "Actualizar reglas"}</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <div className="eh-card p-4">
          <div className="eh-kicker">Rspamd</div>
          <div className="mt-3 flex items-center gap-4">
            <MiniGauge value={nodes.length ? Math.round((activeNodes / nodes.length) * 100) : 100} tone="blue" />
            <div>
              <div className="text-2xl font-bold">{activeNodes ? "Activo" : "Sin datos"}</div>
              <p className="mt-1 text-sm text-slate-500">{activeNodes} de {nodes.length} nodo(s) reportando</p>
            </div>
          </div>
        </div>
        <div className="eh-card p-4">
          <div className="eh-kicker">Spam bloqueado</div>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <div className="text-2xl font-bold">{spamBlocked.toLocaleString()}</div>
              <p className="mt-1 text-sm text-slate-500">Ultimas 24 horas</p>
            </div>
            <MiniLineChart />
          </div>
        </div>
        <AdminMetric label="Marcados spam" value={markedSpam.toLocaleString()} detail="Movidos a carpeta spam" />
        <AdminMetric label="Falsos positivos" value={`${falsePositivePct}%`} detail="Estimado por eventos corregidos" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_330px]">
        <div className="eh-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex h-9 w-[430px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              <input className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar regla, tecnica, accion o recomendacion..." value={query} />
            </div>
            <div className="flex gap-2">
              <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
                <option value="">Tipo</option>
                {Array.from(new Set(rules.map((rule) => rule.type))).map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                <option value="">Estado</option>
                {Array.from(new Set(rules.map((rule) => rule.status))).map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setActionFilter(event.target.value)} value={actionFilter}>
                <option value="">Accion</option>
                {Array.from(new Set(rules.map((rule) => rule.action))).map((action) => <option key={action} value={action}>{action}</option>)}
              </select>
            </div>
          </div>

          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {["Regla / tecnica", "Tipo", "Score", "Accion", "Mensajes", "Estado", "Sugerencia", "Acciones"].map((column) => (
                  <th className="px-4 py-2 font-bold" key={column}>{column}</th>
                ))}
              </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
              {filteredRules.map((rule) => (
                <tr className="hover:bg-slate-50" key={rule.name}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{rule.name}</td>
                  <td className="px-4 py-3"><AntispamTypeBadge type={rule.type} /></td>
                  <td className="px-4 py-3 font-semibold">{rule.score}</td>
                  <td className="px-4 py-3">{rule.action}</td>
                  <td className="px-4 py-3">{rule.hits}</td>
                  <td className="px-4 py-3"><WafStateBadge status={rule.status} /></td>
                  <td className="max-w-[320px] px-4 py-3 text-slate-600">{rule.recommendation}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button onClick={() => setSelectedRule(rule)} size="sm" variant="outline">Ver</Button>
                      <Button onClick={() => setEditingRule(rule)} size="sm" variant="outline">Editar</Button>
                      <Button disabled={isSaving} onClick={() => void sendRuleAction(rule, "pause_antispam_rule")} size="sm" variant="outline">Pausar</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredRules.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={8}>No hay reglas antispam para esos filtros.</td>
                </tr>
              ) : null}
          </tbody>
        </table>
        </div>

        <aside className="eh-card p-4">
          <div className="eh-kicker">Tecnicas activas</div>
          <h3 className="mt-1 text-lg font-bold">Proteccion instalada</h3>
          <div className="mt-4 space-y-2">
            <AdminStatus label="Rspamd" value={activeNodes ? "Activo" : "Sin reporte"} />
            <AdminStatus label="Bayes" value={antispamCapabilityEnabled(nodes, "bayes") ? "Entrenado" : "Sin dato"} />
            <AdminStatus label="SPF/DKIM/DMARC" value={authIssues ? `${authIssues} alerta(s)` : "Validando"} />
            <AdminStatus label="RBL/DNSBL" value={`${dnsblLists.length || 0} listas`} />
            <AdminStatus label="Greylisting" value={antispamCapabilityEnabled(nodes, "greylist") ? "Selectivo" : "Sin dato"} />
            <AdminStatus label="Cuarentena" value={antispamCapabilityEnabled(nodes, "quarantine") ? "Activa" : "Sin dato"} />
          </div>
          <p className="mt-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
            {dnsblLists.length ? `DNSBL detectadas: ${dnsblLists.slice(0, 4).join(", ")}.` : "Sin listas DNSBL reportadas por el agente. Solicita Actualizar reglas para refrescar telemetria."}
          </p>
        </aside>
      </section>
      {selectedRule ? <AntispamRuleDetailModal onClose={() => setSelectedRule(null)} rule={selectedRule} /> : null}
      {editingRule ? (
        <AntispamRuleEditModal
          isSaving={isSaving}
          onClose={() => setEditingRule(null)}
          onSave={(values) => void sendRuleAction(editingRule, "configure_antispam_rule", values)}
          rule={editingRule}
        />
      ) : null}
    </div>
  )
}

type AntispamRuleRow = {
  action: string
  details: Array<{ label: string; value: string }>
  events: AdminMailQueueItem[]
  hits: string
  hitsCount: number
  name: string
  nodeId?: string
  recommendation: string
  score: string
  status: string
  type: string
}

function AntispamRuleDetailModal({ onClose, rule }: { onClose: () => void; rule: AntispamRuleRow }) {
  return (
    <AdminModalFrame kicker="Antispam" onClose={onClose} title={rule.name}>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <AdminStatus label="Tipo" value={rule.type} />
          <AdminStatus label="Score" value={rule.score} />
          <AdminStatus label="Accion" value={rule.action} />
          <AdminStatus label="Mensajes" value={rule.hits} />
          <AdminStatus label="Estado" value={rule.status} />
          <AdminStatus label="Sugerencia" value={rule.recommendation} />
        </div>
        <div className="rounded-md border border-slate-200">
          {rule.details.map((item) => (
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm last:border-b-0" key={item.label}>
              <span className="font-semibold text-slate-500">{item.label}</span>
              <span className="max-w-[65%] text-right font-bold text-slate-900">{item.value}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="mb-2 text-sm font-bold text-slate-900">Eventos relacionados</div>
          <div className="max-h-56 overflow-auto rounded-md border border-slate-200">
            {rule.events.slice(0, 8).map((item) => (
              <div className="border-b border-slate-100 px-3 py-2 text-sm last:border-b-0" key={item.id}>
                <div className="font-semibold text-slate-800">{item.status} - {item.code || "N/D"} - {item.to || item.from || "N/D"}</div>
                <div className="mt-1 text-xs text-slate-500">{item.explanation || item.queue_id}</div>
              </div>
            ))}
            {!rule.events.length ? <div className="px-3 py-4 text-sm font-semibold text-slate-500">Sin eventos recientes para esta regla.</div> : null}
          </div>
        </div>
      </div>
    </AdminModalFrame>
  )
}

function AntispamRuleEditModal({ isSaving, onClose, onSave, rule }: { isSaving: boolean; onClose: () => void; onSave: (values: Partial<AntispamRuleRow>) => void; rule: AntispamRuleRow }) {
  const [score, setScore] = useState(rule.score)
  const [action, setAction] = useState(rule.action)
  const [status, setStatus] = useState(rule.status)
  return (
    <AdminModalFrame kicker="Editar regla" onClose={onClose} title={rule.name}>
      <div className="space-y-4">
        <label className="text-sm font-bold text-slate-700">
          Score
          <input className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-500" onChange={(event) => setScore(event.target.value)} value={score} />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Accion
          <select className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-500" onChange={(event) => setAction(event.target.value)} value={action}>
            {["Permitir", "Marcar asunto", "Mover a spam", "Rechazar", "Cuarentena"].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">
          Estado
          <select className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-500" onChange={(event) => setStatus(event.target.value)} value={status}>
            {["Activa", "Pausada", "Revision"].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
          La configuracion se envia al agente del nodo como accion Rspamd. El agente debe aplicar el cambio en su backend antispam.
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">Cancelar</Button>
          <Button disabled={isSaving} onClick={() => onSave({ action, score, status })} type="button">{isSaving ? "Guardando" : "Guardar"}</Button>
        </div>
      </div>
    </AdminModalFrame>
  )
}

function buildAntispamRules(data: { dnsRecords: HostingDnsRecord[]; domains: HostingDomain[]; mailboxes: HostingMailbox[]; nodes: AdminNode[]; queueRows: AdminMailQueueItem[] }): AntispamRuleRow[] {
  const inboundRows = data.queueRows.filter((row) => row.direction !== "Salida")
  const spamRows = inboundRows.filter((row) => row.status === "Spam")
  const rejectRows = inboundRows.filter((row) => row.status === "Rechazado")
  const dnsblRows = inboundRows.filter((row) => smtpBlacklistSignal(row) || antispamDnsblSignal(row))
  const spfRows = data.queueRows.filter((row) => antispamText(row).includes("spf"))
  const dkimRows = data.queueRows.filter((row) => antispamText(row).includes("dkim"))
  const dmarcRows = data.queueRows.filter((row) => antispamText(row).includes("dmarc"))
  const dangerousRows = inboundRows.filter((row) => ["virus", "malware", "phishing", "attachment", "adjunto", "executable"].some((token) => antispamText(row).includes(token)))
  const whitelistCount = data.mailboxes.filter((mailbox) => antispamSettingList(mailbox, "whitelist").length > 0).length
  const disabledMailboxes = data.mailboxes.filter((mailbox) => !mailbox.antispam_enabled)
  const missingSpf = data.domains.filter((domain) => !domainHasDnsRecord(domain, data.dnsRecords, "spf"))
  const missingDkim = data.domains.filter((domain) => !domainHasDnsRecord(domain, data.dnsRecords, "dkim"))
  const missingDmarc = data.domains.filter((domain) => !domainHasDnsRecord(domain, data.dnsRecords, "dmarc"))
  const dnsblLists = antispamDnsblLists(data.nodes)
  const rspamdEvents = [...spamRows, ...rejectRows].slice(0, 50)
  return [
    {
      action: "Mover a spam",
      details: [
        { label: "Nodos activos", value: `${data.nodes.filter((node) => antispamNodeHealthy(node)).length} de ${data.nodes.length}` },
        { label: "Eventos spam", value: String(spamRows.length) },
        { label: "Buzones con antispam", value: `${data.mailboxes.filter((mailbox) => mailbox.antispam_enabled).length} de ${data.mailboxes.length}` },
      ],
      events: rspamdEvents,
      hits: spamRows.length.toLocaleString(),
      hitsCount: spamRows.length,
      name: "Rspamd + Bayes",
      recommendation: disabledMailboxes.length ? `${disabledMailboxes.length} buzon(es) tienen antispam desactivado.` : "Mantener activo y revisar entrenamiento Bayes semanal.",
      score: "+6.4",
      status: data.nodes.some((node) => antispamNodeHealthy(node)) ? "Activa" : "Revision",
      type: "Rspamd",
    },
    {
      action: "Rechazar",
      details: [
        { label: "Listas DNSBL", value: dnsblLists.length ? dnsblLists.join(", ") : "No reportadas por agente" },
        { label: "Rechazos DNSBL/RBL", value: String(dnsblRows.length) },
        { label: "Senales blacklist salida", value: String(data.queueRows.filter((row) => smtpBlacklistSignal(row)).length) },
      ],
      events: dnsblRows,
      hits: dnsblRows.length.toLocaleString(),
      hitsCount: dnsblRows.length,
      name: "RBL / DNSBL",
      recommendation: dnsblRows.length ? "Revisar falsos positivos y reputacion de remitentes bloqueados." : "Sin bloqueos DNSBL recientes en cola.",
      score: "+8.0",
      status: dnsblRows.length || dnsblLists.length ? "Activa" : "Revision",
      type: "Lista negra",
    },
    {
      action: "Marcar asunto",
      details: [
        { label: "Dominios sin SPF", value: String(missingSpf.length) },
        { label: "Eventos SPF", value: String(spfRows.length) },
        { label: "Ejemplos", value: missingSpf.slice(0, 3).map((domain) => domain.domain).join(", ") || "N/D" },
      ],
      events: spfRows,
      hits: (spfRows.length + missingSpf.length).toLocaleString(),
      hitsCount: spfRows.length + missingSpf.length,
      name: "SPF fallido o ausente",
      recommendation: missingSpf.length ? "Aplicar plantilla DNS a dominios sin SPF para evitar rechazos." : "SPF correcto en dominios registrados.",
      score: "+4.2",
      status: missingSpf.length ? "Revision" : "Activa",
      type: "Autenticacion",
    },
    {
      action: "Marcar asunto",
      details: [
        { label: "Dominios sin DKIM", value: String(missingDkim.length) },
        { label: "Dominios sin DMARC", value: String(missingDmarc.length) },
        { label: "Eventos DKIM/DMARC", value: String(dkimRows.length + dmarcRows.length) },
      ],
      events: [...dkimRows, ...dmarcRows],
      hits: (dkimRows.length + dmarcRows.length + missingDkim.length + missingDmarc.length).toLocaleString(),
      hitsCount: dkimRows.length + dmarcRows.length + missingDkim.length + missingDmarc.length,
      name: "DKIM / DMARC",
      recommendation: missingDkim.length || missingDmarc.length ? "Completar DKIM y DMARC antes de aumentar volumen de salida." : "Autenticacion de dominio dentro de rango.",
      score: "+5.5",
      status: missingDkim.length || missingDmarc.length ? "Revision" : "Activa",
      type: "Autenticacion",
    },
    {
      action: "Cuarentena",
      details: [
        { label: "Adjuntos o malware", value: String(dangerousRows.length) },
        { label: "Nodos", value: data.nodes.map((node) => node.hostname).join(", ") || "N/D" },
        { label: "Cuarentena", value: antispamCapabilityEnabled(data.nodes, "quarantine") ? "Reportada" : "Sin dato del agente" },
      ],
      events: dangerousRows,
      hits: dangerousRows.length.toLocaleString(),
      hitsCount: dangerousRows.length,
      name: "Adjunto peligroso",
      recommendation: dangerousRows.length ? "Mantener cuarentena y analizar archivos con antivirus." : "Sin adjuntos peligrosos recientes.",
      score: "+10.0",
      status: "Activa",
      type: "Contenido",
    },
    {
      action: "Permitir",
      details: [
        { label: "Buzones con whitelist", value: String(whitelistCount) },
        { label: "Antispam desactivado", value: String(disabledMailboxes.length) },
        { label: "Auditoria", value: "Derivado de antispam_settings de buzones" },
      ],
      events: [],
      hits: whitelistCount.toLocaleString(),
      hitsCount: whitelistCount,
      name: "Lista blanca global",
      recommendation: whitelistCount ? "Auditar remitentes confiables y evitar dominios completos innecesarios." : "Sin whitelists registradas en buzones.",
      score: "-5.0",
      status: disabledMailboxes.length ? "Revision" : "Activa",
      type: "Whitelist",
    },
  ]
}

function antispamText(row: AdminMailQueueItem) {
  return `${row.code} ${row.status} ${row.explanation} ${row.raw ? JSON.stringify(row.raw) : ""}`.toLowerCase()
}

function antispamRejectSignal(row: AdminMailQueueItem) {
  const text = antispamText(row)
  return row.status === "Rechazado" && ["spam", "rbl", "dnsbl", "blacklist", "spf", "dkim", "dmarc", "policy"].some((token) => text.includes(token))
}

function antispamFalsePositiveSignal(row: AdminMailQueueItem) {
  const text = antispamText(row)
  return ["false positive", "falso positivo", "released", "liberado", "whitelist"].some((token) => text.includes(token))
}

function antispamDnsblSignal(row: AdminMailQueueItem) {
  const text = antispamText(row)
  return ["dnsbl", "rbl", "zen.spamhaus", "sbl", "xbl", "pbl", "barracuda", "spamcop"].some((token) => text.includes(token))
}

function antispamSettingList(mailbox: HostingMailbox, key: string) {
  const value = mailbox.antispam_settings?.[key]
  if (Array.isArray(value)) return value
  if (typeof value === "string" && value.trim()) return [value]
  return []
}

function domainHasDnsRecord(domain: HostingDomain, records: HostingDnsRecord[], kind: "spf" | "dkim" | "dmarc") {
  const domainRecords = records.filter((record) => record.domain === domain.id || record.domain_name === domain.domain)
  if (kind === "spf") return domainRecords.some((record) => record.type === "TXT" && record.content.toLowerCase().includes("v=spf1"))
  if (kind === "dkim") return domainRecords.some((record) => record.type === "TXT" && (record.name.toLowerCase().includes("_domainkey") || record.content.toLowerCase().includes("dkim")))
  return domainRecords.some((record) => record.type === "TXT" && (record.name.toLowerCase().includes("_dmarc") || record.content.toLowerCase().includes("dmarc")))
}

function antispamNodeHealthy(node: AdminNode) {
  const text = `${JSON.stringify(node.capabilities || {})} ${JSON.stringify(node.last_telemetry || {})}`.toLowerCase()
  return text.includes("rspamd") || text.includes("spamassassin") || text.includes("antispam")
}

function antispamCapabilityEnabled(nodes: AdminNode[], key: string) {
  return nodes.some((node) => `${JSON.stringify(node.capabilities || {})} ${JSON.stringify(node.last_telemetry || {})}`.toLowerCase().includes(key))
}

function antispamDnsblLists(nodes: AdminNode[]) {
  const values = new Set<string>()
  nodes.forEach((node) => {
    collectAntispamStringList(node.capabilities, values)
    collectAntispamStringList(node.last_telemetry, values)
  })
  return Array.from(values).filter((item) => ["rbl", "dnsbl", "spamhaus", "barracuda", "spamcop", "sorbs", "uribl"].some((token) => item.toLowerCase().includes(token))).slice(0, 12)
}

function collectAntispamStringList(value: unknown, target: Set<string>) {
  if (!value) return
  if (Array.isArray(value)) {
    value.forEach((item) => collectAntispamStringList(item, target))
    return
  }
  if (typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (["rbl", "dnsbl", "blacklist", "lists", "rspamd"].some((token) => key.toLowerCase().includes(token))) collectAntispamStringList(item, target)
    })
    return
  }
  if (typeof value === "string" && value.trim()) target.add(value.trim())
}

function AntispamTypeBadge({ type }: { type: string }) {
  const tone =
    type === "Rspamd"
      ? "bg-blue-50 text-blue-700"
      : type === "Lista negra"
        ? "bg-red-50 text-red-700"
        : type === "Whitelist"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-700"

  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{type}</span>
}

function AdminBackupPoliciesPage() {
  const [policies, setPolicies] = useState<BackupPolicy[]>([])
  const [storages, setStorages] = useState<BackupStorageDestination[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [selected, setSelected] = useState<BackupPolicy | null>(null)
  const [editing, setEditing] = useState<BackupPolicy | null>(null)
  const [duplicate, setDuplicate] = useState<BackupPolicy | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [message, setMessage] = useState("")

  const load = () => {
    Promise.all([hostingApi.backupPolicies(), hostingApi.backupStorage()])
      .then(([policyPage, storagePage]) => { setPolicies(policyPage.results); setStorages(storagePage.results) })
      .catch((error: Error) => setMessage(error.message || "No se pudieron cargar politicas."))
  }
  useEffect(() => { load() }, [])
  const rows = policies.filter((item) => backupMatches([item.name, item.frequency, item.includes_label, item.storage_name || ""], query, statusFilter, typeFilter, item.status, item.policy_type))
  const savePolicy = async (payload: BackupPolicyPayload, id?: number) => {
    try {
      if (id) await hostingApi.updateBackupPolicy(id, payload)
      else await hostingApi.createBackupPolicy(payload)
      setShowCreate(false); setEditing(null); load()
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar la politica.") }
  }

  return (
    <div className="space-y-4">
      {message ? <BackupMessage message={message} /> : null}
      <AdminBackupHeader description="Reglas base para copias de seguridad: que se copia, frecuencia, retencion y almacenamiento por defecto." onAction={() => setShowCreate(true)} title="Politicas globales" />
      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Politicas" value={String(policies.length)} detail={`${policies.filter((item) => item.status === "active").length} activas`} />
        <AdminMetric label="Cobertura" value={policies.length ? "Config." : "N/D"} detail="Segun politicas activas" />
        <AdminMetric label="Retencion mayor" value={`${Math.max(0, ...policies.map((item) => item.retention_days))} dias`} detail="Maximo configurado" />
        <AdminMetric label="Ultima ejecucion" value="Historial" detail="Desde backups reales" />
      </section>
      <BackupFilters actionFilter={typeFilter} actionLabel="Tipo" onActionChange={setTypeFilter} onExport={() => exportBackupCsv("politicas-backup", rows)} onQueryChange={setQuery} onStatusChange={setStatusFilter} query={query} search="Buscar politica, frecuencia o almacenamiento..." status={statusFilter} />
      <BackupTable columns={["Politica", "Tipo", "Frecuencia", "Incluye", "Almacenamiento", "Retencion", "Estado", "Acciones"]}>
        {rows.map((item) => (
          <tr className="hover:bg-slate-50" key={item.id}>
            <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
            <td className="px-4 py-3">{backupPolicyTypeLabel(item.policy_type)}</td>
            <td className="px-4 py-3">{backupFrequencyLabel(item.frequency)}</td>
            <td className="px-4 py-3">{item.includes_label}</td>
            <td className="px-4 py-3">{item.storage_name || "N/D"}</td>
            <td className="px-4 py-3">{item.retention_label}</td>
            <td className="px-4 py-3"><BackupStatusBadge status={backupStatusLabel(item.status)} /></td>
            <td className="px-4 py-3"><BackupActions labels={["Ver", "Editar", "Duplicar"]} onClick={(label) => label === "Ver" ? setSelected(item) : label === "Editar" ? setEditing(item) : setDuplicate(item)} /></td>
          </tr>
        ))}
      </BackupTable>
      {selected ? <BackupPolicyDetailModal onClose={() => setSelected(null)} policy={selected} /> : null}
      {(showCreate || editing) ? <BackupPolicyModal onClose={() => { setShowCreate(false); setEditing(null) }} onSave={savePolicy} policy={editing} storages={storages} /> : null}
      {duplicate ? <BackupDuplicateModal itemName={duplicate.name} onClose={() => setDuplicate(null)} onSave={async (name) => { await hostingApi.duplicateBackupPolicy(duplicate.id, name); setDuplicate(null); load() }} /> : null}
    </div>
  )
}

function AdminClientBackupsPage() { return <AccountBackupsPage mode="client" /> }
function AdminResellerBackupsPage() { return <AccountBackupsPage mode="reseller" /> }

function AccountBackupsPage({ mode }: { mode: "client" | "reseller" }) {
  const [exports, setExports] = useState<HostingAccountExport[]>([])
  const [accounts, setAccounts] = useState<HostingAccount[]>([])
  const [resellers, setResellers] = useState<HostingReseller[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [selected, setSelected] = useState<HostingAccountExport | null>(null)
  const [restore, setRestore] = useState<HostingAccountExport | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [message, setMessage] = useState("")
  const load = () => Promise.all([hostingApi.accountExports(), hostingApi.accounts(), hostingApi.resellers()])
    .then(([exportPage, accountPage, resellerPage]) => { setExports(exportPage.results); setAccounts(accountPage.results); setResellers(resellerPage.results) })
    .catch((error: Error) => setMessage(error.message || "No se pudieron cargar backups."))
  useEffect(() => { load() }, [])
  const resellerAccountIds = new Set(accounts.filter((account) => account.reseller).map((account) => account.id))
  const scoped = exports.filter((item) => mode === "reseller" ? resellerAccountIds.has(item.account) : !resellerAccountIds.has(item.account))
  const rows = scoped.filter((item) => backupMatches([item.account_domain, item.account_username, item.node_hostname || "", item.export_type], query, statusFilter, typeFilter, item.status, item.export_type))
  const completed = scoped.filter((item) => item.status === "completed").length
  return (
    <div className="space-y-4">
      {message ? <BackupMessage message={message} /> : null}
      <AdminBackupHeader description={mode === "client" ? "Historial y control de copias por cuenta cliente, incluyendo ubicacion, tipo, tamano y estado de ejecucion." : "Copias agrupadas por revendedor para proteger sus cuentas, configuracion comercial y datos operativos."} onAction={() => setShowCreate(true)} title={mode === "client" ? "Backups por cliente" : "Backups por revendedor"} />
      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label={mode === "client" ? "Backups cliente" : "Backups reseller"} value={String(scoped.length)} detail="Historial real" />
        <AdminMetric label="Completados" value={scoped.length ? `${Math.round((completed / scoped.length) * 100)}%` : "0%"} detail={`${completed} completados`} />
        <AdminMetric label="En progreso" value={String(scoped.filter((item) => ["queued", "running"].includes(item.status)).length)} detail="Ahora mismo" />
        <AdminMetric label="Espacio usado" value={formatBytes(scoped.reduce((total, item) => total + item.size_bytes, 0))} detail="Backups registrados" />
      </section>
      <BackupFilters actionFilter={typeFilter} actionLabel="Tipo" onActionChange={setTypeFilter} onExport={() => exportBackupCsv(`backups-${mode}`, rows)} onQueryChange={setQuery} onStatusChange={setStatusFilter} query={query} search="Buscar cuenta, nodo, tipo o destino..." status={statusFilter} />
      <BackupTable columns={mode === "client" ? ["Cuenta", "Nodo", "Tipo", "Alojado en", "Fecha", "Tamano", "Estado", "Acciones"] : ["Revendedor", "Cuentas", "Tipo", "Alojado en", "Fecha", "Tamano", "Estado", "Acciones"]}>
        {rows.map((item) => {
          const account = accounts.find((entry) => entry.id === item.account)
          const reseller = resellers.find((entry) => entry.user_id === account?.reseller)
          return (
            <tr className="hover:bg-slate-50" key={item.id}>
              <td className="px-4 py-3 font-semibold text-slate-900">{mode === "client" ? item.account_domain : reseller?.company_name || item.account_username}</td>
              <td className="px-4 py-3">{mode === "client" ? item.node_hostname || "N/D" : `${reseller?.accounts_count || 1} cuenta(s)`}</td>
              <td className="px-4 py-3">{backupExportTypeLabel(item)}</td>
              <td className="px-4 py-3">{backupExportStorageLabel(item)}</td>
              <td className="px-4 py-3">{formatDateTime(item.created_at)}</td>
              <td className="px-4 py-3">{formatBytes(item.size_bytes)}</td>
              <td className="px-4 py-3"><BackupStatusBadge status={backupStatusLabel(item.status)} /></td>
              <td className="px-4 py-3"><BackupActions labels={mode === "client" ? ["Ver", "Restaurar", "Descargar"] : ["Ver", "Restaurar", "Politica"]} onClick={async (label) => { if (label === "Ver") setSelected(item); if (label === "Restaurar") setRestore(item); if (label === "Descargar") await downloadBackupExport(item, setMessage); if (label === "Politica") setShowCreate(true) }} /></td>
            </tr>
          )
        })}
      </BackupTable>
      {showCreate ? <BackupExportModal accounts={accounts.filter((account) => mode === "reseller" ? Boolean(account.reseller) : !account.reseller)} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} /> : null}
      {selected ? <BackupExportDetailModal backup={selected} onClose={() => setSelected(null)} /> : null}
      {restore ? <BackupRestoreModal accounts={accounts} backup={restore} onClose={() => setRestore(null)} onSaved={() => { setRestore(null); load() }} /> : null}
    </div>
  )
}

function AdminBackupStoragePage() {
  const [storages, setStorages] = useState<BackupStorageDestination[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [selected, setSelected] = useState<BackupStorageDestination | null>(null)
  const [editing, setEditing] = useState<BackupStorageDestination | null>(null)
  const [showCreateStorage, setShowCreateStorage] = useState(false)
  const [message, setMessage] = useState("")
  const load = () => hostingApi.backupStorage().then((page) => setStorages(page.results)).catch((error: Error) => setMessage(error.message || "No se pudieron cargar destinos."))
  useEffect(() => { load() }, [])
  const rows = storages.filter((item) => backupMatches([item.name, item.endpoint, item.bucket, item.path, item.storage_type], query, statusFilter, typeFilter, item.status, item.storage_type))
  return (
    <div className="space-y-4">
      {message ? <BackupMessage message={message} /> : null}
      <AdminBackupHeader description="Destinos disponibles para alojar backups: local, EHPanel Drive, S3 compatible o FTP externo." onAction={() => setShowCreateStorage(true)} title="Almacenamientos" />
      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Destinos" value={String(storages.length)} detail="Configurados" />
        <AdminMetric label="Capacidad total" value={`${storages.reduce((total, item) => total + item.capacity_gb, 0).toLocaleString()} GB`} detail="Declarada" />
        <AdminMetric label="Uso actual" value={formatBytes(storages.reduce((total, item) => total + item.used_bytes, 0))} detail="Reportado" />
        <AdminMetric label="Externos" value={String(storages.filter((item) => ["s3", "ftp"].includes(item.storage_type)).length)} detail="S3 y FTP" />
      </section>
      <BackupFilters actionFilter={typeFilter} actionLabel="Tipo" onActionChange={setTypeFilter} onExport={() => exportBackupCsv("almacenamientos-backup", rows)} onQueryChange={setQuery} onStatusChange={setStatusFilter} query={query} search="Buscar almacenamiento, tipo o ubicacion..." status={statusFilter} />
      <BackupTable columns={["Nombre", "Tipo", "Ubicacion", "Capacidad usada", "Estado", "Acciones"]}>
        {rows.map((item) => (
          <tr className="hover:bg-slate-50" key={item.id}>
            <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
            <td className="px-4 py-3">{backupStorageTypeLabel(item.storage_type)}</td>
            <td className="px-4 py-3">{item.endpoint || item.bucket || item.path || "N/D"}</td>
            <td className="px-4 py-3">{formatBytes(item.used_bytes)} / {item.capacity_gb ? `${item.capacity_gb} GB` : "Sin limite"}</td>
            <td className="px-4 py-3"><BackupStatusBadge status={backupStatusLabel(item.status)} /></td>
            <td className="px-4 py-3"><BackupActions labels={["Ver", "Editar", "Probar"]} onClick={async (label) => { if (label === "Ver") setSelected(item); if (label === "Editar") setEditing(item); if (label === "Probar") { await hostingApi.testBackupStorage(item.id); load() } }} /></td>
          </tr>
        ))}
      </BackupTable>
      {(showCreateStorage || editing) ? <CreateBackupStorageModal onClose={() => { setShowCreateStorage(false); setEditing(null) }} onSaved={load} storage={editing} /> : null}
      {selected ? <BackupStorageDetailModal onClose={() => setSelected(null)} storage={selected} /> : null}
    </div>
  )
}

function AdminBackupRestoresPage() {
  const [restores, setRestores] = useState<BackupRestoreRun[]>([])
  const [accounts, setAccounts] = useState<HostingAccount[]>([])
  const [exports, setExports] = useState<HostingAccountExport[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [selected, setSelected] = useState<BackupRestoreRun | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [message, setMessage] = useState("")
  const load = () => Promise.all([hostingApi.backupRestores(), hostingApi.accounts(), hostingApi.accountExports()]).then(([restorePage, accountPage, exportPage]) => { setRestores(restorePage.results); setAccounts(accountPage.results); setExports(exportPage.results) }).catch((error: Error) => setMessage(error.message || "No se pudieron cargar restauraciones."))
  useEffect(() => { load() }, [])
  const rows = restores.filter((item) => backupMatches([item.accounts_detail.map((account) => account.domain).join(" "), item.destination_node_hostname || "", item.notes], query, statusFilter, typeFilter, item.status, item.restore_type))
  return (
    <div className="space-y-4">
      {message ? <BackupMessage message={message} /> : null}
      <AdminBackupHeader description="Historial de restauraciones pasadas y actuales, con cuenta, backup usado, destino, operador y estado." onAction={() => setShowCreate(true)} title="Restauraciones" />
      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Restauraciones" value={String(restores.length)} detail="Ultimos eventos" />
        <AdminMetric label="Completadas" value={String(restores.filter((item) => item.status === "completed").length)} detail="Sin incidencias" />
        <AdminMetric label="En progreso" value={String(restores.filter((item) => ["queued", "running"].includes(item.status)).length)} detail="Actualmente" />
        <AdminMetric label="Fallidas" value={String(restores.filter((item) => item.status === "failed").length)} detail="Requiere revision" />
      </section>
      <BackupFilters actionFilter={typeFilter} actionLabel="Tipo" onActionChange={setTypeFilter} onExport={() => exportBackupCsv("restauraciones", rows)} onQueryChange={setQuery} onStatusChange={setStatusFilter} query={query} search="Buscar cuenta, backup, operador o estado..." status={statusFilter} />
      <BackupTable columns={["Cuenta", "Backup usado", "Destino", "Fecha", "Operador", "Estado", "Acciones"]}>
        {rows.map((item) => (
          <tr className="hover:bg-slate-50" key={item.id}>
            <td className="px-4 py-3 font-semibold text-slate-900">{item.accounts_detail.map((account) => account.domain).join(", ") || "N/D"}</td>
            <td className="px-4 py-3">{item.backup_label || item.backup || "Backup manual"}</td>
            <td className="px-4 py-3">{item.destination_node_hostname || item.accounts_detail[0]?.node || "N/D"}</td>
            <td className="px-4 py-3">{formatDateTime(item.created_at)}</td>
            <td className="px-4 py-3">{item.operator || "N/D"}</td>
            <td className="px-4 py-3"><BackupStatusBadge status={backupStatusLabel(item.status)} /></td>
            <td className="px-4 py-3"><BackupActions labels={["Ver", "Log", "Reintentar"]} onClick={async (label) => { if (label === "Ver" || label === "Log") setSelected(item); if (label === "Reintentar") { await hostingApi.retryBackupRestore(item.id); load() } }} /></td>
          </tr>
        ))}
      </BackupTable>
      {showCreate ? <BackupRestoreModal accounts={accounts} backups={exports} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} /> : null}
      {selected ? <BackupRestoreDetailModal onClose={() => setSelected(null)} restore={selected} /> : null}
    </div>
  )
}

function AdminBackupHeader({ description, onAction, title }: { description: string; onAction?: () => void; title: string }) {
  return (
    <section className="eh-card px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700"><DatabaseBackup className="h-5 w-5" /></div>
          <div><div className="eh-kicker">Backups</div><h1 className="mt-1 text-xl font-bold tracking-tight">{title}</h1><p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p></div>
        </div>
        <Button onClick={onAction} size="sm">{title === "Almacenamientos" ? "Nuevo destino" : title === "Restauraciones" ? "Nueva restauracion" : "Nueva politica"}</Button>
      </div>
    </section>
  )
}

function BackupTable({ children, columns }: { children: ReactNode; columns: string[] }) {
  return <div className="eh-card overflow-hidden"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{columns.map((column) => <th className="px-4 py-2 font-bold" key={column}>{column}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{children}</tbody></table></div>
}

function AdminSimpleTable({ columns, rows, search }: { columns: string[]; rows: Array<Array<ReactNode>>; search: string }) {
  return (
    <div className="eh-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex h-9 w-[420px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
          <Search className="h-4 w-4" />
          {search}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline">Estado</Button>
          <Button size="sm" variant="outline">Tipo</Button>
          <Button size="sm" variant="outline">Exportar</Button>
        </div>
      </div>
      <table className="w-full min-w-[1120px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>{columns.map((column) => <th className="px-4 py-2 font-bold" key={column}>{column}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, rowIndex) => (
            <tr className="hover:bg-slate-50" key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td className={cn("px-4 py-3", cellIndex === 0 && "font-semibold text-slate-900")} key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        <span>Mostrando 1-{rows.length} de {rows.length} registros</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline">Anterior</Button>
          <span className="font-semibold text-slate-800">Pagina 1</span>
          <Button size="sm" variant="outline">Siguiente</Button>
        </div>
      </div>
    </div>
  )
}

function BackupActions({ labels, onClick }: { labels: string[]; onClick?: (label: string) => void }) {
  return <div className="flex justify-end gap-1">{labels.map((label) => <Button key={label} onClick={() => onClick?.(label)} size="sm" variant="outline">{label}</Button>)}</div>
}

function BackupMessage({ message }: { message: string }) {
  return <div className={cn("rounded-lg border px-4 py-3 text-sm font-semibold", message.includes("No se") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>{message}</div>
}

function BackupFilters({ actionFilter, actionLabel, onActionChange, onExport, onQueryChange, onStatusChange, query, search, status }: { actionFilter: string; actionLabel: string; onActionChange: (value: string) => void; onExport: () => void; onQueryChange: (value: string) => void; onStatusChange: (value: string) => void; query: string; search: string; status: string }) {
  return (
    <div className="eh-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex h-9 w-[420px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
        <Search className="h-4 w-4" />
        <input className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => onQueryChange(event.target.value)} placeholder={search} value={query} />
      </div>
      <div className="flex gap-2">
        <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => onStatusChange(event.target.value)} value={status}>
          <option value="">Estado</option><option value="active">Activa</option><option value="paused">Pausada</option><option value="queued">Programado</option><option value="running">En progreso</option><option value="completed">Completado</option><option value="failed">Fallido</option>
        </select>
        <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => onActionChange(event.target.value)} value={actionFilter}>
          <option value="">{actionLabel}</option><option value="full">Completo</option><option value="incremental">Incremental</option><option value="partial">Parcial</option><option value="realtime">Tiempo real</option><option value="s3">S3</option><option value="ftp">FTP</option><option value="local">Local</option>
        </select>
        <Button onClick={onExport} size="sm" variant="outline">Exportar</Button>
      </div>
    </div>
  )
}

function BackupInput({ label, onChange, type = "text", value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return <label className="block text-sm font-bold text-slate-700">{label}<input className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-500" onChange={(event) => onChange(event.target.value)} type={type} value={value} /></label>
}

function backupMatches(values: string[], query: string, statusFilter: string, typeFilter: string, status: string, type: string) {
  const haystack = values.join(" ").toLowerCase()
  return (!query.trim() || haystack.includes(query.trim().toLowerCase())) && (!statusFilter || status === statusFilter) && (!typeFilter || type === typeFilter)
}

function backupStatusLabel(status: string) {
  return ({ active: "Activa", paused: "Pausada", queued: "Programado", running: "En progreso", completed: "Completado", failed: "Fallido", testing: "En revision" } as Record<string, string>)[status] || status
}

function backupPolicyTypeLabel(type: string) {
  return ({ full: "Completo", incremental: "Incremental", partial: "Parcial", realtime: "Tiempo real" } as Record<string, string>)[type] || type
}

function backupStorageTypeLabel(type: string) {
  return ({ local: "Local", s3: "S3 compatible", ftp: "FTP externo", ehpanel_drive: "EHPanel Drive" } as Record<string, string>)[type] || type
}

function backupFrequencyLabel(value: string) {
  return ({ manual: "Manual", daily_02: "Diario 02:00", weekly_sun_03: "Domingo 03:00", every_6h: "Cada 6 horas", realtime: "Tiempo real" } as Record<string, string>)[value] || value
}

function backupExportTypeLabel(item: HostingAccountExport) {
  if (item.export_type === "full") return "Completo"
  if (item.export_type === "mail_only") return "Solo correo"
  return "Archivos + BD"
}

function backupExportStorageLabel(item: HostingAccountExport) {
  const destination = item.result?.destination || item.result?.storage || item.archive_path
  return typeof destination === "string" && destination ? destination : "Nodo / pendiente"
}

function backupIncludeLabel(key: string) {
  return ({ full_account: "Cuenta completa", include_files: "Archivos", include_databases: "Bases de datos", include_mail: "Correo", include_config: "Configuracion", include_subdomains: "Subdominios" } as Record<string, string>)[key] || key
}

async function downloadBackupExport(item: HostingAccountExport, setMessage: (message: string) => void) {
  try {
    const result = await hostingApi.downloadAccountExport(item.id)
    const url = URL.createObjectURL(result.blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = result.filename
    anchor.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "No se pudo descargar el backup.")
  }
}

function exportBackupCsv(name: string, rows: unknown[]) {
  const csv = rows.map((row) => JSON.stringify(row)).join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${name}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

function BackupPolicyModal({ onClose, onSave, policy, storages }: { onClose: () => void; onSave: (payload: BackupPolicyPayload, id?: number) => void; policy?: BackupPolicy | null; storages: BackupStorageDestination[] }) {
  const [form, setForm] = useState<BackupPolicyPayload>({ frequency: policy?.frequency || "daily_02", full_account: policy?.full_account ?? true, include_config: policy?.include_config ?? true, include_databases: policy?.include_databases ?? true, include_files: policy?.include_files ?? true, include_mail: policy?.include_mail ?? true, name: policy?.name || "", notes: policy?.notes || "", policy_type: policy?.policy_type || "incremental", retention_copies: policy?.retention_copies || 14, retention_days: policy?.retention_days || 30, status: policy?.status || "active", storage: policy?.storage || storages[0]?.id || null })
  return <AdminModalFrame kicker="Politica backup" onClose={onClose} title={policy ? "Editar politica" : "Nueva politica"}><div className="grid gap-4 md:grid-cols-2"><BackupInput label="Nombre" onChange={(value) => setForm({ ...form, name: value })} value={form.name} /><label className="text-sm font-bold text-slate-700">Tipo<select className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" onChange={(event) => setForm({ ...form, policy_type: event.target.value as BackupPolicy["policy_type"] })} value={form.policy_type}><option value="full">Completo</option><option value="incremental">Incremental</option><option value="partial">Parcial</option><option value="realtime">Tiempo real</option></select></label><label className="text-sm font-bold text-slate-700">Frecuencia<select className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" onChange={(event) => setForm({ ...form, frequency: event.target.value })} value={form.frequency}><option value="manual">Manual</option><option value="daily_02">Diario 02:00</option><option value="weekly_sun_03">Domingo 03:00</option><option value="every_6h">Cada 6 horas</option><option value="realtime">Tiempo real</option></select></label><label className="text-sm font-bold text-slate-700">Almacenamiento<select className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" onChange={(event) => setForm({ ...form, storage: event.target.value ? Number(event.target.value) : null })} value={form.storage || ""}><option value="">Sin destino</option>{storages.map((storage) => <option key={storage.id} value={storage.id}>{storage.name}</option>)}</select></label><BackupInput label="Retencion dias" onChange={(value) => setForm({ ...form, retention_days: Number(value) })} type="number" value={String(form.retention_days)} /><BackupInput label="Copias" onChange={(value) => setForm({ ...form, retention_copies: Number(value) })} type="number" value={String(form.retention_copies)} /><label className="text-sm font-bold text-slate-700">Estado<select className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" onChange={(event) => setForm({ ...form, status: event.target.value as BackupPolicy["status"] })} value={form.status}><option value="active">Activa</option><option value="paused">Pausada</option></select></label><div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">{(["full_account", "include_files", "include_databases", "include_mail", "include_config"] as const).map((key) => <label className="flex items-center gap-2" key={key}><input checked={Boolean(form[key])} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} type="checkbox" />{backupIncludeLabel(key)}</label>)}</div></div><div className="mt-5 flex justify-end gap-2"><Button onClick={onClose} variant="outline">Cancelar</Button><Button onClick={() => onSave(form, policy?.id)}>Guardar</Button></div></AdminModalFrame>
}

function BackupDuplicateModal({ itemName, onClose, onSave }: { itemName: string; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(`${itemName} copia`)
  return <AdminModalFrame kicker="Duplicar" onClose={onClose} title="Duplicar politica"><BackupInput label="Nuevo nombre" onChange={setName} value={name} /><div className="mt-5 flex justify-end gap-2"><Button onClick={onClose} variant="outline">Cancelar</Button><Button onClick={() => onSave(name)}>Duplicar</Button></div></AdminModalFrame>
}

function BackupPolicyDetailModal({ onClose, policy }: { onClose: () => void; policy: BackupPolicy }) {
  return <AdminModalFrame kicker="Politica backup" onClose={onClose} title={policy.name}><div className="grid gap-3 md:grid-cols-2"><AdminStatus label="Tipo" value={backupPolicyTypeLabel(policy.policy_type)} /><AdminStatus label="Frecuencia" value={backupFrequencyLabel(policy.frequency)} /><AdminStatus label="Incluye" value={policy.includes_label} /><AdminStatus label="Almacenamiento" value={policy.storage_name || "N/D"} /><AdminStatus label="Retencion" value={policy.retention_label} /><AdminStatus label="Estado" value={backupStatusLabel(policy.status)} /></div><p className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Las ultimas y proximas copias se derivan del historial real de backups por cuenta cuando el agente las registre.</p></AdminModalFrame>
}

function BackupExportModal({ accounts, onClose, onSaved }: { accounts: HostingAccount[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CreateHostingAccountExportPayload>({ account: accounts[0]?.id || "", export_type: "full", include_databases: true, include_files: true, include_mail: true, include_subdomains: true, notes: "" })
  return <AdminModalFrame kicker="Backup cuenta" onClose={onClose} title="Nueva copia de seguridad"><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-bold text-slate-700">Cuenta<select className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" onChange={(event) => setForm({ ...form, account: event.target.value })} value={form.account}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.primary_domain}</option>)}</select></label><label className="text-sm font-bold text-slate-700">Tipo<select className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" onChange={(event) => setForm({ ...form, export_type: event.target.value as CreateHostingAccountExportPayload["export_type"] })} value={form.export_type}><option value="full">Completo</option><option value="files_databases">Archivos + BD</option><option value="mail_only">Solo correo</option></select></label>{(["include_files", "include_databases", "include_mail", "include_subdomains"] as const).map((key) => <label className="flex items-center gap-2 text-sm font-semibold text-slate-700" key={key}><input checked={Boolean(form[key])} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} type="checkbox" />{backupIncludeLabel(key)}</label>)}</div><div className="mt-5 flex justify-end gap-2"><Button onClick={onClose} variant="outline">Cancelar</Button><Button onClick={async () => { await hostingApi.createAccountExport(form); onSaved() }}>Crear backup</Button></div></AdminModalFrame>
}

function BackupExportDetailModal({ backup, onClose }: { backup: HostingAccountExport; onClose: () => void }) {
  return <AdminModalFrame kicker="Backup" onClose={onClose} title={backup.account_domain}><div className="grid gap-3 md:grid-cols-2"><AdminStatus label="Estado" value={backupStatusLabel(backup.status)} /><AdminStatus label="Tipo" value={backupExportTypeLabel(backup)} /><AdminStatus label="Nodo" value={backup.node_hostname || "N/D"} /><AdminStatus label="Tamano" value={formatBytes(backup.size_bytes)} /><AdminStatus label="Archivo" value={backup.filename || "Pendiente"} /><AdminStatus label="Creado" value={formatDateTime(backup.created_at)} /></div>{backup.error_detail ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{backup.error_detail}</p> : null}</AdminModalFrame>
}

function BackupRestoreModal({ accounts, backup, backups, onClose, onSaved }: { accounts: HostingAccount[]; backup?: HostingAccountExport | null; backups?: HostingAccountExport[]; onClose: () => void; onSaved: () => void }) {
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(backup ? [backup.account] : accounts.slice(0, 1).map((account) => account.id))
  const [backupId, setBackupId] = useState<number | null>(backup?.id || backups?.[0]?.id || null)
  const [restoreType, setRestoreType] = useState("full")
  const payload = (): BackupRestoreRunPayload => ({ account_ids: selectedAccounts, backup: backupId, destination_node: null, include_databases: true, include_files: true, include_mail: true, notes: "", restore_type: restoreType })
  return <AdminModalFrame kicker="Restauracion" onClose={onClose} title="Nueva restauracion"><div className="space-y-4"><label className="text-sm font-bold text-slate-700">Backup<select className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" onChange={(event) => setBackupId(event.target.value ? Number(event.target.value) : null)} value={backupId || ""}>{backup ? <option value={backup.id}>{backup.account_domain} - {formatDateTime(backup.created_at)}</option> : backups?.map((item) => <option key={item.id} value={item.id}>{item.account_domain} - {formatDateTime(item.created_at)}</option>)}</select></label><label className="text-sm font-bold text-slate-700">Cuentas<select className="mt-1 h-32 w-full rounded-md border border-slate-200 px-3" multiple onChange={(event) => setSelectedAccounts(Array.from(event.target.selectedOptions).map((option) => option.value))} value={selectedAccounts}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.primary_domain}</option>)}</select></label><label className="text-sm font-bold text-slate-700">Tipo<select className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" onChange={(event) => setRestoreType(event.target.value)} value={restoreType}><option value="full">Completo</option><option value="files_databases">Archivos + BD</option><option value="mail_only">Solo correo</option></select></label></div><div className="mt-5 flex justify-end gap-2"><Button onClick={onClose} variant="outline">Cancelar</Button><Button onClick={async () => { await hostingApi.createBackupRestore(payload()); onSaved() }}>Solicitar restauracion</Button></div></AdminModalFrame>
}

function BackupRestoreDetailModal({ onClose, restore }: { onClose: () => void; restore: BackupRestoreRun }) {
  return <AdminModalFrame kicker="Restauracion" onClose={onClose} title={`Restauracion #${restore.id}`}><div className="grid gap-3 md:grid-cols-2"><AdminStatus label="Estado" value={backupStatusLabel(restore.status)} /><AdminStatus label="Cuentas" value={restore.accounts_detail.map((account) => account.domain).join(", ") || "N/D"} /><AdminStatus label="Destino" value={restore.destination_node_hostname || "N/D"} /><AdminStatus label="Job" value={restore.job_status || "N/D"} /><AdminStatus label="Operador" value={restore.operator || "N/D"} /><AdminStatus label="Creada" value={formatDateTime(restore.created_at)} /></div><pre className="mt-4 max-h-60 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(restore.result || { error: restore.error_detail || "Sin log reportado" }, null, 2)}</pre></AdminModalFrame>
}

function BackupStorageDetailModal({ onClose, storage }: { onClose: () => void; storage: BackupStorageDestination }) {
  return <AdminModalFrame kicker="Almacenamiento" onClose={onClose} title={storage.name}><div className="grid gap-3 md:grid-cols-2"><AdminStatus label="Tipo" value={backupStorageTypeLabel(storage.storage_type)} /><AdminStatus label="Estado" value={backupStatusLabel(storage.status)} /><AdminStatus label="Endpoint" value={storage.endpoint || storage.path || "N/D"} /><AdminStatus label="Bucket" value={storage.bucket || "N/D"} /><AdminStatus label="Uso" value={formatBytes(storage.used_bytes)} /><AdminStatus label="Ultima prueba" value={storage.last_test_at ? formatDateTime(storage.last_test_at) : "Sin probar"} /></div><pre className="mt-4 max-h-48 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(storage.last_test_result || {}, null, 2)}</pre></AdminModalFrame>
}

function CreateBackupStorageModal({ onClose, onSaved, storage }: { onClose: () => void; onSaved: () => void; storage?: BackupStorageDestination | null }) {
  const [form, setForm] = useState<BackupStorageDestinationPayload>({ bucket: storage?.bucket || "", capacity_gb: storage?.capacity_gb || 0, config: storage?.config || {}, endpoint: storage?.endpoint || "", name: storage?.name || "", path: storage?.path || "", status: storage?.status || "active", storage_type: storage?.storage_type || "s3", username: storage?.username || "" })
  return <AdminModalFrame kicker="Almacenamiento" onClose={onClose} title={storage ? "Editar destino" : "Nuevo destino"}><div className="grid gap-4 md:grid-cols-2"><BackupInput label="Nombre" onChange={(value) => setForm({ ...form, name: value })} value={form.name} /><label className="text-sm font-bold text-slate-700">Tipo<select className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" onChange={(event) => setForm({ ...form, storage_type: event.target.value as BackupStorageDestination["storage_type"] })} value={form.storage_type}><option value="s3">S3 compatible</option><option value="ftp">FTP externo</option><option value="local">Local</option><option value="ehpanel_drive">EHPanel Drive</option></select></label><BackupInput label="Endpoint / host" onChange={(value) => setForm({ ...form, endpoint: value })} value={form.endpoint || ""} /><BackupInput label="Bucket / ruta" onChange={(value) => setForm({ ...form, bucket: value, path: value })} value={form.bucket || form.path || ""} /><BackupInput label="Usuario / access key" onChange={(value) => setForm({ ...form, username: value })} value={form.username || ""} /><BackupInput label="Secret / password" onChange={(value) => setForm({ ...form, secret: value })} type="password" value={form.secret || ""} /><BackupInput label="Capacidad GB" onChange={(value) => setForm({ ...form, capacity_gb: Number(value) })} type="number" value={String(form.capacity_gb || 0)} /><label className="text-sm font-bold text-slate-700">Estado<select className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" onChange={(event) => setForm({ ...form, status: event.target.value as BackupStorageDestination["status"] })} value={form.status}><option value="active">Activo</option><option value="paused">Pausado</option></select></label></div><div className="mt-5 flex justify-end gap-2"><Button onClick={onClose} variant="outline">Cancelar</Button><Button onClick={async () => { storage ? await hostingApi.updateBackupStorage(storage.id, form) : await hostingApi.createBackupStorage(form); onSaved(); onClose() }}>Guardar destino</Button></div></AdminModalFrame>
}

function BackupStatusBadge({ status }: { status: string }) {
  const tone =
    status === "Completado" || status === "Activa" || status === "Activo"
      ? "bg-emerald-50 text-emerald-700"
      : status === "En progreso" || status === "Programado"
        ? "bg-blue-50 text-blue-700"
        : status === "Fallido"
          ? "bg-red-50 text-red-700"
          : "bg-amber-50 text-amber-700"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{status}</span>
}

function AdminSupportTicketsPage({ audience }: { audience: "clientes" | "revendedores" }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selected, setSelected] = useState<SupportTicket | null>(null)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("")
  const [message, setMessage] = useState("")
  const title = audience === "revendedores" ? "Tickets de revendedores" : "Tickets de clientes"
  const description =
    audience === "revendedores"
      ? "Solicitudes abiertas por revendedores hacia el administrador global del servidor."
      : "Solicitudes abiertas por clientes finales hacia soporte o administracion."
  const apiAudience = audience === "revendedores" ? "resellers" : "clients"

  const load = () => {
    setMessage("")
    hostingApi.tickets({ audience: apiAudience, search: query, status })
      .then((page) => setTickets(page.results))
      .catch((error: Error) => setMessage(error.message || "No se pudieron cargar los tickets."))
  }

  useEffect(() => {
    load()
  }, [audience])

  const counts = {
    closed: tickets.filter((ticket) => ticket.status === "closed").length,
    open: tickets.filter((ticket) => ticket.status !== "closed").length,
    pending: tickets.filter((ticket) => ticket.status === "open" || ticket.status === "customer_reply").length,
    answered: tickets.filter((ticket) => ticket.status === "answered").length,
  }

  return (
    <div className="space-y-4">
      {message ? <BackupMessage message={message} /> : null}
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Ticket className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Soporte</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">{title}</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
            </div>
          </div>
          <Button onClick={load} size="sm" variant="outline">Actualizar</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Abiertos" value={String(counts.open)} detail="Mesa actual" />
        <AdminMetric label="Pendientes" value={String(counts.pending)} detail="Sin respuesta final" />
        <AdminMetric label="Respondidos" value={String(counts.answered)} detail="Esperando usuario" />
        <AdminMetric label="Completados" value={String(counts.closed)} detail="Cerrados" />
      </section>

      <AdminTicketFilters onQueryChange={setQuery} onSearch={load} onStatusChange={setStatus} query={query} status={status} />
      <div className="eh-card overflow-hidden">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{["Ticket", "Solicitante", "Asunto", "Departamento", "Prioridad", "Creado", "Estado", "Acciones"].map((column) => <th className="px-4 py-2 font-bold" key={column}>{column}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.map((item) => (
              <tr className="hover:bg-slate-50" key={item.id}>
                <td className="px-4 py-3 font-semibold text-slate-900">{item.display_id}</td>
                <td className="px-4 py-3">{item.requester_name || item.account_domain || item.account_username}</td>
                <td className="px-4 py-3">{item.subject}</td>
                <td className="px-4 py-3">{supportDepartmentLabel(item.department)}</td>
                <td className="px-4 py-3"><SupportPriorityBadge priority={item.priority} /></td>
                <td className="px-4 py-3">{formatDateTime(item.created_at)}</td>
                <td className="px-4 py-3"><SupportTicketStatusBadge status={item.status} /></td>
                <td className="px-4 py-3 text-right"><BackupActions labels={["Ver"]} onClick={() => setSelected(item)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Mostrando {tickets.length} registros</div>
      </div>
      {selected ? <AdminTicketDetailModal onClose={() => setSelected(null)} onSaved={(ticket) => { setSelected(ticket); load() }} ticket={selected} /> : null}
    </div>
  )
}

const knowledgeArticles = [
  { category: "Primeros pasos", status: "Publicado", title: "Como apuntar un dominio a EHPanel", updated: "2026-05-08", views: "1,284" },
  { category: "Correo", status: "Publicado", title: "Configurar correo en Gmail, Outlook e iOS", updated: "2026-05-07", views: "940" },
  { category: "Backups", status: "Borrador", title: "Restaurar archivos desde una copia", updated: "2026-05-05", views: "120" },
  { category: "Seguridad", status: "Publicado", title: "Activar SSL gratuito y revisar HTTPS", updated: "2026-05-03", views: "760" },
]

function AdminKnowledgeBasePage() {
  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Soporte</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Base de conocimiento</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Biblioteca administrable de articulos, manuales y guias para clientes y revendedores.
              </p>
            </div>
          </div>
          <Button size="sm">Nuevo articulo</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Articulos" value="42" detail="Publicados y borradores" />
        <AdminMetric label="Categorias" value="8" detail="Correo, DNS, SSL..." />
        <AdminMetric label="Lecturas" value="9,840" detail="Ultimos 30 dias" />
        <AdminMetric label="Borradores" value="6" detail="Pendientes editar" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <AdminSimpleTable
          columns={["Articulo", "Categoria", "Vistas", "Actualizado", "Estado", "Acciones"]}
          rows={knowledgeArticles.map((item) => [
            item.title,
            item.category,
            item.views,
            item.updated,
            <KnowledgeStatusBadge key="status" status={item.status} />,
            <BackupActions key="actions" labels={["Editar", "Vista previa", "Publicar"]} />,
          ])}
          search="Buscar articulo, categoria o estado..."
        />

        <aside className="eh-card p-4">
          <div className="eh-kicker">Estructura sugerida</div>
          <h3 className="mt-1 text-lg font-bold">Categorias base</h3>
          <div className="mt-4 space-y-2">
            <AdminStatus label="Inicio" value="Primeros pasos" />
            <AdminStatus label="Hosting" value="Dominios, DNS, SSL" />
            <AdminStatus label="Correo" value="Clientes y errores" />
            <AdminStatus label="Seguridad" value="WAF, backups" />
            <AdminStatus label="Revendedor" value="Operacion comercial" />
          </div>
        </aside>
      </section>
    </div>
  )
}

function AdminGlobalAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<GlobalAnnouncement[]>([])
  const [editing, setEditing] = useState<GlobalAnnouncement | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("")
  const [message, setMessage] = useState("")

  const load = () => {
    setMessage("")
    hostingApi.announcements({ search: query, status })
      .then((page) => setAnnouncements(page.results))
      .catch((error: Error) => setMessage(error.message || "No se pudieron cargar los anuncios."))
  }

  useEffect(() => {
    load()
  }, [])

  const counts = {
    critical: announcements.filter((item) => item.priority === "critical" || item.priority === "high").length,
    draft: announcements.filter((item) => item.status === "draft").length,
    published: announcements.filter((item) => item.status === "published").length,
    scheduled: announcements.filter((item) => item.status === "scheduled").length,
  }

  return (
    <div className="space-y-4">
      {message ? <BackupMessage message={message} /> : null}
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Soporte</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Anuncios globales</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Avisos visibles para clientes o revendedores sobre mantenimientos, incidencias y comunicados del servicio.
              </p>
            </div>
          </div>
          <Button onClick={() => { setEditing(null); setShowModal(true) }} size="sm">Nuevo anuncio</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Publicados" value={String(counts.published)} detail="Visibles ahora" />
        <AdminMetric label="Programados" value={String(counts.scheduled)} detail="Proximas horas" />
        <AdminMetric label="Borradores" value={String(counts.draft)} detail="Sin publicar" />
        <AdminMetric label="Criticos" value={String(counts.critical)} detail="Prioridad alta" />
      </section>

      <AdminAnnouncementFilters onQueryChange={setQuery} onSearch={load} onStatusChange={setStatus} query={query} status={status} />
      <div className="eh-card overflow-hidden">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{["Anuncio", "Audiencia", "Prioridad", "Publicacion", "Expira", "Estado", "Acciones"].map((column) => <th className="px-4 py-2 font-bold" key={column}>{column}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {announcements.map((item) => (
              <tr className="hover:bg-slate-50" key={item.id}>
                <td className="px-4 py-3 font-semibold text-slate-900">{item.title}</td>
                <td className="px-4 py-3">{item.audience_label}</td>
                <td className="px-4 py-3"><SupportPriorityBadge priority={item.priority} /></td>
                <td className="px-4 py-3">{formatDateTime(item.publish_at || item.created_at)}</td>
                <td className="px-4 py-3">{item.expires_at ? formatDateTime(item.expires_at) : "Sin expiracion"}</td>
                <td className="px-4 py-3"><KnowledgeStatusBadge status={item.status} /></td>
                <td className="px-4 py-3 text-right"><BackupActions labels={["Editar", item.status === "published" ? "Retirar" : "Publicar"]} onClick={(label) => { if (label === "Editar") { setEditing(item); setShowModal(true) } else { void hostingApi.updateAnnouncement(item.id, { status: item.status === "published" ? "archived" : "published" }).then(load).catch((error: Error) => setMessage(error.message)) } }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Mostrando {announcements.length} registros</div>
      </div>
      {showModal ? <AdminAnnouncementModal announcement={editing} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} /> : null}
    </div>
  )
}

function AdminTicketFilters({ onQueryChange, onSearch, onStatusChange, query, status }: { onQueryChange: (value: string) => void; onSearch: () => void; onStatusChange: (value: string) => void; query: string; status: string }) {
  return (
    <div className="eh-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex h-9 w-[420px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
        <Search className="h-4 w-4" />
        <input className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => onQueryChange(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onSearch()} placeholder="Buscar ticket, solicitante, asunto o departamento..." value={query} />
      </div>
      <div className="flex gap-2">
        <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => onStatusChange(event.target.value)} value={status}>
          <option value="">Estado</option><option value="open">Abierto</option><option value="customer_reply">Respuesta cliente</option><option value="answered">Respondido</option><option value="closed">Cerrado</option>
        </select>
        <Button onClick={onSearch} size="sm" variant="outline">Filtrar</Button>
      </div>
    </div>
  )
}

function AdminTicketDetailModal({ onClose, onSaved, ticket }: { onClose: () => void; onSaved: (ticket: SupportTicket) => void; ticket: SupportTicket }) {
  const [body, setBody] = useState("")
  const [status, setStatus] = useState<SupportTicket["status"]>(ticket.status)
  const [error, setError] = useState("")

  const submitReply = async (event: FormEvent) => {
    event.preventDefault()
    if (!body.trim()) return setError("Escribe una respuesta.")
    const form = new FormData()
    form.set("body", body)
    try {
      setError("")
      const updated = await hostingApi.replyTicket(ticket.id, form)
      setBody("")
      onSaved(updated)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo responder el ticket.")
    }
  }

  const updateStatus = async () => {
    try {
      setError("")
      onSaved(await hostingApi.setTicketStatus(ticket.id, status))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar el estado.")
    }
  }

  return (
    <AdminModalFrame kicker="Ticket de soporte" onClose={onClose} title={`${ticket.display_id} - ${ticket.subject}`}>
      <div className="grid gap-3 md:grid-cols-3">
        <AdminStatus label="Solicitante" value={ticket.requester_name || ticket.account_domain} />
        <AdminStatus label="Cuenta" value={ticket.account_domain || ticket.account_username} />
        <AdminStatus label="Departamento" value={supportDepartmentLabel(ticket.department)} />
        <AdminStatus label="Prioridad" value={supportPriorityLabel(ticket.priority)} />
        <AdminStatus label="Estado" value={supportStatusLabel(ticket.status)} />
        <AdminStatus label="Creado" value={formatDateTime(ticket.created_at)} />
      </div>
      <div className="mt-4 max-h-80 space-y-3 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
        {ticket.messages.map((message) => (
          <div className={cn("max-w-[86%] rounded-lg border p-3 text-sm", message.author_type === "staff" ? "ml-auto border-blue-100 bg-blue-50" : "border-slate-200 bg-white")} key={message.id}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs font-bold uppercase text-slate-500">
              <span>{message.author_name || supportAuthorLabel(message.author_type)}</span>
              <span>{formatDateTime(message.created_at)}</span>
            </div>
            <p className="whitespace-pre-wrap leading-6 text-slate-700">{message.body}</p>
          </div>
        ))}
      </div>
      {error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
      <form className="mt-4 space-y-3" onSubmit={submitReply}>
        <textarea className="h-28 w-full resize-none rounded-md border border-slate-200 p-3 text-sm outline-none focus:border-blue-500" onChange={(event) => setBody(event.target.value)} placeholder="Responder como administrador..." value={body} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setStatus(event.target.value as SupportTicket["status"])} value={status}>
              <option value="open">Abierto</option><option value="customer_reply">Respuesta cliente</option><option value="answered">Respondido</option><option value="closed">Cerrado</option>
            </select>
            <Button onClick={updateStatus} type="button" variant="outline">Actualizar estado</Button>
          </div>
          <Button type="submit">Enviar respuesta</Button>
        </div>
      </form>
    </AdminModalFrame>
  )
}

function AdminAnnouncementFilters({ onQueryChange, onSearch, onStatusChange, query, status }: { onQueryChange: (value: string) => void; onSearch: () => void; onStatusChange: (value: string) => void; query: string; status: string }) {
  return (
    <div className="eh-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex h-9 w-[420px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
        <Search className="h-4 w-4" />
        <input className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => onQueryChange(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onSearch()} placeholder="Buscar anuncio, audiencia o estado..." value={query} />
      </div>
      <div className="flex gap-2">
        <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => onStatusChange(event.target.value)} value={status}>
          <option value="">Estado</option><option value="draft">Borrador</option><option value="published">Publicado</option><option value="scheduled">Programado</option><option value="archived">Archivado</option>
        </select>
        <Button onClick={onSearch} size="sm" variant="outline">Filtrar</Button>
      </div>
    </div>
  )
}

function AdminAnnouncementModal({ announcement, onClose, onSaved }: { announcement: GlobalAnnouncement | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<GlobalAnnouncementPayload>({
    audience: announcement?.audience || "all",
    body: announcement?.body || "",
    expires_at: toLocalInputValue(announcement?.expires_at),
    priority: announcement?.priority || "medium",
    publish_at: toLocalInputValue(announcement?.publish_at),
    status: announcement?.status || "draft",
    title: announcement?.title || "",
  })
  const [error, setError] = useState("")

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.title.trim()) return setError("El titulo es obligatorio.")
    const payload = {
      ...form,
      expires_at: fromLocalInputValue(form.expires_at),
      publish_at: fromLocalInputValue(form.publish_at),
    }
    try {
      setError("")
      if (announcement) await hostingApi.updateAnnouncement(announcement.id, payload)
      else await hostingApi.createAnnouncement(payload)
      onSaved()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el anuncio.")
    }
  }

  return (
    <AdminModalFrame kicker="Comunicacion" onClose={onClose} title={announcement ? "Editar anuncio" : "Nuevo anuncio"}>
      <form className="space-y-4" onSubmit={submit}>
        <BackupInput label="Titulo" onChange={(value) => setForm({ ...form, title: value })} value={form.title} />
        <label className="block text-sm font-bold text-slate-700">Contenido<textarea className="mt-1 h-28 w-full resize-none rounded-md border border-slate-200 p-3 text-sm outline-none focus:border-blue-500" onChange={(event) => setForm({ ...form, body: event.target.value })} value={form.body || ""} /></label>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block text-sm font-bold text-slate-700">Audiencia<select className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" onChange={(event) => setForm({ ...form, audience: event.target.value as GlobalAnnouncementPayload["audience"] })} value={form.audience}><option value="all">Todos</option><option value="clients">Clientes</option><option value="resellers">Revendedores</option></select></label>
          <label className="block text-sm font-bold text-slate-700">Prioridad<select className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" onChange={(event) => setForm({ ...form, priority: event.target.value as GlobalAnnouncementPayload["priority"] })} value={form.priority}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Critica</option></select></label>
          <label className="block text-sm font-bold text-slate-700">Estado<select className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" onChange={(event) => setForm({ ...form, status: event.target.value as GlobalAnnouncementPayload["status"] })} value={form.status}><option value="draft">Borrador</option><option value="published">Publicado</option><option value="scheduled">Programado</option><option value="archived">Archivado</option></select></label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <BackupInput label="Publicar desde" onChange={(value) => setForm({ ...form, publish_at: value })} type="datetime-local" value={form.publish_at || ""} />
          <BackupInput label="Expira" onChange={(value) => setForm({ ...form, expires_at: value })} type="datetime-local" value={form.expires_at || ""} />
        </div>
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
        <div className="flex justify-end gap-2"><Button onClick={onClose} type="button" variant="outline">Cancelar</Button><Button type="submit">Guardar anuncio</Button></div>
      </form>
    </AdminModalFrame>
  )
}

function SupportTicketStatusBadge({ status }: { status: SupportTicket["status"] | string }) {
  const tone =
    status === "closed" || status === "Completado"
      ? "bg-emerald-50 text-emerald-700"
      : status === "answered" || status === "Respondido"
        ? "bg-blue-50 text-blue-700"
        : "bg-amber-50 text-amber-700"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{supportStatusLabel(status)}</span>
}

function SupportPriorityBadge({ priority }: { priority: string }) {
  const tone = priority === "high" || priority === "critical" || priority === "Alta" ? "bg-red-50 text-red-700" : priority === "medium" || priority === "Media" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{supportPriorityLabel(priority)}</span>
}

function KnowledgeStatusBadge({ status }: { status: string }) {
  const tone =
    status === "published" || status === "Publicado"
      ? "bg-emerald-50 text-emerald-700"
      : status === "scheduled" || status === "Programado"
        ? "bg-blue-50 text-blue-700"
        : "bg-slate-100 text-slate-700"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{announcementStatusLabel(status)}</span>
}

function supportStatusLabel(status: string) {
  return { answered: "Respondido", closed: "Completado", customer_reply: "Respuesta cliente", open: "Abierto" }[status] || status
}

function supportPriorityLabel(priority: string) {
  return { critical: "Critica", high: "Alta", low: "Baja", medium: "Media", urgent: "Urgente" }[priority] || priority
}

function supportDepartmentLabel(department: string) {
  return { administration: "Administracion", billing: "Facturacion", security: "Abuso y seguridad", technical: "Soporte tecnico" }[department] || department
}

function supportAuthorLabel(authorType: string) {
  return { customer: "Cliente", reseller: "Revendedor", staff: "Administrador", system: "Sistema" }[authorType] || authorType
}

function announcementStatusLabel(status: string) {
  return { archived: "Archivado", draft: "Borrador", published: "Publicado", scheduled: "Programado" }[status] || status
}

function toLocalInputValue(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function fromLocalInputValue(value?: string | null) {
  return value ? new Date(value).toISOString() : null
}

function AdminLogsPageShell({
  children,
  description,
  metrics,
  onExport,
  title,
}: {
  children: ReactNode
  description: string
  metrics: Array<[string, string, string]>
  onExport?: () => void
  search: string
  title: string
}) {
  return (
    <div className="space-y-4">
      <section className="eh-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="eh-kicker">Logs</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">{title}</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
            </div>
          </div>
          <Button onClick={onExport} size="sm">Exportar log</Button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        {metrics.map(([label, value, detail]) => (
          <AdminMetric detail={detail} key={label} label={label} value={value} />
        ))}
      </section>

      {children}
    </div>
  )
}

type AdminLogRow = {
  actionLabels: string[]
  cells: Array<string | ReactNode>
  exportName: string
  raw: Record<string, unknown>
  searchable: string
  title: string
}

function AdminSystemLogsPageReal() {
  const load = async () => {
    const [jobs, events, nodes] = await Promise.all([adminApi.jobs(), adminApi.nodeEvents(), adminApi.nodes()])
    const rows = [...jobs.results.slice(0, 50).map(systemLogRowFromJob), ...events.results.slice(0, 50).map(systemLogRowFromEvent)]
    return {
      metrics: [
        ["Eventos 24h", String(rows.length), "Sistema y servicios"],
        ["Servicios activos", String(nodes.results.filter((node) => node.effective_state === "online").length), "Nodos online"],
        ["Reinicios", String(jobs.results.filter((job) => job.job_type === "service_action").length), "Programados o cambios"],
        ["Advertencias", String(jobs.results.filter((job) => job.status === "failed").length), "Requiere revision"],
      ] as Array<[string, string, string]>,
      rows,
    }
  }
  return <AdminRealLogsPage columns={["Fecha", "Nodo", "Servicio", "Evento", "Motivo", "Activo desde", "Nivel", "Acciones"]} description="Movimientos del sistema y servicios: reinicios, estado activo, motivo de cambios y tiempo activo." load={load} search="Buscar servicio, nodo, motivo o evento..." title="Logs del sistema" />
}

function AdminPanelLogsPageReal() {
  const load = async () => {
    const page = await adminApi.auditLogs()
    const rows = page.results.map(panelLogRowFromAudit)
    return {
      metrics: [
        ["Movimientos", String(page.count || rows.length), "Ultimos registros"],
        ["Administradores", String(page.results.filter((row) => row.user_username.includes("admin")).length), "Cambios globales"],
        ["Revendedores", String(page.results.filter((row) => String(row.metadata?.role || "").includes("reseller")).length), "Acciones sobre clientes"],
        ["Staff", String(page.results.filter((row) => row.user_username && !row.user_username.includes("admin")).length), "Soporte y operaciones"],
      ] as Array<[string, string, string]>,
      rows,
    }
  }
  return <AdminRealLogsPage columns={["Fecha", "Actor", "Rol", "Area", "Movimiento", "Detalle", "Acciones"]} description="Auditoria de movimientos realizados dentro del panel por administradores, staff, revendedores y operadores." load={load} search="Buscar actor, accion, area o detalle..." title="Logs del panel" />
}

function AdminMailLogsPageReal() {
  const load = async () => {
    const [queue, jobs] = await Promise.all([adminApi.mailQueue(), adminApi.jobs()])
    const mailJobs = jobs.results.filter((job) => job.job_type.includes("mail") || JSON.stringify(job.payload).includes("mail"))
    const rows = [...queue.results.map(mailLogRowFromQueue), ...mailJobs.map(mailLogRowFromJob)]
    return {
      metrics: [
        ["Eventos correo", String(rows.length), "Ultimas consultas"],
        ["Entregados", String(queue.results.filter((item) => item.status.toLowerCase().includes("sent") || item.status.toLowerCase().includes("deliver")).length), "Aceptados"],
        ["Rechazados", String(queue.results.filter((item) => item.status.toLowerCase().includes("reject") || item.code.startsWith("5")).length), "Politicas o auth"],
        ["Spam/rebote", String(queue.results.filter((item) => item.status.toLowerCase().includes("spam") || item.status.toLowerCase().includes("bounce")).length), "Revisar casos"],
      ] as Array<[string, string, string]>,
      rows,
    }
  }
  return <AdminRealLogsPage columns={["Fecha", "Servidor", "Cola", "Direccion", "Codigo", "Estado", "Resumen", "Acciones"]} description="Movimientos de correo con codigo, direccion, cola y explicacion resumida para soporte tecnico." load={load} search="Buscar codigo, cola, estado o servidor..." title="Logs de correo" />
}

function AdminBackupLogsPageReal() {
  const load = async () => {
    const [exportsPage, restoresPage, jobs] = await Promise.all([hostingApi.accountExports(), hostingApi.backupRestores(), adminApi.jobs()])
    const rows = [...exportsPage.results.map(backupLogRowFromExport), ...restoresPage.results.map(backupLogRowFromRestore), ...jobs.results.filter((job) => job.job_type.includes("backup") || JSON.stringify(job.payload).includes("backup")).map(backupLogRowFromJob)]
    return {
      metrics: [
        ["Eventos backup", String(rows.length), "Registros reales"],
        ["Completados", String(rows.filter((row) => row.searchable.includes("Completado")).length), "Sin errores"],
        ["En progreso", String(rows.filter((row) => row.searchable.includes("En progreso")).length), "Ahora mismo"],
        ["Fallidos", String(rows.filter((row) => row.searchable.includes("Fallido")).length), "Requieren revision"],
      ] as Array<[string, string, string]>,
      rows,
    }
  }
  return <AdminRealLogsPage columns={["Fecha", "Cuenta", "Tipo", "Destino", "Estado", "Resumen", "Acciones"]} description="Eventos de copias y restauraciones: inicio, finalizacion, destino, errores y validaciones." load={load} search="Buscar cuenta, destino, tipo o estado..." title="Logs de backups" />
}

function AdminSecurityLogsPageReal() {
  const load = async () => {
    const [scans, blocks, jobs] = await Promise.all([hostingApi.securityScans(), hostingApi.ipBlocks(), adminApi.jobs()])
    const rows = [...scans.results.map(securityLogRowFromScan), ...blocks.results.map(securityLogRowFromBlock), ...jobs.results.filter((job) => job.job_type.includes("security") || job.job_type.includes("waf") || JSON.stringify(job.payload).includes("security")).map(securityLogRowFromJob)]
    return {
      metrics: [
        ["Eventos seguridad", String(rows.length), "Registros reales"],
        ["Bots", String(rows.filter((row) => row.searchable.toLowerCase().includes("bot")).length), "Challenge o bloqueo"],
        ["Amenazas", String(scans.results.filter((scan) => scan.status === "threat").length), "Antivirus/WAF"],
        ["Bloqueos IP", String(blocks.results.length), "Activos e historico"],
      ] as Array<[string, string, string]>,
      rows,
    }
  }
  return <AdminRealLogsPage columns={["Fecha", "Tipo", "Modulo", "IP", "Severidad", "Accion", "Resumen", "Acciones"]} description="Intentos de bots, fuerza bruta, SSH, WAF, inyeccion SQL y eventos de seguridad relevantes." load={load} search="Buscar IP, tipo, modulo o accion..." title="Logs de seguridad" />
}

function AdminLogDownloadsPageReal() {
  const load = async () => {
    const [audits, mail, exportsPage, scans] = await Promise.all([adminApi.auditLogs(), adminApi.mailQueue(), hostingApi.accountExports(), hostingApi.securityScans()])
    const rows = [
      logDownloadRow("panel-audit-log.txt", "Panel", audits.results.length, "Auditoria del panel", audits.results),
      logDownloadRow("mail-queue-log.txt", "Correo", mail.results.length, "Cola y eventos de correo", mail.results),
      logDownloadRow("backup-events-log.txt", "Backup", exportsPage.results.length, "Exportaciones y copias", exportsPage.results),
      logDownloadRow("security-scan-log.txt", "Seguridad", scans.results.length, "Escaneos y remediacion", scans.results),
    ]
    return {
      metrics: [
        ["Descargas", String(rows.length), "Paquetes generables"],
        ["Generados", String(rows.length), "Listo para bajar"],
        ["Registros", String(audits.results.length + mail.results.length + exportsPage.results.length + scans.results.length), "Incluidos"],
        ["Expirados", "0", "Se generan al momento"],
      ] as Array<[string, string, string]>,
      rows,
    }
  }
  return <AdminRealLogsPage columns={["Archivo", "Tipo", "Rango", "Generado por", "Fecha", "Tamano", "Estado", "Acciones"]} description="Historial de paquetes de logs generados y descargados, con rango de fechas, responsable y estado." load={load} search="Buscar archivo, actor, rango o tipo..." title="Descargas de logs" />
}

function AdminRealLogsPage({ columns, description, load, search, title }: { columns: string[]; description: string; load: () => Promise<{ metrics: Array<[string, string, string]>; rows: AdminLogRow[] }>; search: string; title: string }) {
  const [metrics, setMetrics] = useState<Array<[string, string, string]>>([["Registros", "0", "Cargando"], ["Errores", "0", "Sin datos"], ["Activos", "0", "Sin datos"], ["Exportables", "0", "TXT"]])
  const [rows, setRows] = useState<AdminLogRow[]>([])
  const [selected, setSelected] = useState<AdminLogRow | null>(null)
  const [query, setQuery] = useState("")
  const [message, setMessage] = useState("")

  const refresh = () => {
    setMessage("")
    load()
      .then((data) => {
        setMetrics(data.metrics)
        setRows(data.rows)
      })
      .catch((error: Error) => setMessage(error.message || "No se pudieron cargar los logs."))
  }

  useEffect(() => {
    refresh()
  }, [title])

  const filtered = rows.filter((row) => !query.trim() || row.searchable.toLowerCase().includes(query.trim().toLowerCase()))
  const exportAll = () => downloadLogRows(`${slugifyLogFileName(title)}.txt`, title, filtered)

  return (
    <AdminLogsPageShell description={description} metrics={metrics} onExport={exportAll} search={search} title={title}>
      {message ? <BackupMessage message={message} /> : null}
      <div className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex h-9 w-[420px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => setQuery(event.target.value)} placeholder={search} value={query} />
          </div>
          <div className="flex gap-2"><Button onClick={refresh} size="sm" variant="outline">Actualizar</Button><Button onClick={exportAll} size="sm" variant="outline">Exportar</Button></div>
        </div>
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{columns.map((column) => <th className="px-4 py-2 font-bold" key={column}>{column}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((row, rowIndex) => (
              <tr className="hover:bg-slate-50" key={`${row.exportName}-${rowIndex}`}>
                {row.cells.map((cell, cellIndex) => <td className={cn("px-4 py-3", cellIndex === 0 && "font-semibold text-slate-900")} key={cellIndex}>{cell}</td>)}
                <td className="px-4 py-3 text-right"><BackupActions labels={row.actionLabels} onClick={(label) => handleLogAction(label, row, setSelected, setMessage)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"><span>Mostrando {filtered.length} de {rows.length} registros</span><span className="font-semibold text-slate-800">Exportacion TXT</span></div>
      </div>
      {selected ? <AdminLogDetailModal onClose={() => setSelected(null)} row={selected} /> : null}
    </AdminLogsPageShell>
  )
}

function AdminLogDetailModal({ onClose, row }: { onClose: () => void; row: AdminLogRow }) {
  return (
    <AdminModalFrame kicker="Log" onClose={onClose} title={row.title}>
      <pre className="max-h-[520px] overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-100">{formatLogText(row.title, row.raw)}</pre>
      <div className="mt-4 flex justify-end"><Button onClick={() => downloadLogRow(row)}>Exportar TXT</Button></div>
    </AdminModalFrame>
  )
}

function systemLogRowFromJob(job: AdminAgentJob): AdminLogRow {
  const service = String(job.payload?.service || job.job_type || "EHPanel Agent")
  const event = jobTypeLabel(job.job_type)
  const level = job.status === "failed" ? "Error" : job.status === "running" || job.status === "sent" || job.status === "queued" ? "Advertencia" : "Info"
  const reason = job.error_detail || String(job.payload?.action || job.error_code || jobStatusLabel(job.status))
  const raw = logRecord("agent_job", job)
  return {
    actionLabels: ["Ver", "Exportar"],
    cells: [formatDateTime(job.started_at || job.sent_at || job.queued_at), job.node_hostname || "N/D", service, event, reason, job.finished_at ? formatDateTime(job.finished_at) : jobStatusLabel(job.status), <LogLevelBadge key="level" level={level} />],
    exportName: `system-job-${job.id}.txt`,
    raw,
    searchable: logSearch([job.node_hostname, service, event, reason, job.status]),
    title: `${event} - ${job.node_hostname || "Nodo"}`,
  }
}

function systemLogRowFromEvent(event: AdminAgentEvent): AdminLogRow {
  const payload = event.payload || {}
  const service = String(payload.service || payload.unit || payload.name || event.msg_type)
  const detail = String(payload.detail || payload.message || payload.status || event.msg_id || "Evento del agente")
  const level = detail.toLowerCase().includes("error") || detail.toLowerCase().includes("failed") ? "Error" : detail.toLowerCase().includes("warning") ? "Advertencia" : "Info"
  const raw = logRecord("agent_event", event)
  return {
    actionLabels: ["Ver", "Exportar"],
    cells: [formatDateTime(event.created_at), event.node_hostname || "N/D", service, event.msg_type, detail, formatDateTime(event.created_at), <LogLevelBadge key="level" level={level} />],
    exportName: `system-event-${event.id}.txt`,
    raw,
    searchable: logSearch([event.node_hostname, service, event.msg_type, detail]),
    title: `${event.msg_type} - ${event.node_hostname || "Evento"}`,
  }
}

function panelLogRowFromAudit(audit: AdminAuditLog): AdminLogRow {
  const role = audit.user_username?.includes("admin") ? "Administrador" : "Operador"
  const area = audit.account_domain || audit.target_type || audit.action.split(".")[0] || "Panel"
  const detail = audit.path || audit.target_label || audit.target_id || JSON.stringify(audit.metadata || {})
  const raw = logRecord("audit_log", audit)
  return {
    actionLabels: ["Ver", "Auditar"],
    cells: [formatDateTime(audit.created_at), audit.user_username || "Sistema", role, area, audit.action, detail],
    exportName: `panel-audit-${audit.id}.txt`,
    raw,
    searchable: logSearch([audit.user_username, role, area, audit.action, detail, audit.ip || ""]),
    title: `${audit.action} - ${audit.user_username || "Sistema"}`,
  }
}

function mailLogRowFromQueue(item: AdminMailQueueItem): AdminLogRow {
  const raw = { ...logRecord("mail_queue", item), node: item.node, queue_id: item.queue_id }
  return {
    actionLabels: ["Ver", "Reintentar"],
    cells: [formatDateTime(item.time), item.node_hostname || item.node, item.queue_id, item.direction || "N/D", item.code || "N/D", <MailStatusBadge key="status" status={item.status || "Pendiente"} />, item.explanation || `${item.from} -> ${item.to}`],
    exportName: `mail-${item.queue_id || item.id}.txt`,
    raw,
    searchable: logSearch([item.node_hostname, item.queue_id, item.direction, item.code, item.status, item.explanation, item.from, item.to]),
    title: `Correo ${item.queue_id || item.id}`,
  }
}

function mailLogRowFromJob(job: AdminAgentJob): AdminLogRow {
  const raw = logRecord("mail_job", job)
  return {
    actionLabels: ["Ver", "Exportar"],
    cells: [formatDateTime(job.started_at || job.queued_at), job.node_hostname, String(job.payload?.queue_id || job.id), "Agente", String(job.error_code || job.status), <MailStatusBadge key="status" status={jobStatusLabel(job.status)} />, job.error_detail || jobTypeLabel(job.job_type)],
    exportName: `mail-job-${job.id}.txt`,
    raw,
    searchable: logSearch([job.node_hostname, job.job_type, job.status, job.error_detail]),
    title: `Job correo ${job.id}`,
  }
}

function backupLogRowFromExport(item: HostingAccountExport): AdminLogRow {
  const status = backupStatusLabel(item.status)
  const raw = logRecord("account_export", item)
  return {
    actionLabels: ["Ver", "Logs"],
    cells: [formatDateTime(item.updated_at || item.created_at), item.account_domain, backupExportTypeLabel(item), item.node_hostname || "N/D", <BackupStatusBadge key="status" status={status} />, item.error_detail || item.filename || "Exportacion registrada"],
    exportName: `backup-export-${item.id}.txt`,
    raw,
    searchable: logSearch([item.account_domain, backupExportTypeLabel(item), item.node_hostname || "", status, item.error_detail || item.filename || ""]),
    title: `Backup ${item.account_domain}`,
  }
}

function backupLogRowFromRestore(item: BackupRestoreRun): AdminLogRow {
  const status = backupStatusLabel(item.status)
  const accounts = item.accounts_detail.map((account) => account.domain).join(", ") || item.reseller_name || "N/D"
  const raw = logRecord("backup_restore", item)
  return {
    actionLabels: ["Ver", "Logs"],
    cells: [formatDateTime(item.updated_at || item.created_at), accounts, item.restore_type, item.destination_node_hostname || "N/D", <BackupStatusBadge key="status" status={status} />, item.error_detail || item.backup_label || "Restauracion registrada"],
    exportName: `backup-restore-${item.id}.txt`,
    raw,
    searchable: logSearch([accounts, item.restore_type, item.destination_node_hostname || "", status, item.error_detail || ""]),
    title: `Restauracion #${item.id}`,
  }
}

function backupLogRowFromJob(job: AdminAgentJob): AdminLogRow {
  const status = job.status === "success" ? "Completado" : job.status === "failed" ? "Fallido" : "En progreso"
  const raw = logRecord("backup_job", job)
  return {
    actionLabels: ["Ver", "Logs"],
    cells: [formatDateTime(job.started_at || job.queued_at), String(job.payload?.account || job.payload?.domain || "N/D"), jobTypeLabel(job.job_type), job.node_hostname, <BackupStatusBadge key="status" status={status} />, job.error_detail || String(job.payload?.action || "Job de backup")],
    exportName: `backup-job-${job.id}.txt`,
    raw,
    searchable: logSearch([job.node_hostname, job.job_type, status, job.error_detail, JSON.stringify(job.payload)]),
    title: `Job backup ${job.id}`,
  }
}

function securityLogRowFromScan(scan: HostingSecurityScan): AdminLogRow {
  const severity = scan.status === "threat" ? "Alta" : scan.status === "failed" ? "Media" : "Baja"
  const raw = logRecord("security_scan", scan)
  return {
    actionLabels: ["Ver", "Exportar"],
    cells: [formatDateTime(scan.finished_at || scan.updated_at), scan.scan_type, "Antivirus", scan.account_domain, <SeverityBadge key="severity" severity={severity} />, securityScanAction(scan.status), scan.error_detail || `${scan.infected_files} infecciones / ${scan.files_scanned} archivos`],
    exportName: `security-scan-${scan.id}.txt`,
    raw,
    searchable: logSearch([scan.account_domain, scan.scan_type, scan.status, scan.error_detail, scan.output]),
    title: `Escaneo ${scan.account_domain}`,
  }
}

function securityLogRowFromBlock(block: HostingIpBlock): AdminLogRow {
  const severity = block.status === "active" ? "Alta" : "Media"
  const raw = logRecord("ip_block", block)
  return {
    actionLabels: ["Ver", "Exportar"],
    cells: [formatDateTime(block.created_at), "Bloqueo IP", block.source_label || block.source, block.target, <SeverityBadge key="severity" severity={severity} />, block.enabled ? "Bloqueado" : "Inactivo", block.reason || block.domain_name],
    exportName: `ip-block-${block.id}.txt`,
    raw,
    searchable: logSearch([block.target, block.source_label, block.source, block.reason, block.status]),
    title: `Bloqueo ${block.target}`,
  }
}

function securityLogRowFromJob(job: AdminAgentJob): AdminLogRow {
  const severity = job.status === "failed" ? "Alta" : "Media"
  const raw = logRecord("security_job", job)
  return {
    actionLabels: ["Ver", "Exportar"],
    cells: [formatDateTime(job.started_at || job.queued_at), jobTypeLabel(job.job_type), "Agente", job.node_hostname, <SeverityBadge key="severity" severity={severity} />, jobStatusLabel(job.status), job.error_detail || String(job.payload?.action || "Evento de seguridad")],
    exportName: `security-job-${job.id}.txt`,
    raw,
    searchable: logSearch([job.node_hostname, job.job_type, job.status, job.error_detail, JSON.stringify(job.payload)]),
    title: `Evento seguridad ${job.id}`,
  }
}

function logDownloadRow(file: string, type: string, count: number, detail: string, records: unknown[]): AdminLogRow {
  const raw = { detail, file, generated_at: new Date().toISOString(), records, type }
  return {
    actionLabels: ["Descargar", "Regenerar"],
    cells: [file, type, "Ultimos registros disponibles", "EHPanel", formatDateTime(raw.generated_at), `${formatLogText(file, raw).length} B`, <KnowledgeStatusBadge key="status" status="Publicado" />],
    exportName: file,
    raw,
    searchable: logSearch([file, type, detail, String(count)]),
    title: `${type}: ${count} registros`,
  }
}

function handleLogAction(label: string, row: AdminLogRow, setSelected: (row: AdminLogRow) => void, setMessage: (message: string) => void) {
  if (label === "Ver" || label === "Auditar") {
    setSelected(row)
    return
  }
  if (label === "Reintentar" && typeof row.raw.node === "string" && typeof row.raw.queue_id === "string") {
    adminApi.retryMailQueue({ node: row.raw.node, queue_id: row.raw.queue_id }).then(() => setMessage("Reintento enviado al agente.")).catch((error: Error) => setMessage(error.message || "No se pudo reintentar."))
    return
  }
  downloadLogRow(row)
  if (label === "Regenerar") setMessage("Paquete regenerado desde los registros actuales.")
}

function downloadLogRows(fileName: string, title: string, rows: AdminLogRow[]) {
  downloadTextFile(fileName, rows.map((row) => formatLogText(`${title} / ${row.title}`, row.raw)).join("\n\n---\n\n"))
}

function downloadLogRow(row: AdminLogRow) {
  downloadTextFile(row.exportName, formatLogText(row.title, row.raw))
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function formatLogText(title: string, raw: unknown) {
  return `${title}\nGenerado: ${new Date().toISOString()}\n\n${JSON.stringify(raw, null, 2)}`
}

function logRecord(source: string, raw: unknown): Record<string, unknown> {
  return { raw, source }
}

function logSearch(values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ")
}

function slugifyLogFileName(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "logs"
}

function securityScanAction(status: string) {
  return ({ canceled: "Cancelado", clean: "Limpio", failed: "Fallido", queued: "En cola", running: "Escaneando", threat: "Amenaza detectada" } as Record<string, string>)[status] || status
}

function LogLevelBadge({ level }: { level: string }) {
  const tone = level === "Advertencia" ? "bg-amber-50 text-amber-700" : level === "Error" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{level}</span>
}


function AdminAdministratorsPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("staff")
  const [message, setMessage] = useState("")
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [showCreateAdmin, setShowCreateAdmin] = useState(false)

  const load = async () => {
    try {
      const response = await adminApi.users({ search: query || undefined })
      setUsers(response.results.filter((user) => user.is_staff || ["admin", "moderator", "technician"].includes(user.role)))
      setMessage("")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar administradores.")
    }
  }

  useEffect(() => {
    load()
  }, [])

  const visibleUsers = users.filter((user) => roleFilter === "staff" || user.role === roleFilter)
  const activeCount = users.filter((user) => user.is_active).length
  const toggleUser = async (user: AdminUser) => {
    await adminApi.updateUser(user.id, { is_active: !user.is_active })
    await load()
  }

  return (
    <div className="space-y-4">
      <AdminUsersHeader action="Anadir administrador" description="Lista de administradores y staff con acceso al panel. Solo el propietario puede eliminar o dar de baja definitiva." icon={UserCog} onAction={() => setShowCreateAdmin(true)} title="Administradores" />
      {message ? <BackupMessage message={message} /> : null}
      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Administradores" value={String(users.length)} detail="Con acceso interno" />
        <AdminMetric label="Activos" value={String(activeCount)} detail="Pueden iniciar sesion" />
        <AdminMetric label="Suspendidos" value={String(users.length - activeCount)} detail="Acceso bloqueado" />
        <AdminMetric label="Superusuarios" value={String(users.filter((user) => user.role === "admin").length)} detail="Permisos criticos" />
      </section>
      <AdminUserFilters onFilterChange={setRoleFilter} onQueryChange={setQuery} onSearch={load} query={query} roleFilter={roleFilter} roles={["staff", "admin", "moderator", "technician"]} />
      <BackupTable columns={["Nombre", "Cargo", "Correo", "Rol", "Alta", "Estado", "Acciones"]}>
        {visibleUsers.map((user) => (
          <tr className="hover:bg-slate-50" key={user.id}>
            <td className="px-4 py-3 font-semibold text-slate-900">{adminUserName(user)}</td>
            <td className="px-4 py-3">{adminRoleLabel(user.role)}</td>
            <td className="px-4 py-3">{user.email || "N/D"}</td>
            <td className="px-4 py-3">{adminRoleLabel(user.role)}</td>
            <td className="px-4 py-3">{formatDateTime(user.date_joined)}</td>
            <td className="px-4 py-3"><BackupStatusBadge status={user.is_active ? "Activo" : "Suspendido"} /></td>
            <td className="px-4 py-3"><BackupActions labels={["Ver", "Editar", user.is_active ? "Suspender" : "Reactivar"]} onClick={(label) => { if (label === "Ver") setSelected(user); if (label === "Editar") setEditing(user); if (label === "Suspender" || label === "Reactivar") void toggleUser(user) }} /></td>
          </tr>
        ))}
      </BackupTable>
      {showCreateAdmin ? <AdministratorModal onClose={() => setShowCreateAdmin(false)} onSaved={() => { setShowCreateAdmin(false); void load() }} /> : null}
      {editing ? <AdministratorModal onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load() }} user={editing} /> : null}
      {selected ? <AdministratorDetailModal onClose={() => setSelected(null)} user={selected} /> : null}
    </div>
  )
}

function AdministratorModal({ onClose, onSaved, user }: { onClose: () => void; onSaved: () => void; user?: AdminUser }) {
  const [form, setForm] = useState({ email: user?.email || "", first_name: user?.first_name || "", last_name: user?.last_name || "", password: generateAdminPassword(), role: user?.role || "technician", username: user?.username || "" })
  const [message, setMessage] = useState("")
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const save = async (event: FormEvent) => {
    event.preventDefault()
    try {
      if (user) await adminApi.updateUser(user.id, { email: form.email, first_name: form.first_name, last_name: form.last_name, role: form.role as AdminUser["role"] })
      else await adminApi.createUser({ email: form.email, first_name: form.first_name, last_name: form.last_name, password: form.password, role: form.role as AdminUser["role"], username: form.username })
      onSaved()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el usuario.")
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
      <form className="w-full max-w-[920px] overflow-hidden rounded-lg bg-white shadow-2xl" onSubmit={save}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h3 className="text-lg font-bold">{user ? "Editar administrador" : "Anadir administrador"}</h3><p className="mt-1 text-sm text-slate-500">El alta queda registrada en usuarios reales del panel.</p></div><button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button></div>
        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_320px]">
          <section className="space-y-4">
            {message ? <BackupMessage message={message} /> : null}
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold">Datos del administrador</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {!user ? <AdminTextInput label="Usuario" onChange={(value) => update("username", value)} value={form.username} /> : <AdminField label="Usuario" value={form.username} />}
                <AdminTextInput label="Nombre" onChange={(value) => update("first_name", value)} value={form.first_name} />
                <AdminTextInput label="Apellido" onChange={(value) => update("last_name", value)} value={form.last_name} />
                <AdminTextInput label="Correo" onChange={(value) => update("email", value)} value={form.email} />
                <AdminField label="Fecha de alta" readonly value={user ? formatDateTime(user.date_joined) : formatDateTime(new Date().toISOString())} />
                {!user ? <div className="grid gap-2"><AdminTextInput label="Contrasena sugerida" onChange={(value) => update("password", value)} value={form.password} /><Button onClick={() => update("password", generateAdminPassword())} size="sm" type="button" variant="outline">Generar nueva</Button></div> : null}
                <label className="block"><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Rol</span><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("role", event.target.value)} value={form.role}><option value="admin">Administrador</option><option value="moderator">Moderador</option><option value="technician">Soporte tecnico</option></select></label>
              </div>
            </div>
          </section>
          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="eh-kicker">Restriccion critica</div><h4 className="mt-1 text-lg font-bold">Sin permiso de eliminar</h4><p className="mt-3 text-sm leading-6 text-slate-500">Ningun administrador nuevo puede eliminar cuentas, borrar informacion critica ni dar de baja el sistema. Solo la cuenta propietaria conserva ese nivel.</p><div className="mt-4 space-y-2"><AdminStatus label="Eliminar cuentas" value="Solo propietario" /><AdminStatus label="Baja definitiva" value="Solo propietario" /><AdminStatus label="Acceso staff" value="Completo limitado" /></div></aside>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3"><Button onClick={onClose} size="sm" type="button" variant="outline">Cancelar</Button><Button size="sm" type="submit">{user ? "Guardar cambios" : "Crear administrador"}</Button></div>
      </form>
    </div>
  )
}

function AdminRolesPage() {
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [query, setQuery] = useState("")
  const [message, setMessage] = useState("")
  const [selected, setSelected] = useState<AdminRole | null>(null)
  const [editing, setEditing] = useState<AdminRole | null>(null)
  const [duplicateSource, setDuplicateSource] = useState<AdminRole | null>(null)
  const [creating, setCreating] = useState(false)
  const load = async () => {
    try { const response = await adminApi.roles({ search: query || undefined }); setRoles(response.results); setMessage("") }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo cargar roles.") }
  }
  useEffect(() => { load() }, [])
  return <div className="space-y-4"><AdminUsersHeader action="Nuevo rol" description="Roles internos del staff y permisos base que se asignan a cada usuario administrativo." icon={Users} onAction={() => setCreating(true)} title="Roles" />{message ? <BackupMessage message={message} /> : null}<AdminRoleFilters onQueryChange={setQuery} onSearch={load} query={query} /><BackupTable columns={["Rol", "Descripcion", "Usuarios", "Estado", "Acciones"]}>{roles.map((item) => <tr className="hover:bg-slate-50" key={item.id}><td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td><td className="px-4 py-3">{item.description}</td><td className="px-4 py-3">{item.users_count}</td><td className="px-4 py-3"><BackupStatusBadge status="Activo" /></td><td className="px-4 py-3"><BackupActions labels={["Ver", "Editar", "Duplicar"]} onClick={(label) => { if (label === "Ver") setSelected(item); if (label === "Editar") setEditing(item); if (label === "Duplicar") setDuplicateSource(item) }} /></td></tr>)}</BackupTable>{creating ? <RoleModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void load() }} /> : null}{editing ? <RoleModal onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load() }} role={editing} /> : null}{duplicateSource ? <DuplicateRoleModal onClose={() => setDuplicateSource(null)} onSaved={() => { setDuplicateSource(null); void load() }} role={duplicateSource} /> : null}{selected ? <RoleDetailModal onClose={() => setSelected(null)} role={selected} /> : null}</div>
}

function AdminPermissionsPage() {
  const roleNames = ["Administrador", "Contabilidad", "Soporte tecnico"]
  const [permissions, setPermissions] = useState<AdminPermission[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [query, setQuery] = useState("")
  const [message, setMessage] = useState("")
  const load = async () => {
    try { const [permissionResponse, roleResponse] = await Promise.all([adminApi.permissions({ search: query || undefined }), adminApi.roles()]); setPermissions(permissionResponse.results); setRoles(roleResponse.results); setMessage("") }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo cargar permisos.") }
  }
  useEffect(() => { load() }, [])
  const togglePermission = async (roleName: string, permission: AdminPermission) => {
    const role = roles.find((item) => item.name === roleName)
    if (!role) return
    const enabled = role.permission_ids.includes(permission.id)
    const permissionIds = enabled ? role.permission_ids.filter((id) => id !== permission.id) : [...role.permission_ids, permission.id]
    await adminApi.updateRole(role.id, { permission_ids: permissionIds })
    await load()
  }
  return <div className="space-y-4"><AdminUsersHeader description="Matriz de permisos por rol para definir que puede hacer cada grupo de staff." icon={KeyRound} title="Permisos" />{message ? <BackupMessage message={message} /> : null}<AdminRoleFilters onQueryChange={setQuery} onSearch={load} query={query} /><div className="eh-card overflow-hidden"><div className="border-b border-slate-200 px-4 py-3"><h2 className="font-bold">Matriz de permisos</h2><p className="mt-1 text-sm text-slate-500">Permisos reales de Django por rol. La eliminacion definitiva queda fuera para todos excepto propietario.</p></div><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Modulo", "Administrador", "Contabilidad", "Soporte tecnico", "Regla avanzada"].map((column) => <th className="px-4 py-2 font-bold" key={column}>{column}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{permissions.map((permission) => <tr className="hover:bg-slate-50" key={permission.id}><td className="px-4 py-3 font-semibold text-slate-900">{permission.name}<span className="block text-xs font-normal text-slate-500">{permission.app}.{permission.codename}</span></td>{roleNames.map((roleName) => { const role = roles.find((item) => item.name === roleName); return <td className="px-4 py-3" key={roleName}><input checked={Boolean(role?.permission_ids.includes(permission.id))} onChange={() => void togglePermission(roleName, permission)} type="checkbox" /></td> })}<td className="px-4 py-3 text-slate-600">{permission.model || "global"}</td></tr>)}</tbody></table></div></div>
}

function AdminActiveSessionsPage() {
  const [sessions, setSessions] = useState<AdminAccessSession[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [message, setMessage] = useState("")
  const [selected, setSelected] = useState<AdminAccessSession | null>(null)
  const load = async () => {
    try { const response = await adminApi.accessSessions({ search: query || undefined, status: statusFilter || undefined }); setSessions(response.results); setMessage("") }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo cargar sesiones.") }
  }
  useEffect(() => { load() }, [])
  const closeSession = async (session: AdminAccessSession) => { await adminApi.closeAccessSession(session.id); await load() }
  const activeCount = sessions.filter((session) => session.status === "active").length
  return <div className="space-y-4"><AdminUsersHeader description="Sesiones iniciadas por clientes, revendedores, administradores y staff, con IP, dispositivo y estado." icon={ShieldCheck} title="Sesiones activas" />{message ? <BackupMessage message={message} /> : null}<section className="grid gap-3 xl:grid-cols-4"><AdminMetric label="Activas" value={String(activeCount)} detail="En este momento" /><AdminMetric label="Staff" value={String(sessions.filter((session) => ["admin", "moderator", "technician"].includes(session.role)).length)} detail="Admin y soporte" /><AdminMetric label="Clientes" value={String(sessions.filter((session) => session.role === "client").length)} detail="Panel cliente" /><AdminMetric label="Ubicaciones" value={String(new Set(sessions.map((session) => session.location).filter(Boolean)).size)} detail="Paises detectados" /></section><AdminSessionFilters onQueryChange={setQuery} onSearch={load} onStatusChange={setStatusFilter} query={query} statusFilter={statusFilter} /><BackupTable columns={["Usuario", "Rol", "IP", "Ubicacion", "Dispositivo", "Ultima actividad", "Estado", "Acciones"]}>{sessions.map((session) => <tr className="hover:bg-slate-50" key={session.id}><td className="px-4 py-3 font-semibold text-slate-900">{session.email || session.username}</td><td className="px-4 py-3">{adminRoleLabel(session.role)}</td><td className="px-4 py-3">{session.ip_address || "N/D"}</td><td className="px-4 py-3">{session.location || "N/D"}</td><td className="px-4 py-3">{session.device || "N/D"}</td><td className="px-4 py-3">{formatDateTime(session.last_seen_at || session.created_at)}</td><td className="px-4 py-3"><BackupStatusBadge status={session.status === "active" ? "Activo" : "Pausada"} /></td><td className="px-4 py-3"><BackupActions labels={session.status === "active" ? ["Ver", "Cerrar sesion"] : ["Ver"]} onClick={(label) => { if (label === "Ver") setSelected(session); if (label === "Cerrar sesion") void closeSession(session) }} /></td></tr>)}</BackupTable>{selected ? <SessionDetailModal onClose={() => setSelected(null)} session={selected} /> : null}</div>
}

function AdminAccessSecurityPage() {
  const [settings, setSettings] = useState<AdminAccessSecurity | null>(null)
  const [message, setMessage] = useState("")
  const load = async () => {
    try { setSettings(await adminApi.accessSecurity()); setMessage("") }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo cargar seguridad de acceso.") }
  }
  useEffect(() => { load() }, [])
  const update = (key: keyof AdminAccessSecurity, value: AdminAccessSecurity[keyof AdminAccessSecurity]) => setSettings((current) => current ? { ...current, [key]: value } : current)
  const save = async () => {
    if (!settings) return
    try { setSettings(await adminApi.saveAccessSecurity(settings)); setMessage("Configuracion guardada.") }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar seguridad de acceso.") }
  }
  const allowlistText = settings?.admin_ip_allowlist.join("\n") || ""
  return <div className="space-y-4"><AdminUsersHeader description="Politicas de acceso para proteger el panel administrativo y reducir accesos no autorizados." icon={ShieldCheck} title="Seguridad de acceso" />{message ? <BackupMessage message={message} /> : null}<section className="grid gap-3 xl:grid-cols-4"><AdminMetric label="2FA requerido" value={settings?.require_2fa_staff ? "Staff" : "Opcional"} detail="Admin y soporte" /><AdminMetric label="Intentos fallidos" value={String(settings?.failed_login_limit || 0)} detail={String(settings?.failed_login_window_minutes || 0) + " minutos"} /><AdminMetric label="IPs permitidas" value={String(settings?.admin_ip_allowlist.length || 0)} detail="Lista blanca admin" /><AdminMetric label="Alertas" value={settings?.alert_new_device ? "Activas" : "Pausadas"} detail="Nuevos dispositivos" /></section><section className="grid gap-4 xl:grid-cols-[1fr_340px]"><div className="eh-card p-4"><h2 className="font-bold">Politicas recomendadas</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold"><input checked={Boolean(settings?.require_2fa_staff)} onChange={(event) => update("require_2fa_staff", event.target.checked)} type="checkbox" />Doble factor obligatorio</label><label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold"><input checked={Boolean(settings?.alert_new_device)} onChange={(event) => update("alert_new_device", event.target.checked)} type="checkbox" />Alerta por dispositivo nuevo</label><label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold"><input checked={Boolean(settings?.critical_actions_owner_only)} onChange={(event) => update("critical_actions_owner_only", event.target.checked)} type="checkbox" />Acciones criticas solo propietario</label><AdminNumberInput label="Intentos fallidos" onChange={(value) => update("failed_login_limit", value)} value={settings?.failed_login_limit || 5} /><AdminNumberInput label="Ventana minutos" onChange={(value) => update("failed_login_window_minutes", value)} value={settings?.failed_login_window_minutes || 10} /><AdminNumberInput label="Caducidad horas" onChange={(value) => update("session_timeout_hours", value)} value={settings?.session_timeout_hours || 8} /><label className="block md:col-span-2"><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Lista blanca IP admin</span><textarea className="min-h-[120px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("admin_ip_allowlist", event.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))} value={allowlistText} /></label><Button onClick={save} size="sm" type="button">Guardar cambios</Button></div></div><aside className="eh-card p-4"><div className="eh-kicker">Criterio</div><h3 className="mt-1 text-lg font-bold">Propietario como control final</h3><p className="mt-3 text-sm leading-6 text-slate-500">Esta seccion centraliza 2FA, sesiones, restricciones IP, dispositivos confiables y acciones criticas. Las eliminaciones y bajas definitivas quedan reservadas para la cuenta propietaria.</p></aside></section></div>
}

function AdminUserFilters({ onFilterChange, onQueryChange, onSearch, query, roleFilter, roles }: { onFilterChange: (value: string) => void; onQueryChange: (value: string) => void; onSearch: () => void; query: string; roleFilter: string; roles: string[] }) {
  return <div className="eh-card flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div className="flex h-9 w-[420px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"><Search className="h-4 w-4" /><input className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => onQueryChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSearch() }} placeholder="Buscar administrador, cargo, correo o rol..." value={query} /></div><div className="flex gap-2"><select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold" onChange={(event) => onFilterChange(event.target.value)} value={roleFilter}>{roles.map((role) => <option key={role} value={role}>{role === "staff" ? "Todo staff" : adminRoleLabel(role)}</option>)}</select><Button onClick={onSearch} size="sm" variant="outline">Filtrar</Button></div></div>
}

function AdminRoleFilters({ onQueryChange, onSearch, query }: { onQueryChange: (value: string) => void; onSearch: () => void; query: string }) {
  return <div className="eh-card flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div className="flex h-9 w-[420px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"><Search className="h-4 w-4" /><input className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => onQueryChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSearch() }} placeholder="Buscar rol, permiso o descripcion..." value={query} /></div><Button onClick={onSearch} size="sm" variant="outline">Buscar</Button></div>
}

function AdminSessionFilters({ onQueryChange, onSearch, onStatusChange, query, statusFilter }: { onQueryChange: (value: string) => void; onSearch: () => void; onStatusChange: (value: string) => void; query: string; statusFilter: string }) {
  return <div className="eh-card flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div className="flex h-9 w-[420px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"><Search className="h-4 w-4" /><input className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => onQueryChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSearch() }} placeholder="Buscar usuario, IP, rol o dispositivo..." value={query} /></div><div className="flex gap-2"><select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold" onChange={(event) => onStatusChange(event.target.value)} value={statusFilter}><option value="">Todos</option><option value="active">Activas</option><option value="closed">Cerradas</option><option value="expired">Expiradas</option></select><Button onClick={onSearch} size="sm" variant="outline">Filtrar</Button></div></div>
}

function AdministratorDetailModal({ onClose, user }: { onClose: () => void; user: AdminUser }) {
  return <AdminModalFrame kicker="Administrador" onClose={onClose} title={adminUserName(user)}><div className="grid gap-3 md:grid-cols-2"><AdminStatus label="Usuario" value={user.username} /><AdminStatus label="Correo" value={user.email || "N/D"} /><AdminStatus label="Rol" value={adminRoleLabel(user.role)} /><AdminStatus label="Estado" value={user.is_active ? "Activo" : "Suspendido"} /><AdminStatus label="Fecha de alta" value={formatDateTime(user.date_joined)} /><AdminStatus label="Staff" value={user.is_staff ? "Si" : "No"} /></div></AdminModalFrame>
}

function RoleModal({ onClose, onSaved, role }: { onClose: () => void; onSaved: () => void; role?: AdminRole }) {
  const [name, setName] = useState(role?.name || "")
  const [message, setMessage] = useState("")
  const save = async (event: FormEvent) => { event.preventDefault(); try { if (role) await adminApi.updateRole(role.id, { name }); else await adminApi.createRole({ name }); onSaved() } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar el rol.") } }
  return <AdminModalFrame kicker="Rol" onClose={onClose} title={role ? "Editar rol" : "Nuevo rol"}><form className="space-y-4" onSubmit={save}>{message ? <BackupMessage message={message} /> : null}<AdminTextInput label="Nombre del rol" onChange={setName} value={name} /><div className="flex justify-end gap-2"><Button onClick={onClose} size="sm" type="button" variant="outline">Cancelar</Button><Button size="sm" type="submit">Guardar</Button></div></form></AdminModalFrame>
}

function DuplicateRoleModal({ onClose, onSaved, role }: { onClose: () => void; onSaved: () => void; role: AdminRole }) {
  const [name, setName] = useState(role.name + " copia")
  const [message, setMessage] = useState("")
  const save = async (event: FormEvent) => { event.preventDefault(); try { await adminApi.duplicateRole(role.id, name); onSaved() } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo duplicar el rol.") } }
  return <AdminModalFrame kicker="Duplicar rol" onClose={onClose} title={role.name}><form className="space-y-4" onSubmit={save}>{message ? <BackupMessage message={message} /> : null}<AdminTextInput label="Nuevo nombre" onChange={setName} value={name} /><div className="flex justify-end gap-2"><Button onClick={onClose} size="sm" type="button" variant="outline">Cancelar</Button><Button size="sm" type="submit">Duplicar</Button></div></form></AdminModalFrame>
}

function RoleDetailModal({ onClose, role }: { onClose: () => void; role: AdminRole }) {
  return <AdminModalFrame kicker="Rol" onClose={onClose} title={role.name}><div className="space-y-3"><AdminStatus label="Usuarios" value={String(role.users_count)} /><AdminStatus label="Estado" value="Activo" /><AdminStatus label="Descripcion" value={role.description} /><div className="rounded-md border border-slate-200 bg-slate-50 p-3"><p className="text-sm font-bold">Permisos asignados</p><div className="mt-2 max-h-[260px] overflow-auto text-sm text-slate-600">{role.permissions_detail.length ? role.permissions_detail.map((permission) => <p key={permission.id}>{permission.name}</p>) : <p>Sin permisos asignados.</p>}</div></div></div></AdminModalFrame>
}

function SessionDetailModal({ onClose, session }: { onClose: () => void; session: AdminAccessSession }) {
  return <AdminModalFrame kicker="Sesion" onClose={onClose} title={session.email || session.username}><div className="grid gap-3 md:grid-cols-2"><AdminStatus label="Usuario" value={session.username} /><AdminStatus label="Rol" value={adminRoleLabel(session.role)} /><AdminStatus label="IP" value={session.ip_address || "N/D"} /><AdminStatus label="Ubicacion" value={session.location || "N/D"} /><AdminStatus label="Dispositivo" value={session.device || "N/D"} /><AdminStatus label="Estado" value={session.status_label} /><AdminStatus label="Inicio" value={formatDateTime(session.created_at)} /><AdminStatus label="Ultima actividad" value={formatDateTime(session.last_seen_at || session.created_at)} /></div></AdminModalFrame>
}

function AdminNumberInput({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span><input className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" min={1} onChange={(event) => onChange(Number(event.target.value))} type="number" value={value} /></label>
}

function adminUserName(user: AdminUser) {
  return (String(user.first_name || "") + " " + String(user.last_name || "")).trim() || user.username
}

function adminRoleLabel(role: string) {
  return ({ admin: "Administrador", client: "Cliente", moderator: "Moderador", reseller: "Revendedor", technician: "Soporte tecnico" } as Record<string, string>)[role] || role
}

function generateAdminPassword() {
  return "EHAdm-" + Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + new Date().getFullYear()
}

function AdminUsersHeader({
  action,
  description,
  icon: Icon,
  onAction,
  title,
}: {
  action?: string
  description: string
  icon: LucideIcon
  onAction?: () => void
  title: string
}) {
  return (
    <section className="eh-card px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="eh-kicker">Usuarios y permisos</div>
            <h1 className="mt-1 text-xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
          </div>
        </div>
        {action ? <Button onClick={onAction} size="sm">{action}</Button> : null}
      </div>
    </section>
  )
}

function AdminConfigHeader({ action = "Guardar cambios", description, icon: Icon, onAction, title }: { action?: string; description: string; icon: LucideIcon; onAction?: () => void; title: string }) {
  return (
    <section className="eh-card px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="eh-kicker">Configuracion</div>
            <h1 className="mt-1 text-xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
          </div>
        </div>
        <Button onClick={onAction} size="sm" type="button">{action}</Button>
      </div>
    </section>
  )
}


function AdminGlobalSettingsPage() {
  const [configuration, setConfiguration] = useState<HostingConfiguration | null>(null)
  const [form, setForm] = useState(defaultGlobalSettings())
  const [message, setMessage] = useState("")

  const load = async () => {
    try {
      const config = await hostingApi.configuration()
      setConfiguration(config)
      setForm(readGlobalSettings(config))
      setMessage("")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar parametros globales.")
    }
  }

  useEffect(() => {
    load()
  }, [])

  const update = (key: keyof GlobalSettingsForm, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const save = async () => {
    if (!configuration) return
    try {
      const saved = await hostingApi.updateConfiguration({
        mail_defaults: {
          ...configuration.mail_defaults,
          system_email: form.system_email,
        },
        policies: {
          ...configuration.policies,
          global_settings: form,
        },
      })
      setConfiguration(saved)
      setForm(readGlobalSettings(saved))
      setMessage("Parametros globales guardados.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar parametros globales.")
    }
  }

  return (
    <div className="space-y-4">
      <AdminConfigHeader description="Parametros generales del panel: marca base, zona horaria, idioma, politicas por defecto y comportamiento global." icon={Settings2} onAction={save} title="Parametros globales" />
      {message ? <BackupMessage message={message} /> : null}
      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Idioma base" value={form.default_language} detail="Configurado en base" />
        <AdminMetric label="Zona horaria" value={form.timezone} detail="Servidor admin" />
        <AdminMetric label="Modo panel" value={form.panel_mode} detail="Configuracion real" />
        <AdminMetric label="Mantenimiento" value={form.maintenance_mode} detail="Estado global" />
      </section>
      <section className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="eh-card p-4">
          <h2 className="font-bold">Configuracion base</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <AdminTextInput label="Nombre del panel" onChange={(value) => update("panel_name", value)} value={form.panel_name} />
            <AdminTextInput label="Dominio principal" onChange={(value) => update("primary_domain", value)} value={form.primary_domain} />
            <AdminTextInput label="Correo sistema" onChange={(value) => update("system_email", value)} value={form.system_email} />
            <AdminTextInput label="Zona horaria" onChange={(value) => update("timezone", value)} value={form.timezone} />
            <label className="block"><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Idioma por defecto</span><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("default_language", event.target.value)} value={form.default_language}><option value="Espanol">Espanol</option><option value="English">English</option></select></label>
            <AdminTextInput label="Retencion logs" onChange={(value) => update("log_retention", value)} value={form.log_retention} />
            <label className="block"><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Modo panel</span><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("panel_mode", event.target.value)} value={form.panel_mode}><option value="Produccion">Produccion</option><option value="Staging">Staging</option><option value="Mantenimiento">Mantenimiento</option></select></label>
            <label className="block"><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Mantenimiento</span><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("maintenance_mode", event.target.value)} value={form.maintenance_mode}><option value="Inactivo">Inactivo</option><option value="Programado">Programado</option><option value="Activo">Activo</option></select></label>
          </div>
        </div>
        <aside className="eh-card p-4">
          <div className="eh-kicker">Politicas</div>
          <h3 className="mt-1 text-lg font-bold">Valores por defecto</h3>
          <div className="mt-4 space-y-2">
            <AdminStatus label="Dominio principal" value={form.primary_domain || "N/D"} />
            <AdminStatus label="Correo sistema" value={form.system_email || "N/D"} />
            <AdminStatus label="Crear SSL" value={form.auto_ssl} />
            <AdminStatus label="Backups" value={form.backup_policy} />
            <AdminStatus label="WAF" value={form.waf_policy} />
            <AdminStatus label="Suspensiones" value={form.suspension_policy} />
          </div>
        </aside>
      </section>
    </div>
  )
}

type GlobalSettingsForm = {
  auto_ssl: string
  backup_policy: string
  default_language: string
  log_retention: string
  maintenance_mode: string
  panel_mode: string
  panel_name: string
  primary_domain: string
  suspension_policy: string
  system_email: string
  timezone: string
  waf_policy: string
}

function defaultGlobalSettings(): GlobalSettingsForm {
  return {
    auto_ssl: "Automatico",
    backup_policy: "Politica global",
    default_language: "Espanol",
    log_retention: "90 dias",
    maintenance_mode: "Inactivo",
    panel_mode: "Produccion",
    panel_name: "EHPanel Web",
    primary_domain: "web.ehclouding.com",
    suspension_policy: "Manual/admin",
    system_email: "noreply@ehclouding.com",
    timezone: "America/La_Paz",
    waf_policy: "Monitoreo 24h",
  }
}

function readGlobalSettings(configuration: HostingConfiguration): GlobalSettingsForm {
  const defaults = defaultGlobalSettings()
  const policies = configuration.policies || {}
  const settings = typeof policies.global_settings === "object" && policies.global_settings !== null && !Array.isArray(policies.global_settings) ? policies.global_settings as Partial<GlobalSettingsForm> : {}
  const mailDefaults = configuration.mail_defaults || {}
  return {
    ...defaults,
    ...settings,
    primary_domain: String(settings.primary_domain || defaults.primary_domain),
    system_email: String(settings.system_email || mailDefaults.system_email || defaults.system_email),
  }
}

function AdminWebEnginePage() {
  const [configuration, setConfiguration] = useState<HostingConfiguration | null>(null)
  const [nodes, setNodes] = useState<AdminNode[]>([])
  const [query, setQuery] = useState("")
  const [message, setMessage] = useState("")
  const [selected, setSelected] = useState<WebEngineNodeRow | null>(null)
  const [busy, setBusy] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const load = () => {
    setIsLoading(true)
    setMessage("")
    Promise.all([hostingApi.configuration(), adminApi.nodes()])
      .then(([config, nodePage]) => {
        setConfiguration(config)
        setNodes(nodePage.results)
      })
      .catch((error: Error) => setMessage(error.message || "No se pudo cargar motor web."))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const settings = readWebEngineSettings(configuration)
  const rows = nodes.map((node) => webEngineNodeRow(node, settings))
  const filteredRows = rows.filter((row) => !query.trim() || [row.hostname, row.engine, row.service, row.status, row.version, row.port].join(" ").toLowerCase().includes(query.trim().toLowerCase()))
  const activeRows = rows.filter((row) => row.status === "Activo").length
  const problemRows = rows.filter((row) => row.status === "Problemas" || row.status === "Sin reporte").length

  const saveSettings = async () => {
    if (!configuration) return
    try {
      const saved = await hostingApi.updateConfiguration({
        policies: {
          ...configuration.policies,
          web_engine: settings,
        },
      })
      setConfiguration(saved)
      setMessage("Motor web guardado como OpenLiteSpeed.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar motor web.")
    }
  }

  const sendAction = async (row: WebEngineNodeRow, action: string) => {
    setBusy(`${row.nodeId}:${action}`)
    setMessage("")
    try {
      await adminApi.serviceAction(row.nodeId, { action, service: row.service })
      setMessage(`Orden ${action} enviada a ${row.service} en ${row.hostname}.`)
      load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo enviar la accion al nodo.")
    } finally {
      setBusy("")
    }
  }

  return (
    <div className="space-y-4">
      <AdminConfigHeader description="Motor web principal para cuentas, panel y servicios internos. La plataforma queda estandarizada en OpenLiteSpeed." icon={Server} onAction={saveSettings} title="Motor web" />
      {message ? <BackupMessage message={message} /> : null}
      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Motor activo" value="OpenLiteSpeed" detail="Estandar global" />
        <AdminMetric label="Servicio" value={settings.service} detail="Unidad systemd" />
        <AdminMetric label="Nodos activos" value={`${activeRows}/${rows.length}`} detail="Reportando OLS" />
        <AdminMetric label="Revisar" value={String(problemRows)} detail="Sin reporte o problemas" />
      </section>
      <section className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="eh-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex h-9 w-[420px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              <input className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nodo, servicio, version o estado..." value={query} />
            </div>
            <Button disabled={isLoading} onClick={load} size="sm" variant="outline">{isLoading ? "Actualizando" : "Actualizar"}</Button>
          </div>
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Nodo", "Motor", "Servicio", "Puerto", "Estado", "Version", "Ultima lectura", "Acciones"].map((column) => <th className="px-4 py-2 font-bold" key={column}>{column}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <tr className="hover:bg-slate-50" key={row.nodeId}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.hostname}<span className="block font-mono text-xs font-normal text-slate-500">{row.ip}</span></td>
                  <td className="px-4 py-3">{row.engine}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.service}</td>
                  <td className="px-4 py-3">{row.port}</td>
                  <td className="px-4 py-3"><ServiceStatusBadge status={row.status === "Sin reporte" ? "Problemas" : row.status} /></td>
                  <td className="px-4 py-3">{row.version}</td>
                  <td className="px-4 py-3">{row.lastSeen}</td>
                  <td className="px-4 py-3"><BackupActions labels={["Ver", "Estado", "Recargar", "Reiniciar"]} onClick={(label) => { if (label === "Ver") setSelected(row); if (label === "Estado") void sendAction(row, "status"); if (label === "Recargar") void sendAction(row, "reload"); if (label === "Reiniciar") void sendAction(row, "restart") }} /></td>
                </tr>
              ))}
              {!isLoading && filteredRows.length === 0 ? <tr><td className="px-4 py-4 text-sm font-semibold text-slate-500" colSpan={8}>No hay nodos o servicios que coincidan con la busqueda.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <aside className="eh-card p-4">
          <div className="eh-kicker">Configuracion activa</div>
          <h3 className="mt-1 text-lg font-bold">OpenLiteSpeed</h3>
          <div className="mt-4 space-y-2">
            <AdminStatus label="Servicio" value={settings.service} />
            <AdminStatus label="Admin OLS" value={settings.admin_port} />
            <AdminStatus label="Publico" value={settings.public_ports} />
            <AdminStatus label="PHP handler" value={settings.php_handler} />
            <AdminStatus label="Provisionamiento" value={settings.provisioning} />
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-500">Estos valores quedan guardados en base y las acciones se ejecutan sobre el nodo seleccionado.</p>
        </aside>
      </section>
      {selected ? <WebEngineDetailModal busy={busy.startsWith(selected.nodeId)} onAction={(action) => void sendAction(selected, action)} onClose={() => setSelected(null)} row={selected} /> : null}
    </div>
  )
}

type WebEngineSettings = {
  admin_port: string
  engine: string
  php_handler: string
  provisioning: string
  public_ports: string
  service: string
}

type WebEngineNodeRow = {
  engine: string
  hostname: string
  ip: string
  lastSeen: string
  nodeId: string
  port: string
  raw: Record<string, unknown>
  service: string
  status: string
  version: string
}

function defaultWebEngineSettings(): WebEngineSettings {
  return { admin_port: "7080", engine: "OpenLiteSpeed", php_handler: "lsphp", provisioning: "OpenLiteSpeed hosting", public_ports: "80 / 443", service: "lshttpd" }
}

function readWebEngineSettings(configuration: HostingConfiguration | null): WebEngineSettings {
  const defaults = defaultWebEngineSettings()
  const policies = configuration?.policies || {}
  const settings = typeof policies.web_engine === "object" && policies.web_engine !== null && !Array.isArray(policies.web_engine) ? policies.web_engine as Partial<WebEngineSettings> : {}
  return { ...defaults, ...settings, engine: "OpenLiteSpeed", service: normalizeOpenLiteSpeedUnit(String(settings.service || defaults.service)) }
}

function webEngineNodeRow(node: AdminNode, settings: WebEngineSettings): WebEngineNodeRow {
  const services = systemServiceRows(node)
  const olsService = services.find((service) => isOpenLiteSpeedService(service.serviceKey) || isOpenLiteSpeedService(service.name))
  const raw = olsService?.raw || { expected_service: settings.service, source: "configuration", message: "El nodo aun no reporta OpenLiteSpeed." }
  return {
    engine: settings.engine,
    hostname: node.hostname,
    ip: node.public_ip || "IP N/D",
    lastSeen: formatDateTime(node.last_seen_at),
    nodeId: node.id,
    port: olsService?.port && olsService.port !== "N/D" ? olsService.port : settings.public_ports,
    raw,
    service: olsService?.serviceKey || settings.service,
    status: olsService?.status || "Sin reporte",
    version: textFromUnknown(raw.version) || textFromUnknown(raw.release) || node.agent_version || "N/D",
  }
}

function isOpenLiteSpeedService(value: string) {
  const normalized = value.toLowerCase()
  return normalized.includes("openlitespeed") || normalized.includes("litespeed") || normalized === "lshttpd" || normalized.includes("lshttpd") || normalized === "lsws" || normalized.includes("lsws")
}

function normalizeOpenLiteSpeedUnit(value: string) {
  return value.trim().toLowerCase() === "lsws" ? "lshttpd" : value
}

function WebEngineDetailModal({ busy, onAction, onClose, row }: { busy: boolean; onAction: (action: string) => void; onClose: () => void; row: WebEngineNodeRow }) {
  return (
    <AdminModalFrame kicker={row.hostname} onClose={onClose} title="OpenLiteSpeed">
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <AdminStatus label="Nodo" value={row.hostname} />
          <AdminStatus label="IP" value={row.ip} />
          <AdminStatus label="Servicio" value={row.service} />
          <AdminStatus label="Estado" value={row.status} />
          <AdminStatus label="Version" value={row.version} />
          <AdminStatus label="Puerto" value={row.port} />
        </div>
        <div><div className="mb-2 text-sm font-bold text-slate-900">Detalle reportado</div><pre className="max-h-64 overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(row.raw, null, 2)}</pre></div>
        <div className="flex flex-wrap justify-end gap-2">{["status", "reload", "restart", "start", "stop"].map((action) => <Button disabled={busy} key={action} onClick={() => onAction(action)} size="sm" type="button" variant={action === "stop" ? "outline" : "default"}>{busy ? "Enviando" : action}</Button>)}</div>
      </div>
    </AdminModalFrame>
  )
}
function AdminPhpVersionsPage() {
  const [nodes, setNodes] = useState<AdminNode[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [selected, setSelected] = useState<PhpVersionRow | null>(null)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const load = () => {
    setIsLoading(true)
    setMessage("")
    adminApi.nodes()
      .then((page) => setNodes(page.results))
      .catch((error: Error) => setMessage(error.message || "No se pudieron cargar versiones PHP."))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const rows = nodes.flatMap((node) => phpVersionRowsFromNode(node))
  const filteredRows = rows.filter((row) => {
    const haystack = [row.version, row.handler, row.nodeHostname, row.status, row.binary, row.sapi].join(" ").toLowerCase()
    const matchesSearch = !query.trim() || haystack.includes(query.trim().toLowerCase())
    const matchesStatus = !statusFilter || row.status === statusFilter
    return matchesSearch && matchesStatus
  })
  const uniqueVersions = new Set(rows.map((row) => row.version)).size
  const activeRows = rows.filter((row) => row.status === "Disponible" || row.status === "Recomendado").length
  const legacyRows = rows.filter((row) => row.status === "Legacy").length
  const recommended = recommendedPhpVersion(rows)

  const refreshNode = async (nodeId: string, hostname: string) => {
    setBusy(nodeId)
    setMessage("")
    try {
      await adminApi.serviceAction(nodeId, { action: "php_versions", service: "php" })
      setMessage(`Orden de refresco PHP enviada a ${hostname}.`)
      load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo solicitar el refresco PHP al agente.")
    } finally {
      setBusy("")
    }
  }

  return (
    <div className="space-y-4">
      <AdminConfigHeader description="Versiones PHP instaladas reportadas por cada nodo. Para OpenLiteSpeed se priorizan handlers lsphp." icon={Code2} onAction={load} action={isLoading ? "Actualizando" : "Actualizar"} title="Versiones PHP" />
      {message ? <BackupMessage message={message} /> : null}
      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Versiones" value={String(uniqueVersions)} detail={`${rows.length} instalaciones reportadas`} />
        <AdminMetric label="Recomendada" value={recommended} detail="Mayor version estable reportada" />
        <AdminMetric label="Legacy" value={String(legacyRows)} detail="Evitar nuevas cuentas" />
        <AdminMetric label="Activas" value={String(activeRows)} detail={`${nodes.length} nodos consultados`} />
      </section>
      <div className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex h-9 w-[430px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar version, handler, nodo o estado..." value={query} />
          </div>
          <div className="flex gap-2">
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="">Estado</option>
              {Array.from(new Set(rows.map((row) => row.status))).map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <Button disabled={isLoading} onClick={load} size="sm" variant="outline">Actualizar</Button>
          </div>
        </div>
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{["Version", "Handler", "Nodo", "Binario", "SAPI", "Uso", "Soporte", "Estado", "Acciones"].map((column) => <th className="px-4 py-2 font-bold" key={column}>{column}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.map((row) => (
              <tr className="hover:bg-slate-50" key={`${row.nodeId}-${row.version}-${row.handler}-${row.binary}`}>
                <td className="px-4 py-3 font-semibold text-slate-900">{row.version}</td>
                <td className="px-4 py-3">{row.handler}</td>
                <td className="px-4 py-3">{row.nodeHostname}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.binary}</td>
                <td className="px-4 py-3">{row.sapi}</td>
                <td className="px-4 py-3">{row.usage}</td>
                <td className="px-4 py-3">{row.support}</td>
                <td className="px-4 py-3"><PhpStatusBadge status={row.status} /></td>
                <td className="px-4 py-3"><BackupActions labels={["Ver", "Refrescar"]} onClick={(label) => { if (label === "Ver") setSelected(row); if (label === "Refrescar") void refreshNode(row.nodeId, row.nodeHostname) }} /></td>
              </tr>
            ))}
            {!isLoading && filteredRows.length === 0 ? <tr><td className="px-4 py-4 text-sm font-semibold text-slate-500" colSpan={9}>El nodo aun no ha reportado versiones PHP instaladas.</td></tr> : null}
          </tbody>
        </table>
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Mostrando {filteredRows.length} de {rows.length} versiones reportadas</div>
      </div>
      {selected ? <PhpVersionDetailModal busy={busy === selected.nodeId} onClose={() => setSelected(null)} onRefresh={() => void refreshNode(selected.nodeId, selected.nodeHostname)} row={selected} /> : null}
    </div>
  )
}

type PhpVersionRow = {
  binary: string
  handler: string
  nodeHostname: string
  nodeId: string
  raw: Record<string, unknown>
  sapi: string
  status: string
  support: string
  usage: string
  version: string
}

function phpVersionRowsFromNode(node: AdminNode): PhpVersionRow[] {
  const sources = [node.capabilities, node.last_telemetry]
  const rows: PhpVersionRow[] = []
  for (const source of sources) {
    if (!source || typeof source !== "object") continue
    rows.push(...phpRowsFromUnknown((source as Record<string, unknown>).php_versions, node))
    rows.push(...phpRowsFromUnknown((source as Record<string, unknown>).lsphp_versions, node))
    const php = (source as Record<string, unknown>).php
    if (php && typeof php === "object") {
      const phpObject = php as Record<string, unknown>
      rows.push(...phpRowsFromUnknown(phpObject.versions, node))
      rows.push(...phpRowsFromUnknown(phpObject.installed, node))
    }
  }
  rows.push(...phpRowsFromServices(node))
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = `${row.nodeId}:${row.version}:${row.handler}:${row.binary}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => comparePhpVersions(b.version, a.version))
}

function phpRowsFromUnknown(value: unknown, node: AdminNode): PhpVersionRow[] {
  if (!value) return []
  if (Array.isArray(value)) return value.map((item) => phpRowFromValue(item, node)).filter((row): row is PhpVersionRow => Boolean(row))
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([key, item]) => phpRowFromValue(typeof item === "object" && item !== null ? { version: key, ...(item as Record<string, unknown>) } : { version: key, value: item }, node)).filter((row): row is PhpVersionRow => Boolean(row))
  }
  if (typeof value === "string") return value.split(/[\s,]+/).map((item) => phpRowFromValue(item, node)).filter((row): row is PhpVersionRow => Boolean(row))
  return []
}

function phpRowFromValue(value: unknown, node: AdminNode): PhpVersionRow | null {
  if (typeof value === "string" || typeof value === "number") {
    const version = normalizePhpVersion(String(value))
    if (!version) return null
    return buildPhpRow(node, version, { version })
  }
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  const version = normalizePhpVersion(textFromUnknown(raw.version) || textFromUnknown(raw.branch) || textFromUnknown(raw.name) || textFromUnknown(raw.php))
  if (!version) return null
  return buildPhpRow(node, version, raw)
}

function phpRowsFromServices(node: AdminNode): PhpVersionRow[] {
  return systemServiceRows(node)
    .map((service) => {
      const version = normalizePhpVersion(service.serviceKey) || normalizePhpVersion(service.name)
      if (!version || !isPhpServiceName(service.serviceKey || service.name)) return null
      return buildPhpRow(node, version, { ...service.raw, service: service.serviceKey, status: service.status })
    })
    .filter((row): row is PhpVersionRow => Boolean(row))
}

function buildPhpRow(node: AdminNode, version: string, raw: Record<string, unknown>): PhpVersionRow {
  const handler = textFromUnknown(raw.handler) || textFromUnknown(raw.sapi) || (isOpenLiteSpeedPhp(raw) ? `lsphp${version.replace(".", "")}` : "lsphp")
  return {
    binary: textFromUnknown(raw.binary) || textFromUnknown(raw.path) || `/usr/local/lsws/lsphp${version.replace(".", "")}/bin/php`,
    handler,
    nodeHostname: node.hostname,
    nodeId: node.id,
    raw,
    sapi: textFromUnknown(raw.sapi) || textFromUnknown(raw.server_api) || "lsapi/fpm",
    status: phpStatus(version, raw),
    support: textFromUnknown(raw.support) || textFromUnknown(raw.eol) || phpSupportLabel(version),
    usage: textFromUnknown(raw.usage) || textFromUnknown(raw.accounts) || textFromUnknown(raw.sites) || "Reportado",
    version,
  }
}

function normalizePhpVersion(value: string) {
  const match = value.match(/(?:php|lsphp)?\s*([0-9]+\.[0-9]+)(?:\.[0-9]+)?/i)
  return match ? match[1] : ""
}

function isPhpServiceName(value: string) {
  return /php|lsphp/i.test(value)
}

function isOpenLiteSpeedPhp(raw: Record<string, unknown>) {
  return [raw.handler, raw.sapi, raw.binary, raw.path, raw.service].map(textFromUnknown).join(" ").toLowerCase().includes("lsphp")
}

function phpStatus(version: string, raw: Record<string, unknown>) {
  const rawStatus = textFromUnknown(raw.status)
  if (rawStatus && !["Activo", "active", "running"].includes(rawStatus)) return rawStatus
  const numeric = Number(version)
  if (numeric < 8.1) return "Legacy"
  if (numeric >= 8.3 && numeric <= 8.5) return numeric === 8.3 ? "Recomendado" : "Disponible"
  if (numeric === 8.2) return "Disponible"
  return "Disponible"
}

function phpSupportLabel(version: string) {
  const numeric = Number(version)
  if (numeric < 8.1) return "Sin soporte"
  if (numeric === 8.1) return "Seguridad"
  if (numeric >= 8.2 && numeric <= 8.5) return "Activo"
  return "N/D"
}

function comparePhpVersions(a: string, b: string) {
  return Number(a) - Number(b)
}

function recommendedPhpVersion(rows: PhpVersionRow[]) {
  const candidates = rows.filter((row) => row.status === "Recomendado" || row.status === "Disponible").map((row) => row.version).sort(comparePhpVersions)
  return candidates.at(-1) || "N/D"
}

function PhpVersionDetailModal({ busy, onClose, onRefresh, row }: { busy: boolean; onClose: () => void; onRefresh: () => void; row: PhpVersionRow }) {
  return (
    <AdminModalFrame kicker={row.nodeHostname} onClose={onClose} title={`PHP ${row.version}`}>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <AdminStatus label="Handler" value={row.handler} />
          <AdminStatus label="Binario" value={row.binary} />
          <AdminStatus label="SAPI" value={row.sapi} />
          <AdminStatus label="Soporte" value={row.support} />
          <AdminStatus label="Uso" value={row.usage} />
          <AdminStatus label="Estado" value={row.status} />
        </div>
        <div><div className="mb-2 text-sm font-bold text-slate-900">Detalle reportado</div><pre className="max-h-64 overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(row.raw, null, 2)}</pre></div>
        <div className="flex justify-end gap-2"><Button disabled={busy} onClick={onRefresh} size="sm" type="button">{busy ? "Enviando" : "Refrescar nodo"}</Button></div>
      </div>
    </AdminModalFrame>
  )
}
function AdminIntegrationsPage() {
  const [configuration, setConfiguration] = useState<HostingConfiguration | null>(null)
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([])
  const [billingStatus, setBillingStatus] = useState<BillingIntegrationStatus | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [message, setMessage] = useState("")
  const [selected, setSelected] = useState<IntegrationRow | null>(null)
  const [editing, setEditing] = useState<IntegrationRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = () => {
    setIsLoading(true)
    setMessage("")
    hostingApi.configuration()
      .then(async (config) => {
        let billing: BillingIntegrationStatus | null = null
        try {
          billing = await hostingApi.billingIntegrationStatus()
        } catch (error) {
          console.warn("No se pudo consultar estado Billing", error)
        }
        setConfiguration(config)
        setBillingStatus(billing)
        setIntegrations(applyBillingIntegrationStatus(readIntegrations(config), billing))
      })
      .catch((error: Error) => setMessage(error.message || "No se pudieron cargar integraciones."))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const saveRows = async (nextRows: IntegrationRow[], success: string) => {
    if (!configuration) return
    try {
      const saved = await hostingApi.updateConfiguration({
        policies: {
          ...configuration.policies,
          integrations: nextRows,
        },
      })
      setConfiguration(saved)
      setIntegrations(applyBillingIntegrationStatus(readIntegrations(saved), billingStatus))
      setMessage(success)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar integraciones.")
    }
  }

  const saveIntegration = async (item: IntegrationRow) => {
    const exists = integrations.some((row) => row.id === item.id)
    const nextRows = exists ? integrations.map((row) => (row.id === item.id ? item : row)) : [item, ...integrations]
    await saveRows(nextRows, exists ? "Integracion actualizada." : "Integracion creada.")
    setEditing(null)
  }

  const testIntegration = async (item: IntegrationRow) => {
    const nextRows = integrations.map((row) => row.id === item.id ? { ...row, last_check_at: new Date().toISOString(), last_check_status: integrationCanTest(row) ? "Pendiente de API" : "No disponible" } : row)
    await saveRows(nextRows, `Revision registrada para ${item.name}.`)
  }

  const filtered = integrations.filter((item) => {
    const haystack = [item.name, item.category, item.type, item.endpoint, item.status, item.notes].join(" ").toLowerCase()
    const matchesSearch = !query.trim() || haystack.includes(query.trim().toLowerCase())
    const matchesStatus = !statusFilter || item.status === statusFilter
    return matchesSearch && matchesStatus
  })
  const activeCount = integrations.filter((item) => item.status === "Activo").length
  const pendingCount = integrations.filter((item) => item.status === "Pendiente" || item.status === "Planeado").length

  return (
    <div className="space-y-4">
      <AdminConfigHeader action={isLoading ? "Actualizando" : "Actualizar"} description="Conectores del ecosistema EHPanel: billing, webmail, drive y futuras aplicaciones internas." icon={Boxes} onAction={load} title="Integraciones" />
      {message ? <BackupMessage message={message} /> : null}
      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Integraciones" value={String(integrations.length)} detail="Aplicaciones EHPanel" />
        <AdminMetric label="Activas" value={String(activeCount)} detail="Operando" />
        <AdminMetric label="Pendientes" value={String(pendingCount)} detail="En desarrollo o por conectar" />
        <AdminMetric label="Futuras" value={String(integrations.filter((item) => item.status === "Futuro").length)} detail="Reservadas" />
      </section>
      <div className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex h-9 w-[420px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar integracion, endpoint o categoria..." value={query} />
          </div>
          <div className="flex gap-2">
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="">Estado</option>
              {Array.from(new Set(integrations.map((item) => item.status))).map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <Button onClick={() => setEditing(newIntegrationRow())} size="sm">Nueva integracion</Button>
          </div>
        </div>
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Integracion", "Categoria", "Tipo", "Endpoint", "Estado", "Ultima prueba", "Acciones"].map((column) => <th className="px-4 py-2 font-bold" key={column}>{column}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((item) => (
              <tr className="hover:bg-slate-50" key={item.id}>
                <td className="px-4 py-3 font-semibold text-slate-900">{item.name}<span className="block text-xs font-normal text-slate-500">{item.notes || "Sin notas"}</span></td>
                <td className="px-4 py-3">{item.category}</td>
                <td className="px-4 py-3">{item.type}</td>
                <td className="px-4 py-3 font-mono text-xs">{item.endpoint || "Pendiente"}</td>
                <td className="px-4 py-3"><KnowledgeStatusBadge status={integrationBadgeStatus(item.status)} /></td>
                <td className="px-4 py-3">{item.last_check_at ? formatDateTime(item.last_check_at) : item.last_check_status || "Sin prueba"}</td>
                <td className="px-4 py-3"><BackupActions labels={["Ver", "Editar", "Probar"]} onClick={(label) => { if (label === "Ver") setSelected(item); if (label === "Editar") setEditing(item); if (label === "Probar") void testIntegration(item) }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected ? <IntegrationDetailModal integration={selected} onClose={() => setSelected(null)} /> : null}
      {editing ? <IntegrationEditModal integration={editing} onClose={() => setEditing(null)} onSave={saveIntegration} /> : null}
    </div>
  )
}

type IntegrationRow = {
  category: string
  endpoint: string
  id: string
  last_check_at?: string
  last_check_status?: string
  name: string
  notes: string
  status: string
  type: string
}

function defaultIntegrations(): IntegrationRow[] {
  return [
    { category: "Billing", endpoint: "", id: "ehpanel-billing", name: "EHPanel Billing", notes: "Sistema de facturacion propio. Pendiente de conectar API.", status: "Pendiente", type: "Aplicacion EHPanel" },
    { category: "Correo", endpoint: "https://webmail.ehclouding.com", id: "ehpanel-webmail", name: "EHPanel Webmail", notes: "Servicio webmail del ecosistema EHClouding.", status: "Activo", type: "Aplicacion EHPanel" },
    { category: "Almacenamiento", endpoint: "", id: "ehpanel-drive", name: "EHPanel Drive", notes: "Pendiente. Se conectara por API cuando el servicio exista.", status: "Pendiente", type: "Aplicacion EHPanel" },
  ]
}

function readIntegrations(configuration: HostingConfiguration): IntegrationRow[] {
  const policies = configuration.policies || {}
  const raw = Array.isArray(policies.integrations) ? policies.integrations : []
  const stored = raw.map((item) => normalizeIntegrationRow(item)).filter((item): item is IntegrationRow => Boolean(item))
  const byId = new Map(defaultIntegrations().map((item) => [item.id, item]))
  for (const item of stored) byId.set(item.id, { ...(byId.get(item.id) || {} as IntegrationRow), ...item })
  return Array.from(byId.values())
}

function applyBillingIntegrationStatus(rows: IntegrationRow[], billing: BillingIntegrationStatus | null) {
  if (!billing) return rows
  return rows.map((row) => {
    if (row.id !== "ehpanel-billing") return row
    const healthStatus = textFromUnknown(billing.health?.status)
    const healthDetail = textFromUnknown(billing.health?.detail)
    const lastCheck = healthStatus === "ok" ? "Billing API ok" : healthDetail || "Health de Billing no configurado"
    return {
      ...row,
      endpoint: billing.billing_api_base || row.endpoint,
      last_check_status: lastCheck,
      notes: `${billing.linked_accounts} cuentas vinculadas / ${billing.unlinked_accounts} sin vincular. Bridge interno ${billing.web_token_configured ? "configurado" : "sin token"}.`,
      status: billing.web_token_configured ? "Activo" : "Pendiente",
    }
  })
}

function normalizeIntegrationRow(value: unknown): IntegrationRow | null {
  if (!value || typeof value !== "object") return null
  const item = value as Record<string, unknown>
  const id = textFromUnknown(item.id) || slugifyLogFileName(textFromUnknown(item.name) || "integracion")
  if (!id) return null
  return {
    category: textFromUnknown(item.category) || "Aplicacion",
    endpoint: textFromUnknown(item.endpoint),
    id,
    last_check_at: textFromUnknown(item.last_check_at),
    last_check_status: textFromUnknown(item.last_check_status),
    name: textFromUnknown(item.name) || id,
    notes: textFromUnknown(item.notes),
    status: textFromUnknown(item.status) || "Pendiente",
    type: textFromUnknown(item.type) || "Aplicacion EHPanel",
  }
}

function newIntegrationRow(): IntegrationRow {
  return { category: "Aplicacion", endpoint: "", id: `integration-${Date.now()}`, name: "Nueva aplicacion EHPanel", notes: "", status: "Futuro", type: "Aplicacion EHPanel" }
}

function integrationBadgeStatus(status: string) {
  if (status === "Activo") return "Publicado"
  if (status === "Pendiente") return "Borrador"
  if (status === "Futuro") return "Planeado"
  return status
}

function integrationCanTest(item: IntegrationRow) {
  return Boolean(item.endpoint && item.endpoint.startsWith("http"))
}

function IntegrationDetailModal({ integration, onClose }: { integration: IntegrationRow; onClose: () => void }) {
  return <AdminModalFrame kicker="Integracion" onClose={onClose} title={integration.name}><div className="grid gap-3 md:grid-cols-2"><AdminStatus label="Categoria" value={integration.category} /><AdminStatus label="Tipo" value={integration.type} /><AdminStatus label="Endpoint" value={integration.endpoint || "Pendiente"} /><AdminStatus label="Estado" value={integration.status} /><AdminStatus label="Ultima prueba" value={integration.last_check_at ? formatDateTime(integration.last_check_at) : integration.last_check_status || "Sin prueba"} /><AdminStatus label="Notas" value={integration.notes || "N/D"} /></div></AdminModalFrame>
}

function IntegrationEditModal({ integration, onClose, onSave }: { integration: IntegrationRow; onClose: () => void; onSave: (integration: IntegrationRow) => Promise<void> }) {
  const [form, setForm] = useState(integration)
  const [message, setMessage] = useState("")
  const update = (key: keyof IntegrationRow, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await onSave(form)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la integracion.")
    }
  }
  return (
    <AdminModalFrame kicker="Integracion" onClose={onClose} title={form.name}>
      <form className="space-y-4" onSubmit={submit}>
        {message ? <BackupMessage message={message} /> : null}
        <div className="grid gap-3 md:grid-cols-2">
          <AdminTextInput label="Nombre" onChange={(value) => update("name", value)} value={form.name} />
          <AdminTextInput label="Categoria" onChange={(value) => update("category", value)} value={form.category} />
          <AdminTextInput label="Tipo" onChange={(value) => update("type", value)} value={form.type} />
          <AdminTextInput label="Endpoint" onChange={(value) => update("endpoint", value)} value={form.endpoint} />
          <label className="block"><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Estado</span><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => update("status", event.target.value)} value={form.status}><option>Activo</option><option>Pendiente</option><option>Planeado</option><option>Futuro</option><option>Pausado</option></select></label>
          <AdminTextInput label="Notas" onChange={(value) => update("notes", value)} value={form.notes} />
        </div>
        <div className="flex justify-end gap-2"><Button onClick={onClose} size="sm" type="button" variant="outline">Cancelar</Button><Button size="sm" type="submit">Guardar</Button></div>
      </form>
    </AdminModalFrame>
  )
}
function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<SystemNotificationRow[]>([])
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [selected, setSelected] = useState<SystemNotificationRow | null>(null)
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const load = () => {
    setIsLoading(true)
    setMessage("")
    Promise.all([
      adminApi.auditLogs(),
      adminApi.nodeEvents(),
      adminApi.jobs(),
      hostingApi.announcements(),
    ])
      .then(([auditPage, eventPage, jobPage, announcementPage]) => {
        const rows = [
          ...auditPage.results.map(notificationFromAudit),
          ...eventPage.results.map(notificationFromAgentEvent),
          ...jobPage.results.map(notificationFromAgentJob),
          ...announcementPage.results.map(notificationFromAnnouncement),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setNotifications(rows.slice(0, 250))
      })
      .catch((error: Error) => setMessage(error.message || "No se pudieron cargar notificaciones."))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = notifications.filter((item) => {
    const haystack = [item.title, item.channel, item.recipients, item.type, item.status, item.source].join(" ").toLowerCase()
    const matchesSearch = !query.trim() || haystack.includes(query.trim().toLowerCase())
    const matchesType = !typeFilter || item.type === typeFilter
    const matchesStatus = !statusFilter || item.status === statusFilter
    return matchesSearch && matchesType && matchesStatus
  })
  const failedCount = notifications.filter((item) => item.status === "Fallida" || item.status === "Error").length
  const pendingCount = notifications.filter((item) => item.status === "Pendiente" || item.status === "En cola").length
  const sentCount = notifications.filter((item) => item.status === "Registrada" || item.status === "Enviada" || item.status === "Completada").length

  return (
    <div className="space-y-4">
      <AdminConfigHeader action={isLoading ? "Actualizando" : "Actualizar"} description="Registro real de notificaciones generadas por el sistema: auditoria, agente, jobs y anuncios. Aqui no se crean notificaciones manuales." icon={Bell} onAction={load} title="Notificaciones" />
      {message ? <BackupMessage message={message} /> : null}
      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Registradas" value={String(notifications.length)} detail="Ultimos eventos del sistema" />
        <AdminMetric label="Completadas" value={String(sentCount)} detail="Emitidas o registradas" />
        <AdminMetric label="Pendientes" value={String(pendingCount)} detail="Jobs o avisos en espera" />
        <AdminMetric label="Errores" value={String(failedCount)} detail="Requieren revision" />
      </section>
      <div className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex h-9 w-[420px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar evento, canal, destinatario o fuente..." value={query} />
          </div>
          <div className="flex gap-2">
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
              <option value="">Tipo</option>
              {Array.from(new Set(notifications.map((item) => item.type))).map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="">Estado</option>
              {Array.from(new Set(notifications.map((item) => item.status))).map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <Button disabled={isLoading} onClick={load} size="sm" variant="outline">Actualizar</Button>
          </div>
        </div>
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Evento", "Canal", "Tipo", "Destinatarios", "Fecha", "Estado", "Acciones"].map((column) => <th className="px-4 py-2 font-bold" key={column}>{column}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((item) => (
              <tr className="hover:bg-slate-50" key={item.id}>
                <td className="px-4 py-3 font-semibold text-slate-900">{item.title}<span className="block text-xs font-normal text-slate-500">{item.source}</span></td>
                <td className="px-4 py-3">{item.channel}</td>
                <td className="px-4 py-3">{item.type}</td>
                <td className="px-4 py-3">{item.recipients}</td>
                <td className="px-4 py-3">{formatDateTime(item.created_at)}</td>
                <td className="px-4 py-3"><NotificationStatusBadge status={item.status} /></td>
                <td className="px-4 py-3"><BackupActions labels={["Ver"]} onClick={() => setSelected(item)} /></td>
              </tr>
            ))}
            {!isLoading && filtered.length === 0 ? <tr><td className="px-4 py-4 text-sm font-semibold text-slate-500" colSpan={7}>No hay notificaciones generadas por el sistema para este filtro.</td></tr> : null}
          </tbody>
        </table>
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Mostrando {filtered.length} de {notifications.length} registros</div>
      </div>
      {selected ? <NotificationDetailModal notification={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  )
}

type SystemNotificationRow = {
  channel: string
  created_at: string
  id: string
  raw: Record<string, unknown>
  recipients: string
  source: string
  status: string
  title: string
  type: string
}

function notificationFromAudit(item: AdminAuditLog): SystemNotificationRow {
  return {
    channel: "Panel admin",
    created_at: item.created_at,
    id: `audit-${item.id}`,
    raw: item as unknown as Record<string, unknown>,
    recipients: item.user_username || "Administradores",
    source: item.path || "Auditoria",
    status: item.status_code >= 400 ? "Error" : "Registrada",
    title: auditNotificationTitle(item),
    type: "Auditoria",
  }
}

function notificationFromAgentEvent(item: AdminAgentEvent): SystemNotificationRow {
  return {
    channel: "Agente nodo",
    created_at: item.created_at,
    id: `event-${item.id}`,
    raw: item as unknown as Record<string, unknown>,
    recipients: item.node_hostname || "Operaciones",
    source: item.node_hostname || item.msg_type,
    status: agentEventStatus(item),
    title: eventSummary(item),
    type: "Evento agente",
  }
}

function notificationFromAgentJob(item: AdminAgentJob): SystemNotificationRow {
  return {
    channel: "Cola de tareas",
    created_at: item.finished_at || item.started_at || item.queued_at,
    id: `job-${item.id}`,
    raw: item as unknown as Record<string, unknown>,
    recipients: item.node_hostname || "Operaciones",
    source: item.node_hostname || item.correlation_id || item.id,
    status: jobNotificationStatus(item.status),
    title: `${jobTypeLabel(item.job_type)} ${item.error_detail ? `- ${item.error_detail}` : ""}`.trim(),
    type: "Job agente",
  }
}

function notificationFromAnnouncement(item: GlobalAnnouncement): SystemNotificationRow {
  return {
    channel: "Panel cliente",
    created_at: item.publish_at || item.created_at,
    id: `announcement-${item.id}`,
    raw: item as unknown as Record<string, unknown>,
    recipients: item.audience_label,
    source: "Anuncios globales",
    status: item.status === "published" ? "Enviada" : item.status === "scheduled" ? "Pendiente" : "Registrada",
    title: item.title,
    type: "Anuncio",
  }
}

function auditNotificationTitle(item: AdminAuditLog) {
  return [item.action, item.target_label || item.account_domain || item.target_type].filter(Boolean).join(" - ") || "Evento de auditoria"
}

function agentEventStatus(item: AdminAgentEvent) {
  const text = JSON.stringify(item.payload || {}).toLowerCase()
  if (text.includes("error") || text.includes("failed") || text.includes("fallo")) return "Error"
  return "Registrada"
}

function jobNotificationStatus(status: AdminAgentJob["status"]) {
  return ({ canceled: "Cancelada", expired: "Error", failed: "Fallida", queued: "En cola", running: "Pendiente", sent: "Pendiente", success: "Completada" } as Record<string, string>)[status] || status
}

function NotificationStatusBadge({ status }: { status: string }) {
  const tone = ["Completada", "Enviada", "Registrada"].includes(status)
    ? "bg-emerald-50 text-emerald-700"
    : ["Error", "Fallida", "Cancelada"].includes(status)
      ? "bg-red-50 text-red-700"
      : "bg-amber-50 text-amber-700"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{status}</span>
}

function NotificationDetailModal({ notification, onClose }: { notification: SystemNotificationRow; onClose: () => void }) {
  return (
    <AdminModalFrame kicker={notification.type} onClose={onClose} title={notification.title}>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <AdminStatus label="Canal" value={notification.channel} />
          <AdminStatus label="Destinatarios" value={notification.recipients} />
          <AdminStatus label="Fuente" value={notification.source} />
          <AdminStatus label="Estado" value={notification.status} />
          <AdminStatus label="Fecha" value={formatDateTime(notification.created_at)} />
          <AdminStatus label="Tipo" value={notification.type} />
        </div>
        <div><div className="mb-2 text-sm font-bold text-slate-900">Registro original</div><pre className="max-h-64 overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(notification.raw, null, 2)}</pre></div>
      </div>
    </AdminModalFrame>
  )
}
const apiScopeOptions = [
  { label: "Clientes", value: "hosting.accounts" },
  { label: "Planes", value: "hosting.plans" },
  { label: "Revendedores", value: "hosting.resellers" },
  { label: "Tickets", value: "hosting.tickets" },
  { label: "Backups", value: "hosting.backups" },
  { label: "DNS", value: "hosting.dns" },
  { label: "SSL", value: "hosting.ssl" },
  { label: "Agentes", value: "agents.jobs" },
  { label: "Solo lectura", value: "read" },
  { label: "Escritura", value: "write" },
]

function defaultApiKeyForm(): ApiKeyCredentialPayload {
  return { name: "", notes: "", owner: "Sistema interno", route: "/api/", scopes: ["read"], status: "active" }
}

function AdminApiKeysPage() {
  const [items, setItems] = useState<ApiKeyCredential[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<ApiKeyCredentialStatus | "">("")
  const [form, setForm] = useState<ApiKeyCredentialPayload>(defaultApiKeyForm())
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ApiKeyCredential | null>(null)
  const [selected, setSelected] = useState<ApiKeyCredential | null>(null)
  const [created, setCreated] = useState<ApiKeyCredentialCreated | null>(null)
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const load = async () => {
    setIsLoading(true)
    try {
      const page = await hostingApi.apiKeys({ search: query, status: statusFilter })
      setItems(page.results)
      setMessage("")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la solicitud.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(defaultApiKeyForm())
    setShowForm(true)
  }

  const openEdit = (item: ApiKeyCredential) => {
    setEditing(item)
    setForm({ name: item.name, notes: item.notes, owner: item.owner, route: item.route, scopes: item.scopes, status: item.status })
    setShowForm(true)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const payload = { ...form, scopes: form.scopes || [] }
      if (editing) {
        await hostingApi.updateApiKey(editing.id, payload)
        setMessage("Clave API actualizada.")
      } else {
        const result = await hostingApi.createApiKey(payload)
        setCreated(result)
        setMessage("Clave API generada. Guardala ahora; no se volvera a mostrar completa.")
      }
      setEditing(null)
      setForm(defaultApiKeyForm())
      setShowForm(false)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la solicitud.")
    }
  }

  const rotate = async (item: ApiKeyCredential) => {
    try {
      const result = await hostingApi.rotateApiKey(item.id)
      setCreated(result)
      setMessage("Clave API rotada. La clave anterior queda invalidada.")
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la solicitud.")
    }
  }

  const changeState = async (item: ApiKeyCredential, action: "activate" | "pause" | "revoke" | "test") => {
    try {
      if (action === "activate") await hostingApi.activateApiKey(item.id)
      if (action === "pause") await hostingApi.pauseApiKey(item.id)
      if (action === "revoke") await hostingApi.revokeApiKey(item.id)
      if (action === "test") await hostingApi.testApiKey(item.id)
      setMessage(action === "test" ? "Prueba registrada como ultimo uso." : "Estado de la clave actualizado.")
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la solicitud.")
    }
  }

  const filtered = items.filter((item) => {
    const haystack = `${item.name} ${item.owner} ${item.route} ${item.key_prefix} ${item.scopes_label} ${item.status_label}`.toLowerCase()
    return !query || haystack.includes(query.toLowerCase())
  })
  const activeCount = items.filter((item) => item.status === "active").length
  const pausedCount = items.filter((item) => item.status === "paused").length
  const revokedCount = items.filter((item) => item.status === "revoked").length
  const scopeCount = new Set(items.flatMap((item) => item.scopes)).size

  return (
    <div className="space-y-4">
      <AdminConfigHeader
        action="Nueva clave"
        description="Credenciales API para enlazar EHPanel con Billing, WHMCS u otros sistemas internos/externos."
        icon={KeyRound}
        onAction={openCreate}
        title="API / claves"
      />
      {message ? <BackupMessage message={message} /> : null}
      <section className="grid gap-3 xl:grid-cols-4">
        <AdminMetric label="Claves" value={String(items.length)} detail="Registradas" />
        <AdminMetric label="Activas" value={String(activeCount)} detail="Disponibles" />
        <AdminMetric label="Pausadas" value={String(pausedCount)} detail="Sin uso temporal" />
        <AdminMetric label="Scopes" value={String(scopeCount)} detail={`Revocadas: ${revokedCount}`} />
      </section>
      <div className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex h-9 w-[420px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar clave, propietario o permisos..." value={query} />
          </div>
          <div className="flex gap-2">
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" onChange={(event) => setStatusFilter(event.target.value as ApiKeyCredentialStatus | "")} value={statusFilter}>
              <option value="">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="paused">Pausadas</option>
              <option value="revoked">Revocadas</option>
              <option value="draft">Borrador</option>
            </select>
            <Button onClick={load} size="sm" type="button" variant="outline">{isLoading ? "Actualizando" : "Filtrar"}</Button>
          </div>
        </div>
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{["Nombre", "Propietario", "Ruta", "Prefijo", "Permisos", "Creada", "Ultimo uso", "Estado", "Acciones"].map((column) => <th className="px-4 py-2 font-bold" key={column}>{column}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((item) => (
              <tr className="hover:bg-slate-50" key={item.id}>
                <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                <td className="px-4 py-3">{item.owner}</td>
                <td className="px-4 py-3 font-mono text-xs">{item.route}</td>
                <td className="px-4 py-3 font-mono text-xs">{item.key_prefix}</td>
                <td className="px-4 py-3">{item.scopes_label}</td>
                <td className="px-4 py-3">{formatDateTime(item.created_at)}</td>
                <td className="px-4 py-3">{formatDateTime(item.last_used_at)}</td>
                <td className="px-4 py-3"><ApiKeyStatusBadge status={item.status} /></td>
                <td className="px-4 py-3">
                  <BackupActions labels={["Ver", "Editar", "Rotar", item.status === "paused" ? "Activar" : "Pausar", "Revocar"]} onClick={(label) => {
                    if (label === "Ver") setSelected(item)
                    if (label === "Editar") openEdit(item)
                    if (label === "Rotar") void rotate(item)
                    if (label === "Pausar") void changeState(item, "pause")
                    if (label === "Activar") void changeState(item, "activate")
                    if (label === "Revocar") void changeState(item, "revoke")
                  }} />
                </td>
              </tr>
            ))}
            {!filtered.length ? <tr><td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={9}>No hay claves API para mostrar.</td></tr> : null}
          </tbody>
        </table>
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Mostrando {filtered.length} de {items.length} registros</div>
      </div>
      {showForm ? <ApiKeyFormModal form={form} item={editing} onChange={setForm} onClose={() => { setEditing(null); setForm(defaultApiKeyForm()); setShowForm(false) }} onSubmit={save} /> : null}
      {selected ? <ApiKeyDetailModal item={selected} onClose={() => setSelected(null)} onTest={() => void changeState(selected, "test")} /> : null}
      {created?.api_key ? <ApiKeyTokenModal item={created} onClose={() => setCreated(null)} /> : null}
    </div>
  )
}

function ApiKeyStatusBadge({ status }: { status: ApiKeyCredentialStatus }) {
  const label = ({ active: "Activa", draft: "Borrador", paused: "Pausada", revoked: "Revocada" } as Record<ApiKeyCredentialStatus, string>)[status]
  const tone = status === "active" ? "bg-emerald-50 text-emerald-700" : status === "revoked" ? "bg-red-50 text-red-700" : status === "paused" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{label}</span>
}

function ApiKeyFormModal({ form, item, onChange, onClose, onSubmit }: { form: ApiKeyCredentialPayload; item: ApiKeyCredential | null; onChange: (value: ApiKeyCredentialPayload) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  const scopes = form.scopes || []
  const toggleScope = (scope: string) => {
    onChange({ ...form, scopes: scopes.includes(scope) ? scopes.filter((item) => item !== scope) : [...scopes, scope] })
  }
  return (
    <AdminModalFrame kicker="API / claves" onClose={onClose} title={item ? "Editar clave API" : "Nueva clave API"}>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <AdminTextInput label="Nombre" onChange={(value) => onChange({ ...form, name: value })} placeholder="EHPanel Billing" value={form.name} />
          <AdminTextInput label="Propietario" onChange={(value) => onChange({ ...form, owner: value })} placeholder="Sistema interno" value={form.owner || ""} />
          <AdminTextInput label="Ruta base" onChange={(value) => onChange({ ...form, route: value })} placeholder="/api/" value={form.route || ""} />
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Estado</span>
            <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => onChange({ ...form, status: event.target.value as ApiKeyCredentialStatus })} value={form.status || "active"}>
              <option value="active">Activa</option>
              <option value="paused">Pausada</option>
              <option value="draft">Borrador</option>
              <option value="revoked">Revocada</option>
            </select>
          </label>
        </div>
        <div>
          <div className="mb-2 text-xs font-bold uppercase text-slate-500">Permisos API</div>
          <div className="grid gap-2 md:grid-cols-2">
            {apiScopeOptions.map((scope) => (
              <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" key={scope.value}>
                <input checked={scopes.includes(scope.value)} onChange={() => toggleScope(scope.value)} type="checkbox" />
                {scope.label}
              </label>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Notas</span>
          <textarea className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => onChange({ ...form, notes: event.target.value })} value={form.notes || ""} />
        </label>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">Cancelar</Button>
          <Button type="submit">{item ? "Guardar" : "Generar clave"}</Button>
        </div>
      </form>
    </AdminModalFrame>
  )
}

function ApiKeyDetailModal({ item, onClose, onTest }: { item: ApiKeyCredential; onClose: () => void; onTest: () => void }) {
  return (
    <AdminModalFrame kicker={item.owner} onClose={onClose} title={item.name}>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <AdminStatus label="Ruta base" value={item.route} />
          <AdminStatus label="Prefijo visible" value={item.key_prefix} />
          <AdminStatus label="Permisos" value={item.scopes_label} />
          <AdminStatus label="Estado" value={item.status_label} />
          <AdminStatus label="Creada" value={formatDateTime(item.created_at)} />
          <AdminStatus label="Ultimo uso" value={formatDateTime(item.last_used_at)} />
        </div>
        <div><div className="mb-1 text-sm font-bold text-slate-900">Notas</div><p className="text-sm text-slate-600">{item.notes || "Sin notas registradas."}</p></div>
        <div className="flex justify-end"><Button onClick={onTest} size="sm" type="button" variant="outline">Registrar prueba</Button></div>
      </div>
    </AdminModalFrame>
  )
}

function ApiKeyTokenModal({ item, onClose }: { item: ApiKeyCredentialCreated; onClose: () => void }) {
  return (
    <AdminModalFrame kicker="Clave generada" onClose={onClose} title={item.name}>
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">La clave completa solo se muestra una vez. Guarda este valor antes de cerrar el modal.</div>
        <AdminStatus label="Ruta base" value={item.route} />
        <textarea className="h-28 w-full rounded-md border border-slate-200 bg-slate-950 p-3 font-mono text-xs text-slate-100" readOnly value={item.api_key || ""} />
        <div className="flex justify-end"><Button onClick={onClose} type="button">Cerrar</Button></div>
      </div>
    </AdminModalFrame>
  )
}

function PhpStatusBadge({ status }: { status: string }) {
  const tone =
    status === "Recomendado"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Legacy"
        ? "bg-red-50 text-red-700"
        : status === "Pruebas"
          ? "bg-blue-50 text-blue-700"
          : "bg-slate-100 text-slate-700"
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", tone)}>{status}</span>
}

function AdminDevelopmentPage({
  description,
  icon: Icon,
  kicker,
  title,
}: {
  description: string
  icon: LucideIcon
  kicker: string
  title: string
}) {
  return (
    <section className="eh-card px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="eh-kicker">{kicker}</div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-blue-700 shadow-sm">
          <Code2 className="h-6 w-6" />
        </div>
        <h2 className="mt-3 text-lg font-bold text-slate-900">En desarrollo</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
          Esta pantalla queda reservada para una fase posterior. Por ahora solo mantenemos el espacio definido en el menu.
        </p>
      </div>
    </section>
  )
}

function AdminSidebarButton({ icon: Icon, label, active, onClick }: AdminMenuItem & { active?: boolean; onClick?: () => void }) {
  return (
    <button
      className={cn(
        "flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-slate-300 transition",
        "hover:bg-white/10 hover:text-white",
        active && "bg-primary text-white shadow-[0_8px_18px_rgba(37,99,235,0.28)] hover:bg-primary",
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-sidebar-muted")} />
      <span className="truncate">{label}</span>
    </button>
  )
}

function AdminStatus({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-xs font-bold uppercase text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-800">{value}</span>
    </div>
  )
}
