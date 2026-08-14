import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { calcularTSS, construirSerieDiaria, calcularCargaDiaria } from '../lib/tss'
import { calcularMejoresPotencias, etiquetaDuracion } from '../lib/potenciaCurva'
import { LineChart as ReLineChart, Line as ReLine, XAxis as ReXAxis, YAxis as ReYAxis, Tooltip as ReTooltip, ResponsiveContainer as ReResponsiveContainer, CartesianGrid as ReCartesianGrid } from 'recharts'
import { parseActivityFile } from '../lib/parseActivity'
import { SkeletonList } from '../components/Skeleton'
import { useToast } from '../lib/ToastContext'
import { useConfirm } from '../lib/ConfirmContext'
import { descargarWorkoutFit } from '../lib/generarWorkoutFit'
import IconoInsignia from '../components/IconoInsignia'
import EstadoVacio from '../components/EstadoVacio'
import { Activity } from 'lucide-react'

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
const ESTILOS_SESION = [
  'Recuperación', 'Resistencia (Endurance)', 'Tempo', 'Sweet Spot', 'Umbral (Threshold)',
  'VO2 Max', 'Anaeróbico', 'Sprint / Neuromuscular', 'Fuerza (baja cadencia)', 'Otro'
]
const TIPOS_MESOCICLO = [
  { id: 'base', label: 'Base', color: '#4A9EFF' },
  { id: 'construccion', label: 'Construcción', color: '#C4F135' },
  { id: 'especifico', label: 'Específico', color: '#F5A623' },
  { id: 'pico', label: 'Pico', color: '#F14A4A' },
  { id: 'transicion', label: 'Transición / Descanso', color: '#8A8F9C' }
]
const TIPOS_TEST_FTP = [
  { id: 'ftp', label: 'Test de FTP (20/60 min)' },
  { id: 'rampa', label: 'Test de rampa' },
  { id: '20min', label: '20 minutos' },
  { id: 'escalon', label: 'Test escalonado' },
  { id: 'otro', label: 'Otro' }
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
function lunesDeSemana(fechaStr) {
  const d = new Date(fechaStr + 'T12:00:00')
  const dow = d.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + offset)
  return d
}
function escaparXml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function agruparPorFecha(items) {
  const grupos = {}
  for (const item of items) { if (!grupos[item.fecha]) grupos[item.fecha] = []; grupos[item.fecha].push(item) }
  return Object.entries(grupos).sort((a, b) => b[0].localeCompare(a[0]))
}

export default function Entrenamientos() {
  const toast = useToast()
  const { confirmar, alertar } = useConfirm()
  const [vista, setVista] = useState('temporada')
  const [lista, setLista] = useState([])
  const [bicicletas, setBicicletas] = useState([])
  const [planes, setPlanes] = useState([])
  const [objetivos, setObjetivos] = useState([])
  const [ftpHistorial, setFtpHistorial] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [valoresEdicion, setValoresEdicion] = useState(null)
  const [valoresImportados, setValoresImportados] = useState(null)
  const [errorImport, setErrorImport] = useState('')
  const [formPlanOpen, setFormPlanOpen] = useState(false)
  const [planEditando, setPlanEditando] = useState(null)
  const [formObjetivoOpen, setFormObjetivoOpen] = useState(false)
  const [formFtpOpen, setFormFtpOpen] = useState(false)
  const [ftpEditando, setFtpEditando] = useState(null)
  const [feedbackPorEntreno, setFeedbackPorEntreno] = useState({})
  const [mesociclos, setMesociclos] = useState([])
  const [registrosPotencia, setRegistrosPotencia] = useState([])
  const [competencias, setCompetencias] = useState([])
  const [formMesoOpen, setFormMesoOpen] = useState(false)
  const [mesoEditando, setMesoEditando] = useState(null)
  const inputArchivoRef = useRef(null)

  async function cargar() {
    setCargando(true)
    const [{ data: ents }, { data: bicis }, { data: pls }, { data: objs }, { data: ftps }, { data: mesos }, { data: comps }, { data: regPot }] = await Promise.all([
      supabase.from('entrenamientos').select('*').order('fecha', { ascending: false }).limit(200),
      supabase.from('bicicletas').select('id, nombre'),
      supabase.from('planes_entrenamiento').select('*').eq('activo', true).order('created_at', { ascending: true }),
      supabase.from('objetivos').select('*').eq('categoria', 'entrenamiento').order('created_at', { ascending: false }),
      supabase.from('ftp_historial').select('*').order('fecha', { ascending: true }),
      supabase.from('mesociclos').select('*').order('fecha_inicio', { ascending: true }),
      supabase.from('competencias').select('id, nombre, fecha').order('fecha', { ascending: true }),
      supabase.from('registros_potencia').select('*').order('duracion_seg', { ascending: true })
    ])
    setLista(ents || [])
    setBicicletas(bicis || [])
    setPlanes(pls || [])
    setObjetivos(objs || [])
    setFtpHistorial(ftps || [])
    setMesociclos(mesos || [])
    setRegistrosPotencia(regPot || [])
    setCompetencias(comps || [])

    if (ents && ents.length > 0) {
      const { data: fbs } = await supabase
        .from('feedback_entrenamientos')
        .select('*')
        .in('entrenamiento_id', ents.map((e) => e.id))
        .order('created_at', { ascending: true })
      const agrupado = {}
      for (const fb of fbs || []) {
        if (!agrupado[fb.entrenamiento_id]) agrupado[fb.entrenamiento_id] = []
        agrupado[fb.entrenamiento_id].push(fb)
      }
      setFeedbackPorEntreno(agrupado)
    } else {
      setFeedbackPorEntreno({})
    }

    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  const [searchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('nuevo') === '1') {
      setVista('registro')
      setMostrarForm(true)
    }
  }, [searchParams])

  async function crear(nuevo) {
    const tss = calcularTSS(nuevo)
    const { data: creado, error } = await supabase.from('entrenamientos').insert({ ...nuevo, tss }).select().single()
    setMostrarForm(false); setValoresImportados(null)

    if (!error && creado && Array.isArray(nuevo.serie_potencia) && nuevo.serie_potencia.length > 0) {
      const mejores = calcularMejoresPotencias(nuevo.serie_potencia)
      await Promise.all(
        mejores.map((m) => supabase.rpc('actualizar_registro_potencia', {
          p_duracion_seg: m.duracion_seg,
          p_watts: m.watts,
          p_entrenamiento_id: creado.id,
          p_fecha: creado.fecha
        }))
      )
    }

    cargar()
    toast('Entrenamiento guardado')
  }
  async function actualizar(id, datos) {
    const tss = calcularTSS(datos)
    await supabase.from('entrenamientos').update({ ...datos, tss }).eq('id', id)
    setEditandoId(null); cargar()
    toast('Entrenamiento guardado')
  }
  async function eliminar(id) {
    await supabase.from('entrenamientos').delete().eq('id', id); cargar()
  }
  async function descargarParaReloj(s) {
    const ftpActual = ftpHistorial[ftpHistorial.length - 1]?.ftp_watts || null
    const { data: pesos } = await supabase.from('peso_historial').select('peso').order('fecha', { ascending: false }).limit(1)
    const pesoActual = pesos && pesos[0]?.peso || null
    descargarWorkoutFit(s, { ftp: ftpActual, peso: pesoActual })
  }
  function exportarGPX(e) {
    const nombre = `${e.tipo}${e.ruta ? ' - ' + e.ruta : ''}`
    const fechaISO = new Date(e.fecha + 'T00:00:00').toISOString()
    const descripcionPartes = []
    if (e.km) descripcionPartes.push(`${e.km} km`)
    if (e.duracion_min) descripcionPartes.push(`${e.duracion_min} min`)
    if (e.desnivel) descripcionPartes.push(`${e.desnivel} m desnivel`)
    if (e.potencia_avg) descripcionPartes.push(`${e.potencia_avg} W media`)
    if (e.potencia_normalizada) descripcionPartes.push(`${e.potencia_normalizada} W NP`)
    if (e.fc_avg) descripcionPartes.push(`${e.fc_avg} bpm media`)
    if (e.tss) descripcionPartes.push(`${e.tss} TSS`)
    const descripcion = descripcionPartes.join(' · ') + (e.comentarios ? ` — ${e.comentarios}` : '')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="HELU" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escaparXml(nombre)}</name>
    <desc>${escaparXml(descripcion)}</desc>
    <time>${fechaISO}</time>
  </metadata>
</gpx>`

    const blob = new Blob([xml], { type: 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${e.fecha}-${e.tipo.toLowerCase()}.gpx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  async function manejarArchivo(e) {
    const file = e.target.files[0]; e.target.value = ''
    if (!file) return
    setErrorImport('')
    if (!/\.(gpx|tcx|fit)$/i.test(file.name)) {
      setErrorImport(`"${file.name}" no es un archivo .gpx, .tcx o .fit. Elegí el archivo exportado desde Garmin Connect.`)
      return
    }
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
    await supabase.from('objetivos').insert({ ...form, categoria: 'entrenamiento', estado: 'activo', valor_actual: 0 })
    setFormObjetivoOpen(false); cargar()
  }
  async function actualizarValorObjetivo(id, valor) { await supabase.from('objetivos').update({ valor_actual: valor }).eq('id', id); cargar() }
  async function marcarCumplidoObjetivo(o) { await supabase.from('objetivos').update({ estado: o.estado === 'cumplido' ? 'activo' : 'cumplido' }).eq('id', o.id); cargar() }
  async function borrarObjetivo(id) { if (!(await confirmar('¿Borrar este objetivo?', { destructivo: true }))) return; await supabase.from('objetivos').delete().eq('id', id); cargar() }

  async function crearFtp(form) { await supabase.from('ftp_historial').insert(form); setFormFtpOpen(false); cargar() }
  async function actualizarFtp(id, form) { await supabase.from('ftp_historial').update(form).eq('id', id); setFtpEditando(null); cargar() }
  async function eliminarFtp(id) { if (!(await confirmar('¿Borrar este registro de FTP?', { destructivo: true }))) return; await supabase.from('ftp_historial').delete().eq('id', id); cargar() }

  async function crearMesociclo(form) {
    const { semanas, ...meta } = form
    const { error, data: nuevo } = await supabase.from('mesociclos').insert({ ...meta, semanas }).select().single()
    if (error) { alertar('No se pudo guardar: ' + error.message); return }

    const lunesBase = lunesDeSemana(meta.fecha_inicio)
    const sesionesNuevas = []
    semanas.forEach((semana, si) => {
      DIAS_SEMANA.forEach((diaInfo, oi) => {
        const d = (semana.dias || []).find((x) => x.dia === diaInfo.id)
        if (!d || !d.activo) return
        const fecha = new Date(lunesBase)
        fecha.setDate(fecha.getDate() + si * 7 + oi)
        sesionesNuevas.push({
          fecha: fecha.toISOString().slice(0, 10),
          tipo: d.tipo,
          duracion_min: d.duracion_min ? Number(d.duracion_min) : null,
          comentarios: d.descripcion || null,
          estado: 'pendiente',
          es_clave: !!d.es_clave,
          mesociclo_id: nuevo.id,
          estilo_sesion: d.estilo_sesion || null,
          zona_objetivo: d.zona_objetivo || null,
          watts_kg_objetivo: d.watts_kg_objetivo ? Number(d.watts_kg_objetivo) : null,
          series_objetivo: d.series_objetivo ? Number(d.series_objetivo) : null,
          repeticiones_objetivo: d.repeticiones_objetivo ? Number(d.repeticiones_objetivo) : null,
          tiempo_trabajo_objetivo: d.tiempo_trabajo_objetivo || null,
          pausa_objetivo: d.pausa_objetivo || null
        })
      })
    })
    if (sesionesNuevas.length > 0) await supabase.from('entrenamientos').insert(sesionesNuevas)

    setFormMesoOpen(false); cargar()
  }
  async function actualizarMesociclo(id, form) {
    const { semanas, ...meta } = form
    const { error } = await supabase.from('mesociclos').update(meta).eq('id', id)
    if (error) { alertar('No se pudo guardar: ' + error.message); return }
    setMesoEditando(null); cargar()
  }
  async function eliminarMesociclo(id) {
    if (!(await confirmar('¿Borrar este mesociclo? Las sesiones pendientes generadas por él también se van a borrar (las ya realizadas quedan como historial).', { destructivo: true }))) return
    await supabase.from('entrenamientos').delete().eq('mesociclo_id', id).eq('estado', 'pendiente')
    await supabase.from('mesociclos').delete().eq('id', id)
    cargar()
  }

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
    normalizada: realizados.filter((e) => e.potencia_normalizada).reduce((max, e) => (Number(e.potencia_normalizada) > (max?.potencia_normalizada || 0) ? e : max), null),
    tss: realizados.reduce((max, e) => (Number(e.tss) > (max?.tss || 0) ? e : max), null)
  }

  const hoyStr = new Date().toISOString().slice(0, 10)
  const desde400 = new Date(); desde400.setDate(desde400.getDate() - 400)
  const serieCTL = calcularCargaDiaria(construirSerieDiaria(realizados, desde400.toISOString().slice(0, 10), hoyStr))
  const ctlActual = serieCTL[serieCTL.length - 1]?.ctl ?? 0
  const nombreCompetencia = (id) => competencias.find((c) => c.id === id)?.nombre || null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <IconoInsignia Icono={Activity} />
        <div>
          <h1 className="text-2xl font-bold">Entrenamientos</h1>
          <p className="text-ink-muted text-sm mt-1">Registro, planificación y análisis</p>
        </div>
      </div>

      <div className="flex gap-1 bg-asphalt-950 p-1 rounded-lg overflow-x-auto">
        {[['temporada', 'Mesociclo'], ['planes', 'Planes'], ['registro', 'Registro'], ['ftp', 'FTP y zonas'], ['records', 'Récords']].map(([id, label]) => (
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
            <input ref={inputArchivoRef} type="file" className="hidden" onChange={manejarArchivo} />
            <button onClick={() => { setValoresImportados(null); setEditandoId(null); setMostrarForm((v) => !v) }} className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg hover:brightness-95">
              + Nuevo
            </button>
          </div>

          {errorImport && <div className="card border-alert-red text-sm text-alert-red">{errorImport}</div>}

          {mostrarForm && (
            <FormEntrenamiento bicicletas={bicicletas} planes={planes} valoresIniciales={valoresImportados} onGuardar={crear} onCancelar={() => { setMostrarForm(false); setValoresImportados(null) }} />
          )}

          {cargando ? (
            <SkeletonList rows={4} />
          ) : porDia.length === 0 ? (
            <EstadoVacio
              Icono={Activity}
              titulo="Sin entrenamientos registrados"
              descripcion="Importá un archivo de tu Garmin o cargá uno a mano con '+ Nuevo'."
            />
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
                          <FormEntrenamiento key={e.id} bicicletas={bicicletas} planes={planes} valoresIniciales={valoresEdicion && valoresEdicion.id === e.id ? valoresEdicion : e} onGuardar={(datos) => actualizar(e.id, datos)} onCancelar={() => { setEditandoId(null); setValoresEdicion(null) }} />
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
                            {(feedbackPorEntreno[e.id] || []).length > 0 && (
                              <div className="flex flex-col gap-1 mt-1.5 ml-4">
                                {feedbackPorEntreno[e.id].map((c) => (
                                  <p key={c.id} className="text-ink-muted text-xs">
                                    <span className="text-hiviz">Feedback de tu entrenador:</span> {c.comentario}
                                  </p>
                                ))}
                              </div>
                            )}
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
                                  <button onClick={() => { setMostrarForm(false); setValoresEdicion({ ...e, estado: 'realizado' }); setEditandoId(e.id) }} className="text-hiviz text-xs border border-asphalt-700 rounded-lg px-2 py-1">Cargar datos</button>
                                )}
                                {e.estado === 'realizado' && (
                                  <button onClick={() => exportarGPX(e)} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">GPX</button>
                                )}
                                <button onClick={() => { setMostrarForm(false); setValoresEdicion(null); setEditandoId(e.id) }} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Editar</button>
                                <button onClick={async () => { if (await confirmar('¿Borrar este entrenamiento?', { destructivo: true })) eliminar(e.id) }} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
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
              {ftpActual.fc_maxima && (
                <div className="card">
                  <span className="label-eyebrow">FC máxima registrada</span>
                  <p className="readout text-2xl font-bold mt-1">{ftpActual.fc_maxima} <span className="text-sm text-ink-muted">bpm</span></p>
                  <p className="text-ink-faint text-xs mt-1">Dato informativo — las zonas de FC se calculan sobre tu FC umbral</p>
                </div>
              )}
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
                      <p className="text-sm font-medium">{h.ftp_watts} W {h.fc_umbral ? `· ${h.fc_umbral} bpm umbral` : ''}{h.fc_maxima ? ` · ${h.fc_maxima} bpm máx` : ''}</p>
                      <p className="text-ink-muted text-xs">{h.fecha}{h.tipo_test ? ` · ${TIPOS_TEST_FTP.find((t) => t.id === h.tipo_test)?.label || h.tipo_test}` : ''}</p>
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

      {vista === 'temporada' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => { setMesoEditando(null); setFormMesoOpen((v) => !v) }}>+ Mesociclo</button>
          </div>
          {formMesoOpen && <FormMesociclo competencias={competencias} onGuardar={crearMesociclo} onCancelar={() => setFormMesoOpen(false)} />}

          <div className="card">
            <span className="label-eyebrow">CTL actual</span>
            <p className="readout text-2xl font-bold text-hiviz mt-1">{ctlActual}</p>
          </div>

          {mesociclos.length === 0 ? (
            <EstadoVacio
              Icono={Activity}
              titulo="Sin mesociclos todavía"
              descripcion="Armá tu bloque de 4 semanas: base, construcción, específico, pico o transición."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {mesociclos.map((m) =>
                mesoEditando === m.id ? (
                  <FormMesociclo key={m.id} valoresIniciales={m} competencias={competencias} onGuardar={(datos) => actualizarMesociclo(m.id, datos)} onCancelar={() => setMesoEditando(null)} />
                ) : (
                  (() => {
                    const tipoInfo = TIPOS_MESOCICLO.find((t) => t.id === m.tipo) || TIPOS_MESOCICLO[0]
                    const enCurso = hoyStr >= m.fecha_inicio && hoyStr <= m.fecha_fin
                    const totalDias = (new Date(m.fecha_fin) - new Date(m.fecha_inicio)) / 86400000 + 1
                    const diasPasados = Math.max(0, Math.min(totalDias, (new Date(hoyStr) - new Date(m.fecha_inicio)) / 86400000 + 1))
                    const pctTiempo = Math.round((diasPasados / totalDias) * 100)
                    const sesionesMeso = lista.filter((e) => e.mesociclo_id === m.id).sort((a, b) => a.fecha.localeCompare(b.fecha))
                    const finalizado = !enCurso && hoyStr > m.fecha_fin
                    return (
                      <div key={m.id} className="card" style={enCurso ? { borderColor: tipoInfo.color } : undefined}>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full inline-block" style={{ background: tipoInfo.color }} />
                              <p className="font-semibold text-sm">{m.nombre}</p>
                              {enCurso && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-hiviz text-asphalt-950">EN CURSO</span>}
                              {finalizado && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-asphalt-700 text-ink-muted">FINALIZADO</span>}
                            </div>
                            <p className="text-ink-muted text-xs mt-0.5">
                              {tipoInfo.label} · {m.fecha_inicio} a {m.fecha_fin}
                              {m.competencia_id && nombreCompetencia(m.competencia_id) && ` · → ${nombreCompetencia(m.competencia_id)}`}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => { setFormMesoOpen(false); setMesoEditando(m.id) }} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Editar</button>
                            <button onClick={() => eliminarMesociclo(m.id)} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
                          </div>
                        </div>
                        {enCurso && (
                          <div className="w-full h-1.5 bg-asphalt-700 rounded-full mt-2.5 overflow-hidden">
                            <div className="h-full" style={{ width: `${pctTiempo}%`, background: tipoInfo.color }} />
                          </div>
                        )}
                        {m.ctl_objetivo && (
                          <p className="text-ink-muted text-xs mt-2">
                            CTL objetivo: <span className="text-ink font-semibold">{m.ctl_objetivo}</span>
                            {enCurso && <span className={ctlActual >= m.ctl_objetivo ? 'text-hiviz' : 'text-alert-amber'}> · actual {ctlActual} ({ctlActual >= m.ctl_objetivo ? 'cumplido' : `faltan ${(m.ctl_objetivo - ctlActual).toFixed(0)}`})</span>}
                          </p>
                        )}
                        {m.notas && <p className="text-ink-faint text-xs mt-1.5">{m.notas}</p>}

                        {finalizado && (
                          <ResumenMesociclo m={m} sesionesMeso={sesionesMeso} serieCTL={serieCTL} ftpHistorial={ftpHistorial} />
                        )}

                        {sesionesMeso.length > 0 && (
                          <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-asphalt-700">
                            {sesionesMeso.map((s) =>
                              editandoId === s.id ? (
                                <FormEntrenamiento
                                  key={s.id}
                                  bicicletas={bicicletas}
                                  planes={planes}
                                  valoresIniciales={valoresEdicion && valoresEdicion.id === s.id ? valoresEdicion : s}
                                  onGuardar={(datos) => actualizar(s.id, datos)}
                                  onCancelar={() => { setEditandoId(null); setValoresEdicion(null) }}
                                />
                              ) : (
                                <SesionMesocicloRow
                                  key={s.id}
                                  s={s}
                                  onCargarDatos={() => { setMostrarForm(false); setValoresEdicion({ ...s, estado: 'realizado' }); setEditandoId(s.id) }}
                                  onDescargarReloj={() => descargarParaReloj(s)}
                                />
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()
                )
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <h2 className="text-sm font-semibold">Objetivos</h2>
            <button className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg" onClick={() => setFormObjetivoOpen((v) => !v)}>+ Objetivo</button>
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
        </div>
      )}


      {vista === 'records' && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="card border-hiviz">
              <span className="label-eyebrow">FTP actual</span>
              <p className="readout text-2xl font-bold text-hiviz mt-1">{ftpActual ? `${ftpActual.ftp_watts} W` : '—'}</p>
              {ftpActual && <p className="text-ink-faint text-xs mt-0.5">{ftpActual.fecha}</p>}
            </div>
            <div className="card border-hiviz">
              <span className="label-eyebrow">Potencia media pico</span>
              <p className="readout text-2xl font-bold text-hiviz mt-1">{records.potencia ? `${records.potencia.potencia_avg} W` : '—'}</p>
              {records.potencia && <p className="text-ink-faint text-xs mt-0.5">{records.potencia.fecha}</p>}
            </div>
            <div className="card border-hiviz">
              <span className="label-eyebrow">NP más alta</span>
              <p className="readout text-2xl font-bold text-hiviz mt-1">{records.normalizada ? `${records.normalizada.potencia_normalizada} W` : '—'}</p>
              {records.normalizada && <p className="text-ink-faint text-xs mt-0.5">{records.normalizada.fecha}</p>}
            </div>
          </div>
          <RecordCard label="Salida más larga" item={records.km} valor={records.km ? `${records.km.km} km` : null} />
          <RecordCard label="Mayor desnivel" item={records.desnivel} valor={records.desnivel ? `${records.desnivel.desnivel} m` : null} />
          <RecordCard label="Mayor TSS en una salida" item={records.tss} valor={records.tss ? `${records.tss.tss} TSS` : null} />

          {registrosPotencia.length > 0 && (
            <div className="card mt-2">
              <span className="label-eyebrow">Curva de potencia</span>
              <p className="text-ink-faint text-xs mt-1 mb-2">Mejor promedio sostenido por duración, de todas tus salidas importadas.</p>
              <div className="-ml-4">
                <ReResponsiveContainer width="100%" height={200}>
                  <ReLineChart data={registrosPotencia.map((r) => ({ ...r, etiqueta: etiquetaDuracion(r.duracion_seg) }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <ReCartesianGrid stroke="#262A33" vertical={false} />
                    <ReXAxis dataKey="etiqueta" tick={{ fill: '#8A8F9C', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#262A33' }} />
                    <ReYAxis tick={{ fill: '#8A8F9C', fontSize: 10 }} tickLine={false} axisLine={false} width={34} />
                    <ReTooltip contentStyle={{ background: '#1C1F26', border: '1px solid #262A33', borderRadius: 8, fontSize: 12 }} />
                    <ReLine type="monotone" dataKey="watts" stroke="#EB642A" strokeWidth={2} dot={{ r: 3 }} name="W" />
                  </ReLineChart>
                </ReResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
                {registrosPotencia.map((r) => (
                  <div key={r.duracion_seg} className="text-center">
                    <p className="readout text-sm font-bold text-hiviz">{r.watts}W</p>
                    <p className="text-ink-faint text-[10px] uppercase">{etiquetaDuracion(r.duracion_seg)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
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
    duracion_min: '', km: '', desnivel: '', potencia_avg: '', potencia_normalizada: '', fc_avg: '', rpe: '', comentarios: '',
    plan_id: '', estado: 'realizado', es_clave: false,
    calorias: '', cadencia_avg: '', cadencia_max: '', descenso: '', altura_min: '', altura_max: '',
    temperatura_avg: '', temperatura_min: '', temperatura_max: '', velocidad_avg: '', velocidad_max: '',
    potencia_max: '', potencia_20min: '', trabajo_kj: '', tiempo_movimiento_min: '',
    ...valoresIniciales
  })
  const [masMetricas, setMasMetricas] = useState(false)
  function campo(k) { return { value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) } }
  const esRodillo = form.tipo === 'Rodillo'
  const numOrNull = (v) => (v === '' || v == null ? null : Number(v))

  return (
    <form className="card grid grid-cols-1 sm:grid-cols-3 gap-3" onSubmit={(e) => {
      e.preventDefault()
      if (!esRodillo && !form.bicicleta_id) { alertar('Elegí con qué bici hiciste este entrenamiento (o marcá Rodillo si fue indoor).'); return }
      onGuardar({
        ...form,
        bicicleta_id: form.bicicleta_id || null,
        plan_id: form.plan_id || null,
        duracion_min: numOrNull(form.duracion_min),
        km: numOrNull(form.km),
        desnivel: numOrNull(form.desnivel),
        potencia_avg: numOrNull(form.potencia_avg),
        potencia_normalizada: numOrNull(form.potencia_normalizada),
        fc_avg: numOrNull(form.fc_avg),
        rpe: numOrNull(form.rpe),
        calorias: numOrNull(form.calorias),
        cadencia_avg: numOrNull(form.cadencia_avg),
        cadencia_max: numOrNull(form.cadencia_max),
        descenso: numOrNull(form.descenso),
        altura_min: numOrNull(form.altura_min),
        altura_max: numOrNull(form.altura_max),
        temperatura_avg: numOrNull(form.temperatura_avg),
        temperatura_min: numOrNull(form.temperatura_min),
        temperatura_max: numOrNull(form.temperatura_max),
        velocidad_avg: numOrNull(form.velocidad_avg),
        velocidad_max: numOrNull(form.velocidad_max),
        potencia_max: numOrNull(form.potencia_max),
        potencia_20min: numOrNull(form.potencia_20min),
        trabajo_kj: numOrNull(form.trabajo_kj),
        tiempo_movimiento_min: numOrNull(form.tiempo_movimiento_min)
      })
    }}>
      {(form.estilo_sesion || form.zona_objetivo || form.watts_kg_objetivo || form.series_objetivo || form.tiempo_trabajo_objetivo) && (
        <div className="sm:col-span-3 bg-asphalt-900 border border-hiviz-dim rounded-lg px-3 py-2 text-xs text-ink-muted">
          <span className="text-hiviz font-semibold">Prescrito por tu entrenador:</span>{' '}
          {[
            form.estilo_sesion,
            form.zona_objetivo,
            form.watts_kg_objetivo && `${form.watts_kg_objetivo} W/kg`,
            form.series_objetivo && `${form.series_objetivo} series`,
            form.repeticiones_objetivo && `${form.repeticiones_objetivo} reps`,
            form.tiempo_trabajo_objetivo && `trabajo ${form.tiempo_trabajo_objetivo}`,
            form.pausa_objetivo && `pausa ${form.pausa_objetivo}`
          ].filter(Boolean).join(' · ')}
        </div>
      )}
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
      <Campo label="Potencia normalizada / NP (W)" type="number" {...campo('potencia_normalizada')} />
      <Campo label="FC media" type="number" {...campo('fc_avg')} />
      <Campo label="RPE (1-10)" type="number" min="1" max="10" {...campo('rpe')} />

      <div className="sm:col-span-3">
        <button type="button" onClick={() => setMasMetricas((v) => !v)} className="text-hiviz text-xs font-semibold">
          {masMetricas ? 'Ocultar más métricas ▲' : 'Más métricas (opcional) ▼'}
        </button>
      </div>

      {masMetricas && (
        <>
          <Campo label="Calorías" type="number" {...campo('calorias')} />
          <Campo label="Cadencia media (rpm)" type="number" {...campo('cadencia_avg')} />
          <Campo label="Cadencia máxima (rpm)" type="number" {...campo('cadencia_max')} />
          <Campo label="Descenso (m)" type="number" {...campo('descenso')} />
          <Campo label="Altura mínima (m)" type="number" {...campo('altura_min')} />
          <Campo label="Altura máxima (m)" type="number" {...campo('altura_max')} />
          <Campo label="Temperatura media (°C)" type="number" step="0.1" {...campo('temperatura_avg')} />
          <Campo label="Temperatura mínima (°C)" type="number" step="0.1" {...campo('temperatura_min')} />
          <Campo label="Temperatura máxima (°C)" type="number" step="0.1" {...campo('temperatura_max')} />
          <Campo label="Velocidad media (km/h)" type="number" step="0.1" {...campo('velocidad_avg')} />
          <Campo label="Velocidad máxima (km/h)" type="number" step="0.1" {...campo('velocidad_max')} />
          <Campo label="Potencia máxima (W)" type="number" {...campo('potencia_max')} />
          <Campo label="Pot. media máx. 20min (W)" type="number" {...campo('potencia_20min')} />
          <Campo label="Trabajo (kJ)" type="number" {...campo('trabajo_kj')} />
          <Campo label="Tiempo en movimiento (min)" type="number" {...campo('tiempo_movimiento_min')} />
        </>
      )}

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

function crearSemanaVacia(numero) {
  return {
    semana: numero,
    dias: DIAS_SEMANA.map((d) => ({
      dia: d.id, activo: false, tipo: 'Ruta', duracion_min: '', descripcion: '', es_clave: false,
      estilo_sesion: '', zona_objetivo: '', watts_kg_objetivo: '', series_objetivo: '',
      repeticiones_objetivo: '', tiempo_trabajo_objetivo: '', pausa_objetivo: ''
    }))
  }
}

function FormMesociclo({ onGuardar, onCancelar, valoresIniciales, competencias = [] }) {
  const esEdicion = !!valoresIniciales
  const [form, setForm] = useState({
    nombre: '', tipo: 'base', fecha_inicio: new Date().toISOString().slice(0, 10),
    competencia_id: '', ctl_objetivo: '', notas: '', ...valoresIniciales
  })
  const [semanas, setSemanas] = useState(
    valoresIniciales?.semanas?.length ? valoresIniciales.semanas : [1, 2, 3, 4].map(crearSemanaVacia)
  )
  const [parametrosAbiertos, setParametrosAbiertos] = useState({})
  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })
  function toggleParametros(key) {
    setParametrosAbiertos((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function actualizarDia(semanaIdx, diaId, cambios) {
    setSemanas((prev) => prev.map((s, i) => (
      i !== semanaIdx ? s : { ...s, dias: s.dias.map((d) => (d.dia === diaId ? { ...d, ...cambios } : d)) }
    )))
  }

  return (
    <form className="card flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault()
      const lunes = lunesDeSemana(form.fecha_inicio)
      const fechaFin = new Date(lunes); fechaFin.setDate(fechaFin.getDate() + 27)
      onGuardar({
        ...form,
        fecha_inicio: lunes.toISOString().slice(0, 10),
        fecha_fin: fechaFin.toISOString().slice(0, 10),
        competencia_id: form.competencia_id || null,
        ctl_objetivo: form.ctl_objetivo === '' ? null : Number(form.ctl_objetivo),
        semanas
      })
    }}>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Nombre</span>
        <input {...campo('nombre')} required placeholder="Base invierno / Pico pre-fondo" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Tipo</span>
          <select {...campo('tipo')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
            {TIPOS_MESOCICLO.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select></label>
        <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Semana 1 empieza (lunes más cercano)</span>
          <input type="date" {...campo('fecha_inicio')} required disabled={esEdicion} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink disabled:opacity-50" /></label>
      </div>
      {competencias.length > 0 && (
        <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Competencia objetivo (opcional)</span>
          <select {...campo('competencia_id')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
            <option value="">—</option>
            {competencias.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.fecha})</option>)}
          </select></label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">CTL objetivo (opcional)</span>
          <input type="number" {...campo('ctl_objetivo')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      </div>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Notas</span>
        <input {...campo('notas')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>

      {esEdicion ? (
        <p className="text-ink-faint text-xs">Para cambiar el cronograma de sesiones, borrá este mesociclo y creá uno nuevo.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <span className="label-eyebrow">Cronograma — 4 semanas</span>
          {semanas.map((semana, si) => (
            <div key={si} className="border border-asphalt-700 rounded-lg p-2.5">
              <p className="text-sm font-semibold mb-2">Semana {semana.semana}</p>
              <div className="flex flex-col gap-2">
                {DIAS_SEMANA.map((diaInfo) => {
                  const d = semana.dias.find((x) => x.dia === diaInfo.id)
                  return (
                    <div key={diaInfo.id} className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={!!d.activo} onChange={(e) => actualizarDia(si, diaInfo.id, { activo: e.target.checked })} />
                        <span className="font-medium w-8">{diaInfo.label}</span>
                        {d.activo && (
                          <select value={d.tipo} onChange={(e) => actualizarDia(si, diaInfo.id, { tipo: e.target.value })} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1 text-ink text-xs flex-1">
                            {TIPOS.map((t) => <option key={t}>{t}</option>)}
                          </select>
                        )}
                      </label>
                      {d.activo && (
                        <div className="flex gap-1.5 pl-9">
                          <input type="number" value={d.duracion_min} onChange={(e) => actualizarDia(si, diaInfo.id, { duracion_min: e.target.value })} placeholder="Min" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1 text-ink text-xs w-16" />
                          <input value={d.descripcion} onChange={(e) => actualizarDia(si, diaInfo.id, { descripcion: e.target.value })} placeholder="Detalle" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1 text-ink text-xs flex-1" />
                          <label className="flex items-center gap-1 text-xs text-ink-muted whitespace-nowrap">
                            <input type="checkbox" checked={!!d.es_clave} onChange={(e) => actualizarDia(si, diaInfo.id, { es_clave: e.target.checked })} />
                            ★ clave
                          </label>
                        </div>
                      )}
                      {d.activo && (
                        <div className="pl-9">
                          <button type="button" onClick={() => toggleParametros(`${si}_${diaInfo.id}`)} className="text-hiviz text-[11px] font-semibold">
                            {parametrosAbiertos[`${si}_${diaInfo.id}`] ? 'Ocultar parámetros ▲' : '+ Parámetros (zona, W/kg, series...) ▼'}
                          </button>
                          {parametrosAbiertos[`${si}_${diaInfo.id}`] && (
                            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                              <select value={d.estilo_sesion} onChange={(e) => actualizarDia(si, diaInfo.id, { estilo_sesion: e.target.value })} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1 text-ink text-xs col-span-2">
                                <option value="">Estilo de sesión (opcional)</option>
                                {ESTILOS_SESION.map((es) => <option key={es}>{es}</option>)}
                              </select>
                              <select value={d.zona_objetivo} onChange={(e) => actualizarDia(si, diaInfo.id, { zona_objetivo: e.target.value })} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1 text-ink text-xs">
                                <option value="">Zona objetivo</option>
                                {ZONAS_POTENCIA.map((z) => <option key={z.zona} value={z.zona}>{z.zona} — {z.nombre}</option>)}
                              </select>
                              <input type="number" step="0.1" value={d.watts_kg_objetivo} onChange={(e) => actualizarDia(si, diaInfo.id, { watts_kg_objetivo: e.target.value })} placeholder="W/kg objetivo" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1 text-ink text-xs" />
                              <input type="number" value={d.series_objetivo} onChange={(e) => actualizarDia(si, diaInfo.id, { series_objetivo: e.target.value })} placeholder="Series" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1 text-ink text-xs" />
                              <input type="number" value={d.repeticiones_objetivo} onChange={(e) => actualizarDia(si, diaInfo.id, { repeticiones_objetivo: e.target.value })} placeholder="Repeticiones" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1 text-ink text-xs" />
                              <input value={d.tiempo_trabajo_objetivo} onChange={(e) => actualizarDia(si, diaInfo.id, { tiempo_trabajo_objetivo: e.target.value })} placeholder="Tiempo de trabajo (ej: 8min)" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1 text-ink text-xs" />
                              <input value={d.pausa_objetivo} onChange={(e) => actualizarDia(si, diaInfo.id, { pausa_objetivo: e.target.value })} placeholder="Pausa (ej: 3min)" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1 text-ink text-xs" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button>
      </div>
    </form>
  )
}

function SesionMesocicloRow({ s, onCargarDatos, onDescargarReloj }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        {s.es_clave && <span className="text-hiviz text-xs" title="Sesión clave">★</span>}
        <div>
          <p className="text-xs font-medium">{s.fecha} · {s.tipo}{s.comentarios ? ` — ${s.comentarios}` : ''}</p>
          {s.estado === 'realizado' && (
            <p className="text-ink-faint text-[11px]">{s.km ? `${s.km} km · ` : ''}{s.duracion_min ? `${s.duracion_min} min · ` : ''}{s.tss ? `${s.tss} TSS` : ''}</p>
          )}
        </div>
      </div>
      {s.estado === 'pendiente' ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onDescargarReloj} className="text-ink-muted text-[11px] whitespace-nowrap">⌚ Reloj</button>
          <button onClick={onCargarDatos} className="text-hiviz text-[11px] font-semibold whitespace-nowrap">Cargar datos</button>
        </div>
      ) : (
        <span className="text-hiviz text-[11px]">✓ hecha</span>
      )}
    </div>
  )
}

function FormFTP({ onGuardar, onCancelar, valoresIniciales }) {
  const [form, setForm] = useState({ fecha: new Date().toISOString().slice(0, 10), ftp_watts: '', fc_umbral: '', fc_maxima: '', tipo_test: 'ftp', fuente: 'test', notas: '', ...valoresIniciales })
  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })
  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onGuardar({ ...form, ftp_watts: Number(form.ftp_watts), fc_umbral: form.fc_umbral ? Number(form.fc_umbral) : null, fc_maxima: form.fc_maxima ? Number(form.fc_maxima) : null }) }}>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fecha</span>
        <input type="date" {...campo('fecha')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Tipo de test</span>
        <select {...campo('tipo_test')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          {TIPOS_TEST_FTP.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fuente</span>
        <select {...campo('fuente')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          <option value="test">Test</option><option value="estimado">Estimado</option>
        </select></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">FTP (W)</span>
        <input type="number" {...campo('ftp_watts')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">FC umbral (bpm)</span>
        <input type="number" {...campo('fc_umbral')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">FC máxima (bpm) — informativo</span>
        <input type="number" {...campo('fc_maxima')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="col-span-2 flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button>
      </div>
    </form>
  )
}


function ftpMasCercano(ftpHistorial, fechaLimite) {
  const candidatos = ftpHistorial.filter((h) => h.fecha <= fechaLimite)
  if (candidatos.length === 0) return null
  return candidatos[candidatos.length - 1]
}

function ResumenMesociclo({ m, sesionesMeso, serieCTL, ftpHistorial }) {
  const ctlCierre = serieCTL.find((s) => s.fecha === m.fecha_fin)?.ctl ?? null

  const realizadas = sesionesMeso.filter((s) => s.estado === 'realizado')
  const totalSesiones = sesionesMeso.length
  const pctAdherencia = totalSesiones > 0 ? Math.round((realizadas.length / totalSesiones) * 100) : null

  const clave = sesionesMeso.filter((s) => s.es_clave)
  const claveHechas = clave.filter((s) => s.estado === 'realizado')

  const ftpInicio = ftpMasCercano(ftpHistorial, m.fecha_inicio)
  const ftpFin = ftpMasCercano(ftpHistorial, m.fecha_fin)
  const huboCambioFtp = ftpInicio && ftpFin && ftpInicio.id !== ftpFin.id

  return (
    <div className="mt-3 pt-3 border-t border-asphalt-700">
      <span className="label-eyebrow">Resumen del bloque</span>
      <div className="flex flex-col gap-1.5 mt-2">
        {m.ctl_objetivo && (
          <p className="text-xs text-ink-muted">
            CTL: apuntabas a <span className="text-ink font-semibold">{m.ctl_objetivo}</span>
            {ctlCierre != null && (
              <> · llegaste a <span className={ctlCierre >= m.ctl_objetivo ? 'text-hiviz font-semibold' : 'text-alert-amber font-semibold'}>{ctlCierre.toFixed(0)}</span></>
            )}
          </p>
        )}
        {totalSesiones > 0 && (
          <p className="text-xs text-ink-muted">
            Adherencia: <span className="text-ink font-semibold">{realizadas.length}/{totalSesiones} sesiones</span>
            {pctAdherencia != null && <span className="text-ink-faint"> ({pctAdherencia}%)</span>}
          </p>
        )}
        {clave.length > 0 && (
          <p className="text-xs text-ink-muted">
            Sesiones clave: <span className="text-ink font-semibold">{claveHechas.length} de {clave.length}</span>
            {claveHechas.length === clave.length ? ' ✓' : ''}
          </p>
        )}
        {huboCambioFtp && (
          <p className="text-xs text-ink-muted">
            FTP: {ftpInicio.ftp_watts}W → <span className="text-hiviz font-semibold">{ftpFin.ftp_watts}W</span>
            <span className={ftpFin.ftp_watts >= ftpInicio.ftp_watts ? 'text-hiviz' : 'text-alert-amber'}> ({ftpFin.ftp_watts >= ftpInicio.ftp_watts ? '+' : ''}{ftpFin.ftp_watts - ftpInicio.ftp_watts}W)</span>
          </p>
        )}
      </div>
    </div>
  )
}
