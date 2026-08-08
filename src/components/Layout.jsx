import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Gauge, Calendar, Activity, Bike, Apple, Moon, Trophy, Dumbbell,
  LineChart, Users, FileText, Settings
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const NAV = [
  { to: '/', label: 'Panel', Icon: Gauge, end: true },
  { to: '/calendario', label: 'Calendario', Icon: Calendar },
  { to: '/entrenamientos', label: 'Entrenamientos', Icon: Activity },
  { to: '/bicicletas', label: 'Bicis', Icon: Bike },
  { to: '/nutricion', label: 'Nutrición', Icon: Apple },
  { to: '/recuperacion', label: 'Recuperación', Icon: Moon },
  { to: '/competencias', label: 'Competencias', Icon: Trophy },
  { to: '/gimnasio', label: 'Gimnasio', Icon: Dumbbell },
  { to: '/analitica', label: 'Análisis', Icon: LineChart },
  { to: '/equipo', label: 'Equipo', Icon: Users },
  { to: '/reportes', label: 'Reportes', Icon: FileText },
  { to: '/configuracion', label: 'Configuración', Icon: Settings }
]

export default function Layout() {
  const [pendientes, setPendientes] = useState(0)
  const [tema, setTema] = useState(() => localStorage.getItem('tema') || 'dark')

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
      const { data } = await supabase
        .from('vinculos')
        .select('id, iniciado_por')
        .eq('estado', 'pendiente')
      const paraMi = (data || []).filter((v) => v.iniciado_por !== userData.user.id)
      setPendientes(paraMi.length)
    }
    cargar()
  }, [])

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="hidden md:flex md:flex-col w-56 border-r border-asphalt-700 p-5 gap-1 overflow-y-auto">
        <div className="mb-8">
          <span className="font-display font-bold text-xl text-hiviz">HELU</span>
        </div>
        {NAV.map((item) => (
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
        <span className="font-display font-bold text-lg text-hiviz">HELU</span>
        <div className="flex items-center gap-3">
          <button onClick={alternarTema} className="text-ink-muted text-xs" aria-label="Cambiar tema">
            {tema === 'dark' ? '◐' : '◑'}
          </button>
          <button onClick={() => supabase.auth.signOut()} className="text-ink-muted text-xs">
            Salir
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
        <Outlet />
      </main>

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 border-t border-asphalt-700 bg-asphalt-900 flex overflow-x-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {NAV.map((item) => (
          <NavItem key={item.to} {...item} mobile badge={item.to === '/equipo' ? pendientes : 0} />
        ))}
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
          ? `flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] whitespace-nowrap flex-shrink-0 ${
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
