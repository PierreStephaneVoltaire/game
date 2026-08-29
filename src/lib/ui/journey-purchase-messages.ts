import { eventTemplate } from '$lib/event-messages';
import type { GameEvent, PurchaseRecord } from '$lib/game-types';
import type { SeededTextContext } from '$lib/seeded-text';

export function journeyTextContext(
  seed: string | number,
  event: GameEvent,
  petName: string,
): SeededTextContext {
  const ordinal = Number(event.id.match(/\d+$/)?.[0] ?? 0);
  return {
    seed,
    stateVersion: ordinal,
    actionId: event.sourceActionId ?? event.id,
    petName,
  };
}

export function purchaseJourneyMessage(
  event: GameEvent,
  purchase: PurchaseRecord,
  petName: string,
  textContext: SeededTextContext,
): string {
  const item =
    purchase.quantity === 1
      ? purchase.itemName
      : `${purchase.itemName} ×${purchase.quantity}`;
  return event.purchaseActor === 'companion'
    ? eventTemplate(
        'journey_companion_purchase',
        { pet: petName, item },
        textContext,
      )
    : eventTemplate(
        'journey_player_purchase',
        { pet: petName, item },
        textContext,
      );
}
