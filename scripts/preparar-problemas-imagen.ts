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
interface Entrada { n: number; clave?: string; color: 'w' | 'b'; tableros: string[]; san?: string; destino?: string; capitulo?: string }
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
const fuerte = (e: Evaluacion) => (e.mate !== undefined ? e.mate > 0 : (e.cp ?? 0) >= 120)

const motor = new MotorNativo(Number(prof), 4)
const nuevos: { id: string; fen: string; jugadas: string[]; temas: string[]; fuente: { titulo: string; capitulo?: string } }[] = []
const cuenta: Record<string, number> = {}
const informe: string[] = []
const anotar = (k: string, msg?: string) => { cuenta[k] = (cuenta[k] ?? 0) + 1; if (msg) informe.push(msg) }

for (const e of entradas) {
  const n = e.n
  // Primer tablero candidato que sea legal (y en el que la jugada del libro sea legal, si la hay).
  let fenN: string | undefined, uciLibro: string | undefined
  for (const tab of e.tableros) {
    if (tab.includes('?')) continue
    try {
      const pos = posDesdeFen(`${tab} ${e.color} ${enroques(tab)} - 0 1`)
      if (e.san) {
        const m = parseSan(pos, e.san)
        if (!m) continue
        uciLibro = uciEstandar(pos, m)
      }
      fenN = makeFen(pos.toSetup())
      break
    } catch { /* posición ilegal: probar el siguiente candidato */ }
  }
  if (!fenN) { anotar('ningún tablero legal', `${n}: ${e.tableros.join(' | ')} ${e.san ?? e.destino ?? ''}`); continue }
  if (process.env.DEPURAR) console.error(n, fenN)
  const a = await motor.analizar(fenN, 4)
  const mejor = a.lineas[0]
  // Sin solución legible del libro: la mejor de Stockfish, siempre que sea claramente única y decisiva.
  const sinSolucion = !e.san && !e.destino
  if (sinSolucion) {
    const segunda = a.lineas[1]
    const ventaja = chancesDeGanar(mejor.ev) - (segunda ? chancesDeGanar(segunda.ev) : -1)
    const decisiva = mejor.ev.mate !== undefined ? mejor.ev.mate > 0 : (mejor.ev.cp ?? 0) >= 200
    if (!decisiva || ventaja < 0.15) { anotar('sin solución del libro: no hay una jugada única y decisiva', `${n}: ${JSON.stringify(mejor.ev)} vs ${JSON.stringify(segunda?.ev)} (${fenN})`); continue }
  }
  const elegida = sinSolucion ? mejor : a.lineas.find((l) => l.pv[0] && (uciLibro ? l.pv[0] === uciLibro : destino(l.pv[0], fenN!) === e.destino))
  if (!elegida) { anotar('la jugada del libro no está entre las 4 mejores', `${n}: libro → ${e.san ?? e.destino}; Stockfish ${a.lineas.map((l) => l.pv[0]).join(' ')} (${fenN})`); continue }
  const perdida = chancesDeGanar(mejor.ev) - chancesDeGanar(elegida.ev)
  if (perdida > 0.05 || !fuerte(elegida.ev)) { anotar('no confirmado', `${n}: pérdida ${perdida.toFixed(2)}, eval ${JSON.stringify(elegida.ev)} (${fenN})`); continue }
  // Línea de la solución: hasta 5 medias jugadas, terminando con una jugada propia.
  const largo = Math.min(elegida.pv.length, 5)
  const jugadas = elegida.pv.slice(0, largo % 2 === 1 ? largo : largo - 1)
  const temas: string[] = []
  if (elegida.ev.mate !== undefined && elegida.ev.mate > 0 && elegida.ev.mate <= 3) temas.push(`mateIn${elegida.ev.mate}`)
  anotar('ok')
  nuevos.push({ id: `${prefijo}-${e.clave ?? n}`, fen: fenN, jugadas, temas, fuente: { titulo, capitulo: [e.capitulo, `n.º ${n}`].filter(Boolean).join(', ') } })
}
motor.cerrar()

const RUTA = 'public/datos/problemas-libros.json'
const previos = existsSync(RUTA) ? (JSON.parse(readFileSync(RUTA, 'utf8')) as { id: string }[]).filter((p) => !p.id.startsWith(`${prefijo}-`)) : []
writeFileSync(RUTA, JSON.stringify([...previos, ...nuevos]))
writeFileSync(`${DIR}/${base}_informe.txt`, [JSON.stringify(cuenta, null, 2), ...informe].join('\n'))
console.log(cuenta)
