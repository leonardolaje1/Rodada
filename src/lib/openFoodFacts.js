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

async function buscarViaSearchALicious(texto) {
  const url = `${BASE_BUSQUEDA}/search?q=${encodeURIComponent(texto)}&langs=es:en&page_size=10&fields=code,product_name,product_name_es,brands,nutriments`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`search-a-licious respondió ${res.status}`)
  const data = await res.json()
  return data.hits || data.products || data.results || []
}

async function buscarViaLegacy(texto) {
  // Endpoint clásico de Open Food Facts. Sigue soportado y sirve como respaldo
  // cuando search-a-licious (todavía en beta) no responde.
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(texto)}&search_simple=1&action=process&json=1&page_size=10&fields=code,product_name,product_name_es,brands,nutriments`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Búsqueda clásica respondió ${res.status}`)
  const data = await res.json()
  return data.products || []
}

export async function buscarAlimentosPorTexto(texto) {
  if (!texto || texto.trim().length < 2) return []
  let productos = []
  try {
    productos = await buscarViaSearchALicious(texto)
  } catch (err) {
    // Si el buscador nuevo (beta) falla, probamos con el endpoint clásico antes de rendirnos.
    productos = await buscarViaLegacy(texto)
  }
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
