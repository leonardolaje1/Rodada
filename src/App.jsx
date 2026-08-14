import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './pages/Login'
import ActualizarPassword from './pages/ActualizarPassword'
import Dashboard from './pages/Dashboard'
import Bicicletas from './pages/Bicicletas'
import BicicletaDetalle from './pages/BicicletaDetalle'
import Entrenamientos from './pages/Entrenamientos'
import Nutricion from './pages/Nutricion'
import Recuperacion from './pages/Recuperacion'
import Competencias from './pages/Competencias'
import Gimnasio from './pages/Gimnasio'
import Calendario from './pages/Calendario'
import Analitica from './pages/Analitica'
import Reportes from './pages/Reportes'
import Equipo from './pages/Equipo'
import VerAtleta from './pages/VerAtleta'
import Configuracion from './pages/Configuracion'
import Onboarding from './pages/Onboarding'
import { useAuth } from './lib/useAuth'
import { ToastProvider } from './lib/ToastContext'
import { ConfirmProvider } from './lib/ConfirmContext'

export default function App() {
  const { session, cargando, modoRecuperacion, setModoRecuperacion } = useAuth()
  const [onboardingListo, setOnboardingListo] = useState(false)

  const usuario = session?.user ?? null
  const onboardingCompletado = Boolean(usuario?.user_metadata?.onboarding_completado)

  return (
    <ErrorBoundary>
      {cargando ? (
        <div className="min-h-screen flex items-center justify-center">
          <span className="text-ink-muted text-sm">Cargando…</span>
        </div>
      ) : modoRecuperacion ? (
        <ActualizarPassword onListo={() => setModoRecuperacion(false)} />
      ) : !session ? (
        <Login />
      ) : !onboardingCompletado && !onboardingListo ? (
        <Onboarding usuario={usuario} onFinish={() => setOnboardingListo(true)} />
      ) : (
        <ToastProvider>
          <ConfirmProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/calendario" element={<Calendario />} />
                <Route path="/entrenamientos" element={<Entrenamientos />} />
                <Route path="/bicicletas" element={<Bicicletas />} />
                <Route path="/bicicletas/:id" element={<BicicletaDetalle />} />
                <Route path="/nutricion" element={<Nutricion />} />
                <Route path="/recuperacion" element={<Recuperacion />} />
                <Route path="/competencias" element={<Competencias />} />
                <Route path="/gimnasio" element={<Gimnasio />} />
                <Route path="/analitica" element={<Analitica />} />
                <Route path="/reportes" element={<Reportes />} />
                <Route path="/equipo" element={<Equipo />} />
                <Route path="/equipo/:id" element={<VerAtleta />} />
                <Route path="/configuracion" element={<Configuracion />} />
              </Route>
            </Routes>
          </ConfirmProvider>
        </ToastProvider>
      )}
    </ErrorBoundary>
  )
}
