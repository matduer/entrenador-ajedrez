<script lang="ts">
  import { SECCIONES, type IdSeccion } from './lib/secciones'
  import AvisoActualizacion from './lib/AvisoActualizacion.svelte'
  import Ajustes from './pantallas/Ajustes.svelte'
  import MisPartidas from './pantallas/MisPartidas.svelte'
  import Tactica from './pantallas/Tactica.svelte'

  function seccionDesdeHash(): IdSeccion {
    const id = location.hash.replace('#/', '')
    return SECCIONES.some((s) => s.id === id) ? (id as IdSeccion) : 'partidas'
  }

  let actual = $state<IdSeccion>(seccionDesdeHash())
  let seccion = $derived(SECCIONES.find((s) => s.id === actual)!)
  let enLinea = $state(navigator.onLine)
</script>

<svelte:window
  onhashchange={() => (actual = seccionDesdeHash())}
  ononline={() => (enLinea = true)}
  onoffline={() => (enLinea = false)}
/>

<div class="marco">
  <nav aria-label="Secciones">
    {#each SECCIONES as s (s.id)}
      <a href={`#/${s.id}`} aria-current={s.id === actual ? 'page' : undefined}>
        <span class="icono" aria-hidden="true">{s.icono}</span>
        <span class="rotulo">{s.titulo}</span>
      </a>
    {/each}
  </nav>

  <main>
    {#if !enLinea}
      <p class="sin-conexion">Sin conexión: todo funciona salvo importar partidas y las consultas en línea.</p>
    {/if}
    {#if actual === 'partidas'}
      <MisPartidas />
    {:else if actual === 'tactica'}
      <Tactica />
    {:else if actual === 'ajustes'}
      <Ajustes />
    {:else}
      <h1>{seccion.titulo}</h1>
      <p class="descripcion">{seccion.descripcion}</p>
      <p class="pendiente">En construcción</p>
    {/if}
  </main>
</div>

<AvisoActualizacion />

<style>
  .marco {
    display: flex;
    flex-direction: column-reverse;
    min-height: 100dvh;
  }

  nav {
    position: sticky;
    bottom: 0;
    display: flex;
    justify-content: space-around;
    background: var(--superficie);
    border-top: 1px solid var(--borde);
    padding-bottom: env(safe-area-inset-bottom);
  }

  nav a {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 4px;
    color: var(--texto-suave);
    text-decoration: none;
    font-size: 0.72rem;
  }

  nav a[aria-current='page'] {
    color: var(--acento);
  }

  .icono {
    font-size: 1.35rem;
    line-height: 1;
  }

  main {
    flex: 1;
    padding: 24px 16px;
    max-width: 760px;
    width: 100%;
    margin: 0 auto;
  }

  .descripcion {
    color: var(--texto-suave);
  }

  .pendiente {
    display: inline-block;
    padding: 4px 10px;
    border: 1px dashed var(--borde);
    border-radius: var(--radio);
    color: var(--texto-suave);
    font-size: 0.85rem;
  }

  .sin-conexion {
    background: var(--superficie);
    border: 1px solid var(--borde);
    border-radius: var(--radio);
    padding: 8px 12px;
    font-size: 0.85rem;
  }

  @media (min-width: 900px) {
    .marco {
      flex-direction: row;
    }

    nav {
      position: sticky;
      top: 0;
      height: 100dvh;
      flex-direction: column;
      justify-content: flex-start;
      width: 200px;
      border-top: none;
      border-right: 1px solid var(--borde);
      padding: 16px 8px;
    }

    nav a {
      flex: none;
      flex-direction: row;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--radio);
      font-size: 0.95rem;
    }

    nav a[aria-current='page'] {
      background: var(--fondo);
    }
  }
</style>
