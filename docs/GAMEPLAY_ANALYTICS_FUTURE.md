# Gameplay logging and future analysis

The logging pipeline is independent of game saves, displayed History, and the
graveyard. Reports, MCP tools, SQL export jobs, and statistics screens described
below are future work. No player-facing presentation is added by this change.

## Trace contract

Each browser capture has its own stream UUID. An operation contains the readable
eight-digit game hash, run-start timestamp, mode, timezone, simulation and recording
times, engine build digest, content version, operation UUID, parent UUID, and
sequence. The server derives the environment and a stable HMAC account suffix from
the authenticated user. Authentication headers, usernames, and email addresses are
not part of the stored trace.

The first observed state is a checkpoint. For an existing run, everything before
that checkpoint is historical state rather than newly recorded calculation
evidence. Later operations contain ordered state changes, including simulation
history, receipts, scheduled boundaries, and newly appended or revised events.
Accumulated narrative event history is not copied into each operation.

The collector surrounds synchronous engine execution. Build instrumentation
observes arithmetic, comparisons, compound arithmetic assignments, and Math calls
in engine dependencies, preserving operand evaluation order. Source location and
expression identify a calculation within its engine build. Keyed random draws
retain seed, state version, action/rule/roll IDs, and the actual result. Feeding
records retain preferences, authored effects, nutrition context, suppressed gains,
and final resolution. Purchases retain item IDs, quantities, prices, and spending;
LOC fees, advances, repayments, income credits, and settlement summaries remain
distinct. Settlement summaries must not be summed again as additional cash flows.

Accepted and rejected commands are both recorded. Automatic events and ending
records remain available through the state-change stream and associated
calculations. `save_conflict`, `command_replay`, `replay_superseded`,
`replay_applied`, and `save_confirmed` markers distinguish local attempts from
canonical corrections. Switching accounts pauses the original capture; returning to
that account begins a new checkpoint explicitly marking the unobserved interval.
A save acknowledgment names its target state version,
simulation time, event count, and final event ID. Confirmation markers do not
rewind the locally observed state. Browser confirmations are evidence of a client
response, not a replacement for authoritative server graveyard confirmation.

## Delivery, reconstruction, and access

The dedicated `companion-gameplay-logging` IndexedDB database holds pending
operations and immutable upload batches. It is separate from save transactions.
Uploads run every 60 seconds, when uncompressed queued records reach 256 KiB, and
on completion. Oversized operations become ordered fragments without truncation.
Each fragment carries its operation identity and its part number/count. Its `data`
contains path/value patches; large strings use ordered `appendText` patches.

An export reader must group fragments by environment, account suffix, stream ID,
and operation ID; require every part from zero through `parts - 1`; and apply the
fragment patches in part order. Decode the exact `$undefined` and `$number` tagged
values before applying the reconstructed state changes. Within each stream, order
operations by sequence and check parent relationships. Delivery and storage
timestamps are not simulation ordering. Missing parts, sequence gaps, and missing
parents are incomplete evidence, never permission to invent intermediate states.

The same-origin authenticated ingest endpoint checks identity, schema, identifiers,
sizes, and finite JSON numbers. It writes the validated batch into a private,
compressed trace blob before enqueuing the reference. Only queue acceptance earns
HTTP 200 with the matching batch ID and digest. A duplicate batch ID with different
bytes is rejected. Lost acknowledgments retry the original bytes. Authentication
failures pause delivery; data belonging to a previous account is never sent as the
new account. Invalid batches remain locally inspectable with a rejection status.
Failed IndexedDB writes retain records in memory and emit an operational diagnostic;
closing the browser before storage recovers cannot provide durable delivery.

The queue worker is a separate Python Function App: managed Static Web Apps APIs
support HTTP triggers only. Queue messages have no expiry. The worker batches Table
writes, using deterministic row keys so retries and reordered duplicate delivery
do not multiply indexed records. Full traces live in Blob Storage; the Table index
contains chronological operation summaries, fragment positions, and blob references.
Partitions are environment, game hash, account suffix, and run start. The configured
six dequeue attempts are the initial attempt plus five retries; exhausted messages
go to native `gameplay-traces-poison`. Raw blobs survive processing failures and
dead letters are not automatically replayed. Trace blobs and indexed history have
no age-based deletion policy. [Managed API constraints](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions),
[queue retry behavior](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-storage-queue-trigger).

Future read-only MCP access should expose bounded run lookup, operation listing,
and retrieval of explicitly selected trace fragments. Authorize access to the
requested environment and runs, use Blob/Table read permissions, and return
pagination or continuation tokens. Keep storage private and credentials outside
tool responses. Do not give an analysis tool game-writing, queue-replay, or billing
mutation permissions. Only operational counts, sizes, and failure types belong in
Application Insights; trace bodies belong in private storage.

## SQL analysis over exports

Export selected, reassembled operations into versioned JSON or Parquet datasets.
Normalize runs, operations, purchases, financial legs, status transitions, and
calculation evidence into separate relations. Keep operation and parent IDs,
explicit sequence, stream provenance, content/build versions, and completeness
flags on exported rows. Preserve raw blob references so an aggregate can be
audited. DuckDB can read JSON directly and join those exported relations locally;
Parquet is preferable for repeated scans. No analytical scan runs against gameplay
PostgreSQL. [DuckDB JSON loading](https://duckdb.org/docs/lts/data/json/loading_json).

After the future export has produced normalized relations, useful queries include:

```sql
SELECT p.item_id,
       COUNT(DISTINCT p.account_suffix) AS purchasing_players,
       COUNT(DISTINCT p.run_id) AS purchasing_runs,
       SUM(p.quantity) AS units,
       SUM(p.spending) AS spending
FROM read_parquet('purchases/*.parquet') p
JOIN read_parquet('runs/*.parquet') r USING (run_id)
WHERE r.environment = 'production'
  AND r.complete AND p.confirmed AND NOT p.superseded
GROUP BY p.item_id;
```

```sql
SELECT run_id, stream_id, sequence, command_type,
       LEAD(command_type) OVER (
         PARTITION BY run_id, stream_id ORDER BY sequence
       ) AS next_command
FROM read_parquet('operations/*.parquet')
WHERE confirmed AND NOT superseded AND accepted;
```

These queries depend on future export schemas; they are not queries against the
fragment envelopes currently stored. Connect replay branches to their canonical
predecessors before computing cross-stream sequences. Never infer adjacent actions
across a missing sequence or an unresolved conflict.

## Denominators and interpretation

- **Players:** distinct stable account suffixes in a specified environment and
  observation window. A player with several runs still counts once. These are
  accounts, not a claim that multiple accounts belong to different humans.
- **Runs:** distinct environment/hash/account/run-start tuples. Capture streams
  and reloads are not new runs. Separate realtime and streaming cohorts.
- **Purchase rates:** report the fraction of eligible players and the fraction of
  eligible runs that purchased, separately from units or purchases per hour.
  Publish both numerator and denominator. Item availability and progression gates
  can make an all-player denominator misleading.
- **Sequences:** distinguish accepted actions, rejected attempts, automatic
  events, and replayed commands. Present frequent transitions and short sequences
  with support counts, not causal claims.
- **Balance outcomes:** show spending, individual income sources, cash advances,
  fees, debt principal, repayments, final cash, and ending kind. A net cash change
  does not measure purchasing or income activity.
- **Incomplete evidence:** label late capture, offline gaps, missing fragments,
  unconfirmed saves, and superseded attempts. Exclude unresolved branches from
  canonical outcome rates, or show a separate sensitivity analysis. An existing
  run's opening checkpoint does not establish its earlier action history.

Version every analysis definition, cohort rule, content version, and engine build.
Keep results separated where changed rules make combined cohorts misleading.

## Graveyard-triggered reports and cached findings

Future report generation starts from a newly **server-confirmed** graveyard entry.
An incremental confirmation notification or bounded metadata read can identify
that entry; the analytical workload still reads exported traces. Deduplicate the
trigger using the authoritative run/ending identity.

Before finalizing, reconcile known logging streams and expected fragment/sequence
watermarks with the indexed backlog, save confirmations, and unresolved replay
branches. A new graveyard entry does not prove every browser has uploaded its
outbox. Keep a report pending while known backlog is outstanding. If a browser
never returns, explicitly publish incomplete coverage rather than asserting
completeness. A future stream-manifest/watermark protocol will be needed to make
that completion decision authoritative across browsers.

Cache static findings keyed by run/ending identity, trace coverage digest, analysis
version, and content/build cohort. Late confirmed traces create a new report
version rather than silently changing an old result. A future statistics
presentation alongside the graveyard can read these cached findings without
starting analytical queries during gameplay. No such screen or report job is
implemented here.

## Measured volume and cost envelope

Measurements on 2026-09-10 used the real instrumented engine, three fixed seeds,
both modes, one modeled 60-minute session per player/day, and 60 commands/session.
Realtime advances one minute before each command. Streaming completes activities
through its normal engine behavior, so its simulated time is much longer than its
modeled wall session. Runs would restart after an ending; these six samples each
used one run. The modeled actions cycle waiting, resting, socializing, playing, and
available food use; this is a reproducible volume workload, not a player-behavior
forecast. Purchases, hospital care, conflicts, and endings have separate validation
coverage and can change production volume.

| Mode      | Raw uploaded bytes/session | Compressed bytes/session | Batches/session | Table rows/session |
| --------- | -------------------------: | -----------------------: | --------------: | -----------------: |
| Realtime  |             16.08–16.39 MB |             0.98–1.00 MB |           66–67 |            345–349 |
| Streaming |           158.48–210.55 MB |            7.96–10.35 MB |         643–852 |        3,226–4,276 |

Reproduce with `node tools/measure_gameplay_traces.mjs /tmp/gameplay-volume.json`.
Batch packing here measures size-triggered grouping; timed flushes, reloads,
retries, rejected data, and additional streams can add operations. The outbox
threshold is uncompressed data, so compressed storage volume alone is not a
request-count estimate. A normal batch incurs a blob write, queue enqueue,
worker blob read, queue dequeue/delete, and one or more Table transactions.
Worker retries can add reads and writes without adding duplicate indexed rows.

Azure reported **C$3.19 month to date** during this implementation. Later cost and
forecast calls failed (`429` and a forecast API error), so the automated fresh
deployment billing gate has not passed. Resource inspection found the existing
B1MS PostgreSQL server, 32 GB storage, Free Static Web App, two storage accounts,
and Application Insights/Log Analytics. Retail B1MS compute at C$0.0236/hour and
database storage at C$0.1594/GB-month total about C$22.33 at 730 hours; the
calculator reserves at least C$25 for existing infrastructure plus C$5 for
diagnostics/unmeasured overhead. Those allowances are assumptions, not a verified
future invoice. [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices).

The projection uses the largest observed streaming sample for every player, a
30-day month, 512 MB worker instances, a conservative one second of execution per
batch without a concurrency saving, and zero always-ready instances. It allows
2 KiB/indexed row and indefinite accumulation. Storage retail rates queried in
East US 2 were C$0.0255/GB-month for Hot LRS blobs, C$0.0624/GB-month for Standard
LRS Tables, C$0.0693/10,000 blob writes, C$0.0055/10,000 blob reads and Queue v2
operations, and C$0.0005/10,000 Standard Table operations. Additional queue polling
has an allowance. Pricing tiers and redundant transaction charges are treated
conservatively.

The Functions Retail API returned zero-valued paid-tier prices, which are not
treated as free compute. The estimate instead uses published on-demand prices of
US$0.000026/GB-second and US$0.40/million executions, converted using an explicit
budget assumption of C$1.50/US$1, with the 100,000 GB-second and 250,000-execution
subscription grants. Actual currency conversion, shared free grants, execution
duration, retries, and operational-log volume must be monitored.
[Functions pricing](https://azure.microsoft.com/en-us/pricing/details/functions/).

| Daily players | New compressed blobs/month | New index storage/month | Total/month at month 1 | Total/month at month 12 |
| ------------- | -------------------------: | ----------------------: | ---------------------: | ----------------------: |
| 1             |                    0.31 GB |                 0.26 GB |                C$30.36 |                 C$30.63 |
| 10            |                    3.11 GB |                 2.63 GB |                C$33.83 |                 C$36.50 |
| 100           |                   31.06 GB |                26.27 GB |               C$103.83 |                C$130.58 |

The initial 1–10-player scenario fits the **C$50/month monitored target** under
these assumptions. The 100-player conservative scenario does not. Validate actual
worker duration/concurrency and reduce delivery overhead or revise the budget
before expanding to that workload. Indefinite retention means storage continues
growing beyond year one; there is no fixed long-term cost ceiling.

Terraform configures subscription-wide actual-cost alerts at C$40 and C$45 and a
forecast alert at C$50, addressed to subscription Owners. Azure budget amounts use
the subscription billing currency; the deployment gate requires a CAD billing
result. Alerts are notifications, not spending caps. No budget action disables
gameplay, ingestion, or capture. [Azure budget behavior](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets).

## Rollout and verification

Infrastructure deployment runs the volume study and fresh billing/cost gate before
Terraform applies storage and the worker. The worker package includes the shared
ingest schema. Deploy and index the worker before enabling ingestion or deploying
an enabled browser capture build. Preserve the existing managed HTTP API hosting
and stable staging OAuth origin.

`GAMEPLAY_LOGGING_ENABLED=true` in the deployment workflow selects an enabled
browser build; otherwise capture is off. `tools.configure_telemetry` checks worker
readiness, provisions an independent HMAC key once in production settings, shares
it with the selected environment, and enables that environment's ingestion after
deployment. Keep this key stable independently of authentication-signing-key
rotation. Terraform does not toggle the runtime ingestion flag on subsequent
applies. The worker uses managed identity and scoped storage roles; the managed
HTTP API uses its existing runtime identity with trace-container and queue-sender
permissions. Neither component receives analytics permissions on gameplay SQL.

Validation includes seeded logged/unlogged state and outcome comparisons, exact
serialized save reconstruction, unchanged view models and graveyard exports,
accepted room placement, hospital completion and debt payoff, separate offsetting cash
legs, terminal transitions, conflict replay branches, queue failure after blob
creation, duplicate/reordered worker delivery, partial Table failure, poisoned
processing in a local failure test, and real-browser offline/reload/account/rejection
tests. A failed trace confirmation cannot reject or retry an acknowledged game save.
The Python 3.11 deployment package imports and exposes the queue trigger locally;
live Azure queue/poison delivery has not been verified. A production
worker latency measurement and a fresh successful billing gate remain required
before treating the cost envelope as an observed deployment result.
