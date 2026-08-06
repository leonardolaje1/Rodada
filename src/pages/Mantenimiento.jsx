import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const TIPOS_MANTENIMIENTO = ['Lavado', 'Lubricación', 'Ajuste de cambios', 'Ajuste de frenos', 'Cambio de líquido', 'Revisión general', 'Otro']

export default function Mantenimiento() {
  const [bicicletas, setBicicletas] = useState([])
  const [mantenimientos, setMantenimientos] = useState([])
  const [formOpen, setFormOpen] = useState(false)

  async function cargar() {
    const [{ data: b }, { data: m }] = await Promise.all([
      supabase.from('bicicletas').select('id, nombre'),
      supabase.from('mantenimientos').select('*').order('fecha', { ascending: false }).limit(100)
    ])
    setBicicletas(b || [])
    setMantenimientos(m || [])
  }

  useEffect(() => { cargar() }, [])

  const nombreBici = (id) => bicicletas.find((b) => b.id === id)?.nombre || '—'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mantenimiento</h1>
          <p className="text-ink-muted text-sm mt-1">Historial de lavados, ajustes y revisiones</p>
        </div>
        <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => setFormOpen((v) => !v)}>+ Nuevo</button>
      </div>

      {formOpen && (
        <FormMantenimiento bicicletas={bicicletas} onGuardar={async (n) => {
          await supabase.from('mantenimientos').insert(n)
          setFormOpen(false)
          cargar()
        }} onCancelar={() => setFormOpen(false)} />
      )}

      {bicicletas.length === 0 ? (
        <p className="text-ink-muted text-sm">Primero cargá una bicicleta en la pestaña Bicis.</p>
      ) : mantenimientos.length === 0 ? (
        <p className="text-ink-muted text-sm">Sin mantenimientos registrados todavía.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {mantenimientos.map((m) => (
            <div key={m.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{m.tipo}</p>
                <p className="text-ink-muted text-xs">{nombreBici(m.bicicleta_id)} · {m.fecha}</p>
                {m.notas && <p className="text-ink-faint text-xs mt-0.5">{m.notas}</p>}
              </div>
              {m.km_bici && <span className="readout text-xs text-ink-muted">{m.km_bici} km</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FormMantenimiento({ bicicletas, onGuardar, onCancelar }) {
  const [form, setForm] = useState({
    bicicleta_id: bicicletas[0]?.id || '', tipo: 'Lavado',
    fecha: new Date().toISOString().slice(0, 10), km_bici: '', notas: ''
  })
  const campo = (k) => ({ value: form[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })

  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onGuardar(form) }}>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Bicicleta</span>
        <select {...campo('bicicleta_id')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          {bicicletas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
        </select></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Tipo</span>
        <select {...campo('tipo')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          {TIPOS_MANTENIMIENTO.map((t) => <option key={t}>{t}</option>)}
        </select></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fecha</span>
        <input type="date" {...campo('fecha')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Km de la bici</span>
        <input type="number" {...campo('km_bici')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Notas</span>
        <input {...campo('notas')} placeholder="Detalle del trabajo realizado" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="col-span-2 flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button>
      </div>
    </form>
  )
}
