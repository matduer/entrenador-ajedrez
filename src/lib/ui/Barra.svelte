<script lang="ts">
  /** Barra horizontal de victorias / tablas / derrotas. */
  interface Props {
    gano: number
    tablas: number
    pierdo: number
  }
  let { gano, tablas, pierdo }: Props = $props()
  let total = $derived(gano + tablas + pierdo || 1)
  const pct = (x: number) => `${(100 * x) / total}%`
</script>

<div class="barra" role="img" aria-label={`${gano} ganadas, ${tablas} tablas, ${pierdo} perdidas`}>
  <span class="g" style:width={pct(gano)}></span>
  <span class="t" style:width={pct(tablas)}></span>
  <span class="p" style:width={pct(pierdo)}></span>
</div>

<style>
  .barra {
    display: flex;
    height: 10px;
    border-radius: 5px;
    overflow: hidden;
    background: var(--borde);
    min-width: 60px;
  }
  .g {
    background: #5aa469;
  }
  .t {
    background: #a69e91;
  }
  .p {
    background: #c9483c;
  }
</style>
