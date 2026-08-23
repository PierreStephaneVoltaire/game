# Simulation rules and file map

The main app has one authoritative, session-only simulation. Svelte
renders typed view models and dispatches typed commands; it does not resolve
gameplay rules.

## Source data

- `src/lib/data/simulation-rules.json` — bounds, initial state, decay cadence,
  and configurable simulation values.
- `src/lib/data/shop-items.json` — the 225 canonical item definitions:
  prices, qualitative hints, hidden effects/properties, nutrition provenance,
  status/event hooks, actions, room placement, and generated PNG paths.
- `src/lib/data/catalogue/food-items.jsonl`,
  `food-nutrition.jsonl`, and `non-food-items.jsonl` — maintained,
  individually authored catalogue inputs. Nutrition facts stay separate from
  gameplay values so the compiler only joins records; it never derives scores.
- `src/lib/data/catalogue/canonical-item-ids.json` — explicit ordered
  225-item allowlist. The compiler and validator reject missing, unexpected,
  duplicated, or reordered IDs.
- `src/lib/data/pet-profile.json` — the configured companion identity and
  avatar path. Runtime code does not hardcode a companion name.
- `src/lib/companion-profile.ts` — typed, environment-neutral access to the
  configured identity and tier-ordered appearance IDs.
- `scripts/generate-canonical-catalogue.mjs` — deterministic compiler from
  the maintained JSONL inputs to `shop-items.json`; `--check` detects drift.

## Runtime modules

- `src/lib/game-types.ts` — run state, commands, events, outcomes, activities,
  history, and terminal death records.
- `src/lib/progression-types.ts` — Followers, career tiers, projects, queued
  event streams, appearances, donations, and scheduled-effect state.
- `src/lib/game-definition.ts` — versioned bundled definition and repository
  seam used by the pure engine and tests.
- `src/lib/game-constants.ts` — structural time units, stat bounds, and
  simulation limits shared by runtime modules.
- `src/lib/game-engine.ts` — pure `startRun`, `dispatchCommand`, and
  `reconcileTime` public seam.
- `src/lib/commands/activity-commands.ts` — start, wait, and timed-activity
  command resolution.
- `src/lib/commands/progression-actions.ts` — Commission Work and data-driven
  model/full-body service actions.
- `src/lib/commands/item-action-commands.ts` and
  `src/lib/commands/item-consumption.ts` — non-consume item actions and the
  consume-item transaction pipeline.
- `src/lib/commands/consumption-timed-effects.ts` and
  `src/lib/commands/consumption-rule-events.ts` — timed caffeine, Hyperfocus,
  Pain Relief, and authored status/reaction events for item consumption.
- `src/lib/commands/item-consumption-events.ts` — structured item discovery and
  reaction event construction for the consumption pipeline.
- `src/lib/commands/nutrition-resolution.ts` — catalogue nutrition effects
  and deterministic nutrition-event outcomes.
- `src/lib/commands/room-commands.ts` and
  `src/lib/commands/shop-commands.ts` — placement, removal, shop rotation,
  cart, and purchase commands.
- `src/lib/item-action-prerequisites.ts` — data-driven action
  prerequisite evaluation shared by the command layer and UI.
- `src/lib/simulation/reconcile-time.ts` — chronological reconciliation and
  the terminal-state guard.
- `src/lib/simulation/decay-resolution.ts` and
  `src/lib/simulation/timeline-effects.ts` — interval decay plus ordered
  boundary, status, and recurrence effects.
- `src/lib/simulation/timeline-opportunities.ts` and
  `src/lib/simulation/timeline-status-events.ts` — chronological autonomous
  opportunities, craving/shop deadlines, and narrated status transitions.
- `src/lib/simulation/health-resolution.ts` — critical-state detection,
  periodic recovery, and structured critical-need damage sources.
- `src/lib/simulation/dizzy-resolution.ts` — run-age, activity-protection,
  rolling-salt, and seeded Dizzy checks at Health boundaries.
- `src/lib/simulation/hyperfocus-resolution.ts` — scheduled Hyperfocus pinning,
  expiry penalties, and suppression of concurrent Creativity effects.
- `src/lib/simulation/death-resolution.ts` — structured terminal cause
  collection and causal event-chain construction.
- `src/lib/simulation/activity-completion.ts` — completion of Rest,
  Socialize, Play, Hospital, Commission Work, and stream activities.
- `src/lib/simulation/engine-state.ts` and
  `src/lib/simulation/run-state.ts` — immutable state/event helpers and
  canonical death construction.
- `src/lib/status-rules.ts` — metric status alignment, onset effects,
  recurrence, and status helpers.
- `src/lib/status-rules/context-statuses.ts` — context-driven status
  penalties, clearances, overstimulation, annoyance, and nutrition status
  resolution behind the status-rules facade.
- `src/lib/status-rules/fixed-point.ts` and
  `src/lib/status-rules/boundaries.ts` and
  `src/lib/status-rules/names.ts` and
  `src/lib/status-rules/nutrition-statuses.ts` and
  `src/lib/status-rules/low-metric-rules.ts` — fixed-point status cascades,
  chronological deadlines, and the canonical status vocabulary.
- `src/lib/status-rules/metric-source-reconciliation.ts` — uniform
  post-source status normalization and once-only onset effects.
- `src/lib/status-rules/natural-resolution.ts` — chronological Sick and Kidney
  Stone natural passage, including same-boundary passage-before-recurrence.
- `src/lib/event-candidate-pool.ts`, `src/lib/event-autonomous-actions.ts`,
  and `src/lib/event-hook-application.ts` — weighted event eligibility and
  cohesive autonomous/event-hook resolutions behind `event-rules.ts`.
- `src/lib/activity-rules.ts` — seeded activity distributions, refusals, and
  completion effects.
- `src/lib/event-rules.ts` — deterministic automatic event opportunity rules.
- `src/lib/event-stream-rules.ts` — queued Tournament and model-debut stream
  state.
- `src/lib/simulation/event-hook-resolution.ts` — seeded, data-authored
  automatic item-hook effects and their damage attribution.
- `src/lib/event-messages.ts` — user-facing copy for built-in event types.
- `src/lib/stream-rules.ts` — stream eligibility, dynamic event weight,
  daypart adjustment, duration, and autonomous-stream activity creation.
- `src/lib/billing-rules.ts` and `src/lib/debt-rules.ts` — Hospital coverage,
  ownership caps, debt shopping eligibility, and debt recovery suppression.
- `src/lib/economy-rules.ts` — stream income and coordinated career rewards.
- `src/lib/donation-rules.ts` and `src/lib/follower-rules.ts` — independent
  hourly donation tiers and exact elapsed-time Follower growth, milestone
  ordering, and career stream-rate bands.
- `src/lib/project-rules.ts` and `src/lib/project-economy-rules.ts` — rare and
  model project creation, third-local-midnight completion, rewards, and debut
  queues.
- `src/lib/shop-rules.ts` — local-date rotation, stock, and shop guarantees.
- `src/lib/seeded-rng.ts` — the only gameplay randomness implementation.
- `src/lib/game-controller.ts` and `src/lib/game-session.ts` — the
  in-memory browser/controller boundary.
- `src/lib/ui/journey-events.ts` — player-facing narrative projection over the
  immutable internal event ledger.
- `src/lib/ui/journey-status-messages.ts` — natural status onset, improvement,
  and recovery narration used by the Journey projection.
- `src/lib/ui/` — companion profile, centralized game copy, and typed view
  model mapping.
- `src/lib/catalog-validation.ts`,
  `src/lib/catalog-structure-validation.ts`,
  `src/lib/nutrition-validation.ts`, and
  `scripts/validate-assets.mjs` — strict catalogue, cross-reference,
  nutrition provenance, compiler-drift, and generated-PNG checks.

## UI modules

- `src/routes/login/+page.svelte` — username and eight-character key inputs,
  with a separate new-session key generator, followed by the
  Realtime/Streaming mode choice and navigation to the game. The current key is
  session-only and must not be treated as persisted account data.
- `src/routes/game/+layout.svelte` — shared game shell, game-entry and
  visibility-return Realtime reconciliation, Settings access, and the four
  destinations.
- `src/routes/game/+page.svelte` and `src/lib/components/GameRoom.svelte` —
  the centered three-row game page. Its first row is exactly two columns: one
  borderless vertical flex layout for stats, status, and time/money beside the
  established-size game display. Its second and third rows contain four
  aligned, identically sized care and Room/Shop/Inventory/History navigation
  controls. The companion event area renders only the actual event text. Feed
  and item-specific choices open dialogs; they are not persistent dropdowns.
  The room has eight anchors and uses the landing page's purple/orange visual
  system; the Settings details/summary dropdown only displays the current mode
  and simulation seed.
- `src/lib/components/room.css` — overview, care-row, event-caption, and Feed
  dialog presentation.
- `src/lib/components/room-scene.css` — daypart room, companion, and placement
  anchor presentation.
- `src/lib/components/CompanionOverview.svelte` — metrics, statuses, timed
  effects, Time/Money, debt, Followers, career, appearance, and project
  progress.
- `src/lib/components/GameShop.svelte`, `ShoppingCart.svelte`,
  `ShopItemGrid.svelte`, and `ItemDetail.svelte` — URL-addressable Shop, Cart,
  Inventory, item detail, debt-aware buying, and data-authored activity/service
  actions.
- `src/lib/ui/progression-view-model.ts` and
  `src/lib/ui/journey-progress-messages.ts` — career/project presentation and
  natural progression narration.
- `src/routes/game/history/+page.svelte` — narrated Journey, structured death
  cause list and causal Journey, and graveyard presentation.

Keep status behavior behind `status-rules.ts`, all configurable values in
data, and all simulation uncertainty in `seeded-rng.ts`. Realtime has no
minute-by-minute simulation loop: entry, visibility return, and the
pre-command path reconcile timestamps. Split a cohesive module before it grows
beyond roughly 300 lines.
