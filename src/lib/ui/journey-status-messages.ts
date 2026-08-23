import type { GameEvent, StatusName } from '$lib/game-types';

export function statusJourneyMessage(input: {
  events: GameEvent[];
  event: GameEvent;
  status: StatusName;
  petName: string;
  active: boolean;
}): string | undefined {
  const { events, event, status, petName, active } = input;
  if (
    (!active &&
      status === 'hungry' &&
      hasTransition(events, event, 'starving', true)) ||
    (!active &&
      status === 'starving' &&
      hasTransition(events, event, 'hungry', true))
  )
    return undefined;
  if (
    status === 'hungry' &&
    active &&
    hasTransition(events, event, 'starving', false)
  )
    return `${petName} is still hungry, but no longer starving.`;
  if (active) return activeMessage(status, petName);
  return clearedMessage(status, petName);
}

function activeMessage(status: StatusName, name: string): string {
  const messages: Record<StatusName, string> = {
    hungry: `${name} is hungry.`,
    starving: `${name} is starving.`,
    sleep_deprived: `${name} is sleep deprived.`,
    depressed: `${name} is depressed.`,
    lonely: `${name} is lonely.`,
    creative_block: `${name} feels creatively blocked.`,
    annoyed: `${name} is annoyed.`,
    sick: `${name} is sick.`,
    overstimulated: `${name} is overstimulated.`,
    kidney_stone: `${name} has a kidney stone.`,
    full: `${name} is full.`,
    low_energy: `${name} is running low on energy.`,
    sugar_crash: `${name} is having a sugar crash.`,
  };
  return messages[status];
}

function clearedMessage(status: StatusName, name: string): string {
  const messages: Record<StatusName, string> = {
    hungry: `${name} is no longer hungry.`,
    starving: `${name} is no longer starving.`,
    sleep_deprived: `${name} is no longer sleep deprived.`,
    depressed: `${name} is no longer depressed.`,
    lonely: `${name} is no longer lonely.`,
    creative_block: `${name}'s creativity has returned.`,
    annoyed: `${name} is no longer annoyed.`,
    sick: `${name} is no longer sick.`,
    overstimulated: `${name} has settled down.`,
    kidney_stone: `${name}'s kidney stone has been treated.`,
    full: `${name} is no longer full.`,
    low_energy: `${name}'s energy has recovered.`,
    sugar_crash: `${name} has recovered from the sugar crash.`,
  };
  return messages[status];
}

function hasTransition(
  events: GameEvent[],
  event: GameEvent,
  status: StatusName,
  active: boolean,
): boolean {
  return events.some(
    (candidate) =>
      candidate.at === event.at &&
      candidate.status === status &&
      (candidate.type === 'status_cleared') !== active,
  );
}
