<script lang="ts">
  import { NOMBRE_FASE, type Fase } from '../lib/ajedrez/fase.ts'
  import { NOMBRE_CLASIFICACION, type Clasificacion } from '../lib/ajedrez/evaluacion.ts'
  import { db } from '../lib/datos/db.ts'
  import type { ErrorPartida, Partida } from '../lib/datos/tipos.ts'
  import { armarSesion, estadoRepaso, FILTROS_INICIALES, type EstadoRepaso, type Filtros, type ResultadoIntento } from '../lib/repaso/repaso.ts'
  import Ejercicio from '../lib/ui/Ejercicio.svelte'
  import TacticaLichess from './TacticaLichess.svelte'

  let fuente = $state<'propios' | 'lichess' | 'libros'>('propios')

  const MOTIVOS = [
    'pieza colgada',
    'recibís mate',
    'mate',
    'horquilla',
    'clavada',
    'ataque descubierto',
    'jaque descubierto',
    'pieza indefensa',
    'ganancia de material',
    'sin clasificar',
  ]

  let filtros = $state<Filtros>(cargarFiltros())
  let estado = $state<EstadoRepaso>()
  let sesion = $state<ErrorPartida[]>([])
  let indice = $state(0)
  let partida = $state<Partida>()
  let resultados = $state<ResultadoIntento[]>([])
  let enSesion = $state(false)

  function cargarFiltros(): Filtros {
    try {
      return { ...FILTROS_INICIALES, ...JSON.parse(localStorage.getItem('filtros-tactica') ?? '{}') }
    } catch {
      return { ...FILTROS_INICIALES }
    }
  }

  const filtrosActuales = () => $state.snapshot(filtros) as Filtros

  $effect(() => {
    const f = filtrosActuales()
    try {
      localStorage.setItem('filtros-tactica', JSON.stringify(f))
    } catch {
      /* sin almacenamiento: los filtros no se recuerdan */
    }
    estadoRepaso(f).then((e) => (estado = e))
  })

  let disponibles = $derived(estado ? estado.vencidos + Math.min(estado.nuevosHoy, estado.nuevosDisponibles) : 0)

  async function empezar() {
    sesion = await armarSesion(filtrosActuales())
    indice = 0
    resultados = []
    await cargarPartida()
    enSesion = sesion.length > 0
  }

  async function cargarPartida() {
    partida = sesion[indice] ? await db.partidas.get(sesion[indice].partidaId) : undefined
  }

  async function seguir(r: ResultadoIntento) {
    resultados.push(r)
    indice++
    if (indice >= sesion.length) {
      await terminar()
      return
    }
    await cargarPartida()
  }

  async function terminar() {
    enSesion = false
    estado = await estadoRepaso(filtrosActuales())
  }

  function alternarClasificacion(c: Clasificacion) {
    filtros.clasificaciones = filtros.clasificaciones.includes(c)
      ? filtros.clasificaciones.filter((x) => x !== c)
      : [...filtros.clasificaciones, c]
  }

  let aciertos = $derived(resultados.filter((r) => r !== 'mal').length)
</script>

{#if enSesion && sesion[indice]}
  <div class="barra">
    <span>Ejercicio {indice + 1} de {sesion.length}</span>
    <button class="boton enlace" onclick={terminar}>Terminar</button>
  </div>
  {#key sesion[indice].id}
    <Ejercicio error={sesion[indice]} {partida} alSeguir={seguir} />
  {/key}
{:else}
  <h1>Táctica</h1>
  <div class="pestanas" role="tablist">
    <button role="tab" aria-selected={fuente === 'propios'} onclick={() => (fuente = 'propios')}>Mis errores</button>
    <button role="tab" aria-selected={fuente === 'lichess'} onclick={() => (fuente = 'lichess')}>Problemas de Lichess</button>
    <button role="tab" aria-selected={fuente === 'libros'} onclick={() => (fuente = 'libros')}>Problemas de libros</button>
  </div>
{/if}

{#if enSesion && sesion[indice]}
  <!-- sesión en curso: ya se mostró arriba -->
{:else if fuente === 'lichess'}
  <TacticaLichess />
{:else if fuente === 'libros'}
  {#key fuente}<TacticaLichess origen="libros" />{/key}
{:else}
  <p class="suave">
    Ejercicios armados con tus propios errores: la posición antes de la jugada mala, para encontrar la buena. Lo que
    fallás vuelve antes.
  </p>

  {#if resultados.length}
    <p><b>Sesión terminada: {aciertos} de {resultados.length} bien.</b></p>
  {/if}

  <section class="tarjeta">
    {#if !estado}
      <p>Cargando…</p>
    {:else if estado.total === 0}
      <p>
        No hay ejercicios con estos filtros. Si todavía no cargaste tus partidas, andá a <a href="#/partidas">Mis partidas</a>
        o a <a href="#/ajustes">Ajustes</a>.
      </p>
    {:else}
      <div class="numeros">
        <div><b>{estado.vencidos}</b><span>para repasar</span></div>
        <div><b>{Math.min(estado.nuevosHoy, estado.nuevosDisponibles)}</b><span>nuevos hoy</span></div>
        <div><b>{estado.total}</b><span>en total</span></div>
      </div>
      <button class="boton principal" onclick={empezar} disabled={disponibles === 0}>Empezar</button>
      {#if disponibles === 0}
        <p class="suave">Por hoy está todo hecho con estos filtros. Podés subir el límite de nuevos por día en Ajustes.</p>
      {/if}
    {/if}
  </section>

  <section class="tarjeta">
    <h2>Filtros</h2>
    <div class="fila">
      {#each ['grave', 'error', 'imprecision'] as const as c (c)}
        <label><input type="checkbox" checked={filtros.clasificaciones.includes(c)} onchange={() => alternarClasificacion(c)} /> {NOMBRE_CLASIFICACION[c]}</label>
      {/each}
    </div>
    <label>
      Fase
      <select bind:value={filtros.fase}>
        <option value={undefined}>Todas</option>
        {#each Object.entries(NOMBRE_FASE) as [id, nombre] (id)}
          <option value={id as Fase}>{nombre}</option>
        {/each}
      </select>
    </label>
    <label>
      Motivo
      <select bind:value={filtros.motivo}>
        <option value={undefined}>Todos</option>
        {#each MOTIVOS as m (m)}<option value={m}>{m}</option>{/each}
      </select>
    </label>
    <label>
      Color
      <select bind:value={filtros.color}>
        <option value={undefined}>Los dos</option>
        <option value="white">Blancas</option>
        <option value="black">Negras</option>
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
