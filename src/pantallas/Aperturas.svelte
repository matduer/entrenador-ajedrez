<script lang="ts">
  import { armarArbol, lineasDesde } from '../lib/aperturas/arbol.ts'
  import { cargarCatalogo } from '../lib/aperturas/catalogo.ts'
  import { EXPLICACIONES } from '../lib/aperturas/explicaciones.ts'
  import type { Color } from '../lib/datos/tipos.ts'
  import Explorador from './aperturas/Explorador.svelte'
  import Practica from './aperturas/Practica.svelte'
  import Repertorio from './aperturas/Repertorio.svelte'

  let modo = $state<'explorar' | 'repertorio' | 'practica'>('explorar')
  let inicial = $state<string[]>([])
  let practica = $state<{ color: Color; lineas: string[][]; titulo: string }>()
  let claveExplorador = $state(0)

  async function practicarDesde(color: Color, prefijo: string[], titulo: string) {
    const arbol = armarArbol(await cargarCatalogo())
    const lineas = lineasDesde(arbol, prefijo, 40)
    practica = { color, lineas: lineas.length ? lineas : [prefijo], titulo }
    modo = 'practica'
  }

  function practicarLineas(color: Color, lineas: string[][], titulo: string) {
    practica = { color, lineas, titulo }
    modo = 'practica'
  }

  function explorar(ucis: string[]) {
    inicial = ucis
    claveExplorador++
    modo = 'explorar'
  }
</script>

<h1>Aperturas</h1>

<div class="pestanas" role="tablist">
  <button role="tab" aria-selected={modo === 'explorar'} onclick={() => (modo = 'explorar')}>Explorar</button>
  <button role="tab" aria-selected={modo === 'repertorio'} onclick={() => (modo = 'repertorio')}>Mi repertorio</button>
  <button role="tab" aria-selected={modo === 'practica'} onclick={() => (modo = 'practica')} disabled={!practica}>Práctica</button>
</div>

{#if modo === 'explorar'}
  {#if EXPLICACIONES.length}
    <p class="suave">
      Con explicación escrita:
      {#each EXPLICACIONES as e, i (e.id)}{i ? ' · ' : ''}<button class="boton enlace" onclick={() => explorar(e.raiz.split(' '))}>{e.nombre}</button>{/each}
    </p>
  {/if}
  {#key claveExplorador}
    <Explorador {inicial} alPracticar={practicarDesde} />
  {/key}
{:else if modo === 'repertorio'}
  <Repertorio alPracticar={practicarLineas} alExplorar={explorar} />
{:else if practica}
  {#key practica}
    <Practica {...practica} alSalir={() => (modo = 'explorar')} />
  {/key}
{/if}
