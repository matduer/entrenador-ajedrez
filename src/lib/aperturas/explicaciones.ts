/**
 * Explicaciones de aperturas escritas durante el desarrollo (src/contenido/aperturas/*.json).
 * Redacción propia a partir de fuentes abiertas, con las jugadas verificadas por Stockfish
 * (scripts/verificar-explicaciones.ts). Siempre se muestran con la advertencia de contenido generado.
 */

export interface Fuente {
  titulo: string
  url: string
  licencia?: string
}

export interface PorQueNo {
  uci: string // la jugada que NO conviene en esta posición
  texto: string
}

export interface NotaJugada {
  /** Por qué se juega esta jugada (la última de la clave). */
  porQue: string
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

export const AVISO = 'Explicación generada, puede contener errores. Las jugadas están verificadas con Stockfish; las ideas son una guía.'

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

/** Nota de la última jugada de la línea, si existe en alguna explicación. */
export function notaPara(ucis: string[]): { nota: NotaJugada; explicacion: Explicacion } | undefined {
  const clave = ucis.join(' ')
  for (const e of EXPLICACIONES) if (e.notas[clave]) return { nota: e.notas[clave], explicacion: e }
  return undefined
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
  return undefined
}
