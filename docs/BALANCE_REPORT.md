# 60-Day Health, Career, Event, Nutrition, and Economy Diagnosis

Policy contract: canonical 50-run balance study v2

This report is generated from the real seeded engine. It contains 18 Casual,
12 Focused, 10 Optimal, and 10 exact 50%-neglect runs, stopped at death or 60
game-days. The complete validator-compatible ledger is in
[BALANCE_RESULTS.json](./BALANCE_RESULTS.json).

## Question and profile contract

Can goal-directed players stay alive while reaching approximately 250K
subscribers under Casual play, 500K under Focused play, and 1M under Optimal
play without making exact 50% neglect safe?

- Casual schedules 3–6 checks/day, responds at Food/Rest 4 and Mood 3, keeps a
  nine-food inventory reserve, seeks one Clipper stack, model progression, and
  Creativity 6.
- Focused schedules 4–6 checks/day, keeps ten food, seeks two Clipper stacks,
  model progression, and Creativity 8.
- Optimal checks every two hours, responds at Food/Rest 6 and Mood 4, keeps 16
  food, seeks three Clipper stacks, model progression, Creativity 9, and
  proactively manages nutrition risk.
- Neglect retains the Casual goals, skips every second scheduled visit, and
  buys food only when immediate care requires it instead of stockpiling.
- Kidney Stone responses rotate through unaware, instinctive hydration,
  symptom management, delayed Hospital, and immediate Hospital. Optimal uses
  informed prevention and treats critically only when necessary.

## Main result

| Profile / target | Runs |    Survived |  Target hit | Median subs, all | Survivor median | Median target day | Median death day |
| ---------------- | ---: | ----------: | ----------: | ---------------: | --------------: | ----------------: | ---------------: |
| Casual / 250K    |   18 | 18 (100.0%) |  17 (94.4%) |        1,042,932 |       1,042,932 |             47.92 |                — |
| Focused / 500K   |   12 | 12 (100.0%) |  11 (91.7%) |        1,695,469 |       1,695,469 |             50.42 |                — |
| Optimal / 1M     |   10 | 10 (100.0%) | 10 (100.0%) |        3,793,501 |       3,793,501 |             44.83 |                — |
| Neglect / 250K   |   10 |   2 (20.0%) |    0 (0.0%) |           13,542 |         159,952 |                 — |            25.00 |

Managed survival is 100.0%; exact-neglect survival is
20.0%. Progression failure and premature death are reported
separately: survivor medians are never substituted for all-run medians.

## Milestone timing

| Profile                |    1K |   10K |  100K |  250K |  500K |    1M |
| ---------------------- | ----: | ----: | ----: | ----: | ----: | ----: |
| Casual: runs reaching  |    18 |    18 |    17 |    17 |    13 |     9 |
| Casual: median day     |  9.42 | 22.75 | 39.42 | 47.92 | 52.75 | 57.25 |
| Focused: runs reaching |    12 |    12 |    12 |    11 |    11 |     9 |
| Focused: median day    |  7.71 | 20.46 | 37.13 | 45.17 | 50.42 | 54.92 |
| Optimal: runs reaching |    10 |    10 |    10 |    10 |    10 |    10 |
| Optimal: median day    |  6.13 | 16.23 | 30.13 | 36.38 | 40.75 | 44.83 |
| Neglect: runs reaching |     7 |     5 |     2 |     0 |     0 |     0 |
| Neglect: median day    | 13.50 | 30.42 | 54.63 |     — |     — |     — |

## Subscriber sources and stream pressure

| Profile | Natural growth | Clippers | Donation followers | Model rewards | Other | Median active boost load |
| ------- | -------------: | -------: | -----------------: | ------------: | ----: | -----------------------: |
| Casual  |     17,533,189 |  109,000 |              1,610 |         2,650 | 1,800 |                     4.00 |
| Focused |     17,541,638 |  149,500 |              1,265 |         2,000 | 1,200 |                     5.00 |
| Optimal |     37,243,600 |  221,800 |              2,705 |         2,000 | 1,000 |                    12.50 |
| Neglect |        443,663 |        0 |                210 |           450 | 1,000 |                     2.00 |

Across all runs, 2,435 streams
started, 2,001 completed,
434 were interrupted,
and exact stream time was 9378.05
hours. Audience ticks recorded
106,594
full-value boost contributions and
84,091
discounted contributions; the largest active load was 22.
The follower table separates natural growth, Clippers, donations, model rewards,
and any residual source; it does not infer growth from final totals.

## Survival, statuses, and damage

| Damage source     | Raw need damage | Applied Health damage | Terminal cause appearances |
| ----------------- | --------------: | --------------------: | -------------------------: |
| starving          |           1,787 |                 1,787 |                          7 |
| sleep_deprived    |             733 |                   733 |                          7 |
| kidney_stone      |               0 |                   618 |                          0 |
| depressed         |             112 |                    99 |                          0 |
| stood_up_too_fast |               0 |                    27 |                          0 |
| sick              |               0 |                    23 |                          0 |

| Status         | Exposure hours |
| -------------- | -------------: |
| hungry         |       26405.35 |
| sleep_deprived |       12565.05 |
| low_energy     |        8520.30 |
| kidney_stone   |        8289.30 |
| starving       |        5651.85 |
| dizzy_spell    |        4916.45 |
| creative_block |        1149.35 |
| depressed      |         761.55 |
| overstimulated |         731.35 |
| full           |         206.00 |
| sick           |          26.00 |

Sugar Crash produced 744
actual crashes after 791
warnings; 215 pending
crashes were averted. Recorded crash deltas total Mood
-1,488 and Rest
-744.

## Weighted events and direct impact

The study recorded 58,558 weighted opportunities across
2739.6 run-days, or
21.37 opportunities/day. Configured weight
is shown beside observed selection frequency and direct ledger impact; weights
are not unconditional probabilities because eligibility and cooldowns alter
the pool.

| Candidate            | Configured weight | Selections | Share | Recorded direct impact |
| -------------------- | ----------------: | ---------: | ----: | ---------------------- |
| none                 |               100 |     40,402 | 69.0% | Narration/state only   |
| stream               |           Dynamic |      3,790 |  6.5% | Narration/state only   |
| benign_room_event    |  Authored/dynamic |      3,434 |  5.9% | Narration/state only   |
| creative_inspiration |                15 |      2,931 |  5.0% | creativity +2,906      |
| food_craving         |                20 |      2,468 |  4.2% | Narration/state only   |
| off_stream_support   |  Authored/dynamic |      2,377 |  4.1% | $+23,872               |
| self_entertainment   |                 5 |        854 |  1.5% | mood +854              |
| tiny_walk            |                 3 |        582 |  1.0% | mood +582              |
| stood_up_too_fast    |                 3 |        578 |  1.0% | rest -123, health -27  |
| barely_moved_today   |                 3 |        501 |  0.9% | mood -501              |
| rest_snoring         |                10 |        361 |  0.6% | Narration/state only   |
| moms_care_package    |                 5 |        190 |  0.3% | mood +190              |
| low_money_stress     |                20 |         90 |  0.2% | mood -90               |

### Seeded authored outcomes

| Outcome ID | Selections |
| ---------- | ---------: |
| brief      |        428 |
| rough      |        123 |
| stumble    |         27 |

## Autonomous rescue

| Profile | Food rescues | Rest rescues | Blocked attempts | Survived |
| ------- | -----------: | -----------: | ---------------: | -------: |
| Casual  |          609 |          226 |              222 |    18/18 |
| Focused |          331 |          118 |               76 |    12/12 |
| Optimal |            5 |           11 |                0 |    10/10 |
| Neglect |           23 |          145 |              740 |     2/10 |

| Rescue block reason                     | Count |
| --------------------------------------- | ----: |
| no_eligible_owned_food                  |   568 |
| rescue_locked                           |   469 |
| ordinary_consumption_did_not_raise_food |     1 |

Food and Rest rescues remain separately locked. The Neglect row is the
important safety check: rescue frequency must be interpreted beside survival,
not as evidence that autonomy can maintain a run indefinitely.

## Kidney Stone and Hospital response

The cohort recorded 17,654 successful feeds, including
16,686 player-commanded feeds,
2,231 qualifying risky feeds,
103 onsets, and 515 recurrences.
44/50 runs experienced an onset. Among completed
episodes, 65 cleared naturally and
33 cleared through Hospital; 5
remained active at death or the horizon.

| Response         | Runs | Runs with stone | Onsets | Recurrences | Natural clears | Hospital clears | Survived | Medical payments |
| ---------------- | ---: | --------------: | -----: | ----------: | -------------: | --------------: | -------: | ---------------: |
| unaware          |    9 |               7 |     17 |         162 |             16 |               0 |        7 |               $0 |
| instinctive      |    9 |               9 |     18 |         133 |             17 |               0 |        7 |               $0 |
| wait             |    8 |               8 |     22 |         130 |             20 |               0 |        7 |               $0 |
| delayed_hospital |    7 |               7 |     16 |          26 |              0 |              16 |        6 |          $26,036 |
| hospital         |    7 |               6 |     17 |           1 |              0 |              17 |        5 |          $21,477 |
| optimal          |   10 |               7 |     13 |          63 |             12 |               0 |       10 |               $0 |

### Every affected run

| Run        | Response         | Onsets | Recurrences | Natural clears | Hospital clears | Payments | Principal | Outcome     |
| ---------- | ---------------- | -----: | ----------: | -------------: | --------------: | -------: | --------: | ----------- |
| casual-01  | unaware          |      3 |          25 |              3 |               0 |       $0 |        $0 | Survived    |
| casual-02  | instinctive      |      4 |          36 |              4 |               0 |       $0 |        $0 | Survived    |
| casual-03  | wait             |      4 |          27 |              4 |               0 |       $0 |        $0 | Survived    |
| casual-04  | delayed_hospital |      2 |           4 |              0 |               2 |   $6,200 |    $4,300 | Survived    |
| casual-05  | hospital         |      2 |           0 |              0 |               2 |   $1,675 |    $8,825 | Survived    |
| casual-06  | unaware          |      1 |           7 |              1 |               0 |       $0 |        $0 | Survived    |
| casual-07  | instinctive      |      1 |           3 |              1 |               0 |       $0 |        $0 | Survived    |
| casual-08  | wait             |      3 |          30 |              2 |               0 |       $0 |        $0 | Survived    |
| casual-09  | delayed_hospital |      3 |           5 |              0 |               3 |   $5,205 |   $24,795 | Survived    |
| casual-10  | hospital         |      5 |           0 |              0 |               5 |   $4,711 |   $45,289 | Survived    |
| casual-11  | unaware          |      3 |          29 |              3 |               0 |       $0 |        $0 | Survived    |
| casual-12  | instinctive      |      2 |          10 |              2 |               0 |       $0 |        $0 | Survived    |
| casual-13  | wait             |      4 |          14 |              4 |               0 |       $0 |        $0 | Survived    |
| casual-14  | delayed_hospital |      5 |           9 |              0 |               5 |   $4,200 |    $7,800 | Survived    |
| casual-15  | hospital         |      2 |           0 |              0 |               2 |   $2,900 |    $7,600 | Survived    |
| casual-16  | unaware          |      1 |          11 |              1 |               0 |       $0 |        $0 | Survived    |
| casual-17  | instinctive      |      2 |           6 |              2 |               0 |       $0 |        $0 | Survived    |
| casual-18  | wait             |      3 |           7 |              2 |               0 |       $0 |        $0 | Survived    |
| focused-01 | unaware          |      6 |          41 |              5 |               0 |       $0 |        $0 | Survived    |
| focused-02 | instinctive      |      3 |          13 |              3 |               0 |       $0 |        $0 | Survived    |
| focused-03 | wait             |      1 |          11 |              1 |               0 |       $0 |        $0 | Survived    |
| focused-04 | delayed_hospital |      1 |           1 |              0 |               1 |     $500 |        $0 | Survived    |
| focused-05 | hospital         |      2 |           0 |              0 |               2 |   $6,604 |    $3,896 | Survived    |
| focused-06 | unaware          |      2 |          38 |              2 |               0 |       $0 |        $0 | Survived    |
| focused-07 | instinctive      |      3 |          49 |              3 |               0 |       $0 |        $0 | Survived    |
| focused-08 | wait             |      3 |          12 |              3 |               0 |       $0 |        $0 | Survived    |
| focused-09 | delayed_hospital |      3 |           3 |              0 |               3 |   $6,250 |    $4,750 | Survived    |
| focused-10 | hospital         |      5 |           0 |              0 |               5 |   $5,360 |   $44,640 | Survived    |
| focused-11 | unaware          |      1 |          11 |              1 |               0 |       $0 |        $0 | Survived    |
| focused-12 | instinctive      |      1 |           3 |              1 |               0 |       $0 |        $0 | Survived    |
| optimal-01 | optimal          |      1 |           3 |              1 |               0 |       $0 |        $0 | Survived    |
| optimal-02 | optimal          |      3 |          21 |              3 |               0 |       $0 |        $0 | Survived    |
| optimal-03 | optimal          |      2 |           6 |              1 |               0 |       $0 |        $0 | Survived    |
| optimal-04 | optimal          |      1 |           4 |              1 |               0 |       $0 |        $0 | Survived    |
| optimal-05 | optimal          |      2 |           8 |              2 |               0 |       $0 |        $0 | Survived    |
| optimal-09 | optimal          |      2 |          15 |              2 |               0 |       $0 |        $0 | Survived    |
| optimal-10 | optimal          |      2 |           6 |              2 |               0 |       $0 |        $0 | Survived    |
| neglect-02 | instinctive      |      1 |           3 |              1 |               0 |       $0 |        $0 | Died d38.56 |
| neglect-03 | wait             |      2 |           5 |              2 |               0 |       $0 |        $0 | Died d44.08 |
| neglect-04 | delayed_hospital |      1 |           2 |              0 |               1 |   $3,533 |    $6,467 | Survived    |
| neglect-05 | hospital         |      1 |           1 |              0 |               1 |     $227 |    $9,773 | Died d21.42 |
| neglect-07 | instinctive      |      1 |          10 |              0 |               0 |       $0 |        $0 | Died d45.85 |
| neglect-08 | wait             |      2 |          24 |              2 |               0 |       $0 |        $0 | Survived    |
| neglect-09 | delayed_hospital |      1 |           2 |              0 |               1 |     $148 |    $9,852 | Died d13.59 |

## Medical obligations and economy

The study created 33 medical bills, including
11 insured bills, and finished with
$177,987 in explicit medical principal. It
processed 434 scheduled payment events and
0 discounted full-payoff events.

| Source                    |     Total |
| ------------------------- | --------: |
| Income: stream            |  $191,572 |
| Income: donations         |  $370,264 |
| Income: subscriberRevenue |   $91,100 |
| Income: offStreamSupport  |   $23,872 |
| Income: appearances       |   $20,500 |
| Income: commissions       |        $0 |
| Income: projects          |        $0 |
| Income: other             |        $0 |
| Expense: shop             | −$102,524 |
| Expense: hospital         |  −$47,513 |
| Expense: other            |       −$0 |
| Combined starting cash    |    $1,000 |
| Combined ending cash      |  $548,271 |

| Profile | Median ending cash | Median income | Shop spending | Medical payments | Remaining principal | Rejected purchases |
| ------- | -----------------: | ------------: | ------------: | ---------------: | ------------------: | -----------------: |
| Casual  |             $7,685 |       $10,645 |       $38,672 |          $24,891 |             $98,609 |                 15 |
| Focused |             $8,501 |       $11,705 |       $28,951 |          $18,714 |             $53,286 |                 20 |
| Optimal |            $28,331 |       $31,050 |       $26,824 |               $0 |                  $0 |                 36 |
| Neglect |               $710 |        $1,652 |        $8,077 |           $3,908 |             $26,092 |                  1 |

Every run satisfies `starting cash + income - expenses = ending cash`. Base
stream income is the exact residual because the engine has no standalone base
stream-pay event. Medical principal is separate from cash; only actual payments
are expenses.

## Per-run exceptions

| Run        | Outcome                       | Subscribers | Target | Stone onsets | Bills | Principal |
| ---------- | ----------------------------- | ----------: | ------ | -----------: | ----: | --------: |
| casual-01  | Survived                      |      53,702 | Missed |            3 |     0 |        $0 |
| casual-04  | Survived                      |   1,841,566 | d46.58 |            2 |     2 |    $4,300 |
| casual-05  | Survived                      |     583,706 | d53.83 |            2 |     2 |    $8,825 |
| casual-09  | Survived                      |   1,108,862 | d47.92 |            3 |     3 |   $24,795 |
| casual-10  | Survived                      |     285,892 | d59.25 |            5 |     5 |   $45,289 |
| casual-14  | Survived                      |   1,266,348 | d45.92 |            5 |     5 |    $7,800 |
| casual-15  | Survived                      |   1,181,494 | d47.67 |            2 |     2 |    $7,600 |
| focused-05 | Survived                      |   2,023,085 | d48.42 |            2 |     2 |    $3,896 |
| focused-07 | Survived                      |     112,880 | Missed |            3 |     0 |        $0 |
| focused-09 | Survived                      |   1,781,965 | d50.42 |            3 |     3 |    $4,750 |
| focused-10 | Survived                      |   1,496,683 | d51.92 |            5 |     5 |   $44,640 |
| neglect-01 | Sleep deprivation             |         150 | Missed |            0 |     0 |        $0 |
| neglect-02 | Starvation, Sleep deprivation |      21,002 | Missed |            1 |     0 |        $0 |
| neglect-03 | Starvation                    |      45,023 | Missed |            2 |     0 |        $0 |
| neglect-04 | Survived                      |     138,937 | Missed |            1 |     1 |    $6,467 |
| neglect-05 | Starvation, Sleep deprivation |         728 | Missed |            1 |     1 |    $9,773 |
| neglect-06 | Starvation, Sleep deprivation |       2,097 | Missed |            0 |     0 |        $0 |
| neglect-07 | Starvation, Sleep deprivation |      49,963 | Missed |            1 |     0 |        $0 |
| neglect-08 | Survived                      |     180,966 | Missed |            2 |     0 |        $0 |
| neglect-09 | Starvation, Sleep deprivation |         376 | Missed |            1 |     1 |    $9,852 |
| neglect-10 | Starvation, Sleep deprivation |       6,081 | Missed |            0 |     0 |        $0 |

## Interpretation

1. **Survival separation:** 2/10
   Neglect runs survive versus 40/40
   managed runs. Interpret this independently from progression.
2. **Progression consistency:** 11/12
   Focused runs and 10/10
   Optimal runs hit their targets. Compare survivor medians and boost loads
   before changing a global audience rate.
3. **Condition pressure:** 44/50 runs develop Kidney Stone.
   The response table and affected-run appendix show whether Hospital,
   hydration, or waiting explains survival and repeat treatment.
4. **Medical economy:** actual medical payments consume 6.8%
   of recorded income while $177,987 remains.
   Principal and cash are separate, so a nonnegative balance is not evidence of
   affordable care.
5. **Counterfactual boundary:** this report contains diagnosis only. Test one
   coherent lever family with paired seeds before recommending production
   numbers.

## Method limits

- This is the maintained canonical policy, not a claim that it represents
  every human play style. Policy version changes require intentional review.
- Configured weights are reported with selections and direct impacts, but
  dynamic eligible-pool exposure is not yet persisted by the production event
  ledger.
- This baseline changes no production rules. Any counterfactual must be run as
  a separately labeled paired study with the same seeds and policy version.
