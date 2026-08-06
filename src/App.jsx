import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import ActualizarPassword from './pages/ActualizarPassword'
import Dashboard from './pages/Dashboard'
import Bicicletas from './pages/Bicicletas'
import BicicletaDetalle from './pages/BicicletaDetalle'
import Entrenamientos from './pages/Entrenamientos'
import Nutricion from './pages/Nutricion'
import Mantenimiento from './pages/Mantenimiento'
import Objetivos from './pages/Objetivos'
import Recuperacion from './pages/Recuperacion'
import Competencias from './pages/Competencias'
import Gimnasio from './pages/Gimnasio'
import BikeFitting from './pages/BikeFitting'
import Reportes from './pages/Reportes'
import Configuracion from './pages/Configuracion'
import { useAuth } from './lib/useAuth'

export default function App() {
  const { session, cargando, modoRecuperacion, setModoRecuperacion } = useAuth()

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-ink-muted text-sm">Cargando…</span>
      </div>
    )
  }

  if (modoRecuperacion) {
    return <ActualizarPassword onListo={() => setModoRecuperacion(false)} />
  }

  if (!session) {
    return <Login />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/entrenamientos" element={<Entrenamientos />} />
        <Route path="/bicicletas" element={<Bicicletas />} />
        <Route path="/bicicletas/:id" element={<BicicletaDetalle />} />
        <Route path="/nutricion" element={<Nutricion />} />
        <Route path="/mantenimiento" element={<Mantenimiento />} />
        <Route path="/objetivos" element={<Objetivos />} />
        <Route path="/recuperacion" element={<Recuperacion />} />
        <Route path="/competencias" element={<Competencias />} />
        <Route path="/gimnasio" element={<Gimnasio />} />
        <Route path="/bike-fitting" element={<BikeFitting />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/configuracion" element={<Configuracion />} />
      </Route>
    </Routes>
  )
}
