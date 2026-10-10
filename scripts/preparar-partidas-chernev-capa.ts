/**
 * Chernev, «Capablanca's Best Chess Endings» (Dover, 1982): las 60 partidas completas, en algebraica larga
 * («Nb1-d2», «e6xd5»). La capa de texto del PDF es muy mala; se usa un OCR propio con RapidOCR a 300 dpi
 * (datos-privados/biblioteca/ocr_paginas.py) y chernev_capa_filas.py, que separa la línea principal por la posición:
 * número en el borde de la columna, jugada blanca ~100 px a la derecha y negra ~300 px
 * (→ datos-privados/biblioteca/textos/chernev_capa_filas.json).
 *
 * Cada media jugada leída se compara con las jugadas legales en algebraica larga mediante una distancia de edición que
 * abarata las confusiones típicas del OCR (9/g, 5/S, 1/l, 0/O/Q…; también la lectura girada 180°, «SP-Lp» = «d7-d5»),
 * y una búsqueda en haz elige la secuencia más barata. Con un costo alto puede suponer una media jugada que no se leyó
 * o que es ilegible, pero una partida solo entra si ninguna supuesta es ambigua (otra jugada legal en su lugar no deja
 * igual de válido el resto), si llega a la última jugada leída y si el libro da el resultado.
 *
 * Uso: node scripts/preparar-partidas-chernev-capa.ts [n] → agrega (o reemplaza, por prefijo) en public/datos/partidas-libros.json
 * SECO=1: no escribe; DETALLE=1: cada jugada con su lectura y costo; LEIDAS=1: las lecturas; FORZAR="uci…": fija el comienzo.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { candidatasLargas, corregirNumeros, limpiar, orden, reconstruir, supuestaAmbigua, type Leida } from './lib-reconstruir-ocr.ts'
import type { PartidaLibro } from '../src/lib/partidas-libros/partidas-libros.ts'

const TITULO = "Irving Chernev — Capablanca's Best Chess Endings (Dover, 1982)"
const PREFIJO = 'chernev-capa-'
interface Fila { tipo: 'pagina' | 'jugada' | 'texto'; pagina: number; nro?: string; blancas?: string | null; negras?: string | null; texto?: string }
const filas: Fila[] = JSON.parse(readFileSync('datos-privados/biblioteca/textos/chernev_capa_filas.json', 'utf8'))

// ---------- partidas ----------
interface Partida { n: number; incompleta?: boolean; blancas: string; negras: string; lugar: string; anio?: number; apertura?: string; leidas: Leida[]; resultado?: PartidaLibro['resultado'] }
const partidas: Partida[] = []
const ANIO = /1[89]\s?\d\s?\d/
for (let i = 0; i < filas.length; i++) {
  const f = filas[i]
  const textos = filas.slice(i + 1, i + 8).filter((x) => x.tipo === 'texto').map((x) => x.texto!)
  if (f.tipo === 'texto' && /^GAME\s*\S+$/.test(f.texto!) && /^White\b/.test(textos[0] ?? '')) {
    const lugarAnio: string[] = []
    let j = 2
    for (; j < 5 && j < textos.length; j++) { lugarAnio.push(textos[j]); if (ANIO.test(textos[j])) break }
    const la = lugarAnio.join(' ')
    partidas.push({
      n: partidas.length + 1,
      blancas: textos[0].replace(/^White\s+/, '').replace(/\s+Black$/, '').trim(),
      negras: (textos[1] ?? '').replace(/^Black\s+/, '').trim(),
      lugar: la.replace(/1[89]\s?\d\s?\d.*/, '').replace(/[,.\s]+$/, '').trim(),
      anio: Number((ANIO.exec(la)?.[0] ?? '').replace(/\s/g, '')) || undefined,
      apertura: textos[j + 1],
      leidas: [],
    })
    continue
  }
  const p = partidas[partidas.length - 1]
  if (!p) continue
  // Después del resultado no tendría que haber más jugadas de la línea principal: si las hay, el resultado salió de un
  // comentario y la partida quedó incompleta.
  if (p.resultado) {
    const ultima = p.leidas[p.leidas.length - 1]
    if (f.tipo === 'jugada' && f.nro !== '?' && ultima && Number(f.nro!.replace(/[Il]/g, '1')) > ultima.nro) p.incompleta = true
    continue
  }
  // Solo «White/Black Resigns», «Drawn» o «Draw agreed» al principio del renglón: «draw thus: ...» es prosa.
  if (f.tipo === 'texto' && /^(White|Black)\s+Resigns|^Drawn\b|^Draw agreed/.test(f.texto!)) {
    p.resultado = /^White/.test(f.texto!) ? '0-1' : /^Black/.test(f.texto!) ? '1-0' : '1/2-1/2'
    continue
  }
  // Última jugada pegada a su número y al resultado («54Rh3-e3 Black Resigns»).
  const pegada = f.tipo === 'texto' ? /^(\d{1,3})\s*(\.\s*\.\s*\.)?\s*([KQRBN]?[a-h][1-8][-x][a-h][1-8]\S*)\s+(White|Black)\s+Resigns/.exec(f.texto!) : null
  if (pegada) {
    p.leidas.push({ nro: Number(pegada[1]), negras: pegada[4] === 'White', texto: limpiar(pegada[3]) })
    p.resultado = pegada[4] === 'White' ? '0-1' : '1-0'
    continue
  }
  // «Kann resigned», «Lasker resigned»: pierde el que se nombra.
  const abandona = f.tipo === 'texto' ? /^([A-Z][a-z]+) resigned/.exec(f.texto!) : null
  if (abandona && (p.blancas.includes(abandona[1]) !== p.negras.includes(abandona[1]))) {
    p.resultado = p.blancas.includes(abandona[1]) ? '0-1' : '1-0'
    continue
  }
  if (f.tipo !== 'jugada') continue
  // Sin número leído: el que sigue al de la lectura anterior.
  const previa = p.leidas[p.leidas.length - 1]
  const nro = f.nro === '?' ? (previa ? previa.nro + 1 : 1) : Number(f.nro!.replace(/[Il]/g, '1'))
  for (const [t, negras] of [[f.blancas, false], [f.negras, true]] as const) {
    if (!t) continue
    const r = /(White|Black)\s+Resigns|Drawn/.exec(t)
    const jug = limpiar(r ? t.slice(0, r.index) : t)
    if (jug.length >= 2 && !/^[.…]+$/.test(jug)) p.leidas.push({ nro, negras, texto: jug })
    if (r) { p.resultado = r[1] === 'White' ? '0-1' : r[1] === 'Black' ? '1-0' : '1/2-1/2'; break }
  }
}

corregirNumeros(partidas.map((p) => p.leidas))

// ---------- nombres y lugares ----------
/** «Biack J. R, Capabfanca» → «J. R. Capablanca»: restos de «Black», variantes de OCR del apellido, puntos y comas. */
const nombre = (t: string) =>
  t.replace(/^[B8]\S{2,4}k\s+/, '').replace(/\s*\(Exhibition Game\)/, '').replace('(blindfold)', '(a ciegas)').replace(/\s+Bi?ack$/, '')
    .replace(/Capab\S*/g, 'Capablanca').replace(/^j\./, 'J.')
    .replace(/^([A-Z]),/, '$1.').replace(/([A-Z]),\s/g, '$1. ').replace(/\.(?=[A-Z])/g, '. ').replace(/\s+/g, ' ').trim()
// Encabezados partidos en varios renglones (partidas en consulta o simultáneas): a mano.
const ENCABEZADOS: Record<number, Partial<Pick<Partida, 'blancas' | 'negras' | 'lugar' | 'anio'>>> = {
  6: { negras: 'J. Corzo, R. Blanco y R. Portela', lugar: 'Havana', anio: 1910 },
  17: { blancas: 'J. R. Capablanca', negras: 'Salwe y aliados' },
  19: { blancas: 'H. Fähndrich y A. Kaufmann', negras: 'J. R. Capablanca y R. Réti' },
  22: { negras: 'R. T. Black' },
  31: { negras: 'T. Germann, D. Miller y W. Skillcorn', lugar: 'London', anio: 1920 },
  59: { blancas: 'A. Ilyin-Genevsky y I. L. Rabinovich', negras: 'J. R. Capablanca', lugar: 'Leningrad', anio: 1936 },
}
const CIUDADES: Record<string, string> = { Havana: 'La Habana', 'New York': 'Nueva York', 'San Sebastian': 'San Sebastián', Berlin: 'Berlín', 'St. Petersburg': 'San Petersburgo', 'St Petersburg': 'San Petersburgo', Moscow: 'Moscú', London: 'Londres', Vienna: 'Viena', Lodz: 'Łódź', Leningrad: 'Leningrado', Prague: 'Praga', 'Buenos Aires': 'Buenos Aires', Carlsbad: 'Karlsbad', Bertin: 'Berlín' }
/** «Ninth Match Game, Havana» → «La Habana»: la ciudad es lo último antes del año. */
const ciudad = (t: string) => { const c = t.split(',').pop()!.replace(/\(.*\)?/, '').trim(); return CIUDADES[c] ?? c }
const APERTURAS: [RegExp, string][] = [
  [/dutch/, 'Defensa Holandesa'], [/queensgambit/, 'Gambito de Dama Rehusado'], [/queenspawn/, 'Apertura del Peón Dama'],
  [/centercounter/, 'Defensa Escandinava'], [/threeknights/, 'Tres Caballos'], [/fourknights/, 'Cuatro Caballos'],
  [/irregular/, 'Apertura irregular'], [/sicilian/, 'Defensa Siciliana'], [/ruylopez/, 'Apertura Española'],
  [/giuoco/, 'Giuoco Piano'], [/petrof/, 'Defensa Petrov'], [/carokann/, 'Defensa Caro-Kann'], [/kingsindian/, 'Defensa India de Rey'],
  [/french/, 'Defensa Francesa'], [/queensindian/, 'Defensa India de Dama'], [/reti/, 'Apertura Réti'], [/vienna/, 'Apertura Vienesa'],
  [/english/, 'Apertura Inglesa'], [/nimzo/, 'Defensa Nimzoindia'], [/slav/, 'Defensa Eslava'], [/alekhine/, 'Defensa Alekhine'],
]
/** Nombre de la apertura en castellano; si no se reconoce, nada (mejor sin nombre que con uno mal leído). */
const apertura = (t?: string) => { const k = (t ?? '').toLowerCase().replace(/[^a-z]/g, ''); return APERTURAS.find(([re]) => re.test(k))?.[1] }
for (const p of partidas) {
  p.apertura = apertura(p.apertura)
  p.blancas = nombre(p.blancas)
  p.negras = nombre(p.negras)
  p.lugar = ciudad(p.lugar)
  const m = ENCABEZADOS[p.n]
  if (m) { Object.assign(p, m); if (m.lugar) p.lugar = ciudad(m.lugar) }
}

const solo = process.argv[2] ? Number(process.argv[2]) : undefined
const salida: PartidaLibro[] = []
const fallas: string[] = []
for (const p of partidas) {
  if (solo && p.n !== solo) continue
  const titulo = `partida ${p.n} (${p.blancas} - ${p.negras})`
  if (process.env.LEIDAS) console.log(p.leidas.map((l) => `${l.nro}${l.negras ? '...' : '.'}${l.texto}`).join(' '))
  const finales = reconstruir(p.leidas, candidatasLargas)
  const mejor = finales[0]
  if (!mejor) { fallas.push(`${titulo}: sin reconstrucción`); continue }
  const otra = finales.find((f) => f.ucis.join() !== mejor.ucis.join())
  const margen = otra ? otra.costo - mejor.costo : Infinity
  if (process.env.DETALLE) mejor.detalle.forEach((d, i) => console.log(`  ${Math.floor(i / 2) + 1}${i % 2 ? '...' : '.'} ${d}`))
  const promedio = mejor.costo / Math.max(1, mejor.ucis.length)
  const dudosa = supuestaAmbigua(mejor, candidatasLargas)
  const ultima = p.leidas[p.leidas.length - 1]
  const total = ultima ? orden(ultima.nro, ultima.negras) + 1 : 0
  const motivo = !p.resultado ? 'sin resultado en el texto'
    : p.incompleta ? 'hay jugadas después del resultado'
    : mejor.ucis.length < total ? `no llega al final (${mejor.ucis.length} medias jugadas de ${total})`
    : dudosa ? `jugada supuesta ambigua (media jugada ${dudosa})`
    : margen < 0.3 ? `ambigua (margen ${margen.toFixed(2)}; difiere en la media jugada ${otra!.ucis.findIndex((u, i) => u !== mejor.ucis[i]) + 1})`
    : promedio > 0.8 ? `costo medio alto (${promedio.toFixed(2)})`
    : ''
  console.log(`${p.n}: ${p.blancas} - ${p.negras}, ${mejor.ucis.length}/${total} medias jugadas, costo ${mejor.costo.toFixed(1)}, supuestas ${mejor.supuestas}, margen ${margen.toFixed(2)}, ${p.resultado ?? '?'} ${motivo}`)
  if (motivo) { fallas.push(`${titulo}: ${motivo}`); continue }
  salida.push({
    id: `${PREFIJO}${p.n}`,
    blancas: p.blancas,
    negras: p.negras,
    lugar: p.lugar || undefined,
    anio: p.anio,
    resultado: p.resultado,
    jugadas: mejor.ucis,
    fuente: { titulo: TITULO, capitulo: `final n.º ${p.n}${p.apertura ? ` (${p.apertura})` : ''}` },
  })
}
const RUTA = 'public/datos/partidas-libros.json'
const previas = existsSync(RUTA) ? (JSON.parse(readFileSync(RUTA, 'utf8')) as PartidaLibro[]).filter((x) => !x.id.startsWith(PREFIJO)) : []
if (!process.env.SECO && !solo) writeFileSync(RUTA, JSON.stringify([...previas, ...salida]))
console.log(partidas.length, 'encabezados;', salida.length, 'partidas;', fallas.length, 'descartadas')
for (const f of fallas) console.log('  falla:', f)
