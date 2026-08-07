import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabaseClient'

const NIVELES = [1, 2, 3, 4, 5]

function estadoRecuperacion(r) {
  if (!r) return { color: '#565B68', texto: 'Sin datos' }
  const señales = []
  if (r.body_battery_manana != null && r.body_battery_manana !== '') {
    const bb = Number(r.body_battery_manana)
    señales.push(bb >= 70 ? 0 : bb >= 40 ? 1 : 2)
  }
  if (r.estres_score != null && r.estres_score !== '') {
    const es = Number(r.estres_score)
    señales.push(es <= 25 ? 0 : es <= 50 ? 1 : 2)
  }
  if (r.sueño_score != null && r.sueño_score !== '') {
    const ss = Number(r.sueño_score)
    señales.push(ss >= 80 ? 0 : ss >= 60 ? 1 : 2)
  }
  const fatiga = Number(r.fatiga) || 0, dolor = Number(r.dolor_muscular) || 0, estresP = Number(r.estres) || 0
  const sueño = Number(r.sueño_horas) || 0
  const subjetivo = (fatiga + dolor + estresP) / 3 - (sueño >= 7 ? 0.5 : sueño >= 6 ? 0 : -0.5)
  señales.push(subjetivo <= 2 ? 0 : subjetivo <= 3.5 ? 1 : 2)

  const promedio = señales.reduce((a, b) => a + b, 0) / señales.length
  if (promedio < 0.66) return { color: '#C4F135', texto: 'Buen estado — listo para exigir' }
  if (promedio < 1.33) return { color: '#F5A623', texto: 'Moderado — controlar la carga' }
  return { color: '#F14A4A', texto: 'Fatiga alta — priorizar descanso' }
}

function fmtFecha(f) { const [, m, d] = f.split('-'); return `${d}/${m}` }

export default function Recuperacion() {
  const [registros, setRegistros] = useState([])
  const hoy = new Date().toISOString().slice(0, 10)
  const entradaHoy = registros.find((r) => r.fecha === hoy)
  const [form, setForm] = useState({
    fecha: hoy, sueño_horas: '', sueño_score: '', calidad_sueño: 3,
    estres_score: '', body_battery_manana: '', body_battery_noche: '',
    hrv: '', hrv_estado: '', fc_reposo: '', spo2: '', respiracion_rpm: '',
    dolor_muscular: 2, fatiga: 2, estres: 2
  })

  async function cargar() {
    const { data } = await supabase.from('metricas_diarias').select('*').order('fecha', { ascending: false }).limit(30)
    setRegistros(data || [])
    const hoyData = (data || []).find((r) => r.fecha === hoy)
    if (hoyData) setForm(hoyData)
  }

  useEffect(() => { cargar() }, [])

    async function guardar() {
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('metricas_diarias').upsert(
      { ...form, user_id: userData.user.id, fuente: 'manual' },
      { onConflict: 'user_id,fecha' }
    )
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    cargar()
  }

  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })
  const { color, texto } = estadoRecuperacion(entradaHoy || form)

  const graficoData = [...registros].reverse().map((r) => ({
    fecha: r.fecha,
    sueño: r.sueño_horas != null ? Number(r.sueño_horas) : null,
    bodyBattery: r.body_battery_manana != null ? Number(r.body_battery_manana) : null,
    estres: r.estres_score != null ? Number(r.estres_score) : null
  }))
  const hayDatosSueño = graficoData.filter((d) => d.sueño != null).length > 1
  const hayDatosBB = graficoData.filter((d) => d.bodyBattery != null).length > 1
  const hayDatosEstres = graficoData.filter((d) => d.estres != null).length > 1

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Recuperación</h1>
        <p className="text-ink-muted text-sm mt-1">Sueño, estrés, body battery y estado general</p>
      </div>

      <div className="card" style={{ borderColor: color }}>
        <span className="label-eyebrow">Hoy</span>
        <p className="text-sm font-semibold mt-1.5" style={{ color }}>{texto}</p>
      </div>

      {(hayDatosSueño || hayDatosBB || hayDatosEstres) && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Evolución</h2>
          <div className="flex flex-col gap-3">
            {hayDatosSueño && (
              <div className="card">
                <span className="label-eyebrow">Horas de sueño</span>
                <div className="mt-2 -ml-4">
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={graficoData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#262A33" vertical={false} />
                      <XAxis dataKey="fecha" tickFormatter={fmtFecha} tick={{ fill: '#8A8F9C', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#262A33' }} />
                      <YAxis tick={{ fill: '#8A8F9C', fontSize: 10 }} tickLine={false} axisLine={false} width={25} domain={[0, 10]} />
                      <Tooltip contentStyle={{ background: '#1C1F26', border: '1px solid #262A33', borderRadius: 8, fontSize: 12 }} labelFormatter={fmtFecha} />
                      <Line type="monotone" dataKey="sueño" stroke="#4A9EFF" strokeWidth={2} dot={{ r: 3 }} name="Horas" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {hayDatosBB && (
              <div className="card">
                <span className="label-eyebrow">Body Battery al despertar</span>
                <div className="mt-2 -ml-4">
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={graficoData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#262A33" vertical={false} />
                      <XAxis dataKey="fecha" tickFormatter={fmtFecha} tick={{ fill: '#8A8F9C', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#262A33' }} />
                      <YAxis tick={{ fill: '#8A8F9C', fontSize: 10 }} tickLine={false} axisLine={false} width={25} domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: '#1C1F26', border: '1px solid #262A33', borderRadius: 8, fontSize: 12 }} labelFormatter={fmtFecha} />
                      <Line type="monotone" dataKey="bodyBattery" stroke="#C4F135" strokeWidth={2} dot={{ r: 3 }} name="Body Battery" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {hayDatosEstres && (
              <div className="card">
                <span className="label-eyebrow">Stress score</span>
                <div className="mt-2 -ml-4">
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={graficoData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#262A33" vertical={false} />
                      <XAxis dataKey="fecha" tickFormatter={fmtFecha} tick={{ fill: '#8A8F9C', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#262A33' }} />
                      <YAxis tick={{ fill: '#8A8F9C', fontSize: 10 }} tickLine={false} axisLine={false} width={25} domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: '#1C1F26', border: '1px solid #262A33', borderRadius: 8, fontSize: 12 }} labelFormatter={fmtFecha} />
                      <Line type="monotone" dataKey="estres" stroke="#F14A4A" strokeWidth={2} dot={{ r: 3 }} name="Stress" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <form className="card flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); guardar() }}>
        <div>
          <span className="label-eyebrow">Datos de wearable (Garmin, Whoop, etc.)</span>
          <p className="text-ink-faint text-xs mt-0.5 mb-3">Cuando conectemos Garmin Connect, estos campos se van a completar solos.</p>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Sueño total (h)" type="number" step="0.5" {...campo('sueño_horas')} />
            <Campo label="Sleep score (0-100)" type="number" min="0" max="100" {...campo('sueño_score')} />
            <Campo label="Body Battery al despertar" type="number" min="0" max="100" {...campo('body_battery_manana')} />
            <Campo label="Body Battery antes de dormir" type="number" min="0" max="100" {...campo('body_battery_noche')} />
            <Campo label="Stress score (0-100)" type="number" min="0" max="100" {...campo('estres_score')} />
            <Campo label="FC reposo" type="number" {...campo('fc_reposo')} />
            <Campo label="HRV (ms)" type="number" {...campo('hrv')} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-muted text-xs">Estado HRV</span>
              <select {...campo('hrv_estado')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
                <option value="">—</option>
                <option value="bajo">Bajo</option>
                <option value="equilibrado">Equilibrado</option>
                <option value="alto">Alto</option>
              </select>
            </label>
            <Campo label="SpO2 (%)" type="number" {...campo('spo2')} />
            <Campo label="Respiración (rpm)" type="number" {...campo('respiracion_rpm')} />
          </div>
        </div>

        <div className="border-t border-asphalt-700 pt-3">
          <span className="label-eyebrow">Percepción propia</span>
          <div className="grid grid-cols-2 gap-3 mt-2.5">
            <Escala label="Calidad del sueño" value={form.calidad_sueño} onChange={(v) => setForm((f) => ({ ...f, calidad_sueño: v }))} />
            <Escala label="Dolor muscular" value={form.dolor_muscular} onChange={(v) => setForm((f) => ({ ...f, dolor_muscular: v }))} />
            <Escala label="Fatiga" value={form.fatiga} onChange={(v) => setForm((f) => ({ ...f, fatiga: v }))} />
            <Escala label="Estrés percibido" value={form.estres} onChange={(v) => setForm((f) => ({ ...f, estres: v }))} />
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">
            {entradaHoy ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </form>

      {registros.length > 0 && (
        <div className="flex flex-col gap-2">
          {registros.slice(0, 10).map((r) => {
            const est = estadoRecuperacion(r)
            return (
              <div key={r.fecha} className="card flex justify-between items-center py-2.5">
                <span className="text-sm">{r.fecha}</span>
                <div className="flex gap-2.5 items-center">
                  {r.body_battery_manana != null && <span className="text-ink-muted text-xs">BB {r.body_battery_manana}</span>}
                  <span className="text-ink-muted text-xs">{r.sueño_horas || '—'}h sueño</span>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: est.color }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Campo({ label, ...props }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-muted text-xs">{label}</span>
      <input {...props} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" />
    </label>
  )
}

function Escala({ label, value, onChange }) {
  return (
    <div>
      <label className="text-ink-muted text-xs">{label} ({value}/5)</label>
      <div className="flex gap-1 mt-1">
        {NIVELES.map((n) => (
          <div
            key={n}
            onClick={() => onChange(n)}
            className={`flex-1 text-center py-1.5 rounded-md text-xs cursor-pointer border border-asphalt-700 ${
              Number(value) === n ? 'bg-hiviz text-asphalt-950' : 'bg-asphalt-900 text-ink-muted'
            }`}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  )
}
