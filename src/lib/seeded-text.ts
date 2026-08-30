import { companionProfile } from './companion-profile';
import { actionRandom } from './seeded-rng';

export type SeededTextContext = {
  seed: string | number;
  stateVersion: number;
  actionId: string;
  petName?: string;
};

export function selectSeededText(
  options: readonly string[],
  context: SeededTextContext | undefined,
  ruleId: string,
  values: Record<string, string | number> = {},
  rollId = 'variant',
): string {
  if (!options.length) throw new Error(`Text pool ${ruleId} is empty.`);
  const index = context
    ? Math.floor(
        actionRandom(
          context.seed,
          context.stateVersion,
          context.actionId,
          `text:${ruleId}`,
          rollId,
        ) * options.length,
      )
    : 0;
  return interpolateText(options[index], {
    pet: context?.petName ?? companionProfile.displayName,
    ...values,
  });
}

export function interpolateText(
  template: string,
  values: Record<string, string | number>,
): string {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function stateTextContext(
  state: { seed: string | number; stateVersion: number },
  actionId: string,
  petName?: string,
): SeededTextContext {
  return {
    seed: state.seed,
    stateVersion: state.stateVersion,
    actionId,
    petName,
  };
}
