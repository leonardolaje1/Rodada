import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { construirSerieDiaria, calcularCargaDiaria, interpretarTSB } from '../lib/tss'
import StatCard from '../components/StatCard'
import PMCChart from '../components/PMCChart'

export default function Dashboard() {
  const [entrenamientos, setEntrenamientos] = useState([])
  const [bicicletas, setBicicletas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const desde90 = new Date()
      desde90.setDate(desde90.getDate() - 90)

      const [{ data: ents }, { data: bicis }] = await Promise.all([
        supabase
          .from('entrenamientos')
          .select('*')
          .gte('fecha', desde90.toISOString().slice(0, 10))
          .order('fecha', { ascending: true }),
        supabase.from('bicicletas').select('*')
      ])

      setEntrenamientos(ents || [])
      setBicicletas(bicis || [])
      setCargando(false)
    }
    cargar()
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

  if (cargando) {
    return <p className="text-ink-muted text-sm">Cargando panel…</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Panel</h1>
        <p className="text-ink-muted text-sm mt-1">Resumen de tu actividad</p>
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
      </div>

      <PMCChart data={serie} />

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
