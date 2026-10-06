import type { Evaluacion } from '../ajedrez/evaluacion.ts'

export interface LineaMotor {
  ev: Evaluacion // desde el punto de vista del bando que mueve
  linea: string[]
}

export interface ResultadoMotor extends LineaMotor {
  mejor: string
  profundidad: number
  lineas: LineaMotor[] // una por multipv, la mejor primero
}

export interface OpcionesAnalisis {
  profundidad?: number
  tiempoMs?: number
  multipv?: number
}

/**
 * Stockfish 19 lite (WASM, un hilo) corriendo en un Web Worker. Las consultas se encolan: el motor
 * piensa una posición por vez.
 */
export class Motor {
  private worker: Worker
  private listo: Promise<void>
  private cola: Promise<unknown> = Promise.resolve()
  private alRecibir: ((linea: string) => void) | undefined

  constructor() {
    this.worker = new Worker(`${import.meta.env.BASE_URL}motor/stockfish.js`)
    this.worker.onmessage = (e: MessageEvent) => this.alRecibir?.(String(e.data))
    this.listo = this.esperar('uci', (l) => l === 'uciok').then(async () => {
      this.enviar('setoption name Hash value 32')
      await this.esperar('isready', (l) => l === 'readyok')
    })
  }

  private enviar(comando: string) {
    this.worker.postMessage(comando)
  }

  private esperar(comando: string, fin: (linea: string) => boolean, cadaLinea?: (linea: string) => void): Promise<void> {
    return new Promise((resolve) => {
      this.alRecibir = (linea) => {
        cadaLinea?.(linea)
        if (fin(linea)) {
          this.alRecibir = undefined
          resolve()
        }
      }
      this.enviar(comando)
    })
  }

  analizar(fen: string, opciones: OpcionesAnalisis = {}): Promise<ResultadoMotor> {
    const tarea = this.cola.then(() => this.analizarYa(fen, opciones))
    this.cola = tarea.catch(() => undefined)
    return tarea
  }

  private async analizarYa(fen: string, { profundidad, tiempoMs, multipv = 1 }: OpcionesAnalisis): Promise<ResultadoMotor> {
    await this.listo
    this.enviar(`setoption name MultiPV value ${multipv}`)
    this.enviar(`position fen ${fen}`)
    const lineas: LineaMotor[] = []
    let mejor = ''
    let prof = 0
    const go = tiempoMs && !profundidad ? `go movetime ${tiempoMs}` : `go depth ${profundidad ?? 12}${tiempoMs ? ` movetime ${tiempoMs}` : ''}`
    await this.esperar(
      go,
      (l) => l.startsWith('bestmove'),
      (l) => {
        if (l.startsWith('bestmove')) {
          mejor = l.split(' ')[1]
          return
        }
        if (!l.startsWith('info') || !l.includes(' pv ') || l.includes('bound')) return
        const score = / score (cp|mate) (-?\d+)/.exec(l)
        const pv = / pv (.+)$/.exec(l)
        if (!score || !pv) return
        const idx = Number(/ multipv (\d+)/.exec(l)?.[1] ?? 1) - 1
        prof = Number(/ depth (\d+)/.exec(l)?.[1] ?? prof)
        lineas[idx] = {
          ev: score[1] === 'cp' ? { cp: Number(score[2]) } : { mate: Number(score[2]) },
          linea: pv[1].trim().split(' '),
        }
      },
    )
    // Posición terminal (mate o ahogado): Stockfish responde "bestmove (none)".
    if (!lineas[0] || mejor === '(none)') {
      const ev = lineas[0]?.ev ?? { cp: 0 }
      return { ev, linea: [], mejor: '', profundidad: prof, lineas: [] }
    }
    return { ...lineas[0], mejor: mejor || lineas[0].linea[0], profundidad: prof, lineas: lineas.filter(Boolean) }
  }

  /** Corta la búsqueda en curso: el resultado parcial se devuelve igual. */
  detener() {
    this.enviar('stop')
  }

  terminar() {
    this.worker.terminate()
  }
}

let fondo: Motor | undefined
let interactivo: Motor | undefined

/** Motor para analizar partidas en segundo plano. */
export function motorFondo(): Motor {
  return (fondo ??= new Motor())
}

/** Motor para responder mientras resolvés ejercicios: separado para no esperar la cola de fondo. */
export function motorInteractivo(): Motor {
  return (interactivo ??= new Motor())
}
