// Importador de mesociclos desde Excel/Google Sheets (exportado como .xlsx o .csv).
//
// No es un parser "libre" que adivina cualquier formato: espera una plantilla
// con dos hojas (Meta + Sesiones para bici, Meta + Ejercicios para gimnasio),
// pero es tolerante con el nombre exacto de las columnas — no importan mayúsculas,
// tildes, guiones bajos vs espacios, ni el orden de las columnas.
//
// Si el archivo no tiene las hojas esperadas o le faltan columnas obligatorias,
// tira un error con un mensaje concreto (qué hoja/columna falta) en vez de fallar
// en silencio o importar datos a medias.

const DIAS_VALIDOS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']

const ALIAS_DIA = {
  lun: 'lun', lunes: 'lun', monday: 'lun', mon: 'lun',
  mar: 'mar', martes: 'mar', tuesday: 'mar', tue: 'mar', tues: 'mar',
  mie: 'mie', miercoles: 'mie', wednesday: 'mie', wed: 'mie',
  jue: 'jue', jueves: 'jue', thursday: 'jue', thu: 'jue', thur: 'jue', thurs: 'jue',
  vie: 'vie', viernes: 'vie', friday: 'vie', fri: 'vie',
  sab: 'sab', sabado: 'sab', saturday: 'sab', sat: 'sab',
  dom: 'dom', domingo: 'dom', sunday: 'dom', sun: 'dom'
}

const VERDADEROS = new Set(['x', 'si', 'sí', 'true', '1', 'yes', 'y', 'clave'])

function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // saca tildes
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_') // cualquier símbolo, espacio, paréntesis, slash -> "_"
    .replace(/^_+|_+$/g, '')
}
function normalizarDia(s) {
  const n = normalizar(s).replace(/_/g, '')
  return ALIAS_DIA[n] || null
}
function esVerdadero(v) {
  return VERDADEROS.has(normalizar(v))
}
function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(String(v).replace(',', '.'))
  return isNaN(n) ? null : n
}

// Busca, entre las hojas del workbook, la primera cuyo nombre normalizado
// empiece con alguno de los alias dados.
function buscarHoja(workbook, alias) {
  const nombre = workbook.SheetNames.find((n) => alias.some((a) => normalizar(n).startsWith(a)))
  return nombre ? workbook.Sheets[nombre] : null
}

// Dada una fila (objeto {encabezadoOriginal: valor}) y un mapa alias->clave,
// devuelve un objeto con las claves normalizadas encontradas.
function mapearFila(fila, mapaAlias) {
  const resultado = {}
  const clavesFila = Object.keys(fila)
  for (const [clave, alias] of Object.entries(mapaAlias)) {
    const original = clavesFila.find((k) => alias.includes(normalizar(k)))
    if (original !== undefined) resultado[clave] = fila[original]
  }
  return resultado
}

function leerMetaKV(hoja, XLSX) {
  // La hoja "Meta" es de 2 columnas: Campo / Valor (en cualquier orden de filas).
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '' })
  const meta = {}
  for (const fila of filas) {
    if (!fila || fila.length < 2) continue
    const campo = normalizar(fila[0])
    if (!campo) continue
    meta[campo] = fila[1]
  }
  return meta
}

async function leerWorkbook(file) {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  return { XLSX, wb }
}

function lunesDeFecha(fechaStr) {
  const d = new Date(fechaStr + 'T12:00:00')
  const dow = d.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + offset)
  return d
}
function fechaISO(d) { return d.toISOString().slice(0, 10) }

// ---------------- BICI ----------------
const ALIAS_META_BICI = {
  nombre: ['nombre', 'name', 'titulo'],
  tipo: ['tipo', 'tipo_mesociclo'],
  fecha_inicio: ['fecha_inicio', 'inicio', 'fecha', 'start'],
  competencia: ['competencia', 'evento'],
  ctl_objetivo: ['ctl_objetivo', 'ctl'],
  notas: ['notas', 'notes', 'comentarios']
}
const ALIAS_SESION = {
  semana: ['semana', 'week', 'sem'],
  dia: ['dia', 'day'],
  tipo: ['tipo', 'actividad', 'type'],
  duracion_min: ['duracion_min', 'duracion', 'minutos', 'duration', 'min'],
  descripcion: ['descripcion', 'detalle', 'estructura', 'comentarios', 'notas'],
  es_clave: ['clave', 'es_clave', 'destacada', 'key'],
  estilo_sesion: ['estilo', 'estilo_sesion', 'tipo_entreno'],
  zona_objetivo: ['zona', 'zona_objetivo', 'zone'],
  watts_kg_objetivo: ['watts_kg', 'w_kg', 'wattskg', 'watts_kg_objetivo'],
  series_objetivo: ['series', 'series_objetivo'],
  repeticiones_objetivo: ['repeticiones', 'reps', 'repeticiones_objetivo'],
  tiempo_trabajo_objetivo: ['tiempo_trabajo', 'tiempo', 'trabajo', 'tiempo_trabajo_objetivo'],
  pausa_objetivo: ['pausa', 'descanso', 'pausa_objetivo', 'recuperacion']
}

function diaVacioBici(d) {
  return {
    dia: d, activo: false, tipo: 'Rodillo', duracion_min: null, descripcion: '', es_clave: false,
    estilo_sesion: '', zona_objetivo: '', watts_kg_objetivo: null, series_objetivo: null,
    repeticiones_objetivo: null, tiempo_trabajo_objetivo: '', pausa_objetivo: ''
  }
}

export async function parsearPlanillaBici(file) {
  const { XLSX, wb } = await leerWorkbook(file)

  const hojaMeta = buscarHoja(wb, ['meta', 'plan', 'info', 'datos'])
  const hojaSesiones = buscarHoja(wb, ['sesion', 'entrenamiento', 'bici', 'plan_bici'])
  if (!hojaMeta) throw new Error('No encontré una hoja "Meta" (o "Plan") con los datos generales del mesociclo.')
  if (!hojaSesiones) throw new Error('No encontré una hoja "Sesiones" con el detalle de cada día.')

  const metaRaw = leerMetaKV(hojaMeta, XLSX)
  const meta = mapearFila(metaRaw, ALIAS_META_BICI)
  if (!meta.nombre) throw new Error('A la hoja "Meta" le falta el campo "Nombre".')
  if (!meta.fecha_inicio) throw new Error('A la hoja "Meta" le falta el campo "Fecha_inicio" (formato AAAA-MM-DD).')

  const filasRaw = XLSX.utils.sheet_to_json(hojaSesiones, { defval: '' })
  if (filasRaw.length === 0) throw new Error('La hoja "Sesiones" está vacía.')

  const semanas = [1, 2, 3, 4].map((n) => ({ semana: n, dias: DIAS_VALIDOS.map(diaVacioBici) }))

  filasRaw.forEach((filaOriginal, i) => {
    const fila = mapearFila(filaOriginal, ALIAS_SESION)
    const numFila = i + 2 // +2: encabezado + índice base 1
    const semanaNum = numOrNull(fila.semana)
    const diaId = normalizarDia(fila.dia)
    if (!semanaNum || semanaNum < 1 || semanaNum > 4) throw new Error(`Fila ${numFila} de "Sesiones": la columna Semana debe ser 1, 2, 3 o 4.`)
    if (!diaId) throw new Error(`Fila ${numFila} de "Sesiones": no reconozco el día "${fila.dia}". Usá Lun/Mar/Mié/Jue/Vie/Sáb/Dom.`)
    if (!fila.tipo) throw new Error(`Fila ${numFila} de "Sesiones": falta la columna Tipo (Ruta/MTB/Gravel/Rodillo/Pista/Descanso).`)

    const semana = semanas[semanaNum - 1]
    const idx = semana.dias.findIndex((d) => d.dia === diaId)
    semana.dias[idx] = {
      dia: diaId, activo: true,
      tipo: String(fila.tipo).trim(),
      duracion_min: numOrNull(fila.duracion_min),
      descripcion: fila.descripcion ? String(fila.descripcion).trim() : '',
      es_clave: esVerdadero(fila.es_clave),
      estilo_sesion: fila.estilo_sesion ? String(fila.estilo_sesion).trim() : '',
      zona_objetivo: fila.zona_objetivo ? String(fila.zona_objetivo).trim().toUpperCase() : '',
      watts_kg_objetivo: numOrNull(fila.watts_kg_objetivo),
      series_objetivo: numOrNull(fila.series_objetivo),
      repeticiones_objetivo: numOrNull(fila.repeticiones_objetivo),
      tiempo_trabajo_objetivo: fila.tiempo_trabajo_objetivo ? String(fila.tiempo_trabajo_objetivo).trim() : '',
      pausa_objetivo: fila.pausa_objetivo ? String(fila.pausa_objetivo).trim() : ''
    }
  })

  const inicio = lunesDeFecha(String(meta.fecha_inicio).slice(0, 10))
  const fin = new Date(inicio); fin.setDate(fin.getDate() + 27)

  return {
    nombre: String(meta.nombre).trim(),
    tipo: meta.tipo ? normalizar(meta.tipo) : 'base',
    fecha_inicio: fechaISO(inicio),
    fecha_fin: fechaISO(fin),
    competencia_id: null,
    ctl_objetivo: numOrNull(meta.ctl_objetivo),
    notas: meta.notas ? String(meta.notas).trim() : '',
    semanas
  }
}

// ---------------- Generación de filas (compartida con el flujo de Equipo) ----------------
// Mismas funciones que generarSesionesDesdeSemanas (Entrenamientos.jsx) y
// generarFilasDesdeDias (Gimnasio.jsx), con un parámetro extra opcional "userId"
// para cuando un profesional crea el mesociclo a nombre de un atleta vinculado
// (si no se pasa, el user_id lo completa el default de la tabla en Supabase).
const DIAS_SEMANA_ORDEN = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']

export function generarSesionesDesdeSemanas(lunesBase, semanas, mesociclo_id, userId) {
  const sesiones = []
  semanas.forEach((semana, si) => {
    DIAS_SEMANA_ORDEN.forEach((diaId, oi) => {
      const d = (semana.dias || []).find((x) => x.dia === diaId)
      if (!d || !d.activo) return
      const fecha = new Date(lunesBase)
      fecha.setDate(fecha.getDate() + si * 7 + oi)
      sesiones.push({
        fecha: fecha.toISOString().slice(0, 10),
        tipo: d.tipo,
        duracion_min: d.duracion_min ? Number(d.duracion_min) : null,
        comentarios: d.descripcion || null,
        estado: 'pendiente',
        es_clave: !!d.es_clave,
        mesociclo_id,
        estilo_sesion: d.estilo_sesion || null,
        zona_objetivo: d.zona_objetivo || null,
        watts_kg_objetivo: d.watts_kg_objetivo ? Number(d.watts_kg_objetivo) : null,
        series_objetivo: d.series_objetivo ? Number(d.series_objetivo) : null,
        repeticiones_objetivo: d.repeticiones_objetivo ? Number(d.repeticiones_objetivo) : null,
        tiempo_trabajo_objetivo: d.tiempo_trabajo_objetivo || null,
        pausa_objetivo: d.pausa_objetivo || null,
        ...(userId ? { user_id: userId } : {})
      })
    })
  })
  return sesiones
}

// Las columnas series/reps son numéricas en Supabase. Si el valor prescrito
// trae texto ("10-12", "10 c/lado"), NUNCA lo mandamos crudo a esas columnas
// -- un insert masivo con un solo valor no numérico en una columna numérica
// falla completo y en silencio si no se chequea el error. Extraemos el primer
// entero para la columna numérica, y guardamos el texto completo (si difiere)
// en valor_prescrito para no perder precisión.
function enteroSeguro(v) {
  if (v === '' || v === null || v === undefined) return null
  const m = String(v).match(/\d+/)
  return m ? Number(m[0]) : null
}
function textoSiDistinto(v, entero) {
  if (v === '' || v === null || v === undefined) return null
  const s = String(v).trim()
  return s === String(entero) ? null : s
}

export function generarFilasDesdeDias(fechaInicioBase, dias, mesociclo_gimnasio_id, userId) {
  const filas = []
  for (let offset = 0; offset < 28; offset++) {
    const fecha = new Date(fechaInicioBase)
    fecha.setDate(fecha.getDate() + offset)
    const si = Math.floor(offset / 7)
    const diaId = DIAS_SEMANA_ORDEN[(fecha.getDay() + 6) % 7]
    const d = dias.find((x) => x.dia === diaId)
    if (!d || !d.activo) continue
    const fechaStr = fecha.toISOString().slice(0, 10)
    // Una sesión por día: todos los ejercicios de ese día comparten sesion_id.
    // "orden" fija la posición del ejercicio dentro del día tal como vino en la
    // planilla — sin esto, Postgres no garantiza devolver las filas con la misma
    // fecha en el orden en que se insertaron (pueden salir mezcladas o invertidas).
    const sesionId = crypto.randomUUID()
    ;(d.ejercicios || []).forEach((ej, orden) => {
      if (!ej.ejercicio) return
      const p = ej.porSemana?.[si] || {}
      const seriesNum = enteroSeguro(p.series)
      const repsNum = enteroSeguro(p.reps)
      const repsTexto = textoSiDistinto(p.reps, repsNum)
      const seriesTexto = textoSiDistinto(p.series, seriesNum)
      const notaReps = [seriesTexto ? `series ${seriesTexto}` : null, repsTexto ? `reps ${repsTexto}` : null].filter(Boolean).join(' · ')
      filas.push({
        fecha: fechaStr, ejercicio: ej.ejercicio,
        series: seriesNum,
        reps: repsNum,
        peso: null, estado: 'pendiente', es_clave: !!d.es_clave,
        metodo_prescrito: ej.metodo || null,
        valor_prescrito: [p.valor || null, notaReps || null].filter(Boolean).join(' · ') || null,
        mesociclo_gimnasio_id,
        sesion_id: sesionId,
        orden,
        ...(userId ? { user_id: userId } : {})
      })
    })
  }
  return filas
}

// ---------------- Plantillas descargables ----------------
// Generan un .xlsx vacío (con una fila de ejemplo) en el formato exacto que
// parsearPlanillaBici / parsearPlanillaGimnasio esperan, para que el
// profesional lo complete en Excel/Sheets y lo vuelva a subir.
async function construirLibro(XLSX, hojaMeta, filasMeta, hojaDatos, headers, filasEjemplo) {
  const wb = XLSX.utils.book_new()
  const wsMeta = XLSX.utils.aoa_to_sheet(filasMeta)
  wsMeta['!cols'] = [{ wch: 16 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, wsMeta, hojaMeta)
  const wsDatos = XLSX.utils.aoa_to_sheet([headers, ...filasEjemplo])
  wsDatos['!cols'] = headers.map(() => ({ wch: 16 }))
  XLSX.utils.book_append_sheet(wb, wsDatos, hojaDatos)
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([out], { type: 'application/octet-stream' })
}

export async function generarPlantillaBici() {
  const XLSX = await import('xlsx')
  const filasMeta = [
    ['Nombre', 'Nombre del mesociclo'],
    ['Tipo', 'base'],
    ['Fecha_inicio', '2026-01-05'],
    ['CTL_objetivo', ''],
    ['Notas', '']
  ]
  const headers = ['Semana', 'Dia', 'Tipo', 'Duracion_min', 'Descripcion', 'Clave', 'Estilo_sesion', 'Zona', 'Series', 'Repeticiones', 'Tiempo_trabajo', 'Pausa']
  const ejemplo = [
    [1, 'Lun', 'Rodillo', 60, 'Base Z2 continua', '', 'Resistencia (Endurance)', 'Z2', '', '', '', ''],
    [1, 'Mie', 'Ruta', 90, 'Z2 con 3x8 SS', 'x', 'Sweet Spot', 'Z3', '', '', '8min', '5min']
  ]
  return construirLibro(XLSX, 'Meta', filasMeta, 'Sesiones', headers, ejemplo)
}

export async function generarPlantillaGimnasio() {
  const XLSX = await import('xlsx')
  const filasMeta = [
    ['Nombre', 'Nombre del mesociclo'],
    ['Fecha_inicio', '2026-01-05'],
    ['Notas', '']
  ]
  const headers = ['Semana', 'Dia', 'Clave', 'Ejercicio', 'Metodo', 'Series', 'Reps', 'Valor']
  const ejemplo = [
    [1, 'Mar', '', 'Sentadilla trasera', 'RPE', 3, 12, 6],
    [2, 'Mar', '', 'Sentadilla trasera', 'RPE', 4, 10, '6-7']
  ]
  return construirLibro(XLSX, 'Meta', filasMeta, 'Ejercicios', headers, ejemplo)
}

export function descargarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
// ---------------- GIMNASIO ----------------
const ALIAS_META_GYM = {
  nombre: ['nombre', 'name', 'titulo'],
  fecha_inicio: ['fecha_inicio', 'inicio', 'fecha', 'start'],
  notas: ['notas', 'notes', 'comentarios']
}
const ALIAS_EJERCICIO = {
  semana: ['semana', 'week', 'sem'],
  dia: ['dia', 'day'],
  es_clave: ['clave', 'es_clave', 'destacada', 'key'],
  ejercicio: ['ejercicio', 'exercise', 'nombre_ejercicio'],
  metodo: ['metodo', 'method'],
  series: ['series'],
  reps: ['reps', 'repeticiones'],
  valor: ['valor', 'carga', 'rpe', 'peso', 'valor_prescrito']
}

export async function parsearPlanillaGimnasio(file) {
  const { XLSX, wb } = await leerWorkbook(file)

  const hojaMeta = buscarHoja(wb, ['meta', 'plan', 'info', 'datos'])
  const hojaEjercicios = buscarHoja(wb, ['ejercicio', 'gimnasio', 'gym', 'plan_gimnasio'])
  if (!hojaMeta) throw new Error('No encontré una hoja "Meta" (o "Plan") con los datos generales del mesociclo.')
  if (!hojaEjercicios) throw new Error('No encontré una hoja "Ejercicios" con el detalle de cada día.')

  const metaRaw = leerMetaKV(hojaMeta, XLSX)
  const meta = mapearFila(metaRaw, ALIAS_META_GYM)
  if (!meta.nombre) throw new Error('A la hoja "Meta" le falta el campo "Nombre".')
  if (!meta.fecha_inicio) throw new Error('A la hoja "Meta" le falta el campo "Fecha_inicio" (formato AAAA-MM-DD).')

  const filasRaw = XLSX.utils.sheet_to_json(hojaEjercicios, { defval: '' })
  if (filasRaw.length === 0) throw new Error('La hoja "Ejercicios" está vacía.')

  // dias: { [diaId]: { dia, activo, es_clave, ejercicios: { [nombreEjercicio]: { metodo, porSemana:[4] } } } }
  const diasMap = {}
  for (const d of DIAS_VALIDOS) diasMap[d] = { dia: d, activo: false, es_clave: false, ejerciciosPorNombre: {} }

  filasRaw.forEach((filaOriginal, i) => {
    const fila = mapearFila(filaOriginal, ALIAS_EJERCICIO)
    const numFila = i + 2
    const semanaNum = numOrNull(fila.semana)
    const diaId = normalizarDia(fila.dia)
    if (!semanaNum || semanaNum < 1 || semanaNum > 4) throw new Error(`Fila ${numFila} de "Ejercicios": la columna Semana debe ser 1, 2, 3 o 4.`)
    if (!diaId) throw new Error(`Fila ${numFila} de "Ejercicios": no reconozco el día "${fila.dia}". Usá Lun/Mar/Mié/Jue/Vie/Sáb/Dom.`)
    if (!fila.ejercicio) throw new Error(`Fila ${numFila} de "Ejercicios": falta el nombre del ejercicio.`)

    const dia = diasMap[diaId]
    dia.activo = true
    if (esVerdadero(fila.es_clave)) dia.es_clave = true

    const nombreEj = String(fila.ejercicio).trim()
    if (!dia.ejerciciosPorNombre[nombreEj]) {
      dia.ejerciciosPorNombre[nombreEj] = {
        ejercicio: nombreEj,
        metodo: fila.metodo ? String(fila.metodo).trim() : '',
        porSemana: [1, 2, 3, 4].map(() => ({ series: '', reps: '', valor: '' }))
      }
    }
    const ej = dia.ejerciciosPorNombre[nombreEj]
    ej.porSemana[semanaNum - 1] = {
      series: fila.series !== undefined ? String(fila.series).trim() : '',
      reps: fila.reps !== undefined ? String(fila.reps).trim() : '',
      valor: fila.valor !== undefined ? String(fila.valor).trim() : ''
    }
  })

  const dias = DIAS_VALIDOS.map((d) => {
    const dia = diasMap[d]
    const ejercicios = Object.values(dia.ejerciciosPorNombre)
    return {
      dia: d, activo: dia.activo, es_clave: dia.es_clave,
      ejercicios: ejercicios.length > 0 ? ejercicios : [{ ejercicio: '', metodo: '', porSemana: [1, 2, 3, 4].map(() => ({ series: '', reps: '', valor: '' })) }]
    }
  })

  const inicio = String(meta.fecha_inicio).slice(0, 10)
  const fin = new Date(inicio + 'T12:00:00'); fin.setDate(fin.getDate() + 27)

  return {
    nombre: String(meta.nombre).trim(),
    fecha_inicio: inicio,
    fecha_fin: fechaISO(fin),
    notas: meta.notas ? String(meta.notas).trim() : '',
    dias
  }
}
