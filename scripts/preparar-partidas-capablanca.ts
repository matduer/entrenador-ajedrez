/**
 * Capablanca, «Fundamentos del ajedrez» (trad. Enrique P. Falcón, rev. Fernando Pérez, 2010): las 14 partidas
 * modelo de la última parte. Texto limpio en notación algebraica española (datos-privados/biblioteca/textos/
 * capablanca_fundamentos.txt). La línea principal son los renglones que solo tienen jugadas y empiezan con el
 * número que sigue ("7...Cxc3 8.bxc3 Cd7"); los comentarios, con variantes dentro de la prosa, quedan afuera.
 * Una partida entra solo si todas sus jugadas son legales y llega al resultado.
 *
 * Uso: node scripts/preparar-partidas-capablanca.ts → agrega (o reemplaza, por prefijo) en public/datos/partidas-libros.json
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parseSan } from 'chessops/san'
import { FEN_INICIAL, posDesdeFen, uciEstandar } from '../src/lib/ajedrez/posicion.ts'
import type { PartidaLibro } from '../src/lib/partidas-libros/partidas-libros.ts'
import { sanIngles } from './lib-san-es.ts'

const TITULO = 'José Raúl Capablanca — Fundamentos del ajedrez (trad. Enrique P. Falcón, rev. Fernando Pérez, 2010)'
const texto = readFileSync('datos-privados/biblioteca/textos/capablanca_fundamentos.txt', 'utf8')
// Solo la primera aparición de "ESTUDIO DE PARTIDAS MODELO" (la segunda es el índice final).
const desde = texto.indexOf('ESTUDIO DE PARTIDAS MODELO')
const hasta = texto.indexOf('ESTUDIO DE PARTIDAS MODELO', desde + 10)
// Sin las marcas de página del escaneo ("http://matika…", "Página 183 de 281"), que cortan la línea principal.
const renglones = texto.slice(desde, hasta).split('\n').map((l) => l.trim()).filter((l) => !/^(http:|Página \d+ de \d+)/.test(l))
const RESULTADO = /^(1-0|0-1|½-½|1\/2-1\/2)$/
const esJugada = (t: string) => /^(\d+\.{1,4})?([RDTAC]?[a-h]?[1-8]?x?[a-h][1-8](=?[DTAC])?|0-0(-0)?)[+#]*[!?]*$/.test(t)

const salida: PartidaLibro[] = []
const fallas: string[] = []
const inicios = renglones.flatMap((l, i) => (/^Partida Nº \d+$/.test(l) ? [i] : []))
for (let k = 0; k < inicios.length; k++) {
  const i0 = inicios[k]
  const fin = inicios[k + 1] ?? renglones.length
  const n = Number(/\d+/.exec(renglones[i0])![0])
  const [blancas, negras] = renglones[i0 + 1].split(/\s+vs\.\s+/).map((s) => s.trim().replace(/,(\S)/, ', $1'))
  const lugarAnio = renglones[i0 + 2].replace(/[()]/g, '').replace(/,\s*$/, '')
  const apertura = renglones[i0 + 3]
  let pos = posDesdeFen(FEN_INICIAL)
  const ucis: string[] = []
  let resultado: PartidaLibro['resultado']
  let error = ''
  let ultimoError = ''
  // Bloques de renglones seguidos que solo tienen jugadas: la línea principal a veces se corta en dos renglones.
  // Un renglón en blanco o de prosa cierra el bloque.
  // "17...,exd5", "(1-0).", valoraciones "(=+)" y "Axe5 jaque" también aparecen así en el texto
  const partir = (l: string) =>
    l
      .replace(/\.\.\.\.?,?/g, '...')
      .replace(/\((1-0|0-1|½-½)\)\.?/g, '$1')
      .replace(/\([=+\-±∓]+\)/g, '')
      .replace(/\s+jaque\s*$/, '+').replace(/(\d+\.(?:\.\.)?)\s+/g, '$1').split(/\s+/).filter((t) => t && t !== '...')
  const soloJugadas = (l: string) => { const t = partir(l); return t.length > 0 && t.every((x) => esJugada(x) || RESULTADO.test(x)) }
  const parrafos: string[] = []
  for (let i = i0 + 4, act = ''; i <= fin; i++) {
    if (i < fin && soloJugadas(renglones[i])) act += ' ' + renglones[i]
    else { if (act) parrafos.push(act); act = '' }
  }
  for (const parrafo of parrafos) {
    if (resultado || error) break
    const tokens = partir(parrafo)
    if (!tokens.length) continue
    const sinRes = RESULTADO.test(tokens[tokens.length - 1]) ? tokens.slice(0, -1) : tokens
    if (!sinRes.every(esJugada)) continue
    // el renglón tiene que seguir exactamente la numeración de la línea principal
    const nro = Math.floor(ucis.length / 2) + 1
    const esperado = ucis.length % 2 === 0 ? `${nro}.` : `${nro}...`
    if (sinRes.length && !sinRes[0].startsWith(esperado)) continue
    if (sinRes.length && ucis.length % 2 === 0 && sinRes[0].startsWith(`${nro}...`)) continue
    // Una variante del comentario puede estar sola en su renglón con la numeración esperada: si alguna de sus
    // jugadas es ilegal, el bloque entero se descarta y se sigue buscando la línea principal.
    const prueba = pos.clone()
    const nuevas: string[] = []
    for (const t of sinRes) {
      const m = parseSan(prueba, sanIngles(t.replace(/^\d+\.{1,3}/, '').replace(/[!?]+$/, '')))
      if (!m) { error = `jugada ${Math.floor((ucis.length + nuevas.length) / 2) + 1} «${t}»`; break }
      nuevas.push(uciEstandar(prueba, m))
      prueba.play(m)
    }
    if (error) { ultimoError = error; error = ''; continue }
    ucis.push(...nuevas)
    pos = prueba
    if (tokens.length > sinRes.length) resultado = (tokens[tokens.length - 1].replace('½-½', '1/2-1/2')) as PartidaLibro['resultado']
  }
  if (error || !resultado || ucis.length < 20) { fallas.push(`partida ${n} (${blancas} - ${negras}): ${error || (resultado ? 'muy corta' : `sin resultado tras ${ucis.length} medias jugadas${ultimoError ? `; descartado: ${ultimoError}` : ''}`)}`); continue }
  const anio = /(\d{4})/.exec(lugarAnio)?.[1]
  salida.push({
    id: `capablanca-fund-${n}`,
    blancas,
    negras,
    lugar: lugarAnio.replace(/,?\s*\d{4}.*$/, '').trim() || undefined,
    anio: anio ? Number(anio) : undefined,
    resultado,
    jugadas: ucis,
    fuente: { titulo: TITULO, capitulo: `partida modelo n.º ${n} (${apertura})` },
  })
}
const RUTA = 'public/datos/partidas-libros.json'
const previas = existsSync(RUTA) ? (JSON.parse(readFileSync(RUTA, 'utf8')) as PartidaLibro[]).filter((x) => !x.id.startsWith('capablanca-fund-')) : []
if (!process.env.SECO) writeFileSync(RUTA, JSON.stringify([...previas, ...salida]))
console.log(salida.length, 'partidas;', fallas.length, 'descartadas')
for (const f of fallas) console.log('  falla:', f)
for (const s of salida) console.log(' ', s.id, s.blancas, '-', s.negras, s.lugar ?? '', s.anio ?? '', s.resultado, s.jugadas.length)
