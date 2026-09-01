import { describe, it, expect } from 'vitest'
import { detectarNecesidadTaper } from './motorTaper'
import { proyectarCarga, proyectarCargaSinEntrenar, calcularCargaDiaria } from './tss'

const competencia = { id: 'c1', nombre: 'Gran Fondo', fecha: '2026-03-20' }

describe('detectarNecesidadTaper', () => {
  it('no avisa si no hay competencia próxima', () => {
    expect(detectarNecesidadTaper({ competenciaProxima: null, tsbActual: -30, ctlActual: 60, fechaHoy: '2026-03-15' })).toBeNull()
  })

  it('no avisa sin TSB calculado', () => {
    expect(detectarNecesidadTaper({ competenciaProxima: competencia, tsbActual: null, ctlActual: 60, fechaHoy: '2026-03-15' })).toBeNull()
  })

  it('no avisa si la competencia ya pasó', () => {
    expect(detectarNecesidadTaper({ competenciaProxima: competencia, tsbActual: -30, ctlActual: 60, fechaHoy: '2026-03-25' })).toBeNull()
  })

  it('no avisa si la competencia está a más de 10 días', () => {
    expect(detectarNecesidadTaper({ competenciaProxima: competencia, tsbActual: -30, ctlActual: 60, fechaHoy: '2026-03-01' })).toBeNull()
  })

  it('avisa cuando la fatiga es alta y faltan pocos días', () => {
    const aviso = detectarNecesidadTaper({ competenciaProxima: competencia, tsbActual: -40, ctlActual: 80, fechaHoy: '2026-03-18' })
    expect(aviso).not.toBeNull()
    expect(aviso.diasRestantes).toBe(2)
    expect(aviso.competencia).toBe('Gran Fondo')
  })

  it('no avisa si ya llega fresco manteniendo su carga habitual', () => {
    // TSB +20 con CTL bajo: aun sosteniendo la carga habitual sigue por encima
    // del objetivo en los pocos días que faltan.
    const aviso = detectarNecesidadTaper({ competenciaProxima: competencia, tsbActual: 20, ctlActual: 30, fechaHoy: '2026-03-19' })
    expect(aviso).toBeNull()
  })

  it('avisa cuando la carga habitual lo deja por debajo del objetivo', () => {
    const aviso = detectarNecesidadTaper({ competenciaProxima: competencia, tsbActual: -40, ctlActual: 80, fechaHoy: '2026-03-10' })
    expect(aviso).not.toBeNull()
    expect(aviso.tsbProyectado).toBeLessThan(5)
  })

  it('informa hasta dónde podría llegar bajando el volumen', () => {
    const aviso = detectarNecesidadTaper({ competenciaProxima: competencia, tsbActual: -40, ctlActual: 80, fechaHoy: '2026-03-15' })
    expect(aviso.tsbSiDescansaTodo).toBeGreaterThan(aviso.tsbProyectado)
    expect(aviso.alcanzable).toBe(true)
  })

  it('la proyección usa la EMA real, no la vieja regla lineal CTL/7', () => {
    // Caso de referencia: CTL 60, TSB -10, 10 días de reposo total.
    // Regla vieja (tsb + ctl/7 * dias) daba ~+76, fisiológicamente imposible.
    // La EMA real da ~+33.
    const proyectado = proyectarCargaSinEntrenar({ ctl: 60, atl: 70 }, 10).tsb
    expect(proyectado).toBeGreaterThan(25)
    expect(proyectado).toBeLessThan(40)
  })
})

describe('proyectarCarga', () => {
  it('con TSS diario igual al CTL, el TSB tiende a cero', () => {
    const r = proyectarCarga({ ctl: 60, atl: 90 }, 20, 60)
    expect(Math.abs(r.tsb)).toBeLessThan(2)
  })

  it('con TSS diario igual al CTL, el CTL se mantiene', () => {
    const r = proyectarCarga({ ctl: 60, atl: 60 }, 10, 60)
    expect(r.ctl).toBeCloseTo(60, 0)
  })

  it('mantener la carga habitual siempre deja peor TSB que descansar', () => {
    const sigue = proyectarCarga({ ctl: 70, atl: 100 }, 7, 70)
    const descansa = proyectarCarga({ ctl: 70, atl: 100 }, 7, 0)
    expect(descansa.tsb).toBeGreaterThan(sigue.tsb)
  })
})

describe('proyectarCargaSinEntrenar', () => {
  it('sin días por delante devuelve los valores actuales', () => {
    const r = proyectarCargaSinEntrenar({ ctl: 60, atl: 70 }, 0)
    expect(r.ctl).toBe(60)
    expect(r.atl).toBe(70)
    expect(r.tsb).toBe(-10)
  })

  it('el ATL decae más rápido que el CTL', () => {
    const r = proyectarCargaSinEntrenar({ ctl: 60, atl: 60 }, 7)
    expect(r.atl).toBeLessThan(r.ctl)
  })

  it('el TSB siempre mejora al no entrenar si se parte de fatiga', () => {
    const r = proyectarCargaSinEntrenar({ ctl: 60, atl: 90 }, 5)
    expect(r.tsb).toBeGreaterThan(-30)
  })

  it('coincide con simular la EMA día a día con TSS 0', () => {
    const dias = Array.from({ length: 10 }, (_, i) => ({ fecha: `2026-03-${String(i + 1).padStart(2, '0')}`, tss: 0 }))
    const simulado = calcularCargaDiaria(dias, { ctl: 60, atl: 70 })
    const proyectado = proyectarCargaSinEntrenar({ ctl: 60, atl: 70 }, 10)
    expect(proyectado.tsb).toBeCloseTo(simulado[simulado.length - 1].tsb, 0)
  })
})
