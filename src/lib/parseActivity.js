import { parseFIT } from './parseFit'

export function detectarFormato(nombreArchivo) {
  const ext = nombreArchivo.split('.').pop().toLowerCase()
  if (ext === 'gpx') return 'gpx'
  if (ext === 'tcx') return 'tcx'
  if (ext === 'fit') return 'fit'
  return null
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function promedio(valores) {
  const limpio = valores.filter((v) => v != null && !Number.isNaN(v))
  if (limpio.length === 0) return null
  return limpio.reduce((a, b) => a + b, 0) / limpio.length
}

function maximo(valores) {
  const limpio = valores.filter((v) => v != null && !Number.isNaN(v))
  if (limpio.length === 0) return null
  return Math.max(...limpio)
}

function minimo(valores) {
  const limpio = valores.filter((v) => v != null && !Number.isNaN(v))
  if (limpio.length === 0) return null
  return Math.min(...limpio)
}

function calcularAscensoDescenso(alturas) {
  let ascenso = 0
  let descenso = 0
  for (let i = 1; i < alturas.length; i++) {
    if (alturas[i] == null || alturas[i - 1] == null) continue
    const diff = alturas[i] - alturas[i - 1]
    if (diff > 0) ascenso += diff
    else descenso += Math.abs(diff)
  }
  return { ascenso, descenso }
}

export async function parseActivityFile(file) {
  const formato = detectarFormato(file.name)
  if (!formato) throw new Error('Formato no reconocido. Subí un archivo .gpx, .tcx o .fit')

  if (formato === 'fit') {
    try {
      const buffer = await file.arrayBuffer()
      return parseFIT(buffer)
    } catch (err) {
      throw new Error(
        (err.message || 'No se pudo leer el archivo FIT.') +
        ' Como alternativa, exportá la actividad como GPX o TCX desde Garmin Connect.'
      )
    }
  }

  const texto = await file.text()
  const parser = new DOMParser()
  const xml = parser.parseFromString(texto, 'application/xml')

  if (xml.querySelector('parsererror')) {
    throw new Error('No se pudo leer el archivo. ¿Es un GPX o TCX válido?')
  }

  return formato === 'gpx' ? parseGPX(xml) : parseTCX(xml)
}

function parseGPX(xml) {
  const puntos = Array.from(xml.querySelectorAll('trkpt')).map((pt) => {
    const lat = parseFloat(pt.getAttribute('lat'))
    const lon = parseFloat(pt.getAttribute('lon'))
    const ele = pt.querySelector('ele') ? parseFloat(pt.querySelector('ele').textContent) : null
    const time = pt.querySelector('time') ? pt.querySelector('time').textContent : null
    const hr = pt.querySelector('hr, [*|hr]') ? parseFloat(pt.querySelector('hr, [*|hr]').textContent) : null
    const cad = pt.querySelector('cad, [*|cad]') ? parseFloat(pt.querySelector('cad, [*|cad]').textContent) : null
    const atemp = pt.querySelector('atemp, [*|atemp]') ? parseFloat(pt.querySelector('atemp, [*|atemp]').textContent) : null
    const power = pt.querySelector('power, [*|power]') ? parseFloat(pt.querySelector('power, [*|power]').textContent) : null
    return { lat, lon, ele, time, hr, cad, atemp, power }
  })

  if (puntos.length === 0) throw new Error('El GPX no tiene puntos de recorrido (trkpt).')

  let km = 0
  const alturas = puntos.map((p) => p.ele)
  const { ascenso, descenso } = calcularAscensoDescenso(alturas)

  const velocidadesInstant = []
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1]
    const b = puntos[i]
    if (a.lat && b.lat) {
      const tramoKm = haversineKm(a.lat, a.lon, b.lat, b.lon)
      km += tramoKm
      if (a.time && b.time) {
        const segundos = (new Date(b.time) - new Date(a.time)) / 1000
        if (segundos > 0) velocidadesInstant.push((tramoKm / segundos) * 3600)
      }
    }
  }

  const primero = puntos.find((p) => p.time)
  const ultimo = [...puntos].reverse().find((p) => p.time)
  const duracion_min = primero && ultimo
    ? Math.round((new Date(ultimo.time) - new Date(primero.time)) / 60000)
    : null

  const velocidad_avg = duracion_min ? Math.round(((km / duracion_min) * 60) * 10) / 10 : null

  return {
    fecha: primero ? primero.time.slice(0, 10) : new Date().toISOString().slice(0, 10),
    duracion_min,
    km: Math.round(km * 100) / 100,
    desnivel: Math.round(ascenso),
    descenso: Math.round(descenso),
    altura_min: minimo(alturas) != null ? Math.round(minimo(alturas)) : null,
    altura_max: maximo(alturas) != null ? Math.round(maximo(alturas)) : null,
    fc_avg: Math.round(promedio(puntos.map((p) => p.hr)) || 0) || null,
    cadencia_avg: Math.round(promedio(puntos.map((p) => p.cad)) || 0) || null,
    cadencia_max: maximo(puntos.map((p) => p.cad)) != null ? Math.round(maximo(puntos.map((p) => p.cad))) : null,
    potencia_avg: promedio(puntos.map((p) => p.power)) != null ? Math.round(promedio(puntos.map((p) => p.power))) : null,
    potencia_max: maximo(puntos.map((p) => p.power)) != null ? Math.round(maximo(puntos.map((p) => p.power))) : null,
    temperatura_avg: promedio(puntos.map((p) => p.atemp)) != null ? Math.round(promedio(puntos.map((p) => p.atemp)) * 10) / 10 : null,
    temperatura_min: minimo(puntos.map((p) => p.atemp)) != null ? Math.round(minimo(puntos.map((p) => p.atemp)) * 10) / 10 : null,
    temperatura_max: maximo(puntos.map((p) => p.atemp)) != null ? Math.round(maximo(puntos.map((p) => p.atemp)) * 10) / 10 : null,
    velocidad_avg,
    velocidad_max: maximo(velocidadesInstant) != null ? Math.round(maximo(velocidadesInstant) * 10) / 10 : null
  }
}

function parseTCX(xml) {
  const laps = Array.from(xml.querySelectorAll('Lap'))
  if (laps.length === 0) throw new Error('El TCX no tiene vueltas (Lap) con datos de actividad.')

  const trackpoints = Array.from(xml.querySelectorAll('Trackpoint'))
  const primerTiempo = xml.querySelector('Id')?.textContent || trackpoints[0]?.querySelector('Time')?.textContent

  let totalSegundos = 0
  let totalMetros = 0
  let sumaHrPonderada = 0
  let totalCalorias = 0
  let velocidadMaxLap = null

  for (const lap of laps) {
    const segundos = parseFloat(lap.querySelector('TotalTimeSeconds')?.textContent || 0)
    const metros = parseFloat(lap.querySelector('DistanceMeters')?.textContent || 0)
    const hrLap = parseFloat(lap.querySelector('AverageHeartRateBpm > Value')?.textContent || 0)
    const calLap = parseFloat(lap.querySelector('Calories')?.textContent || 0)
    const maxSpeedLap = lap.querySelector('MaximumSpeed') ? parseFloat(lap.querySelector('MaximumSpeed').textContent) : null
    totalSegundos += segundos
    totalMetros += metros
    sumaHrPonderada += hrLap * segundos
    totalCalorias += calLap
    if (maxSpeedLap != null && (velocidadMaxLap == null || maxSpeedLap > velocidadMaxLap)) velocidadMaxLap = maxSpeedLap
  }

  const watts = trackpoints
    .map((tp) => tp.querySelector('Watts, [*|Watts]'))
    .filter(Boolean)
    .map((n) => parseFloat(n.textContent))

  const cadencias = trackpoints
    .map((tp) => tp.querySelector('Cadence'))
    .filter(Boolean)
    .map((n) => parseFloat(n.textContent))

  const alturas = trackpoints
    .map((tp) => tp.querySelector('AltitudeMeters'))
    .filter(Boolean)
    .map((n) => parseFloat(n.textContent))

  const { ascenso, descenso } = calcularAscensoDescenso(alturas)

  return {
    fecha: primerTiempo ? primerTiempo.slice(0, 10) : new Date().toISOString().slice(0, 10),
    duracion_min: Math.round(totalSegundos / 60),
    km: Math.round((totalMetros / 1000) * 100) / 100,
    desnivel: Math.round(ascenso),
    descenso: Math.round(descenso),
    altura_min: minimo(alturas) != null ? Math.round(minimo(alturas)) : null,
    altura_max: maximo(alturas) != null ? Math.round(maximo(alturas)) : null,
    fc_avg: totalSegundos ? Math.round(sumaHrPonderada / totalSegundos) : null,
    cadencia_avg: cadencias.length ? Math.round(promedio(cadencias)) : null,
    cadencia_max: maximo(cadencias) != null ? Math.round(maximo(cadencias)) : null,
    potencia_avg: watts.length ? Math.round(promedio(watts)) : null,
    potencia_max: maximo(watts) != null ? Math.round(maximo(watts)) : null,
    calorias: totalCalorias ? Math.round(totalCalorias) : null,
    velocidad_avg: totalSegundos ? Math.round(((totalMetros / 1000) / (totalSegundos / 3600)) * 10) / 10 : null,
    velocidad_max: velocidadMaxLap != null ? Math.round(velocidadMaxLap * 3.6 * 10) / 10 : null
    // Nota: temperatura, trabajo (kJ), potencia normalizada y tiempo en movimiento
    // no vienen en el formato TCX estándar de Garmin — quedan para carga manual,
    // o se podrían sumar más adelante si extendemos parseFit.js para leerlos del .FIT.
  }
}
