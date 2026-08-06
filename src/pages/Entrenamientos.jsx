import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { calcularTSS } from '../lib/tss'
import { parseActivityFile } from '../lib/parseActivity'

const TIPOS = ['Ruta', 'MTB', 'Gravel', 'Rodillo', 'Pista', 'Descanso']
const DIAS_SEMANA = [
  { id: 'lun', label: 'Lun' },
  { id: 'mar', label: 'Mar' },
  { id: 'mie', label: 'Mié' },
  { id: 'jue', label: 'Jue' },
  { id: 'vie', label: 'Vie' },
  { id: 'sab', label: 'Sáb' },
  { id: 'dom', label: 'Dom' }
]
const DIA_POR_INDICE = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']

function diaIdDeHoy() {
  return DIA_POR_INDICE[new Date().getDay()]
}

function agruparPorFecha(items) {
  const grupos = {}
  for (const item of items) {
    if (!grupos[item.fecha]) grupos[item.fecha] = []
    grupos[item.fecha].push(item)
  }
  return Object.entries(grupos).sort((a, b) => b[0].localeCompare(a[0]))
}

export default function Entrenamientos() {
  const [vista, setVista] = useState('registro') // 'registro' | 'planes'
  const [lista, setLista] = useState([])
  const [bicicletas, setBicicletas] = useState([])
  const [planes, setPlanes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [valoresImportados, setValoresImportados] = useState(null)
  const [errorImport, setErrorImport] = useState('')
  const [formPlanOpen, setFormPlanOpen] = useState(false)
  const [planEditando, setPlanEditando] = useState(null)
  const inputArchivoRef = useRef(null)

  async function cargar() {
    setCargando(true)
    const [{ data: ents }, { data: bicis }, { data: pls }] = await Promise.all([
      supabase.from('entrenamientos').select('*').order('fecha', { ascending: false }).limit(200),
      supabase.from('bicicletas').select('id, nombre'),
      supabase.from('planes_entrenamiento').select('*').eq('activo', true).order('created_at', { ascending: true })
    ])
    setLista(ents || [])
    setBicicletas(bicis || [])
    setPlanes(pls || [])
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

  async function actualizar(id, datos) {
    const tss = calcularTSS(datos)
    await supabase.from('entrenamientos').update({ ...datos, tss }).eq('id', id)
    setEditandoId(null)
    cargar()
  }

  async function eliminar(id) {
    await supabase.from('entrenamientos').delete().eq('id', id)
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
      setEditandoId(null)
      setMostrarForm(true)
    } catch (err) {
      setErrorImport(err.message)
    }
  }

  async function crearPlan(form) {
    await supabase.from('planes_entrenamiento').insert(form)
    setFormPlanOpen(false)
    cargar()
  }

  async function actualizarPlan(id, form) {
    await supabase.from('planes_entrenamiento').update(form).eq('id', id)
    setPlanEditando(null)
    cargar()
  }

  async function borrarPlan(id) {
    await supabase.from('planes_entrenamiento').update({ activo: false }).eq('id', id)
    cargar()
  }

  function registrarSesionDeHoy(plan, sesion) {
    setValoresImportados({
      tipo: sesion.tipo,
      duracion_min: sesion.duracion_min,
      comentarios: sesion.descripcion || '',
      plan_id: plan.id
    })
    setEditandoId(null)
    setMostrarForm(true)
  }

  const nombreBici = (id) => bicicletas.find((b) => b.id === id)?.nombre || null
  const nombrePlan = (id) => planes.find((p) => p.id === id)?.nombre || null
  const porDia = agruparPorFecha(lista)
  const hoyId = diaIdDeHoy()

  const sesionesHoy = planes.flatMap((p) =>
    (p.sesiones || []).filter((s) => s.dia === hoyId).map((s) => ({ plan: p, sesion: s }))
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Entrenamientos</h1>
        <p className="text-ink-muted text-sm mt-1">Registro de actividad</p>
      </div>

      <div className="flex gap-1 bg-asphalt-950 p-1 rounded-lg">
        <button
          onClick={() => setVista('registro')}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold ${vista === 'registro' ? 'bg-hiviz text-asphalt-950' : 'text-ink-muted'}`}
        >
          Registro
        </button>
        <button
          onClick={() => setVista('planes')}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold ${vista === 'planes' ? 'bg-hiviz text-asphalt-950' : 'text-ink-muted'}`}
        >
          Mis planes
        </button>
      </div>

      {vista === 'registro' && (
        <>
          {sesionesHoy.length > 0 && (
            <div className="card">
              <span className="label-eyebrow">Plan de hoy</span>
              <div className="flex flex-col gap-2 mt-2.5">
                {sesionesHoy.map(({ plan, sesion }, i) => (
                  <button
                    key={i}
                    onClick={() => registrarSesionDeHoy(plan, sesion)}
                    className="flex items-center justify-between border border-asphalt-700 rounded-lg px-3 py-2 text-left hover:border-hiviz"
                  >
                    <div>
                      <p className="text-sm font-medium">{sesion.tipo}{sesion.duracion_min ? ` — ${sesion.duracion_min} min` : ''}</p>
                      <p className="text-ink-muted text-xs">{plan.nombre}{sesion.descripcion ? ` · ${sesion.descripcion}` : ''}</p>
                    </div>
                    <span className="text-hiviz text-xs font-semibold">+ Registrar</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => inputArchivoRef.current?.click()}
              className="border border-asphalt-700 text-ink-muted font-semibold text-sm px-3 py-2 rounded-lg hover:text-ink"
            >
              Importar FIT/GPX/TCX
            </button>
            <input ref={inputArchivoRef} type="file" accept=".gpx,.tcx,.fit" className="hidden" onChange={manejarArchivo} />
            <button
              onClick={() => { setValoresImportados(null); setEditandoId(null); setMostrarForm((v) => !v) }}
              className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg hover:brightness-95"
            >
              + Nuevo
            </button>
          </div>

          {errorImport && (
            <div className="card border-alert-red text-sm text-alert-red">{errorImport}</div>
          )}

          {mostrarForm && (
            <FormEntrenamiento
              bicicletas={bicicletas}
              planes={planes}
              valoresIniciales={valoresImportados}
              onGuardar={crear}
              onCancelar={() => { setMostrarForm(false); setValoresImportados(null) }}
            />
          )}

          {cargando ? (
            <p className="text-ink-muted text-sm">Cargando…</p>
          ) : porDia.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin entrenamientos registrados.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {porDia.map(([fecha, items]) => {
                const kmDia = items.reduce((a, e) => a + (Number(e.km) || 0), 0)
                const minDia = items.reduce((a, e) => a + (Number(e.duracion_min) || 0), 0)
                const tssDia = items.reduce((a, e) => a + (Number(e.tss) || 0), 0)
                return (
                  <div key={fecha}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold">{fecha}</span>
                      <span className="readout text-xs text-ink-muted">
                        {kmDia.toFixed(0)} km · {(minDia / 60).toFixed(1)} h ·{' '}
                        <span className="text-hiviz font-semibold">{tssDia.toFixed(0)} TSS</span>
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {items.map((e) =>
                        editandoId === e.id ? (
                          <FormEntrenamiento
                            key={e.id}
                            bicicletas={bicicletas}
                            planes={planes}
                            valoresIniciales={e}
                            onGuardar={(datos) => actualizar(e.id, datos)}
                            onCancelar={() => setEditandoId(null)}
                          />
                        ) : (
                          <div key={e.id} className="card flex items-center justify-between gap-4">
                            <div>
                              <p className="font-medium">{e.tipo} — {e.ruta || 'sin ruta'}</p>
                              <p className="text-ink-muted text-xs">
                                {nombreBici(e.bicicleta_id) || 'sin bici'}
                                {e.plan_id && nombrePlan(e.plan_id) && ` · ${nombrePlan(e.plan_id)}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex gap-4 text-right">
                                <MiniDato label="km" value={e.km} />
                                <MiniDato label="min" value={e.duracion_min} />
                                <MiniDato label="TSS" value={e.tss} accent="hiviz" />
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => { setMostrarForm(false); setEditandoId(e.id) }}
                                  className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => { if (confirm('¿Borrar este entrenamiento?')) eliminar(e.id) }}
                                  className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1"
                                >
                                  Borrar
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {vista === 'planes' && (
        <>
          <div className="flex justify-end">
            <button
              className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg"
              onClick={() => { setPlanEditando(null); setFormPlanOpen((v) => !v) }}
            >
              + Plan
            </button>
          </div>

          {formPlanOpen && (
            <FormPlanEntreno onGuardar={crearPlan} onCancelar={() => setFormPlanOpen(false)} />
          )}

          {planes.length === 0 ? (
            <p className="text-ink-muted text-sm">
              Sin planes cargados. Armá tu primero — por ejemplo "Semana base", con una sesión distinta para cada día (rodillo, series, salida larga, descanso).
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {planes.map((p) =>
                planEditando === p.id ? (
                  <FormPlanEntreno
                    key={p.id}
                    valoresIniciales={p}
                    onGuardar={(datos) => actualizarPlan(p.id, datos)}
                    onCancelar={() => setPlanEditando(null)}
                  />
                ) : (
                  <div key={p.id} className="card">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{p.nombre}</p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setFormPlanOpen(false); setPlanEditando(p.id) }}
                          className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => { if (confirm('¿Borrar este plan?')) borrarPlan(p.id) }}
                          className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1"
                        >
                          Borrar
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 mt-2.5">
                      {DIAS_SEMANA.map((d) => {
                        const sesion = (p.sesiones || []).find((s) => s.dia === d.id)
                        return (
                          <div key={d.id} className="flex items-center gap-2 text-xs">
                            <span className={`w-8 text-center py-0.5 rounded ${sesion ? 'bg-hiviz text-asphalt-950 font-semibold' : 'text-ink-faint border border-asphalt-700'}`}>
                              {d.label}
                            </span>
                            <span className="text-ink-muted">
                              {sesion ? `${sesion.tipo}${sesion.duracion_min ? ` — ${sesion.duracion_min} min` : ''}${sesion.descripcion ? ` · ${sesion.descripcion}` : ''}` : '—'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </>
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

function FormEntrenamiento({ bicicletas, onGuardar, onCancelar, valoresIniciales, planes = [] }) {
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
    plan_id: '',
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
          plan_id: form.plan_id || null,
          duracion_min: form.duracion_min ? Number(form.duracion_min) : null,
          km: form.km ? Number(form.km) : null,
          desnivel: form.desnivel ? Number(form.desnivel) : null,
          potencia_avg: form.potencia_avg ? Number(form.potencia_avg) : null,
          fc_avg: form.fc_avg ? Number(form.fc_avg) : null,
          rpe: form.rpe ? Number(form.rpe) : null
        })
      }}
    >
      {valoresIniciales?.fuente === 'garmin' && !valoresIniciales?.id && (
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

      {planes.length > 0 && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted text-xs">Pertenece al plan</span>
          <select
            {...campo('plan_id')}
            className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink focus:border-hiviz outline-none"
          >
            <option value="">—</option>
            {planes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
      )}

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

function FormPlanEntreno({ onGuardar, onCancelar, valoresIniciales }) {
  const [nombre, setNombre] = useState(valoresIniciales?.nombre || '')
  const [sesiones, setSesiones] = useState(
    valoresIniciales?.sesiones?.length
      ? valoresIniciales.sesiones
      : DIAS_SEMANA.map((d) => ({ dia: d.id, activo: false, tipo: 'Ruta', duracion_min: '', descripcion: '' }))
  )

  function sesionDeDia(diaId) {
    return sesiones.find((s) => s.dia === diaId) || { dia: diaId, activo: false, tipo: 'Ruta', duracion_min: '', descripcion: '' }
  }

  function actualizarDia(diaId, cambios) {
    setSesiones((prev) => {
      const existe = prev.some((s) => s.dia === diaId)
      if (existe) return prev.map((s) => (s.dia === diaId ? { ...s, ...cambios } : s))
      return [...prev, { dia: diaId, activo: false, tipo: 'Ruta', duracion_min: '', descripcion: '', ...cambios }]
    })
  }

  return (
    <form
      className="card flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        const sesionesActivas = sesiones
          .filter((s) => s.activo)
          .map((s) => ({ dia: s.dia, tipo: s.tipo, duracion_min: s.duracion_min, descripcion: s.descripcion }))
        onGuardar({ nombre, sesiones: sesionesActivas })
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted text-xs">Nombre del plan</span>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          placeholder="Semana base / Pre-competencia / Recuperación"
          className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink"
        />
      </label>

      <div className="flex flex-col gap-2.5">
        {DIAS_SEMANA.map((d) => {
          const s = sesionDeDia(d.id)
          return (
            <div key={d.id} className="border border-asphalt-700 rounded-lg p-2.5">
              <label className="flex items-center gap-2 text-sm mb-2">
                <input
                  type="checkbox"
                  checked={!!s.activo}
                  onChange={(e) => actualizarDia(d.id, { activo: e.target.checked })}
                />
                <span className="font-medium">{d.label}</span>
              </label>
              {s.activo && (
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={s.tipo}
                    onChange={(e) => actualizarDia(d.id, { tipo: e.target.value })}
                    className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm"
                  >
                    {TIPOS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <input
                    type="number"
                    value={s.duracion_min}
                    onChange={(e) => actualizarDia(d.id, { duracion_min: e.target.value })}
                    placeholder="Min"
                    className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm"
                  />
                  <input
                    value={s.descripcion}
                    onChange={(e) => actualizarDia(d.id, { descripcion: e.target.value })}
                    placeholder="Detalle (opcional)"
                    className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar plan</button>
      </div>
    </form>
  )
}
