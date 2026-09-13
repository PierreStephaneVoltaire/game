import { expect, test } from 'vitest';
import { GameController } from '../game-controller';
import { BUNDLED_GAME_DEFINITION as definition } from '../test-game-definition';
import { GameplayCapture, type Operation } from './capture';

test('account changes pause original capture and resume with an explicit coverage correction', async () => {
  let ownerActive = true;
  const operations: Operation[] = [];
  const capture = new GameplayCapture(
    (operation) => operations.push(operation),
    () => ownerActive,
  );
  const controller = new GameController(
    { load: async () => definition },
    capture,
  );
  await controller.start({
    mode: 'streaming',
    now: 1_800_000_000_000,
    seed: '00421873',
    timezone: 'UTC',
  });
  const count = operations.length;
  ownerActive = false;
  await controller.dispatch({
    type: 'wait',
    commandId: 'another-account',
    now: controller.current!.now,
  });
  expect(operations).toHaveLength(count);
  ownerActive = true;
  await controller.dispatch({
    type: 'wait',
    commandId: 'original-account',
    now: controller.current!.now,
  });
  expect(operations[count]).toMatchObject({
    kind: 'checkpoint',
    input: { resumedAfterAccountChange: true },
  });
  expect(
    operations
      .filter((operation) => operation.kind === 'command')
      .map((operation) => (operation.input as { commandId: string }).commandId),
  ).toEqual(['original-account']);
});
