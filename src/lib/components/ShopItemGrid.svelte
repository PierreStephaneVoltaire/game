<script lang="ts">
  import type { ItemViewModel } from '$lib/ui/game-view-model';

  export let items: ItemViewModel[] = [];
  export let disabled = false;
  export let onOpen: (itemId: string) => void;
  export let onAdd: (itemId: string) => Promise<void> | void;
  export let onQuantity: (
    itemId: string,
    quantity: number,
  ) => Promise<void> | void;
</script>

<div class="item-grid">
  {#each items as item (item.id)}
    <article class="item-card">
      <button class="item-open" on:click={() => onOpen(item.id)}
        ><img src={item.image} alt={item.name} width="88" height="88" /><span
          ><strong>{item.name}</strong><small>{item.qualitativeHint}</small
          ></span
        ></button
      >
      <div class="item-footer">
        <span>${item.price} · {item.stock} available</span>
        <div class="quantity-stepper" aria-label={`${item.name} quantity`}>
          <button
            type="button"
            aria-label={`Remove one ${item.name}`}
            on:click={() => onQuantity(item.id, item.inCart - 1)}
            disabled={disabled || item.inCart <= 0}>−</button
          ><output aria-live="polite">{item.inCart}</output><button
            type="button"
            aria-label={`Add one ${item.name}`}
            on:click={() => onAdd(item.id)}
            disabled={disabled ||
              !item.stock ||
              !item.purchaseAllowed ||
              item.inCart >= item.maximumCartQuantity}
            title={item.purchaseBlockReason ?? undefined}>+</button
          >
        </div>
      </div>
      {#if item.purchaseBlockReason}
        <small class="purchase-note">{item.purchaseBlockReason}</small>
      {/if}
    </article>
  {/each}
</div>
