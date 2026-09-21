import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const origin = server.resolvedUrls.local[0];
  await page.route('**/telemetry-check', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Logging check</title><script type="module" src="/@vite/client"></script>',
    }),
  );
  let responseMode = 'offline';
  const requests = [];
  await page.route('**/api/telemetry/batches', async (route) => {
    const request = route.request();
    requests.push({
      body: request.postData(),
      owner: request.headers()['x-telemetry-owner'],
      digest: request.headers()['x-content-digest'],
    });
    if (responseMode === 'offline') return route.abort('internetdisconnected');
    if (responseMode === 'auth')
      return route.fulfill({ status: 401, body: '{}' });
    if (responseMode === 'invalid')
      return route.fulfill({ status: 422, body: '{}' });
    const body = JSON.parse(request.postData());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        batchId: body.batchId,
        digest:
          responseMode === 'lost-ack'
            ? 'wrong-digest'
            : request.headers()['x-content-digest'],
      }),
    });
  });
  await page.goto(`${origin}telemetry-check`);
  await page.evaluate(async () => {
    const { GameController } = await import('/src/lib/game-controller.ts');
    const { BUNDLED_GAME_DEFINITION } =
      await import('/src/lib/test-game-definition.ts');
    const { GameplayCapture } = await import('/src/lib/telemetry/capture.ts');
    const { enqueueOperation, persistMemory } =
      await import('/src/lib/telemetry/outbox.ts');
    const controller = new GameController(
      { load: async () => BUNDLED_GAME_DEFINITION },
      new GameplayCapture((operation) =>
        enqueueOperation('account-a', operation),
      ),
    );
    await controller.start({
      mode: 'streaming',
      now: 1_800_000_000_000,
      seed: '00421873',
      timezone: 'UTC',
    });
    await persistMemory();
  });
  await page.reload();
  async function flush(account = 'account-a') {
    await page.evaluate(async (account) => {
      const { setLoggingAccount, flushLogging } =
        await import('/src/lib/telemetry/delivery.ts');
      const { openLoggingDb } = await import('/src/lib/telemetry/outbox.ts');
      const db = await openLoggingDb();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction('batches', 'readwrite');
        const store = transaction.objectStore('batches');
        const request = store.getAll();
        request.onsuccess = () => {
          for (const batch of request.result)
            store.put({ ...batch, retryAt: 0 });
        };
        transaction.oncomplete = resolve;
        transaction.onerror = reject;
      });
      setLoggingAccount(account);
      await new Promise((resolve) => setTimeout(resolve, 500));
      await flushLogging();
    }, account);
  }
  async function pending() {
    return page.evaluate(async () => {
      const { pendingBatches } = await import('/src/lib/telemetry/outbox.ts');
      return pendingBatches('account-a');
    });
  }
  await flush();
  const failed = await pending();
  assert(failed.length > 0);
  assert(failed.some((batch) => batch.retryCount > 0));
  const firstRequest = requests[0];
  assert(
    JSON.parse(firstRequest.body).records.every((record) =>
      /^[0-9a-f]{64}$/.test(record.engineBuild),
    ),
  );
  responseMode = 'lost-ack';
  await flush();
  assert.equal((await pending()).length, failed.length);
  assert(
    requests.every((request) =>
      failed.some(
        (batch) =>
          batch.body === request.body && batch.digest === request.digest,
      ),
    ),
  );
  responseMode = 'auth';
  await flush();
  const authRequests = requests.length;
  await page.evaluate(async () => {
    const { flushLogging } = await import('/src/lib/telemetry/delivery.ts');
    await flushLogging();
  });
  assert.equal(requests.length, authRequests);
  responseMode = 'success';
  await flush('account-b');
  assert.equal(requests.length, authRequests);
  assert.equal((await pending()).length, failed.length);
  await page.reload();
  await flush();
  assert.equal((await pending()).length, 0);
  assert(requests.every((request) => request.owner === 'account-a'));
  assert(
    requests.every((request) =>
      failed.some(
        (batch) =>
          batch.body === request.body && batch.digest === request.digest,
      ),
    ),
  );
  assert(
    requests.filter((request) => request.digest === firstRequest.digest)
      .length >= 2,
  );
  await page.evaluate(async () => {
    const { openLoggingDb } = await import('/src/lib/telemetry/outbox.ts');
    const db = await openLoggingDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('batches', 'readwrite');
      transaction.objectStore('batches').put({
        batchId: crypto.randomUUID(),
        owner: 'account-a',
        body: '{}',
        digest: 'invalid',
        retryCount: 0,
        retryAt: 0,
        blocked: null,
        createdAt: Date.now(),
      });
      transaction.oncomplete = resolve;
      transaction.onerror = reject;
    });
  });
  responseMode = 'invalid';
  await flush();
  assert.equal((await pending())[0].blocked, 'http_422');
  console.log(
    'Logging browser checks passed: reload, offline retry, lost acknowledgment, account isolation, authentication pause, rejected-data retention.',
  );
} finally {
  await browser.close();
  await server.close();
}
