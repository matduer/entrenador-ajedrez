/**
 * Irving Chernev, «Ajedrez lógico, jugada a jugada» (trad. Manuel Arce, Diana, México, 1959; 10.ª impr. 1971):
 * las 33 partidas comentadas jugada por jugada. Notación descriptiva española con OCR
 * (datos-privados/biblioteca/textos/chernev.txt).
 *
 * Línea principal: cada jugada va en su propio renglón ("15. CxPR !"); las negras, con "15. . . ." en un renglón y
 * la jugada en el siguiente. Los comentarios (con variantes en prosa) van entre jugadas y se ignoran. La numeración
 * tiene que seguir exacta. Cada jugada se interpreta con scripts/lib-descriptiva.ts; una jugada ilegible (el OCR
 * deja "hC" por "PxC") vale como comodín: cualquier jugada legal. Se exige que la partida entera tenga UNA sola
 * reconstrucción legal, así que las jugadas siguientes deciden cuál era. Resultado: "N. Abandonan" (las blancas
 * abandonan en su jugada N) o "N. . . . Abandonan".
 *
 * Uso: node scripts/preparar-partidas-chernev.ts → agrega (o reemplaza, por prefijo) en public/datos/partidas-libros.json
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { Chess } from 'chessops/chess'
import type { NormalMove } from 'chessops/types'
import { FEN_INICIAL, posDesdeFen, uciEstandar } from '../src/lib/ajedrez/posicion.ts'
import type { PartidaLibro } from '../src/lib/partidas-libros/partidas-libros.ts'
import { candidatosDescriptiva, leerDescriptiva } from './lib-descriptiva.ts'

const TITULO = 'Irving Chernev — Ajedrez lógico, jugada a jugada (trad. Manuel Arce, Diana, México, 1959)'
const renglones = readFileSync('datos-privados/biblioteca/textos/chernev.txt', 'utf8')
  .replace(/\r/g, '')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !/^<<P\d+>>$/.test(l) && l !== '•')

const num = (s: string) => Number(s.replace(/[lI]/g, '1').replace(/[oO]/g, '0').replace(/S/g, '5').replace(/\s/g, ''))
const RE_BL = /^([0-9lIoOS]{1,3})\s*\.\s*(?!\.)([^\s.].{0,12}?)\s*$/
const RE_NG = /^([0-9lIoOS]{1,3})\s*\.\s*\.[\s.'"‘’`,]*$/
const limpiar = (t: string) => t.replace(/\s+/g, '').replace(/[!?]+/g, '').replace(/(tt|t|\+)+$/, '')

type Item = { n: number; negras: boolean; tok: string }
const inicios = renglones.flatMap((l, i) => (/^Partida Núm\.\s*\d+/.test(l) ? [i] : []))
const salida: PartidaLibro[] = []
const fallas: string[] = []

function legales(pos: Chess): NormalMove[] {
  const out: NormalMove[] = []
  for (const [d, h] of pos.allDests()) for (const to of h) out.push({ from: d, to })
  return out
}

for (let k = 0; k < inicios.length; k++) {
  const i0 = inicios[k]
  const fin = inicios[k + 1] ?? renglones.length
  const nro = Number(/\d+/.exec(renglones[i0])![0])
  const apertura = renglones[i0 + 1]
  const iB = renglones.slice(i0, i0 + 8).findIndex((l) => l === 'NEGRAS')
  const blancas = renglones[i0 + iB + 1], negras = renglones[i0 + iB + 2], lugar = renglones[i0 + iB + 3]
  // tokens de la línea principal
  const items: Item[] = []
  let esperado = 1, turnoNegras = false
  let resultado: PartidaLibro['resultado']
  for (let i = i0 + iB + 4; i < fin; i++) {
    const l = renglones[i]
    if (/abandonan/i.test(l) && /^\.?\s*[0-9lIoOS]{1,3}\s*\./.test(l)) {
      const m = /([0-9lIoOS]{1,3})\s*\.\s*(\.\s*\.\s*\.)?/.exec(l)!
      if (num(m[1]) === esperado || num(m[1]) === esperado - 1) { resultado = m[2] ? '1-0' : '0-1'; break }
    }
    if (/^tablas/i.test(l) && items.length > 20) { resultado = '1/2-1/2'; break }
    const ng = RE_NG.exec(l)
    if (ng && turnoNegras && num(ng[1]) === esperado) {
      // la jugada de las negras: el próximo renglón corto
      let j = i + 1
      while (j < fin && /^[\s.'"‘’`,]*$/.test(renglones[j])) j++
      if (j < fin && renglones[j].length <= 12) {
        items.push({ n: esperado, negras: true, tok: limpiar(renglones[j]) })
        turnoNegras = false; esperado++; i = j
      }
      continue
    }
    const bl = RE_BL.exec(l)
    if (bl && !turnoNegras && num(bl[1]) === esperado && /[A-Z0-9]/.test(bl[2]) && !/[a-zñ]{4,}/.test(bl[2])) {
      items.push({ n: esperado, negras: false, tok: limpiar(bl[2]) })
      turnoNegras = true
    }
  }
  if (!resultado) { fallas.push(`partida ${nro}: sin resultado (${items.length} medias jugadas)`); continue }
  // reconstrucción con comodines para tokens ilegibles; una sola solución
  const sols: string[][] = []
  let nodos = 0, hasta = 0
  const rec = (pos: Chess, i: number, acc: string[]) => {
    if (sols.length > 1 || ++nodos > 200000) return
    hasta = Math.max(hasta, i)
    if (i === items.length) { sols.push([...acc]); return }
    const tok = items[i].tok
    const cands = leerDescriptiva(tok).length ? candidatosDescriptiva(pos, tok) : legales(pos)
    for (const mv of cands) {
      const p2 = pos.clone()
      acc.push(uciEstandar(pos, mv))
      p2.play(mv)
      rec(p2, i + 1, acc)
      acc.pop()
    }
  }
  rec(posDesdeFen(FEN_INICIAL), 0, [])
  if (sols.length !== 1) { fallas.push(`partida ${nro} (${blancas} - ${negras}): ${sols.length ? 'varias lecturas' : `se corta en ${items[hasta]?.n}${items[hasta]?.negras ? '…' : '.'} «${items[hasta]?.tok}»`}`); continue }
  const anio = /(\d{4})/.exec(lugar)?.[1]
  salida.push({
    id: `chernev-${nro}`,
    blancas, negras,
    lugar: lugar.replace(/,?\s*\d{4}.*$/, '').trim() || undefined,
    anio: anio ? Number(anio) : undefined,
    resultado,
    jugadas: sols[0],
    fuente: { titulo: TITULO, capitulo: `partida n.º ${nro} (${apertura.toLowerCase().replace(/^./, (c) => c.toUpperCase())})` },
  })
}
const RUTA = 'public/datos/partidas-libros.json'
const previas = existsSync(RUTA) ? (JSON.parse(readFileSync(RUTA, 'utf8')) as PartidaLibro[]).filter((x) => !x.id.startsWith('chernev-')) : []
if (!process.env.SECO) writeFileSync(RUTA, JSON.stringify([...previas, ...salida]))
console.log(inicios.length, 'partidas en el libro;', salida.length, 'reconstruidas;', fallas.length, 'descartadas')
for (const f of fallas) console.log('  falla:', f)
for (const s of salida) console.log(' ', s.id, s.blancas, '-', s.negras, s.anio ?? '', s.resultado, s.jugadas.length)
