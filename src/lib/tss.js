const CTL_DAYS = 42
const ATL_DAYS = 7

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

export function calcularCargaDiaria(diasConTSS) {
  let ctl = 0
  let atl = 0
  const ctlFactor = 2 / (CTL_DAYS + 1)
  const atlFactor = 2 / (ATL_DAYS + 1)

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
    const fecha = cursor.toISOString().slice(0, 10)
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
