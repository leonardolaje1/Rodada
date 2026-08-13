// lib/openFoodFacts.js
const BASE = 'https://world.openfoodfacts.org'

export async function buscarAlimentosPorTexto(texto) {
  if (!texto || texto.trim().length < 2) return []
  
  const q = encodeURIComponent(texto.trim())
  const url = `${BASE}/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=20&fields=product_name,brands,nutriments`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(url, { 
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    })
    clearTimeout(timeout)
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    return (data.products || []).map(p => ({
      nombre: p.product_name || 'Sin nombre',
      marca: p.brands || '',
      kcal100g: p.nutriments?.['energy-kcal_100g'],
      proteinas100g: p.nutriments?.proteins_100g,
      carbohidratos100g: p.nutriments?.carbohydrates_100g,
      grasas100g: p.nutriments?.fat_100g,
    }))
  } catch (err) {
    clearTimeout(timeout)
    console.error('[OFF] Error buscando texto:', err)
    throw err // importante para que el componente lo capture
  }
}

export async function buscarAlimentoPorCodigoBarras(codigo) {
  const url = `${BASE}/api/v0/product/${codigo}.json`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 1) return null
    const p = data.product
    return {
      nombre: p.product_name,
      marca: p.brands,
      kcal100g: p.nutriments?.['energy-kcal_100g'],
      proteinas100g: p.nutriments?.proteins_100g,
      carbohidratos100g: p.nutriments?.carbohydrates_100g,
      grasas100g: p.nutriments?.fat_100g,
    }
  } catch (err) {
    console.error('[OFF] Error código barras:', err)
    throw err
  }
}
