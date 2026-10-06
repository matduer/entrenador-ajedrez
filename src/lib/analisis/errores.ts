import { chancesDeGanar, clasificar, invertir, type Evaluacion } from '../ajedrez/evaluacion.ts'
import { faseDe } from '../ajedrez/fase.ts'
import { fenDe, jugarUci, posDesdeFen } from '../ajedrez/posicion.ts'
import { detectarMotivoError, detectarTemas } from '../ajedrez/temas.ts'
import type { ErrorPartida, Partida } from '../datos/tipos.ts'

export interface AnalisisPosicion {
  ev: Evaluacion // desde el punto de vista del bando que mueve
  mejor: string
  linea: string[]
}

/**
 * Compara la posición antes de mi jugada con la posición después y, si perdí chances de ganar
 * suficientes para que cuente como imprecisión o peor, arma el registro del error.
 */
export function construirError(
  partida: Partida,
  ply: number,
  fenAntes: string,
  antes: AnalisisPosicion,
  despues: AnalisisPosicion,
  origen: ErrorPartida['origen'],
): ErrorPartida | undefined {
  const jugada = partida.jugadas[ply]
  if (!jugada || jugada === antes.mejor) return undefined

  const evAntes = antes.ev
  const evDespues = invertir(despues.ev)
  const perdida = chancesDeGanar(evAntes) - chancesDeGanar(evDespues)
  const clasificacion = clasificar(perdida)
  if (!clasificacion) return undefined

  const pos = posDesdeFen(fenAntes)
  const numeroJugada = Number(fenAntes.split(' ')[5] ?? 1)
  const posDespues = jugarUci(pos, jugada)
  if (!posDespues) return undefined

  return {
    id: `${partida.id}:${ply}`,
    partidaId: partida.id,
    ply,
    numeroJugada,
    fen: fenAntes,
    jugada,
    mejor: antes.mejor,
    lineaMejor: antes.linea,
    refutacion: despues.linea,
    evalAntes: evAntes,
    evalDespues: evDespues,
    perdida: Math.round(perdida * 1000) / 1000,
    clasificacion,
    fase: faseDe(pos, numeroJugada),
    temas: detectarTemas(fenAntes, antes.linea, evAntes),
    motivo: detectarMotivoError(fenDe(posDespues), despues.linea, despues.ev),
    miColor: partida.miColor,
    fecha: partida.fecha,
    ritmo: partida.ritmo,
    eco: partida.eco,
    apertura: partida.apertura,
    origen,
  }
}
