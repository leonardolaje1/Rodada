import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

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

function agruparPorFecha(items) {
  const grupos = {}
  for (const item of items) {
    if (!grupos[item.fecha]) grupos[item.fecha] = []
    grupos[item.fecha].push(item)
  }
  return Object.entries(grupos).sort((a, b) => b[0].localeCompare(a[0]))
}

function recalcularPRs(sesiones) {
  const ordenadas = [...sesiones].sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.id).localeCompare(String(b.id)))
  const maxPorEjercicio = {}
  const marcados = {}
  for (const s of ordenadas) {
    const p = Number(s.peso) || 0
    const max = maxPorEjercicio[s.ejercicio] || 0
    if (p > max) {
      marcados[s.id] = true
      maxPorEjercicio[s.ejercicio] = p
    } else {
      marcados[s.id] = false
    }
  }
  return marcados
}

function inicioSemanaDe(fecha) {
  const d = new Date(fecha)
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().slice(0, 10)
}

function volumen(item) {
  return (Number(item.series) || 0) * (Number(item.reps) || 0) * (Number(item.peso) || 0)
}

export default function Gimnasio() {
  const [vista, setVista] = useState('registro') // 'registro' | 'planes'
  const [sesiones, setSesiones] = useState([])
  const [planes, setPlanes] = useState([])
  const [formOpen, setFormOpen] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [formPlanOpen, setFormPlanOpen] = useState(false)
  const [planEditando, setPlanEditando] = useState(null)

  async function cargar() {
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from('gimnasio').select('*').order('fecha', { ascending: false }).limit(300),
      supabase.from('planes_gimnasio').select('*').eq('activo', true).order('created_at', { ascending: true })
    ])
    setSesiones(s || [])
    setPlanes(p || [])
  }

  useEffect(() => { cargar() }, [])

  const prsPorId = recalcularPRs(sesiones)

  async function sincronizarPRs(listaActualizada) {
    const marcados = recalcularPRs(listaActualizada)
    await Promise.all(
      listaActualizada
        .filter((s) => Boolean(s.pr) !== Boolean(marcados[s.id]))
        .map((s) => supabase.from('gimnasio').update({ pr: marcados[s.id] }).eq('id', s.id))
    )
  }

  async function crear(form) {
    const { data } = await supabase.from('gimnasio').insert(form).select()
    setFormOpen(false)
    const nuevaLista = [...(data || []), ...sesiones]
    await sincronizarPRs(nuevaLista)
    cargar()
  }

  async function actualizar(id, form) {
    await supabase.from('gimnasio').update(form).eq('id', id)
    setEditandoId(null)
    const nuevaLista = sesiones.map((s) => (s.id === id ? { ...s, ...form } : s))
    await sincronizarPRs(nuevaLista)
    cargar()
  }

  async function eliminar(id) {
    await supabase.from('gimnasio').delete().eq('id', id)
    const nuevaLista = sesiones.filter((s) => s.id !== id)
    await sincronizarPRs(nuevaLista)
    cargar()
  }

  async function crearPlan(form) {
    await supabase.from('planes_gimnasio').insert(form)
    setFormPlanOpen(false)
    cargar()
  }

  async function actualizarPlan(id, form) {
    await supabase.from('planes_gimnasio').update(form).eq('id', id)
    setPlanEditando(null)
    cargar()
  }

  async function borrarPlan(id) {
    await supabase.from('planes_gimnasio').update({ activo: false }).eq('id', id)
    cargar()
  }

  async function registrarDesdesPlan(plan) {
    const hoy = new Date().toISOString().slice(0, 10)
    const nuevos = (plan.ejercicios || []).map((ej) => ({
      fecha: hoy,
      ejercicio: ej.ejercicio,
      series: ej.series,
      reps: ej.reps,
      peso: '',
      plan_id: plan.id
    }))
    const { data } = await supabase.from('gimnasio').insert(nuevos).select()
    const nuevaLista = [...(data || []), ...sesiones]
    await sincronizarPRs(nuevaLista)
    setVista('registro')
    cargar()
  }

  const porDia = agruparPorFecha(sesiones)

  const hoy = new Date().toISOString().slice(0, 10)
  const inicioSemanaHoy = inicioSemanaDe(hoy)
  const inicioMesHoy = hoy.slice(0, 7)

  const sesionesSemana = sesiones.filter((s) => inicioSemanaDe(s.fecha) === inicioSemanaHoy)
  const sesionesMes = sesiones.filter((s) => s.fecha.slice(0, 7) === inicioMesHoy)
  const sesionesHoy = sesiones.filter((s) => s.fecha === hoy)

  const volumenPorPlan = (lista) => {
    const grupos = {}
    for (const s of lista) {
      const key = s.plan_id || 'sin_plan'
      if (!grupos[key]) grupos[key] = 0
      grupos[key] += volumen(s)
    }
    return grupos
  }

  const nombrePlan = (id) => planes.find((p) => p.id === id)?.nombre || 'Sin plan asignado'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gimnasio</h1>
          <p className="text-ink-muted text-sm mt-1">Rutinas y volumen</p>
        </div>
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
          Mis rutinas
        </button>
      </div>

      {vista === 'registro' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatVolumen label="Hoy" valor={sesionesHoy.reduce((a, s) => a + volumen(s), 0)} />
            <StatVolumen label="Esta semana" valor={sesionesSemana.reduce((a, s) => a + volumen(s), 0)} />
            <StatVolumen label="Este mes" valor={sesionesMes.reduce((a, s) => a + volumen(s), 0)} />
          </div>

          {planes.length > 0 && (
            <div className="card">
              <span className="label-eyebrow">Registrar desde una rutina</span>
              <p className="text-ink-faint text-xs mt-0.5 mb-2.5">Carga todos los ejercicios del plan para hoy — después completás el peso de cada uno.</p>
              <div className="flex flex-col gap-2">
                {planes.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => registrarDesdesPlan(p)}
                    className="flex items-center justify-between border border-asphalt-700 rounded-lg px-3 py-2 text-left hover:border-hiviz"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.nombre}</p>
                      <p className="text-ink-muted text-xs">{(p.ejercicios || []).length} ejercicios</p>
                    </div>
                    <span className="text-hiviz text-xs font-semibold">+ Registrar hoy</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg"
              onClick={() => { setEditandoId(null); setFormOpen((v) => !v) }}
            >
              + Ejercicio suelto
            </button>
          </div>

          {formOpen && <FormGimnasio planes={planes} onGuardar={crear} onCancelar={() => setFormOpen(false)} />}

          {porDia.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin sesiones registradas todavía.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {porDia.map(([fecha, items]) => {
                const volumenDia = items.reduce((a, g) => a + volumen(g), 0)
                const porPlanDelDia = volumenPorPlan(items)
                return (
                  <div key={fecha}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold">{fecha}</span>
                      <span className="readout text-xs text-ink-muted">
                        <span className="text-hiviz font-semibold">{volumenDia.toLocaleString('es-AR')} kg</span> volumen del día
                      </span>
                    </div>
                    {Object.keys(porPlanDelDia).length > 1 && (
                      <div className="flex gap-3 mb-2 flex-wrap">
                        {Object.entries(porPlanDelDia).map(([key, vol]) => (
                          <span key={key} className="text-[11px] text-ink-muted">
                            {key === 'sin_plan' ? 'Sueltos' : nombrePlan(key)}: <span className="text-ink font-semibold">{vol.toLocaleString('es-AR')} kg</span>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      {items.map((g) =>
                        editandoId === g.id ? (
                          <FormGimnasio
                            key={g.id}
                            planes={planes}
                            valoresIniciales={g}
                            onGuardar={(datos) => actualizar(g.id, datos)}
                            onCancelar={() => setEditandoId(null)}
                          />
                        ) : (
                          <div key={g.id} className="card flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">
                                {g.ejercicio}{' '}
                                {prsPorId[g.id] && (
                                  <span className="text-[10px] font-bold text-asphalt-950 bg-hiviz px-1.5 py-0.5 rounded-full ml-1">PR</span>
                                )}
                              </p>
                              {g.plan_id && <p className="text-ink-faint text-[11px]">{nombrePlan(g.plan_id)}</p>}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex gap-3 text-right">
                                <MiniDato label="series" value={g.series} />
                                <MiniDato label="reps" value={g.reps} />
                                <MiniDato label="kg" value={g.peso} color="text-hiviz" />
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => { setFormOpen(false); setEditandoId(g.id) }}
                                  className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => { if (confirm('¿Borrar este ejercicio?')) eliminar(g.id) }}
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
              + Rutina
            </button>
          </div>

          {formPlanOpen && (
            <FormPlan onGuardar={crearPlan} onCancelar={() => setFormPlanOpen(false)} />
          )}

          {planes.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin rutinas cargadas. Armá tu primera — por ejemplo "Tren superior", asignale los días de la semana y los ejercicios con series/reps objetivo.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {planes.map((p) =>
                planEditando === p.id ? (
                  <FormPlan
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
                          onClick={() => { if (confirm('¿Borrar esta rutina?')) borrarPlan(p.id) }}
                          className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1"
                        >
                          Borrar
                        </button>
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
                        <p key={i} className="text-ink-muted text-xs">
                          {ej.ejercicio} — {ej.series}x{ej.reps}
                        </p>
                      ))}
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

function StatVolumen({ label, valor }) {
  return (
    <div className="card">
      <span className="label-eyebrow">{label}</span>
      <p className="readout text-lg font-bold text-hiviz mt-1">{valor.toLocaleString('es-AR')} kg</p>
    </div>
  )
}

function MiniDato({ label, value, color = 'text-ink' }) {
  return (
    <div>
      <p className={`readout text-sm font-semibold ${color}`}>{value}</p>
      <p className="text-ink-muted text-[10px] uppercase">{label}</p>
    </div>
  )
}

function FormGimnasio({ onGuardar, onCancelar, valoresIniciales, planes = [] }) {
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10), ejercicio: 'Sentadilla', series: '', reps: '', peso: '', rpe: '', plan_id: '',
    ...valoresIniciales
  })
  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })

  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onGuardar({ ...form, plan_id: form.plan_id || null }) }}>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fecha</span>
        <input type="date" {...campo('fecha')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Ejercicio</span>
        <select {...campo('ejercicio')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          {EJERCICIOS_COMUNES.map((e) => <option key={e}>{e}</option>)}
        </select></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Series</span>
        <input type="number" {...campo('series')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Reps</span>
        <input type="number" {...campo('reps')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Peso (kg)</span>
        <input type="number" {...campo('peso')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">RPE (1-10)</span>
        <input type="number" min="1" max="10" {...campo('rpe')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      {planes.length > 0 && (
        <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Pertenece a la rutina</span>
          <select {...campo('plan_id')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
            <option value="">— Ejercicio suelto —</option>
            {planes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select></label>
      )}
      <div className="col-span-2 flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button>
      </div>
    </form>
  )
}

function FormPlan({ onGuardar, onCancelar, valoresIniciales }) {
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
      onSubmit={(e) => {
        e.preventDefault()
        onGuardar({ nombre, dias_semana: dias, ejercicios })
      }}
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
