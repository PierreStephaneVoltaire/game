<script lang="ts">
  import { roomLook, swappableSlots } from '$lib/ui/room-look';
</script>

<div class="room-look">
  {#each swappableSlots as [slot, variants] (slot)}
    <label>
      {slot.replaceAll('-', ' ')}
      <select bind:value={$roomLook.variants[slot]}>
        {#each variants as variant (variant)}
          <option value={variant}>{variant}</option>
        {/each}
      </select>
    </label>
  {/each}
</div>

<style>
  .room-look {
    display: grid;
    gap: 8px;
    max-height: 40vh;
    margin-bottom: 12px;
    overflow-y: auto;
  }
  label {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    text-transform: capitalize;
  }
  select {
    min-width: 0;
    border: 2px solid var(--theme-ink);
    color: var(--theme-ink);
    background: var(--theme-white);
    font: inherit;
  }
</style>
