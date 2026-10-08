/**
 * David Bronstein, «El ajedrez de torneo: Zúrich 1953» (CDA 19, 6.ª ed.): las 210 partidas del torneo de
 * candidatos, desde el texto del PDF (datos-privados/biblioteca/textos/zurich.txt, con marcas <<Pn>> de página).
 *
 * El OCR es legible pero tiene tres problemas: (1) los dígitos 5 y 6 se confunden entre sí y con "&" (y la "S"
 * puede ser 5 u 8), la "c" se lee a veces "e"; (2) la línea principal va una jugada por renglón, pero a veces en
 * dos columnas (primero varias jugadas blancas numeradas y después las respuestas negras); (3) el final de la
 * partida suele estar en un párrafo de prosa ("47. Ce3 Cc3 48. ab4 … b3. Blancas rinden.").
 *
 * Cada jugada se acepta solo si es la única legal compatible con la lectura (con el menor número de
 * sustituciones de caracteres dudosos); si no, la partida se descarta. Una partida entra solo si llega al
 * resultado, y después se controla con scripts/verificar-partidas-libros.ts.
 *
 * Uso: node scripts/preparar-partidas-zurich.ts → agrega (o reemplaza, por prefijo) en public/datos/partidas-libros.json
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { Chess } from 'chessops/chess'
import { makeSquare } from 'chessops/util'
import type { NormalMove, Role } from 'chessops/types'
import { FEN_INICIAL, posDesdeFen, uciEstandar } from '../src/lib/ajedrez/posicion.ts'
import type { PartidaLibro } from '../src/lib/partidas-libros/partidas-libros.ts'

const TITULO = 'David Bronstein — El ajedrez de torneo: Zúrich 1953 (CDA 19)'
const PIEZA: Record<string, Role> = { R: 'king', D: 'queen', T: 'rook', A: 'bishop', C: 'knight' }
const FILA: Record<string, string[]> = { '5': ['5', '6'], '6': ['6', '5'], '&': ['5', '6'], S: ['5', '8'], s: ['5', '8'], l: ['1'], I: ['1'], B: ['8'] }
const COLUMNA: Record<string, string[]> = { c: ['c', 'e'], e: ['e', 'c'] }

/** Lectura de un token de jugada: lo que se puede rescatar. */
interface Lectura { pieza?: Role; desconocida: boolean; captura: boolean; desdeCol?: string; desambig?: string; destinos: { sq: string; costo: number }[]; enroque?: 'corto' | 'largo' }

function leer(token: string): Lectura | undefined {
  const t = token.replace(/[+!?#]+$/g, '').replace(/[!?]/g, '')
  if (/^[0O]-[0O](-[0O])?$/.test(t)) return { desconocida: false, captura: false, destinos: [], enroque: t.length > 3 ? 'largo' : 'corto' }
  const m = /^([RDTAC]|[^a-zA-Z0-9])?(x?)([a-h1-8]?)(x?)([a-hA-H])([1-8&SslIB])$/.exec(t)
  if (!m) return undefined
  const [, p, x1, medio, x2, col, fila] = m
  const destinos: { sq: string; costo: number }[] = []
  const cols = COLUMNA[col.toLowerCase()] ?? [col.toLowerCase()]
  const filas = FILA[fila] ?? [fila]
  cols.forEach((c, i) => filas.forEach((f, j) => destinos.push({ sq: c + f, costo: i + j })))
  const pieza = p && PIEZA[p]
  if (!p) {
    // peón: "e4", o captura a la antigua "ed5" (columna de origen y casilla)
    if (medio && !/[a-h]/.test(medio)) return undefined
    return { desconocida: false, captura: !!medio || !!x1 || !!x2, desdeCol: medio || undefined, destinos }
  }
  return { pieza, desconocida: !pieza, captura: !!(x1 || x2), desambig: medio || undefined, destinos }
}

// ---- texto ----
const texto = readFileSync('datos-privados/biblioteca/textos/zurich.txt', 'utf8')
const renglones = texto
  .split('\n')
  .map((l) => l.trim().replace(/\s+\+/g, '+').replace(/\s+!/g, '!'))
  .filter((l) => l && !/^<<P\d+>>$/.test(l) && !/^\d{1,3}$/.test(l)) // marcas y números de página

const NUM = String.raw`[0-9lIOoS&'ʥͰ-Ͽ]{1,3}\s?[0-9]?`
const reNegras = new RegExp(`^${NUM}\\s*\\.\\s*(\\.\\s*){1,4}$`)
const reNumero = new RegExp(`^${NUM}\\s*\\.$`)
const reNumJugada = new RegExp(`^${NUM}\\s*\\.\\s*(\\S+)$`)
const esJugada = (t: string) => leer(t) !== undefined || /^[^a-zA-Z0-9\s]$/.test(t) // un glifo suelto: jugada ilegible
const RES_SOLO = /^(tablas|abandonan|1-0|0-1)\.?$/i

type Item = { tipo: 'blanca' | 'negra' | 'marca-negra' | 'marca'; mv?: string }
function clasificar(l: string): Item | 'resultado' | undefined {
  if (RES_SOLO.test(l)) return 'resultado'
  if (reNegras.test(l)) return { tipo: 'marca-negra' }
  if (reNumero.test(l)) return { tipo: 'marca' }
  const m = reNumJugada.exec(l)
  if (m && esJugada(m[1])) return { tipo: 'blanca', mv: m[1] }
  if (!/\s/.test(l) && esJugada(l)) return { tipo: 'negra', mv: l }
  return undefined
}

// resultado escrito en prosa: "Blancas rinden", "Las negras abandonan", "Tablas"
function resultadoProsa(s: string, turno: 'white' | 'black'): PartidaLibro['resultado'] | undefined {
  if (/blancas\s+(rinden|abandonan)/i.test(s)) return '0-1'
  if (/negras\s+(rinden|abandonan)/i.test(s)) return '1-0'
  if (/^\s*(abandonan|rinden)/i.test(s)) return turno === 'white' ? '0-1' : '1-0'
  if (/^\s*tablas/i.test(s)) return '1/2-1/2'
  return undefined
}

/** Candidatos legales de un token, del más fiel a la lectura al menos fiel. */
function candidatos(pos: Chess, tok: string): NormalMove[] {
  const l = leer(tok)
  if (!l) return []
  const out: { mv: NormalMove; costo: number }[] = []
  for (const [desde, hacia] of pos.allDests()) {
    const pieza = pos.board.get(desde)!
    for (const to of hacia) {
      const enDestino = pos.board.get(to)
      if (l.enroque) {
        if (pieza.role !== 'king' || !enDestino || enDestino.role !== 'rook' || enDestino.color !== pieza.color) continue
        if (((to % 8) < (desde % 8)) === (l.enroque === 'largo')) out.push({ mv: { from: desde, to }, costo: 0 })
        continue
      }
      if (enDestino && enDestino.color === pieza.color) continue
      const d = l.destinos.find((x) => x.sq === makeSquare(to))
      if (!d) continue
      const esCaptura = !!enDestino || (pieza.role === 'pawn' && (to % 8) !== (desde % 8))
      if (esCaptura !== l.captura) continue
      if (l.desconocida ? pieza.role === 'pawn' : l.pieza ? pieza.role !== l.pieza : pieza.role !== 'pawn') continue
      if (l.desdeCol && makeSquare(desde)[0] !== l.desdeCol) continue
      if (l.desambig && !makeSquare(desde).includes(l.desambig)) continue
      const mv: NormalMove = { from: desde, to }
      if (pieza.role === 'pawn' && /[18]$/.test(makeSquare(to))) mv.promotion = 'queen'
      out.push({ mv, costo: d.costo })
    }
  }
  return out.sort((x, y) => x.costo - y.costo).map((x) => x.mv)
}

/**
 * Reconstrucción con búsqueda hacia adelante: un "&" puede ser 5 o 6 y solo las jugadas siguientes dicen cuál.
 * Se exige que la secuencia completa tenga UNA sola reconstrucción legal (si hay dos, no se elige).
 */
function reconstruirTodo(tokens: string[]): { ucis?: string[]; hasta: number; ambigua?: boolean } {
  let hasta = 0
  let nodos = 0
  const soluciones: string[][] = []
  const rec = (pos: Chess, i: number, acc: string[]) => {
    if (soluciones.length > 1 || ++nodos > 50000) return
    hasta = Math.max(hasta, i)
    if (i === tokens.length) { soluciones.push([...acc]); return }
    for (const mv of candidatos(pos, tokens[i])) {
      const p2 = pos.clone()
      acc.push(uciEstandar(pos, mv))
      p2.play(mv)
      rec(p2, i + 1, acc)
      acc.pop()
    }
  }
  rec(posDesdeFen(FEN_INICIAL), 0, [])
  if (soluciones.length === 1) return { ucis: soluciones[0], hasta }
  return { hasta, ambigua: soluciones.length > 1 }
}

const APERTURA = /^(Defensa|Apertura|Gambito|Sistema|Contragambito|Ataque|Variante|Partida)\b/i
const NOMBRE = /^[A-ZÁÉÍÓÚl0O]\s?\.\s?[A-ZÁÉÍÓÚ][\wáéíóúñü]+$/

const inicios = renglones.flatMap((l, i) => (/^Partida\s*n\s*[°o]\s*\d+/i.test(l) ? [i] : []))
const salida: PartidaLibro[] = []
const fallas: string[] = []
for (let k = 0; k < inicios.length; k++) {
  const i0 = inicios[k]
  const fin = inicios[k + 1] ?? renglones.length
  const n = Number(/n\s*[°o]\s*(\d+)/i.exec(renglones[i0])![1])
  // encabezado: la apertura (puede haber un párrafo de introducción antes) y los dos jugadores, que a veces
  // aparecen separados por las primeras jugadas
  const ia = renglones.slice(i0 + 1, fin).findIndex((l) => APERTURA.test(l) && !/\s(de|la|el)\s.*\s(de|la|el)\s/.test(l) && l.split(/\s+/).length <= 7)
  const i1 = renglones.slice(i0, fin).findIndex((l) => /^1\s*\.\s*\S+$/.test(l))
  if (ia < 0 || i1 < 0) { fallas.push(`partida ${n}: sin encabezado reconocible`); continue }
  const apertura = renglones[i0 + 1 + ia]
  const nombres: number[] = []
  for (let r = i0 + 1 + ia + 1; r < Math.min(fin, i0 + i1 + 20) && nombres.length < 2; r++) if (NOMBRE.test(renglones[r])) nombres.push(r)
  if (nombres.length < 2) { fallas.push(`partida ${n}: sin los dos jugadores`); continue }
  const [blancas, negras] = nombres.map((r) => renglones[r])

  // 1) secuencia de tokens de la línea principal y resultado (sin legalidad todavía: el turno sale de la cuenta)
  const toks: string[] = []
  const turno = () => (toks.length % 2 === 0 ? 'white' : 'black')
  let resultado: PartidaLibro['resultado']
  let bl: string[] = [], ng: string[] = []
  const volcar = () => {
    while (bl.length || ng.length) {
      if (turno() === 'white') toks.push((bl.length ? bl : ng).shift()!)
      else if (ng.length) toks.push(ng.shift()!)
      else break
    }
  }
  for (let i = i0 + i1; i < fin && !resultado; i++) {
    if (nombres.includes(i)) continue
    const c = clasificar(renglones[i])
    if (c === 'resultado') { volcar(); resultado = resultadoProsa(renglones[i], turno()); break }
    if (c) {
      if (c.tipo === 'blanca') bl.push(c.mv!)
      else if (c.tipo === 'negra') ng.push(c.mv!)
      continue
    }
    // prosa: cierra el tramo de jugadas sueltas
    volcar()
    bl = []; ng = []
    // la línea principal sigue en prosa solo si el renglón empieza con el número que sigue y el anterior cerraba
    // una oración (si no, es una variante del comentario)
    const nro = Math.floor(toks.length / 2) + 1
    const empieza = turno() === 'white' ? new RegExp(`^${nro}\\s*\\.\\s*(?!\\s*\\.)`) : new RegExp(`^${nro}\\s*\\.\\s*\\.\\s*\\.`)
    const previo = renglones[i - 1] ?? ''
    if (toks.length && empieza.test(renglones[i]) && (/[.:]\s*$/.test(previo) || clasificar(previo))) {
      let resto = ''
      let r = i
      for (; r < fin; r++) {
        resto += ' ' + renglones[r]
        if (/[a-zñ]{4,}/i.test(renglones[r].replace(/[RDTAC]x?[a-h][1-8&S]/g, ''))) break
      }
      const ts = resto.replace(/(\S)\s*\.\s*\.\s*\.(\s*\.)?/g, '$1. ').split(/\s+/).filter(Boolean)
      for (let t = 0; t < ts.length; t++) {
        const tk = ts[t]
        if (/^\S{1,3}\.$/.test(tk) && !leer(tk.slice(0, -1))) continue // número de jugada
        const limpio = tk.replace(/[.,;:]+$/, '')
        if (!leer(limpio)) { resultado = resultadoProsa(ts.slice(t).join(' '), turno()); break }
        toks.push(limpio)
        if (/[.;:]$/.test(tk)) { resultado = resultadoProsa(ts.slice(t + 1).join(' '), turno()); break }
      }
      i = r
    }
  }
  volcar()
  if (!resultado) { fallas.push(`partida ${n} (${blancas} - ${negras}): sin resultado (${toks.length} medias jugadas leídas)`); continue }
  // 2) reconstrucción legal
  const r = reconstruirTodo(toks)
  if (!r.ucis) {
    fallas.push(`partida ${n} (${blancas} - ${negras}): ${r.ambigua ? 'dos lecturas legales' : `se corta en la jugada ${Math.floor(r.hasta / 2) + 1}${r.hasta % 2 ? '…' : '.'} «${toks[r.hasta]}»`}`)
    continue
  }
  if (r.ucis.length < 20) { fallas.push(`partida ${n}: muy corta`); continue }
  const nombre = (s: string) => s.replace(/\s+/g, ' ').replace(/^([A-ZÁÉÍÓÚl])\s?\.\s?/, (_, x) => (x === 'l' ? 'I' : x) + '. ')
  salida.push({
    id: `zurich-${n}`,
    blancas: nombre(blancas),
    negras: nombre(negras),
    lugar: 'Zúrich (torneo de candidatos)',
    anio: 1953,
    resultado,
    jugadas: r.ucis,
    fuente: { titulo: TITULO, capitulo: `partida n.º ${n} (${apertura.replace(/lnd[ií]a/g, 'India')})` },
  })
}
const RUTA = 'public/datos/partidas-libros.json'
const previas = existsSync(RUTA) ? (JSON.parse(readFileSync(RUTA, 'utf8')) as PartidaLibro[]).filter((x) => !x.id.startsWith('zurich-')) : []
if (!process.env.SECO) writeFileSync(RUTA, JSON.stringify([...previas, ...salida]))
console.log(inicios.length, 'encabezados;', salida.length, 'partidas;', fallas.length, 'descartadas')
if (process.env.DETALLE) for (const f of fallas) console.log('  falla:', f)
for (const s of salida) console.log(' ', s.id, s.blancas, '-', s.negras, s.resultado, s.jugadas.length)
