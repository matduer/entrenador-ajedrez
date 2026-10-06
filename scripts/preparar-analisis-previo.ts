/**
 * Convierte el análisis de Stockfish hecho antes de la app (posiciones_completo.json +
 * resultados_completo.jsonl) en un archivo de respaldo que la app importa desde Ajustes.
 *
 * El análisis previo solo guardó FEN + evaluación de cada posición, sin decir de qué partida es
 * ni qué jugada se hizo. Este script reproduce todas las partidas de los PGN, ubica cada par de
 * posiciones consecutivas en su partida y de ahí deduce la jugada jugada, el color propio, la
 * fecha y la apertura. No vuelve a correr el motor.
 *
 * Uso: node scripts/preparar-analisis-previo.ts [carpeta-del-analisis] [carpeta-de-pgn]
 * Salida: datos-privados/analisis-previo.json (excluido de git).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Chess } from 'chessops/chess'
import { clavePosicion, fenDe, jugarUci } from '../src/lib/ajedrez/posicion.ts'
import type { Evaluacion } from '../src/lib/ajedrez/evaluacion.ts'
import { construirError, type AnalisisPosicion } from '../src/lib/analisis/errores.ts'
import { partidasDesdeTextoPgn } from '../src/lib/datos/normalizar.ts'
import type { ErrorPartida, Partida, Respaldo } from '../src/lib/datos/tipos.ts'

const CARPETA_ANALISIS =
  process.argv[2] ??
  'D:/Documentos de Mati/Facultad/2025 - 1er cuatrimestre/Ajedrez/Claude Ajedrez/Claude outputs/Stockfish - instalar y analizar'
const CARPETA_PGN = process.argv[3] ?? 'docs/contexto/partidas'
const USUARIOS = { lichess: 'avatargs', chesscom: 'avatargs' }

// 1. Partidas
const porId = new Map<string, Partida>()
for (const archivo of readdirSync(CARPETA_PGN).filter((f) => f.endsWith('.pgn'))) {
  const texto = readFileSync(join(CARPETA_PGN, archivo), 'utf8')
  for (const p of partidasDesdeTextoPgn(texto, USUARIOS)) porId.set(p.id, p)
}
const partidas = [...porId.values()]
console.log(`Partidas leídas: ${partidas.length}`)

// 2. Índice: clave de posición → (partida, ply). claves[i][ply] = posición antes de la jugada `ply`.
const claves: string[][] = []
const indice = new Map<string, [number, number][]>()
const fens: string[][] = []
partidas.forEach((p, i) => {
  let pos = Chess.default() as ReturnType<typeof Chess.default>
  const k: string[] = []
  const f: string[] = []
  for (let ply = 0; ply <= p.jugadas.length; ply++) {
    const fen = fenDe(pos)
    const clave = clavePosicion(fen)
    k.push(clave)
    f.push(fen)
    let lista = indice.get(clave)
    if (!lista) indice.set(clave, (lista = []))
    lista.push([i, ply])
    if (ply < p.jugadas.length) pos = jugarUci(pos, p.jugadas[ply]) as typeof pos
  }
  claves.push(k)
  fens.push(f)
})

// 3. Análisis previo
interface PosicionPrevia { id: string; fen: string }
interface ResultadoPrevio { id: string; engine_bestmove: string; score_type: 'cp' | 'mate'; score_value: number; pv: string }
const posiciones: PosicionPrevia[] = JSON.parse(readFileSync(join(CARPETA_ANALISIS, 'posiciones_completo.json'), 'utf8'))
const resultados = new Map<string, ResultadoPrevio>()
for (const linea of readFileSync(join(CARPETA_ANALISIS, 'resultados_completo.jsonl'), 'utf8').split('\n')) {
  if (!linea.trim()) continue
  const r: ResultadoPrevio = JSON.parse(linea)
  resultados.set(r.id, r)
}
const prefijos = new Map<string, number>()
for (const p of posiciones) {
  const pre = p.id.replace(/_?\d+$/, '')
  prefijos.set(pre, (prefijos.get(pre) ?? 0) + 1)
}
console.log(`Posiciones analizadas: ${posiciones.length}, resultados: ${resultados.size}, prefijos:`, Object.fromEntries(prefijos))

function analisis(r: ResultadoPrevio): AnalisisPosicion | undefined {
  if (!r?.engine_bestmove || r.score_type === undefined || r.score_value === null) return undefined
  const ev: Evaluacion = r.score_type === 'mate' ? { mate: r.score_value } : { cp: r.score_value }
  return { ev, mejor: r.engine_bestmove, linea: (r.pv ?? r.engine_bestmove).split(' ').filter(Boolean) }
}

// 4. Pares consecutivos → errores
const errores = new Map<string, ErrorPartida>()
let pares = 0
let ubicados = 0
let mios = 0
for (let i = 0; i + 1 < posiciones.length; i++) {
  const a = posiciones[i]
  const b = posiciones[i + 1]
  pares++
  const claveB = clavePosicion(b.fen)
  const candidatos = (indice.get(clavePosicion(a.fen)) ?? []).filter(([g, ply]) => claves[g][ply + 1] === claveB)
  if (candidatos.length === 0) continue
  ubicados++
  // Si la misma secuencia aparece en varias partidas, se toma la más reciente.
  const [g, ply] = candidatos.reduce((x, y) => (partidas[y[0]].fecha > partidas[x[0]].fecha ? y : x))
  const partida = partidas[g]
  const mueve = a.fen.split(' ')[1] === 'w' ? 'white' : 'black'
  if (mueve !== partida.miColor) continue
  mios++
  const antes = analisis(resultados.get(a.id)!)
  const despues = analisis(resultados.get(b.id)!)
  if (!antes || !despues) continue
  const error = construirError(partida, ply, fens[g][ply], antes, despues, 'previo')
  if (error) errores.set(error.id, error)
}

for (const p of partidas) if (p.estadoAnalisis === 'pendiente') p.estadoAnalisis = 'previo'

const lista = [...errores.values()]
const cuenta = (f: (e: ErrorPartida) => string) =>
  lista.reduce<Record<string, number>>((acc, e) => ((acc[f(e)] = (acc[f(e)] ?? 0) + 1), acc), {})
console.log(`Pares de posiciones: ${pares}, ubicados en una partida: ${ubicados}, jugadas propias: ${mios}`)
console.log(`Errores: ${lista.length}`, cuenta((e) => e.clasificacion))
console.log('Por fase:', cuenta((e) => e.fase))
console.log('Por tema:', cuenta((e) => (e.temas.length ? e.temas.join('+') : 'sin clasificar')))
console.log('Por motivo:', cuenta((e) => (e.motivo.length ? e.motivo[0] : 'sin clasificar')))

// 5. Respaldo
const ultima = (fuente: Partida['fuente']) => Math.max(0, ...partidas.filter((p) => p.fuente === fuente).map((p) => p.fecha))
const respaldo: Respaldo = {
  formato: 'entrenador-ajedrez',
  version: 1,
  creado: Date.now(),
  partidas,
  errores: lista,
  repasos: [],
  ajustes: [
    { clave: 'usuarios', valor: USUARIOS },
    { clave: 'cursor:lichess', valor: ultima('lichess') },
    { clave: 'cursor:chesscom', valor: ultima('chesscom') },
  ],
}
mkdirSync('datos-privados', { recursive: true })
writeFileSync('datos-privados/analisis-previo.json', JSON.stringify(respaldo))
console.log('Escrito datos-privados/analisis-previo.json')
