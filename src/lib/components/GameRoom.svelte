<script lang="ts">
  import { gameViewModel, sendGameIntent } from '$lib/game-session';
  import { daypartFor, type GameIntent } from '$lib/ui/game-view-model';
  import CompanionOverview from './CompanionOverview.svelte';
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
</script>

<svelte:head>
  <title>{model ? `${model.companion.name} · Room` : 'Room'}</title>
</svelte:head>

{#if model}
  <main class={`room-page daypart-${daypart}`}>
    <section class="overview-row" data-game-row="overview">
      <CompanionOverview
        {model}
        disabled={careBlocked}
        {errorMessage}
        onIntent={act}
      />

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
            src={model.activeAvatar.assetPath}
            alt={model.companion.name}
            data-appearance-id={model.activeAvatar.id}
            width="176"
            height="176"
          />
        </div>
        <div class="companion-caption" aria-live="polite">
          <span>{latestEvent}</span>
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
