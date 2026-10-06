<script lang="ts">
  import { contarPendientes } from '../lib/analisis/cola.svelte.ts'
  import { db, guardarAjuste, leerPreferencias, leerUsuarios, PREFERENCIAS_INICIALES, type Preferencias } from '../lib/datos/db.ts'
  import type { Usuarios } from '../lib/datos/normalizar.ts'
  import { descargarRespaldo, importarRespaldo } from '../lib/datos/respaldo.ts'
  import { importarArchivoPgn, mensajeDeError } from '../lib/importar/importar.ts'

  let usuarios = $state<Usuarios>({})
  let preferencias = $state<Preferencias>({ ...PREFERENCIAS_INICIALES })
  let guardado = $state('')
  let mensajeRespaldo = $state('')
  let mensajePgn = $state('')
  let ocupado = $state(false)
  let conteo = $state({ partidas: 0, errores: 0, repasos: 0 })

  async function cargar() {
    usuarios = await leerUsuarios()
    preferencias = await leerPreferencias()
    conteo = { partidas: await db.partidas.count(), errores: await db.errores.count(), repasos: await db.repasos.count() }
  }
  cargar()

  async function guardarUsuarios(e: SubmitEvent) {
    e.preventDefault()
    const limpio: Usuarios = {
      lichess: usuarios.lichess?.trim() || undefined,
      chesscom: usuarios.chesscom?.trim() || undefined,
    }
    await guardarAjuste('usuarios', limpio)
    await guardarAjuste('preferencias', $state.snapshot(preferencias))
    guardado = 'Guardado.'
    setTimeout(() => (guardado = ''), 2500)
  }

  async function leerArchivo(e: Event): Promise<string | undefined> {
    const input = e.currentTarget as HTMLInputElement
    const archivo = input.files?.[0]
    input.value = ''
    return archivo?.text()
  }

  async function alElegirRespaldo(e: Event) {
    const texto = await leerArchivo(e)
    if (!texto) return
    ocupado = true
    mensajeRespaldo = 'Importando…'
    try {
      const r = await importarRespaldo(texto)
      mensajeRespaldo = `Listo: ${r.partidasNuevas} partidas nuevas, ${r.erroresNuevos} errores nuevos, ${r.repasosActualizados} repasos actualizados.`
      await contarPendientes()
      await cargar()
    } catch (err) {
      mensajeRespaldo = `No se pudo importar: ${mensajeDeError(err)}`
    } finally {
      ocupado = false
    }
  }

  async function alElegirPgn(e: Event) {
    const texto = await leerArchivo(e)
    if (!texto) return
    ocupado = true
    try {
      const r = await importarArchivoPgn(texto)
      mensajePgn = `Leídas ${r.leidas} partidas tuyas, ${r.nuevas} nuevas. Se analizan desde Mis partidas.`
      await contarPendientes()
      await cargar()
    } catch (err) {
      mensajePgn = `No se pudo leer el archivo: ${mensajeDeError(err)}`
    } finally {
      ocupado = false
    }
  }
</script>

<h1>Ajustes</h1>

<form class="tarjeta" onsubmit={guardarUsuarios}>
  <h2>Usuarios</h2>
  <p class="suave">Se usan para importar tus partidas por las APIs públicas, sin contraseña.</p>
  <label>Lichess <input bind:value={usuarios.lichess} autocomplete="off" autocapitalize="off" spellcheck="false" /></label>
  <label>Chess.com <input bind:value={usuarios.chesscom} autocomplete="off" autocapitalize="off" spellcheck="false" /></label>

  <h2>Entrenamiento</h2>
  <label>
    Ejercicios nuevos por día
    <input type="number" min="0" max="200" bind:value={preferencias.nuevosPorDia} />
  </label>
  <label>
    Profundidad del análisis
    <select bind:value={preferencias.profundidad}>
      <option value={10}>10 · rápido (celular)</option>
      <option value={12}>12 · equilibrado</option>
      <option value={14}>14 · más preciso</option>
      <option value={16}>16 · lento (compu)</option>
    </select>
  </label>
  <div class="fila">
    <button class="boton principal" type="submit">Guardar</button>
    <span class="suave">{guardado}</span>
  </div>
</form>

<section class="tarjeta">
  <h2>Respaldo y otros dispositivos</h2>
  <p class="suave">
    Los datos viven solo en este dispositivo. Para pasarlos al celular (o a la compu), exportá un respaldo acá y
    importalo allá: se combinan sin pisar el progreso más nuevo. También sirve para cargar el análisis previo de tus partidas.
  </p>
  <p>En este dispositivo: {conteo.partidas} partidas, {conteo.errores} errores detectados, {conteo.repasos} ejercicios practicados.</p>
  <div class="fila">
    <button class="boton" onclick={descargarRespaldo} disabled={ocupado}>Exportar respaldo</button>
    <label class="boton archivo">
      Importar respaldo
      <input type="file" accept=".json,application/json" onchange={alElegirRespaldo} disabled={ocupado} />
    </label>
  </div>
  {#if mensajeRespaldo}<p>{mensajeRespaldo}</p>{/if}
</section>

<section class="tarjeta">
  <h2>Importar un archivo PGN</h2>
  <p class="suave">Para partidas que no estén en Lichess o Chess.com, o exportaciones viejas. Se toman solo las partidas de tus usuarios.</p>
  <label class="boton archivo">
    Elegir archivo PGN
    <input type="file" accept=".pgn,text/plain" onchange={alElegirPgn} disabled={ocupado} />
  </label>
  {#if mensajePgn}<p>{mensajePgn}</p>{/if}
</section>

<section class="tarjeta">
  <h2>Acerca de</h2>
  <p class="suave">
    Código abierto (GPL-3.0): <a href="https://github.com/matduer/entrenador-ajedrez" target="_blank" rel="noopener">github.com/matduer/entrenador-ajedrez</a>.
    Usa Stockfish 19 (motor que corre en el dispositivo), chessground y chessops.
  </p>
</section>

<style>
  label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  label input:not([type='file']),
  label select {
    width: 55%;
  }
  .archivo {
    position: relative;
    display: inline-block;
    cursor: pointer;
    align-self: flex-start;
  }
  .archivo input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
</style>
