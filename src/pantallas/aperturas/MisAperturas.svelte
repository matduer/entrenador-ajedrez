<script lang="ts">
  import { fensDeLinea } from '../../lib/aperturas/arbol.ts'
  import { armarCurso, estadoCurso, guardarMisAperturas, leerMisAperturas, type MisAperturas } from '../../lib/aperturas/curso.ts'
  import { EXPLICACIONES, type Explicacion } from '../../lib/aperturas/explicaciones.ts'
  import type { Color } from '../../lib/datos/tipos.ts'
  import MiniTablero from '../../lib/ui/MiniTablero.svelte'
  import Curso from './Curso.svelte'

  /**
   * Inicio de la práctica de aperturas: una fila para blancas y otra para negras con las aperturas que
   * eligió el usuario. Cada apertura se abre en su curso, con secciones y lecciones.
   */
  let mias = $state<MisAperturas>({ white: [], black: [] })
  let progreso = $state<Record<string, string>>({})
  let abierta = $state<{ explicacion: Explicacion; color: Color }>()
  let agregando = $state<Color>()
  let busqueda = $state('')
  let filtro = $state<'todas' | 'e4' | 'd4' | 'otras'>('todas')

  const porId = new Map(EXPLICACIONES.map((e) => [e.id, e]))
  const fenFinal = (e: Explicacion) => fensDeLinea(e.raiz.split(' ')).at(-1)!

  async function cargar() {
    mias = await leerMisAperturas()
    for (const color of ['white', 'black'] as Color[])
      for (const id of mias[color]) {
        const e = porId.get(id)
        if (!e) continue
        armarCurso(e, color)
          .then(estadoCurso)
          .then((s) => (progreso = { ...progreso, [`${color}:${id}`]: `${s.aprendidas}/${s.total} líneas${s.vencidas.length ? ` · ${s.vencidas.length} para repasar` : ''}` }))
      }
  }
  cargar()

  async function agregar(color: Color, id: string) {
    const nuevas = { ...mias, [color]: [...mias[color].filter((x) => x !== id), id] }
    await guardarMisAperturas(nuevas)
    agregando = undefined
    busqueda = ''
    await cargar()
  }

  async function quitar(color: Color, id: string) {
    await guardarMisAperturas({ ...mias, [color]: mias[color].filter((x) => x !== id) })
    abierta = undefined
    await cargar()
  }

  const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const grupo = (e: Explicacion) => (e.raiz.startsWith('e2e4') ? 'e4' : e.raiz.startsWith('d2d4') ? 'd4' : 'otras')

  let candidatas = $derived(
    agregando
      ? EXPLICACIONES.filter(
          (e) =>
            !mias[agregando!].includes(e.id) &&
            (filtro === 'todas' || grupo(e) === filtro) &&
            (!busqueda.trim() || sinAcentos(e.nombre).includes(sinAcentos(busqueda.trim()))),
        )
      : [],
  )
</script>

{#if abierta}
  {@const a = abierta}
  {#key a}
    <Curso
      explicacion={a.explicacion}
      color={a.color}
      alVolver={() => {
        abierta = undefined
        cargar()
      }}
      alQuitar={() => quitar(a.color, a.explicacion.id)}
    />
  {/key}
{:else if agregando}
  <div class="cabecera">
    <h2>Agregar una apertura con {agregando === 'white' ? 'blancas' : 'negras'}</h2>
    <button class="boton enlace" onclick={() => (agregando = undefined)}>Cancelar</button>
  </div>
  <input class="busqueda" type="search" placeholder="Buscar apertura…" bind:value={busqueda} />
  <div class="filtros" role="tablist">
    {#each [['todas', 'Todas'], ['e4', '1.e4'], ['d4', '1.d4'], ['otras', 'Otras']] as [v, t] (v)}
      <button role="tab" aria-selected={filtro === v} onclick={() => (filtro = v as typeof filtro)}>{t}</button>
    {/each}
  </div>
  <ul class="grilla">
    {#each candidatas as e (e.id)}
      <li>
        <button class="carta" onclick={() => agregar(agregando!, e.id)}>
          <span class="nombre">{e.nombre}</span>
          <MiniTablero fen={fenFinal(e)} orientacion={agregando} />
        </button>
      </li>
    {/each}
  </ul>
  {#if !candidatas.length}<p class="suave">No hay aperturas con ese filtro.</p>{/if}
{:else}
  <p class="suave">Elegí qué aperturas practicar con cada color. Dentro de cada una, las líneas se van sumando de a poco, lección por lección.</p>
  {#each [['white', 'Con blancas'], ['black', 'Con negras']] as [color, titulo] (color)}
    {@const c = color as Color}
    <section class="fila-aperturas">
      <h3>{titulo}</h3>
      <ul class="carrusel">
        {#each mias[c] as id (id)}
          {@const e = porId.get(id)}
          {#if e}
            <li>
              <button class="carta" onclick={() => (abierta = { explicacion: e, color: c })}>
                <span class="nombre">{e.nombre}</span>
                <MiniTablero fen={fenFinal(e)} orientacion={c} />
                <span class="suave detalle">{progreso[`${c}:${id}`] ?? '…'}</span>
              </button>
            </li>
          {/if}
        {/each}
        <li>
          <button class="carta agregar" onclick={() => { agregando = c; filtro = 'todas' }}>
            <span class="mas">+</span>
            <span>Agregar apertura</span>
          </button>
        </li>
      </ul>
    </section>
  {/each}
{/if}

<style>
  .cabecera {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
  }
  .cabecera h2 {
    margin: 0;
  }
  .busqueda {
    width: 100%;
    margin: 4px 0 8px;
  }
  .filtros {
    display: flex;
    gap: 6px;
    margin-bottom: 10px;
  }
  .filtros button {
    border: 1px solid var(--borde);
    background: var(--superficie);
    color: var(--texto);
    border-radius: 999px;
    padding: 4px 12px;
    cursor: pointer;
  }
  .filtros button[aria-selected='true'] {
    border-color: var(--acento);
    font-weight: 600;
  }
  .fila-aperturas h3 {
    font-size: 1rem;
    margin: 16px 0 8px;
  }
  .carrusel,
  .grilla {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .carrusel {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 6px;
  }
  .carrusel li {
    flex: none;
    width: 150px;
  }
  .grilla {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }
  .carta {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: left;
    border: 1px solid var(--borde);
    border-radius: var(--radio);
    background: var(--superficie);
    color: var(--texto);
    padding: 8px;
    cursor: pointer;
    font: inherit;
  }
  .carta:hover {
    border-color: var(--acento);
  }
  .nombre {
    font-weight: 600;
    font-size: 0.88rem;
    min-height: 2.3em;
  }
  .detalle {
    font-size: 0.78rem;
  }
  .agregar {
    align-items: center;
    justify-content: center;
    min-height: 190px;
    color: var(--texto-suave);
  }
  .mas {
    font-size: 2rem;
    line-height: 1;
  }
</style>
