import { BarChart3, ExternalLink, Megaphone, SearchCheck } from "lucide-react"

export function SeoMarketingPage() {
  return (
    <div className="space-y-4">
      <section className="eh-card overflow-hidden">
        <div className="border-b border-slate-200 bg-white px-4 py-3">
          <h2 className="text-base font-bold text-slate-900">SEO & Marketing</h2>
          <p className="text-xs text-slate-500">Modulo reservado para integracion externa.</p>
        </div>
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
          <div className="flex min-h-[320px] flex-col justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8">
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <SearchCheck className="h-6 w-6" />
            </div>
            <div className="text-2xl font-bold text-slate-950">SEO & Marketing esta en desarrollo</div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Esta funcion se integrara mas adelante con la plataforma externa de SEO & Marketing. Por ahora no forma parte critica del panel y no se mostraran datos simulados.
            </p>
          </div>

          <aside className="space-y-3">
            <InfoItem icon={ExternalLink} label="Origen futuro" value="Plataforma externa" />
            <InfoItem icon={BarChart3} label="Datos" value="Se consultaran por API" />
            <InfoItem icon={Megaphone} label="Estado" value="En desarrollo" />
          </aside>
        </div>
      </section>
    </div>
  )
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof SearchCheck; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-slate-100 text-slate-700">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
          <div className="text-sm font-bold text-slate-900">{value}</div>
        </div>
      </div>
    </div>
  )
}
