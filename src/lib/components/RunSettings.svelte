<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { logoutAccount } from '$lib/accounts/account-client';
  import {
    listAccountGameKeys,
    NICKNAME_MAX_LENGTH,
    saveGameNickname,
  } from '$lib/accounts/game-keys';
  import type { GameMode } from '$lib/game-types';
  import RoomLookSettings from './RoomLookSettings.svelte';
  export let mode: GameMode = 'realtime';
  export let seed = '';
  let busy = false;
  let settings: HTMLDetailsElement;
  let nickname = '';
  let nicknameBusy = false;
  let nicknameMessage = '';

  onMount(() => {
    void listAccountGameKeys()
      .then((games) => {
        nickname = games.find((game) => game.gameHash === seed)?.nickname ?? '';
      })
      .catch(() => undefined);
  });

  async function saveNickname(): Promise<void> {
    if (nicknameBusy || !seed) return;
    nicknameBusy = true;
    nicknameMessage = '';
    try {
      nickname = (await saveGameNickname(seed, nickname)) ?? '';
      nicknameMessage = 'Nickname saved.';
    } catch {
      nicknameMessage = 'Could not save that nickname. Try again.';
    } finally {
      nicknameBusy = false;
    }
  }

  function closeOnOutsideClick(event: MouseEvent): void {
    if (settings?.open && !settings.contains(event.target as Node))
      settings.open = false;
  }

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

<svelte:window on:click={closeOnOutsideClick} />

<details class="settings" bind:this={settings}>
  <summary>Settings</summary>
  <div class="settings-menu">
    <RoomLookSettings />
    <p>Current mode: <strong>{modeLabel(mode)}</strong></p>
    <p>Game key: <code>{seed}</code></p>
    <form class="nickname" on:submit|preventDefault={saveNickname}>
      <label for="game-nickname">Game key nickname</label>
      <input
        id="game-nickname"
        type="text"
        maxlength={NICKNAME_MAX_LENGTH}
        bind:value={nickname}
      />
      <button type="submit" disabled={nicknameBusy}>Save nickname</button>
      {#if nicknameMessage}<p role="status">{nicknameMessage}</p>{/if}
    </form>
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
    background: var(--theme-white);
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
  .nickname {
    margin: 0 0 14px;
  }
  .nickname label {
    display: block;
    margin-bottom: 6px;
    font-weight: 900;
  }
  .nickname input {
    box-sizing: border-box;
    width: 100%;
    min-height: 42px;
    margin-bottom: 10px;
    padding: 8px 10px;
    border: 3px solid var(--theme-ink);
    color: var(--theme-ink);
    background: var(--theme-white);
    font: inherit;
  }
  .nickname p {
    margin: 8px 0 0;
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
