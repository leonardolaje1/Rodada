import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import Skeleton from '../components/Skeleton'
import IconoInsignia from '../components/IconoInsignia'
import { detectarConflictosCalendario } from '../lib/motorConflictos'
import { detectarOportunidadCalendario } from '../lib/motorOportunidades'
import { construirSerieDiaria, calcularCargaDiaria } from '../lib/tss'
import { generarInsightRecuperacion } from '../lib/motorInsights'
import { useToast } from '../lib/ToastContext'
import { Calendar } from 'lucide-react'

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIA_POR_INDICE = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']

function aFecha(d) {
  return d.toISOString().slice(0, 10)
}

function construirGrilla(anio, mes) {
  const primerDia = new Date(anio, mes, 1)
  const ultimoDia = new Date(anio, mes + 1, 0)

  const inicioGrilla = new Date(primerDia)
  inicioGrilla.setDate(inicioGrilla.getDate() - inicioGrilla.getDay())

  const finGrilla = new Date(ultimoDia)
  finGrilla.setDate(finGrilla.getDate() + (6 - finGrilla.getDay()))

  const dias = []
  const cursor = new Date(inicioGrilla)
  while (cursor <= finGrilla) {
    dias.push({
      fecha: aFecha(cursor),
      diaMes: cursor.getDate(),
      diaSemanaId: DIA_POR_INDICE[cursor.getDay()],
      delMesActual: cursor.getMonth() === mes
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return { dias, inicioGrilla, finGrilla }
}

export default function Calendario() {
  const toast = useToast()
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth())
  const [entrenamientos, setEntrenamientos] = useState([])
  const [gimnasio, setGimnasio] = useState([])
  const [competencias, setCompetencias] = useState([])
  const [mantenimientos, setMantenimientos] = useState([])
  const [planes, setPlanes] = useState([])
  const [planesGym, setPlanesGym] = useState([])
  const [diaSeleccionado, setDiaSeleccionado] = useState(null)
  const [cargando, setCargando] = useState(true)

  // Datos para detectar oportunidades de mañana (independiente del mes que se esté mirando).
  const [entrenamientosHistorial, setEntrenamientosHistorial] = useState([])
  const [hrvActual, setHrvActual] = useState(null)
  const [historialHrv, setHistorialHrv] = useState([])
  const [sueñoUltimaNoche, setSueñoUltimaNoche] = useState(null)
  const [entrenamientoManana, setEntrenamientoManana] = useState(null)

  const { dias, inicioGrilla, finGrilla } = construirGrilla(anio, mes)

  async function cargar() {
    setCargando(true)
    const desde = aFecha(inicioGrilla)
    const hasta = aFecha(finGrilla)

    const [{ data: ents }, { data: gym }, { data: comps }, { data: mants }, { data: pls }, { data: plsGym }] = await Promise.all([
      supabase.from('entrenamientos').select('*').gte('fecha', desde).lte('fecha', hasta),
      supabase.from('gimnasio').select('*').gte('fecha', desde).lte('fecha', hasta),
      supabase.from('competencias').select('*').gte('fecha', desde).lte('fecha', hasta),
      supabase.from('mantenimientos').select('*').gte('fecha', desde).lte('fecha', hasta),
      supabase.from('planes_entrenamiento').select('*').eq('activo', true),
      supabase.from('planes_gimnasio').select('*').eq('activo', true)
    ])
    setEntrenamientos(ents || [])
    setGimnasio(gym || [])
    setCompetencias(comps || [])
    setMantenimientos(mants || [])
    setPlanes(pls || [])
    setPlanesGym(plsGym || [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [anio, mes])

  // Carga aparte, independiente del mes visible: recuperación actual +
  // entrenamiento de mañana, para la detección de oportunidades.
  useEffect(() => {
    async function cargarRecuperacion() {
      const hoyStr = aFecha(hoy)
      const manana = new Date(hoy); manana.setDate(manana.getDate() + 1)
      const mananaStr = aFecha(manana)
      const desde90 = new Date(hoy); desde90.setDate(desde90.getDate() - 90)

      const [{ data: entsHist }, { data: metricas }, { data: entManana }] = await Promise.all([
        supabase.from('entrenamientos').select('fecha, tss').gte('fecha', aFecha(desde90)).lte('fecha', hoyStr).order('fecha', { ascending: true }),
        supabase.from('metricas_diarias').select('fecha, hrv, sueño_horas').order('fecha', { ascending: false }).limit(8),
        supabase.from('entrenamientos').select('*').eq('fecha', mananaStr).limit(1).maybeSingle()
      ])
      setEntrenamientosHistorial(entsHist || [])
      const metricasOrdenadas = metricas || []
      setHrvActual(metricasOrdenadas[0]?.hrv ?? null)
      setHistorialHrv(metricasOrdenadas.slice(1).map((m) => m.hrv))
      setSueñoUltimaNoche(metricasOrdenadas[0]?.sueño_horas ?? null)
      setEntrenamientoManana(entManana || null)
    }
    cargarRecuperacion()
  }, [])

  async function aplicarSugerencia(conflicto) {
    const { tabla, fecha_origen, fecha_destino } = conflicto.sugerencia.mover
    const { error } = await supabase.from(tabla).update({ fecha: fecha_destino }).eq('fecha', fecha_origen).eq('estado', 'pendiente')
    if (error) { toast('No se pudo mover: ' + error.message); return }
    toast('Movido a ' + fecha_destino)
    cargar()
  }

  const conflictos = detectarConflictosCalendario({ entrenamientos, gimnasio })
  const conflictosPorFecha = {}
  for (const c of conflictos) { (conflictosPorFecha[c.fecha] ||= []).push(c) }

  const desde90 = new Date(hoy); desde90.setDate(desde90.getDate() - 90)
  const serieCarga = calcularCargaDiaria(construirSerieDiaria(entrenamientosHistorial, aFecha(desde90), aFecha(hoy)))
  const ultimaCarga = serieCarga[serieCarga.length - 1] || { tsb: 0, atl: 0 }
  const historialAtlSerie = serieCarga.slice(-43, -1).map((d) => d.atl)
  const insightRecuperacion = generarInsightRecuperacion({
    tsb: ultimaCarga.tsb, atl: ultimaCarga.atl, historialAtl: historialAtlSerie,
    hrvActual, historialHrv, sueñoUltimaNoche
  })
  const manana = new Date(hoy); manana.setDate(manana.getDate() + 1)
  const mananaStr = aFecha(manana)
  const oportunidad = detectarOportunidadCalendario({
    nivelRecuperacion: insightRecuperacion.nivel,
    entrenamientoManana,
    fechaManana: mananaStr
  })

  function cambiarMes(delta) {
    let nuevoMes = mes + delta
    let nuevoAnio = anio
    if (nuevoMes < 0) { nuevoMes = 11; nuevoAnio -= 1 }
    if (nuevoMes > 11) { nuevoMes = 0; nuevoAnio += 1 }
    setMes(nuevoMes)
    setAnio(nuevoAnio)
    setDiaSeleccionado(null)
  }

  function irAHoy() {
    setAnio(hoy.getFullYear())
    setMes(hoy.getMonth())
    setDiaSeleccionado(aFecha(hoy))
  }

  function itemsDelDia(fecha, diaSemanaId) {
    const ents = entrenamientos.filter((e) => e.fecha === fecha)
    const gyms = gimnasio.filter((g) => g.fecha === fecha)
    const comps = competencias.filter((c) => c.fecha === fecha)
    const mants = mantenimientos.filter((m) => m.fecha === fecha)
    const sesionesPlanificadas = ents.length === 0
      ? planes.flatMap((p) => (p.sesiones || []).filter((s) => s.dia === diaSemanaId).map((s) => ({ ...s, planNombre: p.nombre })))
      : []
    const gymPlanificado = gyms.length === 0 && planesGym.some((p) => (p.dias_semana || []).includes(diaSemanaId))
    return { ents, gyms, comps, mants, sesionesPlanificadas, gymPlanificado }
  }

  const infoSeleccionado = diaSeleccionado
    ? itemsDelDia(diaSeleccionado, DIA_POR_INDICE[new Date(diaSeleccionado + 'T12:00:00').getDay()])
    : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconoInsignia Icono={Calendar} />
          <div>
            <h1 className="text-2xl font-bold">Calendario</h1>
            <p className="text-ink-muted text-sm mt-1">{MESES[mes]} {anio}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => cambiarMes(-1)} className="border border-asphalt-700 rounded-lg w-9 h-9 text-ink-muted">‹</button>
          <button onClick={irAHoy} className="border border-asphalt-700 rounded-lg px-3 text-sm text-ink-muted">Hoy</button>
          <button onClick={() => cambiarMes(1)} className="border border-asphalt-700 rounded-lg w-9 h-9 text-ink-muted">›</button>
        </div>
      </div>

      <div className="flex gap-3 text-[11px] text-ink-muted flex-wrap">
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-hiviz inline-block" /> Entrenamiento</span>
        <span className="flex items-center gap-1" style={{ color: undefined }}><i className="w-2 h-2 rounded-full inline-block" style={{ background: '#C34AF1' }} /> Gimnasio</span>
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-alert-red inline-block" /> Competencia</span>
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-route inline-block" /> Mantenimiento</span>
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full border border-ink-faint inline-block" /> Plan sugerido</span>
        <span className="flex items-center gap-1 text-alert-amber">⚠️ Posible conflicto</span>
        <span className="flex items-center gap-1 text-hiviz">🟢 Oportunidad</span>
      </div>

      {oportunidad && (
        <div className="card border-hiviz">
          <span className="text-hiviz font-semibold text-sm">🟢 Buena recuperación</span>
          <p className="text-ink-muted text-xs mt-1">
            Mañana: {oportunidad.zona} · {oportunidad.duracionActual}'
          </p>
          <div className="mt-2.5 pt-2.5 border-t border-asphalt-700">
            <span className="label-eyebrow text-hiviz">Oportunidad</span>
            <p className="text-sm mt-1">{oportunidad.mensaje}</p>
            <Link to="/entrenamientos" className="text-hiviz text-xs mt-2 inline-block">Ajustar manualmente en Entrenamientos →</Link>
          </div>
        </div>
      )}

      {conflictos.length > 0 && (
        <div className="flex flex-col gap-2">
          {conflictos.map((c) => (
            <div key={c.id} className="card border-alert-amber">
              <span className="label-eyebrow text-alert-amber">⚠️ Posible conflicto</span>
              <p className="text-sm mt-1.5">{c.mensaje}</p>
              {c.sugerencia && (
                <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-asphalt-700">
                  <p className="text-ink-muted text-xs">{c.sugerencia.texto}</p>
                  <button onClick={() => aplicarSugerencia(c)} className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg whitespace-nowrap ml-2">Aplicar sugerencia</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-7 gap-1">
        {DIAS_CORTOS.map((d) => (
          <div key={d} className="text-center text-[10px] text-ink-faint uppercase pb-1">{d}</div>
        ))}

                {cargando ? (
          Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))
        ) : (
      
          dias.map((dia) => {
            const { ents, gyms, comps, mants, sesionesPlanificadas, gymPlanificado } = itemsDelDia(dia.fecha, dia.diaSemanaId)
            const esHoy = dia.fecha === aFecha(hoy)
            const seleccionado = dia.fecha === diaSeleccionado
            const tieneConflicto = !!conflictosPorFecha[dia.fecha]
            return (
              <button
                key={dia.fecha}
                onClick={() => setDiaSeleccionado(dia.fecha === diaSeleccionado ? null : dia.fecha)}
                className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-start border transition-colors relative ${
                  seleccionado ? 'border-hiviz bg-asphalt-800' : tieneConflicto ? 'border-alert-amber' : 'border-asphalt-700'
                } ${dia.delMesActual ? '' : 'opacity-30'}`}
              >
                {tieneConflicto && <span className="absolute top-0.5 right-0.5 text-[9px]">⚠️</span>}
                <span className={`text-xs ${esHoy ? 'text-hiviz font-bold' : 'text-ink'}`}>{dia.diaMes}</span>
                <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                  {ents.length > 0 && <i className="w-1.5 h-1.5 rounded-full bg-hiviz inline-block" />}
                  {gyms.length > 0 && <i className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#C34AF1' }} />}
                  {comps.length > 0 && <i className="w-1.5 h-1.5 rounded-full bg-alert-red inline-block" />}
                  {mants.length > 0 && <i className="w-1.5 h-1.5 rounded-full bg-route inline-block" />}
                  {(sesionesPlanificadas.length > 0 || gymPlanificado) && <i className="w-1.5 h-1.5 rounded-full border border-ink-faint inline-block" />}
                </div>
              </button>
            )
          })
        )}
      </div>

      {diaSeleccionado && infoSeleccionado && (
        <div className="card">
          <span className="label-eyebrow">{diaSeleccionado}</span>

          {conflictosPorFecha[diaSeleccionado] && (
            <div className="flex flex-col gap-2 mt-2.5">
              {conflictosPorFecha[diaSeleccionado].map((c) => (
                <div key={c.id} className="border border-alert-amber rounded-lg p-2.5">
                  <p className="text-alert-amber text-xs font-semibold">⚠️ Posible conflicto</p>
                  <p className="text-sm mt-1">{c.mensaje}</p>
                  {c.sugerencia && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-asphalt-700">
                      <p className="text-ink-muted text-xs">{c.sugerencia.texto}</p>
                      <button onClick={() => aplicarSugerencia(c)} className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg whitespace-nowrap ml-2">Aplicar sugerencia</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {infoSeleccionado.ents.length === 0 && infoSeleccionado.gyms.length === 0 && infoSeleccionado.comps.length === 0 && infoSeleccionado.mants.length === 0 && infoSeleccionado.sesionesPlanificadas.length === 0 && !infoSeleccionado.gymPlanificado ? (
            <p className="text-ink-muted text-sm mt-2">Sin nada registrado ni planificado este día.</p>
          ) : (
            <div className="flex flex-col gap-3 mt-3">
              {infoSeleccionado.ents.map((e) => (
                <div key={e.id} className="flex items-center gap-2">
                  <i className="w-2 h-2 rounded-full bg-hiviz inline-block flex-shrink-0" />
                  <p className="text-sm">{e.tipo}{e.ruta ? ` — ${e.ruta}` : ''} {e.km ? `· ${e.km} km` : ''}</p>
                </div>
              ))}
              {infoSeleccionado.gyms.map((g) => (
                <div key={g.id} className="flex items-center gap-2">
                  <i className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: '#C34AF1' }} />
                  <p className="text-sm">{g.ejercicio}{g.estado === 'pendiente' ? ' · Pendiente' : g.peso ? ` · ${g.peso} kg` : ''}</p>
                </div>
              ))}
              {infoSeleccionado.gymPlanificado && (
                <div className="flex items-center gap-2">
                  <i className="w-2 h-2 rounded-full border border-ink-faint inline-block flex-shrink-0" />
                  <p className="text-sm text-ink-muted">Rutina de gimnasio planificada para hoy</p>
                </div>
              )}
              {infoSeleccionado.comps.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <i className="w-2 h-2 rounded-full bg-alert-red inline-block flex-shrink-0" />
                  <p className="text-sm">{c.nombre}{c.posicion ? ` · Puesto ${c.posicion}` : ''}</p>
                </div>
              ))}
              {infoSeleccionado.mants.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <i className="w-2 h-2 rounded-full bg-route inline-block flex-shrink-0" />
                  <p className="text-sm">{m.tipo}</p>
                </div>
              ))}
              {infoSeleccionado.sesionesPlanificadas.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <i className="w-2 h-2 rounded-full border border-ink-faint inline-block flex-shrink-0" />
                  <p className="text-sm text-ink-muted">
                    {s.tipo}{s.duracion_min ? ` — ${s.duracion_min} min` : ''} <span className="text-ink-faint">({s.planNombre})</span>
                  </p>
                </div>
              ))}
            </div>
          )}

          <Link to="/entrenamientos" className="text-hiviz text-xs mt-3 inline-block">Ir a Entrenamientos →</Link>
        </div>
      )}
    </div>
  )
}
