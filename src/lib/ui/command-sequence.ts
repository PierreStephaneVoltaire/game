/** Monotonic UI command IDs prevent same-tick commands from sharing receipts. */
export class UiCommandSequence {
  private value = 0;

  reset(): void {
    this.value = 0;
  }

  next(): string {
    this.value += 1;
    return `ui-${this.value}`;
  }
}
