<script lang="ts" module>
  /** Flecha de `de` a `a`, o círculo en `de` si no hay `a`. */
  export interface Flecha {
    de: string
    a?: string
    color?: 'green' | 'red' | 'blue' | 'yellow'
  }
</script>

<script lang="ts">
  import { Chessground } from 'chessground'
  import type { Api } from 'chessground/api'
  import type { Key } from 'chessground/types'
  import { chessgroundDests } from 'chessops/compat'
  import 'chessground/assets/chessground.base.css'
  import 'chessground/assets/chessground.brown.css'
  import 'chessground/assets/chessground.cburnett.css'
  import { posDesdeFen } from '../ajedrez/posicion.ts'

  interface Props {
    fen: string
    orientacion: 'white' | 'black'
    /** Si se define, se pueden mover las piezas de ese color (cuando le toca). */
    puedeMover?: 'white' | 'black'
    ultimaJugada?: string
    flechas?: Flecha[]
    alJugar?: (uci: string) => void
  }

  let { fen, orientacion, puedeMover, ultimaJugada, flechas = [], alJugar }: Props = $props()

  let elemento: HTMLDivElement
  let cg: Api | undefined

  function configurar() {
    const pos = posDesdeFen(fen)
    const mueve = puedeMover && pos.turn === puedeMover ? puedeMover : undefined
    const ultima = ultimaJugada ? ([ultimaJugada.slice(0, 2), ultimaJugada.slice(2, 4)] as Key[]) : undefined
    const config = {
      fen,
      orientation: orientacion,
      turnColor: pos.turn,
      check: pos.isCheck(),
      lastMove: ultima,
      movable: {
        free: false,
        color: mueve,
        dests: mueve ? (chessgroundDests(pos) as Map<Key, Key[]>) : new Map(),
        showDests: true,
        events: {
          after: (de: Key, a: Key) => {
            // Coronación: siempre a dama (la subpromoción casi nunca es la clave de un ejercicio).
            const rol = cg?.state.pieces.get(a)?.role
            const fila = a[1]
            const corona = rol === 'pawn' && (fila === '8' || fila === '1')
            alJugar?.(de + a + (corona ? 'q' : ''))
          },
        },
      },
      drawable: {
        autoShapes: flechas.map((f) => ({ orig: f.de as Key, dest: f.a as Key | undefined, brush: f.color ?? 'green' })),
      },
    }
    if (cg) cg.set(config)
    else
      cg = Chessground(elemento, {
        ...config,
        coordinates: true,
        animation: { enabled: true, duration: 200 },
        // Solo en desarrollo: acepta eventos simulados para poder probar la app automáticamente.
        trustAllEvents: import.meta.env.DEV,
      })
  }

  $effect(() => {
    // Dependencias: cualquier cambio de estas props redibuja el tablero.
    void [fen, orientacion, puedeMover, ultimaJugada, flechas]
    configurar()
  })

  // chessground guarda las medidas del tablero: si el contenedor cambia de tamaño, hay que avisarle.
  $effect(() => {
    const observador = new ResizeObserver(() => cg?.redrawAll())
    observador.observe(elemento)
    return () => {
      observador.disconnect()
      cg?.destroy()
    }
  })
</script>

<div class="tablero" bind:this={elemento}></div>

<style>
  /* Cuadrado, tan grande como entre a lo ancho y sin pasarse del alto de la pantalla. */
  .tablero {
    width: min(100%, calc(100dvh - 240px));
    min-width: min(100%, 280px);
    aspect-ratio: 1 / 1;
    margin: 0 auto;
  }
</style>
