import {
  Activity,
  BriefcaseBusiness,
  Database,
  FileText,
  Globe2,
  HardDrive,
  LayoutDashboard,
  Mail,
  MonitorCog,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type Role = "admin" | "reseller" | "client"

export type NavItem = {
  label: string
  icon: LucideIcon
  active?: boolean
}

export type NavSection = {
  label: string
  items: NavItem[]
}

export const roleMeta: Record<Role, { label: string; initials: string; tone: string }> = {
  admin: { label: "Admin", initials: "AD", tone: "bg-indigo-600" },
  reseller: { label: "Revendedor", initials: "RV", tone: "bg-violet-600" },
  client: { label: "Cliente", initials: "CL", tone: "bg-sky-600" },
}

export const navByRole: Record<Role, NavSection[]> = {
  admin: [
    {
      label: "Inicio",
      items: [
        { label: "Dashboard", icon: LayoutDashboard, active: true },
        { label: "Actividad", icon: Activity },
      ],
    },
    {
      label: "Hosting",
      items: [
        { label: "Sitios", icon: Globe2 },
        { label: "Revendedores", icon: BriefcaseBusiness },
        { label: "Planes", icon: FileText },
        { label: "Usuarios", icon: Users },
      ],
    },
    {
      label: "Infraestructura",
      items: [
        { label: "Nodos", icon: Server },
        { label: "Servicios", icon: MonitorCog },
        { label: "Seguridad", icon: ShieldCheck },
      ],
    },
  ],
  reseller: [
    {
      label: "Inicio",
      items: [{ label: "Dashboard", icon: LayoutDashboard, active: true }],
    },
    {
      label: "Gestion",
      items: [
        { label: "Sitios", icon: Globe2 },
        { label: "Planes propios", icon: FileText },
        { label: "Correos", icon: Mail },
        { label: "DNS", icon: Server },
      ],
    },
    {
      label: "Operacion",
      items: [
        { label: "Monitoreo", icon: Activity },
        { label: "Logs", icon: FileText },
      ],
    },
  ],
  client: [
    {
      label: "Cliente",
      items: [
        { label: "Dashboard", icon: LayoutDashboard, active: true },
        { label: "Dominios", icon: Globe2 },
        { label: "Correos", icon: Mail },
        { label: "Bases de datos", icon: Database },
        { label: "Archivos", icon: HardDrive },
      ],
    },
  ],
}

export const sites = [
  {
    domain: "theflakito.com",
    owner: "Luis Ernesto",
    plan: "Business Pro",
    node: "web-01.ehclouding.com",
    status: "Online",
    disk: 36,
    traffic: 18,
    ssl: "Activo",
  },
  {
    domain: "clientes.theflakito.com",
    owner: "Staging Client",
    plan: "Starter",
    node: "web-01.ehclouding.com",
    status: "Provisionando",
    disk: 12,
    traffic: 4,
    ssl: "Pendiente",
  },
  {
    domain: "webmail.ehclouding.com",
    owner: "EHClouding",
    plan: "Internal",
    node: "server0.ehclouding.com",
    status: "Online",
    disk: 22,
    traffic: 9,
    ssl: "Activo",
  },
]

export const services = [
  { name: "Nginx", state: "Activo", load: "12 ms" },
  { name: "OpenLiteSpeed", state: "Activo", load: "18 ms" },
  { name: "MariaDB", state: "Activo", load: "31 ms" },
  { name: "Postfix", state: "Activo", load: "24 ms" },
  { name: "Dovecot", state: "Activo", load: "19 ms" },
  { name: "PowerDNS", state: "Activo", load: "16 ms" },
]

export const timeline = [
  { step: "WordPress instalado", detail: "theflakito.com" },
  { step: "SSL renovado", detail: "webmail.ehclouding.com" },
  { step: "Cuenta SFTP actualizada", detail: "u_theflakito" },
  { step: "DNS sincronizado", detail: "clientes.theflakito.com" },
]
