import { describe, it, expect } from 'vitest'
import { calcularTSS, calcularCargaDiaria, construirSerieDiaria, interpretarTSB } from './tss'

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
