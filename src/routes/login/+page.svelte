<script lang="ts">
  import { resolve } from '$app/paths';
  import LoginWidget from '$lib/components/LoginWidget.svelte';
  import { copy, createTranslator } from '$lib/i18n';
  import { companion } from '$lib/ui/companion';

  const text = createTranslator({ pet: companion.name });
</script>

<svelte:head>
  <title>{copy.login.title}</title>
</svelte:head>

<main class="auth-page">
  <a class="auth-wordmark" href={resolve('/')}>{text(copy.wordmark)}</a>
  <LoginWidget />
</main>

<style>
  @import '../entry-page.css';
</style>
