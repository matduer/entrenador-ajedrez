<script lang="ts">
  import { invertir, textoEvaluacion, type Evaluacion } from '../ajedrez/evaluacion.ts'
  import { lineaConNumeros, posDesdeFen } from '../ajedrez/posicion.ts'
  import { motorAnalisis, type ResultadoMotor } from '../motor/motor.ts'

  interface Props {
    fen: string
    /** Mejor jugada de la posición, para dibujarla en el tablero (o nada si el panel está apagado). */
    mejor?: string
    /** Se llama al prenderlo: en un ejercicio sin resolver, mirar el motor cuenta como pista. */
    alPrender?: () => void
    /** Aviso junto al interruptor (por ejemplo, que prenderlo cuenta como pista). */
    aviso?: string
  }
  let { fen, mejor = $bindable(), alPrender, aviso }: Props = $props()

  // Apagado por defecto: así no muestra la respuesta antes de tiempo.
  let activo = $state(false)
  let resultado = $state<ResultadoMotor>()
  let terminal = $state<string>()
  let ficha = 0

  const PROFUNDIDADES = [10, 14, 18, 22]

  /** Evaluación desde el lado de las blancas, como en Lichess. */
  function paraBlancas(ev: Evaluacion, f: string): Evaluacion {
    return f.split(' ')[1] === 'w' ? ev : invertir(ev)
  }

  function texto(ev: Evaluacion, f: string): string {
    const e = paraBlancas(ev, f)
    if (e.mate !== undefined) return e.mate === 0 ? '#' : `#${e.mate > 0 ? '' : '−'}${Math.abs(e.mate)}`
    return textoEvaluacion(e)
  }

  async function analizar(f: string, mia: number) {
    for (const p of PROFUNDIDADES) {
      const r = await motorAnalisis().analizar(f, { profundidad: p, multipv: 3 })
      if (mia !== ficha) return
      resultado = r
      mejor = r.mejor || undefined
      if (!r.lineas.length) return
    }
  }

  $effect(() => {
    const f = fen
    const mia = ++ficha
    resultado = undefined
    mejor = undefined
    terminal = undefined
    if (!activo) return
    const pos = posDesdeFen(f)
    if (pos.isCheckmate()) terminal = 'Jaque mate.'
    else if (pos.isStalemate()) terminal = 'Ahogado.'
    else analizar(f, mia)
    return () => motorAnalisis().detener()
  })

  function alternar() {
    activo = !activo
    if (activo) alPrender?.()
  }
</script>

<div class="motor" class:activo>
  <div class="cabecera">
    <button class="interruptor" role="switch" aria-checked={activo} aria-label="Stockfish" onclick={alternar}><span></span></button>
    {#if activo && resultado?.lineas.length}
      <b class="evaluacion">{texto(resultado.ev, fen)}</b>
    {/if}
    <span class="suave">Stockfish{activo && resultado ? ` · profundidad ${resultado.profundidad}` : ''}</span>
    {#if !activo && aviso}<span class="suave aviso">{aviso}</span>{/if}
  </div>
  {#if activo}
    {#if terminal}
      <p class="suave">{terminal}</p>
    {:else if !resultado}
      <p class="suave">Analizando…</p>
    {:else}
      <ol class="lineas">
        {#each resultado.lineas as l, i (i)}
          <li><b>{texto(l.ev, fen)}</b> <span>{lineaConNumeros(fen, l.linea.slice(0, 12))}</span></li>
        {/each}
      </ol>
    {/if}
  {/if}
</div>

<style>
  .motor {
    border: 1px solid var(--borde);
    border-radius: var(--radio);
    background: var(--superficie);
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cabecera {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .evaluacion {
    font-size: 1.3rem;
  }
  .aviso {
    font-size: 0.8rem;
  }
  .interruptor {
    width: 40px;
    height: 22px;
    border-radius: 11px;
    border: 1px solid var(--borde);
    background: var(--borde);
    position: relative;
    cursor: pointer;
    padding: 0;
    flex: none;
  }
  .interruptor span {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--superficie);
    transition: left 0.15s;
  }
  .activo .interruptor {
    background: #3f9b4b;
  }
  .activo .interruptor span {
    left: 20px;
  }
  .lineas {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.88rem;
  }
  .lineas li {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lineas b {
    display: inline-block;
    min-width: 3.2em;
  }
</style>
