/**
 * Las 60 partidas de Fischer, «My 60 Memorable Games» (Batsford, 2008). datos-privados/biblioteca/fischer60.py saca
 * del PDF las jugadas de la línea principal (las figuras son imágenes); acá se validan una por una con chessops.
 * Solo entran las partidas completas y legales. Son jugadas y datos de la partida: no hay texto del libro.
 *
 * Uso: node scripts/preparar-partidas-fischer.ts → agrega (o reemplaza, por prefijo) en public/datos/partidas-libros.json
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parseSan } from 'chessops/san'
import { FEN_INICIAL, posDesdeFen, uciEstandar } from '../src/lib/ajedrez/posicion.ts'
import type { PartidaLibro } from '../src/lib/partidas-libros/partidas-libros.ts'

const TITULO = 'Bobby Fischer — My 60 Memorable Games (Batsford, 2008)'
interface Cruda { n: number; cabecera: string; san: string[]; san_negrita: string[]; resultado: string | null }
const crudas: Cruda[] = JSON.parse(readFileSync('datos-privados/biblioteca/img/fischer60.json', 'utf8'))

const titulo = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase())
    .replace(/\bUsa\b/g, 'USA')
    .replace(/\bU\.s\.a\./g, 'U.S.A.')
    .replace(/ Del /g, ' del ')
    .replace('Curaçlao', 'Curaçao')
const salida: PartidaLibro[] = []
const fallas: string[] = []
for (const c of crudas) {
  const [jugadores = '', evento = ''] = c.cabecera.split(' | ')
  const [blancas, negras] = jugadores.replace(/\[[^\]]*\]/g, '').split(/\s[–-]\s/).map((s) => s.trim())
  // "MAR DEL PLATA 1959", "USA CHAMPIONSHIP 1960-1", "NEW YORK 1961: 2nd Match Game"
  const m = /^(.*?)\s*(\d{4})(?:-\d+)?(?::\s*(.*))?$/.exec(evento)
  // Dos lecturas del PDF (por columnas y solo negritas): vale la primera que es legal de punta a punta.
  let jugadas: string[] = []
  let falla = ''
  for (const lectura of [c.san, c.san_negrita]) {
    const pos = posDesdeFen(FEN_INICIAL)
    jugadas = []
    falla = ''
    for (const s of lectura) {
      const mv = parseSan(pos, s)
      if (!mv) { falla = `jugada ${Math.floor(jugadas.length / 2) + 1}: ${s}`; break }
      jugadas.push(uciEstandar(pos, mv))
      pos.play(mv)
    }
    if (!falla) break
  }
  if (falla) { fallas.push(`n.º ${c.n} (${jugadores}): ${falla}`); continue }
  const r = c.resultado ?? ''
  const resultado = /black resigns|white wins/i.test(r) ? '1-0' : /white resigns|black wins/i.test(r) ? '0-1' : /draw/i.test(r) ? '1/2-1/2' : undefined
  salida.push({
    id: `fischer60-${c.n}`,
    blancas: blancas || 'N. N.',
    negras: negras || 'N. N.',
    lugar: m ? titulo(m[1].replace(/[,\s]+$/, '')) + (m[3] ? ` (${m[3].trim()})` : '') : evento || undefined,
    anio: m ? Number(m[2]) : undefined,
    resultado,
    jugadas,
    fuente: { titulo: TITULO, capitulo: `partida ${c.n}` },
  })
}
const RUTA = 'public/datos/partidas-libros.json'
const previas = existsSync(RUTA) ? (JSON.parse(readFileSync(RUTA, 'utf8')) as PartidaLibro[]).filter((p) => !p.id.startsWith('fischer60-')) : []
writeFileSync(RUTA, JSON.stringify([...previas, ...salida]))
console.log(salida.length, 'partidas de Fischer;', fallas.length, 'descartadas')
for (const f of fallas) console.log(' ', f)
