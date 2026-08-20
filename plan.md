# Virtual Pet Plan

## Current milestone

Deliver a responsive, static Svelte landing page that establishes the project’s colorful pixel-pet visual direction. It uses a CSS-only placeholder and care-stat preview. This milestone contains no gameplay, save state, API, Azure configuration, generated artwork, or third-party visual assets.

## Settled technical decisions

- Frontend: SvelteKit with Svelte and strict TypeScript.
- Delivery: static-site output suitable for later Azure Static Web Apps hosting.
- Runtime footprint: no component library, state library, image optimizer, analytics SDK, or external font request.
- Persistence: Azure Table Storage will be the canonical future database.
- Server boundary: a future Azure Functions API will own Azure credentials, recovery credentials, version validation, idempotency, and timestamps. The browser will not access Table Storage directly.
- Save model: a username and 8-digit recovery code identify a save; state writes carry a monotonically increasing version and an idempotency identifier.

## Delivery roadmap

### 1. Local starter site

- Establish the SvelteKit workspace, static build, formatting, linting, type checks, and local-development documentation.
- Create an original colorful CSS-only virtual-pet landing page that works on mobile and desktop.

### 2. Local persistence proof

- Add a separate Azure Functions app and Azurite Table Storage configuration for local development.
- Define server-side save entities for the current pet, recovery lookup, version, timestamps, graveyard records, and recent idempotency keys.
- Implement save creation, recovery, load, and versioned update endpoints before connecting the UI to them.

### 3. Playable POC

- Add local pet state, elapsed-time need decay, food interaction, death state, and graveyard presentation.
- Keep simulation client-side while sending bundled, idempotent state updates to the server.

### 4. Personality and polish

- Add food preferences, inventory, shopping, random events, variable attention, refused interactions, and pet-specific dialogue.
- Replace temporary art with original commissioned assets when available, then add animation, mobile refinements, and optional sound.

### 5. Deployment and release

- Provision Azure resources with Terraform and deploy through GitHub Actions using Azure OIDC.
- Add static hosting, Azure Functions, Table Storage, logging, cost alerts, basic rate limiting, and community testing.

## Acceptance checks for this milestone

- `pnpm check`, `pnpm lint`, `pnpm format`, and `pnpm build` pass.
- The page remains readable and free of horizontal overflow at 320px and 1440px widths.
- The page makes no API or third-party asset requests.
- The original source brief remains unchanged.
