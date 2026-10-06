<script lang="ts">
  import { cola, contarPendientes, iniciarCola, pausarCola } from '../lib/analisis/cola.svelte.ts'
  import { db, leerAjuste, leerUsuarios } from '../lib/datos/db.ts'
  import type { Usuarios } from '../lib/datos/normalizar.ts'
  import type { Partida } from '../lib/datos/tipos.ts'
  import { importarNuevas, type ResultadoImportacion } from '../lib/importar/importar.ts'
  import Estadisticas from './Estadisticas.svelte'

  const POR_PAGINA = 30
  const NOMBRE_RITMO: Record<Partida['ritmo'], string> = {
    ultrabullet: 'Ultrabullet',
    bullet: 'Bullet',
    blitz: 'Blitz',
    rapida: 'Rápida',
    clasica: 'Clásica',
    correspondencia: 'Correspondencia',
  }
  const ESTADO: Record<Partida['estadoAnalisis'], string> = {
    pendiente: 'por analizar',
    analizada: 'analizada',
    previo: 'análisis previo',
    omitida: '—',
  }

  let usuarios = $state<Usuarios>({})
  let total = $state(0)
  let partidas = $state<Partida[]>([])
  let erroresPorPartida = $state(new Map<string, number>())
  let pagina = $state(0)
  let importando = $state(false)
  let mensaje = $state('')
  let resultados = $state<ResultadoImportacion[]>([])
  let ultimaImportacion = $state<number>()
  let vista = $state<'estadisticas' | 'lista'>('estadisticas')
  let version = $state(0) // sube cuando cambian los datos, para refrescar las estadísticas

  async function cargar() {
    usuarios = await leerUsuarios()
    total = await db.partidas.count()
    partidas = await db.partidas.orderBy('fecha').reverse().offset(pagina * POR_PAGINA).limit(POR_PAGINA).toArray()
    const errores = await db.errores.where('partidaId').anyOf(partidas.map((p) => p.id)).toArray()
    const m = new Map<string, number>()
    for (const e of errores) if (e.clasificacion !== 'imprecision') m.set(e.partidaId, (m.get(e.partidaId) ?? 0) + 1)
    erroresPorPartida = m
    ultimaImportacion = await leerAjuste<number | undefined>('ultimaImportacion', undefined)
    await contarPendientes()
    version++
  }

  $effect(() => {
    void pagina
    cargar()
  })

  // Al terminar cada partida analizada, refrescar la lista.
  $effect(() => {
    void cola.analizadas
    if (cola.analizadas > 0) cargar()
  })

  async function importar() {
    importando = true
    resultados = []
    try {
      resultados = await importarNuevas((m) => (mensaje = m))
    } finally {
      importando = false
      mensaje = ''
      pagina = 0
      await cargar()
    }
    if (cola.pendientes > 0) iniciarCola()
  }

  function rival(p: Partida) {
    return p.miColor === 'white' ? p.negras : p.blancas
  }

  let hayUsuarios = $derived(Boolean(usuarios.lichess || usuarios.chesscom))
</script>

<h1>Mis partidas</h1>

<section class="tarjeta">
  {#if !hayUsuarios}
    <p>Para importar tus partidas, primero cargá tu usuario de Lichess o Chess.com en <a href="#/ajustes">Ajustes</a>.</p>
  {:else}
    <div class="fila">
      <button class="boton principal" onclick={importar} disabled={importando || !navigator.onLine}>
        {importando ? 'Importando…' : 'Importar partidas nuevas'}
      </button>
      <span class="suave">
        {[usuarios.lichess && `Lichess: ${usuarios.lichess}`, usuarios.chesscom && `Chess.com: ${usuarios.chesscom}`].filter(Boolean).join(' · ')}
      </span>
    </div>
    {#if !navigator.onLine}<p class="suave">Para importar hace falta conexión.</p>{/if}
    {#if mensaje}<p class="suave">{mensaje}</p>{/if}
    {#each resultados as r (r.fuente)}
      <p class={r.error ? 'aviso' : ''}>
        {r.fuente === 'lichess' ? 'Lichess' : 'Chess.com'}: {r.nuevas} partida{r.nuevas === 1 ? '' : 's'} nueva{r.nuevas === 1 ? '' : 's'}{r.error ? `. ${r.error}` : '.'}
      </p>
    {/each}
    {#if ultimaImportacion}
      <p class="suave">Última importación: {new Date(ultimaImportacion).toLocaleString('es-AR')}.</p>
    {/if}
  {/if}
</section>

<section class="tarjeta">
  <h2>Análisis con Stockfish</h2>
  {#if cola.activa}
    <p>
      Analizando {cola.partida}: posición {cola.posicion} de {cola.totalPosiciones}.
      Quedan {cola.pendientes} partida{cola.pendientes === 1 ? '' : 's'}.
    </p>
    <progress max={cola.totalPosiciones} value={cola.posicion}></progress>
    <div class="fila">
      <button class="boton" onclick={pausarCola}>Pausar</button>
      {#if cola.analizadas}<span class="suave">{cola.analizadas} analizadas en esta sesión, {cola.erroresNuevos} errores nuevos para practicar.</span>{/if}
    </div>
  {:else if cola.pendientes > 0}
    <p>
      Hay {cola.pendientes} partida{cola.pendientes === 1 ? '' : 's'} sin analizar. El análisis corre en este dispositivo mientras
      la app está abierta; se puede pausar y sigue donde quedó.
    </p>
    <button class="boton principal" onclick={iniciarCola}>Analizar</button>
  {:else}
    <p class="suave">No hay partidas pendientes de análisis.</p>
  {/if}
  {#if cola.error}<p class="aviso">Error del motor: {cola.error}</p>{/if}
</section>

{#if total > 0}
  <div class="pestanas" role="tablist">
    <button role="tab" aria-selected={vista === 'estadisticas'} onclick={() => (vista = 'estadisticas')}>Estadísticas</button>
    <button role="tab" aria-selected={vista === 'lista'} onclick={() => (vista = 'lista')}>Partidas ({total})</button>
  </div>

  {#if vista === 'estadisticas'}
    <Estadisticas {version} />
  {:else}
    <section class="tarjeta">
      <div class="tabla-scroll">
        <table>
          <thead>
            <tr><th>Fecha</th><th>Rival</th><th>Color</th><th>Res.</th><th>Ritmo</th><th>Apertura</th><th class="num">Errores</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {#each partidas as p (p.id)}
              <tr>
                <td>{#if p.url}<a href={p.url} target="_blank" rel="noopener">{new Date(p.fecha).toLocaleDateString('es-AR')}</a>{:else}{new Date(p.fecha).toLocaleDateString('es-AR')}{/if}</td>
                <td>{rival(p)}</td>
                <td>{p.miColor === 'white' ? '○' : '●'}</td>
                <td class={p.resultado}>{p.resultado === 'gano' ? '1' : p.resultado === 'pierdo' ? '0' : '½'}{p.porTiempo ? ' ⏱' : ''}</td>
                <td>{NOMBRE_RITMO[p.ritmo]}</td>
                <td class="apertura">{p.apertura ?? p.eco ?? ''}</td>
                <td class="num">{erroresPorPartida.get(p.id) ?? (p.estadoAnalisis === 'analizada' ? 0 : '')}</td>
                <td class="suave">{ESTADO[p.estadoAnalisis]}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="fila">
        <button class="boton" onclick={() => pagina--} disabled={pagina === 0}>Más nuevas</button>
        <span class="suave">Página {pagina + 1} de {Math.ceil(total / POR_PAGINA)}</span>
        <button class="boton" onclick={() => pagina++} disabled={(pagina + 1) * POR_PAGINA >= total}>Más viejas</button>
      </div>
      <p class="suave">○ blancas · ● negras · ⏱ terminó por tiempo. Errores: cuenta errores y errores graves.</p>
    </section>
  {/if}
{/if}

<style>
  progress {
    width: 100%;
  }
  .aviso {
    color: #c9483c;
  }
  .gano {
    color: #3f9b4b;
  }
  .pierdo {
    color: #c9483c;
  }
  .apertura {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pestanas {
    display: flex;
    gap: 4px;
    margin-bottom: 12px;
  }
  .pestanas button {
    flex: 1;
    border: 1px solid var(--borde);
    background: var(--superficie);
    color: var(--texto-suave);
    border-radius: 8px;
    padding: 8px;
  }
  .pestanas button[aria-selected='true'] {
    color: var(--acento);
    border-color: var(--acento);
  }
</style>
