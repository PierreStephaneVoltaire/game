<script lang="ts">
  import { resolve } from '$app/paths';
  import { copy, createTranslator } from '$lib/i18n';
  import { companion } from '$lib/ui/companion';

  const text = createTranslator({ pet: companion.name });
</script>

<svelte:head>
  <title>About · {text(copy.wordmark)}</title>
</svelte:head>

<main class="about-page">
  <header class="site-header">
    <a class="wordmark" href={resolve('/')}>
      <span class="wordmark-spark" aria-hidden="true">✦</span>
      {text(copy.wordmark).toUpperCase()}
    </a>
    <a class="build-label" href={resolve('/login')}>{copy.login.submit}</a>
  </header>

  <article class="about-card">
    <section aria-labelledby="about-title">
      <h1 id="about-title">About</h1>
      <p class="section-copy"></p>
    </section>

    <section aria-labelledby="credits-title">
      <h2 id="credits-title">Credits</h2>
      <p class="section-copy"></p>
    </section>
  </article>
</main>

<style>
  @import '../landing-base.css';

  .about-page {
    width: min(920px, calc(100% - 32px));
    min-height: 100vh;
    margin: 0 auto;
    padding-bottom: 64px;
  }
  .about-card {
    display: grid;
    gap: 28px;
    margin-top: clamp(36px, 8vh, 88px);
  }
  .about-card section {
    padding: clamp(24px, 5vw, 48px);
    border: 4px solid #512b9a;
    background: #fffdf9;
    box-shadow: 8px 8px 0 #f3a15f;
  }
  h1,
  h2 {
    margin: 0;
    color: #512b9a;
  }
  h1 {
    font-size: clamp(2.4rem, 7vw, 4.8rem);
  }
  h2 {
    font-size: clamp(2rem, 6vw, 3.8rem);
  }
  .section-copy {
    min-height: 8rem;
    margin: 20px 0 0;
    color: #56466b;
    line-height: 1.7;
  }
</style>
