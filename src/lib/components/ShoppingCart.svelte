<script lang="ts">
  import type { ItemViewModel } from '$lib/ui/game-view-model';

  export let lines: Array<{ item: ItemViewModel; quantity: number }> = [];
  export let total = 0;
  export let checkoutAllowed = false;
  export let disabled = false;
  export let onQuantity: (
    itemId: string,
    quantity: number,
  ) => Promise<void> | void;
  export let onCheckout: () => Promise<void> | void;
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
        <img src={line.item.image} alt="" width="52" height="52" /><span
          ><strong>{line.item.name}</strong><small
            >${line.item.price} each</small
          ></span
        >
        <div>
          <button
            aria-label={`Remove one ${line.item.name}`}
            on:click={() => onQuantity(line.item.id, line.quantity - 1)}
            {disabled}>−</button
          ><output>{line.quantity}</output><button
            aria-label={`Add one ${line.item.name}`}
            on:click={() => onQuantity(line.item.id, line.quantity + 1)}
            disabled={disabled ||
              !line.item.purchaseAllowed ||
              line.quantity >= line.item.maximumCartQuantity}>+</button
          >
        </div>
        <strong>${line.item.price * line.quantity}</strong>
      </div>
    {/each}
    <p class="total"><span>Total</span><strong>${total}</strong></p>
    <button
      class="checkout"
      on:click={onCheckout}
      disabled={disabled || !checkoutAllowed}>Checkout</button
    >
  {/if}
</section>
