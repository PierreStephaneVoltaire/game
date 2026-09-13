import { get } from 'svelte/store';
import { currentAccount } from '../accounts/account-client';
import { GameplayCapture } from './capture';
import { enqueueOperation } from './outbox';
import { flushLogging, setLoggingAccount } from './delivery';

const enabled =
  typeof window !== 'undefined' &&
  import.meta.env.PUBLIC_GAMEPLAY_LOGGING === 'true';

export function browserCapture(): GameplayCapture | undefined {
  if (!enabled) return;
  const owner = get(currentAccount)?.userId;
  if (!owner) return;
  try {
    return new GameplayCapture(
      (operation) => {
        enqueueOperation(owner, operation);
        void flushLogging(
          !operation.checkpoint?.ending &&
            !operation.changes.some((change) => change.path[0] === 'ending'),
        );
      },
      () => get(currentAccount)?.userId === owner,
    );
  } catch {
    console.warn('Gameplay logging could not initialize.');
    return;
  }
}

if (enabled) {
  currentAccount.subscribe((account) =>
    setLoggingAccount(account?.userId ?? null),
  );
  window.setInterval(() => {
    void flushLogging();
  }, 60_000);
  window.addEventListener('online', () => {
    void flushLogging();
  });
}
