import type { Activity, StatusName } from './game-types';

export type BuiltInEventType =
  | 'low_money_stress'
  | 'food_craving'
  | 'creative_inspiration'
  | 'socks'
  | 'benign_room_event';

export function messageFor(type: BuiltInEventType): string {
  if (type === 'low_money_stress') return 'Companion is stressed about money.';
  if (type === 'food_craving') return 'Companion developed a food craving.';
  if (type === 'creative_inspiration')
    return 'Companion had a creative inspiration.';
  if (type === 'socks') return 'The socks demand attention.';
  return 'Something benign happened in the room.';
}

const STATUS_NAMES: Record<StatusName, string> = {
  starving: 'Starving',
  hungry: 'Hungry',
  sleep_deprived: 'Sleep Deprived',
  depressed: 'Depressed',
  lonely: 'Lonely',
  creative_block: 'Creative Block',
  annoyed: 'Annoyed',
  sick: 'Sick',
  overstimulated: 'Overstimulated',
  kidney_stone: 'Kidney Stone',
  full: 'Full',
  low_energy: 'Low Energy',
  sugar_crash: 'Sugar Crash',
};

export function statusDisplayName(status: StatusName): string {
  return STATUS_NAMES[status];
}

export function statusTransitionMessage(
  status: StatusName,
  active: boolean,
): string {
  return `${statusDisplayName(status)} ${active ? 'became active' : 'cleared'}.`;
}

export function activityCompletionMessage(type: Activity['type']): string {
  if (type === 'rest') return 'Rest finished.';
  if (type === 'socialize') return 'Socializing finished.';
  if (type === 'play') return 'Play finished.';
  if (type === 'stream') return 'The stream finished.';
  return 'The hospital visit finished.';
}
