import type { GameState } from '../game-types';
import type { Operation } from './capture';
import { applyChanges, stateChanges } from './state-changes';
import { decodeTraceValue, type Fragment } from './batches';

export type ReplayStep = {
  operation: Operation;
  eventId: string | null;
  state: GameState;
  appliesTransition: boolean;
};

export type Reconstruction = {
  steps: ReplayStep[];
  state?: GameState;
  complete: boolean;
  gaps: number[];
  superseded: boolean;
};

export function reconstructStream(records: Operation[]): Reconstruction {
  const unique = new Map<string, Operation>();
  for (const record of records) {
    const existing = unique.get(record.operationId);
    if (existing && stateChanges(existing, record).length)
      throw new Error('Conflicting copies of a diagnostic record.');
    unique.set(record.operationId, record);
  }
  const ordered = [...unique.values()].sort((a, b) => a.sequence - b.sequence);
  if (new Set(ordered.map((record) => record.streamId)).size > 1)
    throw new Error('Reconstruct one diagnostic stream at a time.');
  const result: Reconstruction = {
    steps: [],
    complete: true,
    gaps: [],
    superseded: false,
  };
  let previous: Operation | undefined;
  let connected = false;
  for (const operation of ordered) {
    const gap =
      operation.sequence !== (previous?.sequence ?? 0) + 1 ||
      operation.parentId !== (previous?.operationId ?? null);
    if (
      operation.kind === 'checkpoint' &&
      (operation.input as { resumedAfterAccountChange?: boolean } | null)
        ?.resumedAfterAccountChange
    ) {
      result.complete = false;
      result.gaps.push(operation.sequence);
    }
    if (gap) {
      result.gaps.push(operation.sequence);
      result.complete = false;
      connected = false;
    }
    const previousEventCount = result.state?.events.length ?? 0;
    if (operation.checkpoint) {
      result.state = structuredClone(operation.checkpoint);
      connected = true;
    } else if (connected && result.state) {
      result.state = applyChanges(result.state, operation.changes);
    } else {
      result.complete = false;
    }
    if (operation.kind === 'stream_superseded') result.superseded = true;
    if (connected && result.state) {
      const eventIds =
        operation.kind === 'transition'
          ? ((operation.input as { eventIds?: string[] }).eventIds ?? [])
          : operation.checkpoint
            ? []
            : result.state.events
                .slice(previousEventCount)
                .map((event) => event.id);
      for (const [index, eventId] of (eventIds.length
        ? eventIds
        : [null]
      ).entries()) {
        result.steps.push({
          operation,
          eventId,
          state: structuredClone(result.state),
          appliesTransition: index === 0,
        });
      }
    }
    previous = operation;
  }
  if (!ordered.length) result.complete = false;
  return result;
}

export function verifyReconstruction(
  records: Operation[],
  snapshot: GameState,
): Reconstruction {
  const result = reconstructStream(records);
  if (!result.state || stateChanges(result.state, snapshot).length)
    result.complete = false;
  return result;
}

export function reconstructFragments(fragments: Fragment[]): Reconstruction {
  const groups = new Map<string, Map<number, Fragment>>();
  for (const fragment of fragments) {
    const group =
      groups.get(fragment.operationId) ?? new Map<number, Fragment>();
    const existing = group.get(fragment.part);
    if (existing && stateChanges(existing, fragment).length)
      throw new Error('Conflicting copies of a diagnostic fragment.');
    group.set(fragment.part, fragment);
    groups.set(fragment.operationId, group);
  }
  const operations: Operation[] = [];
  const gaps: number[] = [];
  for (const group of groups.values()) {
    const ordered = [...group.values()].sort((a, b) => a.part - b.part);
    const { part: _part, parts, data: _data, ...metadata } = ordered[0];
    void _part;
    void _data;
    if (
      ordered.length !== parts ||
      ordered.some(
        (fragment, index) =>
          fragment.part !== index || fragment.parts !== parts,
      )
    ) {
      gaps.push(metadata.sequence);
      continue;
    }
    const payload = decodeTraceValue(
      applyChanges(
        {},
        ordered.flatMap((fragment) => fragment.data),
      ),
    );
    operations.push({
      ...metadata,
      ...(payload as Pick<
        Operation,
        'input' | 'outcome' | 'changes' | 'calculations' | 'checkpoint'
      >),
    });
  }
  const result = reconstructStream(operations);
  if (gaps.length) {
    result.complete = false;
    result.gaps = [...new Set([...result.gaps, ...gaps])].sort((a, b) => a - b);
  }
  return result;
}
