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
  Discord["Discord<br/>OAuth sign-in and bot direct messages"]
  subgraph Azure["Azure resource group"]
    DNS["Existing Azure DNS zone<br/>prod: apex A record; stage: env CNAME"]
    subgraph Env["Per-environment stack: prod and stage"]
      subgraph SWA["Azure Static Web Apps — Free"]
        Frontend["Static SvelteKit frontend"]
        API["Managed Azure Functions API — Python"]
      end
      Notifier["Notifier Python Function App<br/>Flex Consumption; one-minute timer; max one instance"]
      EnvDatabase[("Environment database<br/>on the shared server")]
      NotifierFiles["Blob: notifier-env-deployments<br/>and Functions host storage"]
    end
    subgraph Shared["Shared stack"]
      Entra["Microsoft Entra ID"]
      Server["Azure Database for PostgreSQL Flexible Server<br/>PostgreSQL 17; B1ms; Entra-only authentication"]
      Worker["Trace worker Python Function App<br/>Flex Consumption; zero always-ready instances"]
      subgraph Storage["Existing Azure Storage account — private storage"]
        Quotes["Blob: companion-content"]
        Traces["Blob: gameplay-traces<br/>Immutable gzip JSON; indefinite retention"]
        Queue["Queue: gameplay-traces<br/>Batch references"]
        Poison["Queue: gameplay-traces-poison<br/>No automatic replay"]
        Index["Table: GameplayRuns<br/>Run and operation index; indefinite retention"]
        WorkerFiles["Blob: gameplay-worker-deployments<br/>and Functions host storage"]
      end
      Insights["Application Insights"]
      Logs["Log Analytics workspace<br/>30-day retention"]
      Budget["Monthly subscription budget: C$80<br/>Actual alerts: 80% / 90%; forecast: 100%<br/>No automatic shutdown"]
    end

    DNS -->|"Custom domain"| Frontend
    Frontend -->|"Serves game"| Game
    Game -->|"Authenticated requests: /api/*"| API
    Outbox -->|"Authenticated POST /api/telemetry/batches<br/>60 seconds / 256 KiB; flush on ending"| API
    API -->|"OAuth code exchange"| Discord
    API -->|"1. Store validated batch"| Traces
    API -->|"2. Enqueue blob reference"| Queue
    API -->|"3. Acknowledge after queue acceptance"| Outbox
    Queue -->|"Queue trigger"| Worker
    Traces -->|"Read and validate full trace"| Worker
    Worker -->|"Idempotent summaries and trace references"| Index
    Worker -->|"After initial attempt + five retries"| Poison
    WorkerFiles -->|"Code and host state"| Worker
    NotifierFiles -->|"Code and host state"| Notifier
    API -->|"Acquire database access token"| Entra
    Notifier -->|"Acquire database access token"| Entra
    API -->|"SQL over TLS with Entra authentication"| EnvDatabase
    Notifier -->|"Read due notifications over TLS"| EnvDatabase
    Notifier -->|"Bot direct messages"| Discord
    EnvDatabase -->|"Hosted on"| Server
    API -->|"Operational diagnostics"| Insights
    Notifier -->|"Operational diagnostics"| Insights
    Worker -->|"Operational diagnostics only"| Insights
    Insights -->|"Diagnostic storage"| Logs
  end
  Deployment["GitHub Actions deployment<br/>main: prod; other branches: stage"]
  Deployment -->|"Terraform: shared stack, then environment stack"| Azure
  Deployment -->|"Read quotes for database import"| Quotes
  Deployment -->|"Deploy worker before enabling logging"| WorkerFiles
  Deployment -->|"Deploy notifier and set its secrets"| NotifierFiles
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
