/**
 * Arma las líneas profundizadas de los cursos con lo descargado de Masters (`descargar-masters.ts`)
 * filtrado por Stockfish, y las escribe en `public/datos/profundizacion.json`.
 *
 * Desde el final de cada línea de un curso, por color:
 * - en mis jugadas, la más jugada por los maestros que Stockfish no considere imprecisa (pierde menos
 *   de PERDIDA_PROPIA); si ninguna de las dos más jugadas pasa, la línea termina ahí;
 * - en las del rival, la más jugada y, en las primeras jugadas, las frecuentes (PARTE_RIVAL), salvo
 *   que sean un error claro.
 * Para cuando no hay datos de Masters o hay pocas partidas. Las evaluaciones se guardan en
 * `datos-privados/profundizar/motor.json` para retomar si se corta.
 *
 * Uso: node scripts/profundizar-lineas.ts [profundidad=16]
 */
import fs from 'node:fs'
import { clavePosicion } from '../src/lib/ajedrez/posicion.ts'
import { fensDeLinea } from '../src/lib/aperturas/arbol.ts'
import { MotorNativo } from './lib-motor.ts'

const DIR = 'datos-privados/profundizar'
const SALIDA = 'public/datos/profundizacion.json'
const CACHE_MOTOR = `${DIR}/motor.json`
// Los mismos criterios que la descarga, para recorrer solo lo descargado.
const objetivo = (largo: number) => Math.min(30, Math.max(24, largo + 6))
const MINIMO_PARTIDAS = 30
const PLIES_CON_RAMAS = 8
const PARTE_RIVAL = 0.15
const MAX_RAMAS_RIVAL = 3
/** Pérdida (chances de ganar, 0 a 2) desde la que una jugada propia no se enseña: la de los «por qué no». */
const PERDIDA_PROPIA = 0.08
/** Una respuesta del rival que pierde más que esto es un error: no se prepara como línea principal. */
const PERDIDA_RIVAL = 0.2

type Color = 'white' | 'black'
const masters = JSON.parse(fs.readFileSync(`${DIR}/masters.json`, 'utf8')) as Record<string, Record<string, number>>
const hojas = JSON.parse(fs.readFileSync(`${DIR}/hojas.json`, 'utf8')) as { linea: string; colores: Color[] }[]
const evaluadas: Record<string, number> = fs.existsSync(CACHE_MOTOR) ? JSON.parse(fs.readFileSync(CACHE_MOTOR, 'utf8')) : {}
const motor = new MotorNativo(Number(process.argv[2] ?? 16), 4)
let nuevas = 0

async function perdida(prefijo: string[], uci: string): Promise<number> {
  const k = `${clavePosicion(fensDeLinea(prefijo).at(-1)!)}|${uci}`
  if (!(k in evaluadas)) {
    evaluadas[k] = (await motor.evaluarJugada(prefijo, uci))?.perdida ?? 2
    if (++nuevas % 100 === 0) fs.writeFileSync(CACHE_MOTOR, JSON.stringify(evaluadas))
  }
  return evaluadas[k]
}

const lineas = new Set<string>()
/** Mi jugada en cada posición profundizada, por línea previa: la que el curso tiene que elegir. */
const propias: Record<string, string> = {}

async function recorrer(camino: string[], hasta: number, inicio: number, color: Color) {
  const f = camino.length < hasta ? masters[clavePosicion(fensDeLinea(camino).at(-1)!)] : undefined
  const total = f ? Object.values(f).reduce((s, x) => s + x, 0) : 0
  if (!f || total < MINIMO_PARTIDAS) {
    if (camino.length > inicio) lineas.add(camino.join(' '))
    return
  }
  const ordenadas = Object.entries(f).sort((a, b) => b[1] - a[1])
  const mio = (camino.length % 2 === 0) === (color === 'white')
  const siguientes: string[] = []
  if (mio) {
    for (const [u] of ordenadas.slice(0, 2)) {
      if ((await perdida(camino, u)) < PERDIDA_PROPIA) {
        siguientes.push(u)
        propias[camino.join(' ')] ??= u
        break
      }
    }
  } else {
    const candidatas = ordenadas.filter(([, n], i) => i === 0 || (camino.length - inicio < PLIES_CON_RAMAS && i < MAX_RAMAS_RIVAL && n / total >= PARTE_RIVAL))
    for (const [u] of candidatas) if ((await perdida(camino, u)) < PERDIDA_RIVAL) siguientes.push(u)
  }
  if (!siguientes.length) {
    if (camino.length > inicio) lineas.add(camino.join(' '))
    return
  }
  for (const u of siguientes) await recorrer([...camino, u], hasta, inicio, color)
}

const pendientes = hojas.filter((h) => h.linea.split(' ').length < 24)
for (const [i, h] of pendientes.entries()) {
  const ucis = h.linea.split(' ')
  for (const color of h.colores) await recorrer(ucis, objetivo(ucis.length), ucis.length, color)
  if (i % 100 === 0) console.log(`${i + 1}/${pendientes.length} · ${lineas.size} líneas · ${nuevas} evaluaciones nuevas`)
}
fs.writeFileSync(CACHE_MOTOR, JSON.stringify(evaluadas))
// Solo las hojas: una línea que es comienzo de otra no aporta nada.
const ordenadas = [...lineas].sort()
const hojasFinales = ordenadas.filter((l, i) => !ordenadas[i + 1]?.startsWith(l + ' '))
fs.writeFileSync(SALIDA, JSON.stringify({ fuente: 'Base Masters de Lichess, filtrada con Stockfish', lineas: hojasFinales, propias }))
console.log(`Listo: ${hojasFinales.length} líneas y ${Object.keys(propias).length} elecciones propias en ${SALIDA}.`)
motor.cerrar()
