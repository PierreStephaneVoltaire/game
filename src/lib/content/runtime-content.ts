import {
  gameDefinitionFromBundle,
  type GameDefinition,
  type GameDefinitionRepository,
  type RuntimeContentBundle,
} from '$lib/game-definition';
import { openVirtualPetDb } from '$lib/persistence/indexed-db';

const CONTENT_STORE = 'content';
const METADATA_STORE = 'metadata';
const ACTIVE_VERSION_KEY = 'activeContentVersion';

type Metadata = { key: typeof ACTIVE_VERSION_KEY; value: string };

export class RuntimeContentUnavailableError extends Error {
  constructor() {
    super(
      'Runtime content is unavailable. Connect once before starting a game.',
    );
  }
}

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });
}

function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error);
  });
}

export class RuntimeContentCache implements GameDefinitionRepository {
  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly apiBase = '/api/content',
  ) {}

  async load(): Promise<GameDefinition> {
    const bundle = await this.cachedBundle();
    return gameDefinitionFromBundle(bundle ?? (await this.refresh()));
  }

  /** Fetch only when there is no cached definition; cache hits never redownload. */
  async hydrate(): Promise<GameDefinition> {
    return this.load();
  }

  /** Call before each game-write flush; 304 leaves IndexedDB untouched. */
  async refreshBeforeWrite(): Promise<GameDefinition> {
    const cached = await this.cachedBundle();
    return gameDefinitionFromBundle(await this.refresh(cached?.version));
  }

  private async refresh(cachedVersion?: string): Promise<RuntimeContentBundle> {
    let manifest: Response;
    try {
      manifest = await this.fetcher(`${this.apiBase}/manifest`, {
        headers: cachedVersion ? { 'If-None-Match': `"${cachedVersion}"` } : {},
      });
    } catch {
      const cached = await this.cachedBundle();
      if (cached) return cached;
      throw new RuntimeContentUnavailableError();
    }
    if (manifest.status === 304) {
      const cached = await this.cachedBundle();
      if (cached) return cached;
      throw new RuntimeContentUnavailableError();
    }
    if (!manifest.ok) throw new Error('Could not check runtime content.');
    const { version } = (await manifest.json()) as { version: string };
    const existing = await this.bundle(version);
    if (existing) {
      await this.replace(existing);
      return existing;
    }
    const response = await this.fetcher(
      `${this.apiBase}/${encodeURIComponent(version)}`,
    );
    if (!response.ok) throw new Error('Could not load runtime content.');
    const bundle = (await response.json()) as RuntimeContentBundle;
    if (bundle.version !== version)
      throw new Error('Runtime content version mismatch.');
    await this.replace(bundle);
    return bundle;
  }

  private async database(): Promise<IDBDatabase> {
    const database = await openVirtualPetDb();
    if (!database) throw new RuntimeContentUnavailableError();
    return database;
  }

  private async cachedBundle(): Promise<RuntimeContentBundle | undefined> {
    const database = await this.database();
    const transaction = database.transaction(
      [CONTENT_STORE, METADATA_STORE],
      'readonly',
    );
    const version = await request(
      transaction.objectStore(METADATA_STORE).get(ACTIVE_VERSION_KEY),
    ).then((value) => (value as Metadata | undefined)?.value);
    const bundle = version
      ? await request(transaction.objectStore(CONTENT_STORE).get(version))
      : undefined;
    await completed(transaction);
    return bundle as RuntimeContentBundle | undefined;
  }

  private async bundle(
    version: string,
  ): Promise<RuntimeContentBundle | undefined> {
    const database = await this.database();
    const transaction = database.transaction(CONTENT_STORE, 'readonly');
    const bundle = await request(
      transaction.objectStore(CONTENT_STORE).get(version),
    );
    await completed(transaction);
    return bundle as RuntimeContentBundle | undefined;
  }

  private async replace(bundle: RuntimeContentBundle): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(
      [CONTENT_STORE, METADATA_STORE],
      'readwrite',
    );
    transaction.objectStore(CONTENT_STORE).put(bundle);
    transaction.objectStore(METADATA_STORE).put({
      key: ACTIVE_VERSION_KEY,
      value: bundle.version,
    } satisfies Metadata);
    await completed(transaction);
  }
}
