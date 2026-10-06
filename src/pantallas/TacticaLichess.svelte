<script lang="ts">
  import { armarSesionProblemas, cargarProblemas, estadoProblemas, FILTROS_PROBLEMAS, nombreTema, TEMAS_FILTRO, type FiltrosProblemas, type Problema } from '../lib/problemas/problemas.ts'
  import type { ResultadoIntento } from '../lib/repaso/repaso.ts'
  import ProblemaLichess from '../lib/ui/ProblemaLichess.svelte'

  const RANGOS: [number, number, string][] = [
    [1400, 1700, '1400 a 1700'],
    [1500, 2000, '1500 a 2000 (alrededor de tu nivel)'],
    [1700, 2000, '1700 a 2000'],
    [2000, 2200, '2000 a 2200 (más difíciles)'],
    [1400, 2200, 'Todos'],
  ]

  let filtros = $state<FiltrosProblemas>({ ...FILTROS_PROBLEMAS })
  let rango = $state(1)
  let resumen = $state<{ total: number; vencidos: number; nuevosHoy: number; nuevos: number }>()
  let hayDatos = $state(true)
  let sesion = $state<Problema[]>([])
  let indice = $state(0)
  let enSesion = $state(false)
  let resultados = $state<ResultadoIntento[]>([])

  cargarProblemas().then((p) => (hayDatos = p.length > 0))

  $effect(() => {
    filtros.ratingMin = RANGOS[rango][0]
    filtros.ratingMax = RANGOS[rango][1]
  })

  async function actualizar() {
    const e = await estadoProblemas($state.snapshot(filtros))
    resumen = { total: e.todos.length, vencidos: e.vencidos.length, nuevosHoy: Math.min(e.nuevosHoy, e.nuevos.length), nuevos: e.nuevos.length }
  }

  $effect(() => {
    void [filtros.tema, filtros.ratingMin, filtros.ratingMax]
    actualizar()
  })

  async function empezar() {
    sesion = await armarSesionProblemas($state.snapshot(filtros))
    indice = 0
    resultados = []
    enSesion = sesion.length > 0
  }

  async function seguir(r: ResultadoIntento) {
    resultados.push(r)
    indice++
    if (indice >= sesion.length) {
      enSesion = false
      await actualizar()
    }
  }
</script>

{#if enSesion && sesion[indice]}
  <div class="barra">
    <span>Problema {indice + 1} de {sesion.length}</span>
    <button class="boton enlace" onclick={() => { enSesion = false; actualizar() }}>Terminar</button>
  </div>
  {#key sesion[indice].id}
    <ProblemaLichess problema={sesion[indice]} alSeguir={seguir} />
  {/key}
{:else if !hayDatos}
  <p class="suave">La selección de problemas no está disponible en esta versión.</p>
{:else}
  <p class="suave">
    Una selección de la base pública de problemas de Lichess (CC0): problemas probados por miles de jugadores y bien
    valorados, filtrados por tema y rating. Los que fallás vuelven antes.
  </p>
  {#if resultados.length}
    <p><b>Sesión terminada: {resultados.filter((r) => r !== 'mal').length} de {resultados.length} bien.</b></p>
  {/if}
  <section class="tarjeta">
    {#if resumen}
      <div class="numeros">
        <div><b>{resumen.vencidos}</b><span>para repasar</span></div>
        <div><b>{resumen.nuevosHoy}</b><span>nuevos hoy</span></div>
        <div><b>{resumen.total}</b><span>con estos filtros</span></div>
      </div>
      <button class="boton principal" onclick={empezar} disabled={resumen.vencidos + resumen.nuevosHoy === 0}>Empezar</button>
    {:else}
      <p>Cargando…</p>
    {/if}
  </section>
  <section class="tarjeta">
    <h2>Filtros</h2>
    <label>
      Tema
      <select bind:value={filtros.tema}>
        <option value={undefined}>Todos</option>
        {#each TEMAS_FILTRO as t (t)}<option value={t}>{nombreTema(t)}</option>{/each}
      </select>
    </label>
    <label>
      Rating
      <select bind:value={rango}>
        {#each RANGOS as r, i (i)}<option value={i}>{r[2]}</option>{/each}
      </select>
    </label>
  </section>
{/if}

<style>
  .barra {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    color: var(--texto-suave);
  }
  label {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  select {
    flex: 1;
  }
</style>
