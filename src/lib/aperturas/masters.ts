import { leerAjuste } from '../datos/db.ts'

/**
 * Consulta en línea a la base Masters de Lichess (partidas presenciales de jugadores de más de
 * 2200). Desde 2025 el explorador de Lichess exige un token personal: se crea sin ningún permiso
 * en https://lichess.org/account/oauth/token y se pega en Ajustes. Queda guardado solo en este
 * dispositivo y nunca entra en los respaldos.
 */
export interface JugadaMasters {
  uci: string
  san: string
  white: number
  draws: number
  black: number
  averageRating?: number
}

export interface RespuestaMasters {
  white: number
  draws: number
  black: number
  moves: JugadaMasters[]
}

export const leerToken = () => leerAjuste<string>('tokenLichess', '')

export async function consultarMasters(fen: string): Promise<RespuestaMasters | 'sin-token' | 'error'> {
  const token = await leerToken()
  if (!token) return 'sin-token'
  try {
    const resp = await fetch(`https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}&moves=12&topGames=0`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!resp.ok) return 'error'
    return (await resp.json()) as RespuestaMasters
  } catch {
    return 'error'
  }
}
