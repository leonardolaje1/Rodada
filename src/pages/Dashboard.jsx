import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { construirSerieDiaria, calcularCargaDiaria, interpretarTSB } from '../lib/tss'
import PMCChart from '../components/PMCChart'

function StatCard({ label, value, unit, accent }) {
  return (
    <div className="bg-[#19191D] border border-[#242429] rounded-[16px] p-5">
      <p className="text-[11px] tracking-[0.14em] text-[#8A8A93] uppercase">{label}</p>
      <div className="flex items-baseline gap-2 mt-3">
        <span className="text-[32px] font-bold leading-none tracking-tight" style={{ color: accent || 'white' }}>
          {value}
        </span>
        {unit && <span className="text-[13px] text-[#8A8A93]">{unit}</span>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [entrenamientos, setEntrenamientos] = useState([])
  const [bicicletas, setBicicletas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [clima] = useState({ temp: 7, viento: 3, direccion: 'E' })

  const hoyStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const desde90Str = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 90)
    return d.toISOString().slice(0, 10)
  }, [])

  useEffect(() => {
    async function cargar() {
      const [{ data: ents }, { data: bicis }] = await Promise.all([
        supabase.from('entrenamientos').select('*').gte('fecha', desde90Str).order('fecha', { ascending: true }),
        supabase.from('bicicletas').select('*'),
      ])
      setEntrenamientos(ents || [])
      setBicicletas(bicis || [])
      setCargando(false)
    }
    cargar()
  }, [desde90Str])

  const serie = useMemo(() => {
    return calcularCargaDiaria(construirSerieDiaria(entrenamientos, desde90Str, hoyStr))
  }, [entrenamientos, desde90Str, hoyStr])

  const ultimo = serie[serie.length - 1] || { ctl: 0, atl: 0, tsb: 0 }
  const forma = useMemo(() => interpretarTSB(ultimo.tsb), [ultimo.tsb])

  const inicioSemana = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay())
    return d.toISOString().slice(0,10)
  }, [])

  const statsSemana = useMemo(() => {
    const sem = entrenamientos.filter(e => (e.fecha?.slice(0,10) || '') >= inicioSemana)
    const km = sem.reduce((a,e) => a + (e.km || 0), 0)
    const horas = sem.reduce((a,e) => a + (e.duracion_min || 0), 0) / 60
    return { km: km.toFixed(0), horas: horas.toFixed(1) }
  }, [entrenamientos, inicioSemana])

  if (cargando) return <div className="p-8 bg-[#0A0A0C] min-h-screen text-white">Cargando...</div>

  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Panel</h1>
          <p className="text-[#8A8A93] text-[14px] mt-1">Resumen de tu actividad</p>
        </div>
        <div className="bg-[#19191D] border border-[#242429] rounded-[14px] px-4 py-2.5 flex items-center gap-3">
          <span className="text-[#C4F135] text-[24px] font-bold leading-none">{clima.temp}°</span>
          <div className="text-right leading-none">
            <p className="text-[#8A8A93] text-[12px]">{clima.viento} km/h</p>
            <p className="text-[#5A5A63] text-[10px] mt-1 uppercase">{clima.direccion}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <StatCard label="Horas — Semana" value={statsSemana.horas} unit="h" />
        <StatCard label="Km — Semana" value={statsSemana.km} unit="km" />
        <StatCard label="CTL (Fitness)" value={ultimo.ctl} accent="#C4F135" />
        <StatCard label="ATL (Fatiga)" value={ultimo.atl} accent="#F45D5D" />
      </div>

      <div className="bg-[#19191D] border border-[#242429] rounded-[16px] p-5 mt-4">
        <p className="text-[11px] tracking-[0.14em] text-[#8A8A93] uppercase">Forma Actual (TSB)</p>
        <div className="flex items-center gap-3 mt-3">
          <span className="text-[32px] font-bold leading-none text-[#C4F135]">{ultimo.tsb}</span>
          <span className="text-[14px] text-[#8A8A93]">{forma.texto}</span>
        </div>
      </div>

      <div className="bg-[#19191D] border border-[#242429] rounded-[16px] p-5 mt-4">
        <div className="flex justify-between items-center mb-6">
          <p className="text-[11px] tracking-[0.14em] text-[#8A8A93] uppercase">Carga — 90 días</p>
          <div className="flex gap-4 text-[12px] text-[#8A8A93]">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#C4F135]"/> CTL</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#F45D5D]"/> ATL</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#5DA9FF]"/> TSB</span>
          </div>
        </div>
        <PMCChart data={serie} />
      </div>

      <div className="mt-10">
        <h2 className="text-[18px] font-semibold">Bicicletas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {bicicletas.map(b => (
            <Link key={b.id} to={`/bicicletas/${b.id}`} className="bg-[#19191D] border border-[#242429] rounded-[16px] p-5 flex justify-between items-center hover:border-[#C4F135]/50 transition">
              <div>
                <p className="font-semibold">{b.nombre}</p>
                <p className="text-[#8A8A93] text-[12px] uppercase mt-1">{b.modelo || 'S-WORKS SL8'}</p>
              </div>
              <span className="text-[#8A8A93] text-[14px]">{b.km_totales || 0} km</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
