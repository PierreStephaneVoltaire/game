import { companionProfile } from '$lib/companion-profile';
import type { AppearanceId } from '$lib/game-types';

export type CompanionProfile = {
  name: string;
  avatar: string;
  pronouns?: string;
  appearances: CompanionAppearance[];
};

export type CompanionAppearance = {
  id: AppearanceId;
  label: string;
  assetPath: string;
};

/** The bundled identity is data-driven so the UI never becomes a second pet definition. */
export const companion: CompanionProfile = {
  name: companionProfile.displayName,
  avatar: companionProfile.avatarPath,
  pronouns: companionProfile.pronouns,
  appearances: companionProfile.appearances,
};
