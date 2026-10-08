/**
 * Las partidas de Colin Crouch, «Modern Chess: Move by Move» (Everyman, 2009), desde el texto del PDF
 * (datos-privados/biblioteca/textos/crouch_modern.txt, OCR con las figuras ilegibles).
 * Línea principal: renglones que son solo jugadas y que siguen exactamente la numeración esperada ("12 lLlf3",
 * "12 ... dxC4"); los comentarios con variantes tienen palabras y quedan afuera. Cada jugada se reconstruye con
 * lib-ocr-jugadas.ts y se acepta solo si es la única legal compatible; si una falla, la partida se descarta.
 *
 * Uso: node scripts/preparar-partidas-crouch.ts → agrega (o reemplaza, por prefijo) en public/datos/partidas-libros.json
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { FEN_INICIAL, posDesdeFen } from '../src/lib/ajedrez/posicion.ts'
import type { PartidaLibro } from '../src/lib/partidas-libros/partidas-libros.ts'
import { leer, reconstruir } from './lib-ocr-jugadas.ts'

const TITULO = 'Colin Crouch — Modern Chess: Move by Move (Everyman, 2009)'
const texto = readFileSync('datos-privados/biblioteca/textos/crouch_modern.txt', 'utf8')
const renglones = texto.split('\n').map((l) => l.trim())

// Encabezados: "Game 12" (el OCR escribe "Gamel", "Game 1 7") seguido de "Blancas-Negras" y "Lugar Año".
const partidas: { n: number; jugadores: string; evento: string; desde: number }[] = []
for (let i = 0; i < renglones.length - 2; i++) {
  const m = /^Game\s*([0-9l ]{1,4})$/.exec(renglones[i])
  if (!m || !/-/.test(renglones[i + 1]) || !/\d{4}/.test(renglones[i + 2])) continue
  const n = Number(m[1].replace(/l/g, '1').replace(/\s/g, ''))
  if (n >= 1 && n <= 40 && !partidas.some((p) => p.n === n)) partidas.push({ n, jugadores: renglones[i + 1], evento: renglones[i + 2], desde: i + 3 })
}
partidas.sort((a, b) => a.desde - b.desde)

const numero = (t: string) => (/^[0-9lI]{1,3}$/.test(t) ? Number(t.replace(/[lI]/g, '1')) : NaN)
const esJugada = (t: string) => leer(t) !== undefined

const salida: PartidaLibro[] = []
const fallas: string[] = []
for (let k = 0; k < partidas.length; k++) {
  const p = partidas[k]
  const hasta = k + 1 < partidas.length ? partidas[k + 1].desde - 3 : renglones.length
  // Tramos de línea principal: empiezan en un renglón cuyo primer número es el esperado y siguen mientras los
  // renglones sean solo números, "..." y jugadas. Dentro del tramo la numeración tiene que cerrar exacta.
  const tokens: string[] = []
  let esperado = 1
  let negras = false
  let resultado: PartidaLibro['resultado']
  // "..." separado de la jugada; ojo: el alfil a veces sale como "..t" o ".i", que no hay que partir.
  const partir = (r: string) =>
    r
      .replace(/[•·]/g, '.')
      .replace(/\.\s\.\s\./g, '...')
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((t) => (/^\.{3}[^.]/.test(t) && !/^\.{3}[ti]/.test(t) ? ['...', t.slice(3)] : /^\.{3,}$/.test(t) ? ['...'] : [t]))
      // número pegado a la jugada ("6i..d3"), pero no "0-0" ni "1-0"
      .flatMap((t) => {
        const m = /^(\d{1,3})([^\d\-./][^]*)$/.exec(t)
        return m ? [m[1], m[2]] : [t]
      })
  const esToken = (t: string) => !Number.isNaN(numero(t)) || t === '...' || esJugada(t) || /^[0O]-[0O](-[0O])?[+!?]*$/.test(t)
  for (let i = p.desde; i < hasta; i++) {
    const t0 = partir(renglones[i] + (/^\d{1,3}$/.test(renglones[i]) && i + 1 < hasta ? ' ' + renglones[i + 1] : ''))
    if (!t0.length) continue
    if (/^(1-0|0-1|1\/2-1\/2|½-½)$/.test(t0[0])) { resultado = (t0[0] === '½-½' ? '1/2-1/2' : t0[0]) as PartidaLibro['resultado']; break }
    if (numero(t0[0]) !== esperado || (negras && t0[1] !== '...') || (!negras && t0[1] === '...')) continue
    // Juntar el tramo: solo renglones enteros de jugadas. Un renglón con alguna palabra es comentario (aunque
    // empiece con el número esperado, como "6 'iVc2 .td6 7 g4!? is an extremely") y corta el tramo.
    if (!t0.every(esToken)) continue
    const tramo: string[] = []
    let j = i
    for (; j < hasta; j++) {
      const t = partir(renglones[j])
      if (!t.length || !t.every(esToken)) break
      tramo.push(...t)
    }
    // recorrer el tramo con la numeración
    let k = 0
    while (k < tramo.length) {
      if (numero(tramo[k]) !== esperado) break
      k++
      if (negras) {
        if (tramo[k] !== '...') break
        k++
      }
      if (k >= tramo.length || !Number.isNaN(numero(tramo[k])) || tramo[k] === '...') break
      tokens.push(tramo[k]); k++
      if (negras) { negras = false; esperado++; continue }
      if (k < tramo.length && Number.isNaN(numero(tramo[k])) && tramo[k] !== '...') { tokens.push(tramo[k]); k++; esperado++ } else { negras = true }
    }
    i = Math.max(i, j - 1)
  }
  if (process.env.DEPURAR && p.n === Number(process.env.DEPURAR)) console.log(tokens.join(" "))
  const r = reconstruir(posDesdeFen(FEN_INICIAL), tokens)
  // Solo partidas completas: la línea principal tiene que llegar hasta el resultado.
  if (r.corte || r.ucis.length < 20 || !resultado) { fallas.push(`partida ${p.n} (${p.jugadores}): ${r.corte ? `jugada ${Math.floor(r.corte.i / 2) + 1} «${r.corte.token}»` : `solo ${r.ucis.length} jugadas`}`); continue }
  const [blancas, negrasJ] = p.jugadores.split('-').map((s) => s.trim().replace(/\s+/g, ' '))
  const m = /^(.*?)\s*(\d{4})/.exec(p.evento)
  salida.push({
    id: `crouch-${p.n}`,
    blancas: blancas || 'N. N.',
    negras: negrasJ || 'N. N.',
    lugar: m ? m[1].replace(/,\s*$/, '') : p.evento,
    anio: m ? Number(m[2]) : undefined,
    resultado,
    jugadas: r.ucis,
    fuente: { titulo: TITULO, capitulo: `partida ${p.n}` },
  })
}
const RUTA = 'public/datos/partidas-libros.json'
const previas = existsSync(RUTA) ? (JSON.parse(readFileSync(RUTA, 'utf8')) as PartidaLibro[]).filter((x) => !x.id.startsWith('crouch-')) : []
if (!process.env.SECO) writeFileSync(RUTA, JSON.stringify([...previas, ...salida]))
console.log(partidas.length, 'encabezados;', salida.length, 'partidas;', fallas.length, 'descartadas')
for (const f of fallas) console.log(' ', f)
for (const s of salida) console.log(' ', s.id, s.blancas, '-', s.negras, s.lugar, s.anio, s.resultado, s.jugadas.length)
