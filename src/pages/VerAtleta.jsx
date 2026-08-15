import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { calcularTSS } from '../lib/tss'
import Avatar from '../components/Avatar'
import {
  parsearPlanillaBici, parsearPlanillaGimnasio, generarPlantillaBici, generarPlantillaGimnasio,
  descargarBlob, generarSesionesDesdeSemanas, generarFilasDesdeDias
} from '../lib/importarPlanilla'

const TIPOS = ['Ruta', 'MTB', 'Gravel', 'Rodillo', 'Pista', 'Descanso']
const EJERCICIOS_COMUNES = ['Sentadilla', 'Peso muerto', 'Press banca', 'Zancadas', 'Prensa', 'Core / plancha', 'Otro']
function fmtFecha(f) { const [, m, d] = f.split('-'); return `${d}/${m}` }
const DIA_POR_INDICE = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']
const DIAS_ADHERENCIA = 14
function diaIdDe(fecha) { return DIA_POR_INDICE[new Date(fecha + 'T12:00:00').getDay()] }
const NIVELES_ACTIVIDAD = [
  { id: 'sedentario', label: 'Sedentario', factor: 1.2 },
  { id: 'ligero', label: 'Entreno ligero (1-3 d/sem)', factor: 1.375 },
  { id: 'moderado', label: 'Entreno moderado (3-5 d/sem)', factor: 1.55 },
  { id: 'alto', label: 'Entreno intenso (6-7 d/sem)', factor: 1.725 },
  { id: 'muy_alto', label: 'Doble sesión / muy intenso', factor: 1.9 }
]
function calcularBMR({ peso, altura, edad, sexo }) {
  const p = Number(peso), a = Number(altura), e = Number(edad)
  if (!p || !a || !e) return null
  return sexo === 'F' ? 10 * p + 6.25 * a - 5 * e - 161 : 10 * p + 6.25 * a - 5 * e + 5
}

const TIPOS_COMIDA = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Snack', 'Intra-entreno']
const DIAS_SEMANA = [
  { id: 'lun', label: 'Lun' },
  { id: 'mar', label: 'Mar' },
  { id: 'mie', label: 'Mié' },
  { id: 'jue', label: 'Jue' },
  { id: 'vie', label: 'Vie' },
  { id: 'sab', label: 'Sáb' },
  { id: 'dom', label: 'Dom' }
]

export default function VerAtleta() {
  const { id: atletaId } = useParams()
  const [searchParams] = useSearchParams()
  const rol = searchParams.get('rol') || 'entrenador'
  const esNutricionista = rol === 'nutricionista'
  const esEntrenador = rol === 'entrenador'

  const [email, setEmail] = useState('')
  const [nombreAtleta, setNombreAtleta] = useState('')
  const [avatarAtleta, setAvatarAtleta] = useState('')
  const [entrenamientos, setEntrenamientos] = useState([])
  const [gimnasio, setGimnasio] = useState([])
  const [comidas, setComidas] = useState([])
  const [planesEntreno, setPlanesEntreno] = useState([])
  const [planesGimnasio, setPlanesGimnasio] = useState([])
  const [seccion, setSeccion] = useState('resumen') // 'resumen' | 'planes-entreno' | 'planes-gym' | 'plan-bloques'
  const inputBiciRef = useRef(null)
  const inputGymRef = useRef(null)
  const [formPlanEntrenoOpen, setFormPlanEntrenoOpen] = useState(false)
  const [planEntrenoEditando, setPlanEntrenoEditando] = useState(null)
  const [formPlanGymOpen, setFormPlanGymOpen] = useState(false)
  const [planGymEditando, setPlanGymEditando] = useState(null)
  const [feedbackPorEntreno, setFeedbackPorEntreno] = useState({})
  const [comentandoId, setComentandoId] = useState(null)
  const [tipoComparar, setTipoComparar] = useState('')
  const [perfilNutri, setPerfilNutri] = useState(null)
  const [editandoPerfil, setEditandoPerfil] = useState(false)
  const [planesNutricion, setPlanesNutricion] = useState([])
  const [formPlanNutriOpen, setFormPlanNutriOpen] = useState(false)
  const [planNutriEditando, setPlanNutriEditando] = useState(null)
  const [documentosNutricion, setDocumentosNutricion] = useState([])
  const [subiendoArchivoAtleta, setSubiendoArchivoAtleta] = useState(false)
  const [errorArchivoAtleta, setErrorArchivoAtleta] = useState('')
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    setCargando(true)
    const desde30 = new Date()
    desde30.setDate(desde30.getDate() - 30)
    const fechaDesde = desde30.toISOString().slice(0, 10)

    const { data: perfilData, error: errorPerfil } = await supabase.rpc('perfil_de_vinculado', { p_user_id: atletaId })
    if (!errorPerfil && perfilData) {
      setEmail(perfilData.email || 'Atleta')
      setNombreAtleta(perfilData.nombre || '')
      setAvatarAtleta(perfilData.avatar_url || '')
    } else {
      const { data: emailData } = await supabase.rpc('email_de_vinculado', { p_user_id: atletaId })
      setEmail(emailData || 'Atleta')
    }

    const [{ data: ents }, { data: gym }, { data: plsE }, { data: plsG }] = await Promise.all([
      supabase.from('entrenamientos').select('*').eq('user_id', atletaId).gte('fecha', fechaDesde).order('fecha', { ascending: false }),
      supabase.from('gimnasio').select('*').eq('user_id', atletaId).gte('fecha', fechaDesde).order('fecha', { ascending: false }),
      supabase.from('planes_entrenamiento').select('*').eq('user_id', atletaId).eq('activo', true).order('created_at', { ascending: true }),
      supabase.from('planes_gimnasio').select('*').eq('user_id', atletaId).eq('activo', true).order('created_at', { ascending: true })
    ])
    setEntrenamientos(ents || [])
    setGimnasio(gym || [])
    setPlanesEntreno(plsE || [])
    setPlanesGimnasio(plsG || [])

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

    if (esNutricionista) {
      const { data: cms } = await supabase.from('comidas').select('*').eq('user_id', atletaId).gte('fecha', fechaDesde)
      setComidas(cms || [])
      const { data: perfil } = await supabase.from('perfil_nutricional').select('*').eq('user_id', atletaId).maybeSingle()
      setPerfilNutri(perfil || { peso: '', altura: '', edad: '', sexo: 'M', nivel_actividad: 'moderado' })
      const { data: planesNutri } = await supabase.from('planes_nutricion').select('*').eq('user_id', atletaId).eq('activo', true).order('created_at', { ascending: true })
      setPlanesNutricion(planesNutri || [])
      const { data: docsNutri } = await supabase.from('documentos_nutricion').select('*').eq('user_id', atletaId).order('created_at', { ascending: false })
      setDocumentosNutricion(docsNutri || [])
    }
    setCargando(false)
  }

  useEffect(() => { cargar() }, [atletaId, rol])

  async function crearPlanEntreno(form) {
    await supabase.from('planes_entrenamiento').insert({ ...form, user_id: atletaId })
    setFormPlanEntrenoOpen(false)
    cargar()
  }
  async function actualizarPlanEntreno(id, form) {
    await supabase.from('planes_entrenamiento').update(form).eq('id', id)
    setPlanEntrenoEditando(null)
    cargar()
  }
  async function borrarPlanEntreno(id) {
    if (!confirm('¿Borrar este plan?')) return
    await supabase.from('planes_entrenamiento').update({ activo: false }).eq('id', id)
    cargar()
  }

  async function crearPlanGym(form) {
    await supabase.from('planes_gimnasio').insert({ ...form, user_id: atletaId })
    setFormPlanGymOpen(false)
    cargar()
  }
  async function actualizarPlanGym(id, form) {
    await supabase.from('planes_gimnasio').update(form).eq('id', id)
    setPlanGymEditando(null)
    cargar()
  }

  async function importarBloqueBici(e) {
    const file = e.target.files[0]; e.target.value = ''
    if (!file) return
    try {
      const json = /\.(xlsx|xls|csv)$/i.test(file.name)
        ? await parsearPlanillaBici(file)
        : JSON.parse(await file.text())
      if (!json.nombre || !Array.isArray(json.semanas)) { alert('El archivo no tiene el formato esperado (falta "nombre" o "semanas").'); return }
      const { semanas, ...meta } = json
      const { data: nuevo, error } = await supabase.from('mesociclos').insert({ ...meta, semanas, user_id: atletaId }).select().single()
      if (error) { alert('No se pudo asignar el mesociclo: ' + error.message + '\n\nSi el error menciona permisos (RLS), la tabla "mesociclos" todavía no tiene la política que deja a un profesional vinculado crear bloques a nombre de su atleta — hay que agregarla en Supabase.'); return }
      const lunes = new Date(meta.fecha_inicio + 'T12:00:00')
      const sesiones = generarSesionesDesdeSemanas(lunes, semanas, nuevo.id, atletaId)
      if (sesiones.length > 0) await supabase.from('entrenamientos').insert(sesiones)
      alert(`Mesociclo "${json.nombre}" asignado a ${nombreAtleta || email}.`)
      cargar()
    } catch (err) {
      alert('No se pudo importar: ' + err.message)
    }
  }

  async function importarBloqueGym(e) {
    const file = e.target.files[0]; e.target.value = ''
    if (!file) return
    try {
      const json = /\.(xlsx|xls|csv)$/i.test(file.name)
        ? await parsearPlanillaGimnasio(file)
        : JSON.parse(await file.text())
      if (!json.nombre || !Array.isArray(json.dias)) { alert('El archivo no tiene el formato esperado (falta "nombre" o "dias").'); return }
      const { dias, ...meta } = json
      const { data: nuevo, error } = await supabase.from('mesociclos_gimnasio').insert({ ...meta, semanas: dias, user_id: atletaId }).select().single()
      if (error) { alert('No se pudo asignar la rutina: ' + error.message + '\n\nSi el error menciona permisos (RLS), la tabla "mesociclos_gimnasio" todavía no tiene la política que deja a un profesional vinculado crear rutinas a nombre de su atleta — hay que agregarla en Supabase.'); return }
      const fechaInicioBase = new Date(meta.fecha_inicio + 'T12:00:00')
      const filas = generarFilasDesdeDias(fechaInicioBase, dias, nuevo.id, atletaId)
      if (filas.length > 0) await supabase.from('gimnasio').insert(filas)
      alert(`Rutina "${json.nombre}" asignada a ${nombreAtleta || email}.`)
      cargar()
    } catch (err) {
      alert('No se pudo importar: ' + err.message)
    }
  }

  async function bajarPlantillaBici() { descargarBlob(await generarPlantillaBici(), 'plantilla_bici.xlsx') }
  async function bajarPlantillaGym() { descargarBlob(await generarPlantillaGimnasio(), 'plantilla_gimnasio.xlsx') }

  async function crearFeedback(entrenamientoId, comentario) {
    if (!comentario.trim()) return
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('feedback_entrenamientos').insert({
      entrenamiento_id: entrenamientoId,
      atleta_id: atletaId,
      profesional_id: userData.user.id,
      comentario: comentario.trim()
    })
    setComentandoId(null)
    cargar()
  }

  async function guardarPerfilNutri(datos) {
    const { error } = await supabase.from('perfil_nutricional').upsert({ ...datos, user_id: atletaId })
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setEditandoPerfil(false)
    cargar()
  }

  async function crearPlanNutricion(form) {
    const { error } = await supabase.from('planes_nutricion').insert({ ...form, user_id: atletaId })
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setFormPlanNutriOpen(false)
    cargar()
  }
  async function actualizarPlanNutricion(id, form) {
    const { error } = await supabase.from('planes_nutricion').update(form).eq('id', id)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setPlanNutriEditando(null)
    cargar()
  }
  async function borrarPlanNutricion(id) {
    if (!confirm('¿Borrar este plan de comidas?')) return
    await supabase.from('planes_nutricion').update({ activo: false }).eq('id', id)
    cargar()
  }

  async function subirDocumentoAtleta(file) {
    if (!file) return
    setErrorArchivoAtleta('')
    setSubiendoArchivoAtleta(true)
    try {
      const rutaStorage = `${atletaId}/${Date.now()}-${file.name}`
      const { error: errSubida } = await supabase.storage.from('documentos-nutricion').upload(rutaStorage, file)
      if (errSubida) throw errSubida
      const { error: errFila } = await supabase.from('documentos_nutricion').insert({
        user_id: atletaId, nombre: file.name, ruta_storage: rutaStorage, tipo_archivo: file.type
      })
      if (errFila) throw errFila
      cargar()
    } catch (err) {
      setErrorArchivoAtleta('No se pudo subir el archivo: ' + (err.message || ''))
    } finally {
      setSubiendoArchivoAtleta(false)
    }
  }

  async function verDocumentoAtleta(doc) {
    const { data, error } = await supabase.storage.from('documentos-nutricion').createSignedUrl(doc.ruta_storage, 60)
    if (error) { alert('No se pudo abrir el archivo: ' + error.message); return }
    window.open(data.signedUrl, '_blank')
  }

  async function borrarDocumentoAtleta(doc) {
    if (!confirm(`¿Borrar "${doc.nombre}"?`)) return
    await supabase.storage.from('documentos-nutricion').remove([doc.ruta_storage])
    await supabase.from('documentos_nutricion').delete().eq('id', doc.id)
    cargar()
  }

  async function borrarPlanGym(id) {
    if (!confirm('¿Borrar esta rutina?')) return
    await supabase.from('planes_gimnasio').update({ activo: false }).eq('id', id)
    cargar()
  }

  if (cargando) return <p className="text-ink-muted text-sm">Cargando…</p>

  const kmTotal = entrenamientos.reduce((a, e) => a + (Number(e.km) || 0), 0)
  const horasTotal = entrenamientos.reduce((a, e) => a + (Number(e.duracion_min) || 0), 0) / 60
  const tssTotal = entrenamientos.reduce((a, e) => a + calcularTSS(e), 0)
  const volumenGym = gimnasio.reduce((a, g) => a + (Number(g.series) || 0) * (Number(g.reps) || 0) * (Number(g.peso) || 0), 0)
  const diasConComida = new Set(comidas.map((c) => c.fecha)).size || 1
  const kcalProm = comidas.reduce((a, c) => a + (Number(c.kcal) || 0), 0) / diasConComida

  const diasEvaluados = []
  const cursorAdh = new Date()
  cursorAdh.setDate(cursorAdh.getDate() - (DIAS_ADHERENCIA - 1))
  for (let i = 0; i < DIAS_ADHERENCIA; i++) {
    diasEvaluados.push(cursorAdh.toISOString().slice(0, 10))
    cursorAdh.setDate(cursorAdh.getDate() + 1)
  }
  let diasEsperadosEntreno = 0, diasCumplidosEntreno = 0
  for (const fecha of diasEvaluados) {
    const diaId = diaIdDe(fecha)
    const seEspera = planesEntreno.some((p) => (p.sesiones || []).some((s) => s.dia === diaId && s.tipo !== 'Descanso'))
    if (!seEspera) continue
    diasEsperadosEntreno++
    if (entrenamientos.some((e) => e.fecha === fecha && e.estado === 'realizado')) diasCumplidosEntreno++
  }
  let diasEsperadosGym = 0, diasCumplidosGym = 0
  for (const fecha of diasEvaluados) {
    const diaId = diaIdDe(fecha)
    const seEspera = planesGimnasio.some((p) => (p.dias_semana || []).includes(diaId))
    if (!seEspera) continue
    diasEsperadosGym++
    if (gimnasio.some((g) => g.fecha === fecha && g.estado === 'realizado')) diasCumplidosGym++
  }
  const diasEsperadosTotal = diasEsperadosEntreno + diasEsperadosGym
  const diasCumplidosTotal = diasCumplidosEntreno + diasCumplidosGym
  const adherenciaPct = diasEsperadosTotal > 0 ? Math.round((diasCumplidosTotal / diasEsperadosTotal) * 100) : null
  const colorAdherencia = adherenciaPct == null ? 'rgb(var(--color-state-neutral))' : adherenciaPct >= 80 ? 'rgb(var(--color-state-success))' : adherenciaPct >= 50 ? 'rgb(var(--color-state-warning))' : 'rgb(var(--color-state-critical))'

  return (
    <div className="flex flex-col gap-6">
      <Link to="/equipo" className="text-ink-muted text-sm">← Equipo</Link>

      <div>
        <div className="flex items-center gap-3">
          <Avatar url={avatarAtleta} nombre={nombreAtleta || email} size={40} />
          <h1 className="text-2xl font-bold">{nombreAtleta || email}</h1>
        </div>
        <p className="text-ink-muted text-sm mt-1">Sos su {rol} · últimos 30 días</p>
      </div>

      {(esEntrenador || esNutricionista) && (
        <div className="flex gap-1 bg-asphalt-950 p-1 rounded-lg overflow-x-auto">
          {[
            ['resumen', 'Resumen'],
            ...(esEntrenador ? [['planes-entreno', 'Planes de entrenamiento'], ['planes-gym', 'Rutinas de gimnasio'], ['plan-bloques', 'Plan por bloques (Excel)']] : []),
            ...(esNutricionista ? [['planes-nutricion', 'Planes de nutrición'], ['documentos-nutricion', 'Documentos']] : [])
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSeccion(id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${seccion === id ? 'bg-hiviz text-asphalt-950' : 'text-ink-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {seccion === 'resumen' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Dato label="Km" value={kmTotal.toFixed(0)} />
            <Dato label="Horas" value={horasTotal.toFixed(1)} />
            <Dato label="TSS acumulado" value={tssTotal.toFixed(0)} accent />
            <Dato label="Volumen gym (kg)" value={volumenGym.toLocaleString('es-AR')} />
          </div>

          {esEntrenador && diasEsperadosTotal > 0 && (
            <div className="card" style={{ borderColor: colorAdherencia }}>
              <span className="label-eyebrow">Adherencia al plan — últimos {DIAS_ADHERENCIA} días</span>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="readout text-3xl font-bold" style={{ color: colorAdherencia }}>{adherenciaPct}%</span>
                <span className="text-sm text-ink-muted">{diasCumplidosTotal} de {diasEsperadosTotal} días planificados</span>
              </div>
              <div className="w-full h-1.5 bg-asphalt-700 rounded-full mt-3 overflow-hidden">
                <div className="h-full" style={{ width: `${adherenciaPct}%`, background: colorAdherencia }} />
              </div>
              <div className="flex gap-4 mt-2.5">
                {diasEsperadosEntreno > 0 && <span className="text-ink-muted text-xs">Entrenamiento: {diasCumplidosEntreno}/{diasEsperadosEntreno}</span>}
                {diasEsperadosGym > 0 && <span className="text-ink-muted text-xs">Gimnasio: {diasCumplidosGym}/{diasEsperadosGym}</span>}
              </div>
            </div>
          )}

          {esNutricionista && (
            <div className="card">
              <span className="label-eyebrow">Nutrición — promedio diario</span>
              <p className="readout text-2xl font-bold text-hiviz mt-1">{kcalProm.toFixed(0)} kcal/día</p>
              <p className="text-ink-muted text-xs mt-1">{comidas.length} comidas registradas en el período</p>
            </div>
          )}

          {esNutricionista && perfilNutri && (
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="label-eyebrow">Perfil y necesidades calóricas</span>
                <button onClick={() => setEditandoPerfil((v) => !v)} className="text-hiviz text-xs">{editandoPerfil ? 'Cerrar' : 'Editar'}</button>
              </div>
              {editandoPerfil ? (
                <FormPerfilNutri valoresIniciales={perfilNutri} onGuardar={guardarPerfilNutri} onCancelar={() => setEditandoPerfil(false)} />
              ) : (
                (() => {
                  const bmr = calcularBMR(perfilNutri)
                  const nivel = NIVELES_ACTIVIDAD.find((n) => n.id === perfilNutri.nivel_actividad) || NIVELES_ACTIVIDAD[2]
                  const tdee = bmr ? Math.round(bmr * nivel.factor) : null
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      <MiniDato label="Peso" value={perfilNutri.peso ? `${perfilNutri.peso} kg` : '—'} />
                      <MiniDato label="Altura" value={perfilNutri.altura ? `${perfilNutri.altura} cm` : '—'} />
                      <MiniDato label="Edad" value={perfilNutri.edad || '—'} />
                      <MiniDato label="TDEE estimado" value={tdee ? `${tdee} kcal` : '—'} accent />
                    </div>
                  )
                })()
              )}
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold mb-2">Entrenamientos recientes</h2>
            {entrenamientos.length === 0 ? (
              <p className="text-ink-muted text-sm">Sin entrenamientos en los últimos 30 días.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {entrenamientos.slice(0, 10).map((e) => {
                  const comentarios = feedbackPorEntreno[e.id] || []
                  return (
                    <div key={e.id} className="card">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{e.tipo} — {e.ruta || 'sin ruta'}</p>
                          <p className="text-ink-muted text-xs">{e.fecha}</p>
                        </div>
                        <div className="flex gap-3 text-right">
                          <MiniDato label="km" value={e.km} />
                          <MiniDato label="min" value={e.duracion_min} />
                          <MiniDato label="TSS" value={e.tss} accent />
                        </div>
                      </div>

                      {e.comentarios && (
                        <div className="mt-2.5 pt-2.5 border-t border-asphalt-700">
                          <p className="text-ink-muted text-xs">
                            <span className="text-ink-faint font-medium">El atleta escribió:</span> {e.comentarios}
                          </p>
                        </div>
                      )}

                      {comentarios.length > 0 && (
                        <div className="flex flex-col gap-1.5 mt-2.5 pt-2.5 border-t border-asphalt-700">
                          {comentarios.map((c) => (
                            <p key={c.id} className="text-ink-muted text-xs">
                              <span className="text-hiviz">Tu feedback:</span> {c.comentario}
                            </p>
                          ))}
                        </div>
                      )}

                      {esEntrenador && (
                        comentandoId === e.id ? (
                          <FormFeedback onGuardar={(texto) => crearFeedback(e.id, texto)} onCancelar={() => setComentandoId(null)} />
                        ) : (
                          <button onClick={() => setComentandoId(e.id)} className="text-hiviz text-xs mt-2.5">
                            {comentarios.length > 0 ? '+ Agregar otro comentario' : '+ Dar feedback'}
                          </button>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {esEntrenador && entrenamientos.length > 1 && (
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="label-eyebrow">Comparar entrenamientos similares</span>
                <select
                  value={tipoComparar}
                  onChange={(e) => setTipoComparar(e.target.value)}
                  className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1 text-ink text-xs"
                >
                  <option value="">Elegí un tipo</option>
                  {[...new Set(entrenamientos.map((e) => e.tipo))].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {tipoComparar ? (
                (() => {
                  const datos = [...entrenamientos]
                    .filter((e) => e.tipo === tipoComparar)
                    .sort((a, b) => a.fecha.localeCompare(b.fecha))
                    .map((e) => ({ fecha: e.fecha, tss: e.tss, potencia: e.potencia_avg }))
                  return datos.length > 1 ? (
                    <div className="mt-2 -ml-4">
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={datos} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke="#262A33" vertical={false} />
                          <XAxis dataKey="fecha" tickFormatter={fmtFecha} tick={{ fill: '#8A8F9C', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#262A33' }} />
                          <YAxis tick={{ fill: '#8A8F9C', fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
                          <Tooltip contentStyle={{ background: '#1C1F26', border: '1px solid #262A33', borderRadius: 8, fontSize: 12 }} labelFormatter={fmtFecha} />
                          <Line type="monotone" dataKey="tss" stroke="#C4F135" strokeWidth={2} dot={{ r: 3 }} name="TSS" />
                          <Line type="monotone" dataKey="potencia" stroke="#4A9EFF" strokeWidth={2} dot={{ r: 3 }} name="Potencia (W)" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-ink-muted text-xs mt-2">Necesita al menos 2 sesiones de tipo "{tipoComparar}" en los últimos 30 días.</p>
                  )
                })()
              ) : (
                <p className="text-ink-muted text-xs mt-2">Elegí un tipo de entrenamiento para ver su evolución (TSS y potencia) en el período.</p>
              )}
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold mb-2">Gimnasio reciente</h2>
            {gimnasio.length === 0 ? (
              <p className="text-ink-muted text-sm">Sin sesiones de gimnasio en los últimos 30 días.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {gimnasio.slice(0, 10).map((g) => (
                  <div key={g.id} className="card flex items-center justify-between">
                    <p className="text-sm font-medium">{g.ejercicio}</p>
                    <div className="flex gap-3 text-right">
                      <MiniDato label="series" value={g.series} />
                      <MiniDato label="reps" value={g.reps} />
                      <MiniDato label="kg" value={g.peso} accent />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {seccion === 'planes-entreno' && esEntrenador && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Planes de entrenamiento</h2>
            <button
              onClick={() => { setPlanEntrenoEditando(null); setFormPlanEntrenoOpen((v) => !v) }}
              className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg"
            >
              + Plan
            </button>
          </div>

          {formPlanEntrenoOpen && (
            <FormPlanEntreno onGuardar={crearPlanEntreno} onCancelar={() => setFormPlanEntrenoOpen(false)} />
          )}

          {planesEntreno.length === 0 ? (
            <p className="text-ink-muted text-sm">Todavía no le asignaste ningún plan de entrenamiento.</p>
          ) : (
            <div className="flex flex-col gap-3 mt-2">
              {planesEntreno.map((p) =>
                planEntrenoEditando === p.id ? (
                  <FormPlanEntreno
                    key={p.id}
                    valoresIniciales={p}
                    onGuardar={(datos) => actualizarPlanEntreno(p.id, datos)}
                    onCancelar={() => setPlanEntrenoEditando(null)}
                  />
                ) : (
                  <div key={p.id} className="card">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{p.nombre}</p>
                      <div className="flex gap-1">
                        <button onClick={() => { setFormPlanEntrenoOpen(false); setPlanEntrenoEditando(p.id) }} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Editar</button>
                        <button onClick={() => borrarPlanEntreno(p.id)} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 mt-2.5">
                      {DIAS_SEMANA.map((d) => {
                        const sesion = (p.sesiones || []).find((s) => s.dia === d.id)
                        return (
                          <div key={d.id} className="flex items-center gap-2 text-xs">
                            <span className={`w-8 text-center py-0.5 rounded ${sesion ? 'bg-hiviz text-asphalt-950 font-semibold' : 'text-ink-faint border border-asphalt-700'}`}>{d.label}</span>
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
        </div>
      )}

      {seccion === 'planes-gym' && esEntrenador && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Rutinas de gimnasio</h2>
            <button
              onClick={() => { setPlanGymEditando(null); setFormPlanGymOpen((v) => !v) }}
              className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg"
            >
              + Rutina
            </button>
          </div>

          {formPlanGymOpen && (
            <FormPlanGimnasio onGuardar={crearPlanGym} onCancelar={() => setFormPlanGymOpen(false)} />
          )}

          {planesGimnasio.length === 0 ? (
            <p className="text-ink-muted text-sm">Todavía no le asignaste ninguna rutina de gimnasio.</p>
          ) : (
            <div className="flex flex-col gap-3 mt-2">
              {planesGimnasio.map((p) =>
                planGymEditando === p.id ? (
                  <FormPlanGimnasio
                    key={p.id}
                    valoresIniciales={p}
                    onGuardar={(datos) => actualizarPlanGym(p.id, datos)}
                    onCancelar={() => setPlanGymEditando(null)}
                  />
                ) : (
                  <div key={p.id} className="card">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{p.nombre}</p>
                      <div className="flex gap-1">
                        <button onClick={() => { setFormPlanGymOpen(false); setPlanGymEditando(p.id) }} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Editar</button>
                        <button onClick={() => borrarPlanGym(p.id)} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
                      </div>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      {DIAS_SEMANA.map((d) => (
                        <span
                          key={d.id}
                          className={`text-[10px] px-1.5 py-0.5 rounded ${(p.dias_semana || []).includes(d.id) ? 'bg-hiviz text-asphalt-950 font-semibold' : 'text-ink-faint border border-asphalt-700'}`}
                        >
                          {d.label}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2.5 flex flex-col gap-1">
                      {(p.ejercicios || []).map((ej, i) => (
                        <p key={i} className="text-ink-muted text-xs">{ej.ejercicio} — {ej.series}x{ej.reps}</p>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {seccion === 'plan-bloques' && esEntrenador && (
        <div className="flex flex-col gap-4">
          <p className="text-ink-muted text-sm">
            Bloques de 4 semanas (bici o gimnasio) desde una planilla de Excel/Google Sheets. Bajá la plantilla, completala con el plan de {nombreAtleta || 'tu atleta'} y subila acá — se carga directo en su cuenta, sin que tenga que hacer nada.
          </p>

          <div className="card">
            <p className="font-semibold text-sm">Ciclismo</p>
            <p className="text-ink-muted text-xs mt-0.5">Mesociclo de 4 semanas (sesiones día a día, zonas, series).</p>
            <div className="flex gap-2 mt-3">
              <button onClick={bajarPlantillaBici} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-3 py-1.5">Descargar plantilla</button>
              <input ref={inputBiciRef} type="file" accept=".xlsx,.xls,.csv,.json,application/json" className="hidden" onChange={importarBloqueBici} />
              <button onClick={() => inputBiciRef.current?.click()} className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg">Subir planilla completada</button>
            </div>
          </div>

          <div className="card">
            <p className="font-semibold text-sm">Gimnasio</p>
            <p className="text-ink-muted text-xs mt-0.5">Mesociclo de 4 semanas (ejercicios por día, series/reps/RPE por semana).</p>
            <div className="flex gap-2 mt-3">
              <button onClick={bajarPlantillaGym} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-3 py-1.5">Descargar plantilla</button>
              <input ref={inputGymRef} type="file" accept=".xlsx,.xls,.csv,.json,application/json" className="hidden" onChange={importarBloqueGym} />
              <button onClick={() => inputGymRef.current?.click()} className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg">Subir planilla completada</button>
            </div>
          </div>

          <p className="text-ink-faint text-[11px]">
            El bloque queda visible para {nombreAtleta || 'el atleta'} en su propia app (Entrenamientos → Mesociclo / Gimnasio → Planificación). Si subís uno nuevo no borra bloques anteriores.
          </p>
        </div>
      )}

      {seccion === 'planes-nutricion' && esNutricionista && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Planes de nutrición</h2>
            <button
              onClick={() => { setPlanNutriEditando(null); setFormPlanNutriOpen((v) => !v) }}
              className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg"
            >
              + Plan
            </button>
          </div>

          {formPlanNutriOpen && (
            <FormPlanNutricion onGuardar={crearPlanNutricion} onCancelar={() => setFormPlanNutriOpen(false)} />
          )}

          {planesNutricion.length === 0 ? (
            <p className="text-ink-muted text-sm">Todavía no le asignaste ningún plan de comidas.</p>
          ) : (
            <div className="flex flex-col gap-3 mt-2">
              {planesNutricion.map((p) =>
                planNutriEditando === p.id ? (
                  <FormPlanNutricion
                    key={p.id}
                    valoresIniciales={p}
                    onGuardar={(datos) => actualizarPlanNutricion(p.id, datos)}
                    onCancelar={() => setPlanNutriEditando(null)}
                  />
                ) : (
                  <div key={p.id} className="card">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{p.nombre}</p>
                      <div className="flex gap-1">
                        <button onClick={() => { setFormPlanNutriOpen(false); setPlanNutriEditando(p.id) }} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Editar</button>
                        <button onClick={() => borrarPlanNutricion(p.id)} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 mt-2.5">
                      {(p.comidas || []).map((c, i) => (
                        <p key={i} className="text-ink-muted text-xs">
                          <span className="text-ink font-medium">{c.momento}</span>{c.nombre ? ` — ${c.nombre}` : ''}
                          {c.kcal_objetivo ? ` · ${c.kcal_objetivo} kcal` : ''}{c.proteinas_objetivo ? ` · ${c.proteinas_objetivo}g prot` : ''}
                        </p>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
      {seccion === 'documentos-nutricion' && esNutricionista && (
        <div>
          <div className="card">
            <span className="label-eyebrow">Subir plan de comidas (PDF o foto)</span>
            <p className="text-ink-muted text-xs mt-1.5">
              Subí el plan de comidas de tu atleta en PDF o como foto, para que lo tenga siempre a mano dentro de la app.
            </p>
            <label className="inline-block mt-3">
              <span className="border border-asphalt-700 text-ink-muted font-semibold text-sm px-4 py-2.5 rounded-lg inline-block cursor-pointer hover:text-ink hover:border-hiviz">
                {subiendoArchivoAtleta ? 'Subiendo…' : 'Elegir archivo'}
              </span>
              <input
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                disabled={subiendoArchivoAtleta}
                onChange={(e) => { subirDocumentoAtleta(e.target.files[0]); e.target.value = '' }}
              />
            </label>
            {errorArchivoAtleta && <p className="text-alert-red text-xs mt-3">{errorArchivoAtleta}</p>}
          </div>

          {documentosNutricion.length === 0 ? (
            <p className="text-ink-muted text-sm mt-3">Sin documentos subidos todavía.</p>
          ) : (
            <div className="flex flex-col gap-2 mt-3">
              {documentosNutricion.map((doc) => (
                <div key={doc.id} className="card flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{doc.nombre}</p>
                    <p className="text-ink-muted text-xs">{new Date(doc.created_at).toLocaleDateString('es-AR')}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => verDocumentoAtleta(doc)} className="text-hiviz text-xs border border-asphalt-700 rounded-lg px-2 py-1">Ver</button>
                    <button onClick={() => borrarDocumentoAtleta(doc)} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Dato({ label, value, accent }) {
  return (
    <div className="card">
      <span className="label-eyebrow">{label}</span>
      <p className={`readout text-lg font-semibold mt-1 ${accent ? 'text-hiviz' : ''}`}>{value}</p>
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
                <input type="checkbox" checked={!!s.activo} onChange={(e) => actualizarDia(d.id, { activo: e.target.checked })} />
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

function FormPlanGimnasio({ onGuardar, onCancelar, valoresIniciales }) {
  const [nombre, setNombre] = useState(valoresIniciales?.nombre || '')
  const [dias, setDias] = useState(valoresIniciales?.dias_semana || [])
  const [ejercicios, setEjercicios] = useState(valoresIniciales?.ejercicios || [{ ejercicio: 'Sentadilla', series: 4, reps: 8 }])

  function toggleDia(id) {
    setDias((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]))
  }
  function actualizarEjercicio(i, campo, valor) {
    setEjercicios((ejs) => ejs.map((e, idx) => (idx === i ? { ...e, [campo]: valor } : e)))
  }
  function agregarEjercicio() {
    setEjercicios((ejs) => [...ejs, { ejercicio: 'Sentadilla', series: 3, reps: 10 }])
  }
  function quitarEjercicio(i) {
    setEjercicios((ejs) => ejs.filter((_, idx) => idx !== i))
  }

  return (
    <form
      className="card flex flex-col gap-3"
      onSubmit={(e) => { e.preventDefault(); onGuardar({ nombre, dias_semana: dias, ejercicios }) }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted text-xs">Nombre de la rutina</span>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          placeholder="Tren superior / Piernas / Full body"
          className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink"
        />
      </label>

      <div>
        <span className="text-ink-muted text-xs">Días de la semana</span>
        <div className="flex gap-1.5 mt-1.5">
          {DIAS_SEMANA.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => toggleDia(d.id)}
              className={`flex-1 text-center py-1.5 rounded-md text-xs border ${
                dias.includes(d.id) ? 'bg-hiviz text-asphalt-950 border-hiviz font-semibold' : 'border-asphalt-700 text-ink-muted'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-ink-muted text-xs">Ejercicios</span>
        <div className="flex flex-col gap-2 mt-1.5">
          {ejercicios.map((ej, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 items-end">
              <select
                value={ej.ejercicio}
                onChange={(e) => actualizarEjercicio(i, 'ejercicio', e.target.value)}
                className="col-span-2 bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm"
              >
                {EJERCICIOS_COMUNES.map((e) => <option key={e}>{e}</option>)}
              </select>
              <input
                type="number"
                value={ej.series}
                onChange={(e) => actualizarEjercicio(i, 'series', e.target.value)}
                placeholder="Series"
                className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm"
              />
              <div className="flex gap-1">
                <input
                  type="number"
                  value={ej.reps}
                  onChange={(e) => actualizarEjercicio(i, 'reps', e.target.value)}
                  placeholder="Reps"
                  className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm w-full"
                />
                <button type="button" onClick={() => quitarEjercicio(i)} className="text-alert-red text-xs px-2">✕</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={agregarEjercicio} className="text-hiviz text-xs mt-2">+ Agregar ejercicio</button>
      </div>

      <div className="flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar rutina</button>
      </div>
    </form>
  )
}

function FormFeedback({ onGuardar, onCancelar }) {
  const [texto, setTexto] = useState('')
  return (
    <form
      className="mt-2.5 pt-2.5 border-t border-asphalt-700 flex flex-col gap-2"
      onSubmit={(e) => { e.preventDefault(); onGuardar(texto) }}
    >
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={2}
        placeholder="Cómo viste esta sesión, qué ajustarías..."
        className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink text-sm"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-xs px-3 py-1.5">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg">Enviar</button>
      </div>
    </form>
  )
}

function FormPerfilNutri({ onGuardar, onCancelar, valoresIniciales }) {
  const [form, setForm] = useState({ peso: '', altura: '', edad: '', sexo: 'M', nivel_actividad: 'moderado', ...valoresIniciales })
  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })
  return (
    <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onGuardar(form) }}>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Peso (kg)</span>
        <input type="number" {...campo('peso')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Altura (cm)</span>
        <input type="number" {...campo('altura')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Edad</span>
        <input type="number" {...campo('edad')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Sexo</span>
        <select {...campo('sexo')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          <option value="M">Masculino</option><option value="F">Femenino</option>
        </select></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Nivel de actividad</span>
        <select {...campo('nivel_actividad')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          {NIVELES_ACTIVIDAD.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
        </select></label>
      <div className="col-span-2 flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button>
      </div>
    </form>
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
    <form
      className="card flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        const comidasLimpias = comidas.map((c) => ({
          momento: c.momento, nombre: c.nombre,
          kcal_objetivo: c.kcal_objetivo === '' ? null : Number(c.kcal_objetivo),
          proteinas_objetivo: c.proteinas_objetivo === '' ? null : Number(c.proteinas_objetivo)
        }))
        onGuardar({ nombre, comidas: comidasLimpias })
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted text-xs">Nombre del plan</span>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          placeholder="Plan de volumen / Plan pre-competencia"
          className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink"
        />
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
