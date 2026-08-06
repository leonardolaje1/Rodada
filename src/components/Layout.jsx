import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const NAV = [
  { to: '/', label: 'Panel', icon: '◆', end: true },
  { to: '/entrenamientos', label: 'Entrenos', icon: '⟢' },
  { to: '/bicicletas', label: 'Bicis', icon: '⊙' },
  { to: '/nutricion', label: 'Nutrición', icon: '◈' },
  { to: '/mantenimiento', label: 'Mantenimiento', icon: '⚙' },
  { to: '/objetivos', label: 'Objetivos', icon: '◎' },
  { to: '/recuperacion', label: 'Recuperación', icon: '☾' },
  { to: '/competencias', label: 'Competencias', icon: '▲' },
  { to: '/gimnasio', label: 'Gimnasio', icon: '⬢' },
  { to: '/bike-fitting', label: 'Bike Fitting', icon: '⟁' },
  { to: '/configuracion', label: 'Configuración', icon: '✦' }
]

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="hidden md:flex md:flex-col w-56 border-r border-asphalt-700 p-5 gap-1 overflow-y-auto">
        <div className="mb-8">
          <span className="font-display font-bold text-xl text-hiviz">rodada</span>
        </div>
        {NAV.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-6 text-ink-muted text-sm px-3 py-2 text-left hover:text-ink"
        >
          Cerrar sesión
        </button>
      </aside>

      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-asphalt-700">
        <span className="font-display font-bold text-lg text-hiviz">rodada</span>
        <button onClick={() => supabase.auth.signOut()} className="text-ink-muted text-xs">
          Salir
        </button>
      </header>

      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
        <Outlet />
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-asphalt-700 bg-asphalt-900 flex overflow-x-auto">
        {NAV.map((item) => (
          <NavItem key={item.to} {...item} mobile />
        ))}
      </nav>
    </div>
  )
}

function NavItem({ to, label, icon, end, mobile }) {
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
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </NavLink>
  )
}
