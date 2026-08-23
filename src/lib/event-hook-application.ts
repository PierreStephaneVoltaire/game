import type { AutomaticEventHookDefinition } from './game-definition';
import type { GameEvent, GameState, Metrics } from './game-types';
import { resolveAutomaticEventHook } from './simulation/event-hook-resolution';

export function applyAutomaticHook(input: {
  state: GameState;
  commandId: string;
  itemId: string;
  hook: AutomaticEventHookDefinition;
  metrics: Metrics;
  event: GameEvent;
  cooldowns: Record<string, number>;
}): void {
  const resolution = resolveAutomaticEventHook({
    state: input.state,
    commandId: input.commandId,
    itemId: input.itemId,
    hook: input.hook,
  });
  Object.assign(input.metrics, resolution.metrics);
  if (Object.keys(resolution.metricDeltas).length)
    input.event.metricDeltas = resolution.metricDeltas;
  input.event.healthDamageSources = resolution.healthDamageSources;
  if (resolution.cooldownAt)
    input.cooldowns[`item_hook:${input.itemId}:${input.hook.id}`] =
      resolution.cooldownAt;
}
