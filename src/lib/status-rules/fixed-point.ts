import type { Metrics, StatusName, StatusRecord } from '../game-types';
import type { StatusEffectEvent } from '../status-rules';
import { STATUS_FIXED_POINT_PASS_LIMIT } from '../game-constants';
import { statusTransitionMessage } from '../event-messages';

type Statuses = Partial<Record<StatusName, StatusRecord>>;
type Align = (metrics: Metrics, previous: Statuses, now: number) => Statuses;
type ApplyOnset = (
  metrics: Metrics,
  previous: Statuses,
  next: Statuses,
) => { metrics: Metrics; events: StatusEffectEvent[] };

export function resolveStatusFixedPoint(input: {
  metrics: Metrics;
  previous: Statuses;
  now: number;
  align: Align;
  applyOnset: ApplyOnset;
}): { metrics: Metrics; statuses: Statuses; events: StatusEffectEvent[] } {
  let metrics = input.metrics;
  let statuses = input.align(metrics, input.previous, input.now);
  const events: StatusEffectEvent[] = [];
  for (let pass = 0; pass < STATUS_FIXED_POINT_PASS_LIMIT; pass += 1) {
    const onsetBaseline = statuses;
    const onset = input.applyOnset(metrics, input.previous, statuses);
    metrics = onset.metrics;
    events.push(...onset.events);
    for (const status of Object.keys(statuses) as StatusName[]) {
      if (
        !input.previous[status] &&
        !onset.events.some((event) => event.status === status)
      )
        events.push({
          status,
          metricDeltas: {},
          message: statusTransitionMessage(status, true),
        });
    }
    const aligned = input.align(metrics, onsetBaseline, input.now);
    const changed = Object.keys(aligned).some(
      (status) => !statuses[status as StatusName],
    );
    input.previous = onsetBaseline;
    statuses = aligned;
    if (!changed) break;
  }
  return { metrics, statuses, events };
}
