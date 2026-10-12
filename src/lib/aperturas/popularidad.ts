import { clavePosicion } from '../ajedrez/posicion.ts'
import { db } from '../datos/db.ts'
import { leerToken } from './masters.ts'

/**
 * Cuánto se juega cada jugada en una posición según la base Masters de Lichess (partidas
 * presenciales de jugadores de más de 2200). Sirve para ordenar las respuestas del rival en los
 * cursos: primero lo que más se juega, y las rarezas a una sección aparte. Las consultas necesitan
 * el token de Ajustes y quedan guardadas en este dispositivo (ajustes «masters:<posición>»), así que
 * cada posición se pide una sola vez. No entran en los respaldos.
 */
export type Frecuencias = Record<string, number>

export const PREFIJO_CACHE = 'masters:'
const clave = (fen: string) => PREFIJO_CACHE + clavePosicion(fen)

/** Las frecuencias ya guardadas, por clave de posición. */
export async function frecuenciasGuardadas(fens: string[]): Promise<Map<string, Frecuencias>> {
  const unicas = [...new Set(fens.map(clave))]
  const filas = await db.ajustes.bulkGet(unicas)
  const r = new Map<string, Frecuencias>()
  filas.forEach((f, i) => f && r.set(unicas[i].slice(PREFIJO_CACHE.length), f.valor as Frecuencias))
  return r
}

/** El explorador escribe el enroque como rey a torre (e1h1); el resto de la app, como e1g1. */
function uciNormal(uci: string): string {
  const enroques: Record<string, string> = { e1h1: 'e1g1', e1a1: 'e1c1', e8h8: 'e8g8', e8a8: 'e8c8' }
  return enroques[uci] ?? uci
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Descarga las posiciones que faltan, de a una y sin apurar al servidor. Devuelve 'sin-token' si no
 * hay token, 'error' si el servidor rechaza el token o no responde, y 'ok' al terminar.
 */
export async function descargarFrecuencias(fens: string[], alProgreso?: (hechas: number, total: number) => void): Promise<'ok' | 'sin-token' | 'error'> {
  const token = await leerToken()
  if (!token) return 'sin-token'
  const guardadas = await frecuenciasGuardadas(fens)
  const faltan = [...new Map(fens.filter((f) => !guardadas.has(clavePosicion(f))).map((f) => [clavePosicion(f), f])).values()]
  for (const [i, fen] of faltan.entries()) {
    alProgreso?.(i, faltan.length)
    let intentos = 0
    for (;;) {
      let resp: Response
      try {
        resp = await fetch(`https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}&moves=30&topGames=0`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch {
        return 'error'
      }
      if (resp.status === 429 && intentos++ < 3) {
        await esperar(60_000)
        continue
      }
      if (!resp.ok) return 'error'
      const datos = (await resp.json()) as { moves: { uci: string; white: number; draws: number; black: number }[] }
      const f: Frecuencias = {}
      for (const m of datos.moves) f[uciNormal(m.uci)] = m.white + m.draws + m.black
      await db.ajustes.put({ clave: clave(fen), valor: f })
      break
    }
    await esperar(250)
  }
  alProgreso?.(faltan.length, faltan.length)
  return 'ok'
}
