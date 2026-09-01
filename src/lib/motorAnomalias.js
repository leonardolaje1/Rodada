// Motor de detección de anomalías por comparación histórica — sin IA, con
// una comparación estadística simple (promedio móvil). Mismo patrón que los
// otros motores: reglas explícitas, ninguna acción automática.

import { aFechaLocal } from './fechas'

const SEMANAS_COMPARACION = 4
const CAIDA_PCT_AVISO = 30 // % de caída respecto al promedio para avisar
const TSS_MINIMO_PARA_COMPARAR = 50 // con promedio anterior muy bajo, comparar no tiene sentido

function inicioSemana(fechaStr) {
  const d = new Date(fechaStr + 'T12:00:00')
  const delta = (d.getDay() + 6) % 7 // días transcurridos desde el lunes
  d.setDate(d.getDate() - delta)
  return d
}

function tssEnRango(entrenamientos, desde, hasta) {
  const desdeStr = aFechaLocal(desde)
  const hastaStr = aFechaLocal(hasta)
  return entrenamientos
    .filter((e) => e.fecha >= desdeStr && e.fecha <= hastaStr)
    .reduce((a, e) => a + (Number(e.tss) || 0), 0)
}

// Compara la carga acumulada esta semana (de lunes a hoy) contra el promedio
// del mismo tramo parcial (lunes a "hoy" de esa semana) en las últimas N
// semanas — comparación pareja, así no da falso positivo un lunes o martes.
export function detectarCaidaCargaSemanal({ entrenamientos = [], fechaHoy }) {
  const hoy = new Date(fechaHoy + 'T12:00:00')
  const diasTranscurridos = (hoy.getDay() + 6) % 7 // 0 = lunes
  if (diasTranscurridos < 2) return null // muy pronto en la semana para comparar

  const inicioActual = inicioSemana(fechaHoy)
  const tssSemanaActual = tssEnRango(entrenamientos, inicioActual, hoy)

  let sumaAnteriores = 0
  for (let i = 1; i <= SEMANAS_COMPARACION; i++) {
    const inicioSemanaAnt = new Date(inicioActual)
    inicioSemanaAnt.setDate(inicioSemanaAnt.getDate() - 7 * i)
    const finParcial = new Date(inicioSemanaAnt)
    finParcial.setDate(finParcial.getDate() + diasTranscurridos)
    sumaAnteriores += tssEnRango(entrenamientos, inicioSemanaAnt, finParcial)
  }
  const promedioAnterior = sumaAnteriores / SEMANAS_COMPARACION
  if (promedioAnterior < TSS_MINIMO_PARA_COMPARAR) return null

  const caidaPct = Math.round(((promedioAnterior - tssSemanaActual) / promedioAnterior) * 100)
  if (caidaPct < CAIDA_PCT_AVISO) return null

  return {
    tssSemanaActual: Math.round(tssSemanaActual),
    promedioAnterior: Math.round(promedioAnterior),
    caidaPct,
    mensaje: `Tu carga esta semana (${Math.round(tssSemanaActual)} TSS hasta hoy) está ${caidaPct}% por debajo de tu promedio de las últimas ${SEMANAS_COMPARACION} semanas a esta altura (${Math.round(promedioAnterior)} TSS).`
  }
}
