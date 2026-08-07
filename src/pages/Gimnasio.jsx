import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const EJERCICIOS_COMUNES = ['Sentadilla', 'Peso muerto', 'Press banca', 'Zancadas', 'Prensa', 'Core / plancha', 'Otro']
const DIAS_SEMANA = [
  { id: 'lun', label: 'Lun' }, { id: 'mar', label: 'Mar' }, { id: 'mie', label: 'Mié' },
  { id: 'jue', label: 'Jue' }, { id: 'vie', label: 'Vie' }, { id: 'sab', label: 'Sáb' }, { id: 'dom', label: 'Dom' }
]

function agruparPorFecha(items) {
  const grupos = {}
  for (const item of items) { if (!grupos[item.fecha]) grupos[item.fecha] = []; grupos[item.fecha].push(item) }
  return Object.entries(grupos).sort((a, b) => b[0].localeCompare(a[0]))
}
function recalcularPRs(sesiones) {
  const ordenadas = [...sesiones].sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.id).localeCompare(String(b.id)))
  const maxPorEjercicio = {}; const marcados = {}
  for (const s of ordenadas) {
    const p = Number(s.peso) || 0
    const max = maxPorEjercicio[s.ejercicio] || 0
    if (p > max) { marcados[s.id] = true; maxPorEjercicio[s.ejercicio] = p } else marcados[s.id] = false
  }
  return marcados
}

export default function Gimnasio() {
  const [vista, setVista] = useState('registro')
  const [sesiones, setSesiones] = useState([])
  const [planes, setPlanes] = useState([])
  const [objetivos, setObjetivos] = useState([])
  const [formOpen, setFormOpen] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [formPlanOpen, setFormPlanOpen] = useState(false)
  const [planEditando, setPlanEditando] = useState(null)
  const [formObjetivoOpen, setFormObjetivoOpen] = useState(false)

  async function cargar() {
    const [{ data: s }, { data: p }, { data: objs }] = await Promise.all([
      supabase.from('gimnasio').select('*').order('fecha', { ascending: false }).limit(300),
      supabase.from('planes_gimnasio').select('*').eq('activo', true).order('created_at', { ascending: true }),
      supabase.from('objetivos').select('*').eq('categoria', 'gimnasio').order('created_at', { ascending: false })
    ])
    setSesiones(s || []); setPlanes(p || []); setObjetivos(objs || [])
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
    setEditandoId(null)
    const nuevaLista = sesiones.map((s) => (s.id === id ? { ...s, ...form } : s))
    await sincronizarPRs(nuevaLista); cargar()
  }
  async function eliminar(id) {
    await supabase.from('gimnasio').delete().eq('id', id)
    const nuevaLista = sesiones.filter((s) => s.id !== id)
    await sincronizarPRs(nuevaLista); cargar()
  }
  async function crearPlan(form) { await supabase.from('planes_gimnasio').insert(form); setFormPlanOpen(false); cargar() }
  async function actualizarPlan(id, form) { await supabase.from('planes_gimnasio').update(form).eq('id', id); setPlanEditando(null); cargar() }
  async function borrarPlan(id) { await supabase.from('planes_gimnasio').update({ activo: false }).eq('id', id); cargar() }
  async function registrarDesdesPlan(plan) {
    const hoy = new Date().toISOString().slice(0, 10)
    const nuevos = (plan.ejercicios || []).map((ej) => ({ fecha: hoy, ejercicio: ej.ejercicio, series: ej.series, reps: ej.reps, peso: '', plan_id: plan.id }))
    const { data } = await supabase.from('gimnasio').insert(nuevos).select()
    const nuevaLista = [...(data || []), ...sesiones]
    await sincronizarPRs(nuevaLista); setVista('registro'); cargar()
  }  
  async function crearObjetivo(form) {
    const { error } = await supabase.from('objetivos').insert({ ...form, categoria: 'gimnasio', estado: 'activo', valor_actual: 0 })
    if (error) { alert('No se pudo guardar el objetivo: ' + error.message); return }
    setFormObjetivoOpen(false); cargar()
  }

  async function actualizarValorObjetivo(id, valor) { await supabase.from('objetivos').update({ valor_actual: valor }).eq('id', id); cargar() }
  async function marcarCumplidoObjetivo(o) { await supabase.from('objetivos').update({ estado: o.estado === 'cumplido' ? 'activo' : 'cumplido' }).eq('id', o.id); cargar() }
  async function borrarObjetivo(id) { if (!confirm('¿Borrar este objetivo?')) return; await supabase.from('objetivos').delete().eq('id', id); cargar() }

  const porDia = agruparPorFecha(sesiones)
  const hoy = new Date().toISOString().slice(0, 10)
  const inicioSemana = new Date(); inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())
  const inicioSemanaStr = inicioSemana.toISOString().slice(0, 10)
  const volumen = (i) => (Number(i.series) || 0) * (Number(i.reps) || 0) * (Number(i.peso) || 0)
  const volumenSemanal = sesiones.filter((g) => g.fecha >= inicioSemanaStr).reduce((a, g) => a + volumen(g), 0)
  const nombrePlan = (id) => planes.find((p) => p.id === id)?.nombre || 'Sin plan asignado'

  const pesosMaximosPorEjercicio = {}
  for (const s of sesiones) {
    const p = Number(s.peso) || 0
    if (!pesosMaximosPorEjercicio[s.ejercicio] || p > pesosMaximosPorEjercicio[s.ejercicio].peso) {
      pesosMaximosPorEjercicio[s.ejercicio] = { peso: p, fecha: s.fecha }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="text-2xl font-bold">Gimnasio</h1><p className="text-ink-muted text-sm mt-1">Rutinas, objetivos y récords</p></div>

      <div className="flex gap-1 bg-asphalt-950 p-1 rounded-lg overflow-x-auto">
        {[['registro', 'Registro'], ['planes', 'Rutinas'], ['objetivos', 'Objetivos'], ['records', 'Récords']].map(([id, label]) => (
          <button key={id} onClick={() => setVista(id)} className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${vista === id ? 'bg-hiviz text-asphalt-950' : 'text-ink-muted'}`}>{label}</button>
        ))}
      </div>

      {vista === 'registro' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatVolumen label="Hoy" valor={sesiones.filter((s) => s.fecha === hoy).reduce((a, s) => a + volumen(s), 0)} />
            <StatVolumen label="Esta semana" valor={volumenSemanal} />
            <StatVolumen label="Este mes" valor={sesiones.filter((s) => s.fecha.slice(0, 7) === hoy.slice(0, 7)).reduce((a, s) => a + volumen(s), 0)} />
          </div>

          {planes.length > 0 && (
            <div className="card">
              <span className="label-eyebrow">Registrar desde una rutina</span>
              <div className="flex flex-col gap-2 mt-2.5">
                {planes.map((p) => (
                  <button key={p.id} onClick={() => registrarDesdesPlan(p)} className="flex items-center justify-between border border-asphalt-700 rounded-lg px-3 py-2 text-left hover:border-hiviz">
                    <div><p className="text-sm font-medium">{p.nombre}</p><p className="text-ink-muted text-xs">{(p.ejercicios || []).length} ejercicios</p></div>
                    <span className="text-hiviz text-xs font-semibold">+ Registrar hoy</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => { setEditandoId(null); setFormOpen((v) => !v) }}>+ Ejercicio suelto</button>
          </div>
          {formOpen && <FormGimnasio planes={planes} onGuardar={crear} onCancelar={() => setFormOpen(false)} />}

          {porDia.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin sesiones registradas todavía.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {porDia.map(([fecha, items]) => (
                <div key={fecha}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">{fecha}</span>
                    <span className="readout text-xs text-ink-muted"><span className="text-hiviz font-semibold">{items.reduce((a, g) => a + volumen(g), 0).toLocaleString('es-AR')} kg</span> volumen del día</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.map((g) =>
                      editandoId === g.id ? (
                        <FormGimnasio key={g.id} planes={planes} valoresIniciales={g} onGuardar={(datos) => actualizar(g.id, datos)} onCancelar={() => setEditandoId(null)} />
                      ) : (
                        <div key={g.id} className="card flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{g.ejercicio} {prsPorId[g.id] && <span className="text-[10px] font-bold text-asphalt-950 bg-hiviz px-1.5 py-0.5 rounded-full ml-1">PR</span>}</p>
                            {g.plan_id && <p className="text-ink-faint text-[11px]">{nombrePlan(g.plan_id)}</p>}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex gap-3 text-right">
                              <MiniDato label="series" value={g.series} /><MiniDato label="reps" value={g.reps} /><MiniDato label="kg" value={g.peso} color="text-hiviz" />
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => { setFormOpen(false); setEditandoId(g.id) }} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Editar</button>
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

      {vista === 'planes' && (
        <>
          <div className="flex justify-end"><button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => { setPlanEditando(null); setFormPlanOpen((v) => !v) }}>+ Rutina</button></div>
          {formPlanOpen && <FormPlan onGuardar={crearPlan} onCancelar={() => setFormPlanOpen(false)} />}
          {planes.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin rutinas cargadas.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {planes.map((p) =>
                planEditando === p.id ? (
                  <FormPlan key={p.id} valoresIniciales={p} onGuardar={(datos) => actualizarPlan(p.id, datos)} onCancelar={() => setPlanEditando(null)} />
                ) : (
                  <div key={p.id} className="card">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{p.nombre}</p>
                      <div className="flex gap-1">
                        <button onClick={() => { setFormPlanOpen(false); setPlanEditando(p.id) }} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Editar</button>
                        <button onClick={() => { if (confirm('¿Borrar esta rutina?')) borrarPlan(p.id) }} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
                      </div>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      {DIAS_SEMANA.map((d) => <span key={d.id} className={`text-[10px] px-1.5 py-0.5 rounded ${(p.dias_semana || []).includes(d.id) ? 'bg-hiviz text-asphalt-950 font-semibold' : 'text-ink-faint border border-asphalt-700'}`}>{d.label}</span>)}
                    </div>
                    <div className="mt-2.5 flex flex-col gap-1">
                      {(p.ejercicios || []).map((ej, i) => <p key={i} className="text-ink-muted text-xs">{ej.ejercicio} — {ej.series}x{ej.reps}</p>)}
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
            Object.entries(pesosMaximosPorEjercicio).map(([ejercicio, info]) => (
              <div key={ejercicio} className="card flex items-center justify-between">
                <div><p className="text-sm font-semibold">{ejercicio}</p><p className="text-ink-muted text-xs">{info.fecha}</p></div>
                <span className="readout text-lg font-bold text-hiviz">{info.peso} kg</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function StatVolumen({ label, valor }) {
  return <div className="card"><span className="label-eyebrow">{label}</span><p className="readout text-lg font-bold text-hiviz mt-1">{valor.toLocaleString('es-AR')} kg</p></div>
}
function MiniDato({ label, value, color = 'text-ink' }) {
  return <div><p className={`readout text-sm font-semibold ${color}`}>{value}</p><p className="text-ink-muted text-[10px] uppercase">{label}</p></div>
}

function FormGimnasio({ onGuardar, onCancelar, valoresIniciales, planes = [] }) {
  const [form, setForm] = useState({ fecha: new Date().toISOString().slice(0, 10), ejercicio: 'Sentadilla', series: '', reps: '', peso: '', rpe: '', plan_id: '', ...valoresIniciales })
  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })
  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onGuardar({ ...form, plan_id: form.plan_id || null }) }}>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fecha</span><input type="date" {...campo('fecha')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Ejercicio</span>
        <select {...campo('ejercicio')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">{EJERCICIOS_COMUNES.map((e) => <option key={e}>{e}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Series</span><input type="number" {...campo('series')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Reps</span><input type="number" {...campo('reps')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Peso (kg)</span><input type="number" {...campo('peso')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">RPE (1-10)</span><input type="number" min="1" max="10" {...campo('rpe')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      {planes.length > 0 && (
        <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Rutina</span>
          <select {...campo('plan_id')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink"><option value="">— Suelto —</option>{planes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
      )}
      <div className="col-span-2 flex justify-end gap-2 mt-1"><button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button><button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button></div>
    </form>
  )
}

function FormPlan({ onGuardar, onCancelar, valoresIniciales }) {
  const [nombre, setNombre] = useState(valoresIniciales?.nombre || '')
  const [dias, setDias] = useState(valoresIniciales?.dias_semana || [])
  const [ejercicios, setEjercicios] = useState(valoresIniciales?.ejercicios || [{ ejercicio: 'Sentadilla', series: 4, reps: 8 }])
  function toggleDia(id) { setDias((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id])) }
  function actualizarEjercicio(i, campo, valor) { setEjercicios((ejs) => ejs.map((e, idx) => (idx === i ? { ...e, [campo]: valor } : e))) }
  function agregarEjercicio() { setEjercicios((ejs) => [...ejs, { ejercicio: 'Sentadilla', series: 3, reps: 10 }]) }
  function quitarEjercicio(i) { setEjercicios((ejs) => ejs.filter((_, idx) => idx !== i)) }
  return (
    <form className="card flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); onGuardar({ nombre, dias_semana: dias, ejercicios }) }}>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Nombre de la rutina</span><input value={nombre} onChange={(e) => setNombre(e.target.value)} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div>
        <span className="text-ink-muted text-xs">Días de la semana</span>
        <div className="flex gap-1.5 mt-1.5">
          {DIAS_SEMANA.map((d) => (
            <button key={d.id} type="button" onClick={() => toggleDia(d.id)} className={`flex-1 text-center py-1.5 rounded-md text-xs border ${dias.includes(d.id) ? 'bg-hiviz text-asphalt-950 border-hiviz font-semibold' : 'border-asphalt-700 text-ink-muted'}`}>{d.label}</button>
          ))}
        </div>
      </div>
      <div>
        <span className="text-ink-muted text-xs">Ejercicios</span>
        <div className="flex flex-col gap-2 mt-1.5">
          {ejercicios.map((ej, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 items-end">
              <select value={ej.ejercicio} onChange={(e) => actualizarEjercicio(i, 'ejercicio', e.target.value)} className="col-span-2 bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm">
                {EJERCICIOS_COMUNES.map((e) => <option key={e}>{e}</option>)}
              </select>
              <input type="number" value={ej.series} onChange={(e) => actualizarEjercicio(i, 'series', e.target.value)} placeholder="Series" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm" />
              <div className="flex gap-1">
                <input type="number" value={ej.reps} onChange={(e) => actualizarEjercicio(i, 'reps', e.target.value)} placeholder="Reps" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm w-full" />
                <button type="button" onClick={() => quitarEjercicio(i)} className="text-alert-red text-xs px-2">✕</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={agregarEjercicio} className="text-hiviz text-xs mt-2">+ Agregar ejercicio</button>
      </div>
      <div className="flex justify-end gap-2 mt-1"><button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button><button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar rutina</button></div>
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
