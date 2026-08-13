const BASE = 'https://api.nal.usda.gov/fdc/v1'
const API_KEY = import.meta.env.VITE_USDA_API_KEY

// USDA identifica nutrientes por "nutrientNumber" (código estable, no cambia
// entre releases): 208 = energía (kcal), 203 = proteína, 204 = grasa total,
// 205 = carbohidratos. Buscamos por número y, si no está, por nombre como respaldo.
function extraerNutriente(foodNutrients, numero, nombreIncluye) {
  const item = (foodNutrients || []).find((n) => {
    const num = String(n.nutrientNumber ?? n.nutrient?.number ?? '')
    const nombre = (n.nutrientName || n.nutrient?.name || '').toLowerCase()
    return num === numero || nombre.includes(nombreIncluye)
  })
  if (!item) return null
  const valor = item.value ?? item.amount
  return valor == null ? null : valor
}

function normalizar(food) {
  const fn = food.foodNutrients || []
  return {
    nombre: food.description,
    marca: food.brandOwner || null,
    kcal100g: extraerNutriente(fn, '208', 'energy'),
    proteinas100g: extraerNutriente(fn, '203', 'protein'),
    carbohidratos100g: extraerNutriente(fn, '205', 'carbohydrate'),
    grasas100g: extraerNutriente(fn, '204', 'total lipid')
  }
}

// Alimentos genéricos (huevo, palta, arroz, pollo...) — Foundation/SR Legacy/Survey
// son los datasets de USDA con comida real sin marca, reportada per 100g.
// Excluimos "Branded" a propósito: eso ya lo cubre bien Open Food Facts.
export async function buscarAlimentosUSDA(texto) {
  if (!texto || texto.trim().length < 2) return []
  if (!API_KEY) return [] // sin key configurada: no rompe la búsqueda combinada, solo no aporta resultados

  const tipos = encodeURIComponent('Foundation,SR Legacy,Survey (FNDDS)')
  const url = `${BASE}/foods/search?query=${encodeURIComponent(texto)}&api_key=${API_KEY}&pageSize=10&dataType=${tipos}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`USDA FoodData Central respondió ${res.status}`)
  const data = await res.json()

  return (data.foods || [])
    .map(normalizar)
    .filter((p) => p.kcal100g != null)
}
