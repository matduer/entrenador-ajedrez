/**
 * Las 600 miniaturas de Polgár («Chess: 5334 Problems, Combinations and Games», cap. 4), reconstruidas por
 * preparar-problemas-polgar.ts en datos-privados/biblioteca/polgar-partidas.json. Solo entran las que se
 * pudieron leer completas (todas las jugadas legales). Son jugadas y datos de la partida: no hay texto del libro.
 *
 * Uso: node scripts/preparar-partidas-polgar.ts → agrega (o reemplaza, por prefijo) en public/datos/partidas-libros.json
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { FEN_INICIAL, jugarUci, posDesdeFen } from '../src/lib/ajedrez/posicion.ts'
import type { PartidaLibro } from '../src/lib/partidas-libros/partidas-libros.ts'

const TITULO = 'László Polgár — Chess: 5334 Problems, Combinations and Games (Könemann, 1994)'
interface Cruda { id: string; jugadas: string[]; jugadores?: string; lugar?: string; completa: boolean }
const crudas: Cruda[] = JSON.parse(readFileSync('datos-privados/biblioteca/polgar-partidas.json', 'utf8'))

const salida: PartidaLibro[] = []
for (const c of crudas) {
  if (!c.completa || !c.jugadas.length) continue
  const [blancas, negras] = (c.jugadores ?? '').split(/\s[–-]\s/).map((s) => s.trim())
  const m = /^(.*?)\s*-\s*(\d{4})$/.exec(c.lugar ?? '')
  // Resultado: si la partida termina en mate se sabe quién ganó; si no, el libro la da como ganada por quien hizo la combinación.
  let pos = posDesdeFen(FEN_INICIAL)
  for (const u of c.jugadas) pos = jugarUci(pos, u) ?? pos
  const mate = pos.isCheckmate()
  salida.push({
    id: c.id,
    blancas: blancas || 'N. N.',
    negras: negras || 'N. N.',
    lugar: m ? m[1] : c.lugar,
    anio: m ? Number(m[2]) : undefined,
    resultado: mate ? (pos.turn === 'white' ? '0-1' : '1-0') : undefined,
    jugadas: c.jugadas,
    fuente: { titulo: TITULO, capitulo: `cap. 4, «600 Miniature games», n.º ${c.id.split('-')[1]}` },
  })
}
const RUTA = 'public/datos/partidas-libros.json'
const previas = existsSync(RUTA) ? (JSON.parse(readFileSync(RUTA, 'utf8')) as PartidaLibro[]).filter((p) => !p.id.startsWith('polgar-')) : []
writeFileSync(RUTA, JSON.stringify([...previas, ...salida]))
console.log(salida.length, 'partidas de Polgár')
