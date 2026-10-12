<script lang="ts">
  import { Chessground } from 'chessground'
  import 'chessground/assets/chessground.base.css'
  import 'chessground/assets/chessground.brown.css'
  import 'chessground/assets/chessground.cburnett.css'

  /** Tablero chico, solo para mostrar: sin coordenadas, sin mover piezas. */
  interface Props {
    fen: string
    orientacion: 'white' | 'black'
  }
  let { fen, orientacion }: Props = $props()

  let elemento: HTMLDivElement

  $effect(() => {
    const cg = Chessground(elemento, { fen, orientation: orientacion, viewOnly: true, coordinates: false, animation: { enabled: false } })
    const observador = new ResizeObserver(() => cg.redrawAll())
    observador.observe(elemento)
    return () => {
      observador.disconnect()
      cg.destroy()
    }
  })
</script>

<div class="mini" bind:this={elemento}></div>

<style>
  .mini {
    width: 100%;
    aspect-ratio: 1 / 1;
  }
</style>
