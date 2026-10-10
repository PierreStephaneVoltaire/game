import type { GameState } from '../game-types';
export type TraceEntry = {
  sequence: number;
  parentId: string;
  kind: string;
  ruleId: string;
  values: unknown;
};

type Collector = {
  operationId: string;
  entries: TraceEntry[];
  resolved?: (state: GameState, entries: TraceEntry[]) => void;
};
let active: Collector | undefined;

export function collectCalculations<T>(
  operationId: string,
  execute: () => T,
  resolved?: Collector['resolved'],
) {
  const previous = active;
  const collector: Collector = { operationId, entries: [], resolved };
  active = collector;
  try {
    return { result: execute(), entries: collector.entries };
  } finally {
    active = previous;
  }
}

export function trace(kind: string, ruleId: string, values: unknown): void {
  if (!active) return;
  try {
    active.entries.push({
      sequence: active.entries.length + 1,
      parentId: active.operationId,
      kind,
      ruleId,
      values: structuredClone(values),
    });
  } catch {
    console.warn('Gameplay calculation capture failed.');
  }
}

export function calculation<T>(
  ruleId: string,
  expression: string,
  inputs: unknown[],
  result: T,
): T {
  if (inputs.every((value) => value === null || typeof value !== 'object'))
    trace('calculation', ruleId, { expression, inputs, result });
  return result;
}

export function resolvedState<T extends GameState>(state: T): T {
  try {
    active?.resolved?.(state, active.entries);
  } catch {
    console.warn('Gameplay transition capture failed.');
  }
  return state;
}
