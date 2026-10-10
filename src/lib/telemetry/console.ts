import type { Metrics } from '../game-types';
import type { TraceSink } from './capture';

export function consoleGameplaySink(): TraceSink {
  let previous:
    { metrics: Metrics; balance: number; eventCount: number } | undefined;
  return (operation, state) => {
    const events =
      operation.kind === 'run_initialized'
        ? state.events
        : operation.checkpoint
          ? []
          : state.events.slice(previous?.eventCount ?? state.events.length);
    const origin = operation.input as {
      type?: string;
      now?: number;
      origin?: { type?: string; now?: number; commandId?: string };
      commandId?: string;
    } | null;
    const action = origin?.origin ?? origin;
    const reason = operation.checkpoint
      ? operation.kind === 'run_initialized'
        ? 'Run initialized'
        : 'Saved state loaded; no gameplay replayed'
      : events.map((event) => event.message).join(' ') ||
        (action?.type
          ? `Action: ${action.type}`
          : action?.now !== undefined
            ? 'Elapsed simulation time and status reconciliation'
            : operation.kind);
    const context = {
      streamId: operation.streamId,
      operationId: operation.operationId,
      sequence: operation.sequence,
      simulationAt: operation.simulationAt,
      stateVersion: operation.summary.stateVersion,
      commandId: action?.commandId ?? null,
      reason,
      eventIds: events.map((event) => event.id),
      calculations: operation.calculations,
    };
    const next = {
      metrics: { ...state.metrics },
      balance: state.balance,
      eventCount: state.events.length,
    };
    const before = previous;
    previous = next;
    try {
      const timeOf = (time: number) => `at ${new Date(time).toISOString()}`;
      const at = timeOf(operation.simulationAt);
      const cause =
        operation.kind === 'stream_superseded'
          ? 'server replacement'
          : action?.type
            ? `requested ${action.type}`
            : action?.now !== undefined
              ? 'elapsed time'
              : operation.kind;
      const eventCause = (event: { type: string }) =>
        event.type === 'activity_completed' ||
        event.type === 'activity_interrupted'
          ? 'activity completion'
          : cause;
      if (operation.checkpoint)
        console.log(`[gameplay] ${operation.kind}`, {
          ...context,
          metrics: next.metrics,
          balance: next.balance,
          historyEventCount: next.eventCount,
        });
      if (before) {
        const values = { ...state.metrics, balance: state.balance };
        const prior = { ...before.metrics, balance: before.balance };
        for (const metric of Object.keys(values) as Array<
          keyof typeof values
        >) {
          const delta = values[metric] - prior[metric];
          if (!delta) continue;
          console.log(
            `[gameplay] metric ${metric} ${delta > 0 ? '+' : ''}${delta} (${prior[metric]} → ${values[metric]}) ${at} [${cause}]: ${reason}`,
            {
              ...context,
              metric,
              before: prior[metric],
              after: values[metric],
              delta,
            },
          );
        }
      }
      for (const event of events)
        console.log(
          `[gameplay] event ${event.type} ${timeOf(event.at)} [${eventCause(event)}]: ${event.message}`,
          {
            ...context,
            event: structuredClone(event),
          },
        );
      if (operation.kind === 'command')
        console.log('[gameplay] command', {
          ...context,
          input: operation.input,
          outcomes: operation.outcome,
        });
      if (operation.kind === 'stream_superseded')
        console.log(
          `[gameplay] stream_superseded ${at} [${cause}]`,
          operation.input,
        );
    } catch {
      // Browser console extensions can throw; diagnostics must not affect gameplay.
    }
  };
}
