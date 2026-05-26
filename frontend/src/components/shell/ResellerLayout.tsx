import {
  Activity,
  Bell,
  Box,
  BriefcaseBusiness,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Cloud,
  CreditCard,
  DatabaseBackup,
  FileDown,
  FileText,
  Gauge,
  HardDrive,
  Import,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  MoreHorizontal,
  Palette,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  ShieldCheck,
  Ticket,
  Upload,
  UserCog,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { adminApi, type AdminAuditLog } from "@/api/admin"
import { authApi } from "@/api/auth"
import {
  hostingApi,
  type BackupPolicy,
  type BackupRestoreRun,
  type BackupStorageDestination,
  type GlobalNameserver,
  type HostingAccount,
  type HostingAccountExport,
  type HostingDomain,
  type HostingMailbox,
  type HostingPlan,
  type HostingReseller,
  type MigrationRun,
  type ResellerSecurityResponse,
  type ResellerTeamMember,
  type SupportTicket,
} from "@/api/hosting"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ResellerLayoutProps = {
  onLogout: () => void
}

type ResellerView =
  | "Dashboard"
  | "Cuentas de hosting"
  | "Paquetes de hosting"
  | "DNS global"
  | "SSL de clientes"
  | "Cuentas de correo"
  | "Backups de clientes"
  | "Tickets"
  | "White label"
  | "Clientes y estado comercial"
  | "Uso de recursos"
  | "Importar cuentas"
  | "Exportar datos"
  | "Auditoria"
  | "Logs"
  | "Perfil revendedor"
  | "Usuarios del equipo"
  | "Seguridad"

type MenuItem = {
  label: ResellerView
  icon: LucideIcon
}

type ResellerData = {
  accounts: HostingAccount[]
  accountExports: HostingAccountExport[]
  auditLogs: AdminAuditLog[]
  backupPolicies: BackupPolicy[]
  backupRestores: BackupRestoreRun[]
  backupStorage: BackupStorageDestination[]
  domains: HostingDomain[]
  mailboxes: HostingMailbox[]
  migrationRuns: MigrationRun[]
  nameservers: GlobalNameserver[]
  plans: HostingPlan[]
  profile: HostingReseller | null
  security: ResellerSecurityResponse | null
  team: ResellerTeamMember[]
  tickets: SupportTicket[]
}

type JsonRecord = Record<string, unknown>

const emptyData: ResellerData = {
  accounts: [],
  accountExports: [],
  auditLogs: [],
  backupPolicies: [],
  backupRestores: [],
  backupStorage: [],
  domains: [],
  mailboxes: [],
  migrationRuns: [],
  nameservers: [],
  plans: [],
  profile: null,
  security: null,
  team: [],
  tickets: [],
}

const menuSections: Array<{ label: string; items: MenuItem[] }> = [
  { label: "Inicio", items: [{ label: "Dashboard", icon: LayoutDashboard }] },
  { label: "Clientes", items: [{ label: "Cuentas de hosting", icon: Users }] },
  { label: "Planes", items: [{ label: "Paquetes de hosting", icon: Box }] },
  { label: "Dominios", items: [{ label: "DNS global", icon: Cloud }, { label: "SSL de clientes", icon: ShieldCheck }] },
  { label: "Correo", items: [{ label: "Cuentas de correo", icon: Mail }] },
  { label: "Backups", items: [{ label: "Backups de clientes", icon: DatabaseBackup }] },
  { label: "Soporte", items: [{ label: "Tickets", icon: Ticket }] },
  { label: "Marca", items: [{ label: "White label", icon: Palette }] },
  { label: "Facturacion", items: [{ label: "Clientes y estado comercial", icon: CreditCard }] },
  { label: "Reportes", items: [{ label: "Uso de recursos", icon: Gauge }] },
  { label: "Herramientas", items: [{ label: "Importar cuentas", icon: Import }, { label: "Exportar datos", icon: FileDown }, { label: "Auditoria", icon: ClipboardList }, { label: "Logs", icon: FileText }] },
  { label: "Cuenta", items: [{ label: "Perfil revendedor", icon: BriefcaseBusiness }, { label: "Usuarios del equipo", icon: UserCog }, { label: "Seguridad", icon: LockKeyhole }] },
]

const departments = [
  ["technical", "Soporte tecnico"],
  ["administration", "Administracion"],
  ["billing", "Facturacion"],
  ["security", "Abuso y seguridad"],
] as const

const priorities = [["low", "Baja"], ["medium", "Media"], ["high", "Alta"], ["urgent", "Urgente"]] as const

export function ResellerLayout({ onLogout }: ResellerLayoutProps) {
  const [activeView, setActiveView] = useState<ResellerView>("Dashboard")
  const [data, setData] = useState<ResellerData>(emptyData)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [showCreateHostingAccountModal, setShowCreateHostingAccountModal] = useState(false)
  const isAdminView = typeof window !== "undefined" && window.sessionStorage.getItem("eh_admin_view_reseller")

  async function loadData() {
    setIsLoading(true)
    setError("")
    try {
      const [
        profile,
        accounts,
        plans,
        domains,
        mailboxes,
        tickets,
        backupPolicies,
        backupStorage,
        backupRestores,
        migrationRuns,
        accountExports,
        nameservers,
        auditLogs,
        team,
        security,
      ] = await Promise.all([
        hostingApi.resellerSelf().catch(() => null),
        hostingApi.accounts(),
        hostingApi.plans(),
        hostingApi.domains(),
        hostingApi.mailboxes(),
        hostingApi.tickets({ audience: "resellers" }),
        hostingApi.backupPolicies().catch(() => page<BackupPolicy>()),
        hostingApi.backupStorage().catch(() => page<BackupStorageDestination>()),
        hostingApi.backupRestores().catch(() => page<BackupRestoreRun>()),
        hostingApi.migrationRuns().catch(() => page<MigrationRun>()),
        hostingApi.accountExports().catch(() => page<HostingAccountExport>()),
        hostingApi.globalNameservers().catch(() => page<GlobalNameserver>()),
        adminApi.auditLogs().catch(() => page<AdminAuditLog>()),
        hostingApi.resellerTeam().catch(() => page<ResellerTeamMember>()),
        hostingApi.resellerSecurity().catch(() => null),
      ])
      setData({
        accountExports: accountExports.results,
        accounts: accounts.results,
        auditLogs: auditLogs.results,
        backupPolicies: backupPolicies.results,
        backupRestores: backupRestores.results,
        backupStorage: backupStorage.results,
        domains: domains.results,
        mailboxes: mailboxes.results,
        migrationRuns: migrationRuns.results,
        nameservers: nameservers.results,
        plans: plans.results,
        profile,
        security,
        team: team.results,
        tickets: tickets.results,
      })
    } catch (err) {
      setError(readMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const company = data.profile?.company_name || data.profile?.username || "Revendedor"
  const activeAccounts = data.accounts.filter((account) => account.status === "active").length

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
              <div className="mt-2 truncate text-xs font-semibold text-cyan-300">{company}</div>
            </div>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {menuSections.map((section) => (
            <div className="mb-4" key={section.label}>
              <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-muted">{section.label}</div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <SidebarButton active={activeView === item.label} icon={item.icon} key={item.label} label={item.label} onClick={() => setActiveView(item.label)} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          {isAdminView ? (
            <button
              className="mb-2 flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-cyan-200 transition hover:bg-white/10 hover:text-white"
              onClick={() => {
                authApi.restoreAdminSession()
                window.location.assign("/")
              }}
              type="button"
            >
              <ShieldCheck className="h-4 w-4 text-cyan-200" />
              Volver al admin
            </button>
          ) : null}
          <button className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white" onClick={onLogout} type="button">
            <LogOut className="h-4 w-4 text-sidebar-muted" />
            Cerrar sesion
          </button>
        </div>
      </aside>

      <div style={{ marginLeft: 238, width: "calc(100% - 238px)" }}>
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Button disabled={isLoading} onClick={loadData} size="sm" variant="outline">
              <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              Actualizar
            </Button>
            <Button size="sm" variant="outline">
              {company}
              <ChevronDown className="h-4 w-4" />
            </Button>
            <div className="hidden h-8 w-[360px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 xl:flex">
              <Search className="h-4 w-4" />
              Buscar cliente, dominio, ticket, plan...
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
              <div className="grid h-6 w-6 place-items-center rounded bg-cyan-600 text-xs font-bold text-white">RV</div>
              <div className="text-xs">
                <div className="font-semibold leading-4">{company}</div>
                <div className="text-slate-500">{activeAccounts} cuentas activas</div>
              </div>
            </div>
          </div>
        </header>

        <main className="px-5 py-5">
          {error ? <Alert text={error} /> : null}
          <ResellerPage
            activeView={activeView}
            data={data}
            isLoading={isLoading}
            onRefresh={loadData}
            setShowCreateHostingAccountModal={setShowCreateHostingAccountModal}
            showCreateHostingAccountModal={showCreateHostingAccountModal}
            switchToHostingAccounts={() => {
              setActiveView("Cuentas de hosting")
              setShowCreateHostingAccountModal(true)
            }}
          />
        </main>
      </div>
    </div>
  )
}

function ResellerPage({
  activeView,
  data,
  isLoading,
  onRefresh,
  setShowCreateHostingAccountModal,
  showCreateHostingAccountModal,
  switchToHostingAccounts,
}: {
  activeView: ResellerView
  data: ResellerData
  isLoading: boolean
  onRefresh: () => Promise<void>
  setShowCreateHostingAccountModal: (show: boolean) => void
  showCreateHostingAccountModal: boolean
  switchToHostingAccounts: () => void
}) {
  if (activeView === "Dashboard") return <DashboardReseller data={data} onCreateAccount={switchToHostingAccounts} />
  if (activeView === "Cuentas de hosting") return <HostingAccountsPage data={data} onRefresh={onRefresh} setShowCreateModal={setShowCreateHostingAccountModal} showCreateModal={showCreateHostingAccountModal} />
  if (activeView === "Paquetes de hosting") return <PlansPage data={data} />
  if (activeView === "DNS global") return <DnsGlobalPage data={data} />
  if (activeView === "SSL de clientes") return <SslClientsPage data={data} onRefresh={onRefresh} />
  if (activeView === "Cuentas de correo") return <MailAccountsPage data={data} onRefresh={onRefresh} />
  if (activeView === "Backups de clientes") return <BackupsClientsPage data={data} onRefresh={onRefresh} />
  if (activeView === "Tickets") return <TicketsPage data={data} onRefresh={onRefresh} />
  if (activeView === "White label") return <WhiteLabelPage data={data} onRefresh={onRefresh} />
  if (activeView === "Clientes y estado comercial") return <CommercialStatusPage data={data} onRefresh={onRefresh} />
  if (activeView === "Uso de recursos") return <ResourceUsagePage data={data} />
  if (activeView === "Importar cuentas") return <ImportAccountsPage data={data} onRefresh={onRefresh} />
  if (activeView === "Exportar datos") return <ExportDataPage data={data} onRefresh={onRefresh} />
  if (activeView === "Auditoria") return <AuditPage data={data} />
  if (activeView === "Logs") return <LogsPage data={data} />
  if (activeView === "Perfil revendedor") return <ResellerProfilePage data={data} onRefresh={onRefresh} />
  if (activeView === "Usuarios del equipo") return <TeamUsersPage data={data} isLoading={isLoading} onRefresh={onRefresh} />
  return <SecurityAccountPage data={data} onRefresh={onRefresh} />
}

function DashboardReseller({ data, onCreateAccount }: { data: ResellerData; onCreateAccount: () => void }) {
  const active = data.accounts.filter((account) => account.status === "active").length
  const pending = data.accounts.filter((account) => account.status === "pending").length
  const suspended = data.accounts.filter((account) => account.status === "suspended").length
  const openTickets = data.tickets.filter((ticket) => ticket.status !== "closed").length
  const highTickets = data.tickets.filter((ticket) => ["high", "urgent"].includes(ticket.priority) && ticket.status !== "closed").length
  const diskUsed = sum(data.accounts, (account) => usageNumber(account, "disk_used_mb"))
  const diskLimit = data.profile?.disk_mb || sum(data.accounts, (account) => account.disk_mb)
  const bandwidthUsed = sum(data.accounts, (account) => usageNumber(account, "bandwidth_used_mb"))
  const bandwidthLimit = data.profile?.bandwidth_mb || sum(data.accounts, (account) => account.bandwidth_mb)
  const alerts = [
    `${data.accounts.filter((account) => pct(usageNumber(account, "disk_used_mb"), account.disk_mb) >= 80).length} cuentas cerca del limite de disco`,
    `${data.domains.filter((domain) => domain.ssl_status !== "active").length} dominios con SSL pendiente o fallido`,
    `${data.tickets.filter((ticket) => ticket.status === "customer_reply").length} tickets esperando respuesta del revendedor`,
    `${data.nameservers.length} nameservers visibles para clientes`,
  ]
  return (
    <div className="space-y-4">
      <PageHeader action="Crear cuenta" icon={LayoutDashboard} onAction={onCreateAccount} subtitle="Resumen real de cartera, recursos, soporte y riesgos operativos del revendedor." title="Dashboard revendedor" />
      <section className="grid gap-3 xl:grid-cols-4">
        <StatCard icon={Users} label="Cuentas hosting" value={String(data.accounts.length)} detail={`${active} activas, ${pending} pendientes, ${suspended} suspendidas`} tone="text-blue-700" />
        <StatCard icon={HardDrive} label="Disco usado" value={formatMb(diskUsed)} detail={`${pct(diskUsed, diskLimit)}% de ${formatMb(diskLimit)} asignado`} tone="text-emerald-700" />
        <StatCard icon={Ticket} label="Tickets abiertos" value={String(openTickets)} detail={`${highTickets} prioridad alta/urgente`} tone="text-orange-700" />
        <StatCard icon={Gauge} label="Trafico usado" value={formatMb(bandwidthUsed)} detail={`${pct(bandwidthUsed, bandwidthLimit)}% de ${formatMb(bandwidthLimit)}`} tone="text-cyan-700" />
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.55fr_0.85fr]">
        <AccountsTable accounts={data.accounts.slice(0, 8)} title="Cuentas recientes y estado" />
        <CompactPanel title="Alertas operativas">
          {alerts.map((item, index) => (
            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2" key={item}>
              <span className="text-sm font-medium text-slate-700">{item}</span>
              <span className={cn("h-2.5 w-2.5 rounded-full", index === 3 ? "bg-emerald-500" : "bg-orange-500")} />
            </div>
          ))}
        </CompactPanel>
      </section>
    </div>
  )
}

function HostingAccountsPage({ data, onRefresh, setShowCreateModal, showCreateModal }: { data: ResellerData; onRefresh: () => Promise<void>; setShowCreateModal: (show: boolean) => void; showCreateModal: boolean }) {
  const [selectedAccount, setSelectedAccount] = useState<HostingAccount | null>(null)
  return (
    <div className="space-y-4">
      <PageHeader action="Nueva cuenta" icon={Users} onAction={() => setShowCreateModal(true)} subtitle="Crear cuentas, suspender/activar, migrar y revisar limites desde una sola vista." title="Cuentas de hosting" />
      <section className="grid gap-3 xl:grid-cols-4">
        <ActionCard icon={Plus} title="Crear cuenta" text="Alta guiada con dominio, plan, credenciales y recursos." />
        <ActionCard icon={Upload} title="Migraciones" text="Solicitudes y estado de traslados desde cPanel, Plesk u otro panel." />
        <ActionCard icon={Activity} title="Suspender / activar" text="Control rapido por mora, abuso o solicitud administrativa." />
        <ActionCard icon={Gauge} title="Limites y consumo" text="Uso por cuenta, alertas y ampliaciones temporales." />
      </section>
      <AccountsTable accounts={data.accounts} onManage={setSelectedAccount} title="Clientes alojados" />
      {showCreateModal ? <CreateHostingAccountModal accounts={data.accounts} onClose={() => setShowCreateModal(false)} onRefresh={onRefresh} plans={data.plans} profile={data.profile} /> : null}
      {selectedAccount ? <AccountActionsModal account={selectedAccount} onClose={() => setSelectedAccount(null)} onRefresh={onRefresh} /> : null}
    </div>
  )
}

function PlansPage({ data }: { data: ResellerData }) {
  const resellerPlans = data.plans.filter((plan) => plan.is_active && (plan.features?.plan_scope !== "reseller"))
  return (
    <div className="space-y-4">
      <PageHeader icon={Box} subtitle="Paquetes reales disponibles para provisionar cuentas del revendedor. La edicion de planes sigue bajo administrador." title="Paquetes de hosting" />
      <div className="grid gap-3 xl:grid-cols-3">
        {resellerPlans.map((plan) => (
          <div className="eh-card p-4" key={plan.id}>
            <div className="flex items-start justify-between">
              <div>
                <div className="eh-kicker">Plan real</div>
                <h3 className="mt-1 text-lg font-bold">{plan.name}</h3>
              </div>
              <StatusBadge state={plan.is_active ? "active" : "suspended"} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <PlanLimit label="Disco" value={formatMb(plan.disk_mb)} />
              <PlanLimit label="Trafico" value={formatMb(plan.bandwidth_mb)} />
              <PlanLimit label="Dominios" value={String(plan.max_domains)} />
              <PlanLimit label="Bases de datos" value={String(plan.max_databases)} />
              <PlanLimit label="Correos" value={String(plan.max_mailboxes)} />
              <PlanLimit label="PHP" value={(plan.allowed_php_versions || []).join(", ") || "Default"} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DnsGlobalPage({ data }: { data: ResellerData }) {
  return (
    <CrudPage
      columns={["Nameserver", "IP", "Rol", "Zona", "Estado"]}
      hideRowActions
      icon={Cloud}
      rows={data.nameservers.map((row) => [row.hostname, row.ip_address || "-", row.role, row.zone || "-", row.status])}
      subtitle="Nameservers reales publicados para entregar a clientes o configurar dominios."
      title="DNS global"
    />
  )
}

function SslClientsPage({ data, onRefresh }: { data: ResellerData; onRefresh: () => Promise<void> }) {
  const [selectedDomain, setSelectedDomain] = useState<HostingDomain | null>(null)
  return (
    <>
      <CrudPage
        columns={["Dominio", "Cliente", "Tipo", "Estado", "Vence"]}
        icon={ShieldCheck}
        onRowAction={(row) => setSelectedDomain(data.domains.find((domain) => domain.id === Number(row[5])) || null)}
        rows={data.domains.map((domain) => [domain.domain, domain.account_username, domain.domain_type, domain.ssl_status, domain.ssl_expires_at ? formatDate(domain.ssl_expires_at) : "Pendiente", String(domain.id)])}
        subtitle="Activacion y revision de certificados SSL sin entrar a cada cuenta individual."
        title="SSL de clientes"
      />
      {selectedDomain ? <SslActionsModal domain={selectedDomain} onClose={() => setSelectedDomain(null)} onRefresh={onRefresh} /> : null}
    </>
  )
}

function MailAccountsPage({ data, onRefresh }: { data: ResellerData; onRefresh: () => Promise<void> }) {
  const [showMailModal, setShowMailModal] = useState(false)
  const [selectedMailbox, setSelectedMailbox] = useState<HostingMailbox | null>(null)
  return (
    <>
      <CrudPage
        action="Crear buzon"
        columns={["Cuenta", "Cliente", "Uso", "Estado", "Limite SMTP"]}
        icon={Mail}
        onAction={() => setShowMailModal(true)}
        onRowAction={(row) => setSelectedMailbox(data.mailboxes.find((mailbox) => mailbox.id === Number(row[5])) || null)}
        rows={data.mailboxes.map((mailbox) => [mailbox.email, mailbox.account_domain, formatMb(mailbox.used_mb), mailbox.status, `${mailbox.outgoing_limit}/h`, String(mailbox.id)])}
        subtitle="Buzones reales, uso, reputacion y limites SMTP por cliente."
        title="Cuentas de correo"
      />
      {showMailModal ? <CreateMailboxModal accounts={data.accounts} onClose={() => setShowMailModal(false)} onRefresh={onRefresh} /> : null}
      {selectedMailbox ? <MailboxActionsModal mailbox={selectedMailbox} onClose={() => setSelectedMailbox(null)} onRefresh={onRefresh} /> : null}
    </>
  )
}

function BackupsClientsPage({ data, onRefresh }: { data: ResellerData; onRefresh: () => Promise<void> }) {
  const [showBackupPolicyModal, setShowBackupPolicyModal] = useState(false)
  const [showS3Modal, setShowS3Modal] = useState(false)
  const rows = [
    ...data.accountExports.map((item) => [item.account_domain, item.export_type, item.node_hostname || "-", formatDate(item.updated_at), item.status]),
    ...data.backupRestores.map((item) => [item.accounts_detail?.[0]?.domain || "Restauracion", item.restore_type, item.destination_node_hostname || "-", formatDate(item.updated_at), item.status]),
  ]
  return (
    <>
      <CrudPage
        action="Nueva politica"
        secondaryAction="Configurar S3"
        columns={["Cliente", "Tipo", "Destino", "Fecha", "Estado"]}
        icon={DatabaseBackup}
        onAction={() => setShowBackupPolicyModal(true)}
        onSecondaryAction={() => setShowS3Modal(true)}
        rows={rows}
        subtitle="Historial, restauraciones y politicas de copias de seguridad por cliente."
        title="Backups de clientes"
      />
      {showBackupPolicyModal ? <CreateBackupPolicyModal onClose={() => setShowBackupPolicyModal(false)} onRefresh={onRefresh} storage={data.backupStorage} /> : null}
      {showS3Modal ? <ConfigureS3StorageModal onClose={() => setShowS3Modal(false)} onRefresh={onRefresh} /> : null}
    </>
  )
}

function TicketsPage({ data, onRefresh }: { data: ResellerData; onRefresh: () => Promise<void> }) {
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  return (
    <>
      <CrudPage
        action="Nuevo ticket"
        columns={["ID", "Cliente", "Asunto", "Prioridad", "Estado", "Actualizado"]}
        icon={Ticket}
        onAction={() => setShowTicketModal(true)}
        onRowAction={(row) => setSelectedTicket(data.tickets.find((ticket) => ticket.id === Number(row[6])) || null)}
        rows={data.tickets.map((ticket) => [ticket.display_id, ticket.account_domain, ticket.subject, priorityLabel(ticket.priority), statusLabel(ticket.status), formatDate(ticket.updated_at), String(ticket.id)])}
        subtitle="Soporte del revendedor con tickets reales y trazabilidad por cuenta."
        title="Tickets"
      />
      {showTicketModal ? <CreateTicketModal accounts={data.accounts} onClose={() => setShowTicketModal(false)} onRefresh={onRefresh} /> : null}
      {selectedTicket ? <TicketDetailModal onClose={() => setSelectedTicket(null)} onRefresh={onRefresh} ticket={selectedTicket} /> : null}
    </>
  )
}

function WhiteLabelPage({ data, onRefresh }: { data: ResellerData; onRefresh: () => Promise<void> }) {
  const [showBrand, setShowBrand] = useState(false)
  return (
    <div className="space-y-4">
      <PageHeader action="Guardar marca" icon={Palette} onAction={() => setShowBrand(true)} subtitle="Identidad comercial real del perfil revendedor." title="White label" />
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.2fr]">
        <div className="eh-card p-4">
          <h3 className="font-bold">Identidad visual</h3>
          <div className="mt-4 space-y-3">
            <ProfileInfo label="Nombre comercial" value={data.profile?.company_name || data.profile?.username || "-"} />
            <ProfileInfo label="Dominio del panel" value={data.profile?.panel_domain || "No configurado"} />
            <ProfileInfo label="Correo soporte" value={data.profile?.support_email || data.profile?.email || "-"} />
          </div>
        </div>
        <div className="eh-card p-4">
          <h3 className="font-bold">Colores</h3>
          <p className="mt-1 text-sm text-slate-500">Marca basica persistida en backend para el revendedor.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="h-10 rounded" style={{ background: data.profile?.brand_primary_color || "#2563eb" }} />
              <p className="mt-2 text-xs font-bold text-slate-500">Primario</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="h-10 rounded" style={{ background: data.profile?.brand_accent_color || "#0891b2" }} />
              <p className="mt-2 text-xs font-bold text-slate-500">Acento</p>
            </div>
          </div>
        </div>
      </section>
      {showBrand ? <BrandModal onClose={() => setShowBrand(false)} onRefresh={onRefresh} profile={data.profile} /> : null}
    </div>
  )
}

function CommercialStatusPage({ data, onRefresh }: { data: ResellerData; onRefresh: () => Promise<void> }) {
  const [selectedAccount, setSelectedAccount] = useState<HostingAccount | null>(null)
  return (
    <>
      <CrudPage
        columns={["Cliente", "Servicio", "Estado comercial", "Actualizado", "Dominio"]}
        icon={CreditCard}
        onRowAction={(row) => setSelectedAccount(data.accounts.find((account) => account.id === row[5]) || null)}
        rows={data.accounts.map((account) => [account.customer_name || account.customer_email || account.username, account.plan_name || "-", statusText(account.status), formatDate(account.updated_at), account.primary_domain, account.id])}
        subtitle="Estado comercial derivado del estado real de las cuentas hosting."
        title="Clientes y estado comercial"
      />
      {selectedAccount ? <AccountActionsModal account={selectedAccount} onClose={() => setSelectedAccount(null)} onRefresh={onRefresh} /> : null}
    </>
  )
}

function ResourceUsagePage({ data }: { data: ResellerData }) {
  const [selectedAccount, setSelectedAccount] = useState<HostingAccount | null>(null)
  const diskUsed = sum(data.accounts, (account) => usageNumber(account, "disk_used_mb"))
  const diskLimit = data.profile?.disk_mb || sum(data.accounts, (account) => account.disk_mb)
  const bandwidthUsed = sum(data.accounts, (account) => usageNumber(account, "bandwidth_used_mb"))
  const bandwidthLimit = data.profile?.bandwidth_mb || sum(data.accounts, (account) => account.bandwidth_mb)
  const mailboxes = data.mailboxes.length
  const rows = [
    { label: "Disco asignado", used: diskUsed, total: diskLimit, unit: "MB", tone: "bg-blue-600" },
    { label: "Trafico mensual", used: bandwidthUsed, total: bandwidthLimit, unit: "MB", tone: "bg-emerald-600" },
    { label: "Cuentas creadas", used: data.accounts.length, total: data.profile?.max_accounts || data.accounts.length || 1, unit: "", tone: "bg-orange-500" },
    { label: "Correos activos", used: mailboxes, total: data.profile?.max_mailboxes || mailboxes || 1, unit: "", tone: "bg-sky-600" },
  ]
  return (
    <div className="space-y-4">
      <PageHeader icon={Gauge} subtitle="Uso agregado de recursos del revendedor y distribucion por cliente." title="Uso de recursos" />
      <section className="grid gap-3 xl:grid-cols-4">
        {rows.map((row) => (
          <div className="eh-card p-4" key={row.label}>
            <div className="eh-kicker">{row.label}</div>
            <div className="mt-2 text-2xl font-bold">{row.unit === "MB" ? `${formatMb(row.used)} / ${formatMb(row.total)}` : `${row.used} / ${row.total}`}</div>
            <Progress value={pct(row.used, row.total)} tone={row.tone} />
          </div>
        ))}
      </section>
      <AccountsTable accounts={data.accounts} onManage={setSelectedAccount} title="Consumo por cuenta" />
      {selectedAccount ? <ResourceAccountUsageModal account={selectedAccount} onClose={() => setSelectedAccount(null)} /> : null}
    </div>
  )
}

function ImportAccountsPage({ data, onRefresh }: { data: ResellerData; onRefresh: () => Promise<void> }) {
  const [showUploadModal, setShowUploadModal] = useState(false)
  return (
    <div className="space-y-4">
      <PageHeader action="Cargar archivo" icon={Import} onAction={() => setShowUploadModal(true)} subtitle="Carga backups o exportaciones de otros paneles, analiza su contenido y restaura cuentas manualmente." title="Importar cuentas" />
      <CrudPage
        columns={["Origen", "Cuenta", "Nodo", "Estado", "Progreso"]}
        hideHeader
        icon={Import}
        rows={data.migrationRuns.map((run) => [run.source?.provider_label || run.origin || "-", run.account_label || `${run.total_accounts} cuentas`, run.destination_node_hostname || "-", run.status, `${run.progress_percent}%`])}
        subtitle="Importaciones reales registradas en backend."
        title="Importaciones"
      />
      {showUploadModal ? <ImportAccountUploadModal accounts={data.accounts} onClose={() => setShowUploadModal(false)} onRefresh={onRefresh} profile={data.profile} /> : null}
    </div>
  )
}

function ExportDataPage({ data, onRefresh }: { data: ResellerData; onRefresh: () => Promise<void> }) {
  const [showExportModal, setShowExportModal] = useState(false)
  return (
    <div className="space-y-4">
      <PageHeader action="Generar exportacion" icon={FileDown} onAction={() => setShowExportModal(true)} subtitle="Exporta cuentas completas o parciales y descarga paquetes cuando el agente los complete." title="Exportar datos" />
      <CrudPage
        columns={["Cuenta", "Tipo", "Nodo", "Tamano", "Estado", "Actualizado"]}
        hideHeader
        icon={FileDown}
        rows={data.accountExports.map((item) => [item.account_domain, item.export_type, item.node_hostname || "-", formatBytes(item.size_bytes), item.status, formatDate(item.updated_at)])}
        subtitle="Exportaciones reales de cuentas del revendedor."
        title="Exportaciones"
      />
      {showExportModal ? <GenerateExportModal accounts={data.accounts} onClose={() => setShowExportModal(false)} onRefresh={onRefresh} /> : null}
    </div>
  )
}

function AuditPage({ data }: { data: ResellerData }) {
  return (
    <div className="space-y-4">
      <PageHeader icon={ClipboardList} subtitle="Historial real de acciones importantes filtrado por cuentas del revendedor." title="Auditoria" />
      <DataTable columns={["Fecha", "Usuario", "Accion", "Cuenta", "Recurso", "Resultado"]} rows={data.auditLogs.map((row) => [formatDate(row.created_at), row.user_username, row.action, row.account_domain || "-", row.target_label || row.target_type || "-", String(row.status_code || "OK")])} />
    </div>
  )
}

function LogsPage({ data }: { data: ResellerData }) {
  const mailEvents = data.accounts.flatMap((account) => {
    const mail = (account.last_usage as JsonRecord | undefined)?.mail as JsonRecord | undefined
    const events = Array.isArray(mail?.events) ? (mail.events as JsonRecord[]) : []
    return events.map((event) => [formatDate(String(event.time || "")), String(event.direction || "-"), String(event.from || "-"), String(event.to || "-"), String(event.status || "-"), String(event.detail || account.primary_domain)])
  })
  return (
    <div className="space-y-4">
      <PageHeader icon={FileText} subtitle="Eventos de correo leidos desde la ultima telemetria de uso de las cuentas." title="Logs" />
      <DataTable columns={["Fecha", "Tipo", "De", "Para", "Estado", "Detalle"]} empty="Sin eventos de correo recientes en la telemetria." rows={mailEvents} />
    </div>
  )
}

function ResellerProfilePage({ data, onRefresh }: { data: ResellerData; onRefresh: () => Promise<void> }) {
  const [showBrand, setShowBrand] = useState(false)
  const profile = data.profile
  return (
    <div className="space-y-4">
      <PageHeader action="Editar perfil" icon={BriefcaseBusiness} onAction={() => setShowBrand(true)} subtitle="Informacion comercial, plan reseller y consumo general de recursos asignados." title="Perfil revendedor" />
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.2fr]">
        <div className="eh-card p-5">
          <div className="eh-kicker">Cuenta revendedor</div>
          <h3 className="mt-2 text-2xl font-bold">{profile?.company_name || profile?.username || "Revendedor"}</h3>
          <div className="mt-4 space-y-2">
            <ProfileInfo label="Usuario" value={profile?.username || "-"} />
            <ProfileInfo label="Correo principal" value={profile?.email || "-"} />
            <ProfileInfo label="Dominio panel" value={profile?.panel_domain || "No configurado"} />
            <ProfileInfo label="Plan revendedor" value={profile?.plan_name || "Sin plan"} />
            <ProfileInfo label="Nodo principal" value={profile?.primary_node_hostname || "No fijado"} />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ProfileGauge label="Disco" sub={`${formatMb(profile?.disk_used_mb)} / ${formatMb(profile?.disk_mb)}`} value={profile?.disk_pct || 0} />
          <ProfileGauge label="Trafico" sub={`${formatMb(profile?.bandwidth_used_mb)} / ${formatMb(profile?.bandwidth_mb)}`} value={profile?.bandwidth_pct || 0} />
          <ProfileGauge label="Cuentas" sub={`${profile?.accounts_count || data.accounts.length} / ${profile?.max_accounts || "-"}`} value={pct(profile?.accounts_count || data.accounts.length, profile?.max_accounts || data.accounts.length || 1)} />
          <ProfileGauge label="Correos" sub={`${data.mailboxes.length} / ${profile?.max_mailboxes || "-"}`} value={pct(data.mailboxes.length, profile?.max_mailboxes || data.mailboxes.length || 1)} />
        </div>
      </section>
      {showBrand ? <BrandModal onClose={() => setShowBrand(false)} onRefresh={onRefresh} profile={profile} /> : null}
    </div>
  )
}

function TeamUsersPage({ data, isLoading, onRefresh }: { data: ResellerData; isLoading: boolean; onRefresh: () => Promise<void> }) {
  const [showInvite, setShowInvite] = useState(false)
  const [selectedMember, setSelectedMember] = useState<ResellerTeamMember | null>(null)
  return (
    <div className="space-y-4">
      <PageHeader action="Invitar usuario" icon={UserCog} onAction={() => setShowInvite(true)} subtitle="Usuarios reales del revendedor con permisos de vista y soporte." title="Usuarios del equipo" />
      <CrudPage
        columns={["Usuario", "Correo", "Rol", "Estado", "Activo"]}
        hideHeader
        icon={UserCog}
        onRowAction={(row) => setSelectedMember(data.team.find((member) => member.id === Number(row[5])) || null)}
        rows={data.team.map((member) => [member.username, member.email, teamRoleLabel(member.role), statusText(member.status), member.is_active ? "Si" : "No", String(member.id)])}
        subtitle={isLoading ? "Cargando usuarios..." : "Personal interno ligado a este revendedor."}
        title="Equipo"
      />
      {showInvite ? <InviteTeamUserModal onClose={() => setShowInvite(false)} onRefresh={onRefresh} /> : null}
      {selectedMember ? <TeamMemberModal member={selectedMember} onClose={() => setSelectedMember(null)} onRefresh={onRefresh} /> : null}
    </div>
  )
}

function SecurityAccountPage({ data, onRefresh }: { data: ResellerData; onRefresh: () => Promise<void> }) {
  const [activeModal, setActiveModal] = useState<"password" | "ip" | null>(null)
  return (
    <div className="space-y-4">
      <PageHeader icon={LockKeyhole} subtitle="Controles de acceso para proteger la cuenta revendedor y su personal." title="Seguridad" />
      <section className="grid gap-3 xl:grid-cols-4">
        <SecurityCard action="Cambiar" icon={LockKeyhole} onClick={() => setActiveModal("password")} text="Actualiza la contrasena propia del usuario actual." title="Contrasena" />
        <SecurityCard action="Despues" icon={ShieldCheck} text="2FA queda diferido para despues de cerrar produccion." title="Doble factor" />
        <SecurityCard action="Configurar" icon={Activity} onClick={() => setActiveModal("ip")} text={`${data.security?.security.ip_allowlist?.length || 0} IPs o rangos permitidos.`} title="IP allowlist" />
        <SecurityCard action="Global" icon={KeyRound} text={`${data.profile?.status || "active"} en perfil reseller.`} title="Estado" />
      </section>
      <DataTable
        columns={["Dispositivo", "IP", "Rol", "Estado", "Ultimo acceso"]}
        empty="Sin sesiones registradas para este usuario."
        rows={(data.security?.sessions || []).map((session) => [session.device || "-", session.ip_address || "-", session.role, session.status, formatDate(session.last_seen_at || session.created_at)])}
      />
      {activeModal === "password" ? <ChangePasswordModal onClose={() => setActiveModal(null)} /> : null}
      {activeModal === "ip" ? <IpAllowlistModal onClose={() => setActiveModal(null)} onRefresh={onRefresh} security={data.security} /> : null}
    </div>
  )
}

function AccountActionsModal({ account, onClose, onRefresh }: { account: HostingAccount; onClose: () => void; onRefresh: () => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function run(action: "suspend" | "unsuspend") {
    setSaving(true)
    setError("")
    try {
      if (action === "suspend") await hostingApi.suspendAccount(account.id)
      else await hostingApi.unsuspendAccount(account.id)
      await onRefresh()
      onClose()
    } catch (err) {
      setError(readMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <ModalShell onClose={onClose} title={`Gestionar ${account.primary_domain}`}>
      <div className="space-y-4 p-5">
        {error ? <Alert text={error} /> : null}
        <div className="grid gap-3 md:grid-cols-4">
          <PlanLimit label="Cliente" value={account.customer_name || account.customer_email || account.username} />
          <PlanLimit label="Plan" value={account.plan_name || "-"} />
          <PlanLimit label="Estado" value={statusText(account.status)} />
          <PlanLimit label="Nodo" value={account.node_hostname || "-"} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <button className="rounded-md border border-slate-200 bg-slate-50 p-4 text-left hover:bg-blue-50" disabled={saving} onClick={() => run("suspend")} type="button">
            <p className="text-sm font-bold text-slate-900">Suspender cuenta</p>
            <p className="mt-1 text-xs text-slate-500">Bloquea servicios por mora, abuso o solicitud administrativa.</p>
          </button>
          <button className="rounded-md border border-slate-200 bg-slate-50 p-4 text-left hover:bg-blue-50" disabled={saving} onClick={() => run("unsuspend")} type="button">
            <p className="text-sm font-bold text-slate-900">Reactivar cuenta</p>
            <p className="mt-1 text-xs text-slate-500">Marca el servicio como activo si la situacion fue regularizada.</p>
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

function CreateHostingAccountModal({ accounts, plans, profile, onClose, onRefresh }: { accounts: HostingAccount[]; plans: HostingPlan[]; profile: HostingReseller | null; onClose: () => void; onRefresh: () => Promise<void> }) {
  const firstPlan = plans.find((plan) => plan.features?.plan_scope !== "reseller") || plans[0]
  const firstAccount = accounts[0]
  const defaultNode = profile?.primary_node_hostname || firstAccount?.node_hostname || ""
  const [form, setForm] = useState({
    account_password: "",
    customer_email: "",
    customer_name: "",
    node: defaultNode,
    php_version: firstPlan?.allowed_php_versions?.[0] || "8.3",
    plan: firstPlan ? String(firstPlan.id) : "",
    primary_domain: "",
    username: "",
    web_engine: firstPlan?.allowed_web_engines?.[0] || "nginx_apache",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function submit() {
    setSaving(true)
    setError("")
    try {
      await hostingApi.provisionAccount({ ...form, plan: Number(form.plan), ssl_email: form.customer_email, ssl_staging: false, ssl_force_renewal: false })
      await onRefresh()
      onClose()
    } catch (err) {
      setError(readMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <ModalShell onClose={onClose} title="Nueva cuenta de hosting">
      <div className="space-y-4 p-5">
        {error ? <Alert text={error} /> : null}
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="Cliente" onChange={(value) => setForm({ ...form, customer_name: value })} placeholder="Nombre del cliente" value={form.customer_name} />
          <TextField label="Correo cliente" onChange={(value) => setForm({ ...form, customer_email: value })} placeholder="cliente@dominio.com" value={form.customer_email} />
          <TextField label="Dominio principal" onChange={(value) => setForm({ ...form, primary_domain: value })} placeholder="cliente.com" value={form.primary_domain} />
          <TextField label="Usuario" onChange={(value) => setForm({ ...form, username: value })} placeholder="clientecom" value={form.username} />
          <TextField label="Contrasena" onChange={(value) => setForm({ ...form, account_password: value })} placeholder="Minimo 8 caracteres" type="password" value={form.account_password} />
          <SelectField label="Plan" onChange={(value) => setForm({ ...form, plan: value })} options={plans.filter((plan) => plan.features?.plan_scope !== "reseller").map((plan) => [String(plan.id), plan.name])} value={form.plan} />
        </div>
      </div>
      <ModalFooter onCancel={onClose} onSubmit={submit} saving={saving} submitLabel="Crear cuenta" />
    </ModalShell>
  )
}

function SslActionsModal({ domain, onClose, onRefresh }: { domain: HostingDomain; onClose: () => void; onRefresh: () => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function issue() {
    setSaving(true)
    setError("")
    try {
      await hostingApi.issueDomainSsl(domain.id)
      await onRefresh()
      onClose()
    } catch (err) {
      setError(readMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <ModalShell onClose={onClose} title={`SSL ${domain.domain}`}>
      <div className="space-y-4 p-5">
        {error ? <Alert text={error} /> : null}
        <div className="grid gap-3 md:grid-cols-3">
          <PlanLimit label="Cuenta" value={domain.account_username} />
          <PlanLimit label="Estado SSL" value={domain.ssl_status} />
          <PlanLimit label="DNS" value={domain.dns_status} />
        </div>
      </div>
      <ModalFooter onCancel={onClose} onSubmit={issue} saving={saving} submitLabel="Emitir / renovar SSL" />
    </ModalShell>
  )
}

function CreateMailboxModal({ accounts, onClose, onRefresh }: { accounts: HostingAccount[]; onClose: () => void; onRefresh: () => Promise<void> }) {
  const [form, setForm] = useState({ account: accounts[0]?.id || "", email: "", password: "", quota_mb: "1024" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function submit() {
    setSaving(true)
    setError("")
    try {
      await hostingApi.createMailbox({ account: form.account, email: form.email, password: form.password, quota_mb: Number(form.quota_mb) })
      await onRefresh()
      onClose()
    } catch (err) {
      setError(readMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <ModalShell onClose={onClose} title="Crear buzon">
      <div className="space-y-4 p-5">
        {error ? <Alert text={error} /> : null}
        <SelectField label="Cuenta" onChange={(value) => setForm({ ...form, account: value })} options={accounts.map((account) => [account.id, account.primary_domain])} value={form.account} />
        <div className="grid gap-3 md:grid-cols-3">
          <TextField label="Correo" onChange={(value) => setForm({ ...form, email: value })} placeholder="ventas@dominio.com" value={form.email} />
          <TextField label="Contrasena" onChange={(value) => setForm({ ...form, password: value })} placeholder="Minimo 8 caracteres" type="password" value={form.password} />
          <TextField label="Cuota MB" onChange={(value) => setForm({ ...form, quota_mb: value })} placeholder="1024" value={form.quota_mb} />
        </div>
      </div>
      <ModalFooter onCancel={onClose} onSubmit={submit} saving={saving} submitLabel="Crear buzon" />
    </ModalShell>
  )
}

function MailboxActionsModal({ mailbox, onClose, onRefresh }: { mailbox: HostingMailbox; onClose: () => void; onRefresh: () => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function run(action: "suspend" | "unsuspend" | "webmail") {
    setSaving(true)
    setError("")
    try {
      if (action === "suspend") await hostingApi.suspendMailbox(mailbox.id)
      if (action === "unsuspend") await hostingApi.unsuspendMailbox(mailbox.id)
      if (action === "webmail") {
        const response = await hostingApi.webmailUrl(mailbox.id)
        window.open(response.url, "_blank", "noopener,noreferrer")
      }
      await onRefresh()
      if (action !== "webmail") onClose()
    } catch (err) {
      setError(readMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <ModalShell onClose={onClose} title={mailbox.email}>
      <div className="space-y-4 p-5">
        {error ? <Alert text={error} /> : null}
        <div className="grid gap-3 md:grid-cols-3">
          <PlanLimit label="Cuenta" value={mailbox.account_domain} />
          <PlanLimit label="Uso" value={formatMb(mailbox.used_mb)} />
          <PlanLimit label="Estado" value={mailbox.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={saving} onClick={() => run("webmail")} size="sm" variant="outline">Abrir webmail</Button>
          <Button disabled={saving} onClick={() => run("suspend")} size="sm" variant="outline">Suspender</Button>
          <Button disabled={saving} onClick={() => run("unsuspend")} size="sm">Reactivar</Button>
        </div>
      </div>
    </ModalShell>
  )
}

function CreateTicketModal({ accounts, onClose, onRefresh }: { accounts: HostingAccount[]; onClose: () => void; onRefresh: () => Promise<void> }) {
  const [form, setForm] = useState({ account: accounts[0]?.id || "", body: "", department: "technical", priority: "medium", subject: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function submit() {
    setSaving(true)
    setError("")
    try {
      const payload = new FormData()
      Object.entries(form).forEach(([key, value]) => payload.append(key, value))
      await hostingApi.createTicket(payload)
      await onRefresh()
      onClose()
    } catch (err) {
      setError(readMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <ModalShell onClose={onClose} title="Nuevo ticket">
      <div className="space-y-4 p-5">
        {error ? <Alert text={error} /> : null}
        <TextField label="Asunto" onChange={(value) => setForm({ ...form, subject: value })} placeholder="Ej. Revisar limite de recursos" value={form.subject} />
        <div className="grid gap-3 md:grid-cols-3">
          <SelectField label="Cuenta" onChange={(value) => setForm({ ...form, account: value })} options={accounts.map((account) => [account.id, account.primary_domain])} value={form.account} />
          <SelectField label="Prioridad" onChange={(value) => setForm({ ...form, priority: value })} options={priorities} value={form.priority} />
          <SelectField label="Departamento" onChange={(value) => setForm({ ...form, department: value })} options={departments} value={form.department} />
        </div>
        <TextArea label="Descripcion del ticket" onChange={(value) => setForm({ ...form, body: value })} placeholder="Describe el problema, cliente afectado, dominio y datos utiles." value={form.body} />
      </div>
      <ModalFooter onCancel={onClose} onSubmit={submit} saving={saving} submitLabel="Registrar ticket" />
    </ModalShell>
  )
}

function TicketDetailModal({ ticket, onClose, onRefresh }: { ticket: SupportTicket; onClose: () => void; onRefresh: () => Promise<void> }) {
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function reply() {
    setSaving(true)
    setError("")
    try {
      const payload = new FormData()
      payload.append("body", body)
      await hostingApi.replyTicket(ticket.id, payload)
      await onRefresh()
      onClose()
    } catch (err) {
      setError(readMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <ModalShell onClose={onClose} title={`${ticket.display_id} ${ticket.subject}`}>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
        {error ? <Alert text={error} /> : null}
        <div className="grid gap-3 md:grid-cols-4">
          <PlanLimit label="Cuenta" value={ticket.account_domain} />
          <PlanLimit label="Estado" value={statusLabel(ticket.status)} />
          <PlanLimit label="Prioridad" value={priorityLabel(ticket.priority)} />
          <PlanLimit label="Actualizado" value={formatDate(ticket.updated_at)} />
        </div>
        {(ticket.messages || []).map((message) => (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={message.id}>
            <div className="text-sm font-bold">{authorLabel(message.author_type)}</div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.body}</p>
          </div>
        ))}
        {ticket.status !== "closed" ? <TextArea label="Responder" onChange={setBody} placeholder="Escribe una respuesta..." value={body} /> : null}
      </div>
      {ticket.status !== "closed" ? <ModalFooter onCancel={onClose} onSubmit={reply} saving={saving} submitLabel="Responder" /> : null}
    </ModalShell>
  )
}

function BrandModal({ profile, onClose, onRefresh }: { profile: HostingReseller | null; onClose: () => void; onRefresh: () => Promise<void> }) {
  const [form, setForm] = useState({
    brand_accent_color: profile?.brand_accent_color || "#0891b2",
    brand_primary_color: profile?.brand_primary_color || "#2563eb",
    company_name: profile?.company_name || "",
    panel_domain: profile?.panel_domain || "",
    support_email: profile?.support_email || profile?.email || "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function submit() {
    setSaving(true)
    setError("")
    try {
      await hostingApi.updateResellerSelf(form)
      await onRefresh()
      onClose()
    } catch (err) {
      setError(readMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <ModalShell onClose={onClose} title="Actualizar marca">
      <div className="space-y-4 p-5">
        {error ? <Alert text={error} /> : null}
        <TextField label="Nombre comercial" onChange={(value) => setForm({ ...form, company_name: value })} placeholder="Mi hosting" value={form.company_name} />
        <TextField label="Dominio del panel" onChange={(value) => setForm({ ...form, panel_domain: value })} placeholder="panel.midominio.com" value={form.panel_domain} />
        <TextField label="Correo soporte" onChange={(value) => setForm({ ...form, support_email: value })} placeholder="soporte@midominio.com" value={form.support_email} />
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="Color primario" onChange={(value) => setForm({ ...form, brand_primary_color: value })} placeholder="#2563eb" value={form.brand_primary_color} />
          <TextField label="Color acento" onChange={(value) => setForm({ ...form, brand_accent_color: value })} placeholder="#0891b2" value={form.brand_accent_color} />
        </div>
      </div>
      <ModalFooter onCancel={onClose} onSubmit={submit} saving={saving} submitLabel="Guardar marca" />
    </ModalShell>
  )
}

function InviteTeamUserModal({ onClose, onRefresh }: { onClose: () => void; onRefresh: () => Promise<void> }) {
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "", password: "", role: "support", username: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function submit() {
    setSaving(true)
    setError("")
    try {
      await hostingApi.createResellerTeamMember({ ...form, role: form.role as ResellerTeamMember["role"] })
      await onRefresh()
      onClose()
    } catch (err) {
      setError(readMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <ModalShell onClose={onClose} title="Invitar usuario del equipo">
      <div className="space-y-4 p-5">
        {error ? <Alert text={error} /> : null}
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="Usuario" onChange={(value) => setForm({ ...form, username: value })} placeholder="soporte1" value={form.username} />
          <TextField label="Correo" onChange={(value) => setForm({ ...form, email: value })} placeholder="soporte@empresa.com" value={form.email} />
          <TextField label="Nombre" onChange={(value) => setForm({ ...form, first_name: value })} placeholder="Nombre" value={form.first_name} />
          <TextField label="Apellido" onChange={(value) => setForm({ ...form, last_name: value })} placeholder="Apellido" value={form.last_name} />
          <TextField label="Contrasena" onChange={(value) => setForm({ ...form, password: value })} placeholder="Minimo 8 caracteres" type="password" value={form.password} />
          <SelectField label="Rol" onChange={(value) => setForm({ ...form, role: value })} options={[["support", "Soporte"], ["commercial", "Comercial"], ["admin_reseller", "Administrador reseller"]]} value={form.role} />
        </div>
      </div>
      <ModalFooter onCancel={onClose} onSubmit={submit} saving={saving} submitLabel="Crear usuario" />
    </ModalShell>
  )
}

function TeamMemberModal({ member, onClose, onRefresh }: { member: ResellerTeamMember; onClose: () => void; onRefresh: () => Promise<void> }) {
  const [role, setRole] = useState(member.role)
  const [status, setStatus] = useState(member.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function submit() {
    setSaving(true)
    setError("")
    try {
      await hostingApi.updateResellerTeamMember(member.id, { is_active: status === "active", role, status })
      await onRefresh()
      onClose()
    } catch (err) {
      setError(readMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <ModalShell onClose={onClose} title={`Usuario ${member.username}`}>
      <div className="space-y-4 p-5">
        {error ? <Alert text={error} /> : null}
        <div className="grid gap-3 md:grid-cols-2">
          <PlanLimit label="Correo" value={member.email} />
          <PlanLimit label="Permiso" value="Vista y soporte" />
          <SelectField label="Rol" onChange={(value) => setRole(value as ResellerTeamMember["role"])} options={[["support", "Soporte"], ["commercial", "Comercial"], ["admin_reseller", "Administrador reseller"]]} value={role} />
          <SelectField label="Estado" onChange={(value) => setStatus(value as ResellerTeamMember["status"])} options={[["active", "Activo"], ["suspended", "Suspendido"]]} value={status} />
        </div>
      </div>
      <ModalFooter onCancel={onClose} onSubmit={submit} saving={saving} submitLabel="Guardar usuario" />
    </ModalShell>
  )
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ current_password: "", new_password: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function submit() {
    setSaving(true)
    setError("")
    try {
      await hostingApi.changeOwnPassword(form)
      onClose()
    } catch (err) {
      setError(readMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <ModalShell onClose={onClose} title="Cambiar contrasena">
      <div className="space-y-4 p-5">
        {error ? <Alert text={error} /> : null}
        <TextField label="Contrasena actual" onChange={(value) => setForm({ ...form, current_password: value })} placeholder="Actual" type="password" value={form.current_password} />
        <TextField label="Nueva contrasena" onChange={(value) => setForm({ ...form, new_password: value })} placeholder="Minimo 8 caracteres" type="password" value={form.new_password} />
      </div>
      <ModalFooter onCancel={onClose} onSubmit={submit} saving={saving} submitLabel="Cambiar" />
    </ModalShell>
  )
}

function IpAllowlistModal({ security, onClose, onRefresh }: { security: ResellerSecurityResponse | null; onClose: () => void; onRefresh: () => Promise<void> }) {
  const [value, setValue] = useState((security?.security.ip_allowlist || []).join("\n"))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function submit() {
    setSaving(true)
    setError("")
    try {
      await hostingApi.updateResellerSecurity({ ip_allowlist: value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) })
      await onRefresh()
      onClose()
    } catch (err) {
      setError(readMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <ModalShell onClose={onClose} title="Restriccion por IP">
      <div className="space-y-4 p-5">
        {error ? <Alert text={error} /> : null}
        <TextArea label="IPs o rangos permitidos" onChange={setValue} placeholder={"203.0.113.10\n198.51.100.0/24"} value={value} />
      </div>
      <ModalFooter onCancel={onClose} onSubmit={submit} saving={saving} submitLabel="Guardar IPs" />
    </ModalShell>
  )
}

function CreateBackupPolicyModal({ onClose, onRefresh, storage }: { onClose: () => void; onRefresh: () => Promise<void>; storage: BackupStorageDestination[] }) {
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function submit() {
    setSaving(true)
    setError("")
    try {
      await hostingApi.createBackupPolicy({
        frequency: "daily_02",
        full_account: true,
        include_config: true,
        include_databases: true,
        include_files: true,
        include_mail: true,
        name: name || "Politica reseller",
        notes: "Creada desde panel revendedor",
        policy_type: "incremental",
        retention_copies: 12,
        retention_days: 30,
        status: "active",
        storage: storage[0]?.id ?? null,
      })
      await onRefresh()
      onClose()
    } catch (err) {
      setError(readMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <ModalShell onClose={onClose} title="Nueva politica de backup">
      <div className="space-y-4 p-5">
        {error ? <Alert text={error} /> : null}
        <TextField label="Nombre" onChange={setName} placeholder="Backup diario clientes" value={name} />
      </div>
      <ModalFooter onCancel={onClose} onSubmit={submit} saving={saving} submitLabel="Crear politica" />
    </ModalShell>
  )
}

function ConfigureS3StorageModal({ onClose, onRefresh }: { onClose: () => void; onRefresh: () => Promise<void> }) {
  const [form, setForm] = useState({ bucket: "", endpoint: "", name: "", path: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function submit() {
    setSaving(true)
    setError("")
    try {
      await hostingApi.createBackupStorage({ ...form, capacity_gb: 0, storage_type: "s3", username: "" })
      await onRefresh()
      onClose()
    } catch (err) {
      setError(readMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <ModalShell onClose={onClose} title="Configurar almacenamiento S3">
      <div className="grid gap-3 p-5 md:grid-cols-2">
        {error ? <div className="md:col-span-2"><Alert text={error} /></div> : null}
        <TextField label="Nombre" onChange={(value) => setForm({ ...form, name: value })} placeholder="Backups S3 principal" value={form.name} />
        <TextField label="Endpoint" onChange={(value) => setForm({ ...form, endpoint: value })} placeholder="https://s3.proveedor.com" value={form.endpoint} />
        <TextField label="Bucket" onChange={(value) => setForm({ ...form, bucket: value })} placeholder="ehpanel-backups" value={form.bucket} />
        <TextField label="Ruta" onChange={(value) => setForm({ ...form, path: value })} placeholder="reseller/clientes/" value={form.path} />
      </div>
      <ModalFooter onCancel={onClose} onSubmit={submit} saving={saving} submitLabel="Guardar almacenamiento" />
    </ModalShell>
  )
}

function ImportAccountUploadModal({ accounts, profile, onClose, onRefresh }: { accounts: HostingAccount[]; profile: HostingReseller | null; onClose: () => void; onRefresh: () => Promise<void> }) {
  const [form, setForm] = useState({ account_label: "", backup_url: "", destination_node: profile?.primary_node_hostname || accounts[0]?.node_hostname || "", panel_type: "cpanel" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function submit() {
    setSaving(true)
    setError("")
    try {
      await hostingApi.createImportRun({
        account_label: form.account_label,
        backup_url: form.backup_url,
        destination_node: form.destination_node,
        import_source: "remote_url",
        include_databases: true,
        include_files: true,
        include_mail: true,
        include_subdomains: true,
        migration_type: "full",
        panel_type: form.panel_type as "cpanel" | "plesk" | "directadmin" | "ehpanel" | "generic",
        preserve_mail_passwords: true,
        priority: "normal",
      })
      await onRefresh()
      onClose()
    } catch (err) {
      setError(readMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <ModalShell onClose={onClose} title="Importar cuenta via URL">
      <div className="space-y-4 p-5">
        {error ? <Alert text={error} /> : null}
        <TextField label="Etiqueta cuenta" onChange={(value) => setForm({ ...form, account_label: value })} placeholder="cliente-demo.com" value={form.account_label} />
        <TextField label="URL backup" onChange={(value) => setForm({ ...form, backup_url: value })} placeholder="https://origen/backup.tar.gz" value={form.backup_url} />
        <TextField label="Nodo destino" onChange={(value) => setForm({ ...form, destination_node: value })} placeholder="UUID del nodo destino" value={form.destination_node} />
      </div>
      <ModalFooter onCancel={onClose} onSubmit={submit} saving={saving} submitLabel="Importar y analizar" />
    </ModalShell>
  )
}

function GenerateExportModal({ accounts, onClose, onRefresh }: { accounts: HostingAccount[]; onClose: () => void; onRefresh: () => Promise<void> }) {
  const [account, setAccount] = useState(accounts[0]?.id || "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function submit() {
    setSaving(true)
    setError("")
    try {
      await hostingApi.createAccountExport({ account, export_type: "full", include_databases: true, include_files: true, include_mail: true, include_subdomains: true, notes: "Exportacion solicitada por revendedor" })
      await onRefresh()
      onClose()
    } catch (err) {
      setError(readMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <ModalShell onClose={onClose} title="Generar exportacion">
      <div className="space-y-4 p-5">
        {error ? <Alert text={error} /> : null}
        <SelectField label="Cuenta" onChange={setAccount} options={accounts.map((item) => [item.id, item.primary_domain])} value={account} />
      </div>
      <ModalFooter onCancel={onClose} onSubmit={submit} saving={saving} submitLabel="Generar exportacion" />
    </ModalShell>
  )
}

function ResourceAccountUsageModal({ account, onClose }: { account: HostingAccount; onClose: () => void }) {
  const disk = pct(usageNumber(account, "disk_used_mb"), account.disk_mb)
  const traffic = pct(usageNumber(account, "bandwidth_used_mb"), account.bandwidth_mb)
  return (
    <ModalShell onClose={onClose} title={`Consumo ${account.primary_domain}`}>
      <div className="grid gap-4 p-5 md:grid-cols-3">
        <UsageGauge label="Disco" value={disk} />
        <UsageGauge label="Trafico" value={traffic} />
        <UsageGauge label="CPU" value={Number((account.last_usage as JsonRecord | undefined)?.cpu_pct ?? 0)} />
      </div>
    </ModalShell>
  )
}

function AccountsTable({ accounts, onManage, title }: { accounts: HostingAccount[]; onManage?: (account: HostingAccount) => void; title: string }) {
  return (
    <div className="eh-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h3 className="font-bold">{title}</h3>
        <MoreHorizontal className="h-4 w-4 text-slate-400" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{["Cliente", "Dominio", "Plan", "Estado", "Disco", "Trafico", "Acciones"].map((column) => <th className="px-4 py-2 font-bold" key={column}>{column}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.length === 0 ? <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={7}>No hay cuentas registradas.</td></tr> : null}
            {accounts.map((account) => (
              <tr className="hover:bg-slate-50" key={account.id}>
                <td className="px-4 py-3 font-semibold">{account.customer_name || account.customer_email || account.username}</td>
                <td className="px-4 py-3">{account.primary_domain}</td>
                <td className="px-4 py-3">{account.plan_name || "-"}</td>
                <td className="px-4 py-3"><StatusBadge state={account.status} /></td>
                <td className="px-4 py-3"><MiniBar value={pct(usageNumber(account, "disk_used_mb"), account.disk_mb)} /></td>
                <td className="px-4 py-3"><MiniBar value={pct(usageNumber(account, "bandwidth_used_mb"), account.bandwidth_mb)} /></td>
                <td className="px-4 py-3 text-right"><Button disabled={!onManage} onClick={() => onManage?.(account)} size="sm" variant="outline">Gestionar</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CrudPage({ action, columns, hideHeader, hideRowActions, icon, onAction, onRowAction, onSecondaryAction, rows, secondaryAction, subtitle, title }: {
  action?: string
  columns: string[]
  hideHeader?: boolean
  hideRowActions?: boolean
  icon: LucideIcon
  onAction?: () => void
  onRowAction?: (row: string[]) => void
  onSecondaryAction?: () => void
  rows: string[][]
  secondaryAction?: string
  subtitle: string
  title: string
}) {
  const visibleColumns = columns
  return (
    <div className="space-y-4">
      {!hideHeader ? <PageHeader action={action} icon={icon} onAction={onAction} onSecondaryAction={onSecondaryAction} secondaryAction={secondaryAction} subtitle={subtitle} title={title} /> : null}
      <div className="eh-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="font-bold">{title}</h3>
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          </div>
          <div className="flex h-9 w-[320px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            Buscar o filtrar...
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {visibleColumns.map((column) => <th className="px-4 py-2 font-bold" key={column}>{column}</th>)}
                {!hideRowActions ? <th className="px-4 py-2 text-right font-bold">Acciones</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={visibleColumns.length + (hideRowActions ? 0 : 1)}>Sin registros.</td></tr> : null}
              {rows.map((row) => {
                const visible = row.slice(0, visibleColumns.length)
                return (
                  <tr className="hover:bg-slate-50" key={row.join("-")}>
                    {visible.map((cell, index) => <td className={cn("px-4 py-3", index === 0 && "font-semibold text-slate-800")} key={`${cell}-${index}`}>{cell}</td>)}
                    {!hideRowActions ? <td className="px-4 py-3 text-right"><Button onClick={() => onRowAction?.(row)} size="sm" variant="outline">Gestionar</Button></td> : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function DataTable({ columns, empty = "Sin registros.", rows }: { columns: string[]; empty?: string; rows: string[][] }) {
  return (
    <div className="eh-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{columns.map((column) => <th className="px-4 py-2 font-bold" key={column}>{column}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={columns.length}>{empty}</td></tr> : null}
            {rows.map((row) => <tr className="hover:bg-slate-50" key={row.join("-")}>{row.map((cell, index) => <td className="px-4 py-3" key={`${cell}-${index}`}>{cell}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PageHeader({ action, icon, onAction, onSecondaryAction, secondaryAction, subtitle, title }: { action?: string; icon: LucideIcon; onAction?: () => void; onSecondaryAction?: () => void; secondaryAction?: string; subtitle: string; title: string }) {
  const Icon = icon
  return (
    <section className="eh-card px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700"><Icon className="h-5 w-5" /></div>
          <div>
            <div className="eh-kicker">Revendedor</div>
            <h1 className="mt-1 text-xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {secondaryAction ? <Button onClick={onSecondaryAction} size="sm" variant="outline"><Settings2 className="h-4 w-4" />{secondaryAction}</Button> : null}
          {action ? <Button onClick={onAction} size="sm"><Plus className="h-4 w-4" />{action}</Button> : null}
        </div>
      </div>
    </section>
  )
}

function SidebarButton({ icon: Icon, label, active, onClick }: MenuItem & { active?: boolean; onClick?: () => void }) {
  return (
    <button className={cn("flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white", active && "bg-primary text-white shadow-[0_8px_18px_rgba(37,99,235,0.28)] hover:bg-primary")} onClick={onClick} type="button">
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-sidebar-muted")} />
      <span className="truncate">{label}</span>
    </button>
  )
}

function StatCard({ detail, icon, label, tone, value }: { detail: string; icon: LucideIcon; label: string; tone: string; value: string }) {
  const Icon = icon
  return (
    <div className="eh-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="eh-kicker">{label}</div>
        <Icon className={cn("h-5 w-5", tone)} />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{detail}</div>
    </div>
  )
}

function ActionCard({ icon, text, title }: { icon: LucideIcon; text: string; title: string }) {
  const Icon = icon
  return <div className="eh-card p-4"><div className="flex items-start gap-3"><div className="grid h-9 w-9 place-items-center rounded-md bg-slate-100 text-blue-700"><Icon className="h-4 w-4" /></div><div><h3 className="text-sm font-bold">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></div></div>
}

function CompactPanel({ children, title }: { children: React.ReactNode; title: string }) {
  return <div className="eh-card p-4"><h3 className="mb-3 font-bold">{title}</h3><div className="space-y-2">{children}</div></div>
}

function PlanLimit({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"><div className="text-[11px] font-bold uppercase text-slate-400">{label}</div><div className="mt-1 font-semibold">{value}</div></div>
}

function ProfileInfo({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2"><span className="text-xs font-bold uppercase text-slate-500">{label}</span><span className="text-sm font-semibold text-slate-800">{value}</span></div>
}

function ProfileGauge({ label, sub, value }: { label: string; sub: string; value: number }) {
  const tone = value >= 75 ? "#f97316" : "#2563eb"
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center"><div className="mx-auto grid h-28 w-28 place-items-center rounded-full" style={{ background: `conic-gradient(${tone} ${value * 3.6}deg, #e8eef7 0deg)` }}><div className="grid h-20 w-20 place-items-center rounded-full bg-white"><span className="text-xl font-bold">{value}%</span></div></div><p className="mt-3 text-sm font-bold">{label}</p><p className="mt-1 text-xs text-slate-500">{sub}</p></div>
}

function MiniBar({ value }: { value: number }) {
  return <div className="w-24"><div className="mb-1 text-xs font-semibold text-slate-500">{value}%</div><div className="h-1.5 rounded-full bg-slate-200"><div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${Math.min(value, 100)}%` }} /></div></div>
}

function Progress({ tone, value }: { tone: string; value: number }) {
  return <div className="mt-3"><div className="mb-1 flex justify-between text-xs text-slate-500"><span>Uso</span><span>{Math.round(value)}%</span></div><div className="h-2 rounded-full bg-slate-200"><div className={cn("h-2 rounded-full", tone)} style={{ width: `${Math.min(value, 100)}%` }} /></div></div>
}

function StatusBadge({ state }: { state: string }) {
  return <span className={cn("rounded-full px-2 py-1 text-xs font-bold", state === "active" && "bg-emerald-50 text-emerald-700", state === "pending" && "bg-amber-50 text-amber-700", state === "suspended" && "bg-red-50 text-red-700", !["active", "pending", "suspended"].includes(state) && "bg-slate-100 text-slate-600")}>{statusText(state)}</span>
}

function UsageGauge({ label, value }: { label: string; value: number }) {
  const normalized = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  const tone = normalized >= 75 ? "#f97316" : normalized >= 60 ? "#2563eb" : "#0891b2"
  return <div className="rounded-lg border border-slate-200 bg-white p-4 text-center"><div className="mx-auto grid h-24 w-24 place-items-center rounded-full" style={{ background: `conic-gradient(${tone} ${normalized * 3.6}deg, #eef2f7 0deg)` }}><div className="grid h-16 w-16 place-items-center rounded-full bg-white text-xl font-bold">{normalized}%</div></div><p className="mt-3 text-sm font-bold">{label}</p></div>
}

function SecurityCard({ action, icon: Icon, onClick, text, title }: { action: string; icon: LucideIcon; onClick?: () => void; text: string; title: string }) {
  const className = cn("eh-card p-4 text-left transition", onClick && "hover:border-blue-200 hover:bg-blue-50/40")
  const content = <><div className="flex items-start justify-between gap-3"><div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700"><Icon className="h-5 w-5" /></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{action}</span></div><h3 className="mt-4 font-bold">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{text}</p></>
  if (onClick) return <button className={className} onClick={onClick} type="button">{content}</button>
  return <div className={className}>{content}</div>
}

function ModalShell({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6"><div className="w-full max-w-[820px] overflow-hidden rounded-lg bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h3 className="text-lg font-bold">{title}</h3><button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button></div>{children}</div></div>
}

function ModalFooter({ onCancel, onSubmit, saving, submitLabel }: { onCancel: () => void; onSubmit: () => void; saving: boolean; submitLabel: string }) {
  return <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3"><Button onClick={onCancel} size="sm" variant="outline">Cancelar</Button><Button disabled={saving} onClick={onSubmit} size="sm">{saving ? "Guardando..." : submitLabel}</Button></div>
}

function TextField({ label, onChange, placeholder, type = "text", value }: { label: string; onChange: (value: string) => void; placeholder: string; type?: string; value: string }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span><input className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none placeholder:text-slate-400 focus:border-blue-500" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} /></label>
}

function TextArea({ label, onChange, placeholder, value }: { label: string; onChange: (value: string) => void; placeholder: string; value: string }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span><textarea className="h-36 w-full resize-none rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 outline-none placeholder:text-slate-400 focus:border-blue-500" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} /></label>
}

function SelectField({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: readonly (readonly [string, string])[]; value: string }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-500" onChange={(event) => onChange(event.target.value)} value={value}>{options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}</select></label>
}

function Alert({ text }: { text: string }) {
  return <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{text}</div>
}

function page<T>() {
  return { count: 0, next: null, previous: null, results: [] as T[] }
}

function readMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "No se pudo completar la solicitud."
}

function sum<T>(items: T[], read: (item: T) => number) {
  return items.reduce((total, item) => total + read(item), 0)
}

function usageNumber(account: HostingAccount, key: string) {
  const usage = (account.last_usage || {}) as JsonRecord
  const storage = usage.storage as JsonRecord | undefined
  return Number(usage[key] ?? storage?.[key] ?? 0)
}

function pct(value?: number, total?: number) {
  if (!value || !total || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)))
}

function formatMb(value?: number | null) {
  const amount = Number(value || 0)
  if (amount >= 1024) return `${formatNumber(amount / 1024)} GB`
  return `${formatNumber(amount)} MB`
}

function formatBytes(value?: number | null) {
  return formatMb(Number(value || 0) / 1024 / 1024)
}

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat("es-BO", { maximumFractionDigits: 1 }).format(Number(value || 0))
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" })
}

function statusText(value: string) {
  return { active: "Activa", answered: "Respondido", closed: "Cerrado", customer_reply: "Respuesta cliente", failed: "Fallido", open: "Abierto", pending: "Pendiente", queued: "En cola", running: "En proceso", suspended: "Suspendida", success: "Correcto" }[value] || value
}

function teamRoleLabel(role: string) {
  return {
    admin_reseller: "Administrador reseller",
    commercial: "Comercial",
    support: "Soporte",
  }[role] || role
}

function priorityLabel(value: string) {
  return priorities.find(([key]) => key === value)?.[1] || value
}

function statusLabel(value: SupportTicket["status"]) {
  return statusText(value)
}

function authorLabel(value: string) {
  return { customer: "Cliente", reseller: "Revendedor", staff: "Soporte", system: "Sistema" }[value as "customer"] || value
}
