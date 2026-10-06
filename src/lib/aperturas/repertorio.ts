import { Chess, type Position } from 'chessops/chess'
import { clavePosicion, fenDe, jugadaLegal } from '../ajedrez/posicion.ts'
import { db } from '../datos/db.ts'
import type { Color, LineaRepertorio, Partida } from '../datos/tipos.ts'

export function idLinea(color: Color, ucis: string[]): string {
  return `${color}:${ucis.join(' ')}`
}

export async function agregarLinea(color: Color, ucis: string[], nombre: string | undefined, origen: LineaRepertorio['origen']) {
  // Una línea que es prefijo de otra ya guardada no agrega nada; si la nueva extiende a una
  // guardada, la reemplaza.
  const existentes = await db.repertorio.where('color').equals(color).toArray()
  const texto = ucis.join(' ')
  if (existentes.some((l) => l.ucis.join(' ') === texto || l.ucis.join(' ').startsWith(texto + ' '))) return
  const prefijos = existentes.filter((l) => texto.startsWith(l.ucis.join(' ') + ' ')).map((l) => l.id)
  await db.transaction('rw', db.repertorio, async () => {
    await db.repertorio.bulkDelete(prefijos)
    await db.repertorio.put({ id: idLinea(color, ucis), color, ucis, nombre, origen, creada: Date.now() })
  })
}

/** Jugadas propias en conflicto: posiciones donde el repertorio tiene dos jugadas distintas mías. */
export function conflictos(lineas: LineaRepertorio[]): { clave: string; jugadas: string[] }[] {
  const porPosicion = new Map<string, Set<string>>()
  for (const l of lineas) {
    const pos: Position = Chess.default()
    for (const uci of l.ucis) {
      if (pos.turn === l.color) {
        const clave = clavePosicion(fenDe(pos))
        if (!porPosicion.has(clave)) porPosicion.set(clave, new Set())
        porPosicion.get(clave)!.add(uci)
      }
      const move = jugadaLegal(pos, uci)
      if (!move) break
      pos.play(move)
    }
  }
  return [...porPosicion].filter(([, s]) => s.size > 1).map(([clave, s]) => ({ clave, jugadas: [...s] }))
}

export interface Sugerencia {
  ucis: string[]
  partidas: number
  puntaje: number
}

/**
 * Sugiere un repertorio a partir de lo que realmente jugás: en tus turnos toma tu jugada más
 * frecuente; en los del rival, abre una rama por cada respuesta que aparezca en al menos el 10 %
 * de las partidas (y 3 partidas). Las líneas terminan cuando quedan menos de 3 partidas.
 */
export function sugerirRepertorio(partidas: Partida[], color: Color, maxPlies = 14): Sugerencia[] {
  const mias = partidas.filter((p) => p.miColor === color)
  const sugerencias: Sugerencia[] = []

  const recorrer = (ucis: string[], grupo: Partida[]) => {
    const ply = ucis.length
    const cuenta = new Map<string, Partida[]>()
    for (const p of grupo) {
      const uci = p.jugadas[ply]
      if (!uci) continue
      if (!cuenta.has(uci)) cuenta.set(uci, [])
      cuenta.get(uci)!.push(p)
    }
    const turnoMio = (ply % 2 === 0) === (color === 'white')
    let siguientes = [...cuenta].sort((a, b) => b[1].length - a[1].length)
    siguientes = turnoMio ? siguientes.slice(0, 1) : siguientes.filter(([, g]) => g.length >= 3 && g.length >= grupo.length * 0.1)
    siguientes = siguientes.filter(([, g]) => g.length >= 3)
    if (ply >= maxPlies || siguientes.length === 0) {
      if (ply > 0) {
        const puntos = grupo.reduce((s, p) => s + (p.resultado === 'gano' ? 1 : p.resultado === 'tablas' ? 0.5 : 0), 0)
        sugerencias.push({ ucis, partidas: grupo.length, puntaje: puntos / grupo.length })
      }
      return
    }
    for (const [uci, g] of siguientes) recorrer([...ucis, uci], g)
  }
  recorrer([], mias)
  return sugerencias.sort((a, b) => b.partidas - a.partidas)
}
