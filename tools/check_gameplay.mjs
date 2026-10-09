import { installSaveServer } from './gameplay-check-server.mjs';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import {
  hydrateInFreshBrowser,
  overlappingTransitions,
  prepare,
  records,
  transition,
  verifyLegacyClockSave,
} from './gameplay-check-helpers.mjs';

const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const browser = await chromium.launch();
const origin = server.resolvedUrls.local[0];
const context = await browser.newContext();
const page = await context.newPage();
const serverState = await installSaveServer(context);
const { requests, createSeen, releaseCreate } = serverState;

await context.route('**/gameplay-check', (route) =>
  route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>Gameplay check</title><script type="module" src="/@vite/client"></script>',
  }),
);
await page.goto(`${origin}gameplay-check`);

try {
  const firstCommandId = await page.evaluate(async () => {
    const { UiCommandSequence } =
      await import('/src/lib/ui/command-sequence.ts');
    return new UiCommandSequence().next();
  });
  await page.reload();
  const secondCommandId = await page.evaluate(async () => {
    const { UiCommandSequence } =
      await import('/src/lib/ui/command-sequence.ts');
    return new UiCommandSequence().next();
  });
  assert.notEqual(firstCommandId, secondCommandId);

  const base = await prepare(page, '10000001');
  await overlappingTransitions(page, base, base.now + 1000, base.now + 2000);
  const overlap = await records(page, base.seed);
  assert.equal(overlap.games.state.events.at(-1).id, 'overlap-two-event');
  assert.deepEqual(
    overlap.events.map((event) => event.sequence),
    [1, 2, 3],
  );
  assert.equal(overlap.pending.flatMap((batch) => batch.commands).length, 2);

  const delayedBase = await prepare(page, '10000002');
  serverState.holdCreate = true;
  const delayedFlush = page.evaluate(async (seed) => {
    const { flushGame } = await import('/src/lib/persistence/sync.ts');
    await flushGame(seed);
  }, delayedBase.seed);
  await createSeen;
  const delayedAfter = await transition(
    page,
    delayedBase,
    1,
    'while-create-waits',
    delayedBase.now + 1000,
  );
  releaseCreate();
  await delayedFlush;
  serverState.holdCreate = false;
  const delayed = await records(page, delayedBase.seed);
  assert.equal(
    delayed.games.state.events.at(-1).id,
    delayedAfter.events.at(-1).id,
  );
  assert.equal(delayed.pending.length, 0);
  assert(requests.some((request) => JSON.parse(request.body).creationBatchId));
  assert(requests.some((request) => JSON.parse(request.body).batchId));

  requests.length = 0;
  const retryBase = await prepare(page, '10000003');
  const retryAfter = await transition(
    page,
    retryBase,
    1,
    'retry-command',
    retryBase.now + 1000,
  );
  serverState.mode = 'lost-ack';
  await page.evaluate(async (seed) => {
    const { flushGame } = await import('/src/lib/persistence/sync.ts');
    await flushGame(seed);
  }, retryBase.seed);
  const held = (await records(page, retryBase.seed)).pending;
  assert(held.length > 0);
  serverState.mode = 'success';
  await page.evaluate(async (seed) => {
    const { flushGame } = await import('/src/lib/persistence/sync.ts');
    await flushGame(seed);
  }, retryBase.seed);
  assert.equal(requests[0].requestId, requests[1].requestId);
  assert.equal(requests[0].body, requests[1].body);
  assert.equal((await records(page, retryBase.seed)).pending.length, 0);
  assert.equal(
    retryAfter.events.at(-1).id,
    JSON.parse(requests[0].body).events.at(-1).eventId,
  );

  await page.evaluate(async () => {
    const { beginGameSession, sendGameIntent, useGameDefinitionRepository } =
      await import('/src/lib/game-session.ts');
    const { BUNDLED_GAME_DEFINITION } =
      await import('/src/lib/test-game-definition.ts');
    const { loadGame } = await import('/src/lib/persistence/games.ts');
    const originalNow = Date.now;
    const startedAt = 1_800_000_000_000;
    let now = startedAt;
    let loads = 0;
    Date.now = () => now;
    try {
      useGameDefinitionRepository({
        load: async () => {
          if (++loads === 2) now = startedAt + 7_200_001;
          return BUNDLED_GAME_DEFINITION;
        },
      });
      await beginGameSession('realtime', '10000004');
      now = startedAt + 7_199_999;
      const outcome = await sendGameIntent({ type: 'play' });
      if (outcome.kind === 'stale')
        throw new Error('Boundary crossing rejected its own action');
      const stored = await loadGame('10000004');
      if (stored.state.now !== startedAt + 7_199_999)
        throw new Error('Action used unreconciled wall time');
      if (
        !stored.state.events.some((event) =>
          event.sourceActionId?.startsWith('ui-'),
        )
      )
        throw new Error('Action was not persisted');
    } finally {
      Date.now = originalNow;
    }
  });

  const tabBase = await prepare(page, '10000007');
  const otherTab = await context.newPage();
  await otherTab.goto(`${origin}gameplay-check`);
  const beforeTabs = requests.length;
  const flush = async (seed) => {
    const { flushGame } = await import('/src/lib/persistence/sync.ts');
    await flushGame(seed);
  };
  await Promise.all([
    page.evaluate(flush, tabBase.seed),
    otherTab.evaluate(flush, tabBase.seed),
  ]);
  assert.equal(requests.length - beforeTabs, 1);
  await otherTab.close();

  requests.length = 0;
  serverState.mode = 'competing';
  const competingBase = await prepare(page, '10000005');
  const competingAfter = await transition(
    page,
    competingBase,
    1,
    'losing-command',
    competingBase.now + 1000,
  );
  const remote = {
    gameHash: competingBase.seed,
    stateVersion: 8,
    lastEventSequence: 1,
    lastEventId: 'server-winning-event',
    latestCommittedBatchId: 'server-winning-batch',
    state: {
      ...competingAfter,
      balance: competingAfter.balance + 77,
      events: [],
    },
  };
  const remoteEvent = {
    sequence: 1,
    eventId: 'server-winning-event',
    eventType: 'server_winner',
    eventAt: new Date(competingBase.now + 7000).toISOString(),
    payload: { message: 'Server state wins', sourceActionId: 'server-winner' },
  };
  serverState.remoteGame = remote;
  serverState.historyPage = [remoteEvent];
  await page.evaluate(async (seed) => {
    const { flushGame } = await import('/src/lib/persistence/sync.ts');
    const { cacheRemoteGame } = await import('/src/lib/persistence/remote.ts');
    await flushGame(seed, {
      adoptRemote: async (game) => cacheRemoteGame(game, true),
    });
  }, competingBase.seed);
  const adopted = await records(page, competingBase.seed);
  assert.equal(adopted.pending.length, 0);
  assert.equal(adopted.games.state.balance, remote.state.balance);
  assert.deepEqual(
    adopted.games.state.events.map((event) => event.id),
    ['server-winning-event'],
  );

  const hydrationBase = { ...competingBase, seed: '10000006', events: [] };
  const historyState = {
    ...competingBase,
    seed: hydrationBase.seed,
    events: [],
  };
  serverState.remoteGame = undefined;
  serverState.historyPage = undefined;
  const hydrationHistory = Array.from({ length: 205 }, (_, index) => ({
    id: `history-${index + 1}`,
    type: index ? 'time_reconciled' : 'run_started',
    at: historyState.now + index * 1000,
    message: 'Recorded history',
  }));
  serverState.remoteGame = {
    gameHash: historyState.seed,
    stateVersion: 5,
    lastEventSequence: hydrationHistory.length,
    lastEventId: hydrationHistory.at(-1).id,
    state: { ...historyState, events: [] },
  };
  serverState.historyPage = hydrationHistory.map((event, index) => ({
    sequence: index + 1,
    eventId: event.id,
    eventType: event.type,
    eventAt: new Date(event.at).toISOString(),
    payload: Object.fromEntries(
      Object.entries(event).filter(
        ([key]) => !['id', 'type', 'at'].includes(key),
      ),
    ),
  }));
  const opened = await hydrateInFreshBrowser(
    browser,
    origin,
    serverState.remoteGame,
    serverState.historyPage,
    hydrationBase,
  );
  assert.equal(opened.succeeded, true);
  assert.deepEqual(
    opened.events,
    hydrationHistory.map((event) => event.id),
  );
  assert.deepEqual(opened.cached.events, opened.events);
  assert.equal(opened.cached.stateVersion, 5);

  const legacyBase = await prepare(page, '10000008');
  await verifyLegacyClockSave(page, legacyBase);
  assert.deepEqual(serverState.violations, []);
  assert.equal(serverState.games.get(retryBase.seed).batches.size, 1);
  assert.equal(
    serverState.games.get(retryBase.seed).events.length,
    retryAfter.events.length,
  );
  console.log(
    'Gameplay browser checks passed: command ID uniqueness, overlapping writes, delayed creation, exact retry, boundary timestamps, server-winning adoption, and fresh history hydration.',
  );
} finally {
  await browser.close();
  await server.close();
}
