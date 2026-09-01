import { describe, it, expect } from 'vitest'
import {
  aFechaLocal, hoyLocal, aDateLocal, sumarDiasLocal, hace, inicioSemanaLocal, diasEntreLocal
} from './fechas'

describe('aFechaLocal', () => {
  it('formatea usando los componentes locales, no UTC', () => {
    // 22:30 del 15 de marzo hora local. Con toISOString() en cualquier zona
    // negativa esto se convertía en el 16 — el bug que motivó este archivo.
    const nocheDel15 = new Date(2026, 2, 15, 22, 30, 0)
    expect(aFechaLocal(nocheDel15)).toBe('2026-03-15')
  })

  it('mantiene el día correcto también a primera hora de la mañana', () => {
    expect(aFechaLocal(new Date(2026, 2, 15, 0, 5, 0))).toBe('2026-03-15')
  })

  it('rellena mes y día con cero a la izquierda', () => {
    expect(aFechaLocal(new Date(2026, 0, 3))).toBe('2026-01-03')
  })

  it('devuelve null ante una fecha inválida', () => {
    expect(aFechaLocal('no soy una fecha')).toBeNull()
  })
})

describe('hoyLocal', () => {
  it('devuelve una cadena YYYY-MM-DD', () => {
    expect(hoyLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('coincide con la fecha local del dispositivo', () => {
    const ahora = new Date()
    expect(hoyLocal()).toBe(aFechaLocal(ahora))
  })
})

describe('aDateLocal', () => {
  it('ancla la fecha al mediodía local', () => {
    expect(aDateLocal('2026-03-15').getHours()).toBe(12)
  })

  it('ida y vuelta con aFechaLocal no corre el día', () => {
    expect(aFechaLocal(aDateLocal('2026-03-15'))).toBe('2026-03-15')
  })
})

describe('sumarDiasLocal', () => {
  it('suma días', () => {
    expect(sumarDiasLocal('2026-03-15', 3)).toBe('2026-03-18')
  })

  it('resta días con valores negativos', () => {
    expect(sumarDiasLocal('2026-03-15', -20)).toBe('2026-02-23')
  })

  it('cruza fin de mes correctamente', () => {
    expect(sumarDiasLocal('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('cruza fin de año correctamente', () => {
    expect(sumarDiasLocal('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('respeta los años bisiestos', () => {
    expect(sumarDiasLocal('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('inicioSemanaLocal', () => {
  it('un miércoles devuelve el lunes de esa semana', () => {
    // 2026-03-18 es miércoles
    expect(inicioSemanaLocal('2026-03-18')).toBe('2026-03-16')
  })

  it('un lunes se devuelve a sí mismo', () => {
    expect(inicioSemanaLocal('2026-03-16')).toBe('2026-03-16')
  })

  it('un domingo devuelve el lunes anterior, no el siguiente', () => {
    // 2026-03-22 es domingo
    expect(inicioSemanaLocal('2026-03-22')).toBe('2026-03-16')
  })
})

describe('diasEntreLocal', () => {
  it('cuenta días calendario hacia adelante', () => {
    expect(diasEntreLocal('2026-03-15', '2026-03-25')).toBe(10)
  })

  it('devuelve negativo si la segunda fecha es anterior', () => {
    expect(diasEntreLocal('2026-03-25', '2026-03-15')).toBe(-10)
  })

  it('devuelve 0 para el mismo día', () => {
    expect(diasEntreLocal('2026-03-15', '2026-03-15')).toBe(0)
  })

  it('cuenta bien a través de un cambio de mes', () => {
    expect(diasEntreLocal('2026-01-28', '2026-02-03')).toBe(6)
  })
})

describe('hace', () => {
  it('devuelve una fecha anterior a hoy', () => {
    expect(hace(30) < hoyLocal()).toBe(true)
  })

  it('hace(0) es hoy', () => {
    expect(hace(0)).toBe(hoyLocal())
  })

  it('la distancia hasta hoy es exactamente la pedida', () => {
    expect(diasEntreLocal(hace(90), hoyLocal())).toBe(90)
  })
})
