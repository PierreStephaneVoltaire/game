import type { StatusName as GameStatusName } from '../game-types';

export const STATUS_NAMES = [
  'starving',
  'hungry',
  'sleep_deprived',
  'depressed',
  'lonely',
  'creative_block',
  'annoyed',
  'sick',
  'overstimulated',
  'kidney_stone',
  'full',
  'low_energy',
  'sugar_crash',
  'dizzy_spell',
] as const satisfies readonly GameStatusName[];

export function isStatusName(value: string): value is GameStatusName {
  return (STATUS_NAMES as readonly string[]).includes(value);
}
