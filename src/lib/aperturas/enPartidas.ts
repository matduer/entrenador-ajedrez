import { clavePosicion } from '../ajedrez/posicion.ts'
import type { Partida, RepasoLinea } from '../datos/tipos.ts'
import { fensDeLinea } from './arbol.ts'
import type { Curso } from './curso.ts'
import { idLinea } from './repertorio.ts'

/**
 * Tus partidas comparadas con un curso: dónde te saliste de la jugada que el curso enseña y dónde el
 * rival jugó algo que el curso no tiene. Las posiciones se comparan por FEN, así que cuenta también
 * llegar a la línea por otro orden de jugadas.
 */

/** Un punto donde las partidas salen del curso: misma posición, misma jugada jugada. */
export interface Desvio {
  tipo: 'mia' | 'rival'
  /** Clave de la posición donde se sale del curso. */
  clave: string
  /** Jugadas de la primera partida del grupo hasta la posición del desvío. */
  prefijo: string[]
  jugada: string
  /** Lo que el curso juega (mía) o conoce (rival) en esa posición. */
  esperadas: string[]
  /** Solo para los míos: la jugada del curso pertenece a una línea que ya aprendiste. */
  aprendida: boolean
  partidas: Partida[]
}

export interface PartidasEnCurso {
  /** Partidas con mi color que llegaron a alguna posición del curso desde la raíz. */
  llegaron: number
  /** De esas, las que siguieron el curso hasta que se terminó la línea. */
  completas: number
  desvios: Desvio[]
}

/** Hasta qué jugada se mira cada partida: los cursos no pasan de la jugada 15. */
const MAX_PLIES = 40

interface Entrada {
  ply: number
  jugadas: Set<string>
  aprendidas: Set<string>
}

export function partidasEnCurso(curso: Curso, partidas: Partida[], repasos: Map<string, RepasoLinea>): PartidasEnCurso {
  const raiz = curso.explicacion.raiz.split(' ').length
  const indice = new Map<string, Entrada>()
  for (const linea of curso.secciones.flatMap((s) => s.lecciones.flatMap((l) => l.lineas))) {
    const aprendida = repasos.has(idLinea(curso.color, linea))
    const fens = fensDeLinea(linea)
    for (let i = 0; i < linea.length && i < fens.length; i++) {
      const k = clavePosicion(fens[i])
      let e = indice.get(k)
      if (!e) indice.set(k, (e = { ply: i, jugadas: new Set(), aprendidas: new Set() }))
      e.ply = Math.min(e.ply, i)
      e.jugadas.add(linea[i])
      if (aprendida) e.aprendidas.add(linea[i])
    }
  }

  let llegaron = 0
  let completas = 0
  const grupos = new Map<string, Desvio>()
  for (const p of partidas) {
    if (p.miColor !== curso.color) continue
    const jugadas = p.jugadas.slice(0, MAX_PLIES)
    const fens = fensDeLinea(jugadas)
    // Se empieza a comparar en la primera posición del curso que esté en la raíz o más allá.
    let k = fens.findIndex((f) => (indice.get(clavePosicion(f))?.ply ?? -1) >= raiz)
    if (k < 0) continue
    llegaron++
    for (; k < jugadas.length; k++) {
      const clave = clavePosicion(fens[k])
      const e = indice.get(clave)
      if (!e) {
        completas++
        break
      }
      const jugada = jugadas[k]
      if (e.jugadas.has(jugada)) continue
      const mia = (fens[k].split(' ')[1] === 'w') === (curso.color === 'white')
      const id = `${clave}|${jugada}`
      const g = grupos.get(id)
      if (g) g.partidas.push(p)
      else
        grupos.set(id, {
          tipo: mia ? 'mia' : 'rival',
          clave,
          prefijo: jugadas.slice(0, k),
          jugada,
          esperadas: [...e.jugadas],
          aprendida: mia && [...e.jugadas].some((j) => e.aprendidas.has(j)),
          partidas: [p],
        })
      break
    }
  }
  const desvios = [...grupos.values()].sort(
    (a, b) => b.partidas.length - a.partidas.length || Math.max(...b.partidas.map((x) => x.fecha)) - Math.max(...a.partidas.map((x) => x.fecha)),
  )
  return { llegaron, completas, desvios }
}

/** Las líneas del curso que pasan por la posición del desvío con la jugada del curso. */
export function lineasDelDesvio(curso: Curso, d: Desvio): string[][] {
  return curso.secciones
    .flatMap((s) => s.lecciones.flatMap((l) => l.lineas))
    .filter((l) => {
      const fens = fensDeLinea(l)
      return fens.some((f, i) => i < l.length && d.esperadas.includes(l[i]) && clavePosicion(f) === d.clave)
    })
}

/** Posición + jugada de toda la teoría de la apertura, calculado una vez por curso. */
const teorias = new WeakMap<Curso, Set<string>>()

/** La jugada del desvío es teoría (aparece en alguna línea teórica de la apertura en esa posición). */
export function esTeoria(curso: Curso, d: Desvio): boolean {
  let t = teorias.get(curso)
  if (!t) {
    t = new Set()
    for (const l of curso.todas) {
      const fens = fensDeLinea(l)
      for (let i = 0; i < l.length && i < fens.length; i++) t.add(`${clavePosicion(fens[i])}|${l[i]}`)
    }
    teorias.set(curso, t)
  }
  return t.has(`${d.clave}|${d.jugada}`)
}
