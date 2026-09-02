import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type GlobalDataEntity = {
  partitionKey: string;
  rowKey: string;
  payloadJson: string;
  contentHash: string;
  sourcePath: string;
  schemaVersion: number;
};

export type GlobalDataRecords = {
  shopItems: GlobalDataEntity[];
  globalRules: GlobalDataEntity[];
};

const RULE_FILES = [
  'activity-rules.json',
  'ending-rules.json',
  'event-texts.json',
  'financial-rules.json',
  'life-events.json',
  'pet-profile.json',
  'simulation-rules.json',
] as const;

function hash(payloadJson: string): string {
  return createHash('sha256').update(payloadJson).digest('hex');
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function entity(
  partitionKey: string,
  rowKey: string,
  payload: unknown,
  sourcePath: string,
): GlobalDataEntity {
  const payloadJson = JSON.stringify(payload);
  return {
    partitionKey,
    rowKey,
    payloadJson,
    contentHash: hash(payloadJson),
    sourcePath,
    schemaVersion: 1,
  };
}

export async function loadGlobalDataRecords(
  repositoryRoot: string,
): Promise<GlobalDataRecords> {
  const dataRoot = resolve(repositoryRoot, 'src/lib/data');
  const shopPath = resolve(dataRoot, 'shop-items.json');
  const shopData = await readJson(shopPath);
  if (!Array.isArray(shopData)) throw new Error('Shop data must be an array.');
  const shopItems = shopData.map((item) => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string')
      throw new Error('Every shop item must have an id.');
    return entity('SHOP_ITEM', item.id, item, 'src/lib/data/shop-items.json');
  });
  const globalRules = await Promise.all(
    RULE_FILES.map(async (fileName) =>
      entity(
        'GLOBAL_RULE',
        fileName.slice(0, -'.json'.length),
        await readJson(resolve(dataRoot, fileName)),
        `src/lib/data/${fileName}`,
      ),
    ),
  );
  return {
    shopItems: shopItems.sort((left, right) =>
      left.rowKey.localeCompare(right.rowKey),
    ),
    globalRules: globalRules.sort((left, right) =>
      left.rowKey.localeCompare(right.rowKey),
    ),
  };
}
