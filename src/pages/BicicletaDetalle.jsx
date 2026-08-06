import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { WEAR_TYPES, estadoDesgaste, nivelDesgasteInfo } from '../lib/wear'

const VIDA_UTIL_KM = {
  cadena: 3000,
  cassette: 9000,
  pastillas: 2000,
  cubiertas: 4000
}

export default function BicicletaDetalle() {
  const { id } = useParams()
  const [bici, setBici] = useState(null)
  const [componentes, setComponentes] = useState([])
  const [desgaste, setDesgaste] = useState([])

  async function cargar() {
    const { data: b } = await supabase.from('bicicletas').select('*').eq('id', id).single()
    const { data: c } = await supabase.from('componentes').select('*').eq('bicicleta_id', id)
    const { data: d } = await supabase.from('desgaste_componentes').select('*').eq('bicicleta_id', id)
    setBici(b)
    setComponentes(c || [])
    setDesgaste(d || [])
  }

  useEffect(() => {
    cargar()
  }, [id])

  async function configurarDesgaste(tipo, config) {
    await supabase.from('desgaste_componentes').insert({
      bicicleta_id: id,
      tipo,
      fecha_instalacion: config.fecha_instalacion,
      km_instalacion: config.km_instalacion,
      vida_util_km: config.vida_util_km,
      mediciones: []
    })
    cargar()
  }

  async function medirDesgaste(itemId, medicion) {
    const item = desgaste.find((d) => d.id === itemId)
    const nuevasMediciones = [...(item.mediciones || []), medicion]
    await supabase.from('desgaste_componentes').update({ mediciones: nuevasMediciones }).eq('id', itemId)
    cargar()
  }

  if (!bici) return <p className="text-ink-muted text-sm">Cargando…</p>

  const kmTotalesBici = bici.km_totales || 0

  return (
    <div className="flex flex-col gap-6">
      <Link to="/bicicletas" className="text-ink-muted text-sm">← Bicicletas</Link>

      <div>
        <h1 className="text-2xl font-bold">{bici.nombre}</h1>
        <p className="text-ink-muted text-sm mt-1">{bici.marca} {bici.modelo} · {bici.año}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Dato label="Rodado" value={bici.rodado || '—'} />
        <Dato label="Peso" value={bici.peso ? `${bici.peso} kg` : '—'} />
        <Dato label="Km totales" value={kmTotalesBici.toLocaleString('es-AR')} />
        <Dato label="Nro. cuadro" value={bici.nro_cuadro || '—'} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-1">Desgaste — tren motriz y cubiertas</h2>
        <p className="text-ink-muted text-xs mb-3">
          Combina kilómetros con mediciones manuales. Sirve de base para las sugerencias del asistente de IA cuando lo conectemos.
        </p>
        <div className="flex flex-col gap-3">
          {WEAR_TYPES.map((wt) => {
            const item = desgaste.find((d) => d.tipo === wt.id)
            return (
              <WearCard
                key={wt.id}
                wearType={wt}
                item={item}
                kmActualBici={kmTotalesBici}
                onConfigurar={(config) => configurarDesgaste(wt.id, config)}
                onMedir={(medicion) => medirDesgaste(item.id, medicion)}
              />
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Otros componentes</h2>
        {componentes.length === 0 ? (
          <p className="text-ink-muted text-sm">Sin otros componentes cargados (pastillas, cables, rulemanes, discos).</p>
        ) : (
          <div className="flex flex-col gap-2">
            {componentes.map((c) => {
              const kmDesdeInstalacion = kmTotalesBici - (c.km_instalacion || 0)
              const vidaUtil = c.vida_util_km || VIDA_UTIL_KM[c.tipo] || null
              const porcentaje = vidaUtil ? Math.min(100, (kmDesdeInstalacion / vidaUtil) * 100) : null
              const alerta = porcentaje !== null && porcentaje >= 80

              return (
                <div key={c.id} className="card flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium capitalize">{c.tipo}</p>
                    <p className="text-ink-muted text-xs">{c.marca} {c.modelo}</p>
                    {porcentaje !== null && (
                      <div className="w-full h-1.5 bg-asphalt-700 rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full ${alerta ? 'bg-alert-red' : 'bg-hiviz'}`}
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="readout text-sm font-semibold">{kmDesdeInstalacion.toLocaleString('es-AR')} km</p>
                    {vidaUtil && (
                      <p className={`text-xs ${alerta ? 'text-alert-red' : 'text-ink-muted'}`}>
                        de {vidaUtil.toLocaleString('es-AR')} km estimados
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function WearCard({ wearType, item, kmActualBici, onConfigurar, onMedir }) {
  const [configurando, setConfigurando] = useState(false)
  const [midiendo, setMidiendo] = useState(false)
  const [valorConfig, setValorConfig] = useState({
    fecha_instalacion: new Date().toISOString().slice(0, 10),
    km_instalacion: kmActualBici,
    vida_util_km: wearType.vidaUtilDefault
  })
  const [valorMedicion, setValorMedicion] = useState('')

  if (!item) {
    return (
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">{wearType.label}</p>
            <p className="text-ink-faint text-xs mt-0.5">Sin configurar</p>
          </div>
          <button
            className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-3 py-1.5"
            onClick={() => setConfigurando((v) => !v)}
          >
            Configurar
          </button>
        </div>
        {configurando && (
          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-asphalt-700">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-ink-muted">Fecha instalación</span>
              <input
                type="date"
                value={valorConfig.fecha_instalacion}
                onChange={(e) => setValorConfig((v) => ({ ...v, fecha_instalacion: e.target.value }))}
                className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-ink-muted">Km al instalar</span>
              <input
                type="number"
                value={valorConfig.km_instalacion}
                onChange={(e) => setValorConfig((v) => ({ ...v, km_instalacion: e.target.value }))}
                className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs col-span-2">
              <span className="text-ink-muted">Vida útil estimada (km)</span>
              <input
                type="number"
                value={valorConfig.vida_util_km}
                onChange={(e) => setValorConfig((v) => ({ ...v, vida_util_km: e.target.value }))}
                className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm"
              />
            </label>
            <div className="col-span-2 flex justify-end gap-2">
              <button className="text-ink-muted text-xs px-3 py-1.5" onClick={() => setConfigurando(false)}>Cancelar</button>
              <button
                className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg"
                onClick={() => { onConfigurar(valorConfig); setConfigurando(false) }}
              >
                Guardar
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const { kmDesde, vidaUtil, pctKm, pct, ultimaMedicion, nivel } = estadoDesgaste(item, wearType, kmActualBici)
  const { color, texto } = nivelDesgasteInfo(nivel)

  return (
    <div className="card" style={nivel !== 'ok' ? { borderColor: color } : undefined}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-sm">{wearType.label}</p>
          <p className="text-ink-muted text-xs mt-0.5">{kmDesde.toFixed(0)} km desde instalación · de {vidaUtil} km est.</p>
        </div>
        <span className="readout text-base font-bold" style={{ color }}>{pct}%</span>
      </div>

      <div className="w-full h-1.5 bg-asphalt-700 rounded-full mt-2.5 overflow-hidden relative">
        <div className="absolute inset-y-0 left-1/2 w-px bg-asphalt-600" />
        <div className="absolute inset-y-0 left-3/4 w-px bg-asphalt-600" />
        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
      </div>

      {nivel !== 'ok' && (
        <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold" style={{ color }}>
          <span>⚠</span><span>{texto}</span>
        </div>
      )}

      <div className="flex items-center justify-between mt-2.5">
        <p className="text-ink-muted text-xs">
          {ultimaMedicion
            ? `Última medición: ${ultimaMedicion.valor} ${wearType.unidad} (${ultimaMedicion.fecha})`
            : `Sin mediciones manuales — solo estimado por km (${pctKm}%)`}
        </p>
        <button
          className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2.5 py-1"
          onClick={() => setMidiendo((v) => !v)}
        >
          + Medición
        </button>
      </div>

      {midiendo && (
        <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-asphalt-700 items-end">
          <label className="flex-1 flex flex-col gap-1 text-xs">
            <span className="text-ink-muted">Valor ({wearType.unidad})</span>
            <input
              type="number"
              step="0.01"
              value={valorMedicion}
              onChange={(e) => setValorMedicion(e.target.value)}
              placeholder={wearType.ayuda}
              className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm"
            />
          </label>
          <button
            className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg"
            onClick={() => {
              if (valorMedicion === '') return
              onMedir({ fecha: new Date().toISOString().slice(0, 10), valor: Number(valorMedicion), km_bici: kmActualBici })
              setValorMedicion('')
              setMidiendo(false)
            }}
          >
            Guardar
          </button>
        </div>
      )}
    </div>
  )
}

function Dato({ label, value }) {
  return (
    <div className="card">
      <span className="label-eyebrow">{label}</span>
      <p className="readout text-lg font-semibold mt-1">{value}</p>
    </div>
  )
}
