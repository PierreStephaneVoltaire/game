<script lang="ts">
  import { resolve } from '$app/paths';
  import { logoutAccount } from '$lib/accounts/account-client';
  import type { GameMode } from '$lib/game-types';
  export let mode: GameMode = 'realtime';
  export let seed = '';
  export let ended = false;
  let busy = false;

  const modeLabel = (value: GameMode) =>
    value === 'streaming' ? 'Streaming mode' : 'Realtime mode';

  async function signOut(): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      await logoutAccount();
    } finally {
      window.location.assign(resolve('/login'));
    }
  }
</script>

<details class="settings">
  <summary>Settings</summary>
  <div class="settings-menu">
    <p>Current mode: <strong>{modeLabel(mode)}</strong></p>
    <p>Game key: <code>{seed}</code></p>
    <p>
      {#if ended}This game has ended.
      {:else}This game is active.
      {/if} The time mode is selected before entering the room.
    </p>
    <button type="button" disabled={busy} on:click={signOut}>Sign out</button>
  </div>
</details>

<style>
  .settings {
    position: relative;
  }
  summary {
    min-height: 42px;
    padding: 10px 16px;
    border: 3px solid var(--theme-pink);
    color: var(--theme-pink-text);
    background: var(--theme-white);
    box-shadow: 5px 5px 0 var(--theme-gold);
    font-size: 0.78rem;
    font-weight: 900;
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .settings-menu {
    position: absolute;
    z-index: 20;
    top: calc(100% + 10px);
    right: 0;
    width: min(320px, calc(100vw - 32px));
    border: 3px solid var(--theme-pink);
    padding: 18px;
    color: var(--theme-ink);
    background: var(--theme-pink-light);
    box-shadow: 6px 6px 0 var(--theme-gold);
    font-size: 0.8rem;
    line-height: 1.45;
  }
  .settings-menu p {
    margin: 0 0 10px;
  }
  .settings-menu p:last-child {
    margin-bottom: 0;
  }
  button {
    width: 100%;
    min-height: 42px;
    padding: 10px 16px;
    border: 3px solid var(--theme-pink);
    color: var(--theme-pink-text);
    background: var(--theme-white);
    box-shadow: 5px 5px 0 var(--theme-gold);
    cursor: pointer;
    font: inherit;
    font-weight: 900;
  }
  summary:hover,
  button:hover:not(:disabled) {
    box-shadow: 3px 3px 0 var(--theme-gold);
    transform: translate(2px, 2px);
    background: var(--theme-pink);
    color: var(--theme-on-pink);
  }
  summary:active,
  button:active:not(:disabled) {
    box-shadow: 2px 2px 0 var(--theme-gold);
    transform: translate(3px, 3px);
  }
  button:disabled {
    cursor: wait;
    opacity: 0.6;
  }
  strong,
  code {
    color: var(--theme-ink);
  }
  code {
    overflow-wrap: anywhere;
  }
</style>
