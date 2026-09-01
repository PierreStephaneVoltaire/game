<script lang="ts">
  import { currentAccount } from './account-client';
</script>

{#if $currentAccount}
  <div class="account-menu">
    <span>{$currentAccount.username}</span>
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
</style>
