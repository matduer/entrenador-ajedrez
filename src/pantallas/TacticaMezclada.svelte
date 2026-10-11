<script lang="ts">
  import { db } from '../lib/datos/db.ts'
  import type { ErrorPartida, Partida } from '../lib/datos/tipos.ts'
  import { armarSesionProblemas, estadoProblemas, FILTROS_PROBLEMAS, type Problema } from '../lib/problemas/problemas.ts'
  import { armarSesion, estadoRepaso, FILTROS_INICIALES, type Filtros, type ResultadoIntento } from '../lib/repaso/repaso.ts'
  import Ejercicio from '../lib/ui/Ejercicio.svelte'
  import ProblemaLichess from '../lib/ui/ProblemaLichess.svelte'

  type Fuente = 'propios' | 'lichess' | 'libros'
  type Item = { tipo: 'error'; error: ErrorPartida } | { tipo: 'problema'; problema: Problema }

  const NOMBRES: Record<Fuente, string> = { propios: 'Mis errores', lichess: 'Problemas de Lichess', libros: 'Problemas de libros' }
  const MAXIMO = 20

  let elegidas = $state<Fuente[]>(cargarElegidas())
  let disponibles = $state<Partial<Record<Fuente, number>>>({})
  let sesion = $state<Item[]>([])
  let indice = $state(0)
  let partida = $state<Partida>()
  let enSesion = $state(false)
  let resultados = $state<ResultadoIntento[]>([])

  function cargarElegidas(): Fuente[] {
    try {
      const v = JSON.parse(localStorage.getItem('tactica-mezcla') ?? 'null')
      if (Array.isArray(v) && v.length) return v
    } catch {
      /* sin almacenamiento */
    }
    return ['propios', 'lichess', 'libros']
  }

  /** Los filtros de «Mis errores» son los que quedaron elegidos en su pestaña. */
  function filtrosPropios(): Filtros {
    try {
      return { ...FILTROS_INICIALES, ...JSON.parse(localStorage.getItem('filtros-tactica') ?? '{}') }
    } catch {
      return { ...FILTROS_INICIALES }
    }
  }

  async function contar() {
    const e = await estadoRepaso(filtrosPropios())
    const l = await estadoProblemas({ ...FILTROS_PROBLEMAS, origen: 'lichess' })
    const b = await estadoProblemas({ ...FILTROS_PROBLEMAS, origen: 'libros' })
    disponibles = {
      propios: e.vencidos + Math.min(e.nuevosHoy, e.nuevosDisponibles),
      lichess: l.vencidos.length + Math.min(l.nuevosHoy, l.nuevos.length),
      libros: b.vencidos.length + Math.min(b.nuevosHoy, b.nuevos.length),
    }
  }
  contar()

  $effect(() => {
    const v = $state.snapshot(elegidas)
    try {
      localStorage.setItem('tactica-mezcla', JSON.stringify(v))
    } catch {
      /* sin almacenamiento: la elección no se recuerda */
    }
  })

  function alternar(f: Fuente) {
    elegidas = elegidas.includes(f) ? elegidas.filter((x) => x !== f) : [...elegidas, f]
  }

  async function empezar() {
    const items: Item[] = []
    if (elegidas.includes('propios')) for (const error of await armarSesion(filtrosPropios())) items.push({ tipo: 'error', error })
    for (const origen of ['lichess', 'libros'] as const) {
      if (!elegidas.includes(origen)) continue
      for (const problema of await armarSesionProblemas({ ...FILTROS_PROBLEMAS, origen })) items.push({ tipo: 'problema', problema })
    }
    // Mezcla al azar y recorta: cada fuente aporta parecido, sin que una tape a las otras.
    sesion = items.sort(() => Math.random() - 0.5).slice(0, MAXIMO)
    indice = 0
    resultados = []
    await cargarPartida()
    enSesion = sesion.length > 0
  }

  async function cargarPartida() {
    const it = sesion[indice]
    partida = it?.tipo === 'error' ? await db.partidas.get(it.error.partidaId) : undefined
  }

  async function seguir(r: ResultadoIntento) {
    resultados.push(r)
    indice++
    if (indice >= sesion.length) {
      enSesion = false
      await contar()
      return
    }
    await cargarPartida()
  }

  let total = $derived(elegidas.reduce((s, f) => s + (disponibles[f] ?? 0), 0))
  let item = $derived(sesion[indice])
</script>

{#if enSesion && item}
  <div class="barra">
    <span>Ejercicio {indice + 1} de {sesion.length} · {item.tipo === 'error' ? NOMBRES.propios : item.problema.fuente ? NOMBRES.libros : NOMBRES.lichess}</span>
    <button class="boton enlace" onclick={() => { enSesion = false; contar() }}>Terminar</button>
  </div>
  {#key indice}
    {#if item.tipo === 'error'}
      <Ejercicio error={item.error} {partida} alSeguir={seguir} />
    {:else}
      <ProblemaLichess problema={item.problema} alSeguir={seguir} />
    {/if}
  {/key}
{:else}
  <p class="suave">
    Ejercicios de las fuentes que elijas, mezclados al azar en una misma sesión. Cada uno se registra en su propio
    repaso, igual que si lo hicieras en su pestaña. Para «Mis errores» se usan los filtros que dejaste en esa pestaña.
  </p>
  {#if resultados.length}
    <p><b>Sesión terminada: {resultados.filter((r) => r !== 'mal').length} de {resultados.length} bien.</b></p>
  {/if}
  <section class="tarjeta">
    <h2>Fuentes</h2>
    {#each Object.entries(NOMBRES) as [f, nombre] (f)}
      <label>
        <input type="checkbox" checked={elegidas.includes(f as Fuente)} onchange={() => alternar(f as Fuente)} />
        {nombre} <span class="suave">({disponibles[f as Fuente] ?? '…'} para hoy)</span>
      </label>
    {/each}
    <button class="boton principal" onclick={empezar} disabled={total === 0}>Empezar</button>
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
</style>
