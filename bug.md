# Run 1 playtest findings

Status: implemented and covered by automated regression tests.

Source: `docs/log.md`

The run lasted from August 23, 2026 at 5:20 PM through September 8, 2026 at
11:20 PM, about 16 days and 18 hours of game time. These are the issues to
address before evaluating another run.

## Run evidence

- The run began with 100 Followers and gained only 144 more from six normally
  completed streams, ending at approximately 244 Followers. The career ladder
  extends to 1,000,000.
- Eight streams started. Six completed normally, two ended early, and together
  they occupied 45 game-hours. These totals are not shown or retained as career
  statistics.
- Kidney Stone began four times: after Hash Brown on August 29, Sushi later
  that same day, Peanuts on September 5, and Fries on September 7.
- The first post-Hospital Kidney Stone began only seven hours after discharge.
  The final one began twelve hours after the next relevant discharge. The run
  ended with Kidney Stone, Sleep Deprived, and Depressed all active.
- Buying several units from a shop card required pressing **Add** once per unit.
- While in debt, purchases logged as essential included broad selections such
  as Steak, BBQ ribs, Cake, and Roast beef rather than a deliberately limited
  essentials set.
- Water is already authored at $1. It is not guaranteed to appear in every
  daily shop rotation.
- Five Plain Tortillas is currently a $25 Decoration and is absent from the
  starter inventory, despite being intended as starter Food.

## P0 — Kidney Stone probability and recovery are too punishing

### Problem

Kidney Stone triggers too frequently. The current rolling 48-hour condition can
accumulate an arbitrarily large number of consumptions when the player feeds
Bri several items without advancing time. Reaching salt 8 / water 2 then
enables a 35% onset roll on each later consumption. That allowed two episodes
on August 29. Its recurring Health and Rest damage then compounds hunger, sleep
loss, depression, debt, and blocked streaming. Natural passage currently uses
a fixed seeded deadline of 36, 48, 60, or 72 hours rather than giving a player
who keeps Bri alive recurring chances to recover.

### Required change

- Replace the rolling 48-hour nutrition history with the ten most recent
  successful food or drink consumptions. Refused or rejected attempts and
  non-nutrition Medicine actions do not count as feeds.
- After each successful feed, append its nutrition scores and discard anything
  older than the most recent ten feeds. Use that bounded window to evaluate the
  existing salt 8 / water 2 danger condition.
- Lower the eligible-consumption onset probability from 35% to 5%.
- Do not add a post-Hospital immunity or Hospital cooldown. Hospital continues
  to clear the active stone; later onset uses the same nutrition condition and
  reduced probability as any other eligible consumption.
- Replace the fixed natural-passage deadline with a 50% seeded chance to clear
  the stone after each three game-days it remains active. A failed check
  schedules another 50% check three game-days later and repeats until the stone
  clears, Hospital clears it, or the run ends.
- Store the onset probability, natural-clear interval, and natural-clear
  probability in simulation-rule data. Status alignment and natural-clear
  reconciliation belong in the status-rule modules, not the item resolver.

### Acceptance criteria

- The Kidney Stone nutrition history never contains more than ten successful
  feeds during the in-memory run.
- Outside the ten-feed nutrition danger condition, a feed cannot make an onset
  roll. Inside it, each successful feed uses the configured seeded 5%
  probability.
- Adding a new feed evicts the oldest feed before evaluating the updated
  window, allowing hydration and diet changes to move Bri out of danger.
- At each 72-hour active-stone boundary, one seeded 50% natural-clear roll is
  made. A failure preserves the status and schedules the next 72-hour check.
- Boundary tests cover each natural-clear interval.
- Hospital clears an active stone but creates no additional immunity timer.
- Seeded balance tests demonstrate that ordinary feeding does not repeatedly
  force Hospital visits or a near-inescapable death spiral.

## P0 — Career progression is far too slow

### Problem

The first run gained 144 Followers over 45 stream-hours and more than sixteen
game-days. That barely passes the 150-Follower milestone and makes a career
ladder ending at one million functionally unreachable. Completed streams are
currently almost the only source of base audience growth.

### Required change

- Add a small natural audience-growth stream so Followers can increase between
  broadcasts. It must use game time and seeded simulation inputs, not wall-clock
  timers or `Math.random()`.
- Natural audience growth starts at `1×`. Each stream event adds another `+1×`
  contribution that remains active for a rolling seven game-days from that
  stream's start timestamp. Contributions stack while their individual
  seven-day windows overlap, rewarding Bri for streaming regularly without
  using a calendar-week reset.
- Every actual stream start creates one seven-day passive-growth contribution.
  Snapshot its milestone band and Creativity at start; later milestone or
  Creativity changes must not retroactively alter that contribution. The
  Creativity factor is intentionally small so career progress remains the
  primary input. Ordinary completion does not add a separate direct base award.
- Add **Clippers** to the shop. Owned Clippers produce clips, and clips create
  an additional passive source of Followers. Clipper price, availability,
  production rate, and Follower effects must be data-authored.
- Use the documented milestone ladder for natural growth, clips, and stream
  contributions so actively streaming always increases passive growth.
- Preserve the rule that Followers never decrease.

### Acceptance criteria

- A healthy seeded 14-day run gains a meaningful amount of career progress
  even when stream selection is unlucky.
- At a natural-growth tick, the multiplier is `1× + 1×` for every stream event
  whose start timestamp is still within the preceding seven game-days. Each
  contribution expires independently at its exact seven-day boundary.
- A stream snapshots its milestone band and Creativity at start. Its passive
  contribution uses those snapshots whether it completes normally or ends
  early.
- Milestone boost amounts and the Creativity factor are data-authored and
  documented; no frontend branch hardcodes them.
- Clippers cost $25 and are available from Debut. Each activation adds one
  stack and renews a shared 72-hour expiry. The first activation pays
  immediately; later awards occur daily before expiry at `50 × current career
tier ordinal × stacks`. Renewal keeps the already scheduled next daily tick
  and does not pay another immediate award.
- Passive gains pass through the same milestone-resolution path as stream
  gains, including multiple milestones crossed at once.
- The natural and Clipper sources are distinguishable in the Journey or career
  history without flooding it with routine bookkeeping.

## P1 — Track stream count and stream-hours

Career state and presentation must retain:

- total streams started;
- total streams completed normally;
- total streams interrupted;
- total elapsed stream-hours, including elapsed time from interrupted streams.

Hours must use exact elapsed simulation time rather than counting event lines
or assuming scheduled duration. The totals should be visible with the other
career information throughout the in-memory run. Run 1 should be represented as
eight starts, six normal completions, two interruptions, and 45 elapsed hours.

## P1 — Graveyard omits the run dates

### Problem

The Graveyard card says only that the run is complete. Its Markdown export
includes the end timestamp but not the start timestamp.

### Acceptance criteria

- Show the run start and end date/time on the in-app Graveyard record using the
  run timezone.
- Include both timestamps in the Markdown export.
- Also show the elapsed run duration so the record is useful without manually
  comparing dates.
- Do not infer the start by parsing narration text; expose structured run-start
  data to the presentation layer.

## P1 — Restore quantity controls to shop cards

Replace the one-click-per-unit **Add** flow for quantity-supporting items with
an inline decrement / quantity / increment control on each shop card. The
control must:

- start at zero and directly reflect the cart quantity;
- respect stock, ownership caps, debt eligibility, and terminal state;
- allow a quantity to return to zero;
- remain keyboard accessible and have item-specific accessible labels;
- keep non-quantity durables capped at one.

The existing Cart controls may remain, but users should not have to open the
Cart or press **Add** seven times to select seven units.

## P1 — Show item tags in Item Detail

The Item Detail dialog currently shows description, qualitative hint,
ownership, and category but hides the item's authored tags. Display the tags so
the player can understand an item's gameplay role before buying or using it.

At minimum, relevant labels such as **salty**, **hydrating**, **food**,
**medicine**, and **essential** must be visible when present. Use the catalogue
tags as the source of truth, format them as readable labels, and expose the tag
group with accessible text. The detail view must not duplicate tag
classifications in hardcoded frontend branches.

## P1 — Correct essential shopping behavior

### Problem

Debt eligibility is currently category-wide: every Food and Medicine item may
be purchased while already in debt. "Essential" should be a deliberately
authored subset, not a synonym for every edible item.

### Required change

- Add a data-authored essential designation and use it for debt purchase
  eligibility.
- At minimum, Water, Five Plain Tortillas, and Medicine must remain purchasable
  while already in debt.
- Nonessential Food such as premium meals, snacks, and desserts must remain
  blocked in debt.
- Update the debt notice and rejection copy to describe essentials rather than
  claiming that all Food is available.

## P1 — Fix Water and Five Plain Tortillas availability

- Keep Water priced at $1. This is already correct in the catalogue and should
  receive a regression test.
- Water must appear in every shop rotation, rather than merely being one
  possible way to satisfy the hydration-support slot.
- Reclassify Five Plain Tortillas from Decoration to Food, with appropriate
  edible/nutrition behavior.
- Add Five Plain Tortillas to the starter inventory as originally intended.
- Ensure both items carry the data-authored essential designation used by debt
  shopping.

## P2 — Replace rude donation-tier wording

Do not call large donors "whales" in player-facing copy. Replace **Whale** and
**Legendary whale** with neutral labels such as **Major supporter** and
**Legendary supporter**, including Journey narration, shop/career copy, tests,
and `docs/GAME_RULES.md`. Internal identifiers may remain stable for save
compatibility, but the term must not be rendered to the player.

## Documentation and implementation boundaries

When these items are implemented:

- keep configurable rates, thresholds, natural-clear cadence, essential flags,
  prices, and Clipper effects in JSON under `src/lib/data/`;
- put persistent career statistics in progression state and seeded passive
  outcomes in the appropriate simulation modules;
- keep status reconciliation in `src/lib/status-rules.ts` or its domain
  modules;
- update `docs/GAME_RULES.md` and `docs/RULES_AND_FILES.md` alongside the code.
