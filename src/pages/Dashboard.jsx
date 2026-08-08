import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Gauge, Calendar, Activity, Bike, Apple, Moon, Trophy, Dumbbell,
  LineChart, Users, FileText, Settings, MoreHorizontal, X, BarChart3
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const NAV_PRINCIPAL = [
  { to: '/', label: 'Hoy', Icon: Gauge, end: true },
  { to: '/calendario', label: 'Plan', Icon: Calendar },
  { to: '/analitica', label: 'Rendimiento', Icon: LineChart },
  { to: '/bicicletas', label: 'Equipamiento', Icon: Bike }
]

const NAV_PLAN = [
  { to: '/calendario', label: 'Calendario', Icon: Calendar },
  { to: '/entrenamientos', label: 'Entrenamientos', Icon: Activity }
]

const NAV_RENDIMIENTO = [
  { to: '/analitica', label: 'Análisis', Icon: BarChart3 },
  { to: '/recuperacion', label: 'Recuperación', Icon: Moon }
]

const NAV_MAS = [
  { to: '/nutricion', label: 'Nutrición', Icon: Apple },
  { to: '/gimnasio', label: 'Gimnasio', Icon: Dumbbell },
  { to: '/competencias', label: 'Competencias', Icon: Trophy },
  { to: '/equipo', label: 'Equipo', Icon: Users },
  { to: '/reportes', label: 'Reportes', Icon: FileText },
  { to: '/configuracion', label: 'Configuración', Icon: Settings }
]

export default function Layout() {
  const [pendientes, setPendientes] = useState(0)
  const [tema, setTema] = useState(() => localStorage.getItem('tema') || 'dark')
  const [masAbierto, setMasAbierto] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('light', tema === 'light')
    localStorage.setItem('tema', tema)
  }, [tema])

  function alternarTema() {
    setTema((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser()

      if (!userData?.user?.id) return

      const { data } = await supabase
        .from('vinculos')
        .select('id, iniciado_por')
        .eq('estado', 'pendiente')

      const paraMi = (data || []).filter(
        (v) => v.iniciado_por !== userData.user.id
      )

      setPendientes(paraMi.length)
    }

    cargar()
  }, [])

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* NAVEGACIÓN DESKTOP */}
      <aside className="hidden md:flex md:flex-col w-60 border-r border-asphalt-700 p-5 overflow-y-auto">

        {/* MARCA */}
        <div className="mb-8">
          <span className="font-display font-bold text-xl text-hiviz">
            HELU
          </span>
          <p className="text-[10px] text-ink-muted uppercase tracking-widest mt-1">
            Cycling intelligence
          </p>
        </div>

        {/* PRINCIPAL */}
        <NavSection title="Principal">
          {NAV_PRINCIPAL.map((item) => (
            <NavItem
              key={item.to}
              {...item}
            />
          ))}
        </NavSection>

        {/* PLAN */}
        <NavSection title="Plan">
          {NAV_PLAN
            .filter((item) => item.to !== '/calendario')
            .map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
        </NavSection>

        {/* RENDIMIENTO */}
        <NavSection title="Rendimiento">
          {NAV_RENDIMIENTO
            .filter((item) => item.to !== '/analitica')
            .map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
        </NavSection>

        {/* MÁS */}
        <NavSection title="Más">
          {NAV_MAS.map((item) => (
            <NavItem
              key={item.to}
              {...item}
              badge={item.to === '/equipo' ? pendientes : 0}
            />
          ))}
        </NavSection>

        <div className="mt-auto pt-6">

          <button
            onClick={alternarTema}
            className="w-full text-ink-muted text-sm px-3 py-2 text-left hover:text-ink flex items-center gap-2"
          >
            <span aria-hidden>
              {tema === 'dark' ? '◐' : '◑'}
            </span>

            {tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>

          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full text-ink-muted text-sm px-3 py-2 text-left hover:text-ink"
          >
            Cerrar sesión
          </button>

        </div>
      </aside>

      {/* HEADER MOBILE */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-asphalt-700">

        <div>
          <span className="font-display font-bold text-lg text-hiviz">
            HELU
          </span>

          <p className="text-[9px] text-ink-muted uppercase tracking-widest">
            Cycling intelligence
          </p>
        </div>

        <div className="flex items-center gap-3">

          <button
            onClick={alternarTema}
            className="text-ink-muted text-xs"
            aria-label="Cambiar tema"
          >
            {tema === 'dark' ? '◐' : '◑'}
          </button>

          <button
            onClick={() => supabase.auth.signOut()}
            className="text-ink-muted text-xs"
          >
            Salir
          </button>

        </div>
      </header>

      {/* CONTENIDO */}
      <main
        className="flex-1 p-4 md:p-8 pb-24 md:pb-8"
        style={{
          paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))'
        }}
      >
        <Outlet />
      </main>

      {/* MENÚ MÁS - MOBILE */}
      {masAbierto && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMasAbierto(false)}
        >

          <div
            className="absolute bottom-0 left-0 right-0 bg-asphalt-900 border-t border-asphalt-700 rounded-t-2xl p-4"
            style={{
              paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))'
            }}
            onClick={(e) => e.stopPropagation()}
          >

            <div className="flex items-center justify-between mb-4">

              <div>
                <span className="font-display font-bold text-sm text-ink-muted uppercase tracking-wide">
                  Más
                </span>

                <p className="text-[11px] text-ink-muted mt-1">
                  Herramientas y configuración
                </p>
              </div>

              <button
                onClick={() => setMasAbierto(false)}
                className="text-ink-muted p-1"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>

            </div>

            <div className="grid grid-cols-3 gap-3">

              {NAV_MAS.map(({ to, label, Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMasAbierto(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1.5 py-3 rounded-lg text-[11px] font-medium relative ${
                      isActive
                        ? 'bg-asphalt-800 text-hiviz'
                        : 'text-ink-muted hover:bg-asphalt-800'
                    }`
                  }
                >

                  <span className="relative inline-flex">

                    <Icon
                      size={22}
                      strokeWidth={2}
                      aria-hidden
                    />

                    {to === '/equipo' && pendientes > 0 && (
                      <i className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-alert-red inline-block" />
                    )}

                  </span>

                  <span className="text-center leading-tight">
                    {label}
                  </span>

                </NavLink>
              ))}

            </div>

          </div>

        </div>
      )}

      {/* NAVEGACIÓN MOBILE */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 border-t border-asphalt-700 bg-asphalt-900 flex z-30"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >

        {NAV_PRINCIPAL.map((item) => (
          <NavItem
            key={item.to}
            {...item}
            mobile
            badge={0}
          />
        ))}

        <button
          onClick={() => setMasAbierto(true)}
          className="flex-1 flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] whitespace-nowrap text-ink-muted"
        >

          <span className="relative inline-flex">

            <MoreHorizontal
              size={20}
              strokeWidth={2}
              aria-hidden
            />

            {pendientes > 0 && (
              <i className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-alert-red inline-block" />
            )}

          </span>

          <span>Más</span>

        </button>

      </nav>

    </div>
  )
}

function NavSection({ title, children }) {
  return (
    <div className="mb-5">

      <div className="px-3 mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
        {title}
      </div>

      <div className="flex flex-col gap-0.5">
        {children}
      </div>

    </div>
  )
}

function NavItem({ to, label, Icon, end, mobile, badge }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        mobile
          ? `flex-1 flex flex-col items-center gap-0.5 px-2 py-2 text-[10px] whitespace-nowrap ${
              isActive ? 'text-hiviz' : 'text-ink-muted'
            }`
          : `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-asphalt-800 text-hiviz'
                : 'text-ink-muted hover:text-ink hover:bg-asphalt-800'
            }`
      }
    >

      <span className="relative inline-flex">

        <Icon
          size={mobile ? 20 : 18}
          strokeWidth={2}
          aria-hidden
        />

        {badge > 0 && (
          <i className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-alert-red inline-block" />
        )}

      </span>

      <span>{label}</span>

    </NavLink>
  )
}
