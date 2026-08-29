import type { GameState } from '../../../../src/lib/game-types';
import { HOUR_MS } from '../../../../src/lib/game-constants';
import { localDate } from '../../../../src/lib/shop-rules';
import type { ExpandedProfile } from './balance-profile-schema';

const DAY_MS = 24 * HOUR_MS;
const TIMEZONE = 'America/Toronto';

export type ScheduleCursor = {
  next(state: GameState): number | null;
};

export function createScheduleCursor(
  profile: ExpandedProfile,
  start: number,
  horizon: number,
): ScheduleCursor {
  const schedule = profile.schedule;
  if (schedule.type === 'fixed_interval')
    return intervalCursor(start, horizon, () => schedule.intervalHours!);
  if (schedule.type === 'gap_pattern') {
    let index = 0;
    return intervalCursor(start, horizon, () => {
      const gap =
        schedule.gapPatternHours![index % schedule.gapPatternHours!.length];
      index += 1;
      return gap;
    });
  }
  if (schedule.type === 'phase_schedule')
    return intervalCursor(start, horizon, (state, at) => {
      const day = (at - start) / DAY_MS;
      const phase =
        schedule.phases!.find(
          (candidate) =>
            (candidate.untilDay === undefined || day < candidate.untilDay) &&
            (candidate.afterDay === undefined || day >= candidate.afterDay) &&
            (candidate.untilFollowers === undefined ||
              state.progression.followers < candidate.untilFollowers),
        ) ?? schedule.phases!.at(-1)!;
      return phase.intervalHours;
    });
  const visits =
    schedule.type === 'local_times'
      ? localTimeVisits(profile, start, horizon)
      : dayPatternVisits(profile, start, horizon);
  let index = 0;
  return {
    next() {
      return visits[index++] ?? null;
    },
  };
}

function intervalCursor(
  start: number,
  horizon: number,
  interval: (state: GameState, at: number) => number,
): ScheduleCursor {
  let at = start;
  return {
    next(state) {
      at += interval(state, at) * HOUR_MS;
      return at <= horizon ? at : null;
    },
  };
}

function localTimeVisits(
  profile: ExpandedProfile,
  start: number,
  horizon: number,
) {
  const result: number[] = [];
  const schedule = profile.schedule;
  for (let day = 0; day <= Math.ceil((horizon - start) / DAY_MS); day += 1) {
    const dateAtNoon = start + day * DAY_MS + 5 * HOUR_MS;
    const weekday = localWeekday(dateAtNoon);
    const weekend = weekday === 0 || weekday === 6;
    const times =
      schedule.localTimes ??
      (weekend ? schedule.weekendTimes : schedule.weekdayTimes) ??
      [];
    const date = localDate(dateAtNoon, TIMEZONE);
    for (const time of times) {
      const at = localTimestamp(date, time);
      if (at > start && at <= horizon) result.push(at);
    }
  }
  return result.sort((left, right) => left - right);
}

function dayPatternVisits(
  profile: ExpandedProfile,
  start: number,
  horizon: number,
) {
  const result: number[] = [];
  const schedule = profile.schedule;
  for (let day = 0; day <= Math.ceil((horizon - start) / DAY_MS); day += 1) {
    const dateAtNoon = start + day * DAY_MS + 5 * HOUR_MS;
    const weekday = localWeekday(dateAtNoon);
    const mondayIndex = (weekday + 6) % 7;
    const count =
      schedule.checksByWeekday?.[mondayIndex] ??
      schedule.cycleChecksPerDay?.[day % schedule.cycleChecksPerDay.length] ??
      0;
    const date = localDate(dateAtNoon, TIMEZONE);
    for (const time of evenlySpacedTimes(count)) {
      const at = localTimestamp(date, time);
      if (at > start && at <= horizon) result.push(at);
    }
  }
  return result.sort((left, right) => left - right);
}

function evenlySpacedTimes(count: number) {
  if (count <= 0) return [];
  if (count === 1) return ['20:00'];
  return Array.from({ length: count }, (_, index) => {
    const minutes = 8 * 60 + Math.round((index * 14 * 60) / (count - 1));
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  });
}

function localWeekday(at: number) {
  const value = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
  }).format(at);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value);
}

function localTimestamp(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = localParts(guess);
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
    );
    const wanted = Date.UTC(year, month - 1, day, hour, minute);
    guess += wanted - represented;
  }
  return guess;
}

function localParts(at: number) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
  };
}
