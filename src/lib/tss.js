import { aFechaLocal } from './fechas'

export const CTL_DAYS = 42
export const ATL_DAYS = 7

// Factores de la media móvil exponencial. Se exportan para que cualquier
// proyección use exactamente la misma dinámica que calcularCargaDiaria(),
// en vez de reinventar una aproximación propia.
export const CTL_FACTOR = 2 / (CTL_DAYS + 1)
export const ATL_FACTOR = 2 / (ATL_DAYS + 1)

export function calcularTSS({ tss, duracion_min, if: intensityFactor, rpe }) {
  if (tss != null) return tss
  if (duracion_min == null) return 0

  if (intensityFactor != null) {
    return Math.round((duracion_min * intensityFactor ** 2) / 60 * 100)
  }
  if (rpe != null) {
    return Math.round(duracion_min * (rpe / 10) * 1.5)
  }
  return 0
}

// `semilla` permite arrancar la EMA con un CTL/ATL previo en vez de cero.
// Sin ella, la serie siempre parte de 0 en el borde de la ventana: las
// primeras ~6 semanas quedan con CTL subestimado y, por lo tanto, TSB
// inflado — y el mismo día mostraba distinto TSB según el rango elegido.
// Ver calcularCargaConWarmup() más abajo, que es la forma recomendada de
// consumir esto desde las páginas.
export function calcularCargaDiaria(diasConTSS, semilla = { ctl: 0, atl: 0 }) {
  let ctl = Number(semilla?.ctl) || 0
  let atl = Number(semilla?.atl) || 0
  const ctlFactor = CTL_FACTOR
  const atlFactor = ATL_FACTOR

  return diasConTSS.map((dia) => {
    ctl = ctl + ctlFactor * (dia.tss - ctl)
    atl = atl + atlFactor * (dia.tss - atl)
    const tsb = ctl - atl
    return {
      ...dia,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round(tsb * 10) / 10
    }
  })
}

export function construirSerieDiaria(entrenamientos, rangoInicio, rangoFin) {
  const tssPorDia = {}
  for (const e of entrenamientos) {
    const fecha = e.fecha.slice(0, 10)
    tssPorDia[fecha] = (tssPorDia[fecha] || 0) + calcularTSS(e)
  }

  const serie = []
  const cursor = new Date(rangoInicio)
  const fin = new Date(rangoFin)
  while (cursor <= fin) {
    const fecha = aFechaLocal(cursor)
    serie.push({ fecha, tss: tssPorDia[fecha] || 0 })
    cursor.setDate(cursor.getDate() + 1)
  }
  return serie
}

export function interpretarTSB(tsb) {
  if (tsb > 20) return { texto: 'Muy fresco — quizás perdiendo forma', color: 'route' }
  if (tsb >= 5) return { texto: 'Fresco, listo para exigir', color: 'hiviz' }
  if (tsb >= -10) return { texto: 'Zona de entrenamiento óptima', color: 'hiviz' }
  if (tsb >= -30) return { texto: 'Fatiga acumulada — controlar', color: 'amber' }
  return { texto: 'Riesgo de sobreentrenamiento', color: 'red' }
}

// Cuántos días de historial previo hacen falta para que la EMA de CTL llegue
// "cargada" al primer día visible. Con 3 constantes de tiempo (3 × 42) el
// error remanente respecto de la serie completa es < 5%.
export const DIAS_WARMUP = CTL_DAYS * 3

// Forma recomendada de calcular la curva PMC para mostrar en pantalla.
//
// Recibe TODOS los entrenamientos disponibles y el rango que se quiere
// mostrar. Internamente calcula la EMA desde `DIAS_WARMUP` días antes del
// inicio visible y recién ahí recorta, así el CTL/ATL del primer día visible
// ya viene con la historia real del atleta incorporada en vez de arrancar
// en cero.
export function calcularCargaConWarmup(entrenamientos, rangoInicio, rangoFin, diasWarmup = DIAS_WARMUP) {
  const inicioWarmup = aFechaLocal(
    new Date(new Date(`${rangoInicio}T12:00:00`).getTime() - diasWarmup * 86400000)
  )
  const serieCompleta = calcularCargaDiaria(
    construirSerieDiaria(entrenamientos, inicioWarmup, rangoFin)
  )
  return serieCompleta.filter((d) => d.fecha >= rangoInicio)
}

// Proyecta CTL/ATL/TSB hacia adelante aplicando la MISMA EMA que
// calcularCargaDiaria(), asumiendo un TSS diario constante de aquí en más.
//
//   tssDiario = 0    -> escenario de reposo total (cota optimista)
//   tssDiario = ctl  -> "si seguís con tu carga habitual" (el CTL es, por
//                       definición, el TSS/día promedio de las últimas semanas)
//
// Con TSS 0 el ATL decae ~25% por día y el CTL ~4.7% por día.
export function proyectarCarga({ ctl = 0, atl = 0 }, dias, tssDiario = 0) {
  let ctlProy = Number(ctl) || 0
  let atlProy = Number(atl) || 0
  const tss = Number(tssDiario) || 0
  for (let i = 0; i < Math.max(0, dias); i++) {
    ctlProy = ctlProy + CTL_FACTOR * (tss - ctlProy)
    atlProy = atlProy + ATL_FACTOR * (tss - atlProy)
  }
  return {
    ctl: Math.round(ctlProy * 10) / 10,
    atl: Math.round(atlProy * 10) / 10,
    tsb: Math.round((ctlProy - atlProy) * 10) / 10
  }
}

// Atajo para el escenario de reposo total.
export function proyectarCargaSinEntrenar(estado, dias) {
  return proyectarCarga(estado, dias, 0)
}
