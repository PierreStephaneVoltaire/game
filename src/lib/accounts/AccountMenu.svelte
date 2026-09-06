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
    color: #512b9a;
    font-size: 0.76rem;
    font-weight: 900;
  }

  button {
    border: 0;
    color: inherit;
    background: transparent;
    cursor: pointer;
    font: inherit;
    text-decoration: underline;
  }
</style>
