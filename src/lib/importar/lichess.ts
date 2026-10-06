import { Chess } from 'chessops/chess'
import { parseSan } from 'chessops/san'
import { uciEstandar } from '../ajedrez/posicion.ts'
import type { Color, Partida, Ritmo } from '../datos/tipos.ts'

interface JugadorLichess {
  user?: { name: string }
  rating?: number
  aiLevel?: number
}

interface PartidaLichess {
  id: string
  variant: string
  speed: string
  createdAt: number
  status: string
  players: { white: JugadorLichess; black: JugadorLichess }
  winner?: Color
  opening?: { eco: string; name: string }
  moves: string
  clocks?: number[]
  clock?: { initial: number; increment: number }
  daysPerTurn?: number
  initialFen?: string
}

const RITMOS: Record<string, Ritmo> = {
  ultraBullet: 'ultrabullet',
  bullet: 'bullet',
  blitz: 'blitz',
  rapid: 'rapida',
  classical: 'clasica',
  correspondence: 'correspondencia',
}

const SIN_JUGAR = new Set(['created', 'started', 'aborted', 'noStart', 'unknownFinish'])

function nombre(j: JugadorLichess): string {
  return j.user?.name ?? (j.aiLevel ? `Stockfish nivel ${j.aiLevel}` : 'Anónimo')
}

function convertir(g: PartidaLichess, usuario: string): Partida | undefined {
  if (g.variant !== 'standard' || g.initialFen || SIN_JUGAR.has(g.status)) return undefined
  const miColor: Color = g.players.white.user?.name.toLowerCase() === usuario.toLowerCase() ? 'white' : 'black'
  const pos = Chess.default()
  const jugadas: string[] = []
  for (const san of g.moves.split(' ').filter(Boolean)) {
    const move = parseSan(pos, san)
    if (!move) return undefined
    jugadas.push(uciEstandar(pos, move))
    pos.play(move)
  }
  return {
    id: `lichess:${g.id}`,
    fuente: 'lichess',
    url: `https://lichess.org/${g.id}`,
    fecha: g.createdAt,
    ritmo: RITMOS[g.speed] ?? 'clasica',
    control: g.clock ? `${g.clock.initial}+${g.clock.increment}` : g.daysPerTurn ? `1/${g.daysPerTurn * 86400}` : '-',
    blancas: nombre(g.players.white),
    negras: nombre(g.players.black),
    eloBlancas: g.players.white.rating,
    eloNegras: g.players.black.rating,
    miColor,
    resultado: !g.winner ? 'tablas' : g.winner === miColor ? 'gano' : 'pierdo',
    porTiempo: g.status === 'outoftime',
    terminacion: g.status,
    eco: g.opening?.eco,
    apertura: g.opening?.name,
    jugadas,
    relojes: g.clocks,
    estadoAnalisis: jugadas.length < 10 ? 'omitida' : 'pendiente',
  }
}

/**
 * Descarga las partidas de `usuario` posteriores a `desde` (ms) con la API pública de Lichess
 * (sin token). La respuesta llega como NDJSON en streaming: una partida por línea.
 */
export async function importarLichess(
  usuario: string,
  desde: number,
  alRecibir: (lote: Partida[]) => Promise<void>,
  alProgresar: (cantidad: number) => void,
): Promise<number> {
  const params = new URLSearchParams({
    since: String(desde + 1),
    moves: 'true',
    clocks: 'true',
    opening: 'true',
    sort: 'dateAsc',
  })
  const resp = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(usuario)}?${params}`, {
    headers: { Accept: 'application/x-ndjson' },
  })
  if (resp.status === 404) throw new Error(`Lichess no encuentra el usuario "${usuario}".`)
  if (resp.status === 429) throw new Error('Lichess pide esperar un minuto antes de volver a importar.')
  if (!resp.ok || !resp.body) throw new Error(`Lichess respondió con un error (${resp.status}).`)

  const lector = resp.body.pipeThrough(new TextDecoderStream()).getReader()
  let resto = ''
  let lote: Partida[] = []
  let total = 0
  for (;;) {
    const { value, done } = await lector.read()
    resto += value ?? ''
    const lineas = resto.split('\n')
    resto = done ? '' : lineas.pop()!
    for (const linea of lineas) {
      if (!linea.trim()) continue
      const p = convertir(JSON.parse(linea), usuario)
      if (p) lote.push(p)
    }
    if (lote.length >= 100 || (done && lote.length)) {
      total += lote.length
      await alRecibir(lote)
      alProgresar(total)
      lote = []
    }
    if (done) break
  }
  return total
}
