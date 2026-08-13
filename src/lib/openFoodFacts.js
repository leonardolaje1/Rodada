const BASE = 'https://world.openfoodfacts.org'
const BASE_BUSQUEDA = 'https://search.openfoodfacts.org'

function normalizar(producto) {
  const n = producto.nutriments || {}
  return {
    codigo: producto.code || null,
    nombre: producto.product_name || producto.product_name_es || 'Sin nombre',
    marca: producto.brands || '',
    kcal100g: n['energy-kcal_100g'] ?? null,
    proteinas100g: n['proteins_100g'] ?? null,
    carbohidratos100g: n['carbohydrates_100g'] ?? null,
    grasas100g: n['fat_100g'] ?? null
  }
}

export async function buscarAlimentosPorTexto(texto) {
  if (!texto || texto.trim().length < 2) return []
  // El endpoint viejo (/cgi/search.pl) fue discontinuado por Open Food Facts —
  // este es el reemplazo oficial (search-a-licious, en beta).
  const url = `${BASE_BUSQUEDA}/search?q=${encodeURIComponent(texto)}&langs=es:en&page_size=10&fields=code,product_name,product_name_es,brands,nutriments`
  const res = await fetch(url)
  if (!res.ok) throw new Error('No se pudo buscar el alimento')
  const data = await res.json()
  const productos = data.hits || data.products || data.results || []
  return productos
    .filter((p) => p.product_name || p.product_name_es)
    .map(normalizar)
    .filter((p) => p.kcal100g != null)
}

export async function buscarAlimentoPorCodigoBarras(codigo) {
  const url = `${BASE}/api/v2/product/${encodeURIComponent(codigo)}.json?fields=code,product_name,product_name_es,brands,nutriments`
  const res = await fetch(url)
  if (!res.ok) throw new Error('No se pudo consultar el producto')
  const data = await res.json()
  if (data.status !== 1 || !data.product) return null
  return normalizar(data.product)
}
