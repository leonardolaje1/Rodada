// Utilidades de fecha en zona horaria LOCAL del dispositivo.
//
// Por qué existe este archivo: durante mucho tiempo la app calculó "hoy" con
// `new Date()` + `toISOString().slice(0, 10)`. `toISOString()` devuelve SIEMPRE
// UTC, así que en Argentina (UTC-3) entre las 21:00 y la medianoche la app
// creía que ya era el día siguiente. Consecuencias reales:
//   - un entrenamiento cargado a las 22:00 quedaba guardado con la fecha de
//     mañana (dato corrupto en la base, no solo en pantalla);
//   - "gimnasio pendiente hoy", "comidas de hoy" y "falta recuperación hoy"
//     consultaban el día equivocado;
//   - los rangos `.gte('fecha', ...)` se corrían un día.
//
// Toda la app usa fechas "date-only" (YYYY-MM-DD, sin hora) para lo que el
// atleta percibe como un día de calendario. Estas funciones son la única
// forma correcta de producir y consumir esas cadenas.

// Formatea un Date (o algo parseable a Date) como YYYY-MM-DD usando los
// componentes LOCALES, nunca UTC. Sin argumentos devuelve el día de hoy.
export function aFechaLocal(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  if (isNaN(d.getTime())) return null
  const anio = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

// El día de hoy según el reloj del dispositivo. Reemplaza a
// `hoyLocal()` en toda la app.
export function hoyLocal() {
  return aFechaLocal(new Date())
}

// Convierte una fecha YYYY-MM-DD en un Date anclado al MEDIODÍA local.
// El mediodía evita que sumar/restar días cruce de día por el horario de
// verano (donde exista) o por redondeos de zona horaria.
export function aDateLocal(fechaStr) {
  if (!fechaStr) return null
  const d = new Date(`${fechaStr}T12:00:00`)
  return isNaN(d.getTime()) ? null : d
}

// Suma (o resta, con negativo) días a una fecha YYYY-MM-DD y devuelve otra
// fecha YYYY-MM-DD. Nunca muta el argumento.
export function sumarDiasLocal(fechaStr, dias) {
  const d = aDateLocal(fechaStr)
  if (!d) return null
  d.setDate(d.getDate() + dias)
  return aFechaLocal(d)
}

// Atajo para los rangos del tipo `.gte('fecha', hace(90))`.
export function hace(dias) {
  return sumarDiasLocal(hoyLocal(), -dias)
}

// Lunes de la semana a la que pertenece la fecha (semana lunes-domingo).
export function inicioSemanaLocal(fechaStr = hoyLocal()) {
  const d = aDateLocal(fechaStr)
  if (!d) return null
  const delta = (d.getDay() + 6) % 7 // 0 = lunes
  d.setDate(d.getDate() - delta)
  return aFechaLocal(d)
}

// Días calendario entre dos fechas YYYY-MM-DD (b - a). Positivo si b es
// posterior. Ambas se anclan al mediodía, así que no hay errores de ±1.
export function diasEntreLocal(fechaA, fechaB) {
  const a = aDateLocal(fechaA)
  const b = aDateLocal(fechaB)
  if (!a || !b) return null
  return Math.round((b - a) / 86400000)
}
