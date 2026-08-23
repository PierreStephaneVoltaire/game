import type { ItemDefinition } from '../game-definition';
import type { GameEvent, GameState } from '../game-types';
import type { NutritionResolution } from './nutrition-resolution';
import { healthDamageSource } from '../simulation/health-resolution';

/** Builds the authored status/reaction events caused by one accepted serving. */
export function consumptionRuleEvents(input: {
  state: GameState;
  item: ItemDefinition;
  nutrition: NutritionResolution;
  sourceActionId: string;
  precedingEventCount: number;
  event: GameEvent;
}): GameEvent[] {
  const { state, item, nutrition, sourceActionId, precedingEventCount, event } =
    input;
  const events: GameEvent[] = [];
  const id = () =>
    `event-${state.events.length + precedingEventCount + events.length + 2}`;
  if (nutrition.fullFeedSuppressed)
    events.push({
      id: id(),
      type: 'full_feed_suppressed',
      at: state.now,
      message: nutrition.sickFeedingHarm
        ? `${item.name} did not increase Food because the companion was sick.`
        : `${item.name} did not increase Food because the companion was full.`,
      sourceActionId,
      causedBy: [event.id],
      status: 'full',
      metricDeltas: { food: 0 },
    });
  if (nutrition.sickFromFull || nutrition.sickFeedingHarm) {
    const sicknessEvent = nutrition.sickFromFull
      ? {
          type: 'sickness_onset' as const,
          message: `${item.name} caused sickness from overfeeding.`,
        }
      : {
          type: 'sick_feeding_harm' as const,
          message: `${item.name} harmed the sick companion.`,
        };
    events.push({
      id: id(),
      type: sicknessEvent.type,
      at: state.now,
      message: sicknessEvent.message,
      sourceActionId,
      causedBy: [event.id],
      status: 'sick',
      metricDeltas: nutrition.sickFeedingDeltas,
      healthDamageSources: [
        healthDamageSource(
          'status',
          'sick',
          'Sickness',
          nutrition.sickFeedingDeltas.health ?? 0,
          [event.id],
        ),
      ],
    });
  }
  if (nutrition.kidneyStone)
    events.push({
      id: id(),
      type: 'kidney_stone_onset',
      at: state.now,
      message: `${item.name} triggered kidney stone symptoms.`,
      sourceActionId,
      causedBy: [event.id],
      status: 'kidney_stone',
      metricDeltas: nutrition.kidneyStoneDeltas,
      healthDamageSources: [
        healthDamageSource(
          'status',
          'kidney_stone',
          'Kidney stone complications',
          nutrition.kidneyStoneDeltas.health ?? 0,
          [event.id],
        ),
      ],
    });
  if (nutrition.dizzySpell)
    events.push({
      id: id(),
      type: 'dizzy_spell_onset',
      at: state.now,
      message: `${item.name} left the companion feeling dizzy.`,
      sourceActionId,
      causedBy: [event.id],
      status: 'dizzy_spell',
      metricDeltas: nutrition.dizzySpellDeltas,
    });
  return events;
}
