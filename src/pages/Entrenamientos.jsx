import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { calcularTSS } from '../lib/tss'
import { parseActivityFile } from '../lib/parseActivity'

const TIPOS = ['Ruta', 'MTB', 'Gravel', 'Rodillo', 'Pista']

export default function Entrenamientos() {
  const [lista, setLista] = useState([])
  const [bicicletas, setBicicletas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [valoresImportados, setValoresImportados] = useState(null)
  const [errorImport, setErrorImport] = useState('')
  const inputArchivoRef = useRef(null)

  async function cargar() {
    setCargando(true)
    const [{ data: ents }, { data: bicis }] = await Promise.all([
      supabase.from('entrenamientos').select('*').order('fecha', { ascending: false }).limit(100),
      supabase.from('bicicletas').select('id, nombre')
    ])
    setLista(ents || [])
    setBicicletas(bicis || [])
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  async function crear(nuevo) {
    const tss = calcularTSS(nuevo)
    await supabase.from('entrenamientos').insert({ ...nuevo, tss })
    setMostrarForm(false)
    setValoresImportados(null)
    cargar()
  }

  async function manejarArchivo(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setErrorImport('')
    try {
      const datos = await parseActivityFile(file)
      setValoresImportados({ tipo: 'Ruta', ruta: file.name.replace(/\.(gpx|tcx|fit)$/i, ''), bicicleta_id: '', ...datos, fuente: 'garmin' })
      setMostrarForm(true)
    } catch (err) {
      setErrorImport(err.message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Entrenamientos</h1>
          <p className="text-ink-muted text-sm mt-1">Registro de actividad</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => inputArchivoRef.current?.click()}
            className="border border-asphalt-700 text-ink-muted font-semibold text-sm px-3 py-2 rounded-lg hover:text-ink"
          >
            Importar FIT/GPX/TCX
          </button>
          <input ref={inputArchivoRef} type="file" accept=".gpx,.tcx,.fit" className="hidden" onChange={manejarArchivo} />
          <button
            onClick={() => { setValoresImportados(null); setMostrarForm((v) => !v) }}
            className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg hover:brightness-95"
          >
            + Nuevo
          </button>
        </div>
      </div>

      {errorImport && (
        <div className="card border-alert-red text-sm text-alert-red">{errorImport}</div>
      )}

      {mostrarForm && (
        <FormEntrenamiento
          bicicletas={bicicletas}
          valoresIniciales={valoresImportados}
          onGuardar={crear}
          onCancelar={() => { setMostrarForm(false); setValoresImportados(null) }}
        />
      )}

      {cargando ? (
        <p className="text-ink-muted text-sm">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="text-ink-muted text-sm">Sin entrenamientos registrados.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map((e) => (
            <div key={e.id} className="card flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{e.tipo} — {e.ruta || 'sin ruta'}</p>
                <p className="text-ink-muted text-xs">{e.fecha}</p>
              </div>
              <div className="flex gap-4 text-right">
                <MiniDato label="km" value={e.km} />
                <MiniDato label="min" value={e.duracion_min} />
                <MiniDato label="TSS" value={e.tss} accent="hiviz" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MiniDato({ label, value, accent }) {
  return (
    <div>
      <p className={`readout text-sm font-semibold ${accent === 'hiviz' ? 'text-hiviz' : ''}`}>
        {value ?? '—'}
      </p>
      <p className="text-ink-muted text-[10px] uppercase">{label}</p>
    </div>
  )
}

function FormEntrenamiento({ bicicletas, onGuardar, onCancelar, valoresIniciales }) {
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    tipo: 'Ruta',
    ruta: '',
    bicicleta_id: '',
    duracion_min: '',
    km: '',
    desnivel: '',
    potencia_avg: '',
    fc_avg: '',
    rpe: '',
    comentarios: '',
    ...valoresIniciales
  })

  function campo(k) {
    return {
      value: form[k] ?? '',
      onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
    }
  }

  return (
    <form
      className="card grid grid-cols-1 sm:grid-cols-3 gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        onGuardar({
          ...form,
          bicicleta_id: form.bicicleta_id || null,
          duracion_min: form.duracion_min ? Number(form.duracion_min) : null,
          km: form.km ? Number(form.km) : null,
          desnivel: form.desnivel ? Number(form.desnivel) : null,
          potencia_avg: form.potencia_avg ? Number(form.potencia_avg) : null,
          fc_avg: form.fc_avg ? Number(form.fc_avg) : null,
          rpe: form.rpe ? Number(form.rpe) : null
        })
      }}
    >
      {valoresIniciales && (
        <p className="sm:col-span-3 text-hiviz text-xs -mb-1">
          Datos completados desde el archivo importado — revisá y ajustá lo que haga falta antes de guardar.
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted text-xs">Fecha</span>
        <input
          type="date"
          {...campo('fecha')}
          required
          className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink focus:border-hiviz outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted text-xs">Tipo</span>
        <select
          {...campo('tipo')}
          className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink focus:border-hiviz outline-none"
        >
          {TIPOS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted text-xs">Bicicleta</span>
        <select
          {...campo('bicicleta_id')}
          className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink focus:border-hiviz outline-none"
        >
          <option value="">—</option>
          {bicicletas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
        </select>
      </label>

      <Campo label="Ruta" {...campo('ruta')} />
      <Campo label="Duración (min)" type="number" {...campo('duracion_min')} />
      <Campo label="Km" type="number" step="0.1" {...campo('km')} />
      <Campo label="Desnivel (m)" type="number" {...campo('desnivel')} />
      <Campo label="Potencia media (W)" type="number" {...campo('potencia_avg')} />
      <Campo label="FC media" type="number" {...campo('fc_avg')} />
      <Campo label="RPE (1-10)" type="number" min="1" max="10" {...campo('rpe')} />

      <label className="flex flex-col gap-1 text-sm sm:col-span-3">
        <span className="text-ink-muted text-xs">Comentarios / sensaciones</span>
        <textarea
          {...campo('comentarios')}
          rows={2}
          className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink focus:border-hiviz outline-none"
        />
      </label>

      <div className="sm:col-span-3 flex gap-2 justify-end mt-2">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">
          Cancelar
        </button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">
          Guardar
        </button>
      </div>
    </form>
  )
}

function Campo({ label, ...props }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-muted text-xs">{label}</span>
      <input
        {...props}
        className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink focus:border-hiviz outline-none"
      />
    </label>
  )
}
