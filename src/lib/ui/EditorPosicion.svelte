<script lang="ts">
  import { untrack } from 'svelte'
  import { Chessground } from 'chessground'
  import type { Api } from 'chessground/api'
  import type { Key, Piece } from 'chessground/types'
  import { Chess } from 'chessops/chess'
  import { parseFen } from 'chessops/fen'
  import 'chessground/assets/chessground.base.css'
  import 'chessground/assets/chessground.brown.css'
  import 'chessground/assets/chessground.cburnett.css'

  interface Props {
    alJugar: (fen: string, objetivo: 'ganar' | 'tablas') => void
  }
  let { alJugar }: Props = $props()

  const PIEZAS: Piece[] = (['white', 'black'] as const).flatMap((color) =>
    (['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'] as const).map((role) => ({ color, role })),
  )

  let elemento: HTMLDivElement
  let cg: Api | undefined
  let seleccionada = $state<Piece | 'borrar' | undefined>()
  let turno = $state<'w' | 'b'>('w')
  let objetivo = $state<'ganar' | 'tablas'>('ganar')
  let textoFen = $state('8/8/8/4k3/8/8/4P3/4K3 w - - 0 1')
  let error = $state('')

  function fenCompleto(): string {
    return `${cg?.getFen() ?? '8/8/8/8/8/8/8/8'} ${turno} - - 0 1`
  }

  $effect(() => {
    // El tablero se crea una sola vez: la posición inicial se lee sin suscribirse a cambios.
    const inicial = untrack(() => textoFen.split(' ')[0])
    cg = Chessground(elemento, {
      fen: inicial,
      movable: { free: true, color: 'both' },
      draggable: { deleteOnDropOff: true },
      premovable: { enabled: false },
      highlight: { lastMove: false },
      events: {
        select: (key: Key) => {
          if (!cg || !seleccionada) return
          if (seleccionada === 'borrar') cg.setPieces(new Map([[key, undefined]]))
          else cg.setPieces(new Map([[key, { ...seleccionada }]]))
        },
        change: () => (textoFen = fenCompleto()),
      },
    })
    const obs = new ResizeObserver(() => cg?.redrawAll())
    obs.observe(elemento)
    return () => {
      obs.disconnect()
      cg?.destroy()
    }
  })

  $effect(() => {
    void turno
    textoFen = fenCompleto()
  })

  function cargarFen() {
    const partes = textoFen.trim().split(/\s+/)
    if (parseFen(textoFen.trim()).isErr) {
      error = 'El FEN no es válido.'
      return
    }
    cg?.set({ fen: partes[0] })
    if (partes[1] === 'b' || partes[1] === 'w') turno = partes[1]
    error = ''
  }

  function jugar() {
    const fen = fenCompleto()
    const setup = parseFen(fen)
    if (setup.isErr) {
      error = 'Posición inválida.'
      return
    }
    const pos = Chess.fromSetup(setup.value)
    if (pos.isErr) {
      error = 'Posición ilegal: revisá que haya un rey de cada color y que el bando que no mueve no esté en jaque.'
      return
    }
    error = ''
    alJugar(fen, objetivo)
  }

  const simbolo = (p: Piece) => ({ king: 'R', queen: 'D', rook: 'T', bishop: 'A', knight: 'C', pawn: 'P' })[p.role]
</script>

<div class="editor">
  <div class="tablero" bind:this={elemento}></div>
  <div class="paleta">
    {#each PIEZAS as p (p.color + p.role)}
      <button class="pieza {p.color}" class:activa={seleccionada !== 'borrar' && seleccionada?.color === p.color && seleccionada?.role === p.role} onclick={() => (seleccionada = p)} aria-label={`${p.role} ${p.color}`}>
        {simbolo(p)}
      </button>
    {/each}
    <button class="pieza" class:activa={seleccionada === 'borrar'} onclick={() => (seleccionada = 'borrar')}>✕</button>
    <button class="pieza" class:activa={!seleccionada} onclick={() => (seleccionada = undefined)}>✋</button>
  </div>
  <p class="suave">Elegí una pieza y tocá una casilla para ponerla (✕ borra, ✋ mueve arrastrando). También podés arrastrar fuera del tablero para sacar una pieza.</p>
  <label>FEN <input bind:value={textoFen} onchange={cargarFen} spellcheck="false" /></label>
  <div class="fila">
    <label><input type="radio" bind:group={turno} value="w" /> Mueven blancas</label>
    <label><input type="radio" bind:group={turno} value="b" /> Mueven negras</label>
  </div>
  <div class="fila">
    <label><input type="radio" bind:group={objetivo} value="ganar" /> Objetivo: ganar</label>
    <label><input type="radio" bind:group={objetivo} value="tablas" /> Objetivo: tablas</label>
  </div>
  {#if error}<p class="mal">{error}</p>{/if}
  <button class="boton principal" onclick={jugar}>Jugar contra Stockfish</button>
  <p class="suave">Jugás con el bando que mueve. Con 7 piezas o menos y conexión, el rival juega perfecto con las tablebases de Lichess.</p>
</div>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .tablero {
    width: min(100%, calc(100dvh - 300px));
    min-width: min(100%, 280px);
    aspect-ratio: 1 / 1;
    margin: 0 auto;
  }
  .paleta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    justify-content: center;
  }
  .pieza {
    width: 36px;
    height: 36px;
    border: 1px solid var(--borde);
    border-radius: 8px;
    background: var(--superficie);
    color: var(--texto);
    font-weight: 700;
  }
  .pieza.white {
    background: #f4efe6;
    color: #23201c;
  }
  .pieza.black {
    background: #3a3630;
    color: #f4efe6;
  }
  .pieza.activa {
    outline: 2px solid var(--acento);
  }
  label {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  label input:not([type='radio']) {
    flex: 1;
  }
  .mal {
    color: #c9483c;
  }
</style>
