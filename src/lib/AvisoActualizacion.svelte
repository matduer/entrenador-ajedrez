<script lang="ts">
  import { registerSW } from 'virtual:pwa-register'

  let hayVersionNueva = $state(false)
  let listaOffline = $state(false)

  const actualizar = registerSW({
    onNeedRefresh: () => (hayVersionNueva = true),
    onOfflineReady: () => (listaOffline = true),
  })
</script>

{#if hayVersionNueva}
  <div class="aviso" role="status">
    <span>Hay una versión nueva.</span>
    <button onclick={() => actualizar(true)}>Actualizar</button>
    <button class="secundario" onclick={() => (hayVersionNueva = false)}>Después</button>
  </div>
{:else if listaOffline}
  <div class="aviso" role="status">
    <span>Lista para usar sin conexión.</span>
    <button class="secundario" onclick={() => (listaOffline = false)}>Cerrar</button>
  </div>
{/if}

<style>
  .aviso {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: calc(72px + env(safe-area-inset-bottom));
    max-width: 420px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--superficie);
    border: 1px solid var(--borde);
    border-radius: var(--radio);
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.2);
  }

  span {
    flex: 1;
  }

  button {
    border: none;
    border-radius: 8px;
    padding: 6px 12px;
    background: var(--acento);
    color: var(--acento-texto);
  }

  .secundario {
    background: transparent;
    color: var(--texto-suave);
  }
</style>
