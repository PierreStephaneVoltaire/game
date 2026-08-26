# 60-Day Health, Career, Event, and Kidney Stone Diagnosis

Date: 2026-08-24

This report diagnoses the current game without changing production rules. It
uses the real seeded engine, the bundled catalogue, Health 40, starting Health
32, critical Health 1–8, and a hard stop at death or 60 game-days.

The complete income and spending ledger is in the
[economy appendix](./60_DAY_BALANCE_ECONOMY.md).

## Question

Can goal-directed human players stay alive while reaching approximately 250K
subscribers under casual play, 500K under subscriber-focused but imperfect
play, and 1M under optimal play, without making neglect harmless? Which random
events, health rules, money sources, and Kidney Stone responses determine the
outcome?

## Profiles and method

Fifty baseline runs were used:

- 18 Casual: three to six scheduled check-ins per day, care thresholds Food 4,
  Rest 4, Mood 3, a nine-point food reserve, basic Clippers/model progression,
  and a Creativity target of 6.
- 12 Subscriber-focused: four to six scheduled check-ins per day, the same
  danger floor, a ten-point food reserve, more consistent career spending, two
  desired Clipper stacks, and Creativity target 8.
- 10 Optimal: a scheduled check every two hours, proactive thresholds Food 6,
  Rest 6, Mood 4, a sixteen-point food reserve, immediate career progression,
  three desired Clipper stacks, Creativity target 9, and informed medical care.
- 10 50%-neglect controls: three to six scheduled check-ins per day but every
  other visit was skipped. These players still pursued survival and career
  goals when present. Every run skipped at least 50% of scheduled visits.

A check-in could perform several instant shop/feed/item actions before starting
one timed activity, matching a human session rather than one click per visit.
Checks landing during an activity were counted as busy checks. Actual attended
care sessions averaged 3.40/day Casual, 3.54/day Focused, 5.66/day Optimal, and
about 2/day in the neglect controls.

Every run recorded milestone times, subscriber sources, stream starts and
hours, income, purchases, random-event selections, metric impacts, status
exposure, damage, risky feeds, and individual Kidney Stone episodes.

## Main result

| Profile            | Runs | Survived 60d | Hit requested target | Median subs, all runs | Median subs, survivors | Median target day | Median completed streams |
| ------------------ | ---: | -----------: | -------------------: | --------------------: | ---------------------: | ----------------: | -----------------------: |
| Casual / 250K      |   18 |      9 (50%) |              8 (44%) |               228,976 |                716,769 |             48.83 |                       17 |
| Focused / 500K     |   12 |      7 (58%) |              6 (50%) |               715,263 |                979,139 |             53.67 |                       20 |
| Optimal / 1M       |   10 |    10 (100%) |            10 (100%) |             7,799,361 |              7,799,361 |             38.50 |                       76 |
| 50%-neglect / 250K |   10 |            0 |                    0 |                   192 |                      — |                 — |                        0 |

The requested progression targets are already reachable. The low all-run Casual
result is caused by death, not weak subscriber growth: surviving Casual runs
have a 716,769 median. Focused survivors also exceed 500K. Optimal growth is
approximately 7.8 times the requested 1M endpoint and reaches 1M around day 38,
far before day 60.

The skill gradient remains lethal. Every 50%-neglect run died between day 2.92
and day 15.06, with a median of day 5.39. Health 40 does not make neglect safe.

## Milestone timing

| Profile                             |    1K |   10K |  100K |  250K |  500K |    1M |
| ----------------------------------- | ----: | ----: | ----: | ----: | ----: | ----: |
| Casual: runs reaching it            |    18 |    14 |    11 |     8 |     6 |     4 |
| Casual: median day among achievers  | 10.00 | 26.58 | 44.50 | 48.83 | 54.75 | 59.25 |
| Focused: runs reaching it           |    11 |    10 |     9 |     7 |     6 |     3 |
| Focused: median day among achievers |  8.83 | 22.42 | 42.58 | 47.83 | 53.67 | 50.17 |
| Optimal: runs reaching it           |    10 |    10 |    10 |    10 |    10 |    10 |
| Optimal: median day                 |  6.17 | 13.58 | 26.17 | 30.50 | 34.08 | 38.50 |

## Why subscriber totals diverge

Across all 50 runs, final subscriber counts totaled 91,976,061:

- Natural audience growth supplied 91,779,931, or **99.79%**.
- Clippers supplied 182,900, or **0.20%**.
- Donations recorded 3,380 subscriber awards; model rewards supplied the small
  remaining difference.

Median active seven-day stream-boost load, estimated from stream starts, was
2.9 for Casual, 3.6 for Focused, and 9.3 for Optimal. Each boost contributes a
full tier rate and all boosts stack. The large Optimal result is therefore a
stacking problem, not a lack of income sources or Clippers.

Clippers at 50 subscribers per tier per stack are numerically decorative beside
natural growth. Median Clipper contribution was 750 Casual, 3,800 Focused, and
9,900 Optimal.

## Tested rate counterfactual

A second real-engine run preserved all rates through 200K but changed the
250K, 500K, and 1M natural-audience tier rates from 1,000/2,000/2,000 to
500/500/500. No production data was changed.

| Profile        | Baseline survivor median | Flat-500 survivor median | Flat-500 target hits | Flat-500 median target day |
| -------------- | -----------------------: | -----------------------: | -------------------: | -------------------------: |
| Casual / 250K  |                  716,769 |                  468,919 |                 8/18 |                      48.83 |
| Focused / 500K |                  979,139 |                  596,034 |                 5/12 |                      49.92 |
| Optimal / 1M   |                7,799,361 |                2,426,031 |                10/10 |                      42.58 |

Flattening high-tier rates protects the Casual path and brings Focused close to
the requested endpoint, but Optimal still overshoots because it carries about
9.3 simultaneous boosts. A single global multiplier cannot produce the desired
250K/500K/1M separation.

Recommended numbers for the next implementation experiment:

- Keep current tier rates through 200K.
- Set 250K, 500K, and 1M tier rates to **500 per two-hour tick**.
- Cap simultaneous seven-day stream contributions at **4**. Casual and Focused
  medians are below four; this primarily limits Optimal stacking.
- If Clippers should be a meaningful secondary system, test
  `followersPerTierPerStack` at **250** instead of 50. This is a fivefold change,
  but remains much smaller than natural growth after the high-tier flattening.

The flat-500 values were engine-tested. The four-boost cap is an inference from
the measured 2.9/3.6/9.3 active-load split and needs its own test if implemented.

## Survival and damage

Twenty-four of 50 runs died. Terminal causes can overlap:

- Starvation: 19 deaths and 2,275 total Health damage.
- Depression: 11 deaths and 230 total Health damage.
- Sleep deprivation: 8 deaths and 854 total Health damage.
- Kidney Stone complications: 317 total Health damage, but not the terminal
  cause in the final exact-neglect cohort.
- Sickness: 3 Health damage.

Casual deaths occurred at a median day 25.57 and Focused deaths at day 25.75.
The system is not too forgiving at Health 40. Adding more Health conditions now
would attack the wrong side of the balance. Starvation is the dominant failure,
even for players scheduling three to six visits daily.

If Casual survival should exceed 50% without protecting neglect, the first
numeric experiment should be Food decay probability **0.65 instead of 0.75**.
That changes expected awake decay from 9 to 7.8 Food/day while leaving the
50%-neglect cohort far from safe. This number is a recommendation, not an
engine-tested counterfactual in this report.

## Random events: weights, frequency, and impact

The study recorded 42,802 weighted opportunities across 2,063 run-days, or 20.7
opportunities/day. More user actions create more attempt-owned opportunities.

| Selected candidate   | Configured weight | Selections |  Share | Approx. selections/day | Recorded direct impact                                             |
| -------------------- | ----------------: | ---------: | -----: | ---------------------: | ------------------------------------------------------------------ |
| None                 |               100 |     30,406 | 71.04% |                  14.74 | No visible event                                                   |
| Benign room          |                10 |      2,584 |  6.04% |                   1.25 | Narration only                                                     |
| Stream               |           Dynamic |      2,412 |  5.64% |                   1.17 | 1,514 actual starts; blockers/tired candidates prevent some starts |
| Creative inspiration |                15 |      2,252 |  5.26% |                   1.09 | Creativity +2,215 after clamping                                   |
| Food craving         |                20 |      2,185 |  5.10% |                   1.06 | Enables Bond reward on fulfillment                                 |
| Off-stream support   |                10 |      1,782 |  4.16% |                   0.86 | $17,721 total; $9.94 average                                       |
| Autonomous nap       |   40 when Rest ≤2 |        699 |  1.63% |                   0.34 | Starts protective Rest                                             |
| Rest snoring         |  10 when eligible |        264 |  0.62% |                   0.13 | Narration only                                                     |
| Mom's Care Package   |   5 when eligible |        157 |  0.37% |                   0.08 | Two foods and Mood +157 total                                      |
| Low-money stress     |  20 when eligible |         61 |  0.14% |                   0.03 | Mood −61 total                                                     |

Non-pool Sugar Crash occurred 1,213 times: about 0.59/day, causing Mood −2,426
and Rest −1,213 in total. It is one of the most frequent harmful patterns in the
logs and materially increases stream blocking and care pressure.

The supplied `docs/log.md` shows the same pattern: 21 benign events, 19 creative
inspirations, 14 off-stream support payments, 34 Hungry notices, 19 Starving
notices, 19 Sleep Deprived notices, six Starvation damage events, and five Sleep
Deprivation damage events. Visible benign/inspiration events are frequent, but
the harmful pattern is repeated need collapse and Sugar Crash rather than one
high-weight hostile random candidate.

## Kidney Stone findings

The 50 final runs contained 15,032 successful manual feeds. A total of 1,083
feeds were in the risky rolling-window condition and produced 56 onsets, an
observed **5.17% per risky feed**. The configured 5% roll is working correctly.
The problem is how often play remains eligible for repeated rolls.

- 30/50 runs had at least one stone.
- The median onset was hour 612 (day 25.5); the earliest was hour 32.
- 12/56 onsets happened in the first 14 days.
- Onset-window salt ranged 8–20, with median 12.
- Raising the salt threshold from 8 to 10 would have excluded 13/56 observed
  onset windows. Raising it to 12 would have excluded 24/56, assuming player
  behavior remained unchanged.
- There were 261 unsuppressed recurrence penalties, each Health −1 and Rest −1.
- 32 episodes passed naturally, 17 cleared by Hospital, and seven remained
  active at death or the day-60 cap.

The triggering item is only the feed on which the roll occurs. It need not be
salty. Stones triggered on Five Plain Tortillas, Waffle, Lettuce, Lollipop,
Uncrustables, Sour cream, and other apparently harmless foods because earlier
feeds supplied the rolling salt total. This is likely confusing without a clear
rolling-risk indicator.

### Response comparison

| Response                     | Runs | Runs with stone | Episodes | Recurrences | Survived 60d | Hospital spend |
| ---------------------------- | ---: | --------------: | -------: | ----------: | -----------: | -------------: |
| Unaware                      |    8 |               6 |       10 |          75 |            5 |             $0 |
| Instinctive hydration        |    9 |               1 |        1 |           5 |            6 |             $0 |
| Hydrate, pain relief, wait   |    9 |               7 |       18 |         106 |            5 |             $0 |
| Delayed Hospital             |    7 |               5 |        8 |          15 |            0 |        $70,000 |
| Immediate Hospital           |    7 |               5 |       10 |           1 |            0 |        $62,000 |
| Optimal prevention/treatment |   10 |               6 |        9 |          59 |           10 |             $0 |

The instinctive group includes two exact-neglect controls; among the seven
non-neglect instinctive runs, six survived and only one developed a stone.
Regular Water is highly effective when feeds are not extremely frequent.

Every non-neglect run that actually used Hospital died later. Hospital removes
the active status but leaves the ten-feed risk window intact. Eight post-Hospital
re-onsets were observed; six happened 0–56 hours after clearance, including two
at the exact completion timestamp and three after 12 hours. One run paid
$30,500 across four visits.

The $10,000 uninsured bill also overwhelms normal 60-day earnings. Hospital
users commonly died later from Starvation/Sleep Deprivation while deeply in
debt. Even the one $500 insured visit did not guarantee survival, and insurance
is consumed after one claim while immediate re-onset remains possible.

Recommended Kidney Stone experiments, in order:

1. On Hospital completion, clear the ten-feed Kidney Stone risk window. This is
   more directly related to the observed failure than adding a generic cooldown.
2. Keep the 5% roll. It measured 5.17%; the probability implementation is not
   inflated.
3. If onset frequency is still too high, test salt threshold **10**. It would
   remove roughly 23% of the observed qualifying onset windows without making
   hydration irrelevant.
4. If waiting should be less punishing, test natural passage every **48 hours at
   50%** instead of every 72 hours. Expected duration falls from 144 to 96 hours.
5. Expose rolling salt/water risk and item tags clearly. Water-aware play was
   the most effective non-Hospital response.

## Detailed run appendix

The aggregate above covers all 50 runs. The Kidney Stone appendix below lists
every affected run individually because response behavior is a central diagnosis.

## Every run with a Kidney Stone

| Run        | Response         | Episodes | Recurrences | Natural clears | Hospital clears | Hospital spend | Outcome      |
| ---------- | ---------------- | -------: | ----------: | -------------: | --------------: | -------------: | ------------ |
| casual-01  | Unaware          |        1 |          11 |              1 |               0 |             $0 | Died d44.625 |
| casual-03  | Wait             |        3 |          13 |              3 |               0 |             $0 | Survived     |
| casual-04  | Delayed Hospital |        1 |           2 |              0 |               1 |        $10,000 | Died d24.667 |
| casual-05  | Hospital         |        1 |           0 |              0 |               1 |           $500 | Died d13.990 |
| casual-06  | Unaware          |        3 |          32 |              2 |               0 |             $0 | Survived     |
| casual-08  | Wait             |        4 |          22 |              3 |               0 |             $0 | Survived     |
| casual-09  | Delayed Hospital |        1 |           2 |              0 |               1 |        $10,000 | Died d13.573 |
| casual-10  | Hospital         |        4 |           1 |              0 |               4 |        $30,500 | Died d22.313 |
| casual-11  | Unaware          |        2 |          10 |              2 |               0 |             $0 | Survived     |
| casual-13  | Wait             |        2 |          19 |              1 |               0 |             $0 | Died d57.813 |
| casual-14  | Delayed Hospital |        1 |           2 |              0 |               1 |        $10,000 | Died d25.573 |
| casual-15  | Hospital         |        2 |           0 |              0 |               2 |        $10,500 | Died d26.681 |
| casual-16  | Unaware          |        2 |          16 |              2 |               0 |             $0 | Survived     |
| casual-18  | Wait             |        2 |          26 |              2 |               0 |             $0 | Survived     |
| focused-01 | Instinctive      |        1 |           5 |              1 |               0 |             $0 | Survived     |
| focused-02 | Wait             |        3 |          11 |              3 |               0 |             $0 | Survived     |
| focused-03 | Delayed Hospital |        3 |           5 |              0 |               2 |        $20,000 | Died d25.750 |
| focused-04 | Hospital         |        2 |           0 |              0 |               2 |        $10,500 | Died d13.521 |
| focused-05 | Unaware          |        1 |           1 |              0 |               0 |             $0 | Survived     |
| focused-07 | Wait             |        2 |           5 |              1 |               0 |             $0 | Died d52.229 |
| focused-08 | Delayed Hospital |        2 |           4 |              0 |               2 |        $20,000 | Died d57.919 |
| focused-09 | Hospital         |        1 |           0 |              0 |               1 |        $10,000 | Died d5.427  |
| focused-10 | Unaware          |        1 |           5 |              1 |               0 |             $0 | Survived     |
| focused-12 | Wait             |        2 |          10 |              2 |               0 |             $0 | Survived     |
| optimal-02 | Optimal          |        1 |           9 |              1 |               0 |             $0 | Survived     |
| optimal-06 | Optimal          |        1 |           4 |              1 |               0 |             $0 | Survived     |
| optimal-07 | Optimal          |        1 |           5 |              1 |               0 |             $0 | Survived     |
| optimal-08 | Optimal          |        2 |          13 |              2 |               0 |             $0 | Survived     |
| optimal-09 | Optimal          |        3 |          25 |              2 |               0 |             $0 | Survived     |
| optimal-10 | Optimal          |        1 |           3 |              1 |               0 |             $0 | Survived     |

## Verdict

The current game is not failing because casual subscriber income is too low.
It is failing because ordinary goal-directed players have a high chance of
dying before the compounding curve activates, while successful Optimal play
overshoots 1M by millions.

The next balance pass should separate those concerns:

1. Improve ordinary survival reliability, starting with Food pressure rather
   than adding more Health conditions.
2. Remove the Hospital → unchanged risk window → repeat bill loop.
3. Flatten natural growth after 200K and cap simultaneous stream boosts.
4. Make Clippers materially visible only after the natural-growth curve is
   controlled.
