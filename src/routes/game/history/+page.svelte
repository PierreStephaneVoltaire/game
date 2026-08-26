<script lang="ts">
  import { gameViewModel } from '$lib/game-session';
  import {
    graveyardExportFilename,
    graveyardExportMarkdown,
  } from '$lib/ui/graveyard-export';
  $: model = $gameViewModel;
  const dateTime = (at: number, timezone: string) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(at);
  const duration = (start: number, end: number) => {
    const totalHours = Math.floor((end - start) / 3_600_000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return `${days}d ${hours}h`;
  };

  function exportGraveyard() {
    if (!model?.death) return;
    const url = URL.createObjectURL(
      new Blob([graveyardExportMarkdown(model)], {
        type: 'text/markdown;charset=utf-8',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = graveyardExportFilename(model);
    link.click();
    URL.revokeObjectURL(url);
  }
</script>

<svelte:head><title>History · Companion</title></svelte:head>

{#if model}
  <main class="history-page">
    <div class="history-heading">
      <div>
        <p class="eyebrow">SESSION RECORD</p>
        <h1>{model.companion.name}'s History</h1>
      </div>
    </div>
    {#if model.death}
      <section class="death-card" role="alert">
        <p class="eyebrow">TERMINAL RUN</p>
        <h2>Cause of death</h2>
        <ul class="death-causes">
          {#each model.death.causes as cause (cause.name)}<li>
              {cause.name}
            </li>{/each}
        </ul>
        <h3>Causal chain</h3>
        <ol>
          {#each model.causalEvents as event (event.id)}<li>
              <span>{event.message}</span>
            </li>{/each}
        </ol>
        <div class="graveyard">
          <span aria-hidden="true">✦</span><strong>Graveyard</strong>
          <p>This run is complete. Its record remains available for review.</p>
          <dl>
            <div>
              <dt>Started</dt>
              <dd>{dateTime(model.runStartedAt, model.timezone)}</dd>
            </div>
            <div>
              <dt>Ended</dt>
              <dd>{dateTime(model.death.at, model.timezone)}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{duration(model.runStartedAt, model.death.at)}</dd>
            </div>
          </dl>
          <button type="button" on:click={exportGraveyard}
            >Export journey and grave</button
          >
        </div>
      </section>
    {/if}
    <details class="event-log" open={!model.death}>
      <summary>{model.companion.name}'s journey</summary>
      <ol>
        {#each model.events as event (event.id)}<li>
            <time datetime={new Date(event.at).toISOString()}
              >{new Intl.DateTimeFormat('en-US', {
                timeZone: model.timezone,
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(event.at)}</time
            ><span>{event.message}</span>
          </li>{/each}
      </ol>
    </details>
  </main>
{:else}<p class="empty">No active run.</p>{/if}

<style>
  .history-page {
    max-width: 980px;
    margin: auto;
  }
  .history-heading {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 16px;
    margin: 40px 0 28px;
  }
  .eyebrow {
    margin: 0;
    color: #8d386e;
    font-size: 0.65rem;
    font-weight: 900;
    letter-spacing: 0.12em;
  }
  .history-heading h1 {
    margin: 5px 0 0;
    color: #512b9a;
    font-size: clamp(2.4rem, 6vw, 4.3rem);
    letter-spacing: -0.07em;
  }
  .death-card {
    margin-bottom: 24px;
    padding: clamp(20px, 4vw, 34px);
    border: 3px solid #512b9a;
    background: #ffe0e8;
  }
  .death-card h2 {
    margin: 4px 0 7px;
    color: #512b9a;
    font-size: 2rem;
  }
  .death-card h3 {
    margin: 22px 0 8px;
  }
  .death-card ol {
    margin: 0;
    padding-left: 22px;
  }
  .death-card li {
    padding: 4px 0;
  }
  .death-causes {
    margin: 8px 0 0;
    padding-left: 22px;
  }
  .graveyard {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 5px 12px;
    margin-top: 25px;
    padding: 16px;
    background: #eadff0;
  }
  .graveyard span {
    grid-row: span 2;
    font-size: 1.8rem;
  }
  .graveyard p {
    grid-column: 2;
    margin: 0;
    color: #766d7f;
    font-size: 0.8rem;
  }
  .graveyard dl {
    grid-column: 2;
    margin: 4px 0;
    font-size: 0.78rem;
  }
  .graveyard dl div {
    display: grid;
    grid-template-columns: 70px 1fr;
    gap: 8px;
  }
  .graveyard dt {
    font-weight: 900;
  }
  .graveyard dd {
    margin: 0;
  }
  .graveyard button {
    grid-column: 2;
    justify-self: start;
    margin-top: 9px;
    padding: 9px 13px;
    border: 2px solid #512b9a;
    color: #512b9a;
    background: #fff;
    box-shadow: 3px 3px 0 #f3a15f;
    font: inherit;
    font-size: 0.75rem;
    font-weight: 900;
    cursor: pointer;
  }
  .graveyard button:hover {
    color: #fff;
    background: #512b9a;
  }
  .event-log {
    border-top: 3px solid #512b9a;
  }
  .event-log summary {
    padding: 17px 0;
    color: #512b9a;
    font-weight: 900;
    cursor: pointer;
  }
  .event-log ol {
    max-height: min(70vh, 720px);
    overflow: auto;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .event-log li {
    display: grid;
    grid-template-columns: 190px 1fr;
    gap: 18px;
    padding: 12px 0;
    border-bottom: 1px solid #eadff0;
  }
  .event-log time {
    color: #766d7f;
    font-size: 0.75rem;
  }
  .event-log span {
    font-size: 0.82rem;
  }
  .empty {
    padding: 42px;
    text-align: center;
    color: #766d7f;
  }
  @media (max-width: 600px) {
    .history-heading {
      align-items: start;
      flex-direction: column;
    }
    .event-log li {
      grid-template-columns: 1fr;
      gap: 5px;
    }
  }
</style>
