export const DURACIONES_CURVA = [5, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600]

export function etiquetaDuracion(seg) {
  if (seg < 60) return `${seg}s`
  return `${seg / 60}min`
}

// Ventana deslizante O(n) por duración: para una serie de potencia (watts, ~1 muestra/seg),
// encuentra el mejor promedio sostenido para cada duración de DURACIONES_CURVA.
export function calcularMejoresPotencias(serie) {
  if (!Array.isArray(serie) || serie.length === 0) return []
  const n = serie.length
  const resultados = []

  for (const dur of DURACIONES_CURVA) {
    if (n < dur) continue
    let suma = 0
    for (let i = 0; i < dur; i++) suma += serie[i] || 0
    let mejor = suma
    for (let i = dur; i < n; i++) {
      suma += (serie[i] || 0) - (serie[i - dur] || 0)
      if (suma > mejor) mejor = suma
    }
    resultados.push({ duracion_seg: dur, watts: Math.round((mejor / dur) * 10) / 10 })
  }

  return resultados
}
