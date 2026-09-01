import { describe, it, expect } from 'vitest'
import { calcularTSS, calcularCargaDiaria, construirSerieDiaria, interpretarTSB, calcularCargaConWarmup } from './tss'
import { aFechaLocal } from './fechas'

describe('calcularTSS', () => {
  it('usa el tss guardado directamente si ya existe', () => {
    expect(calcularTSS({ tss: 85 })).toBe(85)
  })

  it('devuelve 0 si no hay duración cargada', () => {
    expect(calcularTSS({})).toBe(0)
  })

  it('calcula con Intensity Factor: 60 min a IF 1.0 da 100 TSS', () => {
    expect(calcularTSS({ duracion_min: 60, if: 1.0 })).toBe(100)
  })

  it('calcula con Intensity Factor: 60 min a IF 0.8 (200W/250W FTP) da 64 TSS', () => {
    expect(calcularTSS({ duracion_min: 60, if: 0.8 })).toBe(64)
  })

  it('calcula con RPE cuando no hay potencia: 60 min a RPE 5 da 45', () => {
    expect(calcularTSS({ duracion_min: 60, rpe: 5 })).toBe(45)
  })

  it('prioriza Intensity Factor sobre RPE si ambos están presentes', () => {
    const resultado = calcularTSS({ duracion_min: 60, if: 1.0, rpe: 5 })
    expect(resultado).toBe(100)
  })

  it('devuelve 0 sin potencia ni RPE, aunque haya duración', () => {
    expect(calcularTSS({ duracion_min: 60 })).toBe(0)
  })
})

describe('calcularCargaDiaria', () => {
  it('con TSS 0 todos los días, CTL/ATL/TSB quedan en 0', () => {
    const dias = [{ fecha: '2026-01-01', tss: 0 }, { fecha: '2026-01-02', tss: 0 }]
    const resultado = calcularCargaDiaria(dias)
    expect(resultado[1].ctl).toBe(0)
    expect(resultado[1].atl).toBe(0)
    expect(resultado[1].tsb).toBe(0)
  })

  it('un solo día con TSS alto sube más el ATL (7 días) que el CTL (42 días)', () => {
    const dias = [{ fecha: '2026-01-01', tss: 100 }]
    const resultado = calcularCargaDiaria(dias)
    expect(resultado[0].atl).toBeGreaterThan(resultado[0].ctl)
  })

  it('el TSB es siempre CTL menos ATL', () => {
    const dias = [
      { fecha: '2026-01-01', tss: 80 },
      { fecha: '2026-01-02', tss: 40 },
      { fecha: '2026-01-03', tss: 0 }
    ]
    const resultado = calcularCargaDiaria(dias)
    for (const dia of resultado) {
      expect(dia.tsb).toBeCloseTo(dia.ctl - dia.atl, 1)
    }
  })

  it('mantiene el mismo largo de array que la entrada', () => {
    const dias = [{ fecha: '2026-01-01', tss: 50 }, { fecha: '2026-01-02', tss: 60 }, { fecha: '2026-01-03', tss: 0 }]
    expect(calcularCargaDiaria(dias)).toHaveLength(3)
  })
})

describe('construirSerieDiaria', () => {
  it('rellena con TSS 0 los días sin entrenamiento', () => {
    const serie = construirSerieDiaria([], '2026-01-01', '2026-01-03')
    expect(serie).toEqual([
      { fecha: '2026-01-01', tss: 0 },
      { fecha: '2026-01-02', tss: 0 },
      { fecha: '2026-01-03', tss: 0 }
    ])
  })

  it('suma el TSS de varios entrenamientos en el mismo día', () => {
    const entrenamientos = [
      { fecha: '2026-01-01', tss: 50 },
      { fecha: '2026-01-01', tss: 30 }
    ]
    const serie = construirSerieDiaria(entrenamientos, '2026-01-01', '2026-01-01')
    expect(serie[0].tss).toBe(80)
  })

  it('devuelve un elemento por cada día del rango, inclusive', () => {
    const serie = construirSerieDiaria([], '2026-01-01', '2026-01-05')
    expect(serie).toHaveLength(5)
  })
})

describe('interpretarTSB', () => {
  it('TSB muy alto se interpreta como posible pérdida de forma', () => {
    expect(interpretarTSB(25).color).toBe('route')
  })

  it('TSB en zona óptima de entrenamiento da color hiviz', () => {
    expect(interpretarTSB(-5).color).toBe('hiviz')
  })

  it('TSB muy negativo indica riesgo de sobreentrenamiento', () => {
    expect(interpretarTSB(-35).color).toBe('red')
  })

  it('TSB moderadamente negativo indica fatiga acumulada', () => {
    expect(interpretarTSB(-20).color).toBe('amber')
  })
})

describe('calcularCargaDiaria con semilla', () => {
  it('sin semilla arranca en cero (comportamiento previo intacto)', () => {
    const r = calcularCargaDiaria([{ fecha: '2026-01-01', tss: 0 }])
    expect(r[0].ctl).toBe(0)
    expect(r[0].atl).toBe(0)
  })

  it('con semilla arranca desde el CTL/ATL previo', () => {
    const r = calcularCargaDiaria([{ fecha: '2026-01-01', tss: 0 }], { ctl: 60, atl: 40 })
    expect(r[0].ctl).toBeGreaterThan(55)
    expect(r[0].atl).toBeLessThan(40)
  })

  it('una semilla inválida se trata como cero, no rompe', () => {
    const r = calcularCargaDiaria([{ fecha: '2026-01-01', tss: 100 }], { ctl: undefined, atl: null })
    expect(r[0].ctl).toBeGreaterThan(0)
  })
})

describe('calcularCargaConWarmup', () => {
  const entrenamientos = Array.from({ length: 200 }, (_, i) => {
    const d = new Date(2025, 0, 1)
    d.setDate(d.getDate() + i)
    return { fecha: aFechaLocal(d), tss: 80 }
  })

  it('devuelve solo los días del rango visible', () => {
    const serie = calcularCargaConWarmup(entrenamientos, '2025-06-01', '2025-06-10')
    expect(serie).toHaveLength(10)
    expect(serie[0].fecha).toBe('2025-06-01')
    expect(serie[serie.length - 1].fecha).toBe('2025-06-10')
  })

  it('el primer día visible ya llega con CTL cargado, no en cero', () => {
    const conWarmup = calcularCargaConWarmup(entrenamientos, '2025-06-01', '2025-06-10')
    const sinWarmup = calcularCargaDiaria(construirSerieDiaria(entrenamientos, '2025-06-01', '2025-06-10'))
    expect(conWarmup[0].ctl).toBeGreaterThan(60)
    expect(sinWarmup[0].ctl).toBeLessThan(5)
  })

  it('el TSB del último día no depende del rango elegido', () => {
    const rangoCorto = calcularCargaConWarmup(entrenamientos, '2025-06-01', '2025-06-10')
    const rangoLargo = calcularCargaConWarmup(entrenamientos, '2025-04-01', '2025-06-10')
    const ultimoCorto = rangoCorto[rangoCorto.length - 1]
    const ultimoLargo = rangoLargo[rangoLargo.length - 1]
    expect(ultimoCorto.tsb).toBeCloseTo(ultimoLargo.tsb, 0)
  })
})
