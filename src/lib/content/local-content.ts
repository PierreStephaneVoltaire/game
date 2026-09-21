import {
  gameDefinitionFromBundle,
  InMemoryGameDefinitionRepository,
  type GameDefinition,
  type ItemDefinition,
  type RuntimeContentBundle,
} from '$lib/game-definition';

const documents = import.meta.glob('../data/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

function document<T>(name: string): T {
  return documents[`../data/${name}.json`] as T;
}

const localBundle: RuntimeContentBundle = {
  version: 'local',
  schema_version: 1,
  shop_items: document<ItemDefinition[]>('shop-items'),
  activity_rules: document('activity-rules'),
  ending_rules: document('ending-rules'),
  event_texts: document('event-texts'),
  financial_rules: document('financial-rules'),
  life_events: document('life-events'),
  pet_profile: document('pet-profile'),
  simulation_rules: document('simulation-rules'),
};

const localDefinition: GameDefinition = gameDefinitionFromBundle(localBundle);

export const localContent = new InMemoryGameDefinitionRepository(
  localDefinition,
);
