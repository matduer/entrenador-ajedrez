import type { Fuente } from '../aperturas/explicaciones.ts'

/**
 * Partida tomada de un libro de la biblioteca: jugadas y datos (son hechos, no texto del libro). Los
 * comentarios, si los hay, son propios: ideas del libro con otras palabras, verificadas con Stockfish.
 */
export interface PartidaLibro {
  id: string
  blancas: string
  negras: string
  lugar?: string
  anio?: number
  resultado?: '1-0' | '0-1' | '1/2-1/2'
  /** UCI desde la posición inicial. */
  jugadas: string[]
  /** Comentario después de la media jugada n (1 = después de la primera jugada de las blancas). */
  comentarios?: Record<number, string>
  fuente: Fuente
}

let promesa: Promise<PartidaLibro[]> | undefined
export function cargarPartidasLibros(): Promise<PartidaLibro[]> {
  promesa ??= fetch(`${import.meta.env.BASE_URL}datos/partidas-libros.json`)
    .then((r) => (r.ok ? (r.json() as Promise<PartidaLibro[]>) : []))
    .catch(() => [])
  return promesa
}
