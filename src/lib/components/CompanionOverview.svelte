<script lang="ts">
  import { resolve } from '$app/paths';
  import type { GameIntent, GameViewModel } from '$lib/ui/game-view-model';
  import StatusPanel from './StatusPanel.svelte';

  export let model: GameViewModel;
  export let disabled = false;
  export let errorMessage = '';
  export let onIntent: (intent: GameIntent) => Promise<void> | void;

  let hospitalDialog: HTMLDialogElement;
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
</script>

<aside class="overview-column">
  <section class="metrics" aria-label="Current metrics">
    <h1>{model.companion.name}</h1>
    {#each model.metrics as metric (metric.key)}
      <div class="metric">
        <div>
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
    <h2>Time</h2>
    <span>{model.formattedTime}</span>
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
    {#if model.mode === 'streaming' && !model.ending}
      <button
        class="secondary-action"
        type="button"
        on:click={() => onIntent({ type: 'wait' })}
        {disabled}>Advance time</button
      >
    {/if}
  </section>

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
