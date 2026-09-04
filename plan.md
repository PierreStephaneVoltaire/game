# Backend Implementation Plan (Revised — SQL-first)

Status: authoritative specification. This revision supersedes the original
Table Storage / queue / ACS-email plan in full. The findings in
`suggestion.md` are adopted as binding architecture decisions, not
recommendations. Where the partially completed implementation deviates from
this spec, the deviation is listed in §3 and MUST be resolved; where the
implementation already matches, it is listed in §2 and MUST NOT be redone.

Constraints this spec is scoped to: 10–100 total users, $50 CAD/month total
Azure budget, simulation runs entirely client-side. The backend provides
durable persistence, sync, auth, and versioned content — never simulation
logic.

## 0. Binding decisions adopted from suggestion.md

1. **Azure SQL Database Basic replaces Azure Table Storage** as the only
   application data store (Basic SKU, 2 GB, ~$7 CAD/month). Every game sync
   batch commits as a single database transaction. The former
   GameWriteOperations table, pendingBatchId locking, event-segment packing,
   48 KiB limits, commit-pointer visibility rule, and 503 SYNC_PENDING are
   deleted from the design and MUST NOT be reintroduced.
2. **No Storage Queue and no dedicated worker Function App.** Interrupted
   requests roll back atomically; the frontend IndexedDB outbox retry is the
   only recovery mechanism. The events table itself is the durable ordered
   log for any future analytics; no queue is kept for that purpose.
3. **No Azure Communication Services Email.** Password resets are a manual
   admin process: an admin CLI issues a one-time, 1-hour-expiry reset link
   (only the token's SHA-256 digest is stored) and the admin delivers it
   over Discord DM after verifying identity per the written policy in §6.
   Recovery email, email verification, resend, and forgot-password routes do
   not exist. An optional unverified `contact handle` string on the account
   replaces recovery email.
4. **OAuth-native accounts do not require a local password.** Discord
   onboarding requires only a unique username; the password hash is nullable
   and login against a passwordless account verifies a dummy Argon2 hash and
   fails generically. Accounts may add a password later while authenticated.
5. **Legacy sessions are revoked, not rotated.** There is no 30-day
   AuthRecords dual-read window. Old cookies simply fail; users log in
   again. The scrypt→Argon2 rehash-on-successful-login path is kept.
6. **Content versioning keeps immutable versions + a `current` pointer
   flipped last**, one bundle row per version, manifest ETag/304, and
   immutable caching of versioned URLs. The publisher's read-back
   verification and the API's per-request hash/count re-verification are
   deleted. A wrong publish is fixed by republishing (pointer flip = one-row
   rollback).
7. **Structural abuse caps are mandatory**: max 20 games per user, max
   50,000 events per game, and a per-user fixed-window sync throttle using
   the same attempts table as login throttling.
8. **Secrets never enter Terraform state.** Secret app settings (database
   URL, Discord client secret, signing secret) are installed manually via
   portal/CLI as a documented bootstrap step; Terraform manages only
   non-secret settings and ignores the secret keys.
9. **Sequential build, not three parallel subagents.** Work proceeds auth →
   persistence → content against real interfaces. Package boundaries
   (`auth/`, `games/`, `content/`) remain as code organization only.
10. **Each infrastructure concern lives in its own Terraform module** (see
    §8). No module may own more than one concern.

## 1. Locked Architecture

### Runtime

- Azure SQL Database (Basic SKU, 2 GB) is the only application data store.
- The managed Static Web Apps HTTP API runs Python 3.11 via Azure Functions'
  ASGI integration (`AsgiFunctionApp`) hosting one FastAPI application.
- SQLAlchemy 2.x declarative models define the schema; Alembic owns
  migrations. Local development and tests use SQLite through the same
  models; production uses Azure SQL via pyodbc.
- Pydantic v2 validates API request/response bodies. There is no separate
  storage-entity model layer — the SQLAlchemy models are the storage layer.
- Authlib provides Discord OAuth (identify + email scopes; provider tokens
  discarded after profile resolution).
- pwdlib with Argon2 for new password hashes; a bounded `hashlib.scrypt`
  compatibility verifier for legacy hashes, upgraded on successful login.
- Static Web Apps stays on the Free plan with managed HTTP Functions. There
  is exactly one Function App: the managed API. No worker app, no queue.
- Do not build a generic repository framework, unit-of-work abstraction, or
  ORM-on-ORM wrapper. Services call SQLAlchemy sessions directly.

### Backend layout (already in place — keep)

    api/
      function_app.py          # AsgiFunctionApp wrapper only
      host.json
      alembic.ini
      migrations/              # Alembic environment (versions/ MUST be added, see #3)
      requirements.txt
      requirements-dev.txt
      vpet_backend/
        app.py                 # FastAPI factory, middleware, router registration
        config.py              # env-driven Settings dataclass
        database.py            # engine/session factory, DeclarativeBase
        errors.py              # ApiError + error envelope handler
        pagination.py          # HMAC-signed continuation tokens
        auth/                  # models, schemas, passwords, sessions, discord, service, routes, issue_reset (admin CLI)
        games/                 # models, schemas, validation, service, routes
        content/               # models, schemas, service, routes
      tests/                   # pytest suites per package
    tools/
      global_content_publisher/  # bundle loader + transactional publish CLI

Files at or above 300 lines must be split before expansion (per AGENTS.md).

### Frontend layout (already in place — keep)

    src/lib/persistence/       # indexed-db.ts, games.ts, sync.ts, types.ts
    src/lib/content/           # runtime-content.ts (IndexedDB content cache)
    src/lib/accounts/          # account client + menu

## 2. Implementation Audit — what already conforms

The codebase was partially migrated before this revision. The following was
verified by reading the code and MUST NOT be rebuilt:

- **SQL store adopted.** `api/vpet_backend/*/models.py` define `users`,
  `sessions`, `discord_identities`, `oauth_onboarding`, `password_resets`,
  `auth_attempts`, `games`, `game_events`, `committed_batches`,
  `content_versions`, and `content_pointer` as SQLAlchemy tables. No Table
  Storage SDK usage remains in `vpet_backend`.
- **Single-transaction sync.** `games/service.py::GameService.write` runs
  the whole batch (idempotency check via `committed_batches`, row lock on
  the game, structural validation, event inserts, state advance,
  acknowledgement persistence) inside one `session.begin()` transaction.
  Batch-ID reuse with different hashes returns 409 EVENT_CONFLICT; an
  identical retry returns the stored acknowledgement. No queue, no
  write-ahead table, no pending lock.
- **No queue / no worker / no ACS Email** anywhere in code or Terraform.
- **Manual reset flow.** `auth/issue_reset.py` is the admin CLI (username +
  `--issued-by`, prints a one-time `#reset-token=` URL); `password_resets`
  stores only SHA-256 digests with 1-hour expiry; `POST
/api/auth/password/reset` consumes tokens once and revokes all sessions.
  `users.contact_handle` replaces recovery email. No email routes exist.
- **Passwordless OAuth onboarding.** `users.password_hash` is nullable;
  Discord completion requires only a username; `Passwords.verify` runs the
  dummy Argon2 hash for missing/unknown hashes; the INVALID_CREDENTIALS
  response is generic.
- **Sessions.** `sessionId.secret` cookie, SHA-256 digest stored, 30-day
  TTL, HttpOnly/Secure/SameSite=Lax, logout deletes only the current row,
  password reset revokes every session for the user. No AuthRecords
  dual-read path exists — correct per decision 5.
- **Abuse caps.** `MAX_GAMES_PER_USER=20`, `MAX_EVENTS_PER_GAME=50000`,
  per-batch/state/event byte caps, and a per-user fixed-window game-sync
  throttle sharing the `auth_attempts` table with login/registration
  throttles.
- **Content pipeline.** Canonical-JSON bundle hashing in
  `tools/global_content_publisher/bundle.py`; one immutable
  `content_versions` row per version holding the full bundle as one JSON
  column; a `content_pointer` row named `current` flipped in the same
  transaction as the insert; manifest endpoint with ETag/304 and no-cache;
  versioned bundle endpoint with immutable caching; `X-Content-Version`
  enforcement returning 409 CONTENT_VERSION_OUTDATED with `latestVersion`.
  No read-back verification and no per-request hash re-verification —
  correct per decision 6.
- **Frontend persistence.** IndexedDB database with `games`, `gameEvents`,
  `outbox`, `content`, `metadata` stores; one-time sessionStorage legacy
  import in `persistence/games.ts` (validates seed, imports state + events,
  writes an outbox record, marks migration in metadata);
  `persistence/sync.ts` flushes the outbox with If-Match,
  `X-Content-Version`, death routing to the death endpoint, a 404→create
  fallback for unsynced games, and content-refresh / conflict-replay hooks.
  `LoginWidget.svelte` handles both `#reset-token=` and
  `#discord-onboarding=` URL fragments.
- **Pagination.** Collection endpoints accept `limit` (1–100, default 25)
  and an opaque HMAC-signed `continuationToken` bound to endpoint and owner;
  invalid tokens return 400 INVALID_CONTINUATION_TOKEN.
- **Graves derived, not stored.** `GET /api/graves/{gameHash}` builds the
  grave DTO from the terminal `games` row plus the committed causal events
  referenced by `state.ending.eventIds`. There is no grave table.
- **CI.** `azure-static-web-app.yml` runs frontend tests + pytest (SQLite)
  - an API import check, then deploys frontend and Python API together.
    `database-migrate.yml` applies Alembic on manual dispatch.
    `global-data-sync.yml` validates the catalogue, tests the publisher
    against SQLite, then publishes with the production `DATABASE_URL` secret.
- **Terraform intent.** `infra/modules/database` provisions a SQL server
  (Entra-only auth, TLS 1.2, `prevent_destroy`) and a Basic 2 GB database;
  `infra/modules/monitoring` provisions Log Analytics, App Insights, and a
  $50 monthly budget alert; `infra/modules/web` provisions the Free-tier
  Static Web App with only non-secret app settings; the legacy Table
  Storage account and tables are retained read-only with `prevent_destroy`.

## 3. Implementation Audit — deviations that MUST be fixed

Listed in priority order. Each item is a defect against this spec, found by
reading the code as of this revision.

1. **Terraform module boundaries violate the one-concern-per-module rule and
   the composition cannot plan.**
   - `infra/modules/database/main.tf` owns the resource group, the legacy
     storage account, AND the SQL server/database — three concerns in one
     module. Split per §8 into `core` (resource group), `legacy-storage`
     (storage account + legacy tables), and `database` (SQL server,
     database, firewall rule).
   - `infra/main.tf` and the child modules disagree on variable and output
     names: the root passes `legacy_storage_account_id`, `app_base_url`,
     and `discord_client_id` while `modules/auth` declares
     `storage_account_id`, `discord_callback_url`, and `allowed_origin`
     (and `discord_callback_url` is never supplied); `modules/game-data`
     and `modules/global-data` declare `storage_account_id`, and
     `global-data` additionally requires `sql_database_id`, never supplied;
     the root reads `module.*.legacy_table_names` and
     `module.*.app_settings` but the modules output `table_names`,
     `settings`, and `migration_table_names`. Reconcile all names as part
     of the §8 restructure.
   - `infra/modules/user-accounts/main.tf` duplicates the `Users` /
     `AuthRecords` tables already declared in `modules/auth` and is
     referenced by nothing. Delete it; those legacy tables belong to
     `legacy-storage`.
   - `modules/auth` emits pseudo-settings (`DISCORD_CLIENT_SECRET_SETTING`,
     `DATABASE_URL_SETTING`, `SESSION_SECRET_SETTING`) whose values are the
     names of other settings. Remove them; the §8 secret convention applies
     instead.
   - `modules/global-data` outputs `CONTENT_SQL_DATABASE_ID` (an ARM
     resource ID) as an app setting the API never reads. Remove it.
2. **Terraform app settings do not match what the API reads.** `config.py`
   reads `APP_BASE_URL`, `SESSION_COOKIE_NAME`, `SESSION_TTL_DAYS`,
   `SIGNING_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CALLBACK_URL`,
   `DATABASE_URL`, `ENVIRONMENT`, and the seven limit settings. Terraform
   currently emits `ALLOWED_ORIGIN` (read by nothing) and never emits
   `APP_BASE_URL` or `SESSION_TTL_DAYS`; the web module receives
   `DATABASE_HOST`/`DATABASE_NAME`, which the API also never reads. Align
   the Terraform-managed non-secret settings exactly to the §8 table.
   Same-origin checks derive from `APP_BASE_URL`; there is no separate
   allowed-origin setting.
3. **No Alembic migration versions exist.** `api/migrations/versions/` is
   absent, so `database-migrate.yml` (`alembic upgrade head`) is a no-op and
   the production schema cannot be created. Author the initial migration
   covering every model in §5, wire `env.py` to `Base.metadata`, and add a
   models-vs-migrations drift check to the unit-test workflow so CI fails
   when they diverge.
4. **The legacy TypeScript API is still in the deploy artifact.**
   `api/src/`, committed `api/dist/`, `api/package.json`,
   `api/pnpm-lock.yaml`, and `api/tsconfig.json` (Node `@azure/data-tables`
   account and global-data services) coexist with the Python API. The SWA
   runtime is `python:3.11`, so this is dead weight and a stale-code risk.
   Remove them once the §9 legacy-data migration no longer needs the old
   reader; until then nothing may invoke them and they must not deploy.
5. **`src/lib/game-session.ts` still uses sessionStorage as a live
   persistence path** alongside IndexedDB. Per §7, IndexedDB is the only
   durable client store: `game-session.ts` must delegate to
   `persistence/games.ts`, and sessionStorage access may survive only inside
   the one-time legacy import.
6. **Login failure branches are asymmetric.** `AuthService.login` handles
   missing-user and wrong-password in two separate branches with duplicated
   commits. Collapse them into one uniform failure path (dummy-hash
   verification already runs for missing users) so both cases execute the
   same statements.
7. **Per-write scans of `game_events` do not scale to the 50,000-event
   cap.** The nondecreasing-timestamp check reads the latest event by
   ordering, and the death-cause check loads every event ID for the game.
   Add a `last_event_at` column to `games` (maintained in the same commit
   transaction) for the timestamp check, and validate death causes against
   the supplied batch plus an indexed point lookup on
   `(game_hash, event_id)` — the existing unique constraint already rejects
   duplicate IDs on insert.
8. **`content_bundle_max_bytes` is declared in Terraform but enforced
   nowhere.** Enforce the cap (default 2 MiB) in
   `tools/global_content_publisher/bundle.py` before publish; that is the
   preferred fix over deleting the variable.
9. **Runtime content dependency injection is unverified.** The requirement
   that production gameplay modules consume a GameDefinition loaded from
   IndexedDB/API instead of importing bundled JSON has not been confirmed
   across `src/lib`. Audit production entrypoints; bundled JSON repositories
   may remain only as explicit test/study fixtures. AGENTS.md simulation
   boundaries (status-rules.ts, seeded-rng.ts, game-constants.ts,
   JSON-authored rule data, no `Math.random()` in gameplay) remain
   mandatory.

## 4. Out of Scope

- Unchanged exclusions: Google or YouTube sign-in; server-authoritative
  simulation or anti-cheat; grave tables or grave entities; AI-generated
  epitaphs; public profiles or public graves; username changes; game
  resurrection; provider unlinking; runtime AI conversations; CDN expansion;
  analytics infrastructure; event streaming.
- Deleted by this revision and not to be reintroduced: any queue, any worker
  Function App, any email service, email verification, forgot-password
  automation, AuthRecords session rotation, GameWriteOperations or any
  write-ahead machinery, event-segment packing, publisher read-back
  verification, per-request content hash verification, and the
  three-parallel-subagent execution scheme.

## 5. Database Schema (SQL)

All tables live in the single Azure SQL database and are created by the
initial Alembic migration. The SQLAlchemy models already in
`api/vpet_backend` are the source of truth; this section describes intent
and required constraints, not new work, except where §3 items add columns.

### users

- Primary key: UUID string. Unique, immutable, lowercase username matching
  `[a-z0-9_]{3,24}` (uniqueness via unique constraint, format via API
  validation).
- Nullable `password_hash` + `password_algorithm` (`argon2` or `scrypt`,
  check-constrained). Null means OAuth-only account.
- Optional unverified `contact_handle` free-text string (max 200); this is
  the reset-verification hint, not an identity key.

### sessions

- One row per device session: UUID id, FK to user (cascade delete), unique
  SHA-256 secret digest, created/expires/last-seen timestamps. Raw secrets
  are never stored or logged.

### discord_identities

- Discord user ID (primary key) → user FK (unique, cascade delete). One
  Discord identity maps to exactly one account and vice versa.

### oauth_onboarding

- SHA-256 token digest (primary key), Discord user ID, minimal profile
  JSON, 10-minute expiry, single-use consumption timestamp.

### password_resets

- SHA-256 token digest (primary key), user FK, `issued_by` audit string,
  1-hour expiry, single-use `used_at`. Issued only by the admin CLI.

### auth_attempts

- Composite key (scope, subject digest, window start) with a count. Shared
  by login, registration, and game-sync fixed-window throttles.

### games

- `game_hash` (8-digit string) primary key; owner FK; `life_status`
  alive/dead (check-constrained); monotonically increasing `state_version`;
  `state_schema_version`; FK to `content_versions.version`;
  `last_event_sequence`, `last_event_id`, and (new, §3.7) `last_event_at`;
  full canonical state as one JSON column; created/updated/died timestamps.
- Listing indexes on (owner, updated_at, hash) and
  (owner, life_status, died_at, hash) support keyset pagination.

### game_events

- Append-only ledger: composite primary key (game_hash, sequence), unique
  (game_hash, event_id), batch ID, event type, event timestamp, payload
  JSON. Events are never updated or deleted; a dead game's ledger is
  read-only.

### committed_batches

- Idempotency ledger: composite primary key (game_hash, batch_id) with the
  state hash, events hash, resulting version/cursor, and the exact stored
  acknowledgement JSON returned on retry. Reuse of a batch ID with
  different hashes is 409 EVENT_CONFLICT.

### content_versions / content_pointer

- One immutable row per published version: SHA-256 version key, schema
  version, the entire runtime bundle as one JSON column, item count,
  publish timestamp. `content_pointer` holds a single row named `current`
  pointing at the active version; flipping it is the last step of a
  publish and the entire rollback mechanism.

## 6. Authentication

### Routes (implemented — keep behavior)

    POST /api/auth/register            username, password (>= 12 chars), optional contactHandle
    POST /api/auth/login               generic INVALID_CREDENTIALS on any failure
    POST /api/auth/logout              deletes only the current session
    GET  /api/me                       safe profile: username, providers, hasPassword
    PUT  /api/auth/password            authenticated password change/set
    POST /api/auth/password/reset      consumes a one-time admin-issued token
    GET  /api/auth/discord             begin OAuth (login mode)
    GET  /api/auth/discord/link        begin OAuth (authenticated link mode)
    GET  /api/auth/discord/callback    Authlib state validation, mode dispatch
    POST /api/auth/discord/complete    onboarding token + unique username only

### Rules

- Registration hashes with `PasswordHash.recommended()` (Argon2); username
  uniqueness enforced by the DB unique constraint mapped to 409
  USERNAME_TAKEN.
- Login verifies Argon2 via pwdlib and legacy scrypt via the bounded
  compatibility verifier; a successful scrypt login rehashes to Argon2 in
  the same transaction. Missing users verify a fixed dummy Argon2 hash so
  timing is uniform (see §3.6 for the required branch cleanup).
- Session cookie is `sessionId.secret`; only the SHA-256 digest is stored;
  HttpOnly, Secure outside development/test, SameSite=Lax, Path=/, 30-day
  max age.
- Same-origin `Origin` validation is required on every cookie-authenticated
  mutation; OAuth callbacks rely on Authlib state instead.
- Fixed-window throttles cover login (per source and per username) and
  registration (per source) via `auth_attempts`.
- Discord: identify+email scopes only; provider tokens are discarded after
  profile resolution; unknown identities get a 10-minute single-use
  onboarding token; linking is explicit and authenticated; accounts are
  NEVER linked by matching email.
- Never log passwords, hashes, cookies, reset tokens, OAuth codes, provider
  tokens, or complete user rows.

### Manual password-reset runbook (this is the reset feature)

1. A player requests a reset via Discord DM to the admin or the contact
   link on the login page.
2. The admin verifies identity, in this order of strength:
   a. Discord-linked account: the DM must come from the exact Discord user
   ID stored in `discord_identities`. This alone is sufficient.
   b. Password-only account with a `contact_handle`: the request must
   arrive from that handle.
   c. Neither: the player must name identifying account details (e.g. their
   game hashes / pet names). If they cannot, the account is
   unrecoverable; the login page states this policy.
3. The admin runs the CLI: `python -m vpet_backend.auth.issue_reset
<username> --issued-by <admin-handle>` with production `DATABASE_URL`
   and `APP_BASE_URL` set. It stores only the token digest (1-hour expiry,
   single-use, previous unused tokens invalidated) and prints a one-time
   URL with the token in the fragment.
4. The admin DMs the URL to the verified player. The reset endpoint
   consumes the token, sets the new Argon2 hash, and revokes every session.

This runbook must be committed to `docs/` and kept current.

## 7. Game Persistence and Synchronization

### Client storage (IndexedDB — implemented, keep)

One database `virtual-pet` with stores `games`, `gameEvents`, `outbox`,
`content`, `metadata`. A command is durable only when state, events, and
the outbox record commit in one IndexedDB transaction. Sync is attempted
after each local command, on startup, on the browser `online` event, after
session restore, and after completing a previous batch. No Service Worker
background sync. Deviation §3.5 (game-session.ts) must be fixed so no
gameplay path bypasses this layer.

### Sync request (implemented — keep)

`PUT /api/games/{gameHash}` with `If-Match: "<stateVersion>"` and
`X-Content-Version` headers; body carries batchId, previousEventId,
targetState, and the events after the last acknowledged event. The
frontend never resends full history. `POST /api/games/{gameHash}/death`
uses the same shape plus `causeEventId` and is the only route that may
commit a terminal death state.

### Server commit — one transaction, no machinery

Per request, inside a single database transaction: idempotency lookup in
`committed_batches` (identical retry → stored acknowledgement; divergent
reuse → 409); row-lock the game; ownership else 404; current content
version else 409 CONTENT_VERSION_OUTDATED; dead game → 409; If-Match
mismatch → 412 STALE_STATE; structural validation (contiguous sequences,
unique event IDs, nondecreasing timestamps, byte and count caps); insert
events; advance state/version/cursor; record the acknowledgement. Any
failure rolls back everything; the client outbox retry with the same batch
ID is the sole recovery path. The backend never recalculates simulation
outcomes — structural validity only.

### Conflict and loss handling (implemented — keep)

- 412 STALE_STATE → fetch canonical state, page missing events, replay
  pending commands with original action IDs, atomically replace pending
  IndexedDB records, resubmit against the new version.
- Lost response → resend same batch ID; server returns the stored
  acknowledgement; history is never duplicated.
- 409 CONTENT_VERSION_OUTDATED → refresh bundle, replay pending commands
  under new content with stable command IDs, resubmit.

### Lifecycle, graves, pagination (implemented — keep)

`POST /api/games` (creation with local-hash import support, 20-game cap),
`GET /api/games/{hash}`, `GET /api/games/{hash}/events`, `GET
/api/me/games`, `GET /api/me/graves`, `GET /api/graves/{hash}`. Dead games
are permanently read-only; the grave DTO derives from terminal state plus
committed causal events. All collections use limit 1–100 (default 25) and
HMAC-signed keyset continuation tokens; invalid tokens → 400.

## 8. Runtime Content and Infrastructure

### Content publication (implemented — keep, plus §3.8 cap)

The publisher loads the JSON-authored catalogue and seven global documents
from `src/lib/data/`, runs the existing catalogue validation, canonicalizes
JSON (sorted keys, compact separators), derives the version as the SHA-256
of the canonical bundle, enforces the bundle byte cap (§3.8), then in one
transaction inserts the immutable `content_versions` row (idempotent if the
identical bundle exists; error if the version exists with different bytes)
and flips the `current` pointer. No read-back verification. Rollback =
repoint `current` at a previous version.

### Content API (implemented — keep)

- `GET /api/content/manifest`: no-cache, ETag = active version, 304 on
  If-None-Match.
- `GET /api/content/{version}`: immutable bundle, one-year immutable
  caching.
- All game/grave/event endpoints require `X-Content-Version`; auth routes,
  health, and the manifest are exempt (they bootstrap access). Stale or
  missing versions fail with 409 CONTENT_VERSION_OUTDATED and
  `latestVersion` before any write occurs.

### Frontend content cache (implemented — keep)

IndexedDB stores the bundle keyed by version with the manifest ETag. Cache
hit loads without network; a conditional manifest check runs before each
sync flush; new versions replace the cache atomically; offline play
continues from valid cache with writes retained in the outbox; first run
with no cache and no network cannot start gameplay.

### Terraform module layout (REQUIRED restructure — see §3.1/§3.2)

Each infrastructure concern is its own module under `infra/modules/`. The
root composition in `infra/main.tf` wires them; variable and output names
must match exactly on both sides, and `terraform validate` must pass.

    core/            Resource group only.
    database/        SQL server (Entra-only admin, TLS 1.2, prevent_destroy),
                     Basic 2 GB database (prevent_destroy), Azure-services
                     firewall rule. Outputs host + database name for humans
                     and CI, not as app settings.
    legacy-storage/  The existing storage account and legacy tables (Users,
                     AuthRecords, GameData, ShopItems, GlobalRules), all
                     prevent_destroy, retained read-only until §9 cleanup.
                     Absorbs and replaces modules/user-accounts and the
                     table resources currently inside modules/auth,
                     modules/game-data, and modules/global-data.
    web/             Free-tier Static Web App. Receives the merged
                     non-secret app-settings map; declares
                     lifecycle.ignore_changes for the secret setting keys.
    monitoring/      Log Analytics, Application Insights, $50 monthly
                     budget alert.
    auth/            Non-secret auth app settings only (no resources):
                     APP_BASE_URL, SESSION_COOKIE_NAME, SESSION_TTL_DAYS,
                     DISCORD_CLIENT_ID, DISCORD_CALLBACK_URL.
    game-data/       Non-secret game limit settings only:
                     MAX_GAMES_PER_USER, MAX_EVENTS_PER_GAME,
                     MAX_EVENTS_PER_BATCH, MAX_STATE_BYTES, MAX_EVENT_BYTES,
                     MAX_SYNC_ATTEMPTS, SYNC_WINDOW_SECONDS.
    global-data/     Non-secret content settings only:
                     CONTENT_SCHEMA_VERSION, CONTENT_BUNDLE_MAX_BYTES.

If a settings-only module feels heavier than a locals block, the settings
may instead live beside their concern's resources — but never mixed across
concerns, and the app-settings contract below is unchanged.

### Application settings contract

Terraform-managed (non-secret): ENVIRONMENT, APP_BASE_URL,
SESSION_COOKIE_NAME, SESSION_TTL_DAYS, DISCORD_CLIENT_ID,
DISCORD_CALLBACK_URL, the seven limit settings, CONTENT_SCHEMA_VERSION,
CONTENT_BUNDLE_MAX_BYTES, APPLICATIONINSIGHTS_CONNECTION_STRING.

Manually installed via portal/CLI, ignored by Terraform, never in state or
tfvars: DATABASE_URL (pyodbc connection string), DISCORD_CLIENT_SECRET,
SIGNING_SECRET. Document the bootstrap procedure in `docs/`. Secrets must
never use public frontend environment prefixes. GitHub Actions secrets hold
DATABASE_URL for the migrate and publish workflows only.

### CI workflows (implemented — keep, plus §3.3 drift check)

- `azure-static-web-app.yml`: frontend tests, pytest against SQLite, API
  import check, build, deploy frontend + Python API together.
- `unit-tests.yml`: frontend + API tests on push; add the Alembic
  models-vs-migrations drift check here.
- `database-migrate.yml`: manual-dispatch `alembic upgrade head` against
  production.
- `global-data-sync.yml`: catalogue validation, publisher tests, publish on
  data changes.
- Agents never run Git, Terraform apply/state operations, or deployments.

## 9. Migration and Rollout

### Existing accounts

- Legacy Table Storage `Users` rows are imported into SQL `users` by a
  one-time, idempotent, documented migration script (read the legacy table,
  insert rows preserving username, scrypt hash, algorithm, and creation
  time). This script is the only remaining legitimate consumer of the
  legacy TS reader / azure-data-tables path and is removed together with
  §3.4 once it has run in production.
- Old cookies are not honored (decision 5): users log in again once; scrypt
  hashes upgrade to Argon2 on that login. Announce the cutover via Discord
  or a login-page notice.
- Legacy tables remain read-only under `prevent_destroy` until an explicit
  later cleanup decision by the user.

### Existing browser games (implemented — keep)

First load after the IndexedDB release imports valid
`virtual-pet-game-keys` sessionStorage games into IndexedDB with an outbox
record, marks the migration in metadata, and creates the server game with
the existing hash on first authenticated sync. A hash owned by another
account returns 409 GAME_HASH_CONFLICT; the local import is retained and
surfaced as an explicit conflict — never silently reseeded.

### Rollout order

1. Restructure Terraform per §8 until `terraform validate` passes cleanly;
   the user runs init/plan/apply. Install the three secret settings
   manually per the documented bootstrap.
2. Author the initial Alembic migration (§3.3); the user dispatches
   `database-migrate.yml`.
3. Run the legacy account import; verify one scrypt login upgrades to
   Argon2.
4. Publish the first content version; verify manifest 304 behavior and the
   immutable bundle endpoint.
5. Deploy API + frontend; validate register/login/logout, the manual reset
   runbook end to end, Discord callback, game sync, offline replay,
   competing-device 412 recovery, death finalization, and pagination.
6. Enable the Discord button only after production callback registration
   succeeds.
7. Remove the legacy TS API artifacts (§3.4) and resolve §3.5–§3.9.

## 10. Execution Plan

One implementer (a single agent or developer), sequential phases, each
landing against the real interfaces of the previous phase. No parallel
subagents, no mocked cross-contracts, no root-integration pass.

1. **Infrastructure & schema**: §8 Terraform restructure (§3.1, §3.2), the
   initial Alembic migration and CI drift check (§3.3), the publisher byte
   cap (§3.8).
2. **Backend correctness**: login branch cleanup (§3.6), per-write scan
   fixes and `last_event_at` (§3.7).
3. **Frontend consolidation**: game-session.ts delegation to the
   persistence layer (§3.5), runtime-content injection audit (§3.9).
4. **Migration & retirement**: legacy account import, then §3.4 removal.

Per AGENTS.md: no Git operations, no Terraform apply or state operations,
no deployments — those belong to the user. Keep `docs/RULES_AND_FILES.md`
and `docs/GAME_RULES.md` current when modules move.

## 11. Test Matrix

### Authentication

- Argon2 registration and login; scrypt login with one-time upgrade.
- Duplicate normalized username rejection; generic invalid-credential
  response identical for missing user and wrong password (verifies §3.6).
- Session expiry, logout scope, reset revoking all sessions.
- Admin CLI reset: issuance, expiry, single use, replay rejection,
  invalidation of prior unused tokens, no raw token at rest.
- Passwordless OAuth account: login attempt fails generically; a password
  can be added later while authenticated.
- Discord: state failure, provider failure, onboarding expiry/replay,
  successful login, explicit link, cross-account collision, no email-based
  linking.
- Same-origin rejection on mutations; throttle window boundaries; no
  secrets in logs or public responses.

### Persistence

- A failed batch leaves state, events, and committed_batches unchanged
  (transaction rollback).
- Identical retry returns the stored acknowledgement once; divergent
  batch-ID reuse is rejected; lost-response replay creates no duplicate
  history.
- Competing device write returns 412; IndexedDB replay rebases pending
  commands and resubmits successfully.
- Sequence gaps, duplicate event IDs, decreasing timestamps, oversized
  payloads, over-cap games/events, and sync-throttle breaches are rejected.
- Death commits once, blocks later writes, and the grave DTO derives solely
  from terminal state plus committed causal events.
- Pagination works from the first release; invalid or cross-owner
  continuation tokens are rejected.

### Content

- Canonical hashing is stable; republishing an identical bundle is
  idempotent; the same version with different bytes fails.
- The pointer flip is transactional; a failed publish leaves `current`
  untouched.
- Manifest 304; bundle immutability headers; an oversized bundle is
  rejected at publish (§3.8).
- Stale `X-Content-Version` is rejected before any write; refresh and
  replay produce events under the new version.
- Production gameplay modules contain no direct runtime JSON imports
  (§3.9); deterministic simulation tests produce unchanged results for the
  same content version.

### Infrastructure

- `terraform validate` passes; every root-module reference resolves (§3.1).
- Alembic upgrade from an empty database produces a schema matching the
  models; the CI drift check fails on divergence (§3.3).
- No secret values appear in Terraform state, plan output, or tfvars.

### End-to-end acceptance

- Register, log out, log in; an admin-issued reset is consumed exactly
  once.
- Create and link a Discord identity without losing password login.
- Create a game, play offline, reconnect, and synchronize only missing
  events.
- Reload on a second device and reconstruct history through paginated
  events; resolve a competing write via 412 replay.
- Encounter a content update while offline, refresh, replay, and commit.
- Finalize death once and reopen the same hash as a grave.
- Run pytest, Vitest, Svelte checks, Playwright, and Terraform validation.

## 12. Completion Criteria

The implementation is complete when:

- All nine §3 deviations are resolved and every §2 behavior still holds.
- Existing username/password accounts (imported from the legacy tables) can
  log in; scrypt hashes upgrade on first successful login.
- Discord is the only social sign-in; OAuth-native accounts need no
  password.
- Password reset works end to end through the admin CLI runbook, with the
  identity-verification policy committed to `docs/`.
- Game state survives browser closure and syncs across devices; offline
  commands remain durable in IndexedDB; only unacknowledged events are
  sent.
- Every sync batch commits as one database transaction; duplicate
  deliveries and lost responses cannot duplicate history.
- All collection APIs paginate; graves derive from terminal state with no
  separate grave storage.
- Runtime content comes from versioned SQL rows; stale content is rejected
  before writes and refreshed on CONTENT_VERSION_OUTDATED.
- The Azure footprint is exactly: one Static Web App (Free) with managed
  Python Functions, one Azure SQL Basic database, monitoring, and the
  read-only legacy storage account pending cleanup — no queue, no worker
  app, no email service.
- `terraform validate`, pytest, Vitest, and the E2E suite pass.
