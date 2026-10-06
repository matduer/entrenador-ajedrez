import { Chess, type Position } from 'chessops/chess'
import { clavePosicion, fenDe, jugadaLegal, posDesdeFen } from '../ajedrez/posicion.ts'
import type { Catalogo } from './catalogo.ts'
import type { Apertura } from './tipos.ts'

/** Una continuación teórica desde una posición: la jugada y cuántas líneas con nombre siguen por ahí. */
export interface Continuacion {
  uci: string
  lineas: number
  /** Nombre de la posición a la que se llega, si tiene. */
  apertura?: Apertura
}

export interface Arbol {
  /** clave de posición → continuaciones teóricas */
  hijos: Map<string, Map<string, Continuacion>>
  catalogo: Catalogo
}

let cache: Arbol | undefined

/**
 * Árbol de teoría: une todas las líneas del catálogo por posición (así las transposiciones caen en
 * el mismo nodo). La cantidad de líneas con nombre que pasan por una jugada indica cuánta teoría
 * tiene, no cuán popular es: para popularidad hace falta la base Masters.
 */
export function armarArbol(catalogo: Catalogo): Arbol {
  if (cache?.catalogo === catalogo) return cache
  const hijos = new Map<string, Map<string, Continuacion>>()
  for (const a of catalogo.aperturas) {
    const pos: Position = Chess.default()
    for (const uci of a.ucis) {
      const clave = clavePosicion(fenDe(pos))
      const move = jugadaLegal(pos, uci)
      if (!move) break
      pos.play(move)
      let mapa = hijos.get(clave)
      if (!mapa) hijos.set(clave, (mapa = new Map()))
      const c = mapa.get(uci) ?? { uci, lineas: 0, apertura: catalogo.porPosicion.get(clavePosicion(fenDe(pos))) }
      c.lineas++
      mapa.set(uci, c)
    }
  }
  cache = { hijos, catalogo }
  return cache
}

export function continuaciones(arbol: Arbol, fen: string): Continuacion[] {
  return [...(arbol.hijos.get(clavePosicion(fen))?.values() ?? [])].sort((a, b) => b.lineas - a.lineas)
}

/** Nombre de la posición o, si no tiene, de la última posición con nombre de la línea. */
export function nombreDeLinea(catalogo: Catalogo, ucis: string[]): Apertura | undefined {
  const pos: Position = Chess.default()
  let ultima: Apertura | undefined
  for (const uci of ucis) {
    const move = jugadaLegal(pos, uci)
    if (!move) break
    pos.play(move)
    ultima = catalogo.porPosicion.get(clavePosicion(fenDe(pos))) ?? ultima
  }
  return ultima
}

/** Posiciones (FEN) a lo largo de una línea, empezando por la inicial. */
export function fensDeLinea(ucis: string[]): string[] {
  const pos: Position = Chess.default()
  const fens = [fenDe(pos)]
  for (const uci of ucis) {
    const move = jugadaLegal(pos, uci)
    if (!move) break
    pos.play(move)
    fens.push(fenDe(pos))
  }
  return fens
}

/**
 * Todas las líneas teóricas que salen de una posición, hasta `maxPlies` jugadas más, como listas
 * de UCI desde la posición inicial. Sirve para practicar una apertura completa.
 */
export function lineasDesde(arbol: Arbol, prefijo: string[], maxPlies: number): string[][] {
  const lineas: string[][] = []
  const fens = fensDeLinea(prefijo)
  const recorrer = (ucis: string[], fen: string, resto: number) => {
    const sig = resto > 0 ? continuaciones(arbol, fen) : []
    if (sig.length === 0) {
      if (ucis.length > prefijo.length) lineas.push(ucis)
      return
    }
    for (const c of sig) {
      const pos = posDesdeFen(fen)
      const move = jugadaLegal(pos, c.uci)
      if (!move) continue
      pos.play(move)
      recorrer([...ucis, c.uci], fenDe(pos), resto - 1)
    }
  }
  recorrer(prefijo, fens[fens.length - 1], maxPlies)
  return lineas
}
