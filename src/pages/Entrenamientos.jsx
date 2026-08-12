import { useState } from 'react'
import { buscarAlimentosPorTexto, buscarAlimentoPorCodigoBarras } from '../lib/openFoodFacts'
import EscanerCodigoBarras from './EscanerCodigoBarras'

export default function BuscadorProductoUnidad({ onAgregar, onCancelar }) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState('')
  const [escaneando, setEscaneando] = useState(false)
  const [productoElegido, setProductoElegido] = useState(null)
  const [pesoUnidad, setPesoUnidad] = useState('40')

  async function buscar() {
    setError(''); setBuscando(true); setResultados([])
    try {
      const r = await buscarAlimentosPorTexto(texto)
      if (r.length === 0) setError('Sin resultados. Probá con otro nombre o cargalo a mano.')
      setResultados(r)
    } catch {
      setError('No se pudo buscar. Revisá tu conexión.')
    } finally {
      setBuscando(false)
    }
  }

  async function manejarCodigoDetectado(codigo) {
    setEscaneando(false)
    setError(''); setBuscando(true)
    try {
      const producto = await buscarAlimentoPorCodigoBarras(codigo)
      if (!producto) { setError('No encontramos ese producto en la base. Probá buscarlo por nombre.'); return }
      setProductoElegido(producto)
    } catch {
      setError('No se pudo consultar el producto.')
    } finally {
      setBuscando(false)
    }
  }

  function elegirManual() {
    setProductoElegido({ nombre: texto || 'Producto', marca: '', kcal100g: null, carbohidratos100g: null })
  }

  function confirmar() {
    const g = Number(pesoUnidad) || 0
    const carbohidratosUnidadG = productoElegido.carbohidratos100g != null
      ? Math.round(productoElegido.carbohidratos100g * (g / 100) * 10) / 10
      : ''
    onAgregar({
      nombre: `${productoElegido.nombre}${productoElegido.marca ? ` (${productoElegido.marca})` : ''}`,
      pesoUnidadG: g,
      carbohidratosUnidadG,
      cantidad: 1
    })
  }

  if (escaneando) {
    return (
      <EscanerCodigoBarras
        onDetectado={manejarCodigoDetectado}
        onError={(msg) => { setEscaneando(false); setError(msg) }}
        onCerrar={() => setEscaneando(false)}
      />
    )
  }

  if (productoElegido) {
    return (
      <div className="border border-asphalt-700 rounded-lg p-3 flex flex-col gap-2.5 bg-asphalt-900">
        <div>
          <p className="text-sm font-semibold">{productoElegido.nombre}</p>
          {productoElegido.marca && <p className="text-ink-muted text-xs">{productoElegido.marca}</p>}
          {productoElegido.carbohidratos100g != null && (
            <p className="text-ink-faint text-xs mt-1">Carbohidratos: {productoElegido.carbohidratos100g}g / 100g</p>
          )}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted text-xs">Peso de una unidad (g) — ej: un gel suele ser 40g</span>
          <input type="number" value={pesoUnidad} onChange={(e) => setPesoUnidad(e.target.value)} className="bg-asphalt-950 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" />
        </label>
        {productoElegido.carbohidratos100g == null && (
          <p className="text-alert-amber text-xs">Esta base no tiene el dato de carbohidratos — podés cargarlo manual al agregar el producto en la lista.</p>
        )}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => setProductoElegido(null)} className="text-ink-muted text-xs px-3 py-1.5">Elegir otro</button>
          <button type="button" onClick={confirmar} className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg">Agregar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-asphalt-700 rounded-lg p-3 flex flex-col gap-2.5 bg-asphalt-900">
      <div className="flex gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscar() } }}
          placeholder="Ej: gel Maurten, barrita..."
          className="flex-1 bg-asphalt-950 border border-asphalt-700 rounded-lg px-3 py-2 text-ink text-sm"
        />
        <button type="button" onClick={buscar} disabled={buscando} className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-2 rounded-lg disabled:opacity-60">
          {buscando ? '...' : 'Buscar'}
        </button>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={() => setEscaneando(true)} className="text-hiviz text-xs font-semibold">📷 Escanear código</button>
        {texto && <button type="button" onClick={elegirManual} className="text-ink-muted text-xs">Cargar "{texto}" a mano</button>}
      </div>
      {error && <p className="text-alert-red text-xs">{error}</p>}
      {resultados.length > 0 && (
        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
          {resultados.map((r, i) => (
            <button key={i} type="button" onClick={() => setProductoElegido(r)} className="text-left border border-asphalt-700 rounded-lg px-2.5 py-2 hover:border-hiviz">
              <p className="text-xs font-medium">{r.nombre}{r.marca ? ` — ${r.marca}` : ''}</p>
              <p className="text-ink-faint text-[10px]">{r.carbohidratos100g != null ? `${r.carbohidratos100g}g carbos / 100g` : 'sin dato de carbohidratos'}</p>
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={onCancelar} className="text-ink-muted text-xs self-end">Cancelar</button>
    </div>
  )
}
