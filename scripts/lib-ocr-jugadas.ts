/**
 * Reconstrucción de jugadas a partir de texto de OCR con las figuras ilegibles ("lLlc3", ".td6", "'iVc2", "dxC4", "bs").
 * De cada jugada se rescata lo seguro —casilla de destino, si es captura, enroque, coronación— y una pista de pieza
 * cuando el OCR la deja reconocible; se acepta solo si exactamente una jugada legal es compatible. Si no, la partida
 * se corta ahí (mejor una partida menos que una jugada inventada).
 */
import { makeSan } from 'chessops/san'
import type { Chess } from 'chessops/chess'
import { makeSquare, parseSquare } from 'chessops/util'
import type { Move, NormalMove, Role } from 'chessops/types'
import { uciEstandar } from '../src/lib/ajedrez/posicion.ts'

/** Pistas de pieza que el OCR deja más o menos estables (Everyman, Russell, etc.). Orden: de más largo a más corto. */
const PISTAS: [RegExp, Role][] = [
  [/c;\.?t>|<it>|r;t>|@|ifl'|ifl</, 'king'],
  [/'iV|'iW|'iY|'i'|Wi|W|Y|tN|'lP!|'lN|iN|'f!i|\\W/, 'queen'],
  [/lLl|tLl|ttJ|liJ|tiJ|tbJ|tD|tb|§|\.�\)|�\)|CiJ|ll\)|tt:J|LLl|lb|ltJ|N/, 'knight'],
  [/il\.|iL|i\.|\.t|\.i|Jt|A|�\.|J\./, 'bishop'],
  [/:|l"!|\.E!|l:t|1:\[|:t|�\.|R/, 'rook'],
]

export interface Leida { destino: string; captura: boolean; enroque?: 'corto' | 'largo'; corona?: Role; pieza?: Role; peon: boolean; origenColumna?: string; origen?: string }

const DIGITO: Record<string, string> = { S: '5', s: '5', l: '1', I: '1', i: '1', O: '0', o: '0', B: '8', Z: '2', z: '2', G: '6', b: '6', g: '9' }

/** Interpreta un token de jugada de OCR. undefined si no se reconoce una casilla. */
export function leer(token: string): Leida | undefined {
  let t = token.replace(/[!?+#]+$/g, '').replace(/[!?]+/g, '').trim()
  if (/^[0O]-[0O](-[0O])?$/.test(t)) return { destino: '', captura: false, enroque: t.length > 3 ? 'largo' : 'corto', peon: false }
  let corona: Role | undefined
  const c = /=?([QRBN])$/.exec(t)
  if (c && /[1-8]=?[QRBN]$/.test(t)) {
    corona = ({ Q: 'queen', R: 'rook', B: 'bishop', N: 'knight' } as const)[c[1] as 'Q']
    t = t.slice(0, t.length - c[0].length)
  }
  // La casilla está al final: columna a-h (el OCR a veces la pone en mayúscula) y fila 1-8 (o una letra parecida).
  const m = /([a-hA-Ht])([1-8SslIOoBZzGb])$/.exec(t)
  if (!m) return undefined
  const fila = /[1-8]/.test(m[2]) ? m[2] : DIGITO[m[2]]
  if (!fila || fila === '0' || fila === '9') return undefined
  const destino = (m[1] === 't' ? 'f' : m[1].toLowerCase()) + fila
  const antes = t.slice(0, t.length - m[0].length)
  const captura = /x/i.test(antes)
  const sinX = antes.replace(/x/gi, '')
  // Peón: lo que queda antes es vacío o una columna (exd5).
  const peon = sinX === '' || /^[a-h]$/.test(sinX)
  let pieza: Role | undefined
  if (!peon) for (const [re, r] of PISTAS) if (re.test(sinX)) { pieza = r; break }
  const origenColumna = peon && sinX ? sinX : undefined
  // Desambiguación de pieza ("Cbd7", "T1e1"): el último carácter, si es columna o fila. Se usa solo como filtro
  // opcional, porque también puede ser parte de la figura mal leída ("tbf3").
  const origen = !peon && /[a-h1-8]$/.test(sinX) ? sinX.slice(-1) : undefined
  return { destino, captura, enroque: undefined, corona, pieza, peon, origenColumna, origen }
}

/** La única jugada legal compatible con lo leído, o undefined. */
export function elegir(pos: Chess, l: Leida): NormalMove | undefined {
  const cands: NormalMove[] = []
  const dests = pos.allDests()
  for (const [desde, hacia] of dests) {
    for (const to of hacia) {
      const pieza = pos.board.get(desde)!
      const mv: NormalMove = { from: desde, to }
      if (l.enroque) {
        if (pieza.role !== 'king') continue
        const salto = (to % 8) - (desde % 8)
        // chessops representa el enroque como rey a torre
        const torre = pos.board.get(to)
        if (!(torre && torre.role === 'rook' && torre.color === pieza.color) && Math.abs(salto) !== 2) continue
        const largo = (to % 8) < (desde % 8)
        if (largo !== (l.enroque === 'largo')) continue
        cands.push(mv)
        continue
      }
      const enDestino = pos.board.get(to)
      if (enDestino && enDestino.color === pieza.color) continue // enroque, no es esta lectura
      if (makeSquare(to) !== l.destino) continue
      const esCaptura = !!enDestino || (pieza.role === 'pawn' && (to % 8) !== (desde % 8))
      if (esCaptura !== l.captura) continue
      if (l.peon ? pieza.role !== 'pawn' : pieza.role === 'pawn') continue
      if (l.origenColumna && makeSquare(desde)[0] !== l.origenColumna) continue
      if (pieza.role === 'pawn' && (l.destino[1] === '8' || l.destino[1] === '1')) mv.promotion = l.corona ?? 'queen'
      cands.push(mv)
    }
  }
  if (cands.length <= 1) return cands[0]
  // Varias: primero la pista de pieza, después la de origen; cada filtro se aplica solo si deja alguna.
  let quedan = cands
  for (const filtro of [
    (m: NormalMove) => !l.pieza || pos.board.get(m.from)!.role === l.pieza,
    (m: NormalMove) => !l.origen || makeSquare(m.from).includes(l.origen),
  ]) {
    const f = quedan.filter(filtro)
    if (f.length) quedan = f
  }
  return quedan.length === 1 ? quedan[0] : undefined
}

/** Reconstruye una lista de tokens de OCR. Devuelve las jugadas en UCI hasta donde se pudo y, si se cortó, dónde. */
export function reconstruir(pos: Chess, tokens: string[]): { ucis: string[]; sans: string[]; corte?: { i: number; token: string } } {
  const ucis: string[] = []
  const sans: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const l = leer(tokens[i])
    const mv = l && elegir(pos, l)
    if (!mv) return { ucis, sans, corte: { i, token: tokens[i] } }
    sans.push(makeSan(pos, mv as Move))
    ucis.push(uciEstandar(pos, mv as Move))
    pos.play(mv as Move)
  }
  return { ucis, sans }
}

export { parseSquare }
