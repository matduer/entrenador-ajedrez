import type { Position } from 'chessops/chess'
import { opposite } from 'chessops/util'
import type { Color } from 'chessops/types'
import type { Evaluacion } from '../ajedrez/evaluacion.ts'
import type { Objetivo } from './tipos.ts'

export type Resultado = { estado: 'sigue' } | { estado: 'logrado' | 'fallado'; motivo: string }

function contar(pos: Position, color: Color) {
  const b = pos.board
  const de = (s: ReturnType<typeof b.pieces>) => s.size()
  return {
    damas: de(b.pieces(color, 'queen')),
    torres: de(b.pieces(color, 'rook')),
    menores: de(b.pieces(color, 'bishop')) + de(b.pieces(color, 'knight')),
    peones: de(b.pieces(color, 'pawn')),
  }
}

/** Solo queda el rey del rival y yo tengo dama o torre: el resto es técnica de mate básica. */
function conversionLograda(pos: Position, yo: Color): boolean {
  const r = contar(pos, opposite(yo))
  const m = contar(pos, yo)
  return r.damas + r.torres + r.menores + r.peones === 0 && m.damas + m.torres > 0
}

export interface Contexto {
  objetivo: Objetivo
  yo: Color
  jugadas: number // jugadas propias ya hechas
  maxJugadas: number
  damasIniciales: number
  /** El rival ya empezó con el rey solo (mates básicos): ahí se exige el mate, no alcanza la conversión. */
  exigirMate?: boolean
  repeticiones: number // veces que se repitió la posición actual
  /** Evaluación desde mi lado, si se conoce (motor). */
  evMia?: Evaluacion
  /** Resultado teórico para el bando que mueve, si hay tablebase. */
  tablebase?: string
}

export function damasDe(pos: Position, color: Color) {
  return contar(pos, color).damas
}

export function soloRey(pos: Position, color: Color): boolean {
  const m = contar(pos, color)
  return m.damas + m.torres + m.menores + m.peones === 0
}

/** Decide si el ejercicio sigue, se logró o se falló, en la posición actual. */
export function revisar(pos: Position, c: Contexto): Resultado {
  const rival = opposite(c.yo)
  if (pos.isCheckmate()) {
    return pos.turn === rival
      ? { estado: 'logrado', motivo: 'Jaque mate.' }
      : { estado: 'fallado', motivo: 'Te dieron mate.' }
  }
  const tablas = pos.isStalemate()
    ? 'Ahogado.'
    : pos.isInsufficientMaterial()
      ? 'No queda material para dar mate.'
      : c.repeticiones >= 3
        ? 'Triple repetición.'
        : pos.halfmoves >= 100
          ? 'Regla de las 50 jugadas.'
          : undefined
  if (tablas) {
    return c.objetivo === 'tablas' ? { estado: 'logrado', motivo: `Tablas: ${tablas}` } : { estado: 'fallado', motivo: `Tablas (${tablas}) en una posición ganada.` }
  }

  if (c.objetivo === 'ganar') {
    if (!c.exigirMate && conversionLograda(pos, c.yo)) return { estado: 'logrado', motivo: 'Al rival le queda solo el rey: el mate es técnica básica.' }
    const promovio = damasDe(pos, c.yo) > c.damasIniciales
    const decisiva = c.evMia && (c.evMia.mate !== undefined ? c.evMia.mate > 0 : (c.evMia.cp ?? 0) >= 600)
    if (promovio && decisiva) return { estado: 'logrado', motivo: 'Coronaste con ventaja decisiva.' }
    if (c.tablebase && pos.turn === rival && c.tablebase !== 'loss' && c.tablebase !== 'maybe-loss') {
      return { estado: 'fallado', motivo: 'Según las tablebases, con esa jugada la posición dejó de estar ganada.' }
    }
    if (!c.tablebase && c.evMia && c.evMia.mate === undefined && (c.evMia.cp ?? 0) < 150) {
      return { estado: 'fallado', motivo: 'Según Stockfish, la ventaja ya no alcanza para ganar.' }
    }
    if (c.jugadas >= c.maxJugadas) return { estado: 'fallado', motivo: `No se logró en ${c.maxJugadas} jugadas.` }
  } else {
    if (c.tablebase && pos.turn === rival && (c.tablebase === 'win' || c.tablebase === 'maybe-win')) {
      return { estado: 'fallado', motivo: 'Según las tablebases, con esa jugada la posición quedó perdida.' }
    }
    if (!c.tablebase && c.evMia && (c.evMia.mate !== undefined ? c.evMia.mate < 0 : (c.evMia.cp ?? 0) <= -500)) {
      return { estado: 'fallado', motivo: 'Según Stockfish, la posición quedó perdida.' }
    }
    if (c.jugadas >= c.maxJugadas) return { estado: 'logrado', motivo: `Aguantaste ${c.maxJugadas} jugadas.` }
  }
  return { estado: 'sigue' }
}

export interface RespuestaTablebase {
  category: string
  moves: { uci: string; san: string; category: string }[]
}

/** Tablebases de Lichess (hasta 7 piezas). Solo en línea; sin conexión devuelve undefined. */
export async function consultarTablebase(fen: string, piezas: number): Promise<RespuestaTablebase | undefined> {
  if (piezas > 7 || typeof navigator === 'undefined' || !navigator.onLine) return undefined
  try {
    const r = await fetch(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`)
    return r.ok ? ((await r.json()) as RespuestaTablebase) : undefined
  } catch {
    return undefined
  }
}
