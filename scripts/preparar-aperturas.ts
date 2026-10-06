/**
 * Convierte el dataset abierto de aperturas de Lichess (datos-fuente/aperturas/*.tsv, CC0,
 * https://github.com/lichess-org/chess-openings) al formato de la app: public/datos/aperturas.json.
 *
 * Cada apertura queda con sus jugadas en UCI estándar, así la app no tiene que parsear SAN.
 * Uso: node scripts/preparar-aperturas.ts
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Chess } from 'chessops/chess'
import { parseSan } from 'chessops/san'
import { uciEstandar } from '../src/lib/ajedrez/posicion.ts'
import type { AperturaDatos } from '../src/lib/aperturas/tipos.ts'

const CARPETA = 'datos-fuente/aperturas'
const aperturas: AperturaDatos[] = []
let descartadas = 0

for (const archivo of readdirSync(CARPETA).filter((f) => f.endsWith('.tsv')).sort()) {
  const [, ...filas] = readFileSync(join(CARPETA, archivo), 'utf8').split('\n')
  for (const fila of filas) {
    if (!fila.trim()) continue
    const [eco, nombre, pgn] = fila.split('\t')
    const pos = Chess.default()
    const ucis: string[] = []
    let ok = true
    for (const token of pgn.split(' ')) {
      if (/^\d+\./.test(token)) continue
      const move = parseSan(pos, token)
      if (!move) {
        ok = false
        break
      }
      ucis.push(uciEstandar(pos, move))
      pos.play(move)
    }
    if (ok) aperturas.push({ eco, nombre, jugadas: ucis.join(' ') })
    else descartadas++
  }
}

mkdirSync('public/datos', { recursive: true })
writeFileSync('public/datos/aperturas.json', JSON.stringify(aperturas))
console.log(`Aperturas: ${aperturas.length} (descartadas ${descartadas}) → public/datos/aperturas.json`)
