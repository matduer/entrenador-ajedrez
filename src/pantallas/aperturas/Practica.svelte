<script lang="ts">
  import { chancesDeGanar, invertir, textoEvaluacion } from '../../lib/ajedrez/evaluacion.ts'
  import { lineaSan, posDesdeFen, sanDeUci } from '../../lib/ajedrez/posicion.ts'
  import { detectarMotivoError } from '../../lib/ajedrez/temas.ts'
  import { fensDeLinea, nombreDeLinea } from '../../lib/aperturas/arbol.ts'
  import { cargarCatalogo, nombreEnEspanol, type Catalogo } from '../../lib/aperturas/catalogo.ts'
  import { AVISO, notaPara, porQueNoPara } from '../../lib/aperturas/explicaciones.ts'
  import { elegirLinea, estadoLineas, lineasDelNivel, NIVELES, nivelActual, registrarLinea, UMBRAL_DOMINIO, type EstadoNivel } from '../../lib/aperturas/practica.ts'
  import type { Color } from '../../lib/datos/tipos.ts'
  import { motorInteractivo } from '../../lib/motor/motor.ts'
  import Tablero, { type Flecha } from '../../lib/ui/Tablero.svelte'
  import VisorLinea, { type Linea } from '../../lib/ui/VisorLinea.svelte'

  interface Props {
    color: Color
    lineas: string[][]
    titulo: string
    alSalir: () => void
  }
  let { color, lineas, titulo, alSalir }: Props = $props()

  let catalogo = $state.raw<Catalogo>()
  cargarCatalogo().then((c) => (catalogo = c))

  let nivel = $state(1)
  let estados = $state<EstadoNivel[]>([])
  let objetivo = $state<string[]>()
  let ply = $state(0)
  let errores = $state(0)
  let erroresAca = $state(0)
  let mensaje = $state<{ tipo: 'bien' | 'mal' | 'info'; texto: string }>()
  let porQue = $state<string>()
  let refutacion = $state<Linea>()
  let vista = $state<{ fen: string; ultima?: string; proxima?: string }>()
  let verificando = $state(false)
  let terminado = $state(false)

  let delNivel = $derived(lineasDelNivel(lineas, NIVELES[nivel - 1].plies, color))

  async function actualizarEstados() {
    estados = await Promise.all(NIVELES.map((n) => estadoLineas(color, lineasDelNivel(lineas, n.plies, color))))
  }

  $effect(() => {
    void lineas
    nivelActual(color, lineas).then((n) => (nivel = n))
    actualizarEstados()
  })

  let fens = $derived(objetivo ? fensDeLinea(objetivo) : [])
  let fen = $derived(fens[ply] ?? fens[0])
  let turnoMio = $derived(fen ? (fen.split(' ')[1] === 'w') === (color === 'white') : false)

  async function empezar() {
    objetivo = await elegirLinea(color, delNivel)
    ply = 0
    errores = 0
    erroresAca = 0
    mensaje = undefined
    porQue = undefined
    refutacion = undefined
    terminado = false
    if (objetivo) avanzarRival()
  }

  function avanzarRival() {
    if (!objetivo) return
    if (ply >= objetivo.length) {
      terminar()
      return
    }
    if (!turnoMio) setTimeout(() => {
      ply++
      if (objetivo && ply >= objetivo.length) terminar()
    }, 450)
  }

  async function terminar() {
    if (!objetivo || terminado) return
    terminado = true
    await registrarLinea(color, objetivo, errores === 0)
    await actualizarEstados()
  }

  async function alJugar(uci: string) {
    if (!objetivo || !turnoMio || verificando) return
    const esperada = objetivo[ply]
    const pos = posDesdeFen(fen)
    const san = sanDeUci(pos, uci)
    refutacion = undefined
    vista = undefined

    if (uci === esperada) {
      const nota = notaPara(objetivo.slice(0, ply + 1))
      porQue = nota?.nota.porQue
      mensaje = { tipo: 'bien', texto: `✓ ${san}` }
      ply++
      erroresAca = 0
      avanzarRival()
      return
    }

    // ¿Es otra línea teórica del mismo conjunto?
    const prefijo = objetivo.slice(0, ply).join(' ')
    const alternativa = lineas.find((l) => l.slice(0, ply).join(' ') === prefijo && l[ply] === uci)
    if (alternativa) {
      const nombre = catalogo ? nombreDeLinea(catalogo, alternativa.slice(0, ply + 1)) : undefined
      mensaje = { tipo: 'info', texto: `${san} también es teoría${nombre ? ` (${nombreEnEspanol(nombre)})` : ''}, pero en esta vuelta practicamos otra línea. Probá de nuevo.` }
      return
    }

    errores++
    erroresAca++
    verificando = true
    mensaje = { tipo: 'mal', texto: `✗ ${san}: verificando con Stockfish…` }
    const m = motorInteractivo()
    const antes = await m.analizar(fen, { profundidad: 14 })
    const fenDespues = fensDeLinea([...objetivo.slice(0, ply), uci]).at(-1)!
    const despues = await m.analizar(fenDespues, { profundidad: 14 })
    verificando = false
    const evDespues = invertir(despues.ev)
    const perdida = chancesDeGanar(antes.ev) - chancesDeGanar(evDespues)
    const texto = porQueNoPara(objetivo.slice(0, ply), uci)?.texto
    if (perdida >= 0.1) {
      const motivo = detectarMotivoError(fenDespues, despues.linea, despues.ev)
      mensaje = {
        tipo: 'mal',
        texto: `✗ ${san} pierde: de ${textoEvaluacion(antes.ev)} a ${textoEvaluacion(evDespues)}${motivo.length ? ` (${motivo.join(', ')})` : ''}.${texto ? ' ' + texto : ''}`,
      }
      refutacion = { titulo: `Por qué no ${san}`, fen: fenDespues, ucis: despues.linea }
    } else {
      mensaje = { tipo: 'mal', texto: `✗ ${san} no es la jugada de esta línea. Stockfish la considera jugable (${textoEvaluacion(evDespues)}), pero acá la teoría es otra.${texto ? ' ' + texto : ''}` }
    }
  }

  async function explicarEsperada() {
    if (!objetivo) return
    const esperada = objetivo[ply]
    const nota = notaPara(objetivo.slice(0, ply + 1))
    const san = sanDeUci(posDesdeFen(fen), esperada)
    if (nota) {
      porQue = `${san}: ${nota.nota.porQue}`
      return
    }
    const r = await motorInteractivo().analizar(fen, { profundidad: 16, multipv: 3 })
    const linea = r.lineas.find((l) => l.linea[0] === esperada)
    const nombre = catalogo ? nombreDeLinea(catalogo, objetivo.slice(0, ply + 1)) : undefined
    porQue =
      `${san}${nombre ? ` lleva a ${nombreEnEspanol(nombre)}` : ''}. ` +
      (linea
        ? `Stockfish la evalúa ${textoEvaluacion(linea.ev)} y la ubica entre sus ${r.lineas.length} mejores (${r.lineas.map((l) => sanDeUci(posDesdeFen(fen), l.linea[0])).join(', ')}).`
        : `Stockfish prefiere ${sanDeUci(posDesdeFen(fen), r.mejor)} (${textoEvaluacion(r.ev)}); ${san} es la jugada teórica de la línea.`) +
      ' Todavía no hay una explicación escrita para esta posición.'
  }

  let flechas = $derived.by((): Flecha[] => {
    if (refutacion && vista?.proxima) return [{ de: vista.proxima.slice(0, 2), a: vista.proxima.slice(2, 4), color: 'blue' }]
    if (objetivo && turnoMio && erroresAca >= 2) return [{ de: objetivo[ply].slice(0, 2), a: objetivo[ply].slice(2, 4), color: 'green' }]
    return []
  })
</script>

<div class="cabecera">
  <div>
    <h2>{titulo}</h2>
    <span class="suave">Practicás con {color === 'white' ? 'blancas' : 'negras'} · {lineas.length} líneas en total</span>
  </div>
  <button class="boton enlace" onclick={alSalir}>Volver</button>
</div>

{#if !objetivo}
  <section class="tarjeta">
    <h2>Niveles</h2>
    <ul class="niveles">
      {#each NIVELES as n, i (n.nivel)}
        {@const e = estados[i]}
        <li>
          <label>
            <input type="radio" name="nivel" value={n.nivel} bind:group={nivel} />
            <span>
              <b>{n.nivel}. {n.nombre}</b> <span class="suave">{n.descripcion}</span><br />
              {#if e}
                <span class="suave">{e.total} líneas · dominio {Math.round(100 * e.dominio)} % · {e.vencidas} para repasar · {e.nuevas} sin ver</span>
                {#if e.total && e.dominio >= UMBRAL_DOMINIO && e.vencidas === 0}<span class="etiqueta">dominado</span>{/if}
              {/if}
            </span>
          </label>
        </li>
      {/each}
    </ul>
    <p class="suave">Para pasar de nivel: {Math.round(UMBRAL_DOMINIO * 100)} % de las líneas bien en su último repaso y ninguna vencida. Las que fallás vuelven antes.</p>
    <button class="boton principal" onclick={empezar} disabled={delNivel.length === 0}>Practicar una línea</button>
  </section>
{:else}
  <div class="practica">
    <Tablero
      fen={refutacion && vista ? vista.fen : fen}
      orientacion={color}
      puedeMover={turnoMio && !terminado && !refutacion ? color : undefined}
      ultimaJugada={refutacion && vista ? vista.ultima : ply > 0 ? objetivo[ply - 1] : undefined}
      {flechas}
      {alJugar}
    />
    <div class="panel">
      <p class="suave">{lineaSan(fens[0], objetivo.slice(0, ply)).join(' ') || 'Posición inicial'}</p>
      {#if terminado}
        <p class={errores ? 'mal' : 'bien'}><b>{errores ? `Línea terminada con ${errores} error${errores === 1 ? '' : 'es'}: vuelve pronto.` : 'Línea completa sin errores.'}</b></p>
        <div class="fila">
          <button class="boton principal" onclick={empezar}>Otra línea</button>
          <button class="boton" onclick={() => (objetivo = undefined)}>Niveles</button>
        </div>
      {:else if turnoMio}
        <p>Te toca: ¿qué jugás?</p>
      {:else}
        <p class="suave">Juega el rival…</p>
      {/if}

      {#if mensaje}<p class={mensaje.tipo}>{mensaje.texto}</p>{/if}
      {#if porQue}<p class="idea">{porQue}</p>{/if}

      {#if !terminado && turnoMio}
        <button class="boton" onclick={explicarEsperada} disabled={verificando}>¿Por qué esta jugada?</button>
      {/if}

      {#if refutacion}
        <VisorLinea linea={refutacion} alMover={(f, u, p) => (vista = { fen: f, ultima: u, proxima: p })} />
        <button class="boton enlace" onclick={() => { refutacion = undefined; vista = undefined }}>Volver y probar de nuevo</button>
      {/if}
      <p class="aviso-contenido">{AVISO}</p>
    </div>
  </div>
{/if}

<style>
  .cabecera {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }
  .cabecera h2 {
    margin: 0;
  }
  .niveles {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .niveles label {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .practica {
    display: grid;
    gap: 16px;
  }
  @media (min-width: 1100px) {
    .practica {
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
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
  .aviso-contenido {
    font-size: 0.78rem;
    color: var(--texto-suave);
    font-style: italic;
  }
</style>
