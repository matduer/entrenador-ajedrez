/**
 * Notación descriptiva española ("P4R", "C3AR", "A5C", "CxPR", "TD1D", "0-0-0") con ruido de OCR.
 *
 * No se traduce la jugada a una sola casilla: se arma una lista de restricciones (pieza que mueve, columnas y fila
 * de destino vistas desde el bando que mueve, pieza capturada) y se buscan las jugadas legales que las cumplen.
 * "A5C" puede ser b5 o g5: si solo una es legal, es esa. Las lecturas dudosas del OCR (S/s por 5, l/I por 1, …)
 * entran como alternativas con costo, y reconstruirDescriptiva() busca la única secuencia legal completa.
 */
import type { Chess } from 'chessops/chess'
import { makeSquare } from 'chessops/util'
import type { NormalMove, Role } from 'chessops/types'
import { FEN_INICIAL, posDesdeFen, uciEstandar } from '../src/lib/ajedrez/posicion.ts'

const ROL: Record<string, Role> = { R: 'king', D: 'queen', T: 'rook', A: 'bishop', C: 'knight', P: 'pawn' }
/** Columnas posibles para un nombre de columna: "AR" = f, "A" = c o f, "D" = d, "R" = e. */
const COLUMNAS: Record<string, string> = { TD: 'a', CD: 'b', AD: 'c', D: 'd', R: 'e', AR: 'f', CR: 'g', TR: 'h', T: 'ah', C: 'bg', A: 'cf' }

export interface LecturaD {
  enroque?: 'corto' | 'largo'
  pieza?: Role
  /** columnas posibles de destino (letras a-h) */
  columnas?: string
  /** fila de destino desde el bando que mueve (1-8) */
  fila?: number
  captura: boolean
  capturada?: Role
  /** columnas posibles de la pieza capturada (si el texto las da: "PxPR") */
  colCapturada?: string
  /** ala de origen de la pieza que mueve ("CD" = caballo de dama): solo desempata */
  ala?: 'D' | 'R'
}

/** Variantes de lectura de un token (la primera es la literal). */
function variantes(tok: string): { t: string; costo: number }[] {
  const base = tok.replace(/[+!?#.,;:)]+$/g, '').replace(/^[(]/, '').replace(/[!?]/g, '').replace(/\s+/g, '').replace(/×/g, 'x').replace(/^([RDTACP][DR]?)X/, '$1x')
  const out = [{ t: base, costo: 0 }]
  // dígitos leídos como letras (en la parte numérica) y letras de pieza confundidas: "ese" = C3C, "ASe" = A5C
  const sust: [RegExp, string][] = [[/S/g, '5'], [/s/g, '5'], [/[lI]/g, '1'], [/e/g, 'C'], [/c/g, 'C'], [/a/g, 'A'], [/t/g, 'T'], [/d/g, 'D'], [/r/g, 'R'], [/O/g, '0'], [/o/g, '0'], [/B/g, '8'], [/[&G]/g, '6']]
  let t = base
  let costo = 0
  for (const [re, x] of sust) if (re.test(t)) { t = t.replace(re, x); costo++; out.push({ t, costo }) }
  return out
}

export function leerDescriptiva(tok0: string): LecturaD[] {
  const res: LecturaD[] = []
  for (const { t } of variantes(tok0)) {
    if (/^[0O]-?[0O]-?[0O]$/.test(t)) { res.push({ enroque: 'largo', captura: false }); continue }
    if (/^[0O]-?[0O]$/.test(t)) { res.push({ enroque: 'corto', captura: false }); continue }
    // pieza [ala] (destino | x capturada [destino])
    const m = /^([RDTACP])(D|R)?(?:([1-8])(TD|CD|AD|AR|CR|TR|T|C|A|D|R)|x([RDTACP])(TD|CD|AD|AR|CR|TR|T|C|A|D|R)?(?:([1-8])(TD|CD|AD|AR|CR|TR|T|C|A|D|R))?)$/.exec(t)
    if (!m) continue
    const [, p, ala, fila, col, cap, colCap, fila2, col2] = m
    // "TD1D": la D después de la T es el ala; "D2D": la segunda D es columna (hay fila en el medio, no ambigüedad)
    const l: LecturaD = { pieza: ROL[p], captura: !!cap, ala: ala as 'D' | 'R' | undefined }
    if (fila) { l.fila = Number(fila); l.columnas = COLUMNAS[col] }
    if (cap) {
      l.capturada = ROL[cap]
      if (colCap) l.colCapturada = COLUMNAS[colCap]
      if (fila2) { l.fila = Number(fila2); l.columnas = COLUMNAS[col2] }
    }
    res.push(l)
  }
  return res
}

/** Jugadas legales compatibles con alguna lectura del token, de la lectura más literal a la menos. */
export function candidatosDescriptiva(pos: Chess, tok: string): NormalMove[] {
  const vistos = new Set<string>()
  const out: NormalMove[] = []
  const blancas = pos.turn === 'white'
  for (const l of leerDescriptiva(tok)) {
    const deEsta: NormalMove[] = []
    for (const [desde, hacia] of pos.allDests()) {
      const pieza = pos.board.get(desde)!
      for (const to of hacia) {
        const enDestino = pos.board.get(to)
        if (l.enroque) {
          if (pieza.role !== 'king' || !enDestino || enDestino.role !== 'rook' || enDestino.color !== pieza.color) continue
          if (((to % 8) < (desde % 8)) === (l.enroque === 'largo')) deEsta.push({ from: desde, to })
          continue
        }
        if (enDestino && enDestino.color === pieza.color) continue
        if (pieza.role !== l.pieza) continue
        const sq = makeSquare(to)
        const alPaso = pieza.role === 'pawn' && !enDestino && (to % 8) !== (desde % 8)
        const esCaptura = !!enDestino || alPaso
        if (esCaptura !== l.captura) continue
        if (l.capturada && (alPaso ? 'pawn' : enDestino?.role) !== l.capturada) continue
        if (l.colCapturada && !l.colCapturada.includes(sq[0])) continue
        if (l.fila !== undefined) {
          const filaPropia = blancas ? Number(sq[1]) : 9 - Number(sq[1])
          if (filaPropia !== l.fila || !l.columnas!.includes(sq[0])) continue
        }
        const mv: NormalMove = { from: desde, to }
        if (pieza.role === 'pawn' && /[18]$/.test(sq)) mv.promotion = 'queen'
        deEsta.push(mv)
      }
    }
    // el ala de la pieza ("CD", "TR") solo desempata entre varias
    let elegidas = deEsta
    if (l.ala && deEsta.length > 1) {
      const f = deEsta.filter((m) => (l.ala === 'D' ? 'abcd' : 'efgh').includes(makeSquare(m.from)[0]))
      if (f.length) elegidas = f
    }
    for (const mv of elegidas) {
      const k = `${mv.from}-${mv.to}`
      if (!vistos.has(k)) { vistos.add(k); out.push(mv) }
    }
  }
  return out
}

/**
 * Reconstrucción de una secuencia de tokens: tiene que haber UNA sola secuencia legal completa (si hay dos, por
 * ejemplo un "PxP" que puede ser dos capturas y ambas siguen siendo legales hasta el final, no se elige).
 */
export function reconstruirDescriptiva(tokens: string[], fen = FEN_INICIAL): { ucis?: string[]; hasta: number; ambigua?: boolean } {
  let hasta = 0
  let nodos = 0
  const soluciones: string[][] = []
  const rec = (pos: Chess, i: number, acc: string[]) => {
    if (soluciones.length > 1 || ++nodos > 100000) return
    hasta = Math.max(hasta, i)
    if (i === tokens.length) { soluciones.push([...acc]); return }
    for (const mv of candidatosDescriptiva(pos, tokens[i])) {
      const p2 = pos.clone()
      acc.push(uciEstandar(pos, mv))
      p2.play(mv)
      rec(p2, i + 1, acc)
      acc.pop()
    }
  }
  rec(posDesdeFen(fen), 0, [])
  if (soluciones.length === 1) return { ucis: soluciones[0], hasta }
  return { hasta, ambigua: soluciones.length > 1 }
}

