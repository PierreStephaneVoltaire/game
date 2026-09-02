<script lang="ts">
  import { onMount } from 'svelte';
  import type { InventoryActionChoice } from '$lib/ui/room-action-view-model';

  export let title: string;
  export let choices: InventoryActionChoice[] = [];
  export let confirmLabel: string;
  export let emptyMessage: string;
  export let selectionLimit = Number.POSITIVE_INFINITY;
  export let disabled = false;
  export let onConfirm: (
    selected: Record<string, number>,
  ) => Promise<void> | void;
  export let onClose: () => void;

  let dialog: HTMLDialogElement;
  let selected: Record<string, number> = {};
  let submitting = false;

  $: selectedCount = Object.values(selected).reduce(
    (total, quantity) => total + quantity,
    0,
  );

  onMount(() => dialog.showModal());

  function changeSelection(choice: InventoryActionChoice, delta: number) {
    const current = selected[choice.id] ?? 0;
    const roomRemaining = Math.max(0, selectionLimit - selectedCount + current);
    const maximum = Math.min(choice.owned, roomRemaining);
    selected = {
      ...selected,
      [choice.id]: Math.max(0, Math.min(maximum, current + delta)),
    };
  }

  async function confirm() {
    if (!selectedCount || disabled || submitting) return;
    submitting = true;
    await onConfirm(selected);
    submitting = false;
  }
</script>

<dialog
  class="selection-dialog"
  bind:this={dialog}
  aria-labelledby="inventory-selection-title"
  on:cancel|preventDefault={onClose}
>
  <div class="dialog-heading">
    <h2 id="inventory-selection-title">{title}</h2>
    <button
      class="dialog-close"
      type="button"
      aria-label="Close inventory choices"
      on:click={onClose}>×</button
    >
  </div>
  {#if choices.length}
    <div class="item-choices">
      {#each choices as choice (choice.id)}
        <section
          class="item-choice"
          aria-label={choice.detail
            ? `${choice.name}, ${choice.detail}`
            : `${choice.name}, ${choice.owned} available`}
        >
          <img src={choice.image} alt="" width="72" height="72" />
          <strong>{choice.name}</strong>
          <span>{choice.detail ?? `×${choice.owned}`}</span>
          <div
            class="selection-quantity"
            aria-label={`Quantity of ${choice.name}`}
          >
            <button
              type="button"
              aria-label={`Remove ${choice.name} from selection`}
              on:click={() => changeSelection(choice, -1)}
              disabled={(selected[choice.id] ?? 0) === 0}>−</button
            >
            <output aria-label={`${choice.name} selected`}
              >{selected[choice.id] ?? 0}</output
            >
            <button
              type="button"
              aria-label={`Add ${choice.name} to selection`}
              on:click={() => changeSelection(choice, 1)}
              disabled={selectedCount >= selectionLimit ||
                (selected[choice.id] ?? 0) >= choice.owned}>+</button
            >
          </div>
        </section>
      {/each}
    </div>
    <div class="dialog-actions">
      <button type="button" class="secondary" on:click={onClose}>Cancel</button>
      <button
        type="button"
        on:click={confirm}
        disabled={selectedCount === 0 || disabled || submitting}
        >{confirmLabel} ({selectedCount})</button
      >
    </div>
  {:else}
    <p>{emptyMessage}</p>
    <div class="dialog-actions">
      <button type="button" class="secondary" on:click={onClose}>Close</button>
    </div>
  {/if}
</dialog>

<style>
  .selection-dialog {
    width: min(720px, calc(100% - 32px));
    max-height: calc(100vh - 48px);
    margin: auto;
    border: 4px solid #512b9a;
    padding: clamp(18px, 4vw, 30px);
    color: #32254b;
    background: #fffdf9;
    box-shadow: 8px 8px 0 #f3a15f;
  }
  .selection-dialog::backdrop {
    background: #27163db3;
  }
  .dialog-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
  }
  .dialog-heading h2 {
    margin: 0 0 22px;
    color: #512b9a;
  }
  .dialog-close {
    border: 0;
    color: #512b9a;
    background: transparent;
    font-size: 1.8rem;
    cursor: pointer;
  }
  .item-choices {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
    gap: 16px;
  }
  .item-choice {
    display: grid;
    gap: 5px;
    min-height: 54px;
    padding: 11px;
    border: 3px solid #512b9a;
    background: #fff;
    box-shadow: 5px 5px 0 #f3a15f;
    place-items: center;
  }
  .item-choice img {
    image-rendering: pixelated;
  }
  .item-choice span {
    color: #766d7f;
  }
  .selection-quantity {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .selection-quantity button {
    display: grid;
    width: 34px;
    min-height: 34px;
    padding: 0;
    border: 3px solid #512b9a;
    color: #512b9a;
    background: #fff;
    box-shadow: 5px 5px 0 #f3a15f;
    font: inherit;
    font-weight: 900;
    cursor: pointer;
    place-items: center;
  }
  .selection-quantity output {
    min-width: 1.5rem;
    text-align: center;
    font-weight: 800;
  }
  .dialog-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 24px;
  }
  .dialog-actions button {
    min-height: 40px;
    padding: 8px 12px;
    border: 2px solid #512b9a;
    color: #fff;
    background: #512b9a;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }
  .dialog-actions button.secondary {
    color: #512b9a;
    background: #fff;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
  button:focus-visible {
    outline: 3px solid #f3a15f;
    outline-offset: 3px;
  }
</style>
