import { petProfile as profile } from './runtime-definition';
import type { AppearanceId } from './game-types';

export type ConfiguredAppearance = {
  id: AppearanceId;
  label: string;
  assetPath: string;
};

export type ConfiguredCompanionProfile = {
  displayName: string;
  avatarPath: string;
  pronouns?: string;
  appearances: ConfiguredAppearance[];
};

export const companionProfile = profile as ConfiguredCompanionProfile;

export function startingAppearanceId(): AppearanceId {
  return companionProfile.appearances[0]?.id ?? 'classic';
}

export function appearanceIdForModelTier(tier: 1 | 2 | 3 | 4): AppearanceId {
  return companionProfile.appearances[tier]?.id ?? startingAppearanceId();
}
