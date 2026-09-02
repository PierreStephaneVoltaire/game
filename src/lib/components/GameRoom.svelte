<script lang="ts">
  import { onMount } from 'svelte';
  import { gameViewModel, sendGameIntent } from '$lib/game-session';
  import { daypartFor, type GameIntent } from '$lib/ui/game-view-model';
  import { OPEN_ROOM_INVENTORY_PICKER_EVENT } from '$lib/ui/room-picker-events';
  import CompanionOverview from './CompanionOverview.svelte';
  import InventorySelectionDialog from './InventorySelectionDialog.svelte';
  import RecentEventsPanel from './RecentEventsPanel.svelte';
  import './room.css';
  import './room-scene.css';

  type PickerKind = 'feed' | 'socialize' | 'play' | 'room' | 'room-inventory';

  let errorMessage = '';
  let picker: PickerKind | null = null;
  let roomSlot = '';
  $: model = $gameViewModel;
  $: daypart = model ? daypartFor(model.now, model.timezone) : 'day';
  $: edibleItems = model?.inventory.filter((item) => item.edible) ?? [];
  $: feedChoices = edibleItems.map((item) => ({
    id: item.id,
    itemId: item.id,
    name: item.name,
    image: item.image,
    owned: item.owned,
  }));
  $: careBlocked = Boolean(model?.activity || model?.commandsDisabled);
  $: recentEvents = model?.events.slice(-10) ?? [];
  $: activeCareKind =
    picker === 'socialize' || picker === 'play' ? picker : null;
  $: activeCareChoices =
    activeCareKind && model
      ? [
          {
            id: `default:${activeCareKind}`,
            itemId: '',
            defaultAction: activeCareKind,
            name: 'Default',
            image: model.activeAvatar.assetPath,
            owned: 1,
            detail: `Normal ${activeCareKind}`,
          },
          ...model.careChoices[activeCareKind],
        ]
      : [];
  $: roomAnchor = model?.anchors.find((anchor) => anchor.key === roomSlot);
  $: roomInventoryChoices =
    model?.anchors.flatMap((anchor) =>
      anchor.item ? [] : anchor.placementChoices,
    ) ?? [];

  onMount(() => {
    const open = () => openRoomInventoryPicker();
    window.addEventListener(OPEN_ROOM_INVENTORY_PICKER_EVENT, open);
    return () =>
      window.removeEventListener(OPEN_ROOM_INVENTORY_PICKER_EVENT, open);
  });

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
    picker = 'feed';
  }

  function closePicker() {
    picker = null;
    roomSlot = '';
  }

  function openCarePicker(kind: 'socialize' | 'play') {
    errorMessage = '';
    if (model?.careChoices[kind].length) picker = kind;
    else void act({ type: kind });
  }

  function openRoomPicker(slot: string) {
    errorMessage = '';
    roomSlot = slot;
    picker = 'room';
  }

  function openRoomInventoryPicker() {
    if (careBlocked) return;
    errorMessage = '';
    roomSlot = '';
    picker = 'room-inventory';
  }

  async function feedSelected(selected: Record<string, number>) {
    const items = Object.entries(selected)
      .filter(([, quantity]) => quantity > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }));
    if (!items.length) return;
    await act({ type: 'feed_items', items });
    closePicker();
  }

  async function useCareItem(
    kind: 'socialize' | 'play',
    selected: Record<string, number>,
  ) {
    const choice = activeCareChoices.find(
      (candidate) => (selected[candidate.id] ?? 0) > 0,
    );
    if (!choice) return;
    if (choice.defaultAction) await act({ type: choice.defaultAction });
    else if (choice.actionId)
      await act({
        type: 'item_action',
        itemId: choice.itemId,
        action: choice.actionId,
      });
    closePicker();
  }

  async function placeSelected(selected: Record<string, number>) {
    const choice = roomAnchor?.placementChoices.find(
      (candidate) => (selected[candidate.id] ?? 0) > 0,
    );
    if (!choice || !roomSlot) return;
    await act({ type: 'place_item', itemId: choice.itemId, slot: roomSlot });
    closePicker();
  }

  async function placeFromRoomInventory(selected: Record<string, number>) {
    const choice = roomInventoryChoices.find(
      (candidate) => (selected[candidate.id] ?? 0) > 0,
    );
    if (!choice?.slot) return;
    await act({
      type: 'place_item',
      itemId: choice.itemId,
      slot: choice.slot,
    });
    closePicker();
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
                  decoding="async"
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
                <button
                  type="button"
                  class="anchor-place"
                  on:click={() => openRoomPicker(anchor.key)}
                  disabled={careBlocked}
                  aria-label={`Choose an item for ${anchor.label}`}
                >
                  <span class="anchor-empty" aria-hidden="true">+</span>
                </button>
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
            decoding="async"
          />
        </div>
      </section>

      <RecentEventsPanel events={recentEvents} timezone={model.timezone} />
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
        on:click={() => openCarePicker('socialize')}
        disabled={careBlocked}>Socialize</button
      >
      <button
        type="button"
        on:click={() => openCarePicker('play')}
        disabled={careBlocked}>Play</button
      >
    </section>

    {#if picker === 'feed'}
      <InventorySelectionDialog
        title="Choose something to feed"
        choices={feedChoices}
        confirmLabel="Feed selected"
        emptyMessage="There is nothing edible in the inventory."
        disabled={careBlocked}
        onConfirm={feedSelected}
        onClose={closePicker}
      />
    {:else if activeCareKind}
      <InventorySelectionDialog
        title={`Choose something to ${activeCareKind === 'socialize' ? 'socialize with' : 'play with'}`}
        choices={activeCareChoices}
        confirmLabel="Use selected item"
        emptyMessage="There are no applicable items in the inventory."
        selectionLimit={1}
        disabled={careBlocked}
        onConfirm={(selected) => useCareItem(activeCareKind, selected)}
        onClose={closePicker}
      />
    {:else if picker === 'room'}
      <InventorySelectionDialog
        title={`Choose an item for ${roomAnchor?.label ?? 'this spot'}`}
        choices={roomAnchor?.placementChoices ?? []}
        confirmLabel="Place selected"
        emptyMessage="There are no inventory items that fit this spot."
        selectionLimit={1}
        disabled={careBlocked}
        onConfirm={placeSelected}
        onClose={closePicker}
      />
    {:else if picker === 'room-inventory'}
      <InventorySelectionDialog
        title="Place furniture or an upgrade"
        choices={roomInventoryChoices}
        confirmLabel="Place selected"
        emptyMessage="There are no placeable inventory items for an empty room spot."
        selectionLimit={1}
        disabled={careBlocked}
        onConfirm={placeFromRoomInventory}
        onClose={closePicker}
      />
    {/if}
  </main>
{:else}
  <p class="loading" role="status">Starting…</p>
{/if}
