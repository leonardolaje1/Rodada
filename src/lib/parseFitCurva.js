const FIT_EPOCH_OFFSET = 631065600
const GLOBAL_MSG_RECORD = 20
const GLOBAL_MSG_SESSION = 18

function leerCampoNumerico(view, offset, size, baseType, littleEndian) {
  try {
    switch (baseType) {
      case 0: case 2: case 10: {
        const v = view.getUint8(offset)
        return v === 0xff ? null : v
      }
      case 1: {
        const v = view.getInt8(offset)
        return v === 0x7f ? null : v
      }
      case 3: {
        const v = view.getInt16(offset, littleEndian)
        return v === 0x7fff ? null : v
      }
      case 4: case 11: {
        const v = view.getUint16(offset, littleEndian)
        return v === 0xffff ? null : v
      }
      case 5: {
        const v = view.getInt32(offset, littleEndian)
        return v === 0x7fffffff ? null : v
      }
      case 6: case 12: {
        const v = view.getUint32(offset, littleEndian)
        return v === 0xffffffff ? null : v
      }
      case 8: {
        return view.getFloat32(offset, littleEndian)
      }
      default:
        return null
    }
  } catch {
    return null
  }
}

export function parseFIT(arrayBuffer) {
  const view = new DataView(arrayBuffer)
  const headerSize = view.getUint8(0)

  const firma = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))
  if (firma !== '.FIT') {
    throw new Error('El archivo no tiene la firma .FIT esperada. ¿Es un archivo FIT válido?')
  }

  const dataSize = view.getUint32(4, true)
  let offset = headerSize
  const finDatos = headerSize + dataSize

  const definiciones = {}
  let mejorSesion = null
  const seriePotencia = []

  while (offset < finDatos && offset < view.byteLength) {
    const headerByte = view.getUint8(offset)
    offset += 1

    const esComprimido = (headerByte & 0x80) !== 0

    if (esComprimido) {
      const localType = (headerByte >> 5) & 0x03
      const def = definiciones[localType]
      if (!def) break
      offset += tamañoRegistro(def)
      continue
    }

    const esDefinicion = (headerByte & 0x40) !== 0
    const localType = headerByte & 0x0f

    if (esDefinicion) {
      const tieneDevFields = (headerByte & 0x20) !== 0
      offset += 1
      const arquitectura = view.getUint8(offset)
      offset += 1
      const littleEndian = arquitectura === 0
      const globalMsg = view.getUint16(offset, littleEndian)
      offset += 2
      const numCampos = view.getUint8(offset)
      offset += 1

      const fields = []
      for (let i = 0; i < numCampos; i++) {
        const number = view.getUint8(offset)
        const size = view.getUint8(offset + 1)
        const baseTypeByte = view.getUint8(offset + 2)
        const baseType = baseTypeByte & 0x1f
        fields.push({ number, size, baseType })
        offset += 3
      }

      let devFields = []
      if (tieneDevFields) {
        const numDev = view.getUint8(offset)
        offset += 1
        for (let i = 0; i < numDev; i++) {
          offset += 3
        }
        devFields = new Array(numDev).fill({ size: 0 })
      }

      definiciones[localType] = { globalMsg, littleEndian, fields, devFields }
      continue
    }

    const def = definiciones[localType]
    if (!def) break

    if (def.globalMsg === GLOBAL_MSG_SESSION) {
      const sesion = {}
      let cursor = offset
      for (const campo of def.fields) {
        const valor = leerCampoNumerico(view, cursor, campo.size, campo.baseType, def.littleEndian)
        sesion[campo.number] = valor
        cursor += campo.size
      }
      const totalTimerTime = sesion[8] != null ? sesion[8] / 1000 : null
      if (!mejorSesion || (totalTimerTime || 0) > (mejorSesion._segundos || 0)) {
        mejorSesion = {
          startTime: sesion[2],
          _segundos: totalTimerTime,
          totalElapsedTime: sesion[7] != null ? sesion[7] / 1000 : null,
          totalTimerTime,
          totalDistanceM: sesion[9] != null ? sesion[9] / 100 : null,
          avgHeartRate: sesion[16],
          avgCadence: sesion[18],
          avgPower: sesion[20],
          totalAscent: sesion[22]
        }
      }
    }

    if (def.globalMsg === GLOBAL_MSG_RECORD) {
      // Campo 7 = power (uint16, base type 4), en los mensajes "record" de FIT
      const campoPower = def.fields.find((f) => f.number === 7)
      if (campoPower) {
        let cursor = offset
        for (const campo of def.fields) {
          if (campo.number === 7) {
            const potencia = leerCampoNumerico(view, cursor, campo.size, campo.baseType, def.littleEndian)
            if (potencia != null) seriePotencia.push(potencia)
          }
          cursor += campo.size
        }
      }
    }

    offset += tamañoRegistro(def)
  }

  if (!mejorSesion) {
    throw new Error(
      'No se encontró un resumen de actividad (mensaje "session") dentro del archivo FIT. ' +
      'Probá exportando la actividad como GPX o TCX desde Garmin Connect en su lugar.'
    )
  }

  const fecha = mejorSesion.startTime != null
    ? new Date((mejorSesion.startTime + FIT_EPOCH_OFFSET) * 1000).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  const duracionSeg = mejorSesion.totalTimerTime ?? mejorSesion.totalElapsedTime

  return {
    fecha,
    duracion_min: duracionSeg != null ? Math.round(duracionSeg / 60) : null,
    km: mejorSesion.totalDistanceM != null ? Math.round((mejorSesion.totalDistanceM / 1000) * 100) / 100 : null,
    desnivel: mejorSesion.totalAscent ?? null,
    fc_avg: mejorSesion.avgHeartRate ?? null,
    cadencia_avg: mejorSesion.avgCadence ?? null,
    potencia_avg: mejorSesion.avgPower ?? null,
    serie_potencia: seriePotencia.length > 0 ? seriePotencia : null
  }
}

function tamañoRegistro(def) {
  const camposNormales = def.fields.reduce((a, f) => a + f.size, 0)
  const camposDev = (def.devFields || []).reduce((a, f) => a + (f.size || 0), 0)
  return camposNormales + camposDev
}
