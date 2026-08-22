<script lang="ts">
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import { beginGameSession } from '$lib/game-session';
  import { copy } from '$lib/i18n';

  const keyAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let username = '';
  let sessionKey = '';
  let signedIn = false;
  let starting = false;

  function createGeneratedKey(): string {
    const values = new Uint32Array(8);
    crypto.getRandomValues(values);
    return Array.from(
      values,
      (value) => keyAlphabet[value % keyAlphabet.length],
    ).join('');
  }

  function signIn(): void {
    if (username.trim() && /^[A-Za-z0-9]{8}$/.test(sessionKey.trim()))
      signedIn = true;
  }

  async function startGame(mode: 'realtime' | 'streaming'): Promise<void> {
    if (starting) return;
    starting = true;
    await beginGameSession(mode);
    await goto(resolve('/game'));
  }
</script>

<section class="login-card" aria-labelledby="login-title">
  <div class="login-card-mark" aria-hidden="true">✦</div>
  <p class="login-eyebrow">{copy.login.eyebrow}</p>
  <h1 id="login-title">{copy.login.title}</h1>
  <p class="login-intro">{copy.login.intro}</p>

  {#if !signedIn}
    <form novalidate on:submit|preventDefault={signIn}>
      <label for="username">{copy.login.usernameLabel}</label>
      <input
        id="username"
        name="username"
        type="text"
        placeholder={copy.login.usernamePlaceholder}
        autocomplete="username"
        required
        bind:value={username}
      />

      <label for="session-key">{copy.login.generatedKeyLabel}</label>
      <input
        id="session-key"
        name="key"
        type="text"
        placeholder={copy.login.keyPlaceholder}
        bind:value={sessionKey}
        maxlength="8"
        minlength="8"
        pattern="[A-Za-z0-9]{8}"
        required
        autocapitalize="characters"
        autocomplete="off"
      />

      <button
        class="generate-key"
        type="button"
        on:click={() => (sessionKey = createGeneratedKey())}
        >{copy.login.generateKey}</button
      >

      <button type="submit">
        {copy.login.submit}<span aria-hidden="true">→</span>
      </button>
    </form>
  {:else}
    <div class="mode-choice" role="group" aria-labelledby="mode-title">
      <h2 id="mode-title">{copy.login.modeTitle}</h2>
      <p>{copy.login.modeIntro}</p>
      <div class="mode-buttons">
        <button
          type="button"
          disabled={starting}
          on:click={() => startGame('realtime')}
          >{copy.login.realtimeMode}</button
        >
        <button
          type="button"
          disabled={starting}
          on:click={() => startGame('streaming')}
          >{copy.login.streamingMode}</button
        >
      </div>
    </div>
  {/if}

  <a class="login-back" href={resolve('/')}>← {copy.login.back}</a>
</section>

<style>
  @import './login-widget.css';
</style>
