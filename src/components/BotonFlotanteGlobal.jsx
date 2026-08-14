import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// Botón "+" flotante, visible en (casi) toda la app, para cargar rápido
// un entrenamiento, una comida o un registro de recuperación sin importar
// en qué pantalla esté el usuario.
//
// Se oculta en /nutricion porque esa pantalla ya tiene su propio botón
// flotante con más opciones (agua, peso, medidas) — mostrar los dos juntos
// sería redundante.
const RUTAS_SIN_BOTON = ['/nutricion']

const OPCIONES = [
  { id: 'entrenamiento', icono: '🚴', label: 'Entrenamiento', destino: '/entrenamientos?nuevo=1' },
  { id: 'comida', icono: '🍽️', label: 'Comida', destino: '/nutricion?nuevo=1' },
  { id: 'recuperacion', icono: '🌙', label: 'Recuperación', destino: '/recuperacion' }
]

export default function BotonFlotanteGlobal() {
  const [abierto, setAbierto] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  if (RUTAS_SIN_BOTON.includes(location.pathname)) return null

  function elegir(opcion) {
    setAbierto(false)
    navigate(opcion.destino)
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="fixed right-5 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] w-14 h-14 rounded-full bg-hiviz text-asphalt-950 text-2xl font-semibold flex items-center justify-center shadow-lg z-40"
        aria-label="Registrar"
      >
        +
      </button>

      {abierto && (
        <div
          className="fixed inset-0 bg-black/55 z-50 flex items-end"
          onClick={(e) => { if (e.target === e.currentTarget) setAbierto(false) }}
        >
          <div className="w-full bg-asphalt-800 border-t border-asphalt-700 rounded-t-2xl px-4 pt-2.5 pb-8">
            <div className="w-9 h-1 bg-asphalt-600 rounded-full mx-auto mb-3.5" />
            <p className="font-display font-semibold text-base mb-1.5">Registrar</p>
            <div className="flex flex-col">
              {OPCIONES.map((o) => (
                <button
                  key={o.id}
                  onClick={() => elegir(o)}
                  className="flex items-center gap-3 py-3 border-b border-asphalt-700 last:border-none text-left"
                >
                  <span className="w-8 h-8 rounded-lg bg-asphalt-700 flex items-center justify-center text-sm">{o.icono}</span>
                  <span className="text-sm font-medium">{o.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
