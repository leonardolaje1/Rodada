import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Competencias() {
  const [competencias, setCompetencias] = useState([])
  const [formOpen, setFormOpen] = useState(false)

  async function cargar() {
    const { data } = await supabase.from('competencias').select('*').order('fecha', { ascending: false })
    setCompetencias(data || [])
  }

  useEffect(() => { cargar() }, [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Competencias</h1>
          <p className="text-ink-muted text-sm mt-1">Carreras y resultados</p>
        </div>
        <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => setFormOpen((v) => !v)}>+ Nueva</button>
      </div>

      {formOpen && (
        <FormCompetencia onGuardar={async (n) => {
          await supabase.from('competencias').insert(n)
          setFormOpen(false)
          cargar()
        }} onCancelar={() => setFormOpen(false)} />
      )}

      {competencias.length === 0 ? (
        <p className="text-ink-muted text-sm">Sin competencias registradas todavía.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {competencias.map((c) => (
            <div key={c.id} className="card">
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold text-sm">{c.nombre}</p>
                  <p className="text-ink-muted text-xs">{c.fecha}{c.posicion ? ` · Puesto ${c.posicion}` : ''}</p>
                </div>
                {c.tiempo && <span className="readout text-sm text-hiviz font-semibold">{c.tiempo}</span>}
              </div>
              {c.objetivo && <p className="text-ink-muted text-xs mt-2"><b className="text-ink">Objetivo:</b> {c.objetivo}</p>}
              {c.resultado && <p className="text-ink-muted text-xs mt-1"><b className="text-ink">Resultado:</b> {c.resultado}</p>}
              {(c.potencia_avg || c.fc_avg) && (
                <div className="flex gap-4 mt-2">
                  {c.potencia_avg && <MiniDato label="W avg" value={c.potencia_avg} />}
                  {c.fc_avg && <MiniDato label="FC avg" value={c.fc_avg} />}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MiniDato({ label, value }) {
  return (
    <div>
      <p className="readout text-sm font-semibold">{value}</p>
      <p className="text-ink-muted text-[10px] uppercase">{label}</p>
    </div>
  )
}

function FormCompetencia({ onGuardar, onCancelar }) {
  const [form, setForm] = useState({
    nombre: '', fecha: new Date().toISOString().slice(0, 10), objetivo: '', resultado: '',
    posicion: '', tiempo: '', potencia_avg: '', fc_avg: ''
  })
  const campo = (k) => ({ value: form[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })

  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onGuardar(form) }}>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Nombre</span>
        <input {...campo('nombre')} required placeholder="Gran Fondo Sierras" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fecha</span>
        <input type="date" {...campo('fecha')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Puesto</span>
        <input type="number" {...campo('posicion')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Objetivo</span>
        <input {...campo('objetivo')} placeholder="Top 10 de la general" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Resultado</span>
        <input {...campo('resultado')} placeholder="Cómo fue la carrera" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Tiempo</span>
        <input {...campo('tiempo')} placeholder="2:45:30" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Potencia media (W)</span>
        <input type="number" {...campo('potencia_avg')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">FC media</span>
        <input type="number" {...campo('fc_avg')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="col-span-2 flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button>
      </div>
    </form>
  )
}
