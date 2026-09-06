<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { restoreAccount } from '$lib/accounts/account-client';
  import {
    beginGameSession,
    gameKeyIsValid,
    pendingGameKey,
  } from '$lib/game-session';
  import { copy } from '$lib/i18n';

  let busy = true;
  let gameKey = '';
  let errorMessage = '';

  onMount(() => {
    gameKey = get(pendingGameKey) ?? '';
    pendingGameKey.set(null);
    void restoreAccount()
      .then(async (account) => {
        if (!account) {
          await goto(resolve('/login'));
          return;
        }
        if (!gameKeyIsValid(gameKey)) {
          await goto(resolve('/key'));
          return;
        }
        busy = false;
      })
      .catch(() => {
        errorMessage = copy.login.serviceError;
      });
  });

  async function startGame(mode: 'realtime' | 'streaming'): Promise<void> {
    if (busy) return;
    busy = true;
    errorMessage = '';
    try {
      await beginGameSession(mode, gameKey);
      await goto(resolve('/game'));
    } catch {
      errorMessage = 'The game could not start. Please try again.';
    } finally {
      busy = false;
    }
  }
</script>

<section class="login-card" aria-labelledby="mode-title">
  <div class="login-card-mark" aria-hidden="true">✦</div>
  <div class="mode-choice" role="group" aria-labelledby="mode-title">
    <h2 id="mode-title">{copy.login.modeTitle}</h2>
    <p>{copy.login.modeIntro}</p>
    {#if errorMessage}<p class="form-error" role="alert">{errorMessage}</p>{/if}
    <div class="mode-buttons">
      <button
        type="button"
        disabled={busy}
        on:click={() => startGame('realtime')}>{copy.login.realtimeMode}</button
      >
      <button
        type="button"
        disabled={busy}
        on:click={() => startGame('streaming')}
        >{copy.login.streamingMode}</button
      >
    </div>
  </div>
</section>

<style>
  @import './login-widget.css';
</style>
