/**
 * Arma la selección offline de problemas a partir de la base pública de Lichess (CC0,
 * https://database.lichess.org/#puzzles). La base se procesa en streaming (zstd) sin guardarla:
 * se corta en cuanto se completan los cupos por tema.
 *
 * Criterios: rating 1400-2200 (alrededor del objetivo 1700-1800), desvío de rating < 90,
 * popularidad ≥ 85 y al menos 300 partidas jugadas (problemas probados y bien valorados).
 * Cupo de 250 por tema prioritario: cada problema cuenta para el primer tema de la lista que tenga.
 *
 * Uso: node scripts/preparar-problemas.ts   → public/datos/problemas.json
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { Readable, Transform } from 'node:stream'
import { createInterface } from 'node:readline'
import { createZstdDecompress } from 'node:zlib'

const URL_BASE = 'https://database.lichess.org/lichess_db_puzzle.csv.zst'
const CUPO = 250

// Orden de prioridad: primero los motivos que más pesan en tus errores (material colgado,
// horquillas, clavadas, mates) y después el resto.
const TEMAS = [
  'hangingPiece',
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'backRankMate',
  'deflection',
  'attraction',
  'intermezzo',
  'xRayAttack',
  'trappedPiece',
  'defensiveMove',
  'quietMove',
  'sacrifice',
  'rookEndgame',
  'pawnEndgame',
] as const

interface Problema {
  id: string
  fen: string
  jugadas: string[]
  rating: number
  temas: string[]
}

const cupos = new Map<string, Problema[]>(TEMAS.map((t) => [t, []]))
const completos = () => [...cupos.values()].every((l) => l.length >= CUPO)

const resp = await fetch(URL_BASE)
if (!resp.ok || !resp.body) throw new Error(`No se pudo bajar la base (${resp.status})`)

// El archivo usa el formato zstd "seekable": empieza (y termina) con frames saltables que el
// descompresor de Node no reconoce. Se saltean los 12 bytes del primero; el del final (la tabla
// de búsqueda) se trata como fin de datos.
let saltear = 12
const sinCabecera = new Transform({
  transform(chunk: Buffer, _enc, listo) {
    if (saltear > 0) {
      const corte = Math.min(saltear, chunk.length)
      saltear -= corte
      chunk = chunk.subarray(corte)
    }
    listo(null, chunk)
  },
})
const descompresor = createZstdDecompress()
descompresor.on('error', (e) => {
  console.log(`Fin del flujo comprimido (${e.message}).`)
  descompresor.end()
})
const flujo = Readable.fromWeb(resp.body as never).pipe(sinCabecera).pipe(descompresor)
const lineas = createInterface({ input: flujo })

let leidas = 0
for await (const linea of lineas) {
  leidas++
  if (leidas === 1) continue // encabezado
  const [id, fen, moves, rating, desvio, popularidad, partidas, temas] = linea.split(',')
  const r = Number(rating)
  if (r < 1400 || r > 2200 || Number(desvio) >= 90 || Number(popularidad) < 85 || Number(partidas) < 300) continue
  const lista = temas.split(' ')
  const tema = TEMAS.find((t) => lista.includes(t) && cupos.get(t)!.length < CUPO)
  if (!tema) continue
  cupos.get(tema)!.push({ id, fen, jugadas: moves.split(' '), rating: r, temas: lista })
  if (leidas % 100000 === 0) console.log(`${leidas} leídas; elegidos ${[...cupos.values()].reduce((s, l) => s + l.length, 0)}`)
  if (completos()) break
}
flujo.destroy()

const problemas = [...cupos.values()].flat()
mkdirSync('public/datos', { recursive: true })
writeFileSync('public/datos/problemas.json', JSON.stringify(problemas))
console.log(`Listo: ${problemas.length} problemas tras leer ${leidas} filas.`)
for (const [t, l] of cupos) console.log(`  ${t}: ${l.length}`)
process.exit(0)
