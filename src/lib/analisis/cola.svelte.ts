import { Chess, type Position } from 'chessops/chess'
import { fenDe, jugarUci } from '../ajedrez/posicion.ts'
import { db, leerPreferencias } from '../datos/db.ts'
import type { ErrorPartida, Partida } from '../datos/tipos.ts'
import { motorFondo } from '../motor/motor.ts'
import { construirError, type AnalisisPosicion } from './errores.ts'

/** Estado visible de la cola de análisis de fondo. */
export const cola = $state({
  activa: false,
  pendientes: 0,
  partida: '',
  posicion: 0,
  totalPosiciones: 0,
  analizadas: 0,
  erroresNuevos: 0,
  error: '',
})

let pausaPedida = false

export async function contarPendientes(): Promise<number> {
  cola.pendientes = await db.partidas.where('estadoAnalisis').equals('pendiente').count()
  return cola.pendientes
}

function rival(p: Partida): string {
  return p.miColor === 'white' ? p.negras : p.blancas
}

function analisisTerminal(pos: Position): AnalisisPosicion {
  return { ev: pos.isCheckmate() ? { mate: 0 } : { cp: 0 }, mejor: '', linea: [] }
}

/**
 * Analiza la partida completa: evalúa la posición antes y después de cada jugada propia, y guarda
 * como error toda jugada que pierda chances de ganar (imprecisión o peor). Devuelve false si se pausó.
 */
async function analizarPartida(partida: Partida, profundidad: number): Promise<boolean> {
  const motor = motorFondo()
  const fens: string[] = []
  const posiciones: Position[] = []
  let pos: Position = Chess.default()
  for (let ply = 0; ply <= partida.jugadas.length; ply++) {
    fens.push(fenDe(pos))
    posiciones.push(pos)
    if (ply < partida.jugadas.length) {
      const sig = jugarUci(pos, partida.jugadas[ply])
      if (!sig) break
      pos = sig
    }
  }

  // Solo hacen falta las posiciones antes y después de mis jugadas.
  const miTurno = partida.miColor
  const necesarias = new Set<number>()
  for (let ply = 0; ply < fens.length - 1; ply++) {
    if (posiciones[ply].turn === miTurno) {
      necesarias.add(ply)
      necesarias.add(ply + 1)
    }
  }

  const analisis = new Map<number, AnalisisPosicion>()
  cola.totalPosiciones = necesarias.size
  cola.posicion = 0
  for (const ply of [...necesarias].sort((a, b) => a - b)) {
    if (pausaPedida) return false
    const p = posiciones[ply]
    if (p.isEnd()) analisis.set(ply, analisisTerminal(p))
    else {
      const r = await motor.analizar(fens[ply], { profundidad })
      analisis.set(ply, { ev: r.ev, mejor: r.mejor, linea: r.linea })
    }
    cola.posicion++
  }

  const errores: ErrorPartida[] = []
  for (let ply = 0; ply < fens.length - 1; ply++) {
    if (posiciones[ply].turn !== miTurno) continue
    const antes = analisis.get(ply)
    const despues = analisis.get(ply + 1)
    if (!antes || !despues || !antes.mejor) continue
    const e = construirError(partida, ply, fens[ply], antes, despues, 'app')
    if (e) errores.push(e)
  }

  await db.transaction('rw', db.partidas, db.errores, async () => {
    await db.errores.bulkPut(errores)
    await db.partidas.update(partida.id, { estadoAnalisis: 'analizada' })
  })
  cola.erroresNuevos += errores.filter((e) => e.clasificacion !== 'imprecision').length
  return true
}

/** Analiza las partidas pendientes, de la más nueva a la más vieja, hasta terminar o pausar. */
export async function iniciarCola(): Promise<void> {
  if (cola.activa) return
  pausaPedida = false
  cola.activa = true
  cola.error = ''
  try {
    const { profundidad } = await leerPreferencias()
    for (;;) {
      if (pausaPedida) break
      const partida = await db.partidas.where('estadoAnalisis').equals('pendiente').reverse().sortBy('fecha').then((ps) => ps[0])
      if (!partida) break
      cola.partida = `${rival(partida)} · ${new Date(partida.fecha).toLocaleDateString('es-AR')}`
      const completa = await analizarPartida(partida, profundidad)
      if (!completa) break
      cola.analizadas++
      await contarPendientes()
    }
  } catch (e) {
    cola.error = e instanceof Error ? e.message : String(e)
  } finally {
    cola.activa = false
    cola.partida = ''
    await contarPendientes()
  }
}

export function pausarCola(): void {
  pausaPedida = true
  motorFondo().detener()
}
