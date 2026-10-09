import assert from 'node:assert/strict';

export async function installSaveServer(context) {
  let createArrived, releaseCreate;
  const createSeen = new Promise((resolve) => (createArrived = resolve));
  const createGate = new Promise((resolve) => (releaseCreate = resolve));
  const control = {
    mode: 'success',
    holdCreate: false,
    createSeen,
    releaseCreate,
    remoteGame: null,
    historyPage: [],
    requests: [],
    violations: [],
    games: new Map(),
  };
  await context.route('**/api/games**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const respond = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    if (request.method() === 'GET') {
      if (url.pathname.endsWith('/events')) {
        const limit = Number(url.searchParams.get('limit'));
        if (!(limit > 0 && limit <= 100)) return respond({}, 422);
        const start = Number(request.headers()['x-continuation-token'] ?? 0);
        const end = start + limit;
        return respond({
          items: control.historyPage.slice(start, end),
          continuationToken:
            end < control.historyPage.length ? String(end) : null,
        });
      }
      return respond(control.remoteGame);
    }
    const body = request.postDataJSON();
    control.requests.push({
      body: request.postData(),
      requestId: request.headers()['x-request-id'],
      version: request.headers()['if-match'],
      at: Date.now(),
    });
    if (body.creationBatchId && control.holdCreate) {
      createArrived();
      await createGate;
    }
    if (control.mode === 'competing')
      return respond(
        { error: { code: 'STALE_STATE', message: 'A newer save exists.' } },
        412,
      );
    try {
      const key = body.gameHash ?? request.headers()['x-game-key'];
      const id = body.creationBatchId ?? body.batchId;
      const existing = control.games.get(key);
      const previous = existing?.batches.get(id);
      let ack;
      if (previous) {
        assert.equal(previous.body, request.postData());
        ack = previous.ack;
      } else {
        const events = existing?.events ?? [];
        assert.equal(Boolean(body.creationBatchId), !existing);
        if (existing) {
          assert.equal(request.headers()['if-match'], `"${existing.version}"`);
          assert.equal(body.previousEventId, events.at(-1)?.eventId ?? null);
        }
        assert(body.events.length <= 500);
        body.events.forEach((event, index) => {
          assert.equal(event.sequence, events.length + index + 1);
          assert(!events.some((stored) => stored.eventId === event.eventId));
        });
        const all = [...events, ...body.events];
        const version = existing ? existing.version + 1 : 0;
        ack = {
          gameHash: key,
          stateVersion: version,
          committedThroughSequence: all.length,
          committedThroughEventId: all.at(-1)?.eventId ?? null,
          latestCommittedBatchId: id,
        };
        const batches = existing?.batches ?? new Map();
        batches.set(id, { body: request.postData(), ack });
        control.games.set(key, {
          version,
          events: all,
          batches,
          state: body.state ?? body.targetState,
        });
      }
      if (control.mode === 'lost-ack' && control.requests.length === 1)
        return route.abort('connectionreset');
      return respond(ack);
    } catch (error) {
      control.violations.push(String(error));
      return respond({ error: { code: 'TEST_PROTOCOL_FAILURE' } }, 400);
    }
  });
  return control;
}
