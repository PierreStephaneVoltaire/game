<script lang="ts">
  import { onMount } from 'svelte';
  import {
    loadDiscordDmSetting,
    saveDiscordDmSetting,
  } from '$lib/accounts/notification-settings';

  let enabled = false;
  let busy = true;
  let message = '';

  onMount(() => {
    void loadDiscordDmSetting()
      .then((value) => {
        enabled = value;
      })
      .catch(() => {
        message = 'Could not load notification settings.';
      })
      .finally(() => {
        busy = false;
      });
  });

  async function toggle(event: Event): Promise<void> {
    const requested = (event.currentTarget as HTMLInputElement).checked;
    busy = true;
    message = '';
    try {
      enabled = await saveDiscordDmSetting(requested);
    } catch {
      enabled = !requested;
      message = 'Could not save notification settings. Try again.';
    } finally {
      busy = false;
    }
  }
</script>

<div class="notifications">
  <label>
    <input
      type="checkbox"
      checked={enabled}
      disabled={busy}
      on:change={toggle}
    />
    Discord DM when Socialize or Play is ready
  </label>
  {#if message}<p role="status">{message}</p>{/if}
</div>

<style>
  .notifications {
    margin: 0 0 14px;
  }
  label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 900;
    cursor: pointer;
  }
  input {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--theme-pink);
  }
  p {
    margin: 8px 0 0;
  }
</style>
