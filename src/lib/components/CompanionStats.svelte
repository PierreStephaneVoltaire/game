<script lang="ts">
  import type { GameViewModel } from '$lib/ui/game-view-model';
  import StatusPanel from './StatusPanel.svelte';

  export let model: GameViewModel;
  export let disabled = false;
  export let onHospital: () => void;

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
</script>

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
      on:click={onHospital}
      {disabled}>Hospital</button
    >
  {/if}

  <section class="time-balance" aria-label="Time and balance">
    <div class="session-clock">
      <h2>Time</h2>
      <span>{model.formattedTime}</span>
    </div>
    <div class="detail">
      <strong>Balance</strong>
      <span>${numbers.format(model.balance)}</span>
    </div>
    <div class="detail">
      <strong>Subscribers</strong>
      <span>{numbers.format(model.followers)}</span>
    </div>
    {#if model.madeItUnlocked && !model.ending}<div class="detail">
        <strong>Ending unlocked</strong>
        <span>Made It</span>
      </div>{/if}
    <div class="detail">
      <strong>Career</strong>
      <span>{model.career.label}</span>
    </div>
    <div class="detail">
      <strong>Streams</strong>
      <span>{numbers.format(model.streamStats.completed)}</span>
    </div>
    {#if model.career.nextMilestone}
      <div class="detail">
        <strong>Next milestone</strong>
        <span
          >{model.career.nextMilestone.label} · {numbers.format(
            model.career.nextMilestone.remaining,
          )} to go</span
        >
      </div>
    {:else}
      <div class="detail">
        <strong>Next milestone</strong>
        <span>All career milestones reached</span>
      </div>
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

<style>
  .session-clock {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  @media (min-width: 781px) {
    .status-time-card {
      grid-area: 2 / 1 / auto / -1;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      align-items: start;
    }
    .time-balance {
      display: contents;
    }
    .detail,
    .session-clock {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .detail strong,
    .session-clock h2 {
      margin: 0;
      font-size: 0.9rem;
    }
    .project-progress,
    .activity {
      grid-column: 1 / -1;
    }
    .secondary-action {
      justify-self: start;
    }
  }
</style>
