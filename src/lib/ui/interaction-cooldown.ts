import { MINUTE_MS } from '../game-constants';

type InteractionLock = { locked: boolean; title: string | undefined };

export function cooldownLabel(
  availableAt: number | null | undefined,
  now: number | undefined,
): string | undefined {
  if (availableAt == null || now === undefined) return undefined;
  const minutes = Math.max(1, Math.ceil((availableAt - now) / MINUTE_MS));
  return minutes >= 60
    ? `Ready in ${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `Ready in ${minutes}m`;
}

export function interactionLocks(
  blocked: boolean,
  model:
    | {
        now: number;
        socializeAvailableAt: number | null;
        playAvailableAt: number | null;
      }
    | null
    | undefined,
): { socialize: InteractionLock; play: InteractionLock } {
  const lock = (availableAt: number | null | undefined) => ({
    locked: blocked || availableAt != null,
    title: cooldownLabel(availableAt, model?.now),
  });
  return {
    socialize: lock(model?.socializeAvailableAt),
    play: lock(model?.playAvailableAt),
  };
}
