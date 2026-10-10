<script lang="ts">
  import { resolve } from '$app/paths';
  import type { GameIntent, GameViewModel } from '$lib/ui/game-view-model';
  import CompanionStats from './CompanionStats.svelte';

  export let model: GameViewModel;
  export let disabled = false;
  export let errorMessage = '';
  export let onIntent: (intent: GameIntent) => Promise<void> | void;

  let hospitalDialog: HTMLDialogElement;
  let advanceTimeDialog: HTMLDialogElement;
  let statsDialog: HTMLDialogElement;
  let statsOpen = false;
  const numbers = new Intl.NumberFormat('en-US');
  function openStats() {
    statsOpen = true;
    statsDialog.showModal();
  }

  function openHospital() {
    hospitalDialog.showModal();
  }

  async function confirmHospital() {
    hospitalDialog.close();
    await onIntent({ type: 'medical_care' });
  }

  async function advanceTime(hours?: number) {
    advanceTimeDialog.close();
    await onIntent(
      hours === undefined ? { type: 'wait' } : { type: 'wait', hours },
    );
  }
</script>

<aside class="overview-column">
  <CompanionStats {model} {disabled} onHospital={openHospital} />
  <button class="stats-action" type="button" on:click={openStats}>Stats</button>
  {#if model.mode === 'streaming' && !model.ending}
    <button
      class="advance-time-action"
      type="button"
      on:click={() => advanceTimeDialog.showModal()}
      disabled={model.commandsDisabled}>Advance time</button
    >
  {/if}
  {#if model.ending}
    <section class="ending-card" role="alert">
      <h2>{model.ending.title}</h2>
      <p>{model.ending.explanation}</p>
      {#if model.ending.kind === 'death'}
        <ul>
          {#each model.ending.causes as cause (cause.name)}<li>
              {cause.name}
            </li>{/each}
        </ul>
      {/if}
      <a href={resolve('/game/history')}>View the causal history</a>
    </section>
  {/if}
  {#if errorMessage}
    <p class="command-error" role="alert">{errorMessage}</p>
  {/if}
</aside>

<dialog
  class="stats-dialog"
  bind:this={statsDialog}
  aria-label="Stats"
  on:close={() => (statsOpen = false)}
>
  <button
    type="button"
    class="stats-close"
    aria-label="Close stats"
    on:click={() => statsDialog.close()}>←</button
  >
  {#if statsOpen}
    <CompanionStats {model} {disabled} onHospital={openHospital} />
  {/if}
</dialog>

<dialog
  class="advance-time-dialog"
  bind:this={advanceTimeDialog}
  aria-labelledby="advance-time-title"
>
  <h2 id="advance-time-title">Advance time</h2>
  <div class="dialog-actions time-options">
    <button
      type="button"
      disabled={model.commandsDisabled}
      on:click={() => advanceTime()}>Random</button
    >
    {#each model.waitHours as hours (hours)}
      <button
        type="button"
        disabled={model.commandsDisabled}
        on:click={() => advanceTime(hours)}
        >{hours} {hours === 1 ? 'hour' : 'hours'}</button
      >
    {/each}
    <button type="button" on:click={() => advanceTimeDialog.close()}
      >Cancel</button
    >
  </div>
</dialog>

<dialog
  class="hospital-dialog"
  bind:this={hospitalDialog}
  aria-labelledby="hospital-dialog-title"
>
  <h2 id="hospital-dialog-title">Confirm hospital visit</h2>
  <p>This visit lasts {model.hospital.durationHours} game-hours.</p>
  <p>
    Payment-plan principal: <strong
      >${numbers.format(model.hospital.cost)}</strong
    >
    ({model.hospital.insured ? 'insured' : 'uninsured'})
  </p>
  {#if model.hospital.consumedItemName}
    <p>Your {model.hospital.consumedItemName} will be consumed.</p>
  {:else}
    <p>No insurance card will be used.</p>
  {/if}
  <div class="dialog-actions">
    <button
      type="button"
      class="secondary"
      on:click={() => hospitalDialog.close()}>Cancel</button
    >
    <button type="button" on:click={confirmHospital}>Confirm visit</button>
  </div>
</dialog>

<style>
  .time-options {
    flex-direction: column;
  }
  @media (min-width: 781px) {
    .overview-column {
      display: contents;
    }
    .ending-card,
    .command-error {
      grid-column: 1 / -1;
    }
  }
</style>
