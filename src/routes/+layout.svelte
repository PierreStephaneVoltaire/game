<script lang="ts">
  import theme from '$lib/data/theme.json';

  const variables = Object.entries(theme)
    .map(([name, value]) => `--theme-${name}:${value}`)
    .join(';');
</script>

<svelte:head>
  <svelte:element this={"style"}>{`:root{${variables}}`}</svelte:element>
</svelte:head>

<slot />

<style>
  :global(:root) {
    color: var(--theme-ink);
    background: var(--theme-cream);
    color-scheme: light;
    accent-color: var(--theme-pink);
  }
  :global(body) {
    background: var(--theme-cream);
  }
  :global(button),
  :global(input),
  :global(select),
  :global(textarea),
  :global(dialog) {
    color: var(--theme-ink);
    background-color: var(--theme-white);
    border-color: var(--theme-ink);
    border-radius: 0;
  }
  :global(meter) {
    appearance: none;
    border: 2px solid var(--theme-ink);
    border-radius: 0;
    background: var(--theme-cream);
  }
  :global(meter::-webkit-meter-bar) {
    height: 100%;
    border: 0;
    border-radius: 0;
    background: var(--theme-cream);
    box-shadow: none;
  }
  :global(meter::-webkit-meter-optimum-value),
  :global(meter::-webkit-meter-suboptimum-value),
  :global(meter::-webkit-meter-even-less-good-value) {
    background: var(--theme-pink);
    border-radius: 0;
  }
  :global(meter::-moz-meter-bar) {
    background: var(--theme-pink);
    border-radius: 0;
  }
</style>
