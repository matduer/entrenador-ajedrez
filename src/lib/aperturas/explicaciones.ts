import { fensDeLinea } from './arbol.ts'
import { clavePosicion } from '../ajedrez/posicion.ts'

/**
 * Explicaciones de aperturas escritas durante el desarrollo (src/contenido/aperturas/*.json).
 * Redacción propia a partir de fuentes abiertas y de libros de la biblioteca del usuario (citados por
 * capítulo, sin copiar texto), con las jugadas verificadas por Stockfish
 * (scripts/verificar-explicaciones.ts).
 */

/** Una fuente web lleva url; un libro de la biblioteca lleva capítulo y no tiene enlace. */
export interface Fuente {
  titulo: string
  url?: string
  licencia?: string
  capitulo?: string
}

export interface PorQueNo {
  uci: string // la jugada que NO conviene en esta posición
  texto: string
}

export interface NotaJugada {
  /** Por qué se juega esta jugada (la última de la clave). */
  porQue: string
  /**
   * La jugada es teoría reconocida pero Stockfish la considera algo inferior a la mejor (típico de
   * las jugadas que definen defensas de segunda línea, como 2...d6 en la Philidor). El verificador
   * la acepta hasta 0,15 de pérdida (sigue rechazando errores) y la app lo avisa.
   */
  inferior?: boolean
  /**
   * La jugada aparece en la teoría del catálogo pero Stockfish la considera un error (pierde más de
   * 0,15). El texto lo dice y nombra la mejor; el verificador exige que de verdad pierda eso, y el curso
   * no la elige como jugada propia si hay otra.
   */
  error?: boolean
  /** Alternativas tentadoras en la posición ANTERIOR a esta jugada, y cómo se castigan. */
  porQueNo?: PorQueNo[]
}

export interface Trampa {
  jugadas: string // UCI desde el inicio
  texto: string
}

export interface ResultadoVerificacion {
  ok: boolean
  detalle: string
}

export interface Explicacion {
  id: string
  nombre: string
  /** Línea raíz, en UCI desde el inicio. */
  raiz: string
  resumen: string
  planesBlancas: string[]
  planesNegras: string[]
  estructura: string
  rupturas: string[]
  piezas: string[]
  trampas: Trampa[]
  /** Clave: UCI desde el inicio hasta la jugada explicada, separadas por espacio. */
  notas: Record<string, NotaJugada>
  fuentes: Fuente[]
  verificacion?: { motor: string; profundidad: number; fecha: string; resultados: Record<string, ResultadoVerificacion> }
}


const modulos = import.meta.glob<Explicacion>('../../contenido/aperturas/*.json', { eager: true, import: 'default' })
export const EXPLICACIONES: Explicacion[] = Object.values(modulos).sort((a, b) => a.nombre.localeCompare(b.nombre))

/** La explicación cuya raíz es el prefijo más largo de la línea actual. */
export function explicacionPara(ucis: string[]): Explicacion | undefined {
  const linea = ucis.join(' ')
  let mejor: Explicacion | undefined
  for (const e of EXPLICACIONES) {
    if ((linea === e.raiz || linea.startsWith(e.raiz + ' ')) && (!mejor || e.raiz.length > mejor.raiz.length)) mejor = e
  }
  return mejor
}

/**
 * Índice por posición: «posición antes de la jugada + jugada» → nota. Así una nota escrita para un orden
 * de jugadas (1.d4 Cf6 2.c4) también aparece cuando se llega por transposición (1.c4 Cf6 2.d4).
 */
let indice: Map<string, { nota: NotaJugada; explicacion: Explicacion }> | undefined
function indicePorPosicion() {
  if (indice) return indice
  indice = new Map()
  for (const e of EXPLICACIONES)
    for (const [clave, nota] of Object.entries(e.notas)) {
      const ucis = clave.split(' ')
      const fens = fensDeLinea(ucis.slice(0, -1))
      if (fens.length !== ucis.length) continue
      const k = clavePosicion(fens.at(-1)!) + ' ' + ucis.at(-1)
      if (!indice.has(k)) indice.set(k, { nota, explicacion: e })
    }
  return indice
}

/** Nota de la última jugada de la línea: por el orden exacto de jugadas o, si no, por la posición. */
export function notaPara(ucis: string[]): { nota: NotaJugada; explicacion: Explicacion } | undefined {
  const clave = ucis.join(' ')
  for (const e of EXPLICACIONES) if (e.notas[clave]) return { nota: e.notas[clave], explicacion: e }
  if (!ucis.length) return undefined
  const fens = fensDeLinea(ucis.slice(0, -1))
  if (fens.length !== ucis.length) return undefined
  return indicePorPosicion().get(clavePosicion(fens.at(-1)!) + ' ' + ucis.at(-1))
}

/** "Por qué no" para una jugada concreta en la posición tras `ucis`. */
export function porQueNoPara(ucis: string[], uci: string): PorQueNo | undefined {
  const prefijo = ucis.join(' ')
  for (const e of EXPLICACIONES) {
    for (const [clave, nota] of Object.entries(e.notas)) {
      const partes = clave.split(' ')
      if (partes.slice(0, -1).join(' ') !== prefijo) continue
      const p = nota.porQueNo?.find((x) => x.uci === uci)
      if (p) return p
    }
  }
  // Por transposición: la misma posición alcanzada con otro orden de jugadas.
  const fens = fensDeLinea(ucis)
  if (fens.length !== ucis.length + 1) return undefined
  const k = clavePosicion(fens.at(-1)!)
  for (const e of EXPLICACIONES)
    for (const [clave, nota] of Object.entries(e.notas)) {
      const p = nota.porQueNo?.find((x) => x.uci === uci)
      if (!p) continue
      const previas = clave.split(' ').slice(0, -1)
      const f = fensDeLinea(previas)
      if (f.length === previas.length + 1 && clavePosicion(f.at(-1)!) === k) return p
    }
  return undefined
}
