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
import type { Chess } from 'chessops/chess'
import { makeSquare } from 'chessops/util'
import { FEN_INICIAL, posDesdeFen, uciEstandar } from '../src/lib/ajedrez/posicion.ts'
import type { PartidaLibro } from '../src/lib/partidas-libros/partidas-libros.ts'

const TITULO = "Irving Chernev — Capablanca's Best Chess Endings (Dover, 1982)"
const PREFIJO = 'chernev-capa-'
interface Fila { tipo: 'pagina' | 'jugada' | 'texto'; pagina: number; nro?: string; blancas?: string | null; negras?: string | null; texto?: string }
const filas: Fila[] = JSON.parse(readFileSync('datos-privados/biblioteca/textos/chernev_capa_filas.json', 'utf8'))

// ---------- distancia de edición con confusiones de OCR ----------
const PARES = ['9g', '5s', '5S', 'sS', '1l', '1I', '1i', 'lI', 'li', '1t', 'lt', 'ft', '0O', '0Q', 'OQ', '0o', 'Oo', '8B', '6b', '6G', 'ec', 'ac', 'ae', 'oa', '-+', '-%', '-&', '-~', '-.', 'x%', 'x*', 'x+', '2Z', '2z', 'Nh', 'NM', 'Mf', 'Rl', 'gq', 'g4', 'fH', 'f4', 'd4', 'QO', 'Q0', 'B6', '3B', 'hn', '-=', '7?']
const BARATO = new Set(PARES.flatMap(([a, b]) => [a + b, b + a]))
function costoSub(a: string, b: string): number {
  if (a === b) return 0
  if (a.toLowerCase() === b.toLowerCase()) return 0.25
  return BARATO.has(a + b) ? 0.35 : 1
}
function distancia(s: string, t: string): number {
  const n = s.length, m = t.length
  let prev = new Array<number>(m + 1)
  for (let j = 0; j <= m; j++) prev[j] = j
  for (let i = 1; i <= n; i++) {
    const cur = new Array<number>(m + 1)
    cur[0] = i
    for (let j = 1; j <= m; j++) {
      const del = s[i - 1] === '-' || s[i - 1] === '.' ? 0.5 : s[i - 1] === '+' || s[i - 1] === '#' ? 0.3 : 1 // sobra en el texto
      const ins = t[j - 1] === '-' ? 0.5 : 1 // falta en el texto
      cur[j] = Math.min(prev[j] + del, cur[j - 1] + ins, prev[j - 1] + costoSub(s[i - 1], t[j - 1]))
    }
    prev = cur
  }
  return prev[m]
}

// ---------- jugadas legales en algebraica larga ----------
const LETRA: Record<string, string> = { pawn: '', knight: 'N', bishop: 'B', rook: 'R', queen: 'Q', king: 'K' }
function candidatas(pos: Chess): { uci: string; texto: string; move: any }[] {
  const out: { uci: string; texto: string; move: any }[] = []
  for (const [desde, dests] of pos.allDests()) {
    const pieza = pos.board.get(desde)!
    for (const hacia of dests) {
      const move = { from: desde, to: hacia } as any
      const uci = uciEstandar(pos, move)
      if (pieza.role === 'king' && (uci === 'e1g1' || uci === 'e8g8')) { out.push({ uci, texto: '0-0', move: { from: desde, to: hacia } }); continue }
      if (pieza.role === 'king' && (uci === 'e1c1' || uci === 'e8c8')) { out.push({ uci, texto: '0-0-0', move: { from: desde, to: hacia } }); continue }
      if (pieza.role === 'king' && pos.board.get(hacia)?.color === pieza.color) continue // enroque en notación rey-torre, ya cubierto
      const captura = pos.board.get(hacia) !== undefined || (pieza.role === 'pawn' && desde % 8 !== hacia % 8)
      const base = `${LETRA[pieza.role]}${makeSquare(desde)}${captura ? 'x' : '-'}${makeSquare(hacia)}`
      if (pieza.role === 'pawn' && (hacia >> 3 === 7 || hacia >> 3 === 0)) {
        for (const [r, l] of [['queen', 'Q'], ['rook', 'R'], ['bishop', 'B'], ['knight', 'N']] as const) {
          out.push({ uci: uci + l.toLowerCase(), texto: `${base}(${l})`, move: { from: desde, to: hacia, promotion: r } })
        }
      } else out.push({ uci, texto: base, move })
    }
  }
  return out
}

// ---------- medias jugadas de la línea principal ----------
/** Una media jugada leída: número, color (por la columna en que está) y texto. */
interface Leida { nro: number; negras: boolean; texto: string }
/**
 * RapidOCR a veces lee una jugada dada vuelta 180° («SP-Lp» es «d7-d5», «9P-SP» es «d5-d6»): se invierte el orden
 * y cada carácter pasa a la figura que se ve girada.
 */
const GIRO: Record<string, string> = { S: '5', s: '5', 5: 'S', P: 'd', p: 'd', d: 'p', L: '7', 7: 'L', 9: '6', 6: '9', q: 'b', b: 'q', i: '!', E: '3', 3: 'E', t: 'f', f: 't', h: 'y', y: 'h', n: 'u', u: 'n', M: 'W', W: 'M', 4: 'h', Z: '2', 2: 'Z', a: 'e', e: 'a' }
const girada = (t: string) => [...t].reverse().map((c) => GIRO[c] ?? c).join('')
const limpiar = (t: string) => t.replace(/[!?]+/g, '').replace(/\s+/g, '').replace(/[+#]+$/, '')

// ---------- búsqueda en haz ----------
/** k: próxima media jugada leída. */
interface Estado { pos: Chess; ucis: string[]; k: number; costo: number; supuestas: number; detalle: string[] }
const SALTO = 1.2
const SUPUESTA = 4.5
const ETIQUETA = 3
const ANCHO = Number(process.env.ANCHO ?? 600)
const FORZAR = (process.env.FORZAR ?? '').split(' ').filter(Boolean)
const orden = (nro: number, negras: boolean) => (nro - 1) * 2 + (negras ? 1 : 0)
function reconstruir(leidas: Leida[]): Estado[] {
  let haz: Estado[] = [{ pos: posDesdeFen(FEN_INICIAL), ucis: [], k: 0, costo: 0, supuestas: 0, detalle: [] }]
  const finales: Estado[] = []
  for (let ply = 0; ply < 400 && haz.length; ply++) {
    const nuevos = new Map<string, Estado>()
    const agregar = (e: Estado) => {
      if (FORZAR.length && e.ucis.some((u, i) => i < FORZAR.length && u !== FORZAR[i])) return
      const clave = `${e.k}|${e.ucis.join(' ')}`
      const v = nuevos.get(clave)
      if (!v || v.costo > e.costo) nuevos.set(clave, e)
    }
    for (const e of haz) {
      if (e.k >= leidas.length) { finales.push(e); continue }
      const cands = candidatas(e.pos)
      if (!cands.length) { finales.push({ ...e, costo: e.costo + SALTO * (leidas.length - e.k) }); continue }
      // Lecturas que quedaron atrás (repetidas, o variantes con formato de línea principal): se saltean.
      let k = e.k
      let salto = 0
      while (k < leidas.length && orden(leidas[k].nro, leidas[k].negras) < ply) { k++; salto += SALTO / 2 }
      if (k >= leidas.length) { finales.push({ ...e, k, costo: e.costo + salto }); continue }
      for (let j = k; j < Math.min(leidas.length, k + 3); j++) {
        const l = leidas[j]
        const etiqueta = orden(l.nro, l.negras) === ply ? 0 : ETIQUETA
        const giro = girada(l.texto)
        const ls = cands.map((c) => ({ c, d: Math.min(distancia(l.texto, c.texto), distancia(giro, c.texto) + 0.3) }))
        const minimo = Math.min(...ls.map((x) => x.d))
        // Ilegible (p. ej. leída al revés, «SP-Lp»): ninguna jugada se le parece; vale como supuesta en su lugar.
        if (j === k && !etiqueta && e.supuestas < 4 && ls.every(({ c, d }) => d > Math.max(1.5, c.texto.length * 0.45))) {
          for (const c of cands) {
            const pos = e.pos.clone()
            pos.play(c.move)
            agregar({ pos, ucis: [...e.ucis, c.uci], k: j + 1, costo: e.costo + salto + SUPUESTA, supuestas: e.supuestas + 1, detalle: [...e.detalle, `${c.texto}←(ilegible «${l.texto}») ${SUPUESTA}`] })
          }
        }
        for (const { c, d } of ls) {
          if (d > Math.max(1.5, c.texto.length * 0.45) || d > minimo + 1) continue
          const pos = e.pos.clone()
          pos.play(c.move)
          const extra = salto + etiqueta + d
          agregar({ pos, ucis: [...e.ucis, c.uci], k: j + 1, costo: e.costo + extra, supuestas: e.supuestas, detalle: [...e.detalle, `${c.texto}←«${l.texto}» ${extra.toFixed(2)}`] })
        }
        salto += SALTO
      }
      // Suponer una media jugada que no se leyó, solo si la próxima lectura viene numerada más adelante.
      if (e.supuestas < 4 && orden(leidas[k].nro, leidas[k].negras) > ply) {
        for (const c of cands) {
          const pos = e.pos.clone()
          pos.play(c.move)
          agregar({ pos, ucis: [...e.ucis, c.uci], k, costo: e.costo + SUPUESTA, supuestas: e.supuestas + 1, detalle: [...e.detalle, `${c.texto}←(supuesta) ${SUPUESTA}`] })
        }
      }
    }
    const ordenados = [...nuevos.values()].sort((a, b) => a.costo - b.costo)
    haz = ordenados.filter((h) => h.costo <= ordenados[0].costo + 15).slice(0, ANCHO)
  }
  return finales.sort((a, b) => a.costo - b.costo)
}

/**
 * Una media jugada supuesta (o ilegible) es ambigua si otra jugada legal en su lugar deja todas las siguientes
 * legales y con el mismo texto en algebraica larga: el libro no permite saber cuál fue. Devuelve su número, o 0.
 */
function supuestaAmbigua(e: Estado): number {
  for (let s = 0; s < e.ucis.length; s++) {
    if (!/\((supuesta|ilegible)/.test(e.detalle[s])) continue
    let pos = posDesdeFen(FEN_INICIAL)
    const textos: string[] = []
    for (let i = 0; i < e.ucis.length; i++) {
      const cs = candidatas(pos)
      const c = cs.find((x) => x.uci === e.ucis[i])!
      textos.push(c.texto)
      if (i === s) {
        for (const alt of cs) {
          if (alt.uci === c.uci) continue
          const q = pos.clone()
          q.play(alt.move)
          let ok = true
          for (let j = i + 1; j < e.ucis.length && ok; j++) {
            const d = candidatas(q).find((x) => x.uci === e.ucis[j])
            // la jugada siguiente tiene que existir con el mismo texto (o ser también supuesta)
            if (!d || (!/\((supuesta|ilegible)/.test(e.detalle[j]) && d.texto !== textosDe(e, j))) ok = false
            else q.play(d.move)
          }
          if (ok) return s + 1
        }
      }
      pos.play(c.move)
    }
  }
  return 0
}
const cacheTextos = new WeakMap<Estado, string[]>()
function textosDe(e: Estado, j: number): string {
  let t = cacheTextos.get(e)
  if (!t) {
    t = []
    const pos = posDesdeFen(FEN_INICIAL)
    for (const u of e.ucis) { const c = candidatas(pos).find((x) => x.uci === u)!; t.push(c.texto); pos.play(c.move) }
    cacheTextos.set(e, t)
  }
  return t[j]
}

// ---------- partidas ----------
interface Partida { n: number; blancas: string; negras: string; lugar: string; anio?: number; apertura?: string; leidas: Leida[]; resultado?: PartidaLibro['resultado'] }
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
  if (!p || p.resultado) continue
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

// Números de jugada mal leídos («69» por «59», «71» por «11»): una lectura que se sale de la secuencia de sus
// vecinas toma el número que le corresponde entre ellas.
/** La primera media jugada del color pedido después de la media jugada a. */
const siguiente = (a: number, negras: boolean) => (((a + 1) % 2 === 1) === negras ? a + 1 : a + 2)
for (const p of partidas) {
  const L = p.leidas
  for (let i = 1; i < L.length; i++) {
    const a = orden(L[i - 1].nro, L[i - 1].negras), b = orden(L[i].nro, L[i].negras)
    const c = i + 1 < L.length ? orden(L[i + 1].nro, L[i + 1].negras) : undefined
    if (Math.abs(b - a) <= 3) continue
    if (c !== undefined && !(c - a >= 1 && c - a <= 3)) continue
    const e = siguiente(a, L[i].negras)
    if (c === undefined || e < c) L[i].nro = Math.floor(e / 2) + 1
  }
}

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
  const finales = reconstruir(p.leidas)
  const mejor = finales[0]
  if (!mejor) { fallas.push(`${titulo}: sin reconstrucción`); continue }
  const otra = finales.find((f) => f.ucis.join() !== mejor.ucis.join())
  const margen = otra ? otra.costo - mejor.costo : Infinity
  if (process.env.DETALLE) mejor.detalle.forEach((d, i) => console.log(`  ${Math.floor(i / 2) + 1}${i % 2 ? '...' : '.'} ${d}`))
  const promedio = mejor.costo / Math.max(1, mejor.ucis.length)
  const dudosa = supuestaAmbigua(mejor)
  const ultima = p.leidas[p.leidas.length - 1]
  const total = ultima ? orden(ultima.nro, ultima.negras) + 1 : 0
  const motivo = !p.resultado ? 'sin resultado en el texto'
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
