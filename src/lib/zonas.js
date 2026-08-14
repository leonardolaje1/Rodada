// Paletas de zonas de entrenamiento (potencia y frecuencia cardíaca).
// Antes vivían duplicadas, palabra por palabra, en Entrenamientos.jsx y FTP.jsx.
// Si en algún momento se ajusta un color o un rango, se cambia en un solo lugar.
//
// Los colores de esta paleta son intencionalmente distintos de los tokens
// de estado (state.critical/warning/success/neutral) — acá representan 7
// zonas fisiológicas, no severidad. Por eso quedan como valores fijos en
// vez de variables CSS.

export const ZONAS_POTENCIA = [
  { zona: 'Z1', nombre: 'Recuperación activa', desde: 0, hasta: 0.55, color: '#8A8F9C' },
  { zona: 'Z2', nombre: 'Resistencia', desde: 0.56, hasta: 0.75, color: '#4A9EFF' },
  { zona: 'Z3', nombre: 'Tempo', desde: 0.76, hasta: 0.90, color: '#C4F135' },
  { zona: 'Z4', nombre: 'Umbral', desde: 0.91, hasta: 1.05, color: '#F5A623' },
  { zona: 'Z5', nombre: 'VO2 máx', desde: 1.06, hasta: 1.20, color: '#F14A4A' },
  { zona: 'Z6', nombre: 'Capacidad anaeróbica', desde: 1.21, hasta: 1.50, color: '#C34AF1' },
  { zona: 'Z7', nombre: 'Neuromuscular', desde: 1.51, hasta: null, color: '#7A4AF1' }
]

export const ZONAS_FC = [
  { zona: 'Z1', nombre: 'Recuperación activa', desde: 0, hasta: 0.68, color: '#8A8F9C' },
  { zona: 'Z2', nombre: 'Resistencia', desde: 0.69, hasta: 0.83, color: '#4A9EFF' },
  { zona: 'Z3', nombre: 'Tempo', desde: 0.84, hasta: 0.94, color: '#C4F135' },
  { zona: 'Z4', nombre: 'Umbral', desde: 0.95, hasta: 1.05, color: '#F5A623' },
  { zona: 'Z5', nombre: 'VO2 máx', desde: 1.06, hasta: null, color: '#F14A4A' }
]
