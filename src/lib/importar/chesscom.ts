import { parsePgn } from 'chessops/pgn'
import { partidaDesdePgn } from '../datos/normalizar.ts'
import type { Partida } from '../datos/tipos.ts'

interface PartidaChesscom {
  url: string
  pgn?: string
  end_time: number
  rules: string
}

const FEN_INICIAL_CHESSCOM = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/**
 * Descarga las partidas de `usuario` terminadas después de `desde` (ms) con la API pública de
 * Chess.com (sin token). Las partidas vienen agrupadas en un archivo por mes: solo se piden los
 * meses que pueden tener partidas nuevas.
 */
export async function importarChesscom(
  usuario: string,
  desde: number,
  alRecibir: (lote: Partida[]) => Promise<void>,
  alProgresar: (cantidad: number, mes: string) => void,
): Promise<number> {
  const base = `https://api.chess.com/pub/player/${encodeURIComponent(usuario.toLowerCase())}`
  const resp = await fetch(`${base}/games/archives`)
  if (resp.status === 404) throw new Error(`Chess.com no encuentra el usuario "${usuario}".`)
  if (!resp.ok) throw new Error(`Chess.com respondió con un error (${resp.status}).`)
  const { archives } = (await resp.json()) as { archives: string[] }

  const mesDesde = desde ? new Date(desde).toISOString().slice(0, 7) : '0000-00'
  const pendientes = archives.filter((url) => {
    const [anio, mes] = url.split('/').slice(-2)
    return `${anio}-${mes}` >= mesDesde
  })

  let total = 0
  for (const url of pendientes) {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`Chess.com respondió con un error (${r.status}).`)
    const { games } = (await r.json()) as { games: PartidaChesscom[] }
    const lote: Partida[] = []
    for (const g of games) {
      if (g.rules !== 'chess' || !g.pgn || g.end_time * 1000 <= desde) continue
      const [game] = parsePgn(g.pgn)
      if (!game) continue
      const fen = game.headers.get('FEN')
      if (fen && fen !== FEN_INICIAL_CHESSCOM) continue
      game.headers.delete('FEN')
      game.headers.delete('SetUp')
      const p = partidaDesdePgn(game, { chesscom: usuario })
      if (p) lote.push({ ...p, url: g.url, fecha: g.end_time * 1000 })
    }
    if (lote.length) {
      total += lote.length
      await alRecibir(lote)
    }
    alProgresar(total, url.split('/').slice(-2).join('-'))
  }
  return total
}
