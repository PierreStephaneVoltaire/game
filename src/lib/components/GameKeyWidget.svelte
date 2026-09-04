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
  import { listLocalGames } from '$lib/persistence/games';

  let gameKey = '';
  let generatedKey = '';
  let busy = true;
  let savedKeys: string[] = [];

  $: validGameKey = gameKeyIsValid(gameKey);
  $: generatedKeyIsCurrent = generatedKey !== '' && gameKey === generatedKey;

  onMount(() => {
    void restoreAccount().then(async (account) => {
      if (!account) {
        await goto(resolve('/login'));
        return;
      }
      savedKeys = (await listLocalGames()).map((game) => game.gameHash);
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
    gameKey = generatedKey;
  }

  async function continueWithNewKey(): Promise<void> {
    if (busy || !generatedKey) return;
    await goto(resolve(`/mode?key=${generatedKey}`));
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

  {#if savedKeys.length}
    <section class="saved-games" aria-label="Saved games">
      <p>Saved on this device</p>
      {#each savedKeys as key (key)}
        <button class="secondary-action" type="button" disabled={busy} on:click={() => openKey(key)}
          >Open {key}</button
        >
      {/each}
    </section>
  {/if}

  {#if generatedKeyIsCurrent}
    <button type="button" disabled={busy} on:click={continueWithNewKey}
      >Continue</button
    >
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

  .secondary-action {
    width: 100%;
    justify-content: center;
  }
  .saved-games p {
    margin: 20px 0 8px;
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
  }
  .saved-games .secondary-action + .secondary-action {
    margin-top: 8px;
  }
</style>
