<script lang="ts">
  import type { Position } from 'chessops/chess'
  import { invertir, textoEvaluacion, type Evaluacion } from '../ajedrez/evaluacion.ts'
  import { aEspanol, clavePosicion, fenDe, jugarUci, lineaSan, posDesdeFen, sanDeUci } from '../ajedrez/posicion.ts'
  import { consultarTablebase, damasDe, revisar, soloRey, type Resultado } from '../finales/juego.ts'
  import type { Objetivo } from '../finales/tipos.ts'
  import { motorInteractivo } from '../motor/motor.ts'
  import { registrarIntento } from '../repaso/repaso.ts'
  import Tablero, { type Flecha } from './Tablero.svelte'

  interface Props {
    fen: string
    objetivo: Objetivo
    consigna: string
    pista?: string
    maxJugadas: number
    /** Si se indica, el resultado entra al repaso espaciado con este id. */
    idRepaso?: string
    alSalir?: () => void
  }
  let { fen: fenInicial, objetivo, consigna, pista, maxJugadas, idRepaso, alSalir }: Props = $props()

  // svelte-ignore state_referenced_locally
  let yo = (fenInicial.split(' ')[1] === 'w' ? 'white' : 'black') as 'white' | 'black'
  // Cada ejercicio monta el componente de nuevo ({#key}): solo importa la posición inicial.
  // svelte-ignore state_referenced_locally
  let pos = $state.raw<Position>(posDesdeFen(fenInicial))
  let historial = $state<string[]>([])
  let jugadas = $state(0)
  let resultado = $state<Resultado>({ estado: 'sigue' })
  let pensando = $state(false)
  let verPista = $state(false)
  let usoPista = $state(false)
  let evMia = $state<Evaluacion>()
  let consejo = $state<string>()
  let mejorTablebase = $state<string>()
  let repeticiones = new Map<string, number>()
  // svelte-ignore state_referenced_locally
  const damasIniciales = damasDe(posDesdeFen(fenInicial), yo)
  // svelte-ignore state_referenced_locally
  const exigirMate = soloRey(posDesdeFen(fenInicial), yo === 'white' ? 'black' : 'white')

  let fen = $derived(fenDe(pos))
  let piezas = $derived(pos.board.occupied.size())
  let enJuego = $derived(resultado.estado === 'sigue')

  function contarRepeticion(p: Position): number {
    const clave = clavePosicion(fenDe(p))
    const n = (repeticiones.get(clave) ?? 0) + 1
    repeticiones.set(clave, n)
    return n
  }
  // svelte-ignore state_referenced_locally
  contarRepeticion(posDesdeFen(fenInicial))

  async function terminarSiCorresponde(p: Position, tablebase?: string): Promise<boolean> {
    const r = revisar(p, { objetivo, yo, jugadas, maxJugadas, damasIniciales, exigirMate, repeticiones: repeticiones.get(clavePosicion(fenDe(p))) ?? 1, evMia, tablebase })
    if (r.estado === 'sigue') return false
    resultado = r
    if (idRepaso) await registrarIntento(idRepaso, r.estado === 'logrado' ? (usoPista ? 'pista' : 'bien') : 'mal')
    return true
  }

  async function alJugar(uci: string) {
    if (!enJuego || pensando || pos.turn !== yo) return
    const antes = pos
    const sig = jugarUci(pos, uci)
    if (!sig) return
    const san = sanDeUci(antes, uci)
    pensando = true
    consejo = undefined
    mejorTablebase = undefined
    // Con conexión y pocas piezas, la tablebase dice al instante si la jugada mantuvo el resultado.
    const [tbAntes, tbDespues] = await Promise.all([
      consultarTablebase(fenDe(antes), piezas),
      consultarTablebase(fenDe(sig), sig.board.occupied.size()),
    ])
    pos = sig
    historial = [...historial, uci]
    jugadas++
    contarRepeticion(sig)
    if (tbAntes && tbDespues) {
      const pierde = objetivo === 'ganar' ? tbDespues.category !== 'loss' && tbDespues.category !== 'maybe-loss' : tbDespues.category === 'win' || tbDespues.category === 'maybe-win'
      if (pierde && tbAntes.moves[0]) mejorTablebase = tbAntes.moves[0].uci
      if (pierde) consejo = `Con ${san} se escapa el resultado. La jugada correcta era ${aEspanol(tbAntes.moves[0].san)}.`
    }
    if (await terminarSiCorresponde(sig, tbDespues?.category)) {
      pensando = false
      return
    }
    await responder(sig)
    pensando = false
  }

  /** El rival juega: con tablebase si hay conexión (juego perfecto), si no con Stockfish. */
  async function responder(p: Position) {
    const tb = await consultarTablebase(fenDe(p), p.board.occupied.size())
    let uci = tb?.moves[0]?.uci
    const r = await motorInteractivo().analizar(fenDe(p), { profundidad: 18, tiempoMs: 1200 })
    evMia = invertir(r.ev)
    uci ??= r.mejor
    if (!uci) return
    await new Promise((ok) => setTimeout(ok, 250))
    const sig = jugarUci(p, uci)
    if (!sig) return
    pos = sig
    historial = [...historial, uci]
    contarRepeticion(sig)
    const tbDespues = await consultarTablebase(fenDe(sig), sig.board.occupied.size())
    await terminarSiCorresponde(sig, tbDespues?.category)
  }

  function reiniciar() {
    pos = posDesdeFen(fenInicial)
    historial = []
    jugadas = 0
    resultado = { estado: 'sigue' }
    evMia = undefined
    consejo = undefined
    mejorTablebase = undefined
    usoPista = false
    verPista = false
    repeticiones = new Map()
    contarRepeticion(posDesdeFen(fenInicial))
    // Si el ejercicio empieza con el rival moviendo (no debería), que juegue.
    if (pos.turn !== yo) responder(pos)
  }

  let flechas = $derived.by((): Flecha[] => (mejorTablebase ? [{ de: mejorTablebase.slice(0, 2), a: mejorTablebase.slice(2, 4), color: 'green' }] : []))
</script>

<div class="final">
  <div>
    <p><b>{consigna}</b></p>
    <p class="suave">
      Objetivo: {objetivo === 'ganar' ? 'ganar' : 'hacer tablas'} · jugás con {yo === 'white' ? 'blancas' : 'negras'} · jugada {jugadas} de {maxJugadas}
      {#if evMia}· Stockfish: {textoEvaluacion(evMia)}{/if}
    </p>
  </div>

  <Tablero {fen} orientacion={yo} puedeMover={enJuego && !pensando ? yo : undefined} ultimaJugada={historial.at(-1)} {flechas} {alJugar} />

  {#if pensando}<p class="suave">Pensando…</p>{/if}
  {#if consejo}<p class="mal">{consejo}</p>{/if}
  {#if resultado.estado !== 'sigue'}
    <p class={resultado.estado === 'logrado' ? 'bien' : 'mal'}><b>{resultado.estado === 'logrado' ? '✓ Logrado' : '✗ No salió'}:</b> {resultado.motivo}</p>
  {/if}
  {#if verPista && pista}<p class="idea">{pista}</p>{/if}

  <div class="fila">
    {#if pista && enJuego}<button class="boton" onclick={() => { verPista = true; usoPista = true }} disabled={verPista}>Pista</button>{/if}
    <button class="boton" onclick={reiniciar}>Empezar de nuevo</button>
    {#if alSalir}<button class="boton enlace" onclick={alSalir}>Volver</button>{/if}
  </div>
  {#if historial.length}
    <p class="suave jugadas">{lineaSan(fenInicial, historial).join(' ')}</p>
  {/if}
  <p class="suave nota">
    {navigator.onLine ? 'Con conexión: el rival juega perfecto con las tablebases de Lichess y cada jugada tuya se verifica al instante.' : 'Sin conexión: el rival juega con Stockfish.'}
  </p>
</div>

<style>
  .final {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .final p {
    margin: 0;
  }
  .bien {
    color: #3f9b4b;
  }
  .mal {
    color: #c9483c;
  }
  .idea {
    border-left: 3px solid var(--acento);
    padding-left: 10px;
  }
  .nota {
    font-size: 0.8rem;
  }
</style>
