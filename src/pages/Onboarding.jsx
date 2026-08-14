import { useState } from 'react'
import { User, Zap, HeartPulse, Bike, GitCompare, Flag, ChevronLeft, Info } from 'lucide-react'
import { useOnboarding } from '../lib/useOnboarding'

const POINTS = [
  { x: 0, y: 50 },
  { x: 100, y: 35 },
  { x: 200, y: 25 },
  { x: 300, y: 14 },
  { x: 400, y: 8 },
]
const PATH = `M${POINTS.map((p) => `${p.x},${p.y}`).join(' L')}`

// Wordmark real: la "E" de HELU son 3 barras horizontales naranjas (public/icons/icon-512.png)
function LogoMark({ size = 20 }) {
  const barW = size * 0.62
  const barH = Math.max(2, size * 0.11)
  const gap = size * 0.14
  return (
    <div className="flex items-center" style={{ gap: size * 0.12 }}>
      <span className="font-display font-semibold text-ink" style={{ fontSize: size, lineHeight: 1 }}>H</span>
      <div className="flex flex-col" style={{ gap, width: barW }}>
        <div className="bg-hiviz" style={{ height: barH, width: barW, borderRadius: barH }} />
        <div className="bg-hiviz" style={{ height: barH, width: barW, borderRadius: barH }} />
        <div className="bg-hiviz" style={{ height: barH, width: barW, borderRadius: barH }} />
      </div>
      <span className="font-display font-semibold text-ink" style={{ fontSize: size, lineHeight: 1 }}>LU</span>
    </div>
  )
}

// Narrativa: invitación/identidad -> punto de partida real -> capacidad -> diferencia -> acción.
// Sin nombrar competidoras (ver nota en el paso de diferenciación).
const STEPS = [
  {
    eyebrow: 'HELU',
    title: 'Para los que no entrenan por entrenar.',
    body: 'La comunidad y la plataforma de ciclistas endurance que entrenan con datos, no con excusas.',
    cta: 'Quiero sumarme',
    skip: true,
    hero: true,
  },
  {
    eyebrow: 'Tu punto de partida',
    title: 'Así arrancás vos, no el promedio.',
    body: 'Edad, nivel, objetivo y disponibilidad semanal. Cuanto más real tu perfil, más útil cada recomendación.',
    icon: User,
    cta: 'Siguiente',
    skip: true,
  },
  {
    eyebrow: 'Así entrenan los que van en serio',
    title: 'Carga, cuerpo y equipo, en una sola vista',
    icon: Zap,
    list: [
      { icon: Zap, text: 'Carga y fatiga acumulada, no solo distancia' },
      { icon: HeartPulse, text: 'Recuperación integrada al mismo análisis' },
      { icon: Bike, text: 'Mantenimiento de tu bici, sin hoja aparte' },
    ],
    cta: 'Siguiente',
    skip: true,
  },
  {
    eyebrow: 'No sos un feed de actividades',
    title: 'Elegiste entrenar con intención',
    body: 'No te mostramos un mapa de lo que hiciste ni un plan aislado. Unimos carga, recuperación y equipo para que cada decisión tenga sustento real.',
    note: 'Todavía no sincronizamos con dispositivos externos (Garmin, potenciómetros, etc.) — llega pronto. Por ahora, carga manual.',
    icon: GitCompare,
    cta: 'Siguiente',
    skip: true,
  },
  {
    eyebrow: 'Tu primer paso',
    title: 'La primera rodada es el comienzo de tu curva.',
    body: 'Sin datos no hay panel. Registrá tu primer entrenamiento y empezá a construir tu evidencia desde hoy.',
    icon: Flag,
    cta: 'Registrar mi primera rodada',
    skip: false,
  },
]

export default function Onboarding({ usuario, onFinish }) {
  const { pasoGuardado, guardarPaso, completar, guardando } = useOnboarding(usuario)
  const [step, setStep] = useState(() => Math.min(pasoGuardado, STEPS.length - 1))
  const [dir, setDir] = useState(1)
  const s = STEPS[step]
  const Icon = s.icon
  const frac = step / (STEPS.length - 1)

  function irA(nuevoPaso, direccion) {
    setDir(direccion)
    setStep(nuevoPaso)
    guardarPaso(nuevoPaso)
  }

  async function next() {
    if (step < STEPS.length - 1) {
      irA(step + 1, 1)
      return
    }
    // Último paso: termina el onboarding y entra a la app
    const { error } = await completar()
    if (!error) onFinish()
  }

  function back() {
    if (step > 0) irA(step - 1, -1)
  }

  function skip() {
    // Salta al final del onboarding, no lo cierra — la última pantalla sigue
    // siendo el paso de acción real (registrar primera rodada).
    irA(STEPS.length - 1, 1)
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-asphalt-950 p-4">
      <div className="relative w-full max-w-[420px] min-h-[720px] sm:rounded-[32px] sm:border sm:border-asphalt-700 overflow-hidden flex flex-col bg-asphalt-900">
        {/* Fondo atmosférico — único momento "hero", solo en la bienvenida */}
        {s.hero && (
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div
              className="absolute left-1/2 -translate-x-1/2 opacity-0 animate-[heroFade_900ms_ease-apple_forwards]"
              style={{
                top: '6%',
                width: 420,
                height: 420,
                background: 'radial-gradient(circle, rgb(var(--color-hiviz) / 0.24) 0%, rgb(var(--color-hiviz) / 0) 70%)',
                filter: 'blur(10px)',
              }}
            />
            <svg viewBox="0 0 400 200" className="absolute bottom-0 left-0 w-full" preserveAspectRatio="none">
              <path
                d="M0,160 L60,140 L120,150 L180,100 L240,120 L300,60 L340,80 L400,20 L400,220 L0,220 Z"
                className="fill-hiviz"
                opacity="0.07"
              />
              <path
                d="M0,160 L60,140 L120,150 L180,100 L240,120 L300,60 L340,80 L400,20"
                fill="none"
                className="stroke-hiviz"
                strokeWidth="1.5"
                opacity="0.3"
              />
            </svg>
          </div>
        )}

        {/* Progreso: perfil de subida, mismo trazo naranja del resto de la app */}
        <div className="relative z-10 px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-data text-[11px] tabular-nums text-ink-faint">
              {String(step + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
            </span>
            <div className="flex items-center gap-3">
              {s.skip && (
                <button
                  onClick={skip}
                  className="font-body text-[12px] text-ink-faint hover:text-ink-muted transition-colors duration-200 ease-apple"
                >
                  Saltar
                </button>
              )}
              <LogoMark size={13} />
            </div>
          </div>
          <svg viewBox="-4 0 408 56" className="w-full h-9" fill="none">
            <path d={PATH} className="stroke-asphalt-700" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path
              d={PATH}
              className="stroke-hiviz transition-[stroke-dashoffset] duration-500 ease-apple"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="720"
              strokeDashoffset={720 - 720 * frac}
            />
            <circle
              cx={POINTS[step].x}
              cy={POINTS[step].y}
              r="4.5"
              className="fill-hiviz transition-all duration-500 ease-apple"
            />
          </svg>
        </div>

        {/* Contenido */}
        <div
          key={step}
          className={`relative z-10 flex-1 flex flex-col px-6 ${s.hero ? 'justify-center pb-16' : 'pt-2'} animate-[stepIn_420ms_ease-apple_both]`}
          style={{ '--dir': dir === 1 ? '14px' : '-14px' }}
        >
          {s.hero ? (
            <div className="mb-8">
              <LogoMark size={30} />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-asphalt-800 border border-hiviz/20">
              <Icon size={24} className="text-hiviz" strokeWidth={1.75} />
            </div>
          )}

          {!s.hero && (
            <span className="label-eyebrow text-hiviz mb-3">{s.eyebrow}</span>
          )}

          <h1 className={`font-display font-semibold text-ink mb-4 ${s.hero ? 'text-[38px] sm:text-[42px] leading-[1.04]' : 'text-[30px] sm:text-[32px] leading-[1.05]'}`}>
            {s.title}
          </h1>

          {s.body && (
            <p className={`font-body leading-relaxed text-ink-muted ${s.hero ? 'text-[16px]' : 'text-[15px]'}`}>
              {s.body}
            </p>
          )}

          {s.list && (
            <div className="flex flex-col gap-2.5 mt-1">
              {s.list.map((item, i) => {
                const ItemIcon = item.icon
                return (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3 bg-asphalt-800 border border-hiviz/15">
                    <ItemIcon size={17} className="text-hiviz" strokeWidth={1.75} />
                    <span className="font-body text-[13.5px] text-ink">{item.text}</span>
                  </div>
                )
              })}
            </div>
          )}

          {s.note && (
            <div className="mt-4 rounded-xl px-4 py-3 flex items-start gap-2.5 bg-asphalt-800 border border-hiviz/20">
              <Info size={15} className="text-hiviz mt-[1px] shrink-0" strokeWidth={2} />
              <span className="font-body text-[12.5px] leading-relaxed text-ink-muted">{s.note}</span>
            </div>
          )}
        </div>

        {/* Footer / CTA */}
        <div className="relative z-10 px-6 pb-8 pt-4 flex items-center gap-3">
          {step > 0 && (
            <button
              onClick={back}
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-asphalt-800 border border-asphalt-700 transition-transform duration-150 ease-apple active:scale-[0.97]"
            >
              <ChevronLeft size={20} className="text-ink" />
            </button>
          )}
          <button
            onClick={next}
            disabled={guardando}
            className="flex-1 h-12 rounded-full font-body font-semibold text-[14.5px] bg-hiviz text-asphalt-950 transition-transform duration-150 ease-apple active:scale-[0.97] disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : s.cta}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes stepIn { from { opacity: 0; transform: translateX(var(--dir)); } to { opacity: 1; transform: translateX(0); } }
        @keyframes heroFade { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}
