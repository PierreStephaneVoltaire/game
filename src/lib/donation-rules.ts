import { simulationRules as rules } from './runtime-definition';
import { actionRandom } from './seeded-rng';
import type { DonationTier, GameState } from './game-types';

export type Donation = {
  tier: DonationTier;
  amount: number;
  followers: number;
};

export function weightedDonation(
  state: GameState,
  commandId: string,
  hourIndex: number,
  multiplier: number,
): Donation | null {
  const donationRules = rules.stream.donations;
  const chance = Math.min(
    1,
    (donationRules.baseChance +
      state.metrics.creativity * donationRules.creativityChance +
      (state.progression.permanentDonationBonus
        ? donationRules.finalDebutBonus
        : 0)) *
      multiplier,
  );
  if (
    actionRandom(
      state.seed,
      state.stateVersion,
      commandId,
      'donation',
      `hour:${hourIndex}:chance`,
    ) >= chance
  )
    return null;
  const tiers = donationRules.tiers as Array<{
    id: DonationTier;
    weight: number;
    minimum: number;
    maximum: number;
    requiredCreativity?: number;
  }>;
  const eligible = tiers.filter(
    (tier) =>
      tier.requiredCreativity === undefined ||
      state.metrics.creativity >= tier.requiredCreativity,
  );
  const total = eligible.reduce((sum, tier) => sum + tier.weight, 0);
  let remaining =
    actionRandom(
      state.seed,
      state.stateVersion,
      commandId,
      'donation',
      `hour:${hourIndex}:tier`,
    ) * total;
  const selected =
    eligible.find((tier) => {
      remaining -= tier.weight;
      return remaining < 0;
    }) ?? eligible[0];
  const amount =
    selected.minimum +
    Math.floor(
      actionRandom(
        state.seed,
        state.stateVersion,
        commandId,
        'donation',
        `hour:${hourIndex}:amount`,
      ) *
        (selected.maximum - selected.minimum + 1),
    );
  return {
    tier: selected.id,
    amount,
    followers:
      donationRules.followers +
      (selected.id === 'whale' || selected.id === 'legendary_whale'
        ? donationRules.whaleFollowerBonus
        : 0),
  };
}
