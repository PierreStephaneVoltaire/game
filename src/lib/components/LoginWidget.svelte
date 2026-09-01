<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import {
    credentialsAreValid,
    loginAccount,
    registerAccount,
    restoreAccount,
  } from '$lib/accounts/account-client';
  import { copy } from '$lib/i18n';

  let username = '';
  let password = '';
  let busy = true;
  let authQueued = false;
  let authTimer: ReturnType<typeof setTimeout> | null = null;
  let errorMessage = '';

  $: validCredentials = credentialsAreValid(username, password);

  onDestroy(() => {
    if (authTimer) clearTimeout(authTimer);
  });

  onMount(() => {
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
      const run = action === 'login' ? loginAccount : registerAccount;
      await run(username, password);
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
</script>

<section class="login-card" aria-labelledby="login-title">
  <div class="login-card-mark" aria-hidden="true">✦</div>
  <p class="login-eyebrow">{copy.login.eyebrow}</p>
  <h1 id="login-title">{copy.login.title}</h1>
  <p class="login-intro">{copy.login.intro}</p>

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
      aria-describedby="password-hint"
      bind:value={password}
      maxlength="128"
      minlength="12"
      required
      autocomplete="current-password"
    />
    <p id="password-hint" class="form-hint">{copy.login.passwordHint}</p>

    {#if errorMessage}<p class="form-error" role="alert">
        {errorMessage}
      </p>{/if}

    <div class="form-actions">
      <button type="submit" disabled={busy || authQueued || !validCredentials}>
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

  <a class="login-back" href={resolve('/')}>← {copy.login.back}</a>
</section>

<style>
  @import './login-widget.css';
</style>
