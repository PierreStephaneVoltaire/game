import { derived, writable } from 'svelte/store';
import type { SpeechSession } from './companion-speech';
import { createGameViewModel } from './game-view-model';

const session = writable<SpeechSession | null>(null);
let current: SpeechSession | null = null;
let pending: SpeechSession | null | undefined;
let batching = false;

export const companionSpeechSession = { subscribe: session.subscribe };
export const gameViewModel = derived(session, (value) =>
  value ? createGameViewModel(value.state, value.definition) : null,
);

export function publishSession(value: SpeechSession | null): void {
  if (batching) {
    pending = value;
    return;
  }
  if (
    value?.state === current?.state &&
    value?.definition.version === current?.definition.version &&
    !value?.command
  )
    return;
  current = value;
  session.set(value);
}

export async function batchSessionPublication<T>(
  task: () => Promise<T>,
): Promise<T> {
  batching = true;
  try {
    return await task();
  } finally {
    batching = false;
    if (pending !== undefined) {
      const final = pending;
      pending = undefined;
      publishSession(final);
    }
  }
}
