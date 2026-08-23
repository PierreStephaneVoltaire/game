<script lang="ts">
  import { resolve } from '$app/paths';
  import { gameViewModel, sendGameIntent } from '$lib/game-session';
  import { daypartFor, type GameIntent } from '$lib/ui/game-view-model';
  import StatusPanel from './StatusPanel.svelte';
  import './room.css';
  import './room-scene.css';

  let feedDialog: HTMLDialogElement;
  let errorMessage = '';
  $: model = $gameViewModel;
  $: daypart = model ? daypartFor(model.now, model.timezone) : 'day';
  $: edibleItems = model?.inventory.filter((item) => item.edible) ?? [];
  $: careBlocked = Boolean(model?.activity || model?.death);
  $: latestEvent = model?.events[model.events.length - 1]?.message ?? '';

  async function act(intent: GameIntent) {
    if (careBlocked) return;
    errorMessage = '';
    try {
      await sendGameIntent(intent);
    } catch (error) {
      errorMessage =
        error instanceof Error
          ? error.message
          : 'That action could not be completed.';
    }
  }

  function openFeedDialog() {
    errorMessage = '';
    feedDialog.showModal();
  }

  async function feed(itemId: string) {
    await act({ type: 'item_action', itemId, action: 'consume' });
    feedDialog.close();
  }

  async function unplace(slot: string) {
    if (careBlocked) return;
    await act({ type: 'unplace_item', slot });
  }

  function activityTime(value: number) {
    return model
      ? new Intl.DateTimeFormat('en-US', {
          timeZone: model.timezone,
          timeStyle: 'short',
        }).format(value)
      : '';
  }
</script>

<svelte:head>
  <title>{model ? `${model.companion.name} · Room` : 'Room'}</title>
</svelte:head>

{#if model}
  <main class={`room-page daypart-${daypart}`}>
    <section class="overview-row" data-game-row="overview">
      <aside class="overview-column">
        <section class="metrics" aria-label="Current metrics">
          <h1>{model.companion.name}</h1>
          {#each model.metrics as metric (metric.key)}
            <div class="metric">
              <div>
                <span>{metric.label}</span><strong>{metric.value}/10</strong>
              </div>
              <meter
                min="0"
                max="10"
                value={metric.value}
                aria-label={`${metric.label}: ${metric.value} out of 10`}
                >{metric.value}</meter
              >
            </div>
          {/each}
        </section>

        <StatusPanel statuses={model.statuses} />
        {#if model.statuses.some((status) => status.key === 'kidney_stone' || status.key === 'sick')}
          <button
            class="secondary-action"
            type="button"
            on:click={() => act({ type: 'medical_care' })}
            disabled={careBlocked}>Hospital</button
          >
        {/if}

        <section class="time-balance" aria-label="Time and balance">
          <h2>Time</h2>
          <span>{model.formattedTime}</span>
          <strong>Balance: ${model.balance}</strong>
          {#if model.activity}
            <p class="activity" role="status">
              {model.companion.name} is {model.activity.label} until
              {activityTime(model.activity.endsAt)}.
            </p>
          {/if}
          {#if model.mode === 'streaming' && !model.death}
            <button
              class="secondary-action"
              type="button"
              on:click={() => act({ type: 'wait' })}
              disabled={careBlocked}>Advance time</button
            >
          {/if}
        </section>

        {#if model.death}
          <section class="death-card" role="alert">
            <h2>Run ended</h2>
            <ul>
              {#each model.death.causes as cause (cause.name)}<li>
                  {cause.name}
                </li>{/each}
            </ul>
            <a href={resolve('/game/history')}>View the causal history</a>
          </section>
        {/if}
      </aside>

      <section class="room-card" aria-label={`${model.companion.name}'s room`}>
        <div class="room-scene">
          {#each model.anchors as anchor (anchor.key)}
            <div
              class={`anchor anchor-${anchor.key}`}
              role="group"
              aria-label={anchor.label}
            >
              <span class="anchor-label">{anchor.label}</span>
              {#if anchor.item}
                <img
                  src={anchor.item.image}
                  alt={anchor.item.name}
                  width="64"
                  height="64"
                />
                <button
                  type="button"
                  class="anchor-unplace"
                  on:click={() =>
                    anchor.item?.placedSlot && unplace(anchor.item.placedSlot)}
                  disabled={careBlocked}
                  aria-label={`Unplace ${anchor.item.name}`}>Unplace</button
                >
              {:else}
                <span class="anchor-empty" aria-hidden="true">+</span>
              {/if}
            </div>
          {/each}
          <img
            class="companion"
            src={model.companion.avatar}
            alt={model.companion.name}
            width="176"
            height="176"
          />
        </div>
        <div class="companion-caption" aria-live="polite">
          <span>{errorMessage || latestEvent}</span>
        </div>
      </section>
    </section>

    <section
      class="care-actions"
      data-game-row="care"
      aria-label="Care actions"
    >
      <button
        type="button"
        on:click={openFeedDialog}
        disabled={careBlocked || !edibleItems.length}>Feed</button
      >
      <button
        type="button"
        on:click={() => act({ type: 'rest' })}
        disabled={careBlocked}>Rest</button
      >
      <button
        type="button"
        on:click={() => act({ type: 'socialize' })}
        disabled={careBlocked}>Socialize</button
      >
      <button
        type="button"
        on:click={() => act({ type: 'play' })}
        disabled={careBlocked}>Play</button
      >
    </section>

    <dialog
      class="feed-dialog"
      bind:this={feedDialog}
      aria-labelledby="feed-dialog-title"
    >
      <div class="dialog-heading">
        <h2 id="feed-dialog-title">Choose something to feed</h2>
        <button
          class="dialog-close"
          type="button"
          aria-label="Close feed choices"
          on:click={() => feedDialog.close()}>×</button
        >
      </div>
      {#if edibleItems.length}
        <div class="food-choices">
          {#each edibleItems as item (item.id)}
            <button
              type="button"
              aria-label={`${item.name}, ${item.owned} available`}
              on:click={() => feed(item.id)}
            >
              <img src={item.image} alt="" width="72" height="72" />
              <strong>{item.name}</strong>
              <span>×{item.owned}</span>
              <small>{item.qualitativeHint}</small>
            </button>
          {/each}
        </div>
      {:else}
        <p>There is nothing edible in the inventory.</p>
      {/if}
    </dialog>
  </main>
{:else}
  <p class="loading" role="status">Starting…</p>
{/if}
