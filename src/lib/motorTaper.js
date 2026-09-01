// Motor de detección de necesidad de taper (bajar carga antes de competir),
// mismo patrón que motorConflictos.js y motorOportunidades.js: reglas
// explícitas hoy, reemplazables por IA más adelante sin tocar el resto de la
// app. Igual que motorOportunidades: nunca modifica nada solo, solo devuelve
// un mensaje — bajar la carga siempre lo decide el atleta a mano.

import { proyectarCarga } from './tss'
import { diasEntreLocal } from './fechas'

const DIAS_AVISO_TAPER = 10 // a partir de cuántos días antes de la competencia se empieza a avisar
const TSB_OBJETIVO_COMPETENCIA = 5 // TSB recomendado para llegar "fresco" a competir

export function detectarNecesidadTaper({ competenciaProxima, tsbActual, ctlActual, fechaHoy }) {
  if (!competenciaProxima || tsbActual == null) return null

  const dias = diasEntreLocal(fechaHoy, competenciaProxima.fecha)
  if (dias == null || dias < 0 || dias > DIAS_AVISO_TAPER) return null

  // El TSB es, por definición, CTL - ATL. Con el CTL y el TSB de hoy se
  // recupera el ATL, y con eso se proyecta la evolución día a día usando la
  // MISMA EMA que calcularCargaDiaria().
  //
  // Se proyecta el escenario "si seguís con tu carga habitual" (TSS diario =
  // CTL, que es por definición el promedio de las últimas semanas), porque es
  // exactamente lo que dice el mensaje y es la pregunta que le importa al
  // atleta: ¿necesito empezar a bajar?
  //
  // (La versión anterior hacía dos cosas mal a la vez: asumía una "liberación"
  // diaria de CTL/7 puntos de TSB — sin base fisiológica ni dimensional, con
  // CTL 60 y TSB -10 proyectaba +75 en 10 días — y además esa cuenta modelaba
  // reposo total, contradiciendo su propio mensaje. Resultado: el aviso se
  // disparaba tarde o no se disparaba nunca.)
  const ctl = Number(ctlActual) || 0
  const atl = ctl - tsbActual

  const siSigueIgual = proyectarCarga({ ctl, atl }, dias, ctl)
  if (siSigueIgual.tsb >= TSB_OBJETIVO_COMPETENCIA) return null // llega fresco sin cambiar nada

  // Cota optimista: cuánto podría recuperar en el mejor de los casos, con
  // reposo total. Sirve para no aconsejar un taper imposible.
  const siDescansaTodo = proyectarCarga({ ctl, atl }, dias, 0)
  const proyeccion = siSigueIgual

  return {
    id: `taper-${competenciaProxima.id}`,
    fecha: fechaHoy,
    competencia: competenciaProxima.nombre,
    diasRestantes: dias,
    tsbActual: Math.round(tsbActual),
    tsbProyectado: Math.round(proyeccion.tsb),
    ctlProyectado: proyeccion.ctl,
    atlProyectado: proyeccion.atl,
    tsbSiDescansaTodo: siDescansaTodo.tsb,
    alcanzable: siDescansaTodo.tsb >= TSB_OBJETIVO_COMPETENCIA,
    mensaje: dias === 0
      ? `Hoy es "${competenciaProxima.nombre}". Con tu carga actual llegás con TSB ${Math.round(tsbActual)} — por debajo del rango ideal para rendir fresco (+${TSB_OBJETIVO_COMPETENCIA} o más).`
      : `Faltan ${dias} día${dias === 1 ? '' : 's'} para "${competenciaProxima.nombre}". Si seguís con tu carga habitual llegás con TSB ~${Math.round(siSigueIgual.tsb)}, por debajo del ideal (+${TSB_OBJETIVO_COMPETENCIA}). Bajando el volumen podés llegar hasta ~${Math.round(siDescansaTodo.tsb)}.`
  }
}
