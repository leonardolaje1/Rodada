const DIAS_VENTANA = 5
const UMBRAL = 0.85 // por debajo del 85% del objetivo cuenta como día en déficit
const PROTEINA_G_POR_KG = 1.6

export function evaluarDeficitNutricional({ comidas, tdee, pesoKg }) {
  const alertas = []
  if (!tdee && !pesoKg) return alertas

  const hoy = new Date()
  const fechas = []
  for (let i = 1; i <= DIAS_VENTANA; i++) {
    const d = new Date(hoy)
    d.setDate(d.getDate() - i)
    fechas.push(d.toISOString().slice(0, 10))
  }

  const porDia = fechas.map((fecha) => {
    const delDia = (comidas || []).filter((c) => c.fecha === fecha)
    if (delDia.length === 0) return null
    return {
      fecha,
      kcal: delDia.reduce((a, c) => a + (Number(c.kcal) || 0), 0),
      proteinas: delDia.reduce((a, c) => a + (Number(c.proteinas) || 0), 0)
    }
  })

  // Si falta algún día de datos en la ventana, no evaluamos — evita alertar con información incompleta
  if (porDia.some((d) => d === null)) return alertas

  if (tdee) {
    const objetivoKcal = tdee * UMBRAL
    if (porDia.every((d) => d.kcal < objetivoKcal)) {
      const promedio = Math.round(porDia.reduce((a, d) => a + d.kcal, 0) / DIAS_VENTANA)
      alertas.push({
        tipo: 'kcal',
        titulo: 'Déficit calórico sostenido',
        mensaje: `${DIAS_VENTANA} días seguidos por debajo de tu meta (promedio ${promedio} de ${tdee} kcal). Podría afectar tu rendimiento y tu próxima antropometría.`
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
