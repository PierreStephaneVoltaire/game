import type { GameEvent } from '$lib/game-types';

export const PROGRESSION_EVENT_TYPES = new Set([
  'donation_received',
  'followers_gained',
  'career_milestone',
  'full_body_project_started',
  'full_body_project_completed',
  'model_project_started',
  'project_completed',
  'event_stream_queued',
  'tournament_stream',
  'model_debut_stream',
  'moms_care_package',
]);

export function progressionJourneyMessage(
  event: GameEvent,
  petName: string,
): string | undefined {
  if (event.type === 'donation_received')
    return donationMessage(event, petName);
  if (event.type === 'followers_gained') return followerMessage(event, petName);
  if (event.type === 'career_milestone')
    return milestoneMessage(event, petName);
  if (event.type === 'full_body_project_started')
    return `${petName} landed a rare full-body commission. The work will carry on in the background.`;
  if (event.type === 'full_body_project_completed')
    return `${petName} wrapped up Commission Work and earned ${money(event.amount)}.`;
  if (event.type === 'model_project_started')
    return `${petName} commissioned a new model, and the artists got to work.`;
  if (event.type === 'project_completed') {
    if (event.amount !== undefined)
      return `${petName} delivered the full-body commission and earned ${money(event.amount)}.`;
    return `${petName}'s new model is finished. Their fresh look is ready.`;
  }
  if (event.type === 'event_stream_queued')
    return event.message.toLowerCase().includes('tournament')
      ? `${petName}'s tournament appearance is lined up for the next clear afternoon slot.`
      : `${petName}'s model debut stream is lined up for the next clear afternoon slot.`;
  if (event.type === 'tournament_stream')
    return `${petName} went live to host the tournament.`;
  if (event.type === 'model_debut_stream')
    return `${petName} went live to debut the new model.`;
  if (event.type === 'moms_care_package')
    return `${event.message} It lifted ${petName}'s spirits.`;
  return undefined;
}

function donationMessage(event: GameEvent, petName: string): string {
  const labels = {
    kind_bridiot: 'A kind Bridiot',
    raid_windfall: 'A raid windfall',
    whale: 'A whale',
    legendary_whale: 'A legendary whale',
  } as const;
  const donor = event.donationTier
    ? labels[event.donationTier]
    : 'Someone in chat';
  return `${donor} donated ${money(event.amount)} during ${petName}'s stream.`;
}

function followerMessage(
  event: GameEvent,
  petName: string,
): string | undefined {
  const followers = event.followerDelta ?? 0;
  if (followers <= 0) return undefined;
  return `${petName}'s stream brought ${followers.toLocaleString('en-US')} new ${followers === 1 ? 'follower' : 'followers'} to the channel.`;
}

function milestoneMessage(event: GameEvent, petName: string): string {
  const milestone = event.message.split(' milestone')[0]?.trim();
  const messages: Record<string, string> = {
    affiliate: `${petName}'s channel reached Affiliate! Better stream rates are now available.`,
    partner: `${petName}'s channel reached Partner! The first new-model commission is now available.`,
    convention_guest: `${petName} became a Convention Guest! An appearance fee arrived, along with new set and model opportunities.`,
    tournament_host: `${petName} became a Tournament Host! A special tournament stream is waiting for an open afternoon.`,
    three_d_ready: `${petName}'s channel reached 3D Ready! The final model commission is now available.`,
  };
  return (
    messages[milestone] ??
    `${petName}'s channel reached a new career milestone.`
  );
}

function money(amount: number | undefined): string {
  return `$${Math.max(0, Math.round(amount ?? 0)).toLocaleString('en-US')}`;
}
