/**
 * Problemas de libros cuyos diagramas son imágenes. Entrada (en datos-privados/biblioteca/img/):
 *  - <base>_fen.json: tableros reconocidos (diagramas.py + clasificar.py), con el texto de arriba (número,
 *    jugadores) y de abajo (quién juega) de cada diagrama;
 *  - <base>_soluciones.json: casilla de destino de la primera jugada de la solución del libro, y títulos de
 *    capítulo por página.
 * Un problema entra solo si la posición es legal, Stockfish encuentra la jugada del libro (o una que llega a la casilla que da el libro), esa jugada es (casi) la mejor y deja una ventaja clara. La solución que se guarda es la línea
 * de Stockfish que empieza con esa jugada: no se copia texto del libro.
 *
 * Uso: node scripts/preparar-problemas-imagen.ts <base> "<título del libro>" <prefijo-id> [profundidad]
 * Agrega (o reemplaza, por prefijo de id) los problemas en public/datos/problemas-libros.json.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { makeFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { parseSan } from 'chessops/san'
import { posDesdeFen, uciEstandar } from '../src/lib/ajedrez/posicion.ts'
import { chancesDeGanar, type Evaluacion } from '../src/lib/ajedrez/evaluacion.ts'
import { MotorNativo } from './lib-motor.ts'

const [base, titulo, prefijo, prof = '16'] = process.argv.slice(2)
const DIR = 'datos-privados/biblioteca/img'
/**
 * Entrada común (la arma un script de Python por libro): número, color que mueve, uno o más tableros
 * candidatos (por ejemplo, el diagrama tal cual y dado vuelta) y la solución del libro: la jugada en SAN
 * si el texto es limpio, o solo la casilla de destino si el OCR estropea las piezas.
 */
interface Entrada { n: number; clave?: string; color: 'w' | 'b'; tableros: string[]; san?: string; destino?: string; capitulo?: string; etiqueta?: string }
const entradas: Entrada[] = JSON.parse(readFileSync(`${DIR}/${base}_entrada.json`, 'utf8'))

function enroques(tablero: string): string {
  const filas = tablero.split('/').map((f) => f.replace(/\d/g, (d) => '.'.repeat(Number(d))))
  let r = ''
  if (filas[7][4] === 'K' && filas[7][7] === 'R') r += 'K'
  if (filas[7][4] === 'K' && filas[7][0] === 'R') r += 'Q'
  if (filas[0][4] === 'k' && filas[0][7] === 'r') r += 'k'
  if (filas[0][4] === 'k' && filas[0][0] === 'r') r += 'q'
  return r || '-'
}
/** Casilla de destino de una jugada, o "O-O"/"O-O-O" si es un enroque (rey que se mueve dos columnas). */
const destino = (uci: string, fen: string) => {
  const pieza = posDesdeFen(fen).board.get(parseSquare(uci.slice(0, 2))!)
  const salto = uci.charCodeAt(2) - uci.charCodeAt(0)
  if (pieza?.role === 'king' && Math.abs(salto) === 2) return salto > 0 ? 'O-O' : 'O-O-O'
  return uci.slice(2, 4)
}
/** Material posible: cada pieza de más que la inicial necesita un peón coronado (si no, Stockfish rechaza la posición y no responde). */
const materialPosible = (tab: string) =>
  [/[PNBRQK]/g, /[pnbrqk]/g].every((re) => {
    const c = (tab.match(re) ?? []).join('').toLowerCase()
    const n = (x: string) => [...c].filter((y) => y === x).length
    const extra = Math.max(0, n('q') - 1) + Math.max(0, n('r') - 2) + Math.max(0, n('b') - 2) + Math.max(0, n('n') - 2)
    return n('p') + extra <= 8
  })
/**
 * Sin piezas de más: ni dos damas, ni tres torres, caballos o alfiles, ni dos alfiles del mismo color. En un libro
 * de táctica de partidas casi nunca hay piezas coronadas, y un tablero mal leído suele duplicar una pieza (pasó con
 * Polgár, Middlegame: las damas negras están impresas huecas como las blancas, y de las variantes de color el
 * verificador elegía la que tenía dos damas del bando que gana). Para libros de composiciones o estudios:
 * PIEZAS_DE_MAS=1.
 */
const sinPiezasDeMas = (tab: string) => {
  if (process.env.PIEZAS_DE_MAS) return true
  const filas = tab.split('/').map((f) => f.replace(/\d/g, (d) => '.'.repeat(Number(d))))
  return ['QRBN', 'qrbn'].every(([q, r, b, n]) => {
    const casillas = (p: string) => filas.flatMap((f, i) => [...f].flatMap((c, j) => (c === p ? [(i + j) % 2] : [])))
    const alfiles = casillas(b)
    return casillas(q).length <= 1 && casillas(r).length <= 2 && casillas(n).length <= 2 && alfiles.length <= 2 && !(alfiles.length === 2 && alfiles[0] === alfiles[1])
  })
}
const fuerte = (e: Evaluacion) => (e.mate !== undefined ? e.mate > 0 : (e.cp ?? 0) >= 120)

const motor = new MotorNativo(Number(prof), 4)
const nuevos: { id: string; fen: string; jugadas: string[]; temas: string[]; fuente: { titulo: string; capitulo?: string } }[] = []
const cuenta: Record<string, number> = {}
const informe: string[] = []
const anotar = (k: string, msg?: string) => { cuenta[k] = (cuenta[k] ?? 0) + 1; if (msg) informe.push(msg) }

type Resultado = { ok: true; fen: string; jugadas: string[]; temas: string[] } | { ok: false; motivo: string; msg: string }

/** Verifica un tablero candidato ya legal contra la solución del libro (o, sin solución, la exige única y decisiva). */
async function verificar(e: Entrada, fenN: string, uciLibro: string | undefined): Promise<Resultado> {
  const n = e.n
  if (process.env.DEPURAR) console.error(n, fenN)
  const a = await motor.analizar(fenN, 4)
  const mejor = a.lineas[0]
  if (!mejor?.pv.length) return { ok: false, motivo: 'sin jugadas legales', msg: `${n}: ${fenN}` }
  // Sin solución legible del libro: la mejor de Stockfish, siempre que sea claramente única y decisiva.
  const sinSolucion = !e.san && !e.destino
  if (sinSolucion) {
    const segunda = a.lineas[1]
    const ventaja = chancesDeGanar(mejor.ev) - (segunda ? chancesDeGanar(segunda.ev) : -1)
    const decisiva = mejor.ev.mate !== undefined ? mejor.ev.mate > 0 : (mejor.ev.cp ?? 0) >= 200
    if (!decisiva || ventaja < 0.15) return { ok: false, motivo: 'sin solución del libro: no hay una jugada única y decisiva', msg: `${n}: ${JSON.stringify(mejor.ev)} vs ${JSON.stringify(segunda?.ev)} (${fenN})` }
  }
  const elegida = sinSolucion ? mejor : a.lineas.find((l) => l.pv[0] && (uciLibro ? l.pv[0] === uciLibro : destino(l.pv[0], fenN) === e.destino))
  if (!elegida) return { ok: false, motivo: 'la jugada del libro no está entre las 4 mejores', msg: `${n}: libro → ${e.san ?? e.destino}; Stockfish ${a.lineas.map((l) => l.pv[0]).join(' ')} (${fenN})` }
  const perdida = chancesDeGanar(mejor.ev) - chancesDeGanar(elegida.ev)
  if (perdida > 0.05 || !fuerte(elegida.ev)) return { ok: false, motivo: 'no confirmado', msg: `${n}: pérdida ${perdida.toFixed(2)}, eval ${JSON.stringify(elegida.ev)} (${fenN})` }
  // Línea de la solución: hasta 5 medias jugadas, terminando con una jugada propia.
  const largo = Math.min(elegida.pv.length, 5)
  const temas: string[] = []
  if (elegida.ev.mate !== undefined && elegida.ev.mate > 0 && elegida.ev.mate <= 3) temas.push(`mateIn${elegida.ev.mate}`)
  return { ok: true, fen: fenN, jugadas: elegida.pv.slice(0, largo % 2 === 1 ? largo : largo - 1), temas }
}

// Avance guardado cada 25 posiciones en <base>_avance.json: si la corrida se corta (pasó al reiniciarse la sesión
// con verificaciones de varias horas), con REANUDAR=1 se retoma desde ahí en vez de empezar de cero.
const AVANCE = `${DIR}/${base}_avance.json`
const hechos = new Set<string>()
if (process.env.REANUDAR && existsSync(AVANCE)) {
  const a = JSON.parse(readFileSync(AVANCE, 'utf8')) as { hechos: string[]; nuevos: typeof nuevos; cuenta: typeof cuenta; informe: string[] }
  a.hechos.forEach((h) => hechos.add(h))
  nuevos.push(...a.nuevos)
  Object.assign(cuenta, a.cuenta)
  informe.push(...a.informe)
  console.error(`Reanudando: ${hechos.size} posiciones ya verificadas`)
}
const guardarAvance = () => writeFileSync(AVANCE, JSON.stringify({ hechos: [...hechos], nuevos, cuenta, informe }))

for (const e of entradas) {
  const n = e.n
  const clave = String(e.clave ?? n)
  if (hechos.has(clave)) continue
  hechos.add(clave)
  if (hechos.size % 25 === 0) guardarAvance()
  // Tableros candidatos legales (y en los que la jugada del libro sea legal, si la hay). Con solución del libro
  // se prueban todos (p. ej. variantes de color de una pieza dudosa) y vale el primero que la confirma; sin
  // solución, solo el primero, porque cualquier posición errónea podría tener una jugada decisiva.
  const legales: { fen: string; uci?: string }[] = []
  for (const tab of e.tableros) {
    if (tab.includes('?') || !materialPosible(tab) || !sinPiezasDeMas(tab)) continue
    try {
      const pos = posDesdeFen(`${tab} ${e.color} ${enroques(tab)} - 0 1`)
      let uci: string | undefined
      if (e.san) {
        const m = parseSan(pos, e.san)
        if (!m) continue
        uci = uciEstandar(pos, m)
      }
      legales.push({ fen: makeFen(pos.toSetup()), uci })
    } catch { /* posición ilegal: probar el siguiente candidato */ }
  }
  if (!legales.length) { anotar('ningún tablero legal', `${n}: ${e.tableros.join(' | ')} ${e.san ?? e.destino ?? ''}`); continue }
  let primero: Resultado | undefined, bueno: Resultado | undefined
  for (const c of e.san || e.destino ? legales : legales.slice(0, 1)) {
    const r = await verificar(e, c.fen, c.uci)
    primero ??= r
    if (r.ok) { bueno = r; break }
  }
  const r = bueno ?? primero!
  if (!r.ok) { anotar(r.motivo, r.msg); continue }
  anotar('ok')
  nuevos.push({ id: `${prefijo}-${e.clave ?? n}`, fen: r.fen, jugadas: r.jugadas, temas: r.temas, fuente: { titulo, capitulo: [e.capitulo, e.etiqueta ?? `n.º ${n}`].filter(Boolean).join(', ') } })
}
motor.cerrar()
guardarAvance()

const RUTA = 'public/datos/problemas-libros.json'
const previos = existsSync(RUTA) ? (JSON.parse(readFileSync(RUTA, 'utf8')) as { id: string }[]).filter((p) => !p.id.startsWith(`${prefijo}-`)) : []
writeFileSync(RUTA, JSON.stringify([...previos, ...nuevos]))
writeFileSync(`${DIR}/${base}_informe.txt`, [JSON.stringify(cuenta, null, 2), ...informe].join('\n'))
console.log(cuenta)
