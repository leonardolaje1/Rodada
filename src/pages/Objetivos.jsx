import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const TIPOS_OBJETIVO = [
  { id: 'ftp', label: 'FTP (potencia)', unidad: 'W' },
  { id: 'peso', label: 'Peso corporal', unidad: 'kg' },
  { id: 'km_anuales', label: 'Km acumulados', unidad: 'km' },
  { id: 'evento', label: 'Evento / competencia', unidad: '' },
  { id: 'otro', label: 'Otro', unidad: '' }
]

export default function Objetivos() {
  const [objetivos, setObjetivos] = useState([])
  const [kmAnualesActual, setKmAnualesActual] = useState(0)
  const [pesoActual, setPesoActual] = useState(null)
  const [formOpen, setFormOpen] = useState(false)

  async function cargar() {
    const anio = String(new Date().getFullYear())
    const [{ data: o }, { data: ents }, { data: perfil }] = await Promise.all([
      supabase.from('objetivos').select('*').order('created_at', { ascending: false }),
      supabase.from('entrenamientos').select('km, fecha').gte('fecha', `${anio}-01-01`),
      supabase.from('perfil_nutricional').select('peso').maybeSingle()
    ])
    setObjetivos(o || [])
    setKmAnualesActual((ents || []).reduce((a, e) => a + (Number(e.km) || 0), 0))
    setPesoActual(perfil?.peso || null)
  }

  useEffect(() => { cargar() }, [])

  function valorActualDe(o) {
    if (o.tipo === 'km_anuales') return kmAnualesActual
    if (o.tipo === 'peso' && pesoActual) return Number(pesoActual)
    return Number(o.valor_actual) || 0
  }

  async function actualizarValor(id, valor) {
    await supabase.from('objetivos').update({ valor_actual: valor }).eq('id', id)
    cargar()
  }

  async function marcarCumplido(o) {
    await supabase.from('objetivos').update({ estado: o.estado === 'cumplido' ? 'activo' : 'cumplido' }).eq('id', o.id)
    cargar()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Objetivos</h1>
          <p className="text-ink-muted text-sm mt-1">Metas y su progreso</p>
        </div>
        <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => setFormOpen((v) => !v)}>+ Nuevo</button>
      </div>

      {formOpen && (
        <FormObjetivo onGuardar={async (n) => {
          await supabase.from('objetivos').insert({ ...n, estado: 'activo', valor_actual: 0 })
          setFormOpen(false)
          cargar()
        }} onCancelar={() => setFormOpen(false)} />
      )}

      {objetivos.length === 0 ? (
        <p className="text-ink-muted text-sm">Sin objetivos cargados. Sumá el primero.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {objetivos.map((o) => {
            const meta = TIPOS_OBJETIVO.find((t) => t.id === o.tipo) || TIPOS_OBJETIVO[4]
            const actual = valorActualDe(o)
            const objetivo = Number(o.valor_objetivo) || 0
            const pct = objetivo ? Math.min(100, Math.round((actual / objetivo) * 100)) : 0
            const cumplido = o.estado === 'cumplido'
            const auto = o.tipo === 'km_anuales' || (o.tipo === 'peso' && pesoActual)

            return (
              <div key={o.id} className={`card ${cumplido ? 'opacity-60' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className={`font-semibold text-sm ${cumplido ? 'line-through' : ''}`}>{o.titulo}</p>
                    <p className="text-ink-muted text-xs mt-0.5">{meta.label}{o.fecha_limite ? ` · hasta ${o.fecha_limite}` : ''}</p>
                  </div>
                  <button
                    className="text-xs border border-asphalt-700 rounded-lg px-2.5 py-1 text-ink-muted"
                    onClick={() => marcarCumplido(o)}
                  >
                    {cumplido ? 'Reabrir' : 'Cumplido'}
                  </button>
                </div>

                {o.tipo !== 'evento' && (
                  <>
                    <div className="flex justify-between items-baseline mt-2.5">
                      <span className="readout text-lg font-bold text-hiviz">{actual}{meta.unidad}</span>
                      <span className="text-ink-muted text-xs">meta: {objetivo}{meta.unidad}</span>
                    </div>
                    <div className="w-full h-1.5 bg-asphalt-700 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-hiviz" style={{ width: `${pct}%` }} />
                    </div>
                    {!auto && !cumplido && (
                      <input
                        type="number"
                        placeholder={`Valor actual (${meta.unidad})`}
                        onBlur={(e) => { if (e.target.value !== '') actualizarValor(o.id, e.target.value) }}
                        className="w-full bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink text-sm mt-2.5"
                      />
                    )}
                    {auto && <p className="text-ink-faint text-xs mt-2">Se actualiza solo con tus datos cargados</p>}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FormObjetivo({ onGuardar, onCancelar }) {
  const [form, setForm] = useState({ titulo: '', tipo: 'ftp', valor_objetivo: '', fecha_limite: '' })
  const campo = (k) => ({ value: form[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })

  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onGuardar(form) }}>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Título</span>
        <input {...campo('titulo')} required placeholder="Subir FTP a 280W" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Tipo</span>
        <select {...campo('tipo')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          {TIPOS_OBJETIVO.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Valor objetivo</span>
        <input type="number" {...campo('valor_objetivo')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Fecha límite</span>
        <input type="date" {...campo('fecha_limite')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="col-span-2 flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button>
      </div>
    </form>
  )
}
