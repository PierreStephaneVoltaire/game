<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { restoreAccount } from '$lib/accounts/account-client';
  import {
    createGameKey,
    gameKeyIsValid,
    openGameSession,
  } from '$lib/game-session';

  let gameKey = '';
  let generatedKey = '';
  let busy = true;

  $: validGameKey = gameKeyIsValid(gameKey);

  onMount(() => {
    void restoreAccount().then(async (account) => {
      if (!account) {
        await goto(resolve('/login'));
        return;
      }
      busy = false;
    });
  });

  async function openKey(key = gameKey): Promise<void> {
    if (busy || !gameKeyIsValid(key)) return;
    busy = true;
    if (await openGameSession(key)) await goto(resolve('/game'));
    else busy = false;
  }

  function generateKey(): void {
    if (busy) return;
    generatedKey = createGameKey();
  }

  async function continueWithNewKey(): Promise<void> {
    if (busy || !generatedKey) return;
    await goto(`${resolve('/mode')}?key=${generatedKey}`);
  }
</script>

<section class="login-card" aria-labelledby="key-title">
  <div class="login-card-mark" aria-hidden="true">✦</div>
  <p class="login-eyebrow">GAME SESSION</p>
  <h1 id="key-title">Choose a game key.</h1>

  <form on:submit|preventDefault={() => openKey()}>
    <label for="game-key">Game key</label>
    <input
      id="game-key"
      name="game-key"
      type="text"
      inputmode="numeric"
      pattern={'[0-9]{8}'}
      minlength="8"
      maxlength="8"
      required
      bind:value={gameKey}
    />
    <button type="submit" disabled={busy || !validGameKey}>Open game</button>
  </form>

  <button class="secondary-action" type="button" disabled
    >Retrieve game keys</button
  >

  {#if generatedKey}
    <div class="generated-key">
      <label for="new-game-key">New game key</label>
      <input id="new-game-key" type="text" readonly value={generatedKey} />
      <button type="button" disabled={busy} on:click={continueWithNewKey}
        >Continue</button
      >
    </div>
  {:else}
    <button
      class="secondary-action"
      type="button"
      disabled={busy}
      on:click={generateKey}>Generate new game</button
    >
  {/if}
</section>

<style>
  @import './login-widget.css';

  .generated-key {
    display: grid;
    gap: 9px;
    margin-top: 28px;
  }
  .secondary-action {
    width: 100%;
    justify-content: center;
  }
</style>
