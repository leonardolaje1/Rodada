import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ConfirmContext = createContext({
  confirmar: () => Promise.resolve(false),
  alertar: () => Promise.resolve()
})

export function ConfirmProvider({ children }) {
  const [dialogo, setDialogo] = useState(null)
  const resolverRef = useRef(null)

  const confirmar = useCallback((mensaje, opciones = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setDialogo({ mensaje, tipo: 'confirm', ...opciones })
    })
  }, [])

  const alertar = useCallback((mensaje, opciones = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setDialogo({ mensaje, tipo: 'alert', ...opciones })
    })
  }, [])

  function cerrar(resultado) {
    setDialogo(null)
    if (resolverRef.current) {
      resolverRef.current(resultado)
      resolverRef.current = null
    }
  }

  return (
    <ConfirmContext.Provider value={{ confirmar, alertar }}>
      {children}
      {dialogo && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
          onClick={() => cerrar(false)}
        >
          <div className="card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            {dialogo.titulo && <span className="label-eyebrow">{dialogo.titulo}</span>}
            <p className={`text-sm ${dialogo.titulo ? 'mt-1.5 text-ink-muted' : 'font-medium'}`}>{dialogo.mensaje}</p>
            <div className="flex justify-end gap-2 mt-4">
              {dialogo.tipo === 'confirm' && (
                <button onClick={() => cerrar(false)} className="text-ink-muted text-sm px-4 py-2">
                  {dialogo.textoCancelar || 'Cancelar'}
                </button>
              )}
              <button
                onClick={() => cerrar(true)}
                className={`font-semibold text-sm px-4 py-2 rounded-lg ${
                  dialogo.destructivo ? 'bg-alert-red text-white' : 'bg-hiviz text-asphalt-950'
                }`}
              >
                {dialogo.textoConfirmar || (dialogo.tipo === 'alert' ? 'Entendido' : 'Confirmar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  return useContext(ConfirmContext)
}
