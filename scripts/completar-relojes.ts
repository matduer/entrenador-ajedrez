/**
 * Completa los relojes de las partidas de Lichess del respaldo del análisis previo: la exportación
 * PGN original se bajó sin tiempos, pero la API pública de Lichess los da para todas las partidas.
 *
 * Uso: node scripts/completar-relojes.ts [usuario] [archivo]
 * (por defecto avatargs y datos-privados/analisis-previo.json; lo reescribe en el lugar)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { importarLichess } from '../src/lib/importar/lichess.ts'
import type { Respaldo } from '../src/lib/datos/tipos.ts'

const usuario = process.argv[2] ?? 'avatargs'
const archivo = process.argv[3] ?? 'datos-privados/analisis-previo.json'
const respaldo: Respaldo = JSON.parse(readFileSync(archivo, 'utf8'))
const porId = new Map(respaldo.partidas.map((p) => [p.id, p]))
const sinReloj = respaldo.partidas.filter((p) => p.fuente === 'lichess' && !p.relojes).length
console.log(`Partidas de Lichess sin reloj: ${sinReloj}`)

let completadas = 0
await importarLichess(
  usuario,
  0,
  async (lote) => {
    for (const p of lote) {
      const actual = porId.get(p.id)
      if (actual && !actual.relojes && p.relojes?.length) {
        actual.relojes = p.relojes
        completadas++
      }
    }
  },
  (n) => {
    if (n % 500 === 0) console.log(`${n} partidas recibidas, ${completadas} relojes completados`)
  },
)

writeFileSync(archivo, JSON.stringify(respaldo))
console.log(`Listo: ${completadas} partidas con reloj completado.`)
