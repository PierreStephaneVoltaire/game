import type { GameEvent, StatusName } from '$lib/game-types';

export function statusJourneyMessage(input: {
  events: GameEvent[];
  event: GameEvent;
  status: StatusName;
  petName: string;
  active: boolean;
}): string | undefined {
  const { events, event, status, petName, active } = input;
  if (active && hasAuthoredOnset(events, event, status)) return undefined;
  if (
    !active &&
    (status === 'sick' || status === 'kidney_stone') &&
    hasMedicalCompletion(events, event)
  )
    return undefined;
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
  if (status === 'kidney_stone' && event.message.includes('passed'))
    return `${petName}'s kidney stone passed naturally, bringing some welcome relief.`;
  if (status === 'sick' && event.message.toLowerCase().includes('recovered'))
    return `${petName} recovered from the sickness with time.`;
  if (
    status === 'dizzy_spell' &&
    event.message.toLowerCase().includes('passed')
  )
    return `${petName}'s dizzy spell passed.`;
  return clearedMessage(status, petName);
}

const AUTHORED_ONSETS: Partial<Record<StatusName, string[]>> = {
  sick: ['sickness_onset'],
  kidney_stone: ['kidney_stone_onset'],
  dizzy_spell: ['dizzy_spell_onset'],
};

function hasAuthoredOnset(
  events: GameEvent[],
  event: GameEvent,
  status: StatusName,
): boolean {
  const types = AUTHORED_ONSETS[status];
  return Boolean(
    types?.length &&
    events.some(
      (candidate) =>
        candidate !== event &&
        candidate.at === event.at &&
        candidate.status === status &&
        types.includes(candidate.type),
    ),
  );
}

function hasMedicalCompletion(events: GameEvent[], event: GameEvent): boolean {
  return events.some(
    (candidate) =>
      candidate.at === event.at &&
      candidate.type === 'activity_completed' &&
      candidate.activityType === 'medical_care',
  );
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
    dizzy_spell: `${name} is having a dizzy spell.`,
    in_debt: `${name} is in debt.`,
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
    dizzy_spell: `${name}'s dizzy spell has cleared.`,
    in_debt: `${name} is no longer in debt.`,
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
