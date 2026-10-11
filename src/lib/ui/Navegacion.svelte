<script lang="ts">
  import { lineaSan } from '../ajedrez/posicion.ts'
  import type { Exploracion } from './exploracion.svelte.ts'

  interface Props {
    ex: Exploracion
    /** Jugadas desde las que empieza la parte interesante (en los problemas de Lichess, después de la jugada del rival). */
    desde?: number
  }
  let { ex, desde = 0 }: Props = $props()

  let sans = $derived(lineaSan(ex.base, ex.ucis))
  // Numeración: "23." antes de cada jugada de blancas, "23…" si la línea arranca con negras.
  let etiquetas = $derived.by(() => {
    let numero = Number(ex.base.split(' ')[5] ?? 1)
    let blancas = ex.base.split(' ')[1] === 'w'
    return sans.map((san, i) => {
      const prefijo = blancas ? `${numero}. ` : i === 0 ? `${numero}… ` : ''
      if (!blancas) numero++
      blancas = !blancas
      return prefijo + san
    })
  })

  // Flechas del teclado, como en Lichess (salvo que se esté escribiendo en un campo).
  $effect(() => {
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return
      if (e.key === 'ArrowLeft') ex.ir(ex.idx - 1)
      else if (e.key === 'ArrowRight') ex.ir(ex.idx + 1)
      else if (e.key === 'ArrowUp' || e.key === 'Home') ex.ir(desde)
      else if (e.key === 'ArrowDown' || e.key === 'End') ex.ir(ex.ucis.length)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })
</script>

<div class="navegacion">
  <div class="jugadas">
    {#each etiquetas as e, i (i)}
      {#if i >= desde}
        <button class="jugada" class:actual={ex.idx === i + 1} onclick={() => ex.ir(i + 1)}>{e}</button>
      {/if}
    {:else}
      <span class="suave">Mové en el tablero para analizar.</span>
    {/each}
  </div>
  <div class="botones">
    <button class="boton" title="Al principio" aria-label="Al principio" onclick={() => ex.ir(desde)} disabled={ex.idx <= desde}>⏮</button>
    <button class="boton" title="Atrás (←)" aria-label="Atrás" onclick={() => ex.ir(ex.idx - 1)} disabled={ex.idx <= 0}>◀</button>
    <button class="boton" title="Adelante (→)" aria-label="Adelante" onclick={() => ex.ir(ex.idx + 1)} disabled={ex.idx >= ex.ucis.length}>▶</button>
    <button class="boton" title="Al final" aria-label="Al final" onclick={() => ex.ir(ex.ucis.length)} disabled={ex.idx >= ex.ucis.length}>⏭</button>
  </div>
</div>

<style>
  .navegacion {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .jugadas {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 4px;
    max-height: 160px;
    overflow-y: auto;
  }
  .jugada {
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    padding: 2px 4px;
    border-radius: 4px;
    cursor: pointer;
  }
  .jugada:hover {
    background: var(--borde);
  }
  .jugada.actual {
    background: var(--acento);
    color: var(--acento-texto);
  }
  .botones {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
</style>
