<script lang="ts">
  import { NOMBRE_FASE } from '../lib/ajedrez/fase.ts'
  import { familiaEnEspanol } from '../lib/aperturas/catalogo.ts'
  import { db } from '../lib/datos/db.ts'
  import type { ErrorPartida, Partida, Ritmo } from '../lib/datos/tipos.ts'
  import {
    completarAperturas,
    filtrar,
    porApertura,
    porFase,
    puntaje,
    reloj,
    resumen,
    type FiltroEstadisticas,
  } from '../lib/estadisticas/estadisticas.ts'
  import Barra from '../lib/ui/Barra.svelte'

  let { version }: { version: number } = $props()

  const NOMBRE_RITMO: Record<Ritmo, string> = {
    ultrabullet: 'Ultrabullet',
    bullet: 'Bullet',
    blitz: 'Blitz',
    rapida: 'Rápida',
    clasica: 'Clásica',
    correspondencia: 'Correspondencia',
  }
  const DIA = 86_400_000

  let todas = $state.raw<Partida[]>([])
  let errores = $state.raw<ErrorPartida[]>([])
  let cargando = $state(true)
  let ritmo = $state<Ritmo | ''>('')
  let periodo = $state<'todo' | 'anio' | 'trimestre'>('todo')
  let color = $state<'' | 'white' | 'black'>('')
  let pestana = $state<'resumen' | 'aperturas' | 'fases' | 'reloj'>('resumen')
  let abierta = $state<string>()

  $effect(() => {
    void version
    cargando = true
    completarAperturas()
      .then(() => Promise.all([db.partidas.toArray(), db.errores.toArray()]))
      .then(([p, e]) => {
        todas = p
        errores = e
        cargando = false
      })
  })

  let filtro = $derived<FiltroEstadisticas>({
    ritmo: ritmo || undefined,
    color: color || undefined,
    desde: periodo === 'anio' ? Date.now() - 365 * DIA : periodo === 'trimestre' ? Date.now() - 91 * DIA : undefined,
  })
  let partidas = $derived(filtrar(todas, filtro))
  let ids = $derived(new Set(partidas.map((p) => p.id)))
  let erroresFiltrados = $derived(errores.filter((e) => ids.has(e.partidaId)))
  let res = $derived(resumen(partidas))
  let aperturas = $derived(porApertura(partidas, erroresFiltrados))
  let fases = $derived(porFase(erroresFiltrados))
  let totalErroresFase = $derived(fases.reduce((s, f) => s + f.errores, 0))
  let rel = $derived(reloj(partidas, erroresFiltrados))
  let maxMensual = $derived(Math.max(0.01, ...rel.mensual.map((m) => (m.partidas ? m.perdidasPorTiempo / m.partidas : 0))))

  const pct = (x: number, d = 0) => `${(100 * x).toFixed(d).replace('.', ',')} %`
  const porc = (a: number, b: number) => (b ? pct(a / b) : '—')
</script>

<section class="tarjeta">
  <div class="filtros">
    <label>
      Ritmo
      <select bind:value={ritmo}>
        <option value="">Todos</option>
        {#each Object.entries(NOMBRE_RITMO) as [id, nombre] (id)}<option value={id}>{nombre}</option>{/each}
      </select>
    </label>
    <label>
      Período
      <select bind:value={periodo}>
        <option value="todo">Todo</option>
        <option value="anio">Último año</option>
        <option value="trimestre">Últimos 3 meses</option>
      </select>
    </label>
    <label>
      Color
      <select bind:value={color}>
        <option value="">Los dos</option>
        <option value="white">Blancas</option>
        <option value="black">Negras</option>
      </select>
    </label>
  </div>
  <div class="pestanas" role="tablist">
    {#each [['resumen', 'Resumen'], ['aperturas', 'Aperturas'], ['fases', 'Fases'], ['reloj', 'Reloj']] as [id, nombre] (id)}
      <button role="tab" aria-selected={pestana === id} onclick={() => (pestana = id as typeof pestana)}>{nombre}</button>
    {/each}
  </div>
</section>

{#if cargando}
  <p class="suave">Calculando…</p>
{:else if partidas.length === 0}
  <p class="suave">No hay partidas con estos filtros.</p>
{:else if pestana === 'resumen'}
  <section class="tarjeta">
    <div class="numeros">
      <div><b>{res.total.n}</b><span>partidas</span></div>
      <div><b>{porc(res.total.gano, res.total.n)}</b><span>ganadas</span></div>
      <div><b>{porc(res.total.tablas, res.total.n)}</b><span>tablas</span></div>
      <div><b>{porc(res.total.pierdo, res.total.n)}</b><span>perdidas</span></div>
    </div>
    <table>
      <thead><tr><th></th><th class="num">Partidas</th><th class="num">Puntaje</th><th></th></tr></thead>
      <tbody>
        <tr><td>Con blancas</td><td class="num">{res.blancas.n}</td><td class="num">{pct(puntaje(res.blancas))}</td><td><Barra {...res.blancas} /></td></tr>
        <tr><td>Con negras</td><td class="num">{res.negras.n}</td><td class="num">{pct(puntaje(res.negras))}</td><td><Barra {...res.negras} /></td></tr>
        {#each res.porRitmo as r (r.ritmo)}
          <tr><td>{NOMBRE_RITMO[r.ritmo]}</td><td class="num">{r.m.n}</td><td class="num">{pct(puntaje(r.m))}</td><td><Barra {...r.m} /></td></tr>
        {/each}
      </tbody>
    </table>
    <p class="suave">Puntaje: victorias más la mitad de las tablas, sobre el total. Verde ganadas, gris tablas, rojo perdidas.</p>
  </section>
{:else if pestana === 'aperturas'}
  <section class="tarjeta">
    <p class="suave">
      Agrupadas con el catálogo abierto de aperturas de Lichess, por color. Se muestran las que tienen 5 partidas o más.
      Errores por partida: errores y errores graves, sobre las partidas con análisis.
    </p>
    <div class="tabla-scroll">
      <table>
        <thead><tr><th>Apertura</th><th></th><th class="num">Partidas</th><th class="num">Puntaje</th><th></th><th class="num">Err./partida</th></tr></thead>
        <tbody>
          {#each aperturas as a (a.color + a.familia)}
            {@const clave = a.color + a.familia}
            <tr class="clic" onclick={() => (abierta = abierta === clave ? undefined : clave)}>
              <td>
                {familiaEnEspanol(a.familia)}
                {#if a.m.n >= 15 && puntaje(a.m) < 0.45}<span class="etiqueta alerta">a revisar</span>{/if}
              </td>
              <td>{a.color === 'white' ? '○' : '●'}</td>
              <td class="num">{a.m.n}</td>
              <td class="num">{pct(puntaje(a.m))}</td>
              <td><Barra {...a.m} /></td>
              <td class="num">{a.analizadas ? (a.errores / a.analizadas).toFixed(2).replace('.', ',') : '—'}</td>
            </tr>
            {#if abierta === clave}
              {#each a.variantes.slice(0, 8) as v (v.nombre)}
                <tr class="variante">
                  <td colspan="2">{v.nombre.split(': ')[1] ?? 'Línea principal'}</td>
                  <td class="num">{v.m.n}</td>
                  <td class="num">{pct(puntaje(v.m))}</td>
                  <td><Barra {...v.m} /></td>
                  <td></td>
                </tr>
              {/each}
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
    <p class="suave">○ blancas · ● negras · Tocá una apertura para ver sus variantes. "A revisar": 15 partidas o más y puntaje menor a 45 %.</p>
  </section>
{:else if pestana === 'fases'}
  <section class="tarjeta">
    {#if totalErroresFase}
      {@const medio = fases.find((f) => f.fase === 'medio')!}
      <p>El <b>{porc(medio.errores, totalErroresFase)}</b> de tus errores ocurre en el medio juego.</p>
      <table>
        <thead><tr><th>Fase</th><th class="num">Errores</th><th class="num">Graves</th><th class="num">% del total</th><th class="num">Pérdida media</th></tr></thead>
        <tbody>
          {#each fases as f (f.fase)}
            <tr>
              <td>{NOMBRE_FASE[f.fase]}</td>
              <td class="num">{f.errores}</td>
              <td class="num">{f.graves}</td>
              <td class="num">{porc(f.errores, totalErroresFase)}</td>
              <td class="num">{pct(f.perdidaMedia / 2)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="suave">
        Pérdida media: cuánto bajan, en promedio, tus chances de ganar con cada error. Apertura: hasta la jugada 10; final:
        6 piezas o menos sin contar reyes ni peones.
      </p>
    {:else}
      <p class="suave">Todavía no hay errores detectados en estas partidas.</p>
    {/if}
  </section>
{:else}
  <section class="tarjeta">
    <h2>Partidas que se definen por tiempo</h2>
    <table>
      <thead><tr><th>Ritmo</th><th class="num">Partidas</th><th class="num">Por tiempo</th><th class="num">Perdidas por tiempo</th></tr></thead>
      <tbody>
        {#each rel.porTiempo as r (r.ritmo)}
          <tr>
            <td>{NOMBRE_RITMO[r.ritmo]}</td>
            <td class="num">{r.partidas}</td>
            <td class="num">{porc(r.porTiempo, r.partidas)}</td>
            <td class="num">{r.porTiempo ? `${porc(r.perdidasPorTiempo, r.porTiempo)} de esas` : '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>

  {#if rel.mensual.length > 1}
    <section class="tarjeta">
      <h2>Derrotas por tiempo, mes a mes</h2>
      <svg viewBox="0 0 {rel.mensual.length * 40} 130" class="grafico" role="img" aria-label="Porcentaje de partidas perdidas por tiempo en cada mes">
        {#each rel.mensual as m, i (m.mes)}
          {@const v = m.partidas ? m.perdidasPorTiempo / m.partidas : 0}
          {@const h = (90 * v) / maxMensual}
          <rect x={i * 40 + 8} y={100 - h} width="24" height={h} rx="3" class="columna"><title>{m.mes}: {porc(m.perdidasPorTiempo, m.partidas)} de {m.partidas} partidas</title></rect>
          <text x={i * 40 + 20} y={96 - h} class="valor">{m.partidas ? Math.round(100 * v) : ''}</text>
          <text x={i * 40 + 20} y="116" class="mes">{m.mes.slice(5)}</text>
          {#if i === 0 || m.mes.endsWith('-01')}<text x={i * 40 + 20} y="128" class="mes">{m.mes.slice(0, 4)}</text>{/if}
        {/each}
      </svg>
      <p class="suave">Porcentaje de las partidas de cada mes que perdiste por tiempo (últimos 12 meses con partidas). Es la métrica de seguimiento de tu plan.</p>
    </section>
  {/if}

  {#if rel.partidasConReloj}
    <section class="tarjeta">
      <h2>Cuánto tiempo te queda</h2>
      <table>
        <thead><tr><th>Al llegar a la jugada</th><th class="num">Tiempo restante (promedio)</th><th class="num">Con menos del 10 %</th></tr></thead>
        <tbody>
          {#each rel.restante as r (r.jugada)}
            <tr><td>{r.jugada}</td><td class="num">{pct(r.fraccion)} del inicial</td><td class="num">{pct(r.apurado)} de las partidas</td></tr>
          {/each}
        </tbody>
      </table>

      <h2>Dónde gastás el tiempo</h2>
      <table>
        <thead><tr><th>Tramo</th><th class="num">Segundos por jugada</th><th class="num">% del tiempo inicial por jugada</th></tr></thead>
        <tbody>
          {#each rel.usoPorTramo as t (t.tramo)}
            <tr><td>{t.tramo}</td><td class="num">{t.segundos.toFixed(1).replace('.', ',')}</td><td class="num">{pct(t.fraccionDeLaBase, 1)}</td></tr>
          {/each}
        </tbody>
      </table>

      {#if rel.erroresPorReloj.some((b) => b.jugadas)}
        <h2>Errores según el reloj</h2>
        <table>
          <thead><tr><th>Tiempo que te quedaba</th><th class="num">Jugadas</th><th class="num">Errores cada 100 jugadas</th></tr></thead>
          <tbody>
            {#each rel.erroresPorReloj as b (b.tramo)}
              <tr><td>{b.tramo}</td><td class="num">{b.jugadas}</td><td class="num">{b.jugadas ? ((100 * b.errores) / b.jugadas).toFixed(1).replace('.', ',') : '—'}</td></tr>
            {/each}
          </tbody>
        </table>
        <p class="suave">
          Incluye las partidas del análisis previo, que solo detectó pérdidas de material: la tasa absoluta queda baja, pero la
          comparación entre tramos vale porque el criterio es el mismo en todos.
        </p>
      {/if}
      <p class="suave">Sobre {rel.partidasConReloj} partidas con reloj registrado.</p>
    </section>
  {:else}
    <section class="tarjeta"><p class="suave">Estas partidas no tienen el reloj registrado.</p></section>
  {/if}
{/if}

<style>
  .filtros {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
  }
  .filtros label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.85rem;
    color: var(--texto-suave);
  }
  .pestanas {
    display: flex;
    gap: 4px;
  }
  .pestanas button {
    flex: 1;
    border: 1px solid var(--borde);
    background: var(--fondo);
    color: var(--texto-suave);
    border-radius: 8px;
    padding: 6px;
  }
  .pestanas button[aria-selected='true'] {
    color: var(--acento);
    border-color: var(--acento);
  }
  .clic {
    cursor: pointer;
  }
  .variante td {
    color: var(--texto-suave);
    font-size: 0.85rem;
    padding-left: 16px;
  }
  .alerta {
    border-color: #c9483c;
    color: #c9483c;
    margin-left: 4px;
  }
  .grafico {
    width: 100%;
    max-height: 200px;
  }
  .columna {
    fill: var(--acento);
  }
  .valor,
  .mes {
    fill: var(--texto-suave);
    font-size: 10px;
    text-anchor: middle;
  }
  h2 {
    margin-top: 8px !important;
  }
</style>
