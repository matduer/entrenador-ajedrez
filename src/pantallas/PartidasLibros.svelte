<script lang="ts">
  import { FEN_INICIAL } from '../lib/ajedrez/posicion.ts'
  import { cargarPartidasLibros, type PartidaLibro } from '../lib/partidas-libros/partidas-libros.ts'
  import Tablero from '../lib/ui/Tablero.svelte'
  import VisorLinea from '../lib/ui/VisorLinea.svelte'

  const POR_PAGINA = 30
  let todas = $state<PartidaLibro[]>([])
  let cargando = $state(true)
  let busqueda = $state('')
  let libro = $state<string>()
  let pagina = $state(0)
  let elegida = $state<PartidaLibro>()
  let vista = $state<{ fen: string; ultima?: string }>({ fen: FEN_INICIAL })

  cargarPartidasLibros().then((p) => {
    todas = p
    cargando = false
  })

  let libros = $derived([...new Set(todas.map((p) => p.fuente.titulo))].sort())
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  let filtradas = $derived.by(() => {
    const q = norm(busqueda.trim())
    return todas.filter(
      (p) => (!libro || p.fuente.titulo === libro) && (!q || norm(`${p.blancas} ${p.negras} ${p.lugar ?? ''} ${p.anio ?? ''}`).includes(q)),
    )
  })
  $effect(() => {
    void [busqueda, libro]
    pagina = 0
  })
  let visibles = $derived(filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA))
  const titulo = (p: PartidaLibro) => `${p.blancas} – ${p.negras}${p.resultado ? ` (${p.resultado.replace('1/2-1/2', '½-½')})` : ''}`
</script>

{#if elegida}
  <button class="boton enlace" onclick={() => (elegida = undefined)}>← Volver a la lista</button>
  <h2>{titulo(elegida)}</h2>
  <p class="suave">
    {[elegida.lugar, elegida.anio].filter(Boolean).join(', ')} · Del libro: <cite>{elegida.fuente.titulo}</cite>{elegida.fuente.capitulo ? `, ${elegida.fuente.capitulo}` : ''}
  </p>
  <Tablero fen={vista.fen} orientacion="white" ultimaJugada={vista.ultima} />
  {#key elegida.id}
    <VisorLinea
      linea={{ titulo: 'Jugadas', fen: FEN_INICIAL, ucis: elegida.jugadas }}
      comentarios={elegida.comentarios}
      autoReproducir={false}
      alMover={(f, u) => (vista = { fen: f, ultima: u })}
    />
  {/key}
{:else}
  <p class="suave">
    Partidas tomadas de los libros de tu biblioteca, con libro y capítulo. Las jugadas son las de la partida; cuando hay
    comentarios, son propios (ideas del libro con otras palabras, verificadas con Stockfish).
  </p>
  {#if cargando}
    <p>Cargando…</p>
  {:else if !todas.length}
    <p class="suave">Todavía no hay partidas de libros en esta versión.</p>
  {:else}
    <div class="filtros">
      <input type="search" placeholder="Buscar jugador, lugar o año" bind:value={busqueda} />
      <select bind:value={libro}>
        <option value={undefined}>Todos los libros</option>
        {#each libros as l (l)}<option value={l}>{l}</option>{/each}
      </select>
    </div>
    <p class="suave">{filtradas.length} partidas</p>
    <ul class="lista">
      {#each visibles as p (p.id)}
        <li>
          <button
            onclick={() => {
              vista = { fen: FEN_INICIAL }
              elegida = p
            }}
          >
            <b>{titulo(p)}</b>
            <span class="suave">{[p.lugar, p.anio].filter(Boolean).join(', ')} · {Math.ceil(p.jugadas.length / 2)} jugadas</span>
          </button>
        </li>
      {/each}
    </ul>
    {#if filtradas.length > POR_PAGINA}
      <div class="fila">
        <button class="boton" disabled={pagina === 0} onclick={() => pagina--}>Anteriores</button>
        <span class="suave">Página {pagina + 1} de {Math.ceil(filtradas.length / POR_PAGINA)}</span>
        <button class="boton" disabled={(pagina + 1) * POR_PAGINA >= filtradas.length} onclick={() => pagina++}>Siguientes</button>
      </div>
    {/if}
  {/if}
{/if}

<style>
  .filtros {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }
  .filtros input,
  .filtros select {
    flex: 1;
    min-width: 200px;
  }
  .lista {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .lista button {
    width: 100%;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    border: 1px solid var(--borde);
    border-radius: 8px;
    background: var(--superficie);
    color: var(--texto);
  }
  .fila {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }
</style>
