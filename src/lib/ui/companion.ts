import profile from '$lib/data/pet-profile.json';

export type CompanionProfile = {
  name: string;
  avatar: string;
  pronouns?: string;
};

type PetProfile = {
  displayName: string;
  avatarPath: string;
  pronouns?: string;
};
const source = profile as PetProfile;

/** The bundled identity is data-driven so the UI never becomes a second pet definition. */
export const companion: CompanionProfile = {
  name: source.displayName,
  avatar: source.avatarPath,
  pronouns: source.pronouns,
};
