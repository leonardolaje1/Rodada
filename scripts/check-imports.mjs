#!/usr/bin/env node
// Verifica que todos los imports locales del proyecto resuelvan a un archivo
// real y que cada nombre importado exista como export en el módulo destino.
//
// Por qué existe: un deploy se rompió en Vercel porque motorTaper.js importaba
// `proyectarCarga` de tss.js cuando esa función todavía no estaba exportada.
// Vite solo lo detecta al hacer el bundle, es decir, cuando ya es tarde. Esto
// lo detecta en medio segundo, sin instalar nada y sin depender de ESLint.
//
// Uso:  node scripts/check-imports.mjs
// Sale con código 1 si encuentra algún problema.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'

const RAIZ = resolve(process.cwd(), 'src')
const EXTENSIONES = ['.js', '.jsx']

function listarArchivos(dir) {
  const salida = []
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) salida.push(...listarArchivos(ruta))
    else if (EXTENSIONES.some((e) => entrada.endsWith(e))) salida.push(ruta)
  }
  return salida
}

// Resuelve un specifier relativo probando las extensiones que usa Vite.
function resolverModulo(desde, specifier) {
  const base = resolve(dirname(desde), specifier)
  const candidatos = [base, ...EXTENSIONES.map((e) => base + e), ...EXTENSIONES.map((e) => join(base, 'index' + e))]
  return candidatos.find((c) => existsSync(c) && statSync(c).isFile()) || null
}

// Nombres exportados por un módulo. Cubre las formas que usa el proyecto:
// export function/const/let/class, export { a, b as c }, export default,
// y re-exports export * from '...'.
function exportsDe(ruta, visitados = new Set()) {
  if (visitados.has(ruta)) return new Set()
  visitados.add(ruta)

  const codigo = readFileSync(ruta, 'utf8')
  const nombres = new Set()

  for (const m of codigo.matchAll(/^\s*export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    nombres.add(m[1])
  }
  for (const m of codigo.matchAll(/^\s*export\s*\{([^}]*)\}/gm)) {
    for (const parte of m[1].split(',')) {
      const trozo = parte.trim()
      if (!trozo) continue
      const alias = trozo.split(/\s+as\s+/)
      nombres.add((alias[1] || alias[0]).trim())
    }
  }
  if (/^\s*export\s+default\b/m.test(codigo)) nombres.add('default')

  for (const m of codigo.matchAll(/^\s*export\s*\*\s*from\s*['"]([^'"]+)['"]/gm)) {
    if (!m[1].startsWith('.')) continue
    const destino = resolverModulo(ruta, m[1])
    if (destino) for (const n of exportsDe(destino, visitados)) nombres.add(n)
  }

  return nombres
}

// Imports locales de un archivo, con los nombres que trae cada uno.
function importsDe(ruta) {
  const codigo = readFileSync(ruta, 'utf8')
  const resultado = []
  const re = /import\s+([^'"]*?)\s*from\s*['"](\.[^'"]+)['"]/g

  for (const m of codigo.matchAll(re)) {
    const clausula = m[1].trim()
    const specifier = m[2]
    const nombres = []

    const llaves = clausula.match(/\{([^}]*)\}/)
    if (llaves) {
      for (const parte of llaves[1].split(',')) {
        const trozo = parte.trim()
        if (!trozo) continue
        nombres.push(trozo.split(/\s+as\s+/)[0].trim())
      }
    }
    const porDefecto = clausula.replace(/\{[^}]*\}/, '').replace(/,/g, '').trim()
    if (porDefecto && !porDefecto.startsWith('*')) nombres.push('default')

    resultado.push({ specifier, nombres })
  }
  return resultado
}

const problemas = []
const archivos = listarArchivos(RAIZ)

for (const archivo of archivos) {
  for (const { specifier, nombres } of importsDe(archivo)) {
    const destino = resolverModulo(archivo, specifier)
    if (!destino) {
      problemas.push(`${relative(process.cwd(), archivo)}: no existe el módulo '${specifier}'`)
      continue
    }
    const disponibles = exportsDe(destino)
    for (const nombre of nombres) {
      if (!disponibles.has(nombre)) {
        problemas.push(
          `${relative(process.cwd(), archivo)}: '${nombre}' no está exportado por '${specifier}' ` +
          `(${relative(process.cwd(), destino)})`
        )
      }
    }
  }
}

if (problemas.length > 0) {
  console.error(`\n✘ ${problemas.length} problema(s) de imports:\n`)
  for (const p of problemas) console.error('  - ' + p)
  console.error('')
  process.exit(1)
}

console.log(`✔ imports verificados en ${archivos.length} archivos`)
