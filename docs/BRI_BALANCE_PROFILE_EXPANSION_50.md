# Bri Virtual Pet — 50-Profile Balance Expansion

**Purpose:** Expand the current canonical 50-run balance dataset with 50 additional, behaviorally distinct player profiles.

**Use with:** `canonical-balance-50-v2` and the current real seeded engine.

**Target combined study:** 100 runs total:

- existing canonical 50 runs;
- these 50 additional profiles, one seeded run each.

This file is not a replacement for the existing Casual / Focused / Optimal / Neglect cohorts. It expands behavioral coverage so balancing decisions are not based on four highly regular policies.

---

# 1. Why this expansion is needed

The current study is valuable for controlled comparisons, but it is intentionally regular:

- Casual uses stable care thresholds and stockpiles food.
- Focused uses stable thresholds with stronger career intent.
- Optimal checks every two hours and proactively manages risk.
- Neglect is exactly "skip every second scheduled visit."

That makes the study reproducible, but real players are not that consistent.

A player may:

- log in heavily for two days and vanish for one;
- care about Mood but forget Food;
- keep Bri fed but chronically sleep-deprived;
- spend every dollar on cosmetics;
- hoard money and underbuy food;
- overuse favorite sugary foods;
- panic and use Hospital immediately;
- refuse Hospital because of debt;
- buy insurance late;
- rely on autonomous rescue after discovering it exists;
- stream whenever possible even when stats are bad;
- play conservatively and rarely stream;
- optimize followers but ignore nutrition;
- log in only morning/evening;
- play only on weekdays;
- binge on weekends;
- buy every book/game and let autonomous positive events carry Mood;
- deliberately test refusal/status boundaries.

The new 50 runs should sample those kinds of behavior.

---

# 2. General implementation rules

## 2.1 One profile = one deterministic policy

Each profile should be represented as a deterministic policy driven by:

- seed;
- current state;
- local game time;
- profile configuration.

Do not use unseeded random behavior in the profile driver.

If a behavior is described as "sometimes," resolve it from the same seeded profile RNG system or use a deterministic schedule pattern.

## 2.2 Do not silently improve the player

These profiles are intended to represent imperfect humans.

The policy runner must not:

- buy the objectively best food unless the profile says so;
- cure nutrition risk unless the profile notices it;
- optimize shop spending unless that profile is an optimizer;
- interrupt a bad plan because the simulator "knows better";
- use future information.

## 2.3 Busy means busy

If a scheduled visit occurs during an activity:

- preserve the current engine's busy behavior;
- do not automatically move the visit to the perfect next minute unless the profile explicitly retries.

Different profiles below specify whether they retry after a blocked check.

## 2.4 Track actual behavior, not only intended policy

For each run capture:

- scheduled checks;
- attended checks;
- busy checks;
- skipped checks;
- retries after busy;
- care actions by metric;
- purchases by category;
- autonomous rescues;
- rescue-block reasons;
- hospital decisions;
- medical debt;
- food composition;
- sugar/protein/salt/water exposure;
- stream attempts/completions/interruptions;
- ending/death;
- followers;
- final metrics.

---

# 3. Shared behavior dimensions

The 50 profiles intentionally vary these axes.

## Check cadence

- very frequent: 2–3h;
- normal frequent: 4h;
- moderate: 4.8–6h;
- sparse: 8–12h;
- bursty;
- morning/evening only;
- workday-only;
- weekend-heavy;
- pseudo-random irregular schedule.

## Care philosophy

- threshold-based;
- one-metric priority;
- reactive-only;
- proactive;
- rescue-reliant;
- "fix the worst stat only";
- full top-up;
- minimal intervention;
- mood-first;
- food-first;
- rest-first.

## Economy

- hoarder;
- spender;
- cosmetics-first;
- food-first;
- insurance-first;
- no-insurance;
- debt-averse;
- debt-indifferent;
- Clippers-first;
- books/games-first.

## Career

- stream whenever legal;
- stream only when healthy;
- minimum career effort;
- milestone chaser;
- career indifferent;
- early grind / late coast;
- late grind.

## Nutrition knowledge

- informed;
- partially informed;
- favorite-food bias;
- sugar-blind;
- salt-blind;
- protein-aware;
- hydration-aware;
- intentionally repetitive eater.

## Medical behavior

- unaware;
- wait;
- painkiller-first;
- hydration-first;
- immediate Hospital;
- delayed Hospital;
- Hospital only at critical Health;
- never Hospital;
- insurance before Hospital;
- insurance purchased too late.

---

# 4. Fifty additional profiles

---

## P51 — Morning and Night Only

**Type:** common realistic player

**Schedule**

- Check around 08:00 and 22:00 local time.
- No midday visits.
- If busy at the scheduled time, do not retry.

**Care**

- Feed if Food <= 4.
- Rest if Rest <= 3.
- Mood care if Mood <= 2.
- Fix only one metric per visit: lowest normalized metric first.

**Shopping**

- Maintain 4 food items, not 9–10.
- Buy cheap acceptable foods.
- No deliberate nutrition optimization.

**Career**

- Stream only at night if Food >= 4 and Rest >= 4.

**Medical**

- Hydrate instinctively.
- Hospital if Kidney Stone remains active for 72h.

**Why**
Tests a very plausible "before work / before bed" routine.

---

## P52 — Lunch-Break Player

**Type:** common realistic player

**Schedule**

- Check at 07:30, 12:30, and 19:00.
- Weekdays only get all three.
- Weekends only 12:00 and 21:00.

**Care**

- At work/lunch: only Feed or quick item use.
- At home: Rest, Play, Socialize allowed.

**Shopping**

- Reserve 5 foods.

**Career**

- Streams only evenings/weekends.

**Medical**

- Painkillers first; Hospital after 48h if affordable.

**Why**
Tests time-of-day restrictions and uneven care capability.

---

## P53 — Workday Disappearing Act

**Type:** common realistic player

**Schedule**

- Check 07:00 and 19:00 on weekdays.
- Four checks/day on weekends.

**Care**

- Food threshold 4.
- Rest threshold 4.
- Mood threshold 3.

**Shopping**

- Reserve 6 food.

**Career**

- Heavy weekend streaming.
- Almost no weekday streaming.

**Why**
Tests long daily gaps with compensating weekend attention.

---

## P54 — Weekend Binger

**Type:** common / risky

**Schedule**

- One check/day Monday–Thursday.
- Two checks Friday.
- Six checks/day Saturday/Sunday.

**Care**

- During weekdays only fix Food or Rest.
- Weekend visits perform full care.

**Career**

- Streams aggressively on weekends.

**Shopping**

- Stocks 10 foods Friday evening.

**Why**
Tests whether burst play can recover from several low-attention days.

---

## P55 — Two Days On, One Day Off

**Type:** common irregular

**Schedule**

- 5 checks/day for two consecutive days.
- Zero player input every third day.

**Care**

- Normal Casual thresholds.

**Shopping**

- Reserve 8 food.

**Career**

- Moderate streams on active days.

**Why**
Tests recurring 24h abandonment without total neglect.

---

## P56 — Three Days On, Two Days Off

**Type:** harsh irregular

**Schedule**

- 4 checks/day for three days.
- Zero input for two days.
- Repeat.

**Care**

- Full care while active.

**Shopping**

- Reserve 10 food.

**Career**

- Streams often during active periods.

**Why**
Tests repeated multi-day gaps and autonomous-rescue limits.

---

## P57 — Forgetful Random Gaps

**Type:** common realistic

**Schedule**
Deterministic repeating gap pattern:

- 4h
- 5h
- 9h
- 4h
- 12h
- 6h
- 5h
- repeat.

**Care**

- Casual thresholds.
- Fix worst stat only.

**Shopping**

- Reserve 6 food.

**Why**
Tests irregular gaps without a clean cadence.

---

## P58 — Notification Ignorer

**Type:** common realistic

**Schedule**

- Nominal 4h checks.
- Ignore every third scheduled visit.
- Additionally, after any "everything looks okay" visit, skip the next visit.

**Care**

- Casual thresholds.

**Why**
Models a user who becomes complacent when stats look good.

---

## P59 — Busy Retry Player

**Type:** common realistic

**Schedule**

- 6h cadence.
- If visit is blocked by activity, retry exactly 1h later.

**Care**

- Casual thresholds.

**Career**

- Moderate.

**Why**
Contrasts against canonical profiles that lose visits to busy windows.

---

## P60 — Busy Means "I'll Check Tomorrow"

**Type:** realistic bad habit

**Schedule**

- 6h cadence.
- If busy, skip that visit and the next scheduled visit.

**Care**

- Casual thresholds.

**Why**
Tests cascading missed care caused by long activities.

---

## P61 — Food-First Caregiver

**Type:** common bias

**Schedule**

- 5h cadence.

**Care priority**

1. Food if <= 5.
2. Mood if <= 2.
3. Rest only if <= 1.
4. Other care afterward.

**Shopping**

- Reserve 8 foods.

**Why**
Tests chronic sleep neglect while preventing starvation.

---

## P62 — Rest-First Caregiver

**Type:** common bias

**Schedule**

- 5h cadence.

**Care priority**

1. Rest if <= 5.
2. Food if <= 2.
3. Mood if <= 2.

**Why**
Tests starvation pressure while keeping Rest healthy.

---

## P63 — Mood-First Simp

**Type:** extremely plausible

**Schedule**

- 5h cadence.

**Care priority**

1. Mood if <= 6.
2. Bond if low.
3. Food if <= 2.
4. Rest if <= 2.

**Shopping**

- Buys books, games, cat items, room comfort before food reserve.
- Food reserve target 3.

**Career**

- Streams only when Mood >= 6.

**Why**
Tests over-investment in happiness/comfort at the expense of survival needs.

---

## P64 — Health Bar Watcher

**Type:** common reactive

**Schedule**

- 6h cadence.

**Care**

- Ignores Food/Rest/Mood warnings until Health < 30.
- Once Health < 30, aggressively fixes the lowest critical metric.

**Shopping**

- Reserve 5 food.

**Why**
Tests players who respond to Health rather than underlying needs.

---

## P65 — Critical-Only Player

**Type:** edge/common mobile-game behavior

**Schedule**

- 4h cadence.

**Care**

- Only acts if:
  - Food <= 2;
  - Rest <= 2;
  - Mood <= 1;
  - or dangerous status active.
- Otherwise leaves immediately.

**Career**

- Streams whenever legal.

**Why**
Tests minimum-intervention play.

---

## P66 — Full Top-Up Player

**Type:** cautious

**Schedule**

- 8h cadence.

**Care**
Whenever checking:

- Feed until Food >= 7.
- Rest if Rest < 7.
- Mood action until Mood >= 6 if possible.

**Shopping**

- Reserve 12 food.

**Why**
Tests infrequent but heavy maintenance.

---

## P67 — Worst-Stat-Only Player

**Type:** common simplistic strategy

**Schedule**

- 4.8h cadence.

**Care**

- One care action per visit.
- Always choose lowest current core care metric.
- Never perform a second care action.

**Shopping**

- Reserve 6 food.

**Why**
Tests whether one-action visits are sufficient.

---

## P68 — "Everything at 3 Is Fine"

**Type:** risky but plausible

**Schedule**

- 4h cadence.

**Care**

- Act only when Food/Rest/Mood <= 2.
- Target recovery only to 3–4, never top up.

**Shopping**

- Reserve 5 food.

**Why**
Tests hovering near danger thresholds.

---

## P69 — Rescue Learner

**Type:** exploit-adjacent realistic

**Schedule**

- 8h cadence.

**Behavior**
Once an autonomous Food or Rest rescue has occurred:

- intentionally lowers care priority for that metric;
- allows it to hit critical again;
- does not understand the episode lock.

**Shopping**

- Keeps 8 foods.

**Why**
Tests whether a player can accidentally over-rely on autonomous rescue and still be punished.

---

## P70 — Rescue Exploiter

**Type:** explicit edge case

**Schedule**

- 4h cadence.

**Behavior**

- Attempts to reset Food rescue as cheaply as possible.
- Performs minimal player feed sufficient to satisfy reset threshold.
- Then lets Food crash again.
- Same strategy for Rest.

**Career**

- Streams between rescues.

**Why**
Tests whether rescue-reset semantics create an efficient exploit.

---

## P71 — Empty Pantry Procrastinator

**Type:** common bad economy behavior

**Schedule**

- 6h cadence.

**Shopping**

- Never stockpiles.
- Buys food only when Food <= 2.
- If current shop lacks acceptable food, waits for next rotation.

**Care**

- Otherwise Casual.

**Why**
Tests `no_eligible_owned_food` and shop availability pressure.

---

## P72 — Pantry Hoarder

**Type:** safe economy extreme

**Schedule**

- 6h cadence.

**Shopping**

- Maintain 20 food whenever money permits.
- Prefer varied foods.
- Almost no cosmetics.

**Care**

- Casual thresholds.

**Why**
Measures how powerful deep inventory becomes.

---

## P73 — Favorite-Food Repeater

**Type:** very plausible

**Schedule**

- 5h cadence.

**Food**

- Always buy/feed Bri's highest-preference available food.
- Repeat the same item whenever possible.
- Ignore nutrition variety.

**Why**
Tests authored nutrition consequences and repetitive-diet risk.

---

## P74 — Dr Pepper Main

**Type:** Bri-specific edge/common joke

**Schedule**

- 5h cadence.

**Food**

- Prioritize Dr Pepper whenever available.
- Use it for Food/Mood even when another acceptable option exists.
- Otherwise normal favorite foods.

**Nutrition knowledge**

- Ignores Sugar Crash warning until a crash actually occurs.
- After first crash, adds protein only if easy/owned.

**Why**
Tests sugar/protein behavior under a strong favorite bias.

---

## P75 — Sugar-Blind Player

**Type:** common uninformed

**Schedule**

- 4.8h cadence.

**Food**

- No consideration for sugar.
- Selection by Food gain + preference only.

**Response**

- Does not deliberately use protein to cancel warnings.

**Why**
Establishes crash frequency for normal uninformed play.

---

## P76 — Protein Counterplayer

**Type:** informed

**Schedule**

- 4.8h cadence.

**Food**

- Normal choices.
- When Sugar Crash warning appears, deliberately consume enough protein to bring effective sugar below threshold if inventory/shop permits.

**Why**
Tests whether the new counterplay actually works and feels achievable.

---

## P77 — Salt-Blind Player

**Type:** common uninformed

**Schedule**

- 5h cadence.

**Food**

- Select by Food + preference.
- Ignore Kidney Stone risk warning.

**Medical**

- Wait for symptoms.

**Why**
Measures stone risk under plausible ignorance.

---

## P78 — Warning-Responsive Hydrator

**Type:** informed casual

**Schedule**

- 5h cadence.

**Food**

- Normal.

**When Kidney Stone risk warning appears**

- prioritize Water on next care opportunity;
- do not otherwise optimize salt.

**Why**
Tests whether qualitative warning provides useful counterplay.

---

## P79 — Nutrition Min-Maxer

**Type:** edge optimizer

**Schedule**

- 3h cadence.

**Food**

- Maintains:
  - low effective sugar;
  - rolling salt below stone threshold;
  - sufficient water;
  - regular protein.
- Preference is secondary.

**Career**

- Still tries to maximize streaming.

**Why**
Tests best-case preventable-status rate without full overall Optimal policy.

---

## P80 — Cheap-Calorie Buyer

**Type:** economy optimizer

**Schedule**

- 5h cadence.

**Shopping**

- Maximize Food gain per dollar.
- Ignore Mood/preferences unless refusal risk makes an item unusable.
- Reserve 8 food.

**Why**
Tests whether low-price foods accidentally dominate.

---

## P81 — Cosmetic Whale, Tiny Pantry

**Type:** spender

**Schedule**

- 5h cadence.

**Shopping**
Priority:

1. room items;
2. games/books;
3. cat items;
4. streaming gear;
5. food only when reserve <2.

**Career**

- Moderate streaming.

**Why**
Tests whether spending choices create meaningful survival tradeoffs.

---

## P82 — Money Hoarder

**Type:** economy edge

**Schedule**

- 5h cadence.

**Shopping**

- Keep at least $500 once achieved.
- Buy only essentials below that reserve.
- Never buy Clippers/cosmetics.

**Care**

- Casual.

**Why**
Tests whether cash hoarding provides too much latent safety.

---

## P83 — Perpetually Broke Shopper

**Type:** common spender

**Schedule**

- 5h cadence.

**Shopping**

- Spend down to near $0 each rotation.
- Prefer affordable desired items.
- Keep only 3 food.

**Why**
Tests low-money stress and medical-payment pressure.

---

## P84 — Insurance-First Player

**Type:** cautious

**Schedule**

- 6h cadence.

**Shopping**

- Purchase Insurance Card as soon as reasonably affordable.
- Then maintain 6 food.
- Minimal luxuries until insured.

**Medical**

- Hospital after 24–48h of stone symptoms.

**Why**
Tests intended value of insurance.

---

## P85 — Insurance Too Late

**Type:** realistic misunderstanding

**Schedule**

- 6h cadence.

**Medical**

- Start Hospital uninsured.
- If debt appears, immediately buy Insurance Card afterward believing it helps the existing bill.

**Why**
Tests coverage-lock clarity and UI comprehension assumptions.

---

## P86 — Never Hospital

**Type:** debt-averse

**Schedule**

- 5h cadence.

**Medical**

- Never Hospital.
- Use water/painkillers and wait for natural passage regardless of duration.

**Why**
Tests whether natural management is viable without making Hospital pointless.

---

## P87 — Immediate Hospital

**Type:** health-anxious

**Schedule**

- 5h cadence.

**Medical**

- Hospital immediately on every Kidney Stone onset whenever activity rules allow.
- Buy insurance if already available; otherwise do not wait for it.

**Why**
Tests maximum medical-debt exposure.

---

## P88 — Hospital Only When Health < 15

**Type:** debt-averse reactive

**Schedule**

- 5h cadence.

**Medical**

- Hydrate/wait first.
- Hospital only if Kidney Stone active and Health <15.

**Why**
Tests late intervention.

---

## P89 — Painkiller Reliant

**Type:** symptom manager

**Schedule**

- 5h cadence.

**Medical**

- Use Painkillers whenever stone discomfort returns.
- Hospital only after three pain-relief cycles fail to resolve episode.

**Why**
Tests whether symptom relief meaningfully changes behavior without curing disease.

---

## P90 — Medical Debt Panic

**Type:** economy/medical edge

**Schedule**

- 5h cadence.

**After any medical bill**

- stop buying all non-food items;
- maintain only 4-food reserve;
- prioritize Pay Medical Debt in Full whenever discounted price becomes affordable.

**Why**
Tests the 15% payoff decision.

---

## P91 — Debt Indifferent

**Type:** economy edge

**Schedule**

- 5h cadence.

**Medical**

- Uses Hospital when desired.

**Shopping**

- Ignores outstanding medical principal.
- Continues normal spending.
- Never voluntarily full-pays debt.

**Why**
Tests whether scheduled payments are enough to matter.

---

## P92 — Stream Whenever Possible

**Type:** career addict

**Schedule**

- 4h cadence.

**Career**

- If not currently blocked and basic legal requirements permit, prioritize Stream over care unless:
  - Food <=1;
  - Rest <=1;
  - Health <=10.

**Shopping**

- Streaming gear/Clippers prioritized.

**Why**
Tests self-inflicted stream pressure and interruption.

---

## P93 — Healthy-Only Streamer

**Type:** conservative career player

**Schedule**

- 5h cadence.

**Career**
Stream only if:

- Food >=6;
- Rest >=6;
- Mood >=5;
- Health >=30;
- no major harmful status.

**Why**
Measures the opportunity cost of playing safely.

---

## P94 — Early Grind, Late Coast

**Type:** milestone strategy

**Schedule**

- 3h cadence until 250K.
- After 250K, switch to 8h cadence.

**Care**

- Strong early care, Casual thresholds late.

**Career**

- Aggressive early streaming.
- Minimal streaming after 250K.

**Why**
Tests whether success permits dangerously easy coasting.

---

## P95 — Late Grind

**Type:** milestone strategy

**Schedule**

- 8h cadence for first 20 days.
- 4h cadence days 21–40.
- 2–3h cadence after day 40.

**Career**

- Minimal early streaming.
- Aggressive late streaming.

**Why**
Tests recoverability from a slow start.

---

## P96 — Book-and-Game Collector

**Type:** autonomy-heavy spender

**Schedule**

- 6h cadence.

**Shopping**
Priority:

1. Book;
2. Manga;
3. Really Long Book;
4. games;
5. comfort items;
6. food reserve 5.

**Care**

- Casual.

**Why**
Tests whether autonomous positive Mood events become too strong when many eligible items are owned.

---

## P97 — Room Buff Maxer

**Type:** optimizer / edge

**Schedule**

- 6h cadence.

**Shopping**

- Prioritize strongest room-stat improvements.
- Place items immediately.
- Replace lower-value room items when better ones appear.
- Food reserve 5.

**Why**
Tests cumulative room-effect power.

---

## P98 — Minimalist No-Luxury Run

**Type:** baseline control

**Schedule**

- 6h cadence.

**Shopping**

- Food, medicine, insurance only.
- No books/games/cosmetics/room upgrades unless required by progression.

**Career**

- Moderate.

**Why**
Provides a low-autonomy-item comparison against collectors.

---

## P99 — Chaotic Item User

**Type:** edge / human curiosity

**Schedule**

- 5h cadence.

**Behavior**

- If a newly purchased usable item has not been used before, use it at the next legal opportunity even if not strategically useful.
- Keeps 5 food.
- May trigger risky item outcomes.

**Why**
Tests item interactions and accidental injury exposure.

---

## P100 — "Click Everything" Player

**Type:** hostile/edge UI behavior

**Schedule**

- 3h cadence.

**Behavior**
At each visit:

- tries one care action;
- then attempts one owned item action;
- then attempts Stream if available;
- respects engine rejections but does not strategically learn from them.

**Shopping**

- broad mixed purchases.

**Why**
Tests action/rejection/status interaction under high command volume.

---

# 5. Additional cross-profile scenarios

The 50 new profiles should not all start from identical "clean" intent.

Apply the following deterministic overlays across selected profiles so the study covers more combinations.

## 5.1 Busy-retry overlay

Assign to approximately 10 profiles:

- blocked visit retries 1h later.

Assign to approximately 10:

- blocked visit is simply lost.

The rest use their profile-specific rule.

## 5.2 Shop-rotation bad luck

For approximately 8 profiles:

- do not "magically" guarantee preferred food purchasing beyond actual shop rules;
- if desired food is unavailable, the player waits rather than choosing a perfect substitute.

## 5.3 Preference stubbornness

For approximately 8 profiles:

- Bri preference outranks nutrition efficiency.

## 5.4 Status ignorance

For approximately 8 profiles:

- player does not react to a status until its first explicit penalty/event is observed.

## 5.5 Medical misunderstanding

For approximately 5 profiles:

- player buys insurance only after first medical incident.

These overlays should be assigned deterministically and recorded in profile metadata.

---

# 6. New profile schema guidance

The balance runner should evolve from four hardcoded profiles toward a configuration-driven profile structure.

Suggested conceptual schema:

```ts
type BalanceProfile = {
  id: string;
  label: string;
  archetype: 'common' | 'risky' | 'optimizer' | 'edge' | 'hostile';

  schedule: {
    type:
      | 'fixed_interval'
      | 'local_times'
      | 'day_pattern'
      | 'gap_pattern'
      | 'phase_schedule';
    intervalHours?: number;
    localTimes?: string[];
    gapPatternHours?: number[];
    retryAfterBusyHours?: number | null;
  };

  care: {
    foodThreshold?: number;
    restThreshold?: number;
    moodThreshold?: number;
    healthPanicThreshold?: number;
    actionsPerVisit?: number | 'until_safe';
    priority?: string[];
    targetFood?: number;
    targetRest?: number;
    targetMood?: number;
  };

  shopping: {
    foodReserve: number;
    minimumCashReserve?: number;
    priorityTags?: string[];
    preferredItemIds?: string[];
    avoidTags?: string[];
    spendAggressiveness?: 'minimal' | 'normal' | 'high';
  };

  nutrition: {
    strategy:
      | 'ignore'
      | 'preference_first'
      | 'cheap_food'
      | 'sugar_aware'
      | 'protein_counter'
      | 'salt_aware'
      | 'risk_minimizer';
  };

  career: {
    strategy:
      | 'none'
      | 'casual'
      | 'healthy_only'
      | 'stream_when_possible'
      | 'early_grind'
      | 'late_grind';
  };

  medical: {
    strategy:
      | 'unaware'
      | 'hydrate'
      | 'wait'
      | 'painkiller'
      | 'delayed_hospital'
      | 'immediate_hospital'
      | 'critical_hospital'
      | 'never_hospital';
  };

  debt: {
    strategy:
      | 'ignore'
      | 'scheduled_only'
      | 'full_pay_when_affordable'
      | 'panic_cut_spending';
  };

  autonomyAwareness:
    'unaware' | 'normal' | 'relies_on_rescue' | 'tries_to_exploit_rescue';
};
```

This exact type is not mandatory. The important requirement is to stop encoding every policy as custom procedural logic.

---

# 7. Combined 100-run analysis

After the 50 new profiles are added, report the original controlled cohorts separately from the heterogeneous extension.

Do NOT merge everything into one meaningless "overall survival %" number.

Report:

## 7.1 Original canonical cohorts

Keep:

- Casual;
- Focused;
- Optimal;
- Neglect.

These remain the controlled regression benchmark.

## 7.2 New heterogeneous profiles

Group the new 50 by:

- common;
- risky;
- optimizer;
- edge/hostile.

Also group by major behavior axis:

- cadence;
- care philosophy;
- nutrition knowledge;
- spending;
- streaming intensity;
- Hospital use;
- rescue reliance.

---

# 8. Metrics required from the 100-run study

## Survival

For every profile:

- survived;
- death day;
- death causes;
- minimum Health reached;
- ending Health;
- total Health damage;
- total Health recovery;
- time spent Health <= 8.

Aggregate:

- managed common-player survival;
- risky-player survival;
- optimizer survival;
- edge survival.

## Neglect/autonomy

Capture:

- Food rescues;
- Rest rescues;
- rescue lock blocks;
- no-food rescue blocks;
- player resets of each rescue lock;
- time between rescue and next player care;
- whether a rescue prevented death within the next 12/24h.

## Care behavior

Capture:

- Food actions;
- Rest actions;
- Mood actions;
- Bond actions;
- mean metrics immediately before care;
- visits with no care action;
- actions per attended visit.

## Nutrition

Capture:

- Sugar Crash warnings;
- aversions;
- actual crashes;
- protein cancellations;
- risky Kidney Stone feed windows;
- warnings shown;
- water responses after warnings;
- stone onset count.

## Economy

Capture:

- spending by category;
- ending cash;
- minimum cash;
- time below $10;
- low-money-stress events;
- rejected purchases;
- medical principal;
- medical payments;
- discounted full payoff;
- remaining debt.

## Career

Capture:

- number of streams;
- interrupted stream rate;
- active boost load;
- discounted boost contribution;
- follower milestones;
- final followers.

## Autonomous ordinary life

Capture:

- positive autonomous Mood events;
- negative autonomous events;
- reading events;
- game/item events;
- side-gig income;
- injury events;
- movement events.

---

# 9. Balance questions the 100-run study should answer

Do not tune Health from survival percentage alone.

After the expanded study, explicitly answer:

### Q1 — Is max Health actually too high?

Evidence for "too high":

- chronically bad players repeatedly recover from near-death;
- risky/common profiles survive despite long periods at critical needs;
- reducing max Health in paired runs separates neglect/risky behavior without killing normal care.

Evidence against:

- common irregular players frequently die from one unlucky overlap;
- Kidney Stone + missed visit creates unavoidable deaths;
- Health is being used normally as a recovery buffer rather than an immortality pool.

### Q2 — Is recovery too strong?

Look for profiles that:

- take very high cumulative damage;
- repeatedly return to max Health;
- maintain poor care for weeks;
- nevertheless survive comfortably.

This is different from max Health being too high.

### Q3 — Are autonomous rescues too strong?

Look at:

- Rescue Learner;
- Rescue Exploiter;
- Empty Pantry;
- irregular multi-day-gap profiles.

If rescue-heavy profiles survive with little player care, tighten reset/availability.

If rescues mostly buy time and still require player return, keep them.

### Q4 — Are positive autonomous events too strong?

Compare:

- Book-and-Game Collector;
- Room Buff Maxer;
- Minimalist No-Luxury.

If collector runs become materially safer despite neglect, inspect positive Mood/autonomy frequency.

### Q5 — Is Hospital economically viable?

Compare:

- Insurance First;
- Insurance Too Late;
- Immediate Hospital;
- Hospital <15;
- Never Hospital;
- Debt Panic;
- Debt Indifferent.

Hospital should be survivable but economically meaningful.

### Q6 — Is nutrition understandable rather than merely punishable?

Compare:

- Sugar Blind vs Protein Counterplayer;
- Salt Blind vs Warning Hydrator;
- Favorite Repeater vs Nutrition Min-Maxer.

A knowledgeable response should measurably improve outcomes.

### Q7 — Is career aggression properly costly?

Compare:

- Stream Whenever Possible;
- Healthy-Only Streamer;
- Early Grind / Late Coast;
- Late Grind.

Aggressive streaming should accelerate career but increase care pressure.

---

# 10. Health-cap experiment after the 100-run baseline

Do not change max Health before generating the heterogeneous 100-run baseline unless the implementation already requires a test branch.

Once the 100-run baseline exists:

1. preserve all seeds and profile policies;
2. run paired counterfactual with max Health = 30;
3. keep all other production rules identical;
4. compare first-divergence points and terminal outcomes;
5. only test max Health = 25 if 30 fails to create useful separation.

The primary comparison should be:

```text
40 HP baseline
vs
30 HP paired counterfactual
```

not:

```text
40 -> 30 -> 25 plus several other changes
```

Do not combine Health-cap changes with recovery changes in the same first experiment.

---

# 11. Desired qualitative outcome

The game should support all of these at once:

- a normal imperfect player usually survives;
- an attentive player reliably survives;
- an optimizer gets strong progression but does not become mechanically immortal;
- an irregular player can recover from occasional mistakes;
- repeated 24–48h neglect feels dangerous;
- sustained neglect eventually ends the run;
- autonomous behavior buys time but does not play the game for the user;
- bad spending can hurt without creating an unavoidable death spiral;
- nutrition knowledge helps;
- Hospital helps;
- repeated reckless behavior remains risky;
- Bri feels independent rather than waiting lifelessly for button presses.

The expanded profile set exists to measure those statements rather than infer them from four regular archetypes.
