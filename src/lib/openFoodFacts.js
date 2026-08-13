const BASE = 'https://world.openfoodfacts.org'

function normalizar(producto) {
  const n = producto.nutriments || {}
  
  // FIX 1: Open Food Facts a veces manda energía solo en kJ
  let kcal = n['energy-kcal_100g']
  if (kcal == null && n['energy_100g'] != null) {
    kcal = n['energy_100g'] / 4.184 // kJ a kcal
  }
  if (kcal == null && n['energy-kcal'] != null) {
    kcal = n['energy-kcal']
  }

  return {
    codigo: producto.code || null,
    nombre: producto.product_name || producto.product_name_es || 'Sin nombre',
    marca: producto.brands || '',
    kcal100g: kcal != null ? Math.round(kcal) : null,
    proteinas100g: n['proteins_100g'] ?? n['proteins'] ?? null,
    carbohidratos100g: n['carbohydrates_100g'] ?? n['carbohydrates'] ?? null,
    grasas100g: n['fat_100g'] ?? n['fat'] ?? null
  }
}

export async function buscarAlimentosPorTexto(texto) {
  if (!texto || texto.trim().length < 2) return []
  
  const q = encodeURIComponent(texto.trim())
  // FIX 2: pido un poco más de campos para no perder resultados
  const url = `${BASE}/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,product_name_es,brands,nutriments,product_name_en`

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(t)
    if (!res.ok) throw new Error(`OFF respondió ${res.status}`)
    const data = await res.json()
    
    return (data.products || [])
      .filter((p) => p.product_name || p.product_name_es || p.product_name_en)
      .map(normalizar)
      // FIX 3: ESTE ERA EL ERROR - no filtres por kcal acá
      // Dejalo pasar, aunque no tenga macros lo mostrás igual
  } catch (err) {
    clearTimeout(t)
    console.error('OFF search error:', err)
    throw err
  }
}

export async function buscarAlimentoPorCodigoBarras(codigo) {
  const clean = codigo.trim()
  // v2 a veces falla, v0 es más estable para código de barras
  const urls = [
    `${BASE}/api/v0/product/${encodeURIComponent(clean)}.json`,
    `${BASE}/api/v2/product/${encodeURIComponent(clean)}.json?fields=code,product_name,product_name_es,brands,nutriments`
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const data = await res.json()
      if (data.status === 1 && data.product) {
        return normalizar(data.product)
      }
    } catch {}
  }
  return null // no encontrado, pero no es error de conexión
}
