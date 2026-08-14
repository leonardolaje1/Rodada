import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import IconoInsignia from '../components/IconoInsignia'
import { Moon } from 'lucide-react'
import { useToast } from '../lib/ToastContext'
import { useConfirm } from '../lib/ConfirmContext'

const NIVELES = [1, 2, 3, 4, 5]
const PERIODOS = [
  { dias: 7, label: '7 días' },
  { dias: 30, label: '30 días' },
  { dias: 90, label: '90 días' }
]
const ZONAS_LESION = ['Rodilla', 'Espalda baja', 'Cuello/cervical', 'Hombro', 'Muñeca/mano', 'Cadera', 'Isquiotibiales', 'Cuádriceps', 'Otro']
const CAUSAS_LESION = [
  { id: 'mala_posicion_bici', label: 'Mala posición en la bici' },
  { id: 'sobrecarga', label: 'Sobrecarga / uso excesivo' },
  { id: 'caida', label: 'Caída / accidente' },
  { id: 'otro', label: 'Otro' }
]
const DIAS_ALERTA_BIKEFIT = 5

function estadoRecuperacion(r) {
    if (!r) return { color: 'rgb(var(--color-state-neutral))', texto: 'Sin datos' }
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
  if (promedio < 0.66) return { color: 'rgb(var(--color-state-success))', texto: 'Buen estado — listo para exigir' }
  if (promedio < 1.33) return { color: 'rgb(var(--color-state-warning))', texto: 'Moderado — controlar la carga' }
  return { color: 'rgb(var(--color-state-critical))', texto: 'Fatiga alta — priorizar descanso' }
}

function fmtFecha(f) { const [, m, d] = f.split('-'); return `${d}/${m}` }
function diasDesde(fecha) {
  const ms = new Date().setHours(0, 0, 0, 0) - new Date(fecha + 'T00:00:00').getTime()
  return Math.round(ms / 86400000)
}

export default function Recuperacion() {
  const toast = useToast()
  const { confirmar, alertar } = useConfirm()
  const [registros, setRegistros] = useState([])
  const [lesiones, setLesiones] = useState([])
  const [periodoDias, setPeriodoDias] = useState(30)
  const [formLesionOpen, setFormLesionOpen] = useState(false)
    const [mostrarWearable, setMostrarWearable] = useState(false)
  const hoy = new Date().toISOString().slice(0, 10)
  const valoresVacios = {
    sueño_horas: '', sueño_score: '', calidad_sueño: 3,
    estres_score: '', body_battery_manana: '', body_battery_noche: '',
    hrv: '', hrv_estado: '', fc_reposo: '', spo2: '', respiracion_rpm: '',
    dolor_muscular: 2, fatiga: 2, estres: 2
  }
  const [form, setForm] = useState({ fecha: hoy, ...valoresVacios })
  const entradaExistente = registros.find((r) => r.fecha === form.fecha)

  async function cargar() {
    const [{ data }, { data: les }] = await Promise.all([
      supabase.from('metricas_diarias').select('*').order('fecha', { ascending: false }).limit(100),
      supabase.from('lesiones').select('*').order('fecha_inicio', { ascending: false })
    ])
    setRegistros(data || [])
    setLesiones(les || [])
  }

  function cambiarFecha(nuevaFecha) {
    const existente = registros.find((r) => r.fecha === nuevaFecha)
    setForm(existente ? { ...valoresVacios, ...existente } : { fecha: nuevaFecha, ...valoresVacios })
  }

  function editarRegistro(r) {
    setForm({ ...valoresVacios, ...r })
    window.scrollTo({ top: document.body.scrollHeight * 0.35, behavior: 'smooth' })
  }

  async function eliminarRegistro(fecha) {
    if (!(await confirmar(`¿Borrar el registro de recuperación del ${fecha}?`, { destructivo: true }))) return
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('metricas_diarias').delete().eq('user_id', userData.user.id).eq('fecha', fecha)
    if (error) { alertar('No se pudo borrar: ' + error.message); return }
    if (form.fecha === fecha) setForm({ fecha: hoy, ...valoresVacios })
    cargar()
  }

  useEffect(() => { cargar() }, [])

  async function guardar() {
    const camposNumericos = [
      'sueño_horas', 'sueño_score', 'estres_score', 'body_battery_manana', 'body_battery_noche',
      'hrv', 'fc_reposo', 'spo2', 'respiracion_rpm', 'calidad_sueño', 'dolor_muscular', 'fatiga', 'estres'
    ]
    const payload = { ...form }
    for (const c of camposNumericos) {
      if (payload[c] === '') payload[c] = null
    }

    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('metricas_diarias').upsert(
      { ...payload, user_id: userData.user.id, fuente: 'manual' },
      { onConflict: 'user_id,fecha' }
    )
    if (error) { alertar('No se pudo guardar: ' + error.message); return }
    cargar()
    toast('Recuperación guardada')
  }

  async function crearLesion(datos) {
    const { error } = await supabase.from('lesiones').insert(datos)
    if (error) { alertar('No se pudo guardar: ' + error.message); return }
    setFormLesionOpen(false); cargar()
  }
  async function marcarRecuperada(id) {
    await supabase.from('lesiones').update({ estado: 'recuperada' }).eq('id', id); cargar()
  }
  async function eliminarLesion(id) {
    if (!(await confirmar('¿Borrar este registro de lesión?', { destructivo: true }))) return
    await supabase.from('lesiones').delete().eq('id', id); cargar()
  }

  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })
  const { color, texto } = estadoRecuperacion(entradaExistente || form)

  const fechaLimite = new Date()
  fechaLimite.setDate(fechaLimite.getDate() - periodoDias)
  const fechaLimiteStr = fechaLimite.toISOString().slice(0, 10)
  const registrosPeriodo = registros.filter((r) => r.fecha >= fechaLimiteStr)

  const graficoData = [...registrosPeriodo].reverse().map((r) => ({
    fecha: r.fecha,
    sueño: r.sueño_horas != null ? Number(r.sueño_horas) : null,
    bodyBattery: r.body_battery_manana != null ? Number(r.body_battery_manana) : null,
    estres: r.estres_score != null ? Number(r.estres_score) : null
  }))
  const hayDatosSueño = graficoData.filter((d) => d.sueño != null).length > 1
  const hayDatosBB = graficoData.filter((d) => d.bodyBattery != null).length > 1
  const hayDatosEstres = graficoData.filter((d) => d.estres != null).length > 1

  const alertaBikeFit = lesiones.find((l) =>
    l.estado === 'activa' && l.causa === 'mala_posicion_bici' && diasDesde(l.fecha_inicio) >= DIAS_ALERTA_BIKEFIT
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <IconoInsignia Icono={Moon} />
        <div>
          <h1 className="text-2xl font-bold">Recuperación</h1>
          <p className="text-ink-muted text-sm mt-1">Sueño, estrés, body battery y estado general</p>
        </div>
      </div>

      <div className="card" style={{ borderColor: color }}>
        <span className="label-eyebrow">{form.fecha === hoy ? 'Hoy' : form.fecha}</span>
        <p className="text-sm font-semibold mt-1.5" style={{ color }}>{texto}</p>
      </div>

      {alertaBikeFit && (
        <div className="card border-alert-amber">
          <span className="label-eyebrow text-alert-amber">Posible causa: postura en la bici</span>
          <p className="text-sm mt-1.5">
            Tenés una molestia en <b>{alertaBikeFit.zona}</b> hace {diasDesde(alertaBikeFit.fecha_inicio)} días,
            asociada a mala posición en la bici. Podría convenir un nuevo estudio de bike fitting.
          </p>
          <Link to="/bicicletas" className="text-hiviz text-xs mt-2 inline-block">Ir a Bicis →</Link>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">Evolución</h2>
          <div className="flex gap-1 bg-asphalt-950 p-1 rounded-lg">
            {PERIODOS.map((p) => (
              <button
                key={p.dias}
                onClick={() => setPeriodoDias(p.dias)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold ${periodoDias === p.dias ? 'bg-hiviz text-asphalt-950' : 'text-ink-muted'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {!hayDatosSueño && !hayDatosBB && !hayDatosEstres ? (
          <p className="text-ink-muted text-sm">No hay suficientes registros en este período para graficar.</p>
        ) : (
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
        )}
      </div>

      <form className="card flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); guardar() }}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted text-xs">Fecha del registro</span>
          <input
            type="date"
            value={form.fecha}
            max={hoy}
            onChange={(e) => cambiarFecha(e.target.value)}
            className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink"
          />
          {entradaExistente && <span className="text-ink-faint text-xs mt-1">Ya existe un registro para este día — al guardar lo vas a actualizar.</span>}
        </label>

        <div>
          <button
            type="button"
            onClick={() => setMostrarWearable((v) => !v)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="label-eyebrow">Datos de wearable (Garmin, Whoop, etc.)</span>
            <span className="text-hiviz text-xs font-semibold">{mostrarWearable ? 'Ocultar ▲' : 'Agregar ▼'}</span>
          </button>
          <p className="text-ink-faint text-xs mt-0.5 mb-3">Cuando conectemos Garmin Connect, estos campos se van a completar solos.</p>
          {mostrarWearable && (
          <div className="grid grid-cols-2 gap-3">

        </div>

        <div className="border-t border-asphalt-700 pt-3">
          <span className="label-eyebrow">Percepción propia</span>
          <div className="grid grid-cols-2 gap-3 mt-2.5">
            <Escala label="Calidad del sueño" value={form.calidad_sueño} onChange={(v) => setForm((f) => ({ ...f, calidad_sueño: v }))} />
            <Escala label="Dolor muscular" value={form.dolor_muscular} onChange={(v) => setForm((f) => ({ ...f, dolor_muscular: v }))} />
            <Escala label="Fatiga" value={form.fatiga} onChange={(v) => setForm((f) => ({ ...f, fatiga: v }))} />
            <Escala label="Estrés percibido" value={form.estres} onChange={(v) => setForm((f) => ({ ...f, estres: v }))} />
        </div>
          )}
        </div>

        </div>

        <div className="flex justify-end">
          <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">
            {entradaExistente ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </form>

      {registros.length > 0 && (
        <div className="flex flex-col gap-2">
          {registrosPeriodo.slice(0, 10).map((r) => {
            const est = estadoRecuperacion(r)
            return (
              <div key={r.fecha} className="card flex justify-between items-center py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: est.color }} />
                  <span className="text-sm">{r.fecha}</span>
                </div>
                <div className="flex gap-2.5 items-center">
                  {r.body_battery_manana != null && <span className="text-ink-muted text-xs">BB {r.body_battery_manana}</span>}
                  <span className="text-ink-muted text-xs">{r.sueño_horas || '—'}h sueño</span>
                  <div className="flex gap-1">
                    <button onClick={() => editarRegistro(r)} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Editar</button>
                    <button onClick={() => eliminarRegistro(r.fecha)} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">Lesiones</h2>
          <button onClick={() => setFormLesionOpen((v) => !v)} className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg">+ Registro</button>
        </div>
        {formLesionOpen && <FormLesion onGuardar={crearLesion} onCancelar={() => setFormLesionOpen(false)} />}
        {lesiones.length === 0 ? (
          <p className="text-ink-muted text-sm">Sin lesiones registradas.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {lesiones.map((l) => (
              <div key={l.id} className={`card ${l.estado === 'recuperada' ? 'opacity-60' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className={`font-semibold text-sm ${l.estado === 'recuperada' ? 'line-through' : ''}`}>{l.zona}</p>
                    <p className="text-ink-muted text-xs mt-0.5">
                      {CAUSAS_LESION.find((c) => c.id === l.causa)?.label} · desde {l.fecha_inicio}
                      {l.estado === 'activa' ? ` · hace ${diasDesde(l.fecha_inicio)} días` : ''}
                    </p>
                    {l.profesional_tratante && <p className="text-ink-faint text-xs mt-0.5">Tratante: {l.profesional_tratante}</p>}
                    {l.tiempo_estimado_dias && <p className="text-ink-faint text-xs">Recuperación estimada: {l.tiempo_estimado_dias} días</p>}
                    {l.notas && <p className="text-ink-faint text-xs mt-1">{l.notas}</p>}
                  </div>
                  <div className="flex gap-1">
                    {l.estado === 'activa' && (
                      <button onClick={() => marcarRecuperada(l.id)} className="text-hiviz text-xs border border-asphalt-700 rounded-lg px-2 py-1">Marcar recuperada</button>
                    )}
                    <button onClick={() => eliminarLesion(l.id)} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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

function FormLesion({ onGuardar, onCancelar }) {
  const [form, setForm] = useState({
    fecha_inicio: new Date().toISOString().slice(0, 10), zona: 'Rodilla', causa: 'sobrecarga',
    profesional_tratante: '', tiempo_estimado_dias: '', notas: ''
  })
  const campo = (k) => ({ value: form[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })
  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => {
      e.preventDefault()
      onGuardar({ ...form, tiempo_estimado_dias: form.tiempo_estimado_dias ? Number(form.tiempo_estimado_dias) : null })
    }}>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fecha de inicio</span>
        <input type="date" {...campo('fecha_inicio')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Zona</span>
        <select {...campo('zona')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          {ZONAS_LESION.map((z) => <option key={z}>{z}</option>)}
        </select></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Causa probable</span>
        <select {...campo('causa')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          {CAUSAS_LESION.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Profesional tratante</span>
        <input {...campo('profesional_tratante')} placeholder="Kinesiólogo / traumatólogo" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Recuperación estimada (días)</span>
        <input type="number" {...campo('tiempo_estimado_dias')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Notas</span>
        <input {...campo('notas')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="col-span-2 flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button>
      </div>
    </form>
  )
}
