<script lang="ts" module>
  export interface Linea {
    titulo: string
    fen: string // posición de partida
    ucis: string[]
  }
</script>

<script lang="ts">
  import { fenDe, jugarUci, lineaSan, posDesdeFen } from '../ajedrez/posicion.ts'
  import type { Position } from 'chessops/chess'

  interface Props {
    linea: Linea
    /** Informa la posición a mostrar en el tablero, la última jugada y la próxima. */
    alMover: (fen: string, ultima?: string, proxima?: string) => void
  }

  let { linea, alMover }: Props = $props()

  let fens = $derived.by(() => {
    const lista = [linea.fen]
    let pos: Position = posDesdeFen(linea.fen)
    for (const uci of linea.ucis) {
      const sig = jugarUci(pos, uci)
      if (!sig) break
      pos = sig
      lista.push(fenDe(pos))
    }
    return lista
  })
  let sans = $derived(lineaSan(linea.fen, linea.ucis))
  let idx = $state(0)
  let reproduciendo = $state(true)

  // Numeración de jugadas: "23." antes de cada jugada de blancas, "23…" si la línea arranca con negras.
  let etiquetas = $derived.by(() => {
    let numero = Number(linea.fen.split(' ')[5] ?? 1)
    let blancas = linea.fen.split(' ')[1] === 'w'
    return sans.map((san, i) => {
      const prefijo = blancas ? `${numero}. ` : i === 0 ? `${numero}… ` : ''
      if (!blancas) numero++
      blancas = !blancas
      return prefijo + san
    })
  })

  function ir(i: number) {
    idx = Math.max(0, Math.min(fens.length - 1, i))
    alMover(fens[idx], idx > 0 ? linea.ucis[idx - 1] : undefined, linea.ucis[idx])
  }

  $effect(() => {
    void linea
    idx = 0
    reproduciendo = true
    ir(0)
  })

  $effect(() => {
    if (!reproduciendo) return
    const t = setInterval(() => {
      if (idx >= fens.length - 1) reproduciendo = false
      else ir(idx + 1)
    }, 1100)
    return () => clearInterval(t)
  })

  function manual(i: number) {
    reproduciendo = false
    ir(i)
  }
</script>

<div class="visor">
  <div class="titulo">{linea.titulo}</div>
  <div class="jugadas">
    {#each etiquetas as e, i (i)}
      <button class:actual={i === idx - 1} onclick={() => manual(i + 1)}>{e}</button>
    {/each}
    {#if etiquetas.length === 0}<span class="vacio">Sin jugadas.</span>{/if}
  </div>
  <div class="controles">
    <button onclick={() => manual(0)} aria-label="Al principio">⏮</button>
    <button onclick={() => manual(idx - 1)} aria-label="Anterior">◀</button>
    <button onclick={() => (reproduciendo = !reproduciendo)} aria-label={reproduciendo ? 'Pausar' : 'Reproducir'}>
      {reproduciendo ? '⏸' : '⏵'}
    </button>
    <button onclick={() => manual(idx + 1)} aria-label="Siguiente">▶</button>
    <button onclick={() => manual(fens.length - 1)} aria-label="Al final">⏭</button>
  </div>
</div>

<style>
  .visor {
    border: 1px solid var(--borde);
    border-radius: var(--radio);
    padding: 10px 12px;
    background: var(--superficie);
  }
  .titulo {
    font-weight: 600;
    margin-bottom: 6px;
  }
  .jugadas {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 6px;
    font-variant-numeric: tabular-nums;
  }
  .jugadas button {
    border: none;
    background: transparent;
    color: var(--texto);
    padding: 2px 4px;
    border-radius: 6px;
  }
  .jugadas button.actual {
    background: var(--acento);
    color: var(--acento-texto);
  }
  .vacio {
    color: var(--texto-suave);
  }
  .controles {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }
  .controles button {
    flex: 1;
    border: 1px solid var(--borde);
    background: var(--fondo);
    color: var(--texto);
    border-radius: 8px;
    padding: 6px 0;
  }
</style>
