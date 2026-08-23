<script lang="ts">
  import type { GameViewModel } from '$lib/ui/game-view-model';
  export let statuses: GameViewModel['statuses'] = [];
  export let effects: GameViewModel['effects'] = [];
  export let timezone = 'UTC';

  const effectTime = (value: number) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeStyle: 'short',
    }).format(value);
</script>

<section class="status-panel" aria-labelledby="status-heading">
  <h2 id="status-heading">Status</h2>
  <div aria-live="polite">
    {#if statuses.length === 0}<span class="quiet">No active statuses</span>
    {:else}{#each statuses as status, index (status.key)}{#if index > 0},
        {/if}<span class="status-name">{status.label}</span>{/each}{/if}
  </div>
  {#if effects.length}
    <div class="timed-effects" aria-label="Active timed effects">
      {#each effects as effect (effect.key)}
        <span class="effect-name"
          >{effect.label} until {effectTime(effect.endsAt)}</span
        >
      {/each}
    </div>
  {/if}
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
  .timed-effects {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 8px;
  }
  .effect-name {
    padding: 4px 7px;
    color: #512b9a;
    background: #f1e8ff;
    font-size: 0.7rem;
    font-weight: 800;
  }
</style>
