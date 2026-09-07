<script lang="ts">
  import { logoutAccount, currentAccount } from './account-client';

  let busy = false;

  async function signOut(): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      await logoutAccount();
    } finally {
      busy = false;
    }
  }
</script>

{#if $currentAccount}
  <div class="account-menu">
    <span>{$currentAccount.username}</span>
    <button type="button" on:click={signOut} disabled={busy}>Sign out</button>
  </div>
{/if}

<style>
  .account-menu {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--theme-ink);
    font-size: 0.76rem;
    font-weight: 900;
  }

  button {
    min-height: 42px;
    padding: 6px 8px;
    white-space: nowrap;
    border: 3px solid var(--theme-pink);
    color: var(--theme-pink-text);
    background: var(--theme-white);
    box-shadow: 5px 5px 0 var(--theme-gold);
    cursor: pointer;
    font: inherit;
  }
  button:hover:not(:disabled) {
    color: var(--theme-on-pink);
    background: var(--theme-pink);
    box-shadow: 3px 3px 0 var(--theme-gold);
    transform: translate(2px, 2px);
  }
  button:active:not(:disabled) {
    box-shadow: 2px 2px 0 var(--theme-gold);
    transform: translate(3px, 3px);
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
</style>
