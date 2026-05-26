import { Activity, ArrowRight, CheckCircle2, Cpu, Globe2, Mail, Server, ShieldCheck } from "lucide-react"
import { useState } from "react"

import { AppShell } from "@/components/shell/AppShell"
import { Button } from "@/components/ui/button"
import { services, sites, timeline, type Role } from "@/data/mock"
import { cn } from "@/lib/utils"

const roles: Role[] = ["client", "reseller", "admin"]

export function DashboardLab() {
  const [role, setRole] = useState<Role>("client")

  return (
    <AppShell
      role={role}
      subtitle="EHPanel visual system"
      title={
        role === "client"
          ? "Dashboard del sitio"
          : role === "reseller"
            ? "Dashboard del revendedor"
            : "Centro admin de hosting"
      }
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {roles.map((item) => (
          <Button
            key={item}
            onClick={() => setRole(item)}
            size="sm"
            variant={role === item ? "default" : "outline"}
          >
            {item === "client" ? "Cliente" : item === "reseller" ? "Revendedor" : "Admin"}
          </Button>
        ))}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Globe2} label="Sitios" value={role === "client" ? "1" : "24"} tone="text-violet-600" />
        <MetricCard icon={Mail} label="Correos" value="38" tone="text-sky-600" />
        <MetricCard icon={Server} label="Servicios online" value="12/12" tone="text-emerald-600" />
        <MetricCard icon={ShieldCheck} label="SSL activos" value="23" tone="text-orange-600" />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="eh-card overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <div className="font-semibold">Sitios principales</div>
              <div className="text-sm text-muted-foreground">Unidad central del panel: sitio, plan, nodo y estado.</div>
            </div>
            <Button size="sm">
              Nuevo sitio
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="divide-y">
            {sites.map((site) => (
              <div className="grid gap-3 px-4 py-3 md:grid-cols-[1.2fr_0.8fr_0.7fr_0.5fr]" key={site.domain}>
                <div>
                  <div className="font-semibold">{site.domain}</div>
                  <div className="text-sm text-muted-foreground">{site.owner}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">{site.plan}</div>
                  <div className="text-xs text-muted-foreground">{site.node}</div>
                </div>
                <div className="space-y-1">
                  <ProgressLine label="Disco" value={site.disk} />
                  <ProgressLine label="Trafico" value={site.traffic} />
                </div>
                <div className="flex items-center justify-end">
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-xs font-semibold",
                      site.status === "Online"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700",
                    )}
                  >
                    {site.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="eh-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">Monitoreo solo lectura</div>
              <div className="text-sm text-muted-foreground">Ideal para reseller: observa, no reinicia.</div>
            </div>
            <Activity className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="space-y-3">
            {services.map((service) => (
              <div className="flex items-center justify-between rounded-md border bg-slate-50 px-3 py-2" key={service.name}>
                <div>
                  <div className="text-sm font-semibold">{service.name}</div>
                  <div className="text-xs text-muted-foreground">{service.load}</div>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                  {service.state}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="eh-card p-4 lg:col-span-2">
          <div className="mb-4 font-semibold">Proceso y auditoria</div>
          <div className="space-y-3">
            {timeline.map((item) => (
              <div className="flex gap-3" key={`${item.step}-${item.detail}`}>
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                <div>
                  <div className="text-sm font-semibold">{item.step}</div>
                  <div className="text-sm text-muted-foreground">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="eh-card p-4">
          <div className="mb-4 flex items-center gap-2 font-semibold">
            <Cpu className="h-4 w-4 text-primary" />
            Proxima pantalla
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Primero diseñamos Cliente: Dashboard del sitio.</p>
            <p>Luego Admin: Sitios y aprovisionamiento.</p>
            <p>Finalmente Revendedor: ventas, monitoreo y soporte.</p>
          </div>
        </div>
      </section>
    </AppShell>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Globe2
  label: string
  value: string
  tone: string
}) {
  return (
    <div className="eh-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="eh-kicker">{label}</div>
        <Icon className={cn("h-5 w-5", tone)} />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">Datos mock para validar UI</div>
    </div>
  )
}

function ProgressLine({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-200">
        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
