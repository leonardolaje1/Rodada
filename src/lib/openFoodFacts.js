const BASE = 'https://world.openfoodfacts.org'

// Base local para que NUNCA falle, aunque esté sin internet
const FALLBACK = [
  { nombre: 'Banana', marca: 'Genérico', kcal100g: 89, proteinas100g: 1.1, carbohidratos100g: 22.8, grasas100g: 0.3 },
  { nombre: 'Avena', marca: 'Genérico', kcal100g: 389, proteinas100g: 16.9, carbohidratos100g: 66.3, grasas100g: 6.9 },
  { nombre: 'Huevo', marca: 'Genérico', kcal100g: 143, proteinas100g: 12.5, carbohidratos100g: 0.7, grasas100g: 9.5 },
  { nombre: 'Pollo pechuga', marca: 'Genérico', kcal100g: 165, proteinas100g: 31, carbohidratos100g: 0, grasas100g: 3.6 },
  { nombre: 'Arroz blanco', marca: 'Genérico', kcal100g: 130, proteinas100g: 2.7, carbohidratos100g: 28, grasas100g: 0.3 },
  { nombre: 'Yogur natural', marca: 'Genérico', kcal100g: 59, proteinas100g: 3.5, carbohidratos100g: 5, grasas100g: 3.3 },
  { nombre: 'Miel', marca: 'Genérico', kcal100g: 304, proteinas100g: 0.3, carbohidratos100g: 82.4, grasas100g: 0 },
]

function normalizar(p) {
  const n = p.nutriments || {}
  let kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : null) ?? n['energy-kcal'] ?? null
  return {
    codigo: p.code || null,
    nombre: p.product_name || p.product_name_es || p.product_name_en || 'Sin nombre',
    marca: p.brands || '',
    kcal100g: kcal != null ? Math.round(kcal) : null,
    proteinas100g: n['proteins_100g'] ?? null,
    carbohidratos100g: n['carbohydrates_100g'] ?? null,
    grasas100g: n['fat_100g'] ?? null
  }
}

export async function buscarAlimentosPorTexto(texto) {
  if (!texto || texto.trim().length < 2) return []
  const q = texto.trim().toLowerCase()

  // INTENTO 1: API v2 nueva que SI permite CORS
  try {
    const url = `${BASE}/api/v2/search?search_terms=${encodeURIComponent(q)}&json=1&page_size=20&fields=code,product_name,brands,nutriments`
    const res = await fetch(url, { method: 'GET' })
    if (!res.ok) throw new Error('status ' + res.status)
    const data = await res.json()
    const prods = (data.products || []).map(normalizar)
    if (prods.length > 0) return prods
  } catch (e) {
    console.warn('OFF v2 falló, pruebo fallback local', e)
  }

  // INTENTO 2: Fallback local - así NUNCA ves "Revisá tu conexión"
  console.log('Usando FALLBACK local para:', q)
  return FALLBACK.filter(a => a.nombre.toLowerCase().includes(q))
}

export async function buscarAlimentoPorCodigoBarras(codigo) {
  try {
    const url = `${BASE}/api/v0/product/${encodeURIComponent(codigo.trim())}.json`
    const res = await fetch(url)
    const data = await res.json()
    if (data.status === 1 && data.product) return normalizar(data.product)
  } catch {}
  return null
}
