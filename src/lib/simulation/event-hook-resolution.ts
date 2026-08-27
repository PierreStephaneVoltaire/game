import type { AutomaticEventHookDefinition } from '../game-definition';
import type { GameState, HealthDamageSource } from '../game-types';
import { clampMetric, HOUR_MS } from '../game-constants';
import { actionRandom, resolveRange } from '../seeded-rng';
import { healthDamageSource } from './health-resolution';

export type AutomaticHookResolution = {
  metrics: GameState['metrics'];
  metricDeltas: Partial<GameState['metrics']>;
  healthDamageSources?: HealthDamageSource[];
  balanceDelta: number;
  message: string;
  selectedOutcomeId?: string;
  cooldownAt?: number;
  cooldownKey: string;
};

export function resolveAutomaticEventHook(input: {
  state: GameState;
  commandId: string;
  itemId: string;
  hook: AutomaticEventHookDefinition;
}): AutomaticHookResolution {
  const { state, commandId, itemId, hook } = input;
  const outcome = hook.outcomes?.length
    ? selectWeightedOutcome(state, commandId, itemId, hook)
    : undefined;
  const effects = outcome?.effects ?? hook.effects ?? {};
  const metrics = { ...state.metrics };
  const metricDeltas: Partial<GameState['metrics']> = {};
  for (const [metric, range] of Object.entries(effects)) {
    const name = metric as keyof GameState['metrics'];
    const rolled = resolveRange(
      range,
      actionRandom(
        state.seed,
        state.stateVersion,
        commandId,
        'automatic_hook_effect',
        `${itemId}:${hook.id}:${outcome?.id ?? 'direct'}:${name}`,
      ),
    );
    const before = metrics[name];
    metrics[name] = clampMetric(name, before + rolled);
    metricDeltas[name] = metrics[name] - before;
  }
  const explicitDamage = outcome?.healthDamage
    ? resolveRange(
        outcome.healthDamage,
        actionRandom(
          state.seed,
          state.stateVersion,
          commandId,
          'automatic_hook_injury',
          `${itemId}:${hook.id}:${outcome.id}`,
        ),
      )
    : 0;
  if (explicitDamage > 0) {
    const before = metrics.health;
    metrics.health = clampMetric('health', before - explicitDamage);
    metricDeltas.health =
      (metricDeltas.health ?? 0) + (metrics.health - before);
  }
  const balanceRange = outcome?.balanceEffect ?? hook.balanceEffect;
  const balanceDelta = balanceRange
    ? resolveRange(
        balanceRange,
        actionRandom(
          state.seed,
          state.stateVersion,
          commandId,
          'automatic_hook_balance',
          `${itemId}:${hook.id}:${outcome?.id ?? 'direct'}`,
        ),
      )
    : 0;
  const message =
    outcome?.message ?? selectMessage(state, commandId, itemId, hook);
  return {
    metrics,
    metricDeltas,
    healthDamageSources: buildDamageSources(
      hook,
      outcome,
      message,
      metricDeltas.health,
    ),
    balanceDelta,
    message,
    selectedOutcomeId: outcome?.id,
    cooldownAt: hook.cooldownHours
      ? state.now + hook.cooldownHours * HOUR_MS
      : undefined,
    cooldownKey: hook.sharedCooldownKey ?? `item_hook:${itemId}:${hook.id}`,
  };
}

function selectWeightedOutcome(
  state: GameState,
  commandId: string,
  itemId: string,
  hook: AutomaticEventHookDefinition,
) {
  const outcomes = hook.outcomes ?? [];
  const total = outcomes.reduce((sum, candidate) => sum + candidate.weight, 0);
  let remaining =
    actionRandom(
      state.seed,
      state.stateVersion,
      commandId,
      'automatic_hook_outcome',
      `${itemId}:${hook.id}`,
    ) * total;
  return (
    outcomes.find((candidate) => {
      remaining -= candidate.weight;
      return remaining < 0;
    }) ?? outcomes.at(-1)!
  );
}

function selectMessage(
  state: GameState,
  commandId: string,
  itemId: string,
  hook: AutomaticEventHookDefinition,
): string {
  const messages = hook.messages?.length
    ? hook.messages
    : [hook.message ?? 'Companion did something on her own.'];
  const roll = actionRandom(
    state.seed,
    state.stateVersion,
    commandId,
    'automatic_hook_message',
    `${itemId}:${hook.id}`,
  );
  return messages[Math.floor(roll * messages.length)];
}

function buildDamageSources(
  hook: AutomaticEventHookDefinition,
  outcome:
    NonNullable<AutomaticEventHookDefinition['outcomes']>[number] | undefined,
  message: string,
  healthDelta: number | undefined,
): HealthDamageSource[] | undefined {
  if ((healthDelta ?? 0) >= 0) return undefined;
  return [
    healthDamageSource(
      'event',
      outcome?.healthDamage?.causeId ?? hook.id,
      outcome?.healthDamage?.causeName ?? message,
      healthDelta ?? 0,
    ),
  ];
}
