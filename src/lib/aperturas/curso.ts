import { Chess } from 'chessops/chess'
import { clavePosicion, fenDe, jugadaLegal } from '../ajedrez/posicion.ts'
import { db, guardarAjuste, leerAjuste } from '../datos/db.ts'
import type { Color, RepasoLinea } from '../datos/tipos.ts'
import { armarArbol, fensDeLinea, lineasDesde } from './arbol.ts'
import { cargarCatalogo, clasificar, type Catalogo } from './catalogo.ts'
import { EXPLICACIONES, notaPara, type Explicacion } from './explicaciones.ts'
import { frecuenciasGuardadas, type Frecuencias } from './popularidad.ts'
import { lineasDelNivel } from './practica.ts'
import { idLinea } from './repertorio.ts'

/**
 * Curso de una apertura para un color, al estilo de LotusChess: las líneas se ordenan de la más
 * importante a la más secundaria, se reparten en secciones por profundidad (los niveles de
 * práctica.ts) y cada sección en lecciones chicas que se habilitan de a una. En las posiciones
 * donde me toca a mí queda una sola jugada (la elegida por el usuario o, si no eligió, la principal);
 * en las del rival se practican todas las respuestas teóricas.
 */

export const LINEAS_POR_LECCION = 4

/**
 * Secciones por profundidad. La primera corta cada línea en la primera posición con nombre del
 * catálogo que aparece después de un mínimo de tres jugadas de cada bando desde la posición de la
 * apertura (o en ese mínimo si no hay ninguna antes del máximo de ocho): así una línea de la Inglesa
 * llega a la India de Rey o a la Simétrica, y no se queda en 1.c4 Cf6 2.d4. Las siguientes agregan
 * jugadas a ese corte.
 */
export const SECCIONES = [
  { nivel: 1, nombre: 'Líneas principales', extra: 0, descripcion: 'Cada línea, hasta llegar a la variante que le da nombre.' },
  { nivel: 2, nombre: 'Profundización', extra: 6, descripcion: 'Tres jugadas más de cada bando.' },
  { nivel: 3, nombre: 'Ampliado', extra: 14, descripcion: 'Siete jugadas más de cada bando, con más ramas.' },
  { nivel: 4, nombre: 'Completo', extra: 200, descripcion: 'Todas las líneas, hasta el final de la teoría cargada.' },
] as const

/** Plies mínimos y máximos después de la raíz para el corte en una variante con nombre. */
const CORTE_MINIMO = 6
const CORTE_MAXIMO = 16

/** Largo hasta la primera posición con nombre a partir del mínimo; si no hay antes del máximo, el mínimo. */
function corteEnVariante(catalogo: Catalogo, l: string[], raiz: number): number {
  const pos = Chess.default()
  for (const [i, u] of l.slice(0, raiz + CORTE_MAXIMO).entries()) {
    const m = jugadaLegal(pos, u)
    if (!m) break
    pos.play(m)
    if (i + 1 >= raiz + CORTE_MINIMO && catalogo.porPosicion.has(clavePosicion(fenDe(pos)))) return i + 1
  }
  return raiz + CORTE_MINIMO
}

/**
 * Recorta cada línea a su largo (terminando siempre en una jugada propia: si el corte cae en una del
 * rival, se agrega la respuesta) y descarta las que quedan como comienzo de otra más larga.
 */
function recortar(lineas: string[][], largos: number[], color: Color): string[][] {
  const miParidad = color === 'white' ? 1 : 0
  const recortadas = lineas.map((l, i) => {
    let n = Math.min(largos[i], l.length)
    if (n % 2 !== miParidad) n = n < l.length ? n + 1 : n - 1
    return l.slice(0, n)
  })
  const unicas = [...new Map(recortadas.filter((l) => l.length > 0).map((l) => [l.join(' '), l])).values()]
  return unicas.filter((l) => !unicas.some((o) => o.length > l.length && o.join(' ').startsWith(l.join(' ') + ' ')))
}

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

/** La línea termina en otra apertura (por ejemplo, la Inglesa que con 2.d4 pasa a una India). */
export type SaleDeLaFamilia = (ucis: string[]) => boolean

/** Grupo de una apertura según su primera jugada: las de flanco transponen mucho entre sí sin cambiar de carácter. */
const grupo = (primera: string | undefined) => (primera === 'e2e4' ? 'e4' : primera === 'd2d4' ? 'd4' : 'flanco')

/** Mínimo de notas propias de una explicación en una familia para que esa familia cuente como suya. */
const NOTAS_FAMILIA_PROPIA = 3

/**
 * Una línea sale de la apertura del curso cuando su posición con nombre más profunda es de otra familia
 * del catálogo que la raíz y además:
 * - es de otro grupo de primera jugada (1.e4, 1.d4 o flanco): 1.c4 Cf6 2.d4 g6 3.Cc3 Ag7 4.e4 es la
 *   India de Rey; o
 * - fuera de las de flanco, es la familia de la raíz de otra explicación y no es «propia» de esta (una
 *   donde la explicación tiene notas, como la Española y la Italiana en 1.e4 e5): en la India de Rey,
 *   3...d5 es la Grünfeld.
 * Entre las de flanco no cuenta: la Réti que pasa a la Inglesa no cambia de carácter. Tampoco cuentan
 * los nombres de otra familia sin explicación propia: las familias del catálogo no son una jerarquía
 * limpia (una Najdorf puede tener nombre de Scheveningen sin dejar de ser Siciliana).
 */
export function criterioFamilia(catalogo: Catalogo, raiz: string[]): SaleDeLaFamilia {
  const r = raiz.join(' ')
  const propias = new Set<string>()
  const raizFamilia = clasificar(catalogo, raiz, 200)?.familia
  if (raizFamilia) propias.add(raizFamilia)
  const cuenta = new Map<string, number>()
  for (const e of EXPLICACIONES.filter((x) => x.raiz === r))
    for (const clave of Object.keys(e.notas)) {
      const f = clasificar(catalogo, clave.split(' '), 200)?.familia
      if (f) cuenta.set(f, (cuenta.get(f) ?? 0) + 1)
    }
  for (const [f, n] of cuenta) if (n >= NOTAS_FAMILIA_PROPIA) propias.add(f)
  const deOtras = new Set(
    EXPLICACIONES.filter((e) => e.raiz !== r)
      .map((e) => clasificar(catalogo, e.raiz.split(' '), 200)?.familia)
      .filter((f): f is string => f !== undefined && !propias.has(f)),
  )
  const g = grupo(raiz[0])
  return (ucis) => {
    const a = clasificar(catalogo, ucis, 200)
    if (!a || a.familia === raizFamilia) return false
    if (grupo(a.ucis[0]) !== g) return true
    // «Neo-Grünfeld Defense» cuenta como la Grünfeld.
    return g !== 'flanco' && !propias.has(a.familia) && [...deOtras].some((f) => a.familia.includes(f))
  }
}

/** Resultado de podar un subárbol: cuántas líneas quedan y cuántas terminan en otra apertura. */
interface Poda {
  hojas: number
  fuera: number
  /** Mi jugada elegida, si en este nodo muevo yo. */
  jugada?: string
}

/**
 * Elige mi jugada en cada posición de abajo hacia arriba: la que guardó el usuario o, si no eligió, la
 * de más teoría, prefiriendo las que no están marcadas como inferiores y después las que, ya podadas,
 * no llevan mayormente a otra apertura (para que el curso de la Inglesa no se vuelva un curso de 1.d4).
 * Se mira adónde terminan las líneas que el curso va a enseñar, no la posición inmediata: 1.c4 e6 2.d4
 * todavía figura como Inglesa en el catálogo, y con 2.Cf3 el blanco igual puede pasar a d4 más tarde.
 */
function podarPropias(arbol: Nodo, raiz: string[], color: Color, elecciones: Elecciones, sale: SaleDeLaFamilia): Map<Nodo, Poda> {
  const memo = new Map<Nodo, Poda>()
  const evaluar = (n: Nodo, camino: string[]): Poda => {
    const hecho = memo.get(n)
    if (hecho) return hecho
    let r: Poda
    const ply = camino.length
    if (n.hijos.size === 0) r = { hojas: 1, fuera: Number(sale(camino)) }
    else if (ply < raiz.length) {
      const h = n.hijos.get(raiz[ply])
      r = h ? evaluar(h, [...camino, raiz[ply]]) : { hojas: 0, fuera: 0 }
    } else if ((ply % 2 === 0) === (color === 'white')) {
      const elegida = elecciones[claveEleccion(color, camino)]
      const candidatas = [...n.hijos].map(([u, h]) => {
        const p = evaluar(h, [...camino, u])
        const nota = notaPara([...camino, u])?.nota
        // Un error pesa más que una jugada inferior.
        return { u, peso: h.peso, p, inferior: nota?.error ? 2 : nota?.inferior ? 1 : 0, sale: p.fuera * 2 > p.hojas }
      })
      candidatas.sort(
        (a, b) => Number(b.u === elegida) - Number(a.u === elegida) || a.inferior - b.inferior || Number(a.sale) - Number(b.sale) || b.peso - a.peso,
      )
      // Si la única teoría cargada es un error, la línea no se enseña (hojas: 0): mejor no prepararse
      // contra esa jugada del rival que aprender una respuesta mala.
      r = candidatas[0].inferior === 2 && candidatas[0].u !== elegida ? { hojas: 0, fuera: 0 } : { ...candidatas[0].p, jugada: candidatas[0].u }
    } else {
      r = { hojas: 0, fuera: 0 }
      for (const [u, h] of n.hijos) {
        const p = evaluar(h, [...camino, u])
        r.hojas += p.hojas
        r.fuera += p.fuera
      }
    }
    memo.set(n, r)
    return r
  }
  evaluar(arbol, [])
  return memo
}

/** Mínimo de partidas Masters en una posición para confiar en sus frecuencias. */
const MINIMO_PARTIDAS = 20
/** Una respuesta del rival jugada en menos de esta fracción de las partidas es una rareza. */
const UMBRAL_RAREZA = 0.02

export interface Ordenadas {
  lineas: string[][]
  /** Prefijos (UCI separados por espacio) que terminan en una respuesta rara del rival. */
  raras: Set<string>
  /** Posiciones donde mueve el rival, para consultar sus frecuencias. */
  posicionesRival: string[]
}

/**
 * Poda las líneas a una jugada propia por posición y las ordena: primero la principal, después las que
 * se apartan una sola vez con la segunda respuesta del rival, y así (suma de los rangos de cada desvío).
 * Las respuestas del rival se ordenan por lo que más se juega en la base Masters cuando hay datos; si
 * no, por cuántas líneas del catálogo pasan por ahí.
 */
export function podarYOrdenar(lineas: string[][], raiz: string[], color: Color, elecciones: Elecciones, sale: SaleDeLaFamilia = () => false, frecuencias = new Map<string, Frecuencias>()): Ordenadas {
  const arbol = armarNodos(lineas)
  const poda = podarPropias(arbol, raiz, color, elecciones, sale)
  const salida: { l: string[]; rangos: number[] }[] = []
  const raras = new Set<string>()
  const posicionesRival: string[] = []
  const recorrer = (n: Nodo, camino: string[], rangos: number[], pos: Chess) => {
    if (n.hijos.size === 0) {
      salida.push({ l: camino, rangos })
      return
    }
    const ply = camino.length
    const seguir = (u: string, h: Nodo, r: number[]) => {
      const p = pos.clone()
      const m = jugadaLegal(p, u)
      if (!m) return
      p.play(m)
      recorrer(h, [...camino, u], r, p)
    }
    if (ply < raiz.length) {
      const h = n.hijos.get(raiz[ply])
      if (h) seguir(raiz[ply], h, rangos)
      return
    }
    const mio = (ply % 2 === 0) === (color === 'white')
    if (mio) {
      const u = poda.get(n)!.jugada
      if (!u) return
      seguir(u, n.hijos.get(u)!, rangos)
      return
    }
    const fen = fenDe(pos)
    posicionesRival.push(fen)
    const f = frecuencias.get(clavePosicion(fen))
    const total = f ? Object.values(f).reduce((s, x) => s + x, 0) : 0
    const conDatos = f !== undefined && total >= MINIMO_PARTIDAS
    const veces = (u: string) => (conDatos ? (f[u] ?? 0) : 0)
    const ordenados = [...n.hijos].sort((a, b) => veces(b[0]) - veces(a[0]) || b[1].peso - a[1].peso)
    ordenados.forEach(([u, h], i) => {
      if (conDatos && veces(u) / total < UMBRAL_RAREZA) raras.add([...camino, u].join(' '))
      seguir(u, h, [...rangos, i])
    })
  }
  recorrer(arbol, [], [], Chess.default())
  const suma = (r: number[]) => r.reduce((s, x) => s + x, 0)
  salida.sort((a, b) => {
    const d = suma(a.rangos) - suma(b.rangos)
    if (d) return d
    for (let i = 0; i < Math.min(a.rangos.length, b.rangos.length); i++) if (a.rangos[i] !== b.rangos[i]) return a.rangos[i] - b.rangos[i]
    return a.l.length - b.l.length
  })
  return { lineas: salida.map((x) => x.l), raras, posicionesRival }
}

/** La línea pasa por alguna respuesta rara del rival. */
const esRara = (l: string[], raras: Set<string>) => l.some((_, i) => raras.has(l.slice(0, i + 1).join(' ')))

/** Posiciones del curso donde mueve el rival: las que hay que consultar en la base Masters. */
export async function posicionesDelRival(explicacion: Explicacion, color: Color): Promise<string[]> {
  const raiz = explicacion.raiz.split(' ')
  return podarYOrdenar(await lineasTeoricas(raiz), raiz, color, await leerElecciones(), criterioFamilia(await cargarCatalogo(), raiz)).posicionesRival
}

export const SECCION_RAREZAS = {
  nivel: 5,
  nombre: 'Rarezas y trampas',
  descripcion: 'Respuestas poco jugadas por los maestros y trampas típicas. Es opcional: no bloquea las otras secciones.',
} as const

export async function armarCurso(explicacion: Explicacion, color: Color): Promise<Curso> {
  const raiz = explicacion.raiz.split(' ')
  const todas = await lineasTeoricas(raiz)
  const elecciones = await leerElecciones()
  const catalogo = await cargarCatalogo()
  const sale = criterioFamilia(catalogo, raiz)
  const previo = podarYOrdenar(todas, raiz, color, elecciones, sale)
  const frecuencias = await frecuenciasGuardadas(previo.posicionesRival)
  const { lineas: ordenadas, raras } = frecuencias.size ? podarYOrdenar(todas, raiz, color, elecciones, sale, frecuencias) : previo
  const cortes = ordenadas.map((l) => corteEnVariante(catalogo, l, raiz.length))
  const vistas = new Set<string>()
  const secciones: Seccion[] = []
  const agregar = (nivel: number, nombre: string, descripcion: string, lineas: string[][]) => {
    if (!lineas.length) return
    const lecciones: Leccion[] = []
    for (let i = 0; i < lineas.length; i += LINEAS_POR_LECCION)
      lecciones.push({ seccion: nivel, numero: lecciones.length + 1, lineas: lineas.slice(i, i + LINEAS_POR_LECCION) })
    secciones.push({ nivel, nombre, descripcion, lecciones })
  }
  for (const n of SECCIONES) {
    const comunes = ordenadas.map((l, i) => ({ l, c: cortes[i] })).filter((x) => !esRara(x.l, raras))
    const lineas = recortar(comunes.map((x) => x.l), comunes.map((x) => x.c + n.extra), color).filter((l) => !vistas.has(l.join(' ')))
    lineas.forEach((l) => vistas.add(l.join(' ')))
    agregar(n.nivel, n.nombre, n.descripcion, lineas)
  }
  // Las rarezas y las trampas típicas van aparte, al final: no bloquean el resto del curso.
  const rarezas = ordenadas.filter((l) => esRara(l, raras))
  const trampas = explicacion.trampas.map((t) => t.jugadas.split(' ')).filter((l) => l.length > raiz.length && l.slice(0, raiz.length).join(' ') === raiz.join(' '))
  const extra = lineasDelNivel([...trampas, ...rarezas], 200, color).filter((l) => !vistas.has(l.join(' ')))
  agregar(SECCION_RAREZAS.nivel, SECCION_RAREZAS.nombre, SECCION_RAREZAS.descripcion, extra)
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
  let proximaRareza: Leccion | undefined
  for (const s of curso.secciones)
    for (const l of s.lecciones) {
      const completa = l.lineas.every((x) => repasos.has(idLinea(curso.color, x)))
      // La sección de rarezas es opcional: siempre está abierta y no traba a las demás.
      if (s.nivel === SECCION_RAREZAS.nivel) {
        lecciones.set(claveLeccion(l), completa ? 'completa' : 'disponible')
        if (!completa && !proximaRareza) proximaRareza = l
        continue
      }
      const estado: EstadoLeccion = completa ? 'completa' : anteriorCompleta ? 'disponible' : 'bloqueada'
      if (estado === 'disponible' && !proxima) proxima = l
      lecciones.set(claveLeccion(l), estado)
      anteriorCompleta = completa
    }
  proxima ??= proximaRareza
  const vencidas = lineas
    .filter((l) => {
      const r = repasos.get(idLinea(curso.color, l))
      return r && new Date(r.card.due).getTime() <= ahora
    })
    .sort((a, b) => +new Date(repasos.get(idLinea(curso.color, a))!.card.due) - +new Date(repasos.get(idLinea(curso.color, b))!.card.due))
  return { repasos, total: lineas.length, aprendidas: repasos.size, vencidas, lecciones, proxima }
}

/**
 * Otras jugadas teóricas mías en la posición tras `prefijo` (salvo `jugada`) cuyas líneas terminan
 * mayormente en otra apertura, con las familias a las que llevan (las más frecuentes primero). Sirven
 * para mostrar que existe la transposición sin que el curso la enseñe.
 */
export function transposiciones(todas: string[][], prefijo: string[], jugada: string, sale: SaleDeLaFamilia, catalogo: Catalogo): { uci: string; familias: string[] }[] {
  const texto = prefijo.join(' ')
  const porJugada = new Map<string, string[][]>()
  for (const l of todas)
    if (l.length > prefijo.length && l[prefijo.length] !== jugada && l.slice(0, prefijo.length).join(' ') === texto) {
      const u = l[prefijo.length]
      porJugada.set(u, [...(porJugada.get(u) ?? []), l])
    }
  const r: { uci: string; familias: string[] }[] = []
  for (const [uci, ls] of porJugada) {
    const fuera = ls.filter((l) => sale(l))
    if (fuera.length * 2 <= ls.length) continue
    const cuenta = new Map<string, number>()
    for (const l of fuera) {
      const f = clasificar(catalogo, l, 200)?.familia
      if (f) cuenta.set(f, (cuenta.get(f) ?? 0) + 1)
    }
    r.push({ uci, familias: [...cuenta].sort((a, b) => b[1] - a[1]).map(([f]) => f) })
  }
  return r
}

/**
 * Borra el repaso de las líneas de esta apertura con este color (las que empiezan por la raíz,
 * incluidas las que quedaron fuera del curso cuando cambió). No toca las de otra apertura de «Mis
 * aperturas» con una raíz más larga dentro de esta (la Najdorf dentro de la Siciliana) ni las
 * jugadas guardadas como propias. Devuelve cuántas líneas se reiniciaron.
 */
export async function reiniciarProgreso(explicacion: Explicacion, color: Color): Promise<number> {
  const raiz = explicacion.raiz
  const otras = (await leerMisAperturas())[color]
    .map((id) => EXPLICACIONES.find((e) => e.id === id)?.raiz)
    .filter((r): r is string => r !== undefined && r !== raiz && r.startsWith(raiz + ' '))
  const empieza = (linea: string, r: string) => linea === r || linea.startsWith(r + ' ')
  const ids = (await db.repasosLineas.where('color').equals(color).primaryKeys()).filter((id) => {
    const linea = id.slice(color.length + 1)
    return empieza(linea, raiz) && !otras.some((r) => empieza(linea, r))
  })
  await db.repasosLineas.bulkDelete(ids)
  return ids.length
}
