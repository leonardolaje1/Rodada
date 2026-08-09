import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Dumbbell, Moon, Wrench, Trophy, Check } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { construirSerieDiaria, calcularCargaDiaria } from '../lib/tss'
import StatCard from '../components/StatCard'
import PMCChart from '../components/PMCChart'
import { WEAR_TYPES, estadoDesgaste } from '../lib/wear'
import Skeleton, { SkeletonList } from '../components/Skeleton'
import { calcularTDEE } from '../lib/tdee'
import { evaluarDeficitNutricional } from '../lib/nutricionAlertas'
import { Apple } from 'lucide-react'

const DIRECCIONES = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
function direccionViento(grados) {
  return DIRECCIONES[Math.round(grados / 45) % 8]
}

const DIAS_ADHERENCIA = 14
const DIA_POR_INDICE = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']

function diaIdDe(fecha) {
  return DIA_POR_INDICE[new Date(fecha + 'T12:00:00').getDay()]
}

function calcularEstadoDia(tsb) {
  if (tsb < -25) return { titulo: 'Descansá', frase: 'Fatiga acumulada alta — priorizá recuperar hoy.', color: '#F14A4A' }
  if (tsb < -10) return { titulo: 'Con cuidado', frase: 'TSB bajo — bajá un cambio de intensidad hoy.', color: '#F5A623' }
  return { titulo: 'Entrená fuerte', frase: 'Estás recuperado, buen día para exigir.', color: '#4ADE80' }
}

export default function Dashboard() {
  const [entrenamientos, setEntrenamientos] = useState([])
  const [bicicletas, setBicicletas] = useState([])
  const [planesEntreno, setPlanesEntreno] = useState([])
  const [planesGym, setPlanesGym] = useState([])
  const [gimnasio, setGimnasio] = useState([])
  const [cargando, setCargando] = useState(true)
  const [clima, setClima] = useState(null)
  const [climaError, setClimaError] = useState(false)
  const [proximaCompetencia, setProximaCompetencia] = useState(null)
  const [componentes, setComponentes] = useState([])
  const [desgaste, setDesgaste] = useState([])
  const [gimnasioPendienteHoy, setGimnasioPendienteHoy] = useState(false)
  const [faltaRecuperacionHoy, setFaltaRecuperacionHoy] = useState(false)
  const [verMas, setVerMas] = useState(false)
  const [perfilNutricional, setPerfilNutricional] = useState(null)
  const [comidasRecientes, setComidasRecientes] = useState([])
  const [pesoActual, setPesoActual] = useState(null)

  useEffect(() => {
    async function cargar() {
      const desde90 = new Date()
      desde90.setDate(desde90.getDate() - 90)
      const desde14 = new Date()
      desde14.setDate(desde14.getDate() - DIAS_ADHERENCIA)

      const hoyStr = new Date().toISOString().slice(0, 10)
      const desde7 = new Date()
      desde7.setDate(desde7.getDate() - 7)
      const [{ data: ents }, { data: bicis }, { data: plsE }, { data: plsG }, { data: gym }, { data: comps }, { data: componentesData }, { data: desgasteData }, { data: gymHoy }, { data: recupHoy }, { data: perfilNutri }, { data: comidasNutri }, { data: pesosNutri }] = await Promise.all([
        supabase
          .from('entrenamientos')
          .select('*')
          .gte('fecha', desde90.toISOString().slice(0, 10))
          .order('fecha', { ascending: true }),
        supabase.from('bicicletas').select('*'),
        supabase.from('planes_entrenamiento').select('*').eq('activo', true),
        supabase.from('planes_gimnasio').select('*').eq('activo', true),
        supabase.from('gimnasio').select('fecha').gte('fecha', desde14.toISOString().slice(0, 10)),
        supabase.from('competencias').select('id, nombre, fecha').gte('fecha', hoyStr).order('fecha', { ascending: true }).limit(1),
        supabase.from('componentes').select('*'),
        supabase.from('desgaste_componentes').select('*'),
        supabase.from('gimnasio').select('id').eq('fecha', hoyStr).eq('estado', 'pendiente').limit(1),
        supabase.from('metricas_diarias').select('id').eq('fecha', hoyStr).maybeSingle(),
        supabase.from('perfil_nutricional').select('*').maybeSingle(),
        supabase.from('comidas').select('fecha, kcal, proteinas').gte('fecha', desde7.toISOString().slice(0, 10)),
        supabase.from('peso_historial').select('peso').order('fecha', { ascending: false }).limit(1)
      ])

      setEntrenamientos(ents || [])
      setBicicletas(bicis || [])
      setPlanesEntreno(plsE || [])
      setPlanesGym(plsG || [])
      setGimnasio(gym || [])
      setProximaCompetencia((comps && comps[0]) || null)
      setComponentes(componentesData || [])
      setDesgaste(desgasteData || [])
      setGimnasioPendienteHoy((gymHoy || []).length > 0)
      setFaltaRecuperacionHoy(!recupHoy)
      setPerfilNutricional(perfilNutri || null)
      setComidasRecientes(comidasNutri || [])
      setPesoActual((pesosNutri && pesosNutri[0]?.peso) || perfilNutri?.peso || null)
      setCargando(false)
    }
    cargar()
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) { setClimaError(true); return }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m,wind_direction_10m`
          )
          const data = await res.json()
          if (data.current) {
            setClima({
              temp: Math.round(data.current.temperature_2m),
              viento: Math.round(data.current.wind_speed_10m),
              direccion: direccionViento(data.current.wind_direction_10m)
            })
          } else {
            setClimaError(true)
          }
        } catch {
          setClimaError(true)
        }
      },
      () => setClimaError(true)
    )
  }, [])

  const hoy = new Date().toISOString().slice(0, 10)
  const desde90 = new Date()
  desde90.setDate(desde90.getDate() - 90)

  const serie = calcularCargaDiaria(
    construirSerieDiaria(entrenamientos, desde90.toISOString().slice(0, 10), hoy)
  )
  const ultimo = serie[serie.length - 1] || { ctl: 0, atl: 0, tsb: 0 }
  const estadoDia = calcularEstadoDia(ultimo.tsb)

  const inicioSemana = new Date()
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())
  const entrenosSemana = entrenamientos.filter((e) => e.fecha >= inicioSemana.toISOString().slice(0, 10))
  const kmSemana = entrenosSemana.reduce((acc, e) => acc + (e.km || 0), 0)
  const horasSemana = entrenosSemana.reduce((acc, e) => acc + (e.duracion_min || 0), 0) / 60

  // --- Adherencia al plan (últimos 14 días) ---
  const diasEvaluados = []
  const cursor = new Date()
  cursor.setDate(cursor.getDate() - (DIAS_ADHERENCIA - 1))
  for (let i = 0; i < DIAS_ADHERENCIA; i++) {
    diasEvaluados.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }

  let diasEsperadosEntreno = 0
  let diasCumplidosEntreno = 0
  for (const fecha of diasEvaluados) {
    const diaId = diaIdDe(fecha)
    const seEspera = planesEntreno.some((p) => (p.sesiones || []).some((s) => s.dia === diaId && s.tipo !== 'Descanso'))
    if (!seEspera) continue
    diasEsperadosEntreno++
    const hecho = entrenamientos.some((e) => e.fecha === fecha && e.estado === 'realizado')
    if (hecho) diasCumplidosEntreno++
  }

  let diasEsperadosGym = 0
  let diasCumplidosGym = 0
  for (const fecha of diasEvaluados) {
    const diaId = diaIdDe(fecha)
    const seEspera = planesGym.some((p) => (p.dias_semana || []).includes(diaId))
    if (!seEspera) continue
    diasEsperadosGym++
    const hecho = gimnasio.some((g) => g.fecha === fecha)
    if (hecho) diasCumplidosGym++
  }

  const diasEsperadosTotal = diasEsperadosEntreno + diasEsperadosGym
  const diasCumplidosTotal = diasCumplidosEntreno + diasCumplidosGym
  const tieneAlgunPlan = planesEntreno.length > 0 || planesGym.length > 0
  const adherenciaPct = diasEsperadosTotal > 0 ? Math.round((diasCumplidosTotal / diasEsperadosTotal) * 100) : null
  const colorAdherencia = adherenciaPct == null ? '#565B68' : adherenciaPct >= 80 ? '#C4F135' : adherenciaPct >= 50 ? '#F5A623' : '#F14A4A'

  const nombreBiciPorId = (bId) => bicicletas.find((b) => b.id === bId)?.nombre || 'Bici'
  const kmBiciPorId = (bId) => bicicletas.find((b) => b.id === bId)?.km_totales || 0

  const alertasDesgaste = desgaste
    .map((item) => {
      const wt = WEAR_TYPES.find((w) => w.id === item.tipo)
      if (!wt) return null
      const est = estadoDesgaste(item, wt, kmBiciPorId(item.bicicleta_id))
      if (est.nivel === 'ok') return null
      return { bici: nombreBiciPorId(item.bicicleta_id), label: wt.label, pct: est.pct, nivel: est.nivel, biciId: item.bicicleta_id }
    })
    .filter(Boolean)

  const alertasComponentes = componentes
    .map((c) => {
      if (!c.vida_util_km || c.km_instalacion == null) return null
      const kmDesde = kmBiciPorId(c.bicicleta_id) - Number(c.km_instalacion)
      const pct = Math.min(100, Math.round((kmDesde / Number(c.vida_util_km)) * 100))
      if (pct < 80) return null
      return { bici: nombreBiciPorId(c.bicicleta_id), label: c.tipo, pct, nivel: pct >= 100 ? 'critico' : 'atencion', biciId: c.bicicleta_id }
    })
    .filter(Boolean)

  const alertasMantenimiento = [...alertasDesgaste, ...alertasComponentes].sort((a, b) => b.pct - a.pct)

  const tdeeUsuario = calcularTDEE(perfilNutricional || {})
  const alertasNutricion = evaluarDeficitNutricional({ comidas: comidasRecientes, tdee: tdeeUsuario, pesoKg: pesoActual })

  const entrenamientoPendienteHoy = entrenamientos.find((e) => e.fecha === hoy && e.estado === 'pendiente') || null
  const entrenamientoHechoHoy = entrenamientos.some((e) => e.fecha === hoy && e.estado === 'realizado')
  const diasCompetencia = proximaCompetencia
    ? Math.round((new Date(proximaCompetencia.fecha + 'T00:00:00') - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : null

  if (cargando) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <Skeleton className="h-7 w-24 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-28 w-full" />
        <SkeletonList rows={3} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Panel</h1>
        </div>
        {clima && (
          <div className="card py-2 px-3 flex items-center gap-2.5 flex-shrink-0">
            <span className="readout text-lg font-bold text-hiviz">{clima.temp}°</span>
            <div className="text-right">
              <p className="text-ink-muted text-[11px]">{clima.viento} km/h</p>
              <p className="text-ink-faint text-[9px] uppercase">{clima.direccion}</p>
            </div>
          </div>
        )}
      </div>

      {/* Zona 1 — Hero de decisión */}
      <div className="card text-center py-5" style={{ borderColor: estadoDia.color + '55', background: estadoDia.color + '14' }}>
        <span className="label-eyebrow">Hoy</span>
        <p className="text-2xl font-display font-bold mt-1.5" style={{ color: estadoDia.color }}>{estadoDia.titulo}</p>
        <p className="text-ink-muted text-sm mt-1">{estadoDia.frase}</p>
      </div>

      {/* Zona 2 — Qué hacer hoy */}
      <div className="flex flex-col gap-2">
        <FilaHoy
          Icono={Activity}
          label="Entrenamiento"
          sub={entrenamientoPendienteHoy ? entrenamientoPendienteHoy.tipo : undefined}
          estado={entrenamientoHechoHoy ? 'hecho' : entrenamientoPendienteHoy ? 'pendiente' : 'nada'}
          to="/entrenamientos"
        />
        <FilaHoy
          Icono={Dumbbell}
          label="Gimnasio"
          estado={gimnasioPendienteHoy ? 'pendiente' : 'nada'}
          to="/gimnasio"
        />
        <FilaHoy
          Icono={Moon}
          label="Recuperación"
          sub={faltaRecuperacionHoy ? 'Falta cargar' : 'Cargado hoy'}
          estado={faltaRecuperacionHoy ? 'pendiente' : 'hecho'}
          to="/recuperacion"
        />
      </div>

      {/* Zona 3 — Alertas urgentes */}
      {(alertasMantenimiento.length > 0 || alertasNutricion.length > 0 || (diasCompetencia != null && diasCompetencia <= 7)) && (
        <div className="flex flex-col gap-2">
          {alertasNutricion.map((a) => (
            <Link key={a.tipo} to="/nutricion" className="card flex items-center justify-between hover:border-alert-amber" style={{ borderColor: '#F5A62355' }}>
              <div className="flex items-center gap-2.5">
                <IconoInsignia Icono={Apple} color="#F5A623" />
                <div>
                  <p className="text-xs font-semibold text-alert-amber">{a.titulo}</p>
                  <p className="text-ink-muted text-[11px]">{a.mensaje}</p>
                </div>
              </div>
              <span className="text-ink-faint text-xs">→</span>
            </Link>
          ))}
          {diasCompetencia != null && diasCompetencia <= 7 && (
            <Link to="/competencias" className="card flex items-center justify-between hover:border-hiviz" style={{ borderColor: '#EB642A55' }}>
              <div className="flex items-center gap-2.5">
                <IconoInsignia Icono={Trophy} color="#EB642A" />
                <div>
                  <p className="text-xs font-semibold text-hiviz">{proximaCompetencia.nombre}</p>
                  <p className="text-ink-muted text-[11px]">{diasCompetencia === 0 ? 'Hoy' : `En ${diasCompetencia} días`}</p>
                </div>
              </div>
              <span className="text-ink-faint text-xs">→</span>
            </Link>
          )}
          {alertasMantenimiento.slice(0, 2).map((a, i) => (
            <Link
              key={i}
              to={`/bicicletas/${a.biciId}`}
              className="card flex items-center justify-between hover:border-alert-red"
              style={{ borderColor: (a.nivel === 'critico' ? '#F14A4A' : '#F5A623') + '55' }}
            >
              <div className="flex items-center gap-2.5">
                <IconoInsignia Icono={Wrench} color={a.nivel === 'critico' ? '#F14A4A' : '#F5A623'} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: a.nivel === 'critico' ? '#F14A4A' : '#F5A623' }}>{a.label} — {a.pct}%</p>
                  <p className="text-ink-muted text-[11px]">{a.bici}</p>
                </div>
              </div>
              <span className="text-ink-faint text-xs">→</span>
            </Link>
          ))}
        </div>
      )}

      {/* Zona 4 — Detalle, colapsado por default */}
      <button onClick={() => setVerMas((v) => !v)} className="text-hiviz text-xs font-semibold flex items-center gap-1 self-start">
        {verMas ? 'Ocultar detalle' : 'Ver más detalle'} <span className="text-ink-faint">{verMas ? '▲' : '▼'}</span>
      </button>

      {verMas && (
        <div className="flex flex-col gap-4 pt-1 border-t border-asphalt-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <StatCard label="Horas — semana" value={horasSemana.toFixed(1)} unit="h" />
            <StatCard label="Km — semana" value={kmSemana.toFixed(0)} unit="km" />
            <StatCard label="CTL (fitness)" value={ultimo.ctl} accent="hiviz" />
            <StatCard label="ATL (fatiga)" value={ultimo.atl} accent="red" />
          </div>

          <PMCChart data={serie} />

          {tieneAlgunPlan && (
            <div className="card" style={{ borderColor: colorAdherencia }}>
              <span className="label-eyebrow">Adherencia al plan — últimos {DIAS_ADHERENCIA} días</span>
              {adherenciaPct != null ? (
                <>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="readout text-3xl font-bold" style={{ color: colorAdherencia }}>{adherenciaPct}%</span>
                    <span className="text-sm text-ink-muted">{diasCumplidosTotal} de {diasEsperadosTotal} días planificados</span>
                  </div>
                  <div className="w-full h-1.5 bg-asphalt-700 rounded-full mt-3 overflow-hidden">
                    <div className="h-full" style={{ width: `${adherenciaPct}%`, background: colorAdherencia }} />
                  </div>
                </>
              ) : (
                <p className="text-ink-muted text-sm mt-1">Tenés planes cargados, pero ninguno tiene días activos en los últimos {DIAS_ADHERENCIA}.</p>
              )}
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold mb-3">Bicicletas</h2>
            {bicicletas.length === 0 ? (
              <p className="text-ink-muted text-sm">
                Todavía no cargaste ninguna bicicleta. Andá a la sección Bicicletas para agregar la primera.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {bicicletas.map((b) => (
                  <Link key={b.id} to={`/bicicletas/${b.id}`} className="card flex items-center justify-between hover:border-hiviz">
                    <div>
                      <p className="font-medium">{b.nombre}</p>
                      <p className="text-ink-muted text-xs">{b.marca} {b.modelo}</p>
                    </div>
                    <span className="readout text-sm text-ink-muted">
                      {(b.km_totales || 0).toLocaleString('es-AR')} km
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function IconoInsignia({ Icono, color, activo = true }) {
  return (
    <span
      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: activo ? `${color}1A` : 'rgb(44,44,44)' }}
    >
      <Icono size={15} strokeWidth={2} color={activo ? color : '#6E6E6E'} />
    </span>
  )
}

function FilaHoy({ Icono, label, sub, estado, to }) {
  const hecho = estado === 'hecho'
  const nada = estado === 'nada'
  return (
    <Link
      to={to}
      className={`card flex items-center justify-between py-2.5 ${nada ? 'opacity-50' : 'hover:border-hiviz'}`}
    >
      <div className="flex items-center gap-2.5">
        <IconoInsignia Icono={Icono} color="#EB642A" activo={!nada} />
        <div>
          <p className="text-sm font-semibold">{label}</p>
          {sub && <p className="text-ink-muted text-xs">{sub}</p>}
        </div>
      </div>
      {nada ? (
        <span className="text-ink-faint text-xs">Sin plan</span>
      ) : hecho ? (
        <Check size={16} className="text-hiviz" strokeWidth={2.5} />
      ) : (
        <span className="text-hiviz text-xs font-semibold">Ver →</span>
      )}
    </Link>
  )
}
