import { db, guardarAjuste, leerAjuste, leerUsuarios } from '../datos/db.ts'
import { partidasDesdeTextoPgn } from '../datos/normalizar.ts'
import type { Fuente, Partida } from '../datos/tipos.ts'
import { importarChesscom } from './chesscom.ts'
import { importarLichess } from './lichess.ts'

/** Guarda solo las partidas que no estaban: nunca pisa una partida ya analizada. */
async function guardarNuevas(partidas: Partida[]): Promise<number> {
  const lote = [...new Map(partidas.map((p) => [p.id, p])).values()]
  const existentes = await db.partidas.bulkGet(lote.map((p) => p.id))
  const nuevas = lote.filter((_, i) => !existentes[i])
  await db.partidas.bulkAdd(nuevas)
  return nuevas.length
}

async function avanzarCursor(fuente: Fuente, lote: Partida[]) {
  const actual = await leerAjuste<number>(`cursor:${fuente}`, 0)
  const maximo = Math.max(actual, ...lote.map((p) => p.fecha))
  await guardarAjuste(`cursor:${fuente}`, maximo)
}

export interface ResultadoImportacion {
  fuente: Fuente
  nuevas: number
  error?: string
}

/** Importa las partidas nuevas de Lichess y Chess.com desde la última importación. */
export async function importarNuevas(alInformar: (mensaje: string) => void): Promise<ResultadoImportacion[]> {
  const usuarios = await leerUsuarios()
  const resultados: ResultadoImportacion[] = []

  if (usuarios.lichess) {
    let nuevas = 0
    try {
      const desde = await leerAjuste<number>('cursor:lichess', 0)
      alInformar('Lichess: conectando…')
      await importarLichess(
        usuarios.lichess,
        desde,
        async (lote) => {
          nuevas += await guardarNuevas(lote)
          await avanzarCursor('lichess', lote)
        },
        (n) => alInformar(`Lichess: ${n} partidas recibidas…`),
      )
      resultados.push({ fuente: 'lichess', nuevas })
    } catch (e) {
      resultados.push({ fuente: 'lichess', nuevas, error: mensajeDeError(e) })
    }
  }

  if (usuarios.chesscom) {
    let nuevas = 0
    try {
      const desde = await leerAjuste<number>('cursor:chesscom', 0)
      alInformar('Chess.com: conectando…')
      await importarChesscom(
        usuarios.chesscom,
        desde,
        async (lote) => {
          nuevas += await guardarNuevas(lote)
          await avanzarCursor('chesscom', lote)
        },
        (n, mes) => alInformar(`Chess.com: ${mes}, ${n} partidas…`),
      )
      resultados.push({ fuente: 'chesscom', nuevas })
    } catch (e) {
      resultados.push({ fuente: 'chesscom', nuevas, error: mensajeDeError(e) })
    }
  }

  await guardarAjuste('ultimaImportacion', Date.now())
  return resultados
}

export async function importarArchivoPgn(texto: string): Promise<{ leidas: number; nuevas: number }> {
  const partidas = partidasDesdeTextoPgn(texto, await leerUsuarios())
  return { leidas: partidas.length, nuevas: await guardarNuevas(partidas) }
}

export function mensajeDeError(e: unknown): string {
  if (e instanceof TypeError) return 'No hay conexión o el sitio no respondió.'
  return e instanceof Error ? e.message : String(e)
}
