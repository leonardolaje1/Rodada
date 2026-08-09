import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { construirSerieDiaria, calcularCargaDiaria, interpretarTSB } from '../lib/tss'
import StatCard from '../components/StatCard'
import PMCChart from '../components/PMCChart'
import { WEAR_TYPES, estadoDesgaste } from '../lib/wear'
import Skeleton, { SkeletonStatGrid, SkeletonList } from '../components/Skeleton'

const DIRECCIONES = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
function direccionViento(grados) {
  return DIRECCIONES[Math.round(grados / 45) % 8]
}

const DIAS_ADHERENCIA = 14
const DIA_POR_INDICE = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']

function diaIdDe(fecha) {
  return DIA_POR_INDICE[new Date(fecha + 'T12:00:00').getDay()]
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
  const [mostrarExplicacion, setMostrarExplicacion] = useState(false)
  const [gimnasioPendienteHoy, setGimnasioPendienteHoy] = useState(false)
  const [faltaRecuperacionHoy, setFaltaRecuperacionHoy] = useState(false)

  useEffect(() => {
    async function cargar() {
      const desde90 = new Date()
      desde90.setDate(desde90.getDate() - 90)
      const desde14 = new Date()
      desde14.setDate(desde14.getDate() - DIAS_ADHERENCIA)

      const hoyStr = new Date().toISOString().slice(0, 10)
      const [{ data: ents }, { data: bicis }, { data: plsE }, { data: plsG }, { data: gym }, { data: comps }, { data: componentesData }, { data: desgasteData }, { data: gymHoy }, { data: recupHoy }] = await Promise.all([
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
        supabase.from('metricas_diarias').select('id').eq('fecha', hoyStr).maybeSingle()
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
  const forma = interpretarTSB(ultimo.tsb)

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

  if (cargando) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <Skeleton className="h-7 w-24 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
        <SkeletonStatGrid count={4} />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <SkeletonList rows={2} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Panel</h1>
          <p className="text-ink-muted text-sm mt-1">Resumen de tu actividad</p>
        </div>
        {clima && (
          <div className="card py-2.5 px-3.5 flex items-center gap-3 flex-shrink-0">
            <span className="readout text-2xl font-bold text-hiviz">{clima.temp}°</span>
            <div className="text-right">
              <p className="text-ink-muted text-xs">{clima.viento} km/h</p>
              <p className="text-ink-faint text-[10px] uppercase">{clima.direccion}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Horas — semana" value={horasSemana.toFixed(1)} unit="h" />
        <StatCard label="Km — semana" value={kmSemana.toFixed(0)} unit="km" />
        <StatCard label="CTL (fitness)" value={ultimo.ctl} accent="hiviz" />
        <StatCard label="ATL (fatiga)" value={ultimo.atl} accent="red" />
      </div>

      <div className="card">
        <span className="label-eyebrow">Forma actual (TSB)</span>
        <div className="flex items-baseline gap-3 mt-1">
          <span className={`readout text-4xl font-bold text-${forma.color}`}>{ultimo.tsb}</span>
          <span className="text-sm text-ink-muted">{forma.texto}</span>
        </div>
        <button onClick={() => setMostrarExplicacion((v) => !v)} className="text-hiviz text-xs mt-2.5">
          {mostrarExplicacion ? 'Ocultar explicación' : '¿Qué significan estos números?'}
        </button>
        {mostrarExplicacion && (
          <div className="flex flex-col gap-2.5 mt-3 pt-3 border-t border-asphalt-700">
            <p className="text-ink-muted text-xs"><b className="text-ink">CTL — tu fondo de forma.</b> Cuánto entrenaste en las últimas 6 semanas. Sube y baja lento: hace falta constancia para moverlo.</p>
            <p className="text-ink-muted text-xs"><b className="text-ink">ATL — tu cansancio reciente.</b> Cuánto entrenaste en la última semana. Sube y baja rápido: unos días duros y ya lo notás.</p>
            <p className="text-ink-muted text-xs"><b className="text-ink">TSB — tu estado hoy.</b> Es CTL menos ATL. Positivo: estás descansado. Muy negativo: estás cargado, conviene bajar un cambio.</p>
          </div>
        )}
      </div>

      {tieneAlgunPlan && (
        <div className="card" style={{ borderColor: colorAdherencia }}>
          <span className="label-eyebrow">Adherencia al plan — últimos {DIAS_ADHERENCIA} días</span>
          {adherenciaPct != null ? (
            <>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="readout text-4xl font-bold" style={{ color: colorAdherencia }}>{adherenciaPct}%</span>
                <span className="text-sm text-ink-muted">{diasCumplidosTotal} de {diasEsperadosTotal} días planificados</span>
              </div>
              <div className="w-full h-1.5 bg-asphalt-700 rounded-full mt-3 overflow-hidden">
                <div className="h-full" style={{ width: `${adherenciaPct}%`, background: colorAdherencia }} />
              </div>
              <div className="flex gap-4 mt-2.5">
                {diasEsperadosEntreno > 0 && (
                  <span className="text-ink-muted text-xs">Entrenamiento: {diasCumplidosEntreno}/{diasEsperadosEntreno}</span>
                )}
                {diasEsperadosGym > 0 && (
                  <span className="text-ink-muted text-xs">Gimnasio: {diasCumplidosGym}/{diasEsperadosGym}</span>
                )}
              </div>
            </>
          ) : (
            <p className="text-ink-muted text-sm mt-1">Tenés planes cargados, pero ninguno tiene días activos en los últimos {DIAS_ADHERENCIA}.</p>
          )}
        </div>
      )}

      {proximaCompetencia && (() => {
        const dias = Math.round((new Date(proximaCompetencia.fecha + 'T00:00:00') - new Date().setHours(0, 0, 0, 0)) / 86400000)
        return (
          <div className="card">
            <span className="label-eyebrow">Próxima competencia</span>
            <div className="flex items-baseline justify-between mt-1">
              <p className="text-sm font-semibold">{proximaCompetencia.nombre}</p>
              <span className="readout text-2xl font-bold text-hiviz">{dias === 0 ? 'Hoy' : `${dias}d`}</span>
            </div>
            <p className="text-ink-faint text-xs mt-0.5">{proximaCompetencia.fecha}</p>
          </div>
        )
      })()}

      <PMCChart
        data={serie}
        hoy={{
          entrenamientoPendiente: entrenamientos.find((e) => e.fecha === hoy && e.estado === 'pendiente') || null,
          gimnasioPendiente: gimnasioPendienteHoy,
          faltaRecuperacion: faltaRecuperacionHoy
        }}
      />

      {alertasMantenimiento.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Mantenimiento</h2>
          <div className="flex flex-col gap-2">
            {alertasMantenimiento.map((a, i) => (
              <Link
                key={i}
                to={`/bicicletas/${a.biciId}`}
                className="card flex items-center justify-between hover:border-hiviz"
                style={{ borderColor: a.nivel === 'critico' ? '#F14A4A' : '#F5A623' }}
              >
                <div>
                  <p className="text-sm font-medium">{a.label}</p>
                  <p className="text-ink-muted text-xs">{a.bici}</p>
                </div>
                <span className="readout text-sm font-bold" style={{ color: a.nivel === 'critico' ? '#F14A4A' : '#F5A623' }}>{a.pct}%</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Bicicletas</h2>
        {bicicletas.length === 0 ? (
          <p className="text-ink-muted text-sm">
            Todavía no cargaste ninguna bicicleta. Andá a la sección Bicis para agregar la primera.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {bicicletas.map((b) => (
              <div key={b.id} className="card flex items-center justify-between">
                <div>
                  <p className="font-medium">{b.nombre}</p>
                  <p className="text-ink-muted text-xs">{b.marca} {b.modelo}</p>
                </div>
                <span className="readout text-sm text-ink-muted">
                  {(b.km_totales || 0).toLocaleString('es-AR')} km
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
