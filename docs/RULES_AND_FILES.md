# Simulation rules and file map

The main app has one authoritative, session-only simulation. Svelte
renders typed view models and dispatches typed commands; it does not resolve
gameplay rules.

## Source data

- `src/lib/data/simulation-rules.json` — bounds, initial state (including the
  starting Balance shared by the app and tests), decay cadence, Ending
  thresholds/warning stages, and configurable simulation values.
- `src/lib/data/activity-rules.json` — activity durations, refusals,
  completion rewards, and strong-outcome chance. Player-facing activity copy
  belongs to `event-texts.json`.
- `src/lib/data/shop-items.json` — the 258 compiled canonical item definitions:
  prices, qualitative hints, hidden effects/properties, nutrition provenance,
  status/event hooks, actions, room placement, and content-versioned generated
  PNG paths.
- `src/lib/data/catalogue/food-items.jsonl`,
  `food-nutrition.jsonl`, and `non-food-items.jsonl` — maintained,
  individually authored catalogue inputs containing every item and its final
  copy/gameplay fields. Nutrition facts stay separate from gameplay values so
  the compiler only joins records; it never derives scores.
- `src/lib/data/catalogue/canonical-item-ids.json` — explicit ordered
  258-item allowlist. The compiler and validator reject missing, unexpected,
  duplicated, or reordered IDs.
- `src/lib/data/pet-profile.json` — the configured companion identity and
  generic avatar path. Runtime code does not hardcode a companion name; the
  name-isolation validator keeps that display-only value out of structural
  identifiers, paths, assets, and infrastructure examples.
- `src/lib/data/financial-rules.json`, `ending-rules.json`, and
  `life-events.json` — versioned Balance/LOC terms, Ending thresholds and
  authored Ending/History/export copy pools, plus life-event eligibility,
  catalogue-purchase behavior, and seeded VTuber-life event outcomes and
  effects. Life-event definitions reference prose in
  `src/lib/data/event-texts.json`, which also owns built-in autonomous-event,
  status-transition, activity-completion, purchase, gift, and audience-growth
  text pools. Copy-pool selection is seeded and stable for its originating
  action or presentation event.
- `tools/global_content_publisher/bundle.py` — reads those eight runtime JSON
  documents, canonicalizes one complete immutable bundle, and derives its
  SHA-256 content version. The SQL publisher stores one row per bundle, never
  a row per item.
- `src/lib/companion-profile.ts` — typed, environment-neutral access to the
  configured identity and tier-ordered appearance IDs.
- `scripts/generate-canonical-catalogue.mjs` — deterministic compiler from
  the maintained JSONL inputs to `shop-items.json`; `--check` detects drift.

## Runtime modules

- `src/lib/game-types.ts` — run state, events, outcomes, activities, history,
  and shared simulation records.
- `src/lib/game-command-types.ts` — the complete typed command union accepted
  by the simulation engine.
- `src/lib/game-history-types.ts` — consumption history and chronological Run
  memory kept out of the shared command/event type module.
- `src/lib/ending-types.ts` — discriminated Run Ending records and separate
  Ending-risk clock state.
- `src/lib/progression-types.ts` — current/peak Subscribers, career tiers,
  projects, queued
  event streams, appearances, donations, qualifying ordinary-stream history,
  and scheduled-effect state.
- `src/lib/game-definition.ts` — complete runtime definition shape and the
  SQL/API bundle adapter used by the pure engine.
- `src/lib/test-game-definition.ts` — explicit test/balance fixture built from
  the JSON authoring files. Production modules do not import it.
- `src/lib/runtime-definition.ts` — active, versioned rule-document bindings;
  the game controller activates the cached SQL/API definition before engine
  code runs.
- `src/lib/content/runtime-content.ts` — IndexedDB-backed runtime bundle cache:
  it opens cached content without a network request, conditionally checks the
  manifest before writes, and atomically changes the bundle and active pointer.
- `src/lib/game-constants.ts` — structural time units, Advance Time picker options, stat bounds, and
  simulation limits shared by runtime modules.
- `src/lib/seeded-text.ts` — shared seeded selection and interpolation for
  JSON-authored event, Ending, History, and archive text pools.
- `src/lib/game-engine.ts` — pure `startRun`, `dispatchCommand`, and
  `reconcileTime` public seam.
- `src/lib/telemetry/collector.ts` — synchronous calculation collection scoped
  outside simulation state; records the original random draws and results.
- `tools/trace-instrumentation.ts` — instruments expressions in engine dependencies
  without evaluating operands twice; assigns source-rule IDs and an engine build digest.
- `src/lib/telemetry/capture.ts` and `state-changes.ts` — per-stream operation
  identity, initialization checkpoints, ordered state changes, and reconstruction.
- `src/lib/telemetry/console.ts` — browser console events and applied metric
  changes with action, calculation, and simulation-time evidence, independent
  of remote logging configuration.
- `src/lib/ui/session-state.ts` — publishes one final UI state per serialized
  session operation, combining local refresh, clock catch-up, and action effects.
- `src/lib/telemetry/financial.ts` and `nutrition.ts` — separate purchase/payment
  evidence and resolved feeding context, without changing financial or nutrition rules.
- `src/lib/telemetry/browser.ts`, `outbox.ts`, `batches.ts`, and `delivery.ts` —
  console capture with account-bound uploads, independent IndexedDB storage, lossless fragmentation,
  acknowledged uploads, and retained retry/rejection data.
- `src/lib/telemetry/reconstruction.ts` — ordered, read-only patch replay with
  event steps, checkpoint recovery, missing-record detection, and superseded streams.
- `src/lib/persistence/replay.ts` — verifies a committed save by batch identity
  or matching legacy snapshot; it never executes simulation rules.
- `src/lib/persistence/remote.ts` — complete saved-state/history downloads and
  atomic local cache replacement after pending data is reconciled.
- `src/lib/persistence/scheduler.ts`, `write-spacing.ts`, and `locks.ts` —
  debounced delivery, cross-tab write spacing, and serialized local transitions.
- `src/lib/persistence/save-points.ts` and
  `src/lib/simulation/resolution-boundary.ts` — completed simulation boundaries
  used to split large catch-ups within the existing save event limit.
- `src/lib/ui/intent-command.ts` — unique action inputs built with the reconciled
  state version and simulation timestamp.
- `api/backend/games/snapshot.py` and `diagnostics.py` — complete history hydration
  from the event ledger and save-rejection diagnostics without snapshot contents.
- `api/backend/telemetry/` — authenticated, same-origin validation and immutable
  compressed blob writes followed by queue acceptance.
- `telemetry-worker/` — separate queue-triggered chronological Table index;
  native poison handling preserves source blobs after six failed attempts.
- `src/lib/telemetry/*.test.ts`, `api/tests/telemetry/test_pipeline.py`, and
  `tools/check_telemetry.mjs` — reconstruction, determinism, conflict, storage,
  retry, account-switch, and browser persistence checks.
- `src/lib/ending-rules.ts` — pure terminal reconciliation for Death and the
  persistent Quit Streaming Mood-risk clock. Financial Ruin is finalized by
  the financial operation seam; Made It is finalized by audience progression,
  including normalization of previously saved Made It records.
- `src/lib/ending-rules/messages.ts` — typed seeded template selection and
  interpolation for Ending copy loaded from `ending-rules.json`; Ending prose
  is not authored in TypeScript.
- `src/lib/commands/activity-commands.ts` — start, wait, and timed-activity
  command resolution, including seeded or selected fixed wait durations.
- `src/lib/commands/progression-actions.ts` — Commission Work and data-driven
  model/full-body service actions.
- `src/lib/commands/item-action-commands.ts` and
  `src/lib/commands/item-consumption.ts` — non-consume item actions and the
  consume-item transaction pipeline.
- `src/lib/commands/inventory-mutations.ts` — shared inventory-unit decrement
  used by data-authored consuming actions.
- `src/lib/commands/batch-feeding.ts` — deterministic multi-item Feed command
  adapter that delegates every selected unit to the ordinary consume pipeline.
- `src/lib/commands/creator-services.ts` — merch-run and convention service
  actions, their `ventures` state, seeded merch flop/multiplier rolls, daily
  merch payouts, and convention completion boundaries.
- `src/lib/commands/clipper-action.ts` — the catalogue-action adapter that
  consumes Clippers and delegates their career effect to audience growth.
- `src/lib/commands/consumption-timed-effects.ts` and
  `src/lib/commands/consumption-rule-events.ts` — timed caffeine, Hyperfocus,
  Pain Relief, and authored status/reaction events for item consumption.
- `src/lib/commands/item-consumption-events.ts` — seeded catalogue narration
  selection and preparation-event construction for item consumption.
- `src/lib/commands/item-used-event.ts` — the structured primary consumption
  event, including manual/automatic narration and item damage attribution.
- `src/lib/commands/nutrition-resolution.ts` — catalogue nutrition effects
  and deterministic nutrition-event outcomes.
- `src/lib/commands/room-commands.ts`, `src/lib/commands/shop-commands.ts`, and
  `src/lib/commands/shop-cart-commands.ts` — placement, removal, ordinary
  purchases, and the shared atomic catalogue/LOC cart transaction.
- `src/lib/commands/medical-debt-commands.ts` — the all-or-nothing discounted
  medical payoff command, kept separate from inventory purchases.
- `src/lib/item-action-prerequisites.ts` — data-driven action
  prerequisite evaluation shared by the command layer and UI.
- `src/lib/simulation/reconcile-time.ts` — chronological reconciliation and
  the terminal-state guard.
- `src/lib/simulation/decay-resolution.ts` and
  `src/lib/simulation/timeline-effects.ts` — interval decay with paused care
  clocks, plus ordered
  project, autonomous-opportunity, Subscriber Revenue, status, and recurrence
  effects.
- `src/lib/simulation/decay-remainders.ts` — integer-millisecond need and
  Health interval remainders, reading legacy fractional-hour saves.
- `src/lib/subscriber-revenue-rules.ts` — interval eligibility, payout, and
  atomic financial settlement for Subscriber Revenue.
- `src/lib/simulation/timeline-opportunities.ts` and
  `src/lib/simulation/timeline-status-events.ts` — chronological autonomous
  opportunities, craving/shop deadlines, and narrated status transitions.
- `src/lib/simulation/health-resolution.ts` — critical-state detection,
  periodic recovery, capped applied damage, and raw/applied critical-need
  damage sources.
- `src/lib/simulation/post-health-rescue.ts` — ordered Food-then-Rest emergency
  autonomy after an applied periodic Health event.
- `src/lib/simulation/dizzy-resolution.ts` — run-age, activity-protection,
  rolling-salt, and seeded Dizzy checks at Health boundaries.
- `src/lib/simulation/hyperfocus-resolution.ts` — scheduled Hyperfocus pinning,
  expiry penalties, and suppression of concurrent Creativity effects.
- `src/lib/simulation/death-resolution.ts` — structured terminal cause
  collection and causal event-chain construction for the Death Ending.
- `src/lib/simulation/activity-completion.ts` — completion of Rest,
  Socialize, Play, Hospital, Commission Work, and stream activities.
- `src/lib/simulation/stream-completion.ts` — stream settlement diagnostics,
  qualifying ordinary-stream drought-reset decisions, and the long-stream Lost
  Voice onset roll.
- `src/lib/simulation/activity-completion-message.ts` — seeded selection of
  JSON-authored completion text, including interrupted-activity wording.
- `src/lib/simulation/activity-financial-settlement.ts` — Commission payout
  narration and atomic post-activity debt/Ending reconciliation.
- `src/lib/simulation/medical-care-completion.ts` — Hospital exposure clearing
  and locked medical-bill creation.
- `src/lib/simulation/engine-state.ts` and
  `src/lib/simulation/run-state.ts` — immutable state/event helpers and
  canonical Run construction.
- `src/lib/simulation/status-transition-events.ts` — generic narrated status
  transitions, with debt-specific events left to atomic financial settlement.
- `src/lib/audience-growth-rules.ts` — the deep module for stream-start
  audience snapshots, two-hour natural growth, Clippers activation/ticks,
  milestone settlement, and exact stream statistics.
- `src/lib/status-rules.ts` — metric status alignment, onset effects,
  recurrence, and status helpers.
- `src/lib/status-rules/context-statuses.ts` — context-driven status
  penalties, clearances, overstimulation, annoyance, and nutrition status
  resolution behind the status-rules facade.
- `src/lib/status-rules/fixed-point.ts` and
  `src/lib/status-rules/boundaries.ts` and
  `src/lib/status-rules/names.ts` and
  `src/lib/status-rules/nutrition-statuses.ts` — fixed-point status cascades,
  chronological deadlines, and the canonical status vocabulary.
- `src/lib/status-rules/metric-source-reconciliation.ts` — uniform
  post-source status normalization and once-only onset effects.
- `src/lib/status-rules/low-status-recurrences.ts` — chronological Lonely and
  Creative Block recurrence calculation behind the status-rules facade.
- `src/lib/status-rules/natural-resolution.ts` — chronological Sick, Kidney
  Stone, and Lost Voice natural passage, including same-boundary
  passage-before-recurrence.
- `src/lib/status-rules/sugar-crash.ts` — atomic six-hour effective-sugar
  accumulation, scheduling, pending cancellation, and active clearance.
- `src/lib/event-candidate-pool.ts`, `src/lib/event-selection.ts`,
  `src/lib/event-autonomous-actions.ts`, and
  `src/lib/event-hook-application.ts` — weighted event eligibility, seeded
  selection, and cohesive autonomous/event-hook resolutions behind
  `event-rules.ts`.
- `src/lib/event-resolution-finalizer.ts` — shared event result aggregation
  and atomic financial reconciliation after automatic events.
- `src/lib/activity-rules.ts` — care decay-pause policy, seeded activity
  distributions, refusals, normal/strong outcome selection, and completion effects.
- `src/lib/event-rules.ts` — deterministic automatic event opportunity rules.
- `src/lib/gameplay-spec-acceptance.test.ts` and
  `src/lib/gameplay-autonomy-acceptance.test.ts` — split survival/medical and
  autonomous/audience acceptance coverage kept below the file-size boundary.
- `src/lib/off-stream-support-rules.ts` — seeded off-stream payout, cooldown,
  Journey event, and shared income settlement.
- `src/lib/event-stream-rules.ts` — queued Tournament and model-debut stream
  state.
- `src/lib/simulation/event-hook-resolution.ts` — seeded, data-authored
  automatic item-hook effects and their damage attribution.
- `src/lib/event-messages.ts` — user-facing copy for built-in event types.
- `src/lib/stream-rules.ts` — stream eligibility, internal blocker/weight/drought
  diagnostics, daypart adjustment, duration, and autonomous-stream activity
  creation.
- `src/lib/billing-rules.ts` and `src/lib/medical-debt-rules.ts` — Hospital
  coverage, explicit payment-plan bills, local-day payments, and ownership
  caps.
- `src/lib/financial-rules.ts` and `src/lib/financial-types.ts` — obligation
  presentation plus Balance-only In Debt alignment and atomic crossing-based
  Financial Ruin finalization. LOC obligations and Hospital principal are not
  status or Ending triggers.
- `src/lib/autonomous-rescue-rules.ts` — player-care-only reset rules for the
  independent Food and Rest rescue locks.
- `src/lib/income-rules.ts` — the shared positive-income/debt settlement path.
- `src/lib/economy-rules.ts` — stream income, hourly donations, and coordinated
  donation/model career rewards.
- `src/lib/donation-rules.ts` and `src/lib/follower-rules.ts` — independent
  hourly stream-donation tiers, signed current-Subscriber settlement, peak
  milestone ordering, the Made It Ending, Subscriber Revenue multipliers, and
  career stream-rate bands.
- `src/lib/life-event-rules.ts`, `src/lib/life-event-types.ts`,
  `src/lib/life-event-random-resolution.ts`, and
  `src/lib/life-event-scheduler.ts` —
  data-authored, run-anchored, seeded, atomic life-event eligibility and
  effects, including real full-catalogue personal purchases; the dedicated
  scheduler owns the 30-minute boundary cadence and terminal-event stopping
  rules.
- `src/lib/simulation/reconcile-time-boundaries.ts` — chronological boundary
  planning and non-recursive catch-up for the dedicated 30-minute life-event
  scheduler during long time reconciliation.
- `src/lib/project-rules.ts` and `src/lib/project-economy-rules.ts` — rare and
  model project creation, third-local-midnight completion, rewards, and debut
  queues.
- `src/lib/shop-rules.ts` — local-date rotation, stock, and shop guarantees.
- `src/lib/seeded-rng.ts` — the only gameplay randomness implementation.
- `src/lib/game-controller.ts` and `src/lib/game-session.ts` — the
  in-memory browser/controller boundary.
- `src/lib/ui/journey-events.ts` — player-facing narrative projection over the
  immutable internal event ledger.
- `src/lib/ui/ending-view-model.ts` — Ending-specific cards and countdown
  presentation kept outside the general game view model.
- `src/lib/ui/financial-view-model.ts` — Balance debt, Hospital, and LOC
  presentation kept outside Svelte components and the general view model.
- `src/lib/ui/shop-offer-view-model.ts` — normalized catalogue and permanent
  LOC offers used by the same cards, quantity controls, cart, and preview.
- `src/lib/ui/journey-activity-messages.ts` — projects authored activity
  completion copy from `event-texts.json` and interruption narration.
- `src/lib/ui/run-archive-export.ts` — portable Markdown serialization for all
  Endings, using graveyard wording only for Death.
- `src/lib/ui/graveyard-export.ts` — Death-only compatibility adapter over the
  generic Run archive export.
- `src/lib/ui/journey-status-messages.ts` — natural status onset, improvement,
  and recovery narration used by the Journey projection.
- `src/lib/ui/` — companion profile, centralized game copy, and typed view
  model mapping.
- `src/lib/catalog-validation.ts`,
  `src/lib/catalog-structure-validation.ts`,
  `src/lib/nutrition-validation.ts`, `scripts/validate-assets.mjs`, and
  `scripts/validate-name-isolation.mjs` —
  strict catalogue, cross-reference, nutrition provenance, compiler-drift,
  generated-PNG, and display-name boundary checks. The name validator allows
  authored/display prose and the configured profile field, while rejecting
  names in filenames, asset paths, identifiers, IDs, seeds, infrastructure,
  cookies, state paths, and fenced code examples.
- `docs/ECONOMY_EVENTS_BALANCE_REPORT.md`,
  `docs/ECONOMY_EVENTS_BALANCE_RESULTS.json`,
  `docs/LOC_BALANCE_RESULTS.json`, and
  `docs/LIFE_EVENT_FREQUENCY_RESULTS.json` — generated balance-study outputs;
  the permanent skill contains the unchanged canonical regression and
  configuration-driven extension without retaining every simulation history in
  one process.
- `.agents/skills/game-balance-simulation/scripts/balance-cadence-analysis.ts`
  and `balance-cadence-report.ts` — internal opportunity/stream-gap accounting
  and report tables for fixed-seed ordinary-stream cadence acceptance.
- `.agents/skills/game-balance-simulation/scripts/balance-reconcile-through.ts`
  — study-only continuation through streaming-mode interruption boundaries so
  horizon observations land at the requested timestamp.
- `scripts/run-life-event-frequency-study.mjs`,
  `scripts/life-event-frequency-study.ts`, and
  `scripts/validate-life-event-frequency.mjs`
  — permanent seeded life-event frequency runner. It executes 1,000 isolated
  60-day runs (2,880 scheduler boundaries each) in 40 batches of 25 or fewer,
  then merges and validates the generic JSON output. Invoke it with
  `pnpm study:life-events`.
- `.agents/skills/game-balance-simulation/data/expanded-profiles-*.json` — the
  heterogeneous profile data. Shared schedule, session, care, shopping,
  medical, trace, and report behavior lives in the adjacent generic script
  modules rather than profile-specific branches.

## UI modules

- `src/lib/ui/room-look.ts` — room art layer selection: the career-tier room
  set, placed cosmetic items (Poster and Avatar anchors), and the wall/poster
  picker. `room.svg` layers are tagged `data-slot` and `data-variant`; set
  layers use the variant names `1`–`8`.

## UI terminology

Use the canonical names below in implementation and documentation. The
nicknames are prompt aliases only; each alias identifies one element.

### Game room

- Canonical: Game Room
  - Nicknames: Session Chamber, Companion Room, Main Care Room
- Canonical: Recent Event Cards
  - Nicknames: Event Feed Cards, Activity History Cards, Latest Event Stack
- Canonical: Status Card
  - Nicknames: Condition Panel, Active Status Strip, Status Summary
- Canonical: Advance Time control
  - Nicknames: Time Advance Button, Fast-Forward Control, Wait Duration Trigger
- Canonical: Game Room action buttons
  - Nicknames: Care Action Buttons, Room Command Buttons, Activity Controls
- Canonical: Game destination buttons
  - Nicknames: Room Shop Inventory History Buttons, Destination Tabs, Game Navigation Controls
- Canonical: Game Room action modals
  - Nicknames: Activity Choice Dialogs, Room Command Modals, Care Action Overlays
- Canonical: Item selection modal
  - Nicknames: Inventory Picker, Item Choice Dialog, Held Item Selector
- Canonical: Game Room game screen
  - Nicknames: Live Session Screen, Interactive Companion Screen, In-Game Display
- Canonical: Companion avatar
  - Nicknames: Room Character Portrait, Companion Sprite, Character Display

### Shop and inventory

- Canonical: Shop item tiles
  - Nicknames: Catalogue Tiles, Offer Cards, Store Item Blocks
- Canonical: Shop detail modal
  - Nicknames: Offer Details Dialog, Catalogue Detail Overlay, Item Info Modal
- Canonical: Inventory item tiles
  - Nicknames: Owned Item Cards, Holdings Tiles, Inventory Entries
- Canonical: Inventory detail modal
  - Nicknames: Owned Item Details, Inventory Info Dialog, Item Use Overlay
- Canonical: Shop cart
  - Nicknames: Purchase Basket, Checkout Tray, Cart Panel

### Landing page

- Canonical: Landing page game screen
  - Nicknames: Hero Device Preview, Home Companion Display, Marketing Game Mockup
- Canonical: Landing page avatar
  - Nicknames: Hero Companion Portrait, Preview Character, Landing Sprite
- Canonical: About button
  - Nicknames: About Link, Project Info Trigger, About Navigation Control
- Canonical: Sign in button
  - Nicknames: Login Link, Account Entry Button, Authentication Trigger
- Canonical: SESSION badge
  - Nicknames: Session Availability Badge, Live Status Badge, Session Indicator
- Canonical: Pocket-size routine section
  - Nicknames: Daily Routine Section, Tiny Routine Panel, Pocket Routine Block
- Canonical: Keep your little gremlin alive section
  - Nicknames: Companion Survival Section, Gremlin Care Block, Keep-Alive Feature Panel
- Canonical: Landing page metric cards
  - Nicknames: Hero Stat Tiles, Preview Care Cards, Landing Metrics Grid

### Account and setup

- Canonical: About page
  - Nicknames: Project Information Page, Companion Overview Page, About Screen
- Canonical: Login screen
  - Nicknames: Sign-In Screen, Account Access Page, Authentication Screen
- Canonical: Create account form
  - Nicknames: Registration Form, New Account Panel, Account Creation Form
- Canonical: Game key screen
  - Nicknames: Session Key Screen, Game Access Page, Save Key Screen
- Canonical: Game time screen
  - Nicknames: Time Mode Screen, Session Pace Page, Clock Choice Screen
- Canonical: Game time form
  - Nicknames: Time Mode Form, Session Pace Selector, Clock Behavior Form

### Game shell overlays

- Canonical: Settings modal
  - Nicknames: Session Settings Panel, Game Options Overlay, Configuration Popover
- Canonical: Shop modal
  - Nicknames: Store Dialog, Shopping Overlay, Catalogue Window
- Canonical: Inventory modal
  - Nicknames: Owned Items Dialog, Holdings Overlay, Backpack Window
- Canonical: Item detail modal
  - Nicknames: Item Information Dialog, Product Detail Overlay, Item Inspection Window

- `src/lib/accounts/` — browser-only account API client and account menu. It
  restores the HttpOnly-cookie session without local storage and does not own
  or persist simulation state.
- `src/routes/login/+page.svelte` and
  `src/lib/components/LoginWidget.svelte` — password-account registration and
  sign-in only. Successful authentication continues to the separate game-key
  page.
- `src/routes/key/+page.svelte`, `src/routes/mode/+page.svelte`,
  `src/lib/components/GameKeyWidget.svelte`, and
  `src/lib/components/TimeModeWidget.svelte` — eight-digit game-key entry and
  the on-demand retrieval control. New keys remain visible for confirmation
  before continuing to the separate Realtime/Streaming mode page; existing
  sessions open the game directly.
- `src/routes/game/+layout.svelte` — shared game shell, game-entry and
  visibility-return Realtime reconciliation, account gate and logout access,
  Settings access, and the four destinations.
- `src/routes/game/+page.svelte` and `src/lib/components/GameRoom.svelte` —
  the centered three-row game page. Its first row is exactly two columns: one
  borderless vertical flex layout for stats, status, and time/money beside the
  established-size game display. Its second and third rows contain four
  aligned, identically sized care and Room/Shop/Inventory/History navigation
  controls. The companion event area renders only the actual event text. Feed
  and item-specific choices open dialogs; single-item cards execute directly.
  Room includes furniture and usable actions outside Socialize and Play.
  The room has eight anchors and uses the landing page's purple/orange visual
  system; the Settings details/summary dropdown displays the current mode,
  simulation seed, and sign-out action.
- `src/lib/components/room.css` — overview, care-row, event-caption, and Feed
  dialog presentation.
- `src/lib/components/shop.css` and `shop-dialog.css` — stable Shop/card/cart
  layout and fixed offer-detail dialog presentation.
- `src/lib/components/room-scene.css` — daypart room, companion, and placement
  anchor presentation.
- `src/lib/components/CompanionOverview.svelte` — metrics, discovery-safe
  statuses, Time/Balance, Subscribers, career, appearance, and project progress.
- `src/lib/ui/companion-speech.ts` and `CompanionAvatar.svelte` — seeded quote
  selection for item use, taps, idle contexts, and event/activity/status
  transitions; speech waits for open dialogs to close.
- `api/backend/content/quotes.py` and root `companion-quotes.json` — validated
  quote pools retaining verbatim text and source metadata, with optional in-game edits.
- `src/lib/components/GameShop.svelte`, `ShoppingCart.svelte`,
  `ShopItemGrid.svelte`, `QuantityStepper.svelte`, `InventoryBrowser.svelte`,
  and `ItemDetail.svelte` — URL-addressable Shop, shared catalogue/LOC Cart,
  actual-inventory browsing, inert card bodies, separate Info controls, held
  quantity controls, and data-authored activity/service actions.
- `src/lib/ui/progression-view-model.ts` and
  `src/lib/ui/journey-progress-messages.ts` — career/project presentation and
  natural progression narration.
- `src/lib/ui/unique-presentation-id.ts` — deterministic collision-safe keys
  for legacy or malformed duplicate IDs in rendered history lists.
- `src/routes/game/history/+page.svelte` — narrated Journey, Ending-specific
  evidence and causal Journey, Death-only graveyard presentation, neutral Run
  archives, and local Markdown export.

## Backend and infrastructure modules

- `api/backend/auth/` — SQLAlchemy users/sessions/reset/OAuth models, Argon2,
  Authlib Discord OAuth, native Azure Function routes, and the manual reset
  CLI.
- `api/backend/games/` — transactional SQL game state, append-only events,
  idempotent batches, structural validation, graves, and paginated reads.
- `api/backend/content/` and `tools/global_content_publisher/` — immutable
  SQL runtime bundles, current-pointer reads, version enforcement, and the
  validated publisher.
- `src/lib/persistence/` — IndexedDB games, events, outbox, and single-game
  delivery. Attempted batches are frozen; later saves form a new batch using
  the actual acknowledged server version and event cursor when first sent.
  Creation and write retries retain their identities across content updates.
  Snapshot uploads omit duplicated history, which is restored from the ordered
  event ledger on reads; completed simulation boundaries keep event batches bounded.
- `tools/check_gameplay.mjs` — real IndexedDB regressions for action identity,
  overlapping saves, retries, competing devices, and fresh-browser restoration.
- `infra/shared` — one long-lived state (`shared.tfstate`): the Entra-only
  PostgreSQL server (tagged `stack = shared`), Log Analytics/App Insights, the
  telemetry worker and its storage, the quote reader role, and the monthly
  budget alert. It applies only from `main` or a manual `apply_shared` run.
- `infra/env` — one state per environment (`env-prod.tfstate`,
  `env-stage.tfstate`, selected by `TF_VAR_env`): that environment's Static
  Web App, its own database on the shared server, DNS records, custom domain,
  and non-secret app settings. It finds the DNS zone and server by Azure
  lookups, so the domain is never a variable. Prod serves the zone apex; stage
  serves `stage.<zone>`.
- `infra/modules/static-app`, `auth`, `game-data`, and `global-data` — the
  Static Web App resource and app-setting groups used by `infra/env`.
- `.github/workflows/azure-static-web-app.yml` — `main` deploys to prod and
  every other branch to stage; each deploy publishes the content bundle and
  quotes to its own environment's database, and `tools/configure_api.py` adds
  the CI-held secrets on top of the Terraform settings.

Keep status behavior behind `status-rules.ts`, all configurable values in
data, and all simulation uncertainty in `seeded-rng.ts`. Realtime has no
minute-by-minute simulation loop: entry, visibility return, and the
pre-command path reconcile timestamps. Split a cohesive module before it grows
beyond roughly 300 lines.
