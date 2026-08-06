import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

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
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth())
  const [entrenamientos, setEntrenamientos] = useState([])
  const [competencias, setCompetencias] = useState([])
  const [mantenimientos, setMantenimientos] = useState([])
  const [planes, setPlanes] = useState([])
  const [diaSeleccionado, setDiaSeleccionado] = useState(null)
  const [cargando, setCargando] = useState(true)

  const { dias, inicioGrilla, finGrilla } = construirGrilla(anio, mes)

  async function cargar() {
    setCargando(true)
    const desde = aFecha(inicioGrilla)
    const hasta = aFecha(finGrilla)

    const [{ data: ents }, { data: comps }, { data: mants }, { data: pls }] = await Promise.all([
      supabase.from('entrenamientos').select('*').gte('fecha', desde).lte('fecha', hasta),
      supabase.from('competencias').select('*').gte('fecha', desde).lte('fecha', hasta),
      supabase.from('mantenimientos').select('*').gte('fecha', desde).lte('fecha', hasta),
      supabase.from('planes_entrenamiento').select('*').eq('activo', true)
    ])
    setEntrenamientos(ents || [])
    setCompetencias(comps || [])
    setMantenimientos(mants || [])
    setPlanes(pls || [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [anio, mes])

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
    const comps = competencias.filter((c) => c.fecha === fecha)
    const mants = mantenimientos.filter((m) => m.fecha === fecha)
    const sesionesPlanificadas = ents.length === 0
      ? planes.flatMap((p) => (p.sesiones || []).filter((s) => s.dia === diaSemanaId).map((s) => ({ ...s, planNombre: p.nombre })))
      : []
    return { ents, comps, mants, sesionesPlanificadas }
  }

  const infoSeleccionado = diaSeleccionado
    ? itemsDelDia(diaSeleccionado, DIA_POR_INDICE[new Date(diaSeleccionado + 'T12:00:00').getDay()])
    : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendario</h1>
          <p className="text-ink-muted text-sm mt-1">{MESES[mes]} {anio}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => cambiarMes(-1)} className="border border-asphalt-700 rounded-lg w-9 h-9 text-ink-muted">‹</button>
          <button onClick={irAHoy} className="border border-asphalt-700 rounded-lg px-3 text-sm text-ink-muted">Hoy</button>
          <button onClick={() => cambiarMes(1)} className="border border-asphalt-700 rounded-lg w-9 h-9 text-ink-muted">›</button>
        </div>
      </div>

      <div className="flex gap-3 text-[11px] text-ink-muted flex-wrap">
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-hiviz inline-block" /> Entrenamiento</span>
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-alert-red inline-block" /> Competencia</span>
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-route inline-block" /> Mantenimiento</span>
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full border border-ink-faint inline-block" /> Plan sugerido</span>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DIAS_CORTOS.map((d) => (
          <div key={d} className="text-center text-[10px] text-ink-faint uppercase pb-1">{d}</div>
        ))}

        {cargando ? (
          <div className="col-span-7 text-center text-ink-muted text-sm py-8">Cargando…</div>
        ) : (
          dias.map((dia) => {
            const { ents, comps, mants, sesionesPlanificadas } = itemsDelDia(dia.fecha, dia.diaSemanaId)
            const esHoy = dia.fecha === aFecha(hoy)
            const seleccionado = dia.fecha === diaSeleccionado
            return (
              <button
                key={dia.fecha}
                onClick={() => setDiaSeleccionado(dia.fecha === diaSeleccionado ? null : dia.fecha)}
                className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-start border transition-colors ${
                  seleccionado ? 'border-hiviz bg-asphalt-800' : 'border-asphalt-700'
                } ${dia.delMesActual ? '' : 'opacity-30'}`}
              >
                <span className={`text-xs ${esHoy ? 'text-hiviz font-bold' : 'text-ink'}`}>{dia.diaMes}</span>
                <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                  {ents.length > 0 && <i className="w-1.5 h-1.5 rounded-full bg-hiviz inline-block" />}
                  {comps.length > 0 && <i className="w-1.5 h-1.5 rounded-full bg-alert-red inline-block" />}
                  {mants.length > 0 && <i className="w-1.5 h-1.5 rounded-full bg-route inline-block" />}
                  {sesionesPlanificadas.length > 0 && <i className="w-1.5 h-1.5 rounded-full border border-ink-faint inline-block" />}
                </div>
              </button>
            )
          })
        )}
      </div>

      {diaSeleccionado && infoSeleccionado && (
        <div className="card">
          <span className="label-eyebrow">{diaSeleccionado}</span>

          {infoSeleccionado.ents.length === 0 && infoSeleccionado.comps.length === 0 && infoSeleccionado.mants.length === 0 && infoSeleccionado.sesionesPlanificadas.length === 0 ? (
            <p className="text-ink-muted text-sm mt-2">Sin nada registrado ni planificado este día.</p>
          ) : (
            <div className="flex flex-col gap-3 mt-3">
              {infoSeleccionado.ents.map((e) => (
                <div key={e.id} className="flex items-center gap-2">
                  <i className="w-2 h-2 rounded-full bg-hiviz inline-block flex-shrink-0" />
                  <p className="text-sm">{e.tipo}{e.ruta ? ` — ${e.ruta}` : ''} {e.km ? `· ${e.km} km` : ''}</p>
                </div>
              ))}
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
