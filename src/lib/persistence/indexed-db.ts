export const DATABASE_NAME = 'game-data';
const DATABASE_VERSION = 1;

function addIndex(
  store: IDBObjectStore,
  name: string,
  keyPath: string | string[],
): void {
  if (!store.indexNames.contains(name)) store.createIndex(name, keyPath);
}

export function openVirtualPetDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const games = database.objectStoreNames.contains('games')
        ? request.transaction!.objectStore('games')
        : database.createObjectStore('games', { keyPath: 'gameHash' });
      addIndex(games, 'updatedAt', 'updatedAt');
      const events = database.objectStoreNames.contains('gameEvents')
        ? request.transaction!.objectStore('gameEvents')
        : database.createObjectStore('gameEvents', {
            keyPath: ['gameHash', 'sequence'],
          });
      addIndex(events, 'gameHash', 'gameHash');
      const outbox = database.objectStoreNames.contains('outbox')
        ? request.transaction!.objectStore('outbox')
        : database.createObjectStore('outbox', { keyPath: 'batchId' });
      addIndex(outbox, 'gameHash', 'gameHash');
      if (!database.objectStoreNames.contains('content'))
        database.createObjectStore('content', { keyPath: 'version' });
      if (!database.objectStoreNames.contains('metadata'))
        database.createObjectStore('metadata', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
  });
}

export function read<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
