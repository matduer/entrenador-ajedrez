/** Evaluación de motor desde el punto de vista de un bando: centipeones o mate en N (negativo = recibe mate). */
export interface Evaluacion {
  cp?: number
  mate?: number
}

export type Clasificacion = 'imprecision' | 'error' | 'grave'

export const NOMBRE_CLASIFICACION: Record<Clasificacion, string> = {
  imprecision: 'Imprecisión',
  error: 'Error',
  grave: 'Error grave',
}

/**
 * Probabilidad de ganar en escala [-1, 1], con la misma curva que usa Lichess para clasificar
 * jugadas. Hace que perder 300 cp en una posición igualada pese más que perderlos estando +9.
 */
export function chancesDeGanar(ev: Evaluacion): number {
  if (ev.mate !== undefined) return ev.mate > 0 ? 1 : -1
  const cp = Math.max(-1000, Math.min(1000, ev.cp ?? 0))
  return 2 / (1 + Math.exp(-0.00368208 * cp)) - 1
}

export function invertir(ev: Evaluacion): Evaluacion {
  if (ev.mate !== undefined) return { mate: -ev.mate }
  return { cp: -(ev.cp ?? 0) }
}

/** Umbrales de Lichess sobre la caída de chances de ganar. */
export function clasificar(perdida: number): Clasificacion | undefined {
  if (perdida >= 0.3) return 'grave'
  if (perdida >= 0.2) return 'error'
  if (perdida >= 0.1) return 'imprecision'
  return undefined
}

export function textoEvaluacion(ev: Evaluacion): string {
  if (ev.mate !== undefined) {
    if (ev.mate === 0) return 'mate'
    return ev.mate > 0 ? `mate en ${ev.mate}` : `recibe mate en ${-ev.mate}`
  }
  const p = (ev.cp ?? 0) / 100
  const signo = p > 0 ? '+' : p < 0 ? '−' : ''
  return signo + Math.abs(p).toFixed(1).replace('.', ',')
}
