import profiles51To75 from '../data/expanded-profiles-51-75.json';
import profiles76To100 from '../data/expanded-profiles-76-100.json';
import {
  DEFAULT_EXPANDED_PROFILE,
  type ExpandedProfile,
} from './balance-profile-schema';
import type { ExpandedRunSpec, ResponseMode } from './balance-study-contract';

type RawProfile = Omit<
  Partial<ExpandedProfile>,
  | 'id'
  | 'label'
  | 'archetype'
  | 'schedule'
  | 'care'
  | 'shopping'
  | 'nutrition'
  | 'career'
  | 'medical'
  | 'debt'
> & {
  id: string;
  label: string;
  archetype: ExpandedProfile['archetype'];
  schedule: ExpandedProfile['schedule'];
  care?: Partial<ExpandedProfile['care']>;
  shopping?: Partial<ExpandedProfile['shopping']>;
  nutrition?: Partial<ExpandedProfile['nutrition']>;
  career?: Partial<ExpandedProfile['career']>;
  medical?: Partial<ExpandedProfile['medical']>;
  debt?: Partial<ExpandedProfile['debt']>;
};

export function expandedProfileConfigs(): ExpandedProfile[] {
  const profiles = [
    ...(profiles51To75 as RawProfile[]),
    ...(profiles76To100 as RawProfile[]),
  ].map(expandProfile);
  validateProfiles(profiles);
  return profiles;
}

export function expandedRunSpecs(): ExpandedRunSpec[] {
  return expandedProfileConfigs().map((config) => ({
    id: config.id.toLowerCase(),
    profile: config.id,
    label: config.label,
    studyGroup: 'heterogeneous',
    archetype: config.archetype,
    seed: `heterogeneous-balance-v1-${config.id.toLowerCase()}`,
    cadenceHours: nominalCadence(config),
    target: config.target,
    responseMode: responseMode(config),
    config,
  }));
}

function expandProfile(raw: RawProfile): ExpandedProfile {
  return {
    ...DEFAULT_EXPANDED_PROFILE,
    ...raw,
    care: { ...DEFAULT_EXPANDED_PROFILE.care, ...raw.care },
    shopping: { ...DEFAULT_EXPANDED_PROFILE.shopping, ...raw.shopping },
    nutrition: { ...DEFAULT_EXPANDED_PROFILE.nutrition, ...raw.nutrition },
    career: { ...DEFAULT_EXPANDED_PROFILE.career, ...raw.career },
    medical: { ...DEFAULT_EXPANDED_PROFILE.medical, ...raw.medical },
    debt: { ...DEFAULT_EXPANDED_PROFILE.debt, ...raw.debt },
    overlays: [...(raw.overlays ?? [])],
  } as ExpandedProfile;
}

function validateProfiles(profiles: ExpandedProfile[]) {
  if (profiles.length !== 50)
    throw new Error(
      `Expected 50 expanded profiles, received ${profiles.length}.`,
    );
  const ids = new Set<string>();
  for (const [index, profile] of profiles.entries()) {
    const expected = `P${index + 51}`;
    if (profile.id !== expected)
      throw new Error(`Expected profile ${expected}, received ${profile.id}.`);
    if (ids.has(profile.id))
      throw new Error(`Duplicate profile ${profile.id}.`);
    ids.add(profile.id);
    validateSchedule(profile);
    if (
      profile.care.actionsPerVisit !== 'until_safe' &&
      profile.care.actionsPerVisit < 1
    )
      throw new Error(
        `${profile.id} must permit at least one action per visit.`,
      );
    if (profile.shopping.foodReserve < 0)
      throw new Error(`${profile.id} has a negative food reserve.`);
  }
}

function validateSchedule(profile: ExpandedProfile) {
  const schedule = profile.schedule;
  const positive = (value: number | undefined) =>
    value !== undefined && value > 0;
  if (schedule.type === 'fixed_interval' && !positive(schedule.intervalHours))
    throw new Error(`${profile.id} fixed interval is missing.`);
  if (
    schedule.type === 'local_times' &&
    !schedule.localTimes?.length &&
    !schedule.weekdayTimes?.length &&
    !schedule.weekendTimes?.length
  )
    throw new Error(`${profile.id} local times are missing.`);
  if (
    schedule.type === 'day_pattern' &&
    !schedule.checksByWeekday?.length &&
    !schedule.cycleChecksPerDay?.length
  )
    throw new Error(`${profile.id} day pattern is missing.`);
  if (
    schedule.type === 'gap_pattern' &&
    !schedule.gapPatternHours?.every(positive)
  )
    throw new Error(`${profile.id} gap pattern is invalid.`);
  if (schedule.type === 'phase_schedule' && !schedule.phases?.length)
    throw new Error(`${profile.id} phases are missing.`);
}

function nominalCadence(profile: ExpandedProfile) {
  const schedule = profile.schedule;
  if (schedule.intervalHours) return schedule.intervalHours;
  if (schedule.gapPatternHours?.length)
    return (
      schedule.gapPatternHours.reduce((sum, value) => sum + value, 0) /
      schedule.gapPatternHours.length
    );
  if (schedule.phases?.length) return schedule.phases[0].intervalHours;
  const dailyChecks =
    schedule.localTimes?.length ?? schedule.weekdayTimes?.length;
  return dailyChecks ? 24 / dailyChecks : 6;
}

function responseMode(profile: ExpandedProfile): ResponseMode {
  const strategy = profile.medical.strategy;
  if (strategy === 'unaware') return 'unaware';
  if (strategy === 'hydrate') return 'instinctive';
  if (
    strategy === 'wait' ||
    strategy === 'painkiller' ||
    strategy === 'never_hospital'
  )
    return 'wait';
  if (strategy === 'delayed_hospital' || strategy === 'critical_hospital')
    return 'delayed_hospital';
  return 'hospital';
}
