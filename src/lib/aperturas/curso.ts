import { clavePosicion } from '../ajedrez/posicion.ts'
import { db, guardarAjuste, leerAjuste } from '../datos/db.ts'
import type { Color, RepasoLinea } from '../datos/tipos.ts'
import { armarArbol, fensDeLinea, lineasDesde } from './arbol.ts'
import { cargarCatalogo } from './catalogo.ts'
import { EXPLICACIONES, notaPara, type Explicacion } from './explicaciones.ts'
import { lineasDelNivel } from './practica.ts'
import { idLinea } from './repertorio.ts'

/**
 * Curso de una apertura para un color, al estilo de LotusChess: las líneas se ordenan de la más
 * importante a la más secundaria, se reparten en secciones por profundidad (los niveles de
 * práctica.ts) y cada sección en lecciones chicas que se habilitan de a una. En las posiciones
 * donde me toca a mí queda una sola jugada (la elegida por el usuario o, si no eligió, la principal);
 * en las del rival se practican todas las respuestas teóricas.
 */

export const LINEAS_POR_LECCION = 5

/**
 * Secciones por profundidad, contada desde la posición de la apertura (no desde el inicio): así una
 * apertura de raíz larga, como la Najdorf, no tiene una primera sección vacía.
 */
export const SECCIONES = [
  { nivel: 1, nombre: 'Esqueleto', extra: 4, descripcion: 'Las dos primeras jugadas de cada bando después de la posición de la apertura.' },
  { nivel: 2, nombre: 'Líneas principales', extra: 8, descripcion: 'Hasta cuatro jugadas de cada bando.' },
  { nivel: 3, nombre: 'Ampliado', extra: 14, descripcion: 'Hasta siete jugadas de cada bando, con más ramas.' },
  { nivel: 4, nombre: 'Completo', extra: 60, descripcion: 'Todas las líneas, hasta el final de la teoría cargada.' },
] as const

export interface Leccion {
  seccion: number
  numero: number
  lineas: string[][]
}

export interface Seccion {
  nivel: number
  nombre: string
  descripcion: string
  lecciones: Leccion[]
}

export interface Curso {
  explicacion: Explicacion
  color: Color
  /** Todas las líneas teóricas desde la raíz, sin podar (sirven para reconocer alternativas). */
  todas: string[][]
  secciones: Seccion[]
}

/** Mis aperturas para practicar, por color (ids de explicaciones). */
export type MisAperturas = Record<Color, string[]>

export const leerMisAperturas = () => leerAjuste<MisAperturas>('aperturasPractica', { white: [], black: [] })
// Copia plana: los estados de Svelte son proxies y IndexedDB no los puede clonar.
export const guardarMisAperturas = (m: MisAperturas) => guardarAjuste('aperturasPractica', { white: [...m.white], black: [...m.black] })

/** Jugada propia elegida en una posición: clave `${color}|${clave de posición}` → UCI. */
export type Elecciones = Record<string, string>

export const leerElecciones = () => leerAjuste<Elecciones>('eleccionesAperturas', {})

export async function guardarEleccion(color: Color, prefijo: string[], uci: string) {
  const e = await leerElecciones()
  e[claveEleccion(color, prefijo)] = uci
  await guardarAjuste('eleccionesAperturas', e)
}

function claveEleccion(color: Color, prefijo: string[]): string {
  return `${color}|${clavePosicion(fensDeLinea(prefijo).at(-1)!)}`
}

/** Líneas teóricas desde la raíz: las del catálogo y las de las notas escritas, que suelen llegar más lejos. */
export async function lineasTeoricas(raiz: string[]): Promise<string[][]> {
  const arbol = armarArbol(await cargarCatalogo())
  const lineas = lineasDesde(arbol, raiz, 40)
  const r = raiz.join(' ')
  for (const e of EXPLICACIONES) for (const clave of Object.keys(e.notas)) if (clave.startsWith(r + ' ')) lineas.push(clave.split(' '))
  return lineas.length ? lineas : [raiz]
}

interface Nodo {
  hijos: Map<string, Nodo>
  peso: number
}

function armarNodos(lineas: string[][]): Nodo {
  const raiz: Nodo = { hijos: new Map(), peso: 0 }
  for (const l of lineas) {
    let n = raiz
    n.peso++
    for (const u of l) {
      let h = n.hijos.get(u)
      if (!h) n.hijos.set(u, (h = { hijos: new Map(), peso: 0 }))
      h.peso++
      n = h
    }
  }
  return raiz
}

/** Mi jugada en una posición con varias: la elegida, o la de más teoría que no esté marcada como inferior. */
function elegirPropia(prefijo: string[], hijos: Map<string, Nodo>, color: Color, elecciones: Elecciones): string {
  const elegida = elecciones[claveEleccion(color, prefijo)]
  if (elegida && hijos.has(elegida)) return elegida
  const candidatas = [...hijos].map(([u, n]) => {
    const nota = notaPara([...prefijo, u])?.nota
    return { u, peso: n.peso, inferior: nota?.inferior ?? false }
  })
  candidatas.sort((a, b) => Number(a.inferior) - Number(b.inferior) || b.peso - a.peso)
  return candidatas[0].u
}

/**
 * Poda las líneas a una jugada propia por posición y las ordena: primero la principal, después las que
 * se apartan una sola vez con la segunda respuesta del rival, y así (suma de los rangos de cada desvío).
 */
export function podarYOrdenar(lineas: string[][], raiz: string[], color: Color, elecciones: Elecciones): string[][] {
  const arbol = armarNodos(lineas)
  const salida: { l: string[]; rangos: number[] }[] = []
  const recorrer = (n: Nodo, camino: string[], rangos: number[]) => {
    if (n.hijos.size === 0) {
      salida.push({ l: camino, rangos })
      return
    }
    const ply = camino.length
    if (ply < raiz.length) {
      const h = n.hijos.get(raiz[ply])
      if (h) recorrer(h, [...camino, raiz[ply]], rangos)
      return
    }
    const mio = (ply % 2 === 0) === (color === 'white')
    if (mio) {
      const u = elegirPropia(camino, n.hijos, color, elecciones)
      recorrer(n.hijos.get(u)!, [...camino, u], rangos)
      return
    }
    const ordenados = [...n.hijos].sort((a, b) => b[1].peso - a[1].peso)
    ordenados.forEach(([u, h], i) => recorrer(h, [...camino, u], [...rangos, i]))
  }
  recorrer(arbol, [], [])
  const suma = (r: number[]) => r.reduce((s, x) => s + x, 0)
  salida.sort((a, b) => {
    const d = suma(a.rangos) - suma(b.rangos)
    if (d) return d
    for (let i = 0; i < Math.min(a.rangos.length, b.rangos.length); i++) if (a.rangos[i] !== b.rangos[i]) return a.rangos[i] - b.rangos[i]
    return a.l.length - b.l.length
  })
  return salida.map((x) => x.l)
}

export async function armarCurso(explicacion: Explicacion, color: Color): Promise<Curso> {
  const raiz = explicacion.raiz.split(' ')
  const todas = await lineasTeoricas(raiz)
  const ordenadas = podarYOrdenar(todas, raiz, color, await leerElecciones())
  const vistas = new Set<string>()
  const secciones: Seccion[] = []
  for (const n of SECCIONES) {
    const lineas = lineasDelNivel(ordenadas, raiz.length + n.extra, color).filter((l) => !vistas.has(l.join(' ')))
    lineas.forEach((l) => vistas.add(l.join(' ')))
    if (!lineas.length) continue
    const lecciones: Leccion[] = []
    for (let i = 0; i < lineas.length; i += LINEAS_POR_LECCION)
      lecciones.push({ seccion: n.nivel, numero: lecciones.length + 1, lineas: lineas.slice(i, i + LINEAS_POR_LECCION) })
    secciones.push({ nivel: n.nivel, nombre: n.nombre, descripcion: n.descripcion, lecciones })
  }
  return { explicacion, color, todas, secciones }
}

export type EstadoLeccion = 'completa' | 'disponible' | 'bloqueada'

export interface EstadoCurso {
  repasos: Map<string, RepasoLinea>
  total: number
  aprendidas: number
  vencidas: string[][]
  /** Estado de cada lección, por `${sección}-${número}`. */
  lecciones: Map<string, EstadoLeccion>
  /** Próxima lección para aprender, si queda alguna. */
  proxima?: Leccion
}

export const claveLeccion = (l: Leccion) => `${l.seccion}-${l.numero}`

/** Una lección se habilita cuando todas las líneas de la anterior ya se vieron al menos una vez. */
export async function estadoCurso(curso: Curso): Promise<EstadoCurso> {
  const lineas = curso.secciones.flatMap((s) => s.lecciones.flatMap((l) => l.lineas))
  const ids = lineas.map((l) => idLinea(curso.color, l))
  const filas = await db.repasosLineas.bulkGet(ids)
  const repasos = new Map<string, RepasoLinea>()
  filas.forEach((r, i) => r && repasos.set(ids[i], r))
  const ahora = Date.now()
  const lecciones = new Map<string, EstadoLeccion>()
  let proxima: Leccion | undefined
  let anteriorCompleta = true
  for (const s of curso.secciones)
    for (const l of s.lecciones) {
      const completa = l.lineas.every((x) => repasos.has(idLinea(curso.color, x)))
      const estado: EstadoLeccion = completa ? 'completa' : anteriorCompleta ? 'disponible' : 'bloqueada'
      if (estado === 'disponible' && !proxima) proxima = l
      lecciones.set(claveLeccion(l), estado)
      anteriorCompleta = completa
    }
  const vencidas = lineas
    .filter((l) => {
      const r = repasos.get(idLinea(curso.color, l))
      return r && new Date(r.card.due).getTime() <= ahora
    })
    .sort((a, b) => +new Date(repasos.get(idLinea(curso.color, a))!.card.due) - +new Date(repasos.get(idLinea(curso.color, b))!.card.due))
  return { repasos, total: lineas.length, aprendidas: repasos.size, vencidas, lecciones, proxima }
}
