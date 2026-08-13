// Cache en memoria, vive mientras dure la pestaña/sesión. No persiste
// entre recargas a propósito (para eso está el cache compartido en la DB,
// vía la Edge Function `buscar-alimentos`). Sirve para no repetir la misma
// invocación si el usuario busca lo mismo dos veces seguidas.
const cache = new Map()

export function conCacheDeSesion(clave, fn) {
  if (cache.has(clave)) return cache.get(clave)
  const promesa = fn().catch((err) => {
    cache.delete(clave)
    throw err
  })
  cache.set(clave, promesa)
  return promesa
}
