# 100-Run Controlled and Heterogeneous Balance Diagnosis

Policy contract: canonical v2, heterogeneous
extension v1. This report is generated from
the real seeded engine. It preserves the maintained controlled 50 and adds one
deterministic run for each profile P51–P100. Complete per-run data is in
[BALANCE_RESULTS.json](./BALANCE_RESULTS.json).

## Main result

The heterogeneous extension remained physically alive in 19/50
runs (38.0%) and reached the 60-day horizon in
18/50 (36.0%). Its all-run median
ending audience was 8,141;
the horizon-completion median was
666,556. The
combined study observed 4065.8 run-days without merging the
controlled cohorts into a misleading overall completion percentage.

## Controlled regression benchmark

| Profile / target | Runs | Physically alive | 60-day completion | Target hit | Median subs, all | Completion median | Median target day | Median ending day |
| ---------------- | ---: | ---------------: | ----------------: | ---------: | ---------------: | ----------------: | ----------------: | ----------------: |
| Casual / 250K    |   18 |       17 (94.4%) |        14 (77.8%) | 10 (55.6%) |          428,634 |           674,016 |             48.92 |             22.89 |
| Focused / 500K   |   12 |       11 (91.7%) |         9 (75.0%) |  7 (58.3%) |        1,545,587 |         1,963,201 |             48.25 |             34.75 |
| Optimal / 1M     |   10 |      10 (100.0%) |       10 (100.0%) |  9 (90.0%) |        3,314,601 |         3,314,601 |             47.50 |                 — |
| Neglect / 250K   |   10 |        2 (20.0%) |         1 (10.0%) |   0 (0.0%) |            1,471 |           175,298 |                 — |             23.21 |

### Controlled outcomes by cohort

| Group   | Active at horizon | Made It unlocked | Death | Quit Streaming | Financial Ruin |
| ------- | ----------------: | ---------------: | ----: | -------------: | -------------: |
| Casual  |                14 |                0 |     1 |              0 |              3 |
| Focused |                 9 |                1 |     1 |              0 |              2 |
| Optimal |                10 |                8 |     0 |              0 |              0 |
| Neglect |                 1 |                0 |     8 |              0 |              1 |

## Heterogeneous archetypes

| Group     | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| --------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| common    |   20 |       10 (50.0%) |        10 (50.0%) |  9 (45.0%) |          40,465 |               8.0 |               $839 |        $30,901 |
| risky     |   15 |        2 (13.3%) |         2 (13.3%) |   1 (6.7%) |           1,657 |               0.0 |                $13 |        $22,049 |
| edge      |    7 |        3 (42.9%) |         2 (28.6%) |  2 (28.6%) |          21,814 |               0.0 |                $28 |        $27,001 |
| optimizer |    7 |        4 (57.1%) |         4 (57.1%) |  3 (42.9%) |         467,457 |              27.0 |             $5,007 |         $2,829 |
| hostile   |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             996 |               0.0 |                 $0 |             $0 |

### Heterogeneous outcomes by archetype

| Group     | Active at horizon | Made It unlocked | Death | Quit Streaming | Financial Ruin |
| --------- | ----------------: | ---------------: | ----: | -------------: | -------------: |
| common    |                10 |                0 |    10 |              0 |              0 |
| risky     |                 2 |                0 |    13 |              0 |              0 |
| edge      |                 2 |                0 |     4 |              0 |              1 |
| optimizer |                 4 |                1 |     3 |              0 |              0 |
| hostile   |                 0 |                0 |     1 |              0 |              0 |

## Every heterogeneous profile

| ID   | Profile                            | Type      | Outcome        |  Audience | Target | Min Health |    Cash |    Debt |
| ---- | ---------------------------------- | --------- | -------------- | --------: | ------ | ---------: | ------: | ------: |
| P51  | Morning and Night Only             | common    | death          |       234 | Missed |          0 |     $66 |      $0 |
| P52  | Lunch-Break Player                 | common    | horizon        |   353,868 | d54.75 |         17 |  $2,789 |      $0 |
| P53  | Workday Disappearing Act           | common    | death          |       726 | Missed |          0 |   $-345 |    $345 |
| P54  | Weekend Binger                     | risky     | death          |       903 | Missed |          0 |  $2,434 |      $0 |
| P55  | Two Days On, One Day Off           | common    | death          |    66,514 | Missed |          0 |  $1,353 |      $0 |
| P56  | Three Days On, Two Days Off        | risky     | death          |       474 | Missed |          0 |    $553 |      $0 |
| P57  | Forgetful Random Gaps              | common    | death          |       856 | Missed |          0 |   $-621 |    $621 |
| P58  | Notification Ignorer               | common    | death          |     1,688 | Missed |          0 |   $-806 |    $806 |
| P59  | Busy Retry Player                  | common    | death          |       995 | Missed |          0 |    $-91 |     $91 |
| P60  | Busy Means I'll Check Tomorrow     | risky     | death          |    15,551 | Missed |          0 |   $-943 |    $943 |
| P61  | Food-First Caregiver               | common    | horizon        |   318,308 | d55.25 |         16 |  $3,043 |      $0 |
| P62  | Rest-First Caregiver               | common    | horizon        |    14,416 | Missed |         30 |    $324 |      $0 |
| P63  | Mood-First Simp                    | risky     | death          |       182 | Missed |          0 |     $26 |      $0 |
| P64  | Health Bar Watcher                 | risky     | horizon        |   126,102 | Missed |         16 |  $4,007 |      $0 |
| P65  | Critical-Only Player               | risky     | death          |       651 | Missed |          0 |     $13 |      $0 |
| P66  | Full Top-Up Player                 | common    | horizon        | 1,623,528 | d47.92 |         32 |  $5,261 |      $0 |
| P67  | Worst-Stat-Only Player             | common    | death          |     4,748 | Missed |          0 |    $102 |      $0 |
| P68  | Everything at 3 Is Fine            | risky     | death          |       428 | Missed |          0 |      $1 |      $0 |
| P69  | Rescue Learner                     | edge      | death          |       248 | Missed |          0 |     $28 |      $0 |
| P70  | Rescue Exploiter                   | edge      | death          |   159,054 | Missed |          0 |  $5,263 |      $0 |
| P71  | Empty Pantry Procrastinator        | risky     | death          |     1,657 | Missed |          0 |      $1 |      $0 |
| P72  | Pantry Hoarder                     | optimizer | death          |     6,249 | Missed |          0 | $-1,429 |  $1,429 |
| P73  | Favorite-Food Repeater             | common    | horizon        | 1,448,103 | d47.42 |         28 | $16,612 |      $0 |
| P74  | Dr Pepper Main                     | risky     | death          |       467 | Missed |          0 |    $117 |      $0 |
| P75  | Sugar-Blind Player                 | common    | horizon        |   850,512 | d51.67 |         27 | $16,478 |      $0 |
| P76  | Protein Counterplayer              | optimizer | horizon        |   821,651 | d56.25 |         31 |  $5,007 |      $0 |
| P77  | Salt-Blind Player                  | common    | death          |       246 | Missed |          0 |    $-20 |     $20 |
| P78  | Warning-Responsive Hydrator        | common    | horizon        |   614,975 | d53.58 |         32 |  $8,802 |      $0 |
| P79  | Nutrition Min-Maxer                | optimizer | horizon        | 3,144,825 | d48.08 |         30 | $22,115 |      $0 |
| P80  | Cheap-Calorie Buyer                | optimizer | horizon        |   467,457 | Missed |         31 | $11,928 |      $0 |
| P81  | Cosmetic Whale, Tiny Pantry        | risky     | horizon        |   655,698 | d53.92 |         31 |  $4,094 |      $0 |
| P82  | Money Hoarder                      | edge      | death          |       250 | Missed |          0 |    $172 |      $0 |
| P83  | Perpetually Broke Shopper          | risky     | death          |    16,561 | Missed |          0 |   $-149 |    $149 |
| P84  | Insurance-First Player             | common    | death          |     4,095 | Missed |          0 |   $-207 | $19,525 |
| P85  | Insurance Too Late                 | risky     | death          |     7,992 | Missed |          0 |   $-486 |  $9,486 |
| P86  | Never Hospital                     | risky     | death          |     3,818 | Missed |          0 |   $-466 |    $466 |
| P87  | Immediate Hospital                 | edge      | financial_ruin |     9,176 | Missed |          6 | $-1,013 | $20,164 |
| P88  | Hospital Only When Health Below 15 | risky     | death          |     2,499 | Missed |          0 | $-1,005 | $11,005 |
| P89  | Painkiller Reliant                 | common    | horizon        | 1,084,762 | d49.75 |         31 |  $9,199 |  $6,850 |
| P90  | Medical Debt Panic                 | common    | horizon        |   541,821 | d53.58 |         30 |  $8,080 |      $0 |
| P91  | Debt Indifferent                   | edge      | horizon        |   677,414 | d49.33 |         31 |    $-85 |  $6,262 |
| P92  | Stream Whenever Possible           | risky     | death          |       470 | Missed |          0 |     $20 |      $0 |
| P93  | Healthy-Only Streamer              | common    | death          |     8,289 | Missed |          0 | $-2,643 |  $2,643 |
| P94  | Early Grind, Late Coast            | optimizer | death          |     1,590 | Missed |          0 | $-1,074 |  $1,074 |
| P95  | Late Grind                         | optimizer | death          |       380 | Missed |          0 |   $-326 |    $326 |
| P96  | Book-and-Game Collector            | edge      | horizon        |   488,577 | d55.25 |         28 |  $4,189 |      $0 |
| P97  | Room Buff Maxer                    | optimizer | horizon        |   925,292 | d55.67 |         27 |  $5,282 |      $0 |
| P98  | Minimalist No-Luxury Run           | common    | horizon        | 1,223,880 | d48.25 |         32 |  $5,983 |      $0 |
| P99  | Chaotic Item User                  | edge      | death          |    21,814 | Missed |          0 |   $-575 |    $575 |
| P100 | Click Everything Player            | hostile   | death          |       996 | Missed |          0 |      $0 |      $0 |

## Behavior-axis comparisons

### Cadence model

| Group          | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| -------------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| local_times    |    3 |        1 (33.3%) |         1 (33.3%) |  1 (33.3%) |             726 |               0.0 |                $66 |           $345 |
| day_pattern    |    3 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             903 |               0.0 |             $1,353 |             $0 |
| gap_pattern    |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             856 |               0.0 |              $-621 |           $621 |
| fixed_interval |   41 |       18 (43.9%) |        17 (41.5%) | 14 (34.1%) |          14,416 |               0.0 |                $28 |        $80,414 |
| phase_schedule |    2 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             985 |               0.0 |              $-700 |         $1,400 |

### Care philosophy

| Group           | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| --------------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| worst_only      |    3 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             856 |               0.0 |                $66 |           $621 |
| threshold       |   38 |       15 (39.5%) |        14 (36.8%) | 13 (34.2%) |           8,733 |               0.0 |                $11 |        $82,159 |
| priority        |    3 |        2 (66.7%) |         2 (66.7%) |  1 (33.3%) |          14,416 |              16.0 |               $324 |             $0 |
| health_reactive |    1 |       1 (100.0%) |        1 (100.0%) |   0 (0.0%) |         126,102 |              16.0 |             $4,007 |             $0 |
| critical_only   |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             651 |               0.0 |                $13 |             $0 |
| top_up          |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |       1,623,528 |              32.0 |             $5,261 |             $0 |
| minimal         |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             428 |               0.0 |                 $1 |             $0 |
| rescue_learner  |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             248 |               0.0 |                $28 |             $0 |
| rescue_exploit  |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |         159,054 |               0.0 |             $5,263 |             $0 |

### Nutrition knowledge

| Group            | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| ---------------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| ignore           |   44 |       14 (31.8%) |        13 (29.5%) | 11 (25.0%) |           5,499 |               0.0 |                $17 |        $82,780 |
| preference_first |    2 |        1 (50.0%) |         1 (50.0%) |  1 (50.0%) |         724,285 |              14.0 |             $8,365 |             $0 |
| protein_counter  |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |         821,651 |              31.0 |             $5,007 |             $0 |
| warning_hydrator |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |         614,975 |              32.0 |             $8,802 |             $0 |
| risk_minimizer   |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |       3,144,825 |              30.0 |            $22,115 |             $0 |
| cheap_food       |    1 |       1 (100.0%) |        1 (100.0%) |   0 (0.0%) |         467,457 |              31.0 |            $11,928 |             $0 |

### Spending intensity

| Group   | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| ------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| normal  |   36 |       13 (36.1%) |        12 (33.3%) |  9 (25.0%) |           6,370 |               0.0 |                $84 |        $54,840 |
| high    |   10 |        4 (40.0%) |         4 (40.0%) |  4 (40.0%) |          19,188 |               0.0 |                $10 |         $8,415 |
| minimal |    4 |        2 (50.0%) |         2 (50.0%) |  2 (50.0%) |         272,958 |              15.0 |             $3,078 |        $19,525 |

### Career strategy

| Group                | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| -------------------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| healthy_only         |    3 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             234 |               0.0 |                $26 |         $2,643 |
| casual               |   38 |       18 (47.4%) |        17 (44.7%) | 14 (36.8%) |          16,056 |               0.0 |               $110 |        $78,737 |
| stream_when_possible |    7 |        1 (14.3%) |         1 (14.3%) |  1 (14.3%) |             903 |               0.0 |               $553 |             $0 |
| early_grind          |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |           1,590 |               0.0 |            $-1,074 |         $1,074 |
| late_grind           |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             380 |               0.0 |              $-326 |           $326 |

### Hospital strategy

| Group              | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| ------------------ | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| delayed_hospital   |    2 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |           2,165 |               0.0 |               $-70 |        $19,525 |
| painkiller         |    2 |       2 (100.0%) |        2 (100.0%) | 2 (100.0%) |         719,315 |              24.0 |             $5,994 |         $6,850 |
| hydrate            |   39 |       14 (35.9%) |        14 (35.9%) | 11 (28.2%) |           8,289 |               0.0 |               $117 |         $9,002 |
| wait               |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             246 |               0.0 |               $-20 |            $20 |
| critical_hospital  |    2 |        1 (50.0%) |         1 (50.0%) |  1 (50.0%) |       1,573,662 |              15.0 |            $10,555 |        $11,005 |
| immediate_hospital |    3 |        2 (66.7%) |         1 (33.3%) |  1 (33.3%) |           9,176 |               6.0 |              $-486 |        $35,912 |
| never_hospital     |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |           3,818 |               0.0 |              $-466 |           $466 |

### Rescue awareness

| Group                   | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| ----------------------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| normal                  |   48 |       19 (39.6%) |        18 (37.5%) | 15 (31.3%) |           8,141 |               0.0 |                $46 |        $82,780 |
| relies_on_rescue        |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             248 |               0.0 |                $28 |             $0 |
| tries_to_exploit_rescue |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |         159,054 |               0.0 |             $5,263 |             $0 |

## Physical survival, completion, recovery, and pressure

| Damage source                      | Raw need damage | Applied Health damage | Terminal cause appearances |
| ---------------------------------- | --------------: | --------------------: | -------------------------: |
| starving                           |           4,339 |                 4,339 |                         27 |
| sleep_deprived                     |           1,905 |                 1,905 |                         34 |
| three_month_old_rotisserie_chicken |               0 |                 1,000 |                          0 |
| kidney_stone                       |               0 |                   917 |                          2 |
| depressed                          |             130 |                   112 |                          3 |
| stood_up_too_fast                  |               0 |                    39 |                          0 |
| sick                               |               0 |                    17 |                          0 |

| Status         | Exposure hours |
| -------------- | -------------: |
| hungry         |       34428.13 |
| sleep_deprived |       19442.88 |
| starving       |       17797.10 |
| low_energy     |       17264.03 |
| dizzy_spell    |       16147.15 |
| kidney_stone   |       11365.15 |
| creative_block |        5993.28 |
| depressed      |        3258.45 |
| overstimulated |        1125.80 |
| full           |         637.50 |
| sick           |          30.00 |

32/50 profiles reached Health 8 or lower. 19/50 remained physically alive after receiving at least 20 points of cumulative Health recovery. Median time at Health 8 or lower was 8.25 hours.

## Care and visit behavior

The extension recorded 7,432 Food actions,
1,800 Rest actions, 2,499 Mood
actions, and 363 Bond actions. There were
1,005 attended
visits with no care action and
130 successful retry sessions.

## Nutrition counterplay

| ID  | Profile                     | Type      | Outcome |  Audience | Target | Min Health |    Cash | Debt |
| --- | --------------------------- | --------- | ------- | --------: | ------ | ---------: | ------: | ---: |
| P74 | Dr Pepper Main              | risky     | death   |       467 | Missed |          0 |    $117 |   $0 |
| P75 | Sugar-Blind Player          | common    | horizon |   850,512 | d51.67 |         27 | $16,478 |   $0 |
| P76 | Protein Counterplayer       | optimizer | horizon |   821,651 | d56.25 |         31 |  $5,007 |   $0 |
| P77 | Salt-Blind Player           | common    | death   |       246 | Missed |          0 |    $-20 |  $20 |
| P78 | Warning-Responsive Hydrator | common    | horizon |   614,975 | d53.58 |         32 |  $8,802 |   $0 |
| P79 | Nutrition Min-Maxer         | optimizer | horizon | 3,144,825 | d48.08 |         30 | $22,115 |   $0 |

Across the heterogeneous profiles, the engine produced
189
Sugar Crash warnings,
170
actual crashes,
67
protein cancellations, and
79
Kidney Stone onsets.

## Rescue reliance and ordinary autonomy

| ID  | Profile                     | Type      | Outcome |  Audience | Target | Min Health |   Cash | Debt |
| --- | --------------------------- | --------- | ------- | --------: | ------ | ---------: | -----: | ---: |
| P69 | Rescue Learner              | edge      | death   |       248 | Missed |          0 |    $28 |   $0 |
| P70 | Rescue Exploiter            | edge      | death   |   159,054 | Missed |          0 | $5,263 |   $0 |
| P71 | Empty Pantry Procrastinator | risky     | death   |     1,657 | Missed |          0 |     $1 |   $0 |
| P96 | Book-and-Game Collector     | edge      | horizon |   488,577 | d55.25 |         28 | $4,189 |   $0 |
| P97 | Room Buff Maxer             | optimizer | horizon |   925,292 | d55.67 |         27 | $5,282 |   $0 |
| P98 | Minimalist No-Luxury Run    | common    | horizon | 1,223,880 | d48.25 |         32 | $5,983 |   $0 |

Food rescues totaled
694 and Rest rescues
totaled 386. Player
actions reset 676
Food locks and
352
Rest locks. The result contract records physical survival for 12/24 hours after rescue;
that is a timing measure, not a causal claim that the rescue prevented death.

## Hospital and medical economy

| ID  | Profile                            | Type   | Outcome        |  Audience | Target | Min Health |    Cash |    Debt |
| --- | ---------------------------------- | ------ | -------------- | --------: | ------ | ---------: | ------: | ------: |
| P84 | Insurance-First Player             | common | death          |     4,095 | Missed |          0 |   $-207 | $19,525 |
| P85 | Insurance Too Late                 | risky  | death          |     7,992 | Missed |          0 |   $-486 |  $9,486 |
| P86 | Never Hospital                     | risky  | death          |     3,818 | Missed |          0 |   $-466 |    $466 |
| P87 | Immediate Hospital                 | edge   | financial_ruin |     9,176 | Missed |          6 | $-1,013 | $20,164 |
| P88 | Hospital Only When Health Below 15 | risky  | death          |     2,499 | Missed |          0 | $-1,005 | $11,005 |
| P89 | Painkiller Reliant                 | common | horizon        | 1,084,762 | d49.75 |         31 |  $9,199 |  $6,850 |
| P90 | Medical Debt Panic                 | common | horizon        |   541,821 | d53.58 |         30 |  $8,080 |      $0 |
| P91 | Debt Indifferent                   | edge   | horizon        |   677,414 | d49.33 |         31 |    $-85 |  $6,262 |

The extension created
11 bills, made
99
scheduled payments and
0 discounted
full payments, ending with
$70,496 in
explicit principal.

| Source                    |     Total |
| ------------------------- | --------: |
| Income: stream            |  $213,927 |
| Income: donations         |  $425,422 |
| Income: subscriberRevenue |  $109,820 |
| Income: offStreamSupport  |   $34,497 |
| Income: appearances       |   $24,500 |
| Income: commissions       |        $0 |
| Income: projects          |    $2,008 |
| Income: lifeEvents        |   $58,250 |
| Income: lineOfCredit      |        $0 |
| Income: other             |        $0 |
| Expense: shop             | −$137,947 |
| Expense: hospital         |  −$40,973 |
| Expense: lifeEvents       | −$133,151 |
| Expense: lineOfCredit     |       −$0 |
| Expense: other            |       −$0 |
| Combined starting cash    |    $2,000 |
| Combined ending cash      |  $558,353 |

### Debt and Line of Credit diagnostics

| Financial diagnostic          |        Result |
| ----------------------------- | ------------: |
| Runs entering In Debt         |            19 |
| Median peak total debt        |           $48 |
| Maximum peak total debt       |       $28,660 |
| Total In Debt exposure        | 3176.35 hours |
| LOC uptake                    |        0 runs |
| LOC repayment units purchased |             0 |
| LOC remaining closure cost    |            $0 |
| LOC cumulative open charges   |            $0 |

| Credit spending category | Amount financed into negative cash |
| ------------------------ | ---------------------------------: |
| food                     |                               $317 |
| medicine                 |                                 $7 |
| upgrade                  |                                 $0 |
| care                     |                                 $0 |
| reusable                 |                                 $0 |
| decoration               |                                 $0 |

### VTuber-life events

| Life event            | Resolutions |
| --------------------- | ----------: |
| rain                  |         723 |
| personal_purchase     |         232 |
| sponsored_stream_deal |         125 |
| tax_bill              |          77 |
| algorithm_boost       |          52 |
| gpu_failure           |          43 |
| webcam_failure        |          43 |
| twitter_cancellation  |          24 |
| agency_invitation     |           3 |

| Metric     | Additions | Losses |
| ---------- | --------: | -----: |
| food       |        +0 |     −0 |
| health     |        +0 |     −0 |
| mood       |      +244 |   −721 |
| rest       |        +0 |     −0 |
| bond       |        +0 |     −0 |
| creativity |        +0 |     −0 |

Cash additions were $58,250;
cash subtractions were $133,151.
Subscriber additions were 300,000;
Subscriber losses were 131,770.
The study observed 55
temporary natural-discovery boosts across
1677.00 exposure-hours.

## Career aggression

| ID  | Profile                  | Type      | Outcome | Audience | Target | Min Health |    Cash |   Debt |
| --- | ------------------------ | --------- | ------- | -------: | ------ | ---------: | ------: | -----: |
| P92 | Stream Whenever Possible | risky     | death   |      470 | Missed |          0 |     $20 |     $0 |
| P93 | Healthy-Only Streamer    | common    | death   |    8,289 | Missed |          0 | $-2,643 | $2,643 |
| P94 | Early Grind, Late Coast  | optimizer | death   |    1,590 | Missed |          0 | $-1,074 | $1,074 |
| P95 | Late Grind               | optimizer | death   |      380 | Missed |          0 |   $-326 |   $326 |

## Balance-question analysis

1. **Max Health:** common-profile physical survival is 50.0% and risky-profile physical survival is 13.3%. This baseline alone does not authorize lowering Health; use the paired 30 HP run for causality.
2. **Recovery:** 19 physically alive profiles recovered at least 20 Health cumulatively; inspect their minimum Health and critical-hours fields before attributing survival to the cap.
3. **Rescue strength:** 0/3 rescue-stress profiles completed 60 days, with 142 successful rescues.
4. **Positive autonomy:** P96/P97/P98 provide collector, room, and minimalist outcomes in the comparison table; autonomous Mood, injury, movement, and side-gig fields remain available per run.
5. **Hospital viability:** 2/6 Hospital-oriented profiles completed 60 days and ended with $63,646 principal.
6. **Nutrition clarity:** 3/3 informed profiles completed 60 days; compare their warnings, responses, crashes, and onsets with P74/P75/P77 in the result JSON.
7. **Career cost:** P92–P95 separate aggressive, healthy-only, early-grind, and late-grind policies; their table reports exact outcomes, target timing, audience, cash, and debt without treating audience failure as an ending.

## Method and counterfactual boundary

- P51–P100 are configuration records interpreted by shared schedule, care,
  shopping, nutrition, career, medical, debt, and autonomy strategies. Their
  overlays are recorded per run.
- Scheduled, attended, busy, skipped, and retried visits are distinct. A busy
  visit is not silently moved unless its profile explicitly retries.
- Profile decisions are deterministic. Gameplay continues to use the engine's
  seed, state version, and command identity.
- The 40 HP production baseline is reported here first. The requested paired
  30 HP counterfactual remains a separately labeled experiment; it must not be
  conflated with this baseline or a production rule change.
- Financial Ruin used the production $20,000 total-debt threshold. The $15,000
  counterfactual was not executed in this baseline and did not modify
  production data.
