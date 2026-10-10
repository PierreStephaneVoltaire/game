import type { EffectRange } from './game-definition';
import { trace } from './telemetry/collector';

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
  const result =
    hashString(`${seed}:${stateVersion}:${actionId}:${ruleId}:${rollId}`) /
    4_294_967_296;
  trace('random_draw', ruleId, {
    seed,
    stateVersion,
    actionId,
    rollId,
    result,
  });
  return result;
}

export function resolveRange(
  range: EffectRange | undefined,
  random: number,
): number {
  const min = range ? Math.ceil(range.min) : 0;
  const max = range ? Math.floor(range.max) : 0;
  const result = !range
    ? 0
    : max <= min
      ? min
      : min + Math.floor(random * (max - min + 1));
  trace('range', 'resolveRange', { range, random, min, max, result });
  return result;
}
