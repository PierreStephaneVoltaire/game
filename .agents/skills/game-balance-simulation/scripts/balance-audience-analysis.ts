import type { GameEvent, GameState } from '../../../../src/lib/game-types';

export function followerSources(state: GameState) {
  const events = state.events;
  const natural = sumField(events, 'natural_audience_growth');
  const clippers = sumField(events, 'clipper_audience_growth');
  const donations = sumField(events, 'donation_received');
  const models = state.progression.completedModelTiers.length * 50;
  return {
    natural,
    clippers,
    donations,
    models,
    other:
      state.progression.followers - natural - clippers - donations - models,
  };
}

export function audienceBoostDiagnostics(events: GameEvent[]) {
  const ticks = events.filter(
    (event) => event.type === 'natural_audience_growth',
  );
  const loads = ticks.map(
    (event) =>
      (event.fullValueAudienceBoostIds?.length ?? 0) +
      (event.discountedAudienceBoostIds?.length ?? 0),
  );
  return {
    ticks: ticks.length,
    medianActiveLoad: median(loads),
    maximumActiveLoad: loads.length ? Math.max(...loads) : 0,
    fullValueContributions: ticks.reduce(
      (sum, event) => sum + (event.fullValueAudienceBoostIds?.length ?? 0),
      0,
    ),
    discountedContributions: ticks.reduce(
      (sum, event) => sum + (event.discountedAudienceBoostIds?.length ?? 0),
      0,
    ),
  };
}

function sumField(events: GameEvent[], type: string) {
  return events
    .filter((event) => event.type === type)
    .reduce((sum, event) => sum + (event.followerDelta ?? 0), 0);
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
