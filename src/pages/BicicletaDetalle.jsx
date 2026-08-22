import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { WEAR_TYPES, estadoDesgaste, nivelDesgasteInfo, proyectarDiasRestantes } from '../lib/wear'
import { evaluarFitting, infoNivelFitting } from '../lib/bikeFitting'

const TIPOS_MANTENIMIENTO = ['Lavado', 'Lubricación', 'Ajuste de cambios', 'Ajuste de frenos', 'Cambio de líquido', 'Revisión general', 'Otro']
const TIPOS_COMPONENTE = ['Pastillas de freno', 'Cables', 'Rulemanes', 'Discos', 'Manubrio', 'Sillín', 'Otro']

export default function BicicletaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [vista, setVista] = useState('resumen')
  const [bici, setBici] = useState(null)
  const [componentes, setComponentes] = useState([])
  const [desgaste, setDesgaste] = useState([])
  const [mantenimientos, setMantenimientos] = useState([])
  const [fittings, setFittings] = useState([])
  const [pesoActual, setPesoActual] = useState(null)
  const [recuperacion, setRecuperacion] = useState([])
  const [kmPorDia, setKmPorDia] = useState(0)
  const [formMantOpen, setFormMantOpen] = useState(false)
  const [formCompOpen, setFormCompOpen] = useState(false)
  const [compEditando, setCompEditando] = useState(null)
  const [formFitOpen, setFormFitOpen] = useState(false)

  async function cargar() {
    const { data: b } = await supabase.from('bicicletas').select('*').eq('id', id).single()
    const { data: c } = await supabase.from('componentes').select('*').eq('bicicleta_id', id)
    const { data: d } = await supabase.from('desgaste_componentes').select('*').eq('bicicleta_id', id)
    const { data: m } = await supabase.from('mantenimientos').select('*').eq('bicicleta_id', id).order('fecha', { ascending: false })
    const { data: f } = await supabase.from('bike_fitting').select('*').eq('bicicleta_id', id).order('fecha', { ascending: false })
    const { data: perfil } = await supabase.from('perfil_nutricional').select('peso').maybeSingle()
    const { data: rec } = await supabase.from('metricas_diarias').select('fecha, dolor_muscular').order('fecha', { ascending: false }).limit(14)
    const desde45 = new Date(); desde45.setDate(desde45.getDate() - 45)
    const { data: entsBici } = await supabase.from('entrenamientos').select('km').eq('bicicleta_id', id).gte('fecha', desde45.toISOString().slice(0, 10))
    setBici(b)
    setComponentes(c || [])
    setDesgaste(d || [])
    setMantenimientos(m || [])
    setFittings(f || [])
    setPesoActual(perfil?.peso || null)
    setRecuperacion(rec || [])
    // Ritmo de uso reciente de esta bici, para proyectar cuándo un componente
    // llega al límite de vida útil al ritmo actual (no un promedio histórico).
    const kmTotalesRecientes = (entsBici || []).reduce((a, e) => a + (Number(e.km) || 0), 0)
    setKmPorDia(kmTotalesRecientes / 45)
  }

  useEffect(() => {
    cargar()
  }, [id])

  async function eliminarBici() {
    if (!confirm(`¿Eliminar "${bici.nombre}"? Se borrarán también sus componentes, desgaste, mantenimiento y bike fitting registrados. Los entrenamientos históricos quedan, pero sin bici asociada.`)) return
    await supabase.from('bicicletas').delete().eq('id', id)
    navigate('/bicicletas')
  }

  async function configurarDesgaste(tipo, config) {
    await supabase.from('desgaste_componentes').insert({
      bicicleta_id: id,
      tipo,
      fecha_instalacion: config.fecha_instalacion,
      km_instalacion: config.km_instalacion,
      vida_util_km: config.vida_util_km,
      mediciones: []
    })
    cargar()
  }

  async function medirDesgaste(itemId, medicion) {
    const item = desgaste.find((d) => d.id === itemId)
    const nuevasMediciones = [...(item.mediciones || []), medicion]
    await supabase.from('desgaste_componentes').update({ mediciones: nuevasMediciones }).eq('id', itemId)
    cargar()
  }

  async function crearMantenimiento(form) {
    await supabase.from('mantenimientos').insert({ ...form, bicicleta_id: id })
    setFormMantOpen(false)
    cargar()
  }
  async function eliminarMantenimiento(mid) {
    if (!confirm('¿Borrar este registro de mantenimiento?')) return
    await supabase.from('mantenimientos').delete().eq('id', mid)
    cargar()
  }

  async function crearComponente(form) {
    await supabase.from('componentes').insert({ ...form, bicicleta_id: id })
    setFormCompOpen(false)
    cargar()
  }
  async function actualizarComponente(cid, form) {
    await supabase.from('componentes').update(form).eq('id', cid)
    setCompEditando(null)
    cargar()
  }
  async function eliminarComponente(cid) {
    if (!confirm('¿Borrar este componente?')) return
    await supabase.from('componentes').delete().eq('id', cid)
    cargar()
  }

  async function crearFitting(form) {
    await supabase.from('bike_fitting').insert({ ...form, bicicleta_id: id })
    setFormFitOpen(false)
    cargar()
  }

  if (!bici) return <p className="text-ink-muted text-sm">Cargando…</p>

  const kmTotalesBici = bici.km_totales || 0
  const ultimoFitting = fittings[0] || null
  const evaluacionFitting = evaluarFitting(ultimoFitting, pesoActual, recuperacion)
  const infoFitting = infoNivelFitting(evaluacionFitting.nivel)

  return (
    <div className="flex flex-col gap-6">
      <Link to="/bicicletas" className="text-ink-muted text-sm">← Bicicletas</Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{bici.nombre}</h1>
          <p className="text-ink-muted text-sm mt-1">{bici.marca} {bici.modelo} · {bici.año}</p>
        </div>
        <button onClick={eliminarBici} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-3 py-1.5">
          Eliminar bici
        </button>
      </div>

      <div className="flex gap-1 bg-asphalt-950 p-1 rounded-lg overflow-x-auto">
        <button onClick={() => setVista('resumen')} className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${vista === 'resumen' ? 'bg-hiviz text-asphalt-950' : 'text-ink-muted'}`}>Resumen</button>
        <button onClick={() => setVista('mantenimiento')} className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${vista === 'mantenimiento' ? 'bg-hiviz text-asphalt-950' : 'text-ink-muted'}`}>Mantenimiento</button>
        <button onClick={() => setVista('fitting')} className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${vista === 'fitting' ? 'bg-hiviz text-asphalt-950' : 'text-ink-muted'}`}>Bike Fitting</button>
      </div>

      {vista === 'resumen' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Dato label="Rodado" value={bici.rodado || '—'} />
            <Dato label="Peso" value={bici.peso ? `${bici.peso} kg` : '—'} />
            <Dato label="Km totales" value={kmTotalesBici.toLocaleString('es-AR')} />
            <Dato label="Nro. cuadro" value={bici.nro_cuadro || '—'} />
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-1">Desgaste — tren motriz y cubiertas</h2>
            <p className="text-ink-muted text-xs mb-3">Combina kilómetros con mediciones manuales.</p>
            <div className="flex flex-col gap-3">
              {WEAR_TYPES.map((wt) => {
                const item = desgaste.find((d) => d.tipo === wt.id)
                return (
                  <WearCard
                    key={wt.id}
                    wearType={wt}
                    item={item}
                    kmActualBici={kmTotalesBici}
                    kmPorDia={kmPorDia}
                    onConfigurar={(config) => configurarDesgaste(wt.id, config)}
                    onMedir={(medicion) => medirDesgaste(item.id, medicion)}
                  />
                )
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Otros componentes</h2>
              <button className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg" onClick={() => { setCompEditando(null); setFormCompOpen((v) => !v) }}>+ Componente</button>
            </div>
            {formCompOpen && (
              <FormComponente onGuardar={crearComponente} onCancelar={() => setFormCompOpen(false)} kmActual={kmTotalesBici} />
            )}
            {componentes.length === 0 ? (
              <p className="text-ink-muted text-sm">Sin otros componentes cargados (pastillas, cables, rulemanes, discos).</p>
            ) : (
              <div className="flex flex-col gap-2">
                {componentes.map((c) =>
                  compEditando === c.id ? (
                    <FormComponente key={c.id} valoresIniciales={c} onGuardar={(datos) => actualizarComponente(c.id, datos)} onCancelar={() => setCompEditando(null)} kmActual={kmTotalesBici} />
                  ) : (
                    <ComponenteCard key={c.id} c={c} kmTotalesBici={kmTotalesBici} onEditar={() => { setFormCompOpen(false); setCompEditando(c.id) }} onEliminar={() => eliminarComponente(c.id)} />
                  )
                )}
              </div>
            )}
          </div>
        </>
      )}

      {vista === 'mantenimiento' && (
        <>
          <div className="flex justify-end">
            <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => setFormMantOpen((v) => !v)}>+ Nuevo</button>
          </div>
          {formMantOpen && <FormMantenimiento onGuardar={crearMantenimiento} onCancelar={() => setFormMantOpen(false)} />}
          {mantenimientos.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin mantenimientos registrados para esta bici todavía.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {mantenimientos.map((m) => (
                <div key={m.id} className="card flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{m.tipo}</p>
                    <p className="text-ink-muted text-xs">{m.fecha}{m.km_bici ? ` · ${m.km_bici} km` : ''}</p>
                    {m.notas && <p className="text-ink-faint text-xs mt-0.5">{m.notas}</p>}
                  </div>
                  <button onClick={() => eliminarMantenimiento(m.id)} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {vista === 'fitting' && (
        <>
          <div className="card" style={evaluacionFitting.nivel === 'critico' || evaluacionFitting.nivel === 'atencion' ? { borderColor: infoFitting.color } : undefined}>
            <span className="label-eyebrow">Estado actual</span>
            <p className="text-sm font-semibold mt-1" style={{ color: infoFitting.color }}>{infoFitting.texto}</p>
            <ul className="text-ink-muted text-xs mt-2 flex flex-col gap-1 list-disc pl-4">
              {evaluacionFitting.motivos.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>

          <div className="flex justify-end">
            <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => setFormFitOpen((v) => !v)}>+ Nuevo estudio</button>
          </div>
          {formFitOpen && <FormFitting pesoActual={pesoActual} onGuardar={crearFitting} onCancelar={() => setFormFitOpen(false)} />}

          {fittings.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin estudios de bike fitting cargados para esta bici.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {fittings.map((f) => (
                <div key={f.id} className="card">
                  <span className="label-eyebrow">{f.fecha}{f.realizado_por ? ` · ${f.realizado_por}` : ''}</span>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    <MiniDatoFit label="Altura asiento" value={f.altura_asiento} unidad="mm" />
                    <MiniDatoFit label="Retroceso asiento" value={f.retroceso_asiento} unidad="mm" />
                    <MiniDatoFit label="Reach" value={f.reach} unidad="mm" />
                    <MiniDatoFit label="Stack" value={f.stack} unidad="mm" />
                    <MiniDatoFit label="Caída manubrio" value={f.caida_manubrio} unidad="mm" />
                    <MiniDatoFit label="Largo bielas" value={f.largo_bielas} unidad="mm" />
                    <MiniDatoFit label="Cala fore/aft" value={f.cala_fore_aft} unidad="mm" />
                    <MiniDatoFit label="Cala ángulo" value={f.cala_angulo} unidad="°" />
                  </div>
                  {f.notas && <p className="text-ink-faint text-xs mt-2">{f.notas}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ComponenteCard({ c, kmTotalesBici, onEditar, onEliminar }) {
  const kmDesdeInstalacion = c.km_instalacion != null ? kmTotalesBici - c.km_instalacion : null
  const vidaUtil = c.vida_util_km || null
  const porcentaje = vidaUtil && kmDesdeInstalacion != null ? Math.min(100, (kmDesdeInstalacion / vidaUtil) * 100) : null
  const alerta = porcentaje !== null && porcentaje >= 80

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-medium">{c.tipo}</p>
          <p className="text-ink-muted text-xs">{c.marca} {c.modelo}</p>
          {c.fecha_instalacion && <p className="text-ink-faint text-xs mt-0.5">Instalado {c.fecha_instalacion}</p>}
          {porcentaje !== null && (
            <div className="w-full h-1.5 bg-asphalt-700 rounded-full mt-2 overflow-hidden">
              <div className={`h-full ${alerta ? 'bg-alert-red' : 'bg-hiviz'}`} style={{ width: `${porcentaje}%` }} />
            </div>
          )}
        </div>
        <div className="text-right">
          {kmDesdeInstalacion != null && <p className="readout text-sm font-semibold">{kmDesdeInstalacion.toLocaleString('es-AR')} km</p>}
          {vidaUtil && <p className={`text-xs ${alerta ? 'text-alert-red' : 'text-ink-muted'}`}>de {vidaUtil.toLocaleString('es-AR')} km estimados</p>}
        </div>
      </div>
      <div className="flex gap-1 justify-end mt-2">
        <button onClick={onEditar} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1">Editar</button>
        <button onClick={onEliminar} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1">Borrar</button>
      </div>
    </div>
  )
}

function WearCard({ wearType, item, kmActualBici, kmPorDia, onConfigurar, onMedir }) {
  const [configurando, setConfigurando] = useState(false)
  const [midiendo, setMidiendo] = useState(false)
  const [valorConfig, setValorConfig] = useState({
    fecha_instalacion: new Date().toISOString().slice(0, 10),
    km_instalacion: kmActualBici,
    vida_util_km: wearType.vidaUtilDefault
  })
  const [valorMedicion, setValorMedicion] = useState('')

  if (!item) {
    return (
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">{wearType.label}</p>
            <p className="text-ink-faint text-xs mt-0.5">Sin configurar</p>
          </div>
          <button className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-3 py-1.5" onClick={() => setConfigurando((v) => !v)}>Configurar</button>
        </div>
        {configurando && (
          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-asphalt-700">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-ink-muted">Fecha instalación</span>
              <input type="date" value={valorConfig.fecha_instalacion} onChange={(e) => setValorConfig((v) => ({ ...v, fecha_instalacion: e.target.value }))} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-ink-muted">Km al instalar</span>
              <input type="number" value={valorConfig.km_instalacion} onChange={(e) => setValorConfig((v) => ({ ...v, km_instalacion: e.target.value }))} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-xs col-span-2">
              <span className="text-ink-muted">Vida útil estimada (km)</span>
              <input type="number" value={valorConfig.vida_util_km} onChange={(e) => setValorConfig((v) => ({ ...v, vida_util_km: e.target.value }))} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm" />
            </label>
            <div className="col-span-2 flex justify-end gap-2">
              <button className="text-ink-muted text-xs px-3 py-1.5" onClick={() => setConfigurando(false)}>Cancelar</button>
              <button className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg" onClick={() => { onConfigurar(valorConfig); setConfigurando(false) }}>Guardar</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const { kmDesde, vidaUtil, pctKm, pct, ultimaMedicion, nivel } = estadoDesgaste(item, wearType, kmActualBici)
  const { color, texto } = nivelDesgasteInfo(nivel)
  const diasRestantes = proyectarDiasRestantes({ vidaUtil, kmDesde }, kmPorDia)

  return (
    <div className="card" style={nivel !== 'ok' ? { borderColor: color } : undefined}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-sm">{wearType.label}</p>
          <p className="text-ink-muted text-xs mt-0.5">{kmDesde.toFixed(0)} km desde instalación · de {vidaUtil} km est.</p>
        </div>
        <span className="readout text-base font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-asphalt-700 rounded-full mt-2.5 overflow-hidden relative">
        <div className="absolute inset-y-0 left-1/2 w-px bg-asphalt-600" />
        <div className="absolute inset-y-0 left-3/4 w-px bg-asphalt-600" />
        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      {nivel !== 'ok' && (
        <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold" style={{ color }}>
          <span>⚠</span><span>{texto}</span>
        </div>
      )}
      {diasRestantes != null && (
        <p className="text-ink-faint text-[11px] mt-2">
          {diasRestantes <= 0
            ? 'Ya alcanzó el límite estimado.'
            : `≈ ${diasRestantes} día${diasRestantes === 1 ? '' : 's'} para el límite, al ritmo actual de uso.`}
        </p>
      )}
      <div className="flex items-center justify-between mt-2.5">
        <p className="text-ink-muted text-xs">
          {ultimaMedicion ? `Última medición: ${ultimaMedicion.valor} ${wearType.unidad} (${ultimaMedicion.fecha})` : `Sin mediciones manuales — solo estimado por km (${pctKm}%)`}
        </p>
        <button className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2.5 py-1" onClick={() => setMidiendo((v) => !v)}>+ Medición</button>
      </div>
      {midiendo && (
        <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-asphalt-700 items-end">
          <label className="flex-1 flex flex-col gap-1 text-xs">
            <span className="text-ink-muted">Valor ({wearType.unidad})</span>
            <input type="number" step="0.01" value={valorMedicion} onChange={(e) => setValorMedicion(e.target.value)} placeholder={wearType.ayuda} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-2 py-1.5 text-ink text-sm" />
          </label>
          <button className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg" onClick={() => {
            if (valorMedicion === '') return
            onMedir({ fecha: new Date().toISOString().slice(0, 10), valor: Number(valorMedicion), km_bici: kmActualBici })
            setValorMedicion(''); setMidiendo(false)
          }}>Guardar</button>
        </div>
      )}
    </div>
  )
}

function FormComponente({ onGuardar, onCancelar, valoresIniciales, kmActual }) {
  const [form, setForm] = useState({
    tipo: 'Pastillas de freno', marca: '', modelo: '',
    fecha_instalacion: new Date().toISOString().slice(0, 10), km_instalacion: kmActual, vida_util_km: '',
    ...valoresIniciales
  })
  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })
  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => {
      e.preventDefault()
      onGuardar({ ...form, km_instalacion: form.km_instalacion ? Number(form.km_instalacion) : null, vida_util_km: form.vida_util_km ? Number(form.vida_util_km) : null })
    }}>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Tipo</span>
        <select {...campo('tipo')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          {TIPOS_COMPONENTE.map((t) => <option key={t}>{t}</option>)}
        </select></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Marca</span>
        <input {...campo('marca')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Modelo</span>
        <input {...campo('modelo')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fecha instalación</span>
        <input type="date" {...campo('fecha_instalacion')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Km al instalar</span>
        <input type="number" {...campo('km_instalacion')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Vida útil estimada (km)</span>
        <input type="number" {...campo('vida_util_km')} placeholder="Dejar vacío si no se quiere estimar" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="col-span-2 flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button>
      </div>
    </form>
  )
}

function FormMantenimiento({ onGuardar, onCancelar }) {
  const [form, setForm] = useState({ tipo: 'Lavado', fecha: new Date().toISOString().slice(0, 10), km_bici: '', notas: '' })
  const campo = (k) => ({ value: form[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })
  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onGuardar(form) }}>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Tipo</span>
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

function FormFitting({ onGuardar, onCancelar, pesoActual }) {
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10), realizado_por: '', peso_ciclista: pesoActual || '',
    altura_asiento: '', retroceso_asiento: '', reach: '', stack: '', caida_manubrio: '', largo_bielas: '',
    cala_fore_aft: '', cala_angulo: '', notas: ''
  })
  const campo = (k) => ({ value: form[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })
  return (
    <form className="card grid grid-cols-2 gap-2.5" onSubmit={(e) => { e.preventDefault(); onGuardar(form) }}>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fecha</span>
        <input type="date" {...campo('fecha')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Realizado por</span>
        <input {...campo('realizado_por')} placeholder="Estudio / bikefitter" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Tu peso ese día (kg)</span>
        <input type="number" {...campo('peso_ciclista')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Altura asiento (mm)</span>
        <input type="number" {...campo('altura_asiento')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Retroceso asiento (mm)</span>
        <input type="number" {...campo('retroceso_asiento')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Reach (mm)</span>
        <input type="number" {...campo('reach')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Stack (mm)</span>
        <input type="number" {...campo('stack')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Caída manubrio (mm)</span>
        <input type="number" {...campo('caida_manubrio')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Largo bielas (mm)</span>
        <input type="number" {...campo('largo_bielas')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Cala fore/aft (mm)</span>
        <input type="number" {...campo('cala_fore_aft')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Cala ángulo (°)</span>
        <input type="number" {...campo('cala_angulo')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Notas</span>
        <input {...campo('notas')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="col-span-2 flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button>
      </div>
    </form>
  )
}

function MiniDatoFit({ label, value, unidad }) {
  return (
    <div className="bg-asphalt-900 rounded-lg px-2.5 py-2">
      <p className="text-ink-muted text-[10px] uppercase">{label}</p>
      <p className="readout text-sm font-semibold mt-0.5">{value != null ? `${value} ${unidad}` : '—'}</p>
    </div>
  )
}

function Dato({ label, value }) {
  return (
    <div className="card">
      <span className="label-eyebrow">{label}</span>
      <p className="readout text-lg font-semibold mt-1">{value}</p>
    </div>
  )
}
