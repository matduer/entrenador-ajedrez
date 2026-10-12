<script lang="ts">
  import { chancesDeGanar, invertir, textoEvaluacion } from '../../lib/ajedrez/evaluacion.ts'
  import { lineaSan, posDesdeFen, sanDeUci } from '../../lib/ajedrez/posicion.ts'
  import { detectarMotivoError } from '../../lib/ajedrez/temas.ts'
  import { fensDeLinea } from '../../lib/aperturas/arbol.ts'
  import { cargarCatalogo, clasificar, familiaEnEspanol, nombreEnEspanol, type Catalogo } from '../../lib/aperturas/catalogo.ts'
  import { criterioFamilia, transposiciones } from '../../lib/aperturas/curso.ts'
  import { notaPara, porQueNoPara } from '../../lib/aperturas/explicaciones.ts'
  import { registrarLinea } from '../../lib/aperturas/practica.ts'
  import type { Color } from '../../lib/datos/tipos.ts'
  import { motorInteractivo } from '../../lib/motor/motor.ts'
  import Tablero, { type Flecha } from '../../lib/ui/Tablero.svelte'
  import VisorLinea, { type Linea } from '../../lib/ui/VisorLinea.svelte'

  /**
   * Una sesión de práctica sobre un grupo de líneas. Al aprender, cada línea se presenta siguiendo la
   * flecha y enseguida se juega de memoria; cuando se vieron todas, vuelven mezcladas, con el nombre de
   * la variante como pista, y esa vuelta es la que cuenta para el repaso espaciado. Una línea con
   * errores en la mezcla vuelve al final hasta salir bien. Al repasar, solo la mezcla.
   */
  interface Props {
    color: Color
    lineas: string[][]
    modo: 'aprender' | 'repasar'
    /** Todas las líneas teóricas de la apertura, para reconocer otras jugadas válidas. */
    todas: string[][]
    titulo: string
    /** Raíz de la apertura del curso, para señalar las jugadas que transponen a otra apertura. */
    raiz: string[]
    alSalir: () => void
    /** El usuario prefiere otra jugada propia en esta posición. */
    alCambiarEleccion: (prefijo: string[], uci: string) => void
  }
  let { color, lineas, modo, todas, titulo, raiz, alSalir, alCambiarEleccion }: Props = $props()

  type Paso = { linea: string[]; fase: 'presentar' | 'memoria' | 'mezcla'; registrar: boolean }
  const mezclar = <T,>(xs: T[]) => xs.map((x) => ({ x, r: Math.random() })).sort((a, b) => a.r - b.r).map((y) => y.x)
  const mezcla = (): Paso[] => mezclar(lineas).map((l) => ({ linea: l, fase: 'mezcla', registrar: true }))
  // Las líneas se fijan al abrir la sesión: la cola crece cuando una línea de la mezcla sale con errores.
  // svelte-ignore state_referenced_locally
  let pasos = $state.raw<Paso[]>(
    modo === 'aprender'
      ? [...lineas.flatMap((l): Paso[] => [{ linea: l, fase: 'presentar', registrar: false }, { linea: l, fase: 'memoria', registrar: false }]), ...mezcla()]
      : mezcla(),
  )
  /** Pausa antes de empezar la mezcla, para avisar que cambia la consigna. */
  let antesDeMezcla = $state(false)

  let indice = $state(0)
  let ply = $state(0)
  let errores = $state(0)
  let marcas = $state<('bien' | 'mal')[]>([])
  let mensaje = $state<{ tipo: 'bien' | 'mal' | 'info'; texto: string }>()
  /** Ideas que el usuario abrió en esta línea (por ply): están ocultas por defecto para no delatar el plan. */
  let abiertas = $state<Set<number>>(new Set())
  let catalogo = $state.raw<Catalogo>()
  cargarCatalogo().then((c) => (catalogo = c))
  let refutacion = $state<Linea>()
  let vista = $state<{ fen: string; ultima?: string; proxima?: string }>()
  let alternativa = $state<{ prefijo: string[]; uci: string; san: string }>()
  let verificando = $state(false)
  /** Para que el tablero deshaga una jugada rechazada. */
  let refrescar = $state(0)
  /** Hubo un error en la jugada actual: se muestra la flecha hasta acertarla. */
  let fallaAca = $state(false)
  let lineaTerminada = $state(false)
  let resultados = $state<{ linea: string[]; bien: boolean }[]>([])

  let paso = $derived(pasos[indice])
  let fens = $derived(paso ? fensDeLinea(paso.linea) : [])
  let fen = $derived(fens[ply] ?? fens[0])
  let turnoMio = $derived(fen ? (fen.split(' ')[1] === 'w') === (color === 'white') : false)
  /** Índices (ply) de mis jugadas en la línea: un cuadradito de progreso por cada una. */
  let misPlies = $derived(paso ? paso.linea.map((_, i) => i).filter((i) => (i % 2 === 0) === (color === 'white')) : [])
  let terminado = $derived(indice >= pasos.length)

  function iniciarPaso() {
    ply = 0
    errores = 0
    marcas = []
    mensaje = undefined
    abiertas = new Set()
    refutacion = undefined
    vista = undefined
    alternativa = undefined
    lineaTerminada = false
    fallaAca = false
    avanzarRival()
  }
  iniciarPaso()

  function avanzarRival() {
    if (!paso) return
    if (ply >= paso.linea.length) {
      finDeLinea()
      return
    }
    if (!turnoMio)
      setTimeout(() => {
        ply++
        avanzarRival()
      }, 450)
  }

  async function finDeLinea() {
    if (!paso || lineaTerminada) return
    lineaTerminada = true
    if (paso.fase === 'presentar') {
      mensaje = { tipo: 'info', texto: 'Ahora la misma línea, sin flecha.' }
      setTimeout(siguiente, 900)
      return
    }
    const bien = errores === 0
    if (paso.registrar) {
      await registrarLinea(color, paso.linea, bien)
      resultados = [...resultados, { linea: paso.linea, bien }]
    }
    if (paso.fase === 'mezcla' && !bien) pasos = [...pasos, { linea: paso.linea, fase: 'mezcla', registrar: false }]
    if (bien) {
      mensaje = { tipo: 'bien', texto: 'Línea sin errores.' }
      setTimeout(siguiente, 900)
    } else
      mensaje = {
        tipo: 'mal',
        texto: `Línea con ${errores} error${errores === 1 ? '' : 'es'}${paso.fase === 'mezcla' ? ': vuelve al final de la mezcla y antes al repaso' : ''}.`,
      }
  }

  function siguiente() {
    indice++
    if (indice >= pasos.length) return
    if (pasos[indice].fase === 'mezcla' && pasos[indice - 1].fase !== 'mezcla') antesDeMezcla = true
    else iniciarPaso()
  }

  function empezarMezcla() {
    antesDeMezcla = false
    iniciarPaso()
  }

  /** Posición en la etapa actual, para el encabezado del panel. */
  let etapa = $derived.by(() => {
    if (!paso) return ''
    if (paso.fase !== 'mezcla') return `Línea ${Math.floor(indice / 2) + 1} de ${lineas.length}`
    const primera = pasos.findIndex((p) => p.fase === 'mezcla')
    return `${modo === 'aprender' ? 'Mezcla · ' : ''}${indice - primera + 1} de ${pasos.length - primera}`
  })

  async function alJugar(uci: string) {
    if (!paso || !turnoMio || verificando || lineaTerminada) return
    const linea = paso.linea
    const esperada = linea[ply]
    const pos = posDesdeFen(fen)
    const san = sanDeUci(pos, uci)
    refutacion = undefined
    vista = undefined
    alternativa = undefined
    const indiceMarca = misPlies.indexOf(ply)

    if (uci === esperada) {
      if (marcas[indiceMarca] === undefined) marcas[indiceMarca] = 'bien'
      mensaje = { tipo: 'bien', texto: `✓ ${san}` }
      fallaAca = false
      ply++
      avanzarRival()
      return
    }

    if (paso.fase === 'presentar') {
      mensaje = { tipo: 'info', texto: 'Seguí la flecha: en esta vuelta se aprende la jugada.' }
      refrescar++
      return
    }

    // Otra jugada teórica mía: no cuenta como error y se puede guardar como la propia.
    const prefijo = linea.slice(0, ply)
    const texto = prefijo.join(' ')
    if (todas.some((l) => l.slice(0, ply).join(' ') === texto && l[ply] === uci)) {
      alternativa = { prefijo, uci, san }
      refrescar++
      const otra = transposicionesDe(prefijo, esperada).find((t) => t.uci === uci)
      const destino = otra ? `, y lleva a otra apertura (${otra.familias.slice(0, 2).map(familiaEnEspanol).join(', ')})` : ''
      mensaje = { tipo: 'info', texto: `${san} también es teoría${destino}, pero la jugada que tenés guardada acá es ${sanDeUci(pos, esperada)}.` }
      return
    }

    errores++
    fallaAca = true
    marcas[indiceMarca] = 'mal'
    refrescar++
    verificando = true
    mensaje = { tipo: 'mal', texto: `✗ ${san}: verificando con Stockfish…` }
    const m = motorInteractivo()
    const antes = await m.analizar(fen, { profundidad: 14 })
    const fenDespues = fensDeLinea([...prefijo, uci]).at(-1)!
    const despues = await m.analizar(fenDespues, { profundidad: 14 })
    verificando = false
    const evDespues = invertir(despues.ev)
    const perdida = chancesDeGanar(antes.ev) - chancesDeGanar(evDespues)
    const extra = porQueNoPara(prefijo, uci)?.texto
    if (perdida >= 0.1) {
      const motivo = detectarMotivoError(fenDespues, despues.linea, despues.ev)
      mensaje = {
        tipo: 'mal',
        texto: `✗ ${san} pierde: de ${textoEvaluacion(antes.ev)} a ${textoEvaluacion(evDespues)}${motivo.length ? ` (${motivo.join(', ')})` : ''}.${extra ? ' ' + extra : ''}`,
      }
      refutacion = { titulo: `Por qué no ${san}`, fen: fenDespues, ucis: despues.linea }
    } else {
      mensaje = { tipo: 'mal', texto: `✗ ${san} no es la jugada de esta línea. Stockfish la considera jugable (${textoEvaluacion(evDespues)}), pero la teoría acá es otra.${extra ? ' ' + extra : ''}` }
    }
  }

  let flechas = $derived.by((): Flecha[] => {
    if (refutacion && vista?.proxima) return [{ de: vista.proxima.slice(0, 2), a: vista.proxima.slice(2, 4), color: 'blue' }]
    if (paso && turnoMio && !lineaTerminada && (paso.fase === 'presentar' || fallaAca) && ply < paso.linea.length)
      return [{ de: paso.linea[ply].slice(0, 2), a: paso.linea[ply].slice(2, 4), color: 'green' }]
    return []
  })

  let bien = $derived(resultados.filter((r) => r.bien).length)

  /** Nombre de la variante a la que llega la línea completa (la más profunda con nombre). */
  let variante = $derived.by(() => {
    if (!catalogo || !paso) return undefined
    const a = clasificar(catalogo, paso.linea)
    return a ? nombreEnEspanol(a) : undefined
  })

  let sale = $derived(catalogo ? criterioFamilia(catalogo, raiz) : undefined)

  /** Otras jugadas mías en la posición tras `prefijo` que llevan a otra apertura, en texto. */
  const cacheTransposiciones = new Map<string, ReturnType<typeof transposiciones>>()
  function transposicionesDe(prefijo: string[], jugada: string) {
    if (!catalogo || !sale) return []
    const clave = `${prefijo.join(' ')}|${jugada}`
    let t = cacheTransposiciones.get(clave)
    if (!t) cacheTransposiciones.set(clave, (t = transposiciones(todas, prefijo, jugada, sale, catalogo)))
    return t
  }

  function textoTransposicion(prefijo: string[], jugada: string): string | undefined {
    const t = transposicionesDe(prefijo, jugada)
    if (!t.length) return undefined
    const p = posDesdeFen(fensDeLinea(prefijo).at(-1)!)
    const numero = `${Math.floor(prefijo.length / 2) + 1}.${prefijo.length % 2 ? '..' : ''}`
    const partes = t.map((x) => `${numero} ${sanDeUci(p, x.uci)} (${x.familias.slice(0, 2).map(familiaEnEspanol).join(', ')})`)
    return partes.length === 1
      ? `Acá también se juega ${partes[0]}, que lleva a otra apertura; este curso sigue con la jugada propia de esta.`
      : `Acá también se juegan ${partes.join(' o ')}, que llevan a otras aperturas; este curso sigue con la jugada propia de esta.`
  }

  /** Las jugadas ya hechas en la línea que tienen explicación o una transposición posible, de los dos bandos. */
  let ideas = $derived.by(() => {
    if (!paso) return []
    const sans = lineaSan(fens[0], paso.linea.slice(0, ply))
    const r: { ply: number; jugada: string; texto: string }[] = []
    for (let i = 0; i < ply; i++) {
      const nota = notaPara(paso.linea.slice(0, i + 1))
      const mia = (i % 2 === 0) === (color === 'white')
      const transpone = mia && i >= raiz.length ? textoTransposicion(paso.linea.slice(0, i), paso.linea[i]) : undefined
      if (!nota && !transpone) continue
      const textos = [
        nota && nota.nota.porQue + (nota.nota.inferior ? ' (Stockfish la considera algo inferior, pero es teoría jugable.)' : ''),
        transpone,
      ]
      r.push({ ply: i, jugada: `${Math.floor(i / 2) + 1}.${i % 2 ? '..' : ''} ${sans[i]}`, texto: textos.filter(Boolean).join(' ') })
    }
    return r
  })

  function alternarIdea(i: number) {
    const n = new Set(abiertas)
    if (n.has(i)) n.delete(i)
    else n.add(i)
    abiertas = n
  }
</script>

<div class="cabecera">
  <div>
    <h2>{titulo}</h2>
    <span class="suave">{modo === 'aprender' ? 'Líneas nuevas' : 'Repaso'} · {color === 'white' ? 'blancas' : 'negras'}</span>
  </div>
  <button class="boton enlace" onclick={alSalir}>Volver a la apertura</button>
</div>

{#if terminado}
  <section class="tarjeta">
    <h2>Listo</h2>
    <p>{resultados.length} línea{resultados.length === 1 ? '' : 's'}: {bien} sin errores{resultados.length - bien ? `, ${resultados.length - bien} con errores (vuelven antes al repaso)` : ''}.</p>
    <button class="boton principal" onclick={alSalir}>Volver a la apertura</button>
  </section>
{:else if antesDeMezcla}
  <section class="tarjeta">
    <h2>Ahora, mezcladas</h2>
    <p>
      Ya viste las {lineas.length} líneas de la lección. Ahora vuelven en otro orden: el rival elige la variante y vos tenés que
      recordar tu jugada en cada caso. El nombre de la variante queda como pista. Esta vuelta es la que cuenta para el repaso.
    </p>
    <button class="boton principal" onclick={empezarMezcla}>Empezar</button>
  </section>
{:else if paso}
  <div class="practica">
    <Tablero
      fen={refutacion && vista ? vista.fen : fen}
      orientacion={color}
      puedeMover={turnoMio && !lineaTerminada && !refutacion ? color : undefined}
      ultimaJugada={refutacion && vista ? vista.ultima : ply > 0 ? paso.linea[ply - 1] : undefined}
      {flechas}
      {alJugar}
      {refrescar}
    />
    <div class="panel">
      <p class="suave">{etapa}{#if variante} · <span class="variante">{variante}</span>{/if}</p>
      <div class="progreso" aria-label="Tus jugadas en esta línea">
        {#each misPlies as p, i (p)}<span class="cuadro {marcas[i] ?? ''}" class:actual={p === ply && !lineaTerminada}></span>{/each}
      </div>
      <p class="consigna">
        {#if lineaTerminada}&nbsp;{:else if !turnoMio}Juega el rival…{:else if paso.fase === 'presentar'}Jugá la jugada que marca la flecha.{:else if fallaAca}Jugá la jugada que marca la flecha.{:else}Jugá la jugada que aprendiste.{/if}
      </p>
      <p class="suave">{lineaSan(fens[0], paso.linea.slice(0, ply)).join(' ') || 'Posición inicial'}</p>

      {#if mensaje}<p class={mensaje.tipo}>{mensaje.texto}</p>{/if}
      {#if alternativa}
        {@const a = alternativa}
        <button class="boton" onclick={() => alCambiarEleccion(a.prefijo, a.uci)}>Guardar {a.san} como mi jugada en esta posición</button>
      {/if}
      {#if lineaTerminada && paso.fase !== 'presentar' && errores > 0}
        <button class="boton principal" onclick={siguiente}>Seguir</button>
      {/if}
      {#if refutacion}
        <VisorLinea linea={refutacion} alMover={(f, u, p) => (vista = { fen: f, ultima: u, proxima: p })} />
        <button class="boton enlace" onclick={() => { refutacion = undefined; vista = undefined }}>Volver a la posición</button>
      {/if}
      {#if ideas.length}
        <div class="ideas">
          <p class="suave">Ideas de las jugadas hechas (tocá para verlas):</p>
          {#each ideas as idea (idea.ply)}
            <button class="idea-boton" aria-expanded={abiertas.has(idea.ply)} onclick={() => alternarIdea(idea.ply)}>
              <b>{idea.jugada}</b>
              {#if abiertas.has(idea.ply)}<span>{idea.texto}</span>{:else}<span class="suave">Ver la idea</span>{/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .cabecera {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }
  .cabecera h2 {
    margin: 0;
  }
  .practica {
    display: grid;
    gap: 16px;
  }
  @media (min-width: 1000px) {
    .practica {
      grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr);
      align-items: start;
    }
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .panel p {
    margin: 0;
  }
  .progreso {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .cuadro {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: var(--borde);
  }
  .cuadro.actual {
    outline: 2px solid var(--acento);
  }
  .cuadro.bien {
    background: #3f9b4b;
  }
  .cuadro.mal {
    background: #c9483c;
  }
  .consigna {
    font-weight: 600;
  }
  .bien {
    color: #3f9b4b;
  }
  .mal {
    color: #c9483c;
  }
  .variante {
    color: var(--texto);
  }
  .ideas {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .idea-boton {
    display: flex;
    gap: 8px;
    text-align: left;
    font: inherit;
    color: var(--texto);
    background: none;
    border: none;
    border-left: 3px solid var(--acento);
    padding: 2px 0 2px 10px;
    cursor: pointer;
  }
  .idea-boton b {
    flex: none;
  }
</style>
