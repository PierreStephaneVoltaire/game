# Companion-care rules

The companion's identity is configurable, so this reference calls them “the
companion.” Every run is a single memory-only life. A terminal Ending closes it
permanently; `Made It` is a non-terminal Ending unlock. There is no save
recovery, restart, reset, inherited keepsake, or separate offline-recap screen.
The configured display name and authored player-facing copy may use the chosen
name; runtime identifiers, IDs, paths, assets, seeds, and infrastructure names
remain generic.

## Core rules

- Health is a whole number from 0 through 40. Food, Mood, Rest, Bond, and
  Creativity are whole numbers from 0 through 10. Values clamp at those limits.
- Health at 1–8 or Food, Rest, or Mood at 0–2 is a critical condition. Health
  0 causes Death. Bond and Creativity are not critical conditions. Mood held
  continuously at 0 can cause Quit Streaming.
- All chance is seeded. The same seed, state, action, and opportunity produce
  the same outcome.
- A run starts with Food 6, Health 32, Mood 6, Rest 7, Bond 4, Creativity 3,
  $20, 100 current and peak Subscribers, an available Line of Credit, one
  Water, one Uncrustables, one Pretzel, and one Five
  Plain Tortillas.
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
resolved before a recurrence due at that same instant. At a shared two-hour
boundary, due projects and milestones resolve first, the autonomous candidate
is selected from the pre-Subscriber-Revenue state, Subscriber Revenue is
credited, local-day medical payments resolve, and an activity completion
resolves afterward. Periodic damage is recorded before any emergency rescue.
At a shared timestamp, due activity completions, income, Hospital payments,
LOC settlement, life events, and audience changes settle atomically before
their derived statuses or Endings. Health reaching 0 still resolves first.

### Run Endings and risk clocks

A Run closes permanently with exactly one terminal outcome:

| Ending         | Trigger                                                  |
| -------------- | -------------------------------------------------------- |
| Death          | Health reaches 0                                         |
| Quit Streaming | Mood remains at 0 continuously for 72 game-hours         |
| Financial Ruin | Balance crosses from above −$20,000 to −$20,000 or below |

The Mood countdown starts immediately at 0, clears as soon as Mood rises above
0, and warns at 0, 24, and 48 hours. Financial Ruin has no countdown, grace
period, delinquency state, or due date: every complete Balance operation checks
for the crossing immediately. Unpaid obligations do not count toward it. Death
wins if Health reaches 0 in the same operation.

Ending-risk countdowns are persistent simulation state but are not exposed in
the live Status panel. Recovery adds one Journey recovery entry. Every later
command after a terminal Ending is rejected with “This run is over” and
cannot mutate the archived state.

Ending event messages, warning/recovery copy, Journey death narration, and
Ending-card titles and explanations are authored as text pools in
`ending-rules.json`. A seeded option is selected from each applicable pool and
then its placeholders are filled by the simulation or presentation layer.

When current Subscribers first reach 3,000,000, `Made It` unlocks once with
its exact time and causal audience event. It does not close the Run. Agency
invitation is a career event, not an Ending. `She Cut You Off` remains
unimplemented because no trigger has been approved.

## Needs and Health

### Food, Rest, and Bond

- Every two game-hours, Food has a 65% chance to lose 1.
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

Balance, medical bills, and the Line of Credit do not reduce this recovery
score and do not otherwise apply debt-specific metric penalties.

After due Food and Rest decay, each critical need contributes separately:

| Need value | Health damage |
| ---------: | ------------: |
|        1–2 |            −1 |
|          0 |            −1 |

Food damage requires a successful Food-decay opportunity since the last
unprotected Health check. Recovery and eligible damage combine before Health
is clamped and death is checked. Food, Rest, and Mood damage is capped at 2 in
total per check. Applied attribution is allocated by descending raw damage,
then Food, Rest, and Mood as the stable tie order; the ledger retains the raw
uncapped sources for diagnostics.

If Health is already 1–8 before an action phase, an actual Food, Rest, Bond, or
Creativity change can also cause Mood −1. This penalty has one global 12-game-
hour cooldown, including across the companion action and its following event.

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

The ten most recent successful food or drink feeds contribute salt and water
scores. A new feed is appended and the oldest is evicted before evaluation. If
those ten-or-fewer feeds total at least salt 10 while water remains at most 2,
that feed makes a separate seeded 5% Kidney Stone roll. Refusals, rejections,
and non-food Medicine actions do not enter this window.

Crossing into salt at least 6 with water at most 2 produces a qualitative
warning. Onset applies Mood −1, Health −1, and Rest −2 and points to
Painkillers. After each 48 active hours, one
seeded 50% passage roll occurs. Success clears the status and grants Mood +1
before a recurrence due at the same instant; failure schedules the next check
48 hours later. Symptoms recur every 12 hours for Health −1 and Rest −1.
Hospital also clears it, removes the treated ten-feed exposure window, and
creates no immunity or cooldown; a new onset requires new feeds.

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

Each successful consumption contributes authored sugar and protein to one
rolling six-hour window. `effective sugar = max(0, total sugar − total
protein)`. An atomic post-item total of 4 or more schedules a Sugar Crash two
hours later and exposes a visible warning. Later protein that drops the total
below 4 cancels the pending crash immediately or clears an active crash. A
cancelled crash cannot reschedule without a new consumption. An activated crash
applies Mood −2 and Rest −1; completed Rest also clears it.

A caffeine score of at least 2 moves the next awake Rest loss two hours later.
Only one deferred loss can be pending, and more caffeine does not extend it.
At its deadline the deferred Rest −1 happens before an ordinary Rest loss due
then, even during another activity.

Limited-Edition Dr Pepper sets Creativity to 10 and pins it for six game-hours.
Other Creativity changes are suppressed during Hyperfocus. At expiry,
Creativity loses 2 and Rest loses 2; a newly critical condition can interrupt
an eligible activity. Another can cannot be used during Hyperfocus and is not
consumed or counted toward Annoyed. Hyperfocus and Pain Relief are scheduled
effects, not persistent statuses.

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

Socialize lasts 15, 30, 45, or 60 minutes with equal chances and gives Bond +1
plus Creativity +1. Play lasts 1, 2, or 3 hours with equal chances and gives
Bond +1 plus Mood +1. A seeded strong outcome, selected 25% of the time, raises
the activity's primary reward from +1 to +2 while Bond remains +1. Completed
activities select their player-facing narration from the authored arrays in
`event-texts.json`; outcome strength does not replace that text.

Their refusal chance adds 20 percentage points at Mood 0–2, 20 at Rest 0–2,
and 50 while Annoyed, capped at 90%. Consecutive repetition no longer raises
refusal chance. The first consecutive completion grants its primary reward;
repeats keep Bond but suppress Mood for Play or Creativity for Socialize.
Switching to another companion action ends the repetition streak. Refusals and
interruptions do not grant completion rewards.

Rest, Socialize, Play, streams, and Commission Work end if a condition that was
not critical at their start becomes critical. Interrupted Socialize, Play, and
Commission Work grant no completion reward. Streams retain elapsed-hour income
and donation rolls but not base Subscribers or completion metrics. Hospital does
not end early.

### Hospital and medical payment plans

Hospital is available while Sick or Kidney Stone is active. A confirmation
shows the 12-hour duration, payment-plan principal, and whether an Insurance Card will be used.
Coverage is locked at visit start:

- with a card, consume one card and lock a $500 principal with $25 daily payments;
- without a card, lock a $10,000 principal with $150 daily payments.

No cash is charged at visit start. It protects Health, blocks
other care, suppresses Kidney Stone recurrence, and continues Food and Rest
decay. Completion clears Sick and Kidney Stone and applies Health +4, Food +3,
and Rest +3, then creates the locked medical bill.

At each local midnight, after same-boundary project, autonomous, and Subscriber
income, outstanding bills pay oldest first. A payment never takes cash below
zero; unpaid principal remains without metric harm. While any principal exists,
Shop always offers Pay Medical Debt in Full for
`ceil(total remaining principal × 0.85)`. This service is all-or-nothing,
clears every bill, creates no inventory, and is hidden when no bill remains.

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

The Feed dialog can select quantities across several owned edible items before
one confirmation. Selected units resolve in stable item order through the same
ordinary single-item feeding pipeline, so each can be refused, consumed, or
trigger its normal follow-up effects independently. Resolution stops if a
terminal Ending occurs.

Every catalogue item owns an array of possible Journey lines. An accepted use
selects one line with seeded randomness and prefixes the configured companion
name. Items are familiar possessions and foods, so item use never produces a
discovery event. Water, for example, uses authored reluctant-drinking lines
instead of generic "tried" copy.

Liked foods apply at least Mood +1. Variable foods are mechanically neutral
but still use their item-authored narration. Disliked foods use their authored
refusal chance and disliked Mood effect. Specific-preparation foods first make
their authored preparation roll; an unacceptable preparation follows disliked
behavior. A refused consumable has a separate 50% chance to be wasted.

Automatic stream snacks select only Liked or Variable owned foods. They still
use ordinary salt, water, sugar, protein, preparation, refusal, Full, Sick, and
Kidney Stone rules. Their attempts and refusals do not advance Annoyed or
interaction-inactivity tracking and do not create another event opportunity.

Emergency Food and Rest rescues are separate from the weighted pool. After a
periodic check actually applies matching damage, an idle living companion at
Food or Rest 0–2 may act once: Food consumes one acceptable owned Liked or
Variable food through the ordinary feeding pipeline, then Rest may start the
normal Rest activity. Snack Shelf prefers snack-tagged choices; Mini Fridge
prefers useful drinks or refrigerated food. The Health damage is never
refunded, no item is bought or created, and each metric has an independent
lock. Only a player-commanded action that actually raises the matching metric
to at least 5 resets its lock.

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
unless their authored hook requires idle state; another stream cannot begin.

| Candidate                 | Weight and eligibility                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| No visible event          | 100                                                                                                      |
| Low-money stress          | 20 below $10, once per local date                                                                        |
| Food craving              | 20 when a Liked target exists and no craving is active                                                   |
| Creative inspiration      | 15, 12-hour cooldown, Creativity +1                                                                      |
| Socks                     | Requires a placed Cat Tree; weight 15 plus placement modifiers, six-hour cooldown, Mood −1/+1/+1 equally |
| Benign room event         | 10, four-hour cooldown                                                                                   |
| Self-entertainment        | 5 while idle, Mood +1, 24-hour cooldown                                                                  |
| Stood up too fast         | 3 while idle, seeded neutral/Rest −1/Health −1 outcomes, 24-hour cooldown                                |
| Tiny walk / barely moved  | 3 each, one shared local-day slot; the negative event requires no movement in 24 hours                   |
| Rare full-body commission | 5 with an owned Rigging Tablet, no active one, and a 14-local-day cooldown                               |
| Mom's Care Package        | 5 below $0 Balance or at Food 0–2, 72-hour cooldown                                                      |
| Rest snoring              | 10 once during an eligible low-Rest Rest                                                                 |
| Autonomous stream         | Dynamic                                                                                                  |
| Off-stream support        | 10, 12-hour cooldown, $5–$15 uniformly                                                                   |

Mom's Care Package clearly records two seeded Liked foods as gifts, distinct
where possible, and adds Mood +1. The full-body commission is a nonblocking project that completes at
the third local midnight and pays a seeded $400–$800. Placing Cat Tree adds 3
to Socks weight.

All catalogue-authored automatic hooks also join the weighted pool. Hooks may
use seeded message pools and outcomes, shared cooldowns, idle/career/Follower
requirements, metric effects, explicit injury attribution, and positive
income. Book and Manga share a 12-hour reading cooldown; selected games and
creative hobbies share 18-hour cooldowns. Drawing Tablet can pay $20–$60 on a
36-hour side-gig cooldown, and Merch Sample can pay $15–$50 after the 1K tier
on a 48-hour side-gig cooldown.

The reusable $35 Can Opener has a weight-3 idle hook and a 48-hour kitchen-
accident cooldown: 90% Mood +1, 9% Health −1 with Mood −1..0, and 1% Health −2
with ER narration. Its event Health loss is outside the periodic need cap.

Off-stream support ignores all nonterminal stream blockers and remains
eligible during any activity. It can be selected by either a time-owned or an
attempt-owned opportunity, pays income immediately, grants no Subscribers, and
does not use or modify ordinary stream donation rules. Its selection neither
starts a stream nor resets stream-drought protection.

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
  + clamp(0, (drought hours - 24) × 4, 300)
)
```

The drought clock starts with the run and tracks time since an ordinary
autonomous stream candidate last won the weighted draw. Its bonus is zero for
24 hours, then rises by 4 weight per hour to a cap of 300. The managed-nutrition
and drought bonuses are added before the daypart multiplier. The ordinary
daypart multipliers are 0.5 from 04:00–08:59, 1.5 from 13:00–19:59, and 1
otherwise. June 29 and November 14 double the final pity-inclusive weight.

Drought time continues while streaming is blocked. Selecting an ordinary
stream resets it even when the companion is too tired, the activity is later
interrupted, or midnight caps its duration. Forced Tournament and model-debut
streams do not reset it.

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
Income is added immediately and reduces negative cash first; it does not repay
Hospital principal or LOC units. A normal
completion also applies Creativity −1, Rest −1, and an equal Mood −1/0/+1 roll.

Every completed whole hour, including hours from an interrupted stream, gets
an independent donation roll. Base chance is `2% + 0.5% × current Creativity`.
The fourth model adds one permanent percentage point before multipliers.

| Donation        | Weight |                  Amount | Subscribers |
| --------------- | -----: | ----------------------: | ----------: |
| Kind supporter  |     55 |       $20–$60 uniformly |          +5 |
| Raid windfall   |     27 |     $100–$400 uniformly |          +5 |
| Major donor     |     14 | $1,000–$3,000 uniformly |         +30 |
| Legendary donor |      4 |         exactly $10,000 |         +30 |

Legendary is eligible only at Creativity 10. Below 10, the other tier weights
are normalized rather than doubled. June 29 and November 14 triple donation
hit chance. The Tournament Appearance stream's ×3 stacks with that multiplier,
capped at 100%. Every donation is narrated.

## Subscriber Revenue

Every run earns a deterministic Subscriber Revenue payment on each two-hour
boundary anchored to run start. It begins at `$1 × 1`, has no random roll, does
not enter or consume the autonomous pool, and remains active through Sick,
Hospital, Kidney Stone, streams, and every other activity or status. A terminal
run earns no later payments. Like every positive income source, it reduces
negative cash before producing a positive balance but does not erase explicit
obligations.

The highest unlocked multiplier replaces the previous one; multipliers do not
stack. Each tick uses `round($1 × multiplier)`. The yields below show twelve
ticks over 24 game-hours and are not local-date caps:

| Peak Subscribers | Multiplier | Per tick | 12-tick yield |
| ---------------: | ---------: | -------: | ------------: |
|            0–29K |         1× |       $1 |           $12 |
|           30,000 |       1.5× |       $2 |           $24 |
|           50,000 |         2× |       $2 |           $24 |
|          100,000 |         3× |       $3 |           $36 |
|          200,000 |         4× |       $4 |           $48 |
|          250,000 |         5× |       $5 |           $60 |
|          500,000 |         7× |       $7 |           $84 |
|        1,000,000 |        10× |      $10 |          $120 |

Routine payments stay out of Journey. The milestone entry announces each
multiplier upgrade.

## Subscribers, milestones, and model projects

Natural audience growth resolves every two game-hours. Each tick adds the
current career tier's baseline plus active
stream contributions, rounded once. Every real stream start contributes for
seven days using the career tier and Creativity at its start:

```text
stream contribution = snapshotted tier rate × (1 + snapshotted Creativity × 0.02)
```

The per-tick tier rates are: Debut 1, First Model 2, 1K 10, Model Redesign 20,
Twitch Partner 60, 30K 80, Tournament 100, 50K 150, Convention 200, 100K 300,
3D Ready 400, 200K 500, 250K 1,000, 500K 2,000, and 1M 2,000. Contributions
are ordered by `startedAt` and stream ID. The oldest four count at full value;
every later contribution counts at 25%. When an older one expires, the next
automatically moves into the full-value group. Each expires independently.
Interrupted streams retain their contribution. Ordinary stream completion has
no separate direct base-Subscriber award; donations and model rewards remain.

Clippers are a $25 consumable Upgrade available from Debut and are guaranteed
in the initial shop rotation. The first active Clipper pays immediately, then
the stack publishes daily before a shared
72-hour expiry. Each award is `50 Subscribers × current tier ordinal × stacks`.
Using another Clipper adds a stack and renews the shared expiry without moving
the already scheduled next daily tick or granting another immediate award.
All stacks expire together.

Current Subscribers may fall after a life event. Peak Subscribers never fall;
milestones and their one-time rewards use the peak and resolve in order,
including several crossed by one result. Subscriber Revenue and stream-rate
bands also remain unlocked after a loss.

| Peak Subscribers | Career tier and reward                                                                    |
| ---------------: | ----------------------------------------------------------------------------------------- |
|              100 | Debut; every run begins here                                                              |
|              150 | First Model: first model tier unlocked                                                    |
|            1,000 | 1K Subscribers: hourly stream rate $8–$18 and Mood +2                                     |
|            5,000 | Model Redesign: second model tier unlocked                                                |
|           10,000 | Twitch Partner: hourly stream rate $10–$22                                                |
|           30,000 | 30K Subscribers: Subscriber Revenue 1.5×                                                  |
|           40,000 | Tournament Appearance: third model tier and one fixed eight-hour stream with ×3 donations |
|           50,000 | 50K Subscribers: Subscriber Revenue 2×                                                    |
|           75,000 | Convention Guest: $500 appearance fee and Convention Guest Set                            |
|          100,000 | 100K Subscribers: Subscriber Revenue 3×                                                   |
|          150,000 | 3D Ready: fourth model tier unlocked                                                      |
|          200,000 | 200K Subscribers: Subscriber Revenue 4×                                                   |
|          250,000 | 250K Subscribers: Subscriber Revenue 5×                                                   |
|          500,000 | 500K Subscribers: Subscriber Revenue 7×                                                   |
|        1,000,000 | 1M Subscribers: Subscriber Revenue 10×                                                    |

New Model Commission costs $300 and appears once the required career tier is
unlocked. Each unlocked unfinished tier can be purchased once. Its nonblocking
project ends at the third local midnight and grants Mood +3, Creativity +2,
Subscribers +50, a new active appearance, and a queued fixed four-hour debut
stream.

The appearance identity progresses through 3.0-inspired, pixie-inspired,
goth/oni-inspired, and 3D-debut-inspired models. Appearance artwork is selected
entirely by the companion profile, and multiple identities may share one asset.
Completing the fourth project is the actual 3D Debut and permanently increases
base donation chance by one percentage point.

Tournament Appearance and model-debut streams wait until ordinary stream blockers are gone and
a 13:00–19:59 opportunity occurs. Their fixed duration ignores ordinary
Rest-duration subtraction, remains capped at midnight, and can end at a newly
critical condition.

## Debt, LOC, and life events

`In Debt` is a display-only persistent status. It appears whenever Balance is
below $0 and clears at $0 or above. Hospital principal, the remaining LOC cost,
and other unpaid obligations do not activate it and do not apply recovery or
stat penalties. Financial Ruin occurs only when a Balance-changing transaction
crosses from above −$20,000 to −$20,000 or below; its record keeps the ending
Balance and causal transaction.

The one-time Line of Credit is a permanent ordinary Shop offer. While
available, one $50 opening unit may be added to the cart; checkout charges the
$50 and advances $10,000 atomically even when starting Balance is below $50.
Once open, the same card sells twenty total $600 repayment units, limited by
the remaining count. A repayment checkout requires starting Balance to cover
the repayment portion. Once closed, the card remains in place but cannot be
added. There are no daily or time-based charges.

Seeded VTuber-life events use a dedicated run-anchored scheduler every 30
minutes (not the ordinary autonomous opportunity pool). Each boundary rolls
the authored reciprocal probabilities in specification order. Successful
events resolve chronologically and no later event resolves after a terminal
Ending:

- Tax bills charge a seeded, uniformly selected whole-dollar amount from $100
  through $1,000. Equipment Failure selects one seeded PC-related catalogue
  item from its JSON-authored pool and charges a separate seeded whole-dollar
  replacement cost from $30 through $500. Neither event creates inventory,
  repair state, or a payment plan. They are eligible only while starting
  Balance is $0 or above, so a rare expense may create debt but cannot recur
  while Balance remains negative.
- Twitter cancellation removes 1%, 2%, or 3% of current Subscribers without
  revoking peak progression.
- Rain applies Mood −1 only.
- A personal purchase selects exactly one seeded item from the entire unlocked
  catalogue, independent of rotation and stock. It respects progression,
  ownership, and lifetime limits, requires the real item price to fit within
  current Balance, adds the item and purchase record, deducts that price, and
  adds Mood +1. With no eligible affordable item, it cannot occur.
- Sponsored-stream deals immediately credit a seeded, uniformly selected
  whole-dollar amount from $250 through $2,000.
- The one-time Agency debut adds 100,000 Subscribers and applies 1.5× natural
  discovery for seven days.
- Algorithm boost applies 1.5× natural discovery for one day. Agency and
  Algorithm boosts are tracked separately; when both are active they multiply
  natural growth to 2.25×. Discovery boosts affect neither Clippers nor direct
  Subscriber awards.

## Shop, Inventory, and room

The catalogue has exactly 232 items:

| Category   | Count |
| ---------- | ----: |
| Food       |   114 |
| Medicine   |     2 |
| Care       |     3 |
| Reusable   |    75 |
| Upgrade    |    23 |
| Decoration |    15 |

The renamed items are Mini Tacos, Cheeseless Toppingless Pizza, and The
Concoction. Cheeseless Toppingless Pizza has an 85% acceptable-preparation
chance.

The lore-text merge patch adds Jaffa Cakes ($3), Oatmeal ($2), Homegrown
Chocolate Chip Cookies ($4), and Ring Fit ($60). The three Foods are Liked and
use their authored nutrition scores/effects; their provenance records clone
the explicitly named comparable catalogue nutrition source. Ring Fit is a
single-use interaction that requires owned game-control equipment and applies
its authored seeded Mood, Rest, and Creativity effects. The same patch replaces
listed descriptions and item-use narration by canonical ID without altering
unlisted gameplay fields.

The catalogue additions include Insurance Card ($150, at most one owned),
Painkillers ($7), Electrolyte Sachet ($9; salt 2/water 2), Jar of Pickle Juice
($3; Liked; Food +1/Mood +1; salt 3/water 2), Sheet of Cute Stickers ($25;
single-use Mood −2 interaction), Rigging Tablet ($200), Limited-Edition Dr Pepper
($12; stock 1–2; high effective sugar), Convention Guest Set ($120), New Model
Commission ($300), and Clippers ($25). Five Plain Tortillas is a $2 essential
Food and starter comfort item with Food +2 and Mood +2.
The Can Opener is a single-use item priced at $35. Three-Month-Old Rotisserie Chicken
is an $8 Variable Food with stock, ownership, and lifetime-purchase limit 1;
it participates in ordinary shop rotation and automatic stream snacks.
Consuming the complete item once applies Food +5, Health −8, and Creativity
+2, creates no persistent status or recurrence, and attributes lethal damage
directly to the item. Its gameplay nutrition scores are all zero.

Non-furniture items with stat-granting or commission actions are consumed when
their action succeeds; only placed room furniture remains permanently reusable.

Each local date receives a seeded 24-item rotation:

- 12 Food;
- 2 Medicine or Care;
- 4 Reusable;
- 3 Upgrade; and
- 3 Decoration.

Every rotation always includes Water, plus guarantees one affordable edible
and one hydration-support item. Ordinary stock is seeded from 1 through 5; an item's authored fixed range
overrides that. Milestone-gated items join the candidate pool only after their
unlock.

Every ordinary Food, Medicine, Care, Reusable, Upgrade, or Decoration purchase
may cross Balance below zero. The Shop previews the real Balance after checkout,
including the LOC opening advance. Stock, ownership, quantity, rotation, and
progression rules still apply. Shopping while below $0 has no separate Mood or
recovery penalty. Mixed catalogue/LOC carts settle atomically.

Non-quantity durables reject quantity above one in both direct purchases and
carts. Ownership caps and stock limits still apply.

Shop card bodies are inert. Only the `+` and `−` controls change cart quantity;
a separate Info control opens details. Quantity controls support click,
keyboard operation, and press-and-hold adjustment without inserting feedback
that moves the grid. Inventory is projected only from actual owned inventory
and appears as a searchable, filterable grid with 24 items per page.

Placed room effects are removed by the exact amount that was originally
applied, so clamping never makes placement changes irreversible. The room keeps
its fixed anchors and three-row layout.

## Journey and Endings

Journey shows natural narration for meaningful care, authored activity
completion text, reactions, catch-up events, off-stream support, donations,
milestones, commissions, projects, medical recovery, bills and payments,
emergency rescues, sugar warnings, reading, side gigs, injuries, craving
expiry, Hyperfocus, Dizzy Spell, care packages, model debuts,
room changes, Balance debt crossings and recovery, LOC operations, life
events and expiring discovery boosts, Made It, ending warnings and recoveries,
and terminal Endings. The room displays only the latest projected Journey
entry.

It hides reconciliation, decay, Subscriber Revenue ticks, opportunity
bookkeeping, shop refreshes, nutrition counters, command receipts, and other
internal mechanics. There is no attention-call system or separate offline
recap.

Every terminal Ending keeps its causal Journey and full narrated Journey
available. Death alone uses graveyard language and lists every structured
Health-loss cause. Quit Streaming and Financial Ruin use a neutral archived-run
card with trigger evidence. Made It remains visible as an earned non-terminal
unlock. The Markdown export records the exact terminal Ending, causal chain,
and complete Journey; Death causes are never inferred by parsing narration
text.

## Modifier arithmetic reference

`+` adds the stated amount, `−` subtracts it, and `×` multiplies the value to
its left. Metric changes are applied to the current metric and then clamped:
Health stays from 0 through 40, while Food, Mood, Rest, Bond, and Creativity
stay from 0 through 10. Current Subscribers cannot fall below 0. Balance has no
lower clamp.

Unless a rule below explicitly says that a modifier affects another reward,
it does not. In particular, Subscriber Revenue multipliers do not multiply
stream income, donations, or Subscriber gains; discovery multipliers do not
multiply Clippers, donations, model rewards, or other direct Subscriber
awards; and donation-chance multipliers do not multiply donation cash or the
Subscribers attached to a donation.

### Subscriber arithmetic

| Source                          | Exact change or formula                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Natural two-hour tick           | `round((current tier rate + full stream contributions + discounted stream contributions) × active discovery multipliers)`  |
| One stream contribution         | `tier rate at stream start × (1 + Creativity at stream start × 0.02)` for seven days                                       |
| Full stream contributions       | The oldest four active stream contributions each count at `×1`                                                             |
| Discounted stream contributions | Every later active stream contribution counts at `×0.25`                                                                   |
| Algorithm Boost                 | Natural audience total `×1.5` for 24 hours                                                                                 |
| Agency discovery                | Natural audience total `×1.5` for 168 hours                                                                                |
| Both discovery boosts           | `×1.5 ×1.5 = ×2.25` natural audience growth                                                                                |
| Clippers                        | `+50 × current career-tier ordinal × active stacks`, immediately for the first stack and then every 24 hours before expiry |
| Kind supporter or Raid windfall | `+5` Subscribers                                                                                                           |
| Major or Legendary donor        | `+5 +25 = +30` Subscribers                                                                                                 |
| Model project completion        | `+50` Subscribers                                                                                                          |
| Agency invitation               | `+100,000` Subscribers once                                                                                                |
| Twitter cancellation            | `−1%`, `−2%`, or `−3%` of current Subscribers, rounded once, with a minimum loss of 1 and no result below 0                |

The peak-Subscriber ladder supplies both the current natural-growth tier rate
and the permanent Subscriber Revenue multiplier:

| Peak Subscribers | Career tier           | Natural rate per two-hour tick | Subscriber Revenue |
| ---------------: | --------------------- | -----------------------------: | -----------------: |
|              100 | Debut                 |                             +1 |                 ×1 |
|              150 | First Model           |                             +2 |                 ×1 |
|            1,000 | 1K                    |                            +10 |                 ×1 |
|            5,000 | Model Redesign        |                            +20 |                 ×1 |
|           10,000 | Twitch Partner        |                            +60 |                 ×1 |
|           30,000 | 30K                   |                            +80 |               ×1.5 |
|           40,000 | Tournament Appearance |                           +100 |               ×1.5 |
|           50,000 | 50K                   |                           +150 |                 ×2 |
|           75,000 | Convention Guest      |                           +200 |                 ×2 |
|          100,000 | 100K                  |                           +300 |                 ×3 |
|          150,000 | 3D Ready              |                           +400 |                 ×3 |
|          200,000 | 200K                  |                           +500 |                 ×4 |
|          250,000 | 250K                  |                         +1,000 |                 ×5 |
|          500,000 | 500K                  |                         +2,000 |                 ×7 |
|        1,000,000 | 1M                    |                         +2,000 |                ×10 |

Natural growth is rounded only after the tier baseline, all stream
contributions, the `×0.25` discounts, and all active discovery multipliers have
been combined. Direct Subscriber changes can unlock several milestones in one
operation. Peak Subscribers becomes `max(old peak, current Subscribers)` and
never decreases, so unlocked tiers, stream-rate bands, and Subscriber Revenue
multipliers are never revoked by a later Subscriber loss.

The career-tier ordinal used by Clippers is the tier's position in the full
career ladder: Debut is 1, First Model is 2, 1K is 3, through 1M as 15. For
example, two active stacks at the 1K tier award
`50 × 3 × 2 = 300` Subscribers per publication.

### Stream and donation arithmetic

| Result                                       | Exact modifier order                                                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary stream selection weight             | `max(0, 50 × seeded roll + 25 × ((Mood − 5) / 5) + 25 × ((Creativity − 5) / 5) + nutrition bonus + drought bonus) × daypart × special date` |
| Daypart                                      | `×0.5` from 04:00–08:59, `×1.5` from 13:00–19:59, otherwise `×1`                                                                            |
| June 29 or November 14 stream selection      | Final ordinary stream weight `×2`                                                                                                           |
| Stream cash income                           | `round(hourly rate × elapsed hours × (0.5 + Creativity / 10))`                                                                              |
| Donation hit chance per completed whole hour | `min(100%, (2% + Creativity × 0.5% + final-model bonus) × special-date modifier × queued-stream modifier)`                                  |
| Fourth-model donation bonus                  | `+1` percentage point inside the base donation chance                                                                                       |
| June 29 or November 14 donation chance       | `×3` chance                                                                                                                                 |
| Tournament donation chance                   | A separate `×3` chance, stacking with a special date                                                                                        |

The hourly rate is one seeded whole-dollar value from the highest permanently
unlocked band: $5–$15 initially, $8–$18 after 1K peak Subscribers, or $10–$22
after 10K peak Subscribers. Creativity therefore changes stream income through
the `(0.5 + Creativity / 10)` multiplier: `×0.5` at Creativity 0, `×1` at 5,
and `×1.5` at 10. Interrupted streams use their actual elapsed time for income
and still roll once for each completed whole hour.

After a successful donation roll, its tier selects the cash and direct
Subscriber award shown in the donation table above. The `×3` modifiers affect
only whether a donation occurs. A Kind supporter remains $20–$60 and +5
Subscribers, for example; its amount is not tripled.

### Balance and economic arithmetic

The general cash equation is:

```text
new Balance = old Balance + all income − all expenses
```

| Operation                         | Exact Balance change                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Shop checkout                     | `− sum(item price × purchased quantity)`                                                                                        |
| Open Line of Credit               | `−$50 + $10,000 = +$9,950` atomically                                                                                           |
| Repay Line of Credit              | `−$600 × repayment units`                                                                                                       |
| Close Line of Credit from opening | Twenty units cost `$600 × 20 = $12,000`; including the $50 opening price and $10,000 advance, the complete net cost is `$2,050` |
| Subscriber Revenue                | `+round($1 × highest unlocked Subscriber Revenue multiplier)` every two hours                                                   |
| Stream completion                 | `+round(hourly rate × elapsed hours × (0.5 + Creativity / 10))`, plus each donation's actual amount                             |
| Commission Work                   | `+$40 + ($15 × starting Creativity)`                                                                                            |
| Full-body commission              | `+$400` through `+$800`, seeded uniformly in whole dollars                                                                      |
| Off-stream support                | `+$5` through `+$15`, seeded uniformly in whole dollars                                                                         |
| Sponsored-stream deal             | `+$250` through `+$2,000`, seeded uniformly in whole dollars                                                                    |
| Convention milestone              | `+$500` once                                                                                                                    |
| Personal purchase                 | `− real catalogue price` for the one selected affordable item                                                                   |
| Tax bill                          | `−$100` through `−$1,000`, seeded uniformly in whole dollars                                                                    |
| Equipment Failure                 | `−$30` through `−$500`, seeded uniformly in whole dollars, independently of the selected PC-related item                        |
| Hospital daily payment            | `−min(scheduled payment, remaining principal, max(0, Balance))`                                                                 |
| Pay all medical debt              | `−ceil(total remaining principal × 0.85)`                                                                                       |

The permanent Subscriber Revenue multiplier uses the highest unlocked peak-
Subscriber band and replaces the prior multiplier: `×1`, `×1.5`, `×2`, `×3`,
`×4`, `×5`, `×7`, or `×10`. It does not stack across milestones. Because each
two-hour payment is rounded separately, `$1 ×1.5` pays $2 per tick.

Catalogue checkout can take Balance below $0. Tax and Equipment Failure can
also cross from a nonnegative Balance into debt, but neither is eligible while
Balance is already negative. A personal purchase is selected only when its
real price is no greater than current Balance, so it cannot create debt.
Hospital daily payments stop at $0, full medical payoff requires enough
starting Balance, and LOC repayments require starting Balance to cover the LOC
repayment portion. Opening the LOC is the exception: its $50 price and $10,000
advance settle together even when starting Balance is below $50.

Positive income always adds directly to Balance, reducing negative cash before
making Balance positive. It does not automatically reduce Hospital principal
or remaining LOC units. `In Debt` is determined only by `Balance < $0`, and
Financial Ruin checks only an actual Balance crossing to `−$20,000` or below;
unpaid principal and remaining LOC units are not added to that threshold.
