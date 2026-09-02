<script lang="ts">
  import type { ShopOfferViewModel } from '$lib/ui/game-view-model';
  import QuantityStepper from './QuantityStepper.svelte';

  export let items: ShopOfferViewModel[] = [];
  export let disabled = false;
  export let onOpen: (offer: ShopOfferViewModel) => void;
  export let onQuantity: (
    itemId: string,
    quantity: number,
  ) => Promise<void> | void;
</script>

<div class="item-grid">
  {#each items as item (item.id)}
    <article class="item-card">
      <div class="item-body">
        {#if item.image}<img
            src={item.image}
            alt=""
            width="88"
            height="88"
            decoding="async"
          />{:else}<span class="offer-symbol" aria-hidden="true">$</span>{/if}
        <div class="item-summary">
          <strong>{item.name}</strong>
          {#if item.kind === 'catalogue_item'}
            <p>{item.description}</p>
          {/if}
        </div>
      </div>
      <button
        class="item-info"
        type="button"
        aria-label={`View details for ${item.name}`}
        on:click={() => onOpen(item)}>Info</button
      >
      <div class="item-footer">
        <span>${item.price} · {item.availabilityLabel}</span>
        <QuantityStepper
          value={item.inCart}
          maximum={item.maximumCartQuantity}
          label={item.name}
          disabled={disabled || !item.purchaseAllowed}
          onChange={(quantity) => onQuantity(item.id, quantity)}
        />
      </div>
    </article>
  {/each}
</div>
