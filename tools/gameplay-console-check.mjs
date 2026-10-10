import assert from 'node:assert/strict';

export async function verifyConsoleAndPublications(page) {
  const results = await page.evaluate(async () => {
    const {
      beginGameSession,
      sendGameIntent,
      reconcileGameClock,
      companionSpeechSession,
      useGameDefinitionRepository,
    } = await import('/src/lib/game-session.ts');
    const { BUNDLED_GAME_DEFINITION } =
      await import('/src/lib/test-game-definition.ts');
    const { loadGame, saveTransition } =
      await import('/src/lib/persistence/games.ts');
    const originalNow = Date.now;
    const originalLog = console.log;
    let now = 1_800_000_000_000;
    const logs = [];
    const publications = [];
    const unsubscribe = companionSpeechSession.subscribe((value) =>
      publications.push(value),
    );
    Date.now = () => now;
    console.log = (message, detail) => logs.push({ message, detail });
    try {
      const results = [];
      useGameDefinitionRepository({
        load: async () => BUNDLED_GAME_DEFINITION,
      });
      for (const mode of ['realtime', 'streaming']) {
        logs.length = 0;
        await beginGameSession(
          mode,
          mode === 'realtime' ? '20000001' : '20000002',
        );
        const before = publications.at(-1).state;
        const initialEvents = logs.filter((log) =>
          log.message.startsWith('[gameplay] event'),
        ).length;
        logs.length = 0;
        publications.length = 0;
        now += 7_200_000;
        await sendGameIntent({ type: 'play' });
        const after = publications.at(-1).state;
        const actionPublications = publications.length;
        const metricLogs = logs.filter((log) =>
          log.message.startsWith('[gameplay] metric'),
        );
        const eventIds = logs
          .filter((log) => log.message.startsWith('[gameplay] event'))
          .map((log) => log.detail.event.id);
        const deltas = Object.fromEntries(
          Object.keys(before.metrics).map((metric) => [
            metric,
            metricLogs
              .filter((log) => log.detail.metric === metric)
              .reduce((sum, log) => sum + log.detail.delta, 0),
          ]),
        );
        const stored = await loadGame(after.seed);
        logs.length = 0;
        publications.length = 0;
        await Promise.all([
          reconcileGameClock(),
          reconcileGameClock(),
          reconcileGameClock(),
        ]);
        results.push({
          mode,
          initialEvents,
          expectedInitialEvents: before.events.length,
          actionPublications,
          eventIds,
          expectedEventIds: after.events
            .slice(before.events.length)
            .map((event) => event.id),
          deltas,
          expectedDeltas: Object.fromEntries(
            Object.keys(before.metrics).map((metric) => [
              metric,
              after.metrics[metric] - before.metrics[metric],
            ]),
          ),
          metricsPersisted:
            JSON.stringify(stored.state.metrics) ===
            JSON.stringify(after.metrics),
          repeatedPublications: publications.length,
          repeatedLogs: logs.length,
        });
        const otherTab = { ...after, metrics: { ...after.metrics, food: 3 } };
        await saveTransition(after, otherTab);
        logs.length = 0;
        publications.length = 0;
        await sendGameIntent({ type: 'play' });
        results.at(-1).refreshPublications = publications.length;
        results.at(-1).refreshLogged = logs.some(
          (log) =>
            log.message.startsWith('[gameplay] metric food') &&
            log.detail.reason.includes('Saved state loaded'),
        );
      }
      return results;
    } finally {
      Date.now = originalNow;
      console.log = originalLog;
      unsubscribe();
    }
  });
  for (const result of results) {
    assert.equal(
      result.actionPublications,
      1,
      `${result.mode} action publications`,
    );
    assert.equal(
      result.initialEvents,
      result.expectedInitialEvents,
      `${result.mode} initialization events`,
    );
    assert.deepEqual(
      result.eventIds,
      result.expectedEventIds,
      `${result.mode} console event history`,
    );
    assert.deepEqual(
      result.deltas,
      result.expectedDeltas,
      `${result.mode} applied console metric totals`,
    );
    assert.equal(result.metricsPersisted, true);
    assert.equal(result.repeatedPublications, 0);
    assert.equal(result.repeatedLogs, 0);
    assert.equal(result.refreshPublications, 1);
    assert.equal(result.refreshLogged, true);
  }
}
