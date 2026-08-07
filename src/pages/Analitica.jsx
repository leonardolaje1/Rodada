import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const DIAS_ANALISIS = 90

const BUCKETS_SUEÑO = [
  { id: 'bajo', label: '< 6h', test: (h) => h < 6 },
  { id: 'medio', label: '6–7h', test: (h) => h >= 6 && h < 7 },
  { id: 'bueno', label: '7–8h', test: (h) => h >= 7 && h < 8 },
  { id: 'alto', label: '> 8h', test: (h) => h >= 8 }
]

const BUCKETS_BB = [
  { id: 'bajo', label: '< 40', test: (v) => v < 40 },
  { id: 'medio', label: '40–70', test: (v) => v >= 40 && v < 70 },
  { id: 'alto', label: '> 70', test: (v) => v >= 70 }
]

function promedio(valores) {
  const limpio = valores.filter((v) => v != null && !isNaN(v))
  if (limpio.length === 0) return null
  return limpio.reduce((a, b) => a + b, 0) / limpio.length
}

function armarBuckets(buckets, metricas, entrenamientosPorFecha, campoMetrica) {
  return buckets
    .map((b) => {
      const fechasEnBucket = metricas
        .filter((m) => m[campoMetrica] != null && b.test(Number(m[campoMetrica])))
        .map((m) => m.fecha)

      const entrenosDeEsosDias = fechasEnBucket.flatMap((f) => entrenamientosPorFecha[f] || [])

      return {
        ...b,
        dias: fechasEnBucket.length,
        tssProm: promedio(entrenosDeEsosDias.map((e) => Number(e.tss))),
        potProm: promedio(entrenosDeEsosDias.filter((e) => e.potencia_avg).map((e) => Number(e.potencia_avg))),
        kmProm: promedio(entrenosDeEsosDias.map((e) => Number(e.km)))
      }
    })
    .filter((b) => b.dias >= 3)
}

export default function Analitica() {
  const [entrenamientos, setEntrenamientos] = useState([])
  const [metricas, setMetricas] = useState([])
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    setCargando(true)
    const desde = new Date()
    desde.setDate(desde.getDate() - DIAS_ANALISIS)
    const fechaDesde = desde.toISOString().slice(0, 10)

    const [{ data: ents }, { data: mets }] = await Promise.all([
      supabase.from('entrenamientos').select('*').gte('fecha', fechaDesde),
      supabase.from('metricas_diarias').select('*').gte('fecha', fechaDesde)
    ])
    setEntrenamientos(ents || [])
    setMetricas(mets || [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  if (cargando) return <p className="text-ink-muted text-sm">Cargando…</p>

  const entrenamientosPorFecha = {}
  for (const e of entrenamientos) {
    if (!entrenamientosPorFecha[e.fecha]) entrenamientosPorFecha[e.fecha] = []
    entrenamientosPorFecha[e.fecha].push(e)
  }

  const bucketsSueño = armarBuckets(BUCKETS_SUEÑO, metricas, entrenamientosPorFecha, 'sueño_horas')
  const bucketsBB = armarBuckets(BUCKETS_BB, metricas, entrenamientosPorFecha, 'body_battery_manana')

  const suficienteSueño = bucketsSueño.length >= 2
  const suficienteBB = bucketsBB.length >= 2

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Análisis</h1>
        <p className="text-ink-muted text-sm mt-1">Cómo se relaciona tu recuperación con tu rendimiento — últimos {DIAS_ANALISIS} días</p>
      </div>

      {!suficienteSueño && !suficienteBB && (
        <p className="text-ink-muted text-sm">
          Todavía no hay suficientes días con datos de sueño/recuperación y entrenamientos en el mismo día para
          mostrar un análisis confiable. Seguí cargando Recuperación y Entrenamientos — necesitás al menos 3 días
          en dos rangos distintos.
        </p>
      )}

      {suficienteSueño && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Sueño vs. rendimiento</h2>
          <p className="text-ink-muted text-xs mb-3">TSS y potencia promedio en entrenamientos, agrupados por cuánto dormiste esa noche.</p>
          <div className="flex flex-col gap-2">
            {bucketsSueño.map((b) => (
              <BucketCard key={b.id} label={b.label} dias={b.dias} tss={b.tssProm} potencia={b.potProm} km={b.kmProm} />
            ))}
          </div>
        </div>
      )}

      {suficienteBB && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Body Battery vs. rendimiento</h2>
          <p className="text-ink-muted text-xs mb-3">TSS y potencia promedio, agrupados por tu Body Battery al despertar.</p>
          <div className="flex flex-col gap-2">
            {bucketsBB.map((b) => (
              <BucketCard key={b.id} label={b.label} dias={b.dias} tss={b.tssProm} potencia={b.potProm} km={b.kmProm} />
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <span className="label-eyebrow">Cómo leer esto</span>
        <p className="text-ink-muted text-xs mt-2">
          Cada fila agrupa los días de los últimos {DIAS_ANALISIS} que tuvieron ese nivel de sueño o Body Battery,
          y promedia el TSS, la potencia y los km de los entrenamientos que hiciste esos mismos días. Solo se
          muestran grupos con al menos 3 días de datos, para que el promedio tenga algo de sentido. No es una
          relación de causa-efecto comprobada — es una forma rápida de ver si hay un patrón que valga la pena
          mirar con más atención.
        </p>
      </div>
    </div>
  )
}

function BucketCard({ label, dias, tss, potencia, km }) {
  return (
    <div className="card flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-ink-faint text-xs">{dias} días</p>
      </div>
      <div className="flex gap-4 text-right">
        <MiniDato label="TSS" value={tss != null ? tss.toFixed(0) : '—'} accent />
        <MiniDato label="W" value={potencia != null ? potencia.toFixed(0) : '—'} />
        <MiniDato label="km" value={km != null ? km.toFixed(0) : '—'} />
      </div>
    </div>
  )
}

function MiniDato({ label, value, accent }) {
  return (
    <div>
      <p className={`readout text-sm font-semibold ${accent ? 'text-hiviz' : ''}`}>{value}</p>
      <p className="text-ink-muted text-[10px] uppercase">{label}</p>
    </div>
  )
}
