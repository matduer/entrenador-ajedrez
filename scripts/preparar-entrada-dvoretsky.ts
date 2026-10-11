/**
 * Dvoretsky, *El arte de maniobrar con las piezas*: arma img/dvoretsky_entrada.json para
 * preparar-problemas-imagen.ts a partir de los tableros reconocidos (dvoretsky_fen.json) y del texto que
 * sigue a cada diagrama (dvoretsky_seguidos.json, de datos-privados/biblioteca/dvoretsky.py).
 *
 * Un ejercicio es el primer diagrama de cada encabezado «N-M Jugadores» con consigna «W?» (juegan blancas)
 * o «¿SI?» (juegan negras). La jugada del libro es la primera del bando que mueve en la solución, preferida
 * la marcada con «!». La traducción mezcla notación española e inglesa («Td8», «Qa5», «Rd2» puede ser rey
 * o torre): se prueban todas las piezas posibles y se acepta solo si hay una única jugada legal compatible.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { makeSan } from 'chessops/san'
import { parseSquare } from 'chessops/util'
import { posDesdeFen } from '../src/lib/ajedrez/posicion.ts'

const DIR = 'datos-privados/biblioteca/img'
const fens: { pagina: number; arriba: string | null; abajo: string; tablero: string }[] = JSON.parse(readFileSync(`${DIR}/dvoretsky_fen.json`, 'utf8'))
const seguidos: string[] = JSON.parse(readFileSync(`${DIR}/dvoretsky_seguidos.json`, 'utf8'))

const PIEZAS: Record<string, string[]> = { T: ['rook'], A: ['bishop'], C: ['knight'], D: ['queen'], R: ['king', 'rook'], B: ['bishop'], N: ['knight'], Q: ['queen'], K: ['king'] }
const JUGADA = '([TACDRBNQK]?[a-h]?[1-8]?x?[a-h][1-8](?:=[TACDQRBN])?|O-O-O|O-O)'

function candidatas(texto: string, color: 'w' | 'b'): string[] {
  const re = color === 'w' ? new RegExp(`(?<![\\d.])\\d+\\.\\s*${JUGADA}\\s*(!!|!\\?|\\?!|!|\\?)?`, 'g') : new RegExp(`\\d+\\s*\\.\\.\\.\\s*${JUGADA}\\s*(!!|!\\?|\\?!|!|\\?)?`, 'g')
  const todas = [...texto.matchAll(re)].filter((m) => m[2] !== '?' && m[2] !== '?!')
  const conBien = todas.filter((m) => m[2] === '!' || m[2] === '!!')
  return (conBien.length ? conBien : todas).map((m) => m[1])
}

/** La única jugada legal compatible con el texto («Td8», «Rd2», «exd5»…), en SAN inglés. */
function resolver(fen: string, txt: string): string | undefined {
  const pos = posDesdeFen(fen)
  const enroque = txt.startsWith('O-O')
  const m = enroque ? null : txt.match(/^([TACDRBNQK]?)([a-h]?)([1-8]?)x?([a-h][1-8])(?:=([TACDQRBN]))?$/)
  if (!enroque && !m) return
  const roles = m?.[1] ? PIEZAS[m[1]] : ['pawn']
  const sirven: string[] = []
  for (const [desde, destinos] of pos.allDests()) {
    const pieza = pos.board.get(desde)!
    for (const hasta of destinos) {
      const san = makeSan(pos, { from: desde, to: hasta, promotion: m?.[5] ? (({ D: 'queen', Q: 'queen', T: 'rook', R: 'rook', A: 'bishop', B: 'bishop', C: 'knight', N: 'knight' }) as const)[m[5] as 'D'] : undefined })
      if (enroque) {
        if (san.replace(/[+#]/, '') === txt) sirven.push(san)
        continue
      }
      if (!roles.includes(pieza.role) || hasta !== parseSquare(m![4])) continue
      const archivo = 'abcdefgh'[desde % 8], fila = String(Math.floor(desde / 8) + 1)
      if ((m![2] && m![2] !== archivo) || (m![3] && m![3] !== fila)) continue
      sirven.push(san)
    }
  }
  const unicas = [...new Set(sirven)]
  return unicas.length === 1 ? unicas[0] : undefined
}

const vistos = new Set<string>()
const entradas: unknown[] = []
const cuenta: Record<string, number> = {}
for (const [k, f] of fens.entries()) {
  const enc = f.arriba?.match(/^(\d+)-(\d+)\s+(.+)$/)
  const color = /^W\?/.test(f.abajo) ? 'w' : /^.SI\?/.test(f.abajo) ? 'b' : undefined
  if (!enc || !color || vistos.has(enc[1] + '-' + enc[2])) continue
  vistos.add(enc[1] + '-' + enc[2])
  const fen = `${f.tablero} ${color} - - 0 1`
  let san: string | undefined
  try {
    // La solución empieza después de «Mostrar / ocultar la solución».
    const sol = seguidos[k].split(/Mostrar \/ ocultar la soluci.n/)[1] ?? ''
    for (const c of candidatas(sol, color)) if ((san = resolver(fen, c))) break
  } catch {
    cuenta['tablero ilegal'] = (cuenta['tablero ilegal'] ?? 0) + 1
    continue
  }
  if (!san) { cuenta['sin jugada legible'] = (cuenta['sin jugada legible'] ?? 0) + 1; continue }
  cuenta['ok'] = (cuenta['ok'] ?? 0) + 1
  const jug = enc[3].replace(/\s+-\s+/, '–').trim()
  entradas.push({ n: Number(enc[1]) * 100 + Number(enc[2]), clave: `${enc[1]}-${enc[2]}`, color, tableros: [f.tablero], san, etiqueta: `ej. ${enc[1]}-${enc[2]} (${jug})` })
}
writeFileSync(`${DIR}/dvoretsky_entrada.json`, JSON.stringify(entradas, null, 1))
console.log(vistos.size, 'ejercicios', cuenta)
