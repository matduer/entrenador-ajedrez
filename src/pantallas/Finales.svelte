<script lang="ts">
  import { textoEvaluacion } from '../lib/ajedrez/evaluacion.ts'
  import { db } from '../lib/datos/db.ts'
  import type { ErrorPartida, Repaso } from '../lib/datos/tipos.ts'
  import type { Objetivo, PosicionFinal, Temario, TemaFinal } from '../lib/finales/tipos.ts'
  import temarioJson from '../contenido/finales/temario.json'
  import EditorPosicion from '../lib/ui/EditorPosicion.svelte'
  import JugarFinal from '../lib/ui/JugarFinal.svelte'

  const temario = temarioJson as Temario
  const NIVELES = [...new Set(temario.temas.map((t) => t.nivel))].sort()

  let vista = $state<'temario' | 'mis-finales' | 'editor'>('temario')
  let tema = $state<TemaFinal>()
  let jugando = $state<{ fen: string; objetivo: Objetivo; consigna: string; pista?: string; maxJugadas: number; idRepaso?: string; clave: number }>()
  let repasos = $state(new Map<string, Repaso>())
  let propios = $state<ErrorPartida[]>([])

  async function cargar() {
    const lista = await db.repasos.where('errorId').startsWith('final').toArray()
    repasos = new Map(lista.map((r) => [r.errorId, r]))
    const errores = await db.errores.where('fase').equals('final').toArray()
    propios = errores
      .filter((e) => e.clasificacion !== 'imprecision' && objetivoDe(e))
      .sort((a, b) => b.fecha - a.fecha)
  }
  cargar()

  /** Objetivo de un final propio según la evaluación antes del error: ganado → ganar, parejo → tablas. */
  function objetivoDe(e: ErrorPartida): Objetivo | undefined {
    const ev = e.evalAntes
    if (ev.mate !== undefined) return ev.mate > 0 ? 'ganar' : undefined
    const cp = ev.cp ?? 0
    if (cp >= 200) return 'ganar'
    if (Math.abs(cp) < 150) return 'tablas'
    return undefined
  }

  const idPosicion = (t: TemaFinal, p: PosicionFinal) => `final:${t.id}/${p.id}`

  function estado(id: string): 'nuevo' | 'repasar' | 'logrado' {
    const r = repasos.get(id)
    if (!r) return 'nuevo'
    return new Date(r.card.due).getTime() <= Date.now() ? 'repasar' : 'logrado'
  }

  function dominioTema(t: TemaFinal): number {
    return t.posiciones.filter((p) => estado(idPosicion(t, p)) === 'logrado').length / t.posiciones.length
  }

  let clave = 0
  function jugar(j: Omit<NonNullable<typeof jugando>, 'clave'>) {
    jugando = { ...j, clave: ++clave }
  }

  async function salir() {
    jugando = undefined
    await cargar()
  }

  const ETIQUETA = { nuevo: 'sin intentar', repasar: 'para repasar', logrado: 'logrado' }
</script>

<h1>Finales</h1>

{#if jugando}
  {#key jugando.clave}
    <JugarFinal {...jugando} alSalir={salir} />
  {/key}
{:else}
  <div class="pestanas" role="tablist">
    <button role="tab" aria-selected={vista === 'temario'} onclick={() => { vista = 'temario'; tema = undefined }}>Temario</button>
    <button role="tab" aria-selected={vista === 'mis-finales'} onclick={() => (vista = 'mis-finales')}>De mis partidas</button>
    <button role="tab" aria-selected={vista === 'editor'} onclick={() => (vista = 'editor')}>Posición libre</button>
  </div>

  {#if vista === 'temario' && tema}
    <button class="boton enlace" onclick={() => (tema = undefined)}>← Temario</button>
    <section class="tarjeta">
      <h2>{tema.titulo}</h2>
      {#each tema.explicacion as parrafo (parrafo)}<p>{parrafo}</p>{/each}
      <h3>Ideas clave</h3>
      <ul>{#each tema.ideas as idea (idea)}<li>{idea}</li>{/each}</ul>
      <p class="suave">
        Fuentes: {#each tema.fuentes as f, i (f.titulo + (f.capitulo ?? ''))}{i ? ' · ' : ''}{#if f.url}<a href={f.url} target="_blank" rel="noopener">{f.titulo}</a>{:else}<cite>{f.titulo}</cite>{/if}{f.capitulo ? `, ${f.capitulo}` : ''}{/each}.
        Explicación generada, puede contener errores; las posiciones están verificadas con las tablebases de Lichess.
      </p>
    </section>
    <section class="tarjeta">
      <h2>Posiciones para jugar</h2>
      <ul class="lista">
        {#each tema.posiciones as p (p.id)}
          {@const id = idPosicion(tema, p)}
          <li>
            <div>
              <b>{p.consigna}</b>
              <div class="suave">{p.objetivo === 'ganar' ? 'Ganar' : 'Tablas'} · hasta {p.maxJugadas} jugadas · <span class="etiqueta {estado(id)}">{ETIQUETA[estado(id)]}</span></div>
            </div>
            <button class="boton principal" onclick={() => jugar({ fen: p.fen, objetivo: p.objetivo, consigna: p.consigna, pista: p.pista, maxJugadas: p.maxJugadas, idRepaso: id })}>Jugar</button>
          </li>
        {/each}
      </ul>
    </section>
  {:else if vista === 'temario'}
    <p class="suave">Temario progresivo para 1700-1800: cada tema con su explicación y posiciones para jugar contra Stockfish hasta lograr el resultado. Lo que no sale vuelve para repasar.</p>
    {#each NIVELES as nivel (nivel)}
      <section class="tarjeta">
        <h2>Nivel {nivel}</h2>
        <ul class="lista">
          {#each temario.temas.filter((t) => t.nivel === nivel) as t (t.id)}
            <li>
              <button class="tema" onclick={() => (tema = t)}>
                <b>{t.titulo}</b>
                <span class="suave">{t.posiciones.length} {t.posiciones.length === 1 ? 'posición' : 'posiciones'} · dominio {Math.round(100 * dominioTema(t))} %</span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {:else if vista === 'mis-finales'}
    <section class="tarjeta">
      <p class="suave">
        Finales de tus partidas donde cometiste un error o un error grave. Si la posición estaba ganada, el objetivo es ganarla;
        si estaba pareja, aguantar las tablas. Jugás desde el momento anterior al error.
      </p>
      {#if propios.length === 0}
        <p class="suave">Todavía no hay finales con errores detectados.</p>
      {:else}
        <ul class="lista">
          {#each propios.slice(0, 40) as e (e.id)}
            {@const objetivo = objetivoDe(e)!}
            {@const id = `final-propio:${e.id}`}
            <li>
              <div>
                <b>{new Date(e.fecha).toLocaleDateString('es-AR')} · jugada {e.numeroJugada} · {e.miColor === 'white' ? 'blancas' : 'negras'}</b>
                <div class="suave">{objetivo === 'ganar' ? 'Ganar' : 'Tablas'} · estaba {textoEvaluacion(e.evalAntes)} · <span class="etiqueta {estado(id)}">{ETIQUETA[estado(id)]}</span></div>
              </div>
              <button
                class="boton principal"
                onclick={() => jugar({ fen: e.fen, objetivo, consigna: objetivo === 'ganar' ? 'Ganá este final de tu partida.' : 'Hacé tablas en este final de tu partida.', maxJugadas: 40, idRepaso: id })}
              >
                Jugar
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {:else}
    <section class="tarjeta">
      <EditorPosicion alJugar={(fen, objetivo) => jugar({ fen, objetivo, consigna: 'Posición libre.', maxJugadas: 50 })} />
    </section>
  {/if}
{/if}

<style>
  .lista {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .lista li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--borde);
  }
  .tema {
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    color: var(--texto);
    display: flex;
    flex-direction: column;
    padding: 0;
  }
  .etiqueta.logrado {
    border-color: #3f9b4b;
    color: #3f9b4b;
  }
  .etiqueta.repasar {
    border-color: var(--acento);
    color: var(--acento);
  }
  h3 {
    font-size: 0.95rem;
    margin: 4px 0 0;
  }
  ul:not(.lista) {
    margin: 0;
  }
</style>
