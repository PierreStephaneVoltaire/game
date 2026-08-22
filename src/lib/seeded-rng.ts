import type { EffectRange } from './game-definition';

export function hashString(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function actionRandom(
  seed: string | number,
  stateVersion: number,
  actionId: string,
  ruleId = 'default',
  rollId = 'default',
): number {
  return (
    hashString(`${seed}:${stateVersion}:${actionId}:${ruleId}:${rollId}`) /
    4_294_967_296
  );
}

export function resolveRange(
  range: EffectRange | undefined,
  random: number,
): number {
  if (!range) return 0;
  const min = Math.ceil(range.min);
  const max = Math.floor(range.max);
  if (max <= min) return min;
  return min + Math.floor(random * (max - min + 1));
}
