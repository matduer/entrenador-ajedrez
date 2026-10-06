import type { Position } from 'chessops/chess'

export type Fase = 'apertura' | 'medio' | 'final'

export const NOMBRE_FASE: Record<Fase, string> = {
  apertura: 'Apertura',
  medio: 'Medio juego',
  final: 'Final',
}

/**
 * Final: quedan 6 piezas o menos entre los dos bandos, sin contar reyes ni peones (criterio de Lichess).
 * Apertura: hasta la jugada 10. El resto es medio juego (coincide con el análisis previo, que
 * tomó como medio juego las jugadas 11 a 30).
 */
export function faseDe(pos: Position, numeroJugada: number): Fase {
  const b = pos.board
  const piezas = b.occupied.diff(b.pawn).diff(b.king).size()
  if (piezas <= 6) return 'final'
  if (numeroJugada <= 10) return 'apertura'
  return 'medio'
}
