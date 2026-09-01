# Economy and difficulty tuning plan

Status: Phase 1 (change sets A + B) implemented on 2026-09-01; change sets D
and E remain proposed, and C remains deferred. A landed with the values below.
B preserves the finalized prices in `shop-items.json`, now synchronized into
the maintained catalogue inputs so compiler drift checks pass. The evidence
base remains the static rule data, the casual run
`bri-graveyard-2026-11-06.md`, and the existing
`ECONOMY_EVENTS_BALANCE_REPORT.md`; the post-change balance study is pending.

## 1. Goals

Sixty-day Subscriber targets by playstyle:

| Playstyle                     | 60-day Subscriber target | Today (evidence)                                 |
| ----------------------------- | -----------------------: | ------------------------------------------------ |
| Casual (checks in, no plan)   |                  250,000 | Bri (neglect): 250K on d40, 1M on d49, 3M on d61 |
| Focused (plays with the goal) |                  500,000 | Study focused median 3.6M                        |
| Min-max                       |                1,000,000 | Study optimal median 4.9M                        |

Money goals:

- $1,000+ days should be possible but rare and memorable — one or two per
  run, like real life — not routine. Today they are routine: Bri averaged
  ~$400/day passively and had five separate donation hits over $1,000.
  Ordinary whale donations get capped at $1,000; only the Creativity-10
  legendary exceeds it.
- The Shop must not be trivial. The whole 232-item catalogue costs $10,253
  today — less than one uninsured Hospital visit. Bri bought 142 items for
  $1,270 total and never felt a price.
- Big career purchases should require deliberate saving, not pocket change.

Health goal: shorten the terminal-neglect window. Bri survived ~9 continuous
days of Starvation + Sleep Deprivation damage at the end of her run.

## 2. Evidence summary (Bri's 67-day casual run)

Income (journal amounts are exact; hidden amounts estimated from config and
her milestone dates):

| Source                      |       Amount | Notes                                                |
| --------------------------- | -----------: | ---------------------------------------------------- |
| Stream donations            |      $11,318 | 11 hits; 5 whale hits ≥$1,000 supplied $10,455 (92%) |
| Off-stream support          |       $2,913 | 53 hits, avg $55, ~every 12h regardless of play      |
| Stream cash (hidden)        | ~$6–10k est. | 93 stream starts; $15–28/h band from day 17          |
| Subscriber Revenue (hidden) |    ~$4k est. | floor $2–3/tick early, ×10 multiplier by day 49      |
| Commissions + Convention    |       $1,134 | full-body $519, Commission Work $115, fee $500       |
| **Gross total**             | **~$25–30k** | ~$400/day average                                    |

Expenses: Shop $1,270, medical $9,798 (three visits, all settled at the 85%
discount), tax $159. The Hospital was the only sink that ever mattered; the
Shop absorbed ~5% of income.

Ranked problems:

1. **Whale donation tiers** — $1,000–3,000 at weight 14 and a $10,000
   legendary at weight 4 dominate lifetime income and make daily income spiky
   and unrealistic.
2. **Off-stream support** — a $5–100 seeded gift every ≥12 hours pays even a
   fully idle run ~$40–80/day forever. By design it is the ad-revenue floor
   that keeps a low-stream-count run out of a poverty softlock, so it gets
   reduced, not removed — the floor stays, the salary goes.
3. **Catalogue pricing** — durables and career gear cost toy prices
   (Live2D model $225, PC parts $200, camera $185, New Model Commission $300),
   so income has nowhere meaningful to go.
4. **No recurring sinks** — outside Hospital and the rare tax bill, money only
   accumulates.
5. **Subscriber ladder slightly fast** — natural tier rates plus
   stream-contribution stacking outpace the targets from the mid tiers onward.
6. **Health neglect window** — 40 HP with capped 2-damage checks tolerates
   about a week of total neglect.

## 3. Target economic envelope

Intended 60-day outcomes after tuning (inferred, to be validated later with
the maintained study — not engine-tested):

| Playstyle | Gross income | Spend expected          | Ending cash |
| --------- | -----------: | ----------------------- | ----------: |
| Casual    |      ~$8–11k | ~$5–8k                  |     $1.5–3k |
| Focused   |     ~$12–16k | ~$8–12k                 |       $3–6k |
| Min-max   |     ~$18–24k | ~$14–20k (career sinks) |       $4–8k |

Time-to-afford benchmarks (the "don't breeze through the shop" feel):

| Purchase                     |  New price | Feel target                          |
| ---------------------------- | ---------: | ------------------------------------ |
| Daily food + care            | $10–25/day | Always affordable, never free        |
| First streaming-gear piece   |   $150–400 | 3–5 days of early saving             |
| Rigging Tablet               |       $699 | ~1 week before Commission Work opens |
| New Model Commission         |     $1,000 | A deliberate mid-run savings goal    |
| Uninsured Hospital ($10,000) |  unchanged | A genuine financial event            |

## 4. Change set A — income reductions (IMPLEMENTED)

All in `src/lib/data/simulation-rules.json` unless noted.

### A1. Donation tiers (`stream.donations.tiers`) — the primary lever

Design intent: $1,000+ donations stay possible — they happen in real life —
but they should land roughly once or twice per run, not five times, and the
ordinary whale tier caps at $1,000. Only the Creativity-10 legendary goes
past it.

| Tier            | Today                                 | Proposed                              |
| --------------- | ------------------------------------- | ------------------------------------- |
| kind_supporter  | weight 55, $20–60                     | weight 58, $10–40                     |
| raid_windfall   | weight 27, $100–400                   | weight 30, $60–200                    |
| whale           | weight 14, $1,000–3,000               | weight 10, $400–1,000                 |
| legendary_whale | weight 4, $10,000 flat, Creativity 10 | weight 2, $2,000–5,000, Creativity 10 |

Effect: expected value per donation hit drops from roughly $750 to roughly
$150. Bri rolled 11 donation hits over 67 days; at the new weights that
yields about one whale and, at best, a coin-flip legendary per run — the
one-or-two-big-days-per-run cadence. The legendary remains the only way past
$1,000 in a single hit, gated behind Creativity 10, and stays a real event
($2,000–5,000) rather than the current run-defining $10,000. Direct
Subscriber awards (+5 / +30) are untouched.

### A2. Off-stream support (`events.offStreamSupport`)

- `cooldownHours`: 12 → 24.
- `payout`: $5–100 → $5–40.

Effect: idle income falls from ~$50–80/day to ~$10–20/day. This is
deliberately a reduction, not a removal: off-stream support is the game's
ad-revenue analogue and the anti-softlock floor for runs with low stream
counts. ~$10–20/day still covers staple food indefinitely (staples stay
$1–4 under B1), so a poverty softlock remains impossible, but the floor no
longer doubles as a salary.

### A3. Stream hourly-rate bands

- Base band `stream.income.minimumRate` 8, `rateSlots` 11 ($8–18) → 6 and 7
  ($6–12).
- Milestone bands in `progression.milestones`: `sub_1k` [12, 22] → [9, 16];
  `twitch_partner` [15, 28] → [12, 20].

Effect: roughly a 30% cut to the steady engine. Stream cash stays the main
earned income, but a long stream pays ~$60–120, not ~$150–250.

### A4. Sponsored-stream deal (`src/lib/data/life-events.json`)

Kept rewarding. Sponsor deals are authored as rare (1/2400 per 30-minute
boundary, ~~1.2 per 60 days expected) and seeing one should feel great, so the
range stays high: `cashRange` $250–2,000 → **$250–1,500**. Only the top end
comes down so a lucky roll does not out-earn a whole week by itself; the
median deal (~~$875) still lands like a real sponsorship. If the balance study
later shows sponsor income breaking the envelope, tighten frequency
(`rollDenominator`) before touching the reward — rare-but-rewarding is the
contract.

### A5. Keep unchanged (earned or already small)

- Commission Work (`$40 + $15 × Creativity`) — effortful, capped, daily.
- Full-body commission $400–800 — rare, 14-day cooldown.
- Drawing Tablet / Merch Sample side gigs ($20–60 / $15–50) — small and gated.
- Subscriber Revenue — even at ×10 it is only ~$120/day; it is the growth
  reward and stays as is.
- Convention $500 fee, Mom's Care Package, personal purchase.

## 5. Change set B — real-life-anchored repricing (IMPLEMENTED)

The compiled `shop-items.json` prices are the finalized values. Those exact
prices are mirrored in the catalogue JSONL and merge sources so
`node scripts/generate-canonical-catalogue.mjs --check` can verify the output
without changing gameplay prices.

### B1. Food (114 items) — finalized authored prices

Food prices remain exactly as finalized in the compiled catalogue. They span
$1–15 and are individually authored rather than derived from Food points.
The survival staples remain inexpensive: Water $1, Five Plain Tortillas $1,
Oatmeal $2, Lettuce $1, and Banana $1.

Representative finalized prices are Sushi $4, Steak $13, BBQ Ribs $9,
Cheeseburger $5, Burrito $5, Açaí Bowl $3, and Fruit Smoothie $2.
Limited-Edition Dr Pepper is $2 and Three-Month-Old Rotisserie Chicken is $5.

The affordable-edible and hydration guarantees remain unchanged, so every
rotation retains an early-game survival option.

### B2. Streaming/PC gear and furniture — real prices

| Item                    | Final price | Anchor              |
| ----------------------- | ----------: | ------------------- |
| PC Parts                |        $639 | PC refresh          |
| Console                 |        $449 | current-gen console |
| Camera                  |        $799 | mirrorless body     |
| Drawing Tablet          |        $149 | drawing tablet      |
| Monitor                 |        $199 | desktop display     |
| Studio Mic              |        $299 | mic + interface     |
| Music Software          |        $179 | DAW license         |
| 3D Printer              |        $219 | entry printer       |
| Stream Deck             |        $139 | retail              |
| Desk Chair              |        $159 | office chair        |
| New Bed / Soft Mattress |   $249/$299 | furniture           |
| Sofa / New Desk         |   $799/$209 | furniture           |
| Mini Fridge             |        $119 | retail              |

All other comfort, hobby, care, and decoration prices likewise retain their
finalized compiled values.

### B3. Career items — the headline sinks

| Item                     | Final price |
| ------------------------ | ----------: |
| New Model Commission     |      $1,000 |
| Live2D Model (reusable)  |        $850 |
| Rigging Tablet           |        $699 |
| Rigging Software Upgrade |        $229 |
| Convention Guest Set     |        $528 |
| Commissioned Art         |        $200 |

If per-tier model pricing is wanted later (e.g. $1,500 / $2,500 / $4,000 /
$6,000 across the four tiers), that remains a future schema addition rather
than part of Phase 1.

Guardrails: the shop guarantees in `shop.guarantees` (affordable edible plus
hydration item every rotation) already protect the early game and stay
unchanged. Starting $60 still buys several days of food.

## 6. Change set C — sinks that scale (DEFERRED)

The whole of change set C is deferred until the game is stable. It requires
schema and resolver changes (not pure data), it is the riskiest set for
Financial Ruin pressure, and A + B + D + E should be measured on their own
first. It stays in the plan as the agreed next lever if the ending-cash
envelope is still too rich after Phases 1–4.

### C1. Tax bill scales with success (schema addition, `life-events.json`)

Replace the flat $100–1,000 `cashRange` with a tier-scaled table, seeded
uniformly within the band for the current career tier: Debut–1K $100–400;
Model Redesign–100K $400–1,500; 3D Ready and above $1,500–5,000. Keeps the
"streaming money is real income" joke true at every scale. Requires a small
schema/resolver addition; the nonnegative-Balance eligibility rule stays.

### C2. Equipment Failure charges the real price

Today it charges an independent seeded $30–500 regardless of the named item.
Change it to `round(catalogue price × seeded 0.6–1.1)` of the selected
PC-related item. With B2 repricing, a dead PC Parts event is a real $383–703
problem instead of a $30 shrug. Schema addition in the same file; still no
inventory or repair state, still nonnegative-Balance gated.

### C3. Optional (last within C): cost of living

A configurable daily upkeep (rent/utilities, ~$20–35/day, charged at local
midnight after income, never taking cash below $0 — same shape as medical
daily payments) would convert the passive-income floor into a true
break-even game. This is a new financial rule family
(`financial-rules.json` plus billing modules) and materially increases
Financial Ruin pressure, so it ships separately behind its own study pass —
not in Phase 1.

## 7. Change set D — slight Subscriber-pacing trim

Bri reached 250K on day ~40 with neglect-tier play. To land casual at ~250K
near day 60 the mid/high natural tier rates come down ~30–40%; because the
ladder compounds, modest per-tier cuts move the tail a lot. In
`progression.naturalAudience.tierRates`:

| Tier                 |     Today |  Proposed |     | Tier          | Today | Proposed |
| -------------------- | --------: | --------: | --- | ------------- | ----: | -------: |
| debut / first_model  |     1 / 2 |      keep |     | sub_100k      |   300 |      190 |
| sub_1k               |        10 |         8 |     | three_d_ready |   400 |      260 |
| model_redesign       |        20 |        15 |     | sub_200k      |   500 |      330 |
| twitch_partner       |        60 |        42 |     | sub_250k      | 1,000 |      600 |
| sub_30k              |        80 |        56 |     | sub_500k      | 2,000 |    1,200 |
| tournament           |       100 |        70 |     | sub_1m        | 2,000 |    1,400 |
| sub_50k / convention | 150 / 200 | 105 / 140 |     |               |       |          |

Keep unchanged: milestone thresholds, the 7-day stream-contribution window,
the full-value-4 / ×0.25 stacking, discovery boosts, and Clippers. If the
first study pass shows casual still overshooting, the second lever is
`fullValueBoostCount` 4 → 3 — do not stack both cuts blind.

Note: hitting the targets exactly may need deeper cuts than "slight"; these
numbers are the conservative first step and are explicitly meant to be
re-measured, not trusted.

## 8. Change set E — Health cap

In `simulation-rules.json`:

- `healthMaximum`: 40 → **30** (recommended), `startingMetrics.health`:
  32 → 24 (same 80% ratio).
- Keep the critical band (1–8), recovery buckets, damage values, and the
  2-per-check cap unchanged — one lever at a time.

Effect: the pure-neglect runway shrinks ~25% (Bri's ~9 terminal days become
roughly 6.5–7). The prior study already shows ~35% of common profiles dying
at 40 HP, so the 25-cap option is held in reserve; going straight to 25
(starting 20) risks tipping casual play from "punished" into "unwinnable"
and should only follow a measured 30-cap pass.

## 9. Interactions and risks

- **Hospital**: unchanged at $10,000/$500 it becomes genuinely scary under
  the new income — that is intended. Insurance Card at its finalized $625
  price is a deliberate early savings decision.
- **LOC**: the $2,050 net closure cost changes from trivial to meaningful
  relative to income; no change needed.
- **Financial Ruin (−$20,000)**: with lower income, ruin gets closer to real
  play even before the deferred change set C. Watch the ruin rate in
  validation; if C lands later, loosen its ceilings before ever touching the
  threshold.
- **Early game**: A1–A4 leave days 1–10 nearly untouched (whales and big
  sponsor deals were never early-game income). Starting $60, the necessity
  floor, and the shop guarantees keep the opening loop identical.
- **Anti-softlock invariant**: reduced off-stream support (~$10–20/day) must
  always cover the finalized $1 B1 necessity floor. Any future price or payout change
  must preserve `min daily off-stream expectation ≥ daily survival staple
cost`.
- **Personal purchase life event** deducts the real catalogue price, so
  B2/B3 automatically make it a bigger Mood-for-money trade — acceptable,
  since the rule already requires affordability.
- **Equipment Failure + B2**: with C deferred, B2 repricing ships while the
  failure event still charges its flat $30–500. That is acceptable in the
  interim (the event stays a nuisance, not a sink) and is one more reason C2
  is the first C item to land when C unfreezes.
- **Health cap** interacts with nothing financial; it only shortens neglect
  tolerance. Emergency rescues, Advance Time safety, and the periodic damage
  cap are unaffected.

## 10. Rollout and validation

Phases (each is one reviewable data change):

1. **A + B (implemented)** — income tuning and finalized repricing (pure
   JSON/JSONL; catalogue compiler and rule documentation aligned).
2. **D** — tier-rate trim (pure JSON).
3. **E** — Health cap 30 (pure JSON).
4. **C (deferred)** — scaled tax, real-price equipment failure, and optional
   cost of living, only after the game is stable and only if Phases 1–3
   still leave casual ending cash over roughly $5k.

### Validation prerequisite: balance-progression tracking

The maintained study's endpoint summaries (ending cash, income-by-source
totals) hide chronology — exactly the thing this tuning is about — so it is
not fit for validating these changes as-is. Before any validation pass, the
study result contract gains a **per-run Balance time series**: one sampled
Balance value per local day (60 numbers per run), plus the run's single
largest one-day net gain and its cause. Daily sampling, not per-event
capture, keeps memory flat (~60 integers per run instead of full histories,
which are already known to exhaust memory in combined batches). Per-event
Balance history stays out of scope.

That series is what the money checks below read from. Until it exists, no
study result should be used to accept or reject these changes.

Checks, once tracking exists:

- Casual median Subscribers at day 60 in 200K–350K; focused 400K–650K;
  optimizer 850K–1.3M; Made It (3M) reachable only well past day 60 for
  non-optimal play.
- Casual median ending cash $1.5–3k; no archetype median over ~$8k, read
  from the daily Balance series, not just the endpoint.
- $1,000+ net-gain days occur, but at a median of ~1–2 per run and only
  from whale/legendary/sponsor causes.
- Balance curves grow roughly linearly, not hockey-stick after mid-run
  milestones.
- Common-profile death rate within ±10 points of the 40 HP baseline after
  the 30-cap change; Financial Ruin under ~10% for non-debt-seeking
  profiles.

Documentation follow-ups on implementation: `docs/GAME_RULES.md` (donation,
income, price, tier-rate, and Health tables), `docs/RULES_AND_FILES.md` if
any module moves, and `pnpm validate:data` after JSONL edits.

## 11. Out of scope

- No new statuses, timers, or status metric penalties (per repository
  simulation boundaries).
- No changes to seeded-randomness structure, catch-up rules, or Endings
  other than the numeric Health cap.
- No UI changes; prices and payouts render through existing views.
