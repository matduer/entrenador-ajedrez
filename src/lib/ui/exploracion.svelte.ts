import { fenDe, jugarUci, posDesdeFen } from '../ajedrez/posicion.ts'

/**
 * Una línea que se puede recorrer y modificar: se avanza y retrocede por sus jugadas, y si se juega
 * otra jugada en el medio, la línea se corta ahí y sigue por la nueva. Es el tablero de análisis
 * que queda después de resolver un ejercicio.
 */
export class Exploracion {
  base = $state('')
  ucis = $state<string[]>([])
  idx = $state(0)

  fens = $derived.by(() => {
    const lista = [this.base]
    let pos = posDesdeFen(this.base)
    for (const u of this.ucis) {
      const sig = jugarUci(pos, u)
      if (!sig) break
      pos = sig
      lista.push(fenDe(pos))
    }
    return lista
  })
  fen = $derived(this.fens[Math.min(this.idx, this.fens.length - 1)])
  ultima = $derived(this.idx > 0 ? this.ucis[this.idx - 1] : undefined)
  proxima = $derived(this.ucis[this.idx])
  turno = $derived<'white' | 'black'>(this.fen.split(' ')[1] === 'w' ? 'white' : 'black')

  constructor(base: string, ucis: string[] = [], idx = 0) {
    this.base = base
    this.ucis = ucis
    this.idx = Math.max(0, Math.min(idx, ucis.length))
  }

  /** Juega una jugada en la posición actual: si es la que sigue en la línea, solo avanza. */
  jugar(uci: string) {
    if (this.ucis[this.idx] === uci) {
      this.idx++
      return
    }
    if (!jugarUci(posDesdeFen(this.fen), uci)) return
    this.ucis = [...this.ucis.slice(0, this.idx), uci]
    this.idx++
  }

  ir(i: number) {
    this.idx = Math.max(0, Math.min(i, this.fens.length - 1))
  }
}
