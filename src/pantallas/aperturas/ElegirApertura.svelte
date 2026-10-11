<script lang="ts">
  import { lineaConNumeros } from '../../lib/ajedrez/posicion.ts'
  import { EXPLICACIONES } from '../../lib/aperturas/explicaciones.ts'
  import type { Color } from '../../lib/datos/tipos.ts'

  interface Props {
    alElegir: (color: Color, raiz: string[], nombre: string) => void
  }
  let { alElegir }: Props = $props()

  const INICIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

  let busqueda = $state('')

  const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  let filtradas = $derived(
    busqueda.trim() ? EXPLICACIONES.filter((e) => sinAcentos(e.nombre).includes(sinAcentos(busqueda.trim()))) : EXPLICACIONES,
  )
</script>

<p class="suave">
  Elegí una apertura y el color: vas directo al tablero. Jugás tus jugadas y el rival responde con la teoría, como en
  LotusChess; si te equivocás, te corrige y la línea vuelve antes al repaso.
</p>

<input class="busqueda" type="search" placeholder="Buscar apertura…" bind:value={busqueda} />

<ul class="aperturas">
  {#each filtradas as e (e.id)}
    <li>
      <div class="nombre">
        <b>{e.nombre}</b>
        <span class="suave">{lineaConNumeros(INICIAL, e.raiz.split(' '))}</span>
      </div>
      <div class="botones">
        <button class="boton" onclick={() => alElegir('white', e.raiz.split(' '), e.nombre)}>Blancas</button>
        <button class="boton" onclick={() => alElegir('black', e.raiz.split(' '), e.nombre)}>Negras</button>
      </div>
    </li>
  {/each}
</ul>
{#if !filtradas.length}<p class="suave">No hay aperturas con ese nombre.</p>{/if}

<style>
  .busqueda {
    width: 100%;
    margin: 4px 0 8px;
  }
  .aperturas {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 6px;
  }
  @media (min-width: 900px) {
    .aperturas {
      grid-template-columns: 1fr 1fr;
    }
  }
  .aperturas li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border: 1px solid var(--borde);
    border-radius: var(--radio);
    background: var(--superficie);
    padding: 8px 10px;
  }
  .nombre {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .nombre .suave {
    font-size: 0.82rem;
  }
  .botones {
    display: flex;
    gap: 6px;
    flex: none;
  }
  .botones .boton {
    padding: 4px 10px;
  }
</style>
