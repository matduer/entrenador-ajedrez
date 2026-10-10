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
import { candidatasCortas, corregirNumeros, distancia, limpiar, orden, reconstruir, supuestaAmbigua, type Leida } from './lib-reconstruir-ocr.ts'

const TITULO = 'David Bronstein — El ajedrez de torneo (Zurich 1953) (Club de Ajedrez, CDA 19, 6.ª ed.)'
const PREFIJO = 'zurich1953-'
interface Fila { tipo: 'jugada' | 'texto'; pagina: number; nro?: string; blancas?: string | null; negras?: string | null; texto?: string; partes?: string[] }
const filas: Fila[] = JSON.parse(readFileSync('datos-privados/biblioteca/textos/zurich_filas.json', 'utf8'))

interface Partida { n: number; fila: number; incompleta?: boolean; blancas: string; negras: string; apertura?: string; leidas: Leida[]; resultado?: PartidaLibro['resultado'] }
const partidas: Partida[] = []
/** Encabezado «Partida nº 6» (el OCR escribe «n°6», «n�6», «no 6»). */
const ENCABEZADO = /^Parti\S*\s*n\S{0,2}\s*([0-9TB]{1,3}|\d \d{1,2})(?!\d)/
/** El número del encabezado («T2» = 72, «B2» = 82, «1 03» = 103). */
const numeroEncabezado = (t: string) => Number(t.replace(/T/g, '7').replace(/B/g, '8').replace(/\s/g, ''))
/** El nombre de un jugador como lo trae el libro («M.Euwe» → «M. Euwe»; el OCR lee «1.» por «I.»). */
const nombre = (t: string) => t.replace(/^1\./, 'I.').replace(/\.(?=\S)/g, '. ').replace(/\s+/g, ' ').trim()
const ES_NOMBRE = /^[A-Z1]\.?\s?[A-Z][a-zé]/
/** Los quince jugadores del torneo, con la grafía del libro. */
const JUGADORES = ['Y. Averbaj', 'I. Boleslavsky', 'D. Bronstein', 'M. Euwe', 'Y. Geller', 'S. Gligoric', 'P. Keres', 'A. Kotov', 'M. Najdorf', 'T. Petrosian', 'S. Reshevsky', 'V. Smyslov', 'G. Stahlberg', 'L. Szabo', 'M. Taimanov']
/** El jugador cuyo apellido más se parece al leído («S. Gligorlc» → «S. Gligoric»); si ninguno se parece, «?». */
function canonico(t: string): string {
  const ap = nombre(t).replace(/^\S+\s/, '').toLowerCase()
  let mejor = '?', min = Infinity
  for (const j of JUGADORES) { const d = distancia(ap, j.replace(/^\S+\s/, '').toLowerCase()); if (d < min) { min = d; mejor = j } }
  return min <= 2 ? mejor : '?'
}
/** Las aperturas del libro, con nombre en castellano («Ruy López» es la Española). */
const APERTURAS = ['Apertura Catalana', 'Apertura Inglesa', 'Apertura Réti', 'Apertura Española', 'Defensa Caro-Kann', 'Defensa Grünfeld', 'Defensa Holandesa', 'Defensa India de Dama', 'Defensa India de Rey', 'Defensa Nimzoindia', 'Defensa Siciliana', 'Defensa Francesa', 'Gambito de Dama', 'Gambito de Dama Aceptado', 'Gambito de Dama Rehusado']
const llave = (t: string) => t.normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase().replace('ruylopez', 'espanola')
/** «DefensaNimzoindia», «Defensa Grinfeld» → el nombre canónico más parecido; si ninguno se parece, nada. */
function apertura(t?: string): string | undefined {
  if (!t) return undefined
  const k = llave(t.replace(/\(\*\)/, ''))
  let mejor: string | undefined, min = Infinity
  for (const a of APERTURAS) { const d = distancia(k, llave(a)); if (d < min) { min = d; mejor = a } }
  return min <= Math.max(2, k.length * 0.15) ? mejor : undefined
}
const NOMBRES: Record<number, (string[] | null)[]> = existsSync('datos-privados/biblioteca/textos/zurich_nombres.json') ? JSON.parse(readFileSync('datos-privados/biblioteca/textos/zurich_nombres.json', 'utf8')) : {}
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
    let jug: Fila | undefined, aperturaLeida: string | undefined
    for (let j = i + 1; j < Math.min(filas.length, i + 60) && filas[j].tipo === 'texto'; j++) {
      const x = filas[j]
      if (x.partes!.length >= 1 && ES_NOMBRE.test(x.partes![0]) && (x.partes!.length === 2 ? ES_NOMBRE.test(x.partes![1]) : false)) {
        jug = x
        const prev = filas[j - 1]
        if (j - 1 > i && prev.tipo === 'texto' && prev.partes!.length === 1 && prev.texto!.length < 40 && /^[A-Z]/.test(prev.texto!)) aperturaLeida = prev.texto
        else if (filas[i + 1]?.tipo === 'texto' && filas[i + 1].texto!.length < 40) aperturaLeida = filas[i + 1].partes![0]
        break
      }
    }
    // El número se controla con la secuencia: si el leído no es el siguiente (ni salta uno o dos encabezados perdidos), vale el siguiente.
    const previo = partidas[partidas.length - 1]?.n ?? 0
    const leido = numeroEncabezado(m[1])
    const n = leido > previo && leido <= previo + 3 ? leido : previo + 1
    // Jugadores: los del OCR, comparados con los de la capa de texto del PDF (zurich_nombres.py) para la misma página
    // y el mismo orden de encabezado. Si falta uno, vale la capa de texto; si no coinciden, la partida no entra.
    const enPagina = filas.slice(0, i).filter((x) => x.pagina === f.pagina && x.tipo === 'texto' && ENCABEZADO.test(x.texto!)).length
    const capa = NOMBRES[f.pagina]?.[enPagina]?.map(canonico)
    const ocr = jug ? [canonico(jug.partes![0]), canonico(jug.partes![1])] : undefined
    let [blancas, negras] = ocr ?? capa ?? ['?', '?']
    if (ocr && capa && (ocr[0] !== capa[0] || ocr[1] !== capa[1])) blancas = negras = '?'
    partidas.push({ n, fila: i, apertura: apertura(aperturaLeida), blancas: blancas ?? '?', negras: negras ?? '?', leidas: [] })
    continue
  }
  const p = partidas[partidas.length - 1]
  if (!p) continue
  // Después del resultado no tendría que haber más jugadas de la línea principal: si las hay, el resultado se tomó de
  // un comentario y la partida queda incompleta.
  if (p.resultado) {
    const ultima = p.leidas[p.leidas.length - 1]
    if (f.tipo === 'jugada' && ultima && Number(f.nro!.replace(/[Il]/g, '1')) > ultima.nro) p.incompleta = true
    continue
  }
  if (f.tipo === 'texto') {
    // Con el renglón anterior pegado: «Ambos oponentes acordaron / las tablas» va en dos renglones.
    const t = f.texto!
    const conPrevio = `${filas[i - 1]?.tipo === 'texto' ? filas[i - 1].texto : ''} ${t}`
    // «Blancas rinden.», «Las blancas abandonan.», «Tablas.», «acordaron las tablas».
    const r = /[Bb]lancas (rinden|abandonan)/.test(t) ? '0-1' : /[Nn]egras (rinden|abandonan)/.test(t) ? '1-0'
      : /(^|\.\s*)Tablas\b/.test(t) || /acordaron (las )?tablas/.test(conPrevio) ? '1/2-1/2' : undefined
    if (r) { p.leidas.push(...jugadasAntesDelResultado(t)); p.resultado = r }
    continue
  }
  const nro = Number(f.nro!.replace(/[Il]/g, '1'))
  let { blancas, negras } = f
  const pegadas = blancas && !negras ? PEGADAS.exec(blancas.replace(/\s+/g, '')) : null
  if (pegadas) { blancas = pegadas[1]; negras = pegadas[2] }
  for (const [t, deNegras] of [[blancas, false], [negras, true]] as const) {
    if (!t) continue
    // «41. Cb6 Tablas.», «41 Ae1 tablas.», «34 Td5 Negras [rinden]» (el «rinden» suele quedar en el renglón de abajo, a
    // veces leído al revés): el resultado en la columna de la jugada negra, o pegado a la jugada.
    const fin = /\s*([Tt]ablas|(Blancas|Negras)( rinden| abandonan)?)\.?$/.exec(t)
    if (fin && (deNegras || fin.index > 0)) {
      p.resultado = /ablas/.test(fin[1]) ? '1/2-1/2' : fin[2] === 'Blancas' ? '0-1' : '1-0'
      const antes = limpiar(t.slice(0, fin.index))
      if (antes.length >= 2) p.leidas.push({ nro, negras: deNegras, texto: antes, fila: i })
      break
    }
    const jug = limpiar(t.replace(/\(.*$/, ''))
    if (jug.length >= 2 && !/^[.…]+$/.test(jug)) p.leidas.push({ nro, negras: deNegras, texto: jug, fila: i })
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

// Segunda lectura a 400 dpi de los renglones de las partidas que fallaron (zurich_relectura.py): se suma como alternativa.
const RELECTURA = 'datos-privados/biblioteca/textos/zurich_relectura.json'
const relectura: Record<string, { blancas: string | null; negras: string | null }> = existsSync(RELECTURA) ? JSON.parse(readFileSync(RELECTURA, 'utf8')) : {}
for (const p of partidas) {
  for (const l of p.leidas) {
    const r = l.fila !== undefined ? relectura[l.fila] : undefined
    const t = r && (l.negras ? r.negras : r.blancas?.replace(/^[0-9Il]{1,3}\s*[.,]?\s*/, ''))
    if (t) { const a = limpiar(t.replace(/\(.*$/, '')); if (a.length >= 2 && a !== l.texto) l.alternativas = [a] }
  }
}

const solo = process.argv[2] ? Number(process.argv[2]) : undefined
const salida: PartidaLibro[] = []
const fallas: string[] = []
const vistas = new Set<number>()
const EXCLUIDAS = new Set([26, 144])
for (const p of partidas) {
  if (solo && p.n !== solo) continue
  // El resultado no cuadra con la posición final según verificar-partidas-libros.ts (tablas con una ventaja decisiva):
  // la línea leída está incompleta o tiene un error.
  if (EXCLUIDAS.has(p.n)) { fallas.push(`partida ${p.n}: excluida (el resultado no cuadra con la posición final)`); continue }
  if (vistas.has(p.n)) { fallas.push(`partida ${p.n}: encabezado repetido`); continue }
  vistas.add(p.n)
  const titulo = `partida ${p.n} (${p.blancas} - ${p.negras})`
  if (process.env.LEIDAS) console.log(p.leidas.map((l) => `${l.nro}${l.negras ? '...' : '.'}${l.texto}`).join(' '))
  const finales = reconstruir(p.leidas, candidatasCortas, true)
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
    : p.incompleta ? 'hay jugadas después del resultado'
    : mejor.ucis.length < 10 ? 'demasiado corta (faltan jugadas)'
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
// RELEER=1: anota los renglones de jugada de las partidas descartadas, para pasarlos por zurich_relectura.py.
if (process.env.RELEER) {
  const fallidas = new Set(fallas.map((f) => Number(/partida (\d+)/.exec(f)?.[1])))
  const indices: number[] = []
  partidas.forEach((p, k) => {
    if (!fallidas.has(p.n)) return
    const hasta = partidas[k + 1]?.fila ?? filas.length
    for (let i = p.fila; i < hasta; i++) if (filas[i].tipo === 'jugada' && !(i in relectura)) indices.push(i)
  })
  writeFileSync('datos-privados/biblioteca/img/zurich_indices.json', JSON.stringify(indices))
  console.log(indices.length, 'renglones para releer')
}
const RUTA = 'public/datos/partidas-libros.json'
const previas = existsSync(RUTA) ? (JSON.parse(readFileSync(RUTA, 'utf8')) as PartidaLibro[]).filter((x) => !x.id.startsWith(PREFIJO)) : []
if (!process.env.SECO && !solo) writeFileSync(RUTA, JSON.stringify([...previas, ...salida]))
console.log(partidas.length, 'encabezados;', salida.length, 'partidas;', fallas.length, 'descartadas')
for (const f of fallas) console.log('  falla:', f)
