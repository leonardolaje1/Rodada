import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const NAV = [
  { to: '/', label: 'Panel', icon: '◆', end: true },
  { to: '/calendario', label: 'Calendario', icon: '▦' },
  { to: '/entrenamientos', label: 'Entrenamientos', icon: '✧' },
  { to: '/bicicletas', label: 'Bicis', icon: '○' },
  { to: '/nutricion', label: 'Nutrición', icon: '◇' },
  { to: '/recuperacion', label: 'Recuperación', icon: '◐' },
  { to: '/competencias', label: 'Competencias', icon: '▲' },
  { to: '/gimnasio', label: 'Gimnasio', icon: '⬡' },
  { to: '/analitica', label: 'Análisis', icon: '∿' },
  { to: '/equipo', label: 'Equipo', icon: '∞' },
  { to: '/reportes', label: 'Reportes', icon: '☰' },
  { to: '/configuracion', label: 'Configuración', icon: '✦' },
]

export default function Layout() {
  const [pendientes, setPendientes] = useState(0)
  const [tema, setTema] = useState(() => localStorage.getItem('tema') || 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('light', tema === 'light')
    localStorage.setItem('tema', tema)
  }, [tema])

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user?.id) return
      const { data } = await supabase.from('vinculos').select('id, iniciado_por').eq('estado', 'pendiente')
      setPendientes((data || []).filter(v => v.iniciado_por !== userData.user.id).length)
    }
    cargar()
  }, [])

  return (
    <div className="min-h-screen flex bg-[#0A0A0C] text-white">
      <aside className="hidden md:flex w-[200px] flex-col bg-[#0D0D0F] border-r border-[#1A1A1E] p-4">
        <div className="px-3 pt-2 pb-8">
          <span className="font-bold text-[22px] tracking-tight text-[#C4F135] lowercase">bikeiq</span>
        </div>
        <nav className="flex-1 flex flex-col gap-[2px]">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-[9px] rounded-[8px] text-[14px] font-[450] transition-all ${
                  isActive ? 'bg-[#1A1A1E] text-[#C4F135]' : 'text-[#6B6B71] hover:text-[#A1A1AA] hover:bg-[#141417]'
                }`
              }
            >
              <span className="text-[13px] w-[16px] text-center leading-none">{item.icon}</span>
              <span>{item.label}</span>
              {item.to === '/equipo' && pendientes > 0 && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F14A4A]" />
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 pt-6 border-t border-[#1A1A1E]">
          <button
            onClick={() => setTema(t => (t === 'dark' ? 'light' : 'dark'))}
            className="flex items-center gap-3 px-3 py-2 text-[14px] text-[#6B6B71] hover:text-[#A1A1AA] text-left"
          >
            <span className="text-[13px] w-[16px] text-center">◑</span>
            {tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="px-3 py-2 text-[14px] text-[#6B6B71] hover:text-[#A1A1AA] text-left"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 bg-[#0A0A0C]">
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[#1A1A1E]">
          <span className="font-bold text-[20px] text-[#C4F135] lowercase">bikeiq</span>
          <button onClick={() => supabase.auth.signOut()} className="text-[#6B6B71] text-xs">Salir</button>
        </div>
        <div className="p-4 md:p-7 pb-24 md:pb-7">
          <Outlet />
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0D0D0F] border-t border-[#1A1A1E] flex z-30 pb-[env(safe-area-inset-bottom)]">
        {NAV.slice(0, 4).map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `flex-1 flex flex-col items-center py-2.5 text-[10px] ${isActive ? 'text-[#C4F135]' : 'text-[#6B6B71]'}`}>
            <span className="text-[16px]">{item.icon}</span>
            <span className="mt-1">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
