<script lang="ts">
  import { resolve } from '$app/paths';
  import LoginWidget from '$lib/components/LoginWidget.svelte';
  import { copy } from '$lib/i18n';
</script>

<svelte:head>
  <title>{copy.login.title}</title>
</svelte:head>

<main class="auth-page">
  <a class="auth-wordmark" href={resolve('/')}>{copy.wordmark}</a>
  <LoginWidget />
</main>

<style>
  .auth-page {
    display: grid;
    width: min(100% - 32px, 680px);
    min-height: 100vh;
    margin: 0 auto;
    align-content: center;
    justify-items: start;
    gap: 26px;
    padding: 32px 0;
  }

  .auth-wordmark {
    color: #512b9a;
    font-size: 0.8rem;
    font-weight: 900;
    letter-spacing: 0.13em;
    text-decoration: none;
  }
</style>
