import { useRegisterSW } from 'virtual:pwa-register/react'

// Con registerType: 'autoUpdate' (vite.config.js), el service worker se
// actualiza solo en segundo plano — pero sin este hook la pestaña/PWA
// abierta se queda sirviendo el bundle viejo hasta que el usuario la cierre
// y reabra varias veces (a veces ni así, según cuándo el navegador chequea
// updates). Esto lo hace explícito: apenas hay una versión nueva precacheada,
// avisa y aplica el reload al tocar el botón.
export default function ActualizacionDisponible() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Chequea si hay una versión nueva cada vez que la app vuelve a primer
      // plano (además del chequeo automático que ya hace el navegador),
      // para no depender de que alguien cierre del todo la PWA.
      if (!registration) return
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update()
      })
    }
  })

  if (!needRefresh) return null

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[200] bg-asphalt-800 border border-hiviz rounded-full pl-4 pr-1.5 py-1.5 flex items-center gap-3 shadow-lg"
      style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
    >
      <span className="text-ink text-xs">Hay una versión nueva de HELU</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="bg-hiviz text-asphalt-950 text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0"
      >
        Actualizar
      </button>
    </div>
  )
}
