import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabaseClient'

const ZONAS_POTENCIA = [
  { zona: 'Z1', nombre: 'Recuperación activa', desde: 0, hasta: 0.55, color: '#8A8F9C' },
  { zona: 'Z2', nombre: 'Resistencia', desde: 0.56, hasta: 0.75, color: '#4A9EFF' },
  { zona: 'Z3', nombre: 'Tempo', desde: 0.76, hasta: 0.90, color: '#C4F135' },
  { zona: 'Z4', nombre: 'Umbral', desde: 0.91, hasta: 1.05, color: '#F5A623' },
  { zona: 'Z5', nombre: 'VO2 máx', desde: 1.06, hasta: 1.20, color: '#F14A4A' },
  { zona: 'Z6', nombre: 'Capacidad anaeróbica', desde: 1.21, hasta: 1.50, color: '#C34AF1' },
  { zona: 'Z7', nombre: 'Neuromuscular', desde: 1.51, hasta: null, color: '#7A4AF1' }
]

const ZONAS_FC = [
  { zona: 'Z1', nombre: 'Recuperación activa', desde: 0, hasta: 0.68, color: '#8A8F9C' },
  { zona: 'Z2', nombre: 'Resistencia', desde: 0.69, hasta: 0.83, color: '#4A9EFF' },
  { zona: 'Z3', nombre: 'Tempo', desde: 0.84, hasta: 0.94, color: '#C4F135' },
  { zona: 'Z4', nombre: 'Umbral', desde: 0.95, hasta: 1.05, color: '#F5A623' },
  { zona: 'Z5', nombre: 'VO2 máx', desde: 1.06, hasta: null, color: '#F14A4A' }
]

function fmtFecha(f) {
  const [, m, d] = f.split('-')
  return `${d}/${m}`
}

export default function FTP() {
  const [historial, setHistorial] = useState([])
  const [formOpen, setFormOpen] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('ftp_historial').select('*').order('fecha', { ascending: true })
    setHistorial(data || [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  async function crear(form) {
    await supabase.from('ftp_historial').insert(form)
    setFormOpen(false)
    cargar()
  }

  async function actualizar(id, form) {
    await supabase.from('ftp_historial').update(form).eq('id', id)
    setEditandoId(null)
    cargar()
  }

  async function eliminar(id) {
    if (!confirm('¿Borrar este registro de FTP?')) return
    await supabase.from('ftp_historial').delete().eq('id', id)
    cargar()
  }

  const actual = historial[historial.length - 1] || null
  const grafico = historial.map((h) => ({ fecha: h.fecha, ftp: h.ftp_watts, fc: h.fc_umbral }))

  if (cargando) return <p className="text-ink-muted text-sm">Cargando…</p>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">FTP y zonas</h1>
          <p className="text-ink-muted text-sm mt-1">Umbral funcional y zonas de entrenamiento</p>
        </div>
        <button
          onClick={() => { setEditandoId(null); setFormOpen((v) => !v) }}
          className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg"
        >
          + Test
        </button>
      </div>

      {formOpen && <FormFTP onGuardar={crear} onCancelar={() => setFormOpen(false)} />}

      {!actual ? (
        <p className="text-ink-muted text-sm">
          Todavía no cargaste ningún test de FTP. Sumá el primero para que la app calcule tus zonas de entrenamiento.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="card">
              <span className="label-eyebrow">FTP actual</span>
              <p className="readout text-3xl font-bold text-hiviz mt-1">{actual.ftp_watts} <span className="text-sm text-ink-muted">W</span></p>
              <p className="text-ink-faint text-xs mt-1">{actual.fecha}</p>
            </div>
            <div className="card">
              <span className="label-eyebrow">FC umbral</span>
              <p className="readout text-3xl font-bold text-route mt-1">
                {actual.fc_umbral ? <>{actual.fc_umbral} <span className="text-sm text-ink-muted">bpm</span></> : '—'}
              </p>
              <p className="text-ink-faint text-xs mt-1">{actual.fc_umbral ? actual.fecha : 'No cargada'}</p>
            </div>
          </div>

          {historial.length > 1 && (
            <div className="card">
              <span className="label-eyebrow">Evolución del FTP</span>
              <div className="mt-2 -ml-4">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={grafico} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgb(var(--color-asphalt-700))" vertical={false} />
                    <XAxis dataKey="fecha" tickFormatter={fmtFecha} tick={{ fill: 'rgb(var(--color-ink-faint))', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'rgb(var(--color-asphalt-700))' }} />
                    <YAxis tick={{ fill: 'rgb(var(--color-ink-faint))', fontSize: 10 }} tickLine={false} axisLine={false} width={30} domain={['dataMin - 10', 'dataMax + 10']} />
                    <Tooltip contentStyle={{ background: 'rgb(var(--color-asphalt-800))', border: '1px solid rgb(var(--color-asphalt-700))', borderRadius: 8, fontSize: 12 }} labelFormatter={fmtFecha} />
                    <Line type="monotone" dataKey="ftp" stroke="rgb(var(--color-state-success))" strokeWidth={2} dot={{ r: 3 }} name="FTP (W)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold mb-2">Zonas de potencia</h2>
            <div className="flex flex-col gap-1.5">
              {ZONAS_POTENCIA.map((z) => {
                const desde = Math.round(actual.ftp_watts * z.desde)
                const hasta = z.hasta ? Math.round(actual.ftp_watts * z.hasta) : null
                return (
                  <div key={z.zona} className="card flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: z.color }} />
                      <div>
                        <p className="text-sm font-medium">{z.zona} — {z.nombre}</p>
                      </div>
                    </div>
                    <span className="readout text-sm font-semibold">
                      {desde}{hasta ? `–${hasta}` : '+'} W
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {actual.fc_umbral && (
            <div>
              <h2 className="text-sm font-semibold mb-2">Zonas de frecuencia cardíaca</h2>
              <div className="flex flex-col gap-1.5">
                {ZONAS_FC.map((z) => {
                  const desde = Math.round(actual.fc_umbral * z.desde)
                  const hasta = z.hasta ? Math.round(actual.fc_umbral * z.hasta) : null
                  return (
                    <div key={z.zona} className="card flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: z.color }} />
                        <p className="text-sm font-medium">{z.zona} — {z.nombre}</p>
                      </div>
                      <span className="readout text-sm font-semibold">
                        {desde}{hasta ? `–${hasta}` : '+'} bpm
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {historial.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Historial de tests</h2>
          <div className="flex flex-col gap-2">
            {[...historial].reverse().map((h) =>
              editandoId === h.id ? (
                <FormFTP
                  key={h.id}
                  valoresIniciales={h}
                  onGuardar={(datos) => actualizar(h.id, datos)}
                  onCancelar={() => setEditandoId(null)}
                />
              ) : (
                <div key={h.id} className="card flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{h.ftp_watts} W {h.fc_umbral ? `· ${h.fc_umbral} bpm` : ''}</p>
                    <p className="text-ink-muted text-xs">{h.fecha} · {h.fuente === 'test' ? 'Test' : 'Estimado'}{h.notas ? ` · ${h.notas}` : ''}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setFormOpen(false); setEditandoId(h.id) }}
                      className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => eliminar(h.id)}
                      className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FormFTP({ onGuardar, onCancelar, valoresIniciales }) {
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    ftp_watts: '',
    fc_umbral: '',
    fuente: 'test',
    notas: '',
    ...valoresIniciales
  })
  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })

  return (
    <form
      className="card grid grid-cols-2 gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        onGuardar({
          ...form,
          ftp_watts: Number(form.ftp_watts),
          fc_umbral: form.fc_umbral ? Number(form.fc_umbral) : null
        })
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted text-xs">Fecha</span>
        <input type="date" {...campo('fecha')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted text-xs">Fuente</span>
        <select {...campo('fuente')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          <option value="test">Test</option>
          <option value="estimado">Estimado</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted text-xs">FTP (W)</span>
        <input type="number" {...campo('ftp_watts')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted text-xs">FC umbral (bpm)</span>
        <input type="number" {...campo('fc_umbral')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" />
      </label>
      <label className="flex flex-col gap-1 text-sm col-span-2">
        <span className="text-ink-muted text-xs">Notas</span>
        <input {...campo('notas')} placeholder="Test de 20 min / FTP directo / etc." className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" />
      </label>
      <div className="col-span-2 flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button>
      </div>
    </form>
  )
}
