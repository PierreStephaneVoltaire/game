export async function prepare(page, seed) {
  return page.evaluate(async (seed) => {
    const { GameController } = await import('/src/lib/game-controller.ts');
    const { BUNDLED_GAME_DEFINITION } =
      await import('/src/lib/test-game-definition.ts');
    const { saveNewGame } = await import('/src/lib/persistence/games.ts');
    const controller = new GameController({
      load: async () => BUNDLED_GAME_DEFINITION,
    });
    const state = await controller.start({
      mode: 'realtime',
      now: 1_800_000_000_000,
      seed,
      timezone: 'UTC',
    });
    await saveNewGame(state);
    return state;
  }, seed);
}

export async function records(page, seed) {
  return page.evaluate(async (seed) => {
    const { openVirtualPetDb, completed, read } =
      await import('/src/lib/persistence/indexed-db.ts');
    const db = await openVirtualPetDb();
    const transaction = db.transaction(
      ['games', 'outbox', 'gameEvents'],
      'readonly',
    );
    const games = await read(transaction.objectStore('games').get(seed));
    const pending = await read(
      transaction
        .objectStore('outbox')
        .index('gameHash')
        .getAll(IDBKeyRange.only(seed)),
    );
    const events = await read(
      transaction
        .objectStore('gameEvents')
        .index('gameHash')
        .getAll(IDBKeyRange.only(seed)),
    );
    await completed(transaction);
    db.close();
    return { games, pending, events };
  }, seed);
}

export async function transition(page, before, count, commandId, at) {
  return page.evaluate(
    async ({ before, count, commandId, at }) => {
      const { saveTransition } = await import('/src/lib/persistence/games.ts');
      const events = Array.from({ length: count }, (_, index) => ({
        id: `${commandId}-event-${index}`,
        type: 'test_transition',
        at,
        message: 'Persistence regression event',
        sourceActionId: commandId,
      }));
      const after = {
        ...before,
        stateVersion: before.stateVersion + 1,
        events: [...before.events, ...events],
        lastResolvedAt: at,
      };
      await saveTransition(before, after, { type: 'wait', commandId, now: at });
      return after;
    },
    { before, count, commandId, at },
  );
}

export async function overlappingTransitions(page, before, firstAt, secondAt) {
  return page.evaluate(
    async ({ before, firstAt, secondAt }) => {
      const { saveTransition } = await import('/src/lib/persistence/games.ts');
      const advance = (state, commandId, at) => ({
        ...state,
        stateVersion: state.stateVersion + 1,
        events: [
          ...state.events,
          {
            id: `${commandId}-event`,
            type: 'test_transition',
            at,
            message: 'Persistence regression event',
            sourceActionId: commandId,
          },
        ],
        lastResolvedAt: at,
      });
      const first = advance(before, 'overlap-one', firstAt);
      const second = advance(first, 'overlap-two', secondAt);
      await Promise.all([
        saveTransition(before, first, {
          type: 'wait',
          commandId: 'overlap-one',
          now: firstAt,
        }),
        saveTransition(first, second, {
          type: 'wait',
          commandId: 'overlap-two',
          now: secondAt,
        }),
      ]);
      return second;
    },
    { before, firstAt, secondAt },
  );
}

export async function hydrateInFreshBrowser(
  browser,
  origin,
  remote,
  history,
  state,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await context.route('**/api/games**', (route) => {
    const url = new URL(route.request().url());
    if (
      route.request().method() === 'GET' &&
      url.pathname.endsWith('/events')
    ) {
      const limit = Number(url.searchParams.get('limit'));
      if (!(limit > 0 && limit <= 100))
        return route.fulfill({ status: 422, body: '{}' });
      const start = Number(
        route.request().headers()['x-continuation-token'] ?? 0,
      );
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          items: history.slice(start, start + limit),
          continuationToken:
            start + limit < history.length ? String(start + limit) : null,
        }),
      });
    }
    if (route.request().method() === 'GET')
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(remote),
      });
    return route.fulfill({ status: 500, body: '{}' });
  });
  await context.route('**/api/content/manifest', (route) =>
    route.fulfill({ status: 503, body: '{}' }),
  );
  await context.route('**/src/lib/local-development.ts', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: 'export function isLocalDevelopment() { return false; }',
    }),
  );
  await page.route('**/gameplay-check', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Gameplay check</title><script type="module" src="/@vite/client"></script>',
    }),
  );
  await page.goto(`${origin}gameplay-check`);
  const opened = await page.evaluate(async (gameState) => {
    const {
      useGameDefinitionRepository,
      openGameSession,
      companionSpeechSession,
    } = await import('/src/lib/game-session.ts');
    const { BUNDLED_GAME_DEFINITION } =
      await import('/src/lib/test-game-definition.ts');
    useGameDefinitionRepository({ load: async () => BUNDLED_GAME_DEFINITION });
    const loaded = new Promise((resolve) => {
      const unsubscribe = companionSpeechSession.subscribe((session) => {
        if (!session) return;
        unsubscribe();
        resolve(session.state.events.map((event) => event.id));
      });
    });
    const succeeded = await openGameSession(gameState.seed);
    if (!succeeded) throw new Error('Fresh game open failed');
    const { loadGame } = await import('/src/lib/persistence/games.ts');
    const cached = await loadGame(gameState.seed);
    return {
      succeeded,
      events: await loaded,
      cached: {
        stateVersion: cached.stateVersion,
        events: cached.state.events.map((event) => event.id),
      },
    };
  }, state);
  await context.route('**/api/games**', (route) =>
    route.abort('internetdisconnected'),
  );
  const offlineOpened = await page.evaluate(async (seed) => {
    const { openGameSession } = await import('/src/lib/game-session.ts');
    return openGameSession(seed);
  }, state.seed);
  if (!offlineOpened)
    throw new Error('The downloaded cache could not reopen offline');
  await context.close();
  return opened;
}

export async function verifyLegacyClockSave(page, state) {
  await page.evaluate(async (state) => {
    const { nextOutbox, markSent, acknowledge } =
      await import('/src/lib/persistence/outbox.ts');
    const { openVirtualPetDb, read, completed } =
      await import('/src/lib/persistence/indexed-db.ts');
    const pending = await nextOutbox(state.seed);
    const sent = await markSent(pending);
    const db = await openVirtualPetDb();
    const transaction = db.transaction(['outbox', 'games'], 'readwrite');
    const game = await read(transaction.objectStore('games').get(state.seed));
    const after = {
      ...sent.targetState,
      now: sent.targetState.now + 1,
      lastResolvedAt: sent.targetState.lastResolvedAt + 1,
    };
    transaction.objectStore('games').put({ ...game, state: after });
    transaction.objectStore('outbox').put({ ...sent, targetState: after });
    await completed(transaction);
    db.close();
    await acknowledge(sent, {
      gameHash: state.seed,
      stateVersion: 0,
      committedThroughSequence: sent.events.length,
      committedThroughEventId: sent.events.at(-1).id,
    });
    const remaining = await nextOutbox(state.seed);
    if (
      !remaining ||
      remaining.batchId === sent.batchId ||
      remaining.targetState.now !== after.now
    )
      throw new Error(
        'A legacy acknowledgement lost the later clock-only save',
      );
  }, state);
}
