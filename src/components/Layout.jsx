import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Gauge, Calendar, Activity, Bike, Apple, Moon, Trophy, Dumbbell,
  LineChart, Users, FileText, Settings, MoreHorizontal, X, ChevronDown
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import Avatar from './Avatar'
import BotonFlotanteGlobal from './BotonFlotanteGlobal'

// Ítem suelto, siempre visible arriba del todo
const NAV_PANEL = { to: '/', label: 'Panel', Icon: Gauge, end: true }

// Grupos temáticos del sidebar de escritorio
const NAV_GRUPOS = [
  {
    id: 'entrenar',
    label: 'Entrenar',
    items: [
      { to: '/calendario', label: 'Calendario', Icon: Calendar },
      { to: '/entrenamientos', label: 'Entrenamientos', Icon: Activity },
      { to: '/gimnasio', label: 'Gimnasio', Icon: Dumbbell }
    ]
  },
  {
    id: 'cuerpo',
    label: 'Cuerpo',
    items: [
      { to: '/recuperacion', label: 'Recuperación', Icon: Moon },
      { to: '/nutricion', label: 'Nutrición', Icon: Apple }
    ]
  },
  {
    id: 'progreso',
    label: 'Progreso',
    items: [
      { to: '/analitica', label: 'Análisis', Icon: LineChart },
      { to: '/reportes', label: 'Reportes', Icon: FileText },
      { to: '/competencias', label: 'Competencias', Icon: Trophy }
    ]
  }
]

// Ítems de sistema, sueltos al final
const NAV_OTROS = [
  { to: '/bicicletas', label: 'Bicicletas', Icon: Bike },
  { to: '/equipo', label: 'Equipo', Icon: Users },
  { to: '/configuracion', label: 'Configuración', Icon: Settings }
]

// Lista plana — se sigue usando para el sheet "Más" en mobile y para el badge de pendientes
const NAV = [NAV_PANEL, ...NAV_GRUPOS.flatMap((g) => g.items), ...NAV_OTROS]

const RUTAS_DIRECTAS = ['/', '/entrenamientos', '/gimnasio', '/nutricion', '/calendario']

const GRUPOS_ABIERTOS_KEY = 'nav-grupos-abiertos'

export default function Layout() {
  const location = useLocation()
  const [pendientes, setPendientes] = useState(0)
  const [tema, setTema] = useState(() => localStorage.getItem('tema') || 'dark')
  const [masAbierto, setMasAbierto] = useState(false)

  const [gruposAbiertos, setGruposAbiertos] = useState(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem(GRUPOS_ABIERTOS_KEY))
      if (guardado && typeof guardado === 'object') return guardado
    } catch {
      // ignorar JSON inválido y usar default
    }
    return { entrenar: true, cuerpo: true, progreso: true }
  })

  useEffect(() => {
    localStorage.setItem(GRUPOS_ABIERTOS_KEY, JSON.stringify(gruposAbiertos))
  }, [gruposAbiertos])

  // Si la ruta activa está dentro de un grupo colapsado, lo abre automáticamente
  useEffect(() => {
    const grupo = NAV_GRUPOS.find((g) => g.items.some((item) => item.to === location.pathname))
    if (grupo && !gruposAbiertos[grupo.id]) {
      setGruposAbiertos((prev) => ({ ...prev, [grupo.id]: true }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  function alternarGrupo(id) {
    setGruposAbiertos((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  useEffect(() => {
    document.documentElement.classList.toggle('light', tema === 'light')
    localStorage.setItem('tema', tema)
  }, [tema])

  function alternarTema() {
    setTema((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  const [usuario, setUsuario] = useState(null)

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser()
      setUsuario(userData.user)
      const { data } = await supabase
        .from('vinculos')
        .select('id, iniciado_por')
        .eq('estado', 'pendiente')
      const paraMi = (data || []).filter((v) => v.iniciado_por !== userData.user.id)
      setPendientes(paraMi.length)
    }
    cargar()
  }, [])

  const navDirectos = NAV.filter((item) => RUTAS_DIRECTAS.includes(item.to))
  const navResto = NAV.filter((item) => !RUTAS_DIRECTAS.includes(item.to))
  const pendientesEnResto = navResto.some((item) => item.to === '/equipo') && pendientes > 0

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="hidden md:flex md:flex-col w-56 border-r border-asphalt-700 p-5 gap-1 overflow-y-auto">
        <div className="mb-8 flex items-center gap-2.5">
          <Avatar url={usuario?.user_metadata?.avatar_url} nombre={usuario?.user_metadata?.nombre || usuario?.email} size={30} />
          <span className="font-display font-bold text-xl text-hiviz">HELU</span>
        </div>

        <NavItem {...NAV_PANEL} />

        <div className="h-4" aria-hidden />

        {NAV_GRUPOS.map((grupo) => {
          const abierto = gruposAbiertos[grupo.id]
          return (
            <div key={grupo.id} className="mb-1">
              <button
                onClick={() => alternarGrupo(grupo.id)}
                aria-expanded={abierto}
                className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted hover:text-ink"
              >
                <span>{grupo.label}</span>
                <ChevronDown
                  size={13}
                  strokeWidth={2.5}
                  aria-hidden
                  className="transition-transform duration-200"
                  style={{ transform: abierto ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                />
              </button>
              {abierto && (
                <div className="flex flex-col gap-1 mt-0.5">
                  {grupo.items.map((item) => (
                    <NavItem key={item.to} {...item} badge={item.to === '/equipo' ? pendientes : 0} />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        <div className="h-4" aria-hidden />
        <div className="border-t border-asphalt-700 mx-2 mb-2" />

        {NAV_OTROS.map((item) => (
          <NavItem key={item.to} {...item} badge={item.to === '/equipo' ? pendientes : 0} />
        ))}

        <button
          onClick={alternarTema}
          className="mt-6 text-ink-muted text-sm px-3 py-2 text-left hover:text-ink flex items-center gap-2"
        >
          <span aria-hidden>{tema === 'dark' ? '◐' : '◑'}</span>
          {tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-ink-muted text-sm px-3 py-2 text-left hover:text-ink"
        >
          Cerrar sesión
        </button>
      </aside>

      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-asphalt-700">
        <div className="flex items-center gap-2">
          <Avatar url={usuario?.user_metadata?.avatar_url} nombre={usuario?.user_metadata?.nombre || usuario?.email} size={26} />
          <span className="font-display font-bold text-lg text-hiviz">HELU</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={alternarTema} className="text-ink-muted text-xs" aria-label="Cambiar tema">
            {tema === 'dark' ? '◐' : '◑'}
          </button>
          <button onClick={() => supabase.auth.signOut()} className="text-ink-muted text-xs">
            Salir
          </button>
        </div>
      </header>

      <main className="flex-1 min-w-0 p-4 md:p-8 pb-24 md:pb-8" style={{ paddingBottom: 'calc(8rem + env(safe-area-inset-bottom))' }}>
        <Outlet />
      </main>

      <BotonFlotanteGlobal />

      {masAbierto && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMasAbierto(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-asphalt-900 border-t border-asphalt-700 rounded-t-2xl p-4"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-display font-bold text-sm text-ink-muted uppercase tracking-wide">Más opciones</span>
              <button onClick={() => setMasAbierto(false)} className="text-ink-muted p-1" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {navResto.map(({ to, label, Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMasAbierto(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1.5 py-3 rounded-lg text-[11px] font-medium relative ${
                      isActive ? 'bg-asphalt-800 text-hiviz' : 'text-ink-muted hover:bg-asphalt-800'
                    }`
                  }
                >
                  <span className="relative inline-flex">
                    <Icon size={22} strokeWidth={2} aria-hidden />
                    {to === '/equipo' && pendientes > 0 && (
                      <i className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-alert-red inline-block" />
                    )}
                  </span>
                  <span className="text-center leading-tight">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 border-t border-asphalt-700 bg-asphalt-900 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {navDirectos.map((item) => (
          <NavItem key={item.to} {...item} mobile />
        ))}
        <button
          onClick={() => setMasAbierto(true)}
          className="flex-1 flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] whitespace-nowrap text-ink-muted"
        >
          <span className="relative inline-flex">
            <MoreHorizontal size={20} strokeWidth={2} aria-hidden />
            {pendientesEnResto && (
              <i className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-alert-red inline-block" />
            )}
          </span>
          <span>Más</span>
        </button>
      </nav>
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
          ? `flex-1 flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] whitespace-nowrap ${
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
        <Icon size={mobile ? 20 : 18} strokeWidth={2} aria-hidden />
        {badge > 0 && (
          <i className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-alert-red inline-block" />
        )}
      </span>
      <span>{label}</span>
    </NavLink>
  )
}
