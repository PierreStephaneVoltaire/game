<script lang="ts">
  import type { ItemViewModel } from '$lib/ui/game-view-model';

  export let items: ItemViewModel[] = [];
  export let onOpen: (itemId: string) => void;

  const pageSize = 24;
  let category = 'all';
  let searchQuery = '';
  let page = 1;

  $: categories = [...new Set(items.map((item) => item.category))].sort();
  $: normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  $: filteredItems = items.filter(
    (item) =>
      (category === 'all' || item.category === category) &&
      (!normalizedQuery ||
        `${item.name} ${item.category} ${item.tags.join(' ')}`
          .toLocaleLowerCase()
          .includes(normalizedQuery)),
  );
  $: pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  $: if (page > pageCount) page = pageCount;
  $: firstResult = (page - 1) * pageSize;
  $: visibleItems = filteredItems.slice(firstResult, firstResult + pageSize);

  function selectCategory(nextCategory: string) {
    category = nextCategory;
    page = 1;
  }

  function search() {
    page = 1;
  }
</script>

<section class="inventory-browser" aria-labelledby="inventory-heading">
  <div class="inventory-heading">
    <div>
      <h2 id="inventory-heading">Inventory</h2>
      <p>{items.length} kinds owned</p>
    </div>
    <label class="inventory-search">
      <span>Search inventory</span>
      <input bind:value={searchQuery} on:input={search} type="search" />
    </label>
  </div>

  {#if !items.length}
    <p class="empty">Nothing is here yet.</p>
  {:else}
    <nav class="inventory-categories" aria-label="Inventory categories">
      <button
        type="button"
        class:active={category === 'all'}
        aria-pressed={category === 'all'}
        on:click={() => selectCategory('all')}>All</button
      >
      {#each categories as option (option)}
        <button
          type="button"
          class:active={category === option}
          aria-pressed={category === option}
          on:click={() => selectCategory(option)}>{option}</button
        >
      {/each}
    </nav>

    {#if visibleItems.length}
      <div class="inventory-grid" aria-label="Owned items">
        {#each visibleItems as item (item.id)}
          <button
            type="button"
            class="inventory-card"
            on:click={() => onOpen(item.id)}
            aria-label={`View ${item.name}, ${item.owned} owned`}
          >
            <img
              src={item.image}
              alt=""
              width="56"
              height="56"
              decoding="async"
            />
            <span class="inventory-card-copy">
              <strong>{item.name}</strong>
              <small>{item.category}</small>
            </span>
            <b>×{item.owned}</b>
          </button>
        {/each}
      </div>
    {:else}
      <p class="empty">No owned items match that filter.</p>
    {/if}

    {#if pageCount > 1}
      <nav class="inventory-pagination" aria-label="Inventory pages">
        <button type="button" on:click={() => (page -= 1)} disabled={page === 1}
          >Previous</button
        >
        <span>Page {page} of {pageCount}</span>
        <button
          type="button"
          on:click={() => (page += 1)}
          disabled={page === pageCount}>Next</button
        >
      </nav>
    {/if}
  {/if}
</section>

<style>
  .inventory-browser {
    min-width: 0;
    padding-top: 22px;
  }
  .inventory-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 16px;
  }
  h2 {
    margin: 0;
    color: #512b9a;
  }
  .inventory-heading p {
    margin: 5px 0 0;
    color: #766d7f;
    font-size: 0.75rem;
  }
  .inventory-search {
    display: grid;
    gap: 4px;
    color: #512b9a;
    font-size: 0.7rem;
    font-weight: 800;
  }
  .inventory-search input {
    min-width: min(240px, 45vw);
    padding: 8px 10px;
    border: 2px solid #512b9a;
    border-radius: 0;
    color: #27163d;
    font: inherit;
  }
  .inventory-categories,
  .inventory-pagination {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 7px;
    margin: 16px 0;
  }
  .inventory-categories button,
  .inventory-pagination button {
    padding: 7px 10px;
    border: 2px solid #512b9a;
    color: #512b9a;
    background: #fff;
    font: inherit;
    font-size: 0.72rem;
    font-weight: 800;
    cursor: pointer;
  }
  .inventory-categories button.active {
    background: #ffdaea;
    box-shadow: inset 0 -3px #512b9a;
  }
  .inventory-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
    gap: 10px;
  }
  .inventory-card {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr) auto;
    gap: 9px;
    align-items: center;
    min-width: 0;
    padding: 8px;
    border: 2px solid #c6b9d2;
    color: #512b9a;
    background: #fff;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .inventory-card:hover {
    border-color: #512b9a;
    box-shadow: 3px 3px #f3a15f;
  }
  .inventory-card img {
    image-rendering: pixelated;
  }
  .inventory-card-copy {
    min-width: 0;
  }
  .inventory-card strong,
  .inventory-card small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .inventory-card strong {
    font-size: 0.78rem;
  }
  .inventory-card small {
    margin-top: 3px;
    color: #766d7f;
    font-size: 0.65rem;
  }
  .inventory-card b {
    font-size: 0.78rem;
  }
  .inventory-pagination {
    justify-content: center;
  }
  .inventory-pagination span {
    color: #766d7f;
    font-size: 0.75rem;
    font-weight: 800;
  }
  .empty {
    padding: 42px;
    color: #766d7f;
    text-align: center;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }
  button:focus-visible,
  input:focus-visible {
    outline: 3px solid #f3a15f;
    outline-offset: 3px;
  }
  @media (max-width: 650px) {
    .inventory-heading {
      align-items: stretch;
      flex-direction: column;
    }
    .inventory-search input {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }
    .inventory-grid {
      grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
    }
  }
</style>
