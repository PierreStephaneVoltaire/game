<script lang="ts">
  import type { GameViewModel } from '$lib/ui/game-view-model';
  export let statuses: GameViewModel['statuses'] = [];
</script>

<section class="status-panel" aria-labelledby="status-heading">
  <h2 id="status-heading">Status</h2>
  <div aria-live="polite">
    {#if statuses.length === 0}<span class="quiet">No active statuses</span>
    {:else}{#each statuses as status, index (status.key)}{#if index > 0},
        {/if}<span class="status-name">{status.label}</span>{/each}{/if}
  </div>
</section>

<style>
  .status-panel h2 {
    margin: 0 0 8px;
    font-size: 0.9rem;
  }
  .status-panel > div {
    line-height: 1.45;
    min-height: 28px;
  }
  .status-name {
    font-size: 0.72rem;
    text-transform: capitalize;
  }
  .quiet {
    color: #766d7f;
    font-size: 0.78rem;
  }
</style>
