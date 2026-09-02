import { describe, it, expect } from 'vitest'
import {
  calcularBMR, calcularTDEE, calcularEdad, calcularTDEEDinamico,
  NIVELES_ACTIVIDAD, FACTOR_NEAT_BASE
} from './tdee'
import { DURACIONES_CURVA, etiquetaDuracion, calcularMejoresPotencias } from './potenciaCurva'

describe('calcularBMR (Mifflin-St Jeor)', () => {
  it('hombre de 70kg, 175cm, 40 años', () => {
    // 10*70 + 6.25*175 - 5*40 + 5 = 700 + 1093.75 - 200 + 5
    expect(calcularBMR({ peso: 70, altura: 175, edad: 40 })).toBeCloseTo(1598.75, 1)
  })

  it('la fórmula femenina da menos que la masculina a igual medida', () => {
    const base = { peso: 70, altura: 175, edad: 40 }
    expect(calcularBMR({ ...base, sexo: 'F' })).toBeLessThan(calcularBMR({ ...base, sexo: 'M' }))
  })

  it('devuelve null si falta cualquier dato', () => {
    expect(calcularBMR({ peso: 70, altura: 175 })).toBeNull()
    expect(calcularBMR({ peso: 70, edad: 40 })).toBeNull()
    expect(calcularBMR({ altura: 175, edad: 40 })).toBeNull()
    expect(calcularBMR({})).toBeNull()
  })

  it('acepta valores en texto (vienen de inputs)', () => {
    expect(calcularBMR({ peso: '70', altura: '175', edad: '40' })).toBeCloseTo(1598.75, 1)
  })
})

describe('calcularTDEE', () => {
  it('aplica el factor del nivel de actividad', () => {
    const perfil = { peso: 70, altura: 175, edad: 40, nivel_actividad: 'alto' }
    const bmr = calcularBMR(perfil)
    expect(calcularTDEE(perfil)).toBe(Math.round(bmr * 1.725))
  })

  it('a mayor nivel de actividad, mayor TDEE', () => {
    const base = { peso: 70, altura: 175, edad: 40 }
    const sedentario = calcularTDEE({ ...base, nivel_actividad: 'sedentario' })
    const muyAlto = calcularTDEE({ ...base, nivel_actividad: 'muy_alto' })
    expect(muyAlto).toBeGreaterThan(sedentario)
  })

  it('sin nivel válido cae a moderado', () => {
    const base = { peso: 70, altura: 175, edad: 40 }
    expect(calcularTDEE({ ...base, nivel_actividad: 'inventado' }))
      .toBe(calcularTDEE({ ...base, nivel_actividad: 'moderado' }))
  })

  it('devuelve null si no se puede calcular el BMR', () => {
    expect(calcularTDEE({ peso: 70 })).toBeNull()
  })

  it('todos los niveles tienen id, label y factor', () => {
    for (const n of NIVELES_ACTIVIDAD) {
      expect(typeof n.id).toBe('string')
      expect(typeof n.label).toBe('string')
      expect(n.factor > 1).toBe(true)
    }
  })
})

describe('calcularEdad', () => {
  it('sin fecha devuelve null', () => {
    expect(calcularEdad(null)).toBeNull()
    expect(calcularEdad('')).toBeNull()
  })

  it('descuenta el año si todavía no cumplió', () => {
    const hoy = new Date()
    const d = new Date(hoy.getFullYear() - 30, hoy.getMonth(), hoy.getDate())
    d.setDate(d.getDate() + 1) // cumple mañana
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(calcularEdad(iso)).toBe(29)
  })

  it('cuenta el año completo si ya cumplió', () => {
    const hoy = new Date()
    const d = new Date(hoy.getFullYear() - 30, hoy.getMonth(), hoy.getDate())
    d.setDate(d.getDate() - 1) // cumplió ayer
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(calcularEdad(iso)).toBe(30)
  })
})

describe('calcularTDEEDinamico', () => {
  it('suma el gasto real al BMR sedentario', () => {
    expect(calcularTDEEDinamico({ bmr: 1600, caloriasActivas: 800 }))
      .toBe(Math.round(1600 * FACTOR_NEAT_BASE + 800))
  })

  it('sin calorías activas equivale al piso sedentario', () => {
    expect(calcularTDEEDinamico({ bmr: 1600, caloriasActivas: 0 }))
      .toBe(Math.round(1600 * FACTOR_NEAT_BASE))
  })

  it('sin BMR devuelve null', () => {
    expect(calcularTDEEDinamico({ bmr: null, caloriasActivas: 800 })).toBeNull()
  })

  it('un día de fondo largo da más que un día sin entrenar', () => {
    const suave = calcularTDEEDinamico({ bmr: 1600, caloriasActivas: 0 })
    const fondo = calcularTDEEDinamico({ bmr: 1600, caloriasActivas: 3000 })
    expect(fondo).toBeGreaterThan(suave)
  })
})

describe('etiquetaDuracion', () => {
  it('segundos por debajo del minuto', () => {
    expect(etiquetaDuracion(30)).toBe('30s')
  })

  it('minutos a partir de 60 segundos', () => {
    expect(etiquetaDuracion(300)).toBe('5min')
    expect(etiquetaDuracion(3600)).toBe('60min')
  })
})

describe('calcularMejoresPotencias', () => {
  it('serie vacía o inválida devuelve lista vacía', () => {
    expect(calcularMejoresPotencias([])).toEqual([])
    expect(calcularMejoresPotencias(null)).toEqual([])
  })

  it('omite las duraciones más largas que la serie', () => {
    const serie = new Array(10).fill(200) // 10 segundos
    const r = calcularMejoresPotencias(serie)
    expect(r).toHaveLength(1) // solo la ventana de 5s entra
    expect(r[0].duracion_seg).toBe(5)
  })

  it('con potencia constante, todas las ventanas dan ese valor', () => {
    const serie = new Array(400).fill(250)
    for (const p of calcularMejoresPotencias(serie)) {
      expect(p.watts).toBe(250)
    }
  })

  it('encuentra el mejor tramo, no el primero ni el promedio', () => {
    // 100 segundos flojos y después 100 fuertes
    const serie = [...new Array(100).fill(100), ...new Array(100).fill(400)]
    const cinco = calcularMejoresPotencias(serie).find((p) => p.duracion_seg === 5)
    expect(cinco.watts).toBe(400)
  })

  it('la mejor potencia sostenida nunca sube al alargar la ventana', () => {
    const serie = Array.from({ length: 4000 }, (_, i) => 150 + (i % 300))
    const r = calcularMejoresPotencias(serie)
    for (let i = 1; i < r.length; i++) {
      expect(r[i].watts <= r[i - 1].watts).toBe(true)
    }
  })

  it('trata los huecos de la serie como cero, no como NaN', () => {
    const serie = [200, undefined, 200, null, 200, 200]
    const r = calcularMejoresPotencias(serie)
    expect(Number.isNaN(r[0].watts)).toBe(false)
  })

  it('devuelve las duraciones en el orden de DURACIONES_CURVA', () => {
    const serie = new Array(4000).fill(200)
    const r = calcularMejoresPotencias(serie)
    expect(r.map((p) => p.duracion_seg)).toEqual(DURACIONES_CURVA.filter((d) => d <= 4000))
  })
})
