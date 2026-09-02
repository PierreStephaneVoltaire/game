import {
  TableClient,
  TableTransaction,
  type TableEntity,
} from '@azure/data-tables';
import type { GlobalDataEntity, GlobalDataRecords } from './records.js';

const BATCH_SIZE = 100;

export interface GlobalDataTable {
  listRowKeys(partitionKey: string): Promise<string[]>;
  replace(entities: GlobalDataEntity[]): Promise<void>;
  delete(partitionKey: string, rowKeys: string[]): Promise<void>;
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    result.push(values.slice(index, index + size));
  return result;
}

export class AzureGlobalDataTable implements GlobalDataTable {
  constructor(private readonly client: TableClient) {}

  async listRowKeys(partitionKey: string): Promise<string[]> {
    const rowKeys: string[] = [];
    for await (const value of this.client.listEntities()) {
      const entity = value as TableEntity<Record<string, unknown>>;
      if (entity.partitionKey === partitionKey) rowKeys.push(entity.rowKey);
    }
    return rowKeys.sort();
  }

  async replace(entities: GlobalDataEntity[]): Promise<void> {
    const transaction = new TableTransaction();
    for (const entity of entities) transaction.upsertEntity(entity, 'Replace');
    await this.client.submitTransaction(transaction.actions);
  }

  async delete(partitionKey: string, rowKeys: string[]): Promise<void> {
    const transaction = new TableTransaction();
    for (const rowKey of rowKeys)
      transaction.deleteEntity(partitionKey, rowKey);
    await this.client.submitTransaction(transaction.actions);
  }
}

export async function syncPartition(
  table: GlobalDataTable,
  partitionKey: string,
  desired: GlobalDataEntity[],
): Promise<{ upserted: number; deleted: number }> {
  const desiredKeys = new Set(desired.map(({ rowKey }) => rowKey));
  const staleKeys = (await table.listRowKeys(partitionKey)).filter(
    (rowKey) => !desiredKeys.has(rowKey),
  );
  for (const batch of chunks(desired, BATCH_SIZE)) await table.replace(batch);
  for (const batch of chunks(staleKeys, BATCH_SIZE))
    await table.delete(partitionKey, batch);
  return { upserted: desired.length, deleted: staleKeys.length };
}

export async function publishGlobalData(
  connectionString: string,
  records: GlobalDataRecords,
): Promise<{
  shopItems: { upserted: number; deleted: number };
  globalRules: { upserted: number; deleted: number };
}> {
  const shopItems = new AzureGlobalDataTable(
    TableClient.fromConnectionString(connectionString, 'ShopItems'),
  );
  const globalRules = new AzureGlobalDataTable(
    TableClient.fromConnectionString(connectionString, 'GlobalRules'),
  );
  return {
    shopItems: await syncPartition(shopItems, 'SHOP_ITEM', records.shopItems),
    globalRules: await syncPartition(
      globalRules,
      'GLOBAL_RULE',
      records.globalRules,
    ),
  };
}
