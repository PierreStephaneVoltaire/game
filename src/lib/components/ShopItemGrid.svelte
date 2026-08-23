<script lang="ts">
  import type { ItemViewModel } from '$lib/ui/game-view-model';

  export let items: ItemViewModel[] = [];
  export let disabled = false;
  export let onOpen: (itemId: string) => void;
  export let onAdd: (itemId: string) => Promise<void> | void;
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
        <span>${item.price} · {item.stock} available</span><button
          on:click={() => onAdd(item.id)}
          disabled={disabled ||
            !item.stock ||
            !item.purchaseAllowed ||
            item.inCart >= item.maximumCartQuantity}
          title={item.purchaseBlockReason ?? undefined}>Add</button
        >
      </div>
      {#if item.purchaseBlockReason}
        <small class="purchase-note">{item.purchaseBlockReason}</small>
      {/if}
    </article>
  {/each}
</div>
