<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { restoreAccount } from '$lib/accounts/account-client';
  import AccountMenu from '$lib/accounts/AccountMenu.svelte';
  import {
    ensureGameSession,
    gameViewModel,
    reconcileGameClock,
  } from '$lib/game-session';
  import GameShop from '$lib/components/GameShop.svelte';
  import RunSettings from '$lib/components/RunSettings.svelte';
  import { gameCopy } from '$lib/ui/game-copy';
  import { OPEN_ROOM_INVENTORY_PICKER_EVENT } from '$lib/ui/room-picker-events';

  let authorized = false;
  let openDialog: 'shop' | 'inventory' | null = null;

  async function openShop(mode: 'shop' | 'inventory', event: MouseEvent) {
    const opener = event.currentTarget as HTMLButtonElement;
    if ($page.route.id !== '/game') await goto(resolve('/game'));
    opener.focus();
    openDialog = mode;
  }

  function openRoomInventoryPicker() {
    window.dispatchEvent(new CustomEvent(OPEN_ROOM_INVENTORY_PICKER_EVENT));
  }

  onMount(() => {
    let mounted = true;
    void restoreAccount()
      .then(async (account) => {
        if (!account) {
          await goto(resolve('/login'));
          return;
        }
        if (!mounted) return;
        const sessionReady = await ensureGameSession();
        if (!sessionReady) {
          await goto(resolve('/key'));
          return;
        }
        if (mounted) authorized = true;
      })
      .catch(() => goto(resolve('/login')));
    const reconcile = () => {
      if (authorized && document.visibilityState === 'visible')
        void reconcileGameClock();
    };
    document.addEventListener('visibilitychange', reconcile);
    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', reconcile);
    };
  });
</script>

<svelte:head
  ><meta
    name="description"
    content="A session-only companion game."
  /></svelte:head
>

{#if authorized}
  <div class="game-shell">
    <header class="game-nav">
      <div class="header-tools">
        <AccountMenu />
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
    <nav
      class="game-navigation"
      aria-label="Game navigation"
      data-game-row="navigation"
    >
      {#if $page.route.id === '/game'}
        <button
          type="button"
          on:click={openRoomInventoryPicker}
          disabled={Boolean(
            $gameViewModel?.activity || $gameViewModel?.commandsDisabled,
          )}>{gameCopy.room}</button
        >
      {:else}
        <a href={resolve('/game')}>{gameCopy.room}</a>
      {/if}
      <button type="button" on:click={(event) => openShop('shop', event)}
        >{gameCopy.shop}</button
      >
      <button type="button" on:click={(event) => openShop('inventory', event)}
        >{gameCopy.inventory}</button
      >
      <a href={resolve('/game/history')}>{gameCopy.history}</a>
    </nav>
    {#if openDialog}
      <GameShop mode={openDialog} onClose={() => (openDialog = null)} />
    {/if}
  </div>
{/if}

<style>
  .game-shell {
    min-height: 100vh;
    padding: 0 clamp(16px, 4vw, 64px) 64px;
    color: var(--theme-ink);
    background: var(--theme-cream);
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
    gap: 14px;
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
  .game-navigation a,
  .game-navigation button {
    display: grid;
    flex: 1 1 0;
    min-height: 48px;
    padding: 0;
    place-items: center;
    border: 3px solid var(--theme-ink);
    color: var(--theme-ink);
    background: var(--theme-white);
    box-shadow: 5px 5px 0 var(--theme-teal);
    font-size: 0.78rem;
    font-weight: 900;
    font-family: inherit;
    text-decoration: none;
    cursor: pointer;
  }
  .game-navigation a:hover,
  .game-navigation button:hover:not(:disabled) {
    color: var(--theme-ink);
    background: var(--theme-gold);
  }
  .game-navigation a:active,
  .game-navigation button:active:not(:disabled) {
    box-shadow: 2px 2px 0 var(--theme-teal);
    transform: translate(3px, 3px);
  }
  .game-navigation button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
  :global(button:focus-visible),
  :global(a:focus-visible),
  :global(summary:focus-visible),
  :global(select:focus-visible),
  :global(input:focus-visible) {
    outline: 3px solid var(--theme-ink);
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
    .game-navigation a,
    .game-navigation button {
      min-height: 44px;
      font-size: 0.7rem;
    }
  }
</style>
