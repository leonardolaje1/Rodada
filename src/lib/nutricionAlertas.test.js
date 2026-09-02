import { describe, it, expect } from 'vitest'
import { evaluarDeficitNutricional } from './nutricionAlertas'
import { aFechaLocal } from './fechas'

// El motor mira los 5 días ANTERIORES a hoy (no incluye hoy, que aún está en curso).
const diasPrevios = (n = 5) => {
  const salida = []
  const hoy = new Date()
  for (let i = 1; i <= n; i++) {
    const d = new Date(hoy)
    d.setDate(d.getDate() - i)
    salida.push(aFechaLocal(d))
  }
  return salida
}

// Genera una comida por día con las kcal y proteínas indicadas
const comidasPorDia = (kcal, proteinas, dias = diasPrevios()) =>
  dias.map((fecha) => ({ fecha, kcal, proteinas }))

const TDEE = 3000
const PESO = 70 // objetivo de proteína: 70 * 1.6 = 112 g

describe('evaluarDeficitNutricional', () => {
  it('sin TDEE ni peso no evalúa nada', () => {
    expect(evaluarDeficitNutricional({ comidas: comidasPorDia(1000, 50) })).toEqual([])
  })

  it('comiendo acorde al TDEE no hay alerta calórica', () => {
    const alertas = evaluarDeficitNutricional({
      comidas: comidasPorDia(3000, 120), tdee: TDEE, pesoKg: PESO
    })
    expect(alertas.some((a) => a.tipo === 'kcal')).toBe(false)
  })

  it('cinco días seguidos por debajo del 85% dispara la alerta', () => {
    // 2000 < 3000 * 0.85 = 2550
    const alertas = evaluarDeficitNutricional({
      comidas: comidasPorDia(2000, 120), tdee: TDEE, pesoKg: PESO
    })
    expect(alertas.some((a) => a.tipo === 'kcal')).toBe(true)
  })

  it('justo por encima del umbral del 85% no dispara', () => {
    const alertas = evaluarDeficitNutricional({
      comidas: comidasPorDia(2600, 120), tdee: TDEE, pesoKg: PESO
    })
    expect(alertas.some((a) => a.tipo === 'kcal')).toBe(false)
  })

  it('un solo día bien corta la racha y no alerta', () => {
    const dias = diasPrevios()
    const comidas = dias.map((fecha, i) => ({
      fecha, kcal: i === 2 ? 3000 : 2000, proteinas: 120
    }))
    const alertas = evaluarDeficitNutricional({ comidas, tdee: TDEE, pesoKg: PESO })
    expect(alertas.some((a) => a.tipo === 'kcal')).toBe(false)
  })

  it('si falta el registro de algún día no evalúa (datos incompletos)', () => {
    // Solo 4 de los 5 días cargados
    const comidas = comidasPorDia(1500, 40, diasPrevios(5).slice(0, 4))
    expect(evaluarDeficitNutricional({ comidas, tdee: TDEE, pesoKg: PESO })).toEqual([])
  })

  it('suma todas las comidas del mismo día', () => {
    // Cuatro comidas de 800 = 3200 por día, por encima del objetivo
    const dias = diasPrevios()
    const comidas = dias.flatMap((fecha) =>
      [0, 1, 2, 3].map(() => ({ fecha, kcal: 800, proteinas: 35 }))
    )
    const alertas = evaluarDeficitNutricional({ comidas, tdee: TDEE, pesoKg: PESO })
    expect(alertas).toEqual([])
  })

  it('un día de fondo largo sube el objetivo y evita el falso positivo', () => {
    // 2700 kcal parecerían déficit contra un TDEE fijo de 3000... pero con
    // 2000 kcal activas ese día el objetivo real es mucho mayor. Lo que se
    // verifica es que el TDEE dinámico se usa cuando hay calorías activas.
    const dias = diasPrevios()
    const entrenamientos = dias.map((fecha) => ({ fecha, calorias: 2000 }))
    const conEntrenos = evaluarDeficitNutricional({
      comidas: comidasPorDia(2700, 120), tdee: TDEE, bmr: 1700, entrenamientos, pesoKg: PESO
    })
    const sinEntrenos = evaluarDeficitNutricional({
      comidas: comidasPorDia(2700, 120), tdee: TDEE, pesoKg: PESO
    })
    // Sin entrenamientos: 2700 > 2550, no alerta.
    expect(sinEntrenos.some((a) => a.tipo === 'kcal')).toBe(false)
    // Con 2000 kcal activas por día, 2700 sí queda muy por debajo.
    expect(conEntrenos.some((a) => a.tipo === 'kcal')).toBe(true)
  })

  it('sin BMR no usa el TDEE dinámico aunque haya entrenamientos', () => {
    const dias = diasPrevios()
    const entrenamientos = dias.map((fecha) => ({ fecha, calorias: 2000 }))
    const alertas = evaluarDeficitNutricional({
      comidas: comidasPorDia(2700, 120), tdee: TDEE, entrenamientos, pesoKg: PESO
    })
    expect(alertas.some((a) => a.tipo === 'kcal')).toBe(false)
  })

  it('un día sin entrenar usa el TDEE estático', () => {
    const dias = diasPrevios()
    const entrenamientos = dias.map((fecha) => ({ fecha, calorias: 0 }))
    const alertas = evaluarDeficitNutricional({
      comidas: comidasPorDia(2000, 120), tdee: TDEE, bmr: 1700, entrenamientos, pesoKg: PESO
    })
    expect(alertas.some((a) => a.tipo === 'kcal')).toBe(true)
  })

  // --- Proteína ---

  it('proteína suficiente no dispara alerta', () => {
    const alertas = evaluarDeficitNutricional({
      comidas: comidasPorDia(3000, 120), tdee: TDEE, pesoKg: PESO
    })
    expect(alertas.some((a) => a.tipo === 'proteina')).toBe(false)
  })

  it('cinco días con poca proteína disparan la alerta', () => {
    // Objetivo: 70 * 1.6 * 0.85 = 95.2 g
    const alertas = evaluarDeficitNutricional({
      comidas: comidasPorDia(3000, 60), tdee: TDEE, pesoKg: PESO
    })
    expect(alertas.some((a) => a.tipo === 'proteina')).toBe(true)
  })

  it('sin peso no evalúa proteína', () => {
    const alertas = evaluarDeficitNutricional({
      comidas: comidasPorDia(3000, 10), tdee: TDEE
    })
    expect(alertas.some((a) => a.tipo === 'proteina')).toBe(false)
  })

  it('el objetivo de proteína escala con el peso', () => {
    // 100 g alcanza para 60 kg (96 g objetivo) pero no para 90 kg (144 g)
    const liviano = evaluarDeficitNutricional({
      comidas: comidasPorDia(3000, 100), tdee: TDEE, pesoKg: 60
    })
    const pesado = evaluarDeficitNutricional({
      comidas: comidasPorDia(3000, 100), tdee: TDEE, pesoKg: 90
    })
    expect(liviano.some((a) => a.tipo === 'proteina')).toBe(false)
    expect(pesado.some((a) => a.tipo === 'proteina')).toBe(true)
  })

  it('las dos alertas pueden aparecer juntas', () => {
    const alertas = evaluarDeficitNutricional({
      comidas: comidasPorDia(1500, 40), tdee: TDEE, pesoKg: PESO
    })
    expect(alertas).toHaveLength(2)
  })

  // --- Contrato de salida ---

  it('cada alerta trae tipo, titulo y mensaje', () => {
    const alertas = evaluarDeficitNutricional({
      comidas: comidasPorDia(1500, 40), tdee: TDEE, pesoKg: PESO
    })
    for (const a of alertas) {
      expect(typeof a.tipo).toBe('string')
      expect(typeof a.titulo).toBe('string')
      expect(typeof a.mensaje).toBe('string')
    }
  })

  it('trata kcal y proteínas ausentes como cero, no como NaN', () => {
    const dias = diasPrevios()
    const comidas = dias.map((fecha) => ({ fecha }))
    const alertas = evaluarDeficitNutricional({ comidas, tdee: TDEE, pesoKg: PESO })
    expect(alertas.some((a) => a.mensaje.includes('NaN'))).toBe(false)
  })

  it('ignora las comidas de hoy: el día todavía está en curso', () => {
    const comidas = [
      ...comidasPorDia(3000, 120),
      { fecha: aFechaLocal(new Date()), kcal: 100, proteinas: 5 }
    ]
    const alertas = evaluarDeficitNutricional({ comidas, tdee: TDEE, pesoKg: PESO })
    expect(alertas).toEqual([])
  })
})
