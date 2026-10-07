/**
 * Herramienta de desarrollo para escribir explicaciones: muestra, para la posición al final de
 * una línea, cuánto pierde cada jugada legal según Stockfish, con la refutación de las peores.
 * Sirve para elegir alternativas de "por qué no" que de verdad pierdan.
 *
 * Uso: node scripts/explorar-posicion.ts "e2e4 c7c6 d2d4 d7d5 e4e5" [profundidad] [cantidad]
 */
import { chessgroundDests } from 'chessops/compat'
import { parseSquare } from 'chessops/util'
import { textoEvaluacion } from '../src/lib/ajedrez/evaluacion.ts'
import { lineaSan, posDesdeFen } from '../src/lib/ajedrez/posicion.ts'
import { fensDeLinea } from '../src/lib/aperturas/arbol.ts'
import { MotorNativo } from './lib-motor.ts'

const prefijo = (process.argv[2] ?? '').split(' ').filter(Boolean)
const profundidad = Number(process.argv[3] ?? 16)
const cantidad = Number(process.argv[4] ?? 40)
const motor = new MotorNativo(profundidad, 4)
const fen = fensDeLinea(prefijo).at(-1)!
const pos = posDesdeFen(fen)

// chessground incluye el enroque dos veces (rey a g1 y rey a h1): se descarta la forma "rey a la torre".
const jugadas: string[] = []
for (const [de, destinos] of chessgroundDests(pos)) {
  for (const a of destinos) {
    const esRey = pos.board.getRole(parseSquare(de)) === 'king'
    const aTorre = pos.board.getRole(parseSquare(a)) === 'rook' && pos.board.getColor(parseSquare(a)) === pos.turn
    if (!(esRey && aTorre)) jugadas.push(de + a)
  }
}
const unicas = [...new Set(jugadas)]

console.log(`Posición tras: ${lineaSan(fensDeLinea([])[0], prefijo).join(' ') || '(inicial)'}`)
const filas = []
for (const u of unicas.slice(0, cantidad)) {
  const r = await motor.evaluarJugada(prefijo, u)
  if (!r) continue
  filas.push({ u, ...r })
}
filas.sort((a, b) => a.perdida - b.perdida)
for (const f of filas) {
  const san = lineaSan(fen, [f.u])[0]
  const fenTras = fensDeLinea([...prefijo, f.u]).at(-1)!
  console.log(`${san.padEnd(7)} ${f.u} pérdida ${f.perdida.toFixed(3)}  ${textoEvaluacion(f.despues).padEnd(8)} ${f.perdida >= 0.08 ? 'refuta: ' + lineaSan(fenTras, f.refutacion.slice(0, 5)).join(' ') : ''}`)
}
motor.cerrar()
