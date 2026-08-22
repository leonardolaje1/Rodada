export const WEAR_TYPES = [
  { id: 'cadena', label: 'Cadena', unidad: '% elongación', nuevo: 0, limite: 0.75, vidaUtilDefault: 3000, direccion: 'asc', ayuda: 'Medí con calibre de desgaste. Reemplazar en 0.5% si el cassette es caro, o 0.75% como límite general.' },
  { id: 'piñon', label: 'Piñón (cassette)', unidad: '% desgaste', nuevo: 0, limite: 100, vidaUtilDefault: 9000, direccion: 'asc', ayuda: 'Suele durar 2-3 cadenas. Si la cadena nueva "escala" o salta, hay que reemplazarlo.' },
  { id: 'platos', label: 'Platos', unidad: '% desgaste', nuevo: 0, limite: 100, vidaUtilDefault: 15000, direccion: 'asc', ayuda: 'Revisá la forma de los dientes: perfil de "gancho de tiburón" indica desgaste avanzado.' },
  { id: 'cubiertas', label: 'Cubiertas', unidad: 'mm remanente', nuevo: 2.5, limite: 1, vidaUtilDefault: 4000, direccion: 'desc', ayuda: 'Medí la profundidad del labrado en el centro de la banda de rodadura.' }
]

export function porcentajeDesgasteManual(wearType, valor) {
  if (valor == null || valor === '') return null
  const v = Number(valor)
  const { nuevo, limite, direccion } = wearType
  const pct = direccion === 'asc' ? ((v - nuevo) / (limite - nuevo)) * 100 : ((nuevo - v) / (nuevo - limite)) * 100
  return Math.max(0, Math.min(100, Math.round(pct)))
}

export function estadoDesgaste(item, wearType, kmActualBici) {
  const kmDesde = item ? kmActualBici - (Number(item.km_instalacion) || 0) : 0
  const vidaUtil = item?.vida_util_km ? Number(item.vida_util_km) : wearType.vidaUtilDefault
  const pctKm = vidaUtil ? Math.min(100, Math.round((kmDesde / vidaUtil) * 100)) : 0
  const mediciones = item?.mediciones || []
  const ultimaMedicion = mediciones.length ? mediciones[mediciones.length - 1] : null
  const pctManual = ultimaMedicion ? porcentajeDesgasteManual(wearType, ultimaMedicion.valor) : null
  const pct = Math.max(pctKm, pctManual ?? 0)
  const nivel = pct >= 75 ? 'critico' : pct >= 50 ? 'atencion' : 'ok'
  return { kmDesde, vidaUtil, pctKm, pctManual, pct, ultimaMedicion, nivel }
}

export function nivelDesgasteInfo(nivel) {
  if (nivel === 'critico') return { color: '#F14A4A', texto: 'Desgaste crítico — medir y cambiar pronto' }
  if (nivel === 'atencion') return { color: '#F5A623', texto: 'Pasó el 50% — empezá a controlar' }
  return { color: '#C4F135', texto: 'En rango normal' }
}

// Proyecta cuántos días quedan hasta el límite de vida útil de un componente,
// asumiendo que el ritmo de uso reciente (km/día) se mantiene. Reutiliza el
// estado ya calculado por estadoDesgaste() en vez de repetir esa lógica.
export function proyectarDiasRestantes(estado, kmPorDia) {
  if (!kmPorDia || kmPorDia <= 0) return null
  const kmRestantes = estado.vidaUtil - estado.kmDesde
  if (kmRestantes <= 0) return 0
  return Math.round(kmRestantes / kmPorDia)
}
