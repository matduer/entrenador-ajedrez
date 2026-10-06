import { parsePgn, parseComment, startingPosition, type Game, type PgnNodeData } from 'chessops/pgn'
import { parseSan } from 'chessops/san'
import type { Color, Partida, Resultado, Ritmo } from './tipos.ts'
import { uciEstandar } from '../ajedrez/posicion.ts'

/** Ritmo según el tiempo estimado de la partida (base + 40 × incremento), con los cortes de Lichess. */
export function ritmoDesdeControl(control: string | undefined): Ritmo {
  if (!control || control === '-') return 'correspondencia'
  if (control.includes('/')) return 'correspondencia'
  const [base, inc] = control.split('+').map(Number)
  if (!Number.isFinite(base)) return 'correspondencia'
  const estimado = base + 40 * (inc || 0)
  if (estimado < 30) return 'ultrabullet'
  if (estimado < 180) return 'bullet'
  if (estimado < 480) return 'blitz'
  if (estimado < 1500) return 'rapida'
  return 'clasica'
}

export function resultadoPara(resultado: string, color: Color): Resultado {
  if (resultado === '1/2-1/2') return 'tablas'
  const ganaBlancas = resultado === '1-0'
  return ganaBlancas === (color === 'white') ? 'gano' : 'pierdo'
}

/** Nombre de apertura a partir de la URL de Chess.com ("…/openings/Caro-Kann-Defense-Advance-Variation-3...Bf5"). */
export function aperturaDesdeUrlChesscom(url: string | undefined): string | undefined {
  if (!url) return undefined
  const slug = url.split('/openings/')[1]
  if (!slug) return undefined
  return decodeURIComponent(slug)
    .replace(/-(\d+)\.\.\./g, ' $1...')
    .replace(/-(\d+)\./g, ' $1.')
    .replace(/-/g, ' ')
    .trim()
}

function fechaHora(fecha: string | undefined, hora: string | undefined): number {
  const t = Date.parse(`${(fecha ?? '').replace(/\./g, '-')}T${(hora ?? '00:00:00').split(' ')[0]}Z`)
  return Number.isFinite(t) ? t : 0
}

function hashJugadas(jugadas: string[]): string {
  let h = 0x811c9dc5
  for (const c of jugadas.join(' ')) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

/**
 * Chess.com no trae identificador en la exportación web, así que la partida se identifica por
 * jugadores + hash de las jugadas. La fecha no sirve: la exportación web informa la de inicio y
 * la API la de fin, y en partidas por correspondencia difieren en días. La importación por API
 * arma la misma clave.
 */
export function idChesscom(blancas: string, negras: string, jugadas: string[]): string {
  return `chesscom:${blancas.toLowerCase()}-${negras.toLowerCase()}-${hashJugadas(jugadas)}`
}

/** Fuente, fecha y enlace. El id de Lichess sale del enlace; el de Chess.com se completa con las jugadas. */
function origenPgn(h: Map<string, string>): { id: string; fuente: Partida['fuente']; url?: string; fecha: number } | undefined {
  const site = h.get('Site') ?? ''
  if (site.includes('lichess.org')) {
    const codigo = site.split('/').pop()!.slice(0, 8)
    return {
      id: `lichess:${codigo}`,
      fuente: 'lichess',
      url: `https://lichess.org/${codigo}`,
      fecha: fechaHora(h.get('UTCDate') ?? h.get('Date'), h.get('UTCTime')),
    }
  }
  const link = h.get('Link')
  if (site.toLowerCase().includes('chess.com') || link?.includes('chess.com')) {
    const fin = fechaHora(h.get('EndDate') ?? h.get('Date'), h.get('EndTime'))
    return { id: '', fuente: 'chesscom', url: link, fecha: fin }
  }
  return undefined
}

function centesimas(clk: number | undefined): number | undefined {
  return clk === undefined ? undefined : Math.round(clk * 100)
}

/** Recorre la línea principal: jugadas en UCI estándar y reloj restante tras cada una. */
export function jugadasDePgn(game: Game<PgnNodeData>): { jugadas: string[]; relojes: (number | undefined)[] } | undefined {
  const inicio = startingPosition(game.headers)
  if (inicio.isErr) return undefined
  const pos = inicio.value
  const jugadas: string[] = []
  const relojes: (number | undefined)[] = []
  for (const nodo of game.moves.mainline()) {
    const move = parseSan(pos, nodo.san)
    if (!move) return undefined
    jugadas.push(uciEstandar(pos, move))
    pos.play(move)
    const comentario = nodo.comments?.map(parseComment).find((c) => c.clock !== undefined)
    relojes.push(centesimas(comentario?.clock))
  }
  return { jugadas, relojes }
}

export interface Usuarios {
  lichess?: string
  chesscom?: string
}

/** Convierte una partida PGN (exportada de Lichess o Chess.com) al formato de la app. */
export function partidaDesdePgn(game: Game<PgnNodeData>, usuarios: Usuarios): Partida | undefined {
  const h = game.headers
  const variante = (h.get('Variant') ?? 'Standard').toLowerCase()
  if (variante !== 'standard' && variante !== 'chess') return undefined
  if (h.get('SetUp') === '1' || h.has('FEN')) return undefined

  const origen = origenPgn(h)
  if (!origen) return undefined
  const usuario = (origen.fuente === 'lichess' ? usuarios.lichess : usuarios.chesscom)?.toLowerCase()
  const blancas = h.get('White') ?? '?'
  const negras = h.get('Black') ?? '?'
  let miColor: Color
  if (blancas.toLowerCase() === usuario) miColor = 'white'
  else if (negras.toLowerCase() === usuario) miColor = 'black'
  else return undefined

  const resultadoPgn = h.get('Result') ?? '*'
  if (resultadoPgn === '*') return undefined
  const movidas = jugadasDePgn(game)
  if (!movidas) return undefined

  const terminacion = h.get('Termination') ?? ''
  const porTiempo = /time forfeit|on time|timeout|by time/i.test(terminacion)
  const control = h.get('TimeControl') ?? '-'
  const tieneRelojes = movidas.relojes.some((r) => r !== undefined)

  return {
    id: origen.fuente === 'chesscom' ? idChesscom(blancas, negras, movidas.jugadas) : origen.id,
    fuente: origen.fuente,
    url: origen.url,
    fecha: origen.fecha,
    ritmo: ritmoDesdeControl(control),
    control,
    blancas,
    negras,
    eloBlancas: Number(h.get('WhiteElo')) || undefined,
    eloNegras: Number(h.get('BlackElo')) || undefined,
    miColor,
    resultado: resultadoPara(resultadoPgn, miColor),
    porTiempo,
    terminacion: terminacion || undefined,
    eco: h.get('ECO') && h.get('ECO') !== '?' ? h.get('ECO') : undefined,
    apertura: h.get('Opening') ?? aperturaDesdeUrlChesscom(h.get('ECOUrl')),
    jugadas: movidas.jugadas,
    relojes: tieneRelojes ? movidas.relojes.map((r) => r ?? -1) : undefined,
    estadoAnalisis: movidas.jugadas.length < 10 ? 'omitida' : 'pendiente',
  }
}

export function partidasDesdeTextoPgn(texto: string, usuarios: Usuarios): Partida[] {
  const partidas: Partida[] = []
  for (const game of parsePgn(texto)) {
    const p = partidaDesdePgn(game, usuarios)
    if (p) partidas.push(p)
  }
  return partidas
}
