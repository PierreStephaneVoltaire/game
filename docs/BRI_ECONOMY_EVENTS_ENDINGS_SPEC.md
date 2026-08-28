# Bri Virtual Pet — Economy, Random Events, and Alternate Endings Specification

**Spec version:** 1.2  
**Date:** 2026-08-28  
**Rules basis:** canonical v2, heterogeneous extension v1

## 1. Purpose

This specification adds financial risk, small-chance VTuber-life events, and
non-death outcomes to the existing companion-care simulation.

The intended tone is deliberately a little too real: keeping the companion
physically healthy does not guarantee a successful run. A player can survive
poor care through luck, build a successful career, overextend through credit,
or end the run through insolvency.

This document supplements `GAME_RULES.md`. Existing care, time, Health,
streaming, shop rotation, medical-bill, seeded-RNG, and Journey rules remain in
force unless this specification explicitly replaces them.

## 2. Balance intent

- Maximum Health remains 40.
- Very early deaths are valid outcomes for highly neglectful or reckless
  profiles. They are not automatically balance failures.
- Full AFK play should remain capable of terminal collapse within roughly
  3–4 realtime days. Autonomous behavior may delay collapse but must not make
  indefinite survival reliable.
- A highly optimized or lucky player may exceed 1,000,000 Subscribers.
- `Made It` is reached at 3,000,000 Subscribers.
- The simulation has no mandatory day-60 termination. Sixty days is the main
  balance horizon, not a forced end date.
- Death must not be the only possible ending.
- Debt should behave like quicksand: credit makes short-term survival and
  investment easier while making recovery progressively harder.

## 3. Financial state

### 3.1 Debt sources

The run tracks these liability sources separately:

- negative cash created by credit purchases or immediate expenses;
- outstanding Hospital payment-plan principal;
- the remaining cost of the LOC repayment items; and
- any other explicitly authored financed obligation.

`totalDebt` is:

```text
max(0, -cash)
+ remaining Hospital principal
+ remaining LOC repayment-item cost
+ remaining other financed principal
```

A positive cash balance does not erase an outstanding financed obligation.
Debt is reduced only by the rule belonging to that debt source. The LOC is not
modelled as Hospital-style principal: it remains an open contract until every
repayment item has been purchased.

### 3.2 Ordinary credit purchases

The existing Essential-only restriction for purchases made while cash is
negative is removed.

- Every ordinary Shop item may be purchased when cash is insufficient.
- The purchase subtracts its complete price from cash and may make cash more
  negative.
- Food, Medicine, Care, Reusable, Upgrade, and Decoration items all follow the
  same credit rule.
- Existing stock, ownership-cap, quantity, prerequisite, and rotation rules
  still apply.
- The UI must show the resulting cash balance before final purchase
  confirmation.
- Loan-repayment items are not ordinary purchases and cannot themselves be
  purchased on credit.

The player may therefore finance necessities, Clippers, model-related items,
cosmetics, decorations, or any other available catalogue item. The simulation
does not decide whether the purchase is a sensible investment.

### 3.3 Existing negative-cash demerit

The existing negative-cash Health-recovery demerit remains active:

```text
negativeCashPenalty = min(2, floor(abs(min(cash, 0)) / 2500))
```

This penalty subtracts from the periodic Health recovery score. It does not
deal direct Health damage.

The financial-status penalty described below and the negative-cash penalty use
one combined cap of 2. Financial pressure must never subtract more than 2 from
one periodic Health recovery score.

## 4. Debt status and Financial Ruin

### 4.1 In Debt status

When `totalDebt >= $10,000`, add the persistent `In Debt` status.

While active:

- ensure that the combined financial penalty to periodic Health recovery is at
  least 1;
- retain any stronger negative-cash penalty, up to the combined cap of 2;
- show total debt and its component balances in the UI; and
- narrate the initial threshold crossing in Journey.

The status clears immediately when `totalDebt < $10,000`.

Crossing the threshold again may produce another Journey entry only after the
status has genuinely cleared.

### 4.2 Financial Ruin

When `totalDebt >= $20,000`, the run ends immediately with the `Financial
Ruin` ending.

There is no grace period, delinquency counter, due date, late fee, or separate
`Insolvent` gameplay state.

The terminal record must contain:

- ending type: `financial_ruin`;
- graveyard cause: `Insolvency`;
- final cash balance;
- final total debt;
- each remaining debt component;
- the transaction or event that crossed the threshold; and
- the causal Journey entries leading to insolvency.

Financial Ruin is checked atomically after any operation that can change cash
or debt, including:

- a Shop purchase;
- Hospital bill creation;
- a Hospital payment;
- LOC creation;
- a recurring LOC open charge;
- LOC repayment;
- a random expense;
- a random purchase; and
- any future financed obligation.

If the same atomic operation both creates and repays debt, resolve the complete
operation before checking the ending.

### 4.3 Balance experiment

`$20,000` is the production Financial Ruin threshold for this specification.
A separately labelled counterfactual may test `$15,000` because recovery from
that amount may already be unrealistic within the expected play horizon.

The `$15,000` experiment must not silently replace the production value or be
merged into the production balance report.

## 5. Line of Credit gimmick

### 5.1 LOC offer

The Shop may offer a one-time `Line of Credit` service.

Purchasing it:

- costs $10 immediately;
- adds $10,000 cash;
- opens the LOC contract;
- creates 20 permanent repayment units priced at $600 each; and
- starts a fixed $1,000 cash charge on every later local-day boundary while the
  LOC remains open.

Buying all 20 repayment items costs $12,000. The difference between the
$10,000 advance and the $12,000 closure cost is a fixed 20% finance charge. It
must not be described as APR.

The recurring $1,000 is an LOC open charge, equal to 10% of the original cash
advance per local day. It is not a repayment and does not reduce the remaining
repayment-item count or price.

### 5.2 Repayment units

The 20 repayment units remain available in the Shop until purchased.

- The player may purchase any number at any time.
- The player may clear all 20 on the same day.
- Each purchased unit costs $600 cash and reduces the remaining closure cost by
  $600.
- A repayment unit cannot be purchased on credit.
- At every later local-day boundary, apply `cash -= $1,000` while at least one
  repayment unit remains.
- The daily charge remains exactly $1,000 even when only one repayment unit
  remains.
- The daily charge does not scale down with the remaining closure cost. Any
  nonzero remainder, including as little as $300 if a future adjustment creates
  such a remainder, keeps the complete $1,000 daily charge active.
- The daily charge continues for any number of days until all 20 repayment
  units are purchased.
- The daily charge never purchases a repayment unit and never reduces the
  closure cost.
- There is no required repayment schedule, missed-payment event, due date, or
  late fee. Leaving the LOC open is itself the continuing punishment.
- The fixed $2,000 finance charge is never refunded, including when the loan is
  cleared immediately.
- Purchasing the twentieth repayment unit closes the LOC atomically and stops
  every future daily open charge.

The UI may render the repayments as one persistent Shop entry with a remaining
quantity, but the engine must preserve the exact 20-unit obligation.

Example immediately after origination:

```text
Cash change:              +$10,000
LOC closure cost:          $12,000
Repayment units:           20 × $600
Daily charge while open:    $1,000
```

The LOC immediately satisfies the `$10,000` threshold for `In Debt`. Spending
the borrowed cash, purchasing further items on credit, receiving a Hospital
bill, taking a random expense, or simply leaving the LOC open can push total
debt to Financial Ruin.

If the player keeps the complete $10,000 advance untouched, ten daily open
charges consume the entire cash benefit. Charges continue after that point and
drive cash negative until the LOC is closed or the run ends in Financial Ruin.

## 6. Random VTuber-life events

### 6.1 Life-event effect contract

Life events are data-authored narrative events with explicit signed effects.
They do not infer mechanics from their narration.

Each event may add to or subtract from any of the six companion metrics and the
economy/career values through an `effects` object:

```ts
type LifeEventEffects = {
  food?: number;
  health?: number;
  mood?: number;
  rest?: number;
  bond?: number;
  creativity?: number;
  cash?: number;
  followersFlat?: number;
  followersPercent?: number;
  followerGrowthMultiplier?: number;
  followerGrowthDurationHours?: number;
};
```

- A positive signed value adds to that metric.
- A negative signed value subtracts from that metric.
- An omitted value has no effect.
- Food, Health, Mood, Rest, Bond, and Creativity use their existing clamps.
- Cash additions and deductions use the normal income/debt settlement paths.
- `followersFlat` directly adds or removes a fixed number of current
  Subscribers.
- `followersPercent` directly adds or removes the configured percentage of
  current Subscribers.
- `followerGrowthMultiplier` affects new Subscriber growth only for
  `followerGrowthDurationHours`; it does not multiply the existing audience.
- One event may change several metrics. All of its direct additions and
  subtractions resolve atomically before statuses, debt thresholds, milestone
  unlocks, or terminal outcomes are checked.

Every resolved life event must record the authored event ID, narration, and
each applied signed delta in the internal ledger and Journey.

All life events must:

- use the existing seeded RNG;
- resolve deterministically for the same seed, state, time, and opportunity;
- have a small configured chance;
- use configured eligibility, cooldown, or once-per-run limits where required
  to keep major outcomes rare;
- resolve atomically; and
- use data-configured effects and authored messages rather than UI logic.

### 6.2 Approved event effects

| Event | Food | Health | Mood | Rest | Bond | Creativity | Cash | Subscribers / growth |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Tax bill | 0 | 0 | 0 | 0 | 0 | 0 | fixed negative amount | none |
| Webcam failure | 0 | 0 | 0 | 0 | 0 | 0 | fixed negative amount | none |
| GPU failure | 0 | 0 | 0 | 0 | 0 | 0 | fixed negative amount | none |
| Twitter cancellation | 0 | 0 | 0 | 0 | 0 | 0 | 0 | small negative percentage |
| Rain | 0 | 0 | -1 | 0 | 0 | 0 | 0 | none |
| Random personal purchase | 0 | 0 | authored small positive amount | 0 | 0 | 0 | fixed amount from -$299 through -$11 | none |
| Sponsored-stream deal | 0 | 0 | 0 | 0 | 0 | 0 | configured positive amount | none |
| Agency invitation / debut | 0 | 0 | 0 | 0 | 0 | 0 | 0 | immediate positive amount plus temporary discovery multiplier |
| Algorithm boost | 0 | 0 | 0 | 0 | 0 | 0 | 0 | temporary growth multiplier for one configured day |

The table defines the complete effects of these events. A zero means that the
event must not modify that metric. Additional effects require an explicit spec
change; narration alone cannot create one.

### 6.3 Purely descriptive expense events

Tax bill, Webcam failure, and GPU failure are descriptive explanations for one
immediate cash subtraction.

- Select one authored fixed dollar amount and apply it immediately.
- The event may push cash negative and may cause Financial Ruin through the
  ordinary debt rules.
- It creates no Shop item.
- It creates no inventory item.
- It creates no repair or replacement action.
- It creates no equipment ownership state.
- It creates no activity or stream penalty.
- It creates no status.
- It creates no payment plan, due date, or recurring charge.

Tax amounts are not calculated from recent income and are not percentages.
Each Tax event is one random, one-time `cash -= fixedAmount` resolution.

Webcam and GPU failures differ only through authored narration, configured
chance, and their fixed cash-deduction candidates. They have no connection to
the Shop.

### 6.4 Mixed and career events

#### Twitter cancellation

- Subtract one configured small percentage from current Subscribers.
- Previously unlocked career tiers, appearances, items, and milestone rewards
  remain unlocked.
- Track peak Subscribers separately from current Subscribers.
- The event is not itself a terminal ending.

#### Rain

- Apply Mood -1 immediately.
- Apply no other metric change.
- It creates no persistent weather system.

#### Random personal purchase

- Select an authored non-Shop purchase costing more than $10 and less than
  $300.
- Apply the cash subtraction and authored small Mood addition atomically.
- It creates no Shop or inventory item.
- It may push cash negative and cause Financial Ruin.

#### Sponsored-stream deal

- Apply one configured positive cash amount immediately.
- Record it as sponsor income.
- The event is descriptive and does not queue an activity, Shop item, contract,
  or recurring payment.

#### Agency invitation / Agency debut

- This is a rare positive career event, not an ending.
- Add the authored immediate Subscriber amount.
- Apply the authored temporary discovery multiplier to new Subscriber growth.
- Narrate the boost beginning and ending.

#### Algorithm boost

- Apply the authored temporary multiplier to new Subscriber growth for one
  configured day.
- Do not multiply the existing audience.
- Do not add a permanent multiplier.
- Narrate the boost beginning and ending.

## 7. Subscriber decreases and milestone stability

The existing invariant that Subscribers never decrease is replaced.

The engine must track:

- `followers`: current Subscribers, which may decrease; and
- `peakFollowers`: the highest Subscriber count reached during the run.

Career-tier unlocks and one-time milestone rewards use `peakFollowers`.
Current natural growth and displayed audience use `followers`.

A Subscriber-loss event must never:

- revoke a completed milestone;
- remove an unlocked appearance;
- remove an earned item;
- reissue a previously granted milestone reward when the audience recovers; or
- replay a one-time milestone event.

## 8. Endings

### 8.1 Death

Existing Health-zero terminal behavior remains unchanged. Early death remains
valid for severely neglectful or reckless runs.

### 8.2 Financial Ruin

Financial Ruin is terminal at `$20,000` total debt and uses `Insolvency` as the
graveyard cause, as defined in section 4.

### 8.3 Made It

When current Subscribers first reach 3,000,000:

- unlock the `Made It` ending;
- create a Journey and ending record;
- preserve the exact time and causal audience event; and
- allow the player to continue the same run beyond 3,000,000 Subscribers.

`Made It` is a career-success ending, not a terminal guard.

### 8.4 Other alternate endings

`She Cut You Off` remains a planned alternate ending, but its exact trigger is
not defined by this specification. No Bond duration, refusal count, warning
period, or terminal rule may be invented during implementation without a
separate approved rule.

Agency invitation and Agency debut are explicitly not endings.

## 9. UI requirements

The overview must display:

- cash;
- total debt when greater than zero;
- active `In Debt` status;
- Hospital principal;
- remaining LOC closure cost;
- remaining LOC repayment units; and
- current and peak Subscribers where relevant to a loss event or ending.

The Shop must:

- show the post-purchase cash balance before confirming an ordinary credit
  purchase;
- permit ordinary credit purchases regardless of item category;
- keep LOC repayment available until all units are cleared; and
- prevent LOC repayment from being purchased on credit.

Journey must narrate:

- entry into and recovery from `In Debt`;
- LOC origination and repayments;
- each random financial or career event;
- Subscriber losses and temporary-growth effects;
- Financial Ruin and its causal transaction; and
- the `Made It` unlock.

## 10. Engine and data requirements

- Keep all thresholds and event values in versioned simulation data.
- Keep all randomness in `seeded-rng.ts`.
- Resolve debt and ending checks in the pure engine, never in Svelte UI code.
- Add structured effect sources for credit purchases, LOC creation, the
  recurring LOC open charge, LOC repayment, and every life-event addition or
  subtraction across Food, Health, Mood, Rest, Bond, Creativity, cash,
  Subscribers, and temporary Subscriber growth.
- Terminal reconciliation must stop after Financial Ruin exactly as it stops
  after death.
- Repeated reconciliation to the same timestamp must not duplicate a random
  event, LOC repayment, ending, or Journey entry.
- `Made It` must be idempotent but nonterminal.
- Existing medical daily-payment behavior remains unchanged.

Suggested configurable values:

```json
{
  "debt": {
    "statusThreshold": 10000,
    "financialRuinThreshold": 20000,
    "financialRuinCounterfactualThreshold": 15000,
    "combinedRecoveryPenaltyCap": 2
  },
  "lineOfCredit": {
    "applicationPrice": 10,
    "cashAdvance": 10000,
    "repaymentUnitCount": 20,
    "repaymentUnitPrice": 600,
    "totalClosureCost": 12000,
    "financeChargeRate": 0.2,
    "dailyOpenChargeRate": 0.1,
    "dailyOpenCharge": 1000
  },
  "endings": {
    "madeItFollowers": 3000000
  },
  "randomEvents": {
    "personalPurchaseMinimumExclusive": 10,
    "personalPurchaseMaximumExclusive": 300
  }
}
```

## 11. Validation and balance tests

### 11.1 Debt and credit

- Any ordinary item may cross cash below zero.
- Stock and ownership rules still reject invalid credit purchases.
- Negative cash applies the existing recovery penalty.
- Total debt below $10K does not add `In Debt`.
- Crossing $10K adds `In Debt` exactly once.
- Falling below $10K clears it.
- Hospital principal and the remaining LOC closure cost count toward total
  debt.
- Crossing $20K terminates immediately with cause `Insolvency`.
- The transaction crossing $20K is preserved in the causal ledger.
- The isolated $15K experiment is labelled and cannot modify production data.

### 11.2 LOC

- Origination costs $10, adds $10K cash, opens the LOC, and creates exactly 20
  repayment units with a $12K total closure cost.
- Exactly 20 repayment units exist at $600 each.
- Any quantity may be repaid immediately.
- Repaying all units on the origination day still costs the complete $12K.
- Every later local-day boundary subtracts exactly $1K cash while any repayment
  unit remains.
- The $1K charge is unchanged when only one repayment unit remains.
- Daily charges do not reduce the repayment-unit count or closure cost.
- No missed-payment event, deadline, or late fee exists.
- Repayment cannot use credit.
- The LOC closes only after all 20 units are paid.
- No daily open charge occurs after atomic closure.

### 11.3 Random events

- Tax is one immediate fixed cash deduction.
- Tax creates no due date or persistent tax object.
- Webcam and GPU failures are narration plus one immediate cash subtraction.
- Webcam and GPU failures do not touch the Shop, Inventory, equipment state,
  activities, streams, or statuses.
- Personal-purchase events atomically subtract cash and add the authored Mood
  amount.
- Equipment and personal-purchase expenses can push cash negative.
- Sponsor income uses the shared positive-income settlement path.
- Agency and algorithm boosts expire once and cannot duplicate.
- Twitter cancellation reduces current Subscribers but never revokes milestone
  unlocks.
- A life event may apply authored positive or negative Food, Health, Mood, Rest,
  Bond, Creativity, cash, or Subscriber deltas through the common effect
  contract.
- Every applied event delta is recorded with its sign and actual clamped value.
- An event applies no effect that is absent or zero in its authored data.
- All events replay deterministically under identical seeded inputs.

### 11.4 Three-Month-Old Rotisserie Chicken

- The item exists in the generated catalogue and canonical item allowlist.
- Manual consumption applies Food +5, Health -8, and Creativity +2 exactly
  once.
- Automatic stream-snack consumption applies the same complete atomic effect.
- The direct Health loss is not periodic need damage and is not reduced by the
  periodic need-damage cap.
- The item is consumed completely after either use path.
- The item applies no recurring damage and creates no Sick or other persistent
  status.
- A lethal result attributes death to this item in the structured causal
  record.
- Manual and automatic consumption are deterministic under identical seeded
  inputs and produce the correct item-authored Journey narration.

### 11.5 Endings

- Death remains terminal.
- Financial Ruin is terminal with graveyard cause `Insolvency`.
- Made It unlocks once at 3M and allows continued play.
- Agency events never terminate a run.
- No unapproved `She Cut You Off` trigger exists.

### 11.6 Balance reporting

Future reports must record:

- peak total debt, not only ending debt;
- time first entering `In Debt`;
- hours spent with `In Debt`;
- exact Financial Ruin trigger transaction;
- credit spending by category;
- LOC uptake, repayment units purchased, closure cost remaining, and cumulative
  open charges;
- life-event counts;
- positive and negative life-event totals for Food, Health, Mood, Rest, Bond,
  and Creativity;
- life-event cash additions and cash subtractions reported separately;
- life-event Subscriber additions and losses reported separately;
- temporary Subscriber-growth boost count and exposure hours;
- current and peak Subscribers; and
- ending type counts separated into Death, Financial Ruin, Made It unlocked,
  and continued active runs.

The current `maximumDebt`/`hoursInDebt` diagnostics must be validated against
Hospital principal and the remaining LOC closure cost so a run with explicit
outstanding debt cannot incorrectly report zero debt exposure.

## 12. Catalogue addition: Three-Month-Old Rotisserie Chicken

Add one Food item:

| Field | Value |
| --- | --- |
| ID | `three_month_old_rotisserie_chicken` |
| Display name | Three-Month-Old Rotisserie Chicken |
| Category | Food |
| Preference | Variable |
| Use type | Consume the complete item once |
| Food | +5 |
| Health | -8 |
| Creativity | +2 |
| Persistent status | None |
| Automatic snack eligible | Yes |

The item is a complete rotisserie chicken that has been sitting around for
three months. Eating it fills a substantial amount of Food, causes one heavy
immediate Health loss, and grants Creativity +2 because the incident becomes a
funny stream story.

The item must be eligible for the existing automatic stream-snack selection.
It uses the same Variable-food eligibility as other automatic snacks; it does
not receive forced priority. When selected automatically:

1. consume the complete item;
2. apply Food +5, Health -8, and Creativity +2 atomically;
3. normalize metric statuses;
4. check for a new critical condition or death; and
5. end the stream under the existing new-critical-condition rule when the run
   remains alive.

The Health loss happens once per consumed item. It must not schedule later
damage, add Sick, or create food-poisoning recurrence. If it reduces Health to
zero, the graveyard causal record must identify
`three_month_old_rotisserie_chicken` as the direct damage source.

The automatic-snack Journey narration must explicitly communicate that the
companion found and ate the three-month-old rotisserie chicken during the
stream. Manual consumption uses its own authored line. Both paths grant the
Creativity bonus regardless of whether the stream later ends.

Adding this item increases the canonical catalogue from 227 to 228 items. The
catalogue compiler inputs, ordered canonical allowlist, generated
`shop-items.json`, validation count, and generated asset must be updated
together. Price, stock range, artwork, and authored Journey lines remain
catalogue-data values; this specification defines the mechanical effects and
automatic-snack eligibility.

## 13. Explicit exclusions

This specification does not add:

- automatic daily LOC payments;
- LOC payment deadlines;
- missed-payment events;
- late fees;
- declining-balance LOC interest;
- tax percentages based on recent income;
- tax due dates or tax payment plans;
- Shop or Inventory items created by Webcam or GPU failure events;
- repair, replacement, equipment-state, activity, stream, or status mechanics
  created by Webcam or GPU failure events;
- Shop or Inventory items created by random personal purchases;
- a pre-ending Insolvent grace state;
- an Agency ending; or
- an invented trigger for `She Cut You Off`.
