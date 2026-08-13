import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { SkeletonList } from '../components/Skeleton'
import { buscarAlimentosPorTexto, buscarAlimentoPorCodigoBarras } from '../lib/openFoodFacts'
import EscanerCodigoBarras from '../components/EscanerCodigoBarras'
import IconoInsignia from '../components/IconoInsignia'
import { Apple } from 'lucide-react'
import { NIVELES_ACTIVIDAD, calcularBMR, calcularTDEE, calcularEdad } from '../lib/tdee'
import { evaluarDeficitNutricional } from '../lib/nutricionAlertas'
import { useToast } from '../lib/ToastContext'
import { useConfirm } from '../lib/ConfirmContext'

const TIPOS_COMIDA = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Snack', 'Intra-entreno']
const TIPOS_SUPLEMENTO = ['Natural', 'Químico']
const BEBIDAS = ['Agua', 'Isotónica', 'Café', 'Té', 'Otra']
const METRICAS_ANTROPOMETRIA = [
  { id: 'grasa_corporal_pct', label: '% Grasa corporal', color: '#F14A4A' },
  { id: 'masa_muscular_pct', label: '% Masa muscular', color: '#C4F135' },
  { id: 'perimetro_cintura', label: 'Cintura (cm)', color: '#4A9EFF' },
  { id: 'perimetro_cadera', label: 'Cadera (cm)', color: '#F5A623' },
  { id: 'perimetro_brazo', label: 'Brazo (cm)', color: '#C34AF1' },
  { id: 'perimetro_pierna', label: 'Pierna (cm)', color: '#7A4AF1' }
]
function agruparPorFecha(items) {
  const grupos = {}
  for (const item of items) { if (!grupos[item.fecha]) grupos[item.fecha] = []; grupos[item.fecha].push(item) }
  return Object.entries(grupos).sort((a, b) => b[0].localeCompare(a[0]))
}
function fmtFecha(f) { const [, m, d] = f.split('-'); return `${d}/${m}` }

export default function Nutricion() {
  const toast = useToast()
  const { confirmar, alertar } = useConfirm()
  const [sub, setSub] = useState('resumen')
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
  const [fechaHidratacion, setFechaHidratacion] = useState(new Date().toISOString().slice(0, 10))
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

  async function cargar() {
    const [{ data: p }, { data: cm }, { data: h }, { data: s }, { data: pesos }, { data: antro }, { data: pl }, { data: docs }] = await Promise.all([
      supabase.from('perfil_nutricional').select('*').maybeSingle(),
      supabase.from('comidas').select('*').order('fecha', { ascending: false }).limit(100),
      supabase.from('hidratacion').select('*').order('fecha', { ascending: false }).limit(60),
      supabase.from('suplementos').select('*').eq('activo', true),
      supabase.from('peso_historial').select('*').order('fecha', { ascending: true }),
      supabase.from('antropometria').select('*').order('fecha', { ascending: false }),
      supabase.from('planes_nutricion').select('*').eq('activo', true).order('created_at', { ascending: true }),
      supabase.from('documentos_nutricion').select('*').order('created_at', { ascending: false })
    ])
    if (p) setPerfil(p)
    setComidas(cm || [])
    setHidratacion(h || [])
    setSuplementos(s || [])
    setPesoHistorial(pesos || [])
    setAntropometria(antro || [])
    setPlanes(pl || [])
    setDocumentos(docs || [])
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  async function guardarPerfil(next) {
    setPerfil(next)
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('perfil_nutricional').upsert({ ...next, user_id: userData.user.id })
  }
  async function crearComida(n) {
    const { error } = await supabase.from('comidas').insert(n)
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
    await supabase.from('peso_historial').insert(form)
    await guardarPerfil({ ...perfil, peso: form.peso })
    setFormPeso(false); cargar()
    toast('Peso guardado')
  }
  async function actualizarPeso(id, form) { await supabase.from('peso_historial').update(form).eq('id', id); setPesoEditando(null); cargar(); toast('Peso guardado') }
  async function eliminarPeso(id) { if (!(await confirmar('¿Borrar este registro de peso?', { destructivo: true }))) return; await supabase.from('peso_historial').delete().eq('id', id); cargar() }

  async function crearAntropo(form) { await supabase.from('antropometria').insert(form); setFormAntropo(false); cargar() }
  async function actualizarAntropo(id, form) { await supabase.from('antropometria').update(form).eq('id', id); setAntropoEditando(null); cargar() }
  async function eliminarAntropo(id) { if (!(await confirmar('¿Borrar este registro?', { destructivo: true }))) return; await supabase.from('antropometria').delete().eq('id', id); cargar() }
  async function eliminarSuplemento(id) { if (!(await confirmar('¿Borrar este suplemento?', { destructivo: true }))) return; await supabase.from('suplementos').delete().eq('id', id); cargar() }

  async function cargarBebida(bebida, ml, fecha) {
    await supabase.from('hidratacion').insert({ fecha: fecha || fechaHidratacion, ml, bebida, hora: new Date().toTimeString().slice(0, 5) })
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

  const hoy = new Date().toISOString().slice(0, 10)
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

  const alertasNutricion = evaluarDeficitNutricional({ comidas, tdee, pesoKg: pesoActual?.peso || perfil?.peso })
  const pesoInicial = pesoHistorial[0] || null
  const diferenciaPeso = pesoActual && pesoInicial && pesoHistorial.length > 1 ? (pesoActual.peso - pesoInicial.peso) : null
  const graficoPeso = pesoHistorial.map((p) => ({ fecha: p.fecha, peso: p.peso }))

  const antropometriaAsc = [...antropometria].reverse()
  const graficoAntropo = antropometriaAsc
    .filter((a) => a[metricaGrafico] != null)
    .map((a) => ({ fecha: a.fecha, valor: a[metricaGrafico] }))
  const metricaActual = METRICAS_ANTROPOMETRIA.find((m) => m.id === metricaGrafico)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <IconoInsignia Icono={Apple} />
        <div>
          <h1 className="text-2xl font-bold">Nutrición</h1>
          <p className="text-ink-muted text-sm mt-1">Calorías, hidratación y composición corporal</p>
        </div>
      </div>

      <div className="flex gap-1 bg-asphalt-950 p-1 rounded-lg overflow-x-auto">
        {[['resumen', 'Resumen'], ['planes', 'Planes'], ['documentos', 'Documentos'], ['comidas', 'Comidas'], ['peso', 'Peso'], ['antropometria', 'Antropometría'], ['hidratacion', 'Hidratación'], ['suplementos', 'Suplementos']].map(([id, label]) => (
          <button key={id} onClick={() => setSub(id)} className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${sub === id ? 'bg-hiviz text-asphalt-950' : 'text-ink-muted'}`}>{label}</button>
        ))}
      </div>

      {sub === 'resumen' && (
        <>
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
                <div><span className="label-eyebrow">TDEE estimado</span><p className="readout text-xl font-bold mt-0.5 text-hiviz">{tdee} kcal</p></div>
              </div>
            ) : (
              <p className="text-ink-muted text-xs mt-3">
                Completá tus datos físicos para calcular tu gasto calórico. Tu peso se toma de la pestaña Peso.
              </p>
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
            <StatMini label="Kcal — hoy" value={kcalHoy.toFixed(0)} unit={tdee ? `/ ${tdee}` : ''} color="hiviz" />
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
        </>
      )}

      {sub === 'planes' && (
        <>
          <div className="flex justify-end">
            <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => { setPlanEditando(null); setFormPlanOpen((v) => !v) }}>+ Plan</button>
          </div>
          {formPlanOpen && <FormPlanNutricion onGuardar={crearPlan} onCancelar={() => setFormPlanOpen(false)} />}

          {registrandoComida && (
            <FormComida
              valoresIniciales={registrandoComida}
              onGuardar={crearComida}
              onCancelar={() => setRegistrandoComida(null)}
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
        </>
      )}

      {sub === 'documentos' && (
        <>
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
        </>
      )}

      {sub === 'comidas' && (
        <>
          <div className="flex justify-end">
            <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => { setComidaEditando(null); setFormComida((v) => !v) }}>+ Comida</button>
          </div>
          {formComida && <FormComida onGuardar={crearComida} onCancelar={() => setFormComida(false)} />}
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
                          <FormComida key={c.id} valoresIniciales={c} onGuardar={(n) => actualizarComida(c.id, n)} onCancelar={() => setComidaEditando(null)} />
                        ) : (
                          <div key={c.id} className="card flex items-center justify-between">
                            <div><p className="font-medium text-sm">{c.tipo}{c.descripcion ? ` — ${c.descripcion}` : ''}</p><p className="text-ink-muted text-xs">{c.hora || ''}</p></div>
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
        </>
      )}

      {sub === 'peso' && (
        <>
          <div className="flex justify-end"><button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => { setPesoEditando(null); setFormPeso((v) => !v) }}>+ Registro</button></div>
          {formPeso && <FormPeso onGuardar={crearPeso} onCancelar={() => setFormPeso(false)} />}
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
                  <span className="label-eyebrow">Evolución</span>
                  <div className="mt-2 -ml-4">
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={graficoPeso} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#262A33" vertical={false} />
                        <XAxis dataKey="fecha" tickFormatter={fmtFecha} tick={{ fill: '#8A8F9C', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#262A33' }} />
                        <YAxis tick={{ fill: '#8A8F9C', fontSize: 10 }} tickLine={false} axisLine={false} width={30} domain={['dataMin - 1', 'dataMax + 1']} />
                        <Tooltip contentStyle={{ background: '#1C1F26', border: '1px solid #262A33', borderRadius: 8, fontSize: 12 }} labelFormatter={fmtFecha} />
                        <Line type="monotone" dataKey="peso" stroke="#C4F135" strokeWidth={2} dot={{ r: 3 }} name="Peso (kg)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}
          {pesoHistorial.length > 0 && (
            <div className="flex flex-col gap-2">
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
        </>
      )}

      {sub === 'antropometria' && (
        <>
          <div className="flex justify-end"><button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => { setAntropoEditando(null); setFormAntropo((v) => !v) }}>+ Registro</button></div>

          {antropometria.length > 1 && (
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="label-eyebrow">Evolución</span>
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
                      <CartesianGrid stroke="#262A33" vertical={false} />
                      <XAxis dataKey="fecha" tickFormatter={fmtFecha} tick={{ fill: '#8A8F9C', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#262A33' }} />
                      <YAxis tick={{ fill: '#8A8F9C', fontSize: 10 }} tickLine={false} axisLine={false} width={30} domain={['dataMin - 1', 'dataMax + 1']} />
                      <Tooltip contentStyle={{ background: '#1C1F26', border: '1px solid #262A33', borderRadius: 8, fontSize: 12 }} labelFormatter={fmtFecha} />
                      <Line type="monotone" dataKey="valor" stroke={metricaActual.color} strokeWidth={2} dot={{ r: 3 }} name={metricaActual.label} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-ink-muted text-xs mt-2">No hay suficientes registros de "{metricaActual.label}" para graficar todavía.</p>
              )}
            </div>
          )}

          {formAntropo && <FormAntropometria onGuardar={crearAntropo} onCancelar={() => setFormAntropo(false)} />}
          {antropometria.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin registros de antropometría todavía.</p>
          ) : (
            <div className="flex flex-col gap-2">
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
        </>
      )}

      {sub === 'hidratacion' && (
        <>
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
        </>
      )}

      {sub === 'suplementos' && (
        <>
          <div className="flex justify-end"><button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => setFormSuplemento((v) => !v)}>+ Suplemento</button></div>
          {formSuplemento && (
            <FormSuplemento onGuardar={async (n) => { await supabase.from('suplementos').insert(n); setFormSuplemento(false); cargar() }} onCancelar={() => setFormSuplemento(false)} />
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

function FormComida({ onGuardar, onCancelar, valoresIniciales }) {
  const [form, setForm] = useState({ fecha: new Date().toISOString().slice(0, 10), hora: new Date().toTimeString().slice(0, 5), tipo: 'Desayuno', descripcion: '', kcal: '', proteinas: '', carbohidratos: '', grasas: '', ...valoresIniciales })
  const [buscadorAbierto, setBuscadorAbierto] = useState(false)
  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })

  function aplicarAlimento({ descripcion, kcal, proteinas, carbohidratos, grasas }) {
    setForm((f) => ({ ...f, descripcion: descripcion || f.descripcion, kcal, proteinas, carbohidratos, grasas }))
    setBuscadorAbierto(false)
  }

  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onGuardar(form) }}>
      <div className="col-span-2">
        <button type="button" onClick={() => setBuscadorAbierto((v) => !v)} className="border border-asphalt-700 text-hiviz font-semibold text-sm px-3 py-2 rounded-lg w-full">
          {buscadorAbierto ? 'Cerrar buscador' : '🔍 Buscar alimento (autocompleta macros)'}
        </button>
      </div>
      {buscadorAbierto && (
        <div className="col-span-2">
          <BuscadorAlimento onSeleccionar={aplicarAlimento} />
        </div>
      )}
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fecha</span><input type="date" {...campo('fecha')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Hora</span><input type="time" {...campo('hora')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Tipo</span><select {...campo('tipo')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">{TIPOS_COMIDA.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Descripción</span><input {...campo('descripcion')} placeholder="Avena con banana y miel" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Kcal</span><input type="number" {...campo('kcal')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Proteínas (g)</span><input type="number" {...campo('proteinas')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Carbohidratos (g)</span><input type="number" {...campo('carbohidratos')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Grasas (g)</span><input type="number" {...campo('grasas')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="col-span-2 flex justify-end gap-2 mt-1"><button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button><button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button></div>
    </form>
  )
}

function BuscadorAlimento({ onSeleccionar }) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState('')
  const [escaneando, setEscaneando] = useState(false)
  const [productoElegido, setProductoElegido] = useState(null)
  const [cantidad, setCantidad] = useState('100')

  async function buscar() {
    setError(''); setBuscando(true); setResultados([])
    try {
      const r = await buscarAlimentosPorTexto(texto)
      if (r.length === 0) setError('Sin resultados. Probá con otro nombre o cargá los macros a mano.')
      setResultados(r)
    } catch (err) {
      setError('No se pudo buscar (' + (err.message || 'error desconocido') + ')')
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
    } catch (err) {
      setError('No se pudo consultar el producto.')
    } finally {
      setBuscando(false)
    }
  }

  function confirmarCantidad() {
    const g = Number(cantidad) || 0
    const escala = g / 100
    onSeleccionar({
      descripcion: `${productoElegido.nombre}${productoElegido.marca ? ` (${productoElegido.marca})` : ''} — ${g}g`,
      kcal: productoElegido.kcal100g != null ? Math.round(productoElegido.kcal100g * escala) : '',
      proteinas: productoElegido.proteinas100g != null ? Math.round(productoElegido.proteinas100g * escala * 10) / 10 : '',
      carbohidratos: productoElegido.carbohidratos100g != null ? Math.round(productoElegido.carbohidratos100g * escala * 10) / 10 : '',
      grasas: productoElegido.grasas100g != null ? Math.round(productoElegido.grasas100g * escala * 10) / 10 : ''
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
          <p className="text-ink-faint text-xs mt-1">
            Por 100g: {productoElegido.kcal100g ?? '—'} kcal · P {productoElegido.proteinas100g ?? '—'} · C {productoElegido.carbohidratos100g ?? '—'} · G {productoElegido.grasas100g ?? '—'}
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted text-xs">¿Cuántos gramos comiste?</span>
          <input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="bg-asphalt-950 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" />
        </label>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => setProductoElegido(null)} className="text-ink-muted text-xs px-3 py-1.5">Elegir otro</button>
          <button type="button" onClick={confirmarCantidad} className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg">Usar estos valores</button>
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
          placeholder="Ej: yogur natural, banana..."
          className="flex-1 bg-asphalt-950 border border-asphalt-700 rounded-lg px-3 py-2 text-ink text-sm"
        />
        <button type="button" onClick={buscar} disabled={buscando} className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-2 rounded-lg disabled:opacity-60">
          {buscando ? '...' : 'Buscar'}
        </button>
      </div>
      <button type="button" onClick={() => setEscaneando(true)} className="text-hiviz text-xs font-semibold self-start">
        📷 Escanear código de barras
      </button>
      {error && <p className="text-alert-red text-xs">{error}</p>}
      {resultados.length > 0 && (
        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
          {resultados.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setProductoElegido(r)}
              className="text-left border border-asphalt-700 rounded-lg px-2.5 py-2 hover:border-hiviz"
            >
              <p className="text-xs font-medium">{r.nombre}{r.marca ? ` — ${r.marca}` : ''}</p>
              <p className="text-ink-faint text-[10px]">{r.kcal100g} kcal / 100g</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FormPeso({ onGuardar, onCancelar, valoresIniciales }) {
  const [form, setForm] = useState({ fecha: new Date().toISOString().slice(0, 10), peso: '', notas: '', ...valoresIniciales })
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
    fecha: new Date().toISOString().slice(0, 10), grasa_corporal_pct: '', masa_muscular_pct: '',
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
  const [fecha, setFecha] = useState(valoresIniciales?.fecha || fechaPorDefecto || new Date().toISOString().slice(0, 10))
  const [hora, setHora] = useState(valoresIniciales?.hora || new Date().toTimeString().slice(0, 5))
  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); if (ml) onGuardar(bebida, Number(ml), fecha, hora) }}>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fecha</span>
        <input type="date" value={fecha} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setFecha(e.target.value)} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
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
