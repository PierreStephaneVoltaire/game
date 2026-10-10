# Virtual Pet

A static, session-only companion-care game built with SvelteKit and strict
TypeScript. A run supports Realtime and Streaming clocks, deterministic care and
autonomous events, a 226-item shop and inventory, room placement, persistent
statuses, streaming income and career progression, background projects,
complete in-memory history, and terminal graveyard presentation.

The app uses password accounts while game runs remain browser-session-only.
After authentication, the player reaches a separate game-key page. Existing
eight-digit keys open their sessions directly; generating a new key leads to a
visible confirmation of that key before the player continues to a separate
clock-mode page. There is no in-app reset, restart, recovery, or mode switch.
Runs do not inherit keepsakes, debt, Followers, or unlocks.

## Azure infrastructure

The diagram shows the infrastructure defined in this repository, including the
gameplay logging pipeline. It describes the configured architecture, not deployment
status; browser capture and ingestion are enabled separately after worker deployment.

```mermaid
flowchart TB
  subgraph Browser
    Game["Gameplay"]
    Outbox["Independent IndexedDB logging outbox"]
    Game -->|"Asynchronous capture"| Outbox
  end
  subgraph Azure
    subgraph SWA["Azure Static Web Apps"]
      Frontend["Static SvelteKit frontend"]
      API["Managed Azure Functions API — Python"]
    end
    Entra["Microsoft Entra ID"]
    Database["Azure Database for PostgreSQL Flexible Server"]
    Worker["Separate Python Function App<br/>Flex Consumption; zero always-ready instances"]
    subgraph Storage["Existing Azure Storage account — private storage"]
      Quotes["Blob: companion-content"]
      Traces["Blob: gameplay-traces<br/>Immutable gzip JSON; indefinite retention"]
      Queue["Queue: gameplay-traces<br/>Batch references"]
      Poison["Queue: gameplay-traces-poison<br/>No automatic replay"]
      Index["Table: GameplayRuns<br/>Run and operation index; indefinite retention"]
      WorkerFiles["Blob: worker deployment packages<br/>and Functions host storage"]
    end
    Insights["Application Insights"]
    Logs["Log Analytics workspace"]
    Budget["Monthly infrastructure budget: C$50<br/>Actual alerts: C$40 / C$45; forecast: C$50<br/>No automatic shutdown"]

    Frontend -->|"Serves game"| Game
    Game -->|"Authenticated requests: /api/*"| API
    Outbox -->|"Authenticated POST /api/telemetry/batches<br/>60 seconds / 256 KiB; flush on ending"| API
    API -->|"1. Store validated batch"| Traces
    API -->|"2. Enqueue blob reference"| Queue
    API -->|"3. Acknowledge after queue acceptance"| Outbox
    Queue -->|"Queue trigger"| Worker
    Traces -->|"Read and validate full trace"| Worker
    Worker -->|"Idempotent summaries and trace references"| Index
    Worker -->|"After initial attempt + five retries"| Poison
    WorkerFiles -->|"Code and host state"| Worker
    API -->|"Acquire database access token"| Entra
    API -->|"SQL over TLS with Entra authentication"| Database
    API -->|"Operational diagnostics"| Insights
    Worker -->|"Operational diagnostics only"| Insights
    Insights -->|"Diagnostic storage"| Logs
  end
  Deployment["GitHub Actions deployment"]
  Deployment -->|"Read quotes for database import"| Quotes
  Deployment -->|"Deploy worker before enabling logging"| WorkerFiles
```

## Requirements

- Node.js 24.14.0
- Corepack-enabled pnpm 11.22.0

## Run locally

```sh
corepack enable
pnpm install
pnpm dev
```

For the static production build:

```sh
pnpm build
pnpm preview
```

## Verification

```sh
pnpm validate:data
pnpm validate:assets
pnpm validate:product
pnpm check
pnpm lint
pnpm format
pnpm test
pnpm build
pnpm test:e2e
```

Catalogue nutrition and behavior are authored under
`src/lib/data/catalogue/` and compiled into the bundled game definition. All
gameplay uncertainty is derived from the displayed run seed; the simulation
does not use `Math.random()`.

The catalogue contains 110 Food, 2 Medicine, 3 Care, 73 Reusable, 23 Upgrade,
and 15 Decoration items. Nutrition research and exact primary-source records
are documented in `docs/research/FOOD_NUTRITION_SOURCES.md`.

See `docs/GAME_RULES.md` for the player-facing rules,
`docs/RULES_AND_FILES.md` for source ownership, and `CONTEXT.md` for the domain
vocabulary.
