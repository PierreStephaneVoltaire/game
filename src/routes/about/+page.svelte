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
<section class="about-card" aria-labelledby="about-title">
  <h1 id="about-title">Legally Distinct Virtual Companion</h1>
  <p class="section-copy">
    Congratulations, chat. You have officially adopted a cute, loud, easily distracted, pixie bunny who lives directly inside your screen. Your job is to keep her alive, reasonably sane, and coax her into actually turning on the stream before she hyperfixates on three different Live2D rigging projects and forgets to eat.
  </p>

  <h2>✨ What Is This?</h2>
  <p>
    Part cozy Virtual friend, part chaotic indie creator management sim. She has big streamer dreams, zero survival instincts, an unfiltered mouth, and an endless craving for questionable junk food. Every life is unscripted and permanent, so don't get reckless.
  </p>

  <h2>🌟 What Can You Do?</h2>
  <ul>
    <li>
      <strong>Streams on Her Own Watch:</strong> You can't just force her live like a machine. She boots up the stream when the vibe is right, her energy is up, or chat successfully bribes her. Deal with chat raids, manage hype, and dodge sudden Twitter drama.
    </li>
    <li>
      <strong>Gremlin Nutrition &amp; Hazards:</strong> What you feed her actually matters. If you let her binge on sodium without a drop of water, expect medical complaints. Chug energy drinks for late-night rigging marathons, balance out the sugar crashes, and make sure she occasionally touches bed.
    </li>
    <li>
      <strong>Live2D Rigging Hustles:</strong> When streaming revenue gets tight, put her rigging tablet to work! Take on client art commissions to pay for groceries, desk upgrades, and the inevitable equipment replacements.
    </li>
    <li>
      <strong>A Shop Full of Chaos:</strong> Browse a rotating inventory of snacks, plushies, room decor, and sketchy emergency finance options. Treat her to something nice, or buy an apology gift after you accidentally annoy her.
    </li>
    <li>
      <strong>Choose Your Pace:</strong> Play in Realtime Mode to sync her schedule with your actual day, or kick back in Streaming Mode where time only moves forward when you tell it to.
    </li>
  </ul>

  <p class="section-copy">
    Keep the water glass full, protect the tablet from spilled drinks, and try not to end up in the emergency room. Good luck, you're going to need it!
  </p>
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
    border: 4px solid var(--theme-ink);
    background: var(--theme-cream);
    box-shadow: 8px 8px 0 var(--theme-ink);
  }
  h1,
  h2 {
    margin: 0;
    color: var(--theme-ink);
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
    color: var(--theme-ink);
    line-height: 1.7;
  }
</style>
