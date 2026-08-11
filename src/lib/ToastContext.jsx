import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'

const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [mensaje, setMensaje] = useState(null)
  const [visible, setVisible] = useState(false)
  const timeoutOcultarRef = useRef(null)
  const timeoutLimpiarRef = useRef(null)

  const toast = useCallback((texto) => {
    clearTimeout(timeoutOcultarRef.current)
    clearTimeout(timeoutLimpiarRef.current)
    setMensaje(texto)
    setVisible(false)
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))

    timeoutOcultarRef.current = setTimeout(() => setVisible(false), 1800)
    timeoutLimpiarRef.current = setTimeout(() => setMensaje(null), 2100)
  }, [])

  useEffect(() => () => {
    clearTimeout(timeoutOcultarRef.current)
    clearTimeout(timeoutLimpiarRef.current)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {mensaje && (
        <div
          className="fixed left-1/2 z-[100] pointer-events-none transition-all duration-300 ease-out"
          style={{
            bottom: 'calc(5.5rem + env(safe-area-inset-bottom))',
            transform: `translateX(-50%) translateY(${visible ? '0' : '8px'})`,
            opacity: visible ? 1 : 0
          }}
        >
          <div className="bg-asphalt-800 border border-asphalt-700 rounded-full px-4 py-2 flex items-center gap-2 shadow-lg">
            <Check size={14} className="text-hiviz flex-shrink-0" strokeWidth={3} />
            <span className="text-ink text-sm font-medium whitespace-nowrap">{mensaje}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
