import { ArrowRight, CheckCircle2, Eye, LockKeyhole, Mail, Server, ShieldCheck } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

type LoginPageProps = {
  onLogin: (credentials: { username: string; password: string }) => Promise<void>
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [showRecovery, setShowRecovery] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitLogin = async () => {
    if (showRecovery) return

    setError("")
    setIsSubmitting(true)

    try {
      await onLogin({ password, username })
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : "No se pudo iniciar sesion."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#08111f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(37,99,235,0.34),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(8,145,178,0.26),transparent_26%),linear-gradient(135deg,#08111f_0%,#0f172a_48%,#111827_100%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />

      <section className="relative grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_430px]">
        <div className="hidden flex-col justify-between p-10 lg:flex">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600 text-sm font-black shadow-[0_0_24px_rgba(37,99,235,0.55)]">
              EH
            </div>
            <div>
              <div className="text-lg font-bold leading-5">EHPanel Web</div>
              <div className="text-xs font-medium text-cyan-200/80">by EHClouding</div>
            </div>
          </div>

          <div className="max-w-2xl">
            <div className="mb-4 inline-flex h-8 items-center gap-2 rounded-md border border-white/10 bg-white/8 px-3 text-xs font-semibold text-cyan-100 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />
              Plataforma de hosting activa
            </div>
            <h1 className="max-w-xl text-5xl font-bold leading-tight tracking-tight">
              Control profesional para sitios, correo, DNS y seguridad.
            </h1>
            <div className="mt-8 grid max-w-3xl grid-cols-3 gap-3">
              <SignalCard icon={Server} label="Nodos" value="12 online" />
              <SignalCard icon={ShieldCheck} label="SSL" value="Auto-renew" />
              <SignalCard icon={CheckCircle2} label="Servicios" value="Sin incidentes" />
            </div>
          </div>

          <div className="text-xs text-slate-400">Acceso exclusivo para clientes EHClouding.</div>
        </div>

        <div className="flex items-center justify-center border-l border-white/10 bg-white/[0.03] px-5 py-8 backdrop-blur-xl">
          <div className="w-full max-w-[380px] rounded-lg border border-white/12 bg-white/[0.08] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
            <div className="mb-6 lg:hidden">
              <div className="text-xl font-bold">EHPanel Web</div>
              <div className="text-xs text-cyan-200/80">by EHClouding</div>
            </div>

            <div className="mb-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">Acceso cliente</div>
              <h2 className="mt-2 text-2xl font-bold">{showRecovery ? "Recuperar contraseña" : "Iniciar sesión"}</h2>
              <p className="mt-1 text-sm text-slate-300">
                {showRecovery
                  ? "Ingresa tu correo y enviaremos las instrucciones de recuperación."
                  : "Administra tus servicios de hosting desde un panel limpio y seguro."}
              </p>
            </div>

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                void submitLogin()
              }}
            >
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-200">Correo</span>
                <div className="flex h-10 items-center gap-2 rounded-md border border-white/12 bg-slate-950/55 px-3 text-slate-200">
                  <Mail className="h-4 w-4 text-cyan-200" />
                  <input
                    className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="usuario o correo"
                    type="text"
                    value={username}
                  />
                </div>
              </label>

              {!showRecovery && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-200">Contraseña</span>
                  <div className="flex h-10 items-center gap-2 rounded-md border border-white/12 bg-slate-950/55 px-3 text-slate-200">
                    <LockKeyhole className="h-4 w-4 text-cyan-200" />
                  <input
                    className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Tu contrasena"
                    type="password"
                    value={password}
                  />
                  <Eye className="h-4 w-4 text-slate-500" />
                </div>
              </label>
              )}

              {error ? (
                <div className="rounded-md border border-red-300/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100">
                  {error}
                </div>
              ) : null}

              <Button className="h-10 w-full bg-blue-600 hover:bg-blue-500" disabled={isSubmitting || showRecovery} type="submit">
                {showRecovery ? "Enviar instrucciones" : isSubmitting ? "Entrando..." : "Entrar al panel"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              {!showRecovery && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    className="h-10 w-full border-white/12 bg-white/10 text-white hover:bg-white/15"
                    disabled={isSubmitting}
                    onClick={() => void submitLogin()}
                    type="button"
                    variant="outline"
                  >
                    Revendedor
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    className="h-10 w-full border-white/12 bg-white/10 text-white hover:bg-white/15"
                    disabled={isSubmitting}
                    onClick={() => void submitLogin()}
                    type="button"
                    variant="outline"
                  >
                    Admin
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </form>

            <button
              className="mt-4 text-sm font-semibold text-cyan-200 transition hover:text-white"
              onClick={() => setShowRecovery((current) => !current)}
              type="button"
            >
              {showRecovery ? "Volver a iniciar sesión" : "¿Olvidaste tu contraseña?"}
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

function SignalCard({ icon: Icon, label, value }: { icon: typeof Server; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
      <Icon className="mb-3 h-5 w-5 text-cyan-200" />
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-bold text-white">{value}</div>
    </div>
  )
}
