const FIT_EPOCH_OFFSET = 631065600

const ZONAS_POTENCIA = [
  { zona: 'Z1', desde: 0, hasta: 0.55 },
  { zona: 'Z2', desde: 0.56, hasta: 0.75 },
  { zona: 'Z3', desde: 0.76, hasta: 0.90 },
  { zona: 'Z4', desde: 0.91, hasta: 1.05 },
  { zona: 'Z5', desde: 1.06, hasta: 1.20 },
  { zona: 'Z6', desde: 1.21, hasta: 1.50 },
  { zona: 'Z7', desde: 1.51, hasta: null }
]

// ---------- Parseo de texto libre a segundos ----------
export function parseDuracionTexto(texto) {
  if (!texto) return null
  const match = String(texto).trim().match(/^(\d+(?:[.,]\d+)?)\s*(min|m|seg|s)?$/i)
  if (!match) return null
  const valor = parseFloat(match[1].replace(',', '.'))
  if (isNaN(valor) || valor <= 0) return null
  const unidad = (match[2] || 'min').toLowerCase()
  return Math.round(unidad.startsWith('s') ? valor : valor * 60)
}

// ---------- Rango de potencia objetivo ----------
function rangoPotencia({ zona_objetivo, watts_kg_objetivo }, { ftp, peso }) {
  if (watts_kg_objetivo && peso) {
    const centro = Number(watts_kg_objetivo) * Number(peso)
    return { low: Math.round(centro * 0.95), high: Math.round(centro * 1.05) }
  }
  if (zona_objetivo && ftp) {
    const z = ZONAS_POTENCIA.find((zz) => zz.zona === zona_objetivo)
    if (z) {
      const low = Math.round(ftp * z.desde)
      const high = z.hasta ? Math.round(ftp * z.hasta) : Math.round(low * 1.15)
      return { low, high }
    }
  }
  return null
}

function rangoSuave(ftp) {
  if (!ftp) return null
  return { low: Math.round(ftp * 0.45), high: Math.round(ftp * 0.65) }
}

// ---------- Armado de pasos ----------
export function construirPasos(sesion, { ftp, peso }) {
  const segundosTotal = (Number(sesion.duracion_min) || 30) * 60
  const target = rangoPotencia(sesion, { ftp, peso })
  const suave = rangoSuave(ftp)
  const tiempoTrabajo = parseDuracionTexto(sesion.tiempo_trabajo_objetivo)
  const tiempoPausa = parseDuracionTexto(sesion.pausa_objetivo) ?? 120
  const series = Number(sesion.series_objetivo) || 0

  const pasos = []

  if (series > 0 && tiempoTrabajo) {
    let usados = 0
    if (segundosTotal > 20 * 60) {
      pasos.push({ nombre: 'Calentamiento', segundos: 600, target: suave, intensidad: 'warmup' })
      usados += 600
    }
    for (let i = 1; i <= series; i++) {
      pasos.push({ nombre: `Trabajo ${i}/${series}`, segundos: tiempoTrabajo, target, intensidad: 'active' })
      usados += tiempoTrabajo
      if (i < series) {
        pasos.push({ nombre: 'Recuperación', segundos: tiempoPausa, target: suave, intensidad: 'rest' })
        usados += tiempoPausa
      }
    }
    const restante = segundosTotal - usados
    if (restante > 60) {
      pasos.push({ nombre: 'Vuelta a la calma', segundos: restante, target: suave, intensidad: 'cooldown' })
    }
  } else {
    pasos.push({ nombre: sesion.tipo || 'Entrenamiento', segundos: segundosTotal, target, intensidad: 'active' })
  }

  return pasos
}

// ---------- Escritor binario FIT ----------
const CRC_TABLE = [0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401, 0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400]

function crc16(crc, byte) {
  let tmp = CRC_TABLE[crc & 0xF]
  crc = (crc >> 4) & 0x0FFF
  crc = crc ^ tmp ^ CRC_TABLE[byte & 0xF]
  tmp = CRC_TABLE[crc & 0xF]
  crc = (crc >> 4) & 0x0FFF
  crc = crc ^ tmp ^ CRC_TABLE[(byte >> 4) & 0xF]
  return crc & 0xFFFF
}

class EscritorFIT {
  constructor() {
    this.bytes = []
  }
  u8(v) { this.bytes.push(v & 0xFF) }
  u16(v) { this.bytes.push(v & 0xFF, (v >> 8) & 0xFF) }
  u32(v) { this.bytes.push(v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF) }
  str(v, tamaño) {
    const bytesTexto = Array.from(new TextEncoder().encode((v || '').slice(0, tamaño - 1)))
    for (let i = 0; i < tamaño; i++) this.u8(bytesTexto[i] || 0)
  }
  definicion(localType, globalMsg, campos) {
    this.u8(0x40 | localType) // header: bit6 = definición
    this.u8(0) // reservado
    this.u8(0) // arquitectura: 0 = little endian
    this.u16(globalMsg)
    this.u8(campos.length)
    for (const c of campos) { this.u8(c.num); this.u8(c.tam); this.u8(c.tipo) }
  }
  dato(localType) {
    this.u8(localType) // header: bit6 = 0 → mensaje de datos
  }
}

const TIPO = { ENUM: 0x00, UINT8: 0x02, UINT16: 0x84, UINT32: 0x86, STRING: 0x07 }
const INTENSIDAD = { active: 0, rest: 1, warmup: 2, cooldown: 3 }

export function generarWorkoutFIT(nombreSesion, pasos) {
  const w = new EscritorFIT()

  // file_id (local type 0)
  w.definicion(0, 0, [
    { num: 0, tam: 1, tipo: TIPO.ENUM },   // type
    { num: 1, tam: 2, tipo: TIPO.UINT16 }, // manufacturer
    { num: 2, tam: 2, tipo: TIPO.UINT16 }, // product
    { num: 4, tam: 4, tipo: TIPO.UINT32 }  // time_created
  ])
  w.dato(0)
  w.u8(5) // type = workout
  w.u16(1) // manufacturer = garmin (genérico)
  w.u16(0) // product
  w.u32(Math.floor(Date.now() / 1000) - FIT_EPOCH_OFFSET)

  // workout (local type 1)
  w.definicion(1, 26, [
    { num: 4, tam: 1, tipo: TIPO.ENUM },
    { num: 6, tam: 2, tipo: TIPO.UINT16 },
    { num: 8, tam: 16, tipo: TIPO.STRING }
  ])
  w.dato(1)
  w.u8(2) // sport = cycling
  w.u16(pasos.length)
  w.str(nombreSesion, 16)

  // workout_step (local type 2) — misma definición para todos los pasos
  w.definicion(2, 27, [
    { num: 254, tam: 2, tipo: TIPO.UINT16 }, // message_index
    { num: 0, tam: 16, tipo: TIPO.STRING },  // wkt_step_name
    { num: 1, tam: 1, tipo: TIPO.ENUM },     // duration_type
    { num: 2, tam: 4, tipo: TIPO.UINT32 },   // duration_value
    { num: 3, tam: 1, tipo: TIPO.ENUM },     // target_type
    { num: 4, tam: 4, tipo: TIPO.UINT32 },   // custom_target_value_low
    { num: 5, tam: 4, tipo: TIPO.UINT32 },   // custom_target_value_high
    { num: 6, tam: 1, tipo: TIPO.ENUM }      // intensity
  ])
  pasos.forEach((p, i) => {
    w.dato(2)
    w.u16(i)
    w.str(p.nombre, 16)
    w.u8(0) // duration_type = time
    w.u32(p.segundos * 1000)
    if (p.target) {
      w.u8(4) // target_type = power
      w.u32(p.target.low + 1000)
      w.u32(p.target.high + 1000)
    } else {
      w.u8(0xFF) // target_type = open
      w.u32(0)
      w.u32(0)
    }
    w.u8(INTENSIDAD[p.intensidad] ?? 0)
  })

  const datos = w.bytes
  const dataSize = datos.length

  // Header (14 bytes)
  const header = []
  header.push(14, 16, 0, 0) // header_size, protocol_version, profile_version(2 bytes, simplificado)
  header.push(dataSize & 0xFF, (dataSize >> 8) & 0xFF, (dataSize >> 16) & 0xFF, (dataSize >> 24) & 0xFF)
  header.push(0x2E, 0x46, 0x49, 0x54) // ".FIT"
  header.push(0, 0) // CRC de header (opcional, 0 = no calculado)

  let crc = 0
  for (const b of header) crc = crc16(crc, b)
  for (const b of datos) crc = crc16(crc, b)

  const completo = new Uint8Array(header.length + datos.length + 2)
  completo.set(header, 0)
  completo.set(datos, header.length)
  completo[header.length + datos.length] = crc & 0xFF
  completo[header.length + datos.length + 1] = (crc >> 8) & 0xFF

  return completo
}

export function descargarWorkoutFit(sesion, { ftp, peso }) {
  const pasos = construirPasos(sesion, { ftp, peso })
  const nombre = `${sesion.tipo || 'Entrenamiento'}${sesion.estilo_sesion ? ` - ${sesion.estilo_sesion}` : ''}`
  const bytes = generarWorkoutFIT(nombre, pasos)

  const blob = new Blob([bytes], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sesion.fecha}-entrenamiento.fit`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
