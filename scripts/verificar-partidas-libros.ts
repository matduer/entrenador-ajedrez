/**
 * Control de las partidas de libros: en la posición final, el ganador según el resultado no puede estar peor
 * para Stockfish (si lo está, probablemente se coló una variante del comentario como línea principal).
 * Uso: node scripts/verificar-partidas-libros.ts <prefijo-id>
 */
import { readFileSync } from 'node:fs'
import { makeFen } from 'chessops/fen'
import { parseUci } from 'chessops/util'
import { FEN_INICIAL, posDesdeFen } from '../src/lib/ajedrez/posicion.ts'
import { MotorNativo } from './lib-motor.ts'
const pref = process.argv[2]
const ps = JSON.parse(readFileSync('public/datos/partidas-libros.json', 'utf8')).filter((p: any) => p.id.startsWith(pref))
const motor = new MotorNativo(14, 1)
for (const p of ps) {
  const pos = posDesdeFen(FEN_INICIAL)
  for (const u of p.jugadas) pos.play(parseUci(u)!)
  const fen = makeFen(pos.toSetup())
  let ev: any = 'fin'
  if (!pos.isEnd()) { const a = await motor.analizar(fen, 1); ev = a.lineas[0]?.ev }
  // evaluación desde las blancas
  const s = typeof ev === 'object' ? (ev.mate !== undefined ? Math.sign(ev.mate) * 10000 : ev.cp) * (pos.turn === 'white' ? 1 : -1) : 0
  const ok = p.resultado === '1-0' ? s > -100 : p.resultado === '0-1' ? s < 100 : Math.abs(s) < 300
  console.log(ok ? 'ok ' : 'MAL', p.id, p.resultado, s, pos.isEnd() ? 'fin' : '')
}
motor.cerrar()
