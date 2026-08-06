import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { evaluarFitting, infoNivelFitting } from '../lib/bikeFitting'

export default function BikeFitting() {
  const [bicicletas, setBicicletas] = useState([])
  const [fittings, setFittings] = useState([])
  const [pesoActual, setPesoActual] = useState(null)
  const [recuperacion, setRecuperacion] = useState([])
  const [bicicletaAbierta, setBicicletaAbierta] = useState(null)
  const [formOpen, setFormOpen] = useState(false)

  async function cargar() {
    const [{ data: b }, { data: f }, { data: perfil }, { data: rec }] = await Promise.all([
      supabase.from('bicicletas').select('id, nombre'),
      supabase.from('bike_fitting').select('*').order('fecha', { ascending: false }),
      supabase.from('perfil_nutricional').select('peso').maybeSingle(),
      supabase.from('metricas_diarias').select('fecha, dolor_muscular').order('fecha', { ascending: false }).limit(14)
    ])
    setBicicletas(b || [])
    setFittings(f || [])
    setPesoActual(perfil?.peso || null)
    setRecuperacion(rec || [])
  }

  useEffect(() => { cargar() }, [])

  async function crear(form) {
    await supabase.from('bike_fitting').insert(form)
    setFormOpen(false)
    cargar()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Bike Fitting</h1>
        <p className="text-ink-muted text-sm mt-1">Posición y estudios biomecánicos</p>
      </div>

      {bicicletas.length === 0 ? (
        <p className="text-ink-muted text-sm">Primero cargá una bicicleta en la pestaña Bicis.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {bicicletas.map((bici) => {
            const fittingsBici = fittings.filter((f) => f.bicicleta_id === bici.id)
            const ultimo = fittingsBici[0] || null
            const evaluacion = evaluarFitting(ultimo, pesoActual, recuperacion)
            const { color, texto } = infoNivelFitting(evaluacion.nivel)
            const abierta = bicicletaAbierta === bici.id

            return (
              <div key={bici.id} className="card" style={evaluacion.nivel === 'critico' || evaluacion.nivel === 'atencion' ? { borderColor: color } : undefined}>
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => { setBicicletaAbierta(abierta ? null : bici.id); setFormOpen(false) }}
                >
                  <div>
                    <p className="font-semibold text-sm">{bici.nombre}</p>
                    <p className="text-xs mt-0.5" style={{ color }}>{texto}</p>
                  </div>
                  <span className="text-ink-muted text-xs">{abierta ? '▲' : '▼'}</span>
                </div>

                {abierta && (
                  <div className="mt-3 pt-3 border-t border-asphalt-700 flex flex-col gap-3">
                    <div>
                      <span className="label-eyebrow">Por qué</span>
                      <ul className="text-ink-muted text-xs mt-1.5 flex flex-col gap-1 list-disc pl-4">
                        {evaluacion.motivos.map((m, i) => <li key={i}>{m}</li>)}
                      </ul>
                    </div>

                    {ultimo && (
                      <div>
                        <span className="label-eyebrow">Última medición ({ultimo.fecha})</span>
                        <div className="grid grid-cols-2 gap-2 mt-1.5">
                          <MiniDato label="Altura asiento" value={ultimo.altura_asiento} unidad="mm" />
                          <MiniDato label="Retroceso asiento" value={ultimo.retroceso_asiento} unidad="mm" />
                          <MiniDato label="Reach" value={ultimo.reach} unidad="mm" />
                          <MiniDato label="Stack" value={ultimo.stack} unidad="mm" />
                          <MiniDato label="Caída manubrio" value={ultimo.caida_manubrio} unidad="mm" />
                          <MiniDato label="Largo bielas" value={ultimo.largo_bielas} unidad="mm" />
                          <MiniDato label="Cala fore/aft" value={ultimo.cala_fore_aft} unidad="mm" />
                          <MiniDato label="Cala ángulo" value={ultimo.cala_angulo} unidad="°" />
                        </div>
                        {ultimo.realizado_por && (
                          <p className="text-ink-muted text-xs mt-2">Realizado por: {ultimo.realizado_por}</p>
                        )}
                        {ultimo.notas && <p className="text-ink-faint text-xs mt-1">{ultimo.notas}</p>}
                      </div>
                    )}

                    {fittingsBici.length > 1 && (
                      <div>
                        <span className="label-eyebrow">Historial</span>
                        <div className="flex flex-col gap-1.5 mt-1.5">
                          {fittingsBici.slice(1).map((f) => (
                            <div key={f.id} className="text-ink-muted text-xs flex justify-between">
                              <span>{f.fecha}</span>
                              <span>{f.realizado_por || '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!formOpen ? (
                      <button
                        className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg self-start"
                        onClick={() => setFormOpen(true)}
                      >
                        + Nuevo estudio
                      </button>
                    ) : (
                      <FormFitting
                        bicicletaId={bici.id}
                        pesoActual={pesoActual}
                        onGuardar={crear}
                        onCancelar={() => setFormOpen(false)}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MiniDato({ label, value, unidad }) {
  return (
    <div className="bg-asphalt-900 rounded-lg px-2.5 py-2">
      <p className="text-ink-muted text-[10px] uppercase">{label}</p>
      <p className="readout text-sm font-semibold mt-0.5">{value != null ? `${value} ${unidad}` : '—'}</p>
    </div>
  )
}

function FormFitting({ bicicletaId, pesoActual, onGuardar, onCancelar }) {
  const [form, setForm] = useState({
    bicicleta_id: bicicletaId,
    fecha: new Date().toISOString().slice(0, 10),
    realizado_por: '',
    peso_ciclista: pesoActual || '',
    altura_asiento: '',
    retroceso_asiento: '',
    reach: '',
    stack: '',
    caida_manubrio: '',
    largo_bielas: '',
    cala_fore_aft: '',
    cala_angulo: '',
    notas: ''
  })
  const campo = (k) => ({ value: form[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })

  return (
    <form className="grid grid-cols-2 gap-2.5" onSubmit={(e) => { e.preventDefault(); onGuardar(form) }}>
      <Campo label="Fecha" type="date" {...campo('fecha')} required />
      <Campo label="Realizado por" {...campo('realizado_por')} placeholder="Estudio / bikefitter" />
      <Campo label="Tu peso ese día (kg)" type="number" {...campo('peso_ciclista')} />
      <Campo label="Altura asiento (mm)" type="number" {...campo('altura_asiento')} />
      <Campo label="Retroceso asiento (mm)" type="number" {...campo('retroceso_asiento')} />
      <Campo label="Reach (mm)" type="number" {...campo('reach')} />
      <Campo label="Stack (mm)" type="number" {...campo('stack')} />
      <Campo label="Caída manubrio (mm)" type="number" {...campo('caida_manubrio')} />
      <Campo label="Largo bielas (mm)" type="number" {...campo('largo_bielas')} />
      <Campo label="Cala fore/aft (mm)" type="number" {...campo('cala_fore_aft')} />
      <Campo label="Cala ángulo (°)" type="number" {...campo('cala_angulo')} />
      <label className="flex flex-col gap-1 text-sm col-span-2">
        <span className="text-ink-muted text-xs">Notas</span>
        <input {...campo('notas')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" />
      </label>
      <div className="col-span-2 flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button>
      </div>
    </form>
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
