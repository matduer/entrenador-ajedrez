import type { Fuente } from '../aperturas/explicaciones.ts'
export type Objetivo = 'ganar' | 'tablas'

export interface PosicionFinal {
  id: string
  fen: string
  /** Para el bando que mueve. */
  objetivo: Objetivo
  consigna: string
  pista?: string
  /** Jugadas propias para lograrlo (para "tablas": cuántas hay que aguantar). */
  maxJugadas: number
  verificacion?: { ok: boolean; resultado: string; mejor?: string; dtm?: number; fecha: string }
}

export interface TemaFinal {
  id: string
  titulo: string
  nivel: number
  explicacion: string[]
  ideas: string[]
  posiciones: PosicionFinal[]
  fuentes: Fuente[]
}

export interface Temario {
  temas: TemaFinal[]
}
