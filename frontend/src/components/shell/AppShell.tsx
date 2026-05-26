import { Bell, ChevronDown, ExternalLink, Search } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { navByRole, roleMeta, type Role } from "@/data/mock"
import { cn } from "@/lib/utils"

type AppShellProps = {
  role: Role
  title: string
  subtitle: string
  children: ReactNode
}

export function AppShell({ role, title, subtitle, children }: AppShellProps) {
  const meta = roleMeta[role]
  const nav = navByRole[role]

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-sidebar text-white lg:flex">
        <div className="flex h-14 items-center gap-3 border-b border-white/10 px-4">
          <div className={cn("grid h-8 w-8 place-items-center rounded-lg text-xs font-bold", meta.tone)}>
            EH
          </div>
          <div>
            <div className="text-sm font-bold">EHPanel</div>
            <div className="text-[11px] text-emerald-300">Frontend Lab</div>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {nav.map((section) => (
            <div key={section.label}>
              <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
                {section.label}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <button
                    className={cn(
                      "flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm text-slate-300 transition hover:bg-white/10 hover:text-white",
                      item.active && "bg-sidebar-active text-white",
                    )}
                    key={item.label}
                    type="button"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg bg-white/5 p-2">
            <div className={cn("grid h-8 w-8 place-items-center rounded-full text-xs font-bold", meta.tone)}>
              {meta.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{meta.label}</div>
              <div className="text-[11px] text-sidebar-muted">Vista simulada</div>
            </div>
            <ChevronDown className="h-4 w-4 text-sidebar-muted" />
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-white px-4 lg:px-6">
          <div className="hidden h-8 w-72 items-center gap-2 rounded-md border bg-slate-50 px-3 text-sm text-muted-foreground md:flex">
            <Search className="h-4 w-4" />
            Buscar sitio, dominio, servicio...
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline">
              <ExternalLink className="h-4 w-4" />
              Abrir demo
            </Button>
            <Button size="icon" variant="ghost">
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="px-4 py-5 lg:px-6">
          <div className="mb-5">
            <div className="eh-kicker">{subtitle}</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
