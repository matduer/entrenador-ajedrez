/** Una línea con nombre del dataset de aperturas de Lichess (CC0). */
export interface AperturaDatos {
  eco: string
  nombre: string // "Caro-Kann Defense: Advance Variation"
  jugadas: string // UCI separadas por espacio, desde la posición inicial
}

export interface Apertura extends AperturaDatos {
  familia: string // "Caro-Kann Defense"
  variante?: string // "Advance Variation"
  ucis: string[]
}
