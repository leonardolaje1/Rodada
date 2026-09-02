import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parsearPlanillaBici, generarSesionesDesdeSemanas } from './importarPlanilla'

// Fixture: planilla real exportada desde HELU (Mesociclo 1 - Reingreso).
// Se usa un archivo de verdad y no uno inventado porque los parsers fallan
// justamente en lo que uno no imagina: celdas vacías, apóstrofos en las
// descripciones, columnas opcionales sin completar, tipos mezclados.
function cargarPlanilla(nombre = 'mesociclo-bici.xlsx') {
  const buffer = readFileSync(new URL(`./__fixtures__/${nombre}`, import.meta.url))
  // parsearPlanillaBici espera algo con arrayBuffer(), como un File del browser.
  return {
    arrayBuffer: async () =>
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  }
}

describe('parsearPlanillaBici sobre una planilla real', () => {
  it('lee el nombre y la fecha de inicio de la hoja Meta', async () => {
    const plan = await parsearPlanillaBici(cargarPlanilla())
    expect(plan.nombre.startsWith('Mesociclo 1 - Reingreso')).toBe(true)
    expect(plan.fecha_inicio).toBe('2026-08-31')
  })

  it('lee el tipo de mesociclo', async () => {
    const plan = await parsearPlanillaBici(cargarPlanilla())
    expect(plan.tipo).toBe('base')
  })

  it('acepta CTL_objetivo vacío sin romper', async () => {
    const plan = await parsearPlanillaBici(cargarPlanilla())
    expect(plan.ctl_objetivo).toBeNull()
  })

  it('detecta 4 semanas (3 de carga + descarga)', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    expect(semanas).toHaveLength(4)
  })

  it('cada semana tiene los 7 días, activos o no', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    for (const s of semanas) {
      expect(s.dias).toHaveLength(7)
    }
  })

  it('marca como clave las sesiones de calidad de martes y jueves', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    const semana1 = semanas[0]
    const martes = semana1.dias.find((d) => d.dia === 'mar')
    const jueves = semana1.dias.find((d) => d.dia === 'jue')
    expect(martes.es_clave).toBe(true)
    expect(jueves.es_clave).toBe(true)
  })

  it('no marca como clave los días de resistencia', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    const lunes = semanas[0].dias.find((d) => d.dia === 'lun')
    expect(lunes.es_clave).toBe(false)
  })

  it('lee la duración como número', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    const lunes = semanas[0].dias.find((d) => d.dia === 'lun')
    expect(lunes.duracion_min).toBe(45)
  })

  it('conserva la descripción completa, con apóstrofos y paréntesis', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    const martes = semanas[0].dias.find((d) => d.dia === 'mar')
    expect(martes.descripcion.includes('RESISTENCIA INTERMITENTE')).toBe(true)
    expect(martes.descripcion.length > 50).toBe(true)
  })

  it('lee series y pausa cuando la fila las tiene', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    const jueves = semanas[0].dias.find((d) => d.dia === 'jue')
    expect(jueves.series_objetivo).toBe(2)
    expect(jueves.pausa_objetivo).toBe('5min')
  })

  it('deja en null las columnas opcionales vacías', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    const lunes = semanas[0].dias.find((d) => d.dia === 'lun')
    expect(lunes.series_objetivo).toBeNull()
  })

  it('el domingo de descanso queda activo con duración 0', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    const domingo = semanas[0].dias.find((d) => d.dia === 'dom')
    expect(domingo.activo).toBe(true)
    expect(domingo.duracion_min).toBe(0)
  })

  it('lee el estilo y la zona de cada sesión', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    const jueves = semanas[0].dias.find((d) => d.dia === 'jue')
    expect(jueves.estilo_sesion).toBe('Sweet Spot')
    expect(jueves.zona_objetivo).toBe('Z3')
  })

  it('la semana 2 sube el volumen respecto de la 1', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    const total = (s) => s.dias.reduce((a, d) => a + (d.duracion_min || 0), 0)
    expect(total(semanas[1]) > total(semanas[0])).toBe(true)
  })
})

describe('generarSesionesDesdeSemanas con la planilla real', () => {
  it('genera una sesión por día activo', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    // 2026-08-31 es lunes
    const sesiones = generarSesionesDesdeSemanas(new Date('2026-08-31T12:00:00'), semanas, 'meso-1', 'user-1')
    const activos = semanas.reduce((a, s) => a + s.dias.filter((d) => d.activo).length, 0)
    expect(sesiones).toHaveLength(activos)
  })

  it('la primera sesión cae en el lunes de inicio', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    const sesiones = generarSesionesDesdeSemanas(new Date('2026-08-31T12:00:00'), semanas, 'meso-1', 'user-1')
    expect(sesiones[0].fecha).toBe('2026-08-31')
  })

  it('las fechas avanzan una semana por bloque', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    const sesiones = generarSesionesDesdeSemanas(new Date('2026-08-31T12:00:00'), semanas, 'meso-1', 'user-1')
    // El lunes de la semana 2 es 7 días después
    const lunesSemana2 = sesiones.find((s) => s.fecha === '2026-09-07')
    expect(lunesSemana2).not.toBe(undefined)
  })

  it('todas las fechas quedan en formato local YYYY-MM-DD', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    const sesiones = generarSesionesDesdeSemanas(new Date('2026-08-31T12:00:00'), semanas, 'meso-1', 'user-1')
    for (const s of sesiones) {
      expect(/^\d{4}-\d{2}-\d{2}$/.test(s.fecha)).toBe(true)
    }
  })

  it('ninguna fecha se corre de día al generarse', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    const sesiones = generarSesionesDesdeSemanas(new Date('2026-08-31T12:00:00'), semanas, 'meso-1', 'user-1')
    // El mesociclo arranca lunes: ninguna sesión puede caer antes de esa fecha
    for (const s of sesiones) {
      expect(s.fecha >= '2026-08-31').toBe(true)
    }
    // 4 semanas = 28 días, la última no puede pasarse
    for (const s of sesiones) {
      expect(s.fecha <= '2026-09-27').toBe(true)
    }
  })

  it('propaga mesociclo_id y user_id a cada sesión', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    const sesiones = generarSesionesDesdeSemanas(new Date('2026-08-31T12:00:00'), semanas, 'meso-1', 'user-1')
    for (const s of sesiones) {
      expect(s.mesociclo_id).toBe('meso-1')
      expect(s.user_id).toBe('user-1')
    }
  })

  it('omite user_id si no se pasa', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    const sesiones = generarSesionesDesdeSemanas(new Date('2026-08-31T12:00:00'), semanas, 'meso-1', null)
    expect('user_id' in sesiones[0]).toBe(false)
  })

  it('todas las sesiones nacen pendientes', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    const sesiones = generarSesionesDesdeSemanas(new Date('2026-08-31T12:00:00'), semanas, 'meso-1', 'user-1')
    for (const s of sesiones) {
      expect(s.estado).toBe('pendiente')
    }
  })

  it('conserva las sesiones clave al generar', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    const sesiones = generarSesionesDesdeSemanas(new Date('2026-08-31T12:00:00'), semanas, 'meso-1', 'user-1')
    const claves = sesiones.filter((s) => s.es_clave)
    // Dos por semana en las tres de carga, y solo el retest de FTP en la
    // semana 4 de descarga: 7 en total, no 8. La asimetría es intencional.
    expect(claves).toHaveLength(7)
  })

  it('la semana de descarga conserva solo el retest de FTP como clave', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    const claves4 = semanas[3].dias.filter((d) => d.es_clave)
    expect(claves4).toHaveLength(1)
    expect(claves4[0].dia).toBe('jue')
  })

  it('los campos numéricos salen como número o null, nunca como texto', async () => {
    const { semanas } = await parsearPlanillaBici(cargarPlanilla())
    const sesiones = generarSesionesDesdeSemanas(new Date('2026-08-31T12:00:00'), semanas, 'meso-1', 'user-1')
    for (const s of sesiones) {
      for (const campo of ['duracion_min', 'series_objetivo', 'repeticiones_objetivo']) {
        const v = s[campo]
        expect(v === null || typeof v === 'number').toBe(true)
      }
    }
  })
})
