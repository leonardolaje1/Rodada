import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { calcularTSS } from '../lib/tss'

const TIPOS = ['Ruta', 'MTB', 'Gravel', 'Rodillo', 'Pista', 'Descanso']
const EJERCICIOS_COMUNES = ['Sentadilla', 'Peso muerto', 'Press banca', 'Zancadas', 'Prensa', 'Core / plancha', 'Otro']
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
  const [entrenamientos, setEntrenamientos] = useState([])
  const [gimnasio, setGimnasio] = useState([])
  const [comidas, setComidas] = useState([])
  const [planesEntreno, setPlanesEntreno] = useState([])
  const [planesGimnasio, setPlanesGimnasio] = useState([])
  const [seccion, setSeccion] = useState('resumen') // 'resumen' | 'planes-entreno' | 'planes-gym'
  const [formPlanEntrenoOpen, setFormPlanEntrenoOpen] = useState(false)
  const [planEntrenoEditando, setPlanEntrenoEditando] = useState(null)
  const [formPlanGymOpen, setFormPlanGymOpen] = useState(false)
  const [planGymEditando, setPlanGymEditando] = useState(null)
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    setCargando(true)
    const desde30 = new Date()
    desde30.setDate(desde30.getDate() - 30)
    const fechaDesde = desde30.toISOString().slice(0, 10)

    const { data: emailData } = await supabase.rpc('email_de_vinculado', { p_user_id: atletaId })
    setEmail(emailData || 'Atleta')

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

    if (esNutricionista) {
      const { data: cms } = await supabase.from('comidas').select('*').eq('user_id', atletaId).gte('fecha', fechaDesde)
      setComidas(cms || [])
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

  return (
    <div className="flex flex-col gap-6">
      <Link to="/equipo" className="text-ink-muted text-sm">← Equipo</Link>

      <div>
        <h1 className="text-2xl font-bold">{email}</h1>
        <p className="text-ink-muted text-sm mt-1">Sos su {rol} · últimos 30 días</p>
      </div>

      {esEntrenador && (
        <div className="flex gap-1 bg-asphalt-950 p-1 rounded-lg overflow-x-auto">
          {[['resumen', 'Resumen'], ['planes-entreno', 'Planes de entrenamiento'], ['planes-gym', 'Rutinas de gimnasio']].map(([id, label]) => (
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

          {esNutricionista && (
            <div className="card">
              <span className="label-eyebrow">Nutrición — promedio diario</span>
              <p className="readout text-2xl font-bold text-hiviz mt-1">{kcalProm.toFixed(0)} kcal/día</p>
              <p className="text-ink-muted text-xs mt-1">{comidas.length} comidas registradas en el período</p>
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold mb-2">Entrenamientos recientes</h2>
            {entrenamientos.length === 0 ? (
              <p className="text-ink-muted text-sm">Sin entrenamientos en los últimos 30 días.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {entrenamientos.slice(0, 10).map((e) => (
                  <div key={e.id} className="card flex items-center justify-between">
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
                ))}
              </div>
            )}
          </div>

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
