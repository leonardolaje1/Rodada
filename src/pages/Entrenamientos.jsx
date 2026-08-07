import { useEffect, useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { calcularTSS } from '../lib/tss'
import { parseActivityFile } from '../lib/parseActivity'

const TIPOS = ['Ruta', 'MTB', 'Gravel', 'Rodillo', 'Pista', 'Descanso']
const DIAS_SEMANA = [
  { id: 'lun', label: 'Lun' }, { id: 'mar', label: 'Mar' }, { id: 'mie', label: 'Mié' },
  { id: 'jue', label: 'Jue' }, { id: 'vie', label: 'Vie' }, { id: 'sab', label: 'Sáb' }, { id: 'dom', label: 'Dom' }
]
const DIA_POR_INDICE = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']
const TIPOS_OBJETIVO = [
  { id: 'ftp', label: 'FTP (potencia)', unidad: 'W' },
  { id: 'km_anuales', label: 'Km acumulados', unidad: 'km' },
  { id: 'evento', label: 'Evento / competencia', unidad: '' },
  { id: 'otro', label: 'Otro', unidad: '' }
]
const ZONAS_POTENCIA = [
  { zona: 'Z1', nombre: 'Recuperación activa', desde: 0, hasta: 0.55, color: '#8A8F9C' },
  { zona: 'Z2', nombre: 'Resistencia', desde: 0.56, hasta: 0.75, color: '#4A9EFF' },
  { zona: 'Z3', nombre: 'Tempo', desde: 0.76, hasta: 0.90, color: '#C4F135' },
  { zona: 'Z4', nombre: 'Umbral', desde: 0.91, hasta: 1.05, color: '#F5A623' },
  { zona: 'Z5', nombre: 'VO2 máx', desde: 1.06, hasta: 1.20, color: '#F14A4A' },
  { zona: 'Z6', nombre: 'Capacidad anaeróbica', desde: 1.21, hasta: 1.50, color: '#C34AF1' },
  { zona: 'Z7', nombre: 'Neuromuscular', desde: 1.51, hasta: null, color: '#7A4AF1' }
]
const ZONAS_FC = [
  { zona: 'Z1', nombre: 'Recuperación activa', desde: 0, hasta: 0.68, color: '#8A8F9C' },
  { zona: 'Z2', nombre: 'Resistencia', desde: 0.69, hasta: 0.83, color: '#4A9EFF' },
  { zona: 'Z3', nombre: 'Tempo', desde: 0.84, hasta: 0.94, color: '#C4F135' },
  { zona: 'Z4', nombre: 'Umbral', desde: 0.95, hasta: 1.05, color: '#F5A623' },
  { zona: 'Z5', nombre: 'VO2 máx', desde: 1.06, hasta: null, color: '#F14A4A' }
]

function diaIdDeHoy() { return DIA_POR_INDICE[new Date().getDay()] }
function fmtFecha(f) { const [, m, d] = f.split('-'); return `${d}/${m}` }
function agruparPorFecha(items) {
  const grupos = {}
  for (const item of items) { if (!grupos[item.fecha]) grupos[item.fecha] = []; grupos[item.fecha].push(item) }
  return Object.entries(grupos).sort((a, b) => b[0].localeCompare(a[0]))
}

export default function Entrenamientos() {
  const [vista, setVista] = useState('registro')
  const [lista, setLista] = useState([])
  const [bicicletas, setBicicletas] = useState([])
  const [planes, setPlanes] = useState([])
  const [objetivos, setObjetivos] = useState([])
  const [ftpHistorial, setFtpHistorial] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [valoresImportados, setValoresImportados] = useState(null)
  const [errorImport, setErrorImport] = useState('')
  const [formPlanOpen, setFormPlanOpen] = useState(false)
  const [planEditando, setPlanEditando] = useState(null)
  const [formObjetivoOpen, setFormObjetivoOpen] = useState(false)
  const [formFtpOpen, setFormFtpOpen] = useState(false)
  const [ftpEditando, setFtpEditando] = useState(null)
  const inputArchivoRef = useRef(null)

  async function cargar() {
    setCargando(true)
    const [{ data: ents }, { data: bicis }, { data: pls }, { data: objs }, { data: ftps }] = await Promise.all([
      supabase.from('entrenamientos').select('*').order('fecha', { ascending: false }).limit(200),
      supabase.from('bicicletas').select('id, nombre'),
      supabase.from('planes_entrenamiento').select('*').eq('activo', true).order('created_at', { ascending: true }),
      supabase.from('objetivos').select('*').eq('categoria', 'entrenamiento').order('created_at', { ascending: false }),
      supabase.from('ftp_historial').select('*').order('fecha', { ascending: true })
    ])
    setLista(ents || [])
    setBicicletas(bicis || [])
    setPlanes(pls || [])
    setObjetivos(objs || [])
    setFtpHistorial(ftps || [])
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  async function crear(nuevo) {
    const tss = calcularTSS(nuevo)
    await supabase.from('entrenamientos').insert({ ...nuevo, tss })
    setMostrarForm(false); setValoresImportados(null); cargar()
  }
  async function actualizar(id, datos) {
    const tss = calcularTSS(datos)
    await supabase.from('entrenamientos').update({ ...datos, tss }).eq('id', id)
    setEditandoId(null); cargar()
  }
  async function eliminar(id) {
    await supabase.from('entrenamientos').delete().eq('id', id); cargar()
  }
  async function marcarRealizado(id) {
    await supabase.from('entrenamientos').update({ estado: 'realizado' }).eq('id', id); cargar()
  }

  async function manejarArchivo(e) {
    const file = e.target.files[0]; e.target.value = ''
    if (!file) return
    setErrorImport('')
    try {
      const datos = await parseActivityFile(file)
      setValoresImportados({ tipo: 'Ruta', ruta: file.name.replace(/\.(gpx|tcx|fit)$/i, ''), bicicleta_id: '', ...datos, fuente: 'garmin' })
      setEditandoId(null); setMostrarForm(true)
    } catch (err) { setErrorImport(err.message) }
  }

  async function crearPlan(form) { await supabase.from('planes_entrenamiento').insert(form); setFormPlanOpen(false); cargar() }
  async function actualizarPlan(id, form) { await supabase.from('planes_entrenamiento').update(form).eq('id', id); setPlanEditando(null); cargar() }
  async function borrarPlan(id) { await supabase.from('planes_entrenamiento').update({ activo: false }).eq('id', id); cargar() }

  function registrarSesionDeHoy(plan, sesion) {
    setValoresImportados({ tipo: sesion.tipo, duracion_min: sesion.duracion_min, comentarios: sesion.descripcion || '', plan_id: plan.id, estado: 'realizado' })
    setEditandoId(null); setMostrarForm(true)
  }

    async function crearObjetivo(form) {
    const { error } = await supabase.from('objetivos').insert({ ...form, categoria: 'entrenamiento', estado: 'activo', valor_actual: 0 })
    if (error) { alert('No se pudo guardar el objetivo: ' + error.message); return }
    setFormObjetivoOpen(false); cargar()
  }

  async function actualizarValorObjetivo(id, valor) { await supabase.from('objetivos').update({ valor_actual: valor }).eq('id', id); cargar() }
  async function marcarCumplidoObjetivo(o) { await supabase.from('objetivos').update({ estado: o.estado === 'cumplido' ? 'activo' : 'cumplido' }).eq('id', o.id); cargar() }
  async function borrarObjetivo(id) { if (!confirm('¿Borrar este objetivo?')) return; await supabase.from('objetivos').delete().eq('id', id); cargar() }

  async function crearFtp(form) { await supabase.from('ftp_historial').insert(form); setFormFtpOpen(false); cargar() }
  async function actualizarFtp(id, form) { await supabase.from('ftp_historial').update(form).eq('id', id); setFtpEditando(null); cargar() }
  async function eliminarFtp(id) { if (!confirm('¿Borrar este registro de FTP?')) return; await supabase.from('ftp_historial').delete().eq('id', id); cargar() }

  const nombreBici = (id) => bicicletas.find((b) => b.id === id)?.nombre || null
  const nombrePlan = (id) => planes.find((p) => p.id === id)?.nombre || null
  const porDia = agruparPorFecha(lista)
  const hoyId = diaIdDeHoy()
  const sesionesHoy = planes.flatMap((p) => (p.sesiones || []).filter((s) => s.dia === hoyId).map((s) => ({ plan: p, sesion: s })))

  const realizados = lista.filter((e) => e.estado === 'realizado')
  const kmAnualesActual = realizados
    .filter((e) => e.fecha.slice(0, 4) === String(new Date().getFullYear()))
    .reduce((a, e) => a + (Number(e.km) || 0), 0)

  const ftpActual = ftpHistorial[ftpHistorial.length - 1] || null
  const graficoFtp = ftpHistorial.map((h) => ({ fecha: h.fecha, ftp: h.ftp_watts }))

  const records = {
    km: realizados.reduce((max, e) => (Number(e.km) > (max?.km || 0) ? e : max), null),
    desnivel: realizados.reduce((max, e) => (Number(e.desnivel) > (max?.desnivel || 0) ? e : max), null),
    potencia: realizados.filter((e) => e.potencia_avg).reduce((max, e) => (Number(e.potencia_avg) > (max?.potencia_avg || 0) ? e : max), null),
    tss: realizados.reduce((max, e) => (Number(e.tss) > (max?.tss || 0) ? e : max), null)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Entrenamientos</h1>
        <p className="text-ink-muted text-sm mt-1">Registro, planificación y análisis</p>
      </div>

      <div className="flex gap-1 bg-asphalt-950 p-1 rounded-lg overflow-x-auto">
        {[['registro', 'Registro'], ['planes', 'Planes'], ['objetivos', 'Objetivos'], ['ftp', 'FTP y zonas'], ['records', 'Récords']].map(([id, label]) => (
          <button key={id} onClick={() => setVista(id)} className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${vista === id ? 'bg-hiviz text-asphalt-950' : 'text-ink-muted'}`}>
            {label}
          </button>
        ))}
      </div>

      {vista === 'registro' && (
        <>
          {sesionesHoy.length > 0 && (
            <div className="card">
              <span className="label-eyebrow">Plan de hoy</span>
              <div className="flex flex-col gap-2 mt-2.5">
                {sesionesHoy.map(({ plan, sesion }, i) => (
                  <button key={i} onClick={() => registrarSesionDeHoy(plan, sesion)} className="flex items-center justify-between border border-asphalt-700 rounded-lg px-3 py-2 text-left hover:border-hiviz">
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
            <button onClick={() => inputArchivoRef.current?.click()} className="border border-asphalt-700 text-ink-muted font-semibold text-sm px-3 py-2 rounded-lg hover:text-ink">
              Importar FIT/GPX/TCX
            </button>
            <input ref={inputArchivoRef} type="file" accept=".gpx,.tcx,.fit" className="hidden" onChange={manejarArchivo} />
            <button onClick={() => { setValoresImportados(null); setEditandoId(null); setMostrarForm((v) => !v) }} className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg hover:brightness-95">
              + Nuevo
            </button>
          </div>

          {errorImport && <div className="card border-alert-red text-sm text-alert-red">{errorImport}</div>}

          {mostrarForm && (
            <FormEntrenamiento bicicletas={bicicletas} planes={planes} valoresIniciales={valoresImportados} onGuardar={crear} onCancelar={() => { setMostrarForm(false); setValoresImportados(null) }} />
          )}

          {cargando ? (
            <p className="text-ink-muted text-sm">Cargando…</p>
          ) : porDia.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin entrenamientos registrados.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {porDia.map(([fecha, items]) => {
                const realizadosDia = items.filter((e) => e.estado === 'realizado')
                const kmDia = realizadosDia.reduce((a, e) => a + (Number(e.km) || 0), 0)
                const minDia = realizadosDia.reduce((a, e) => a + (Number(e.duracion_min) || 0), 0)
                const tssDia = realizadosDia.reduce((a, e) => a + (Number(e.tss) || 0), 0)
                return (
                  <div key={fecha}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold">{fecha}</span>
                      <span className="readout text-xs text-ink-muted">{kmDia.toFixed(0)} km · {(minDia / 60).toFixed(1)} h · <span className="text-hiviz font-semibold">{tssDia.toFixed(0)} TSS</span></span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {items.map((e) =>
                        editandoId === e.id ? (
                          <FormEntrenamiento key={e.id} bicicletas={bicicletas} planes={planes} valoresIniciales={e} onGuardar={(datos) => actualizar(e.id, datos)} onCancelar={() => setEditandoId(null)} />
                        ) : (
                          <div key={e.id} className={`card flex items-center justify-between gap-4 ${e.estado === 'pendiente' ? 'opacity-70 border-dashed' : ''}`}>
                            <div className="flex items-center gap-2">
                              {e.estado === 'pendiente' && <i className="w-2 h-2 rounded-full border border-ink-faint inline-block flex-shrink-0" title="Pendiente" />}
                              {e.es_clave && <span className="text-hiviz" title="Sesión clave">★</span>}
                              <div>
                                <p className="font-medium">{e.tipo} — {e.ruta || 'sin ruta'}</p>
                                <p className="text-ink-muted text-xs">
                                  {nombreBici(e.bicicleta_id) || 'sin bici'}
                                  {e.plan_id && nombrePlan(e.plan_id) && ` · ${nombrePlan(e.plan_id)}`}
                                  {e.estado === 'pendiente' && ' · Pendiente'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {e.estado === 'realizado' && (
                                <div className="flex gap-4 text-right">
                                  <MiniDato label="km" value={e.km} />
                                  <MiniDato label="min" value={e.duracion_min} />
                                  <MiniDato label="TSS" value={e.tss} accent />
                                </div>
                              )}
                              <div className="flex gap-1">
                                {e.estado === 'pendiente' && (
                                  <button onClick={() => marcarRealizado(e.id)} className="text-hiviz text-xs border border-asphalt-700 rounded-lg px-2 py-1">Marcar hecho</button>
                                )}
                                <button onClick={() => { setMostrarForm(false); setEditandoId(e.id) }} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Editar</button>
                                <button onClick={() => { if (confirm('¿Borrar este entrenamiento?')) eliminar(e.id) }} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
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
            <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => { setPlanEditando(null); setFormPlanOpen((v) => !v) }}>+ Plan</button>
          </div>
          {formPlanOpen && <FormPlanEntreno onGuardar={crearPlan} onCancelar={() => setFormPlanOpen(false)} />}
          {planes.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin planes cargados.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {planes.map((p) =>
                planEditando === p.id ? (
                  <FormPlanEntreno key={p.id} valoresIniciales={p} onGuardar={(datos) => actualizarPlan(p.id, datos)} onCancelar={() => setPlanEditando(null)} />
                ) : (
                  <div key={p.id} className="card">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{p.nombre}</p>
                      <div className="flex gap-1">
                        <button onClick={() => { setFormPlanOpen(false); setPlanEditando(p.id) }} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Editar</button>
                        <button onClick={() => borrarPlan(p.id)} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 mt-2.5">
                      {DIAS_SEMANA.map((d) => {
                        const sesion = (p.sesiones || []).find((s) => s.dia === d.id)
                        return (
                          <div key={d.id} className="flex items-center gap-2 text-xs">
                            <span className={`w-8 text-center py-0.5 rounded ${sesion ? 'bg-hiviz text-asphalt-950 font-semibold' : 'text-ink-faint border border-asphalt-700'}`}>{d.label}</span>
                            <span className="text-ink-muted">{sesion ? `${sesion.tipo}${sesion.duracion_min ? ` — ${sesion.duracion_min} min` : ''}${sesion.descripcion ? ` · ${sesion.descripcion}` : ''}` : '—'}</span>
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

      {vista === 'objetivos' && (
        <>
          <div className="flex justify-end">
            <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => setFormObjetivoOpen((v) => !v)}>+ Objetivo</button>
          </div>
          {formObjetivoOpen && <FormObjetivo onGuardar={crearObjetivo} onCancelar={() => setFormObjetivoOpen(false)} />}
          {objetivos.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin objetivos de entrenamiento cargados.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {objetivos.map((o) => {
                const meta = TIPOS_OBJETIVO.find((t) => t.id === o.tipo) || TIPOS_OBJETIVO[3]
                const actual = o.tipo === 'km_anuales' ? kmAnualesActual : (o.tipo === 'ftp' && ftpActual ? ftpActual.ftp_watts : Number(o.valor_actual) || 0)
                const objetivo = Number(o.valor_objetivo) || 0
                const pct = objetivo ? Math.min(100, Math.round((actual / objetivo) * 100)) : 0
                const cumplido = o.estado === 'cumplido'
                const auto = o.tipo === 'km_anuales' || (o.tipo === 'ftp' && ftpActual)
                return (
                  <div key={o.id} className={`card ${cumplido ? 'opacity-60' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className={`font-semibold text-sm ${cumplido ? 'line-through' : ''}`}>{o.titulo}</p>
                        <p className="text-ink-muted text-xs mt-0.5">{meta.label}{o.fecha_limite ? ` · hasta ${o.fecha_limite}` : ''}</p>
                      </div>
                      <div className="flex gap-1">
                        <button className="text-xs border border-asphalt-700 rounded-lg px-2.5 py-1 text-ink-muted" onClick={() => marcarCumplidoObjetivo(o)}>{cumplido ? 'Reabrir' : 'Cumplido'}</button>
                        <button className="text-xs border border-asphalt-700 rounded-lg px-2.5 py-1 text-alert-red" onClick={() => borrarObjetivo(o.id)}>Borrar</button>
                      </div>
                    </div>
                    {o.tipo !== 'evento' && (
                      <>
                        <div className="flex justify-between items-baseline mt-2.5">
                          <span className="readout text-lg font-bold text-hiviz">{actual}{meta.unidad}</span>
                          <span className="text-ink-muted text-xs">meta: {objetivo}{meta.unidad}</span>
                        </div>
                        <div className="w-full h-1.5 bg-asphalt-700 rounded-full mt-2 overflow-hidden"><div className="h-full bg-hiviz" style={{ width: `${pct}%` }} /></div>
                        {!auto && !cumplido && (
                          <input type="number" placeholder={`Valor actual (${meta.unidad})`} onBlur={(e) => { if (e.target.value !== '') actualizarValorObjetivo(o.id, e.target.value) }} className="w-full bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink text-sm mt-2.5" />
                        )}
                        {auto && <p className="text-ink-faint text-xs mt-2">Se actualiza solo con tus datos cargados</p>}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {vista === 'ftp' && (
        <>
          <div className="flex justify-end">
            <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => { setFtpEditando(null); setFormFtpOpen((v) => !v) }}>+ Test</button>
          </div>
          {formFtpOpen && <FormFTP onGuardar={crearFtp} onCancelar={() => setFormFtpOpen(false)} />}
          {!ftpActual ? (
            <p className="text-ink-muted text-sm">Todavía no cargaste ningún test de FTP.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="card">
                  <span className="label-eyebrow">FTP actual</span>
                  <p className="readout text-3xl font-bold text-hiviz mt-1">{ftpActual.ftp_watts} <span className="text-sm text-ink-muted">W</span></p>
                  <p className="text-ink-faint text-xs mt-1">{ftpActual.fecha}</p>
                </div>
                <div className="card">
                  <span className="label-eyebrow">FC umbral</span>
                  <p className="readout text-3xl font-bold text-route mt-1">{ftpActual.fc_umbral ? <>{ftpActual.fc_umbral} <span className="text-sm text-ink-muted">bpm</span></> : '—'}</p>
                </div>
              </div>
              {ftpHistorial.length > 1 && (
                <div className="card">
                  <span className="label-eyebrow">Evolución</span>
                  <div className="mt-2 -ml-4">
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={graficoFtp} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#262A33" vertical={false} />
                        <XAxis dataKey="fecha" tickFormatter={fmtFecha} tick={{ fill: '#8A8F9C', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#262A33' }} />
                        <YAxis tick={{ fill: '#8A8F9C', fontSize: 10 }} tickLine={false} axisLine={false} width={30} domain={['dataMin - 10', 'dataMax + 10']} />
                        <Tooltip contentStyle={{ background: '#1C1F26', border: '1px solid #262A33', borderRadius: 8, fontSize: 12 }} labelFormatter={fmtFecha} />
                        <Line type="monotone" dataKey="ftp" stroke="#C4F135" strokeWidth={2} dot={{ r: 3 }} name="FTP (W)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              <div>
                <h2 className="text-sm font-semibold mb-2">Zonas de potencia</h2>
                <div className="flex flex-col gap-1.5">
                  {ZONAS_POTENCIA.map((z) => {
                    const desde = Math.round(ftpActual.ftp_watts * z.desde)
                    const hasta = z.hasta ? Math.round(ftpActual.ftp_watts * z.hasta) : null
                    return (
                      <div key={z.zona} className="card flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-2.5"><span className="w-2 h-2 rounded-full" style={{ background: z.color }} /><p className="text-sm font-medium">{z.zona} — {z.nombre}</p></div>
                        <span className="readout text-sm font-semibold">{desde}{hasta ? `–${hasta}` : '+'} W</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              {ftpActual.fc_umbral && (
                <div>
                  <h2 className="text-sm font-semibold mb-2">Zonas de FC</h2>
                  <div className="flex flex-col gap-1.5">
                    {ZONAS_FC.map((z) => {
                      const desde = Math.round(ftpActual.fc_umbral * z.desde)
                      const hasta = z.hasta ? Math.round(ftpActual.fc_umbral * z.hasta) : null
                      return (
                        <div key={z.zona} className="card flex items-center justify-between py-2.5">
                          <div className="flex items-center gap-2.5"><span className="w-2 h-2 rounded-full" style={{ background: z.color }} /><p className="text-sm font-medium">{z.zona} — {z.nombre}</p></div>
                          <span className="readout text-sm font-semibold">{desde}{hasta ? `–${hasta}` : '+'} bpm</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
          {ftpHistorial.length > 0 && (
            <div className="flex flex-col gap-2">
              {[...ftpHistorial].reverse().map((h) =>
                ftpEditando === h.id ? (
                  <FormFTP key={h.id} valoresIniciales={h} onGuardar={(datos) => actualizarFtp(h.id, datos)} onCancelar={() => setFtpEditando(null)} />
                ) : (
                  <div key={h.id} className="card flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{h.ftp_watts} W {h.fc_umbral ? `· ${h.fc_umbral} bpm` : ''}</p>
                      <p className="text-ink-muted text-xs">{h.fecha}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setFormFtpOpen(false); setFtpEditando(h.id) }} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Editar</button>
                      <button onClick={() => eliminarFtp(h.id)} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}

      {vista === 'records' && (
        <div className="flex flex-col gap-2">
          <RecordCard label="Salida más larga" item={records.km} valor={records.km ? `${records.km.km} km` : null} />
          <RecordCard label="Mayor desnivel" item={records.desnivel} valor={records.desnivel ? `${records.desnivel.desnivel} m` : null} />
          <RecordCard label="Mayor potencia media" item={records.potencia} valor={records.potencia ? `${records.potencia.potencia_avg} W` : null} />
          <RecordCard label="Mayor TSS en una salida" item={records.tss} valor={records.tss ? `${records.tss.tss} TSS` : null} />
        </div>
      )}
    </div>
  )
}

function RecordCard({ label, item, valor }) {
  return (
    <div className="card flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-ink-muted text-xs">{item ? `${item.fecha} · ${item.tipo}` : 'Sin datos todavía'}</p>
      </div>
      <span className="readout text-lg font-bold text-hiviz">{valor || '—'}</span>
    </div>
  )
}

function MiniDato({ label, value, accent }) {
  return (
    <div>
      <p className={`readout text-sm font-semibold ${accent ? 'text-hiviz' : ''}`}>{value ?? '—'}</p>
      <p className="text-ink-muted text-[10px] uppercase">{label}</p>
    </div>
  )
}

function FormEntrenamiento({ bicicletas, onGuardar, onCancelar, valoresIniciales, planes = [] }) {
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10), tipo: 'Ruta', ruta: '', bicicleta_id: '',
    duracion_min: '', km: '', desnivel: '', potencia_avg: '', fc_avg: '', rpe: '', comentarios: '',
    plan_id: '', estado: 'realizado', es_clave: false,
    ...valoresIniciales
  })
  function campo(k) { return { value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) } }
  const esRodillo = form.tipo === 'Rodillo'

  return (
    <form className="card grid grid-cols-1 sm:grid-cols-3 gap-3" onSubmit={(e) => {
      e.preventDefault()
      if (!esRodillo && !form.bicicleta_id) { alert('Elegí con qué bici hiciste este entrenamiento (o marcá Rodillo si fue indoor).'); return }
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
    }}>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fecha</span>
        <input type="date" {...campo('fecha')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Estado</span>
        <select {...campo('estado')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          <option value="realizado">Realizado</option>
          <option value="pendiente">Pendiente</option>
        </select></label>
      <label className="flex items-center gap-2 text-sm mt-6">
        <input type="checkbox" checked={!!form.es_clave} onChange={(e) => setForm((f) => ({ ...f, es_clave: e.target.checked }))} />
        <span className="text-ink-muted text-xs">Sesión clave</span>
      </label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Tipo</span>
        <select {...campo('tipo')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          {TIPOS.map((t) => <option key={t}>{t}</option>)}
        </select></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Bicicleta {esRodillo ? '(opcional)' : ''}</span>
        <select {...campo('bicicleta_id')} required={!esRodillo} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          <option value="">—</option>
          {bicicletas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
        </select></label>
      {planes.length > 0 && (
        <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Plan</span>
          <select {...campo('plan_id')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
            <option value="">—</option>
            {planes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select></label>
      )}
      <Campo label="Ruta" {...campo('ruta')} />
      <Campo label="Duración (min)" type="number" {...campo('duracion_min')} />
      <Campo label="Km" type="number" step="0.1" {...campo('km')} />
      <Campo label="Desnivel (m)" type="number" {...campo('desnivel')} />
      <Campo label="Potencia media (W)" type="number" {...campo('potencia_avg')} />
      <Campo label="FC media" type="number" {...campo('fc_avg')} />
      <Campo label="RPE (1-10)" type="number" min="1" max="10" {...campo('rpe')} />
      <label className="flex flex-col gap-1 text-sm sm:col-span-3"><span className="text-ink-muted text-xs">Comentarios</span>
        <textarea {...campo('comentarios')} rows={2} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="sm:col-span-3 flex gap-2 justify-end mt-2">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button>
      </div>
    </form>
  )
}

function Campo({ label, ...props }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-muted text-xs">{label}</span>
      <input {...props} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" />
    </label>
  )
}

function FormPlanEntreno({ onGuardar, onCancelar, valoresIniciales }) {
  const [nombre, setNombre] = useState(valoresIniciales?.nombre || '')
  const [sesiones, setSesiones] = useState(
    valoresIniciales?.sesiones?.length ? valoresIniciales.sesiones : DIAS_SEMANA.map((d) => ({ dia: d.id, activo: false, tipo: 'Ruta', duracion_min: '', descripcion: '' }))
  )
  function sesionDeDia(diaId) { return sesiones.find((s) => s.dia === diaId) || { dia: diaId, activo: false, tipo: 'Ruta', duracion_min: '', descripcion: '' } }
  function actualizarDia(diaId, cambios) {
    setSesiones((prev) => {
      const existe = prev.some((s) => s.dia === diaId)
      if (existe) return prev.map((s) => (s.dia === diaId ? { ...s, ...cambios } : s))
      return [...prev, { dia: diaId, activo: false, tipo: 'Ruta', duracion_min: '', descripcion: '', ...cambios }]
    })
  }
  return (
    <form className="card flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault()
      const sesionesActivas = sesiones.filter((s) => s.activo).map((s) => ({ dia: s.dia, tipo: s.tipo, duracion_min: s.duracion_min, descripcion: s.descripcion }))
      onGuardar({ nombre, sesiones: sesionesActivas })
    }}>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Nombre del plan</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="flex flex-col gap-2.5">
        {DIAS_SEMANA.map((d) => {
          const s = sesionDeDia(d.id)
          return (
            <div key={d.id} className="border border-asphalt-700 rounded-lg p-2.5">
              <label className="flex items-center gap-2 text-sm mb-2">
                <input type="checkbox" checked={!!s.activo} onChange={(e) => actualizarDia(d.id, { activo: e.target.checked })} />
                <span className="font-medium">{d.label}</span>
              </label>
              {s.activo && (
                <div className="grid grid-cols-3 gap-2">
                  <select value={s.tipo} onChange={(e) => actualizarDia(d.id, { tipo: e.target.value })} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm">
                    {TIPOS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <input type="number" value={s.duracion_min} onChange={(e) => actualizarDia(d.id, { duracion_min: e.target.value })} placeholder="Min" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm" />
                  <input value={s.descripcion} onChange={(e) => actualizarDia(d.id, { descripcion: e.target.value })} placeholder="Detalle" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm" />
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

function FormObjetivo({ onGuardar, onCancelar }) {
  const [form, setForm] = useState({ titulo: '', tipo: 'ftp', valor_objetivo: '', fecha_limite: '' })
  const campo = (k) => ({ value: form[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })
  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onGuardar(form) }}>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Título</span>
        <input {...campo('titulo')} required placeholder="Subir FTP a 280W" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Tipo</span>
        <select {...campo('tipo')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          {TIPOS_OBJETIVO.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Valor objetivo</span>
        <input type="number" {...campo('valor_objetivo')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Fecha límite</span>
        <input type="date" {...campo('fecha_limite')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="col-span-2 flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button>
      </div>
    </form>
  )
}

function FormFTP({ onGuardar, onCancelar, valoresIniciales }) {
  const [form, setForm] = useState({ fecha: new Date().toISOString().slice(0, 10), ftp_watts: '', fc_umbral: '', fuente: 'test', notas: '', ...valoresIniciales })
  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })
  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onGuardar({ ...form, ftp_watts: Number(form.ftp_watts), fc_umbral: form.fc_umbral ? Number(form.fc_umbral) : null }) }}>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fecha</span>
        <input type="date" {...campo('fecha')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fuente</span>
        <select {...campo('fuente')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          <option value="test">Test</option><option value="estimado">Estimado</option>
        </select></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">FTP (W)</span>
        <input type="number" {...campo('ftp_watts')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">FC umbral (bpm)</span>
        <input type="number" {...campo('fc_umbral')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="col-span-2 flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button>
      </div>
    </form>
  )
}
