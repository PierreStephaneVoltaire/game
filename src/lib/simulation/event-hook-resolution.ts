import type { AutomaticEventHookDefinition } from '../game-definition';
import type { GameState, HealthDamageSource } from '../game-types';
import { clampMetric, HOUR_MS } from '../game-constants';
import { actionRandom, resolveRange } from '../seeded-rng';
import { healthDamageSource } from './health-resolution';

export function resolveAutomaticEventHook(input: {
  state: GameState;
  commandId: string;
  itemId: string;
  hook: AutomaticEventHookDefinition;
}): {
  metrics: GameState['metrics'];
  metricDeltas: Partial<GameState['metrics']>;
  healthDamageSources?: HealthDamageSource[];
  cooldownAt?: number;
} {
  const { state, commandId, itemId, hook } = input;
  const metrics = { ...state.metrics };
  const metricDeltas: Partial<GameState['metrics']> = {};
  for (const [metric, range] of Object.entries(hook.effects ?? {})) {
    const name = metric as keyof GameState['metrics'];
    const delta = resolveRange(
      range,
      actionRandom(
        state.seed,
        state.stateVersion,
        commandId,
        'automatic_hook_effect',
        `${itemId}:${hook.id}:${name}`,
      ),
    );
    metrics[name] = clampMetric(name, metrics[name] + delta);
    metricDeltas[name] = delta;
  }
  return {
    metrics,
    metricDeltas,
    healthDamageSources:
      (metricDeltas.health ?? 0) < 0
        ? [
            healthDamageSource(
              'event',
              hook.id,
              hook.message,
              metricDeltas.health ?? 0,
            ),
          ]
        : undefined,
    cooldownAt: hook.cooldownHours
      ? state.now + hook.cooldownHours * HOUR_MS
      : undefined,
  };
}
