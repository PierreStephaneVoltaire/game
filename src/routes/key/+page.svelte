<script lang="ts">
  import { resolve } from '$app/paths';
  import GameKeyWidget from '$lib/components/GameKeyWidget.svelte';
  import { copy, createTranslator } from '$lib/i18n';
  import { companion } from '$lib/ui/companion';

  const text = createTranslator({ pet: companion.name });
</script>

<svelte:head><title>Game key</title></svelte:head>

<main class="auth-page">
  <a class="auth-wordmark" href={resolve('/')}>{text(copy.wordmark)}</a>
  <GameKeyWidget />
</main>

<style>
  @import '../entry-page.css';
</style>
