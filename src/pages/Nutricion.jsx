import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const TIPOS_COMIDA = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Snack', 'Intra-entreno']
const TIPOS_SUPLEMENTO = ['Natural', 'Químico']
const NIVELES_ACTIVIDAD = [
  { id: 'sedentario', label: 'Sedentario', factor: 1.2 },
  { id: 'ligero', label: 'Entreno ligero (1-3 d/sem)', factor: 1.375 },
  { id: 'moderado', label: 'Entreno moderado (3-5 d/sem)', factor: 1.55 },
  { id: 'alto', label: 'Entreno intenso (6-7 d/sem)', factor: 1.725 },
  { id: 'muy_alto', label: 'Doble sesión / muy intenso', factor: 1.9 }
]

function calcularBMR({ peso, altura, edad, sexo }) {
  const p = Number(peso), a = Number(altura), e = Number(edad)
  if (!p || !a || !e) return null
  return sexo === 'F' ? 10 * p + 6.25 * a - 5 * e - 161 : 10 * p + 6.25 * a - 5 * e + 5
}

function agruparPorFecha(items) {
  const grupos = {}
  for (const item of items) {
    if (!grupos[item.fecha]) grupos[item.fecha] = []
    grupos[item.fecha].push(item)
  }
  return Object.entries(grupos).sort((a, b) => b[0].localeCompare(a[0]))
}

export default function Nutricion() {
  const [sub, setSub] = useState('resumen')
  const [perfil, setPerfil] = useState({ peso: '', altura: '', edad: '', sexo: 'M', nivel_actividad: 'moderado' })
  const [comidas, setComidas] = useState([])
  const [hidratacion, setHidratacion] = useState([])
  const [suplementos, setSuplementos] = useState([])
  const [formComida, setFormComida] = useState(false)
  const [comidaEditando, setComidaEditando] = useState(null)
  const [formSuplemento, setFormSuplemento] = useState(false)

  async function cargar() {
    const [{ data: p }, { data: cm }, { data: h }, { data: s }] = await Promise.all([
      supabase.from('perfil_nutricional').select('*').maybeSingle(),
      supabase.from('comidas').select('*').order('fecha', { ascending: false }).limit(100),
      supabase.from('hidratacion').select('*').order('fecha', { ascending: false }).limit(30),
      supabase.from('suplementos').select('*').eq('activo', true)
    ])
    if (p) setPerfil(p)
    setComidas(cm || [])
    setHidratacion(h || [])
    setSuplementos(s || [])
  }

  useEffect(() => { cargar() }, [])

  async function guardarPerfil(next) {
    setPerfil(next)
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('perfil_nutricional').upsert({ ...next, user_id: userData.user.id })
  }

  async function crearComida(n) {
    await supabase.from('comidas').insert(n)
    setFormComida(false)
    cargar()
  }

  async function actualizarComida(id, n) {
    await supabase.from('comidas').update(n).eq('id', id)
    setComidaEditando(null)
    cargar()
  }

  async function eliminarComida(id) {
    await supabase.from('comidas').delete().eq('id', id)
    cargar()
  }

  const hoy = new Date().toISOString().slice(0, 10)
  const comidasHoy = comidas.filter((c) => c.fecha === hoy)
  const kcalHoy = comidasHoy.reduce((a, c) => a + (Number(c.kcal) || 0), 0)
  const proteinasHoy = comidasHoy.reduce((a, c) => a + (Number(c.proteinas) || 0), 0)
  const carbosHoy = comidasHoy.reduce((a, c) => a + (Number(c.carbohidratos) || 0), 0)
  const grasasHoy = comidasHoy.reduce((a, c) => a + (Number(c.grasas) || 0), 0)
  const mlHoy = hidratacion.filter((h) => h.fecha === hoy).reduce((a, h) => a + (Number(h.ml) || 0), 0)

  const bmr = calcularBMR(perfil)
  const nivel = NIVELES_ACTIVIDAD.find((n) => n.id === perfil.nivel_actividad) || NIVELES_ACTIVIDAD[2]
  const tdee = bmr ? Math.round(bmr * nivel.factor) : null

  const comidasPorDia = agruparPorFecha(comidas)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Nutrición</h1>
        <p className="text-ink-muted text-sm mt-1">Calorías, hidratación y suplementos</p>
      </div>

      <div className="flex gap-1 bg-asphalt-950 p-1 rounded-lg overflow-x-auto">
        {[['resumen', 'Resumen'], ['comidas', 'Comidas'], ['hidratacion', 'Hidratación'], ['suplementos', 'Suplementos']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${sub === id ? 'bg-hiviz text-asphalt-950' : 'text-ink-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {sub === 'resumen' && (
        <>
          <div className="card">
            <span className="label-eyebrow">Calculadora — TDEE (Mifflin-St Jeor)</span>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Campo label="Peso (kg)" type="number" value={perfil.peso} onChange={(v) => guardarPerfil({ ...perfil, peso: v })} />
              <Campo label="Altura (cm)" type="number" value={perfil.altura} onChange={(v) => guardarPerfil({ ...perfil, altura: v })} />
              <Campo label="Edad" type="number" value={perfil.edad} onChange={(v) => guardarPerfil({ ...perfil, edad: v })} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-muted text-xs">Sexo</span>
                <select
                  value={perfil.sexo}
                  onChange={(e) => guardarPerfil({ ...perfil, sexo: e.target.value })}
                  className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink"
                >
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm col-span-2">
                <span className="text-ink-muted text-xs">Nivel de actividad</span>
                <select
                  value={perfil.nivel_actividad}
                  onChange={(e) => guardarPerfil({ ...perfil, nivel_actividad: e.target.value })}
                  className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink"
                >
                  {NIVELES_ACTIVIDAD.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                </select>
              </label>
            </div>
            {tdee ? (
              <div className="flex gap-6 mt-4 pt-4 border-t border-asphalt-700">
                <div>
                  <span className="label-eyebrow">BMR</span>
                  <p className="readout text-xl font-bold mt-0.5">{Math.round(bmr)}</p>
                </div>
                <div>
                  <span className="label-eyebrow">TDEE estimado</span>
                  <p className="readout text-xl font-bold mt-0.5 text-hiviz">{tdee} kcal</p>
                </div>
              </div>
            ) : (
              <p className="text-ink-muted text-xs mt-3">Completá peso, altura y edad para calcular tu gasto calórico.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatMini label="Kcal — hoy" value={kcalHoy.toFixed(0)} unit={tdee ? `/ ${tdee}` : ''} color="hiviz" />
            <StatMini label="Agua — hoy" value={(mlHoy / 1000).toFixed(1)} unit="L" color="route" />
            <StatMini label="Proteínas" value={proteinasHoy.toFixed(0)} unit="g" />
            <StatMini label="Carbos / Grasas" value={`${carbosHoy.toFixed(0)}/${grasasHoy.toFixed(0)}`} unit="g" />
          </div>
        </>
      )}

      {sub === 'comidas' && (
        <>
          <div className="flex justify-end">
            <button
              className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg"
              onClick={() => { setComidaEditando(null); setFormComida((v) => !v) }}
            >
              + Comida
            </button>
          </div>
          {formComida && (
            <FormComida onGuardar={crearComida} onCancelar={() => setFormComida(false)} />
          )}

          {comidasPorDia.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin comidas registradas todavía.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {comidasPorDia.map(([fecha, items]) => {
                const totalKcal = items.reduce((a, c) => a + (Number(c.kcal) || 0), 0)
                const totalP = items.reduce((a, c) => a + (Number(c.proteinas) || 0), 0)
                const totalC = items.reduce((a, c) => a + (Number(c.carbohidratos) || 0), 0)
                const totalG = items.reduce((a, c) => a + (Number(c.grasas) || 0), 0)
                return (
                  <div key={fecha}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold">{fecha}</span>
                      <span className="readout text-xs text-ink-muted">
                        <span className="text-hiviz font-semibold">{totalKcal.toFixed(0)} kcal</span>
                        {'  ·  '}P {totalP.toFixed(0)} · C {totalC.toFixed(0)} · G {totalG.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {items.map((c) =>
                        comidaEditando === c.id ? (
                          <FormComida
                            key={c.id}
                            valoresIniciales={c}
                            onGuardar={(n) => actualizarComida(c.id, n)}
                            onCancelar={() => setComidaEditando(null)}
                          />
                        ) : (
                          <div key={c.id} className="card flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{c.tipo}{c.descripcion ? ` — ${c.descripcion}` : ''}</p>
                              <p className="text-ink-muted text-xs">{c.hora || ''}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex gap-3 text-right">
                                <MiniDato label="kcal" value={c.kcal} color="text-hiviz" />
                                <MiniDato label="P" value={c.proteinas} />
                                <MiniDato label="C" value={c.carbohidratos} />
                                <MiniDato label="G" value={c.grasas} />
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => { setFormComida(false); setComidaEditando(c.id) }}
                                  className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-2 py-1"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => { if (confirm('¿Borrar esta comida?')) eliminarComida(c.id) }}
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
        </>
      )}

      {sub === 'hidratacion' && (
        <>
          <div className="card">
            <span className="label-eyebrow">Carga rápida</span>
            <div className="flex gap-2 mt-2.5 flex-wrap">
              {[250, 500, 750].map((ml) => (
                <button
                  key={ml}
                  className="border border-asphalt-700 rounded-lg px-3 py-1.5 text-sm text-ink-muted"
                  onClick={async () => {
                    await supabase.from('hidratacion').insert({ fecha: hoy, ml, hora: new Date().toTimeString().slice(0, 5) })
                    cargar()
                  }}
                >
                  + {ml} ml
                </button>
              ))}
            </div>
          </div>
          <div className="card">
            <span className="label-eyebrow">Hoy</span>
            <p className="readout text-3xl font-bold text-route mt-1">{(mlHoy / 1000).toFixed(1)} L</p>
          </div>
          <div className="flex flex-col gap-2">
            {hidratacion.slice(0, 15).map((h) => (
              <div key={h.id} className="card flex justify-between py-2.5">
                <span className="text-ink-muted text-sm">{h.fecha} · {h.hora}</span>
                <span className="readout text-sm font-semibold">{h.ml} ml</span>
              </div>
            ))}
          </div>
        </>
      )}

      {sub === 'suplementos' && (
        <>
          <div className="flex justify-end">
            <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => setFormSuplemento((v) => !v)}>+ Suplemento</button>
          </div>
          {formSuplemento && (
            <FormSuplemento onGuardar={async (n) => {
              await supabase.from('suplementos').insert(n)
              setFormSuplemento(false)
              cargar()
            }} onCancelar={() => setFormSuplemento(false)} />
          )}
          {['Natural', 'Químico'].map((grupo) => {
            const items = suplementos.filter((s) => s.tipo === grupo)
            if (items.length === 0) return null
            return (
              <div key={grupo}>
                <p className="text-ink-muted text-xs uppercase tracking-wide mb-2">{grupo}</p>
                <div className="flex flex-col gap-2">
                  {items.map((s) => (
                    <div key={s.id} className="card">
                      <div className="flex justify-between">
                        <p className="font-medium text-sm">{s.nombre}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.tipo === 'Natural' ? 'text-hiviz border-hiviz-dim' : 'text-route border-route-dim'}`}>{s.tipo}</span>
                      </div>
                      <p className="text-ink-muted text-xs mt-1">{s.dosis}{s.frecuencia ? ` · ${s.frecuencia}` : ''}</p>
                      {s.notas && <p className="text-ink-faint text-xs mt-1">{s.notas}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

function Campo({ label, ...props }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-muted text-xs">{label}</span>
      <input
        {...props}
        onChange={(e) => props.onChange(e.target.value)}
        className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink focus:border-hiviz outline-none"
      />
    </label>
  )
}

function StatMini({ label, value, unit, color }) {
  const colorClass = { hiviz: 'text-hiviz', route: 'text-route' }[color] || 'text-ink'
  return (
    <div className="card">
      <span className="label-eyebrow">{label}</span>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={`readout text-2xl font-bold ${colorClass}`}>{value}</span>
        {unit && <span className="text-ink-muted text-xs">{unit}</span>}
      </div>
    </div>
  )
}

function MiniDato({ label, value, color = 'text-ink' }) {
  return (
    <div>
      <p className={`readout text-sm font-semibold ${color}`}>{value ?? '—'}</p>
      <p className="text-ink-muted text-[10px] uppercase">{label}</p>
    </div>
  )
}

function FormComida({ onGuardar, onCancelar, valoresIniciales }) {
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10), hora: new Date().toTimeString().slice(0, 5),
    tipo: 'Desayuno', descripcion: '', kcal: '', proteinas: '', carbohidratos: '', grasas: '',
    ...valoresIniciales
  })
  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })

  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onGuardar(form) }}>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Fecha</span>
        <input type="date" {...campo('fecha')} required className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Hora</span>
        <input type="time" {...campo('hora')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Tipo</span>
        <select {...campo('tipo')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          {TIPOS_COMIDA.map((t) => <option key={t}>{t}</option>)}
        </select></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Descripción</span>
        <input {...campo('descripcion')} placeholder="Avena con banana y miel" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Kcal</span>
        <input type="number" {...campo('kcal')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Proteínas (g)</span>
        <input type="number" {...campo('proteinas')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Carbohidratos (g)</span>
        <input type="number" {...campo('carbohidratos')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Grasas (g)</span>
        <input type="number" {...campo('grasas')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="col-span-2 flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button>
      </div>
    </form>
  )
}

function FormSuplemento({ onGuardar, onCancelar }) {
  const [form, setForm] = useState({ nombre: '', tipo: 'Natural', dosis: '', frecuencia: '', notas: '' })
  const campo = (k) => ({ value: form[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })

  return (
    <form className="card grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onGuardar(form) }}>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Nombre</span>
        <input {...campo('nombre')} required placeholder="Cafeína / Creatina / Magnesio" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Tipo</span>
        <select {...campo('tipo')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          {TIPOS_SUPLEMENTO.map((t) => <option key={t}>{t}</option>)}
        </select></label>
      <label className="flex flex-col gap-1 text-sm"><span className="text-ink-muted text-xs">Dosis</span>
        <input {...campo('dosis')} placeholder="5 g" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Frecuencia</span>
        <input {...campo('frecuencia')} placeholder="Diaria / Pre-entreno / Solo competencia" className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <label className="flex flex-col gap-1 text-sm col-span-2"><span className="text-ink-muted text-xs">Notas</span>
        <input {...campo('notas')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" /></label>
      <div className="col-span-2 flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Guardar</button>
      </div>
    </form>
  )
}
