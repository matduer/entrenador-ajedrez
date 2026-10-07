<script lang="ts">
  import { chancesDeGanar, invertir, textoEvaluacion, type Evaluacion } from '../../lib/ajedrez/evaluacion.ts'
  import { lineaSan, posDesdeFen, sanDeUci } from '../../lib/ajedrez/posicion.ts'
  import { detectarMotivoError } from '../../lib/ajedrez/temas.ts'
  import { armarArbol, continuaciones, fensDeLinea, nombreDeLinea, type Arbol } from '../../lib/aperturas/arbol.ts'
  import { cargarCatalogo, familiaEnEspanol, nombreEnEspanol, type Catalogo } from '../../lib/aperturas/catalogo.ts'
  import { AVISO, explicacionPara, notaPara, porQueNoPara } from '../../lib/aperturas/explicaciones.ts'
  import { consultarMasters, type RespuestaMasters } from '../../lib/aperturas/masters.ts'
  import { agregarLinea } from '../../lib/aperturas/repertorio.ts'
  import type { Apertura } from '../../lib/aperturas/tipos.ts'
  import type { Color } from '../../lib/datos/tipos.ts'
  import { motorInteractivo, motorTablero, type LineaMotor } from '../../lib/motor/motor.ts'
  import Tablero from '../../lib/ui/Tablero.svelte'
  import VisorLinea, { type Linea } from '../../lib/ui/VisorLinea.svelte'

  interface Props {
    inicial?: string[]
    alPracticar: (color: Color, prefijo: string[], titulo: string) => void
  }
  let { inicial = [], alPracticar }: Props = $props()

  let catalogo = $state.raw<Catalogo>()
  let arbol = $state.raw<Arbol>()
  // Solo importa la línea inicial: Aperturas.svelte vuelve a montar el explorador para cambiarla.
  // svelte-ignore state_referenced_locally
  let linea = $state<string[]>([...inicial])
  // svelte-ignore state_referenced_locally
  let idx = $state(inicial.length)
  let orientacion = $state<Color>('white')
  let busqueda = $state('')
  let motor = $state<{ fen: string; lineas: LineaMotor[]; profundidad: number }>()
  let masters = $state<RespuestaMasters | 'sin-token' | 'error'>()
  let aviso = $state<{ uci: string; san: string; antes: Evaluacion; despues: Evaluacion; motivo: string[]; texto?: string; refutacion: Linea }>()
  let verLinea = $state<Linea>()
  let vista = $state<{ fen: string; ultima?: string; proxima?: string }>()
  let mensaje = $state('')

  cargarCatalogo().then((c) => {
    catalogo = c
    arbol = armarArbol(c)
  })

  let actual = $derived(linea.slice(0, idx))
  let fens = $derived(fensDeLinea(linea))
  let fen = $derived(fens[idx] ?? fens[fens.length - 1])
  let turno = $derived<Color>(fen.split(' ')[1] === 'w' ? 'white' : 'black')
  let sans = $derived(lineaSan(fens[0], linea))
  let apertura = $derived(catalogo ? nombreDeLinea(catalogo, actual) : undefined)
  let teoria = $derived(arbol ? continuaciones(arbol, fen) : [])
  let explicacion = $derived(explicacionPara(actual))
  let nota = $derived(notaPara(actual))

  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  let resultados = $derived.by((): Apertura[] => {
    if (!catalogo || busqueda.trim().length < 2) return []
    // Todas las palabras tienen que aparecer, en el nombre en inglés, en el español o en el ECO.
    const palabras = norm(busqueda).split(/\s+/).filter(Boolean)
    return catalogo.aperturas
      .filter((a) => {
        const texto = norm(`${a.nombre} ${familiaEnEspanol(a.familia)} ${a.eco}`)
        return palabras.every((p) => texto.includes(p))
      })
      .sort((a, b) => a.ucis.length - b.ucis.length)
      .slice(0, 30)
  })

  // Stockfish sobre la posición actual (las 3 mejores jugadas). Si se cambia de posición, se corta.
  let consulta = 0
  $effect(() => {
    const f = fen
    const yo = ++consulta
    const m = motorTablero()
    m.detener()
    m.analizar(f, { profundidad: 16, multipv: 3 }).then((r) => {
      if (yo === consulta) motor = { fen: f, lineas: r.lineas, profundidad: r.profundidad }
    })
  })

  $effect(() => {
    const f = fen
    masters = undefined
    if (!navigator.onLine) return
    consultarMasters(f).then((r) => {
      if (f === fen) masters = r
    })
  })

  /** Evaluación desde el lado de las blancas, para mostrar. */
  function evBlancas(ev: Evaluacion, fenPos: string): Evaluacion {
    return fenPos.split(' ')[1] === 'w' ? ev : invertir(ev)
  }

  function irA(i: number) {
    idx = Math.max(0, Math.min(linea.length, i))
    aviso = undefined
    verLinea = undefined
    vista = undefined
  }

  function jugar(uci: string, evaluar = true) {
    const fenAntes = fen
    linea = [...linea.slice(0, idx), uci]
    idx = linea.length
    verLinea = undefined
    vista = undefined
    aviso = undefined
    if (evaluar) revisarJugada(fenAntes, uci, [...linea])
  }

  /** "Por qué no": si la jugada pierde chances de ganar, mostrar cómo se castiga. */
  async function revisarJugada(fenAntes: string, uci: string, lineaJugada: string[]) {
    const m = motorInteractivo()
    const antes = await m.analizar(fenAntes, { profundidad: 14 })
    if (antes.mejor === uci) return
    const fenDespues = fensDeLinea(lineaJugada).at(-1)!
    const despues = await m.analizar(fenDespues, { profundidad: 14 })
    if (linea.join(' ') !== lineaJugada.join(' ')) return
    const evDespues = invertir(despues.ev)
    const perdida = chancesDeGanar(antes.ev) - chancesDeGanar(evDespues)
    if (perdida < 0.1) return
    const san = sanDeUci(posDesdeFen(fenAntes), uci)
    aviso = {
      uci,
      san,
      antes: antes.ev,
      despues: evDespues,
      motivo: detectarMotivoError(fenDespues, despues.linea, despues.ev),
      texto: porQueNoPara(lineaJugada.slice(0, -1), uci)?.texto,
      refutacion: { titulo: `Por qué no ${san}`, fen: fenDespues, ucis: despues.linea },
    }
  }

  function elegirApertura(a: Apertura) {
    linea = [...a.ucis]
    idx = linea.length
    busqueda = ''
    aviso = undefined
    verLinea = undefined
    vista = undefined
    // Orientación: la de quien "elige" la apertura según su nombre (defensas → negras).
    orientacion = /Defense|Defence|Countergambit/.test(a.nombre) ? 'black' : 'white'
  }

  async function agregar() {
    await agregarLinea(orientacion, actual, apertura?.nombre, 'manual')
    mensaje = `Agregada a tu repertorio con ${orientacion === 'white' ? 'blancas' : 'negras'}.`
    setTimeout(() => (mensaje = ''), 3000)
  }

  let fenTablero = $derived(verLinea && vista ? vista.fen : fen)
  let ultimaTablero = $derived(verLinea && vista ? vista.ultima : idx > 0 ? linea[idx - 1] : undefined)
  let flechas = $derived.by(() => {
    if (verLinea && vista?.proxima) return [{ de: vista.proxima.slice(0, 2), a: vista.proxima.slice(2, 4), color: 'blue' as const }]
    if (!verLinea && motor?.fen === fen && motor.lineas[0]?.linea[0]) {
      const u = motor.lineas[0].linea[0]
      return [{ de: u.slice(0, 2), a: u.slice(2, 4), color: 'green' as const }]
    }
    return []
  })

  const pctMasters = (j: { white: number; draws: number; black: number }) => {
    const t = j.white + j.draws + j.black || 1
    return `${Math.round((100 * j.white) / t)} / ${Math.round((100 * j.draws) / t)} / ${Math.round((100 * j.black) / t)}`
  }
</script>

<div class="explorador">
  <div class="columna-tablero">
    <div class="buscador">
      <input type="search" placeholder="Buscar apertura: caro-kann, eslava, B12…" bind:value={busqueda} />
      {#if resultados.length}
        <ul class="resultados">
          {#each resultados as a (a.nombre + a.jugadas)}
            <li><button onclick={() => elegirApertura(a)}><b>{nombreEnEspanol(a)}</b> <span class="suave">{a.eco} · {lineaSan(fens[0], a.ucis).join(' ')}</span></button></li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="titulo-apertura">
      {#if apertura}<b>{nombreEnEspanol(apertura)}</b> <span class="suave">{apertura.eco}</span>{:else}<span class="suave">Posición inicial: jugá o buscá una apertura.</span>{/if}
    </div>

    <Tablero fen={fenTablero} {orientacion} puedeMover={verLinea ? undefined : turno} ultimaJugada={ultimaTablero} {flechas} alJugar={(u) => jugar(u)} />

    <div class="controles">
      <button class="boton" onclick={() => irA(0)} aria-label="Al principio">⏮</button>
      <button class="boton" onclick={() => irA(idx - 1)} aria-label="Atrás">◀</button>
      <button class="boton" onclick={() => irA(idx + 1)} aria-label="Adelante">▶</button>
      <button class="boton" onclick={() => (orientacion = orientacion === 'white' ? 'black' : 'white')}>Girar</button>
    </div>

    <div class="jugadas">
      {#each sans as san, i (i)}
        <button class:actual={i === idx - 1} onclick={() => irA(i + 1)}>{i % 2 === 0 ? `${i / 2 + 1}. ` : ''}{san}</button>
      {/each}
    </div>
  </div>

  <div class="columna-paneles">
    {#if aviso}
      <section class="tarjeta alerta">
        <h2>Por qué no {aviso.san}</h2>
        <p>
          La evaluación (desde el lado que movió) pasa de <b>{textoEvaluacion(aviso.antes)}</b> a <b>{textoEvaluacion(aviso.despues)}</b>{#if aviso.motivo.length}: {aviso.motivo.join(', ')}{/if}.
        </p>
        {#if aviso.texto}<p>{aviso.texto}</p>{/if}
        <button class="boton" onclick={() => (verLinea = aviso!.refutacion)}>Ver cómo se castiga</button>
      </section>
    {/if}

    {#if verLinea}
      <VisorLinea linea={verLinea} alMover={(f, u, p) => (vista = { fen: f, ultima: u, proxima: p })} />
      <button class="boton enlace" onclick={() => { verLinea = undefined; vista = undefined }}>Volver a la posición</button>
    {/if}

    {#if nota}
      <section class="tarjeta">
        <h2>¿Por qué {sanDeUci(posDesdeFen(fens[idx - 1]), linea[idx - 1])}?</h2>
        <p>{nota.nota.porQue}</p>
        {#if nota.nota.inferior}<p class="suave">Stockfish la considera algo inferior a la mejor jugada: es teoría reconocida y jugable, no la más precisa.</p>{/if}
        <p class="aviso-contenido">{AVISO}</p>
      </section>
    {/if}

    <section class="tarjeta">
      <h2>Teoría desde acá</h2>
      {#if teoria.length}
        <ul class="lista">
          {#each teoria.slice(0, 10) as c (c.uci)}
            {@const san = sanDeUci(posDesdeFen(fen), c.uci)}
            <li>
              <button onclick={() => jugar(c.uci, false)}>
                <b>{san}</b>
                <span class="suave">{[c.apertura && nombreEnEspanol(c.apertura), `${c.lineas} línea${c.lineas === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</span>
              </button>
              {#if porQueNoPara(actual, c.uci)}<span class="etiqueta alerta-etiqueta">ojo</span>{/if}
            </li>
          {/each}
        </ul>
        <p class="suave">Continuaciones con nombre del catálogo abierto de Lichess. "Líneas" indica cuánta teoría con nombre sigue, no popularidad.</p>
      {:else}
        <p class="suave">No hay más teoría con nombre desde esta posición.</p>
      {/if}
    </section>

    <section class="tarjeta">
      <h2>Stockfish</h2>
      {#if motor?.fen === fen && motor.lineas.length}
        <ul class="lista">
          {#each motor.lineas as l, i (i)}
            <li>
              <button onclick={() => jugar(l.linea[0], false)}>
                <b>{textoEvaluacion(evBlancas(l.ev, fen))}</b>
                <span>{lineaSan(fen, l.linea.slice(0, 6)).join(' ')}</span>
              </button>
            </li>
          {/each}
        </ul>
        <p class="suave">Profundidad {motor.profundidad}. Evaluación desde el lado de las blancas.</p>
      {:else}
        <p class="suave">Calculando…</p>
      {/if}
    </section>

    {#if masters && masters !== 'sin-token'}
      <section class="tarjeta">
        <h2>Masters (en línea)</h2>
        {#if masters === 'error'}
          <p class="suave">No se pudo consultar. Revisá el token en Ajustes.</p>
        {:else if masters.moves.length}
          <table>
            <thead><tr><th>Jugada</th><th class="num">Partidas</th><th class="num">Bl / Tablas / Ne %</th></tr></thead>
            <tbody>
              {#each masters.moves as j (j.uci)}
                <tr class="clic" onclick={() => jugar(j.uci, false)}>
                  <td>{sanDeUci(posDesdeFen(fen), j.uci)}</td>
                  <td class="num">{j.white + j.draws + j.black}</td>
                  <td class="num">{pctMasters(j)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="suave">Ningún maestro llegó a esta posición.</p>
        {/if}
      </section>
    {/if}

    {#if explicacion}
      <section class="tarjeta">
        <h2>Ideas: {explicacion.nombre}</h2>
        <p>{explicacion.resumen}</p>
        <details>
          <summary>Planes, estructura y trampas</summary>
          {#if explicacion.planesBlancas.length}<h3>Planes de las blancas</h3><ul>{#each explicacion.planesBlancas as p (p)}<li>{p}</li>{/each}</ul>{/if}
          {#if explicacion.planesNegras.length}<h3>Planes de las negras</h3><ul>{#each explicacion.planesNegras as p (p)}<li>{p}</li>{/each}</ul>{/if}
          {#if explicacion.estructura}<h3>Estructura de peones</h3><p>{explicacion.estructura}</p>{/if}
          {#if explicacion.rupturas.length}<h3>Rupturas</h3><ul>{#each explicacion.rupturas as p (p)}<li>{p}</li>{/each}</ul>{/if}
          {#if explicacion.piezas.length}<h3>Ubicación de las piezas</h3><ul>{#each explicacion.piezas as p (p)}<li>{p}</li>{/each}</ul>{/if}
          {#if explicacion.trampas.length}
            <h3>Trampas</h3>
            <ul>
              {#each explicacion.trampas as t (t.jugadas)}
                <li>
                  {t.texto}
                  <button class="boton enlace" onclick={() => { linea = t.jugadas.split(' '); idx = linea.length }}>Ver</button>
                </li>
              {/each}
            </ul>
          {/if}
          <h3>Fuentes</h3>
          <ul>{#each explicacion.fuentes as f (f.url)}<li><a href={f.url} target="_blank" rel="noopener">{f.titulo}</a>{f.licencia ? ` (${f.licencia})` : ''}</li>{/each}</ul>
        </details>
        <p class="aviso-contenido">{AVISO}</p>
      </section>
    {/if}

    <section class="tarjeta">
      <div class="fila">
        <button class="boton" onclick={agregar} disabled={actual.length === 0}>Agregar a mi repertorio ({orientacion === 'white' ? 'blancas' : 'negras'})</button>
        <button class="boton principal" onclick={() => alPracticar(orientacion, actual, apertura ? nombreEnEspanol(apertura) : 'Posición inicial')}>
          Practicar desde acá
        </button>
      </div>
      {#if mensaje}<p class="suave">{mensaje}</p>{/if}
      <p class="suave">El color es el de la orientación del tablero (botón Girar).</p>
    </section>
  </div>
</div>

<style>
  .explorador {
    display: grid;
    gap: 16px;
  }
  @media (min-width: 1100px) {
    .explorador {
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      align-items: start;
    }
  }
  .columna-tablero {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .buscador {
    position: relative;
  }
  .buscador input {
    width: 100%;
  }
  .resultados {
    position: absolute;
    z-index: 10;
    left: 0;
    right: 0;
    max-height: 340px;
    overflow-y: auto;
    margin: 4px 0 0;
    padding: 4px;
    list-style: none;
    background: var(--superficie);
    border: 1px solid var(--borde);
    border-radius: var(--radio);
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.25);
  }
  .resultados button,
  .lista button {
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    color: var(--texto);
    padding: 6px 8px;
    border-radius: 8px;
    display: flex;
    gap: 8px;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .resultados button:hover,
  .lista button:hover {
    background: var(--fondo);
  }
  .lista {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .lista li {
    display: flex;
    align-items: center;
  }
  .controles {
    display: flex;
    gap: 6px;
  }
  .controles .boton {
    flex: 1;
  }
  .jugadas {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 6px;
  }
  .jugadas button {
    border: none;
    background: none;
    color: var(--texto);
    padding: 2px 4px;
    border-radius: 6px;
  }
  .jugadas button.actual {
    background: var(--acento);
    color: var(--acento-texto);
  }
  .columna-paneles {
    display: flex;
    flex-direction: column;
  }
  .alerta {
    border-color: #c9483c;
  }
  .alerta-etiqueta {
    border-color: #c9483c;
    color: #c9483c;
  }
  .aviso-contenido {
    font-size: 0.78rem;
    color: var(--texto-suave);
    font-style: italic;
  }
  h3 {
    font-size: 0.95rem;
    margin: 10px 0 4px;
  }
  .clic {
    cursor: pointer;
  }
</style>
