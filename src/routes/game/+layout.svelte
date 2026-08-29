<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { page } from '$app/stores';
  import {
    ensureGameSession,
    gameViewModel,
    reconcileGameClock,
  } from '$lib/game-session';
  import RunSettings from '$lib/components/RunSettings.svelte';
  import { gameCopy } from '$lib/ui/game-copy';

  onMount(() => {
    void ensureGameSession();
    const reconcile = () => {
      if (document.visibilityState === 'visible') void reconcileGameClock();
    };
    document.addEventListener('visibilitychange', reconcile);
    return () => {
      document.removeEventListener('visibilitychange', reconcile);
    };
  });
</script>

<svelte:head
  ><meta
    name="description"
    content="A session-only companion care room."
  /></svelte:head
>

<div class="game-shell">
  <header class="game-nav">
    <div class="header-tools">
      {#if $gameViewModel}
        <RunSettings
          mode={$gameViewModel.mode}
          seed={$gameViewModel.seed}
          ended={Boolean($gameViewModel.ending)}
        />
      {/if}
    </div>
  </header>
  <slot />
  {#if !$page.url.pathname.startsWith('/game/shop')}
    <nav
      class="game-navigation"
      aria-label="Game navigation"
      data-game-row="navigation"
    >
      <a href={resolve('/game')}>{gameCopy.room}</a>
      <a href={resolve('/game/shop?tab=shop')}>{gameCopy.shop}</a>
      <a href={resolve('/game/shop?tab=inventory')}>{gameCopy.inventory}</a>
      <a href={resolve('/game/history')}>{gameCopy.history}</a>
    </nav>
  {/if}
</div>

<style>
  .game-shell {
    min-height: 100vh;
    padding: 0 clamp(16px, 4vw, 64px) 64px;
    color: #32254b;
    background: #fff8f2;
  }
  .game-nav {
    display: flex;
    align-items: center;
    gap: 18px;
    max-width: 1280px;
    margin: auto;
    padding: 20px 0;
    justify-content: space-between;
  }
  .header-tools {
    display: flex;
    align-items: center;
    margin-left: auto;
  }

  .game-navigation {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    width: 100%;
    max-width: 1120px;
    margin: 38px auto 0;
    padding: 0 0 20px;
  }
  .game-navigation a {
    display: grid;
    flex: 1 1 0;
    min-height: 48px;
    place-items: center;
    border: 3px solid #512b9a;
    color: #512b9a;
    background: #fff;
    box-shadow: 5px 5px 0 #f3a15f;
    font-size: 0.78rem;
    font-weight: 900;
    text-decoration: none;
  }
  .game-navigation a:hover {
    color: #fff;
    background: #512b9a;
  }
  .game-navigation a:active {
    box-shadow: 2px 2px 0 #f3a15f;
    transform: translate(3px, 3px);
  }
  :global(button:focus-visible),
  :global(a:focus-visible),
  :global(summary:focus-visible),
  :global(select:focus-visible),
  :global(input:focus-visible) {
    outline: 3px solid #f3a15f;
    outline-offset: 3px;
  }
  :global(*) {
    box-sizing: border-box;
  }
  @media (prefers-reduced-motion: reduce) {
    :global(*),
    :global(*::before),
    :global(*::after) {
      scroll-behavior: auto !important;
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
    }
  }
  @media (max-width: 560px) {
    .game-nav {
      padding-top: 16px;
    }
    .game-navigation {
      gap: 9px;
    }
    .game-navigation a {
      min-height: 44px;
      font-size: 0.7rem;
    }
  }
</style>
