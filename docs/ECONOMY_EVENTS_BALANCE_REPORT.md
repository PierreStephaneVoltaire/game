# 100-Run Controlled and Heterogeneous Balance Diagnosis

Policy contract: canonical v2, heterogeneous
extension v1. This report is generated from
the real seeded engine. It preserves the maintained controlled 50 and adds one
deterministic run for each profile P51–P100. Complete per-run data is in
[ECONOMY_EVENTS_BALANCE_RESULTS.json](./ECONOMY_EVENTS_BALANCE_RESULTS.json).

## Main result

The heterogeneous extension remained physically alive in 23/50
runs (46.0%) and reached the 60-day horizon in
19/50 (38.0%). Its all-run median
ending audience was 12,798;
the horizon-completion median was
858,194. The
combined study observed 4412.6 run-days without merging the
controlled cohorts into a misleading overall completion percentage.

## Controlled regression benchmark

| Profile / target | Runs | Physically alive | 60-day completion | Target hit | Median subs, all | Completion median | Median target day | Median ending day |
| ---------------- | ---: | ---------------: | ----------------: | ---------: | ---------------: | ----------------: | ----------------: | ----------------: |
| Casual / 250K    |   18 |      18 (100.0%) |        16 (88.9%) | 10 (55.6%) |          428,419 |           686,024 |             47.21 |             26.96 |
| Focused / 500K   |   12 |      12 (100.0%) |        10 (83.3%) |  7 (58.3%) |        1,066,682 |         1,272,203 |             49.50 |             44.48 |
| Optimal / 1M     |   10 |      10 (100.0%) |       10 (100.0%) |  9 (90.0%) |        3,663,091 |         3,663,091 |             45.08 |                 — |
| Neglect / 250K   |   10 |        3 (30.0%) |         3 (30.0%) |  2 (20.0%) |            4,195 |            85,964 |             55.17 |             25.25 |

### Controlled outcomes by cohort

| Group   | Active at horizon | Made It unlocked | Death | Quit Streaming | Financial Ruin |
| ------- | ----------------: | ---------------: | ----: | -------------: | -------------: |
| Casual  |                16 |                0 |     0 |              0 |              2 |
| Focused |                10 |                0 |     0 |              0 |              2 |
| Optimal |                10 |                7 |     0 |              0 |              0 |
| Neglect |                 3 |                0 |     7 |              0 |              0 |

## Heterogeneous archetypes

| Group     | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| --------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| common    |   20 |       10 (50.0%) |         9 (45.0%) |  7 (35.0%) |          40,412 |              11.0 |               $592 |        $34,692 |
| risky     |   15 |        3 (20.0%) |         3 (20.0%) |  2 (13.3%) |           1,071 |               0.0 |                $91 |        $23,274 |
| edge      |    8 |        4 (50.0%) |         1 (12.5%) |  2 (25.0%) |           2,649 |               5.0 |              $-126 |        $41,951 |
| optimizer |    7 |        6 (85.7%) |         6 (85.7%) |  5 (71.4%) |         846,538 |              31.0 |             $5,491 |           $699 |

### Heterogeneous outcomes by archetype

| Group     | Active at horizon | Made It unlocked | Death | Quit Streaming | Financial Ruin |
| --------- | ----------------: | ---------------: | ----: | -------------: | -------------: |
| common    |                 9 |                1 |    10 |              0 |              1 |
| risky     |                 3 |                0 |    12 |              0 |              0 |
| edge      |                 1 |                0 |     4 |              1 |              2 |
| optimizer |                 6 |                0 |     1 |              0 |              0 |

## Targeted non-death Ending validation

| ID   | Profile                           | Expected Ending | Observed outcome | Validation | Ending day |
| ---- | --------------------------------- | --------------- | ---------------- | ---------- | ---------: |
| P91  | Financial Ruin Validator          | Financial Ruin  | Financial Ruin   | Pass       |     d25.92 |
| P100 | Quit Streaming Boundary Validator | Quit Streaming  | Quit Streaming   | Pass       |      d0.00 |

P91 reaches Financial Ruin through its ordinary deterministic debt-indifferent
policy. P100 is a controlled boundary profile that enters the real Ending
reconciler when the authored 72-hour zero-Mood countdown is due. It validates
the Ending record, warnings, and precedence boundary without claiming that the
current autonomous-Mood environment naturally sustains that window. The study
test fails if either configured expected outcome is not observed.

## Every heterogeneous profile

| ID   | Profile                            | Type      | Outcome        |  Audience | Target | Min Health |    Cash |    Debt |
| ---- | ---------------------------------- | --------- | -------------- | --------: | ------ | ---------: | ------: | ------: |
| P51  | Morning and Night Only             | common    | death          |       168 | Missed |          0 |     $31 |      $0 |
| P52  | Lunch-Break Player                 | common    | death          |     2,700 | Missed |          0 |     $52 |      $0 |
| P53  | Workday Disappearing Act           | common    | death          |     4,271 | Missed |          0 |     $-7 |      $7 |
| P54  | Weekend Binger                     | risky     | death          |       233 | Missed |          0 |     $30 |      $0 |
| P55  | Two Days On, One Day Off           | common    | death          |    11,072 | Missed |          0 |    $854 |      $0 |
| P56  | Three Days On, Two Days Off        | risky     | death          |       456 | Missed |          0 |   $-908 |    $908 |
| P57  | Forgetful Random Gaps              | common    | death          |     1,267 | Missed |          0 |    $224 |      $0 |
| P58  | Notification Ignorer               | common    | horizon        | 4,542,946 | d20.67 |         22 |  $5,266 |      $0 |
| P59  | Busy Retry Player                  | common    | death          |       788 | Missed |          0 |    $-72 |     $72 |
| P60  | Busy Means I'll Check Tomorrow     | risky     | death          |     7,766 | Missed |          0 |    $629 |      $0 |
| P61  | Food-First Caregiver               | common    | horizon        | 1,047,418 | d49.75 |         26 |  $6,691 |      $0 |
| P62  | Rest-First Caregiver               | common    | horizon        |     5,325 | Missed |         31 |    $330 |      $0 |
| P63  | Mood-First Simp                    | risky     | death          |       172 | Missed |          0 |     $26 |      $0 |
| P64  | Health Bar Watcher                 | risky     | horizon        |    67,410 | Missed |         21 |    $973 |      $0 |
| P65  | Critical-Only Player               | risky     | death          |     1,071 | Missed |          0 |    $223 |      $0 |
| P66  | Full Top-Up Player                 | common    | horizon        | 1,275,102 | d47.50 |         31 | $10,333 |      $0 |
| P67  | Worst-Stat-Only Player             | common    | death          |    67,314 | Missed |          0 |    $928 |      $0 |
| P68  | Everything at 3 Is Fine            | risky     | death          |       980 | Missed |          0 |     $91 |      $0 |
| P69  | Rescue Learner                     | edge      | death          |       176 | Missed |          0 |   $-272 |    $272 |
| P70  | Rescue Exploiter                   | edge      | death          |       282 | Missed |          0 |   $-367 |    $367 |
| P71  | Empty Pantry Procrastinator        | risky     | death          |     3,895 | Missed |          0 |    $950 |      $0 |
| P72  | Pantry Hoarder                     | optimizer | horizon        |   326,966 | Missed |         17 |  $5,491 |      $0 |
| P73  | Favorite-Food Repeater             | common    | horizon        |   872,372 | d50.08 |         31 |  $9,064 |      $0 |
| P74  | Dr Pepper Main                     | risky     | death          |       319 | Missed |          0 |     $97 |      $0 |
| P75  | Sugar-Blind Player                 | common    | horizon        |   442,586 | d55.33 |         27 |  $5,405 |      $0 |
| P76  | Protein Counterplayer              | optimizer | horizon        |   846,538 | d56.50 |         32 |  $3,797 |      $0 |
| P77  | Salt-Blind Player                  | common    | death          |       604 | Missed |          0 |   $-184 |    $184 |
| P78  | Warning-Responsive Hydrator        | common    | horizon        | 1,526,282 | d50.92 |         31 |  $6,642 |      $0 |
| P79  | Nutrition Min-Maxer                | optimizer | horizon        | 2,378,997 | d52.58 |         32 | $17,565 |      $0 |
| P80  | Cheap-Calorie Buyer                | optimizer | death          |    42,978 | Missed |          0 |   $-699 |    $699 |
| P81  | Cosmetic Whale, Tiny Pantry        | risky     | horizon        |   341,768 | d58.08 |         24 |  $2,701 |      $0 |
| P82  | Money Hoarder                      | edge      | death          |       241 | Missed |          0 |    $175 |      $0 |
| P83  | Perpetually Broke Shopper          | risky     | death          |    65,930 | Missed |          0 | $-1,015 |  $1,015 |
| P84  | Insurance-First Player             | common    | death          |    13,510 | Missed |          0 |     $-2 |  $9,035 |
| P85  | Insurance Too Late                 | risky     | death          |    63,446 | Missed |          0 |   $-630 | $19,761 |
| P86  | Never Hospital                     | risky     | death          |       776 | Missed |          0 |   $-126 |    $126 |
| P87  | Immediate Hospital                 | edge      | financial_ruin | 1,392,880 | d44.25 |         32 |  $3,758 | $20,100 |
| P88  | Hospital Only When Health Below 15 | risky     | horizon        | 1,196,767 | d49.33 |         32 |  $4,766 |      $0 |
| P89  | Painkiller Reliant                 | common    | financial_ruin |    93,544 | Missed |         30 |    $153 | $25,200 |
| P90  | Medical Debt Panic                 | common    | horizon        |   420,005 | d53.42 |         32 | $12,748 |      $0 |
| P91  | Financial Ruin Validator           | edge      | financial_ruin |    12,085 | Missed |         10 |   $-829 | $20,529 |
| P92  | Stream Whenever Possible           | risky     | death          |       137 | Missed |          0 | $-1,464 |  $1,464 |
| P93  | Healthy-Only Streamer              | common    | death          |     3,352 | Missed |          0 |   $-194 |    $194 |
| P94  | Early Grind, Late Coast            | optimizer | horizon        | 1,778,095 | d49.25 |         32 |  $8,947 |      $0 |
| P95  | Late Grind                         | optimizer | horizon        | 1,253,940 | d53.50 |         31 | $11,804 |      $0 |
| P96  | Book-and-Game Collector            | edge      | death          |     5,016 | Missed |          0 |   $-683 |    $683 |
| P97  | Room Buff Maxer                    | optimizer | horizon        |   755,400 | d57.17 |         31 |  $1,597 |      $0 |
| P98  | Minimalist No-Luxury Run           | common    | horizon        |   230,842 | Missed |         32 | $14,238 |      $0 |
| P99  | Chaotic Item User                  | edge      | horizon        |   858,194 | d50.83 |         32 |  $4,204 |      $0 |
| P100 | Quit Streaming Boundary Validator  | edge      | quit_streaming |       100 | Missed |         32 |     $20 |      $0 |

## Behavior-axis comparisons

### Cadence model

| Group          | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| -------------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| local_times    |    3 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |           2,700 |               0.0 |                $31 |             $7 |
| day_pattern    |    3 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             456 |               0.0 |                $30 |           $908 |
| gap_pattern    |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |           1,267 |               0.0 |               $224 |             $0 |
| fixed_interval |   41 |       21 (51.2%) |        17 (41.5%) | 14 (34.1%) |          63,446 |              10.0 |               $330 |        $99,701 |
| phase_schedule |    2 |       2 (100.0%) |        2 (100.0%) | 2 (100.0%) |       1,516,018 |              31.5 |            $10,376 |             $0 |

### Care philosophy

| Group           | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| --------------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| worst_only      |    3 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |           1,267 |               0.0 |               $224 |             $0 |
| threshold       |   38 |       19 (50.0%) |        15 (39.5%) | 14 (36.8%) |          53,212 |               5.0 |               $402 |        $99,977 |
| priority        |    3 |        2 (66.7%) |         2 (66.7%) |  1 (33.3%) |           5,325 |              26.0 |               $330 |             $0 |
| health_reactive |    1 |       1 (100.0%) |        1 (100.0%) |   0 (0.0%) |          67,410 |              21.0 |               $973 |             $0 |
| critical_only   |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |           1,071 |               0.0 |               $223 |             $0 |
| top_up          |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |       1,275,102 |              31.0 |            $10,333 |             $0 |
| minimal         |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             980 |               0.0 |                $91 |             $0 |
| rescue_learner  |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             176 |               0.0 |              $-272 |           $272 |
| rescue_exploit  |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             282 |               0.0 |              $-367 |           $367 |

### Nutrition knowledge

| Group            | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| ---------------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| ignore           |   44 |       19 (43.2%) |        15 (34.1%) | 12 (27.3%) |           9,419 |               0.0 |               $199 |        $99,917 |
| preference_first |    2 |        1 (50.0%) |         1 (50.0%) |  1 (50.0%) |         436,346 |              15.5 |             $4,581 |             $0 |
| protein_counter  |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |         846,538 |              32.0 |             $3,797 |             $0 |
| warning_hydrator |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |       1,526,282 |              31.0 |             $6,642 |             $0 |
| risk_minimizer   |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |       2,378,997 |              32.0 |            $17,565 |             $0 |
| cheap_food       |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |          42,978 |               0.0 |              $-699 |           $699 |

### Spending intensity

| Group   | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| ------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| normal  |   37 |       16 (43.2%) |        13 (35.1%) | 12 (32.4%) |           7,766 |               0.0 |               $224 |        $67,890 |
| high    |    9 |        5 (55.6%) |         4 (44.4%) |  3 (33.3%) |          65,930 |              10.0 |                $26 |        $23,691 |
| minimal |    4 |        2 (50.0%) |         2 (50.0%) |  1 (25.0%) |         122,176 |              16.0 |             $6,462 |         $9,035 |

### Career strategy

| Group                | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| -------------------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| healthy_only         |    3 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             172 |               0.0 |                $26 |           $194 |
| casual               |   39 |       20 (51.3%) |        16 (41.0%) | 13 (33.3%) |          63,446 |              10.0 |               $629 |        $97,683 |
| stream_when_possible |    6 |        1 (16.7%) |         1 (16.7%) |  1 (16.7%) |             369 |               0.0 |              $-168 |         $2,739 |
| early_grind          |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |       1,778,095 |              32.0 |             $8,947 |             $0 |
| late_grind           |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |       1,253,940 |              31.0 |            $11,804 |             $0 |

### Hospital strategy

| Group              | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| ------------------ | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| delayed_hospital   |    2 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |           6,839 |               0.0 |                $15 |         $9,035 |
| painkiller         |    2 |        1 (50.0%) |          0 (0.0%) |   0 (0.0%) |          48,122 |              15.0 |               $103 |        $25,200 |
| hydrate            |   39 |       18 (46.2%) |        17 (43.6%) | 13 (33.3%) |          11,072 |               0.0 |               $629 |         $5,681 |
| wait               |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             604 |               0.0 |              $-184 |           $184 |
| critical_hospital  |    2 |       2 (100.0%) |        2 (100.0%) | 2 (100.0%) |       1,787,882 |              32.0 |            $11,166 |             $0 |
| immediate_hospital |    3 |        2 (66.7%) |          0 (0.0%) |  1 (33.3%) |          63,446 |              10.0 |              $-630 |        $60,390 |
| never_hospital     |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             776 |               0.0 |              $-126 |           $126 |

### Rescue awareness

| Group                   | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| ----------------------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| normal                  |   48 |       23 (47.9%) |        19 (39.6%) | 16 (33.3%) |          28,244 |               0.0 |               $277 |        $99,977 |
| relies_on_rescue        |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             176 |               0.0 |              $-272 |           $272 |
| tries_to_exploit_rescue |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             282 |               0.0 |              $-367 |           $367 |

## Physical survival, completion, recovery, and pressure

| Damage source                      | Raw need damage | Applied Health damage | Terminal cause appearances |
| ---------------------------------- | --------------: | --------------------: | -------------------------: |
| starving                           |           4,819 |                 4,819 |                         22 |
| sleep_deprived                     |           1,998 |                 1,998 |                         27 |
| kidney_stone                       |               0 |                 1,008 |                          2 |
| three_month_old_rotisserie_chicken |               0 |                   448 |                          1 |
| depressed                          |             121 |                    89 |                          3 |
| stood_up_too_fast                  |               0 |                    46 |                          0 |
| sick                               |               0 |                    24 |                          0 |
| can_opener_minor_cut               |               0 |                     1 |                          0 |

| Status         | Exposure hours |
| -------------- | -------------: |
| hungry         |       39098.63 |
| sleep_deprived |       21540.83 |
| starving       |       19484.85 |
| low_energy     |       18860.88 |
| dizzy_spell    |       17200.05 |
| kidney_stone   |       13129.05 |
| creative_block |        6519.03 |
| depressed      |        1670.00 |
| overstimulated |        1282.50 |
| full           |         420.80 |
| sick           |          44.00 |
| annoyed        |           3.00 |

27/50 profiles reached Health 8 or lower. 22/50 remained physically alive after receiving at least 20 points of cumulative Health recovery. Median time at Health 8 or lower was 6.00 hours.

## Care and visit behavior

The extension recorded 8,389 Food actions,
2,013 Rest actions, 2,793 Mood
actions, and 377 Bond actions. There were
988 attended
visits with no care action and
129 successful retry sessions.

## Nutrition counterplay

| ID  | Profile                     | Type      | Outcome |  Audience | Target | Min Health |    Cash | Debt |
| --- | --------------------------- | --------- | ------- | --------: | ------ | ---------: | ------: | ---: |
| P74 | Dr Pepper Main              | risky     | death   |       319 | Missed |          0 |     $97 |   $0 |
| P75 | Sugar-Blind Player          | common    | horizon |   442,586 | d55.33 |         27 |  $5,405 |   $0 |
| P76 | Protein Counterplayer       | optimizer | horizon |   846,538 | d56.50 |         32 |  $3,797 |   $0 |
| P77 | Salt-Blind Player           | common    | death   |       604 | Missed |          0 |   $-184 | $184 |
| P78 | Warning-Responsive Hydrator | common    | horizon | 1,526,282 | d50.92 |         31 |  $6,642 |   $0 |
| P79 | Nutrition Min-Maxer         | optimizer | horizon | 2,378,997 | d52.58 |         32 | $17,565 |   $0 |

Across the heterogeneous profiles, the engine produced
206
Sugar Crash warnings,
186
actual crashes,
66
protein cancellations, and
100
Kidney Stone onsets.

## Rescue reliance and ordinary autonomy

| ID  | Profile                     | Type      | Outcome | Audience | Target | Min Health |    Cash | Debt |
| --- | --------------------------- | --------- | ------- | -------: | ------ | ---------: | ------: | ---: |
| P69 | Rescue Learner              | edge      | death   |      176 | Missed |          0 |   $-272 | $272 |
| P70 | Rescue Exploiter            | edge      | death   |      282 | Missed |          0 |   $-367 | $367 |
| P71 | Empty Pantry Procrastinator | risky     | death   |    3,895 | Missed |          0 |    $950 |   $0 |
| P96 | Book-and-Game Collector     | edge      | death   |    5,016 | Missed |          0 |   $-683 | $683 |
| P97 | Room Buff Maxer             | optimizer | horizon |  755,400 | d57.17 |         31 |  $1,597 |   $0 |
| P98 | Minimalist No-Luxury Run    | common    | horizon |  230,842 | Missed |         32 | $14,238 |   $0 |

Food rescues totaled
734 and Rest rescues
totaled 414. Player
actions reset 716
Food locks and
389
Rest locks. The result contract records physical survival for 12/24 hours after rescue;
that is a timing measure, not a causal claim that the rescue prevented death.

## Hospital and medical economy

| ID  | Profile                            | Type   | Outcome        |  Audience | Target | Min Health |    Cash |    Debt |
| --- | ---------------------------------- | ------ | -------------- | --------: | ------ | ---------: | ------: | ------: |
| P84 | Insurance-First Player             | common | death          |    13,510 | Missed |          0 |     $-2 |  $9,035 |
| P85 | Insurance Too Late                 | risky  | death          |    63,446 | Missed |          0 |   $-630 | $19,761 |
| P86 | Never Hospital                     | risky  | death          |       776 | Missed |          0 |   $-126 |    $126 |
| P87 | Immediate Hospital                 | edge   | financial_ruin | 1,392,880 | d44.25 |         32 |  $3,758 | $20,100 |
| P88 | Hospital Only When Health Below 15 | risky  | horizon        | 1,196,767 | d49.33 |         32 |  $4,766 |      $0 |
| P89 | Painkiller Reliant                 | common | financial_ruin |    93,544 | Missed |         30 |    $153 | $25,200 |
| P90 | Medical Debt Panic                 | common | horizon        |   420,005 | d53.42 |         32 | $12,748 |      $0 |
| P91 | Financial Ruin Validator           | edge   | financial_ruin |    12,085 | Missed |         10 |   $-829 | $20,529 |

The extension created
13 bills, made
118
scheduled payments and
0 discounted
full payments, ending with
$93,164 in
explicit principal.

| Source                    |     Total |
| ------------------------- | --------: |
| Income: stream            |  $230,318 |
| Income: donations         |  $372,847 |
| Income: subscriberRevenue |  $120,443 |
| Income: offStreamSupport  |   $37,885 |
| Income: appearances       |   $27,500 |
| Income: commissions       |        $0 |
| Income: projects          |      $697 |
| Income: lifeEvents        |   $40,500 |
| Income: lineOfCredit      |        $0 |
| Income: other             |        $0 |
| Expense: shop             | −$154,278 |
| Expense: hospital         |  −$51,155 |
| Expense: lifeEvents       |  −$79,419 |
| Expense: lineOfCredit     |       −$0 |
| Expense: other            |       −$0 |
| Combined starting cash    |    $2,000 |
| Combined ending cash      |  $547,338 |

### Debt and Line of Credit diagnostics

| Financial diagnostic                        |        Result |
| ------------------------------------------- | ------------: |
| Runs entering In Debt                       |            13 |
| Median peak total debt (all runs)           |           $23 |
| Median peak total debt (debt-positive runs) |          $393 |
| Median peak total debt (In Debt runs)       |       $20,100 |
| Maximum peak total debt                     |       $29,826 |
| Total In Debt exposure                      | 3910.70 hours |
| Crossed $10,000 total debt                  |       13 runs |
| Crossed $15,000 total debt                  |       11 runs |
| Crossed $20,000 total debt                  |        7 runs |
| LOC uptake                                  |        0 runs |
| LOC repayment units purchased               |             0 |
| LOC remaining closure cost                  |            $0 |

| Credit spending category | Amount financed into negative cash |
| ------------------------ | ---------------------------------: |
| food                     |                               $250 |
| medicine                 |                                 $6 |
| upgrade                  |                                 $0 |
| care                     |                                 $0 |
| reusable                 |                                 $0 |
| decoration               |                                 $0 |

### VTuber-life events

| Life event            | Resolutions | Net metric effects | Net cash | Net subscribers | Outcomes                                                 |
| --------------------- | ----------: | ------------------ | -------: | --------------: | -------------------------------------------------------- |
| rain                  |         217 | mood -217          |        0 |               0 | —                                                        |
| personal_purchase     |          98 | mood +104          |   -8,669 |               0 | splurge×16, medium×32, small×31, large×13, collectible×6 |
| algorithm_boost       |          97 | —                  |        0 |               0 | —                                                        |
| sponsored_stream_deal |          80 | —                  |  +40,500 |               0 | medium×32, small×34, large×12, major×2                   |
| tax_bill              |          43 | —                  |  -22,750 |               0 | small×23, medium×10, large×8, major×2                    |
| webcam_failure        |          35 | —                  |  -10,500 |               0 | —                                                        |
| twitter_cancellation  |          31 | —                  |        0 |        -133,686 | minor×20, moderate×7, major×4                            |
| gpu_failure           |          25 | —                  |  -37,500 |               0 | —                                                        |
| agency_invitation     |           2 | —                  |        0 |        +200,000 | —                                                        |

| Metric     | Additions | Losses |
| ---------- | --------: | -----: |
| food       |        +0 |     −0 |
| health     |        +0 |     −0 |
| mood       |      +104 |   −217 |
| rest       |        +0 |     −0 |
| bond       |        +0 |     −0 |
| creativity |        +0 |     −0 |

Cash additions were $40,500;
cash subtractions were $79,419.
Subscriber additions were 200,000;
Subscriber losses were 133,686.
The study observed 99
temporary natural-discovery boosts across
2587.50 exposure-hours.

### Life-event scheduler counters

| Scheduler diagnostic           |   Total |
| ------------------------------ | ------: |
| 30-minute boundaries processed | 211,799 |
| Multi-success boundaries       |       1 |
| Suppressed repeat Agency rolls |       0 |

| Successful life-event roll | Count |
| -------------------------- | ----: |
| rain                       |   217 |
| personal_purchase          |    98 |
| algorithm_boost            |    97 |
| sponsored_stream_deal      |    80 |
| tax_bill                   |    43 |
| webcam_failure             |    35 |
| twitter_cancellation       |    31 |
| gpu_failure                |    25 |
| agency_invitation          |     2 |

### Rotisserie Chicken exposure and outcomes

| Rotisserie Chicken diagnostic                   | Total |
| ----------------------------------------------- | ----: |
| Runs with a Shop appearance                     |    89 |
| Runs with a purchase                            |    56 |
| Shop appearances                                |   197 |
| Purchase events                                 |    56 |
| Purchased units                                 |    56 |
| Manual uses                                     |    49 |
| Automatic stream-snack uses                     |     7 |
| Attributed Health damage                        |   448 |
| Lethal uses                                     |     1 |
| Deaths within 24 hours of any use (correlation) |     1 |

## Career aggression

| ID  | Profile                  | Type      | Outcome |  Audience | Target | Min Health |    Cash |   Debt |
| --- | ------------------------ | --------- | ------- | --------: | ------ | ---------: | ------: | -----: |
| P92 | Stream Whenever Possible | risky     | death   |       137 | Missed |          0 | $-1,464 | $1,464 |
| P93 | Healthy-Only Streamer    | common    | death   |     3,352 | Missed |          0 |   $-194 |   $194 |
| P94 | Early Grind, Late Coast  | optimizer | horizon | 1,778,095 | d49.25 |         32 |  $8,947 |     $0 |
| P95 | Late Grind               | optimizer | horizon | 1,253,940 | d53.50 |         31 | $11,804 |     $0 |

## Balance-question analysis

1. **Max Health:** common-profile physical survival is 50.0% and risky-profile physical survival is 20.0%. This baseline alone does not authorize lowering Health; use the paired 30 HP run for causality.
2. **Recovery:** 22 physically alive profiles recovered at least 20 Health cumulatively; inspect their minimum Health and critical-hours fields before attributing survival to the cap.
3. **Rescue strength:** 0/3 rescue-stress profiles completed 60 days, with 27 successful rescues.
4. **Positive autonomy:** P96/P97/P98 provide collector, room, and minimalist outcomes in the comparison table; autonomous Mood, injury, movement, and side-gig fields remain available per run.
5. **Hospital viability:** 2/6 Hospital-oriented profiles completed 60 days and ended with $67,964 principal.
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
