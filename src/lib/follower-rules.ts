import rules from './data/simulation-rules.json';
import { HOUR_MS, STAT_MAX } from './game-constants';
import type { CareerTier, GameEvent, GameState } from './game-types';

const progressionRules = rules.progression as {
  milestones: Array<{
    id: CareerTier;
    followers: number;
    streamRate?: [number, number];
    mood?: number;
    unlockModelTier?: 1 | 2 | 3 | 4;
    appearanceFee?: number;
  }>;
};

export function applyFollowerMilestones(
  state: GameState,
  sourceActionId: string,
  at: number,
  events: GameEvent[],
): GameState {
  let progression = { ...state.progression };
  let metrics = state.metrics;
  for (const milestone of progressionRules.milestones) {
    if (
      progression.followers < milestone.followers ||
      progression.awardedMilestones.includes(milestone.id)
    )
      continue;
    progression = {
      ...progression,
      careerTier: milestone.id,
      awardedMilestones: [...progression.awardedMilestones, milestone.id],
      unlockedModelTiers: milestone.unlockModelTier
        ? [
            ...new Set([
              ...progression.unlockedModelTiers,
              milestone.unlockModelTier,
            ]),
          ]
        : progression.unlockedModelTiers,
    };
    if (milestone.mood)
      metrics = {
        ...metrics,
        mood: Math.min(STAT_MAX, metrics.mood + milestone.mood),
      };
    if (milestone.appearanceFee)
      state = { ...state, balance: state.balance + milestone.appearanceFee };
    if (
      milestone.id === 'tournament_appearance' &&
      !progression.queuedEventStreams.some(
        (stream) => stream.type === 'tournament',
      )
    )
      progression.queuedEventStreams = [
        ...progression.queuedEventStreams,
        {
          id: `tournament-${at}`,
          type: 'tournament',
          queuedAt: at,
          durationHours: rules.projects.tournamentHours,
          donationMultiplier: rules.stream.donations.tournamentMultiplier,
        },
      ];
    events.push({
      id: `event-${state.events.length + events.length + 1}`,
      type: 'career_milestone',
      at,
      message: `${milestone.id.replaceAll('_', ' ')} milestone reached.`,
      sourceActionId,
      cause: milestone.id,
      followerDelta: milestone.followers,
    });
  }
  return { ...state, metrics, progression };
}

export function followerGain(
  state: GameState,
  startedAt: number,
  elapsedHours: number,
): number {
  if (elapsedHours <= 0) return 0;
  const endsAt = startedAt + elapsedHours * HOUR_MS;
  const base =
    rules.stream.followers.baseRate +
    state.metrics.creativity / rules.stream.followers.creativityDivisor;
  let primeMs = 0;
  const startParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: state.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(startedAt));
  const year = Number(startParts.find((part) => part.type === 'year')?.value);
  const month = Number(startParts.find((part) => part.type === 'month')?.value);
  const day = Number(startParts.find((part) => part.type === 'day')?.value);
  for (
    let offset = -1;
    offset <= Math.ceil(elapsedHours / 24) + 1;
    offset += 1
  ) {
    const wall = new Date(Date.UTC(year, month - 1, day + offset));
    const primeStart = localWallTime(wall, 13, state.timezone);
    const primeEnd = localWallTime(wall, 19, state.timezone);
    primeMs += Math.max(
      0,
      Math.min(endsAt, primeEnd) - Math.max(startedAt, primeStart),
    );
  }
  const normalMs = Math.max(0, endsAt - startedAt - primeMs);
  return Math.round(
    (base * normalMs +
      base * rules.stream.followers.primeMultiplier * primeMs) /
      HOUR_MS,
  );
}

export function streamRateFor(state: GameState): [number, number] {
  const rate = progressionRules.milestones
    .filter(
      (milestone) =>
        milestone.streamRate &&
        state.progression.followers >= milestone.followers,
    )
    .at(-1)?.streamRate;
  return (
    rate ?? [
      rules.stream.income.minimumRate,
      rules.stream.income.minimumRate + rules.stream.income.rateSlots - 1,
    ]
  );
}

function localWallTime(date: Date, hour: number, timezone: string): number {
  const guess = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    hour,
  );
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date(guess));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, Number(part.value)]),
  );
  const localAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
  );
  const desiredAsUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    hour,
  );
  return guess + desiredAsUtc - localAsUtc;
}
