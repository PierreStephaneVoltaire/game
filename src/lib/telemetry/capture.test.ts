import { describe, expect, test, vi } from 'vitest';
import { BUNDLED_GAME_DEFINITION as definition } from '../test-game-definition';
import { GameController } from '../game-controller';
import type { GameCommand, GameState } from '../game-types';
import { createGameViewModel } from '../ui/game-view-model';
import { GameplayCapture, type Operation } from './capture';
import { applyChanges } from './state-changes';
import {
  BATCH_BYTES,
  byteLength,
  decodeTraceValue,
  fragments,
  json,
  makeBatches,
} from './batches';
import { collectCalculations, trace } from './collector';

const repository = { load: async () => definition };
const start = {
  mode: 'streaming' as const,
  now: 1_800_000_000_000,
  seed: '00421873',
  timezone: 'America/Toronto',
};

async function controllers(mode: 'realtime' | 'streaming' = 'streaming') {
  const operations: Operation[] = [];
  const logged = new GameController(
    repository,
    new GameplayCapture((operation) => operations.push(operation)),
  );
  const plain = new GameController(repository);
  await plain.start({ ...start, mode });
  await logged.start({ ...start, mode });
  return { operations, logged, plain };
}

function reconstruct(operations: Operation[]): GameState {
  let state = operations[0].checkpoint!;
  for (const operation of operations.slice(1))
    state = applyChanges(state, operation.changes);
  return state;
}

describe('gameplay traces', () => {
  test('serialized fragments reconstruct the exact save state', async () => {
    const { operations, logged } = await controllers();
    await logged.dispatch({
      type: 'wait',
      commandId: 'wire',
      now: logged.current!.now,
    });
    let reconstructed: GameState | undefined;
    for (const operation of operations) {
      const wire = JSON.parse(json(fragments(operation)));
      const payload = decodeTraceValue(
        applyChanges(
          {},
          wire.flatMap(
            (fragment: { data: import('./state-changes').Change[] }) =>
              fragment.data,
          ),
        ),
      ) as Operation;
      reconstructed =
        payload.checkpoint ?? applyChanges(reconstructed!, payload.changes);
    }
    expect(reconstructed).toEqual(logged.current);
    expect(JSON.stringify(reconstructed)).toBe(JSON.stringify(logged.current));
  });
  test.each(['streaming', 'realtime'] as const)(
    'preserves seeded %s outcomes and reconstructs actions and long clock jumps',
    async (mode) => {
      const { operations, logged, plain } = await controllers(mode);
      expect(logged.current).toEqual(plain.current);
      const water = definition.items.find((item) => item.id === 'water')!;
      const state = {
        ...plain.current!,
        balance: 40_000,
        inventory: { water: 10, 'hot-dog': 10 },
        shop: {
          ...plain.current!.shop,
          itemIds: [water.id],
          stock: { water: 20 },
          cart: {},
        },
      };
      await plain.load(state);
      await logged.load(structuredClone(state));
      const commands: Array<Omit<GameCommand, 'commandId' | 'now'>> = [
        { type: 'buy_item', itemId: 'water', quantity: 2 },
        { type: 'use_item', itemId: 'water' },
        { type: 'use_item', itemId: 'hot-dog' },
        { type: 'rest' },
        { type: 'socialize' },
        { type: 'play' },
        { type: 'medical_care' },
        { type: 'pay_medical_debt' },
        { type: 'buy_item', itemId: 'unavailable' },
        { type: 'wait' },
      ] as GameCommand[];
      for (const [index, command] of commands.entries()) {
        const input = {
          ...command,
          commandId: `trace-check-${index}`,
          now: plain.current!.now,
        } as GameCommand;
        expect(await logged.dispatch(input)).toEqual(
          await plain.dispatch(input),
        );
        expect(reconstruct(operations)).toEqual(plain.current);
        expect(JSON.stringify(logged.current)).toBe(
          JSON.stringify(plain.current),
        );
        expect(createGameViewModel(logged.current!, definition)).toEqual(
          createGameViewModel(plain.current!, definition),
        );
      }
      expect(
        await logged.reconcile(plain.current!.now + 48 * 3_600_000),
      ).toEqual(await plain.reconcile(plain.current!.now + 48 * 3_600_000));
      expect(reconstruct(operations)).toEqual(plain.current);
      expect(
        operations
          .flatMap((operation) => operation.calculations)
          .some((entry) => entry.kind === 'random_draw'),
      ).toBe(true);
      expect(
        operations
          .flatMap((operation) => operation.calculations)
          .some((entry) => entry.kind === 'range'),
      ).toBe(true);
      expect(
        operations
          .flatMap((operation) => operation.calculations)
          .some((entry) =>
            entry.ruleId.startsWith('commands/nutrition-resolution.ts:'),
          ),
      ).toBe(true);
      expect(
        operations.slice(1).every((operation) => !operation.checkpoint),
      ).toBe(true);
    },
  );

  test('records offsetting checkout transactions, prices, and a terminal transition', async () => {
    const { operations, logged, plain } = await controllers();
    const state = {
      ...plain.current!,
      balance: 500,
      shop: {
        ...plain.current!.shop,
        itemIds: ['water'],
        stock: { water: 5 },
        cart: { water: 2, 'line-of-credit': 1 },
      },
    };
    await logged.load(state);
    await plain.load(structuredClone(state));
    const command = {
      type: 'checkout_cart' as const,
      commandId: 'checkout',
      now: state.now,
    };
    expect(await logged.dispatch(command)).toEqual(
      await plain.dispatch(command),
    );
    const entries = operations.flatMap((operation) => operation.calculations);
    expect(
      entries.find((entry) => entry.kind === 'purchase')?.values,
    ).toMatchObject({
      total: 2,
      lines: [{ itemId: 'water', quantity: 2, unitPrice: 1, spending: 2 }],
    });
    expect(
      entries.find((entry) => entry.kind === 'financial_legs')?.values,
    ).toMatchObject({
      itemSpending: 2,
      applicationFee: definition.financialRules.lineOfCredit.applicationPrice,
      cashAdvance: definition.financialRules.lineOfCredit.cashAdvance,
    });
    const endingState = {
      ...logged.current!,
      balance: -19_999,
      shop: { ...logged.current!.shop, cart: { water: 2 } },
    };
    await logged.load(endingState);
    await plain.load(structuredClone(endingState));
    const ending = { ...command, commandId: 'ending', now: endingState.now };
    expect(await logged.dispatch(ending)).toEqual(await plain.dispatch(ending));
    expect(logged.current!.ending?.kind).toBe('financial_ruin');
    expect(operations.at(-1)?.kind).toBe('run_ended');
    expect(reconstruct(operations)).toEqual(plain.current);
  });

  test('collector scopes restore after engine errors and sink failures cannot reject actions', async () => {
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const plain = new GameController(repository);
      const logged = new GameController(
        repository,
        new GameplayCapture(() => {
          throw new Error('Disk full');
        }),
      );
      expect(await logged.start(start)).toEqual(await plain.start(start));
      const command = {
        type: 'wait' as const,
        commandId: 'one',
        now: start.now,
      };
      expect(await logged.dispatch(command)).toEqual(
        await plain.dispatch(command),
      );
      expect(() =>
        collectCalculations('failed', () => {
          throw new Error('engine');
        }),
      ).toThrow('engine');
      const { entries } = collectCalculations('next', () =>
        trace('check', 'next', 1),
      );
      expect(entries).toHaveLength(1);
      expect(entries[0].parentId).toBe('next');
    } finally {
      warnings.mockRestore();
    }
  });

  test('save confirmation markers do not rewind the observed engine state', async () => {
    const { operations, logged } = await controllers();
    const sent = logged.current!;
    await logged.dispatch({
      type: 'wait',
      commandId: 'after-save',
      now: sent.now,
    });
    logged.capture!.marker('save_confirmed', { saveBatchId: 'pending' }, sent);
    expect(operations.at(-1)?.changes).toEqual([]);
    expect(reconstruct(operations)).toEqual(logged.current);
  });

  test('oversized records split without losing Unicode or internal values', async () => {
    const { operations } = await controllers();
    const operation = {
      ...operations[0],
      input: {
        longText: '雨😀'.repeat(50_000),
        omitted: undefined,
        uncapped: Infinity,
      },
    };
    const pieces = fragments(operation);
    expect(pieces.length).toBeGreaterThan(1);
    const batches = makeBatches(pieces);
    expect(
      batches.every((batch) => byteLength(json(batch)) <= BATCH_BYTES),
    ).toBe(true);
    const data = applyChanges(
      {},
      pieces.flatMap((piece) => piece.data),
    );
    expect(data).toEqual(
      JSON.parse(
        json({
          input: operation.input,
          outcome: operation.outcome,
          checkpoint: operation.checkpoint,
          changes: operation.changes,
          calculations: operation.calculations,
        }),
      ),
    );
  });
});
