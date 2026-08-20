<script lang="ts">
  import { resolve } from '$app/paths';
  import { copy, createTranslator } from '$lib/i18n';

  const petName = import.meta.env.PUBLIC_PET_NAME || 'your pet';
  const text = createTranslator({ pet: petName });
</script>

<svelte:head>
  <title>{text(copy.game.title)}</title>
</svelte:head>

<main class="game-page">
  <header class="game-header">
    <a class="game-wordmark" href={resolve('/')}
      >{text(copy.wordmark).toUpperCase()}</a
    >
    <span class="game-status">{copy.game.status}</span>
  </header>

  <section class="game-layout" aria-labelledby="game-title">
    <div class="game-intro">
      <p class="game-eyebrow">{copy.game.eyebrow}</p>
      <h1 id="game-title">{text(copy.game.title)}</h1>
      <p>{copy.game.subtitle}</p>
      <a class="game-exit" href={resolve('/')}>← {copy.game.back}</a>
    </div>

    <article class="game-console" aria-label={copy.previewLabel}>
      <div class="game-console-topline">
        <span>{copy.deviceId}</span>
        <span>{copy.careMode}</span>
      </div>
      <div class="game-screen">
        <span class="game-star game-star-one" aria-hidden="true">✦</span>
        <span class="game-star game-star-two" aria-hidden="true">✦</span>
        <div class="game-pet" aria-hidden="true">
          <span class="game-ear game-ear-left"></span>
          <span class="game-ear game-ear-right"></span>
          <span class="game-hair"></span>
          <span class="game-face"><i></i><i></i><b></b></span>
          <span class="game-body"></span>
        </div>
        <p>{copy.screenMessage}</p>
      </div>
      <div class="game-stats" aria-label={copy.game.statsLabel}>
        <span
          ><b>{copy.stats.food}</b><i class="game-meter game-meter-food"
          ></i></span
        >
        <span
          ><b>{copy.stats.rest}</b><i class="game-meter game-meter-rest"
          ></i></span
        >
        <span
          ><b>{copy.stats.heart}</b><i class="game-meter game-meter-heart"
          ></i></span
        >
        <span
          ><b>{copy.stats.cheer}</b><i class="game-meter game-meter-cheer"
          ></i></span
        >
      </div>
    </article>
  </section>

  <section class="action-panel" aria-labelledby="actions-title">
    <p class="game-eyebrow">{copy.game.actionsLabel}</p>
    <h2 id="actions-title">Take good care.</h2>
    <div class="action-grid">
      <button type="button"><span>●</span>{copy.game.actions.food}</button>
      <button type="button"><span>☾</span>{copy.game.actions.rest}</button>
      <button type="button"><span>♥</span>{copy.game.actions.heart}</button>
      <button type="button"><span>✦</span>{copy.game.actions.cheer}</button>
    </div>
  </section>
</main>

<style>
  @import './game.css';
</style>
