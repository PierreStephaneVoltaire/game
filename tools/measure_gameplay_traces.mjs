import { createServer } from 'vite';
import { gzipSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
import process from 'node:process';

const server = await createServer({ server: { middlewareMode: true } });
try {
  const { GameController } = await server.ssrLoadModule(
    '/src/lib/game-controller.ts',
  );
  const { BUNDLED_GAME_DEFINITION: definition } = await server.ssrLoadModule(
    '/src/lib/test-game-definition.ts',
  );
  const { GameplayCapture } = await server.ssrLoadModule(
    '/src/lib/telemetry/capture.ts',
  );
  const { fragments, makeBatches, json, byteLength } =
    await server.ssrLoadModule('/src/lib/telemetry/batches.ts');
  const sessions = [];
  let sample;
  for (const mode of ['realtime', 'streaming']) {
    for (const seed of ['00421873', '12345678', '87654321']) {
      const operations = [];
      const controller = new GameController(
        { load: async () => definition },
        new GameplayCapture((operation) => operations.push(operation)),
      );
      let run = 0;
      const start = async () =>
        controller.start({
          mode,
          now: 1_800_000_000_000 + run++ * 86_400_000,
          seed,
          timezone: 'America/Toronto',
        });
      await start();
      const started = performance.now();
      for (let action = 0; action < 60; action++) {
        if (controller.current.ending) await start();
        const before = controller.current;
        if (mode === 'realtime')
          await controller.reconcile(before.now + 60_000);
        const state = controller.current;
        const itemId = Object.keys(state.inventory).find(
          (id) =>
            state.inventory[id] > 0 &&
            definition.items.find((item) => item.id === id)?.edible,
        );
        const type =
          action % 5 === 0 && itemId
            ? 'use_item'
            : ['wait', 'rest', 'socialize', 'play'][action % 4];
        await controller.dispatch({
          type,
          ...(type === 'use_item' ? { itemId } : {}),
          commandId: `measured-${action}`,
          now: state.now,
        });
      }
      const captureMs = performance.now() - started;
      const batches = makeBatches(operations.flatMap(fragments));
      const bytes = batches.map((batch) => json(batch));
      sessions.push({
        mode,
        seed,
        wallSessionMinutes: 60,
        actions: 60,
        runs: run,
        operations: operations.length,
        calculations: operations.reduce(
          (sum, operation) => sum + operation.calculations.length,
          0,
        ),
        uncompressedBytes: bytes.reduce(
          (sum, body) => sum + byteLength(body),
          0,
        ),
        compressedBytes: bytes.reduce(
          (sum, body) => sum + gzipSync(body).byteLength,
          0,
        ),
        batches: batches.length,
        tableRows: batches.reduce(
          (sum, batch) => sum + batch.records.length,
          0,
        ),
        captureMs: Math.round(captureMs),
      });
      sample ??= bytes[0];
    }
  }
  const report = { measuredAt: new Date().toISOString(), sessions };
  console.log(JSON.stringify(report, null, 2));
  if (process.argv[2])
    await writeFile(process.argv[2], JSON.stringify(report, null, 2));
  if (process.argv[3]) await writeFile(process.argv[3], sample);
} finally {
  await server.close();
}
