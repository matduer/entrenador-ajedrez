<script lang="ts">
  import { chancesDeGanar, invertir, textoEvaluacion } from '../../lib/ajedrez/evaluacion.ts'
  import { FEN_INICIAL, lineaSan, posDesdeFen, sanDeUci } from '../../lib/ajedrez/posicion.ts'
  import { fensDeLinea, nombreDeLinea } from '../../lib/aperturas/arbol.ts'
  import { cargarCatalogo, nombreEnEspanol, type Catalogo } from '../../lib/aperturas/catalogo.ts'
  import { agregarLinea, conflictos, sugerirRepertorio, type Sugerencia } from '../../lib/aperturas/repertorio.ts'
  import { db } from '../../lib/datos/db.ts'
  import type { Color, LineaRepertorio } from '../../lib/datos/tipos.ts'
  import { motorInteractivo } from '../../lib/motor/motor.ts'

  interface Props {
    alPracticar: (color: Color, lineas: string[][], titulo: string) => void
    alExplorar: (ucis: string[]) => void
  }
  let { alPracticar, alExplorar }: Props = $props()

  let catalogo = $state.raw<Catalogo>()
  let lineas = $state<LineaRepertorio[]>([])
  let color = $state<Color>('white')
  let sugerencias = $state<(Sugerencia & { revision?: string; enRevision?: boolean })[]>([])
  let buscando = $state(false)

  cargarCatalogo().then((c) => (catalogo = c))

  async function cargar() {
    lineas = await db.repertorio.toArray()
  }
  cargar()

  let delColor = $derived(lineas.filter((l) => l.color === color).sort((a, b) => a.ucis.join(' ').localeCompare(b.ucis.join(' '))))
  let choques = $derived(conflictos(delColor))

  function nombre(ucis: string[]) {
    const a = catalogo ? nombreDeLinea(catalogo, ucis) : undefined
    return a ? nombreEnEspanol(a) : 'Sin nombre'
  }

  async function sugerir() {
    buscando = true
    const partidas = await db.partidas.toArray()
    sugerencias = sugerirRepertorio(partidas, color)
    buscando = false
  }

  async function agregarSugerencia(s: Sugerencia) {
    await agregarLinea(color, s.ucis, catalogo ? nombreDeLinea(catalogo, s.ucis)?.nombre : undefined, 'partidas')
    sugerencias = sugerencias.filter((x) => x !== s)
    await cargar()
  }

  /** Revisa con Stockfish cada jugada propia de la línea: marca las que pierden. */
  async function revisar(s: (typeof sugerencias)[number]) {
    s.enRevision = true
    const fens = fensDeLinea(s.ucis)
    const m = motorInteractivo()
    const problemas: string[] = []
    for (let i = 0; i < s.ucis.length; i++) {
      const turno = fens[i].split(' ')[1] === 'w' ? 'white' : 'black'
      if (turno !== color) continue
      const antes = await m.analizar(fens[i], { profundidad: 13 })
      if (antes.mejor === s.ucis[i]) continue
      const despues = await m.analizar(fens[i + 1], { profundidad: 13 })
      const perdida = chancesDeGanar(antes.ev) - chancesDeGanar(invertir(despues.ev))
      if (perdida >= 0.08) {
        const pos = posDesdeFen(fens[i])
        problemas.push(
          `${Math.floor(i / 2) + 1}${i % 2 ? '…' : '.'} ${sanDeUci(pos, s.ucis[i])} pierde (${textoEvaluacion(antes.ev)} → ${textoEvaluacion(invertir(despues.ev))}); Stockfish prefiere ${sanDeUci(pos, antes.mejor)}`,
        )
      }
    }
    s.enRevision = false
    s.revision = problemas.length ? problemas.join(' · ') : 'Sin problemas: tus jugadas no pierden según Stockfish (prof. 13).'
  }

  async function quitar(l: LineaRepertorio) {
    await db.repertorio.delete(l.id)
    await cargar()
  }
</script>

<section class="tarjeta">
  <div class="fila">
    <label><input type="radio" bind:group={color} value="white" /> Con blancas</label>
    <label><input type="radio" bind:group={color} value="black" /> Con negras</label>
  </div>
  {#if delColor.length}
    <button class="boton principal" onclick={() => alPracticar(color, delColor.map((l) => l.ucis), `Mi repertorio con ${color === 'white' ? 'blancas' : 'negras'}`)}>
      Practicar mi repertorio ({delColor.length} líneas)
    </button>
  {/if}
</section>

{#if choques.length}
  <section class="tarjeta alerta">
    <p>Hay {choques.length} posición{choques.length === 1 ? '' : 'es'} donde tu repertorio tiene dos jugadas propias distintas. No es un error, pero conviene elegir una para no dudar en la partida.</p>
  </section>
{/if}

<section class="tarjeta">
  <h2>Mis líneas con {color === 'white' ? 'blancas' : 'negras'}</h2>
  {#if delColor.length === 0}
    <p class="suave">Todavía no hay líneas. Agregalas desde el explorador o pedí una sugerencia a partir de tus partidas.</p>
  {:else}
    <ul class="lineas">
      {#each delColor as l (l.id)}
        <li>
          <div>
            <b>{nombre(l.ucis)}</b>
            <div class="suave">{lineaSan(FEN_INICIAL, l.ucis).join(' ')}</div>
          </div>
          <div class="fila">
            <button class="boton enlace" onclick={() => alExplorar(l.ucis)}>Ver</button>
            <button class="boton enlace" onclick={() => quitar(l)}>Quitar</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<section class="tarjeta">
  <h2>Sugerir a partir de mis partidas</h2>
  <p class="suave">
    Toma tu jugada más frecuente en cada posición y abre una rama por cada respuesta del rival que aparezca en al menos el 10 %
    de las partidas. Revisá cada línea con Stockfish antes de agregarla: lo que jugás seguido no siempre es lo mejor.
  </p>
  <button class="boton" onclick={sugerir} disabled={buscando}>{buscando ? 'Buscando…' : 'Sugerir'}</button>
  {#if sugerencias.length}
    <ul class="lineas">
      {#each sugerencias.slice(0, 25) as s (s.ucis.join(' '))}
        <li>
          <div>
            <b>{nombre(s.ucis)}</b> <span class="suave">· {s.partidas} partidas · puntaje {Math.round(100 * s.puntaje)} %</span>
            <div class="suave">{lineaSan(FEN_INICIAL, s.ucis).join(' ')}</div>
            {#if s.enRevision}<div class="suave">Revisando con Stockfish…</div>{/if}
            {#if s.revision}<div class="revision">{s.revision}</div>{/if}
          </div>
          <div class="fila">
            <button class="boton enlace" onclick={() => revisar(s)} disabled={s.enRevision}>Revisar</button>
            <button class="boton enlace" onclick={() => agregarSugerencia(s)}>Agregar</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .lineas {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .lineas li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--borde);
  }
  .lineas li > div:first-child {
    min-width: 0;
  }
  .lineas .fila {
    flex-shrink: 0;
  }
  .revision {
    font-size: 0.85rem;
    margin-top: 4px;
  }
  .alerta {
    border-color: #c9483c;
  }
</style>
