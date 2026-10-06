import type { Position } from 'chessops/chess'
import { attacks, between, ray } from 'chessops/attacks'
import { opposite } from 'chessops/util'
import type { Color, Square } from 'chessops/types'
import type { Evaluacion } from './evaluacion.ts'
import { VALOR, jugadaLegal, posDesdeFen } from './posicion.ts'

/**
 * Detectores heurísticos de motivos tácticos. Son deliberadamente conservadores: si un motivo no se
 * reconoce con claridad, no se etiqueta (la interfaz lo muestra como "sin clasificar").
 */
export type Tema =
  | 'mate'
  | 'horquilla'
  | 'clavada'
  | 'jaque descubierto'
  | 'jaque doble'
  | 'ataque descubierto'
  | 'pieza indefensa'
  | 'ganancia de material'
  | 'promoción'

export type MotivoError = 'recibís mate' | 'pieza colgada' | Tema

function atacantes(pos: Position, casilla: Square, color: Color): number {
  return pos.kingAttackers(casilla, color, pos.board.occupied).size()
}

function material(pos: Position, color: Color): number {
  let total = 0
  for (const sq of pos.board[color]) {
    const rol = pos.board.getRole(sq)
    if (rol && rol !== 'king') total += VALOR[rol]
  }
  return total
}

/** Balance de material (propio − rival) tras jugar hasta `plies` jugadas de la línea. */
function balanceTrasLinea(pos: Position, linea: string[], plies: number, yo: Color): number {
  const p = pos.clone()
  for (const uci of linea.slice(0, plies)) {
    const move = jugadaLegal(p, uci)
    if (!move) break
    p.play(move)
  }
  return material(p, yo) - material(p, opposite(yo))
}

/** Motivos de la mejor jugada (`linea[0]`) en `fen`, para el bando que mueve. */
export function detectarTemas(fen: string, linea: string[], ev?: Evaluacion): Tema[] {
  const temas = new Set<Tema>()
  const pos = posDesdeFen(fen)
  const yo = pos.turn
  const rival = opposite(yo)

  if (ev?.mate !== undefined && ev.mate > 0) temas.add('mate')

  const move = linea[0] ? jugadaLegal(pos, linea[0]) : undefined
  if (!move || !('from' in move)) return [...temas]

  const pieza = pos.board.get(move.from)!
  const capturada = pos.board.get(move.to)
  const despues = pos.clone()
  despues.play(move)
  const destino = move.to
  const occ = despues.board.occupied

  if (move.promotion) temas.add('promoción')

  // Captura de una pieza sin defensa o que vale más que la que captura.
  if (capturada && capturada.color === rival && VALOR[capturada.role] >= 3) {
    if (atacantes(pos, destino, rival) === 0) temas.add('pieza indefensa')
    else if (VALOR[capturada.role] > VALOR[pieza.role]) temas.add('ganancia de material')
  }

  // Jaques descubiertos y dobles.
  if (despues.isCheck()) {
    const jaqueadores = despues.ctx().checkers
    if (jaqueadores.size() >= 2) temas.add('jaque doble')
    else if (!jaqueadores.has(destino)) temas.add('jaque descubierto')
  }

  // Horquilla: la pieza movida ataca dos o más piezas valiosas (el rey, piezas que valen más
  // que ella, o piezas sin defensa).
  const piezaFinal = despues.board.get(destino)!
  let objetivos = 0
  for (const sq of attacks(piezaFinal, destino, occ).intersect(despues.board[rival])) {
    const rol = despues.board.getRole(sq)!
    if (rol === 'pawn') continue
    if (rol === 'king' || VALOR[rol] > VALOR[piezaFinal.role] || atacantes(despues, sq, rival) === 0) objetivos++
  }
  if (objetivos >= 2) temas.add('horquilla')

  // Ataque descubierto: una pieza de largo alcance propia, que no se movió, pasa a atacar una
  // torre, dama o rey rival.
  for (const sq of despues.board[yo].intersect(despues.board.sliders())) {
    if (sq === destino) continue
    const p = despues.board.get(sq)!
    const antes = attacks(p, sq, pos.board.occupied)
    const ahora = attacks(p, sq, occ)
    for (const obj of ahora.diff(antes).intersect(despues.board[rival])) {
      const rol = despues.board.getRole(obj)!
      if (rol === 'rook' || rol === 'queen' || rol === 'king') {
        if (rol !== 'king' || !temas.has('jaque descubierto')) temas.add('ataque descubierto')
      }
    }
  }

  // Clavada: la pieza movida (de largo alcance) queda clavando una pieza rival contra su rey.
  const reyRival = despues.board.kingOf(rival)
  if (reyRival !== undefined && despues.board.sliders().has(destino)) {
    for (const sq of despues.ctx().blockers.intersect(despues.board[rival])) {
      const rol = despues.board.getRole(sq)!
      if (rol === 'pawn') continue
      if (ray(reyRival, sq).has(destino) && !between(reyRival, sq).has(destino)) temas.add('clavada')
    }
  }

  // Gana material a lo largo de la línea, aunque la primera jugada no capture nada.
  if (!temas.has('mate') && !temas.has('pieza indefensa') && !temas.has('ganancia de material')) {
    const antes = material(pos, yo) - material(pos, rival)
    if (balanceTrasLinea(pos, linea, 6, yo) - antes >= 2) temas.add('ganancia de material')
  }

  return [...temas]
}

/**
 * Por qué fue un error la jugada: cómo la castiga el rival. `fen` es la posición después de mi
 * jugada (mueve el rival) y `refutacion` la mejor línea del rival.
 */
export function detectarMotivoError(fen: string, refutacion: string[], evRival?: Evaluacion): MotivoError[] {
  const pos = posDesdeFen(fen)
  const yo = opposite(pos.turn)
  if (evRival?.mate !== undefined && evRival.mate > 0) return ['recibís mate']

  const move = refutacion[0] ? jugadaLegal(pos, refutacion[0]) : undefined
  if (move && 'from' in move) {
    const capturada = pos.board.get(move.to)
    const captor = pos.board.get(move.from)!
    if (capturada && capturada.color === yo && VALOR[capturada.role] >= 3) {
      if (atacantes(pos, move.to, yo) === 0 || VALOR[capturada.role] > VALOR[captor.role]) return ['pieza colgada']
    }
  }
  return detectarTemas(fen, refutacion, evRival)
}
