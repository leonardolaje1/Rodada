import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { construirSerieDiaria, calcularCargaDiaria, interpretarTSB } from '../lib/tss'
import PMCChart from '../components/PMCChart'
import { WEAR_TYPES, estadoDesgaste } from '../lib/wear'
import Skeleton, { SkeletonStatGrid, SkeletonList } from '../components/Skeleton'

const DIRECCIONES = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
const DIAS_ADHERENCIA = 14
const DIA_POR_INDICE = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']

function direccionViento(grados) {
  return DIRECCIONES[Math.round(grados / 45) % 8]
}

function diaIdDe(fecha) {
  return DIA_POR_INDICE[new Date(fecha + 'T12:00:00').getDay()]
}

function formatearDuracion(minutos) {
  if (!minutos) return null

  const horas = Math.floor(minutos / 60)
  const minutosRestantes = minutos % 60

  if (horas > 0 && minutosRestantes > 0) {
    return `${horas}h ${minutosRestantes}min`
  }

  if (horas > 0) return `${horas}h`
  return `${minutosRestantes}min`
}

function colorForma(forma) {
  if (forma.color === 'red') return '#F14A4A'
  if (forma.color === 'amber') return '#F5A623'
  if (forma.color === 'route') return '#4DA3FF'
  return '#C4F135'
}

function obtenerTextoEntrenamiento(entrenamiento) {
  if (!entrenamiento) return null

  return (
    entrenamiento.nombre ||
    entrenamiento.tipo ||
    entrenamiento.titulo ||
    'Entrenamiento'
  )
}

function obtenerRecomendacion(tsb, entrenamientoHoy, clima) {
  if (tsb < -30) {
    return {
      titulo: 'Priorizar recuperaciÃ³n',
      texto: 'Tu fatiga acumulada es alta. Si el entrenamiento de hoy es exigente, considerÃ¡ reducir la intensidad o priorizar una sesiÃ³n de recuperaciÃ³n.',
      tono: 'red'
    }
  }

  if (tsb < -10) {
    return {
      titulo: 'Controlar la carga',
      texto: 'TenÃ©s fatiga acumulada. La sesiÃ³n prevista puede mantenerse si te sentÃ­s bien, pero evitÃ¡ agregar volumen o intensidad innecesaria.',
      tono: 'amber'
    }
  }

  if (tsb > 20) {
    return {
      titulo: 'Buen momento para estimular',
      texto: 'EstÃ¡s muy fresco. Si el plan contempla intensidad, es un buen momento para aprovecharla sin agregar volumen fuera de lo previsto.',
      tono: 'blue'
    }
  }

  if (entrenamientoHoy) {
    return {
      titulo: 'Seguir el plan',
      texto: 'Tu estado actual es compatible con una jornada normal de entrenamiento. PriorizÃ¡ completar la sesiÃ³n prevista antes de sumar carga adicional.',
      tono: 'green'
    }
  }

  if (clima && clima.viento >= 30) {
    return {
      titulo: 'AtenciÃ³n al viento',
      texto: 'Las condiciones actuales presentan bastante viento. Si vas a salir, priorizÃ¡ controlar el esfuerzo por potencia o frecuencia cardÃ­aca en lugar de perseguir velocidad.',
      tono: 'amber'
    }
  }

  return {
    titulo: 'DÃ­a estable',
    texto: 'No aparece una seÃ±al importante de fatiga. MantenÃ© el plan previsto y dejÃ¡ que la evoluciÃ³n de la semana marque el prÃ³ximo ajuste.',
    tono: 'green'
  }
}

export default function Dashboard() {
  const [entrenamientos, setEntrenamientos] = useState([])
  const [bicicletas, setBicicletas] = useState([])
  const [planesEntreno, setPlanesEntreno] = useState([])
  const [planesGym, setPlanesGym] = useState([])
  const [gimnasio, setGimnasio] = useState([])
  const [cargando, setCargando] = useState(true)
  const [clima, setClima] = useState(null)
  const [proximaCompetencia, setProximaCompetencia] = useState(null)
  const [componentes, setComponentes] = useState([])
  const [desgaste, setDesgaste] = useState([])
  const [mostrarExplicacion, setMostrarExplicacion] = useState(false)

  useEffect(() => {
    async function cargar() {
      const desde90 = new Date()
      desde90.setDate(desde90.getDate() - 90)

      const desde14 = new Date()
      desde14.setDate(desde14.getDate() - DIAS_ADHERENCIA)

      const hoyStr = new Date().toISOString().slice(0, 10)

      const [
        { data: ents },
        { data: bicis },
        { data: plsE },
        { data: plsG },
        { data: gym },
        { data: comps },
        { data: componentesData },
        { data: desgasteData }
      ] = await Promise.all([
        supabase
          .from('entrenamientos')
          .select('*')
          .gte('fecha', desde90.toISOString().slice(0, 10))
          .order('fecha', { ascending: true }),
        supabase.from('bicicletas').select('*'),
        supabase.from('planes_entrenamiento').select('*').eq('activo', true),
        supabase.from('planes_gimnasio').select('*').eq('activo', true),
        supabase
          .from('gimnasio')
          .select('fecha')
          .gte('fecha', desde14.toISOString().slice(0, 10)),
        supabase
          .from('competencias')
          .select('id, nombre, fecha')
          .gte('fecha', hoyStr)
          .order('fecha', { ascending: true })
          .limit(1),
        supabase.from('componentes').select('*'),
        supabase.from('desgaste_componentes').select('*')
      ])

      setEntrenamientos(ents || [])
      setBicicletas(bicis || [])
      setPlanesEntreno(plsE || [])
      setPlanesGym(plsG || [])
      setGimnasio(gym || [])
      setProximaCompetencia((comps && comps[0]) || null)
      setComponentes(componentesData || [])
      setDesgaste(desgasteData || [])
      setCargando(false)
    }

    cargar()
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) return

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
          }
        } catch {
          // El clima es informaciÃ³n secundaria. Si falla, el Dashboard continÃºa funcionando.
        }
      },
      () => {
        // La ubicaciÃ³n es opcional.
      }
    )
  }, [])

  const hoy = new Date().toISOString().slice(0, 10)

  const desde90 = new Date()
  desde90.setDate(desde90.getDate() - 90)

  const serie = calcularCargaDiaria(
    construirSerieDiaria(
      entrenamientos,
      desde90.toISOString().slice(0, 10),
      hoy
    )
  )

  const ultimo = serie[serie.length - 1] || {
    ctl: 0,
    atl: 0,
    tsb: 0
  }

  const forma = interpretarTSB(ultimo.tsb)
  const formaColor = colorForma(forma)

  const entrenamientoHoy = entrenamientos
    .filter((e) => e.fecha?.slice(0, 10) === hoy)
    .sort((a, b) => {
      if (a.estado === 'planificado' && b.estado !== 'planificado') return -1
      if (a.estado !== 'planificado' && b.estado === 'planificado') return 1
      return 0
    })[0] || null

  const entrenamientoRealizadoHoy = entrenamientos.find(
    (e) =>
      e.fecha?.slice(0, 10) === hoy &&
      e.estado === 'realizado'
  )

  const inicioSemana = new Date()
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())

  const entrenosSemana = entrenamientos.filter(
    (e) => e.fecha >= inicioSemana.toISOString().slice(0, 10)
  )

  const kmSemana = entrenosSemana.reduce(
    (acc, e) => acc + (e.km || 0),
    0
  )

  const horasSemana =
    entrenosSemana.reduce(
      (acc, e) => acc + (e.duracion_min || 0),
      0
    ) / 60

  const diasEvaluados = []
  const cursor = new Date()

  cursor.setDate(
    cursor.getDate() - (DIAS_ADHERENCIA - 1)
  )

  for (let i = 0; i < DIAS_ADHERENCIA; i++) {
    diasEvaluados.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }

  let diasEsperadosEntreno = 0
  let diasCumplidosEntreno = 0

  for (const fecha of diasEvaluados) {
    const diaId = diaIdDe(fecha)

    const seEspera = planesEntreno.some((p) =>
      (p.sesiones || []).some(
        (s) =>
          s.dia === diaId &&
          s.tipo !== 'Descanso'
      )
    )

    if (!seEspera) continue

    diasEsperadosEntreno++

    const hecho = entrenamientos.some(
      (e) =>
        e.fecha === fecha &&
        e.estado === 'realizado'
    )

    if (hecho) diasCumplidosEntreno++
  }

  let diasEsperadosGym = 0
  let diasCumplidosGym = 0

  for (const fecha of diasEvaluados) {
    const diaId = diaIdDe(fecha)

    const seEspera = planesGym.some((p) =>
      (p.dias_semana || []).includes(diaId)
    )

    if (!seEspera) continue

    diasEsperadosGym++

    const hecho = gimnasio.some(
      (g) => g.fecha === fecha
    )

    if (hecho) diasCumplidosGym++
  }

  const diasEsperadosTotal =
    diasEsperadosEntreno + diasEsperadosGym

  const diasCumplidosTotal =
    diasCumplidosEntreno + diasCumplidosGym

  const tieneAlgunPlan =
    planesEntreno.length > 0 ||
    planesGym.length > 0

  const adherenciaPct =
    diasEsperadosTotal > 0
      ? Math.round(
          (diasCumplidosTotal / diasEsperadosTotal) * 100
        )
      : null

  const colorAdherencia =
    adherenciaPct == null
      ? '#565B68'
      : adherenciaPct >= 80
        ? '#C4F135'
        : adherenciaPct >= 50
          ? '#F5A623'
          : '#F14A4A'

  const nombreBiciPorId = (bId) =>
    bicicletas.find((b) => b.id === bId)?.nombre || 'Bici'

  const kmBiciPorId = (bId) =>
    bicicletas.find((b) => b.id === bId)?.km_totales || 0

  const alertasDesgaste = desgaste
    .map((item) => {
      const wt = WEAR_TYPES.find(
        (w) => w.id === item.tipo
      )

      if (!wt) return null

      const est = estadoDesgaste(
        item,
        wt,
        kmBiciPorId(item.bicicleta_id)
      )

      if (est.nivel === 'ok') return null

      return {
        bici: nombreBiciPorId(item.bicicleta_id),
        label: wt.label,
        pct: est.pct,
        nivel: est.nivel,
        biciId: item.bicicleta_id
      }
    })
    .filter(Boolean)

  const alertasComponentes = componentes
    .map((c) => {
      if (
        !c.vida_util_km ||
        c.km_instalacion == null
      ) {
        return null
      }

      const kmDesde =
        kmBiciPorId(c.bicicleta_id) -
        Number(c.km_instalacion)

      const pct = Math.min(
        100,
        Math.round(
          (kmDesde / Number(c.vida_util_km)) * 100
        )
      )

      if (pct < 80) return null

      return {
        bici: nombreBiciPorId(c.bicicleta_id),
        label: c.tipo,
        pct,
        nivel: pct >= 100 ? 'critico' : 'atencion',
        biciId: c.bicicleta_id
      }
    })
    .filter(Boolean)

  const alertasMantenimiento = [
    ...alertasDesgaste,
    ...alertasComponentes
  ].sort((a, b) => b.pct - a.pct)

  const recomendacion = obtenerRecomendacion(
    ultimo.tsb,
    entrenamientoHoy,
    clima
  )

  const diasParaCompetencia = proximaCompetencia
    ? Math.round(
        (
          new Date(
            proximaCompetencia.fecha + 'T00:00:00'
          ) -
          new Date().setHours(0, 0, 0, 0)
        ) / 86400000
      )
    : null

  if (cargando) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>

        <Skeleton className="h-36 w-full" />

        <SkeletonStatGrid count={4} />

        <Skeleton className="h-28 w-full" />

        <Skeleton className="h-40 w-full" />

        <SkeletonList rows={2} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 max-w-6xl">

      {/* CABECERA */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="label-eyebrow">Hoy</p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">
            Tu estado y tu plan
          </h1>
          <p className="text-ink-muted text-sm mt-1">
            Lo importante para decidir quÃ© hacer hoy.
          </p>
        </div>

        {clima && (
          <div className="card py-2.5 px-3.5 flex items-center gap-3 flex-shrink-0">
            <span className="readout text-2xl font-bold text-hiviz">
              {clima.temp}Â°
            </span>

            <div className="text-right">
              <p className="text-ink-muted text-xs">
                Viento {clima.viento} km/h
              </p>
              <p className="text-ink-faint text-[10px] uppercase">
                {clima.direccion}
              </p>
            </div>
          </div>
        )}
      </header>

      {/* ESTADO DEL ATLETA */}
      <section
        className="card"
        style={{
          borderColor: formaColor
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

          <div>
            <span className="label-eyebrow">
              Estado actual
            </span>

            <div className="flex items-center gap-3 mt-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: formaColor }}
              />

              <h2 className="text-xl font-bold">
                {forma.texto}
              </h2>
            </div>

            <p className="text-ink-muted text-sm mt-2 max-w-xl">
              Tu forma actual surge de la relaciÃ³n entre
              tu carga acumulada y tu fatiga reciente.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 md:min-w-[280px]">

            <div>
              <p className="text-ink-faint text-[10px] uppercase">
                Fitness
              </p>
              <p className="readout text-xl font-bold mt-1">
                {ultimo.ctl}
              </p>
            </div>

            <div>
              <p className="text-ink-faint text-[10px] uppercase">
                Fatiga
              </p>
              <p className="readout text-xl font-bold mt-1">
                {ultimo.atl}
              </p>
            </div>

            <div>
              <p className="text-ink-faint text-[10px] uppercase">
                TSB
              </p>
              <p
                className="readout text-xl font-bold mt-1"
                style={{ color: formaColor }}
              >
                {ultimo.tsb}
              </p>
            </div>

          </div>

        </div>

        <button
          onClick={() => setMostrarExplicacion((v) => !v)}
          className="text-hiviz text-xs mt-4"
        >
          {mostrarExplicacion
            ? 'Ocultar explicaciÃ³n'
            : 'Â¿CÃ³mo se calcula mi estado?'}
        </button>

        {mostrarExplicacion && (
          <div className="flex flex-col gap-2.5 mt-3 pt-3 border-t border-asphalt-700">
            <p className="text-ink-muted text-xs">
              <b className="text-ink">
                Fitness (CTL).
              </b>{' '}
              Representa tu carga de entrenamiento acumulada
              durante varias semanas.
            </p>

            <p className="text-ink-muted text-xs">
              <b className="text-ink">
                Fatiga (ATL).
              </b>{' '}
              Refleja la carga mÃ¡s reciente y cambia mÃ¡s rÃ¡pido.
            </p>

            <p className="text-ink-muted text-xs">
              <b className="text-ink">
                TSB.
              </b>{' '}
              Compara fitness y fatiga para estimar tu estado
              de frescura actual.
            </p>
          </div>
        )}
      </section>

      {/* RECOMENDACIÃN */}
      <section className="card">

        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="label-eyebrow">
              CycleIQ recomienda
            </span>

            <h2 className="text-lg font-semibold mt-1">
              {recomendacion.titulo}
            </h2>
          </div>

          <span
            className="text-[10px] uppercase tracking-widest font-semibold"
            style={{
              color:
                recomendacion.tono === 'red'
                  ? '#F14A4A'
                  : recomendacion.tono === 'amber'
                    ? '#F5A623'
                    : recomendacion.tono === 'blue'
                      ? '#4DA3FF'
                      : '#C4F135'
            }}
          >
            Insight
          </span>
        </div>

        <p className="text-ink-muted text-sm mt-2 max-w-2xl">
          {recomendacion.texto}
        </p>

      </section>

      {/* ENTRENAMIENTO DE HOY */}
      <section className="card">

        <div className="flex items-center justify-between gap-3">
          <span className="label-eyebrow">
            Entrenamiento de hoy
          </span>

          <Link
            to="/calendario"
            className="text-hiviz text-xs"
          >
            Ver plan
          </Link>
        </div>

        {entrenamientoHoy ? (
          <div className="mt-3">

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

              <div>
                <h2 className="text-xl font-semibold">
                  {obtenerTextoEntrenamiento(entrenamientoHoy)}
                </h2>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-ink-muted">

                  {entrenamientoHoy.duracion_min && (
                    <span>
                      {formatearDuracion(
                        entrenamientoHoy.duracion_min
                      )}
                    </span>
                  )}

                  {entrenamientoHoy.km && (
                    <span>
                      {entrenamientoHoy.km} km
                    </span>
                  )}

                  {entrenamientoHoy.tss != null && (
                    <span>
                      TSS {entrenamientoHoy.tss}
                    </span>
                  )}

                </div>
              </div>

              <div
                className={`text-xs font-medium px-3 py-1.5 rounded-full self-start ${
                  entrenamientoRealizadoHoy
                    ? 'bg-asphalt-800 text-hiviz'
                    : 'bg-asphalt-800 text-ink-muted'
                }`}
              >
                {entrenamientoRealizadoHoy
                  ? 'Realizado'
                  : entrenamientoHoy.estado || 'Planificado'}
              </div>

            </div>

            {entrenamientoHoy.descripcion && (
              <p className="text-ink-muted text-sm mt-4">
                {entrenamientoHoy.descripcion}
              </p>
            )}

          </div>
        ) : (
          <div className="mt-3">

            <p className="text-sm text-ink-muted">
              No hay un entrenamiento registrado para hoy.
            </p>

            <Link
              to="/calendario"
              className="inline-block text-hiviz text-xs mt-2"
            >
              Revisar calendario
            </Link>

          </div>
        )}

      </section>

      {/* MÃTRICAS CLAVE */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            Esta semana
          </h2>

          <Link
            to="/analitica"
            className="text-hiviz text-xs"
          >
            Ver rendimiento
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

          <div className="card">
            <span className="label-eyebrow">
              Tiempo
            </span>
            <p className="readout text-2xl font-bold mt-1">
              {horasSemana.toFixed(1)}
              <span className="text-sm ml-1 text-ink-muted">
                h
              </span>
            </p>
          </div>

          <div className="card">
            <span className="label-eyebrow">
              Distancia
            </span>
            <p className="readout text-2xl font-bold mt-1">
              {kmSemana.toFixed(0)}
              <span className="text-sm ml-1 text-ink-muted">
                km
              </span>
            </p>
          </div>

          <div className="card">
            <span className="label-eyebrow">
              Fitness
            </span>
            <p className="readout text-2xl font-bold text-hiviz mt-1">
              {ultimo.ctl}
            </p>
          </div>

          <div className="card">
            <span className="label-eyebrow">
              Fatiga
            </span>
            <p className="readout text-2xl font-bold mt-1">
              {ultimo.atl}
            </p>
          </div>

        </div>
      </section>

      {/* ADHERENCIA */}
      {tieneAlgunPlan && (
        <section className="card">

          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="label-eyebrow">
                Adherencia
              </span>
              <h2 className="text-lg font-semibold mt-1">
                Â¿QuÃ© tan cerca estÃ¡s del plan?
              </h2>
            </div>

            {adherenciaPct != null && (
              <span
                className="readout text-2xl font-bold"
                style={{ color: colorAdherencia }}
              >
                {adherenciaPct}%
              </span>
            )}

          </div>

          {adherenciaPct != null ? (
            <>
              <div className="w-full h-1.5 bg-asphalt-700 rounded-full mt-4 overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${adherenciaPct}%`,
                    background: colorAdherencia
                  }}
                />
              </div>

              <div className="flex flex-wrap gap-4 mt-2.5">
                <span className="text-ink-muted text-xs">
                  {diasCumplidosTotal} de {diasEsperadosTotal} dÃ­as
                </span>

                {diasEsperadosEntreno > 0 && (
                  <span className="text-ink-muted text-xs">
                    Entrenamiento {diasCumplidosEntreno}/
                    {diasEsperadosEntreno}
                  </span>
                )}

                {diasEsperadosGym > 0 && (
                  <span className="text-ink-muted text-xs">
                    Gimnasio {diasCumplidosGym}/
                    {diasEsperadosGym}
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-ink-muted text-sm mt-2">
              TenÃ©s planes cargados, pero todavÃ­a no hay dÃ­as
              activos para evaluar.
            </p>
          )}

        </section>
      )}

      {/* COMPETENCIA */}
      {proximaCompetencia && (
        <section className="card">

          <div className="flex items-center justify-between gap-4">

            <div>
              <span className="label-eyebrow">
                PrÃ³ximo objetivo
              </span>

              <h2 className="text-lg font-semibold mt-1">
                {proximaCompetencia.nombre}
              </h2>

              <p className="text-ink-faint text-xs mt-1">
                {proximaCompetencia.fecha}
              </p>
            </div>

            <div className="text-right">
              <p className="readout text-3xl font-bold text-hiviz">
                {diasParaCompetencia === 0
                  ? 'Hoy'
                  : `${diasParaCompetencia}d`}
              </p>

              <p className="text-ink-faint text-[10px] uppercase">
                para competir
              </p>
            </div>

          </div>

        </section>
      )}

      {/* EVOLUCIÃN */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">
              EvoluciÃ³n de carga
            </h2>
            <p className="text-ink-muted text-xs mt-1">
              Fitness, fatiga y estado a lo largo del tiempo.
            </p>
          </div>

          <Link
            to="/analitica"
            className="text-hiviz text-xs"
          >
            Ver anÃ¡lisis
          </Link>
        </div>

        <PMCChart data={serie} />
      </section>

      {/* MANTENIMIENTO */}
      {alertasMantenimiento.length > 0 && (
        <section>

          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">
                AtenciÃ³n al equipamiento
              </h2>

              <p className="text-ink-muted text-xs mt-1">
                Solo mostramos elementos que requieren atenciÃ³n.
              </p>
            </div>

            <Link
              to="/bicicletas"
              className="text-hiviz text-xs"
            >
              Ver equipamiento
            </Link>
          </div>

          <div className="flex flex-col gap-2">

            {alertasMantenimiento.slice(0, 3).map((a, i) => (
              <Link
                key={i}
                to={`/bicicletas/${a.biciId}`}
                className="card flex items-center justify-between hover:border-hiviz"
                style={{
                  borderColor:
                    a.nivel === 'critico'
                      ? '#F14A4A'
                      : '#F5A623'
                }}
              >
                <div>
                  <p className="text-sm font-medium">
                    {a.label}
                  </p>

                  <p className="text-ink-muted text-xs">
                    {a.bici}
                  </p>
                </div>

                <span
                  className="readout text-sm font-bold"
                  style={{
                    color:
                      a.nivel === 'critico'
                        ? '#F14A4A'
                        : '#F5A623'
                  }}
                >
                  {a.pct}%
                </span>
              </Link>
            ))}

          </div>

        </section>
      )}

    </div>
  )
}
