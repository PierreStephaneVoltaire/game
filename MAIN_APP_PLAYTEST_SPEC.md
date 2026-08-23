# Main-app local playtest specification

## Product boundary

The deliverable is a static, memory-only companion-care game. A tester enters a
username and eight-character key, chooses Realtime mode or Streaming mode, and
plays one run until terminal death.

- The app has no backend, save repository, storage-backed recovery, telemetry,
  or runtime network API.
- Refreshing or reopening silently starts a fresh Realtime run.
- Username/key recovery, rollback prevention, cross-run keepsakes, restart,
  reset, mode switching, offline recap, and attention calls are absent.
- Feedback is collected outside the app.
- Companion identity and appearance paths come from the configured profile.

## Routes and fixed UI contract

- `/` keeps the established landing page and purple/orange visual language.
- `/login` contains username and key inputs, new-session key generation, Sign
  in, then exactly Realtime mode and Streaming mode choices. The key never
  enters the URL.
- `/game` contains the fixed three-row room.
- `/game/shop` is one URL-addressable Shop, Cart, Inventory, and Item Detail
  workspace.
- `/game/history` contains Journey, structured terminal causes, causal Journey,
  and graveyard presentation.

The room remains:

1. an overview row with one borderless vertical Stats/Status/Time-Money column
   beside the established-size room;
2. four equal care buttons: Feed, Rest, Socialize, Play; and
3. four equal navigation buttons: Room, Shop, Inventory, History.

Settings is a read-only details/summary dropdown for current mode and seed.
Feed and item actions use dialogs rather than persistent dropdowns. The room
keeps Bed, Desk, Chair, Wall, Floor, Shelf, Window, and Cat corner anchors, one
item per anchor. The latest-event area contains only the latest projected
Journey narration.

Beneath Time/Money, the overview presents Followers, career tier, next
milestone, debt labeling, background-project progress, active appearance, and
Hyperfocus/Pain Relief deadlines. Timed effects are not presented as statuses.
Hospital requires a confirmation showing 12 hours, insured or uninsured
charge, and card consumption. Shop controls explain debt eligibility by
category. Rigging Tablet exposes Commission Work in item detail without adding
a fifth care button.

All layouts remain keyboard usable, screen-reader labeled, focus visible,
reduced-motion aware, and free of horizontal overflow at 320px and 1440px.

## Public architecture

The browser-independent engine has only these public transitions:

```ts
startRun(input, definition): GameState
dispatchCommand(state, command, definition): Transition
reconcileTime(state, targetTime, definition): Transition
```

Transitions are immutable. Inputs carry explicit time, seed, command ID, and
optional expected state version. The engine has no Svelte, browser, storage,
network, or timer side effects. A versioned `GameDefinitionRepository` loads
the bundled definition; no persistence interface is part of this release.

The browser controller owns cryptographic root-seed creation, definition
loading, one in-memory state, and typed view-model projection. In Realtime mode
it reconciles on game entry, visibility return, and immediately before a
command. It does not poll the simulation minute by minute.

All gameplay chance is keyed through `seeded-rng.ts` by seed, state version,
action/opportunity identity, rule, and roll. Gameplay code never uses
`Math.random()`. Structural constants stay in `game-constants.ts`; configurable
rules and item behavior stay in JSON.

## State contract

`GameState` includes:

- the six metrics, balance, Inventory, room, exact reversible room modifiers,
  Shop, active activity, immutable event ledger, processed command receipts,
  structured death, and run-local timezone;
- persistent status records, including natural-pass deadlines for Sick and
  Kidney Stone;
- run start and next two-hour autonomous boundary, craving onset/refresh count,
  per-item-type Bond placement cooldowns, seeded Annoyed threshold, and the
  last completed Commission Work date;
- one caffeine-deferred Rest deadline plus Hyperfocus and Pain Relief
  deadlines;
- Followers, career tier, awarded milestones, unlocked/completed model tiers,
  active appearance, queued fixed streams, and permanent 3D Debut bonus; and
- nonblocking rare/full-body and model projects.

`StatusName` includes `dizzy_spell`. `Activity` includes `commission_work`.
Health-clock protection is an explicit activity whitelist; Commission Work is
not protected. Item definitions support ownership caps, fixed stock ranges,
sugar-serving overrides, progression eligibility, event-pool modifiers, and
data-authored activity/service actions. The companion profile maps every
appearance ID to a label and asset path.

The typed game view model exposes Followers, career/next milestone, debt,
projects, effects, Hospital terms, and active avatar in addition to the
existing room, metrics, statuses, catalogue, inventory, and Journey fields.

## Simulation contract

The complete player-facing behavior is normative in `docs/GAME_RULES.md`. The
following boundaries are especially important for implementation acceptance:

### Chronology

- Realtime one-shot and incremental catch-up are equivalent and idempotent.
- The run-anchored two-hour autonomous clock exists in both modes and is
  independent from attempt-owned opportunities.
- Historical boundary time controls dayparts, cooldowns, eligibility, local
  dates, shop refreshes, project deadlines, and stream completion.
- Activities permit narration/stat candidates but gate new stream and
  autonomous-Rest candidates.
- Streaming Advance Time supports autonomous-Rest overshoot and first-critical
  grace exactly as documented.
- A catch-up stream completes only if its end is at or before the target;
  otherwise it remains active.

### Status and fairness

- Every metric-changing source performs one uniform fixed-point status
  reconciliation and once-only onset effects.
- Dizzy onset belongs to later unprotected Health checks, not consumption;
  consumption can clear it by reaching salt 5/water 4.
- Kidney Stone natural passage precedes same-time recurrence. Painkillers
  suppress 12 hours of recurrence without curing it. Sick passes at 48 hours.
- Caffeine has one pending deferred Rest loss. Hyperfocus is scheduled, pins
  Creativity, applies expiry costs, and can interrupt a newly critical
  activity.
- Only genuine refusals advance the seeded 3–5 Annoyed threshold. The warning,
  reset, and while-active behavior are exact.
- Repeated Socialize/Play completions suppress Mood rather than escalating
  refusal chance.
- Cravings expire at 24 hours or the second crossed shop refresh.

### Economy and activities

- Hospital locks coverage at start, consumes one Insurance Card for a $500
  bill or charges $10,000, and retains its 12-hour protection and recovery.
- Already-negative balances allow Food and Medicine only and apply Mood −1
  once per successful command. Positive insufficient balances never cross into
  debt through shopping.
- Debt reduces recovery score by one per $2,500, capped at 3, and causes no
  direct damage.
- Commission Work is a six-hour Rigging Tablet activity with daily eligibility,
  ordinary decay/Health, critical interruption, starting-Creativity payout,
  and one completion opportunity.
- Automatic stream snacks are Liked or Variable and never affect Annoyed or
  interaction-inactivity clocks.
- Non-quantity durables reject quantities above one in direct and cart flows.

### Streams and career

- Each completed whole stream hour rolls its own donation, including an
  interrupted stream's completed hours.
- Donation chance, eligible weighted tiers, exact amount ranges, Followers,
  special dates, Tournament multiplier, and final-debut bonus match the rule
  reference.
- Normal stream Followers integrate exact prime and non-prime time, then round
  once. Interrupted streams receive no base Followers.
- Ordered milestones support several thresholds in one result and apply stream
  rates, Mood, fee, unlocks, and Tournament queue once.
- The career ladder is Debut (100), First Model (150), 1K Subscribers (1,000),
  Model Redesign (5,000), Twitch Partner (10,000), 30K Subscribers (30,000),
  Tournament Appearance (40,000), 50K Subscribers (50,000), Convention Guest
  (75,000), 100K Subscribers (100,000), 3D Ready (150,000), 200K Subscribers
  (200,000), 250K Subscribers (250,000), 500K Subscribers (500,000), and 1M
  Subscribers (1,000,000).
- Rare and model projects complete on their third local midnight. Model rewards
  change profile-driven appearance and queue four-hour debut streams. The
  fourth completion grants the permanent donation bonus.
- Queued Tournament/debut streams wait for an unblocked prime opportunity,
  ignore ordinary Rest-duration subtraction, cap at midnight, and remain
  interruptible by a new critical condition.

## Catalogue, nutrition, and assets

The canonical definition contains exactly 225 IDs and these category counts:

| Food | Medicine | Care | Reusable | Upgrade | Decoration |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 109 | 2 | 3 | 73 | 22 | 16 |

Canonical replacements are `mini-tacos`,
`cheeseless-toppingless-pizza`, and `the-concoction`. The added definitions are
Insurance Card, Painkillers, Electrolyte Sachet, Jar of Pickle Juice, Sheet of
Cute Stickers, Rigging Tablet, Limited-Edition Dr Pepper, Convention Guest Set,
and New Model Commission. Every eligible item participates in the 24-item
rotation; milestone-gated items enter only after unlock.

Every catalogue record has a nonempty array of seeded item-use narration.
Journey prefixes the configured companion name; it does not create discovery
events for familiar foods or possessions.

Each catalogue ID has one unique valid 256×256 transparent PNG. While the
commissioned companion artwork is pending, the classic appearance and four
model tiers share a temporary, transparently pixelated 256×256 PNG selected
through profile data, never frontend name/path branches. The distinct
appearance IDs and progression behavior remain intact so commissioned artwork
can replace the profile paths without frontend changes.

Food nutrition records include exact serving facts, nullable missing values,
source type, exact source record, retrieval date, and pinned snapshot date.
Gameplay scores are authored rather than calculated at runtime. The Concoction
has three explicitly fictional seeded profiles. Source methodology and the 109
Food records plus Salt Tablet are recorded in
`docs/research/FOOD_NUTRITION_SOURCES.md` using first-party labels, USDA
Foundation 2026-04-30, and FNDDS 2024-10-31.

## Journey and terminal behavior

The internal ledger retains commands, reconciliation, opportunity, status,
activity, economy, project, and causal damage records. Journey projects only
natural narration. It includes catch-up events, donations, milestones,
commissions, medical recovery, craving expiry, timed effects, Dizzy, care
packages, model debuts, item-authored reactions, and structured death.

Reconciliation, decay, random-opportunity bookkeeping, shop refreshes,
nutrition counters, command receipts, and internal causal bookkeeping remain
hidden. Death freezes mutation, lists every structured cause, shows the causal
Journey, and displays the graveyard with no restart action.

## Acceptance gate

Vitest coverage exercises the public engine/definition seams for chronology,
status normalization, Wait grace, autonomous behavior, debt, insurance,
donations, Commission Work, Followers, milestones, projects, dynamic catalogue
eligibility, quantity caps, nutrition provenance, terminal causes, and fresh-run
boundaries. Playwright covers the fixed login/game flow, responsive room,
career overview, debt-aware Shop, Hospital confirmation, commission action,
avatar switching, Journey, accessibility, and absence of third-party requests.

Completion requires green output from:

```text
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
