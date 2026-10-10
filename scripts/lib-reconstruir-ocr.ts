/**
 * Reconstrucción de partidas a partir de un OCR de la línea principal, cuando cada media jugada viene con su número y
 * su color (por la columna en que está impresa). Cada lectura se compara con las jugadas legales mediante una distancia
 * de edición que abarata las confusiones típicas del OCR, y una búsqueda en haz elige la secuencia más barata; puede
 * suponer una media jugada que no se leyó, y supuestaAmbigua dice si esa suposición es única.
 * La usan preparar-partidas-chernev-capa.ts (algebraica larga) y preparar-partidas-zurich.ts (algebraica corta española).
 */
import type { Chess } from 'chessops/chess'
import { makeSan } from 'chessops/san'
import { makeSquare } from 'chessops/util'
import { aEspanol, FEN_INICIAL, posDesdeFen, uciEstandar } from '../src/lib/ajedrez/posicion.ts'

// ---------- distancia de edición con confusiones de OCR ----------
const PARES = ['9g', '5s', '5S', 'sS', '1l', '1I', '1i', 'lI', 'li', '1t', 'lt', 'ft', '0O', '0Q', 'OQ', '0o', 'Oo', '8B', '6b', '6G', 'ec', 'ac', 'ae', 'oa', '-+', '-%', '-&', '-~', '-.', 'x%', 'x*', 'x+', '2Z', '2z', 'Nh', 'NM', 'Mf', 'Rl', 'gq', 'g4', 'fH', 'f4', 'd4', 'QO', 'Q0', 'B6', '3B', 'hn', '-=', '7?']
const BARATO = new Set(PARES.flatMap(([a, b]) => [a + b, b + a]))
// Confusiones del OCR de Zúrich 1953 («15» por «f5», «85» por «a5»): solo con la algebraica corta, porque en la larga
// generan empates entre jugadas legales.
const BARATO_CORTA = new Set(['1f', '8a'].flatMap(([a, b]) => [a + b, b + a]))
function costoSub(a: string, b: string, corta = false): number {
  if (a === b) return 0
  if (a.toLowerCase() === b.toLowerCase()) return 0.25
  return BARATO.has(a + b) || (corta && BARATO_CORTA.has(a + b)) ? 0.35 : 1
}
/** xOpcional (algebraica corta): la «x» de captura puede faltar casi sin costo («ed5» por «exd5») y valen las confusiones de BARATO_CORTA. */
export function distancia(s: string, t: string, xOpcional = false): number {
  const n = s.length, m = t.length
  let prev = new Array<number>(m + 1)
  for (let j = 0; j <= m; j++) prev[j] = j
  for (let i = 1; i <= n; i++) {
    const cur = new Array<number>(m + 1)
    cur[0] = i
    for (let j = 1; j <= m; j++) {
      const del = s[i - 1] === '-' || s[i - 1] === '.' ? 0.5 : s[i - 1] === '+' || s[i - 1] === '#' ? 0.3 : 1 // sobra en el texto
      const ins = t[j - 1] === '-' ? 0.5 : xOpcional && t[j - 1] === 'x' ? 0.3 : 1 // falta en el texto
      cur[j] = Math.min(prev[j] + del, cur[j - 1] + ins, prev[j - 1] + costoSub(s[i - 1], t[j - 1], xOpcional))
    }
    prev = cur
  }
  return prev[m]
}

// ---------- jugadas legales en algebraica larga ----------
export interface Cand { uci: string; texto: string; move: any }
export type Candidatas = (pos: Chess) => Cand[]
const LETRA: Record<string, string> = { pawn: '', knight: 'N', bishop: 'B', rook: 'R', queen: 'Q', king: 'K' }
const CORONAS = [['queen', 'Q', 'D'], ['rook', 'R', 'T'], ['bishop', 'B', 'A'], ['knight', 'N', 'C']] as const
/** Jugadas legales en algebraica larga («Ng1-f3», «e5xd6», «0-0», «g7-g8(Q)»). */
export function candidatasLargas(pos: Chess): Cand[] {
  return generar(pos, 'larga')
}
/** Jugadas legales en algebraica corta española («Cf3», «exd6», «0-0», «g8D»). */
export function candidatasCortas(pos: Chess): Cand[] {
  return generar(pos, 'corta')
}
/**
 * Jugadas legales en notación descriptiva española, con sus formas habituales: «C3AR» y «C3A», «P4R», «CxP» y
 * «CxPR», «0-0». Varias formas de la misma jugada son varias candidatas con el mismo uci.
 */
export function candidatasDescriptivas(pos: Chess): Cand[] {
  return generar(pos, 'descriptiva')
}
const COLUMNA_LARGA = ['TD', 'CD', 'AD', 'D', 'R', 'AR', 'CR', 'TR']
const COLUMNA_CORTA = ['T', 'C', 'A', 'D', 'R', 'A', 'C', 'T']
const LETRA_ES: Record<string, string> = { pawn: 'P', knight: 'C', bishop: 'A', rook: 'T', queen: 'D', king: 'R' }
function descriptivas(pos: Chess, desde: number, hacia: number, corona?: string): string[] {
  const pieza = pos.board.get(desde)!
  const l = LETRA_ES[pieza.role]
  const capturada = pos.board.get(hacia) ?? (pieza.role === 'pawn' && desde % 8 !== hacia % 8 ? { role: 'pawn' } : undefined)
  const fila = pieza.color === 'white' ? (hacia >> 3) + 1 : 8 - (hacia >> 3)
  const col = hacia % 8
  const c = corona ? [`=${corona}`, `(${corona})`, corona] : ['']
  if (capturada) {
    const x = `${l}x${LETRA_ES[capturada.role]}`
    return [x, x + COLUMNA_LARGA[col], x + COLUMNA_CORTA[col]].flatMap((t) => c.map((s) => t + s))
  }
  return [`${l}${fila}${COLUMNA_LARGA[col]}`, `${l}${fila}${COLUMNA_CORTA[col]}`].flatMap((t) => c.map((s) => t + s))
}
function generar(pos: Chess, notacion: 'larga' | 'corta' | 'descriptiva'): Cand[] {
  const out: Cand[] = []
  for (const [desde, dests] of pos.allDests()) {
    const pieza = pos.board.get(desde)!
    for (const hacia of dests) {
      const move = { from: desde, to: hacia } as any
      const uci = uciEstandar(pos, move)
      if (pieza.role === 'king' && (uci === 'e1g1' || uci === 'e8g8') && Math.abs(desde - hacia) !== 1) { out.push({ uci, texto: '0-0', move: { from: desde, to: hacia } }); continue }
      if (pieza.role === 'king' && (uci === 'e1c1' || uci === 'e8c8') && Math.abs(desde - hacia) !== 1) { out.push({ uci, texto: '0-0-0', move: { from: desde, to: hacia } }); continue }
      if (pieza.role === 'king' && pos.board.get(hacia)?.color === pieza.color) continue // enroque en notación rey-torre, ya cubierto
      const captura = pos.board.get(hacia) !== undefined || (pieza.role === 'pawn' && desde % 8 !== hacia % 8)
      const corona = pieza.role === 'pawn' && (hacia >> 3 === 7 || hacia >> 3 === 0)
      for (const [r, l] of corona ? CORONAS : ([[undefined, '', '']] as const)) {
        const m = r ? { from: desde, to: hacia, promotion: r } : move
        const u = uci + (l ? l.toLowerCase() : '')
        if (notacion === 'descriptiva') {
          for (const texto of new Set(descriptivas(pos, desde, hacia, l ? LETRA_ES[r!] : undefined))) out.push({ uci: u, texto, move: m })
          continue
        }
        const texto = notacion === 'larga'
          ? `${LETRA[pieza.role]}${makeSquare(desde)}${captura ? 'x' : '-'}${makeSquare(hacia)}${l ? `(${l})` : ''}`
          : aEspanol(makeSan(pos, m)).replace(/[+#]$/, '').replace('=', '')
        out.push({ uci: u, texto, move: m })
      }
    }
  }
  return out
}

// ---------- medias jugadas de la línea principal ----------
/**
 * Una media jugada leída: número, color (por la columna en que está) y texto. «alternativas»: otras lecturas de la misma
 * jugada (p. ej. un segundo OCR a más resolución); vale la que más se parezca a cada jugada legal.
 */
export interface Leida { nro: number; negras: boolean; texto: string; alternativas?: string[]; fila?: number }
/**
 * RapidOCR a veces lee una jugada dada vuelta 180° («SP-Lp» es «d7-d5», «9P-SP» es «d5-d6»): se invierte el orden
 * y cada carácter pasa a la figura que se ve girada.
 */
const GIRO: Record<string, string> = { S: '5', s: '5', 5: 'S', P: 'd', p: 'd', d: 'p', L: '7', 7: 'L', 9: '6', 6: '9', q: 'b', b: 'q', i: '!', E: '3', 3: 'E', t: 'f', f: 't', h: 'y', y: 'h', n: 'u', u: 'n', M: 'W', W: 'M', 4: 'h', Z: '2', 2: 'Z', a: 'e', e: 'a' }
export const girada = (t: string) => [...t].reverse().map((c) => GIRO[c] ?? c).join('')
export const limpiar = (t: string) => t.replace(/[!?]+/g, '').replace(/\s+/g, '').replace(/[+#]+$/, '')

// ---------- búsqueda en haz ----------
/** k: próxima media jugada leída. */
export interface Estado { pos: Chess; ucis: string[]; k: number; costo: number; supuestas: number; detalle: string[] }
const SALTO = 1.2
const SUPUESTA = 4.5
const ETIQUETA = 3
const ANCHO = Number(process.env.ANCHO ?? 600)
const FORZAR = (process.env.FORZAR ?? '').split(' ').filter(Boolean)
export const orden = (nro: number, negras: boolean) => (nro - 1) * 2 + (negras ? 1 : 0)
export function reconstruir(leidas: Leida[], candidatas: Candidatas, xOpcional = false): Estado[] {
  let haz: Estado[] = [{ pos: posDesdeFen(FEN_INICIAL), ucis: [], k: 0, costo: 0, supuestas: 0, detalle: [] }]
  const finales: Estado[] = []
  for (let ply = 0; ply < 400 && haz.length; ply++) {
    const nuevos = new Map<string, Estado>()
    const agregar = (e: Estado) => {
      if (FORZAR.length && e.ucis.some((u, i) => i < FORZAR.length && u !== FORZAR[i])) return
      const clave = `${e.k}|${e.ucis.join(' ')}`
      const v = nuevos.get(clave)
      if (!v || v.costo > e.costo) nuevos.set(clave, e)
    }
    for (const e of haz) {
      if (e.k >= leidas.length) { finales.push(e); continue }
      const cands = candidatas(e.pos)
      if (!cands.length) { finales.push({ ...e, costo: e.costo + SALTO * (leidas.length - e.k) }); continue }
      // Lecturas que quedaron atrás (repetidas, o variantes con formato de línea principal): se saltean.
      let k = e.k
      let salto = 0
      while (k < leidas.length && orden(leidas[k].nro, leidas[k].negras) < ply) { k++; salto += SALTO / 2 }
      if (k >= leidas.length) { finales.push({ ...e, k, costo: e.costo + salto }); continue }
      for (let j = k; j < Math.min(leidas.length, k + 3); j++) {
        const l = leidas[j]
        const etiqueta = orden(l.nro, l.negras) === ply ? 0 : ETIQUETA
        const textos = [l.texto, ...(l.alternativas ?? [])]
        const giros = textos.map(girada)
        const ls = cands.map((c) => ({ c, d: Math.min(...textos.map((t, x) => Math.min(distancia(t, c.texto, xOpcional), distancia(giros[x], c.texto, xOpcional) + 0.3))) }))
        const minimo = Math.min(...ls.map((x) => x.d))
        // Ilegible (p. ej. leída al revés, «SP-Lp»): ninguna jugada se le parece; vale como supuesta en su lugar.
        if (j === k && !etiqueta && e.supuestas < 4 && ls.every(({ c, d }) => d > Math.max(1.5, c.texto.length * 0.45))) {
          for (const c of cands) {
            const pos = e.pos.clone()
            pos.play(c.move)
            agregar({ pos, ucis: [...e.ucis, c.uci], k: j + 1, costo: e.costo + salto + SUPUESTA, supuestas: e.supuestas + 1, detalle: [...e.detalle, `${c.texto}←(ilegible «${l.texto}») ${SUPUESTA}`] })
          }
        }
        for (const { c, d } of ls) {
          if (d > Math.max(1.5, c.texto.length * 0.45) || d > minimo + 1) continue
          const pos = e.pos.clone()
          pos.play(c.move)
          const extra = salto + etiqueta + d
          agregar({ pos, ucis: [...e.ucis, c.uci], k: j + 1, costo: e.costo + extra, supuestas: e.supuestas, detalle: [...e.detalle, `${c.texto}←«${l.texto}» ${extra.toFixed(2)}`] })
        }
        salto += SALTO
      }
      // Suponer una media jugada que no se leyó, solo si la próxima lectura viene numerada más adelante.
      if (e.supuestas < 4 && orden(leidas[k].nro, leidas[k].negras) > ply) {
        for (const c of cands) {
          const pos = e.pos.clone()
          pos.play(c.move)
          agregar({ pos, ucis: [...e.ucis, c.uci], k, costo: e.costo + SUPUESTA, supuestas: e.supuestas + 1, detalle: [...e.detalle, `${c.texto}←(supuesta) ${SUPUESTA}`] })
        }
      }
    }
    const ordenados = [...nuevos.values()].sort((a, b) => a.costo - b.costo)
    haz = ordenados.filter((h) => h.costo <= ordenados[0].costo + 15).slice(0, ANCHO)
  }
  return finales.sort((a, b) => a.costo - b.costo)
}

/**
 * Una media jugada supuesta (o ilegible) es ambigua si otra jugada legal en su lugar deja todas las siguientes
 * legales y con el mismo texto en algebraica larga: el libro no permite saber cuál fue. Devuelve su número, o 0.
 */
export function supuestaAmbigua(e: Estado, candidatas: Candidatas): number {
  for (let s = 0; s < e.ucis.length; s++) {
    if (!/\((supuesta|ilegible)/.test(e.detalle[s])) continue
    let pos = posDesdeFen(FEN_INICIAL)
    const textos: string[] = []
    for (let i = 0; i < e.ucis.length; i++) {
      const cs = candidatas(pos)
      const c = cs.find((x) => x.uci === e.ucis[i])!
      textos.push(c.texto)
      if (i === s) {
        for (const alt of cs) {
          if (alt.uci === c.uci) continue
          const q = pos.clone()
          q.play(alt.move)
          let ok = true
          for (let j = i + 1; j < e.ucis.length && ok; j++) {
            const d = candidatas(q).find((x) => x.uci === e.ucis[j])
            // la jugada siguiente tiene que existir con el mismo texto (o ser también supuesta)
            if (!d || (!/\((supuesta|ilegible)/.test(e.detalle[j]) && d.texto !== textosDe(e, j, candidatas))) ok = false
            else q.play(d.move)
          }
          if (ok) return s + 1
        }
      }
      pos.play(c.move)
    }
  }
  return 0
}
const cacheTextos = new WeakMap<Estado, string[]>()
function textosDe(e: Estado, j: number, candidatas: Candidatas): string {
  let t = cacheTextos.get(e)
  if (!t) {
    t = []
    const pos = posDesdeFen(FEN_INICIAL)
    for (const u of e.ucis) { const c = candidatas(pos).find((x) => x.uci === u)!; t.push(c.texto); pos.play(c.move) }
    cacheTextos.set(e, t)
  }
  return t[j]
}


// Números de jugada mal leídos («69» por «59», «71» por «11»): una lectura que se sale de la secuencia de sus
// vecinas toma el número que le corresponde entre ellas.
/** La primera media jugada del color pedido después de la media jugada a. */
const siguiente = (a: number, negras: boolean) => (((a + 1) % 2 === 1) === negras ? a + 1 : a + 2)
export function corregirNumeros(listas: Leida[][]): void {
  for (const L of listas) {
  for (let i = 1; i < L.length; i++) {
    const a = orden(L[i - 1].nro, L[i - 1].negras), b = orden(L[i].nro, L[i].negras)
    const c = i + 1 < L.length ? orden(L[i + 1].nro, L[i + 1].negras) : undefined
    if (Math.abs(b - a) <= 3) continue
    if (c !== undefined && !(c - a >= 1 && c - a <= 3)) continue
    const e = siguiente(a, L[i].negras)
    if (c === undefined || e < c) L[i].nro = Math.floor(e / 2) + 1
  }
}
}
