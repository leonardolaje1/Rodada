// Motor de detección de oportunidades de calendario — mismo patrón que
// motorConflictos.js y motorInsights.js: reglas explícitas hoy, reemplazables
// por IA más adelante sin tocar el resto de la app.
//
// REGLA DE PRODUCTO (dura, no negociable): HELU nunca modifica un
// entrenamiento automáticamente. Este motor solo devuelve una sugerencia en
// texto — aplicarla siempre requiere que el atleta la cargue a mano en
// Entrenamientos. No expone ninguna acción de "aplicar" ni de escritura.

const ZONAS_BAJA_INTENSIDAD = ['Z1', 'Z2']
const DURACION_MAXIMA_PARA_SUGERIR = 120 // min — por arriba de esto no tiene sentido sugerir extender
const FACTOR_EXTENSION = 1.5

// Detecta si, dada la recuperación actual del atleta, la sesión de mañana
// (si es de baja intensidad y todavía está pendiente) representa una
// oportunidad para sumar volumen sin comprometer el objetivo del bloque.
export function detectarOportunidadCalendario({ nivelRecuperacion, entrenamientoManana, fechaManana }) {
  if (nivelRecuperacion !== 'optimo') return null
  if (!entrenamientoManana) return null
  if (entrenamientoManana.estado && entrenamientoManana.estado !== 'pendiente') return null
  if (!ZONAS_BAJA_INTENSIDAD.includes(entrenamientoManana.zona_objetivo)) return null
  if (!entrenamientoManana.duracion_min || entrenamientoManana.duracion_min >= DURACION_MAXIMA_PARA_SUGERIR) return null

  const duracionSugerida = Math.round((entrenamientoManana.duracion_min * FACTOR_EXTENSION) / 5) * 5
  if (duracionSugerida <= entrenamientoManana.duracion_min) return null

  return {
    id: `oportunidad-${fechaManana}`,
    fecha: fechaManana,
    tipo: 'extension_disponible',
    zona: entrenamientoManana.zona_objetivo,
    duracionActual: entrenamientoManana.duracion_min,
    duracionSugerida,
    mensaje: `Tenés buena disponibilidad y recuperación. Podrías extender la sesión hasta ${duracionSugerida} min si es compatible con tu objetivo.`,
    fuente: 'reglas'
  }
}
