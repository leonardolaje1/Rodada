// Motor de aviso de hidratación reforzada — cruza la duración de la sesión
// planificada para mañana con el pronóstico de temperatura máxima. Mismo
// patrón que los otros motores: reglas explícitas, ninguna acción automática,
// solo un mensaje en texto.

const DURACION_LARGA_MIN = 90 // a partir de acá se considera salida "larga"
const TEMP_CALOR_C = 28 // a partir de acá se considera pronóstico de calor

export function detectarAvisoHidratacion({ duracionMananaMin, tempMaxManana }) {
  if (!duracionMananaMin || duracionMananaMin < DURACION_LARGA_MIN) return null
  if (tempMaxManana == null || tempMaxManana < TEMP_CALOR_C) return null

  return {
    duracionMin: duracionMananaMin,
    tempMax: tempMaxManana,
    mensaje: `Mañana tenés una salida de ${duracionMananaMin}' con máxima prevista de ${Math.round(tempMaxManana)}°. Reforzá la hidratación antes y durante — sumá electrolitos si vas a estar más de 2h afuera.`
  }
}
