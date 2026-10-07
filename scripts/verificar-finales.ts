/**
 * Verifica las posiciones del temario de finales (src/contenido/finales/temario.json) contra las
 * tablebases de Lichess (resultado exacto con hasta 7 piezas): el objetivo de cada posición
 * ("ganar" o "tablas", para el bando que mueve) tiene que coincidir con el resultado teórico.
 * Con más de 7 piezas no hay tablebase: se usa Stockfish nativo a profundidad 30 y se exige
 * +3 o más (o mate) para "ganar" y menos de 0,5 en valor absoluto para "tablas".
 * Guarda la mejor jugada y la distancia en el JSON. Termina con código 1 si algo no coincide.
 *
 * Uso: node scripts/verificar-finales.ts            (verifica el temario)
 *      node scripts/verificar-finales.ts "<FEN>" ... (consulta FEN sueltos)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import type { Temario } from '../src/lib/finales/tipos.ts'
import { MotorNativo } from './lib-motor.ts'

const piezas = (fen: string) => fen.split(' ')[0].replace(/[^a-z]/gi, '').length
let motor: MotorNativo | undefined

const RUTA = 'src/contenido/finales/temario.json'
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface RespuestaTablebase {
  category: string
  dtm?: number | null
  dtz?: number | null
  moves: { uci: string; san: string; category: string }[]
}

async function consultar(fen: string): Promise<RespuestaTablebase> {
  for (let intento = 0; intento < 5; intento++) {
    const r = await fetch(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`)
    if (r.status === 429) {
      await espera(60_000)
      continue
    }
    if (!r.ok) throw new Error(`Tablebase ${r.status} para ${fen}`)
    return (await r.json()) as RespuestaTablebase
  }
  throw new Error('La tablebase no responde')
}

const sueltos = process.argv.slice(2)
if (sueltos.length) {
  for (const fen of sueltos) {
    const r = await consultar(fen)
    console.log(`${r.category.padEnd(12)} dtm=${r.dtm ?? '-'} mejores: ${r.moves.slice(0, 3).map((m) => `${m.san}(${m.category})`).join(' ')}  ${fen}`)
    await espera(1100)
  }
  process.exit(0)
}

const temario: Temario = JSON.parse(readFileSync(RUTA, 'utf8'))
let fallas = 0
for (const tema of temario.temas) {
  for (const p of tema.posiciones) {
    if (piezas(p.fen) > 7) {
      motor ??= new MotorNativo(30)
      const a = await motor.analizar(p.fen)
      const ev = a.ev.mate !== undefined ? (a.ev.mate > 0 ? 10000 : -10000) : (a.ev.cp ?? 0)
      const ok = p.objetivo === 'ganar' ? ev >= 300 : Math.abs(ev) < 50
      const texto = a.ev.mate !== undefined ? `mate en ${a.ev.mate}` : (ev / 100).toFixed(2)
      p.verificacion = { ok, resultado: `stockfish ${texto}`, mejor: a.mejor, fecha: new Date().toISOString().slice(0, 10) }
      console.log(`${ok ? '✓' : '✗'} ${tema.id}/${p.id}: objetivo ${p.objetivo}, Stockfish prof. 30 ${texto}, mejor ${a.mejor}`)
      if (!ok) fallas++
      continue
    }
    const r = await consultar(p.fen)
    const esperado = p.objetivo === 'ganar' ? ['win'] : ['draw', 'cursed-win', 'blessed-loss']
    const ok = esperado.includes(r.category)
    p.verificacion = {
      ok,
      resultado: r.category,
      mejor: r.moves[0]?.uci,
      dtm: r.dtm ?? undefined,
      fecha: new Date().toISOString().slice(0, 10),
    }
    console.log(`${ok ? '✓' : '✗'} ${tema.id}/${p.id}: objetivo ${p.objetivo}, tablebase ${r.category}${r.dtm ? ` (mate en ${Math.ceil(Math.abs(r.dtm) / 2)})` : ''}, mejor ${r.moves[0]?.san ?? '-'}`)
    if (!ok) fallas++
    await espera(1100)
  }
}
motor?.cerrar()
writeFileSync(RUTA, JSON.stringify(temario, null, 2) + '\n')
console.log(fallas ? `${fallas} posición(es) no coinciden con su objetivo.` : 'Todas las posiciones verificadas.')
process.exit(fallas ? 1 : 0)
