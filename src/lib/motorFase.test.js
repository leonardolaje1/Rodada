import { describe, it, expect } from 'vitest'
import {
  detectarFasesMesociclo,
  detectarFasesMesocicloGimnasio,
  detectarFasesMesocicloGimnasioDesdeFilas,
  FASES_INFO
} from './motorFase'

// Helper: semana de ciclismo como lista de sesiones planificadas
const sesion = (min, zona) => ({ duracion_min: min, zona_objetivo: zona })

describe('detectarFasesMesociclo (ciclismo)', () => {
  it('devuelve una fase por cada semana recibida', () => {
    const fases = detectarFasesMesociclo([
      [sesion(60, 'Z2')], [sesion(90, 'Z2')], [sesion(120, 'Z2')], [sesion(45, 'Z2')]
    ])
    expect(fases).toHaveLength(4)
  })

  it('marca sin_datos la semana sin sesiones', () => {
    const fases = detectarFasesMesociclo([[sesion(90, 'Z2')], []])
    expect(fases[1].fase).toBe('sin_datos')
  })

  it('la semana de menor volumen del bloque es descarga', () => {
    // 3 semanas cargadas y una muy liviana al final
    const fases = detectarFasesMesociclo([
      [sesion(300, 'Z2')], [sesion(300, 'Z2')], [sesion(300, 'Z2')], [sesion(60, 'Z2')]
    ])
    expect(fases[3].fase).toBe('descarga')
  })

  it('volumen alto en zona baja es construcción, no pico', () => {
    const fases = detectarFasesMesociclo([
      [sesion(300, 'Z2')], [sesion(300, 'Z2')]
    ])
    expect(fases[0].fase).toBe('construccion')
  })

  it('concentrar trabajo en Z4+ marca pico aunque el volumen no sea el mayor', () => {
    const fases = detectarFasesMesociclo([
      [sesion(300, 'Z2')],                      // mucho volumen, suave
      [sesion(200, 'Z5'), sesion(60, 'Z2')]     // menos volumen, muy intenso
    ])
    expect(fases[1].fase).toBe('pico')
  })

  it('sin zona especificada asume intensidad tipo Z2 y no marca pico', () => {
    const fases = detectarFasesMesociclo([[sesion(200, undefined)], [sesion(200, undefined)]])
    expect(fases[0].fase).not.toBe('pico')
  })

  it('expone carga e intensidad como porcentajes enteros', () => {
    const [semana] = detectarFasesMesociclo([[sesion(120, 'Z4')]])
    expect(semana.cargaRelativa).toBe(100)
    expect(semana.pctAltaIntensidad).toBe(100)
  })

  it('tolera entrada vacía o nula sin romper', () => {
    expect(detectarFasesMesociclo([])).toEqual([])
    expect(detectarFasesMesociclo(null)).toEqual([])
  })

  it('toda fase devuelta tiene entrada en FASES_INFO', () => {
    const fases = detectarFasesMesociclo([
      [sesion(300, 'Z2')], [sesion(60, 'Z2')], [sesion(200, 'Z5')], []
    ])
    for (const f of fases) {
      expect(Boolean(FASES_INFO[f.fase])).toBe(true)
    }
  })
})

describe('detectarFasesMesocicloGimnasio', () => {
  // Estructura del formulario: días -> ejercicios -> porSemana[]
  const dias = (porSemanaPorEjercicio, metodo = '% de 1RM') => ([
    {
      activo: true,
      ejercicios: [{ metodo, porSemana: porSemanaPorEjercicio }]
    }
  ])

  it('detecta tantas semanas como tenga el ejercicio más largo', () => {
    const fases = detectarFasesMesocicloGimnasio(dias([
      { series: 4, reps: 8, valor: '70' },
      { series: 4, reps: 8, valor: '75' },
      { series: 4, reps: 8, valor: '80' }
    ]))
    expect(fases).toHaveLength(3)
  })

  it('no asume bloques de 4 semanas: respeta duraciones distintas', () => {
    const fases = detectarFasesMesocicloGimnasio(dias([
      { series: 3, reps: 10, valor: '65' },
      { series: 3, reps: 10, valor: '70' }
    ]))
    expect(fases).toHaveLength(2)
  })

  it('la semana de mucho menos volumen es descarga', () => {
    const fases = detectarFasesMesocicloGimnasio(dias([
      { series: 5, reps: 10, valor: '70' },
      { series: 5, reps: 10, valor: '70' },
      { series: 1, reps: 5, valor: '70' }
    ]))
    expect(fases[2].fase).toBe('descarga')
  })

  it('series a 85%+ de 1RM marcan la semana como pico', () => {
    const fases = detectarFasesMesocicloGimnasio(dias([
      { series: 5, reps: 10, valor: '65' },
      { series: 5, reps: 8, valor: '90' }
    ]))
    expect(fases[1].fase).toBe('pico')
  })

  it('ignora los días desactivados', () => {
    const conDiaInactivo = [
      { activo: false, ejercicios: [{ metodo: '% de 1RM', porSemana: [{ series: 10, reps: 10, valor: '90' }] }] },
      { activo: true, ejercicios: [{ metodo: '% de 1RM', porSemana: [{ series: 3, reps: 8, valor: '70' }] }] }
    ]
    const fases = detectarFasesMesocicloGimnasio(conDiaInactivo)
    expect(fases[0].pctAltaIntensidad).toBe(0)
  })

  it('RPE alto se traduce a intensidad alta', () => {
    const fases = detectarFasesMesocicloGimnasio(dias([
      { series: 4, reps: 8, valor: '5' },
      { series: 4, reps: 8, valor: '10' }
    ], 'RPE'))
    expect(fases[1].pctAltaIntensidad).toBe(100)
  })

  it('RIR bajo equivale a intensidad alta', () => {
    const fases = detectarFasesMesocicloGimnasio(dias([
      { series: 4, reps: 8, valor: '5' },
      { series: 4, reps: 8, valor: '0' }
    ], 'RIR'))
    expect(fases[1].pctAltaIntensidad).toBe(100)
  })

  it('descarta ejercicios sin series o sin reps', () => {
    const fases = detectarFasesMesocicloGimnasio(dias([
      { series: 0, reps: 8, valor: '70' }
    ]))
    expect(fases[0].fase).toBe('sin_datos')
  })

  it('tolera entrada vacía', () => {
    expect(detectarFasesMesocicloGimnasio([])).toHaveLength(1)
    expect(detectarFasesMesocicloGimnasio(null)).toHaveLength(1)
  })
})

describe('detectarFasesMesocicloGimnasioDesdeFilas', () => {
  it('clasifica igual que la versión de formulario', () => {
    const filas = [
      [{ series: 5, reps: 10, metodo_prescrito: '% de 1RM', valor_prescrito: '70' }],
      [{ series: 1, reps: 5, metodo_prescrito: '% de 1RM', valor_prescrito: '70' }]
    ]
    const fases = detectarFasesMesocicloGimnasioDesdeFilas(filas)
    expect(fases).toHaveLength(2)
    expect(fases[1].fase).toBe('descarga')
  })

  it('parsea el valor aunque traiga notas al lado', () => {
    const filas = [
      [{ series: 4, reps: 8, metodo_prescrito: '% de 1RM', valor_prescrito: '90 · series 3-4' }],
      [{ series: 4, reps: 8, metodo_prescrito: '% de 1RM', valor_prescrito: '90 · series 3-4' }]
    ]
    const fases = detectarFasesMesocicloGimnasioDesdeFilas(filas)
    expect(fases[0].pctAltaIntensidad).toBe(100)
  })

  it('tolera entrada vacía', () => {
    expect(detectarFasesMesocicloGimnasioDesdeFilas([])).toEqual([])
    expect(detectarFasesMesocicloGimnasioDesdeFilas(null)).toEqual([])
  })
})
