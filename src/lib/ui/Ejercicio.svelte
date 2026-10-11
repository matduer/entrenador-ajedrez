<script lang="ts">
  import { chancesDeGanar, invertir, NOMBRE_CLASIFICACION, textoEvaluacion, type Evaluacion } from '../ajedrez/evaluacion.ts'
  import { NOMBRE_FASE } from '../ajedrez/fase.ts'
  import { fenDe, jugarUci, posDesdeFen, sanDeUci } from '../ajedrez/posicion.ts'
  import { detectarMotivoError, type MotivoError } from '../ajedrez/temas.ts'
  import type { ErrorPartida, Partida } from '../datos/tipos.ts'
  import { motorInteractivo } from '../motor/motor.ts'
  import { registrarIntento, type ResultadoIntento } from '../repaso/repaso.ts'
  import { Exploracion } from './exploracion.svelte.ts'
  import Navegacion from './Navegacion.svelte'
  import PanelMotor from './PanelMotor.svelte'
  import Tablero, { type Flecha } from './Tablero.svelte'
  import VisorLinea, { type Linea } from './VisorLinea.svelte'

  interface Props {
    error: ErrorPartida
    partida?: Partida
    alSeguir: (resultado: ResultadoIntento) => void
  }

  let { error, partida, alSeguir }: Props = $props()

  /** Una jugada distinta de la del motor cuenta como correcta si pierde menos que esto de chances de ganar. */
  const TOLERANCIA = 0.06

  type Estado = 'resolver' | 'verificando' | 'resuelto'
  interface Intento {
    uci: string
    san: string
    correcta: boolean
    evMia?: Evaluacion
    refutacion: string[]
    fenDespues: string
    motivo: MotivoError[]
  }

  let estado = $state<Estado>('resolver')
  let resultado = $state<ResultadoIntento>()
  let usoPista = $state(false)
  let intento = $state<Intento>()
  let linea = $state<Linea>()
  let vista = $state<{ fen: string; ultima?: string; proxima?: string }>()
  // Después de resolver, el tablero queda libre para analizar.
  let ex = $state<Exploracion>()
  let mejorMotor = $state<string>()

  let rival = $derived(partida ? (error.miColor === 'white' ? partida.negras : partida.blancas) : undefined)
  let jugadaAnterior = $derived(partida && error.ply > 0 ? partida.jugadas[error.ply - 1] : undefined)
  let colorTexto = $derived(error.miColor === 'white' ? 'blancas' : 'negras')
  let sanMejor = $derived(sanDeUci(posActual(), error.mejor))
  let sanJugada = $derived(sanDeUci(posActual(), error.jugada))
  let fenTrasJugada = $derived(fenDe(jugarUci(posActual(), error.jugada)!))
  let enlace = $derived.by(() => {
    if (!partida?.url) return undefined
    return partida.fuente === 'lichess' ? `${partida.url}#${error.ply}` : partida.url
  })

  /** Posición nueva en cada llamada: chessops muta las posiciones al jugar. */
  function posActual() {
    return posDesdeFen(error.fen)
  }

  let flechas = $derived.by((): Flecha[] => {
    const f: Flecha[] = []
    if (mejorMotor) f.push({ de: mejorMotor.slice(0, 2), a: mejorMotor.slice(2, 4), color: 'blue' })
    if (linea && vista?.proxima) f.push({ de: vista.proxima.slice(0, 2), a: vista.proxima.slice(2, 4), color: 'blue' })
    else if (estado === 'resolver' && usoPista) f.push({ de: error.mejor.slice(0, 2), color: 'green' })
    return f
  })

  function terminar(r: ResultadoIntento) {
    resultado = r
    estado = 'resuelto'
    registrarIntento(error.id, r)
    // Tablero de análisis: tu jugada si estaba bien, o la línea de la solución si no.
    ex = intento?.correcta ? new Exploracion(error.fen, [intento.uci], 1) : new Exploracion(error.fen, [...error.lineaMejor], 0)
  }

  async function alJugar(uci: string) {
    if (estado === 'resuelto') {
      ex?.jugar(uci)
      return
    }
    if (estado !== 'resolver') return
    const pos = posActual()
    const despues = jugarUci(pos, uci)
    if (!despues) return
    const san = sanDeUci(pos, uci)
    const fenDespues = fenDe(despues)
    const base = { uci, san, fenDespues, refutacion: [] as string[], motivo: [] as MotivoError[] }

    if (uci === error.mejor || despues.isCheckmate()) {
      intento = { ...base, correcta: true }
      terminar(usoPista ? 'pista' : 'bien')
      return
    }

    estado = 'verificando'
    vista = { fen: fenDespues, ultima: uci }
    const r = await motorInteractivo().analizar(fenDespues, { profundidad: 14, tiempoMs: 4000 })
    const evMia = invertir(r.ev)
    const correcta = uci !== error.jugada && chancesDeGanar(error.evalAntes) - chancesDeGanar(evMia) <= TOLERANCIA
    intento = { ...base, correcta, evMia, refutacion: r.linea, motivo: correcta ? [] : detectarMotivoError(fenDespues, r.linea, r.ev) }
    vista = undefined
    if (correcta) {
      terminar(usoPista ? 'pista' : 'bien')
    } else {
      terminar('mal')
      verLinea({ titulo: `Por qué no ${san}: así responde el rival`, fen: fenDespues, ucis: r.linea })
    }
  }

  function verLinea(l: Linea) {
    linea = l
  }

  function cerrarLinea() {
    linea = undefined
    vista = undefined
  }

  // Tablero: posición de la línea que se está viendo, o la del ejercicio.
  let fenTablero = $derived(linea && vista ? vista.fen : estado === 'resuelto' && ex ? ex.fen : (vista?.fen ?? error.fen))
  let ultimaTablero = $derived(linea && vista ? vista.ultima : estado === 'resuelto' && ex ? ex.ultima : (vista?.ultima ?? jugadaAnterior))

  function nombreMotivo(m: string): string {
    return m.charAt(0).toUpperCase() + m.slice(1)
  }
</script>

<article class="ejercicio juego">
  <div class="col-tablero">
    <Tablero
      fen={fenTablero}
      orientacion={error.miColor}
      puedeMover={estado === 'resolver' ? error.miColor : estado === 'resuelto' && ex && !linea ? ex.turno : undefined}
      ultimaJugada={ultimaTablero}
      {flechas}
      {alJugar}
    />
  </div>

  <aside class="panel">
    <header>
      <div class="consigna">
        {#if estado === 'resuelto'}
          {#if intento?.correcta}
            <strong class="bien">✓ {intento.san}{intento.uci !== error.mejor ? ' también sirve' : ''}</strong>
          {:else if intento}
            <strong class="mal">✗ {intento.san} no sirve</strong>
          {:else}
            <strong>Solución</strong>
          {/if}
        {:else if estado === 'verificando'}
          Verificando {intento?.san ?? ''} con Stockfish…
        {:else}
          Jugás con {colorTexto}: encontrá la mejor jugada.
        {/if}
      </div>
      <div class="contexto">
        {[rival && `Contra ${rival}`, new Date(error.fecha).toLocaleDateString('es-AR'), `jugada ${error.numeroJugada}`, NOMBRE_FASE[error.fase]]
          .filter(Boolean)
          .join(' · ')}
      </div>
    </header>

    {#if estado === 'resuelto'}
      <button class="boton principal siguiente" onclick={() => alSeguir(resultado!)}>Siguiente →</button>
    {/if}

    {#if estado === 'resolver'}
      <div class="acciones">
        <button class="boton" onclick={() => (usoPista = true)} disabled={usoPista}>Pista: qué pieza mover</button>
        <button class="boton" onclick={() => terminar('mal')}>No sé, mostrame</button>
      </div>
    {/if}

    {#if estado === 'resuelto'}
      <section class="explicacion">
        {#if intento && !intento.correcta && intento.evMia}
          <p>
            Después de {intento.san} la evaluación (desde tu lado) pasa de <b>{textoEvaluacion(error.evalAntes)}</b> a
            <b>{textoEvaluacion(intento.evMia)}</b>{#if intento.motivo.length}: {intento.motivo.join(', ')}{/if}.
          </p>
        {/if}

        <p>
          La mejor era <b>{sanMejor}</b> ({textoEvaluacion(error.evalAntes)}).
          {#if error.temas.length}
            <span class="etiquetas">{#each error.temas as t (t)}<span class="etiqueta">{nombreMotivo(t)}</span>{/each}</span>
          {/if}
        </p>

        <p class="partida">
          En la partida jugaste <b>{sanJugada}</b> — {NOMBRE_CLASIFICACION[error.clasificacion].toLowerCase()}:
          de {textoEvaluacion(error.evalAntes)} a {textoEvaluacion(error.evalDespues)}{#if error.motivo.length}{' '}({error.motivo.join(', ')}){/if}.
          {#if enlace}<a href={enlace} target="_blank" rel="noopener">Ver la partida</a>{/if}
        </p>

        {#if ex && !linea}<Navegacion {ex} />{/if}

        <div class="acciones">
          {#if intento && !intento.correcta && intento.refutacion.length}
            <button class="boton" onclick={() => verLinea({ titulo: `Por qué no ${intento!.san}`, fen: intento!.fenDespues, ucis: intento!.refutacion })}>
              Por qué no {intento.san}
            </button>
          {/if}
          <button class="boton" onclick={() => { cerrarLinea(); ex = new Exploracion(error.fen, [...error.lineaMejor], 0) }}>
            Ver la solución
          </button>
          <button class="boton" onclick={() => verLinea({ titulo: `Por qué no ${sanJugada} (tu jugada)`, fen: fenTrasJugada, ucis: error.refutacion })}>
            Por qué no {sanJugada}
          </button>
        </div>

        {#if linea}
          <VisorLinea {linea} alMover={(fen, ultima, proxima) => (vista = { fen, ultima, proxima })} />
          <button class="boton enlace" onclick={cerrarLinea}>Volver al tablero de análisis</button>
        {:else}
          <p class="suave nota">Podés mover las piezas de los dos colores para analizar (← y → recorren la línea).</p>
        {/if}
      </section>
    {/if}

    <PanelMotor
      fen={fenTablero}
      bind:mejor={mejorMotor}
      alPrender={() => { if (estado !== 'resuelto') usoPista = true }}
      aviso={estado !== 'resuelto' ? 'Prenderlo antes de resolver cuenta como pista.' : undefined}
    />
  </aside>
</article>

<style>
  .juego {
    display: grid;
    gap: 16px;
  }
  @media (min-width: 1000px) {
    .juego {
      grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr);
      align-items: start;
    }
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .siguiente {
    font-size: 1.05rem;
    padding: 10px;
  }
  .nota {
    font-size: 0.8rem;
  }
  .consigna {
    font-size: 1.05rem;
  }
  .contexto {
    color: var(--texto-suave);
    font-size: 0.85rem;
  }
  .bien {
    color: #3f9b4b;
  }
  .mal {
    color: #c9483c;
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .explicacion {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .explicacion p {
    margin: 0;
  }
  .partida {
    color: var(--texto-suave);
  }
  .etiquetas {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-left: 4px;
  }
  .explicacion :global(.enlace) {
    align-self: flex-start;
  }
</style>
