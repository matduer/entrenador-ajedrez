<script lang="ts">
  import { chancesDeGanar, invertir, textoEvaluacion } from '../ajedrez/evaluacion.ts'
  import { fenDe, jugarUci, posDesdeFen, sanDeUci } from '../ajedrez/posicion.ts'
  import { detectarMotivoError } from '../ajedrez/temas.ts'
  import type { Position } from 'chessops/chess'
  import { motorInteractivo } from '../motor/motor.ts'
  import { idRepaso, nombreTema, type Problema } from '../problemas/problemas.ts'
  import { registrarIntento, type ResultadoIntento } from '../repaso/repaso.ts'
  import Tablero, { type Flecha } from './Tablero.svelte'
  import VisorLinea, { type Linea } from './VisorLinea.svelte'

  interface Props {
    problema: Problema
    alSeguir: (r: ResultadoIntento) => void
  }
  let { problema, alSeguir }: Props = $props()

  // Posiciones a lo largo de la solución: fens[0] es antes de la jugada del rival que plantea el problema.
  let fens = $derived.by(() => {
    const lista = [problema.fen]
    let pos: Position = posDesdeFen(problema.fen)
    for (const u of problema.jugadas) {
      const sig = jugarUci(pos, u)
      if (!sig) break
      pos = sig
      lista.push(fenDe(pos))
    }
    return lista
  })
  let miColor = $derived<'white' | 'black'>(fens[1]?.split(' ')[1] === 'w' ? 'white' : 'black')

  let paso = $state(0) // cantidad de jugadas de la solución ya jugadas
  let estado = $state<'inicio' | 'resolver' | 'verificando' | 'resuelto'>('inicio')
  let resultado = $state<ResultadoIntento>()
  let pista = $state(false)
  let mensaje = $state('')
  let linea = $state<Linea>()
  let vista = $state<{ fen: string; ultima?: string; proxima?: string }>()

  // La jugada del rival se muestra animada después de un momento.
  $effect(() => {
    const t = setTimeout(() => {
      paso = 1
      estado = 'resolver'
    }, 700)
    return () => clearTimeout(t)
  })

  function terminar(r: ResultadoIntento) {
    resultado = r
    estado = 'resuelto'
    registrarIntento(idRepaso(problema), r)
  }

  async function alJugar(uci: string) {
    if (estado !== 'resolver') return
    const esperada = problema.jugadas[paso]
    const pos = posDesdeFen(fens[paso])
    const despues = jugarUci(pos, uci)
    if (!despues) return
    const san = sanDeUci(pos, uci)

    if (uci === esperada || despues.isCheckmate()) {
      mensaje = `✓ ${san}`
      if (despues.isCheckmate() || paso + 1 >= problema.jugadas.length) {
        paso = problema.jugadas.length
        terminar(pista ? 'pista' : 'bien')
        return
      }
      paso++
      setTimeout(() => (paso = Math.min(paso + 1, problema.jugadas.length)), 450)
      return
    }

    estado = 'verificando'
    mensaje = `Verificando ${san}…`
    const fenDespues = fenDe(despues)
    const m = motorInteractivo()
    const antes = await m.analizar(fens[paso], { profundidad: 14 })
    const r = await m.analizar(fenDespues, { profundidad: 14 })
    const evMia = invertir(r.ev)
    const motivo = detectarMotivoError(fenDespues, r.linea, r.ev)
    const perdida = chancesDeGanar(antes.ev) - chancesDeGanar(evMia)
    mensaje = `✗ ${san}: de ${textoEvaluacion(antes.ev)} a ${textoEvaluacion(evMia)}${motivo.length ? ` (${motivo.join(', ')})` : ''}.${perdida < 0.1 ? ' No pierde mucho, pero no es la solución del problema.' : ''}`
    linea = { titulo: `Por qué no ${san}`, fen: fenDespues, ucis: r.linea }
    terminar('mal')
  }

  let fenTablero = $derived(linea && vista ? vista.fen : fens[paso])
  let ultima = $derived(linea && vista ? vista.ultima : paso > 0 ? problema.jugadas[paso - 1] : undefined)
  let flechas = $derived.by((): Flecha[] => {
    if (linea && vista?.proxima) return [{ de: vista.proxima.slice(0, 2), a: vista.proxima.slice(2, 4), color: 'blue' }]
    if (estado === 'resolver' && pista) return [{ de: problema.jugadas[paso].slice(0, 2), color: 'green' }]
    return []
  })
  let titulo = $derived(estado === 'resuelto' ? (resultado === 'mal' ? 'No era esa' : '¡Resuelto!') : `Jugás con ${miColor === 'white' ? 'blancas' : 'negras'}: encontrá la mejor jugada.`)
</script>

<article class="problema">
  <header>
    <div class="consigna"><b class:bien={estado === 'resuelto' && resultado !== 'mal'} class:mal={resultado === 'mal'}>{titulo}</b></div>
    <div class="suave">Problema de Lichess · rating {problema.rating}</div>
  </header>

  <Tablero fen={fenTablero} orientacion={miColor} puedeMover={estado === 'resolver' ? miColor : undefined} ultimaJugada={ultima} {flechas} {alJugar} />

  {#if mensaje}<p>{mensaje}</p>{/if}

  {#if estado === 'resolver'}
    <div class="fila">
      <button class="boton" onclick={() => (pista = true)} disabled={pista}>Pista</button>
      <button class="boton" onclick={() => terminar('mal')}>Ver la solución</button>
    </div>
  {/if}

  {#if estado === 'resuelto'}
    <div class="etiquetas">{#each problema.temas.filter((t) => !['short', 'long', 'oneMove', 'veryLong', 'middlegame', 'endgame', 'opening', 'advantage', 'crushing', 'master', 'masterVsMaster', 'superGM'].includes(t)) as t (t)}<span class="etiqueta">{nombreTema(t)}</span>{/each}</div>
    <div class="fila">
      <button class="boton" onclick={() => (linea = { titulo: 'Solución', fen: fens[1], ucis: problema.jugadas.slice(1) })}>Ver la solución</button>
      <a class="boton enlace" href={`https://lichess.org/training/${problema.id}`} target="_blank" rel="noopener">Ver en Lichess</a>
    </div>
    {#if linea}
      <VisorLinea {linea} alMover={(f, u, p) => (vista = { fen: f, ultima: u, proxima: p })} />
    {/if}
    <button class="boton principal" onclick={() => alSeguir(resultado!)}>Siguiente</button>
  {/if}
</article>

<style>
  .problema {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .problema p {
    margin: 0;
  }
  .bien {
    color: #3f9b4b;
  }
  .mal {
    color: #c9483c;
  }
  .etiquetas {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
</style>
