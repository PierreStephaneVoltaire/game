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
    border: 3px solid #512b9a;
    color: #512b9a;
    background: #fff;
    box-shadow: 4px 4px 0 #f3a15f;
    font-size: 0.78rem;
    font-weight: 900;
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary:hover {
    color: #fff;
    background: #512b9a;
  }
  .settings-menu {
    position: absolute;
    z-index: 20;
    top: calc(100% + 10px);
    right: 0;
    width: min(320px, calc(100vw - 32px));
    border: 3px solid #512b9a;
    padding: 18px;
    color: #766d7f;
    background: #fff8f2;
    box-shadow: 6px 6px 0 #f3a15f;
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
    border: 3px solid #512b9a;
    color: #512b9a;
    background: #fff;
    cursor: pointer;
    font: inherit;
    font-weight: 900;
  }
  button:hover:not(:disabled) {
    color: #fff;
    background: #512b9a;
  }
  button:disabled {
    cursor: wait;
    opacity: 0.6;
  }
  strong,
  code {
    color: #512b9a;
  }
  code {
    overflow-wrap: anywhere;
  }
</style>
