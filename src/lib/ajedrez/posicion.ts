import { Chess, type Position } from 'chessops/chess'
import { makeFen, parseFen } from 'chessops/fen'
import { makeSan, parseSan } from 'chessops/san'
import { castlingSide } from 'chessops/chess'
import { kingCastlesTo, makeSquare, makeUci, parseUci } from 'chessops/util'
import type { Move, Role } from 'chessops/types'

export const FEN_INICIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export const VALOR: Record<Role, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 100 }

export function posDesdeFen(fen: string): Chess {
  return Chess.fromSetup(parseFen(fen).unwrap()).unwrap()
}

export function fenDe(pos: Position): string {
  return makeFen(pos.toSetup())
}

/** Clave de posición sin contadores ni captura al paso: sirve para buscar la misma posición en otra fuente. */
export function clavePosicion(fen: string): string {
  return fen.split(' ').slice(0, 3).join(' ')
}

/**
 * UCI estándar (el que usa Stockfish): el enroque se escribe con la casilla de destino del rey
 * (e1g1), no con la de la torre como hace chessops internamente.
 */
export function uciEstandar(pos: Position, move: Move): string {
  if ('from' in move) {
    const lado = castlingSide(pos, move)
    if (lado) return makeSquare(move.from) + makeSquare(kingCastlesTo(pos.turn, lado))
  }
  return makeUci(move)
}

/** Convierte un UCI (de Stockfish o de chessground) en una jugada legal de esta posición. */
export function jugadaLegal(pos: Position, uci: string): Move | undefined {
  const move = parseUci(uci)
  if (!move || !pos.isLegal(move)) return undefined
  return move
}

export function jugarUci(pos: Position, uci: string): Position | undefined {
  const move = jugadaLegal(pos, uci)
  if (!move) return undefined
  const sig = pos.clone()
  sig.play(move)
  return sig
}

const LETRA_ES: Record<string, string> = { K: 'R', Q: 'D', R: 'T', B: 'A', N: 'C' }

/** Notación algebraica en español: Cf3, Dxd5, Txe1, Axb7, Re2, e8=D. */
export function aEspanol(san: string): string {
  return san.replace(/[KQRBN]/g, (l) => LETRA_ES[l])
}

/** SAN en español de una jugada UCI (para mostrar). */
export function sanDeUci(pos: Position, uci: string): string {
  const move = jugadaLegal(pos, uci)
  return move ? aEspanol(makeSan(pos, move)) : uci
}

export function uciDeSan(pos: Position, san: string): string | undefined {
  const move = parseSan(pos, san)
  return move ? uciEstandar(pos, move) : undefined
}

/** Línea de jugadas UCI → lista de SAN en español, cortando en la primera ilegal. */
export function lineaSan(fen: string, ucis: string[]): string[] {
  const pos = posDesdeFen(fen)
  const sans: string[] = []
  for (const uci of ucis) {
    const move = jugadaLegal(pos, uci)
    if (!move) break
    sans.push(aEspanol(makeSan(pos, move)))
    pos.play(move)
  }
  return sans
}

/** Texto con números de jugada: "23. Cf5 gxf5 24. Dg4+". */
export function lineaConNumeros(fen: string, ucis: string[]): string {
  const pos = posDesdeFen(fen)
  let numero = Number(fen.split(' ')[5] ?? 1)
  let texto = ''
  let primera = true
  for (const uci of ucis) {
    const move = jugadaLegal(pos, uci)
    if (!move) break
    if (pos.turn === 'white') texto += `${numero}. `
    else if (primera) texto += `${numero}… `
    texto += aEspanol(makeSan(pos, move)) + ' '
    if (pos.turn === 'black') numero++
    pos.play(move)
    primera = false
  }
  return texto.trim()
}
