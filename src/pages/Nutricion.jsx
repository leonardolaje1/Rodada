import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { SkeletonList } from '../components/Skeleton'
import { buscarAlimentosPorTexto, buscarAlimentoPorCodigoBarras } from '../lib/openFoodFacts'
import { buscarAlimentosUSDA } from '../lib/usdaFoodData'
import { buscarAlimentosLocal, BASE_ALIMENTOS } from '../lib/baseAlimentos'
import { PLATOS_PRECARGADOS } from '../lib/platosPrecargados'
import EscanerCodigoBarras from '../components/EscanerCodigoBarras'
import IconoInsignia from '../components/IconoInsignia'
import { Apple, ChevronLeft } from 'lucide-react'
import { NIVELES_ACTIVIDAD, calcularBMR, calcularTDEE, calcularEdad, calcularTDEEDinamico } from '../lib/tdee'
import { evaluarDeficitNutricional } from '../lib/nutricionAlertas'
import { useToast } from '../lib/ToastContext'
import { useConfirm } from '../lib/ConfirmContext'
import { aFechaLocal, hoyLocal } from '../lib/fechas'

const TIPOS_COMIDA = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Snack', 'Intra-entreno']
const TIPOS_SUPLEMENTO = ['Natural', 'Químico']
const BEBIDAS = ['Agua', 'Isotónica', 'Café', 'Té', 'Otra']
const METRICAS_ANTROPOMETRIA = [
  { id: 'grasa_corporal_pct', label: '% Grasa corporal', color: '#F14A4A' },
  { id: 'masa_muscular_pct', label: '% Masa muscular', color: '#4A9EFF' },
  { id: 'perimetro_cintura', label: 'Cintura (cm)', color: '#4A9EFF' },
  { id: 'perimetro_cadera', label: 'Cadera (cm)', color: '#F5A623' },
  { id: 'perimetro_brazo', label: 'Brazo (cm)', color: '#C34AF1' },
  { id: 'perimetro_pierna', label: 'Pierna (cm)', color: '#7A4AF1' }
]
const TABS = [['hoy', 'Hoy'], ['comidas', 'Comidas'], ['hidratacion', 'Agua'], ['composicion', 'Composición'], ['mas', 'Más']]
const OPCIONES_FAB_DEFAULT = [
  { id: 'comida', label: 'Comida', icono: '🍽️' },
  { id: 'agua', label: 'Agua (+250 ml)', icono: '💧' },
  { id: 'peso', label: 'Peso', icono: '⚖️' }
]
const OPCIONES_FAB_COMPOSICION = [
  { id: 'peso', label: 'Peso', icono: '⚖️' },
  { id: 'medidas', label: 'Medidas (músculo, grasa, perímetros)', icono: '📏' }
]

function agruparPorFecha(items) {
  const grupos = {}
  for (const item of items) { if (!grupos[item.fecha]) grupos[item.fecha] = []; grupos[item.fecha].push(item) }
  return Object.entries(grupos).sort((a, b) => b[0].localeCompare(a[0]))
}
function fmtFecha(f) { const [, m, d] = f.split('-'); return `${d}/${m}` }

function round1(n) { return Math.round(n * 10) / 10 }
function nuevoIdItem() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

// Resuelve un ingrediente de un plato precargado (nombre + gramos) contra la
// base local de alimentos y lo escala a un ítem listo para sumar al plato.
function itemDesdeAlimento(nombreAlimento, gramos) {
  const alimento = BASE_ALIMENTOS.find((a) => a.nombre === nombreAlimento)
  if (!alimento) return null
  const escala = gramos / 100
  return {
    id: nuevoIdItem(),
    nombre: `${alimento.nombre} — ${gramos}g`,
    kcal: Math.round(alimento.kcal100g * escala),
    proteinas: round1(alimento.proteinas100g * escala),
    carbohidratos: round1(alimento.carbohidratos100g * escala),
    grasas: round1(alimento.grasas100g * escala),
  }
}
function itemsDesdePlato(plato) {
  return plato.ingredientes.map((i) => itemDesdeAlimento(i.alimento, i.gramos)).filter(Boolean)
}

// Alimentos recientes: mira el historial de comidas ya guardadas (más nuevo
// primero) y devuelve los últimos alimentos distintos de la base local, para
// ofrecerlos como acceso directo de 1 tap al registrar.
function itemsRecientesUnicos(historial, limite = 8) {
  const vistos = new Set()
  const out = []
  for (const c of historial || []) {
    for (const it of (c.items || [])) {
      const base = (it.nombre || '').split(' — ')[0]
      if (!base || vistos.has(base)) continue
      const alimento = BASE_ALIMENTOS.find((a) => a.nombre === base)
      if (!alimento) continue
      vistos.add(base)
      out.push(alimento)
      if (out.length >= limite) return out
    }
  }
  return out
}

export default function Nutricion() {
  const toast = useToast()
  const { confirmar, alertar } = useConfirm()

  const [tab, setTab] = useState('hoy')
  const [subMas, setSubMas] = useState(null) // null = lista | 'planes' | 'suplementos' | 'documentos'
  const [fabAbierto, setFabAbierto] = useState(false)

  const [perfil, setPerfil] = useState({ peso: '', altura: '', edad: '', sexo: 'M', nivel_actividad: 'moderado' })
  const [comidas, setComidas] = useState([])
  const [hidratacion, setHidratacion] = useState([])
  const [suplementos, setSuplementos] = useState([])
  const [pesoHistorial, setPesoHistorial] = useState([])
  const [antropometria, setAntropometria] = useState([])
  const [planes, setPlanes] = useState([])
  const [formComida, setFormComida] = useState(false)
  const [comidaEditando, setComidaEditando] = useState(null)
  const [formSuplemento, setFormSuplemento] = useState(false)
  const [formPeso, setFormPeso] = useState(false)
  const [pesoEditando, setPesoEditando] = useState(null)
  const [formAntropo, setFormAntropo] = useState(false)
  const [antropoEditando, setAntropoEditando] = useState(null)
  const [formBebidaOpen, setFormBebidaOpen] = useState(false)
  const [fechaHidratacion, setFechaHidratacion] = useState(hoyLocal())
  const [editandoHidratacionId, setEditandoHidratacionId] = useState(null)
  const [metricaGrafico, setMetricaGrafico] = useState('grasa_corporal_pct')
  const [formPlanOpen, setFormPlanOpen] = useState(false)
  const [planEditando, setPlanEditando] = useState(null)
  const [registrandoComida, setRegistrandoComida] = useState(null)
  const [documentos, setDocumentos] = useState([])
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)
  const [errorArchivo, setErrorArchivo] = useState('')
  const [cargando, setCargando] = useState(true)
  const [editarDatosFisicos, setEditarDatosFisicos] = useState(false)
  const [entrenamientosRecientes, setEntrenamientosRecientes] = useState([])

  async function cargar() {
    const desde6 = new Date()
    desde6.setDate(desde6.getDate() - 6)
    const [{ data: p }, { data: cm }, { data: h }, { data: s }, { data: pesos }, { data: antro }, { data: pl }, { data: docs }, { data: ents }] = await Promise.all([
      supabase.from('perfil_nutricional').select('*').maybeSingle(),
      supabase.from('comidas').select('*').order('fecha', { ascending: false }).limit(100),
      supabase.from('hidratacion').select('*').order('fecha', { ascending: false }).limit(60),
      supabase.from('suplementos').select('*').eq('activo', true),
      supabase.from('peso_historial').select('*').order('fecha', { ascending: true }),
      supabase.from('antropometria').select('*').order('fecha', { ascending: false }),
      supabase.from('planes_nutricion').select('*').eq('activo', true).order('created_at', { ascending: true }),
      supabase.from('documentos_nutricion').select('*').order('created_at', { ascending: false }),
      supabase.from('entrenamientos').select('fecha, calorias').gte('fecha', aFechaLocal(desde6))
    ])
    if (p) setPerfil(p)
    setComidas(cm || [])
    setHidratacion(h || [])
    setSuplementos(s || [])
    setPesoHistorial(pesos || [])
    setAntropometria(antro || [])
    setPlanes(pl || [])
    setDocumentos(docs || [])
    setEntrenamientosRecientes(ents || [])
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  const [searchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('nuevo') === '1') {
      setTab('comidas')
      setComidaEditando(null)
      setFormComida(true)
    }
  }, [searchParams])

  async function guardarPerfil(next) {
    setPerfil(next)
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('perfil_nutricional').upsert({ ...next, user_id: userData.user.id })
  }
  async function crearComida(n) {
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('comidas').insert({ ...n, user_id: userData.user.id })
    if (error) { alertar('No se pudo guardar la comida: ' + error.message); return }
    setFormComida(false); setRegistrandoComida(null); cargar(); toast('Comida guardada')
  }
  async function actualizarComida(id, n) {
    const { error } = await supabase.from('comidas').update(n).eq('id', id)
    if (error) { alertar('No se pudo guardar la comida: ' + error.message); return }
    setComidaEditando(null); cargar(); toast('Comida guardada')
  }
  async function eliminarComida(id) { await supabase.from('comidas').delete().eq('id', id); cargar() }

  async function crearPeso(form) {
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('peso_historial').insert({ ...form, user_id: userData.user.id })
    await guardarPerfil({ ...perfil, peso: form.peso })
    setFormPeso(false); cargar()
    toast('Peso guardado')
  }
  async function actualizarPeso(id, form) { await supabase.from('peso_historial').update(form).eq('id', id); setPesoEditando(null); cargar(); toast('Peso guardado') }
  async function eliminarPeso(id) { if (!(await confirmar('¿Borrar este registro de peso?', { destructivo: true }))) return; await supabase.from('peso_historial').delete().eq('id', id); cargar() }

  async function crearAntropo(form) {
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('antropometria').insert({ ...form, user_id: userData.user.id })
    setFormAntropo(false); cargar()
    toast('Registro guardado')
  }
  async function actualizarAntropo(id, form) { await supabase.from('antropometria').update(form).eq('id', id); setAntropoEditando(null); cargar(); toast('Registro guardado') }
  async function eliminarAntropo(id) { if (!(await confirmar('¿Borrar este registro?', { destructivo: true }))) return; await supabase.from('antropometria').delete().eq('id', id); cargar() }
  async function eliminarSuplemento(id) { if (!(await confirmar('¿Borrar este suplemento?', { destructivo: true }))) return; await supabase.from('suplementos').delete().eq('id', id); cargar() }

  async function cargarBebida(bebida, ml, fecha) {
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('hidratacion').insert({ fecha: fecha || fechaHidratacion, ml, bebida, hora: new Date().toTimeString().slice(0, 5), user_id: userData.user.id })
    setFormBebidaOpen(false); cargar()
  }
  async function actualizarHidratacion(id, datos) {
    await supabase.from('hidratacion').update(datos).eq('id', id)
    setEditandoHidratacionId(null); cargar()
  }
  async function eliminarHidratacion(id) {
    if (!(await confirmar('¿Borrar este registro de hidratación?', { destructivo: true }))) return
    await supabase.from('hidratacion').delete().eq('id', id); cargar()
  }

  async function crearPlan(form) {
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('planes_nutricion').insert({ ...form, user_id: userData.user.id })
    if (error) { alertar('No se pudo guardar: ' + error.message); return }
    setFormPlanOpen(false); cargar()
  }
  async function actualizarPlan(id, form) {
    const { error } = await supabase.from('planes_nutricion').update(form).eq('id', id)
    if (error) { alertar('No se pudo guardar: ' + error.message); return }
    setPlanEditando(null); cargar()
  }
  async function borrarPlan(id) {
    if (!(await confirmar('¿Borrar este plan de comidas?', { destructivo: true }))) return
    await supabase.from('planes_nutricion').update({ activo: false }).eq('id', id); cargar()
  }

  async function subirDocumento(file) {
    if (!file) return
    setErrorArchivo('')
    setSubiendoArchivo(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user.id
      const rutaStorage = `${uid}/${Date.now()}-${file.name}`
      const { error: errSubida } = await supabase.storage.from('documentos-nutricion').upload(rutaStorage, file)
      if (errSubida) throw errSubida
      const { error: errFila } = await supabase.from('documentos_nutricion').insert({
        user_id: uid, nombre: file.name, ruta_storage: rutaStorage, tipo_archivo: file.type
      })
      if (errFila) throw errFila
      cargar()
    } catch (err) {
      setErrorArchivo('No se pudo subir el archivo: ' + (err.message || ''))
    } finally {
      setSubiendoArchivo(false)
    }
  }

  async function verDocumento(doc) {
    const { data, error } = await supabase.storage.from('documentos-nutricion').createSignedUrl(doc.ruta_storage, 60)
    if (error) { alertar('No se pudo abrir el archivo: ' + error.message); return }
    window.open(data.signedUrl, '_blank')
  }

  async function borrarDocumento(doc) {
    if (!(await confirmar(`¿Borrar "${doc.nombre}"?`, { destructivo: true }))) return
    await supabase.storage.from('documentos-nutricion').remove([doc.ruta_storage])
    await supabase.from('documentos_nutricion').delete().eq('id', doc.id)
    cargar()
  }

  function registrarDesdeComida(comidaPlan) {
    setRegistrandoComida({
      tipo: comidaPlan.momento, descripcion: comidaPlan.nombre,
      kcal: comidaPlan.kcal_objetivo ?? '', proteinas: comidaPlan.proteinas_objetivo ?? '',
      carbohidratos: '', grasas: ''
    })
  }

  function manejarAccionRapida(accion) {
    setFabAbierto(false)
    if (accion === 'agua') { cargarBebida('Agua', 250, hoyLocal()); return }
    if (accion === 'comida') { setTab('comidas'); setComidaEditando(null); setFormComida(true); return }
    if (accion === 'peso') { setTab('composicion'); setPesoEditando(null); setFormAntropo(false); setFormPeso(true); return }
    if (accion === 'medidas') { setTab('composicion'); setAntropoEditando(null); setFormPeso(false); setFormAntropo(true) }
  }

  const hoy = hoyLocal()
  const comidasHoy = comidas.filter((c) => c.fecha === hoy)
  const kcalHoy = comidasHoy.reduce((a, c) => a + (Number(c.kcal) || 0), 0)
  const proteinasHoy = comidasHoy.reduce((a, c) => a + (Number(c.proteinas) || 0), 0)
  const carbosHoy = comidasHoy.reduce((a, c) => a + (Number(c.carbohidratos) || 0), 0)
  const grasasHoy = comidasHoy.reduce((a, c) => a + (Number(c.grasas) || 0), 0)

  const hidratacionHoy = hidratacion.filter((h) => h.fecha === hoy)
  const mlHoyAgua = hidratacionHoy.filter((h) => (h.bebida || 'Agua') === 'Agua').reduce((a, h) => a + (Number(h.ml) || 0), 0)
  const hidratacionFechaSeleccionada = hidratacion.filter((h) => h.fecha === fechaHidratacion)
  const porBebidaFecha = BEBIDAS.map((b) => ({
    bebida: b,
    ml: hidratacionFechaSeleccionada.filter((h) => (h.bebida || 'Agua') === b).reduce((a, h) => a + (Number(h.ml) || 0), 0)
  })).filter((b) => b.ml > 0)
  const hidratacionPorDia = agruparPorFecha(hidratacion)

  const pesoActual = pesoHistorial[pesoHistorial.length - 1] || null
  const edadCalculada = perfil.fecha_nacimiento ? calcularEdad(perfil.fecha_nacimiento) : perfil.edad
  const perfilEfectivo = { ...perfil, peso: pesoActual?.peso || perfil.peso, edad: edadCalculada }
  const bmr = calcularBMR(perfilEfectivo)
  const tdee = calcularTDEE(perfilEfectivo)
  const comidasPorDia = agruparPorFecha(comidas)

  // Calorías activas reales de hoy (de Entrenamientos) y TDEE ajustado con ese
  // dato — más preciso que el multiplicador fijo de nivel de actividad cuando
  // hay un entrenamiento registrado hoy.
  const caloriasActivasHoy = entrenamientosRecientes
    .filter((e) => e.fecha === hoy)
    .reduce((a, e) => a + (Number(e.calorias) || 0), 0)
  const tdeeDinamicoHoy = calcularTDEEDinamico({ bmr, caloriasActivas: caloriasActivasHoy })
  const tdeeEfectivoHoy = caloriasActivasHoy > 0 && tdeeDinamicoHoy ? tdeeDinamicoHoy : tdee

  const alertasNutricion = evaluarDeficitNutricional({ comidas, tdee, bmr, entrenamientos: entrenamientosRecientes, pesoKg: pesoActual?.peso || perfil?.peso })
  const pesoInicial = pesoHistorial[0] || null
  const diferenciaPeso = pesoActual && pesoInicial && pesoHistorial.length > 1 ? (pesoActual.peso - pesoInicial.peso) : null
  const graficoPeso = pesoHistorial.map((p) => ({ fecha: p.fecha, peso: p.peso }))

  const ultimaComposicion = antropometria[0] || null
  const antropometriaAsc = [...antropometria].reverse()
  const graficoAntropo = antropometriaAsc
    .filter((a) => a[metricaGrafico] != null)
    .map((a) => ({ fecha: a.fecha, valor: a[metricaGrafico] }))
  const metricaActual = METRICAS_ANTROPOMETRIA.find((m) => m.id === metricaGrafico)

  const opcionesFab = tab === 'composicion' ? OPCIONES_FAB_COMPOSICION : OPCIONES_FAB_DEFAULT

  return (
    <div className="flex flex-col gap-6 pb-16">
      <div className="flex items-center gap-3">
        <IconoInsignia Icono={Apple} />
        <div>
          <h1 className="text-2xl font-bold">Nutrición</h1>
          <p className="text-ink-muted text-sm mt-1">Calorías, hidratación y composición corporal</p>
        </div>
      </div>

      <div className="flex gap-1 bg-asphalt-950 p-1 rounded-lg">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setSubMas(null) }} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${tab === id ? 'bg-hiviz text-asphalt-950' : 'text-ink-muted'}`}>{label}</button>
        ))}
      </div>

      {tab === 'hoy' && (
        <div className="flex flex-col gap-3">
          <div className="card">
            <span className="label-eyebrow">Tu gasto calórico (TDEE)</span>
            <label className="flex flex-col gap-1 text-sm mt-3">
              <span className="text-ink-muted text-xs">Nivel de actividad</span>
              <select value={perfil.nivel_actividad} onChange={(e) => guardarPerfil({ ...perfil, nivel_actividad: e.target.value })} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
                {NIVELES_ACTIVIDAD.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
            </label>
            {tdee ? (
              <div className="flex gap-6 mt-4 pt-4 border-t border-asphalt-700">
                <div><span className="label-eyebrow">BMR</span><p className="readout text-xl font-bold mt-0.5">{Math.round(bmr)}</p></div>
                <div><span className="label-eyebrow">TDEE base</span><p className="readout text-xl font-bold mt-0.5 text-hiviz">{tdee} kcal</p></div>
              </div>
            ) : (
              <p className="text-ink-muted text-xs mt-3">
                Completá tus datos físicos para calcular tu gasto calórico. Tu peso se toma de la pestaña Composición.
              </p>
            )}
            {tdee && caloriasActivasHoy > 0 && (
              <div className="mt-3 pt-3 border-t border-asphalt-700">
                <span className="label-eyebrow text-route">TDEE ajustado hoy</span>
                <p className="readout text-xl font-bold mt-0.5 text-route">{tdeeEfectivoHoy} kcal</p>
                <p className="text-ink-faint text-[11px] mt-1">Incluye {caloriasActivasHoy} kcal quemadas en entrenamientos de hoy, en vez del promedio fijo por nivel de actividad.</p>
              </div>
            )}
            <button onClick={() => setEditarDatosFisicos((v) => !v)} className="text-hiviz text-xs font-semibold mt-3">
              {editarDatosFisicos ? 'Ocultar datos físicos ▲' : 'Editar datos físicos (altura, edad, sexo) ▼'}
            </button>
            {editarDatosFisicos && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Campo label="Altura (cm)" type="number" value={perfil.altura} onChange={(v) => guardarPerfil({ ...perfil, altura: v })} />
                <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fecha de nacimiento</span>
                  <input type="date" value={perfil.fecha_nacimiento || ''} onChange={(e) => guardarPerfil({ ...perfil, fecha_nacimiento: e.target.value })} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
                <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Sexo</span>
                  <select value={perfil.sexo} onChange={(e) => guardarPerfil({ ...perfil, sexo: e.target.value })} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
                    <option value="M">Masculino</option><option value="F">Femenino</option>
                  </select></label>
                {edadCalculada && <p className="text-ink-faint text-xs col-span-2">Edad actual: {edadCalculada} años (se actualiza sola cada año)</p>}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatMini label="Kcal — hoy" value={kcalHoy.toFixed(0)} unit={tdeeEfectivoHoy ? `/ ${tdeeEfectivoHoy}` : ''} color="hiviz" />
            <StatMini label="Agua — hoy" value={(mlHoyAgua / 1000).toFixed(1)} unit="L" color="route" />
            <StatMini label="Proteínas" value={proteinasHoy.toFixed(0)} unit="g" />
            <StatMini label="Carbos / Grasas" value={`${carbosHoy.toFixed(0)}/${grasasHoy.toFixed(0)}`} unit="g" />
          </div>
          {alertasNutricion.map((a) => (
            <div key={a.tipo} className="card border-alert-amber">
              <span className="label-eyebrow text-alert-amber">{a.titulo}</span>
              <p className="text-ink-muted text-sm mt-1.5">{a.mensaje}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'comidas' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => { setComidaEditando(null); setFormComida((v) => !v) }}>+ Comida</button>
          </div>
          {formComida && <FormComida onGuardar={crearComida} onCancelar={() => setFormComida(false)} historial={comidas} />}
          {cargando ? (
            <SkeletonList rows={4} />
          ) : comidasPorDia.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin comidas registradas todavía.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {comidasPorDia.map(([fecha, items]) => {
                const totalKcal = items.reduce((a, c) => a + (Number(c.kcal) || 0), 0)
                const totalP = items.reduce((a, c) => a + (Number(c.proteinas) || 0), 0)
                const totalC = items.reduce((a, c) => a + (Number(c.carbohidratos) || 0), 0)
                const totalG = items.reduce((a, c) => a + (Number(c.grasas) || 0), 0)
                return (
                  <div key={fecha}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold">{fecha}</span>
                      <span className="readout text-xs text-ink-muted"><span className="text-hiviz font-semibold">{totalKcal.toFixed(0)} kcal</span>{'  ·  '}P {totalP.toFixed(0)} · C {totalC.toFixed(0)} · G {totalG.toFixed(0)}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {items.map((c) =>
                        comidaEditando === c.id ? (
                          <FormComida key={c.id} valoresIniciales={c} onGuardar={(n) => actualizarComida(c.id, n)} onCancelar={() => setComidaEditando(null)} historial={comidas} />
                        ) : (
                          <div key={c.id} className="card flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{c.tipo}{c.descripcion ? ` — ${c.descripcion}` : ''}</p>
                              <p className="text-ink-muted text-xs">{c.hora || ''}</p>
                              {c.items?.length > 1 && (
                                <p className="text-ink-faint text-[11px] mt-0.5">{c.items.map((it) => it.nombre.split(' — ')[0]).join(' · ')}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex gap-3 text-right"><MiniDato label="kcal" value={c.kcal} color="text-hiviz" /><MiniDato label="P" value={c.proteinas} /><MiniDato label="C" value={c.carbohidratos} /><MiniDato label="G" value={c.grasas} /></div>
                              <div className="flex gap-1">
                                <button onClick={() => { setFormComida(false); setComidaEditando(c.id) }} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Editar</button>
                                <button onClick={async () => { if (await confirmar('¿Borrar esta comida?', { destructivo: true })) eliminarComida(c.id) }} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
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
        </div>
      )}

      {tab === 'composicion' && (
        <div className="flex flex-col gap-3">
          {!pesoActual ? (
            <p className="text-ink-muted text-sm">Todavía no cargaste ningún registro de peso.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="card"><span className="label-eyebrow">Peso actual</span><p className="readout text-3xl font-bold text-hiviz mt-1">{pesoActual.peso} <span className="text-sm text-ink-muted">kg</span></p><p className="text-ink-faint text-xs mt-1">{pesoActual.fecha}</p></div>
                <div className="card">
                  <span className="label-eyebrow">Variación total</span>
                  {diferenciaPeso != null ? (
                    <p className={`readout text-3xl font-bold mt-1 ${diferenciaPeso < 0 ? 'text-route' : diferenciaPeso > 0 ? 'text-alert-amber' : 'text-ink'}`}>{diferenciaPeso > 0 ? '+' : ''}{diferenciaPeso.toFixed(1)} <span className="text-sm text-ink-muted">kg</span></p>
                  ) : <p className="readout text-3xl font-bold text-ink-faint mt-1">—</p>}
                </div>
              </div>
              {pesoHistorial.length > 1 && (
                <div className="card">
                  <span className="label-eyebrow">Evolución del peso</span>
                  <div className="mt-2 -ml-4">
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={graficoPeso} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="rgb(var(--color-asphalt-700))" vertical={false} />
                        <XAxis dataKey="fecha" tickFormatter={fmtFecha} tick={{ fill: 'rgb(var(--color-ink-faint))', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'rgb(var(--color-asphalt-700))' }} />
                        <YAxis tick={{ fill: 'rgb(var(--color-ink-faint))', fontSize: 10 }} tickLine={false} axisLine={false} width={30} domain={['dataMin - 1', 'dataMax + 1']} />
                        <Tooltip contentStyle={{ background: 'rgb(var(--color-asphalt-800))', border: '1px solid rgb(var(--color-asphalt-700))', borderRadius: 8, fontSize: 12 }} labelFormatter={fmtFecha} />
                        <Line type="monotone" dataKey="peso" stroke="rgb(var(--color-state-success))" strokeWidth={2} dot={{ r: 3 }} name="Peso (kg)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="card">
            <span className="label-eyebrow">Músculo vs. grasa</span>
            {ultimaComposicion && (ultimaComposicion.grasa_corporal_pct != null || ultimaComposicion.masa_muscular_pct != null) ? (
              <>
                <div className="flex gap-6 mt-2.5">
                  {ultimaComposicion.grasa_corporal_pct != null && (
                    <div><span className="text-ink-muted text-xs">% Grasa</span><p className="readout text-2xl font-bold mt-0.5" style={{ color: 'rgb(var(--color-state-critical))' }}>{ultimaComposicion.grasa_corporal_pct}</p></div>
                  )}
                  {ultimaComposicion.masa_muscular_pct != null && (
                    <div><span className="text-ink-muted text-xs">% Músculo</span><p className="readout text-2xl font-bold mt-0.5 text-route">{ultimaComposicion.masa_muscular_pct}</p></div>
                  )}
                </div>
                {ultimaComposicion.grasa_corporal_pct != null && ultimaComposicion.masa_muscular_pct != null && (
                  <div className="flex h-1.5 rounded-full overflow-hidden mt-3 bg-asphalt-700">
                    <div style={{ width: `${ultimaComposicion.grasa_corporal_pct}%`, background: 'rgb(var(--color-state-critical))' }} />
                    <div style={{ width: `${ultimaComposicion.masa_muscular_pct}%`, background: 'rgb(var(--color-route))' }} />
                  </div>
                )}
                <p className="text-ink-faint text-xs mt-2">Último registro: {ultimaComposicion.fecha}</p>
              </>
            ) : (
              <p className="text-ink-muted text-xs mt-2">Todavía no cargaste % de grasa ni de músculo. Sumalo con "+ Medidas".</p>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button className="border border-asphalt-700 text-ink-muted font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => { setPesoEditando(null); setFormPeso((v) => !v); setFormAntropo(false) }}>+ Peso</button>
            <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => { setAntropoEditando(null); setFormAntropo((v) => !v); setFormPeso(false) }}>+ Medidas</button>
          </div>
          {formPeso && <FormPeso onGuardar={crearPeso} onCancelar={() => setFormPeso(false)} />}
          {formAntropo && <FormAntropometria onGuardar={crearAntropo} onCancelar={() => setFormAntropo(false)} />}

          {antropometria.length > 1 && (
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="label-eyebrow">Evolución — perímetros y %</span>
                <select
                  value={metricaGrafico}
                  onChange={(e) => setMetricaGrafico(e.target.value)}
                  className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1 text-ink text-xs"
                >
                  {METRICAS_ANTROPOMETRIA.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
              {graficoAntropo.length > 1 ? (
                <div className="mt-2 -ml-4">
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={graficoAntropo} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="rgb(var(--color-asphalt-700))" vertical={false} />
                      <XAxis dataKey="fecha" tickFormatter={fmtFecha} tick={{ fill: 'rgb(var(--color-ink-faint))', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'rgb(var(--color-asphalt-700))' }} />
                      <YAxis tick={{ fill: 'rgb(var(--color-ink-faint))', fontSize: 10 }} tickLine={false} axisLine={false} width={30} domain={['dataMin - 1', 'dataMax + 1']} />
                      <Tooltip contentStyle={{ background: 'rgb(var(--color-asphalt-800))', border: '1px solid rgb(var(--color-asphalt-700))', borderRadius: 8, fontSize: 12 }} labelFormatter={fmtFecha} />
                      <Line type="monotone" dataKey="valor" stroke={metricaActual.color} strokeWidth={2} dot={{ r: 3 }} name={metricaActual.label} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-ink-muted text-xs mt-2">No hay suficientes registros de "{metricaActual.label}" para graficar todavía.</p>
              )}
            </div>
          )}

          {pesoHistorial.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="label-eyebrow">Historial de peso</span>
              {[...pesoHistorial].reverse().map((p) =>
                pesoEditando === p.id ? (
                  <FormPeso key={p.id} valoresIniciales={p} onGuardar={(datos) => actualizarPeso(p.id, datos)} onCancelar={() => setPesoEditando(null)} />
                ) : (
                  <div key={p.id} className="card flex items-center justify-between py-2.5">
                    <div><span className="readout text-sm font-semibold">{p.peso} kg</span><span className="text-ink-muted text-xs ml-2">{p.fecha}</span>{p.notas && <p className="text-ink-faint text-xs mt-0.5">{p.notas}</p>}</div>
                    <div className="flex gap-1">
                      <button onClick={() => { setFormPeso(false); setPesoEditando(p.id) }} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Editar</button>
                      <button onClick={() => eliminarPeso(p.id)} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {antropometria.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="label-eyebrow">Historial de medidas</span>
              {antropometria.map((a) =>
                antropoEditando === a.id ? (
                  <FormAntropometria key={a.id} valoresIniciales={a} onGuardar={(datos) => actualizarAntropo(a.id, datos)} onCancelar={() => setAntropoEditando(null)} />
                ) : (
                  <div key={a.id} className="card">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-semibold">{a.fecha}</span>
                      <div className="flex gap-1">
                        <button onClick={() => { setFormAntropo(false); setAntropoEditando(a.id) }} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Editar</button>
                        <button onClick={() => eliminarAntropo(a.id)} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {a.grasa_corporal_pct != null && <MiniDato label="% grasa" value={a.grasa_corporal_pct} />}
                      {a.masa_muscular_pct != null && <MiniDato label="% músculo" value={a.masa_muscular_pct} />}
                      {a.perimetro_cintura != null && <MiniDato label="Cintura" value={`${a.perimetro_cintura}cm`} />}
                      {a.perimetro_cadera != null && <MiniDato label="Cadera" value={`${a.perimetro_cadera}cm`} />}
                      {a.perimetro_brazo != null && <MiniDato label="Brazo" value={`${a.perimetro_brazo}cm`} />}
                      {a.perimetro_pierna != null && <MiniDato label="Pierna" value={`${a.perimetro_pierna}cm`} />}
                    </div>
                    {a.notas && <p className="text-ink-faint text-xs mt-2">{a.notas}</p>}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'mas' && subMas === null && (
        <div className="flex flex-col gap-2">
          <button onClick={() => setSubMas('planes')} className="card flex items-center justify-between text-left">
            <div><p className="text-sm font-medium">Planes de comida</p><p className="text-ink-faint text-xs mt-0.5">{planes.length} plan{planes.length === 1 ? '' : 'es'} activo{planes.length === 1 ? '' : 's'}</p></div>
            <span className="text-ink-faint">›</span>
          </button>
          <button onClick={() => setSubMas('suplementos')} className="card flex items-center justify-between text-left">
            <div><p className="text-sm font-medium">Suplementos</p><p className="text-ink-faint text-xs mt-0.5">{suplementos.length} activo{suplementos.length === 1 ? '' : 's'}</p></div>
            <span className="text-ink-faint">›</span>
          </button>
          <button onClick={() => setSubMas('documentos')} className="card flex items-center justify-between text-left">
            <div><p className="text-sm font-medium">Documentos</p><p className="text-ink-faint text-xs mt-0.5">Análisis, planes en PDF</p></div>
            <span className="text-ink-faint">›</span>
          </button>
        </div>
      )}

      {tab === 'mas' && subMas === 'planes' && (
        <div className="flex flex-col gap-3">
          <SubMasHeader onVolver={() => setSubMas(null)} titulo="Planes de comida" />
          <div className="flex justify-end">
            <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => { setPlanEditando(null); setFormPlanOpen((v) => !v) }}>+ Plan</button>
          </div>
          {formPlanOpen && <FormPlanNutricion onGuardar={crearPlan} onCancelar={() => setFormPlanOpen(false)} />}
          {registrandoComida && (
            <FormComida
              valoresIniciales={registrandoComida}
              onGuardar={crearComida}
              onCancelar={() => setRegistrandoComida(null)}
              historial={comidas}
            />
          )}
          {planes.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin planes de comidas cargados todavía.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {planes.map((p) =>
                planEditando === p.id ? (
                  <FormPlanNutricion key={p.id} valoresIniciales={p} onGuardar={(datos) => actualizarPlan(p.id, datos)} onCancelar={() => setPlanEditando(null)} />
                ) : (
                  <div key={p.id} className="card">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{p.nombre}</p>
                      <div className="flex gap-1">
                        <button onClick={() => { setFormPlanOpen(false); setPlanEditando(p.id) }} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Editar</button>
                        <button onClick={() => borrarPlan(p.id)} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 mt-3">
                      {(p.comidas || []).map((c, i) => {
                        const registradaHoy = comidasHoy.find((ch) => ch.tipo === c.momento)
                        return (
                          <div key={i} className="flex items-center justify-between border border-asphalt-700 rounded-lg px-3 py-2">
                            <div>
                              <p className="text-sm font-medium">{c.momento}{c.nombre ? ` — ${c.nombre}` : ''}</p>
                              <p className="text-ink-muted text-xs">
                                Objetivo: {c.kcal_objetivo ? `${c.kcal_objetivo} kcal` : '—'}{c.proteinas_objetivo ? ` · ${c.proteinas_objetivo}g prot` : ''}
                              </p>
                            </div>
                            {registradaHoy ? (
                              <span className="text-hiviz text-xs font-semibold whitespace-nowrap">✓ hoy: {registradaHoy.kcal ?? '—'} kcal</span>
                            ) : (
                              <button onClick={() => registrarDesdeComida(c)} className="text-hiviz text-xs font-semibold whitespace-nowrap">+ Registrar</button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'hidratacion' && (
        <div className="flex flex-col gap-3">
          <div className="card">
            <span className="label-eyebrow">Fecha</span>
            <input
              type="date"
              value={fechaHidratacion}
              max={hoy}
              onChange={(e) => setFechaHidratacion(e.target.value)}
              className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink text-sm mt-1.5"
            />
          </div>
          <div className="card">
            <span className="label-eyebrow">Agua — carga rápida ({fechaHidratacion === hoy ? 'hoy' : fechaHidratacion})</span>
            <div className="flex gap-2 mt-2.5 flex-wrap">
              {[250, 500, 750].map((ml) => (
                <button key={ml} className="border border-asphalt-700 rounded-lg px-3 py-1.5 text-sm text-ink-muted" onClick={() => cargarBebida('Agua', ml, fechaHidratacion)}>+ {ml} ml</button>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => setFormBebidaOpen((v) => !v)}>+ Otra bebida</button>
          </div>
          {formBebidaOpen && (
            <FormBebida
              fechaPorDefecto={fechaHidratacion}
              onGuardar={(bebida, ml, fecha) => cargarBebida(bebida, ml, fecha)}
              onCancelar={() => setFormBebidaOpen(false)}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            {BEBIDAS.map((b) => {
              const item = porBebidaFecha.find((x) => x.bebida === b)
              if (!item && b !== 'Agua') return null
              return (
                <div key={b} className="card">
                  <span className="label-eyebrow">{b}</span>
                  <p className={`readout text-2xl font-bold mt-1 ${b === 'Agua' ? 'text-route' : 'text-hiviz'}`}>{((item?.ml || 0) / 1000).toFixed(2)} L</p>
                </div>
              )
            })}
          </div>
          {hidratacionPorDia.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin registros de hidratación todavía.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {hidratacionPorDia.slice(0, 10).map(([fecha, items]) => (
                <div key={fecha}>
                  <p className="text-sm font-semibold mb-2">{fecha}</p>
                  <div className="flex flex-col gap-2">
                    {items.map((h) =>
                      editandoHidratacionId === h.id ? (
                        <FormBebida
                          key={h.id}
                          valoresIniciales={h}
                          fechaPorDefecto={h.fecha}
                          onGuardar={(bebida, ml, fecha, hora) => actualizarHidratacion(h.id, { bebida, ml, fecha, hora })}
                          onCancelar={() => setEditandoHidratacionId(null)}
                        />
                      ) : (
                        <div key={h.id} className="card flex justify-between items-center py-2.5">
                          <span className="text-ink-muted text-sm">{h.hora} · {h.bebida || 'Agua'}</span>
                          <div className="flex items-center gap-2.5">
                            <span className="readout text-sm font-semibold">{h.ml} ml</span>
                            <div className="flex gap-1">
                              <button onClick={() => setEditandoHidratacionId(h.id)} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Editar</button>
                              <button onClick={() => eliminarHidratacion(h.id)} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'mas' && subMas === 'suplementos' && (
        <div className="flex flex-col gap-3">
          <SubMasHeader onVolver={() => setSubMas(null)} titulo="Suplementos" />
          <div className="flex justify-end"><button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => setFormSuplemento((v) => !v)}>+ Suplemento</button></div>
          {formSuplemento && (
            <FormSuplemento onGuardar={async (n) => { const { data: userData } = await supabase.auth.getUser(); await supabase.from('suplementos').insert({ ...n, user_id: userData.user.id }); setFormSuplemento(false); cargar() }} onCancelar={() => setFormSuplemento(false)} />
          )}
          {['Natural', 'Químico'].map((grupo) => {
            const items = suplementos.filter((s) => s.tipo === grupo)
            if (items.length === 0) return null
            return (
              <div key={grupo}>
                <p className="text-ink-muted text-xs uppercase tracking-wide mb-2">{grupo}</p>
                <div className="flex flex-col gap-2">
                  {items.map((s) => (
                    <div key={s.id} className="card">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{s.nombre}</p>
                          <p className="text-ink-muted text-xs mt-1">{s.dosis}{s.frecuencia ? ` · ${s.frecuencia}` : ''}</p>
                          {s.notas && <p className="text-ink-faint text-xs mt-1">{s.notas}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.tipo === 'Natural' ? 'text-hiviz border-hiviz-dim' : 'text-route border-route-dim'}`}>{s.tipo}</span>
                          <button onClick={() => eliminarSuplemento(s.id)} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'mas' && subMas === 'documentos' && (
        <div className="flex flex-col gap-3">
          <SubMasHeader onVolver={() => setSubMas(null)} titulo="Documentos" />
          <div className="card">
            <span className="label-eyebrow">Subir plan de comidas (PDF o foto)</span>
            <p className="text-ink-muted text-xs mt-1.5">
              Si tu nutricionista te pasa el plan en PDF o como foto, subilo acá para tenerlo siempre a mano dentro de la app.
            </p>
            <label className="inline-block mt-3">
              <span className="border border-asphalt-700 text-ink-muted font-semibold text-sm px-4 py-2.5 rounded-lg inline-block cursor-pointer hover:text-ink hover:border-hiviz">
                {subiendoArchivo ? 'Subiendo…' : 'Elegir archivo'}
              </span>
              <input
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                disabled={subiendoArchivo}
                onChange={(e) => { subirDocumento(e.target.files[0]); e.target.value = '' }}
              />
            </label>
            {errorArchivo && <p className="text-alert-red text-xs mt-3">{errorArchivo}</p>}
          </div>
          {documentos.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin documentos subidos todavía.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {documentos.map((doc) => (
                <div key={doc.id} className="card flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{doc.nombre}</p>
                    <p className="text-ink-muted text-xs">{new Date(doc.created_at).toLocaleDateString('es-AR')}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => verDocumento(doc)} className="text-hiviz text-xs border border-asphalt-700 rounded-lg px-2 py-1">Ver</button>
                    <button onClick={() => borrarDocumento(doc)} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Botón flotante de carga rápida, oculto en "Más" (sin acción rápida obvia ahí) */}
      {tab !== 'mas' && (
        <>
          <button
            onClick={() => setFabAbierto(true)}
            className="fixed right-5 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] w-14 h-14 rounded-full bg-hiviz text-asphalt-950 text-2xl font-semibold flex items-center justify-center shadow-lg z-40"
            aria-label="Registrar"
          >
            +
          </button>
          {fabAbierto && (
            <div className="fixed inset-0 bg-black/55 z-50 flex items-end" onClick={(e) => { if (e.target === e.currentTarget) setFabAbierto(false) }}>
              <div className="w-full bg-asphalt-800 border-t border-asphalt-700 rounded-t-2xl px-4 pt-2.5 pb-8">
                <div className="w-9 h-1 bg-asphalt-600 rounded-full mx-auto mb-3.5" />
                <p className="font-display font-semibold text-base mb-1.5">Registrar</p>
                <div className="flex flex-col">
                  {opcionesFab.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => manejarAccionRapida(o.id)}
                      className="flex items-center gap-3 py-3 border-b border-asphalt-700 last:border-none text-left"
                    >
                      <span className="w-8 h-8 rounded-lg bg-asphalt-700 flex items-center justify-center text-sm">{o.icono}</span>
                      <span className="text-sm font-medium">{o.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Campo({ label, ...props }) {
  return <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">{label}</span><input {...props} onChange={(e) => props.onChange(e.target.value)} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink focus:border-hiviz outline-none" /></label>
}
function StatMini({ label, value, unit, color }) {
  const colorClass = { hiviz: 'text-hiviz', route: 'text-route' }[color] || 'text-ink'
  return <div className="card"><span className="label-eyebrow">{label}</span><div className="flex items-baseline gap-1 mt-1"><span className={`readout text-2xl font-bold ${colorClass}`}>{value}</span>{unit && <span className="text-ink-muted text-xs">{unit}</span>}</div></div>
}
function MiniDato({ label, value, color = 'text-ink' }) {
  return <div><p className={`readout text-sm font-semibold ${color}`}>{value ?? '—'}</p><p className="text-ink-muted text-[10px] uppercase">{label}</p></div>
}
function SubMasHeader({ onVolver, titulo }) {
  return (
    <button onClick={onVolver} className="flex items-center gap-1.5 self-start text-ink-muted hover:text-ink -ml-1">
      <ChevronLeft size={16} strokeWidth={2.5} aria-hidden />
      <span className="label-eyebrow">Más</span>
      <span className="text-ink-faint">/</span>
      <span className="label-eyebrow text-ink">{titulo}</span>
    </button>
  )
}

function FormPlanNutricion({ onGuardar, onCancelar, valoresIniciales }) {
  const [nombre, setNombre] = useState(valoresIniciales?.nombre || '')
  const [comidas, setComidas] = useState(
    valoresIniciales?.comidas?.length ? valoresIniciales.comidas : [{ momento: 'Desayuno', nombre: '', kcal_objetivo: '', proteinas_objetivo: '' }]
  )
  function actualizarComida(i, campo, valor) { setComidas((cs) => cs.map((c, idx) => (idx === i ? { ...c, [campo]: valor } : c))) }
  function agregarComida() { setComidas((cs) => [...cs, { momento: 'Desayuno', nombre: '', kcal_objetivo: '', proteinas_objetivo: '' }]) }
  function quitarComida(i) { setComidas((cs) => cs.filter((_, idx) => idx !== i)) }

  return (
    <form className="card flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault()
      const comidasLimpias = comidas.map((c) => ({
        momento: c.momento, nombre: c.nombre,
        kcal_objetivo: c.kcal_objetivo === '' ? null : Number(c.kcal_objetivo),
        proteinas_objetivo: c.proteinas_objetivo === '' ? null : Number(c.proteinas_objetivo)
      }))
      onGuardar({ nombre, comidas: comidasLimpias })
    }}>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted text-xs">Nombre del plan</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Plan de volumen / Plan pre-competencia" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" />
      </label>
      <div className="flex flex-col gap-2.5">
        {comidas.map((c, i) => (
          <div key={i} className="border border-asphalt-700 rounded-lg p-2.5 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <select value={c.momento} onChange={(e) => actualizarComida(i, 'momento', e.target.value)} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm">
                {TIPOS_COMIDA.map((t) => <option key={t}>{t}</option>)}
              </select>
              <input value={c.nombre} onChange={(e) => actualizarComida(i, 'nombre', e.target.value)} placeholder="Avena con banana y whey" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <input type="number" value={c.kcal_objetivo} onChange={(e) => actualizarComida(i, 'kcal_objetivo', e.target.value)} placeholder="Kcal objetivo" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm" />
              <input type="number" value={c.proteinas_objetivo} onChange={(e) => actualizarComida(i, 'proteinas_objetivo', e.target.value)} placeholder="Prot objetivo (g)" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm" />
              <button type="button" onClick={() => quitarComida(i)} className="text-alert-red text-xs">Quitar</button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={agregarComida} className="text-hiviz text-xs self-start">+ Agregar comida</button>
      <div className="flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar plan</button>
      </div>
    </form>
  )
}

function FormComida({ onGuardar, onCancelar, valoresIniciales, historial }) {
  const itemsIniciales = valoresIniciales?.items?.length
    ? valoresIniciales.items
    : (valoresIniciales?.descripcion || valoresIniciales?.kcal)
      ? [{
          id: nuevoIdItem(),
          nombre: valoresIniciales.descripcion || valoresIniciales.tipo || 'Ítem',
          kcal: Number(valoresIniciales.kcal) || 0,
          proteinas: Number(valoresIniciales.proteinas) || 0,
          carbohidratos: Number(valoresIniciales.carbohidratos) || 0,
          grasas: Number(valoresIniciales.grasas) || 0,
        }]
      : []

  const [form, setForm] = useState({
    fecha: valoresIniciales?.fecha || hoyLocal(),
    hora: valoresIniciales?.hora || new Date().toTimeString().slice(0, 5),
    tipo: valoresIniciales?.tipo || 'Desayuno',
    nombre: valoresIniciales?.descripcion || '',
  })
  const [items, setItems] = useState(itemsIniciales)
  // El buscador arranca abierto si el plato todavía no tiene nada cargado —
  // es lo primero que el usuario necesita hacer.
  const [buscadorAbierto, setBuscadorAbierto] = useState(itemsIniciales.length === 0)
  const [detalleAbierto, setDetalleAbierto] = useState(itemsIniciales.length === 0)
  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })

  const recientes = itemsRecientesUnicos(historial)

  const totales = items.reduce((acc, it) => ({
    kcal: acc.kcal + (Number(it.kcal) || 0),
    proteinas: round1(acc.proteinas + (Number(it.proteinas) || 0)),
    carbohidratos: round1(acc.carbohidratos + (Number(it.carbohidratos) || 0)),
    grasas: round1(acc.grasas + (Number(it.grasas) || 0)),
  }), { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 })

  function agregarItem({ descripcion, kcal, proteinas, carbohidratos, grasas }) {
    setItems((prev) => [...prev, {
      id: nuevoIdItem(), nombre: descripcion,
      kcal: Number(kcal) || 0, proteinas: Number(proteinas) || 0, carbohidratos: Number(carbohidratos) || 0, grasas: Number(grasas) || 0,
    }])
    // El buscador queda abierto a propósito: la mayoría de las comidas
    // tienen más de un componente, así que no tiene sentido cerrarlo y
    // obligar a reabrirlo para el siguiente ingrediente.
  }
  function quitarItem(id) { setItems((prev) => prev.filter((it) => it.id !== id)) }
  function agregarPlato(plato) {
    setItems((prev) => [...prev, ...itemsDesdePlato(plato)])
    setForm((f) => ({ ...f, nombre: f.nombre || plato.nombre, tipo: f.nombre ? f.tipo : plato.tipo }))
  }

  return (
    <form className="card flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault()
      onGuardar({ fecha: form.fecha, hora: form.hora, tipo: form.tipo, descripcion: form.nombre, items, ...totales })
    }}>
      {/* Totales siempre visibles arriba: es el dato que más importa mientras se carga */}
      <div className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2.5 flex items-center justify-between">
        <span className="readout text-lg font-bold text-hiviz">{totales.kcal.toFixed(0)} kcal</span>
        <span className="readout text-xs text-ink-muted">P {totales.proteinas.toFixed(0)} · C {totales.carbohidratos.toFixed(0)} · G {totales.grasas.toFixed(0)}</span>
      </div>

      {items.length > 0 && (
        <div className="flex flex-col">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-asphalt-700 last:border-b-0">
              <span className="text-sm truncate">{it.nombre}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="readout text-xs text-ink-muted">{it.kcal} kcal</span>
                <button type="button" onClick={() => quitarItem(it.id)} className="text-ink-faint hover:text-alert-red text-xs px-1">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {buscadorAbierto ? (
        <div>
          {items.length > 0 && (
            <div className="flex justify-end mb-1"><button type="button" onClick={() => setBuscadorAbierto(false)} className="text-ink-faint text-xs">Listo, ocultar buscador</button></div>
          )}
          <BuscadorAlimento onSeleccionar={agregarItem} onSeleccionarPlato={agregarPlato} recientes={recientes} platos={PLATOS_PRECARGADOS} />
        </div>
      ) : (
        <button type="button" onClick={() => setBuscadorAbierto(true)} className="border border-dashed border-asphalt-600 text-hiviz font-semibold text-sm px-3 py-2.5 rounded-lg text-center">
          + Agregar alimento
        </button>
      )}

      {items.length === 0 && !buscadorAbierto && (
        <p className="text-ink-faint text-xs text-center">Todavía no agregaste nada a este plato.</p>
      )}

      {/* Fecha / hora / tipo / nombre: secundario, colapsado por defecto */}
      <button type="button" onClick={() => setDetalleAbierto((v) => !v)} className="text-ink-muted text-xs self-start flex items-center gap-1">
        {detalleAbierto ? '▾' : '▸'} {form.tipo} · {form.hora}{form.nombre ? ` · ${form.nombre}` : ''}
      </button>
      {detalleAbierto && (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fecha</span><input type="date" {...campo('fecha')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
          <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Hora</span><input type="time" {...campo('hora')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
          <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Tipo</span><select {...campo('tipo')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">{TIPOS_COMIDA.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Nombre del plato (opcional)</span><input {...campo('nombre')} placeholder="Ej: Pollo con arroz" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" disabled={items.length === 0} className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">Guardar</button>
      </div>
    </form>
  )
}

function BuscadorAlimento({ onSeleccionar, onSeleccionarPlato, recientes = [], platos = [] }) {
  const [texto, setTexto] = useState('')
  const [resultadosLocal, setResultadosLocal] = useState([])
  const [resultadosPlatos, setResultadosPlatos] = useState([])
  const [resultadosRed, setResultadosRed] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState('')
  const [escaneando, setEscaneando] = useState(false)
  const [productoElegido, setProductoElegido] = useState(null)
  const [modoCantidad, setModoCantidad] = useState('gramos') // 'gramos' | 'unidad'
  const [cantidad, setCantidad] = useState('100')
  const [agregadoFlash, setAgregadoFlash] = useState('')

  // Búsqueda instantánea: la base local no necesita red, así que se filtra
  // en cada tecleo. Solo si no alcanza se completa (con demora, para no
  // spamear) contra USDA / Open Food Facts.
  useEffect(() => {
    const t = texto.trim()
    if (t.length < 2) {
      setResultadosLocal([]); setResultadosPlatos([]); setResultadosRed([]); setError('')
      return
    }
    const local = buscarAlimentosLocal(t, 8)
    const platosFiltrados = platos.filter((p) => p.nombre.toLowerCase().includes(t.toLowerCase())).slice(0, 4)
    setResultadosLocal(local)
    setResultadosPlatos(platosFiltrados)
    setError('')

    const alcanza = local.length + platosFiltrados.length >= 5
    if (alcanza) { setResultadosRed([]); return }

    const timer = setTimeout(async () => {
      setBuscando(true)
      try {
        const [usda, off] = await Promise.allSettled([
          buscarAlimentosUSDA(t),
          buscarAlimentosPorTexto(t)
        ])
        const resultadosUsda = usda.status === 'fulfilled' ? usda.value : []
        const resultadosOff = off.status === 'fulfilled' ? off.value : []
        const combinados = [...resultadosUsda, ...resultadosOff]
        setResultadosRed(combinados)
        if (local.length === 0 && platosFiltrados.length === 0 && combinados.length === 0) {
          const ambasFallaron = usda.status === 'rejected' && off.status === 'rejected'
          setError(ambasFallaron ? 'No se pudo buscar en ninguna base de datos.' : 'Sin resultados. Probá con otro nombre o cargá los macros a mano.')
        }
      } finally {
        setBuscando(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [texto, platos])

  function flashAgregado(nombre) {
    setAgregadoFlash(nombre)
    setTimeout(() => setAgregadoFlash(''), 1200)
  }

  function elegirPlato(p) {
    onSeleccionarPlato(p)
    setTexto('')
    flashAgregado(p.nombre)
  }

  async function manejarCodigoDetectado(codigo) {
    setEscaneando(false)
    setError(''); setBuscando(true)
    try {
      const producto = await buscarAlimentoPorCodigoBarras(codigo)
      if (!producto) { setError('No encontramos ese producto en la base. Probá buscarlo por nombre.'); return }
      setProductoElegido(producto)
    } catch (err) {
      setError('No se pudo consultar el producto.')
    } finally {
      setBuscando(false)
    }
  }

  function elegirProducto(p) {
    setProductoElegido(p)
    if (p.unidad) { setModoCantidad('unidad'); setCantidad('1') }
    else { setModoCantidad('gramos'); setCantidad('100') }
  }

  function confirmar(g, detalleCantidad) {
    const escala = g / 100
    onSeleccionar({
      descripcion: `${productoElegido.nombre}${productoElegido.marca ? ` (${productoElegido.marca})` : ''} — ${detalleCantidad}`,
      kcal: productoElegido.kcal100g != null ? Math.round(productoElegido.kcal100g * escala) : '',
      proteinas: productoElegido.proteinas100g != null ? Math.round(productoElegido.proteinas100g * escala * 10) / 10 : '',
      carbohidratos: productoElegido.carbohidratos100g != null ? Math.round(productoElegido.carbohidratos100g * escala * 10) / 10 : '',
      grasas: productoElegido.grasas100g != null ? Math.round(productoElegido.grasas100g * escala * 10) / 10 : ''
    })
    flashAgregado(productoElegido.nombre)
    setProductoElegido(null)
    setTexto('')
  }

  // Atajo de 1 tap para las cantidades más comunes (chip), sin pasar por el
  // input numérico. "unidades" son múltiplos de la unidad propia del
  // alimento (huevo, banana...); "gramos" son valores redondos típicos.
  function confirmarChipUnidad(n) {
    const g = n * (productoElegido.unidad?.gramos || 0)
    confirmar(g, `${n} ${productoElegido.unidad.etiqueta}${n === 1 ? '' : 's'}`)
  }
  function confirmarChipGramos(g) { confirmar(g, `${g}g`) }
  function confirmarCantidad() {
    const cant = Number(cantidad) || 0
    const g = modoCantidad === 'unidad' ? cant * (productoElegido.unidad?.gramos || 0) : cant
    const detalleCantidad = modoCantidad === 'unidad'
      ? `${cant} ${productoElegido.unidad.etiqueta}${cant === 1 ? '' : 's'}`
      : `${g}g`
    confirmar(g, detalleCantidad)
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
    const chipsGramos = [50, 100, 150, 200]
    return (
      <div className="border border-asphalt-700 rounded-lg p-3 flex flex-col gap-2.5 bg-asphalt-900">
        <div>
          <p className="text-sm font-semibold">{productoElegido.nombre}</p>
          {productoElegido.marca && <p className="text-ink-muted text-xs">{productoElegido.marca}</p>}
          <p className="text-ink-faint text-xs mt-1">
            Por 100g: {productoElegido.kcal100g ?? '—'} kcal · P {productoElegido.proteinas100g ?? '—'} · C {productoElegido.carbohidratos100g ?? '—'} · G {productoElegido.grasas100g ?? '—'}
            {productoElegido.unidad && ` · 1 ${productoElegido.unidad.etiqueta} ≈ ${productoElegido.unidad.gramos}g`}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-ink-muted text-xs">Cantidad — tocá una opción rápida o poné la tuya</span>
          <div className="flex flex-wrap gap-1.5">
            {productoElegido.unidad ? (
              <>
                {[1, 2, 3].map((n) => (
                  <button key={n} type="button" onClick={() => confirmarChipUnidad(n)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-asphalt-700 hover:border-hiviz hover:text-hiviz">
                    {n} {productoElegido.unidad.etiqueta}{n === 1 ? '' : 's'}
                  </button>
                ))}
              </>
            ) : (
              chipsGramos.map((g) => (
                <button key={g} type="button" onClick={() => confirmarChipGramos(g)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-asphalt-700 hover:border-hiviz hover:text-hiviz">
                  {g} g
                </button>
              ))
            )}
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          {productoElegido.unidad && (
            <div className="flex gap-1 mb-1">
              <button type="button" onClick={() => { setModoCantidad('unidad'); setCantidad('1') }} className={`text-xs px-2.5 py-1 rounded-lg border ${modoCantidad === 'unidad' ? 'bg-hiviz text-asphalt-950 border-hiviz' : 'text-ink-muted border-asphalt-700'}`}>Por {productoElegido.unidad.etiqueta}</button>
              <button type="button" onClick={() => { setModoCantidad('gramos'); setCantidad('100') }} className={`text-xs px-2.5 py-1 rounded-lg border ${modoCantidad === 'gramos' ? 'bg-hiviz text-asphalt-950 border-hiviz' : 'text-ink-muted border-asphalt-700'}`}>Por gramos</button>
            </div>
          )}
          <span className="text-ink-muted text-xs">Otra cantidad</span>
          <input type="number" step={modoCantidad === 'unidad' ? '0.5' : '1'} value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" />
        </label>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => setProductoElegido(null)} className="text-ink-muted text-xs px-3 py-1.5">Elegir otro</button>
          <button type="button" onClick={confirmarCantidad} className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg">Usar esta cantidad</button>
        </div>
      </div>
    )
  }

  const hayResultados = resultadosLocal.length > 0 || resultadosPlatos.length > 0 || resultadosRed.length > 0

  return (
    <div className="border border-asphalt-700 rounded-lg p-3 flex flex-col gap-2.5 bg-asphalt-900">
      {agregadoFlash && (
        <p className="text-xs font-semibold text-hiviz">✓ Agregado: {agregadoFlash}</p>
      )}

      <div className="flex gap-2">
        <input
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscá: yogur, banana, pollo..."
          className="flex-1 bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink text-sm"
        />
        <button type="button" onClick={() => setEscaneando(true)} title="Escanear código de barras" className="border border-asphalt-700 rounded-lg px-3 py-2 text-sm">
          📷
        </button>
      </div>

      {texto.trim().length < 2 && recientes.length > 0 && (
        <div>
          <span className="text-ink-muted text-xs">Recientes</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {recientes.map((r) => (
              <button key={r.nombre} type="button" onClick={() => elegirProducto(r)} className="text-xs px-2.5 py-1.5 rounded-lg border border-asphalt-700 hover:border-hiviz hover:text-hiviz">
                {r.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {buscando && <p className="text-ink-faint text-xs">Buscando...</p>}
      {error && <p className="text-alert-red text-xs">{error}</p>}

      {hayResultados && (
        <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
          {resultadosPlatos.map((p) => (
            <button
              key={`plato-${p.nombre}`}
              type="button"
              onClick={() => elegirPlato(p)}
              className="text-left border border-asphalt-700 rounded-lg px-2.5 py-2 hover:border-hiviz"
            >
              <p className="text-xs font-medium">🍽️ {p.nombre} <span className="text-ink-faint font-normal">· plato completo</span></p>
              <p className="text-ink-faint text-[10px]">{p.ingredientes.map((i) => i.alimento).join(' · ')}</p>
            </button>
          ))}
          {resultadosLocal.map((r, i) => (
            <button
              key={`local-${i}`}
              type="button"
              onClick={() => elegirProducto(r)}
              className="text-left border border-asphalt-700 rounded-lg px-2.5 py-2 hover:border-hiviz"
            >
              <p className="text-xs font-medium">{r.nombre}</p>
              <p className="text-ink-faint text-[10px]">{r.kcal100g} kcal · P {r.proteinas100g} · C {r.carbohidratos100g} · G {r.grasas100g} <span className="text-ink-faint">/100g</span></p>
            </button>
          ))}
          {resultadosRed.map((r, i) => (
            <button
              key={`red-${i}`}
              type="button"
              onClick={() => elegirProducto(r)}
              className="text-left border border-asphalt-700 rounded-lg px-2.5 py-2 hover:border-hiviz"
            >
              <p className="text-xs font-medium">{r.nombre}{r.marca ? ` — ${r.marca}` : ''}</p>
              <p className="text-ink-faint text-[10px]">{r.kcal100g} kcal / 100g</p>
            </button>
          ))}
        </div>
      )}

      {!hayResultados && !buscando && texto.trim().length >= 2 && !error && (
        <p className="text-ink-faint text-xs text-center py-1.5">Sin resultados todavía. Seguí escribiendo.</p>
      )}
    </div>
  )
}

function FormPeso({ onGuardar, onCancelar, valoresIniciales }) {
  const [form, setForm] = useState({ fecha: hoyLocal(), peso: '', notas: '', ...valoresIniciales })
  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })
  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onGuardar({ ...form, peso: Number(form.peso) }) }}>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fecha</span><input type="date" {...campo('fecha')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Peso (kg)</span><input type="number" step="0.1" {...campo('peso')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Notas</span><input {...campo('notas')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="col-span-2 flex justify-end gap-2 mt-1"><button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button><button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button></div>
    </form>
  )
}

function FormAntropometria({ onGuardar, onCancelar, valoresIniciales }) {
  const [form, setForm] = useState({
    fecha: hoyLocal(), grasa_corporal_pct: '', masa_muscular_pct: '',
    perimetro_cintura: '', perimetro_cadera: '', perimetro_brazo: '', perimetro_pierna: '',
    pliegue_triceps: '', pliegue_subescapular: '', pliegue_suprailiaco: '', notas: '',
    ...valoresIniciales
  })
  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })
  const numerico = (k) => (form[k] === '' ? null : Number(form[k]))
  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => {
      e.preventDefault()
      onGuardar({
        fecha: form.fecha, notas: form.notas,
        grasa_corporal_pct: numerico('grasa_corporal_pct'), masa_muscular_pct: numerico('masa_muscular_pct'),
        perimetro_cintura: numerico('perimetro_cintura'), perimetro_cadera: numerico('perimetro_cadera'),
        perimetro_brazo: numerico('perimetro_brazo'), perimetro_pierna: numerico('perimetro_pierna'),
        pliegue_triceps: numerico('pliegue_triceps'), pliegue_subescapular: numerico('pliegue_subescapular'),
        pliegue_suprailiaco: numerico('pliegue_suprailiaco')
      })
    }}>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Fecha</span><input type="date" {...campo('fecha')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <Campo2 label="% Grasa corporal" {...campo('grasa_corporal_pct')} />
      <Campo2 label="% Masa muscular" {...campo('masa_muscular_pct')} />
      <Campo2 label="Perímetro cintura (cm)" {...campo('perimetro_cintura')} />
      <Campo2 label="Perímetro cadera (cm)" {...campo('perimetro_cadera')} />
      <Campo2 label="Perímetro brazo (cm)" {...campo('perimetro_brazo')} />
      <Campo2 label="Perímetro pierna (cm)" {...campo('perimetro_pierna')} />
      <Campo2 label="Pliegue tríceps (mm)" {...campo('pliegue_triceps')} />
      <Campo2 label="Pliegue subescapular (mm)" {...campo('pliegue_subescapular')} />
      <Campo2 label="Pliegue suprailíaco (mm)" {...campo('pliegue_suprailiaco')} />
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Notas</span><input {...campo('notas')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="col-span-2 flex justify-end gap-2 mt-1"><button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button><button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button></div>
    </form>
  )
}
function Campo2({ label, ...props }) {
  return <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">{label}</span><input type="number" step="0.1" {...props} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
}

function FormBebida({ onGuardar, onCancelar, valoresIniciales, fechaPorDefecto }) {
  const [bebida, setBebida] = useState(valoresIniciales?.bebida || 'Isotónica')
  const [ml, setMl] = useState(valoresIniciales?.ml ?? '')
  const [fecha, setFecha] = useState(valoresIniciales?.fecha || fechaPorDefecto || hoyLocal())
  const [hora, setHora] = useState(valoresIniciales?.hora || new Date().toTimeString().slice(0, 5))
  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); if (ml) onGuardar(bebida, Number(ml), fecha, hora) }}>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fecha</span>
        <input type="date" value={fecha} max={hoyLocal()} onChange={(e) => setFecha(e.target.value)} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Hora</span>
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Bebida</span>
        <select value={bebida} onChange={(e) => setBebida(e.target.value)} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          {BEBIDAS.map((b) => <option key={b}>{b}</option>)}
        </select></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Cantidad (ml)</span>
        <input type="number" value={ml} onChange={(e) => setMl(e.target.value)} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="col-span-2 flex justify-end gap-2 mt-1"><button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button><button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button></div>
    </form>
  )
}

function FormSuplemento({ onGuardar, onCancelar }) {
  const [form, setForm] = useState({ nombre: '', tipo: 'Natural', dosis: '', frecuencia: '', notas: '' })
  const campo = (k) => ({ value: form[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })
  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onGuardar(form) }}>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Nombre</span><input {...campo('nombre')} required placeholder="Cafeína / Creatina / Magnesio" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Tipo</span><select {...campo('tipo')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">{TIPOS_SUPLEMENTO.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Dosis</span><input {...campo('dosis')} placeholder="5 g" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Frecuencia</span><input {...campo('frecuencia')} placeholder="Diaria / Pre-entreno / Solo competencia" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Notas</span><input {...campo('notas')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="col-span-2 flex justify-end gap-2 mt-1"><button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button><button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button></div>
    </form>
  )
}
