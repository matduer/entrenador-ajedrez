<script lang="ts">
  import { lineaConNumeros } from '../../lib/ajedrez/posicion.ts'
  import { armarCurso, claveLeccion, estadoCurso, guardarEleccion, posicionesDelRival, type Curso, type EstadoCurso, type Leccion } from '../../lib/aperturas/curso.ts'
  import { descargarFrecuencias } from '../../lib/aperturas/popularidad.ts'
  import type { Explicacion } from '../../lib/aperturas/explicaciones.ts'
  import { idLinea } from '../../lib/aperturas/repertorio.ts'
  import type { Color } from '../../lib/datos/tipos.ts'
  import LeccionPantalla from './Leccion.svelte'

  interface Props {
    explicacion: Explicacion
    color: Color
    alVolver: () => void
    alQuitar: () => void
  }
  let { explicacion, color, alVolver, alQuitar }: Props = $props()

  const INICIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

  let curso = $state.raw<Curso>()
  let estado = $state.raw<EstadoCurso>()
  let pestana = $state<'curso' | 'lineas'>('curso')
  let sesion = $state<{ lineas: string[][]; modo: 'aprender' | 'repasar'; titulo: string }>()

  /** Estado de la consulta a la base Masters para ordenar las respuestas del rival. */
  let masters = $state<{ hechas: number; total: number } | 'sin-token' | 'error'>()

  async function cargar() {
    curso = await armarCurso(explicacion, color)
    estado = await estadoCurso(curso)
  }

  async function ordenarPorMasters() {
    const fens = await posicionesDelRival(explicacion, color)
    const r = await descargarFrecuencias(fens, (hechas, total) => {
      if (total) masters = { hechas, total }
    })
    if (r !== 'ok') masters = r
    else {
      const habia = typeof masters === 'object'
      masters = undefined
      if (habia) await cargar()
    }
  }
  cargar().then(ordenarPorMasters)

  function aprender(l: Leccion) {
    const nombre = curso?.secciones.find((s) => s.nivel === l.seccion)?.nombre
    // Si la lección ya se vio entera, se vuelve a practicar completa; si no, solo lo que falta.
    const faltan = l.lineas.filter((x) => !estado?.repasos.has(idLinea(color, x)))
    sesion = { lineas: faltan.length ? faltan : l.lineas, modo: faltan.length ? 'aprender' : 'repasar', titulo: `${explicacion.nombre} · ${nombre}, lección ${l.numero}` }
  }

  function repasar() {
    if (estado?.vencidas.length) sesion = { lineas: estado.vencidas.slice(0, 10), modo: 'repasar', titulo: explicacion.nombre }
  }

  async function cambiarEleccion(prefijo: string[], uci: string) {
    await guardarEleccion(color, prefijo, uci)
    sesion = undefined
    await cargar()
  }

  async function salirDeSesion() {
    sesion = undefined
    if (curso) estado = await estadoCurso(curso)
  }

  const textoEstado = { completa: 'Aprendida', disponible: 'Disponible', bloqueada: 'Se habilita al terminar la anterior' }
</script>

{#if sesion && curso}
  {#key sesion}
    <LeccionPantalla {...sesion} {color} todas={curso.todas} alSalir={salirDeSesion} alCambiarEleccion={cambiarEleccion} />
  {/key}
{:else}
  <div class="cabecera">
    <div>
      <h2>{explicacion.nombre}</h2>
      <span class="suave">Con {color === 'white' ? 'blancas' : 'negras'} · {lineaConNumeros(INICIAL, explicacion.raiz.split(' '))}</span>
    </div>
    <button class="boton enlace" onclick={alVolver}>Mis aperturas</button>
  </div>

  {#if !curso || !estado}
    <p class="suave">Armando las líneas…</p>
  {:else}
    <section class="tarjeta resumen">
      <p>{estado.aprendidas} de {estado.total} líneas aprendidas · {estado.vencidas.length} para repasar hoy</p>
      {#if typeof masters === 'object'}
        <p class="suave">Ordenando las respuestas del rival según la base Masters: {masters.hechas} de {masters.total} posiciones…</p>
      {:else if masters === 'sin-token'}
        <p class="suave">Para ordenar las respuestas del rival por lo que más juegan los maestros, pegá tu token de Lichess en Ajustes. Mientras tanto, el orden es el del catálogo.</p>
      {:else if masters === 'error'}
        <p class="suave">No se pudo consultar la base Masters (sin conexión o token inválido). El curso usa los datos que ya estaban guardados.</p>
      {/if}
      <div class="fila">
        <button class="boton principal" onclick={() => estado?.proxima && aprender(estado.proxima)} disabled={!estado.proxima}>
          {estado.proxima ? 'Aprender líneas nuevas' : 'No quedan líneas nuevas'}
        </button>
        <button class="boton" onclick={repasar} disabled={!estado.vencidas.length}>Repasar ({estado.vencidas.length})</button>
      </div>
    </section>

    <div class="pestanas" role="tablist">
      <button role="tab" aria-selected={pestana === 'curso'} onclick={() => (pestana = 'curso')}>Curso</button>
      <button role="tab" aria-selected={pestana === 'lineas'} onclick={() => (pestana = 'lineas')}>Líneas</button>
    </div>

    {#if pestana === 'curso'}
      {#each curso.secciones as s (s.nivel)}
        {@const hechas = s.lecciones.filter((l) => estado?.lecciones.get(claveLeccion(l)) === 'completa').length}
        <section class="seccion">
          <h3>Sección {s.nivel}: {s.nombre} <span class="suave">· {s.descripcion} · {hechas} de {s.lecciones.length} lecciones</span></h3>
          {#if s.lecciones.every((l) => estado?.lecciones.get(claveLeccion(l)) === 'bloqueada')}
            <p class="suave">Se habilita al terminar la sección anterior.</p>
          {:else}
          <ol class="lecciones">
            {#each s.lecciones as l (claveLeccion(l))}
              {@const e = estado.lecciones.get(claveLeccion(l)) ?? 'bloqueada'}
              <li class={e}>
                <span class="numero">{l.numero}</span>
                <span class="texto">
                  <b>Lección {l.numero}</b> <span class="suave">· {l.lineas.length} línea{l.lineas.length === 1 ? '' : 's'} · {textoEstado[e]}</span>
                </span>
                {#if e !== 'bloqueada'}
                  <button class="boton" onclick={() => aprender(l)}>{e === 'completa' ? 'Practicar' : 'Aprender'}</button>
                {/if}
              </li>
            {/each}
          </ol>
          {/if}
        </section>
      {/each}
    {:else}
      <p class="suave">
        En tus turnos se practica una sola jugada por posición. Si en la práctica jugás otra que también es teoría, podés
        guardarla y las líneas se rearman con ella.
      </p>
      <ol class="lineas">
        {#each curso.secciones.flatMap((s) => s.lecciones.flatMap((l) => l.lineas)) as l (l.join(' '))}
          {@const r = estado.repasos.get(idLinea(color, l))}
          <li>
            <span>{lineaConNumeros(INICIAL, l)}</span>
            <span class="etiqueta-estado">{!r ? 'nueva' : new Date(r.card.due).getTime() <= Date.now() ? 'para repasar' : 'aprendida'}</span>
          </li>
        {/each}
      </ol>
    {/if}

    <button class="boton enlace quitar" onclick={alQuitar}>Quitar de mis aperturas</button>
  {/if}
{/if}

<style>
  .cabecera {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    gap: 8px;
  }
  .cabecera h2 {
    margin: 0;
  }
  .resumen p {
    margin: 0 0 10px;
  }
  .fila {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .seccion h3 {
    font-size: 1rem;
    margin: 18px 0 8px;
  }
  .lecciones,
  .lineas {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 6px;
  }
  .lecciones li {
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid var(--borde);
    border-radius: var(--radio);
    background: var(--superficie);
    padding: 8px 10px;
  }
  .lecciones li.bloqueada {
    opacity: 0.55;
  }
  .numero {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    border: 2px solid var(--borde);
    font-weight: 600;
  }
  .completa .numero {
    border-color: #3f9b4b;
    color: #3f9b4b;
  }
  .disponible .numero {
    border-color: var(--acento);
  }
  .texto {
    flex: 1;
    min-width: 0;
  }
  .lineas li {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 0.9rem;
    border-bottom: 1px solid var(--borde);
    padding: 4px 0;
  }
  .etiqueta-estado {
    flex: none;
    color: var(--texto-suave);
    font-size: 0.82rem;
  }
  .quitar {
    margin-top: 18px;
  }
</style>
