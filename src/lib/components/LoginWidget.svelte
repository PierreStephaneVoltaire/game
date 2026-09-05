<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import {
    credentialsAreValid,
    beginDiscordLogin,
    completeDiscordOnboarding,
    loginAccount,
    registerAccount,
    resetPassword,
    restoreAccount,
  } from '$lib/accounts/account-client';
  import { copy } from '$lib/i18n';

  let username = '';
  let password = '';
  let onboardingToken = '';
  let resetToken = '';
  let busy = true;
  let authQueued = false;
  let authTimer: ReturnType<typeof setTimeout> | null = null;
  let errorMessage = '';

  $: validCredentials = credentialsAreValid(username, password);

  onDestroy(() => {
    if (authTimer) clearTimeout(authTimer);
  });

  onMount(() => {
    onboardingToken =
      new URLSearchParams(window.location.hash.slice(1)).get(
        'discord-onboarding',
      ) ?? '';
    resetToken =
      new URLSearchParams(window.location.hash.slice(1)).get('reset-token') ??
      '';
    if (onboardingToken || resetToken)
      window.history.replaceState(null, '', window.location.pathname);
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

  async function authenticate(action: 'login' | 'register'): Promise<void> {
    if (busy || !validCredentials) return;
    busy = true;
    errorMessage = '';
    try {
      if (action === 'login') await loginAccount(username, password);
      else await registerAccount(username, password);
      password = '';
      await goto(resolve('/key'));
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : copy.login.serviceError;
    } finally {
      busy = false;
    }
  }

  function queueAuthentication(action: 'login' | 'register'): void {
    if (busy || authQueued || !validCredentials) return;
    authQueued = true;
    authTimer = setTimeout(() => {
      authTimer = null;
      authQueued = false;
      void authenticate(action);
    }, 250);
  }

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

  async function completeReset(): Promise<void> {
    if (busy || !resetToken) return;
    busy = true;
    errorMessage = '';
    try {
      await resetPassword(resetToken, password);
      resetToken = '';
      password = '';
      errorMessage = 'Password reset. Sign in with your new password.';
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

  {#if resetToken}
    <form on:submit|preventDefault={completeReset}>
      <label for="password">Choose a new password</label>
      <input
        id="password"
        name="password"
        type="password"
        autocomplete="new-password"
        minlength="8"
        maxlength="128"
        required
        bind:value={password}
      />
      {#if errorMessage}<p class="form-error" role="alert">
          {errorMessage}
        </p>{/if}
      <div class="form-actions">
        <button type="submit" disabled={busy || password.length < 8}
          >Reset password<span aria-hidden="true">→</span></button
        >
      </div>
    </form>
  {:else if onboardingToken}
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
    <form on:submit|preventDefault={() => queueAuthentication('login')}>
      <label for="username">{copy.login.usernameLabel}</label>
      <input
        id="username"
        name="username"
        type="text"
        placeholder={copy.login.usernamePlaceholder}
        autocomplete="username"
        minlength="3"
        maxlength="24"
        pattern="[A-Za-z0-9_]+"
        required
        bind:value={username}
      />

      <label for="password">{copy.login.passwordLabel}</label>
      <input
        id="password"
        name="password"
        type="password"
        placeholder={copy.login.passwordPlaceholder}
        bind:value={password}
        maxlength="128"
        required
        autocomplete="current-password"
      />

      {#if errorMessage}<p class="form-error" role="alert">
          {errorMessage}
        </p>{/if}

      <div class="form-actions">
        <button
          type="submit"
          disabled={busy || authQueued || !validCredentials}
        >
          {copy.login.submit}<span aria-hidden="true">→</span>
        </button>
        <button
          class="secondary-action"
          type="button"
          disabled={busy || authQueued || !validCredentials}
          on:click={() => queueAuthentication('register')}
          >{copy.login.createAccount}</button
        >
      </div>
    </form>
  {/if}

  <a class="login-back" href={resolve('/')}>← {copy.login.back}</a>
</section>

<style>
  @import './login-widget.css';
</style>
