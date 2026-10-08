/**
 * «Defensa de los Dos Caballos: 3750 partidas modelo» (Lenyb, Colección Escaques64 y con Café, Venezuela, 2013):
 * compilación de partidas sin comentarios, con las figuras de la tipografía de ChessBase (¥ caballo, ¤ alfil,
 * £ dama, ¦ torre, ¢ rey) en datos-privados/biblioteca/textos/lenyb.txt. Encabezado "Blancas - Negras",
 * renglón "1:0, 1859." y las jugadas hasta "[1:0]".
 *
 * Solo entran las partidas anteriores a 1950 (las históricas: Polerio, Morphy, Steinitz, Chigorin…); las de las
 * últimas décadas son en su mayoría de aficionados y no aportan como modelo. Una partida entra solo si todas sus
 * jugadas son legales; las repetidas (misma secuencia de jugadas) entran una vez.
 *
 * Uso: node scripts/preparar-partidas-lenyb.ts → agrega (o reemplaza, por prefijo) en public/datos/partidas-libros.json
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parseSan } from 'chessops/san'
import { FEN_INICIAL, posDesdeFen, uciEstandar } from '../src/lib/ajedrez/posicion.ts'
import type { PartidaLibro } from '../src/lib/partidas-libros/partidas-libros.ts'

const TITULO = 'Lenyb — Defensa de los Dos Caballos: 3750 partidas modelo (Colección Escaques64 y con Café, Venezuela, 2013)'
const HASTA = 1949
const FIGURA: Record<string, string> = { '¥': 'N', '¤': 'B', '£': 'Q', '¦': 'R', '¢': 'K' }
const texto = readFileSync('datos-privados/biblioteca/textos/lenyb.txt', 'utf8').replace(/\r/g, '')
// Partidas cuyo resultado no cuadra con la posición final según scripts/verificar-partidas-libros.ts (probablemente
// jugadas cortadas o mal transcriptas en la compilación): se dejan afuera.
const EXCLUIR = new Set(['Polerio - Domenico', 'Blackburne H - Janowski David M', 'Von Freyman S - Spielmann Rudolf'])
const RES: Record<string, PartidaLibro['resultado']> = { '1:0': '1-0', '0:1': '0-1', '½:½': '1/2-1/2' }

const re = /^(.+?) - (.+)\n([10½]:[10½]), (\d{4})\.\n([\s\S]*?)\[([10½]:[10½])\]/gm
const salida: PartidaLibro[] = []
const vistas = new Set<string>()
const previas0 = existsSync('public/datos/partidas-libros.json') ? (JSON.parse(readFileSync('public/datos/partidas-libros.json', 'utf8')) as PartidaLibro[]) : []
for (const p of previas0) if (!p.id.startsWith('lenyb-')) vistas.add(p.jugadas.join(' '))
let ilegales = 0, repetidas = 0, total = 0
for (const m of texto.matchAll(re)) {
  const [, blancas, negras, res, anio, cuerpo] = m
  if (Number(anio) > HASTA || EXCLUIR.has(`${blancas.trim()} - ${negras.trim()}`)) continue
  total++
  const tokens = cuerpo
    .replace(/[¥¤£¦¢]/g, (f) => FIGURA[f])
    .replace(/\d+\.\s*/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  let pos = posDesdeFen(FEN_INICIAL)
  const ucis: string[] = []
  let ok = true
  for (const t of tokens) {
    const mv = parseSan(pos, t.replace(/[!?]+$/, ''))
    if (!mv) { ok = false; break }
    ucis.push(uciEstandar(pos, mv))
    pos.play(mv)
  }
  if (!ok || ucis.length < 10) { ilegales++; continue }
  const clave = ucis.join(' ')
  if (vistas.has(clave)) { repetidas++; continue }
  vistas.add(clave)
  const nombre = (s: string) => s.trim().replace(/\s+/g, ' ')
  salida.push({
    id: `lenyb-${salida.length + 1}`,
    blancas: nombre(blancas),
    negras: nombre(negras),
    // 1800 es un año de relleno del compilador (Polerio-Domenico es del siglo XVI)
    anio: Number(anio) === 1800 ? undefined : Number(anio),
    resultado: RES[res],
    jugadas: ucis,
    fuente: { titulo: TITULO },
  })
}
const RUTA = 'public/datos/partidas-libros.json'
const previas = previas0.filter((x) => !x.id.startsWith('lenyb-'))
if (!process.env.SECO) writeFileSync(RUTA, JSON.stringify([...previas, ...salida]))
console.log(total, `partidas hasta ${HASTA};`, salida.length, 'nuevas;', ilegales, 'con jugadas ilegales o muy cortas;', repetidas, 'repetidas')
for (const s of salida.slice(0, 15)) console.log(' ', s.id, s.blancas, '-', s.negras, s.anio, s.resultado, s.jugadas.length)
