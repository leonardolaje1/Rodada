// Detecta automáticamente la fase de cada semana de un mesociclo (base,
// construcción, específico/pico, descarga) a partir de las sesiones
// PLANIFICADAS — no las realizadas. Mismo patrón que los otros motores:
// reglas explícitas, nunca reemplaza la elección manual del usuario (el
// campo "tipo" del mesociclo de ciclismo sigue siendo suyo), solo la
// complementa con una lectura semana a semana. Cubre ciclismo y gimnasio,
// cada uno con su propia forma de estimar intensidad.
//
// A diferencia de mirar solo el volumen total, cruza dos ejes — igual que
// haría un entrenador: cuánto volumen hay y qué tan intensas son las
// sesiones. Una semana puede tener menos horas (o menos series) que otra y
// aun así ser la más exigente si concentra el trabajo más intenso.

import { ZONAS_POTENCIA } from './zonas'

const UMBRAL_INTENSIDAD_ALTA = 0.20 // 20%+ del tiempo/series en zona alta cuenta como semana "intensa"
const UMBRAL_DESCARGA = 0.6 // por debajo del 60% de la carga máxima del bloque, se considera descarga
const UMBRAL_CONSTRUCCION = 0.85 // 85%+ de la carga máxima, sin ser especialmente intensa, es construcción
const UMBRAL_INTENSIDAD_ALTA_GYM = 0.85 // ≥85% de 1RM estimado (o equivalente) cuenta como serie de alta intensidad

export const FASES_INFO = {
  base: { label: 'Base', color: '#4A9EFF' },
  construccion: { label: 'Construcción', color: '#C4F135' },
  pico: { label: 'Específico / Pico', color: '#F14A4A' },
  descarga: { label: 'Descarga', color: '#8A8F9C' },
  sin_datos: { label: 'Sin sesiones cargadas', color: '#4A5561' }
}

function clamp(x, min, max) { return Math.max(min, Math.min(max, x)) }

// Clasifica un array de resúmenes semanales {carga, pctAltaIntensidad}
// comparándolos entre sí — no contra un umbral fijo, porque la escala de
// carga de cada plan (o cada atleta) es distinta. Compartido por ciclismo y
// gimnasio: una vez reducido a estos dos números, el criterio es el mismo.
function clasificarFases(resumenes) {
  const cargaMax = Math.max(...resumenes.map((r) => r.carga), 0)

  return resumenes.map((r) => {
    if (!r.carga) return { fase: 'sin_datos', cargaRelativa: 0, pctAltaIntensidad: 0, carga: 0 }

    const cargaRelativa = cargaMax > 0 ? r.carga / cargaMax : 0
    const esAltaIntensidad = r.pctAltaIntensidad >= UMBRAL_INTENSIDAD_ALTA

    let fase
    if (cargaRelativa < UMBRAL_DESCARGA) fase = 'descarga'
    else if (esAltaIntensidad) fase = 'pico' // volumen medio/alto + buena parte en zona alta: específico o pico, no base
    else if (cargaRelativa >= UMBRAL_CONSTRUCCION) fase = 'construccion'
    else fase = 'base'

    return {
      fase,
      cargaRelativa: Math.round(cargaRelativa * 100),
      pctAltaIntensidad: Math.round(r.pctAltaIntensidad * 100),
      carga: Math.round(r.carga)
    }
  })
}

// ---------- Ciclismo ----------

// Punto medio de %FTP de la zona, para estimar intensidad relativa de una
// sesión sin necesitar el FTP real — todo se mueve en % de FTP.
function intensidadRelativaCiclismo(zonaId) {
  const z = ZONAS_POTENCIA.find((zz) => zz.zona === zonaId)
  if (!z) return 0.65 // sin zona especificada, se asume algo tipo Z2 — lo más común en un plan
  const hasta = z.hasta ?? z.desde + 0.3 // Z7 no tiene techo definido, se le da un margen razonable
  return (z.desde + hasta) / 2
}

// "TSS planificado" proxy por sesión — misma fórmula que calcularTSS() en
// tss.js (duración × intensidad² × 100), pero con la intensidad objetivo en
// vez de la real, porque la sesión todavía no se hizo.
function cargaPlanificadaSesion(sesion) {
  const minutos = Number(sesion.duracion_min) || 0
  if (!minutos) return { carga: 0, minutos: 0, minutosAltaIntensidad: 0 }
  const intensidad = intensidadRelativaCiclismo(sesion.zona_objetivo)
  const carga = (minutos / 60) * intensidad * intensidad * 100
  const minutosAltaIntensidad = intensidad >= 0.91 ? minutos : 0 // Z4 (umbral) o más
  return { carga, minutos, minutosAltaIntensidad }
}

function resumenSemanaCiclismo(sesiones) {
  let carga = 0
  let minutosTotales = 0
  let minutosAltaIntensidad = 0
  for (const s of sesiones || []) {
    const r = cargaPlanificadaSesion(s)
    carga += r.carga
    minutosTotales += r.minutos
    minutosAltaIntensidad += r.minutosAltaIntensidad
  }
  return { carga, pctAltaIntensidad: minutosTotales > 0 ? minutosAltaIntensidad / minutosTotales : 0 }
}

// Recibe un array de semanas, cada una con su lista de sesiones planificadas
// activas ({ duracion_min, zona_objetivo }). Devuelve la fase de cada una.
export function detectarFasesMesociclo(semanasSesiones) {
  return clasificarFases((semanasSesiones || []).map(resumenSemanaCiclismo))
}

// ---------- Gimnasio ----------
//
// A diferencia del ciclismo (zonas de potencia con un %FTP fijo por zona),
// en gimnasio la intensidad depende del método de prescripción elegido para
// cada ejercicio. Se normaliza todo a un %1RM aproximado:
// - "% de 1RM": el valor cargado ya es directamente el %1RM.
// - "RPE" / "RIR": aproximación lineal simple (no la tabla real de Helms,
//   que requeriría más contexto) — sirve para comparar semanas entre sí,
//   no como referencia exacta de prescripción.
// - "Peso fijo", "Otro" o sin método: sin el 1RM real del atleta para ese
//   ejercicio no hay forma de saber qué tan exigente es un peso absoluto,
//   así que se asume una intensidad media fija. La comparación entre
//   semanas sigue siendo válida por el lado del volumen, aunque pierde
//   precisión en el eje de intensidad para esos ejercicios puntuales.
function intensidadRelativaGimnasio(metodo, valor) {
  const v = parseFloat(valor)
  if (metodo === '% de 1RM' && !isNaN(v)) return clamp(v / 100, 0, 1.2)
  if (metodo === 'RPE' && !isNaN(v)) return clamp(0.5 + v * 0.05, 0.5, 1) // RPE 10 ≈ 100%, RPE 5 ≈ 75%
  if (metodo === 'RIR' && !isNaN(v)) return clamp(0.5 + (10 - v) * 0.05, 0.5, 1) // RIR se traduce a su RPE equivalente
  return 0.75
}

function resumenSemanaGimnasio(items) {
  let carga = 0
  let seriesTotales = 0
  let seriesAltaIntensidad = 0
  for (const it of items || []) {
    const series = Number(it.series) || 0
    const reps = Number(it.reps) || 0
    if (!series || !reps) continue
    const intensidad = intensidadRelativaGimnasio(it.metodo, it.valor)
    // Volumen relativo de carga (series × reps × intensidad) — a diferencia
    // del proxy de ciclismo, sin elevar al cuadrado: en fuerza, el volumen
    // de entrenamiento estándar (tonelaje relativo) es lineal, no cuadrático.
    carga += series * reps * intensidad
    seriesTotales += series
    if (intensidad >= UMBRAL_INTENSIDAD_ALTA_GYM) seriesAltaIntensidad += series
  }
  return { carga, pctAltaIntensidad: seriesTotales > 0 ? seriesAltaIntensidad / seriesTotales : 0 }
}

// Recibe la plantilla "dias" del formulario de armado (días de la semana,
// cada uno con sus ejercicios y, por ejercicio, un array de 4 semanas con
// {series, reps, valor}). Devuelve la fase de cada una de las 4 semanas.
export function detectarFasesMesocicloGimnasio(dias) {
  const resumenes = [0, 1, 2, 3].map((semanaIdx) => {
    const items = []
    for (const dia of dias || []) {
      if (!dia.activo) continue
      for (const ej of dia.ejercicios || []) {
        const p = ej.porSemana?.[semanaIdx]
        if (p) items.push({ series: p.series, reps: p.reps, metodo: ej.metodo, valor: p.valor })
      }
    }
    return resumenSemanaGimnasio(items)
  })
  return clasificarFases(resumenes)
}

// Recibe un array de 4 arrays (uno por semana) de filas ya materializadas
// ({ series, reps, metodo_prescrito, valor_prescrito }). Mismo cálculo que
// la versión de arriba, pero sobre lo que realmente quedó guardado.
export function detectarFasesMesocicloGimnasioDesdeFilas(filasPorSemana) {
  const resumenes = (filasPorSemana || []).map((filas) =>
    resumenSemanaGimnasio((filas || []).map((f) => ({
      series: f.series,
      reps: f.reps,
      metodo: f.metodo_prescrito,
      valor: f.valor_prescrito // parseFloat interno toma el primer número, ignora notas tipo " · series 3-4"
    })))
  )
  return clasificarFases(resumenes)
}
