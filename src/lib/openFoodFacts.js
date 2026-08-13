import { supabase } from './supabaseClient'

export async function buscarAlimentosPorTexto(texto) {
  if (!texto || texto.trim().length < 2) return []

  // Llama a tu Edge Function, que busca en Open Food Facts de verdad
  const { data, error } = await supabase.functions.invoke('buscar-alimentos', {
    body: { q: texto.trim() }
  })

  if (error) {
    console.error('Error Edge Function:', error)
    throw new Error('No se pudo buscar en la base de datos')
  }

  return data || []
}

export async function buscarAlimentoPorCodigoBarras(codigo) {
  const { data, error } = await supabase.functions.invoke('buscar-alimentos', {
    body: { q: codigo.trim() }
  })
  // para código de barras usamos la misma, o creá otra función igual pero con /api/v0/product/
  if (error) return null
  return data?.[0] || null
}
