import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { SkeletonList } from '../components/Skeleton'
import { useToast } from '../lib/ToastContext'
import { useConfirm } from '../lib/ConfirmContext'
import IconoInsignia from '../components/IconoInsignia'
import EstadoVacio from '../components/EstadoVacio'
import { Dumbbell } from 'lucide-react'
import { parsearPlanillaGimnasio } from '../lib/importarPlanilla'

// Antes era una lista cerrada de 7 nombres (un <select>), lo que impedía cargar
// planes reales con ejercicios de máquina/adaptados. Ahora es solo la lista de
// sugerencias de un <input list="..."> de texto libre — el usuario puede escribir
// cualquier ejercicio y no queda atado a esta lista.
const EJERCICIOS_COMUNES = [
  'Sentadilla', 'Sentadilla trasera', 'Sentadilla en máquina guiada (Hack/Smith)', 'Peso muerto',
  'Peso muerto rumano (RDL)', 'Press banca', 'Press militar máquina', 'Zancadas',
  'Zancada caminando con chaleco lastrado', 'Sentadilla búlgara con chaleco lastrado/mochila',
  'Prensa 45°', 'Extensión de cuádriceps en máquina', 'Curl femoral en máquina',
  'Abducción de cadera en máquina', 'Hip Thrust en máquina', 'Patada de glúteo en máquina/polea',
  'Extensión de cadera en polea con tobillera', 'Elevación de pantorrilla en máquina',
  'Elevación de pantorrilla unilateral', 'Pallof Press unilateral en polea',
  'Dead Bug (sin peso en manos)', 'Plancha frontal', 'Core / plancha', 'Otro'
]
const DIAS_SEMANA = [
  { id: 'lun', label: 'Lun' }, { id: 'mar', label: 'Mar' }, { id: 'mie', label: 'Mié' },
  { id: 'jue', label: 'Jue' }, { id: 'vie', label: 'Vie' }, { id: 'sab', label: 'Sáb' }, { id: 'dom', label: 'Dom' }
]
const PRS_DESTACADOS = ['Press banca', 'Sentadilla', 'Peso muerto']
const METODOS_PRESCRIPCION = ['RPE', 'RIR', 'Peso fijo', '% de 1RM', 'Otro']
const DIA_POR_INDICE = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']

function agruparPorFecha(items) {
  const grupos = {}
  for (const item of items) { if (!grupos[item.fecha]) grupos[item.fecha] = []; grupos[item.fecha].push(item) }
  // Ordenado por cercanía a hoy (la fecha más próxima primero, sea pasada o
  // futura), no por orden cronológico puro — así lo pendiente más inminente
  // o lo recién cargado queda arriba de todo en Registro.
  const hoyMs = new Date().toISOString().slice(0, 10) + 'T12:00:00'
  const hoyTs = new Date(hoyMs).getTime()
  return Object.entries(grupos).sort((a, b) => {
    const distA = Math.abs(new Date(a[0] + 'T12:00:00').getTime() - hoyTs)
    const distB = Math.abs(new Date(b[0] + 'T12:00:00').getTime() - hoyTs)
    return distA - distB
  })
}
function agruparPorFechaAsc(items) {
  const grupos = {}
  for (const item of items) { if (!grupos[item.fecha]) grupos[item.fecha] = []; grupos[item.fecha].push(item) }
  return Object.entries(grupos).sort((a, b) => a[0].localeCompare(b[0]))
}
function fmtFecha(f) { const [, m, d] = f.split('-'); return `${d}/${m}` }
function diaLabelDeFecha(f) {
  const idx = new Date(f + 'T12:00:00').getDay()
  return DIAS_SEMANA.find((d) => d.id === DIA_POR_INDICE[idx])?.label || ''
}
function semanaIndice(fecha, fechaInicioMeso) {
  return Math.floor((new Date(fecha + 'T12:00:00') - new Date(fechaInicioMeso + 'T12:00:00')) / 86400000 / 7)
}
const COLOR_METODO = {
  'RPE': '#F5A623', 'RIR': '#4A9EFF', '% de 1RM': '#C4F135', 'Peso fijo': '#8A8F9C', 'Otro': '#8A8F9C'
}
function colorMetodo(metodo) { return COLOR_METODO[metodo] || '#8A8F9C' }
// Antes comparaba solo el peso levantado, ignorando las repeticiones — una
// serie de 5x100kg no se detectaba como PR frente a un simple de 1x100kg
// previo, aunque represente más fuerza real. Ahora usa 1RM estimado (fórmula
// de Epley) para comparar series con distinta combinación de peso y reps.
function estimar1RM(peso, reps) {
  const p = Number(peso) || 0
  if (!p) return 0
  const r = Number(reps) || 1
  return p * (1 + r / 30)
}
function recalcularPRs(sesiones) {
  const realizadas = sesiones.filter((s) => (s.estado || 'realizado') === 'realizado')
  const ordenadas = [...realizadas].sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.id).localeCompare(String(b.id)))
  const maxPorEjercicio = {}; const marcados = {}
  for (const s of ordenadas) {
    const est = estimar1RM(s.peso, s.reps)
    const max = maxPorEjercicio[s.ejercicio] || 0
    if (est > 0 && est > max) { marcados[s.id] = true; maxPorEjercicio[s.ejercicio] = est } else marcados[s.id] = false
  }
  return marcados
}
function crearParametrosSemanas() {
  return [1, 2, 3, 4].map(() => ({ series: '', reps: '', valor: '' }))
}
function crearDiasVacios() {
  return DIAS_SEMANA.map((d) => ({
    dia: d.id, activo: false, es_clave: false,
    ejercicios: [{ ejercicio: 'Sentadilla', metodo: '', porSemana: crearParametrosSemanas() }]
  }))
}
// Las columnas series/reps son numéricas en Supabase. Si el valor prescrito
// trae texto ("10-12", "10 c/lado"), NUNCA lo mandamos crudo a esas columnas
// -- un insert masivo con un solo valor no numérico en una columna numérica
// falla completo y en silencio si no se chequea el error. Extraemos el primer
// entero para la columna numérica, y guardamos el texto completo (si difiere)
// en valor_prescrito para no perder precisión.
function enteroSeguro(v) {
  if (v === '' || v === null || v === undefined) return null
  const m = String(v).match(/\d+/)
  return m ? Number(m[0]) : null
}
function textoSiDistinto(v, entero) {
  if (v === '' || v === null || v === undefined) return null
  const s = String(v).trim()
  return s === String(entero) ? null : s
}

function generarFilasDesdeDias(fechaInicioBase, dias, mesociclo_gimnasio_id) {
  const filas = []
  for (let offset = 0; offset < 28; offset++) {
    const fecha = new Date(fechaInicioBase)
    fecha.setDate(fecha.getDate() + offset)
    const si = Math.floor(offset / 7)
    const diaId = DIA_POR_INDICE[fecha.getDay()]
    const d = dias.find((x) => x.dia === diaId)
    if (!d || !d.activo) continue
    const fechaStr = fecha.toISOString().slice(0, 10)
    // Una sesión por día: todos los ejercicios de ese día comparten sesion_id,
    // así se pueden mover o mostrar juntos como una sola sesión de gimnasio.
    const sesionId = crypto.randomUUID()
    for (const ej of d.ejercicios || []) {
      if (!ej.ejercicio) continue
      const p = ej.porSemana?.[si] || {}
      const seriesNum = enteroSeguro(p.series)
      const repsNum = enteroSeguro(p.reps)
      const repsTexto = textoSiDistinto(p.reps, repsNum)
      const seriesTexto = textoSiDistinto(p.series, seriesNum)
      const notaReps = [seriesTexto ? `series ${seriesTexto}` : null, repsTexto ? `reps ${repsTexto}` : null].filter(Boolean).join(' · ')
      filas.push({
        fecha: fechaStr, ejercicio: ej.ejercicio,
        series: seriesNum,
        reps: repsNum,
        peso: null, estado: 'pendiente', es_clave: !!d.es_clave,
        metodo_prescrito: ej.metodo || null,
        valor_prescrito: [p.valor || null, notaReps || null].filter(Boolean).join(' · ') || null,
        mesociclo_gimnasio_id,
        sesion_id: sesionId
      })
    }
  }
  return filas
}

export default function Gimnasio() {
  const toast = useToast()
  const { confirmar, alertar } = useConfirm()
  const [vista, setVista] = useState('planificacion')
  const [sesiones, setSesiones] = useState([])
  const [mesociclos, setMesociclos] = useState([])
  const [objetivos, setObjetivos] = useState([])
  const [formOpen, setFormOpen] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [valoresEdicion, setValoresEdicion] = useState(null)
  const [formMesoOpen, setFormMesoOpen] = useState(false)
  const [mesoEditando, setMesoEditando] = useState(null)
  const [formObjetivoOpen, setFormObjetivoOpen] = useState(false)
  const [cargando, setCargando] = useState(true)
  const inputMesocicloRef = useRef(null)

  async function cargar() {
    setCargando(true)
    const [{ data: s }, { data: mesos }, { data: objs }] = await Promise.all([
      supabase.from('gimnasio').select('*').order('fecha', { ascending: false }).order('orden', { ascending: true }).limit(300),
      supabase.from('mesociclos_gimnasio').select('*').eq('activo', true).order('fecha_inicio', { ascending: true }),
      supabase.from('objetivos').select('*').eq('categoria', 'gimnasio').order('created_at', { ascending: false })
    ])
    setSesiones(s || []); setMesociclos(mesos || []); setObjetivos(objs || [])
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  const prsPorId = recalcularPRs(sesiones)

  async function sincronizarPRs(listaActualizada) {
    const marcados = recalcularPRs(listaActualizada)
    await Promise.all(
      listaActualizada.filter((s) => Boolean(s.pr) !== Boolean(marcados[s.id])).map((s) => supabase.from('gimnasio').update({ pr: marcados[s.id] }).eq('id', s.id))
    )
  }
  async function crear(form) {
    // Entrada manual de un solo ejercicio: no forma parte de una sesión con
    // otras filas, así que arranca su propio sesion_id.
    // Carga manual (fuera de un mesociclo importado): no tiene "orden" propio del
    // día, así que se manda al final de lo que ya haya esa fecha.
    const ordenSiguiente = 1 + Math.max(0, ...sesiones.filter((s) => s.fecha === form.fecha).map((s) => s.orden ?? 0))
    const { data } = await supabase.from('gimnasio').insert({ sesion_id: crypto.randomUUID(), orden: ordenSiguiente, ...form }).select()
    setFormOpen(false)
    const nuevaLista = [...(data || []), ...sesiones]
    await sincronizarPRs(nuevaLista); cargar()
    toast('Guardado')
  }
  async function actualizar(id, form) {
    await supabase.from('gimnasio').update(form).eq('id', id)
    setEditandoId(null); setValoresEdicion(null)
    const nuevaLista = sesiones.map((s) => (s.id === id ? { ...s, ...form } : s))
    await sincronizarPRs(nuevaLista); cargar()
    toast('Guardado')
  }
  async function eliminar(id) {
    await supabase.from('gimnasio').delete().eq('id', id)
    const nuevaLista = sesiones.filter((s) => s.id !== id)
    await sincronizarPRs(nuevaLista); cargar()
  }

  async function crearObjetivo(form) {
    const { error } = await supabase.from('objetivos').insert({ ...form, categoria: 'gimnasio', estado: 'activo', valor_actual: 0 })
    if (error) { alertar('No se pudo guardar el objetivo: ' + error.message); return }
    setFormObjetivoOpen(false); cargar()
  }
  async function actualizarValorObjetivo(id, valor) { await supabase.from('objetivos').update({ valor_actual: valor }).eq('id', id); cargar() }
  async function marcarCumplidoObjetivo(o) { await supabase.from('objetivos').update({ estado: o.estado === 'cumplido' ? 'activo' : 'cumplido' }).eq('id', o.id); cargar() }
  async function borrarObjetivo(id) { if (!(await confirmar('¿Borrar este objetivo?', { destructivo: true }))) return; await supabase.from('objetivos').delete().eq('id', id); cargar() }

  async function crearMesociclo(form) {
    // "dias" es la plantilla única (días + ejercicios + método), con un valor de
    // series/reps/valor por cada una de las 4 semanas. Se guarda en la columna
    // "semanas" de mesociclos_gimnasio para no requerir cambios de esquema en Supabase.
    const { dias, ...meta } = form
    const { error, data: nuevo } = await supabase.from('mesociclos_gimnasio').insert({ ...meta, semanas: dias }).select().single()
    if (error) { alertar('No se pudo guardar: ' + error.message); return }

    const fechaInicioBase = new Date(meta.fecha_inicio + 'T12:00:00')
    const filasNuevas = generarFilasDesdeDias(fechaInicioBase, dias, nuevo.id)
    if (filasNuevas.length > 0) {
      const { error: errorFilas } = await supabase.from('gimnasio').insert(filasNuevas)
      if (errorFilas) { alertar('El mesociclo se creó, pero los ejercicios no se pudieron cargar: ' + errorFilas.message); return }
    }

    setFormMesoOpen(false); cargar()
  }

  async function importarMesociclo(e) {
    const file = e.target.files[0]; e.target.value = ''
    if (!file) return
    try {
      let json
      if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
        json = await parsearPlanillaGimnasio(file)
      } else if (/\.json$/i.test(file.name)) {
        const texto = await file.text()
        json = JSON.parse(texto)
        if (!json.nombre || !Array.isArray(json.dias)) {
          alertar('El JSON debe tener al menos "nombre" y "dias" (array de días con ejercicios y "porSemana").')
          return
        }
      } else {
        alertar('Formato no reconocido. Subí un .xlsx, .csv o .json.')
        return
      }
      await crearMesociclo(json)
      toast('Plan importado')
    } catch (err) {
      alertar('No se pudo importar: ' + err.message)
    }
  }
  async function actualizarMesociclo(id, form) {
    // Bug previo: acá se desestructuraba "semanas", una clave que este form nunca
    // manda (manda "dias"), así que "dias" quedaba adentro de meta y el update
    // fallaba porque mesociclos_gimnasio no tiene columna "dias" — bloqueaba
    // cualquier edición, incluso solo cambiar el nombre.
    const { dias, ...meta } = form
    const ok = await confirmar(
      'Al guardar, los ejercicios pendientes de este mesociclo se van a reemplazar según lo que dejes acá. Los ya realizados no se tocan.',
      { destructivo: false }
    )
    if (!ok) return

    const { error } = await supabase.from('mesociclos_gimnasio').update({ ...meta, semanas: dias }).eq('id', id)
    if (error) { alertar('No se pudo guardar: ' + error.message); return }

    await supabase.from('gimnasio').delete().eq('mesociclo_gimnasio_id', id).eq('estado', 'pendiente')
    const fechaInicioBase = new Date(meta.fecha_inicio + 'T12:00:00')
    const filasNuevas = generarFilasDesdeDias(fechaInicioBase, dias, id)
    if (filasNuevas.length > 0) {
      const { error: errorFilas } = await supabase.from('gimnasio').insert(filasNuevas)
      if (errorFilas) { alertar('El mesociclo se actualizó, pero los ejercicios no se pudieron cargar: ' + errorFilas.message); return }
    }

    setMesoEditando(null); cargar()
  }
  async function eliminarMesociclo(id) {
    if (!(await confirmar('¿Borrar este mesociclo? Los ejercicios pendientes generados se van a borrar (los ya realizados quedan como historial).', { destructivo: true }))) return
    await supabase.from('gimnasio').delete().eq('mesociclo_gimnasio_id', id).eq('estado', 'pendiente')
    await supabase.from('mesociclos_gimnasio').delete().eq('id', id)
    cargar()
  }

  const porDia = agruparPorFecha(sesiones)
  const hoy = new Date().toISOString().slice(0, 10)
  const hoyStr = hoy

  const pesosMaximosPorEjercicio = {}
  for (const s of sesiones) {
    if (s.estado !== 'realizado') continue
    const p = Number(s.peso) || 0
    if (!pesosMaximosPorEjercicio[s.ejercicio] || p > pesosMaximosPorEjercicio[s.ejercicio].peso) {
      pesosMaximosPorEjercicio[s.ejercicio] = { peso: p, fecha: s.fecha }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <IconoInsignia Icono={Dumbbell} />
        <div>
          <h1 className="text-2xl font-bold">Gimnasio</h1>
          <p className="text-ink-muted text-sm mt-1">Planificación, objetivos y récords</p>
        </div>
      </div>

      <div className="flex gap-1 bg-asphalt-950 p-1 rounded-lg overflow-x-auto">
        {[['planificacion', 'Planificación'], ['registro', 'Registro'], ['objetivos', 'Objetivos'], ['records', 'Récords']].map(([id, label]) => (
          <button key={id} onClick={() => setVista(id)} className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${vista === id ? 'bg-hiviz text-asphalt-950' : 'text-ink-muted'}`}>{label}</button>
        ))}
      </div>

      {vista === 'planificacion' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap justify-end gap-2">
            <input ref={inputMesocicloRef} type="file" accept=".json,application/json,.xlsx,.xls,.csv" className="hidden" onChange={importarMesociclo} />
            <button className="text-ink-muted text-sm px-4 py-2 border border-asphalt-700 rounded-lg" onClick={() => inputMesocicloRef.current?.click()}>Importar plan (Excel/JSON)</button>
            <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => { setMesoEditando(null); setFormMesoOpen((v) => !v) }}>+ Mesociclo</button>
          </div>
          {formMesoOpen && <FormMesociclo onGuardar={crearMesociclo} onCancelar={() => setFormMesoOpen(false)} />}

          {mesociclos.length === 0 ? (
            <EstadoVacio
              Icono={Dumbbell}
              titulo="Sin mesociclos todavía"
              descripcion="Armá tu bloque de 4 semanas con los días y ejercicios de cada uno."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {mesociclos.map((m) =>
                mesoEditando === m.id ? (
                  <FormMesociclo key={m.id} valoresIniciales={m} onGuardar={(datos) => actualizarMesociclo(m.id, datos)} onCancelar={() => setMesoEditando(null)} />
                ) : (
                  (() => {
                    const enCurso = hoyStr >= m.fecha_inicio && hoyStr <= m.fecha_fin
                    const totalDias = (new Date(m.fecha_fin) - new Date(m.fecha_inicio)) / 86400000 + 1
                    const diasPasados = Math.max(0, Math.min(totalDias, (new Date(hoyStr) - new Date(m.fecha_inicio)) / 86400000 + 1))
                    const pctTiempo = Math.round((diasPasados / totalDias) * 100)
                    const filasMeso = sesiones.filter((s) => s.mesociclo_gimnasio_id === m.id)
                      .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.orden ?? 0) - (b.orden ?? 0))
                    const finalizado = !enCurso && hoyStr > m.fecha_fin
                    return (
                      <div key={m.id} className={`card ${enCurso ? 'border-hiviz' : ''}`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">{m.nombre}</p>
                              {enCurso && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-hiviz text-asphalt-950">EN CURSO</span>}
                              {finalizado && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-asphalt-700 text-ink-muted">FINALIZADO</span>}
                            </div>
                            <p className="text-ink-muted text-xs mt-0.5">{m.fecha_inicio} a {m.fecha_fin}</p>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => { setFormMesoOpen(false); setMesoEditando(m.id) }} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Editar</button>
                            <button onClick={() => eliminarMesociclo(m.id)} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
                          </div>
                        </div>
                        {enCurso && (
                          <div className="w-full h-1.5 bg-asphalt-700 rounded-full mt-2.5 overflow-hidden">
                            <div className="h-full bg-hiviz" style={{ width: `${pctTiempo}%` }} />
                          </div>
                        )}
                        {m.notas && <p className="text-ink-faint text-xs mt-1.5">{m.notas}</p>}

                        {finalizado && (
                          <ResumenMesocicloGym m={m} filasMeso={filasMeso} sesiones={sesiones} />
                        )}

                        {filasMeso.length > 0 && (
                          <div className="flex flex-col mt-3 pt-3 border-t border-asphalt-700">
                            {(() => {
                              const porFecha = agruparPorFechaAsc(filasMeso)
                              return porFecha.map(([fecha, items], i) => {
                                const semanaActual = semanaIndice(fecha, m.fecha_inicio)
                                const semanaAnterior = i > 0 ? semanaIndice(porFecha[i - 1][0], m.fecha_inicio) : null
                                const nuevaSemana = semanaActual !== semanaAnterior
                                const fechasSemana = nuevaSemana ? porFecha.filter(([f]) => semanaIndice(f, m.fecha_inicio) === semanaActual).map(([f]) => f) : null
                                const ejerciciosSemana = nuevaSemana ? fechasSemana.reduce((acc, f) => acc + filasMeso.filter((x) => x.fecha === f).length, 0) : null
                                return (
                                  <div key={fecha}>
                                    {nuevaSemana && (
                                      <div className={`flex items-baseline justify-between ${i === 0 ? '' : 'mt-3'} mb-1`}>
                                        <p className="label-eyebrow mb-0">Semana {semanaActual + 1}</p>
                                        <p className="text-ink-faint text-[11px]">{fechasSemana.length} sesiones · {ejerciciosSemana} ejercicios</p>
                                      </div>
                                    )}
                                    <BloqueDiaGym
                                      fecha={fecha}
                                      items={items}
                                      editandoId={editandoId}
                                      valoresEdicion={valoresEdicion}
                                      onGuardarEdicion={(id, datos) => actualizar(id, datos)}
                                      onCancelarEdicion={() => { setEditandoId(null); setValoresEdicion(null) }}
                                      onCargarDatos={(s) => { setFormOpen(false); setValoresEdicion({ ...s, estado: 'realizado' }); setEditandoId(s.id) }}
                                    />
                                  </div>
                                )
                              })
                            })()}
                          </div>
                        )}
                      </div>
                    )
                  })()
                )
              )}
            </div>
          )}
        </div>
      )}

      {vista === 'registro' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PRS_DESTACADOS.map((ej) => {
              const info = pesosMaximosPorEjercicio[ej]
              return (
                <div key={ej} className="card border-hiviz">
                  <span className="label-eyebrow">{ej}</span>
                  <p className="readout text-xl font-bold text-hiviz mt-1">{info ? `${info.peso} kg` : '—'}</p>
                  {info && <p className="text-ink-faint text-xs mt-0.5">{info.fecha}</p>}
                </div>
              )
            })}
          </div>

          <div className="flex justify-end">
            <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => { setEditandoId(null); setValoresEdicion(null); setFormOpen((v) => !v) }}>+ Ejercicio suelto</button>
          </div>
          {formOpen && <FormGimnasio onGuardar={crear} onCancelar={() => setFormOpen(false)} />}

          {cargando ? (
            <SkeletonList rows={4} />
          ) : porDia.length === 0 ? (
            <EstadoVacio
              Icono={Dumbbell}
              titulo="Sin sesiones registradas"
              descripcion="Cargá un ejercicio suelto o registrá desde tu planificación."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {porDia.map(([fecha, items], i) => (
                <BloqueDiaRegistro
                  key={fecha}
                  fecha={fecha}
                  items={items}
                  abiertoPorDefecto={i === 0}
                  prsPorId={prsPorId}
                  editandoId={editandoId}
                  valoresEdicion={valoresEdicion}
                  onGuardarEdicion={(id, datos) => actualizar(id, datos)}
                  onCancelarEdicion={() => { setEditandoId(null); setValoresEdicion(null) }}
                  onCargarResultado={(g) => { setFormOpen(false); setValoresEdicion({ ...g, estado: 'realizado' }); setEditandoId(g.id) }}
                  onEditar={(g) => { setFormOpen(false); setValoresEdicion(null); setEditandoId(g.id) }}
                  onBorrar={async (id) => { if (await confirmar('¿Borrar este ejercicio?', { destructivo: true })) eliminar(id) }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {vista === 'objetivos' && (
        <>
          <div className="flex justify-end"><button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => setFormObjetivoOpen((v) => !v)}>+ Objetivo</button></div>
          {formObjetivoOpen && <FormObjetivo onGuardar={crearObjetivo} onCancelar={() => setFormObjetivoOpen(false)} ejercicios={EJERCICIOS_COMUNES} />}
          {objetivos.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin objetivos de gimnasio cargados.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {objetivos.map((o) => {
                const actualAuto = o.ejercicio_objetivo ? (pesosMaximosPorEjercicio[o.ejercicio_objetivo]?.peso || 0) : Number(o.valor_actual) || 0
                const objetivo = Number(o.valor_objetivo) || 0
                const pct = objetivo ? Math.min(100, Math.round((actualAuto / objetivo) * 100)) : 0
                const cumplido = o.estado === 'cumplido'
                return (
                  <div key={o.id} className={`card ${cumplido ? 'opacity-60' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className={`font-semibold text-sm ${cumplido ? 'line-through' : ''}`}>{o.titulo}</p>
                        {o.ejercicio_objetivo && <p className="text-ink-muted text-xs mt-0.5">{o.ejercicio_objetivo}</p>}
                      </div>
                      <div className="flex gap-1">
                        <button className="text-xs border border-asphalt-700 rounded-lg px-2.5 py-1 text-ink-muted" onClick={() => marcarCumplidoObjetivo(o)}>{cumplido ? 'Reabrir' : 'Cumplido'}</button>
                        <button className="text-xs border border-asphalt-700 rounded-lg px-2.5 py-1 text-alert-red" onClick={() => borrarObjetivo(o.id)}>Borrar</button>
                      </div>
                    </div>
                    <div className="flex justify-between items-baseline mt-2.5">
                      <span className="readout text-lg font-bold text-hiviz">{actualAuto} kg</span>
                      <span className="text-ink-muted text-xs">meta: {objetivo} kg</span>
                    </div>
                    <div className="w-full h-1.5 bg-asphalt-700 rounded-full mt-2 overflow-hidden"><div className="h-full bg-hiviz" style={{ width: `${pct}%` }} /></div>
                    {!o.ejercicio_objetivo && !cumplido && (
                      <input type="number" placeholder="Valor actual (kg)" onBlur={(e) => { if (e.target.value !== '') actualizarValorObjetivo(o.id, e.target.value) }} className="w-full bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink text-sm mt-2.5" />
                    )}
                    {o.ejercicio_objetivo && <p className="text-ink-faint text-xs mt-2">Se actualiza solo con tu mejor marca registrada</p>}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {vista === 'records' && (
        <div className="flex flex-col gap-2">
          {Object.keys(pesosMaximosPorEjercicio).length === 0 ? (
            <p className="text-ink-muted text-sm">Sin datos todavía.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PRS_DESTACADOS.map((ej) => {
                  const info = pesosMaximosPorEjercicio[ej]
                  return (
                    <div key={ej} className="card border-hiviz">
                      <span className="label-eyebrow">{ej}</span>
                      <p className="readout text-2xl font-bold text-hiviz mt-1">{info ? `${info.peso} kg` : '—'}</p>
                      {info && <p className="text-ink-faint text-xs mt-0.5">{info.fecha}</p>}
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-col gap-2 mt-1">
                {Object.entries(pesosMaximosPorEjercicio)
                  .filter(([ejercicio]) => !PRS_DESTACADOS.includes(ejercicio))
                  .map(([ejercicio, info]) => (
                    <div key={ejercicio} className="card flex items-center justify-between">
                      <div><p className="text-sm font-semibold">{ejercicio}</p><p className="text-ink-muted text-xs">{info.fecha}</p></div>
                      <span className="readout text-lg font-bold text-hiviz">{info.peso} kg</span>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MiniDato({ label, value, color = 'text-ink' }) {
  return <div><p className={`readout text-sm font-semibold ${color}`}>{value}</p><p className="text-ink-muted text-[10px] uppercase">{label}</p></div>
}

function BloqueDiaGym({ fecha, items, editandoId, valoresEdicion, onGuardarEdicion, onCancelarEdicion, onCargarDatos }) {
  return (
    <div className="border-b border-asphalt-800 last:border-0 py-2">
      <p className="text-xs font-medium px-1">{diaLabelDeFecha(fecha)} {fmtFecha(fecha)}</p>
      <div className="pl-1 pt-1 flex flex-col">
        {items.map((s) =>
          editandoId === s.id ? (
            <div key={s.id} className="py-2">
              <FormGimnasio
                valoresIniciales={valoresEdicion && valoresEdicion.id === s.id ? valoresEdicion : s}
                onGuardar={(datos) => onGuardarEdicion(s.id, datos)}
                onCancelar={onCancelarEdicion}
              />
            </div>
          ) : (
            <SesionMesocicloGymRow key={s.id} s={s} onCargarDatos={() => onCargarDatos(s)} />
          )
        )}
      </div>
    </div>
  )
}

// Un día de Registro, colapsado por defecto (salvo el más reciente). Muestra
// todas las sesiones registradas ese día (vengan o no de un mesociclo).
function BloqueDiaRegistro({ fecha, items, abiertoPorDefecto, prsPorId, editandoId, valoresEdicion, onGuardarEdicion, onCancelarEdicion, onCargarResultado, onEditar, onBorrar }) {
  const [abierto, setAbierto] = useState(!!abiertoPorDefecto)
  const hechos = items.filter((g) => g.estado === 'realizado').length
  const todosHechos = hechos === items.length
  const pendientes = items.filter((g) => g.estado === 'pendiente')
  const prsDelDia = items.filter((g) => prsPorId[g.id]).length
  const esClave = items.some((g) => g.es_clave)

  return (
    <div className="card p-0 overflow-hidden">
      <button type="button" onClick={() => setAbierto((v) => !v)} className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-asphalt-700/40 active:bg-asphalt-700/60 transition-colors">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: todosHechos ? '#C4F135' : hechos > 0 ? '#F5A623' : '#565B68' }} />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold">{fecha}</span>
          <span className="text-ink-faint text-[11px]">{hechos}/{items.length} ejercicios{esClave ? ' · día clave' : ''}</span>
        </div>
        {esClave && <span className="text-hiviz text-xs flex-shrink-0" title="Día clave">★</span>}
        {prsDelDia > 0 && (
          <span className="text-[9px] font-bold text-asphalt-950 bg-hiviz px-1.5 py-0.5 rounded-full flex-shrink-0">{prsDelDia} PR{prsDelDia > 1 ? 's' : ''}</span>
        )}
        <span className="flex-1" />
        <span className="text-ink-faint text-[10px] flex-shrink-0">{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto && (
        <div className="px-4 pb-3 border-t border-asphalt-700 flex flex-col">
          {items.map((g) =>
            editandoId === g.id ? (
              <div key={g.id} className="py-2">
                <FormGimnasio valoresIniciales={valoresEdicion && valoresEdicion.id === g.id ? valoresEdicion : g} onGuardar={(datos) => onGuardarEdicion(g.id, datos)} onCancelar={onCancelarEdicion} />
              </div>
            ) : (
              <div key={g.id} className="flex items-center gap-2.5 py-2 border-b border-asphalt-700/60 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">
                    {g.ejercicio}
                    {prsPorId[g.id] && <span className="text-[9px] font-bold text-asphalt-950 bg-hiviz px-1.5 py-0.5 rounded-full ml-1.5 align-middle">PR</span>}
                  </p>
                  {g.estado === 'pendiente' && <p className="text-ink-faint text-[10px] mt-0.5">Pendiente</p>}
                </div>
                {g.estado === 'realizado' ? (
                  <div className="flex gap-2.5 text-right flex-shrink-0">
                    <MiniDato label="series" value={g.series} /><MiniDato label="reps" value={g.reps} /><MiniDato label="kg" value={g.peso} color="text-hiviz" />
                  </div>
                ) : (
                  <button onClick={() => onCargarResultado(g)} className="text-hiviz text-[11px] font-semibold border border-hiviz rounded-lg px-2 py-1 flex-shrink-0">Cargar resultado</button>
                )}
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => onEditar(g)} title="Editar" className="text-ink-faint text-xs border border-asphalt-700 rounded-lg w-6 h-6 flex items-center justify-center hover:text-ink-muted hover:border-ink-muted">✎</button>
                  <button onClick={() => onBorrar(g.id)} title="Borrar" className="text-ink-faint text-xs border border-asphalt-700 rounded-lg w-6 h-6 flex items-center justify-center hover:text-alert-red hover:border-alert-red">🗑</button>
                </div>
              </div>
            )
          )}
          {pendientes.length > 0 && (
            <div className="flex justify-end pt-2">
              <button onClick={() => onCargarResultado(pendientes[0])} className="text-ink-muted text-[11px] font-semibold border border-dashed border-asphalt-600 rounded-lg px-2.5 py-1.5 hover:text-hiviz hover:border-hiviz">
                Marcar día completo ({pendientes.length} pendiente{pendientes.length > 1 ? 's' : ''})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SesionMesocicloGymRow({ s, onCargarDatos }) {
  const hecha = s.estado === 'realizado'
  const metodo = s.metodo_prescrito
  const esNota = !metodo || metodo === 'Otro'
  // valor_prescrito puede traer "6 · reps 10-12" (valor del método + calificador de
  // series/reps que no entraba en la columna numérica) — el chip solo muestra el
  // primer segmento cuando hay método; el resto (o todo, si no hay método) va como nota.
  const partes = (s.valor_prescrito || '').split(' · ').filter(Boolean)
  const valorCore = !esNota ? partes[0] : null
  const notaPartes = esNota ? partes : partes.slice(1)
  const nota = notaPartes.length > 0 ? notaPartes.join(' · ') : null
  const chipTexto = !esNota ? (valorCore ? `${metodo} ${valorCore}` : metodo) : null
  const seriesReps = [s.series, s.reps].filter((v) => v !== null && v !== undefined && v !== '').join('x')
  const pesosTxt = Array.isArray(s.pesos_series) && s.pesos_series.length > 0
    ? s.pesos_series.join('/') + 'kg'
    : (s.peso ? `${s.peso}kg` : '')

  return (
    <div className="flex items-center gap-2 py-1.5 px-1 -mx-1 rounded-lg hover:bg-asphalt-700/40 transition-colors">
      {chipTexto ? (
        <span className="text-[10px] font-bold px-1.5 h-5 flex-shrink-0 flex items-center justify-center rounded-md whitespace-nowrap" style={{ background: `${colorMetodo(metodo)}26`, color: colorMetodo(metodo) }}>{chipTexto}</span>
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-asphalt-600 flex-shrink-0 mx-1.5" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate">{s.ejercicio}{seriesReps ? ` — ${seriesReps}` : ''}{hecha && pesosTxt ? ` @ ${pesosTxt}` : ''}</p>
        {nota && <p className="text-ink-faint text-[10px] truncate">{nota}</p>}
      </div>
      {hecha ? (
        <span className="text-hiviz text-[11px] flex-shrink-0">{s.pr ? '🏆 PR' : '✓'}</span>
      ) : (
        <button onClick={onCargarDatos} className="text-hiviz text-[11px] font-semibold flex-shrink-0 whitespace-nowrap">Cargar</button>
      )}
    </div>
  )
}

function FormGimnasio({ onGuardar, onCancelar, valoresIniciales }) {
  const [form, setForm] = useState({ fecha: new Date().toISOString().slice(0, 10), ejercicio: 'Sentadilla', series: '', reps: '', peso: '', rpe: '', estado: 'realizado', es_clave: false, ...valoresIniciales })
  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })

  // Peso por serie: un input por cada serie (en vez de un único "Peso" para todo
  // el ejercicio). Si el ejercicio ya trae pesos_series cargados, arranca de ahí;
  // si no, usa la cantidad de series prescritas (o 1) con el peso simple como valor inicial.
  const [pesosSeries, setPesosSeries] = useState(() => {
    if (Array.isArray(valoresIniciales?.pesos_series) && valoresIniciales.pesos_series.length > 0) {
      return valoresIniciales.pesos_series.map(String)
    }
    const n = Math.max(1, Math.min(20, parseInt(valoresIniciales?.series) || 1))
    return Array.from({ length: n }, () => (valoresIniciales?.peso != null ? String(valoresIniciales.peso) : ''))
  })
  function actualizarPesoSerie(i, valor) {
    setPesosSeries((prev) => prev.map((p, j) => (j === i ? valor : p)))
  }
  function ajustarCantidadSeries(cantidadStr) {
    const cantidad = Math.max(1, Math.min(20, parseInt(cantidadStr) || 1))
    setPesosSeries((prev) => {
      const copia = [...prev]
      while (copia.length < cantidad) copia.push('')
      while (copia.length > cantidad) copia.pop()
      return copia
    })
  }

  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => {
      e.preventDefault()
      const numeros = pesosSeries.map((p) => (p === '' ? null : Number(p))).filter((n) => n !== null && !isNaN(n))
      const pesoMax = numeros.length > 0 ? Math.max(...numeros) : (form.peso === '' ? null : Number(form.peso))
      onGuardar({ ...form, peso: pesoMax, pesos_series: numeros.length > 0 ? numeros : null })
    }}>
      {form.metodo_prescrito && (
        <div className="col-span-2 bg-asphalt-900 border border-hiviz-dim rounded-lg px-3 py-2 text-xs text-ink-muted">
          Prescrito por tu entrenador: <span className="text-hiviz font-semibold">{form.metodo_prescrito} {form.valor_prescrito}</span>
        </div>
      )}
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fecha</span><input type="date" {...campo('fecha')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Estado</span>
        <select {...campo('estado')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          <option value="realizado">Realizado</option>
          <option value="pendiente">Pendiente</option>
        </select></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Ejercicio</span>
        <input {...campo('ejercicio')} list="ejercicios-sugeridos" placeholder="Escribí o elegí de la lista" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" />
        <datalist id="ejercicios-sugeridos">{EJERCICIOS_COMUNES.map((e) => <option key={e} value={e} />)}</datalist>
      </label>
      <label className="flex items-center gap-2 text-sm mt-6">
        <input type="checkbox" checked={!!form.es_clave} onChange={(e) => setForm((f) => ({ ...f, es_clave: e.target.checked }))} />
        <span className="text-ink-muted text-xs">Sesión clave</span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted text-xs">Series</span>
        <input type="number" min="1" max="20" value={form.series ?? ''} onChange={(e) => { setForm((f) => ({ ...f, series: e.target.value })); ajustarCantidadSeries(e.target.value) }} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" />
      </label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Reps</span><input type="number" {...campo('reps')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="col-span-2 flex flex-col gap-1.5">
        <span className="text-ink-muted text-xs">Peso por serie (kg)</span>
        <div className="flex flex-wrap gap-2">
          {pesosSeries.map((p, i) => (
            <label key={i} className="flex flex-col items-center gap-0.5">
              <span className="text-ink-faint text-[10px]">S{i + 1}</span>
              <input
                type="number" step="0.5" value={p}
                onChange={(e) => actualizarPesoSerie(i, e.target.value)}
                className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink w-16 text-center"
              />
            </label>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">RPE (1-10)</span><input type="number" min="1" max="10" {...campo('rpe')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="col-span-2 flex justify-end gap-2 mt-1"><button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button><button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button></div>
    </form>
  )
}

function FormObjetivo({ onGuardar, onCancelar, ejercicios }) {
  const [form, setForm] = useState({ titulo: '', ejercicio_objetivo: '', valor_objetivo: '', fecha_limite: '' })
  const campo = (k) => ({ value: form[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })
  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onGuardar({ ...form, ejercicio_objetivo: form.ejercicio_objetivo || null }) }}>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Título</span><input {...campo('titulo')} required placeholder="Sentadilla a 100 kg" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Ejercicio (opcional, auto — vacío = manual)</span>
        <input {...campo('ejercicio_objetivo')} list="ejercicios-sugeridos-objetivo" placeholder="Manual" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" />
        <datalist id="ejercicios-sugeridos-objetivo">{ejercicios.map((e) => <option key={e} value={e} />)}</datalist>
      </label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Peso objetivo (kg)</span><input type="number" {...campo('valor_objetivo')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Fecha límite</span><input type="date" {...campo('fecha_limite')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="col-span-2 flex justify-end gap-2 mt-1"><button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button><button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button></div>
    </form>
  )
}

function FormMesociclo({ onGuardar, onCancelar, valoresIniciales }) {
  const esEdicion = !!valoresIniciales
  const [nombre, setNombre] = useState(valoresIniciales?.nombre || '')
  const [fechaInicio, setFechaInicio] = useState(valoresIniciales?.fecha_inicio || new Date().toISOString().slice(0, 10))
  const [notas, setNotas] = useState(valoresIniciales?.notas || '')
  // Plantilla única de días/ejercicios: se define una sola vez y se repite en las 4 semanas.
  // Lo único que cambia semana a semana son los parámetros de carga (series/reps/valor).
  const [dias, setDias] = useState(
    valoresIniciales?.semanas?.length ? valoresIniciales.semanas : crearDiasVacios()
  )

  function actualizarDia(diaId, cambios) {
    setDias((prev) => prev.map((d) => (d.dia === diaId ? { ...d, ...cambios } : d)))
  }
  function actualizarEjercicio(diaId, ejIdx, cambios) {
    setDias((prev) => prev.map((d) => (d.dia !== diaId ? d : {
      ...d, ejercicios: d.ejercicios.map((ej, j) => (j === ejIdx ? { ...ej, ...cambios } : ej))
    })))
  }
  function actualizarParametroSemana(diaId, ejIdx, semanaIdx, cambios) {
    setDias((prev) => prev.map((d) => (d.dia !== diaId ? d : {
      ...d,
      ejercicios: d.ejercicios.map((ej, j) => (j !== ejIdx ? ej : {
        ...ej,
        porSemana: ej.porSemana.map((p, k) => (k === semanaIdx ? { ...p, ...cambios } : p))
      }))
    })))
  }
  function agregarEjercicio(diaId) {
    setDias((prev) => prev.map((d) => (d.dia !== diaId ? d : {
      ...d, ejercicios: [...d.ejercicios, { ejercicio: 'Sentadilla', metodo: '', porSemana: crearParametrosSemanas() }]
    })))
  }
  function quitarEjercicio(diaId, ejIdx) {
    setDias((prev) => prev.map((d) => (d.dia !== diaId ? d : { ...d, ejercicios: d.ejercicios.filter((_, j) => j !== ejIdx) })))
  }

  return (
    <form className="card flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault()
      const inicio = new Date(fechaInicio + 'T12:00:00')
      const fechaFin = new Date(inicio); fechaFin.setDate(fechaFin.getDate() + 27)
      onGuardar({
        nombre,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin.toISOString().slice(0, 10),
        notas,
        dias
      })
    }}>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Nombre</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Fuerza base / Hipertrofia" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fecha de inicio</span>
        <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Notas</span>
        <input value={notas} onChange={(e) => setNotas(e.target.value)} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>

      {esEdicion && (
        <p className="text-alert-amber text-xs">
          Al guardar, los ejercicios pendientes se reemplazan según lo que dejes acá. Los ya realizados quedan como historial, sin tocarse.
        </p>
      )}
      <div className="flex flex-col gap-3">
        <div>
          <span className="label-eyebrow">Días y ejercicios</span>
          <p className="text-ink-faint text-[10px] mt-0.5">Se repiten igual en las 4 semanas. Abajo cargás series/reps/valor de cada semana.</p>
        </div>
        <datalist id="ejercicios-sugeridos">{EJERCICIOS_COMUNES.map((e) => <option key={e} value={e} />)}</datalist>
        {DIAS_SEMANA.map((diaInfo) => {
            const d = dias.find((x) => x.dia === diaInfo.id)
            return (
              <div key={diaInfo.id} className="border border-asphalt-700 rounded-lg p-2.5">
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={!!d.activo} onChange={(e) => actualizarDia(diaInfo.id, { activo: e.target.checked })} />
                  <span className="font-medium w-8">{diaInfo.label}</span>
                  {d.activo && (
                    <label className="flex items-center gap-1 text-ink-muted whitespace-nowrap ml-auto">
                      <input type="checkbox" checked={!!d.es_clave} onChange={(e) => actualizarDia(diaInfo.id, { es_clave: e.target.checked })} />
                      ★ clave
                    </label>
                  )}
                </label>
                {d.activo && (
                  <div className="pl-9 mt-2 flex flex-col gap-3">
                    {d.ejercicios.map((ej, ejIdx) => (
                      <div key={ejIdx} className="flex flex-col gap-1.5 pb-2 border-b border-asphalt-800 last:border-0">
                        <div className="flex gap-1.5 items-center">
                          <input value={ej.ejercicio} onChange={(e) => actualizarEjercicio(diaInfo.id, ejIdx, { ejercicio: e.target.value })} list="ejercicios-sugeridos" placeholder="Ejercicio" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1 text-ink text-xs flex-1" />
                          <select value={ej.metodo} onChange={(e) => actualizarEjercicio(diaInfo.id, ejIdx, { metodo: e.target.value })} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1 text-ink text-xs w-28">
                            <option value="">Sin método</option>
                            {METODOS_PRESCRIPCION.map((m) => <option key={m}>{m}</option>)}
                          </select>
                          <button type="button" onClick={() => quitarEjercicio(diaInfo.id, ejIdx)} className="text-alert-red text-xs px-1">✕</button>
                        </div>
                        <div className="overflow-x-auto -mx-1 px-1">
                          <table className="text-[11px] border-collapse">
                            <thead>
                              <tr className="text-ink-faint">
                                <th className="text-left font-normal pr-2 w-14"></th>
                                {[1, 2, 3, 4].map((n) => <th key={n} className="font-semibold text-hiviz px-1.5 pb-1">S{n}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="text-ink-muted pr-2">Series</td>
                                {ej.porSemana.map((p, si) => (
                                  <td key={si} className="px-0.5 pb-1">
                                    <input type="number" value={p.series} onChange={(e) => actualizarParametroSemana(diaInfo.id, ejIdx, si, { series: e.target.value })} className="w-11 bg-asphalt-900 border border-asphalt-700 rounded px-1 py-1 text-ink text-center" />
                                  </td>
                                ))}
                              </tr>
                              <tr>
                                <td className="text-ink-muted pr-2">Reps</td>
                                {ej.porSemana.map((p, si) => (
                                  <td key={si} className="px-0.5 pb-1">
                                    <input type="number" value={p.reps} onChange={(e) => actualizarParametroSemana(diaInfo.id, ejIdx, si, { reps: e.target.value })} className="w-11 bg-asphalt-900 border border-asphalt-700 rounded px-1 py-1 text-ink text-center" />
                                  </td>
                                ))}
                              </tr>
                              {ej.metodo && (
                                <tr>
                                  <td className="text-ink-muted pr-2">Valor</td>
                                  {ej.porSemana.map((p, si) => (
                                    <td key={si} className="px-0.5 pb-1">
                                      <input value={p.valor} onChange={(e) => actualizarParametroSemana(diaInfo.id, ejIdx, si, { valor: e.target.value })} placeholder="8" className="w-11 bg-asphalt-900 border border-asphalt-700 rounded px-1 py-1 text-ink text-center" />
                                    </td>
                                  ))}
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => agregarEjercicio(diaInfo.id)} className="text-hiviz text-xs self-start">+ Ejercicio</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

      <div className="flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button>
      </div>
    </form>
  )
}

function mejorPesoHasta(sesiones, ejercicio, fechaLimite) {
  const candidatos = sesiones.filter((s) => s.ejercicio === ejercicio && s.estado === 'realizado' && s.fecha <= fechaLimite && s.peso)
  if (candidatos.length === 0) return null
  return Math.max(...candidatos.map((s) => Number(s.peso)))
}

function ResumenMesocicloGym({ m, filasMeso, sesiones }) {
  const realizadas = filasMeso.filter((s) => s.estado === 'realizado')
  const totalSesiones = filasMeso.length
  const pctAdherencia = totalSesiones > 0 ? Math.round((realizadas.length / totalSesiones) * 100) : null

  const clave = filasMeso.filter((s) => s.es_clave)
  const claveHechas = clave.filter((s) => s.estado === 'realizado')

  const volumenTotal = realizadas.reduce((a, s) => a + (Number(s.series) || 0) * (Number(s.reps) || 0) * (Number(s.peso) || 0), 0)

  const cambiosPr = PRS_DESTACADOS.map((ej) => {
    const antes = mejorPesoHasta(sesiones, ej, m.fecha_inicio)
    const despues = mejorPesoHasta(sesiones, ej, m.fecha_fin)
    if (antes == null || despues == null || antes === despues) return null
    return { ejercicio: ej, antes, despues }
  }).filter(Boolean)

  return (
    <div className="mt-3 pt-3 border-t border-asphalt-700">
      <span className="label-eyebrow">Resumen del bloque</span>
      <div className="flex flex-col gap-1.5 mt-2">
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
        {volumenTotal > 0 && (
          <p className="text-xs text-ink-muted">
            Volumen total levantado: <span className="text-hiviz font-semibold">{volumenTotal.toLocaleString('es-AR')} kg</span>
          </p>
        )}
        {cambiosPr.map((c) => (
          <p key={c.ejercicio} className="text-xs text-ink-muted">
            {c.ejercicio}: {c.antes}kg → <span className="text-hiviz font-semibold">{c.despues}kg</span>
            <span className={c.despues >= c.antes ? 'text-hiviz' : 'text-alert-amber'}> ({c.despues >= c.antes ? '+' : ''}{c.despues - c.antes}kg)</span>
          </p>
        ))}
      </div>
    </div>
  )
}
