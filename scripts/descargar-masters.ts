/**
 * Descarga de la base Masters de Lichess las posiciones que siguen a cada línea de los cursos
 * (`datos-privados/profundizar/hojas.json`, de `hojas-cursos.ts`), para profundizarlas.
 *
 * Desde cada final de línea sigue lo que juegan los maestros: la jugada más jugada de cada bando, la
 * segunda propia si es frecuente (por si Stockfish descarta la primera) y, en las primeras jugadas, las
 * respuestas frecuentes del rival. Para cuando hay pocas partidas o se llega a la jugada 12-15.
 *
 * El token se lee de la variable de entorno LICHESS_TOKEN y no se guarda en ningún lado. Lo guardado
 * (`datos-privados/profundizar/masters.json`, partidas por jugada en cada posición) sirve para retomar:
 * si se corta, se vuelve a correr y sigue donde quedó.
 *
 * Uso (PowerShell):  $env:LICHESS_TOKEN = "lip_..." ; node scripts/descargar-masters.ts
 */
import fs from 'node:fs'
import { clavePosicion, fenDe, jugadaLegal, posDesdeFen } from '../src/lib/ajedrez/posicion.ts'
import { fensDeLinea } from '../src/lib/aperturas/arbol.ts'

const DIR = 'datos-privados/profundizar'
const CACHE = `${DIR}/masters.json`
/** Hasta qué media jugada se profundiza: la jugada 12 o seis medias jugadas más que la línea, con tope en la 15. */
const objetivo = (largo: number) => Math.min(30, Math.max(24, largo + 6))
/** Con menos partidas que esto, la posición ya no dice qué juegan los maestros. */
const MINIMO_PARTIDAS = 30
/** Medias jugadas desde el final de la línea en las que se suman respuestas del rival además de la principal. */
const PLIES_CON_RAMAS = 8
const PARTE_RIVAL = 0.15
const MAX_RAMAS_RIVAL = 3
const PARTE_SEGUNDA_PROPIA = 0.2

const token = process.env.LICHESS_TOKEN?.trim()
if (!token) {
  console.error('Falta el token: en PowerShell, $env:LICHESS_TOKEN = "lip_..." y volvé a correr el script.')
  process.exit(1)
}

type Frecuencias = Record<string, number>
const cache: Record<string, Frecuencias> = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {}
const hojas = JSON.parse(fs.readFileSync(`${DIR}/hojas.json`, 'utf8')) as { linea: string; colores: ('white' | 'black')[] }[]

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
const enroques: Record<string, string> = { e1h1: 'e1g1', e1a1: 'e1c1', e8h8: 'e8g8', e8a8: 'e8c8' }
let nuevas = 0

function guardar() {
  fs.writeFileSync(CACHE, JSON.stringify(cache))
}

async function consultar(fen: string): Promise<Frecuencias> {
  const k = clavePosicion(fen)
  if (cache[k]) return cache[k]
  for (let intento = 0; ; intento++) {
    let resp: Response
    try {
      resp = await fetch(`https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}&moves=12&topGames=0`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      if (intento >= 5) throw new Error('Sin conexión con Lichess.')
      await esperar(30_000)
      continue
    }
    if (resp.status === 401) {
      guardar()
      console.error('Lichess rechazó el token (401). Lo descargado hasta acá quedó guardado.')
      process.exit(1)
    }
    if (resp.status === 429 || resp.status >= 500) {
      console.log(`  Lichess pide esperar (${resp.status}); sigo en un minuto.`)
      await esperar(60_000)
      continue
    }
    if (!resp.ok) throw new Error(`Respuesta inesperada de Lichess: ${resp.status}`)
    const datos = (await resp.json()) as { moves: { uci: string; white: number; draws: number; black: number }[] }
    const f: Frecuencias = {}
    for (const m of datos.moves) f[enroques[m.uci] ?? m.uci] = m.white + m.draws + m.black
    cache[k] = f
    if (++nuevas % 50 === 0) guardar()
    await esperar(300)
    return f
  }
}

/** Recorre desde una posición siguiendo lo que juegan los maestros. */
async function recorrer(fen: string, ply: number, hasta: number, inicio: number, colores: Set<string>, visitadas: Set<string>) {
  if (ply >= hasta) return
  const k = clavePosicion(fen)
  if (visitadas.has(k)) return
  visitadas.add(k)
  const f = await consultar(fen)
  const total = Object.values(f).reduce((s, x) => s + x, 0)
  if (total < MINIMO_PARTIDAS) return
  const ordenadas = Object.entries(f).sort((a, b) => b[1] - a[1])
  const mueve = ply % 2 === 0 ? 'white' : 'black'
  const elegidas = [ordenadas[0][0]]
  // Para el curso de ese color es jugada propia: la segunda, por si Stockfish descarta la primera.
  if (colores.has(mueve) && ordenadas[1] && ordenadas[1][1] / total >= PARTE_SEGUNDA_PROPIA) elegidas.push(ordenadas[1][0])
  // Para el curso del otro color es jugada del rival: las respuestas frecuentes.
  const rival = [...colores].some((c) => c !== mueve)
  if (rival && ply - inicio < PLIES_CON_RAMAS)
    for (const [u, n] of ordenadas.slice(1, MAX_RAMAS_RIVAL)) if (n / total >= PARTE_RIVAL && !elegidas.includes(u)) elegidas.push(u)
  for (const u of elegidas) {
    const pos = posDesdeFen(fen)
    const m = jugadaLegal(pos, u)
    if (!m) continue
    pos.play(m)
    await recorrer(fenDe(pos), ply + 1, hasta, inicio, colores, visitadas)
  }
}

const pendientes = hojas.filter((h) => h.linea.split(' ').length < 24)
console.log(`${pendientes.length} líneas para profundizar; ${Object.keys(cache).length} posiciones ya descargadas.`)
for (const [i, h] of pendientes.entries()) {
  const ucis = h.linea.split(' ')
  await recorrer(fensDeLinea(ucis).at(-1)!, ucis.length, objetivo(ucis.length), ucis.length, new Set(h.colores), new Set())
  if (i % 25 === 0) {
    guardar()
    console.log(`${i + 1}/${pendientes.length} líneas · ${Object.keys(cache).length} posiciones (${nuevas} nuevas en esta corrida)`)
  }
}
guardar()
console.log(`Listo: ${Object.keys(cache).length} posiciones en ${CACHE}.`)
