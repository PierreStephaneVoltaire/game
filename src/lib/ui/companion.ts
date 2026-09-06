import type { GameDefinition } from '$lib/game-definition';
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

const marketingCompanion: CompanionProfile = {
  name: 'Bri',
  avatar: '/companions/default-companion-pixel.png',
  appearances: [
    {
      id: 'classic',
      label: 'Classic',
      assetPath: '/companions/default-companion-pixel.png',
    },
  ],
};

/** Static public-page identity; gameplay uses companionFromDefinition. */
export const companion = marketingCompanion;

export function companionFromDefinition(
  definition: GameDefinition,
): CompanionProfile {
  const profile = definition.petProfile as {
    displayName: string;
    avatarPath: string;
    pronouns?: string;
    appearances: CompanionAppearance[];
  };
  return {
    name: profile.displayName,
    avatar: profile.avatarPath,
    pronouns: profile.pronouns,
    appearances: profile.appearances,
  };
}
