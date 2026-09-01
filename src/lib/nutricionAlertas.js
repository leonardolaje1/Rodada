import { calcularTDEEDinamico } from './tdee'
import { aFechaLocal } from './fechas'

const DIAS_VENTANA = 5
const UMBRAL = 0.85 // por debajo del 85% del objetivo cuenta como día en déficit
const PROTEINA_G_POR_KG = 1.6

export function evaluarDeficitNutricional({ comidas, tdee, bmr, entrenamientos, pesoKg }) {
  const alertas = []
  if (!tdee && !pesoKg) return alertas

  const hoy = new Date()
  const fechas = []
  for (let i = 1; i <= DIAS_VENTANA; i++) {
    const d = new Date(hoy)
    d.setDate(d.getDate() - i)
    fechas.push(aFechaLocal(d))
  }

  // TDEE del día: si hay calorías activas reales (de Entrenamientos) para esa
  // fecha, usa el TDEE dinámico (BMR sedentario + gasto real); si no, cae al
  // TDEE estático del selector de nivel de actividad. Así un día de fondo largo
  // no se marca como déficit por comparar contra un promedio que no lo contempla.
  function tdeeDelDia(fecha) {
    if (!bmr || !entrenamientos) return tdee
    const activasEseDia = entrenamientos
      .filter((e) => e.fecha === fecha)
      .reduce((a, e) => a + (Number(e.calorias) || 0), 0)
    if (activasEseDia <= 0) return tdee
    return calcularTDEEDinamico({ bmr, caloriasActivas: activasEseDia }) || tdee
  }

  const porDia = fechas.map((fecha) => {
    const delDia = (comidas || []).filter((c) => c.fecha === fecha)
    if (delDia.length === 0) return null
    return {
      fecha,
      kcal: delDia.reduce((a, c) => a + (Number(c.kcal) || 0), 0),
      proteinas: delDia.reduce((a, c) => a + (Number(c.proteinas) || 0), 0),
      tdee: tdeeDelDia(fecha)
    }
  })

  // Si falta algún día de datos en la ventana, no evaluamos — evita alertar con información incompleta
  if (porDia.some((d) => d === null)) return alertas

  if (porDia.every((d) => d.tdee)) {
    const objetivosKcal = porDia.map((d) => d.tdee * UMBRAL)
    if (porDia.every((d, i) => d.kcal < objetivosKcal[i])) {
      const promedio = Math.round(porDia.reduce((a, d) => a + d.kcal, 0) / DIAS_VENTANA)
      const promedioObjetivo = Math.round(porDia.reduce((a, d) => a + d.tdee, 0) / DIAS_VENTANA)
      alertas.push({
        tipo: 'kcal',
        titulo: 'Déficit calórico sostenido',
        mensaje: `${DIAS_VENTANA} días seguidos por debajo de tu meta (promedio ${promedio} de ${promedioObjetivo} kcal). Podría afectar tu rendimiento y tu próxima antropometría.`
      })
    }
  }

  if (pesoKg) {
    const objetivoProteina = pesoKg * PROTEINA_G_POR_KG * UMBRAL
    if (porDia.every((d) => d.proteinas < objetivoProteina)) {
      const promedio = Math.round(porDia.reduce((a, d) => a + d.proteinas, 0) / DIAS_VENTANA)
      alertas.push({
        tipo: 'proteina',
        titulo: 'Proteína baja sostenida',
        mensaje: `${DIAS_VENTANA} días seguidos con poca proteína (promedio ${promedio}g, recomendado ~${Math.round(pesoKg * PROTEINA_G_POR_KG)}g). Podría afectar tu recuperación muscular.`
      })
    }
  }

  return alertas
}
