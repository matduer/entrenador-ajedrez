/**
 * Verifica con Stockfish las explicaciones de aperturas (src/contenido/aperturas/*.json):
 *  - cada jugada explicada ("por qué sí") tiene que ser legal y no perder más de 0,06 de chances
 *    de ganar respecto de la mejor jugada;
 *  - cada alternativa de "por qué no" tiene que ser legal y perder al menos 0,08;
 *  - las trampas tienen que ser jugables.
 * Guarda el resultado en el campo `verificacion` de cada archivo y termina con código 1 si algo falla.
 *
 * Uso: node scripts/verificar-explicaciones.ts [profundidad] [archivo ...]
 * Motor: variable de entorno STOCKFISH (ruta al ejecutable); por defecto, el que ya estaba instalado.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { textoEvaluacion } from '../src/lib/ajedrez/evaluacion.ts'
import { lineaSan } from '../src/lib/ajedrez/posicion.ts'
import { fensDeLinea } from '../src/lib/aperturas/arbol.ts'
import type { Explicacion, ResultadoVerificacion } from '../src/lib/aperturas/explicaciones.ts'
import { MotorNativo } from './lib-motor.ts'

const PROFUNDIDAD = Number(process.argv[2] ?? 20)
// Una jugada teórica puede no ser la primera del motor: se tolera hasta 0,075 de chances perdidas.
// Un "por qué no" tiene que perder claramente más: al menos 0,08. Los rangos no se superponen.
const TOLERANCIA_SI = 0.075
const MINIMO_NO = 0.08
// Jugadas marcadas como "inferior" (teoría reconocida, algo peor según el motor): hasta 0,15.
const TOLERANCIA_INFERIOR = 0.15
const CARPETA = 'src/contenido/aperturas'
const motor = new MotorNativo(PROFUNDIDAD)
const evaluarJugada = (prefijo: string[], uci: string) => motor.evaluarJugada(prefijo, uci)

let fallas = 0
// Opcional: verificar solo algunos archivos (por nombre, con o sin .json) después de la profundidad.
// Se acepta también la ruta («src/contenido/aperturas/colle.json»): cuenta el nombre. Un nombre que no coincide con
// ningún archivo es un error (antes se ignoraba y el resultado decía «Todo verificado» sin haber verificado nada).
const SOLO = process.argv.slice(3).map((a) => a.split(/[\/]/).pop()!).map((a) => (a.endsWith('.json') ? a : `${a}.json`))
const faltan = SOLO.filter((a) => !readdirSync(CARPETA).includes(a))
if (faltan.length) { console.log(`✗ No existen: ${faltan.join(', ')}`); process.exit(1) }
for (const archivo of readdirSync(CARPETA).filter((f) => f.endsWith('.json') && (!SOLO.length || SOLO.includes(f)))) {
  const ruta = `${CARPETA}/${archivo}`
  const e: Explicacion = JSON.parse(readFileSync(ruta, 'utf8'))
  const resultados: Record<string, ResultadoVerificacion> = {}
  const raiz = e.raiz.split(' ')
  if (fensDeLinea(raiz).length !== raiz.length + 1) {
    console.log(`✗ ${archivo}: la raíz no es legal`)
    fallas++
  }

  for (const [clave, nota] of Object.entries(e.notas)) {
    const ucis = clave.split(' ')
    const prefijo = ucis.slice(0, -1)
    const uci = ucis[ucis.length - 1]
    const sanes = lineaSan(fensDeLinea([])[0], ucis)
    const etiqueta = sanes.join(' ')
    const r = await evaluarJugada(prefijo, uci)
    if (!r) {
      resultados[clave] = { ok: false, detalle: 'Jugada ilegal' }
      console.log(`✗ ${archivo} ${clave}: ilegal`)
      fallas++
      continue
    }
    const ok = r.perdida <= (nota.inferior ? TOLERANCIA_INFERIOR : TOLERANCIA_SI)
    resultados[clave] = {
      ok,
      detalle: ok
        ? nota.inferior && r.perdida > TOLERANCIA_SI
          ? `Stockfish (prof. ${PROFUNDIDAD}) prefiere ${lineaSan(fensDeLinea(prefijo).at(-1)!, [r.mejor])[0]}: ${textoEvaluacion(r.antes)} contra ${textoEvaluacion(r.despues)} (marcada como inferior pero jugable)`
          : `Stockfish (prof. ${PROFUNDIDAD}): ${textoEvaluacion(r.despues)} para el bando que mueve`
        : `Stockfish (prof. ${PROFUNDIDAD}) prefiere ${lineaSan(fensDeLinea(prefijo).at(-1)!, [r.mejor])[0]}: ${textoEvaluacion(r.antes)} contra ${textoEvaluacion(r.despues)}`,
    }
    if (!ok) {
      console.log(`✗ ${archivo} ${etiqueta}: pierde ${r.perdida.toFixed(3)} — ${resultados[clave].detalle}`)
      fallas++
    }
    for (const alt of nota.porQueNo ?? []) {
      const q = await evaluarJugada(prefijo, alt.uci)
      const claveAlt = `${prefijo.join(' ')} ${alt.uci} (por qué no)`
      if (!q) {
        resultados[claveAlt] = { ok: false, detalle: 'Jugada ilegal' }
        console.log(`✗ ${archivo} por qué no ${alt.uci} tras ${prefijo.join(' ')}: ilegal`)
        fallas++
        continue
      }
      const okAlt = q.perdida >= MINIMO_NO
      const fenAlt = fensDeLinea([...prefijo, alt.uci]).at(-1)!
      resultados[claveAlt] = {
        ok: okAlt,
        detalle: `Pierde ${(q.perdida * 50).toFixed(0)} puntos de chances: ${textoEvaluacion(q.antes)} → ${textoEvaluacion(q.despues)}. Refutación: ${lineaSan(fenAlt, q.refutacion.slice(0, 6)).join(' ')}`,
      }
      if (!okAlt) {
        console.log(`✗ ${archivo} por qué no ${lineaSan(fensDeLinea(prefijo).at(-1)!, [alt.uci])[0]} tras ${etiqueta}: solo pierde ${q.perdida.toFixed(3)}`)
        fallas++
      }
    }
  }

  for (const t of e.trampas) {
    const ucis = t.jugadas.split(' ')
    if (fensDeLinea(ucis).length !== ucis.length + 1) {
      console.log(`✗ ${archivo} trampa ilegal: ${t.jugadas}`)
      fallas++
    }
  }

  e.verificacion = { motor: 'Stockfish', profundidad: PROFUNDIDAD, fecha: new Date().toISOString().slice(0, 10), resultados }
  writeFileSync(ruta, JSON.stringify(e, null, 2) + '\n')
  console.log(`${archivo}: ${Object.values(resultados).filter((r) => r.ok).length}/${Object.keys(resultados).length} verificaciones OK`)
}
motor.cerrar()
console.log(fallas ? `${fallas} problema(s): revisar el contenido.` : 'Todo verificado.')
process.exit(fallas ? 1 : 0)
