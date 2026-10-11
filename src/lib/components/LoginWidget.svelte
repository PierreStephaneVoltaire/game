<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import {
    beginDiscordLogin,
    completeDiscordOnboarding,
    restoreAccount,
  } from '$lib/accounts/account-client';
  import { copy } from '$lib/i18n';

  let username = '';
  let onboardingToken = '';
  let busy = true;
  let errorMessage = '';

  onMount(() => {
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    onboardingToken = parameters.get('discord-onboarding') ?? '';
    if (onboardingToken) {
      username = (parameters.get('username') ?? '').trim().toLowerCase();
      window.history.replaceState(null, '', window.location.pathname);
    }
    void restoreAccount()
      .then((account) => {
        if (account) return goto(resolve('/key'));
      })
      .catch(() => {
        errorMessage = copy.login.serviceError;
      })
      .finally(() => {
        busy = false;
      });
  });

  async function completeDiscord(): Promise<void> {
    if (busy || !onboardingToken) return;
    busy = true;
    errorMessage = '';
    try {
      await completeDiscordOnboarding(onboardingToken, username);
      await goto(resolve('/key'));
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : copy.login.serviceError;
    } finally {
      busy = false;
    }
  }
</script>

<section class="login-card" aria-labelledby="login-title">
  <div class="login-card-mark" aria-hidden="true">✦</div>
  <p class="login-eyebrow">{copy.login.eyebrow}</p>
  <h1 id="login-title">{copy.login.title}</h1>
  <p class="login-intro">{copy.login.intro}</p>

  {#if onboardingToken}
    <form on:submit|preventDefault={completeDiscord}>
      <label for="username">Choose a username</label>
      <input
        id="username"
        name="username"
        type="text"
        autocomplete="username"
        minlength="3"
        maxlength="24"
        pattern="[A-Za-z0-9_]+"
        required
        bind:value={username}
      />
      {#if errorMessage}<p class="form-error" role="alert">
          {errorMessage}
        </p>{/if}
      <div class="form-actions">
        <button type="submit" disabled={busy || !username}
          >Finish Discord sign in<span aria-hidden="true">→</span></button
        >
      </div>
    </form>
  {:else}
    <button
      class="discord-action"
      type="button"
      disabled={busy}
      on:click={beginDiscordLogin}>Sign in with Discord</button
    >
    {#if errorMessage}<p class="form-error" role="alert">
        {errorMessage}
      </p>{/if}
  {/if}

  <a class="login-back" href={resolve('/')}>← {copy.login.back}</a>
</section>

<style>
  @import './login-widget.css';
</style>
