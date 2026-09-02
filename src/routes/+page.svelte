<script lang="ts">
  import { resolve } from '$app/paths';
  import { copy, createTranslator } from '$lib/i18n';
  import { companion } from '$lib/ui/companion';

  const text = createTranslator({ pet: companion.name });
</script>

<svelte:head>
  <title>{text(copy.metaTitle)}</title>
  <meta name="description" content={text(copy.metaDescription)} />
</svelte:head>

<main class="page-shell">
  <header class="site-header">
    <span class="wordmark" aria-label={text(copy.metaTitle)}>
      <span class="wordmark-spark" aria-hidden="true">✦</span>
      {text(copy.wordmark).toUpperCase()}
    </span>
    <div class="header-links">
      <a class="build-label" href={resolve('/about')}>About</a>
      <a class="build-label" href={resolve('/login')}>{copy.login.submit}</a>
    </div>
  </header>

  <section class="hero" aria-labelledby="page-title">
    <div class="hero-copy">
      <p class="eyebrow">{copy.eyebrow}</p>
      <h1 id="page-title">{text(copy.heroTitle)}</h1>
      <p class="intro">{copy.intro}</p>
      <div class="status-card">
        <span class="status-light" aria-hidden="true"></span>
        <p>{copy.status}</p>
      </div>
    </div>

    <div class="device-wrap">
      <article class="pet-device" aria-label={copy.previewLabel}>
        <div class="device-topline">
          <span>{copy.deviceId}</span>
          <span>{copy.careMode}</span>
        </div>
        <div class="screen">
          <div class="screen-stars" aria-hidden="true">
            <span>✦</span>
            <span>·</span>
            <span>✦</span>
          </div>
          <div class="pet" aria-hidden="true">
            <span class="bunny-ear bunny-ear-left"></span>
            <span class="bunny-ear bunny-ear-right"></span>
            <span class="pet-ear pet-ear-left"></span>
            <span class="pet-ear pet-ear-right"></span>
            <span class="pet-hair"></span>
            <span class="pet-face">
              <i></i><i></i><b></b>
            </span>
            <span class="pet-body"></span>
          </div>
          <p class="screen-message">{copy.screenMessage}</p>
        </div>
        <div class="care-readout" aria-label={copy.statsLabel}>
          <span><b>{copy.stats.food}</b><i class="meter food-meter"></i></span>
          <span><b>{copy.stats.rest}</b><i class="meter rest-meter"></i></span>
          <span
            ><b>{copy.stats.health}</b><i class="meter heart-meter"></i></span
          >
          <span><b>{copy.stats.mood}</b><i class="meter cheer-meter"></i></span>
          <span><b>{copy.stats.bond}</b><i class="meter cheer-meter"></i></span>
          <span
            ><b>{copy.stats.creativity}</b><i class="meter cheer-meter"
            ></i></span
          >
        </div>
        <div class="device-controls" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </article>
      <span class="sticker sticker-one" aria-hidden="true">✦</span>
      <span class="sticker sticker-two" aria-hidden="true">♥</span>
    </div>
  </section>

  <section class="care-section" aria-labelledby="care-title">
    <div>
      <p class="eyebrow">{copy.sectionEyebrow}</p>
      <h2 id="care-title">{copy.sectionTitle}</h2>
    </div>
    <div class="care-grid">
      <article class="care-card food-card">
        <span class="card-icon" aria-hidden="true">●</span>
        <h3>{copy.cards.food.title}</h3>
        <p>{text(copy.cards.food.body)}</p>
      </article>
      <article class="care-card sleep-card">
        <span class="card-icon" aria-hidden="true">☾</span>
        <h3>{copy.cards.rest.title}</h3>
        <p>{text(copy.cards.rest.body)}</p>
      </article>
      <article class="care-card heart-card">
        <span class="card-icon" aria-hidden="true">♥</span>
        <h3>{copy.cards.heart.title}</h3>
        <p>{text(copy.cards.heart.body)}</p>
      </article>
      <article class="care-card cheer-card">
        <span class="card-icon" aria-hidden="true">✦</span>
        <h3>{copy.cards.cheer.title}</h3>
        <p>{text(copy.cards.cheer.body)}</p>
      </article>
    </div>
  </section>

  <footer>
    <p>
      {text(copy.footer).toUpperCase()}
    </p>
  </footer>
</main>

<style>
  @import './+page.css';
</style>
