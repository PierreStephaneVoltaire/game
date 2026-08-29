<script lang="ts">
  import { onMount } from 'svelte';
  import type { ItemViewModel } from '$lib/ui/game-view-model';
  import { gameCopy } from '$lib/ui/game-copy';
  export let item: ItemViewModel;
  export let disabled = false;
  export let message = '';
  export let onAction: (itemId: string, action: string) => void;
  export let onPlace: (itemId: string, slot: string) => void;
  export let onUnplace: (slot: string) => void;
  export let onClose: () => void;
  let dialog: HTMLDialogElement;
  const anchorLabel = (value: string) =>
    gameCopy.anchors[value as keyof typeof gameCopy.anchors];
  const tagLabel = (value: string) =>
    value
      .replaceAll(/[-_]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  onMount(() => dialog.showModal());
</script>

<dialog
  bind:this={dialog}
  class="detail-dialog"
  aria-labelledby="item-detail-title"
  on:cancel|preventDefault={onClose}
>
  <article class="detail">
    <button
      class="close"
      type="button"
      aria-label="Close item details"
      on:click={onClose}>×</button
    >
    <img src={item.image} alt={item.name} width="144" height="144" />
    <p class="eyebrow">ITEM DETAIL</p>
    <h2 id="item-detail-title">{item.name}</h2>
    <p>{item.description}</p>
    <p class="hint">{item.qualitativeHint}</p>
    <p>Owned: ×{item.owned} · {item.category}</p>
    {#if item.tags.length}<ul class="tags" aria-label="Item tags">
        {#each item.tags as tag (tag)}<li>{tagLabel(tag)}</li>{/each}
      </ul>{/if}
    {#if message}<p class="outcome" role="status" aria-live="polite">
        {message}
      </p>{/if}
    {#if item.itemActions?.length}<div
        class="actions"
        aria-label="Item actions"
      >
        <h3>Actions</h3>
        {#each item.itemActions as action (action.id)}<button
            type="button"
            on:click={() => onAction(item.id, action.id)}
            disabled={disabled || !action.available}>{action.label}</button
          >{/each}
      </div>{/if}
    {#if item.placedSlot}<div class="placement active-placement">
        <strong>Placed in {anchorLabel(item.placedSlot)}</strong>
        <small>Placement remains active while the item is here.</small><button
          type="button"
          class="secondary"
          on:click={() => onUnplace(item.placedSlot!)}
          {disabled}>Unplace</button
        >
      </div>{:else if item.roomSlot && item.owned > 0}<div class="placement">
        <strong>Room anchor: {anchorLabel(item.roomSlot)}</strong>
        <button
          type="button"
          on:click={() => onPlace(item.id, item.roomSlot!)}
          {disabled}>Place item</button
        ><small>Place this item in its room spot.</small>
      </div>{/if}
  </article>
</dialog>

<style>
  .detail-dialog {
    width: min(560px, calc(100% - 32px));
    max-height: calc(100vh - 40px);
    margin: auto;
    border: 4px solid #512b9a;
    padding: 0;
    background: #c9f4ee;
    box-shadow: 8px 8px 0 #f3a15f;
  }
  .detail-dialog::backdrop {
    background: #27163db3;
  }
  .detail {
    position: relative;
    padding: 22px;
    background: #c9f4ee;
    text-align: center;
  }
  .detail img {
    image-rendering: pixelated;
  }
  .eyebrow {
    margin: 8px 0 0;
    color: #8d386e;
    font-size: 0.65rem;
    font-weight: 900;
    letter-spacing: 0.1em;
  }
  h2 {
    margin: 4px 0 8px;
    color: #512b9a;
  }
  h3 {
    margin: 16px 0 6px;
    font-size: 0.9rem;
  }
  .detail p {
    color: #56466b;
    font-size: 0.8rem;
    line-height: 1.5;
  }
  .hint {
    font-style: italic;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    margin: 10px 0;
    padding: 0;
    list-style: none;
  }
  .tags li {
    padding: 4px 8px;
    border: 1px solid #8d386e;
    border-radius: 999px;
    color: #8d386e;
    background: #fff;
    font-size: 0.68rem;
    font-weight: 800;
  }
  .actions,
  .placement {
    display: grid;
    gap: 7px;
    margin-top: 14px;
  }
  button {
    min-height: 40px;
    padding: 9px 13px;
    border: 2px solid #512b9a;
    background: #512b9a;
    color: #fff;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
  button.secondary {
    background: #fff;
    color: #512b9a;
  }
  button.close {
    position: absolute;
    top: 12px;
    right: 12px;
    min-width: 38px;
    padding: 4px;
    color: #512b9a;
    background: #fff;
    box-shadow: 3px 3px 0 #f3a15f;
    font-size: 1.4rem;
  }
  .outcome {
    padding: 9px;
    color: #512b9a;
    background: #fff;
  }
  small {
    color: #56466b;
    font-size: 0.7rem;
  }
  button:focus-visible {
    outline: 3px solid #f3a15f;
    outline-offset: 3px;
  }
</style>
