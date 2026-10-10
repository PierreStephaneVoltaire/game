export class UiCommandSequence {
  next(): string {
    return `ui-${crypto.randomUUID()}`;
  }
}
