<script lang="ts">
  import { chancesDeGanar, invertir, textoEvaluacion } from '../ajedrez/evaluacion.ts'
  import { fenDe, jugarUci, lineaConNumeros, posDesdeFen, sanDeUci } from '../ajedrez/posicion.ts'
  import { detectarMotivoError } from '../ajedrez/temas.ts'
  import type { Position } from 'chessops/chess'
  import { motorInteractivo } from '../motor/motor.ts'
  import { esDeLibro, idRepaso, nombreTema, type Problema } from '../problemas/problemas.ts'
  import { registrarIntento, type ResultadoIntento } from '../repaso/repaso.ts'
  import { Exploracion } from './exploracion.svelte.ts'
  import Navegacion from './Navegacion.svelte'
  import PanelMotor from './PanelMotor.svelte'
  import Tablero, { type Flecha } from './Tablero.svelte'
  import VisorLinea, { type Linea } from './VisorLinea.svelte'

  interface Props {
    problema: Problema
    alSeguir: (r: ResultadoIntento) => void
  }
  let { problema, alSeguir }: Props = $props()

  /** Una jugada propia fuera de la línea del libro vale si gana igual: pierde menos que esto de chances. */
  const TOLERANCIA = 0.03
  const TEMAS_OCULTOS = ['short', 'long', 'oneMove', 'veryLong', 'middlegame', 'endgame', 'opening', 'advantage', 'crushing', 'master', 'masterVsMaster', 'superGM']

  // En los problemas de libros no hay jugada previa del rival: se resuelve desde la posición inicial.
  let libro = $derived(esDeLibro(problema))
  let inicio = $derived(libro ? 0 : 1)
  let total = $derived(problema.jugadas.length)

  // Jugadas hechas desde problema.fen (incluye la del rival que plantea el problema de Lichess).
  let hist = $state<string[]>([])
  // Media jugada desde la que se dejó la línea del libro con una alternativa que también gana.
  let desvio = $state<number>()
  let estado = $state<'inicio' | 'resolver' | 'verificando' | 'error' | 'resuelto'>('inicio')
  let resultado = $state<ResultadoIntento>()
  let pista = $state(false)
  // Se equivocó al menos una vez: para el repaso cuenta como fallado, aunque después termine la línea.
  let fallado = $state(false)
  let mensaje = $state('')
  let linea = $state<Linea>()
  let vista = $state<{ fen: string; ultima?: string; proxima?: string }>()
  // La jugada equivocada queda a la vista hasta volver a intentar.
  let tentativa = $state<{ fen: string; uci: string; porQue?: Linea }>()
  // Después de resolver (o de pedir la solución), el tablero queda libre para analizar.
  let ex = $state<Exploracion>()
  let verSolucion = $state(false)
  let mejorMotor = $state<string>()

  let fens = $derived.by(() => {
    const lista = [problema.fen]
    let pos: Position = posDesdeFen(problema.fen)
    for (const u of hist) {
      const sig = jugarUci(pos, u)
      if (!sig) break
      pos = sig
      lista.push(fenDe(pos))
    }
    return lista
  })
  let fenActual = $derived(fens[fens.length - 1])
  // En Lichess, problema.fen es la posición antes de la jugada del rival: el que resuelve es el otro bando.
  let miColor = $derived.by<'white' | 'black'>(() => {
    const turno = posDesdeFen(problema.fen).turn
    return libro ? turno : turno === 'white' ? 'black' : 'white'
  })

  // La jugada del rival que plantea el problema de Lichess se muestra animada después de un momento.
  $effect(() => {
    if (libro) {
      estado = 'resolver'
      return
    }
    const t = setTimeout(() => {
      hist = [problema.jugadas[0]]
      estado = 'resolver'
    }, 700)
    return () => clearTimeout(t)
  })

  function terminar(r: ResultadoIntento, solucion = false) {
    resultado = r
    estado = 'resuelto'
    tentativa = undefined
    linea = undefined
    vista = undefined
    registrarIntento(idRepaso(problema), r)
    if (solucion) mostrarSolucion()
    else ex = new Exploracion(problema.fen, [...hist], hist.length)
  }

  /** La línea del libro (o de Lichess) en el tablero de análisis, desde donde se llegó sin desviarse. */
  function mostrarSolucion() {
    const enLinea = hist.every((u, i) => u === problema.jugadas[i]) ? hist.length : inicio
    ex = new Exploracion(problema.fen, [...problema.jugadas], Math.max(inicio, Math.min(enLinea, total)))
    verSolucion = true
  }

  function reintentar() {
    tentativa = undefined
    linea = undefined
    vista = undefined
    estado = 'resolver'
  }

  /** Deshace la última jugada propia y la respuesta del rival. */
  function atras() {
    reintentar()
    mensaje = ''
    const propias = hist.length - inicio
    const largo = propias <= 0 ? inicio : inicio + Math.max(0, propias % 2 === 0 ? propias - 2 : propias - 1)
    hist = hist.slice(0, largo)
    if (desvio !== undefined && largo <= desvio) desvio = undefined
  }

  async function aceptar(uci: string, despues: Position) {
    hist = [...hist, uci]
    if (despues.isCheckmate() || hist.length >= total) {
      terminar(fallado ? 'mal' : pista ? 'pista' : 'bien')
      return
    }
    if (desvio === undefined) {
      // La respuesta del rival se juega sola; después sigue el turno propio hasta el final de la línea.
      setTimeout(() => (hist = [...hist, problema.jugadas[hist.length]]), 450)
      return
    }
    // Fuera de la línea del libro, el rival responde con la mejor jugada de Stockfish.
    estado = 'verificando'
    const r = await motorInteractivo().analizar(fenActual, { profundidad: 14 })
    if (!r.mejor) {
      terminar(fallado ? 'mal' : pista ? 'pista' : 'bien')
      return
    }
    hist = [...hist, r.mejor]
    estado = 'resolver'
  }

  async function alJugar(uci: string) {
    if (estado === 'resuelto') {
      ex?.jugar(uci)
      return
    }
    if (estado !== 'resolver') return
    const pos = posDesdeFen(fenActual)
    const despues = jugarUci(pos, uci)
    if (!despues) return
    const san = sanDeUci(pos, uci)
    const esperada = desvio === undefined ? problema.jugadas[hist.length] : undefined

    if (uci === esperada || despues.isCheckmate()) {
      mensaje = `✓ ${san}`
      aceptar(uci, despues)
      return
    }

    const fenDespues = fenDe(despues)
    tentativa = { fen: fenDespues, uci }
    estado = 'verificando'
    mensaje = `Verificando ${san}…`
    const m = motorInteractivo()
    const antes = await m.analizar(fenActual, { profundidad: 14 })
    const r = await m.analizar(fenDespues, { profundidad: 14 })
    const evMia = invertir(r.ev)
    const perdida = chancesDeGanar(antes.ev) - chancesDeGanar(evMia)
    // En un libro puede haber más de una solución: si tu jugada gana igual, vale, y se sigue jugando tu línea
    // contra Stockfish hasta el mismo largo que la del libro.
    if (libro && (uci === antes.mejor || (perdida < TOLERANCIA && chancesDeGanar(evMia) > 0.5))) {
      tentativa = undefined
      if (desvio === undefined) {
        desvio = hist.length
        mensaje = `✓ ${san}: no es la jugada del libro, pero también gana (${textoEvaluacion(evMia)}). Seguí con tu línea: ahora responde Stockfish.`
      } else {
        mensaje = `✓ ${san} (${textoEvaluacion(evMia)})`
      }
      estado = 'resolver'
      aceptar(uci, despues)
      return
    }
    const motivo = detectarMotivoError(fenDespues, r.linea, r.ev)
    fallado = true
    mensaje = `✗ ${san}: de ${textoEvaluacion(antes.ev)} a ${textoEvaluacion(evMia)}${motivo.length ? ` (${motivo.join(', ')})` : ''}.${perdida < 0.1 ? ' No pierde mucho, pero no es la solución del problema.' : ''}`
    tentativa = { fen: fenDespues, uci, porQue: { titulo: `Por qué no ${san}`, fen: fenDespues, ucis: r.linea } }
    estado = 'error'
  }

  let fenTablero = $derived(
    estado === 'resuelto' && ex ? ex.fen : linea && vista ? vista.fen : tentativa ? tentativa.fen : fenActual,
  )
  let ultima = $derived(
    estado === 'resuelto' && ex ? ex.ultima : linea && vista ? vista.ultima : tentativa ? tentativa.uci : hist.at(-1),
  )
  let flechas = $derived.by((): Flecha[] => {
    const f: Flecha[] = []
    if (mejorMotor) f.push({ de: mejorMotor.slice(0, 2), a: mejorMotor.slice(2, 4), color: 'blue' })
    if (estado === 'resuelto' && ex && verSolucion && ex.proxima) f.push({ de: ex.proxima.slice(0, 2), a: ex.proxima.slice(2, 4), color: 'green' })
    else if (linea && vista?.proxima) f.push({ de: vista.proxima.slice(0, 2), a: vista.proxima.slice(2, 4), color: 'blue' })
    else if (estado === 'resolver' && pista && desvio === undefined) f.push({ de: problema.jugadas[hist.length].slice(0, 2), color: 'green' })
    return f
  })
  let puedeMover = $derived(estado === 'resuelto' && ex ? ex.turno : estado === 'resolver' ? miColor : undefined)
  let titulo = $derived(
    estado === 'resuelto'
      ? resultado === 'mal'
        ? fallado && hist.length >= total
          ? 'Línea completa (con algún error)'
          : 'Solución'
        : '¡Resuelto!'
      : estado === 'error'
        ? 'No era esa'
        : hist.length > inicio
          ? 'Bien. Seguí la línea: ¿cómo continúa?'
          : `Jugás con ${miColor === 'white' ? 'blancas' : 'negras'}: encontrá la mejor jugada.`,
  )
</script>

<article class="juego">
  <div class="col-tablero">
    <Tablero fen={fenTablero} orientacion={miColor} {puedeMover} ultimaJugada={ultima} {flechas} {alJugar} />
  </div>

  <aside class="panel">
    <header>
      <b class="titulo" class:bien={estado === 'resuelto' && resultado !== 'mal'} class:mal={resultado === 'mal' || estado === 'error'}>{titulo}</b>
      {#if problema.fuente}
        <div class="suave fuente">Del libro: <cite>{problema.fuente.titulo}</cite>{problema.fuente.capitulo ? `, ${problema.fuente.capitulo}` : ''}</div>
      {:else}
        <div class="suave fuente">Problema de Lichess · rating {problema.rating}</div>
      {/if}
    </header>

    {#if estado === 'resuelto'}
      <button class="boton principal siguiente" onclick={() => alSeguir(resultado!)}>Siguiente →</button>
    {/if}

    {#if mensaje}<p class="mensaje">{mensaje}</p>{/if}

    {#if estado === 'resolver' || estado === 'verificando'}
      <div class="fila">
        <button class="boton" onclick={() => (pista = true)} disabled={pista || desvio !== undefined}>Pista</button>
        {#if hist.length > inicio}<button class="boton" onclick={atras} disabled={estado !== 'resolver'}>Atrás</button>{/if}
        <button class="boton" onclick={() => terminar('mal', true)}>Ver la solución</button>
      </div>
    {/if}

    {#if estado === 'error'}
      <div class="fila">
        <button class="boton principal" onclick={() => { reintentar(); mensaje = '' }}>Volver a intentar</button>
        {#if tentativa?.porQue}<button class="boton" onclick={() => (linea = tentativa?.porQue)}>Ver por qué no</button>{/if}
        <button class="boton" onclick={() => terminar('mal', true)}>Ver la solución</button>
      </div>
      {#if linea}
        <VisorLinea {linea} alMover={(f, u, p) => (vista = { fen: f, ultima: u, proxima: p })} />
      {/if}
    {/if}

    {#if estado === 'resuelto' && ex}
      <Navegacion {ex} desde={inicio} />
      {#if verSolucion}
        <p class="suave">Solución{libro ? ' del libro' : ''}: {lineaConNumeros(fens[inicio] ?? problema.fen, problema.jugadas.slice(inicio))}</p>
      {/if}
      <div class="fila">
        {#if !verSolucion}
          <button class="boton" onclick={mostrarSolucion}>{desvio !== undefined ? 'Ver la línea del libro' : 'Ver la solución'}</button>
        {:else if hist.length > inicio && hist.some((u, i) => u !== problema.jugadas[i])}
          <button class="boton" onclick={() => { ex = new Exploracion(problema.fen, [...hist], hist.length); verSolucion = false }}>Volver a mi línea</button>
        {/if}
        {#if !libro}<a class="boton enlace" href={`https://lichess.org/training/${problema.id}`} target="_blank" rel="noopener">Ver en Lichess</a>{/if}
      </div>
      <div class="etiquetas">{#each problema.temas.filter((t) => !TEMAS_OCULTOS.includes(t)) as t (t)}<span class="etiqueta">{nombreTema(t)}</span>{/each}</div>
      <p class="suave nota">Podés mover las piezas de los dos colores para analizar (← y → recorren la línea).</p>
    {/if}

    <PanelMotor
      fen={fenTablero}
      bind:mejor={mejorMotor}
      alPrender={() => { if (estado !== 'resuelto') pista = true }}
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
    gap: 10px;
  }
  .panel p {
    margin: 0;
  }
  .titulo {
    font-size: 1.1rem;
  }
  .fuente {
    font-size: 0.85rem;
  }
  .siguiente {
    font-size: 1.05rem;
    padding: 10px;
  }
  .nota {
    font-size: 0.8rem;
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
