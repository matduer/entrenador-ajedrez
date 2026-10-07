/**
 * Convierte los diagramas de Polgár, «Chess: 5334 Problems, Combinations and Games» (extraídos a
 * datos-privados/biblioteca/polgar.json con polgar.py) en problemas para la app, y verifica cada uno:
 * solo entran los que confirma la tablebase de Lichess (hasta 7 piezas) o Stockfish. Las jugadas son las
 * del libro (línea principal); no se copia ningún texto del libro.
 *
 * Uso: node scripts/preparar-problemas-polgar.ts [profundidad] [rangos, p. ej. "1-20,4463-4470"]
 * Salida: public/datos/problemas-libros.json (problemas), datos-privados/biblioteca/polgar-partidas.json
 * (las 600 miniaturas completas) y un informe en datos-privados/biblioteca/polgar-informe.txt.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { parseSan } from 'chessops/san'
import { makeFen } from 'chessops/fen'
import type { Position } from 'chessops/chess'
import { FEN_INICIAL, jugarUci, posDesdeFen, uciEstandar } from '../src/lib/ajedrez/posicion.ts'
import { chancesDeGanar, invertir, type Evaluacion } from '../src/lib/ajedrez/evaluacion.ts'
import { MotorNativo } from './lib-motor.ts'

const PROF = Number(process.argv[2] ?? 14)
const RANGOS = process.argv[3]
const TITULO = 'László Polgár — Chess: 5334 Problems, Combinations and Games (Könemann, 1994)'

interface Crudo { n: number; tablero: string; solucion: string }
const crudos = (JSON.parse(readFileSync('datos-privados/biblioteca/polgar.json', 'utf8')) as Crudo[]).filter(
  (c) => !RANGOS || RANGOS.split(',').some((r) => { const [a, b] = r.split('-').map(Number); return c.n >= a && c.n <= (b ?? a) }),
)

type Tipo = 'mate' | 'combinacion' | 'miniatura' | 'tablas' | 'gana'
function seccion(n: number): { cap: string; tipo: Tipo; mate?: number; temas: string[] } {
  if (n <= 306) return { cap: 'cap. 1.1, «Mate in 1»', tipo: 'mate', mate: 1, temas: ['mateIn1'] }
  if (n <= 450) return { cap: 'cap. 2.1, «White to Move #2»', tipo: 'mate', mate: 2, temas: ['mateIn2'] }
  if (n <= 3718) return { cap: 'cap. 2.2-2.3, «Combinations #2»', tipo: 'mate', mate: 2, temas: ['mateIn2'] }
  if (n <= 4462) return { cap: 'cap. 3.1, «Combinations #3»', tipo: 'mate', mate: 3, temas: ['mateIn3'] }
  if (n <= 5062) return { cap: 'cap. 4, «600 Miniature games»', tipo: 'miniatura', temas: ['miniatura'] }
  if (n <= 5104) return { cap: 'cap. 5.1, «White draws»', tipo: 'tablas', temas: ['endgame', 'defensiveMove'] }
  if (n <= 5206) return { cap: 'cap. 5.2, «White wins»', tipo: 'gana', temas: ['endgame'] }
  return { cap: 'cap. 6, combinaciones de las hermanas Polgár', tipo: 'combinacion', temas: ['partidaPolgar'] }
}

/** Quita variantes entre paréntesis (anidadas) y deja la línea principal. */
function lineaPrincipal(s: string): string {
  let out = '', nivel = 0
  for (const c of s) {
    if (c === '(') nivel++
    else if (c === ')') nivel = Math.max(0, nivel - 1)
    else if (nivel === 0) out += c
  }
  return out
}

/** Jugadas en SAN estándar de la línea principal, y el color que mueve primero. */
function sansDe(s: string): { color: 'w' | 'b'; sans: string[] } | undefined {
  s = lineaPrincipal(s.replace(/\(\s*Di-?\s*agram\s*\)/g, ' ')).replace(/ /g, ' ').replace(/(\d+)\.\s+(?=[KQRBNa-hO])/g, '$1.')
  const primero = /(\d+)\.(\.\.)?/.exec(s)
  if (!primero) return undefined
  const sans: string[] = []
  for (let tok of s.split(/\s+/)) {
    tok = tok.replace(/^\d+\.(\.\.)?/, '')
    if (!tok) continue
    if (/^(1–0|0–1|1-0|0-1|½|\+–|–\+|=|∞|\+=|=\+)/.test(tok)) break
    if (!/^[KQRBNa-hO]/.test(tok)) break
    sans.push(tok.replace(/X/g, 'x').replace(/m$/, '#').replace(/[!?]+/g, '').replace(/0-0-0/, 'O-O-O').replace(/0-0/, 'O-O'))
  }
  return sans.length ? { color: primero[2] ? 'b' : 'w', sans } : undefined
}

function enroques(tablero: string): string {
  const filas = tablero.split('/').map((f) => f.replace(/\d/g, (d) => '.'.repeat(Number(d))))
  const [f8, f1] = [filas[0], filas[7]]
  let r = ''
  if (f1[4] === 'K' && f1[7] === 'R') r += 'K'
  if (f1[4] === 'K' && f1[0] === 'R') r += 'Q'
  if (f8[4] === 'k' && f8[7] === 'r') r += 'k'
  if (f8[4] === 'k' && f8[0] === 'r') r += 'q'
  return r || '-'
}

/** Juega SAN desde una posición; devuelve los UCI hasta la primera ilegible. */
function jugar(pos: Position, sans: string[]): { ucis: string[]; fens: string[] } {
  const ucis: string[] = [], fens: string[] = [makeFen(pos.toSetup())]
  const p = pos.clone()
  for (const san of sans) {
    const m = parseSan(p, san)
    if (!m) break
    ucis.push(uciEstandar(p, m))
    p.play(m)
    fens.push(makeFen(p.toSetup()))
  }
  return { ucis, fens }
}

/** Quita restos de la composición del libro: guiones de corte de línea y acentos separados. */
const limpiar = (t?: string) =>
  t?.replace(/^m\s+/, '').replace(/(\p{L})- (\p{L})/gu, '$1$2').replace(/´a/g, 'á').replace(/´e/g, 'é').replace(/`e/g, 'è').replace(/\s+/g, ' ').trim()

const valor = (e: Evaluacion) => (e.mate !== undefined ? (e.mate > 0 ? 100000 - e.mate : -100000 - e.mate) : (e.cp ?? 0))
const piezas = (fen: string) => fen.split(' ')[0].replace(/[^a-z]/gi, '').length
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function tablebase(fen: string): Promise<string | undefined> {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`)
    if (r.status === 429) { await espera(60_000); continue }
    if (!r.ok) return undefined
    await espera(1100)
    return ((await r.json()) as { category: string }).category
  }
}

const motor = new MotorNativo(PROF, 4)
const salida: unknown[] = []
const partidas: unknown[] = []
const informe: string[] = []
const cuenta: Record<string, number> = {}
const anotar = (k: string, msg?: string) => { cuenta[k] = (cuenta[k] ?? 0) + 1; if (msg) informe.push(msg) }

for (const c of crudos) {
  const sec = seccion(c.n)
  let fen: string, ucis: string[]
  if (sec.tipo === 'miniatura') {
    // Partida completa desde el principio: el problema empieza en la posición del diagrama.
    const lib = sansDe(c.solucion)
    if (!lib) { anotar('sin solución legible', `${c.n}: ${c.solucion.slice(0, 80)}`); continue }
    const r = jugar(posDesdeFen(FEN_INICIAL), lib.sans)
    const i = r.fens.findIndex((f) => f.split(' ')[0] === c.tablero)
    const jugadores = /([A-ZÀ-Ýa-zà-ÿ.'`´ -]+?\s[–-]\s[A-ZÀ-Ýa-zà-ÿ.'`´ -]+?)\s*\(([^)]*)\)\s*$/.exec(c.solucion.replace(/ /g, ' '))
    partidas.push({ id: `polgar-${c.n}`, jugadas: r.ucis, jugadores: limpiar(jugadores?.[1]), lugar: limpiar(jugadores?.[2]), completa: r.ucis.length === lib.sans.length })
    if (i >= 0 && i < r.ucis.length) {
      fen = r.fens[i]
      ucis = r.ucis.slice(i)
    } else {
      // A veces el libro omite jugadas antes del diagrama: se parte del diagrama y de lo que sigue.
      const m = /\(\s*Di-?\s*agram\s*\)/.exec(c.solucion)
      const resto = m ? sansDe(c.solucion.slice(m.index + m[0].length)) : undefined
      if (!resto) { anotar('miniatura: diagrama no encontrado', `${c.n}: el diagrama no aparece en la partida (${r.ucis.length} de ${lib.sans.length} jugadas leídas)`); continue }
      fen = `${c.tablero} ${resto.color} ${enroques(c.tablero)} - 0 1`
      try { posDesdeFen(fen) } catch { anotar('posición ilegal', `${c.n}: ${fen}`); continue }
      ucis = jugar(posDesdeFen(fen), resto.sans).ucis
      if (!ucis.length) { anotar('miniatura: diagrama no encontrado', `${c.n}: jugada ilegible tras el diagrama`); continue }
    }
  } else {
    const lib = sansDe(c.solucion)
    if (!lib) { anotar('sin solución legible', `${c.n}: ${c.solucion.slice(0, 80)}`); continue }
    fen = `${c.tablero} ${lib.color} ${enroques(c.tablero)} - 0 1`
    try { posDesdeFen(fen) } catch { anotar('posición ilegal', `${c.n}: ${fen}`); continue }
    ucis = jugar(posDesdeFen(fen), lib.sans).ucis
    if (!ucis.length) { anotar('primera jugada ilegal', `${c.n}: ${lib.sans[0]} en ${fen}`); continue }
  }
  // Posición después de la primera jugada del libro (la que tiene que encontrar quien resuelve).
  const pTras = jugarUci(posDesdeFen(fen), ucis[0])!
  const fenTras = makeFen(pTras.toSetup())
  let ok = false, motivo = ''
  const temas = [...sec.temas]
  if (sec.tipo === 'mate' && sec.mate === 1) {
    ok = pTras.isCheckmate()
    motivo = 'la jugada del libro no da mate'
  } else if ((sec.tipo === 'tablas' || sec.tipo === 'gana') && piezas(fenTras) <= 7) {
    const cat = await tablebase(fenTras)
    ok = sec.tipo === 'tablas' ? ['draw', 'cursed-win', 'blessed-loss'].includes(cat ?? '') : cat === 'loss'
    motivo = `tablebase tras la jugada del libro: ${cat}`
  } else {
    const despues = await motor.analizar(fenTras)
    const evMia = invertir(despues.ev)
    if (sec.tipo === 'mate') {
      ok = pTras.isCheckmate() || (evMia.mate !== undefined && evMia.mate > 0 && evMia.mate <= sec.mate!)
      motivo = `Stockfish no confirma el mate en ${sec.mate} (${JSON.stringify(evMia)})`
    } else {
      const antes = await motor.analizar(fen)
      const perdida = chancesDeGanar(antes.ev) - chancesDeGanar(evMia)
      ok = sec.tipo === 'tablas' ? Math.abs(valor(evMia)) < 60 && perdida < 0.1 : valor(evMia) >= 250 && perdida < 0.1
      if (ok && evMia.mate !== undefined && evMia.mate > 0 && evMia.mate <= 3) temas.push(`mateIn${evMia.mate}`)
      motivo = `Stockfish: antes ${JSON.stringify(antes.ev)}, tras la jugada del libro ${JSON.stringify(evMia)}, pérdida ${perdida.toFixed(2)}`
    }
  }
  if (!ok) { anotar('no confirmado', `${c.n}: ${motivo}`); continue }
  anotar('ok')
  salida.push({ id: `polgar-${c.n}`, fen, jugadas: ucis, temas, fuente: { titulo: TITULO, capitulo: `${sec.cap}, n.º ${c.n}` } })
  if (salida.length % 250 === 0) console.log(`${salida.length} confirmados (n.º ${c.n})`)
}
motor.cerrar()
const sufijo = RANGOS ? '-prueba' : ''
writeFileSync(`public/datos/problemas-libros${sufijo}.json`, JSON.stringify(salida))
writeFileSync(`datos-privados/biblioteca/polgar-partidas${sufijo}.json`, JSON.stringify(partidas))
writeFileSync(`datos-privados/biblioteca/polgar-informe${sufijo}.txt`, [JSON.stringify(cuenta, null, 2), ...informe].join('\n'))
console.log(cuenta)
