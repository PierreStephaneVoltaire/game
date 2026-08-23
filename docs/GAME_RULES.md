# Companion-care rules

The companion's identity is configurable, so this reference calls them “the
companion.” Every run is a single memory-only life. It ends permanently at
death and has no save recovery, restart, reset, inherited keepsakes, or
separate offline-recap screen.

## Core rules

- Food, Health, Mood, Rest, Bond, and Creativity are whole numbers from 0
  through 10. Values clamp at those limits.
- Health, Food, Rest, or Mood at 0–2 is a critical condition. Bond and
  Creativity are not critical conditions.
- All chance is seeded. The same seed, state, action, and opportunity produce
  the same outcome.
- A run starts with Food 6, Health 8, Mood 6, Rest 7, Bond 4, Creativity 3,
  $20, 100 Followers, one Water, one Uncrustables, and one Pretzel.
- It also starts with no statuses, timed effects, activity, project, room
  items, career rewards, or completed model tiers, using the classic
  appearance.

## Time and catch-up

### Realtime mode

Game time follows real elapsed time. The game catches up when the game is
entered, when the document becomes visible again, and immediately before each
command. It does not run a minute-by-minute simulation poll.

Catch-up resolves every crossed boundary in historical order. Event dayparts,
cooldowns, eligibility, local dates, project deadlines, and stream endings use
the time of each boundary rather than the final return time. Repeating a
reconciliation to the same timestamp does nothing, and splitting an elapsed
period into smaller reconciliations produces the same simulation result as one
catch-up.

A stream wholly inside the missed interval completes during catch-up. A stream
whose end is later than the return time remains visibly active.

### Streaming mode

Game time advances only through timed actions and Advance Time. Instant actions
do not advance it. Timed activities resolve immediately to their ending or
interruption boundary.

Advance Time is seeded:

| State before waiting  | Sampled time | Safety rule                                                                                                                            |
| --------------------- | -----------: | -------------------------------------------------------------------------------------------------------------------------------------- |
| No critical condition |   1–12 hours | Stop at the first new critical boundary and prevent simultaneous periodic or direct Health harm from making that first crossing lethal |
| Already critical      |    1–2 hours | No grace; ordinary harm can be lethal                                                                                                  |

An autonomous Rest selected during Advance Time interrupts the sampled wait
and resolves fully. The resulting elapsed time can therefore exceed the
original sample.

### Calendar and boundary order

The timezone captured at run start controls the clock, local dates, midnight
shop rotations, milestone work, and stream dayparts. The reduced stream window
is 04:00–08:59 and the boosted window is 13:00–19:59.

Food and awake Rest share a two-hour needs clock. Health has its own two-hour
clock, Bond has a 48-hour clock, and autonomous opportunities occur every two
hours anchored to run start. At a shared deadline, a pending caffeine-deferred
Rest loss lands before the ordinary Rest loss. Natural Kidney Stone passage is
resolved before a recurrence due at that same instant. Death stops all later
work at its lethal boundary.

## Needs and Health

### Food, Rest, and Bond

- Every two game-hours, Food has a 75% chance to lose 1.
- Rest loses 1 every two game-hours while awake. It continues during
  Socialize, Play, streams, Hospital, and Commission Work.
- Bond loses 1 after each 48 game-hours without a genuine Bond gain. A Bond
  gain resets the full clock.
- Placing a room item that grants Bond may also reset that clock, but each
  catalogue item type can do so only once per 48 hours.

### Periodic Health

An unprotected Health check occurs every two game-hours. Rest, Socialize,
Play, streams, and Hospital preserve and pause the partially accumulated Health
clock. Commission Work does not protect Health.

Recovery uses Food, Rest, and Mood from before Food and Rest decay at the same
boundary. Each point above 5 contributes to a combined recovery score:

| Recovery score | Health |
| -------------: | -----: |
|            0–3 |      0 |
|            4–6 |     +1 |
|           7–15 |     +2 |

While the balance is negative, subtract `floor(abs(balance) / 2500)` from the
score, capped at 3. Debt never deals direct Health damage.

After due Food and Rest decay, each critical need contributes separately:

| Need value | Health damage |
| ---------: | ------------: |
|        1–2 |            −1 |
|          0 |            −2 |

Food damage requires a successful Food-decay opportunity since the last
unprotected Health check. Recovery and eligible damage combine before Health
is clamped and death is checked.

If Health is already 1–2 before an action phase, an actual Food, Rest, Bond, or
Creativity change in that phase also causes Mood −1. A companion action and its
following autonomous event are separate phases.

## Persistent statuses

Every metric-changing source immediately reconciles statuses, including
actions, items, activity boundaries, room changes, autonomous events,
recurrences, timed-effect expiry, and project rewards. Each onset penalty fires
exactly once.

| Status         | Onset               | Persistence and clearance                             |
| -------------- | ------------------- | ----------------------------------------------------- |
| Starving       | Food 0–2            | Becomes Hungry at Food 3–4; clears at 5               |
| Hungry         | Food 3–4            | Becomes Starving at Food 0–2; clears at 5             |
| Sleep Deprived | Rest 0–2            | Persists at 3–4; clears at 5                          |
| Depressed      | Mood 0–2            | Persists at 3–4; clears at 5                          |
| Lonely         | Bond 0–2            | Mood −1 on onset; persists at 3–4; clears at 5        |
| Creative Block | Creativity 0–2      | Mood −1 on onset; persists at 3–4; clears at 5        |
| Low Energy     | Food + Rest below 6 | Creativity −1 on onset; clears when the sum reaches 8 |
| Full           | Food 9–10           | Persists at 8; clears at 7                            |

Lonely and Creative Block cause another Mood −1 every 12 game-hours while
their source metric remains 0–2.

### Full and Sick

Successfully consuming an edible while Full consumes it, suppresses its Food
gain, keeps its other effects, and has a 35% chance to add Sick with Health −1
and Mood −2. While already Sick, every successful edible consumption instead
suppresses Food and applies Health −1 and Mood −1.

Sick clears when Rest ends with Food at most 5 and Health at least 5, when
Hospital completes, or naturally after 48 game-hours. Natural recovery gives no
metric bonus. Its onset Journey narration hints that a less-full stomach and
proper Rest can help.

### Kidney Stone and Pain Relief

Consumptions contribute salt and water scores to a rolling 48-hour window. If
the totals before the current consumption are salt at least 8 and water at most
2, that later consumption makes a separate 35% Kidney Stone roll.

Onset applies Mood −1, Health −1, and Rest −2, then chooses a natural passing
deadline of 36, 48, 60, or 72 hours with equal chances. Until it clears, it
causes Health −1 and Rest −1 every 12 hours. Natural passage clears the status,
adds Mood +1, and is narrated. Hospital also clears it.

Painkillers cost $7 and can be consumed only while Kidney Stone is active.
They suppress recurring Health and Rest harm for 12 game-hours without clearing
or shortening the stone. Reuse during active Pain Relief is refused without
consuming the item or advancing Annoyed.

### Dizzy Spell

Dizzy Spell cannot begin during the first 24 game-hours. At each later
unprotected Health check, rolling salt from 0 through 3 gives a seeded 35%
onset chance. Onset applies Rest −1 and Mood −1 and blocks streaming.

It persists until rolling salt reaches at least 5 and rolling water reaches at
least 4. That managed band also adds 5 to raw autonomous-stream weight before
the daypart multiplier.

### Overstimulated and Annoyed

A Mood-raising Socialize, Play, or item result attempted from Mood 9–10 adds
Overstimulated and replaces that Mood result with Mood −4. It clears after two
game-hours without a companion attempt, at the end of Rest, or through the
Headphones action.

Each run secretly chooses an Annoyed threshold from 3 through 5 genuine
refusals. A warning is narrated one genuine refusal before onset. Only an
eligible attempt the companion actually refuses counts. Blocked, invalid,
unavailable, stale, automatic, and Rest-at-10 attempts do not count.

Acceptance resets the streak. Onset applies Mood −2, resets the streak, and
further refusals do not accumulate while Annoyed remains active. Annoyed clears
after three game-hours without a companion attempt or through the Socks Plushie
apology action.

### Sugar Crash and scheduled effects

Three sugar servings in a rolling six-hour window schedule a Sugar Crash two
hours later. Limited-Edition Dr Pepper counts as two servings; other sugary
consumptions count as one. The crash applies Mood −2 and Rest −1. Completed Rest
or a protein score of 2–3 clears an active crash but does not cancel one already
scheduled.

A caffeine score of at least 2 moves the next awake Rest loss two hours later.
Only one deferred loss can be pending, and more caffeine does not extend it.
At its deadline the deferred Rest −1 happens before an ordinary Rest loss due
then, even during another activity.

Limited-Edition Dr Pepper sets Creativity to 10 and pins it for six game-hours.
Other Creativity changes are suppressed during Hyperfocus. At expiry,
Creativity loses 2 and Rest loses 2; a newly critical condition can interrupt
an eligible activity. Another can cannot be used during Hyperfocus and is not
consumed or counted toward Annoyed. Hyperfocus and Pain Relief are displayed as
timed effects, not persistent statuses.

## Companion actions

Feed, Rest, Socialize, Play, and item-detail interactions are companion
attempts. Each owns one autonomous-event opportunity. Instant attempts roll
after resolution; completed Rest, Socialize, Play, and Commission Work defer
their opportunity until completion. An interrupted activity receives no
completion opportunity.

Shop, room, Advance Time, and Hospital commands own no attempt opportunity.
Hospital requested while busy has no special event or Annoyed exception.
Attempt-owned and two-hour clock-owned opportunities are independent seeded
draws.

### Rest

| Starting Rest | Duration                                       |
| ------------: | ---------------------------------------------- |
|           0–2 | 7h at 20%; 8h at 50%; 9h at 30%                |
|           3–5 | 6h at 30%; 7h at 50%; 8h at 20%                |
|           6–7 | 4h at 50%; 5h at 35%; 6h at 15%                |
|             8 | 80% refusal; otherwise the 6–7 row             |
|             9 | 90% refusal; otherwise the 6–7 row             |
|            10 | Always refused; this is not an Annoyed refusal |

Rest restores 1 Rest per completed whole hour and 1 Mood per 6 Rest actually
recovered. An interrupted Rest keeps completed-hour recovery. A Rest begun at
Rest 0–2 also enables a weight-10, once-per-Rest snoring narration.

### Socialize and Play

Socialize lasts 15, 30, 45, or 60 minutes with equal chances and normally gives
Mood +1 and Bond +1. Play lasts 1, 2, or 3 hours with equal chances and normally
gives Mood +1 and Creativity +1.

Their refusal chance adds 20 percentage points at Mood 0–2, 20 at Rest 0–2,
and 50 while Annoyed, capped at 90%. Consecutive repetition no longer raises
refusal chance. The first consecutive completion grants its normal Mood gain;
repeats keep Bond or Creativity rewards but suppress Mood gain.

Rest, Socialize, Play, streams, and Commission Work end if a condition that was
not critical at their start becomes critical. Interrupted Socialize, Play, and
Commission Work grant no completion reward. Streams retain elapsed-hour income
and donation rolls but not base Followers or completion metrics. Hospital does
not end early.

### Hospital

Hospital is available while Sick or Kidney Stone is active. A confirmation
shows the 12-hour duration, charge, and whether an Insurance Card will be used.
Coverage is locked at visit start:

- with a card, consume one card and charge $500;
- without a card, charge $10,000.

The visit starts even when the charge creates debt. It protects Health, blocks
other care, suppresses Kidney Stone recurrence, and continues Food and Rest
decay. Completion clears Sick and Kidney Stone and applies Health +4, Food +3,
and Rest +3.

### Commission Work

Commission Work is an action on the owned Rigging Tablet, leaving the four care
buttons unchanged. It requires Creativity at least 4, no Sleep Deprived or
Depressed status, no blocking activity, and no completed Commission Work
earlier that local date.

It lasts six hours. Food, Rest, and periodic Health continue. A new critical
condition interrupts it with no payout or completion effects. Normal completion
pays `$40 + $15 × starting Creativity`, then applies Rest −2, Creativity −1,
and an equal Mood −1 or 0 roll, followed by one deferred companion opportunity.

## Feeding, nutrition, and cravings

Liked foods apply at least Mood +1. Variable foods are neutral and reveal one
seeded reaction. Disliked foods use their authored refusal chance and disliked
Mood effect. Specific-preparation foods first make their authored preparation
roll; an unacceptable preparation follows disliked behavior. A refused
consumable has a separate 50% chance to be wasted.

Automatic stream snacks select only Liked or Variable owned foods. They still
use ordinary salt, water, sugar, protein, preparation, refusal, Full, Sick, and
Kidney Stone rules. Their attempts and refusals do not advance Annoyed or
interaction-inactivity tracking and do not create another event opportunity.

A craving selects one available Liked food. Consuming it clears the craving and
adds Bond +1. Otherwise it expires after 24 game-hours or the second shop
refresh after onset, whichever comes first; expiry is narrated and frees the
slot.

Nutrition uses the typical labeled serving. Branded foods use first-party
labels, simple foods use USDA Foundation records, and prepared foods use USDA
FNDDS as-consumed records. Missing water or caffeine remains unknown rather
than becoming zero. The Concoction uses three explicitly fictional seeded
profiles. Only qualitative hints appear in the game.

## Autonomous events

Every two hours from the run's starting timestamp, both clock modes receive a
time-owned weighted opportunity. Companion attempts have their own separate
opportunities. During an activity, narration and stat events remain eligible,
but another stream and autonomous Rest are not.

| Candidate                 | Weight and eligibility                                                     |
| ------------------------- | -------------------------------------------------------------------------- |
| No visible event          | 100                                                                        |
| Low-money stress          | 20 below $10, once per local date                                          |
| Food craving              | 20 when a Liked target exists and no craving is active                     |
| Creative inspiration      | 15, 12-hour cooldown, Creativity +1                                        |
| Socks                     | 15, six-hour cooldown, Mood −1/+1/+1 equally                               |
| Benign room event         | 10, four-hour cooldown                                                     |
| Autonomous Rest           | 40 at Rest 0–2 with no activity                                            |
| Rare full-body commission | 5 with an owned Rigging Tablet, no active one, and a 14-local-day cooldown |
| Mom's Care Package        | 5 in debt or at Food 0–2, 72-hour cooldown                                 |
| Rest snoring              | 10 once during an eligible low-Rest Rest                                   |
| Autonomous stream         | Dynamic                                                                    |

Mom's Care Package adds two seeded Liked foods, distinct where possible, and
Mood +1. The full-body commission is a nonblocking project that completes at
the third local midnight and pays a seeded $400–$800. Placing Cat Tree adds 3
to Socks weight.

All catalogue-authored automatic hooks also join the weighted pool.

## Autonomous streaming and donations

The player cannot start an ordinary stream. It is selected from the autonomous
pool only when no activity or blocking status is active. Stream blockers are
Hungry, Starving, Sleep Deprived, Sick, Kidney Stone, Depressed, Low Energy,
Overstimulated, and Dizzy Spell.

Raw stream weight is:

```text
max(0,
  50 × seeded roll
  + 25 × ((Mood - 5) / 5)
  + 25 × ((Creativity - 5) / 5)
  + managed-nutrition bonus
)
```

The managed-nutrition bonus is 5, added before the daypart multiplier. The
ordinary daypart multipliers are 0.5 from 04:00–08:59, 1.5 from
13:00–19:59, and 1 otherwise. June 29 and November 14 double the final stream
weight.

Base duration is 1, 2, or 3 hours at 15% each; the remaining 55% is divided
equally across 4–12 hours. Ordinary effective duration is base duration minus
`10 - Rest`, then capped at local midnight. A nonpositive result narrates that
the companion is too tired.

Food has a floor of 2 during a stream. A due decay that would cross the floor
tries one eligible automatic snack first. A new critical condition ends the
stream after the required snack resolves.

Stream income is:

```text
round(hourly rate × elapsed hours × (0.5 + Creativity / 10))
```

The starting hourly-rate band is $5–$15 and career milestones can replace it.
Income is added immediately and naturally repays debt first. A normal
completion also applies Creativity −1, Rest −1, and an equal Mood −1/0/+1 roll.

Every completed whole hour, including hours from an interrupted stream, gets
an independent donation roll. Base chance is `2% + 0.5% × current Creativity`.
The fourth model adds one permanent percentage point before multipliers.

| Donation        | Weight |                  Amount | Followers |
| --------------- | -----: | ----------------------: | --------: |
| Kind Bridiot    |     55 |       $20–$60 uniformly |        +5 |
| Raid windfall   |     27 |     $100–$400 uniformly |        +5 |
| Whale           |     14 | $1,000–$3,000 uniformly |       +30 |
| Legendary whale |      4 |         exactly $10,000 |       +30 |

Legendary is eligible only at Creativity 10. Below 10, the other tier weights
are normalized rather than doubled. June 29 and November 14 triple donation
hit chance. Tournament Host's ×3 stacks with that multiplier, capped at 100%.
Every donation is narrated.

## Followers, milestones, and model projects

Followers never decrease. Only normally completed streams earn base stream
Followers. The base rate per hour is `1 + Creativity / 10`; only exact elapsed
time within 13:00–19:00 is doubled. All time segments are summed and rounded
once. Donations and model rewards are then added.

Milestones resolve in order, including several crossed by one result:

| Followers | Career tier and reward                                                                      |
| --------: | ------------------------------------------------------------------------------------------- |
|       250 | Affiliate: hourly stream rate $8–$18 and Mood +2                                            |
|       600 | Partner: hourly rate $10–$22 and first model tier unlocked                                  |
|     1,200 | Convention Guest: $500 appearance fee, Convention Guest Set, and second model tier unlocked |
|     2,000 | Tournament Host: third model tier and one fixed eight-hour stream with donation chance ×3   |
|     3,500 | 3D Ready: fourth model tier unlocked                                                        |

New Model Commission costs $300 and appears once the required career tier is
unlocked. Each unlocked unfinished tier can be purchased once. Its nonblocking
project ends at the third local midnight and grants Mood +3, Creativity +2,
Followers +50, a new active appearance, and a queued fixed four-hour debut
stream.

The appearances progress through 3.0-inspired, pixie-inspired,
goth/oni-inspired, and 3D-debut-inspired models. Completing the fourth project
is the actual 3D Debut and permanently increases base donation chance by one
percentage point.

Tournament and debut streams wait until ordinary stream blockers are gone and
a 13:00–19:59 opportunity occurs. Their fixed duration ignores ordinary
Rest-duration subtraction, remains capped at midnight, and can end at a newly
critical condition.

## Shop, Inventory, and room

The catalogue has exactly 225 items:

| Category   | Count |
| ---------- | ----: |
| Food       |   109 |
| Medicine   |     2 |
| Care       |     3 |
| Reusable   |    73 |
| Upgrade    |    22 |
| Decoration |    16 |

The renamed items are Mini Tacos, Cheeseless Toppingless Pizza, and The
Concoction. Cheeseless Toppingless Pizza has an 85% acceptable-preparation
chance.

The nine added definitions are Insurance Card ($150, at most one owned),
Painkillers ($7), Electrolyte Sachet ($9; salt 2/water 2), Jar of Pickle Juice
($3; Liked; Food +1/Mood +1; salt 3/water 2), Sheet of Cute Stickers ($25;
reusable Mood −2 interaction), Rigging Tablet ($200), Limited-Edition Dr Pepper
($12; stock 1–2; two sugar servings), Convention Guest Set ($120), and New
Model Commission ($300).

Each local date receives a seeded 24-item rotation:

- 12 Food;
- 2 Medicine or Care;
- 4 Reusable;
- 3 Upgrade; and
- 3 Decoration.

Every rotation guarantees one affordable edible and one hydration-support
item. Ordinary stock is seeded from 1 through 5; an item's authored fixed range
overrides that. Milestone-gated items join the candidate pool only after their
unlock.

Positive but insufficient balances cannot cross into debt by shopping. When a
command begins with a negative balance, Food and Medicine can be purchased
without an affordability check; Care, Reusable, Upgrade, and Decoration remain
blocked. Electrolytes and Insurance are Care. One successful Food/Medicine
transaction made while already in debt applies Mood −1, regardless of quantity
or cart lines. The once-per-local-date low-money event remains separate.

Non-quantity durables reject quantity above one in both direct purchases and
carts. Ownership caps and stock limits still apply.

Placed room effects are removed by the exact amount that was originally
applied, so clamping never makes placement changes irreversible. The room keeps
its fixed anchors and three-row layout.

## Journey and death

Journey shows natural narration for meaningful care, reactions, activities,
catch-up events, donations, milestones, commissions, projects, medical
recovery, craving expiry, Hyperfocus, Dizzy Spell, care packages, model debuts,
room changes, and death. The room displays only the latest projected Journey
entry.

It hides reconciliation, decay, opportunity bookkeeping, shop refreshes,
nutrition counters, command receipts, and other internal mechanics. There is no
attention-call system or separate offline recap.

Death is terminal. The graveyard lists every structured cause, preserves the
causal Journey that led to the final Health loss, and keeps the full narrated
Journey available. It never infers causes by parsing narration text.
