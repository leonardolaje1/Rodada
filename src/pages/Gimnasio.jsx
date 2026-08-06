import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const EJERCICIOS_COMUNES = ['Sentadilla', 'Peso muerto', 'Press banca', 'Zancadas', 'Prensa', 'Core / plancha', 'Otro']

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

export default function Gimnasio() {
  const [sesiones, setSesiones] = useState([])
  const [formOpen, setFormOpen] = useState(false)
  const [editandoId, setEditandoId] = useState(null)

  async function cargar() {
    const { data } = await supabase.from('gimnasio').select('*').order('fecha', { ascending: false }).limit(300)
    setSesiones(data || [])
  }

  useEffect(() => { cargar() }, [])

  const inicioSemana = new Date()
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())
  const inicioSemanaStr = inicioSemana.toISOString().slice(0, 10)
  const volumenSemanal = sesiones
    .filter((g) => g.fecha >= inicioSemanaStr)
    .reduce((a, g) => a + (Number(g.series) || 0) * (Number(g.reps) || 0) * (Number(g.peso) || 0), 0)

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

  const porDia = agruparPorFecha(sesiones)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gimnasio</h1>
          <p className="text-ink-muted text-sm mt-1">Fuerza y volumen</p>
        </div>
        <button
          className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg"
          onClick={() => { setEditandoId(null); setFormOpen((v) => !v) }}
        >
          + Ejercicio
        </button>
      </div>

      <div className="card">
        <span className="label-eyebrow">Volumen — esta semana</span>
        <p className="readout text-3xl font-bold text-hiviz mt-1">{volumenSemanal.toLocaleString('es-AR')} kg</p>
      </div>

      {formOpen && <FormGimnasio onGuardar={crear} onCancelar={() => setFormOpen(false)} />}

      {porDia.length === 0 ? (
        <p className="text-ink-muted text-sm">Sin sesiones registradas todavía.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {porDia.map(([fecha, items]) => {
            const volumenDia = items.reduce((a, g) => a + (Number(g.series) || 0) * (Number(g.reps) || 0) * (Number(g.peso) || 0), 0)
            return (
              <div key={fecha}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">{fecha}</span>
                  <span className="readout text-xs text-ink-muted">
                    <span className="text-hiviz font-semibold">{volumenDia.toLocaleString('es-AR')} kg</span> volumen del día
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((g) =>
                    editandoId === g.id ? (
                      <FormGimnasio
                        key={g.id}
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

function FormGimnasio({ onGuardar, onCancelar, valoresIniciales }) {
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10), ejercicio: 'Sentadilla', series: '', reps: '', peso: '', rpe: '',
    ...valoresIniciales
  })
  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })

  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onGuardar(form) }}>
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
      <div className="col-span-2 flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button>
      </div>
    </form>
  )
}
