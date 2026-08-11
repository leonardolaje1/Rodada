// Motor de insights basado en reglas explícitas (sin IA).
//
// El objetivo de este archivo es que, el día que conectemos un modelo de
// lenguaje (Gemini u otro) para generar estas recomendaciones, el resto de
// la app no tenga que cambiar nada: alcanza con reemplazar el cuerpo de
// `generarInsightRecuperacion` por una llamada a la IA que devuelva el mismo
// "contrato" de salida:
//
//   { nivel: 'optimo' | 'atencion' | 'critico', señales: string[], mensaje: string, fuente: 'reglas' | 'ia' }
//
// Mientras tanto, todo corre localmente, gratis e instantáneo.

function promedio(valores) {
  const limpio = valores.filter((v) => v != null && !isNaN(v))
  if (limpio.length === 0) return null
  return limpio.reduce((a, b) => a + b, 0) / limpio.length
}

export function generarInsightRecuperacion({ tsb, atl, historialAtl, hrvActual, historialHrv, sueñoUltimaNoche }) {
  const señales = []
  let nivel = 'optimo'

  const atlPromedio = promedio(historialAtl || [])
  const hrvPromedio = promedio(historialHrv || [])

  const atlPorEncima = atlPromedio != null && atl != null && atl > atlPromedio
  const hrvPorDebajo = hrvPromedio != null && hrvActual != null && hrvActual < hrvPromedio * 0.9

  // Regla 1 — fatiga elevada compuesta: varias señales alineadas a la vez
  if (tsb != null && tsb < -20 && atlPorEncima && hrvPorDebajo) {
    nivel = 'critico'
    señales.push('TSB muy negativo, tu carga reciente (ATL) está por encima de tu promedio, y tu HRV está por debajo de lo habitual')
  }
  // Regla 2 — TSB solo, como respaldo si no hay suficiente historial de ATL/HRV
  else if (tsb != null && tsb < -25) {
    nivel = 'critico'
    señales.push('Fatiga acumulada muy alta (TSB por debajo de -25)')
  } else if (tsb != null && tsb < -10) {
    nivel = 'atencion'
    señales.push('TSB bajo — zona de precaución')
  }

  // Regla 3 — sueño de anoche, suma señal sin importar el nivel de TSB
  if (sueñoUltimaNoche != null && sueñoUltimaNoche < 6) {
    if (nivel === 'optimo') nivel = 'atencion'
    señales.push(`Dormiste ${sueñoUltimaNoche}h anoche — menos de lo recomendado`)
  }

  // Regla 4 — HRV bajo por sí solo, aunque el TSB todavía esté bien
  if (hrvPorDebajo && nivel === 'optimo') {
    nivel = 'atencion'
    señales.push('Tu HRV de hoy está por debajo de tu promedio reciente')
  }

  let mensaje
  if (nivel === 'critico') {
    mensaje = 'Varias señales indican fatiga alta — priorizá el descanso hoy.'
  } else if (nivel === 'atencion') {
    mensaje = 'Hay alguna señal de alerta — bajá un cambio de intensidad si podés.'
  } else {
    mensaje = 'Sin señales de alerta — buen día para exigir.'
  }

  return { nivel, señales, mensaje, fuente: 'reglas' }
}
