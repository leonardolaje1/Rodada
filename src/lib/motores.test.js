import { describe, it, expect } from 'vitest'
import { generarInsightRecuperacion } from './motorInsights'
import { detectarOportunidadCalendario } from './motorOportunidades'
import { detectarAvisoHidratacion } from './motorHidratacion'
import { detectarCaidaCargaSemanal } from './motorAnomalias'
import { evaluarFitting, infoNivelFitting } from './bikeFitting'
import { aFechaLocal, sumarDiasLocal } from './fechas'

describe('generarInsightRecuperacion', () => {
  it('sin datos no alarma', () => {
    const r = generarInsightRecuperacion({})
    expect(r.nivel).toBe('optimo')
    expect(r.señales).toEqual([])
  })

  it('TSB muy negativo por sí solo es crítico', () => {
    expect(generarInsightRecuperacion({ tsb: -30 }).nivel).toBe('critico')
  })

  it('TSB moderadamente bajo es atención', () => {
    expect(generarInsightRecuperacion({ tsb: -15 }).nivel).toBe('atencion')
  })

  it('TSB positivo no genera señales', () => {
    expect(generarInsightRecuperacion({ tsb: 10 }).nivel).toBe('optimo')
  })

  it('la regla compuesta necesita las tres señales alineadas', () => {
    const r = generarInsightRecuperacion({
      tsb: -22, atl: 90, historialAtl: [60, 65, 70], hrvActual: 50, historialHrv: [80, 85, 82]
    })
    expect(r.nivel).toBe('critico')
    // Una sola señal que resume las tres, no tres sueltas
    expect(r.señales).toHaveLength(1)
  })

  it('TSB de -22 sin las otras señales no llega a crítico', () => {
    expect(generarInsightRecuperacion({ tsb: -22 }).nivel).toBe('atencion')
  })

  it('dormir poco sube el nivel aunque el TSB esté bien', () => {
    const r = generarInsightRecuperacion({ tsb: 5, sueñoUltimaNoche: 4 })
    expect(r.nivel).toBe('atencion')
  })

  it('dormir bien no agrega señal', () => {
    expect(generarInsightRecuperacion({ tsb: 5, sueñoUltimaNoche: 8 }).señales).toEqual([])
  })

  it('el sueño no baja un nivel crítico ya establecido', () => {
    const r = generarInsightRecuperacion({ tsb: -30, sueñoUltimaNoche: 4 })
    expect(r.nivel).toBe('critico')
    expect(r.señales).toHaveLength(2)
  })

  it('HRV por debajo del 90% del promedio sube a atención', () => {
    const r = generarInsightRecuperacion({ tsb: 5, hrvActual: 60, historialHrv: [80, 82, 78] })
    expect(r.nivel).toBe('atencion')
  })

  it('HRV apenas por debajo del promedio no alcanza', () => {
    const r = generarInsightRecuperacion({ tsb: 5, hrvActual: 78, historialHrv: [80, 82, 78] })
    expect(r.nivel).toBe('optimo')
  })

  it('ignora los valores nulos del historial', () => {
    const r = generarInsightRecuperacion({ tsb: 5, hrvActual: 60, historialHrv: [80, null, 82, undefined] })
    expect(r.nivel).toBe('atencion')
  })

  it('respeta el contrato de salida', () => {
    const r = generarInsightRecuperacion({ tsb: -30 })
    expect(['optimo', 'atencion', 'critico'].includes(r.nivel)).toBe(true)
    expect(Array.isArray(r.señales)).toBe(true)
    expect(typeof r.mensaje).toBe('string')
    expect(r.fuente).toBe('reglas')
  })
})

describe('detectarOportunidadCalendario', () => {
  const base = {
    nivelRecuperacion: 'optimo',
    entrenamientoManana: { estado: 'pendiente', zona_objetivo: 'Z2', duracion_min: 60 },
    fechaManana: '2026-03-18'
  }

  it('sugiere extender cuando todo alinea', () => {
    const r = detectarOportunidadCalendario(base)
    expect(r).not.toBeNull()
    expect(r.duracionSugerida).toBe(90)
  })

  it('no sugiere si la recuperación no es óptima', () => {
    expect(detectarOportunidadCalendario({ ...base, nivelRecuperacion: 'atencion' })).toBeNull()
  })

  it('no sugiere si no hay sesión mañana', () => {
    expect(detectarOportunidadCalendario({ ...base, entrenamientoManana: null })).toBeNull()
  })

  it('no sugiere sobre una sesión ya realizada', () => {
    expect(detectarOportunidadCalendario({
      ...base, entrenamientoManana: { ...base.entrenamientoManana, estado: 'realizado' }
    })).toBeNull()
  })

  it('no sugiere extender una sesión intensa', () => {
    expect(detectarOportunidadCalendario({
      ...base, entrenamientoManana: { ...base.entrenamientoManana, zona_objetivo: 'Z4' }
    })).toBeNull()
  })

  it('no sugiere si la sesión ya es larga', () => {
    expect(detectarOportunidadCalendario({
      ...base, entrenamientoManana: { ...base.entrenamientoManana, duracion_min: 150 }
    })).toBeNull()
  })

  it('redondea la duración sugerida a múltiplos de 5', () => {
    const r = detectarOportunidadCalendario({
      ...base, entrenamientoManana: { ...base.entrenamientoManana, duracion_min: 47 }
    })
    expect(r.duracionSugerida % 5).toBe(0)
  })

  it('no expone ninguna acción de escritura, solo texto', () => {
    const r = detectarOportunidadCalendario(base)
    expect(r.aplicar).toBe(undefined)
    expect(r.mover).toBe(undefined)
    expect(r.fuente).toBe('reglas')
  })
})

describe('detectarAvisoHidratacion', () => {
  it('avisa con salida larga y calor', () => {
    const r = detectarAvisoHidratacion({ duracionMananaMin: 120, tempMaxManana: 32 })
    expect(r).not.toBeNull()
    expect(r.tempMax).toBe(32)
  })

  it('no avisa si la salida es corta', () => {
    expect(detectarAvisoHidratacion({ duracionMananaMin: 45, tempMaxManana: 35 })).toBeNull()
  })

  it('no avisa si no hace calor', () => {
    expect(detectarAvisoHidratacion({ duracionMananaMin: 180, tempMaxManana: 18 })).toBeNull()
  })

  it('no avisa sin pronóstico de temperatura', () => {
    expect(detectarAvisoHidratacion({ duracionMananaMin: 180, tempMaxManana: null })).toBeNull()
  })

  it('no avisa sin sesión planificada', () => {
    expect(detectarAvisoHidratacion({ duracionMananaMin: null, tempMaxManana: 35 })).toBeNull()
  })

  it('redondea la temperatura en el mensaje', () => {
    const r = detectarAvisoHidratacion({ duracionMananaMin: 120, tempMaxManana: 31.7 })
    expect(r.mensaje.includes('32°')).toBe(true)
  })
})

describe('detectarCaidaCargaSemanal', () => {
  // 2026-03-19 es jueves: 3 días transcurridos desde el lunes.
  const JUEVES = '2026-03-19'

  // Genera sesiones para las N semanas previas, mismo TSS cada lunes-jueves
  const semanasPrevias = (tssPorDia, semanas = 4) => {
    const salida = []
    for (let s = 1; s <= semanas; s++) {
      for (let d = 0; d <= 3; d++) {
        salida.push({ fecha: sumarDiasLocal(JUEVES, -7 * s + d - 3), tss: tssPorDia })
      }
    }
    return salida
  }

  it('no evalúa tan temprano en la semana', () => {
    const LUNES = '2026-03-16'
    expect(detectarCaidaCargaSemanal({ entrenamientos: [], fechaHoy: LUNES })).toBeNull()
  })

  it('sin historial suficiente no compara', () => {
    expect(detectarCaidaCargaSemanal({ entrenamientos: [], fechaHoy: JUEVES })).toBeNull()
  })

  it('detecta una caída fuerte respecto al promedio', () => {
    const previas = semanasPrevias(100)
    const estaSemana = [{ fecha: '2026-03-16', tss: 20 }]
    const r = detectarCaidaCargaSemanal({
      entrenamientos: [...previas, ...estaSemana], fechaHoy: JUEVES
    })
    expect(r).not.toBeNull()
    expect(r.caidaPct > 30).toBe(true)
  })

  it('no alerta si la carga se mantiene', () => {
    const previas = semanasPrevias(100)
    const estaSemana = [0, 1, 2, 3].map((d) => ({ fecha: sumarDiasLocal('2026-03-16', d), tss: 100 }))
    expect(detectarCaidaCargaSemanal({
      entrenamientos: [...previas, ...estaSemana], fechaHoy: JUEVES
    })).toBeNull()
  })

  it('no compara contra un promedio anterior muy bajo', () => {
    const previas = semanasPrevias(5)
    expect(detectarCaidaCargaSemanal({ entrenamientos: previas, fechaHoy: JUEVES })).toBeNull()
  })
})

describe('evaluarFitting', () => {
  const hace = (meses) => {
    const d = new Date()
    d.setMonth(d.getMonth() - meses)
    return aFechaLocal(d)
  }

  it('sin estudio cargado devuelve sin_datos', () => {
    expect(evaluarFitting(null, 70).nivel).toBe('sin_datos')
  })

  it('estudio reciente y peso estable está ok', () => {
    const r = evaluarFitting({ fecha: hace(3), peso_ciclista: 70 }, 70)
    expect(r.nivel).toBe('ok')
  })

  it('más de un año es atención', () => {
    expect(evaluarFitting({ fecha: hace(13), peso_ciclista: 70 }, 70).nivel).toBe('atencion')
  })

  it('más de 18 meses es crítico', () => {
    expect(evaluarFitting({ fecha: hace(20), peso_ciclista: 70 }, 70).nivel).toBe('critico')
  })

  it('un cambio de peso del 6% es atención', () => {
    expect(evaluarFitting({ fecha: hace(2), peso_ciclista: 70 }, 74.2).nivel).toBe('atencion')
  })

  it('un cambio de peso del 10% es crítico', () => {
    expect(evaluarFitting({ fecha: hace(2), peso_ciclista: 70 }, 77).nivel).toBe('critico')
  })

  it('el cambio de peso cuenta en las dos direcciones', () => {
    expect(evaluarFitting({ fecha: hace(2), peso_ciclista: 70 }, 63).nivel).toBe('critico')
  })

  it('dolor muscular sostenido dispara crítico', () => {
    const registros = [0, 1, 2].map((i) => ({
      fecha: sumarDiasLocal(aFechaLocal(new Date()), -i), dolor_muscular: 5
    }))
    expect(evaluarFitting({ fecha: hace(2), peso_ciclista: 70 }, 70, registros).nivel).toBe('critico')
  })

  it('ignora el dolor de hace más de una semana', () => {
    const registros = [10, 11, 12].map((i) => ({
      fecha: sumarDiasLocal(aFechaLocal(new Date()), -i), dolor_muscular: 5
    }))
    expect(evaluarFitting({ fecha: hace(2), peso_ciclista: 70 }, 70, registros).nivel).toBe('ok')
  })

  it('se queda con la peor señal, no con la última', () => {
    // Peso estable pero estudio viejísimo
    const r = evaluarFitting({ fecha: hace(20), peso_ciclista: 70 }, 70)
    expect(r.nivel).toBe('critico')
  })

  it('sin motivos reales devuelve un mensaje tranquilizador', () => {
    const r = evaluarFitting({ fecha: hace(1), peso_ciclista: 70 }, 70)
    expect(r.motivos).toHaveLength(1)
  })
})

describe('infoNivelFitting', () => {
  it('cada nivel tiene color y texto', () => {
    for (const nivel of ['ok', 'atencion', 'critico', 'sin_datos']) {
      const info = infoNivelFitting(nivel)
      expect(typeof info.color).toBe('string')
      expect(typeof info.texto).toBe('string')
    }
  })
})
