<script lang="ts">
  import { onMount } from 'svelte';
  import { gameViewModel, sendGameIntent } from '$lib/game-session';
  import type { GameIntent, ShopOfferViewModel } from '$lib/ui/game-view-model';
  import ItemDetail from './ItemDetail.svelte';
  import InventoryBrowser from './InventoryBrowser.svelte';
  import ShopItemGrid from './ShopItemGrid.svelte';
  import ShoppingCart from './ShoppingCart.svelte';
  import './shop.css';
  import './shop-dialog.css';

  export let mode: 'shop' | 'inventory';
  export let onClose: () => void;

  let dialog: HTMLDialogElement;
  const tabs = ['shop', 'cart'] as const;
  $: model = $gameViewModel;
  let tab: 'shop' | 'cart' = 'shop';
  let selectedId = '';
  let category = 'all';
  let message = '';
  let infoOffer: ShopOfferViewModel | null = null;
  let offerDialog: HTMLDialogElement;
  let quantityQueue = Promise.resolve();
  const numbers = new Intl.NumberFormat('en-US');
  $: selected = model?.catalogue.find((item) => item.id === selectedId) ?? null;
  $: visible =
    model?.shop.filter(
      (item) => category === 'all' || item.category === category,
    ) ?? [];
  $: cartLines =
    model?.cart.map((item) => ({ item, quantity: item.inCart })) ?? [];
  $: blocked = Boolean(model?.activity || model?.commandsDisabled);
  $: terminal = Boolean(model?.commandsDisabled);
  function modal(element: HTMLDialogElement) {
    element.showModal();
    return { destroy: () => element.close() };
  }

  onMount(() => {
    dialog.showModal();
    return () => dialog.close();
  });

  function close() {
    dialog.close();
    onClose();
  }
  function closeOffer() {
    offerDialog.close();
    infoOffer = null;
  }
  function openItem(id: string) {
    selectedId = id;
  }
  function closeItem() {
    selectedId = '';
  }
  async function command(intent: GameIntent) {
    try {
      const transition = await sendGameIntent(intent);
      message =
        transition.accepted &&
        (intent.type === 'set_cart_quantity' || intent.type === 'checkout_cart')
          ? ''
          : transition.message;
      return transition;
    } catch (error) {
      message =
        error instanceof Error
          ? error.message
          : 'That action could not be completed.';
    }
  }
  async function cartQuantity(itemId: string, quantity: number) {
    const task = quantityQueue.then(() =>
      command({ type: 'set_cart_quantity', itemId, quantity }),
    );
    quantityQueue = task.then(
      () => undefined,
      () => undefined,
    );
    await task;
  }
  function openOffer(offer: ShopOfferViewModel) {
    if (offer.item) openItem(offer.id);
    else infoOffer = offer;
  }
  async function checkout() {
    await quantityQueue;
    await command({ type: 'checkout_cart' });
  }
  async function performItemAction(itemId: string, action: string) {
    if (blocked) return;
    await command({ type: 'item_action', itemId, action });
  }
  async function place(itemId: string, slot: string) {
    if (blocked) return;
    await command({ type: 'place_item', itemId, slot });
  }
  async function unplace(slot: string) {
    if (blocked) return;
    await command({ type: 'unplace_item', slot });
  }
</script>

<dialog
  bind:this={dialog}
  class="shop-dialog"
  aria-labelledby="shop-dialog-title"
  on:cancel|preventDefault={close}
>
  {#if model}
    <div class="shop-page">
      <header class="shop-heading">
        <div>
          <p class="eyebrow">ITEMS</p>
          <h1 id="shop-dialog-title">
            {mode === 'shop' ? 'Shop' : 'Inventory'}
          </h1>
        </div>
        <div class="shop-heading-tools">
          <button
            class="back-link"
            type="button"
            on:click={close}
            aria-label={`Close ${mode === 'shop' ? 'Shop' : 'Inventory'}`}
            >←</button
          >
          <strong class:debt={model.debt.active} class="balance"
            >Cash: ${numbers.format(model.balance)}</strong
          >
        </div>
      </header>
      {#if model.medicalDebt.total > 0}
        <section class="medical-service" aria-label="Medical payment service">
          <strong>Medical payment</strong>
          <button
            type="button"
            disabled={terminal ||
              model.balance < model.medicalDebt.discountedFullPayment}
            on:click={() => command({ type: 'pay_medical_debt' })}
            >Pay ${numbers.format(
              model.medicalDebt.discountedFullPayment,
            )}</button
          >
        </section>
      {/if}
      {#if mode === 'shop'}
        <div class="tabs" role="tablist" aria-label="Shop sections">
          {#each tabs as option (option)}
            <button
              role="tab"
              aria-selected={tab === option}
              aria-controls={`${option}-panel`}
              class:active={tab === option}
              on:click={() => (tab = option)}
              >{option === 'shop'
                ? 'Shop'
                : `Cart (${cartLines.length})`}</button
            >
          {/each}
        </div>
      {/if}
      {#if message}<p class="shop-toast" role="status" aria-live="polite">
          {message}
        </p>{/if}
      {#if mode === 'inventory'}
        <InventoryBrowser items={model.inventory} onOpen={openItem} />
      {:else if tab === 'shop'}<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
        <section
          id="shop-panel"
          role="tabpanel"
          tabindex="-1"
          aria-label="Shop items"
        >
          <nav class="categories" aria-label="Shop categories">
            <button
              class:active={category === 'all'}
              on:click={() => (category = 'all')}>All</button
            >{#each model.categories as option (option)}<button
                class:active={category === option}
                on:click={() => (category = option)}>{option}</button
              >{/each}
          </nav>
          <ShopItemGrid
            items={visible}
            disabled={terminal}
            onOpen={openOffer}
            onQuantity={cartQuantity}
          />
        </section>
      {:else if tab === 'cart'}
        <ShoppingCart
          lines={cartLines}
          total={model.cartTotal}
          resultingBalance={model.cartResultingBalance}
          checkoutAllowed={model.cartCheckoutAllowed}
          disabled={terminal}
          onQuantity={cartQuantity}
          onCheckout={checkout}
        />
      {/if}
      {#if selected}
        <ItemDetail
          item={selected}
          disabled={blocked}
          {message}
          onAction={performItemAction}
          onPlace={place}
          onUnplace={unplace}
          onClose={closeItem}
        />
      {/if}
      {#if infoOffer}
        <dialog
          bind:this={offerDialog}
          use:modal
          on:cancel|preventDefault={closeOffer}
          class="offer-detail-dialog"
          aria-modal="true"
          aria-labelledby="offer-detail-title"
        >
          <div>
            <button
              type="button"
              class="dialog-close"
              aria-label="Close offer details"
              on:click={closeOffer}>×</button
            >
            <h2 id="offer-detail-title">{infoOffer.name}</h2>
            <p>{infoOffer.description}</p>
          </div>
        </dialog>
      {/if}
    </div>
  {:else}<p class="empty">Starting a fresh run…</p>{/if}
</dialog>
