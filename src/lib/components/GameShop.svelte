<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { gameViewModel, sendGameIntent } from '$lib/game-session';
  import type { GameIntent } from '$lib/ui/game-view-model';
  import ItemDetail from './ItemDetail.svelte';
  import ShopItemGrid from './ShopItemGrid.svelte';
  import ShoppingCart from './ShoppingCart.svelte';
  import './shop.css';

  type Tab = 'shop' | 'cart' | 'inventory' | 'detail';
  const tabs: Tab[] = ['shop', 'cart', 'inventory', 'detail'];
  $: model = $gameViewModel;
  let tab: Tab = 'shop';
  let selectedId = '';
  let category = 'all';
  let message = '';
  let detailReturn: 'shop' | 'inventory' = 'shop';
  let lastNormalizedUrl = '';
  const numbers = new Intl.NumberFormat('en-US');
  $: selected = model?.catalogue.find((item) => item.id === selectedId) ?? null;
  $: visible =
    model?.shop.filter(
      (item) => category === 'all' || item.category === category,
    ) ?? [];
  $: cartLines =
    model?.cart.map((item) => ({ item, quantity: item.inCart })) ?? [];
  $: blocked = Boolean(model?.activity || model?.death);
  $: terminal = Boolean(model?.death);
  $: if (
    model &&
    typeof window !== 'undefined' &&
    $page.url.toString() !== lastNormalizedUrl
  ) {
    normalizeUrl();
  }

  function normalizeUrl() {
    lastNormalizedUrl = $page.url.toString();
    const params = $page.url.searchParams;
    const rawTab = params.get('tab') as Tab | null;
    const nextTab = rawTab && tabs.includes(rawTab) ? rawTab : 'shop';
    const validCategory =
      params.get('category') === 'all' ||
      Boolean(model?.categories.includes(params.get('category') ?? ''));
    const nextCategory = validCategory
      ? (params.get('category') ?? 'all')
      : 'all';
    const candidate = params.get('item') ?? '';
    const validItem = Boolean(
      model?.catalogue.some((item) => item.id === candidate),
    );
    const nextItem = validItem ? candidate : '';
    tab = nextItem ? 'detail' : nextTab === 'detail' ? 'shop' : nextTab;
    category = nextCategory;
    selectedId = nextItem;
    const canonical = `/game/shop?tab=${tab}${category !== 'all' ? `&category=${encodeURIComponent(category)}` : ''}${selectedId ? `&item=${encodeURIComponent(selectedId)}` : ''}`;
    if (
      typeof window !== 'undefined' &&
      window.location.pathname + window.location.search !== canonical
    )
      void goto(resolve(canonical as `/game/shop?${string}`), {
        replaceState: true,
        keepFocus: true,
      });
  }
  onMount(() => afterNavigate(normalizeUrl));

  function setTab(next: Tab) {
    void goto(resolve(`/game/shop?tab=${next}`));
  }
  function openItem(id: string) {
    detailReturn = tab === 'inventory' ? 'inventory' : 'shop';
    void goto(resolve(`/game/shop?tab=detail&item=${encodeURIComponent(id)}`));
  }
  function closeItem() {
    setTab(detailReturn);
  }
  async function command(intent: GameIntent) {
    try {
      const transition = await sendGameIntent(intent);
      message = transition.message;
      return transition;
    } catch (error) {
      message =
        error instanceof Error
          ? error.message
          : 'That action could not be completed.';
    }
  }
  async function cartQuantity(itemId: string, quantity: number) {
    await command({ type: 'set_cart_quantity', itemId, quantity });
  }
  async function add(itemId: string) {
    await cartQuantity(
      itemId,
      Math.min(
        model?.shop.find((item) => item.id === itemId)?.stock ?? 0,
        (model?.cart.find((item) => item.id === itemId)?.inCart ?? 0) + 1,
      ),
    );
  }
  async function checkout() {
    const transition = await command({ type: 'checkout_cart' });
    if (transition?.kind === 'cart_checked_out') setTab('inventory');
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

<svelte:head
  ><title>Shop · {model?.companion.name ?? 'Companion'}</title></svelte:head
>
{#if model}
  <main class="shop-page">
    <header class="shop-heading">
      <div>
        <p class="eyebrow">ITEMS</p>
        <h1>Shop</h1>
      </div>
      <div class="shop-heading-tools">
        <a class="back-link" href={resolve('/game')} aria-label="Back to room"
          >←</a
        >
        <strong class:debt={model.debt.active} class="balance"
          >{model.debt.active
            ? `Debt: $${numbers.format(model.debt.amount)}`
            : `$${numbers.format(model.balance)}`}</strong
        >
      </div>
    </header>
    {#if model.debt.active}
      <p class="debt-notice" role="status">
        While in debt, essential food, water, and medicine remain available.
        Other purchases are paused.
      </p>
    {/if}
    <div class="tabs" role="tablist" aria-label="Shop sections">
      {#each tabs as option (option)}{#if option !== 'detail' || selected}<button
            role="tab"
            aria-selected={tab === option}
            aria-controls={`${option}-panel`}
            class:active={tab === option}
            on:click={() => setTab(option)}
            >{option === 'detail'
              ? 'Item detail'
              : option[0].toUpperCase() +
                option.slice(1)}{#if option === 'cart'}
              ({cartLines.length}){:else if option === 'inventory'}
              ({model.inventory.length}){/if}</button
          >{/if}{/each}
    </div>
    {#if message}<p class="message" role="status" aria-live="polite">
        {message}
      </p>{/if}
    {#if tab === 'shop'}<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
      <section
        id="shop-panel"
        role="tabpanel"
        tabindex="-1"
        aria-label="Shop items"
      >
        <nav class="categories" aria-label="Shop categories">
          <button
            class:active={category === 'all'}
            on:click={() => goto(resolve('/game/shop?tab=shop&category=all'))}
            >All</button
          >{#each model.categories as option (option)}<button
              class:active={category === option}
              on:click={() =>
                goto(
                  resolve(
                    `/game/shop?tab=shop&category=${encodeURIComponent(option)}`,
                  ),
                )}>{option}</button
            >{/each}
        </nav>
        <ShopItemGrid
          items={visible}
          disabled={terminal}
          onOpen={openItem}
          onAdd={add}
          onQuantity={cartQuantity}
        />
      </section>
    {:else if tab === 'cart'}
      <ShoppingCart
        lines={cartLines}
        total={model.cartTotal}
        checkoutAllowed={model.cartCheckoutAllowed}
        disabled={terminal}
        onQuantity={cartQuantity}
        onCheckout={checkout}
      />
    {:else if tab === 'inventory'}
      <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
      <section
        id="inventory-panel"
        class="inventory"
        role="tabpanel"
        tabindex="-1"
        aria-labelledby="inventory-heading"
      >
        <div>
          <h2 id="inventory-heading">Inventory</h2>
          {#if !model.inventory.length}<p class="empty">
              Nothing is here yet.
            </p>{:else}<div class="inventory-list">
              {#each model.inventory as item (item.id)}<button
                  class:active={selectedId === item.id}
                  on:click={() => openItem(item.id)}
                  ><img src={item.image} alt="" width="56" height="56" /><span
                    >{item.name}</span
                  ><b>×{item.owned}</b></button
                >{/each}
            </div>{/if}
        </div>
      </section>
    {:else if selected}
      <div id="detail-panel" role="tabpanel" aria-label="Item detail">
        <ItemDetail
          item={selected}
          disabled={blocked}
          {message}
          onAction={performItemAction}
          onPlace={place}
          onUnplace={unplace}
          onClose={closeItem}
        />
      </div>
    {/if}
  </main>
{:else}<p class="empty">Starting a fresh run…</p>{/if}
