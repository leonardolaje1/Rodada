import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { SkeletonList } from '../components/Skeleton'
import IconoInsignia from '../components/IconoInsignia'
import { Dumbbell } from 'lucide-react'

const EJERCICIOS_COMUNES = ['Sentadilla', 'Peso muerto', 'Press banca', 'Zancadas', 'Prensa', 'Core / plancha', 'Otro']
const DIAS_SEMANA = [
  { id: 'lun', label: 'Lun' }, { id: 'mar', label: 'Mar' }, { id: 'mie', label: 'Mié' },
  { id: 'jue', label: 'Jue' }, { id: 'vie', label: 'Vie' }, { id: 'sab', label: 'Sáb' }, { id: 'dom', label: 'Dom' }
]
const PRS_DESTACADOS = ['Press banca', 'Sentadilla', 'Peso muerto']
const METODOS_PRESCRIPCION = ['RPE', 'RIR', 'Peso fijo', '% de 1RM', 'Otro']

function agruparPorFecha(items) {
  const grupos = {}
  for (const item of items) { if (!grupos[item.fecha]) grupos[item.fecha] = []; grupos[item.fecha].push(item) }
  return Object.entries(grupos).sort((a, b) => b[0].localeCompare(a[0]))
}
function recalcularPRs(sesiones) {
  const realizadas = sesiones.filter((s) => (s.estado || 'realizado') === 'realizado')
  const ordenadas = [...realizadas].sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.id).localeCompare(String(b.id)))
  const maxPorEjercicio = {}; const marcados = {}
  for (const s of ordenadas) {
    const p = Number(s.peso) || 0
    const max = maxPorEjercicio[s.ejercicio] || 0
    if (p > max) { marcados[s.id] = true; maxPorEjercicio[s.ejercicio] = p } else marcados[s.id] = false
  }
  return marcados
}
function lunesDeSemana(fechaStr) {
  const d = new Date(fechaStr + 'T12:00:00')
  const dow = d.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + offset)
  return d
}
function crearSemanaVacia(numero) {
  return {
    semana: numero,
    dias: DIAS_SEMANA.map((d) => ({ dia: d.id, activo: false, es_clave: false, ejercicios: [{ ejercicio: 'Sentadilla', series: '', reps: '', metodo: '', valor: '' }] }))
  }
}

export default function Gimnasio() {
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

  async function cargar() {
    setCargando(true)
    const [{ data: s }, { data: mesos }, { data: objs }] = await Promise.all([
      supabase.from('gimnasio').select('*').order('fecha', { ascending: false }).limit(300),
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
    const { data } = await supabase.from('gimnasio').insert(form).select()
    setFormOpen(false)
    const nuevaLista = [...(data || []), ...sesiones]
    await sincronizarPRs(nuevaLista); cargar()
  }
  async function actualizar(id, form) {
    await supabase.from('gimnasio').update(form).eq('id', id)
    setEditandoId(null); setValoresEdicion(null)
    const nuevaLista = sesiones.map((s) => (s.id === id ? { ...s, ...form } : s))
    await sincronizarPRs(nuevaLista); cargar()
  }
  async function eliminar(id) {
    await supabase.from('gimnasio').delete().eq('id', id)
    const nuevaLista = sesiones.filter((s) => s.id !== id)
    await sincronizarPRs(nuevaLista); cargar()
  }

  async function crearObjetivo(form) {
    const { error } = await supabase.from('objetivos').insert({ ...form, categoria: 'gimnasio', estado: 'activo', valor_actual: 0 })
    if (error) { alert('No se pudo guardar el objetivo: ' + error.message); return }
    setFormObjetivoOpen(false); cargar()
  }
  async function actualizarValorObjetivo(id, valor) { await supabase.from('objetivos').update({ valor_actual: valor }).eq('id', id); cargar() }
  async function marcarCumplidoObjetivo(o) { await supabase.from('objetivos').update({ estado: o.estado === 'cumplido' ? 'activo' : 'cumplido' }).eq('id', o.id); cargar() }
  async function borrarObjetivo(id) { if (!confirm('¿Borrar este objetivo?')) return; await supabase.from('objetivos').delete().eq('id', id); cargar() }

  async function crearMesociclo(form) {
    const { semanas, ...meta } = form
    const { error, data: nuevo } = await supabase.from('mesociclos_gimnasio').insert({ ...meta, semanas }).select().single()
    if (error) { alert('No se pudo guardar: ' + error.message); return }

    const lunesBase = lunesDeSemana(meta.fecha_inicio)
    const filasNuevas = []
    semanas.forEach((semana, si) => {
      DIAS_SEMANA.forEach((diaInfo, oi) => {
        const d = (semana.dias || []).find((x) => x.dia === diaInfo.id)
        if (!d || !d.activo) return
        const fecha = new Date(lunesBase)
        fecha.setDate(fecha.getDate() + si * 7 + oi)
        const fechaStr = fecha.toISOString().slice(0, 10)
        for (const ej of d.ejercicios || []) {
          if (!ej.ejercicio) continue
          filasNuevas.push({
            fecha: fechaStr, ejercicio: ej.ejercicio,
            series: ej.series ? Number(ej.series) : null,
            reps: ej.reps ? Number(ej.reps) : null,
            peso: null, estado: 'pendiente', es_clave: !!d.es_clave,
            metodo_prescrito: ej.metodo || null,
            valor_prescrito: ej.valor || null,
            mesociclo_gimnasio_id: nuevo.id
          })
        }
      })
    })
    if (filasNuevas.length > 0) await supabase.from('gimnasio').insert(filasNuevas)

    setFormMesoOpen(false); cargar()
  }
  async function actualizarMesociclo(id, form) {
    const { semanas, ...meta } = form
    const { error } = await supabase.from('mesociclos_gimnasio').update(meta).eq('id', id)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setMesoEditando(null); cargar()
  }
  async function eliminarMesociclo(id) {
    if (!confirm('¿Borrar este mesociclo? Los ejercicios pendientes generados se van a borrar (los ya realizados quedan como historial).')) return
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
          <div className="flex justify-end">
            <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => { setMesoEditando(null); setFormMesoOpen((v) => !v) }}>+ Mesociclo</button>
          </div>
          {formMesoOpen && <FormMesociclo onGuardar={crearMesociclo} onCancelar={() => setFormMesoOpen(false)} />}

          {mesociclos.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin mesociclos cargados todavía. Armá tu bloque de 4 semanas con los días y ejercicios de cada uno.</p>
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
                    const filasMeso = sesiones.filter((s) => s.mesociclo_gimnasio_id === m.id).sort((a, b) => a.fecha.localeCompare(b.fecha))
                    return (
                      <div key={m.id} className={`card ${enCurso ? 'border-hiviz' : ''}`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">{m.nombre}</p>
                              {enCurso && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-hiviz text-asphalt-950">EN CURSO</span>}
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

                        {filasMeso.length > 0 && (
                          <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-asphalt-700">
                            {agruparPorFecha(filasMeso).map(([fecha, items]) => (
                              <div key={fecha} className="flex flex-col gap-1">
                                <p className="text-ink-faint text-[10px] uppercase">{fecha}</p>
                                {items.map((s) =>
                                  editandoId === s.id ? (
                                    <FormGimnasio key={s.id} valoresIniciales={valoresEdicion && valoresEdicion.id === s.id ? valoresEdicion : s} onGuardar={(datos) => actualizar(s.id, datos)} onCancelar={() => { setEditandoId(null); setValoresEdicion(null) }} />
                                  ) : (
                                    <SesionMesocicloGymRow
                                      key={s.id}
                                      s={s}
                                      onCargarDatos={() => { setFormOpen(false); setValoresEdicion({ ...s, estado: 'realizado' }); setEditandoId(s.id) }}
                                    />
                                  )
                                )}
                              </div>
                            ))}
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
            <p className="text-ink-muted text-sm">Sin sesiones registradas todavía.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {porDia.map(([fecha, items]) => (
                <div key={fecha}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">{fecha}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.map((g) =>
                      editandoId === g.id ? (
                        <FormGimnasio key={g.id} valoresIniciales={valoresEdicion && valoresEdicion.id === g.id ? valoresEdicion : g} onGuardar={(datos) => actualizar(g.id, datos)} onCancelar={() => { setEditandoId(null); setValoresEdicion(null) }} />
                      ) : (
                        <div key={g.id} className={`card flex items-center justify-between ${g.estado === 'pendiente' ? 'opacity-70 border-dashed' : ''}`}>
                          <div className="flex items-center gap-2">
                            {g.estado === 'pendiente' && <i className="w-2 h-2 rounded-full border border-ink-faint inline-block flex-shrink-0" title="Pendiente" />}
                            {g.es_clave && <span className="text-hiviz" title="Sesión clave">★</span>}
                            <div>
                              <p className="font-medium text-sm">{g.ejercicio} {prsPorId[g.id] && <span className="text-[10px] font-bold text-asphalt-950 bg-hiviz px-1.5 py-0.5 rounded-full ml-1">PR</span>}</p>
                              {g.estado === 'pendiente' && <p className="text-ink-faint text-[11px]">Pendiente</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {g.estado === 'realizado' && (
                              <div className="flex gap-3 text-right">
                                <MiniDato label="series" value={g.series} /><MiniDato label="reps" value={g.reps} /><MiniDato label="kg" value={g.peso} color="text-hiviz" />
                              </div>
                            )}
                            <div className="flex gap-1">
                              {g.estado === 'pendiente' && (
                                <button onClick={() => { setFormOpen(false); setValoresEdicion({ ...g, estado: 'realizado' }); setEditandoId(g.id) }} className="text-hiviz text-xs border border-asphalt-700 rounded-lg px-2 py-1">Cargar resultado</button>
                              )}
                              <button onClick={() => { setFormOpen(false); setValoresEdicion(null); setEditandoId(g.id) }} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Editar</button>
                              <button onClick={() => { if (confirm('¿Borrar este ejercicio?')) eliminar(g.id) }} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
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

function SesionMesocicloGymRow({ s, onCargarDatos }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        {s.es_clave && <span className="text-hiviz text-xs" title="Sesión clave">★</span>}
        <div>
          <p className="text-xs font-medium">{s.ejercicio}{s.estado === 'realizado' ? ` — ${s.series}x${s.reps} @ ${s.peso}kg` : s.series || s.reps ? ` — ${s.series || '—'}x${s.reps || '—'}` : ''}</p>
          {s.estado === 'pendiente' && s.metodo_prescrito && (
            <p className="text-ink-faint text-[10px]">{s.metodo_prescrito}: {s.valor_prescrito || '—'}</p>
          )}
        </div>
      </div>
      {s.estado === 'pendiente' ? (
        <button onClick={onCargarDatos} className="text-hiviz text-[11px] font-semibold whitespace-nowrap">Cargar resultado</button>
      ) : (
        <span className="text-hiviz text-[11px]">✓ hecho</span>
      )}
    </div>
  )
}

function FormGimnasio({ onGuardar, onCancelar, valoresIniciales }) {
  const [form, setForm] = useState({ fecha: new Date().toISOString().slice(0, 10), ejercicio: 'Sentadilla', series: '', reps: '', peso: '', rpe: '', estado: 'realizado', es_clave: false, ...valoresIniciales })
  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })
  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onGuardar(form) }}>
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
        <select {...campo('ejercicio')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">{EJERCICIOS_COMUNES.map((e) => <option key={e}>{e}</option>)}</select></label>
      <label className="flex items-center gap-2 text-sm mt-6">
        <input type="checkbox" checked={!!form.es_clave} onChange={(e) => setForm((f) => ({ ...f, es_clave: e.target.checked }))} />
        <span className="text-ink-muted text-xs">Sesión clave</span>
      </label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Series</span><input type="number" {...campo('series')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Reps</span><input type="number" {...campo('reps')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Peso (kg)</span><input type="number" {...campo('peso')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
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
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Ejercicio (opcional, auto)</span>
        <select {...campo('ejercicio_objetivo')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          <option value="">Manual</option>{ejercicios.map((e) => <option key={e}>{e}</option>)}
        </select></label>
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
  const [semanas, setSemanas] = useState(
    valoresIniciales?.semanas?.length ? valoresIniciales.semanas : [1, 2, 3, 4].map(crearSemanaVacia)
  )

  function actualizarDia(semanaIdx, diaId, cambios) {
    setSemanas((prev) => prev.map((s, i) => (
      i !== semanaIdx ? s : { ...s, dias: s.dias.map((d) => (d.dia === diaId ? { ...d, ...cambios } : d)) }
    )))
  }
  function actualizarEjercicio(semanaIdx, diaId, ejIdx, cambios) {
    setSemanas((prev) => prev.map((s, i) => (
      i !== semanaIdx ? s : {
        ...s,
        dias: s.dias.map((d) => (d.dia !== diaId ? d : {
          ...d,
          ejercicios: d.ejercicios.map((ej, j) => (j === ejIdx ? { ...ej, ...cambios } : ej))
        }))
      }
    )))
  }
  function agregarEjercicio(semanaIdx, diaId) {
    setSemanas((prev) => prev.map((s, i) => (
      i !== semanaIdx ? s : {
        ...s,
        dias: s.dias.map((d) => (d.dia !== diaId ? d : { ...d, ejercicios: [...d.ejercicios, { ejercicio: 'Sentadilla', series: '', reps: '', metodo: '', valor: '' }] }))
      }
    )))
  }
  function quitarEjercicio(semanaIdx, diaId, ejIdx) {
    setSemanas((prev) => prev.map((s, i) => (
      i !== semanaIdx ? s : {
        ...s,
        dias: s.dias.map((d) => (d.dia !== diaId ? d : { ...d, ejercicios: d.ejercicios.filter((_, j) => j !== ejIdx) }))
      }
    )))
  }

  return (
    <form className="card flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault()
      const lunes = lunesDeSemana(fechaInicio)
      const fechaFin = new Date(lunes); fechaFin.setDate(fechaFin.getDate() + 27)
      onGuardar({
        nombre,
        fecha_inicio: lunes.toISOString().slice(0, 10),
        fecha_fin: fechaFin.toISOString().slice(0, 10),
        notas,
        semanas
      })
    }}>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Nombre</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Fuerza base / Hipertrofia" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Semana 1 empieza (lunes más cercano)</span>
        <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required disabled={esEdicion} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink disabled:opacity-50" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Notas</span>
        <input value={notas} onChange={(e) => setNotas(e.target.value)} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>

      {esEdicion ? (
        <p className="text-ink-faint text-xs">Para cambiar el cronograma de ejercicios, borrá este mesociclo y creá uno nuevo.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <span className="label-eyebrow">Cronograma — 4 semanas</span>
          {semanas.map((semana, si) => (
            <div key={si} className="border border-asphalt-700 rounded-lg p-2.5">
              <p className="text-sm font-semibold mb-2">Semana {semana.semana}</p>
              <div className="flex flex-col gap-2.5">
                {DIAS_SEMANA.map((diaInfo) => {
                  const d = semana.dias.find((x) => x.dia === diaInfo.id)
                  return (
                    <div key={diaInfo.id} className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={!!d.activo} onChange={(e) => actualizarDia(si, diaInfo.id, { activo: e.target.checked })} />
                        <span className="font-medium w-8">{diaInfo.label}</span>
                        {d.activo && (
                          <label className="flex items-center gap-1 text-ink-muted whitespace-nowrap ml-auto">
                            <input type="checkbox" checked={!!d.es_clave} onChange={(e) => actualizarDia(si, diaInfo.id, { es_clave: e.target.checked })} />
                            ★ clave
                          </label>
                        )}
                      </label>
                      {d.activo && (
                        <div className="pl-9 flex flex-col gap-1.5">
                          {d.ejercicios.map((ej, ejIdx) => (
                            <div key={ejIdx} className="flex flex-col gap-1.5 pb-1.5 border-b border-asphalt-800 last:border-0">
                              <div className="flex gap-1.5 items-center">
                                <select value={ej.ejercicio} onChange={(e) => actualizarEjercicio(si, diaInfo.id, ejIdx, { ejercicio: e.target.value })} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1 text-ink text-xs flex-1">
                                  {EJERCICIOS_COMUNES.map((e) => <option key={e}>{e}</option>)}
                                </select>
                                <input type="number" value={ej.series} onChange={(e) => actualizarEjercicio(si, diaInfo.id, ejIdx, { series: e.target.value })} placeholder="Series" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1 text-ink text-xs w-14" />
                                <input type="number" value={ej.reps} onChange={(e) => actualizarEjercicio(si, diaInfo.id, ejIdx, { reps: e.target.value })} placeholder="Reps" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1 text-ink text-xs w-14" />
                                <button type="button" onClick={() => quitarEjercicio(si, diaInfo.id, ejIdx)} className="text-alert-red text-xs px-1">✕</button>
                              </div>
                              <div className="flex gap-1.5 items-center">
                                <select value={ej.metodo} onChange={(e) => actualizarEjercicio(si, diaInfo.id, ejIdx, { metodo: e.target.value })} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1 text-ink text-xs flex-1">
                                  <option value="">Sin método prescrito</option>
                                  {METODOS_PRESCRIPCION.map((m) => <option key={m}>{m}</option>)}
                                </select>
                                {ej.metodo && (
                                  <input value={ej.valor} onChange={(e) => actualizarEjercicio(si, diaInfo.id, ejIdx, { valor: e.target.value })} placeholder="Valor (ej: 8, 2, 70kg)" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1 text-ink text-xs w-32" />
                                )}
                              </div>
                            </div>
                          ))}
                          <button type="button" onClick={() => agregarEjercicio(si, diaInfo.id)} className="text-hiviz text-xs self-start">+ Ejercicio</button>
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
