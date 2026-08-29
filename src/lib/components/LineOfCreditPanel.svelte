<script lang="ts">
  import type { GameViewModel } from '$lib/ui/game-view-model';

  export let balance: number;
  export let lineOfCredit: GameViewModel['lineOfCredit'];
  export let disabled: boolean;
  export let onOpen: () => void | Promise<void>;
  export let onRepay: (quantity: number) => void | Promise<void>;

  let repaymentQuantity = 1;
  const numbers = new Intl.NumberFormat('en-US');

  async function repay() {
    await onRepay(repaymentQuantity);
    repaymentQuantity = 1;
  }
</script>

{#if lineOfCredit.status === 'available'}
  <section class="debt-notice" aria-label="Line of Credit offer">
    <strong>Line of Credit</strong>
    <p>
      Pay ${numbers.format(lineOfCredit.applicationPrice)} for a ${numbers.format(
        lineOfCredit.cashAdvance,
      )} cash advance. Close it with {lineOfCredit.totalUnits} × ${numbers.format(
        lineOfCredit.repaymentUnitPrice,
      )} repayment units (${numbers.format(lineOfCredit.totalClosureCost)} total).
      Time passing creates no additional charge.
    </p>
    <button type="button" {disabled} on:click={onOpen}
      >Open Line of Credit</button
    >
  </section>
{:else if lineOfCredit.status === 'open'}
  <section class="debt-notice" aria-label="Line of Credit repayment">
    <strong
      >LOC closure cost: ${numbers.format(
        lineOfCredit.remainingClosureCost,
      )}</strong
    >
    <p>
      {lineOfCredit.remainingUnits} repayment units remain. Repayment units cannot
      be bought on credit, and the remaining cost does not change with time.
    </p>
    <label>
      Units
      <input
        type="number"
        min="1"
        max={lineOfCredit.remainingUnits}
        bind:value={repaymentQuantity}
      />
    </label>
    <p>
      Resulting Cash: ${numbers.format(
        balance - repaymentQuantity * lineOfCredit.repaymentUnitPrice,
      )}
    </p>
    <button
      type="button"
      disabled={disabled ||
        repaymentQuantity < 1 ||
        repaymentQuantity > lineOfCredit.remainingUnits ||
        balance < repaymentQuantity * lineOfCredit.repaymentUnitPrice}
      on:click={repay}>Buy repayment units</button
    >
  </section>
{:else}
  <p class="debt-notice">Line of Credit closed.</p>
{/if}
