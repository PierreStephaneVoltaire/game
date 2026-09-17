<script lang="ts">
  import { resolve } from '$app/paths';
  import type { GameIntent, GameViewModel } from '$lib/ui/game-view-model';
  import StatusPanel from './StatusPanel.svelte';

  export let model: GameViewModel;
  export let disabled = false;
  export let errorMessage = '';
  export let onIntent: (intent: GameIntent) => Promise<void> | void;

  let hospitalDialog: HTMLDialogElement;
  let advanceTimeDialog: HTMLDialogElement;
  const numbers = new Intl.NumberFormat('en-US');
  $: hospitalAvailable = model.statuses.some(
    (status) => status.key === 'kidney_stone' || status.key === 'sick',
  );

  function activityTime(value: number) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: model.timezone,
      timeStyle: 'short',
    }).format(value);
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
  <section class="metrics" aria-label="Current metrics">
    <h1>{model.companion.name}</h1>
    {#each model.metrics as metric (metric.key)}
      <div class="metric">
        <div class="metric-readout">
          <span>{metric.label}</span><strong
            >{metric.value}/{metric.maximum}</strong
          >
        </div>
        <meter
          min="0"
          max={metric.maximum}
          value={metric.value}
          aria-label={`${metric.label}: ${metric.value} out of ${metric.maximum}`}
          >{metric.value}</meter
        >
      </div>
    {/each}
  </section>

  <div class="status-time-card">
    <StatusPanel statuses={model.statuses} />
    {#if hospitalAvailable}
      <button
        class="secondary-action"
        type="button"
        on:click={() => hospitalDialog.showModal()}
        {disabled}>Hospital</button
      >
    {/if}

    <section class="time-balance" aria-label="Time and balance">
      <div class="session-clock">
        <h2>Time</h2>
        <span>{model.formattedTime}</span>
      </div>
      <strong>Balance: ${numbers.format(model.balance)}</strong>
      <span>Subscribers: {numbers.format(model.followers)}</span>
      {#if model.madeItUnlocked && !model.ending}<strong
          >Ending unlocked: Made It</strong
        >{/if}
      <span><strong>Career:</strong> {model.career.label}</span>
      <span
        ><strong>Streams:</strong>
        {numbers.format(model.streamStats.completed)}</span
      >
      {#if model.career.nextMilestone}
        <span
          >Next milestone: {model.career.nextMilestone.label} · {numbers.format(
            model.career.nextMilestone.remaining,
          )} to go</span
        >
      {:else}
        <span>All career milestones reached</span>
      {/if}
      {#each model.projects as project (project.id)}
        <div class="project-progress">
          <div>
            <span>{project.label}</span><strong
              >{project.progressPercentage}%</strong
            >
          </div>
          <meter
            min="0"
            max="100"
            value={project.progressPercentage}
            aria-label={`${project.label}: ${project.progressPercentage}% complete`}
            >{project.progressPercentage}%</meter
          >
          <small>Due {activityTime(project.endsAt)}</small>
        </div>
      {/each}
      {#if model.activity}
        <p class="activity" role="status">
          {model.companion.name} is {model.activity.label} until
          {activityTime(model.activity.endsAt)}.
        </p>
      {/if}
    </section>
  </div>
  {#if model.mode === 'streaming' && !model.ending}
    <button
      class="advance-time-action"
      type="button"
      on:click={() => advanceTimeDialog.showModal()}
      {disabled}>Advance time</button
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
  class="advance-time-dialog"
  bind:this={advanceTimeDialog}
  aria-labelledby="advance-time-title"
>
  <h2 id="advance-time-title">Advance time</h2>
  <div class="dialog-actions time-options">
    <button type="button" {disabled} on:click={() => advanceTime()}
      >Random</button
    >
    {#each model.waitHours as hours (hours)}
      <button type="button" {disabled} on:click={() => advanceTime(hours)}
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
  .session-clock {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  @media (min-width: 781px) {
    .overview-column {
      display: contents;
    }
    .status-time-card {
      grid-area: 2 / 1 / auto / -1;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      align-items: start;
    }
    .time-balance {
      display: contents;
    }
    .secondary-action {
      justify-self: start;
    }
    .ending-card,
    .command-error {
      grid-column: 1 / -1;
    }
  }
</style>
