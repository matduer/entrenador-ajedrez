/**
 * Las 210 partidas del Torneo de Candidatos de Neuhausen-Zúrich 1953, de David Bronstein, «El ajedrez de torneo
 * (Zurich 1953)» (Club de Ajedrez, CDA 19, 6.ª ed.). La capa de texto del PDF confunde dígitos y figuras; se usa un OCR
 * propio con RapidOCR a 200 dpi (datos-privados/biblioteca/ocr_paginas.py) y zurich_filas.py, que separa la línea
 * principal por la sangría: «27. Cc4» y, a la derecha, la jugada negra (→ datos-privados/biblioteca/textos/zurich_filas.json).
 * Las jugadas se reconstruyen con lib-reconstruir-ocr.ts (algebraica corta española). Una partida entra solo si llega a
 * la última jugada leída, si el libro da el resultado y si ninguna jugada supuesta es ambigua.
 *
 * Uso: node scripts/preparar-partidas-zurich.ts [n] → agrega (o reemplaza, por prefijo) en public/datos/partidas-libros.json
 * SECO=1: no escribe; DETALLE=1: cada jugada con su lectura y costo; LEIDAS=1: las lecturas.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { PartidaLibro } from '../src/lib/partidas-libros/partidas-libros.ts'
import { candidatasCortas, corregirNumeros, limpiar, orden, reconstruir, supuestaAmbigua, type Leida } from './lib-reconstruir-ocr.ts'

const TITULO = 'David Bronstein — El ajedrez de torneo (Zurich 1953) (Club de Ajedrez, CDA 19, 6.ª ed.)'
const PREFIJO = 'zurich1953-'
interface Fila { tipo: 'jugada' | 'texto'; pagina: number; nro?: string; blancas?: string | null; negras?: string | null; texto?: string; partes?: string[] }
const filas: Fila[] = JSON.parse(readFileSync('datos-privados/biblioteca/textos/zurich_filas.json', 'utf8'))

interface Partida { n: number; fila: number; blancas: string; negras: string; apertura?: string; leidas: Leida[]; resultado?: PartidaLibro['resultado'] }
const partidas: Partida[] = []
/** Encabezado «Partida nº 6» (el OCR escribe «n°6», «n�6», «no 6»). */
const ENCABEZADO = /^Parti\S*\s*n\S{0,2}\s*([0-9TB]{1,3}|\d \d{1,2})(?!\d)/
/** El número del encabezado («T2» = 72, «B2» = 82, «1 03» = 103). */
const numeroEncabezado = (t: string) => Number(t.replace(/T/g, '7').replace(/B/g, '8').replace(/\s/g, ''))
/** El nombre de un jugador como lo trae el libro («M.Euwe» → «M. Euwe»; el OCR lee «1.» por «I.»). */
const nombre = (t: string) => t.replace(/^1\./, 'I.').replace(/\.(?=\S)/g, '. ').replace(/\s+/g, ' ').trim()
const ES_NOMBRE = /^[A-Z1]\.?\s?[A-Z][a-zé]/
/** Una jugada suelta en castellano: «Ta8+», «Re7», «exd5», «0-0». */
const JUGADA = /^([RDTAC]?[a-h]?[1-8]?x?[a-h][1-8](=?[DTAC])?|0-0(-0)?)[+#]?[!?]*$/
/**
 * «41. Ta8+ Re7. Blancas rinden.»: las últimas jugadas a veces van en el mismo renglón que el resultado. Si todo lo
 * que precede al resultado son jugadas numeradas, se agregan como lecturas.
 */
function jugadasAntesDelResultado(t: string): Leida[] {
  const previo = t.split(/(Blancas|Negras) rinden|Tablas/)[0].trim().replace(/\.$/, '')
  if (!/^\d+\./.test(previo)) return []
  const out: Leida[] = []
  let nro = 0, negras = false
  for (const tok of previo.split(/\s+/)) {
    const m = /^(\d+)\.(\.\.)?$/.exec(tok)
    if (m) { nro = Number(m[1]); negras = !!m[2]; continue }
    if (tok === '...') { negras = true; continue }
    const j = tok.replace(/[.,;]$/, '')
    if (!JUGADA.test(j)) return []
    out.push({ nro, negras, texto: limpiar(j) })
    negras = !negras
  }
  return out
}
// Dos jugadas pegadas en la caja blanca («Tfc1Ad7»): se parten donde empieza la segunda.
const PEGADAS = /^(.*?[a-h][1-8][+#]?)((?:[RDTAC][a-h]?[1-8]?x?|[a-h]x)[a-h][1-8].*|0-0.*)$/
for (let i = 0; i < filas.length; i++) {
  const f = filas[i]
  const m = f.tipo === 'texto' ? ENCABEZADO.exec(f.texto!) : null
  if (m) {
    // Jugadores: el primer renglón de dos cajas con forma de nombre antes de la primera jugada (entre el título y
    // ellos puede haber un párrafo de introducción). Apertura: el renglón corto que los precede, si no es prosa.
    let jug: Fila | undefined, apertura: string | undefined
    for (let j = i + 1; j < Math.min(filas.length, i + 60) && filas[j].tipo === 'texto'; j++) {
      const x = filas[j]
      if (x.partes!.length >= 1 && ES_NOMBRE.test(x.partes![0]) && (x.partes!.length === 2 ? ES_NOMBRE.test(x.partes![1]) : false)) {
        jug = x
        const prev = filas[j - 1]
        if (j - 1 > i && prev.tipo === 'texto' && prev.partes!.length === 1 && prev.texto!.length < 40 && /^[A-Z]/.test(prev.texto!)) apertura = prev.texto
        else if (filas[i + 1]?.tipo === 'texto' && filas[i + 1].texto!.length < 40) apertura = filas[i + 1].partes![0]
        break
      }
    }
    // El número se controla con la secuencia: si el leído no es el siguiente (ni salta uno o dos encabezados perdidos), vale el siguiente.
    const previo = partidas[partidas.length - 1]?.n ?? 0
    const leido = numeroEncabezado(m[1])
    const n = leido > previo && leido <= previo + 3 ? leido : previo + 1
    partidas.push({ n, fila: i, apertura, blancas: jug ? nombre(jug.partes![0]) : '?', negras: jug ? nombre(jug.partes![1]) : '?', leidas: [] })
    continue
  }
  const p = partidas[partidas.length - 1]
  if (!p || p.resultado) continue
  if (f.tipo === 'texto') {
    const t = f.texto!
    const r = /Blancas rinden/.test(t) ? '0-1' : /Negras rinden/.test(t) ? '1-0' : /(^|\.\s*)Tablas\b|acordaron tablas/.test(t) ? '1/2-1/2' : undefined
    if (r) { p.leidas.push(...jugadasAntesDelResultado(t)); p.resultado = r }
    continue
  }
  const nro = Number(f.nro!.replace(/[Il]/g, '1'))
  let { blancas, negras } = f
  const pegadas = blancas && !negras ? PEGADAS.exec(blancas.replace(/\s+/g, '')) : null
  if (pegadas) { blancas = pegadas[1]; negras = pegadas[2] }
  for (const [t, deNegras] of [[blancas, false], [negras, true]] as const) {
    if (!t) continue
    // «41. Cb6 Tablas.»: el resultado en la columna de la jugada negra
    if (/^Tablas/.test(t)) { p.resultado = '1/2-1/2'; break }
    if (/rinden/.test(t)) { p.resultado = /Blancas/.test(t) ? '0-1' : '1-0'; break }
    const jug = limpiar(t.replace(/\(.*$/, ''))
    if (jug.length >= 2 && !/^[.…]+$/.test(jug)) p.leidas.push({ nro, negras: deNegras, texto: jug })
  }
}
// «...por lo que Reshevsky prefirió ofrecer tablas.»: sin fórmula de resultado, el último párrafo de la partida dice
// que se ofrecieron tablas (y no hay más jugadas).
for (let k = 0; k < partidas.length; k++) {
  const p = partidas[k]
  if (p.resultado) continue
  const i = partidas[k + 1]?.fila ?? -1
  const cola = filas.slice(Math.max(0, i - 4), i < 0 ? filas.length : i).filter((f) => f.tipo === 'texto').map((f) => f.texto).join(' ')
  if (/ofrec\S* tablas\.?\s*(\d+\s*)?$/.test(cola.trim())) p.resultado = '1/2-1/2'
}
corregirNumeros(partidas.map((p) => p.leidas))

const solo = process.argv[2] ? Number(process.argv[2]) : undefined
const salida: PartidaLibro[] = []
const fallas: string[] = []
const vistas = new Set<number>()
for (const p of partidas) {
  if (solo && p.n !== solo) continue
  if (vistas.has(p.n)) { fallas.push(`partida ${p.n}: encabezado repetido`); continue }
  vistas.add(p.n)
  const titulo = `partida ${p.n} (${p.blancas} - ${p.negras})`
  if (process.env.LEIDAS) console.log(p.leidas.map((l) => `${l.nro}${l.negras ? '...' : '.'}${l.texto}`).join(' '))
  const finales = reconstruir(p.leidas, candidatasCortas)
  const mejor = finales[0]
  if (!mejor) { fallas.push(`${titulo}: sin reconstrucción`); continue }
  const otra = finales.find((f) => f.ucis.join() !== mejor.ucis.join())
  const margen = otra ? otra.costo - mejor.costo : Infinity
  if (process.env.DETALLE) mejor.detalle.forEach((d, i) => console.log(`  ${Math.floor(i / 2) + 1}${i % 2 ? '...' : '.'} ${d}`))
  const promedio = mejor.costo / Math.max(1, mejor.ucis.length)
  const dudosa = supuestaAmbigua(mejor, candidatasCortas)
  const ultima = p.leidas[p.leidas.length - 1]
  const total = ultima ? orden(ultima.nro, ultima.negras) + 1 : 0
  const motivo = p.blancas === '?' ? 'sin jugadores'
    : !p.resultado ? 'sin resultado en el texto'
    : mejor.ucis.length < total ? `no llega al final (${mejor.ucis.length} medias jugadas de ${total})`
    : dudosa ? `jugada supuesta ambigua (media jugada ${dudosa})`
    : margen < 0.3 ? `ambigua (margen ${margen.toFixed(2)}; media jugada ${otra!.ucis.findIndex((u, i) => u !== mejor.ucis[i]) + 1}: ${mejor.ucis.find((u, i) => u !== otra!.ucis[i])} o ${otra!.ucis.find((u, i) => u !== mejor.ucis[i])})`
    : promedio > 0.8 ? `costo medio alto (${promedio.toFixed(2)})`
    : ''
  console.log(`${p.n}: ${p.blancas} - ${p.negras}, ${mejor.ucis.length}/${total} medias jugadas, costo ${mejor.costo.toFixed(1)}, supuestas ${mejor.supuestas}, margen ${margen.toFixed(2)}, ${p.resultado ?? '?'} ${motivo}`)
  if (motivo) { fallas.push(`${titulo}: ${motivo}`); continue }
  salida.push({
    id: `${PREFIJO}${p.n}`,
    blancas: p.blancas,
    negras: p.negras,
    lugar: 'Neuhausen-Zúrich',
    anio: 1953,
    resultado: p.resultado,
    jugadas: mejor.ucis,
    fuente: { titulo: TITULO, capitulo: `partida n.º ${p.n}${p.apertura ? ` (${p.apertura})` : ''}` },
  })
}
const RUTA = 'public/datos/partidas-libros.json'
const previas = existsSync(RUTA) ? (JSON.parse(readFileSync(RUTA, 'utf8')) as PartidaLibro[]).filter((x) => !x.id.startsWith(PREFIJO)) : []
if (!process.env.SECO && !solo) writeFileSync(RUTA, JSON.stringify([...previas, ...salida]))
console.log(partidas.length, 'encabezados;', salida.length, 'partidas;', fallas.length, 'descartadas')
for (const f of fallas) console.log('  falla:', f)
