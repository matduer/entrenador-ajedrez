/**
 * Irving Chernev, «Ajedrez lógico, jugada a jugada» (trad. Manuel Arce, Diana, México, 1959; 10.ª impr. 1971):
 * las 33 partidas comentadas jugada por jugada, en notación descriptiva española. El texto
 * (datos-privados/biblioteca/textos/chernev.txt) sale de un OCR propio con RapidOCR (logico_texto.py, que además
 * relee las jugadas en negrita que el OCR no detecta).
 *
 * Línea principal: cada jugada va en su propio renglón («15. CxPR!»); las negras, con «15. . . .» y la jugada en el
 * mismo renglón o en el siguiente. A veces el OCR pierde los puntos de las negras, y los comentarios traen listas de
 * alternativas numeradas igual («2. P3AR», «2. D3A»…): por eso no se exige la numeración exacta, sino que las jugadas
 * se reconstruyen con la búsqueda en haz de lib-reconstruir-ocr.ts, que puede saltear lecturas. Una partida entra solo
 * si llega a la última jugada leída, si su reconstrucción es única y si no siguen jugadas después del resultado.
 * Resultado: «N. Abandonan» (abandonan las blancas en su jugada N) o «N. . . . Abandonan».
 *
 * Uso: node scripts/preparar-partidas-chernev.ts [n] → agrega (o reemplaza) en public/datos/partidas-libros.json
 * SECO=1: no escribe; DETALLE=1: cada jugada con su lectura y costo; LEIDAS=1: las lecturas.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { PartidaLibro } from '../src/lib/partidas-libros/partidas-libros.ts'
import { candidatasDescriptivas, orden, reconstruir, supuestaAmbigua, type Leida } from './lib-reconstruir-ocr.ts'

const TITULO = 'Irving Chernev — Ajedrez lógico, jugada a jugada (trad. Manuel Arce, Diana, México, 1959)'
const renglones = readFileSync('datos-privados/biblioteca/textos/chernev.txt', 'utf8')
  .replace(/\r/g, '')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !/^<<P\d+>>$/.test(l))

const num = (s: string) => Number(s.replace(/[lI]/g, '1').replace(/[oO]/g, '0').replace(/S/g, '5').replace(/\s/g, ''))
/** Una jugada en descriptiva, sin signos de valoración ni de jaque («D7T †» → «D7T»: el jaque se lee «f», «t» o «+»). */
const limpiarD = (t: string) => t.replace(/\s+/g, '').replace(/[!?¡¿:;,.]+/g, '').replace(/[a-z+†]+$/, '').replace(/^0-?0-?0$/, '0-0-0').replace(/^0-?0$/, '0-0')
const ES_JUGADA = (t: string) => t.length >= 2 && t.length <= 9 && /^([PCATDR][0-9A-Z]*|0-0(-0)?)$/.test(t)
const RE_BL = /^([0-9lIoOS]{1,3})\s*\.\s*(?!\.)([^\s.].{0,12}?)\s*$/
const RE_NG = /^([0-9lIoOS]{1,3})\s*\.\s*\.[\s.'"‘’`,]*(.{0,12})$/
const PROSA = /[a-zñ]{4,}/

interface Partida { n: number; apertura: string; blancas: string; negras: string; lugar: string; leidas: Leida[]; resultado?: PartidaLibro['resultado']; incompleta?: boolean }
const partidas: Partida[] = []
const p0 = () => partidas[partidas.length - 1]
// Encabezados del OCR viejo (la capa de texto del PDF): ahí los jugadores van en renglones separados.
const VIEJOS: Record<number, { apertura: string; blancas: string; negras: string; lugar: string }> = {}
{
  const v = existsSync('datos-privados/biblioteca/textos/chernev_viejo.txt') ? readFileSync('datos-privados/biblioteca/textos/chernev_viejo.txt', 'utf8').split('\n').map((l) => l.trim()) : []
  for (let i = 0; i < v.length; i++) {
    const h = /^Partida Núm\.\s*(\d+)/.exec(v[i])
    if (!h) continue
    const iN = v.slice(i, i + 10).findIndex((x) => x === 'NEGRAS')
    if (iN < 0) continue
    const iB = v.slice(i, i + 10).findIndex((x) => x === 'BLANCAS')
    VIEJOS[Number(h[1])] = { apertura: v.slice(i + 1, i + iB).join(' '), blancas: v[i + iN + 1], negras: v[i + iN + 2], lugar: v[i + iN + 3] }
  }
}
for (let i = 0; i < renglones.length; i++) {
  const l = renglones[i]
  const h = /^Partida Núm\.\s*(\d+)/.exec(l)
  if (h) {
    // Apertura: los renglones hasta «BLANCAS». Jugadores: el renglón siguiente («Liubarski Soultanbeieff», dos cajas
    // del OCR); si no son exactamente dos palabras, los del OCR viejo (viejo.ts), que los trae en renglones separados.
    const n = Number(h[1])
    const iB = renglones.slice(i, i + 8).findIndex((x) => x === 'BLANCAS')
    const ap = renglones.slice(i + 1, i + Math.max(iB, 1)).join(' ')
    let j = i + iB + 1
    if (renglones[j] === 'NEGRAS') j++
    const dos = renglones[j].split(' ')
    const lugar = renglones.slice(j, j + 3).find((x) => /\d{4}/.test(x)) ?? ''
    const v = VIEJOS[n]
    const [blancas, negras] = dos.length === 2 && iB > 0 ? dos : v ? [v.blancas, v.negras] : ['?', '?']
    partidas.push({ n, apertura: ap || v?.apertura || '', blancas, negras, lugar: lugar || v?.lugar || '', leidas: [] })
    i = j
    continue
  }
  // «Abandonan» solo, sin número: abandona el bando al que le toca jugar.
  if (/^Abandonan\.?$/.test(l) && !p0()?.resultado && p0()?.leidas.length) {
    const u = p0()!.leidas[p0()!.leidas.length - 1]
    p0()!.resultado = u.negras ? '0-1' : '1-0'
    continue
  }
  const p = partidas[partidas.length - 1]
  if (!p) continue
  const ultima = p.leidas[p.leidas.length - 1]
  // Resultado: «18. Abandonan», «20. . . . Abandonan».
  const ab = /^\.?\s*([0-9lIoOS]{1,3})\s*\.\s*(\.\s*\.\s*\.?|\.{2,}|\.\s*\.\s*[:;])?\s*Abandonan/.exec(l)
  if (ab && !p.resultado) { p.resultado = ab[2] ? '1-0' : '0-1'; continue }
  if (/^Tablas\.?$/i.test(l) && !p.resultado && p.leidas.length > 20) { p.resultado = '1/2-1/2'; continue }
  // Después del resultado no tendría que haber más jugadas de la línea principal.
  const bl = RE_BL.exec(l), ng = RE_NG.exec(l)
  if (p.resultado) {
    if ((bl && ES_JUGADA(limpiarD(bl[2])) && ultima && num(bl[1]) > ultima.nro)) p.incompleta = true
    continue
  }
  if (ng) {
    // la jugada de las negras: en el mismo renglón o en el siguiente renglón corto
    let t = ng[2]
    if (!limpiarD(t)) { const sig = renglones[i + 1] ?? ''; if (sig.length <= 12 && !PROSA.test(sig)) { t = sig; i++ } }
    const j = limpiarD(t)
    if (ES_JUGADA(j)) p.leidas.push({ nro: num(ng[1]), negras: true, texto: j })
    continue
  }
  if (bl && !PROSA.test(bl[2])) {
    const j = limpiarD(bl[2])
    // Si repite el número de la jugada blanca anterior, es la negra de ese número con los puntos perdidos por el OCR.
    const nro = num(bl[1])
    const negras = !!ultima && !ultima.negras && ultima.nro === nro
    if (ES_JUGADA(j)) p.leidas.push({ nro, negras, texto: j })
  }
}

const solo = process.argv[2] ? Number(process.argv[2]) : undefined
const salida: PartidaLibro[] = []
const fallas: string[] = []
for (const p of partidas) {
  if (solo && p.n !== solo) continue
  const titulo = `partida ${p.n} (${p.blancas} - ${p.negras})`
  if (process.env.LEIDAS) console.log(p.leidas.map((l) => `${l.nro}${l.negras ? '...' : '.'}${l.texto}`).join(' '))
  const finales = reconstruir(p.leidas, candidatasDescriptivas)
  const mejor = finales[0]
  if (!mejor) { fallas.push(`${titulo}: sin reconstrucción`); continue }
  const otra = finales.find((f) => f.ucis.join() !== mejor.ucis.join())
  const margen = otra ? otra.costo - mejor.costo : Infinity
  if (process.env.DETALLE) mejor.detalle.forEach((d, i) => console.log(`  ${Math.floor(i / 2) + 1}${i % 2 ? '...' : '.'} ${d}`))
  const dudosa = supuestaAmbigua(mejor, candidatasDescriptivas)
  const ultima = p.leidas[p.leidas.length - 1]
  const total = ultima ? orden(ultima.nro, ultima.negras) + 1 : 0
  const motivo = !p.resultado ? 'sin resultado en el texto'
    : p.incompleta ? 'hay jugadas después del resultado'
    : mejor.ucis.length < total ? `no llega al final (${mejor.ucis.length} medias jugadas de ${total})`
    : mejor.ucis.length < 10 ? 'demasiado corta'
    : dudosa ? `jugada supuesta ambigua (media jugada ${dudosa})`
    : margen < 0.3 ? `ambigua (margen ${margen.toFixed(2)}; media jugada ${otra!.ucis.findIndex((u, i) => u !== mejor.ucis[i]) + 1})`
    : mejor.costo / mejor.ucis.length > 0.8 ? 'costo medio alto'
    : ''
  console.log(`${p.n}: ${p.blancas} - ${p.negras}, ${mejor.ucis.length}/${total} medias jugadas, costo ${mejor.costo.toFixed(1)}, supuestas ${mejor.supuestas}, margen ${margen.toFixed(2)}, ${p.resultado ?? '?'} ${motivo}`)
  if (motivo) { fallas.push(`${titulo}: ${motivo}`); continue }
  const anio = /(\d{4})/.exec(p.lugar)?.[1]
  salida.push({
    id: `chernev-${p.n}`,
    blancas: p.blancas,
    negras: p.negras,
    lugar: p.lugar.replace(/,?\s*\d{4}.*$/, '').trim() || undefined,
    anio: anio ? Number(anio) : undefined,
    resultado: p.resultado,
    jugadas: mejor.ucis,
    fuente: { titulo: TITULO, capitulo: `partida n.º ${p.n} (${p.apertura.toLowerCase().replace(/^./, (c) => c.toUpperCase())})` },
  })
}
const RUTA = 'public/datos/partidas-libros.json'
// Solo las de este libro («chernev-12»), no las de «Capablanca's Best Chess Endings» («chernev-capa-12»).
const previas = existsSync(RUTA) ? (JSON.parse(readFileSync(RUTA, 'utf8')) as PartidaLibro[]).filter((x) => !/^chernev-\d+$/.test(x.id)) : []
if (!process.env.SECO && !solo) writeFileSync(RUTA, JSON.stringify([...previas, ...salida]))
console.log(partidas.length, 'partidas en el libro;', salida.length, 'reconstruidas;', fallas.length, 'descartadas')
for (const f of fallas) console.log('  falla:', f)
