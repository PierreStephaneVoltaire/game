import type { GameDefinition } from '../game-definition';
import type { GameCommand, GameEvent, GameState, Outcome } from '../game-types';
import { HOUR_MS, MAX_QUOTE_ACTION_LENGTH } from '../game-constants';
import { actionRandom } from '../seeded-rng';

export type QuotePools = Record<string, string[]>;
export type SpeechSession = {
  state: GameState;
  definition: GameDefinition;
  command?: GameCommand;
  outcome?: Outcome;
};
export type SpeechTrigger = { id: string; pools: string[] };

export function speechAllowed(state: GameState): boolean {
  return (
    !state.ending &&
    state.activity?.type !== 'rest' &&
    state.activity?.type !== 'medical_care'
  );
}

export function speechHour(state: GameState, intervalHours: number): number {
  return Math.floor(
    (state.now - state.history.runStartedAt) / (intervalHours * HOUR_MS),
  );
}

export function nextSpeechBoundary(
  state: GameState,
  intervalHours: number,
): number {
  const hour =
    state.history.runStartedAt +
    (speechHour(state, intervalHours) + 1) * intervalHours * HOUR_MS;
  return Math.min(hour, state.activity?.endsAt ?? hour);
}

export function clickSpeech(state: GameState, sequence: number): SpeechTrigger {
  return {
    id: `click:${sequence}`,
    pools: [`click:${state.activity?.type ?? 'idle'}`, 'click'],
  };
}

function activitySpeech(event: GameEvent): SpeechTrigger | null {
  const activity = event.activityType;
  if (!activity) return null;
  const phase =
    event.type === 'activity_completed'
      ? 'complete'
      : event.type === 'activity_interrupted'
        ? 'interrupt'
        : event.type === 'activity_started' ||
            event.streamActivityStarted === true
          ? 'start'
          : null;
  if (!phase) return null;
  if (activity === 'rest' || activity === 'medical_care') {
    return phase === 'complete'
      ? { id: event.id, pools: [`${activity}:complete`] }
      : null;
  }
  return { id: event.id, pools: [`${activity}:${phase}`, activity] };
}

export function transitionSpeech(
  before: GameState,
  session: SpeechSession,
  intervalHours: number,
): SpeechTrigger | null {
  const { state, definition, command, outcome } = session;
  if (
    !speechAllowed(state) ||
    before.seed !== state.seed ||
    state.now < before.now
  )
    return null;
  const events = state.events.slice(before.events.length);
  if (outcome?.accepted && command) {
    const consumed = events
      .filter(
        (event) =>
          event.type === 'item_used' &&
          event.itemUseMode === 'manual' &&
          outcome.eventIds.includes(event.id) &&
          definition.items.some(
            (item) => item.id === event.itemId && item.edible,
          ),
      )
      .at(-1);
    if (consumed)
      return {
        id: command.commandId,
        pools: [`feed:${consumed.itemId}`, 'feed'],
      };
    if (command.type === 'perform_item_action')
      return {
        id: command.commandId,
        pools: [
          `item_action:${command.itemId}:${command.action}`,
          'item_action',
        ],
      };
  }
  for (let index = events.length - 1; index >= 0; index--) {
    const trigger = activitySpeech(events[index]);
    if (trigger) return trigger;
  }
  const context = state.activity?.type ?? 'idle';
  if (
    speechHour(state, intervalHours) > speechHour(before, intervalHours) &&
    (context === 'idle' || context === 'stream')
  ) {
    return { id: `hour:${speechHour(state, intervalHours)}`, pools: [context] };
  }
  return null;
}

export function selectQuote(
  pools: QuotePools,
  trigger: SpeechTrigger,
  state: GameState,
  previous = '',
): string {
  if (!speechAllowed(state)) return '';
  const key = trigger.pools.find((key) => pools[key]?.length);
  if (!key) return '';
  const alternatives = pools[key].filter((quote) => quote !== previous);
  const options = alternatives.length ? alternatives : pools[key];
  const roll = actionRandom(
    state.seed,
    state.stateVersion,
    trigger.id,
    'companion_speech',
    key,
  );
  return options[Math.floor(roll * options.length)];
}

export async function loadQuotes(
  fetcher: typeof fetch = fetch,
): Promise<QuotePools> {
  try {
    const response = await fetcher('/api/content/quotes', {
      credentials: 'same-origin',
    });
    if (!response.ok) return {};
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    for (const [key, quotes] of Object.entries(value)) {
      if (
        key.length > MAX_QUOTE_ACTION_LENGTH ||
        !/^[a-z][a-z0-9_-]*(?::[a-z0-9][a-z0-9_-]*){0,2}$/.test(key) ||
        !Array.isArray(quotes) ||
        quotes.some((quote) => typeof quote !== 'string' || !quote.trim())
      )
        return {};
    }
    return value as QuotePools;
  } catch {
    return {};
  }
}
