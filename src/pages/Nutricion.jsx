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

export default function Nutricion() {
  const [sub, setSub] = useState('resumen')
  const [perfil, setPerfil] = useState({ peso: '', altura: '', edad: '', sexo: 'M', nivel_actividad: 'moderado' })
  const [comidas, setComidas] = useState([])
  const [hidratacion, setHidratacion] = useState([])
  const [suplementos, setSuplementos] = useState([])
  const [formComida, setFormComida] = useState(false)
  const [formSuplemento, setFormSuplemento] = useState(false)

  async function cargar() {
    const [{ data: p }, { data: cm }, { data: h }, { data: s }] = await Promise.all([
      supabase.from('perfil_nutricional').select('*').maybeSingle(),
      supabase.from('comidas').select('*').order('fecha', { ascending: false }).limit(50),
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
            <button className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg" onClick={() => setFormComida((v) => !v)}>+ Comida</button>
          </div>
          {formComida && (
            <FormComida onGuardar={async (n) => {
              await supabase.from('comidas').insert(n)
              setFormComida(false)
              cargar()
            }} onCancelar={() => setFormComida(false)} />
          )}
          {comidas.length === 0 ? (
            <p className="text-ink-muted text-sm">Sin comidas registradas todavía.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {comidas.map((c) => (
                <div key={c.id} className="card flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{c.tipo}{c.descripcion ? ` — ${c.descripcion}` : ''}</p>
                    <p className="text-ink-muted text-xs">{c.fecha}{c.hora ? ` · ${c.hora}` : ''}</p>
                  </div>
                  <div className="flex gap-3 text-right">
                    <MiniDato label="kcal" value={c.kcal} color="text-hiviz" />
                    <MiniDato label="P" value={c.proteinas} />
                    <MiniDato label="C" value={c.carbohidratos} />
                    <MiniDato label="G" value={c.grasas} />
                  </div>
                </div>
              ))}
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
                
