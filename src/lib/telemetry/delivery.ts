import { BATCH_BYTES, type PendingBatch } from './batches';
import {
  pendingBatches,
  pendingBytes,
  persistMemory,
  sealBatches,
  updateBatch,
} from './outbox';

let owner: string | null = null;
let active = false;
let authenticationPaused: string | null = null;

export function setLoggingAccount(value: string | null): void {
  owner = value;
  authenticationPaused = null;
  if (owner) void flushLogging();
}

async function upload(batch: PendingBatch): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch('/api/telemetry/batches', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        'x-telemetry-owner': batch.owner,
        'x-content-digest': batch.digest,
      },
      body: batch.body,
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 200) {
      const acknowledgement = await response.json();
      if (
        acknowledgement.batchId === batch.batchId &&
        acknowledgement.digest === batch.digest
      ) {
        await updateBatch(batch, true);
        return true;
      }
    }
    if (response.status === 401 || response.status === 403) {
      authenticationPaused = batch.owner;
      return false;
    }
    if ([400, 409, 413, 422].includes(response.status)) {
      await updateBatch({ ...batch, blocked: `http_${response.status}` });
      console.warn(
        'Gameplay logging batch was rejected and retained for inspection.',
      );
      return true;
    }
  } catch {
    console.warn('Gameplay logging upload failed; retrying retained data.');
  }
  const retryCount = batch.retryCount + 1;
  await updateBatch({
    ...batch,
    retryCount,
    retryAt:
      Date.now() + Math.min(3_600_000, 1000 * 2 ** Math.min(retryCount, 12)),
  });
  return false;
}

export async function flushLogging(thresholdOnly = false): Promise<void> {
  if (active || !owner || authenticationPaused === owner) return;
  active = true;
  const account = owner;
  try {
    await persistMemory();
    if (thresholdOnly && (await pendingBytes(account)) < BATCH_BYTES) return;
    await sealBatches(account);
    for (const batch of await pendingBatches(account)) {
      if (owner !== account || authenticationPaused === account) return;
      if (batch.blocked || batch.retryAt > Date.now()) continue;
      if (!(await upload(batch))) return;
    }
  } catch {
    console.warn('Gameplay logging flush failed; pending data was retained.');
  } finally {
    active = false;
  }
}
