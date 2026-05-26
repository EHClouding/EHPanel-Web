import {
  Bell,
  Archive,
  ChevronDown,
  CircleHelp,
  Database,
  FileCode2,
  Files,
  Network,
  Gauge,
  Globe2,
  HardDrive,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Mail,
  Megaphone,
  Activity,
  MoreHorizontal,
  Package,
  Search,
  ServerCog,
  Settings2,
  ShieldCheck,
  Ticket,
  UserRound,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { hostingApi, type GlobalAnnouncement } from "@/api/hosting"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AdvancedPage } from "@/pages/AdvancedPage"
import { ApplicationsPage } from "@/pages/ApplicationsPage"
import { BackupPage } from "@/pages/BackupPage"
import { ClientTicketsPage } from "@/pages/ClientTicketsPage"
import { DatabasesPage } from "@/pages/DatabasesPage"
import { DnsPage } from "@/pages/DnsPage"
import { DomainsPage } from "@/pages/DomainsPage"
import { FilesPage } from "@/pages/FilesPage"
import { FtpPage } from "@/pages/FtpPage"
import { HomePage } from "@/pages/HomePage"
import { MailPage } from "@/pages/MailPage"
import { MetricsPage } from "@/pages/MetricsPage"
import { MonitoringPage } from "@/pages/MonitoringPage"
import { ProfilePage } from "@/pages/ProfilePage"
import { SecurityPage } from "@/pages/SecurityPage"
import { SeoMarketingPage } from "@/pages/SeoMarketingPage"
import { SitesPage } from "@/pages/SitesPage"
import { SoftwarePage } from "@/pages/SoftwarePage"

type ClientLayoutProps = {
  onLogout: () => void
}

type MenuItem = {
  label: string
  icon: LucideIcon
}

type ClientView =
  | "Inicio"
  | "Dominios"
  | "DNS"
  | "Correos"
  | "Bases de Datos"
  | "Archivos"
  | "FTP / SFTP"
  | "Backup"
  | "SSL / Seguridad"
  | "Aplicaciones"
  | "Software"
  | "Métricas"
  | "Monitoreo"
  | "SEO & Marketing"
  | "Avanzado"
  | "Perfil"
  | "Tickets"
  | "Sitios Web"

const hostingMenu: MenuItem[] = [
  { label: "Sitios Web", icon: Globe2 },
  { label: "Dominios", icon: ServerCog },
  { label: "DNS", icon: Settings2 },
  { label: "Correos", icon: Mail },
  { label: "Bases de Datos", icon: Database },
  { label: "Archivos", icon: Files },
  { label: "FTP / SFTP", icon: Network },
  { label: "Backup", icon: Archive },
  { label: "SSL / Seguridad", icon: ShieldCheck },
  { label: "Aplicaciones", icon: Package },
  { label: "Software", icon: FileCode2 },
  { label: "Métricas", icon: Gauge },
  { label: "Monitoreo", icon: Activity },
  { label: "SEO & Marketing", icon: Megaphone },
  { label: "Avanzado", icon: HardDrive },
]

const accountMenu: MenuItem[] = [
  { label: "Tickets", icon: Ticket },
  { label: "Soporte", icon: LifeBuoy },
  { label: "Perfil", icon: UserRound },
]

export function ClientLayout({ onLogout }: ClientLayoutProps) {
  const [activeView, setActiveView] = useState<ClientView>("Inicio")
  const [announcements, setAnnouncements] = useState<GlobalAnnouncement[]>([])
  const [primaryDomain, setPrimaryDomain] = useState("Cargando dominio...")
  const [showAnnouncements, setShowAnnouncements] = useState(false)
  const isAdminView = window.sessionStorage.getItem("eh_admin_view_account")

  useEffect(() => {
    let mounted = true

    hostingApi
      .accounts()
      .then((page) => {
        if (!mounted) return

        const account = page.results.find((item) => item.status === "active") ?? page.results[0]
        setPrimaryDomain(account?.primary_domain || "Sin dominio principal")
      })
      .catch(() => {
        if (mounted) setPrimaryDomain("Sin dominio principal")
      })

    hostingApi
      .announcements()
      .then((page) => {
        if (mounted) setAnnouncements(page.results)
      })
      .catch(() => {
        if (mounted) setAnnouncements([])
      })

    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-[228px] flex-col border-r border-slate-950/40 bg-sidebar text-white shadow-xl lg:flex">
        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="relative mt-1">
              <span className="absolute inline-flex h-3 w-3 animate-status-pulse rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full border border-emerald-200 bg-emerald-500 shadow-[0_0_14px_rgba(34,197,94,0.85)]" />
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-bold leading-5">EHPanel Web</div>
              <div className="text-[11px] font-medium text-sidebar-muted">by EHClouding</div>
              <div className="mt-2 truncate text-xs font-semibold text-emerald-300">{primaryDomain}</div>
            </div>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <SidebarButton
            active={activeView === "Inicio"}
            icon={LayoutDashboard}
            label="Inicio"
            onClick={() => setActiveView("Inicio")}
          />
          <MenuSection activeView={activeView} items={hostingMenu} label="Hosting" onSelect={setActiveView} />
          <MenuSection activeView={activeView} items={accountMenu} label="Cuenta" onSelect={setActiveView} />
        </nav>

        <div className="border-t border-white/10 p-3">
          {isAdminView ? (
            <button
              className="mb-2 flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-cyan-200 transition hover:bg-white/10 hover:text-white"
              onClick={() => {
                window.sessionStorage.removeItem("eh_admin_view_account")
                window.location.assign("/")
              }}
              type="button"
            >
              <ShieldCheck className="h-4 w-4 text-cyan-200" />
              Volver al admin
            </button>
          ) : null}
          <button
            className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            onClick={onLogout}
            type="button"
          >
            <LogOut className="h-4 w-4 text-sidebar-muted" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="lg:pl-[228px]">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Button size="sm" variant="outline">
              {primaryDomain}
              <ChevronDown className="h-4 w-4" />
            </Button>
            <div className="hidden h-8 w-[320px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 xl:flex">
              <Search className="h-4 w-4" />
              Buscar dominio, correo, base de datos...
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline">
              <CircleHelp className="h-4 w-4" />
              Soporte
            </Button>
            <div className="relative">
              <Button aria-label="Notificaciones" onClick={() => setShowAnnouncements((value) => !value)} size="icon" variant="ghost">
                <Bell className="h-4 w-4" />
                {announcements.length ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" /> : null}
              </Button>
              {showAnnouncements ? (
                <div className="absolute right-0 top-11 z-30 w-[360px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                  <div className="border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-900">Anuncios</div>
                  <div className="max-h-80 overflow-auto">
                    {announcements.length ? announcements.map((item) => (
                      <div className="border-b border-slate-100 px-4 py-3" key={item.id}>
                        <div className="text-sm font-bold text-slate-900">{item.title}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">{item.body || item.priority_label}</div>
                      </div>
                    )) : <div className="px-4 py-3 text-sm text-slate-500">Sin anuncios activos.</div>}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="ml-1 hidden items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 md:flex">
              <div className="grid h-6 w-6 place-items-center rounded bg-primary text-xs font-bold text-white">CL</div>
              <div className="text-xs">
                <div className="font-semibold leading-4">Cliente Demo</div>
                <div className="text-slate-500">Cuenta activa</div>
              </div>
            </div>
          </div>
        </header>

        <main className="px-5 py-5">
          {activeView === "Inicio" ? (
            <HomePage onNavigate={(view) => setActiveView(view as ClientView)} />
          ) : activeView === "Sitios Web" ? (
            <SitesPage />
          ) : activeView === "Dominios" ? (
            <DomainsPage />
          ) : activeView === "DNS" ? (
            <DnsPage />
          ) : activeView === "Correos" ? (
            <MailPage />
          ) : activeView === "Bases de Datos" ? (
            <DatabasesPage />
          ) : activeView === "Archivos" ? (
            <FilesPage />
          ) : activeView === "FTP / SFTP" ? (
            <FtpPage />
          ) : activeView === "Backup" ? (
            <BackupPage />
          ) : activeView === "SSL / Seguridad" ? (
            <SecurityPage />
          ) : activeView === "Aplicaciones" ? (
            <ApplicationsPage />
          ) : activeView === "Software" ? (
            <SoftwarePage />
          ) : activeView === "Métricas" ? (
            <MetricsPage />
          ) : activeView === "Monitoreo" ? (
            <MonitoringPage />
          ) : activeView === "SEO & Marketing" ? (
            <SeoMarketingPage />
          ) : activeView === "Avanzado" ? (
            <AdvancedPage />
          ) : activeView === "Tickets" ? (
            <ClientTicketsPage />
          ) : activeView === "Perfil" ? (
            <ProfilePage />
          ) : (
            <CleanCanvas activeView={activeView} />
          )}
        </main>
      </div>
    </div>
  )
}

function MenuSection({
  label,
  items,
  activeView,
  onSelect,
}: {
  label: string
  items: MenuItem[]
  activeView: string
  onSelect: (view: ClientView) => void
}) {
  return (
    <div className="mt-4">
      <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-muted">{label}</div>
      <div className="space-y-1">
        {items.map((item) => (
          <SidebarButton
            active={activeView === item.label}
            key={item.label}
            onClick={() => {
              if (item.label === "Soporte") {
                window.open("https://manuales.ehclouding.com/ehpanel-web", "_blank")
                return
              }

              onSelect(
                item.label === "Dominios" || item.label === "Sitios Web" || item.label === "DNS" || item.label === "Correos"
                  ? item.label
                  : item.label === "Bases de Datos" ||
                      item.label === "Archivos" ||
                      item.label === "FTP / SFTP" ||
                      item.label === "Backup" ||
                      item.label === "SSL / Seguridad" ||
                      item.label === "Aplicaciones" ||
                      item.label === "Software" ||
                      item.label === "Métricas" ||
                      item.label === "Monitoreo" ||
                      item.label === "SEO & Marketing" ||
                      item.label === "Avanzado" ||
                      item.label === "Tickets" ||
                      item.label === "Perfil"
                  ? item.label
                  : "Inicio",
              )
            }}
            {...item}
          />
        ))}
      </div>
    </div>
  )
}

function SidebarButton({ icon: Icon, label, active, onClick }: MenuItem & { active?: boolean; onClick?: () => void }) {
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

function CleanCanvas({ activeView }: { activeView: string }) {
  return (
    <section className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-5 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eh-kicker">Cliente</div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">{activeView}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Lienzo base listo para construir esta pantalla con datos mock y componentes compactos.
          </p>
        </div>
        <Button size="sm" variant="outline">
          <MoreHorizontal className="h-4 w-4" />
          Acciones
        </Button>
      </div>
    </section>
  )
}
