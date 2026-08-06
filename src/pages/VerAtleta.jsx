import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { calcularTSS } from '../lib/tss'

const TIPOS = ['Ruta', 'MTB', 'Gravel', 'Rodillo', 'Pista', 'Descanso']
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

  const [email, setEmail] = useState('')
  const [entrenamientos, setEntrenamientos] = useState([])
  const [gimnasio, setGimnasio] = useState([])
  const [comidas, setComidas] = useState([])
  const [planes, setPlanes] = useState([])
  const [formPlanOpen, setFormPlanOpen] = useState(false)
  const [planEditando, setPlanEditando] = useState(null)
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    setCargando(true)
    const desde30 = new Date()
    desde30.setDate(desde30.getDate() - 30)
    const fechaDesde = desde30.toISOString().slice(0, 10)

    const { data: emailData } = await supabase.rpc('email_de_vinculado', { p_user_id: atletaId })
    setEmail(emailData || 'Atleta')

    const [{ data: ents }, { data: gym }, { data: pls }] = await Promise.all([
      supabase.from('entrenamientos').select('*').eq('user_id', atletaId).gte('fecha', fechaDesde).order('fecha', { ascending: false }),
      supabase.from('gimnasio').select('*').eq('user_id', atletaId).gte('fecha', fechaDesde).order('fecha', { ascending: false }),
      supabase.from('planes_entrenamiento').select('*').eq('user_id', atletaId).eq('activo', true).order('created_at', { ascending: true })
    ])
    setEntrenamientos(ents || [])
    setGimnasio(gym || [])
    setPlanes(pls || [])

    if (esNutricionista) {
      const { data: cms } = await supabase.from('comidas').select('*').eq('user_id', atletaId).gte('fecha', fechaDesde)
      setComidas(cms || [])
    }
    setCargando(false)
  }

  useEffect(() => { cargar() }, [atletaId, rol])

  async function crearPlan(form) {
    await supabase.from('planes_entrenamiento').insert({ ...form, user_id: atletaId })
    setFormPlanOpen(false)
    cargar()
  }

  async function actualizarPlan(id, form) {
    await supabase.from('planes_entrenamiento').update(form).eq('id', id)
    setPlanEditando(null)
    cargar()
  }

  async function borrarPlan(id) {
    if (!confirm('¿Borrar este plan?')) return
    await supabase.from('planes_entrenamiento').update({ activo: false }).eq('id', id)
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

      {rol === 'entrenador' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Planes que le asignaste</h2>
            <button
              onClick={() => { setPlanEditando(null); setFormPlanOpen((v) => !v) }}
              className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg"
            >
              + Plan
            </button>
          </div>

          {formPlanOpen && (
            <FormPlanEntreno onGuardar={crearPlan} onCancelar={() => setFormPlanOpen(false)} />
          )}

          {planes.length === 0 ? (
            <p className="text-ink-muted text-sm">Todavía no le asignaste ningún plan.</p>
          ) : (
            <div className="flex flex-col gap-3 mt-2">
              {planes.map((p) =>
                planEditando === p.id ? (
                  <FormPlanEntreno
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
