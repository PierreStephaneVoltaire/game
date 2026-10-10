import { nextOutbox } from './outbox';
import { flushGame, type SyncHooks } from './sync';

const pending = new Map<
  string,
  { firstAt: number; timer: ReturnType<typeof setTimeout> }
>();

export function scheduleGameSync(gameHash: string, hooks: SyncHooks): void {
  const existing = pending.get(gameHash);
  if (existing) clearTimeout(existing.timer);
  const firstAt = existing?.firstAt ?? Date.now();
  const delay = Math.max(
    0,
    Math.min(Date.now() + 1000, firstAt + 5000) - Date.now(),
  );
  const timer = setTimeout(async () => {
    pending.delete(gameHash);
    try {
      await flushGame(gameHash, hooks);
      if (!(await nextOutbox(gameHash)) || pending.has(gameHash)) return;
    } catch {
      if (pending.has(gameHash)) return;
    }
    const retry = setTimeout(() => {
      pending.delete(gameHash);
      scheduleGameSync(gameHash, hooks);
    }, 5000);
    pending.set(gameHash, { firstAt: Date.now() + 5000, timer: retry });
  }, delay);
  pending.set(gameHash, { firstAt, timer });
}
