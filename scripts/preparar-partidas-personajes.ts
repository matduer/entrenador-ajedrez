/**
 * «Partidas de personajes históricos» (recopilación de ajedrezdeataque.com, 7 p.): partidas atribuidas a
 * personajes célebres (Einstein, Chaplin, el Che, Tolstói, Prokófiev…). Texto limpio en notación algebraica
 * española (datos-privados/biblioteca/textos/personajes.txt). Encabezado "Blancas - Negras", renglón de lugar y
 * año (o "Sin datos"), y las jugadas hasta el resultado. Una partida entra solo si todas sus jugadas son legales.
 *
 * Uso: node scripts/preparar-partidas-personajes.ts → agrega (o reemplaza, por prefijo) en public/datos/partidas-libros.json
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parseSan } from 'chessops/san'
import { FEN_INICIAL, posDesdeFen, uciEstandar } from '../src/lib/ajedrez/posicion.ts'
import type { PartidaLibro } from '../src/lib/partidas-libros/partidas-libros.ts'
import { sanIngles as ingles } from './lib-san-es.ts'

const TITULO = 'Partidas de personajes históricos (recopilación de ajedrezdeataque.com)'
// Erratas del texto en nombres: "'Che' Guevara" y "Che Guevara" conviven; "Xavielly" por Savielly Tartakower.
const limpiar = (s: string) => s.replace(/'Che' Guevara|^Che Guevara$/, 'Guevara, Ernesto «Che»').replace('Xavielly', 'Savielly')
const renglones = readFileSync('datos-privados/biblioteca/textos/personajes.txt', 'utf8').split('\n').map((l) => l.trim())
const RESULTADO = /^(1-0|0-1|½-½|�-�)$/
const salida: PartidaLibro[] = []
const fallas: string[] = []
for (let i = 0; i < renglones.length; i++) {
  // Comienzo de partida: renglón que empieza con "1." y el encabezado dos renglones antes (o uno, sin lugar).
  if (!/^1\.\S/.test(renglones[i])) continue
  const conLugar = !/ - /.test(renglones[i - 1])
  const jugadores = conLugar ? renglones[i - 2] : renglones[i - 1]
  const lugarAnio = conLugar ? renglones[i - 1] : ''
  const tokens: string[] = []
  let resultado: PartidaLibro['resultado']
  let j = i
  for (; j < renglones.length && !resultado; j++) {
    for (const t0 of renglones[j].split(/\s+/).filter(Boolean)) {
      const t = t0.replace(/[–—]/g, '-')
      if (RESULTADO.test(t)) { resultado = t === '1-0' || t === '0-1' ? t : '1/2-1/2'; break }
      tokens.push(t.replace(/^\d+\./, ''))
    }
  }
  i = j - 1
  let pos = posDesdeFen(FEN_INICIAL)
  const ucis: string[] = []
  let error = ''
  for (const t of tokens.filter(Boolean)) {
    const m = parseSan(pos, ingles(t))
    if (!m) { error = `jugada ${Math.floor(ucis.length / 2) + 1} «${t}»`; break }
    ucis.push(uciEstandar(pos, m))
    pos.play(m)
  }
  const [b, n] = jugadores.split(' - ').map((s) => s.trim())
  if (error || !resultado || !n) { fallas.push(`${jugadores}: ${error || 'sin resultado o encabezado'}`); continue }
  const anio = /(\d{4})/.exec(lugarAnio)?.[1]
  const lugar = lugarAnio.replace(/(Año\s*)?\d{4}/, '').trim()
  salida.push({
    id: `personajes-${salida.length + 1}`,
    blancas: limpiar(b),
    negras: limpiar(n),
    lugar: lugar && lugar !== 'Sin datos' ? lugar : undefined,
    anio: anio ? Number(anio) : undefined,
    resultado,
    jugadas: ucis,
    fuente: { titulo: TITULO, capitulo: 'partidas atribuidas' },
  })
}
const RUTA = 'public/datos/partidas-libros.json'
const previas = existsSync(RUTA) ? (JSON.parse(readFileSync(RUTA, 'utf8')) as PartidaLibro[]).filter((x) => !x.id.startsWith('personajes-')) : []
if (!process.env.SECO) writeFileSync(RUTA, JSON.stringify([...previas, ...salida]))
console.log(salida.length, 'partidas;', fallas.length, 'descartadas')
for (const f of fallas) console.log('  falla:', f)
for (const s of salida) console.log(' ', s.id, s.blancas, '-', s.negras, s.lugar ?? '', s.anio ?? '', s.resultado, s.jugadas.length)
