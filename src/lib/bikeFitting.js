const UMBRAL_CAMBIO_PESO_ATENCION = 0.05
const UMBRAL_CAMBIO_PESO_CRITICO = 0.08
const UMBRAL_MESES_ATENCION = 12
const UMBRAL_MESES_CRITICO = 18
const DIAS_DOLOR_SOSTENIDO = 7
const UMBRAL_DIAS_CON_DOLOR = 3
const DOLOR_ALTO = 4

function mesesDesde(fechaISO) {
  const fecha = new Date(fechaISO)
  const hoy = new Date()
  return (hoy.getFullYear() - fecha.getFullYear()) * 12 + (hoy.getMonth() - fecha.getMonth())
}

export function evaluarFitting(ultimoFitting, pesoActual, registrosRecuperacion = []) {
  const señales = []

  if (!ultimoFitting) {
    return {
      nivel: 'sin_datos',
      motivos: ['Todavía no cargaste ningún estudio de bike fitting para esta bici.']
    }
  }

  const motivos = []

  const meses = mesesDesde(ultimoFitting.fecha)
  if (meses >= UMBRAL_MESES_CRITICO) {
    señales.push(2)
    motivos.push(`Pasaron ${meses} meses desde el último estudio.`)
  } else if (meses >= UMBRAL_MESES_ATENCION) {
    señales.push(1)
    motivos.push(`Ya pasó más de un año (${meses} meses) desde el último estudio.`)
  } else {
    señales.push(0)
  }

  if (pesoActual && ultimoFitting.peso_ciclista) {
    const cambio = Math.abs(pesoActual - ultimoFitting.peso_ciclista) / ultimoFitting.peso_ciclista
    if (cambio >= UMBRAL_CAMBIO_PESO_CRITICO) {
      señales.push(2)
      motivos.push(`Tu peso cambió un ${Math.round(cambio * 100)}% desde el último estudio.`)
    } else if (cambio >= UMBRAL_CAMBIO_PESO_ATENCION) {
      señales.push(1)
      motivos.push(`Tu peso cambió un ${Math.round(cambio * 100)}% desde el último estudio.`)
    } else {
      señales.push(0)
    }
  }

  const ultimosDias = registrosRecuperacion.filter((r) => {
    const dias = (new Date() - new Date(r.fecha)) / 86400000
    return dias <= DIAS_DOLOR_SOSTENIDO
  })
  const diasConDolor = ultimosDias.filter((r) => Number(r.dolor_muscular) >= DOLOR_ALTO).length
  if (diasConDolor >= UMBRAL_DIAS_CON_DOLOR) {
    señales.push(2)
    motivos.push(`Reportaste dolor muscular alto en ${diasConDolor} de los últimos ${DIAS_DOLOR_SOSTENIDO} días.`)
  }

  const maxSeñal = Math.max(...señales, 0)
  const nivel = maxSeñal === 2 ? 'critico' : maxSeñal === 1 ? 'atencion' : 'ok'

  return { nivel, motivos: motivos.length ? motivos : ['Todo en orden, no hay señales de alerta.'] }
}

export function infoNivelFitting(nivel) {
  if (nivel === 'critico') return { color: '#F14A4A', texto: 'Buen momento para un nuevo estudio' }
  if (nivel === 'atencion') return { color: '#F5A623', texto: 'Empezá a considerar un nuevo estudio' }
  if (nivel === 'sin_datos') return { color: '#565B68', texto: 'Sin estudio cargado' }
  return { color: '#C4F135', texto: 'Posición al día' }
}
