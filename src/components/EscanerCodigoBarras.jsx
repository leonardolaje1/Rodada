import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

const ID_LECTOR = 'lector-codigo-barras'

export default function EscanerCodigoBarras({ onDetectado, onError, onCerrar }) {
  const instanciaRef = useRef(null)

  useEffect(() => {
    const lector = new Html5Qrcode(ID_LECTOR)
    instanciaRef.current = lector

    lector
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 120 } },
        (textoDecodificado) => {
          onDetectado(textoDecodificado)
        },
        () => { /* frame sin código, ignorar */ }
      )
      .catch(() => {
        onError('No se pudo acceder a la cámara. Revisá los permisos en tu navegador.')
      })

    return () => {
      if (instanciaRef.current) {
        instanciaRef.current.stop().then(() => instanciaRef.current.clear()).catch(() => {})
      }
    }
  }, [])

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="label-eyebrow">Apuntá al código de barras</span>
        <button onClick={onCerrar} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Cancelar</button>
      </div>
      <div id={ID_LECTOR} className="rounded-lg overflow-hidden bg-asphalt-950" />
    </div>
  )
}
