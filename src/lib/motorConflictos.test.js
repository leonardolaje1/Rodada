import { describe, it, expect } from 'vitest'
import { detectarConflictosCalendario, detectarSobrecargaSemanal } from './motorConflictos'

// 2026-03-16 es lunes; el resto de las fechas de este archivo se apoyan en eso.
const LUNES = '2026-03-16'
const MARTES = '2026-03-17'
const MIERCOLES = '2026-03-18'
const JUEVES = '2026-03-19'
const VIERNES = '2026-03-20'
const SABADO = '2026-03-21'

const ent = (fecha, extra = {}) => ({ fecha, tipo: 'Ruta', tss: 40, ...extra })
const gym = (fecha, extra = {}) => ({ fecha, ejercicio: 'Sentadilla', ...extra })

describe('detectarConflictosCalendario', () => {
  it('sin sesiones clave no hay conflictos', () => {
    const r = detectarConflictosCalendario({
      entrenamientos: [ent(LUNES), ent(MARTES)],
      gimnasio: [gym(LUNES)]
    })
    expect(r).toEqual([])
  })

  it('sin datos devuelve lista vacía', () => {
    expect(detectarConflictosCalendario({})).toEqual([])
  })

  // --- Regla 1: gimnasio el día previo a una clave ---

  it('avisa si hay gimnasio el día anterior a una sesión clave', () => {
    const r = detectarConflictosCalendario({
      entrenamientos: [ent(MIERCOLES, { es_clave: true })],
      gimnasio: [gym(MARTES)]
    })
    expect(r).toHaveLength(1)
    expect(r[0].tipo).toBe('carga_previa_a_clave')
  })

  it('no avisa si el gimnasio es dos días antes', () => {
    const r = detectarConflictosCalendario({
      entrenamientos: [ent(MIERCOLES, { es_clave: true })],
      gimnasio: [gym(LUNES)]
    })
    expect(r).toEqual([])
  })

  it('sugiere mover el gimnasio a un día libre', () => {
    const r = detectarConflictosCalendario({
      entrenamientos: [ent(JUEVES, { es_clave: true })],
      gimnasio: [gym(MIERCOLES)]
    })
    expect(r[0].sugerencia).not.toBeNull()
    expect(r[0].sugerencia.mover.tabla).toBe('gimnasio')
    expect(r[0].sugerencia.mover.fecha_origen).toBe(MIERCOLES)
  })

  it('no sugiere mover a un día que ya tiene gimnasio', () => {
    // Jueves clave. Candidatos: lunes (-3) y martes (-2), ambos ocupados.
    const r = detectarConflictosCalendario({
      entrenamientos: [ent(JUEVES, { es_clave: true })],
      gimnasio: [gym(MIERCOLES), gym(MARTES), gym(LUNES)]
    })
    const conflicto = r.find((c) => c.id.startsWith('gym-previo'))
    expect(conflicto.sugerencia).toBeNull()
  })

  it('no sugiere mover el gimnasio encima de otro día clave', () => {
    const r = detectarConflictosCalendario({
      entrenamientos: [ent(JUEVES, { es_clave: true }), ent(LUNES, { es_clave: true }), ent(MARTES, { es_clave: true })],
      gimnasio: [gym(MIERCOLES)]
    })
    const conflicto = r.find((c) => c.id === `gym-previo-${JUEVES}`)
    expect(conflicto.sugerencia).toBeNull()
  })

  it('una sesión de gimnasio marcada como clave también cuenta como día clave', () => {
    const r = detectarConflictosCalendario({
      entrenamientos: [],
      gimnasio: [gym(MIERCOLES, { es_clave: true }), gym(MARTES)]
    })
    expect(r).toHaveLength(1)
  })

  // --- Regla 2: TSS alto el día previo ---

  it('avisa si el día anterior tuvo TSS alto', () => {
    const r = detectarConflictosCalendario({
      entrenamientos: [ent(MIERCOLES, { es_clave: true }), ent(MARTES, { tss: 120 })]
    })
    expect(r.some((c) => c.id.startsWith('tss-previo'))).toBe(true)
  })

  it('no avisa si el TSS del día anterior es bajo', () => {
    const r = detectarConflictosCalendario({
      entrenamientos: [ent(MIERCOLES, { es_clave: true }), ent(MARTES, { tss: 30 })]
    })
    expect(r).toEqual([])
  })

  it('suma el TSS de varias salidas del mismo día', () => {
    // 50 + 50 = 100, supera el umbral aunque ninguna sola lo haga
    const r = detectarConflictosCalendario({
      entrenamientos: [ent(MIERCOLES, { es_clave: true }), ent(MARTES, { tss: 50 }), ent(MARTES, { tss: 50 })]
    })
    expect(r.some((c) => c.id.startsWith('tss-previo'))).toBe(true)
  })

  it('trata el TSS ausente como cero, no como NaN', () => {
    const r = detectarConflictosCalendario({
      entrenamientos: [ent(MIERCOLES, { es_clave: true }), { fecha: MARTES, tipo: 'Ruta' }]
    })
    expect(r).toEqual([])
  })

  // --- Regla 3: dos claves consecutivas ---

  it('avisa por dos sesiones clave en días seguidos', () => {
    const r = detectarConflictosCalendario({
      entrenamientos: [ent(MARTES, { es_clave: true, tss: 10 }), ent(MIERCOLES, { es_clave: true, tss: 10 })]
    })
    expect(r.some((c) => c.tipo === 'clave_consecutiva')).toBe(true)
  })

  it('no avisa si las claves están separadas por un día', () => {
    const r = detectarConflictosCalendario({
      entrenamientos: [ent(LUNES, { es_clave: true, tss: 10 }), ent(MIERCOLES, { es_clave: true, tss: 10 })]
    })
    expect(r.some((c) => c.tipo === 'clave_consecutiva')).toBe(false)
  })

  // --- Contrato de salida ---

  it('los conflictos vienen ordenados por fecha', () => {
    const r = detectarConflictosCalendario({
      entrenamientos: [ent(SABADO, { es_clave: true }), ent(MIERCOLES, { es_clave: true })],
      gimnasio: [gym(VIERNES), gym(MARTES)]
    })
    const fechas = r.map((c) => c.fecha)
    expect(fechas).toEqual([...fechas].sort())
  })

  it('cada conflicto trae id, fecha, tipo, mensaje y fuente', () => {
    const r = detectarConflictosCalendario({
      entrenamientos: [ent(MIERCOLES, { es_clave: true })],
      gimnasio: [gym(MARTES)]
    })
    for (const c of r) {
      expect(typeof c.id).toBe('string')
      expect(typeof c.fecha).toBe('string')
      expect(typeof c.mensaje).toBe('string')
      expect(c.fuente).toBe('reglas')
    }
  })

  it('los ids son únicos aunque haya varios conflictos el mismo día', () => {
    const r = detectarConflictosCalendario({
      entrenamientos: [ent(MIERCOLES, { es_clave: true }), ent(MARTES, { tss: 120 })],
      gimnasio: [gym(MARTES)]
    })
    const ids = r.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('detectarSobrecargaSemanal', () => {
  // Genera días consecutivos de actividad terminando en fechaHoy
  const rachaDe = (dias, hasta) => {
    const salida = []
    const d = new Date(`${hasta}T12:00:00`)
    for (let i = 0; i < dias; i++) {
      const c = new Date(d)
      c.setDate(c.getDate() - i)
      salida.push({ fecha: c.toISOString().slice(0, 10), tss: 50 })
    }
    return salida
  }

  it('no avisa con pocos días seguidos', () => {
    expect(detectarSobrecargaSemanal({
      entrenamientos: rachaDe(3, VIERNES), fechaHoy: VIERNES
    })).toBeNull()
  })

  it('avisa a partir de 7 días seguidos', () => {
    const r = detectarSobrecargaSemanal({
      entrenamientos: rachaDe(7, VIERNES), fechaHoy: VIERNES
    })
    expect(r).not.toBeNull()
    expect(r.diasSeguidos).toBe(7)
  })

  it('cuenta la racha real, no solo el umbral', () => {
    const r = detectarSobrecargaSemanal({
      entrenamientos: rachaDe(12, VIERNES), fechaHoy: VIERNES
    })
    expect(r.diasSeguidos).toBe(12)
  })

  it('un día de descanso corta la racha', () => {
    // 10 días de actividad pero con un hueco: la racha desde hoy es corta
    const conHueco = rachaDe(10, VIERNES).filter((e) => e.fecha !== MIERCOLES)
    const r = detectarSobrecargaSemanal({ entrenamientos: conHueco, fechaHoy: VIERNES })
    expect(r).toBeNull()
  })

  it('el gimnasio también cuenta como día con actividad', () => {
    const r = detectarSobrecargaSemanal({
      entrenamientos: [],
      gimnasio: rachaDe(8, VIERNES).map((e) => ({ fecha: e.fecha })),
      fechaHoy: VIERNES
    })
    expect(r.diasSeguidos).toBe(8)
  })

  it('una sesión de ciclismo con TSS 0 no cuenta como actividad', () => {
    const sinCarga = rachaDe(8, VIERNES).map((e) => ({ ...e, tss: 0 }))
    expect(detectarSobrecargaSemanal({ entrenamientos: sinCarga, fechaHoy: VIERNES })).toBeNull()
  })

  it('si hoy no hubo actividad, no hay racha', () => {
    const hastaAyer = rachaDe(10, JUEVES)
    expect(detectarSobrecargaSemanal({ entrenamientos: hastaAyer, fechaHoy: VIERNES })).toBeNull()
  })

  it('sin datos devuelve null', () => {
    expect(detectarSobrecargaSemanal({ fechaHoy: VIERNES })).toBeNull()
  })
})
