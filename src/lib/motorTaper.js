// Motor de detección de necesidad de taper (bajar carga antes de competir),
// mismo patrón que motorConflictos.js y motorOportunidades.js: reglas
// explícitas hoy, reemplazables por IA más adelante sin tocar el resto de la
// app. Igual que motorOportunidades: nunca modifica nada solo, solo devuelve
// un mensaje — bajar la carga siempre lo decide el atleta a mano.

const DIAS_AVISO_TAPER = 10 // a partir de cuántos días antes de la competencia se empieza a avisar
const TSB_OBJETIVO_COMPETENCIA = 5 // TSB recomendado para llegar "fresco" a competir

function diasEntre(fechaDesde, fechaHasta) {
  const a = new Date(fechaDesde + 'T12:00:00')
  const b = new Date(fechaHasta + 'T12:00:00')
  return Math.round((b - a) / 86400000)
}

// Proyecta el TSB a `dias` en el futuro asumiendo que no se agrega carga
// nueva: el CTL actual funciona como aproximación de cuánto "libera" el ATL
// por día al descansar (misma EMA de 7 días que usa calcularCargaDiaria).
function proyectarTsbSinEntrenar(tsbActual, ctlActual, dias) {
  const liberacionPorDia = ctlActual ? ctlActual / 7 : 0
  return tsbActual + liberacionPorDia * dias
}

export function detectarNecesidadTaper({ competenciaProxima, tsbActual, ctlActual, fechaHoy }) {
  if (!competenciaProxima || tsbActual == null) return null

  const dias = diasEntre(fechaHoy, competenciaProxima.fecha)
  if (dias < 0 || dias > DIAS_AVISO_TAPER) return null

  const tsbProyectado = proyectarTsbSinEntrenar(tsbActual, ctlActual, dias)
  if (tsbProyectado >= TSB_OBJETIVO_COMPETENCIA) return null // ya se proyecta llegar fresco sin cambios

  return {
    id: `taper-${competenciaProxima.id}`,
    fecha: fechaHoy,
    competencia: competenciaProxima.nombre,
    diasRestantes: dias,
    tsbActual: Math.round(tsbActual),
    tsbProyectado: Math.round(tsbProyectado),
    mensaje: dias === 0
      ? `Hoy es "${competenciaProxima.nombre}". Con tu carga actual llegás con TSB ${Math.round(tsbActual)} — por debajo del rango ideal para rendir fresco (+${TSB_OBJETIVO_COMPETENCIA} o más).`
      : `Faltan ${dias} día${dias === 1 ? '' : 's'} para "${competenciaProxima.nombre}". Si seguís con la carga actual, proyectás llegar con TSB ~${Math.round(tsbProyectado)}. Bajar el volumen estos días te acerca a un TSB ideal (+${TSB_OBJETIVO_COMPETENCIA} o más).`
  }
}
