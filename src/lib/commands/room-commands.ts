import type { GameDefinition } from '../game-definition';
import type { GameCommand, GameState, Outcome } from '../game-types';
import {
  accepted,
  appliedRoomMetricDelta,
  applyRoomMetricDelta,
  recordBondGain,
  rejected,
} from '../simulation/engine-state';
import { healthDamageSource } from '../simulation/health-resolution';

export type RoomCommandResult = {
  handled: boolean;
  state: GameState;
  outcome: Outcome;
};

export function handleRoomCommand(
  state: GameState,
  command: Extract<GameCommand, { type: 'place_item' | 'unplace_item' }>,
  definition: GameDefinition,
): RoomCommandResult {
  if (command.type === 'place_item')
    return placeItem(state, command, definition);
  return unplaceItem(state, command, definition);
}

function placeItem(
  state: GameState,
  command: Extract<GameCommand, { type: 'place_item' }>,
  definition: GameDefinition,
): RoomCommandResult {
  const quantity = state.inventory[command.itemId] ?? 0;
  const item = definition.items.find(
    (candidate) => candidate.id === command.itemId,
  );
  if (!item || !quantity)
    return result(state, rejected('unavailable', 'You do not own that item.'));
  if (!item.roomSlot || item.roomSlot !== command.slot)
    return result(
      state,
      rejected('invalid_room_slot', 'That item does not fit this room anchor.'),
    );
  if (state.room[command.slot])
    return result(
      state,
      rejected('room_occupied', 'That room anchor is occupied.'),
    );
  const roomDelta = appliedRoomMetricDelta(
    state.metrics,
    item.roomEffects,
    definition.metricMin,
    definition.metricMax,
  );
  const event = {
    id: `event-${state.events.length + 1}`,
    type: 'item_placed',
    at: state.now,
    message: `Placed ${item.name} in the room.`,
    sourceActionId: command.commandId,
    metricDeltas: roomDelta,
    healthDamageSources:
      (roomDelta.health ?? 0) < 0
        ? [
            healthDamageSource(
              'item',
              item.id,
              item.name,
              roomDelta.health ?? 0,
            ),
          ]
        : undefined,
  };
  const next: GameState = {
    ...state,
    room: { ...state.room, [command.slot]: command.itemId },
    inventory: { ...state.inventory, [command.itemId]: quantity - 1 },
    metrics: applyRoomMetricDelta(
      state.metrics,
      item.roomEffects,
      definition.metricMin,
      definition.metricMax,
    ),
    roomModifiers: {
      ...state.roomModifiers,
      [command.slot]: roomDelta,
    },
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
    actionOrdinal: state.actionOrdinal + 1,
  };
  return result(
    recordBondGain(next, state),
    accepted('item_placed', event.message, [event.id]),
  );
}

function unplaceItem(
  state: GameState,
  command: Extract<GameCommand, { type: 'unplace_item' }>,
  definition: GameDefinition,
): RoomCommandResult {
  const itemId = state.room[command.slot];
  const item = itemId
    ? definition.items.find((candidate) => candidate.id === itemId)
    : undefined;
  if (!item)
    return result(state, rejected('unavailable', 'That room anchor is empty.'));
  const unplacedMetrics = applyRoomMetricDelta(
    state.metrics,
    state.roomModifiers[command.slot] ?? item.roomEffects,
    definition.metricMin,
    definition.metricMax,
    -1,
  );
  const healthDelta = unplacedMetrics.health - state.metrics.health;
  const event = {
    id: `event-${state.events.length + 1}`,
    type: 'item_unplaced',
    at: state.now,
    message: `Removed ${item.name} from the room.`,
    sourceActionId: command.commandId,
    metricDeltas: { health: healthDelta },
    healthDamageSources:
      healthDelta < 0
        ? [healthDamageSource('item', item.id, item.name, healthDelta)]
        : undefined,
  };
  const next: GameState = {
    ...state,
    room: Object.fromEntries(
      Object.entries(state.room).filter(([slot]) => slot !== command.slot),
    ),
    inventory: {
      ...state.inventory,
      [item.id]: (state.inventory[item.id] ?? 0) + 1,
    },
    metrics: unplacedMetrics,
    roomModifiers: Object.fromEntries(
      Object.entries(state.roomModifiers).filter(
        ([slot]) => slot !== command.slot,
      ),
    ),
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
    actionOrdinal: state.actionOrdinal + 1,
  };
  return result(next, accepted('item_unplaced', event.message, [event.id]));
}

function result(state: GameState, outcome: Outcome): RoomCommandResult {
  return { handled: true, state, outcome };
}
