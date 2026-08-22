// Motor de detección de conflictos de calendario, basado en reglas explícitas
// (mismo patrón que motorInsights.js: reglas hoy, día de mañana se puede
// reemplazar por una llamada a IA sin tocar el resto de la app). Contrato de salida:
//
//   {
//     id, fecha, tipo: 'carga_previa_a_clave' | 'clave_consecutiva',
//     mensaje,
//     sugerencia: { texto, mover: { tabla, fecha_origen, fecha_destino } } | null,
//     fuente: 'reglas'
//   }

// Umbral de TSS a partir del cual un día de ciclismo se considera "carga alta".
// Referencia aproximada: ~1h a umbral ronda 100 TSS; una salida suave suele ser <50.
const TSS_ALTO = 80

// A partir de cuántos días seguidos con actividad (sin ningún día de
// descanso entre medio) se avisa del patrón de sobrecarga semanal.
const DIAS_SEGUIDOS_AVISO = 7

// Al buscar un día alternativo para "mover" una sesión, se prueba primero con
// más separación de la sesión clave (más días de por medio = más margen de
// recuperación) y se va acercando si esos días ya están ocupados.
const VENTANA_DIAS_ATRAS = [3, 2]

const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function sumarDias(fechaStr, dias) {
  const d = new Date(fechaStr + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

function formatearDiaCorto(fechaStr) {
  const d = new Date(fechaStr + 'T12:00:00')
  return NOMBRES_DIA[d.getDay()]
}

function agruparPorFecha(items) {
  const grupos = {}
  for (const it of items) {
    if (!grupos[it.fecha]) grupos[it.fecha] = []
    grupos[it.fecha].push(it)
  }
  return grupos
}

function buscarDiaAlternativo(fechaClave, fechaConflicto, gymPorFecha, diasClave) {
  for (const delta of VENTANA_DIAS_ATRAS) {
    const candidata = sumarDias(fechaClave, -delta)
    if (candidata === fechaConflicto) continue
    if (gymPorFecha[candidata]?.length) continue
    if (diasClave.has(candidata)) continue
    return candidata
  }
  return null
}

export function detectarConflictosCalendario({ entrenamientos = [], gimnasio = [] }) {
  const entPorFecha = agruparPorFecha(entrenamientos)
  const gymPorFecha = agruparPorFecha(gimnasio)

  // Días "clave": cualquier fecha con al menos una sesión (ciclismo o gimnasio) marcada es_clave.
  const diasClave = new Map() // fecha -> [{ origen, label }]
  for (const [fecha, items] of Object.entries(entPorFecha)) {
    const claves = items.filter((e) => e.es_clave)
    if (claves.length) diasClave.set(fecha, claves.map((e) => ({ origen: 'ciclismo', label: e.tipo || 'Entrenamiento' })))
  }
  for (const [fecha, items] of Object.entries(gymPorFecha)) {
    const claves = items.filter((g) => g.es_clave)
    if (claves.length) diasClave.set(fecha, (diasClave.get(fecha) || []).concat(claves.map((g) => ({ origen: 'gimnasio', label: g.ejercicio || 'Gimnasio' }))))
  }

  const setDiasClave = new Set(diasClave.keys())
  const conflictos = []

  for (const [fechaClave, claves] of diasClave.entries()) {
    const fechaPrevia = sumarDias(fechaClave, -1)
    const gymPrevio = gymPorFecha[fechaPrevia] || []
    const entPrevio = entPorFecha[fechaPrevia] || []
    const tssPrevio = entPrevio.reduce((a, e) => a + (Number(e.tss) || 0), 0)
    const claveLabel = claves.map((c) => c.label).join(' + ')

    // Regla 1 — sesión de gimnasio el día anterior a una sesión clave.
    if (gymPrevio.length > 0) {
      const ejercicios = [...new Set(gymPrevio.map((g) => g.ejercicio))].join(', ')
      const fechaSugerida = buscarDiaAlternativo(fechaClave, fechaPrevia, gymPorFecha, setDiasClave)
      conflictos.push({
        id: `gym-previo-${fechaClave}`,
        fecha: fechaClave,
        tipo: 'carga_previa_a_clave',
        mensaje: `La carga del ${formatearDiaCorto(fechaPrevia)} (${ejercicios}) puede afectar la sesión clave del ${formatearDiaCorto(fechaClave)}${claveLabel ? ` (${claveLabel})` : ''}.`,
        sugerencia: fechaSugerida ? {
          texto: `Mover ${ejercicios} al ${formatearDiaCorto(fechaSugerida)}`,
          mover: { tabla: 'gimnasio', fecha_origen: fechaPrevia, fecha_destino: fechaSugerida }
        } : null,
        fuente: 'reglas'
      })
    }

    // Regla 2 — carga ciclista alta (TSS) el día anterior a una sesión clave.
    if (tssPrevio >= TSS_ALTO) {
      conflictos.push({
        id: `tss-previo-${fechaClave}`,
        fecha: fechaClave,
        tipo: 'carga_previa_a_clave',
        mensaje: `El entrenamiento del ${formatearDiaCorto(fechaPrevia)} tuvo carga alta (${Math.round(tssPrevio)} TSS) y puede afectar la sesión clave del ${formatearDiaCorto(fechaClave)}${claveLabel ? ` (${claveLabel})` : ''}.`,
        sugerencia: null,
        fuente: 'reglas'
      })
    }

    // Regla 3 — dos sesiones clave en días consecutivos.
    const fechaSiguiente = sumarDias(fechaClave, 1)
    if (setDiasClave.has(fechaSiguiente)) {
      conflictos.push({
        id: `clave-consecutiva-${fechaClave}`,
        fecha: fechaSiguiente,
        tipo: 'clave_consecutiva',
        mensaje: `Tenés sesiones clave dos días seguidos: ${formatearDiaCorto(fechaClave)} y ${formatearDiaCorto(fechaSiguiente)}. Puede que no llegues fresco a la segunda.`,
        sugerencia: null,
        fuente: 'reglas'
      })
    }
  }

  return conflictos.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

// A diferencia de detectarConflictosCalendario (que compara días cercanos
// entre sí), esta regla mira la ventana completa hacia atrás desde hoy:
// cuántos días seguidos hubo actividad sin ningún día de descanso entre
// medio — un patrón que un chequeo día-a-día no ve.
export function detectarSobrecargaSemanal({ entrenamientos = [], gimnasio = [], fechaHoy }) {
  const diasConActividad = new Set()
  for (const e of entrenamientos) {
    if ((Number(e.tss) || 0) > 0) diasConActividad.add(e.fecha)
  }
  for (const g of gimnasio) {
    diasConActividad.add(g.fecha)
  }

  let racha = 0
  let cursor = fechaHoy
  while (diasConActividad.has(cursor)) {
    racha++
    cursor = sumarDias(cursor, -1)
  }

  if (racha < DIAS_SEGUIDOS_AVISO) return null

  return {
    id: `sobrecarga-semanal-${fechaHoy}`,
    fecha: fechaHoy,
    tipo: 'sin_descanso',
    diasSeguidos: racha,
    mensaje: `Llevás ${racha} días seguidos con actividad (ciclismo o gimnasio), sin un día de descanso entre medio. Considerá sumar uno pronto.`,
    fuente: 'reglas'
  }
}
