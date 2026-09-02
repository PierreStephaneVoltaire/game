import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { syncPartition, type GlobalDataTable } from './publisher.js';
import { loadGlobalDataRecords, type GlobalDataEntity } from './records.js';

class MemoryTable implements GlobalDataTable {
  readonly replaceBatches: GlobalDataEntity[][] = [];
  readonly deleteBatches: string[][] = [];

  constructor(private readonly rowKeys: string[]) {}

  async listRowKeys(): Promise<string[]> {
    return [...this.rowKeys];
  }

  async replace(entities: GlobalDataEntity[]): Promise<void> {
    this.replaceBatches.push(entities);
  }

  async delete(_partitionKey: string, rowKeys: string[]): Promise<void> {
    this.deleteBatches.push(rowKeys);
  }
}

function record(index: number): GlobalDataEntity {
  return {
    partitionKey: 'SHOP_ITEM',
    rowKey: `item-${index.toString().padStart(3, '0')}`,
    payloadJson: '{}',
    contentHash: 'hash',
    sourcePath: 'shop-items.json',
    schemaVersion: 1,
  };
}

describe('global data publishing', () => {
  it('loads the compiled catalogue and runtime JSON only', async () => {
    const records = await loadGlobalDataRecords(resolve(process.cwd(), '..'));
    expect(records.shopItems).toHaveLength(232);
    expect(records.globalRules.map(({ rowKey }) => rowKey)).toEqual([
      'activity-rules',
      'ending-rules',
      'event-texts',
      'financial-rules',
      'life-events',
      'pet-profile',
      'simulation-rules',
    ]);
    expect(records.shopItems[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('replace-upserts current rows before deleting stale rows', async () => {
    const table = new MemoryTable(['item-000', 'removed-item']);
    const result = await syncPartition(
      table,
      'SHOP_ITEM',
      Array.from({ length: 232 }, (_, index) => record(index)),
    );
    expect(table.replaceBatches.map((batch) => batch.length)).toEqual([
      100, 100, 32,
    ]);
    expect(table.deleteBatches).toEqual([['removed-item']]);
    expect(result).toEqual({ upserted: 232, deleted: 1 });
  });

  it('is idempotent when Azure already has the desired stable keys', async () => {
    const desired = [record(0), record(1)];
    const table = new MemoryTable(desired.map(({ rowKey }) => rowKey));
    const result = await syncPartition(table, 'SHOP_ITEM', desired);
    expect(table.replaceBatches).toEqual([desired]);
    expect(table.deleteBatches).toEqual([]);
    expect(result).toEqual({ upserted: 2, deleted: 0 });
  });
});
