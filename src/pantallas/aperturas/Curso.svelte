<script lang="ts">
  import { clavePosicion, lineaConNumeros, posDesdeFen, sanDeUci } from '../../lib/ajedrez/posicion.ts'
  import { fensDeLinea } from '../../lib/aperturas/arbol.ts'
  import { esTeoria, lineasDelDesvio, partidasEnCurso, type Desvio, type PartidasEnCurso } from '../../lib/aperturas/enPartidas.ts'
  import { db } from '../../lib/datos/db.ts'
  import { motorInteractivo } from '../../lib/motor/motor.ts'
  import { agregarLineaAlCurso, armarCurso, claveLeccion, leerLineasAgregadas, quitarLineasAgregadas, estadoCurso, guardarEleccion, posicionesDelRival, reiniciarProgreso, type Curso, type EstadoCurso, type Leccion } from '../../lib/aperturas/curso.ts'
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
  let pestana = $state<'curso' | 'lineas' | 'partidas'>('curso')
  let enPartidas = $state.raw<PartidasEnCurso>()

  async function cargarPartidas() {
    if (!curso || !estado) return
    const partidas = await db.partidas.toArray()
    enPartidas = partidasEnCurso(curso, partidas, estado.repasos)
  }

  /** «5.Ad3» o «4...Ab4» para la jugada `uci` jugada después de `prefijo`. */
  function jugadaConNumero(prefijo: string[], uci: string): string {
    const fen = fensDeLinea(prefijo).at(-1)!
    return `${Math.floor(prefijo.length / 2) + 1}.${prefijo.length % 2 ? '..' : ''} ${sanDeUci(posDesdeFen(fen), uci)}`
  }

  /** Tu jugada también es teoría: pasa a ser la del curso (como «Guardar como mi jugada» en la lección). */
  async function adoptar(d: Desvio) {
    await guardarEleccion(color, d.prefijo, d.jugada)
    await cargar()
    await cargarPartidas()
  }

  /** Desvío del rival que se está agregando (Stockfish calcula la respuesta). */
  let agregando = $state<string>()
  /** Líneas de este curso agregadas desde las partidas. */
  let agregadas = $state(0)

  async function contarAgregadas() {
    const r = explicacion.raiz
    agregadas = (await leerLineasAgregadas())[color].filter((l) => l.startsWith(r + ' ')).length
  }
  contarAgregadas()

  /**
   * Agrega al curso la jugada del rival con la respuesta de Stockfish y dos medias jugadas más. Se parte
   * del orden de jugadas del curso (la partida pudo llegar por transposición, y las líneas del curso
   * tienen que empezar por la raíz).
   */
  async function agregarDesvio(d: Desvio) {
    if (!curso || agregando) return
    let base: string[] | undefined
    for (const l of curso.secciones.flatMap((s) => s.lecciones.flatMap((x) => x.lineas))) {
      const i = fensDeLinea(l).findIndex((f, k) => k < l.length && clavePosicion(f) === d.clave)
      if (i >= 0) {
        base = l.slice(0, i)
        break
      }
    }
    if (!base) return
    agregando = d.clave + d.jugada
    try {
      const fen = fensDeLinea([...base, d.jugada]).at(-1)!
      const r = await motorInteractivo().analizar(fen, { profundidad: 18 })
      const linea = [...base, d.jugada, ...r.linea.slice(0, 3)]
      if (r.linea.length && fensDeLinea(linea).length === linea.length + 1) {
        await agregarLineaAlCurso(color, linea)
        await cargar()
        await cargarPartidas()
        await contarAgregadas()
      }
    } finally {
      agregando = undefined
    }
  }

  async function quitarAgregadas() {
    await quitarLineasAgregadas(color, explicacion.raiz.split(' '))
    await cargar()
    await cargarPartidas()
    await contarAgregadas()
  }

  function practicarDesvio(d: Desvio) {
    if (!curso) return
    const lineas = lineasDelDesvio(curso, d)
    if (lineas.length) sesion = { lineas: lineas.slice(0, 10), modo: 'repasar', titulo: `${explicacion.nombre} · desde tus partidas` }
  }
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

  /** Reinicio del progreso: primero se pide confirmación; después se informa cuántas líneas se reiniciaron. */
  let reinicio = $state<'confirmar' | number>()

  async function reiniciar() {
    reinicio = await reiniciarProgreso(explicacion, color)
    await cargar()
  }

  const textoEstado = { completa: 'Aprendida', disponible: 'Disponible', bloqueada: 'Se habilita al terminar la anterior' }
</script>

{#if sesion && curso}
  {#key sesion}
    <LeccionPantalla {...sesion} {color} todas={curso.todas} raiz={explicacion.raiz.split(' ')} alSalir={salirDeSesion} alCambiarEleccion={cambiarEleccion} />
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
      <button role="tab" aria-selected={pestana === 'partidas'} onclick={() => ((pestana = 'partidas'), cargarPartidas())}>En tus partidas</button>
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
    {:else if pestana === 'partidas'}
      {#if !enPartidas}
        <p class="suave">Buscando tus partidas…</p>
      {:else if !enPartidas.llegaron}
        <p class="suave">Ninguna de tus partidas importadas con {color === 'white' ? 'blancas' : 'negras'} llega a esta apertura.</p>
      {:else}
        {@const mias = enPartidas.desvios.filter((d) => d.tipo === 'mia')}
        {@const rival = enPartidas.desvios.filter((d) => d.tipo === 'rival')}
        <p>
          {enPartidas.llegaron} partida{enPartidas.llegaron === 1 ? '' : 's'} tuya{enPartidas.llegaron === 1 ? '' : 's'} llegan a esta apertura.
          En {enPartidas.completas} seguiste el curso hasta el final de la línea; en {mias.reduce((n, d) => n + d.partidas.length, 0)} te saliste vos
          y en {rival.reduce((n, d) => n + d.partidas.length, 0)} el rival jugó algo que el curso no tiene.
        </p>
        {#if mias.length}
          <h3 class="subtitulo">Dónde jugaste otra cosa</h3>
          <p class="suave">Si tu jugada también es teoría y la preferís, podés pasarla al curso: las líneas se rearman con ella.</p>
          <ol class="desvios">
            {#each mias as d (d.clave + d.jugada)}
              <li>
                <span class="suave">{lineaConNumeros(INICIAL, d.prefijo) || 'Posición inicial'}</span>
                <span>
                  Jugaste <b>{jugadaConNumero(d.prefijo, d.jugada)}</b>{d.partidas.length > 1 ? ` (${d.partidas.length} partidas)` : ''}; el curso juega
                  <b>{jugadaConNumero(d.prefijo, d.esperadas[0])}</b>.
                  {#if d.aprendida}<span class="etiqueta">ya la aprendiste</span>{/if}
                </span>
                <span class="fila">
                  <button class="boton" onclick={() => practicarDesvio(d)}>Practicar esta línea</button>
                  {#if curso && esTeoria(curso, d)}
                    <button class="boton" onclick={() => adoptar(d)}>Usar {jugadaConNumero(d.prefijo, d.jugada)} en el curso</button>
                  {/if}
                  {#each d.partidas.slice(0, 3) as p (p.id)}{#if p.url}<a class="boton enlace" href={p.url} target="_blank" rel="noreferrer">Ver partida ({new Date(p.fecha).toLocaleDateString('es-AR')})</a>{/if}{/each}
                </span>
              </li>
            {/each}
          </ol>
        {/if}
        {#if rival.length}
          <h3 class="subtitulo">Jugadas del rival que el curso no tiene</h3>
          <p class="suave">«Agregar al curso» suma la jugada del rival con tu respuesta según Stockfish (profundidad 18) y dos medias jugadas más; queda como una línea para aprender.</p>
          <ol class="desvios">
            {#each rival as d (d.clave + d.jugada)}
              <li>
                <span class="suave">{lineaConNumeros(INICIAL, d.prefijo)}</span>
                <span>
                  El rival jugó <b>{jugadaConNumero(d.prefijo, d.jugada)}</b>{d.partidas.length > 1 ? ` (${d.partidas.length} partidas)` : ''}; el curso
                  cubre {d.esperadas.slice(0, 4).map((j) => jugadaConNumero(d.prefijo, j)).join(', ')}{d.esperadas.length > 4 ? ` y ${d.esperadas.length - 4} más` : ''}.
                </span>
                <span class="fila">
                  <button class="boton" onclick={() => agregarDesvio(d)} disabled={!!agregando}>{agregando === d.clave + d.jugada ? 'Calculando con Stockfish…' : 'Agregar al curso'}</button>
                  {#each d.partidas.slice(0, 3) as p (p.id)}{#if p.url}<a class="boton enlace" href={p.url} target="_blank" rel="noreferrer">Ver partida ({new Date(p.fecha).toLocaleDateString('es-AR')})</a>{/if}{/each}
                </span>
              </li>
            {/each}
          </ol>
        {/if}
        {#if agregadas}
          <p class="suave">
            Agregaste {agregadas} línea{agregadas === 1 ? '' : 's'} desde tus partidas.
            <button class="boton enlace" onclick={quitarAgregadas}>Quitarlas del curso</button>
          </p>
        {/if}
      {/if}
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

    <div class="pie">
      {#if reinicio === 'confirmar'}
        <p>
          Se borra el progreso de todas las líneas de {explicacion.nombre} con {color === 'white' ? 'blancas' : 'negras'}: vuelven a estar
          sin aprender y salen del repaso. Las jugadas que guardaste como propias se mantienen. No se puede deshacer.
        </p>
        <div class="fila">
          <button class="boton" onclick={reiniciar}>Sí, reiniciar el progreso</button>
          <button class="boton enlace" onclick={() => (reinicio = undefined)}>Cancelar</button>
        </div>
      {:else}
        {#if typeof reinicio === 'number'}<p class="suave">Progreso reiniciado: {reinicio} línea{reinicio === 1 ? '' : 's'}.</p>{/if}
        <div class="fila">
          <button class="boton enlace" onclick={() => (reinicio = 'confirmar')}>Reiniciar el progreso</button>
          <button class="boton enlace" onclick={alQuitar}>Quitar de mis aperturas</button>
        </div>
      {/if}
    </div>
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
  .pie {
    margin-top: 18px;
  }
  .subtitulo {
    font-size: 1rem;
    margin: 18px 0 8px;
  }
  .desvios {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 8px;
  }
  .desvios li {
    display: grid;
    gap: 4px;
    border: 1px solid var(--borde);
    border-radius: var(--radio);
    background: var(--superficie);
    padding: 8px 10px;
    font-size: 0.92rem;
  }
  .etiqueta {
    margin-left: 6px;
    font-size: 0.8rem;
    color: #c98a2b;
  }
  .pie p {
    margin: 0 0 8px;
  }
</style>
