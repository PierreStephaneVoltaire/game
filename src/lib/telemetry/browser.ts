import { get } from 'svelte/store';
import { currentAccount } from '../accounts/account-client';
import { GameplayCapture } from './capture';
import { enqueueOperation } from './outbox';
import { flushLogging, setLoggingAccount } from './delivery';
import { consoleGameplaySink } from './console';

const enabled =
  typeof window !== 'undefined' &&
  import.meta.env.PUBLIC_GAMEPLAY_LOGGING === 'true';

export function browserCapture(): GameplayCapture | undefined {
  if (typeof window === 'undefined') return;
  const owner = get(currentAccount)?.userId;
  const log = consoleGameplaySink();
  let uploading = false;
  try {
    return new GameplayCapture((operation, state) => {
      log(operation, state);
      if (!enabled || !owner || get(currentAccount)?.userId !== owner) {
        uploading = false;
        return;
      }
      try {
        enqueueOperation(
          owner,
          uploading || operation.checkpoint
            ? operation
            : {
                ...operation,
                checkpoint: structuredClone(state),
              },
        );
        uploading = true;
        void flushLogging(!state.ending);
      } catch {
        uploading = false;
        console.warn('Remote gameplay logging failed.');
      }
    });
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
