<script lang="ts">
  import { calcularProgreso, type Fila, type Progreso } from '../lib/progreso.ts'

  let progreso = $state<Progreso>()
  calcularProgreso().then((p) => (progreso = p))

  const pct = (x: number) => `${Math.round(100 * x)} %`
  const acierto = (f: Fila) => (f.intentos ? pct(f.aciertos / f.intentos) : '—')
</script>

<h1>Progreso</h1>
<p class="suave">Dominio por área y lo que toca repasar. Sin rachas ni puntos: solo lo que sabés y lo que falta.</p>

{#if !progreso}
  <p class="suave">Calculando…</p>
{:else}
  <section class="tarjeta">
    <h2>Para repasar hoy</h2>
    <div class="numeros">
      <a href="#/tactica"><b>{progreso.colaHoy.tactica}</b><span>mis errores</span></a>
      <a href="#/tactica"><b>{progreso.colaHoy.problemas}</b><span>problemas</span></a>
      <a href="#/aperturas"><b>{progreso.colaHoy.aperturas}</b><span>líneas de apertura</span></a>
      <a href="#/finales"><b>{progreso.colaHoy.finales}</b><span>finales</span></a>
    </div>
    <p class="suave">Lo que fallás vuelve antes; lo que sale bien se espacia cada vez más (repaso espaciado FSRS).</p>
  </section>

  <section class="tarjeta">
    <h2>Táctica: mis errores por motivo</h2>
    {#if progreso.tacticaPorMotivo.length}
      <div class="tabla-scroll">
        <table>
          <thead><tr><th>Motivo</th><th class="num">Ejercicios</th><th class="num">Practicados</th><th class="num">Acierto</th><th class="num">Para repasar</th></tr></thead>
          <tbody>
            {#each progreso.tacticaPorMotivo as f (f.nombre)}
              <tr><td>{f.nombre}</td><td class="num">{f.total}</td><td class="num">{pct(f.practicados / f.total)}</td><td class="num">{acierto(f)}</td><td class="num">{f.vencidos}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="suave">Motivo: cómo castigaba el rival tu jugada (o, si no se reconoce, el tema de la mejor jugada).</p>
    {:else}
      <p class="suave">Todavía no hay errores cargados.</p>
    {/if}
  </section>

  {#if progreso.problemasPorTema.length}
    <section class="tarjeta">
      <h2>Problemas de Lichess por tema</h2>
      <div class="tabla-scroll">
        <table>
          <thead><tr><th>Tema</th><th class="num">Practicados</th><th class="num">Acierto</th><th class="num">Para repasar</th></tr></thead>
          <tbody>
            {#each progreso.problemasPorTema as f (f.nombre)}
              <tr><td>{f.nombre}</td><td class="num">{f.practicados} de {f.total}</td><td class="num">{acierto(f)}</td><td class="num">{f.vencidos}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}

  <section class="tarjeta">
    <h2>Aperturas: mi repertorio</h2>
    {#each progreso.aperturas as a (a.color)}
      <h3>{a.color} · {a.lineas} línea{a.lineas === 1 ? '' : 's'}</h3>
      {#if a.niveles.length}
        <ul class="niveles">
          {#each a.niveles as n (n.nombre)}
            <li>
              <span>{n.nombre}</span>
              <span class="medidor"><span style:width={pct(n.dominio)}></span></span>
              <span class="num">{pct(n.dominio)} de {n.total}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="suave">Sin líneas: armalo desde Aperturas → Mi repertorio.</p>
      {/if}
    {/each}
  </section>

  <section class="tarjeta">
    <h2>Finales del temario</h2>
    <ul class="niveles">
      {#each progreso.finales as f (f.titulo)}
        <li>
          <span>{f.titulo}</span>
          <span class="medidor"><span style:width={pct(f.dominio)}></span></span>
          <span class="num">{pct(f.dominio)}</span>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .numeros a {
    color: var(--texto);
    text-decoration: none;
  }
  h3 {
    font-size: 0.95rem;
    margin: 6px 0 0;
  }
  .niveles {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .niveles li {
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(60px, 1fr) auto;
    gap: 10px;
    align-items: center;
    font-size: 0.9rem;
  }
  .medidor {
    height: 8px;
    border-radius: 4px;
    background: var(--borde);
    overflow: hidden;
  }
  .medidor span {
    display: block;
    height: 100%;
    background: var(--acento);
  }
  .num {
    font-variant-numeric: tabular-nums;
    color: var(--texto-suave);
  }
</style>
