/**
 * Problemas de libros con una sola jugada guardada (Polgár, «Chess: 5334 Problems…», da solo la jugada clave de los
 * mates en dos y de las combinaciones): se les agrega la continuación de Stockfish (la mejor defensa y el remate), para
 * que en la app se juegue la línea entera. Solo si después de la jugada clave la ventaja sigue siendo decisiva (mate, o
 * al menos +2), y la línea termina en una jugada del que resuelve: 3 medias jugadas en «#2», hasta 5 en el resto, o
 * antes si llega al mate. No se tocan los mates en uno ni los estudios («White draws», «White wins»), donde la línea
 * del motor puede no ser la del autor.
 *
 * Uso: node scripts/alargar-problemas-libros.ts [profundidad=18] → reescribe public/datos/problemas-libros.json
 * SECO=1: solo cuenta.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { posDesdeFen, jugarUci, fenDe } from '../src/lib/ajedrez/posicion.ts'
import { MotorNativo } from './lib-motor.ts'

const RUTA = 'public/datos/problemas-libros.json'
interface Problema { id: string; fen: string; jugadas: string[]; temas: string[]; fuente: { titulo: string; capitulo?: string } }
const problemas: Problema[] = JSON.parse(readFileSync(RUTA, 'utf8'))
const prof = Number(process.argv[2] ?? 18)
const motor = new MotorNativo(prof, 4)

const candidatos = problemas.filter((p) =>
  p.jugadas.length === 1 && p.fuente.titulo.startsWith('László Polgár — Chess') && !p.temas.includes('mateIn1') &&
  !/cap\. 1\.|cap\. 5\./.test(p.fuente.capitulo ?? ''))
console.log(candidatos.length, 'problemas para alargar')
const cuenta: Record<string, number> = {}
const anotar = (k: string) => (cuenta[k] = (cuenta[k] ?? 0) + 1)
let k = 0
for (const p of candidatos) {
  if (++k % 100 === 0) console.log(k, cuenta)
  const tras = jugarUci(posDesdeFen(p.fen), p.jugadas[0])
  if (!tras) { anotar('jugada ilegal'); continue }
  if (tras.isCheckmate()) { anotar('ya es mate'); continue }
  const a = await motor.analizar(fenDe(tras))
  // la evaluación es desde el bando que mueve, el rival: decisiva para el que resuelve si es negativa
  const decisiva = a.ev.mate !== undefined ? a.ev.mate < 0 : (a.ev.cp ?? 0) <= -200
  if (!decisiva || a.pv.length < 2) { anotar('no decisiva'); continue }
  const maximo = /#2/.test(p.fuente.capitulo ?? '') ? 3 : 5
  // Medias jugadas de la continuación: rival, propia, rival, propia… hasta llegar al mate o al máximo, terminando en propia.
  const resto: string[] = []
  let pos = tras
  for (const u of a.pv) {
    if (1 + resto.length >= maximo) break
    const sig = jugarUci(pos, u)
    if (!sig) break
    resto.push(u)
    pos = sig
    if (sig.isCheckmate()) break
  }
  if (resto.length % 2 === 1) resto.pop() // la última, propia
  if (!resto.length) { anotar('línea corta'); continue }
  p.jugadas = [p.jugadas[0], ...resto]
  anotar(`alargado a ${p.jugadas.length}`)
}
motor.cerrar()
console.log(cuenta)
if (!process.env.SECO) writeFileSync(RUTA, JSON.stringify(problemas))
