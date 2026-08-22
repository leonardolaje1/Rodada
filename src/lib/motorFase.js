// Detecta automáticamente la fase de cada semana de un mesociclo (base,
// construcción, específico/pico, descarga) a partir de las sesiones
// PLANIFICADAS — no las realizadas. Mismo patrón que los otros motores:
// reglas explícitas, nunca reemplaza la elección manual del usuario (el
// campo "tipo" del mesociclo sigue siendo suyo), solo la complementa con
// una lectura semana a semana.
//
// A diferencia de mirar solo el volumen total, cruza dos ejes — igual que
// haría un entrenador: cuánto volumen hay (duración) y qué tan intensas son
// las sesiones (zona objetivo). Una semana puede tener menos horas que otra
// y aun así ser la más exigente si concentra sesiones de umbral para arriba.

import { ZONAS_POTENCIA } from './zonas'

const UMBRAL_INTENSIDAD_ALTA = 0.20 // 20%+ del tiempo en Z4 (umbral) o más cuenta como semana "intensa"
const UMBRAL_DESCARGA = 0.6 // por debajo del 60% de la carga máxima del bloque, se considera descarga
const UMBRAL_CONSTRUCCION = 0.85 // 85%+ de la carga máxima, sin ser especialmente intensa, es construcción

export const FASES_INFO = {
  base: { label: 'Base', color: '#4A9EFF' },
  construccion: { label: 'Construcción', color: '#C4F135' },
  pico: { label: 'Específico / Pico', color: '#F14A4A' },
  descarga: { label: 'Descarga', color: '#8A8F9C' },
  sin_datos: { label: 'Sin sesiones cargadas', color: '#4A5561' }
}

// Punto medio de %FTP de la zona, para estimar intensidad relativa de una
// sesión sin necesitar el FTP real — todo se mueve en % de FTP.
function intensidadRelativa(zonaId) {
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
  const intensidad = intensidadRelativa(sesion.zona_objetivo)
  const carga = (minutos / 60) * intensidad * intensidad * 100
  const minutosAltaIntensidad = intensidad >= 0.91 ? minutos : 0 // Z4 (umbral) o más
  return { carga, minutos, minutosAltaIntensidad }
}

function resumenSemana(sesiones) {
  let carga = 0
  let minutosTotales = 0
  let minutosAltaIntensidad = 0
  for (const s of sesiones || []) {
    const r = cargaPlanificadaSesion(s)
    carga += r.carga
    minutosTotales += r.minutos
    minutosAltaIntensidad += r.minutosAltaIntensidad
  }
  return { carga, minutosTotales, pctAltaIntensidad: minutosTotales > 0 ? minutosAltaIntensidad / minutosTotales : 0 }
}

// Recibe un array de semanas, cada una con su lista de sesiones planificadas
// activas ({ duracion_min, zona_objetivo }). Devuelve la fase de cada una,
// comparándolas entre sí — no contra un umbral fijo, porque la escala de
// carga de cada plan es distinta.
export function detectarFasesMesociclo(semanasSesiones) {
  const resumenes = (semanasSesiones || []).map(resumenSemana)
  const cargaMax = Math.max(...resumenes.map((r) => r.carga), 0)

  return resumenes.map((r) => {
    if (r.carga === 0) return { fase: 'sin_datos', cargaRelativa: 0, pctAltaIntensidad: 0, carga: 0 }

    const cargaRelativa = cargaMax > 0 ? r.carga / cargaMax : 0
    const esAltaIntensidad = r.pctAltaIntensidad >= UMBRAL_INTENSIDAD_ALTA

    let fase
    if (cargaRelativa < UMBRAL_DESCARGA) fase = 'descarga'
    else if (esAltaIntensidad) fase = 'pico' // volumen medio/alto + buena parte en Z4+: específico o pico, no base
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
