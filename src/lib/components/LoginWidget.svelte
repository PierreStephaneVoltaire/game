<script lang="ts">
  import { resolve } from '$app/paths';
  import { copy, createTranslator } from '$lib/i18n';

  const petName = import.meta.env.PUBLIC_PET_NAME || 'your pet';
  const text = createTranslator({ pet: petName });
</script>

<section class="login-card" aria-labelledby="login-title">
  <div class="login-card-mark" aria-hidden="true">✦</div>
  <p class="login-eyebrow">{copy.login.eyebrow}</p>
  <h1 id="login-title">{copy.login.title}</h1>
  <p class="login-intro">{text(copy.login.intro)}</p>

  <form action="/game" method="get">
    <label for="save-name">{copy.login.saveNameLabel}</label>
    <input
      id="save-name"
      name="save"
      type="text"
      placeholder={copy.login.saveNamePlaceholder}
      autocomplete="off"
    />

    <label for="recovery-code">{copy.login.recoveryLabel}</label>
    <input
      id="recovery-code"
      name="code"
      type="text"
      inputmode="numeric"
      placeholder={copy.login.recoveryPlaceholder}
      autocomplete="off"
    />

    <button type="submit"
      >{copy.login.submit}<span aria-hidden="true">→</span></button
    >
  </form>

  <a class="login-back" href={resolve('/')}>← {copy.login.back}</a>
</section>

<style>
  @import './login-widget.css';
</style>
