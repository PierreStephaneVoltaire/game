<script lang="ts">
  import type { ShopOfferViewModel } from '$lib/ui/game-view-model';
  import QuantityStepper from './QuantityStepper.svelte';

  export let lines: Array<{ item: ShopOfferViewModel; quantity: number }> = [];
  export let total = 0;
  export let resultingBalance = 0;
  export let checkoutAllowed = false;
  export let disabled = false;
  export let onQuantity: (
    itemId: string,
    quantity: number,
  ) => Promise<void> | void;
  export let onCheckout: () => Promise<void> | void;
  const numbers = new Intl.NumberFormat('en-US');
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<section
  id="cart-panel"
  class="cart-panel"
  role="tabpanel"
  tabindex="-1"
  aria-labelledby="cart-heading"
>
  <h2 id="cart-heading">Cart</h2>
  {#if !lines.length}
    <p class="empty">Your cart is empty.</p>
  {:else}
    {#each lines as line (line.item.id)}
      <div class="cart-line">
        {#if line.item.image}<img
            src={line.item.image}
            alt=""
            width="52"
            height="52"
            decoding="async"
          />{:else}<span class="offer-symbol" aria-hidden="true">$</span
          >{/if}<span
          ><strong>{line.item.name}</strong><small
            >${line.item.price} each</small
          ></span
        >
        <QuantityStepper
          value={line.quantity}
          maximum={Math.max(line.item.maximumCartQuantity, line.quantity)}
          label={line.item.name}
          {disabled}
          onChange={(quantity) => onQuantity(line.item.id, quantity)}
        />
        <strong>${numbers.format(line.item.price * line.quantity)}</strong>
      </div>
    {/each}
    <p class="total">
      <span>Total</span><strong>${numbers.format(total)}</strong>
    </p>
    <p class="total">
      <span>Cash after checkout</span><strong
        >${numbers.format(resultingBalance)}</strong
      >
    </p>
    <button
      class="checkout"
      on:click={onCheckout}
      disabled={disabled || !checkoutAllowed}>Checkout</button
    >
  {/if}
</section>
