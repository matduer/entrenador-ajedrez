/**
 * Stockfish nativo para los scripts de desarrollo (verificar contenido, explorar posiciones).
 * Ruta en la variable de entorno STOCKFISH; por defecto, el ejecutable que ya estaba instalado.
 */
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { chancesDeGanar, invertir, type Evaluacion } from '../src/lib/ajedrez/evaluacion.ts'
import { fensDeLinea } from '../src/lib/aperturas/arbol.ts'

const RUTA =
  process.env.STOCKFISH ??
  'D:/Documentos de Mati/Facultad/2025 - 1er cuatrimestre/Ajedrez/Claude Ajedrez/Claude outputs/Stockfish - instalar y analizar/stockfish/stockfish.exe'

export interface Analisis {
  ev: Evaluacion
  mejor: string
  pv: string[]
  lineas: { ev: Evaluacion; pv: string[] }[]
}

export class MotorNativo {
  private proc = spawn(RUTA, [], { stdio: ['pipe', 'pipe', 'inherit'] })
  private oyente: ((l: string) => void) | undefined
  private cache = new Map<string, Analisis>()
  private listo: Promise<void>
  private profundidad: number

  /** Con un solo hilo, Stockfish da siempre el mismo resultado: necesario para verificaciones reproducibles. */
  constructor(profundidad: number, hilos = 1) {
    this.profundidad = profundidad
    createInterface({ input: this.proc.stdout }).on('line', (l) => this.oyente?.(l))
    this.listo = this.esperar((l) => l === 'readyok')
    this.enviar('uci')
    this.enviar(`setoption name Threads value ${hilos}`)
    this.enviar('setoption name Hash value 256')
    this.enviar('isready')
  }

  private enviar(c: string) {
    this.proc.stdin.write(c + '\n')
  }

  private esperar(fin: (l: string) => boolean, cada?: (l: string) => void): Promise<void> {
    return new Promise((ok) => {
      this.oyente = (l) => {
        cada?.(l)
        if (fin(l)) ok()
      }
    })
  }

  async analizar(fen: string, multipv = 1): Promise<Analisis> {
    await this.listo
    const clave = `${fen}|${multipv}`
    const previo = this.cache.get(clave)
    if (previo) return previo
    // Borra la tabla hash: si no, el resultado depende de qué posiciones se analizaron antes
    // y una verificación puede pasar o fallar según el orden.
    const limpio = this.esperar((l) => l === 'readyok')
    this.enviar('ucinewgame')
    this.enviar('isready')
    await limpio
    const lineas: { ev: Evaluacion; pv: string[] }[] = []
    let mejor = ''
    const fin = this.esperar(
      (l) => l.startsWith('bestmove'),
      (l) => {
        const s = / score (cp|mate) (-?\d+)/.exec(l)
        const p = / pv (.+)$/.exec(l)
        if (s && p && !l.includes('bound')) {
          const i = Number(/ multipv (\d+)/.exec(l)?.[1] ?? 1) - 1
          lineas[i] = { ev: s[1] === 'cp' ? { cp: Number(s[2]) } : { mate: Number(s[2]) }, pv: p[1].trim().split(' ') }
        }
        if (l.startsWith('bestmove')) mejor = l.split(' ')[1]
      },
    )
    this.enviar(`setoption name MultiPV value ${multipv}`)
    this.enviar(`position fen ${fen}`)
    this.enviar(`go depth ${this.profundidad}`)
    await fin
    const r: Analisis = { ev: lineas[0]?.ev ?? { cp: 0 }, mejor, pv: lineas[0]?.pv ?? [], lineas: lineas.filter(Boolean) }
    this.cache.set(clave, r)
    return r
  }

  /**
   * Pérdida de chances de ganar (escala 0 a 2) de jugar `uci` tras `prefijo`, con la evaluación
   * antes y después desde el lado que mueve, y la mejor línea del rival después. undefined si es ilegal.
   */
  async evaluarJugada(prefijo: string[], uci: string) {
    const fens = fensDeLinea([...prefijo, uci])
    if (fens.length !== prefijo.length + 2) return undefined
    const antes = await this.analizar(fens[fens.length - 2])
    if (antes.mejor === uci) return { perdida: 0, antes: antes.ev, despues: antes.ev, refutacion: antes.pv.slice(1), mejor: antes.mejor }
    const despues = await this.analizar(fens[fens.length - 1])
    const evDespues = invertir(despues.ev)
    return { perdida: chancesDeGanar(antes.ev) - chancesDeGanar(evDespues), antes: antes.ev, despues: evDespues, refutacion: despues.pv, mejor: antes.mejor }
  }

  cerrar() {
    this.enviar('quit')
  }
}
