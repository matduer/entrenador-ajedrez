/**
 * Dónde termina hoy cada línea de los cursos de aperturas (sin elecciones del usuario), por color.
 * Es el punto de partida para profundizarlas con la base Masters.
 *
 * Uso: node scripts/hojas-cursos.ts  →  datos-privados/profundizar/hojas.json
 */
import fs from 'node:fs'
import { cargarModulo, cerrarVite } from './lib-vite-node.ts'

// Tipos mínimos a mano: importar los de la app arrastraría Dexie y el DOM al chequeo de los scripts.
type Color = 'white' | 'black'
interface Curso {
  lineasTeoricas(raiz: string[]): Promise<string[][]>
  criterioFamilia(catalogo: unknown, raiz: string[]): unknown
  podarYOrdenar(lineas: string[][], raiz: string[], color: Color, elecciones: object, sale: unknown): { lineas: string[][] }
}
type Expl = { EXPLICACIONES: { raiz: string }[] }
type Cat = { cargarCatalogo(): Promise<unknown> }

const curso = await cargarModulo<Curso>('/src/lib/aperturas/curso.ts')
const { EXPLICACIONES } = await cargarModulo<Expl>('/src/lib/aperturas/explicaciones.ts')
const { cargarCatalogo } = await cargarModulo<Cat>('/src/lib/aperturas/catalogo.ts')
const catalogo = await cargarCatalogo()

const hojas = new Map<string, Set<string>>()
for (const e of EXPLICACIONES) {
  const raiz = e.raiz.split(' ')
  const todas = await curso.lineasTeoricas(raiz)
  const sale = curso.criterioFamilia(catalogo, raiz)
  for (const color of ['white', 'black'] as const) {
    for (const l of curso.podarYOrdenar(todas, raiz, color, {}, sale).lineas) {
      const k = l.join(' ')
      if (!hojas.has(k)) hojas.set(k, new Set())
      hojas.get(k)!.add(color)
    }
  }
}
fs.mkdirSync('datos-privados/profundizar', { recursive: true })
const salida = [...hojas].map(([linea, c]) => ({ linea, colores: [...c] }))
fs.writeFileSync('datos-privados/profundizar/hojas.json', JSON.stringify(salida, null, 1))
const largos = salida.map((h) => h.linea.split(' ').length).sort((a, b) => a - b)
console.log(`${salida.length} hojas; plies: mediana ${largos[largos.length >> 1]}, menos de 24: ${largos.filter((x) => x < 24).length}`)
await cerrarVite()
