import { completed, openVirtualPetDb, read } from './indexed-db';

export async function waitForWriteSlot(gameHash: string): Promise<void> {
  const db = await openVirtualPetDb();
  if (!db) return;
  const key = `lastSaveAttempt:${gameHash}`;
  const transaction = db.transaction('metadata', 'readonly');
  const record = (await read(transaction.objectStore('metadata').get(key))) as
    { value: number } | undefined;
  await completed(transaction);
  const delay = Math.max(0, (record?.value ?? 0) + 5000 - Date.now());
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  const write = db.transaction('metadata', 'readwrite');
  write.objectStore('metadata').put({ key, value: Date.now() });
  await completed(write);
  db.close();
}
