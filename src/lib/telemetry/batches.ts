import type { Operation } from './capture';
import type { Change } from './state-changes';

export const BATCH_BYTES = 256 * 1024;
const FRAGMENT_BYTES = 48 * 1024;
const encoder = new TextEncoder();

export type Fragment = Omit<
  Operation,
  'input' | 'outcome' | 'checkpoint' | 'changes' | 'calculations'
> & {
  part: number;
  parts: number;
  data: Change[];
};
export type Batch = { schemaVersion: 1; batchId: string; records: Fragment[] };
export type PendingBatch = {
  batchId: string;
  owner: string;
  body: string;
  digest: string;
  retryCount: number;
  retryAt: number;
  blocked: string | null;
  createdAt: number;
};

export function json(value: unknown): string {
  return JSON.stringify(value, (_, item) => {
    if (typeof item === 'number' && !Number.isFinite(item))
      return { $number: String(item) };
    if (item === undefined) return { $undefined: true };
    return item;
  });
}

export function byteLength(value: string): number {
  return encoder.encode(value).byteLength;
}

export function decodeTraceValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeTraceValue);
  if (!value || typeof value !== 'object') return value;
  const fields = value as Record<string, unknown>;
  if (Object.keys(fields).length === 1) {
    if (fields.$undefined === true) return undefined;
    if (fields.$number === 'Infinity') return Infinity;
    if (fields.$number === '-Infinity') return -Infinity;
    if (fields.$number === 'NaN') return NaN;
  }
  return Object.fromEntries(
    Object.entries(fields).map(([key, item]) => [key, decodeTraceValue(item)]),
  );
}

export async function digest(value: string): Promise<string> {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', encoder.encode(value)),
    ),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}

export function fragments(operation: Operation): Fragment[] {
  const { input, outcome, checkpoint, changes, calculations, ...metadata } =
    operation;
  const payload = JSON.parse(
    json({ input, outcome, checkpoint, changes, calculations }),
  );
  const pieces: Change[] = [];
  function split(value: unknown, path: Change['path']) {
    if (byteLength(json({ path, value })) <= FRAGMENT_BYTES) {
      pieces.push({ path, value });
    } else if (value && typeof value === 'object') {
      pieces.push({ path, value: Array.isArray(value) ? [] : {} });
      for (const [key, child] of Object.entries(value))
        split(child, [...path, Array.isArray(value) ? Number(key) : key]);
    } else if (typeof value === 'string') {
      pieces.push({ path, value: '' });
      for (let offset = 0; offset < value.length; offset += 4096)
        pieces.push({
          path,
          value: value.slice(offset, offset + 4096),
          appendText: true,
        });
    } else {
      throw new Error('An atomic trace value exceeds the fragment limit.');
    }
  }
  split(payload, []);
  const groups: Change[][] = [[]];
  let size = 2;
  for (const piece of pieces) {
    const bytes = byteLength(json(piece)) + 1;
    if (
      (size + bytes > FRAGMENT_BYTES || groups.at(-1)!.length >= 1000) &&
      groups.at(-1)!.length
    ) {
      groups.push([]);
      size = 2;
    }
    groups.at(-1)!.push(piece);
    size += bytes;
  }
  return groups.map((data, part) => ({
    ...metadata,
    part,
    parts: groups.length,
    data,
  }));
}

export function makeBatches(records: Fragment[]): Batch[] {
  const batches: Batch[] = [];
  let current: Batch = {
    schemaVersion: 1,
    batchId: crypto.randomUUID(),
    records: [],
  };
  let size = byteLength(json(current));
  for (const record of records) {
    const bytes = byteLength(json(record));
    if (size + bytes + (current.records.length ? 1 : 0) > BATCH_BYTES) {
      if (!current.records.length)
        throw new Error('Trace fragment exceeds the batch limit.');
      batches.push(current);
      current = { schemaVersion: 1, batchId: crypto.randomUUID(), records: [] };
      size = byteLength(json(current));
    }
    size += bytes + (current.records.length ? 1 : 0);
    current.records.push(record);
  }
  if (current.records.length) batches.push(current);
  return batches;
}
