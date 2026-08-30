# 100-Run Controlled and Heterogeneous Balance Diagnosis

Policy contract: canonical v2, heterogeneous
extension v1. This report is generated from
the real seeded engine. It preserves the maintained controlled 50 and adds one
deterministic run for each profile P51–P100. Complete per-run data is in
[ECONOMY_EVENTS_BALANCE_RESULTS.json](./ECONOMY_EVENTS_BALANCE_RESULTS.json).

Engine revision: 3771ec6a80818460b761e28b71afe581552d45d5+dirty

## Main result

The heterogeneous extension remained physically alive in 34/50
runs (68.0%) and reached the 60-day horizon in
32/50 (64.0%). Its all-run median
ending audience was 2,445,370;
the horizon-completion median was
2,798,452. The
combined study observed 4943.4 run-days without merging the
controlled cohorts into a misleading overall completion percentage.

## Controlled regression benchmark

| Profile / target | Runs | Physically alive | 60-day completion |  Target hit | Median subs, all | Completion median | Median target day | Median ending day |
| ---------------- | ---: | ---------------: | ----------------: | ----------: | ---------------: | ----------------: | ----------------: | ----------------: |
| Casual / 250K    |   18 |       17 (94.4%) |        17 (94.4%) | 18 (100.0%) |        3,162,135 |         3,145,913 |             38.63 |             56.65 |
| Focused / 500K   |   12 |      12 (100.0%) |       12 (100.0%) | 12 (100.0%) |        3,637,863 |         3,637,863 |             41.79 |                 — |
| Optimal / 1M     |   10 |      10 (100.0%) |       10 (100.0%) | 10 (100.0%) |        4,928,921 |         4,928,921 |             43.17 |                 — |
| Neglect / 250K   |   10 |        1 (10.0%) |         1 (10.0%) |   2 (20.0%) |           18,630 |         2,703,678 |             41.25 |             24.08 |

### Controlled outcomes by cohort

| Group   | Active at horizon | Made It unlocked | Death | Quit Streaming | Financial Ruin |
| ------- | ----------------: | ---------------: | ----: | -------------: | -------------: |
| Casual  |                17 |               14 |     1 |              0 |              0 |
| Focused |                12 |               11 |     0 |              0 |              0 |
| Optimal |                10 |               10 |     0 |              0 |              0 |
| Neglect |                 1 |                0 |     9 |              0 |              0 |

### Ordinary-stream cadence acceptance

| Horizon cohort | Runs | Median ordinary starts | At least 45 | Median longest gap | Median blocked hours |
| -------------- | ---: | ---------------------: | ----------: | -----------------: | -------------------: |
| Casual         |   17 |                  100.0 | 17 (100.0%) |              104.0 |                628.9 |
| Focused        |   12 |                  107.0 | 12 (100.0%) |               76.6 |                622.1 |

#### Horizon runs below 45 ordinary starts

| Run | Cohort | Starts | Blocked hours | Too tired | Longest gap | Eligible opportunities |
| --- | ------ | -----: | ------------: | --------: | ----------: | ---------------------: |
| —   | —      |      0 |             0 |         0 |           0 |                      0 |

## Heterogeneous archetypes

| Group     | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| --------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| common    |   20 |       13 (65.0%) |        13 (65.0%) | 14 (70.0%) |       2,473,963 |              25.5 |            $13,635 |        $39,181 |
| risky     |   15 |        7 (46.7%) |         7 (46.7%) |  7 (46.7%) |          87,358 |               0.0 |             $4,259 |         $3,100 |
| edge      |    8 |        7 (87.5%) |         5 (62.5%) |  6 (75.0%) |       2,396,751 |              25.5 |             $4,928 |        $34,274 |
| optimizer |    7 |       7 (100.0%) |        7 (100.0%) | 7 (100.0%) |       3,267,859 |              31.0 |            $18,907 |             $0 |

### Heterogeneous outcomes by archetype

| Group     | Active at horizon | Made It unlocked | Death | Quit Streaming | Financial Ruin |
| --------- | ----------------: | ---------------: | ----: | -------------: | -------------: |
| common    |                13 |                4 |     7 |              0 |              0 |
| risky     |                 7 |                3 |     8 |              0 |              0 |
| edge      |                 5 |                3 |     1 |              1 |              1 |
| optimizer |                 7 |                4 |     0 |              0 |              0 |

## Targeted non-death Ending validation

| ID   | Profile                           | Expected Ending | Observed outcome | Validation | Ending day |
| ---- | --------------------------------- | --------------- | ---------------- | ---------- | ---------: |
| P91  | Financial Ruin Validator          | Financial Ruin  | Financial Ruin   | Pass       |     d38.83 |
| P100 | Quit Streaming Boundary Validator | Quit Streaming  | Quit Streaming   | Pass       |      d0.00 |

P91 reaches Financial Ruin through its ordinary deterministic debt-indifferent
policy. P100 is a controlled boundary profile that enters the real Ending
reconciler when the authored 72-hour zero-Mood countdown is due. It validates
the Ending record, warnings, and precedence boundary without claiming that the
current autonomous-Mood environment naturally sustains that window. The study
test fails if either configured expected outcome is not observed.

## Every heterogeneous profile

| ID   | Profile                            | Type      | Outcome        |  Audience | Target | Min Health |     Cash |    Debt |
| ---- | ---------------------------------- | --------- | -------------- | --------: | ------ | ---------: | -------: | ------: |
| P51  | Morning and Night Only             | common    | death          |       568 | Missed |          0 |     $-49 |     $49 |
| P52  | Lunch-Break Player                 | common    | death          |   138,070 | Missed |          0 |    $-110 | $16,382 |
| P53  | Workday Disappearing Act           | common    | death          |    48,794 | Missed |          0 |   $8,573 |      $0 |
| P54  | Weekend Binger                     | risky     | death          |       432 | Missed |          0 |     $526 |      $0 |
| P55  | Two Days On, One Day Off           | common    | death          |     6,820 | Missed |          0 |   $2,555 |      $0 |
| P56  | Three Days On, Two Days Off        | risky     | death          |       988 | Missed |          0 |     $526 |      $0 |
| P57  | Forgetful Random Gaps              | common    | death          |     7,780 | Missed |          0 |   $2,380 |      $0 |
| P58  | Notification Ignorer               | common    | death          |   644,441 | d42.58 |          0 |   $9,870 |      $0 |
| P59  | Busy Retry Player                  | common    | horizon        | 2,780,601 | d38.42 |         28 |  $15,081 |      $0 |
| P60  | Busy Means I'll Check Tomorrow     | risky     | horizon        | 2,255,734 | d43.00 |         12 |  $11,664 |      $0 |
| P61  | Food-First Caregiver               | common    | horizon        | 3,269,315 | d37.58 |         24 |  $23,174 |      $0 |
| P62  | Rest-First Caregiver               | common    | horizon        | 1,256,847 | d48.75 |         29 |  $23,440 |      $0 |
| P63  | Mood-First Simp                    | risky     | death          |       431 | Missed |          0 |     $245 |      $0 |
| P64  | Health Bar Watcher                 | risky     | horizon        | 2,126,448 | d40.17 |         16 |  $30,098 |      $0 |
| P65  | Critical-Only Player               | risky     | death          |     1,447 | Missed |          0 |   $5,123 |      $0 |
| P66  | Full Top-Up Player                 | common    | horizon        | 2,779,999 | d40.50 |         31 |  $15,683 |      $0 |
| P67  | Worst-Stat-Only Player             | common    | death          |    74,632 | Missed |          0 |   $5,096 |      $0 |
| P68  | Everything at 3 Is Fine            | risky     | death          |     6,815 | Missed |          0 |     $693 |      $0 |
| P69  | Rescue Learner                     | edge      | death          |     1,530 | Missed |          0 |     $606 |      $0 |
| P70  | Rescue Exploiter                   | edge      | horizon        | 3,352,221 | d38.00 |         14 |  $14,795 |      $0 |
| P71  | Empty Pantry Procrastinator        | risky     | death          |    87,358 | Missed |          0 |   $4,259 |      $0 |
| P72  | Pantry Hoarder                     | optimizer | horizon        | 2,810,504 | d46.50 |         18 |  $14,447 |      $0 |
| P73  | Favorite-Food Repeater             | common    | horizon        | 4,763,111 | d35.17 |         25 |  $17,822 |      $0 |
| P74  | Dr Pepper Main                     | risky     | death          |       844 | Missed |          0 |     $436 |      $0 |
| P75  | Sugar-Blind Player                 | common    | horizon        | 1,993,722 | d37.92 |         26 |  $11,401 |      $0 |
| P76  | Protein Counterplayer              | optimizer | horizon        | 4,250,065 | d40.75 |         31 |  $19,300 |      $0 |
| P77  | Salt-Blind Player                  | common    | horizon        | 2,515,696 | d41.42 |         25 |  $18,376 |      $0 |
| P78  | Warning-Responsive Hydrator        | common    | horizon        | 4,017,855 | d36.50 |         32 |  $34,001 |      $0 |
| P79  | Nutrition Min-Maxer                | optimizer | horizon        | 5,160,375 | d40.92 |         32 |  $27,259 |      $0 |
| P80  | Cheap-Calorie Buyer                | optimizer | horizon        | 3,267,859 | d40.17 |         31 |  $14,216 |      $0 |
| P81  | Cosmetic Whale, Tiny Pantry        | risky     | horizon        | 2,458,510 | d41.92 |         28 |  $19,180 |      $0 |
| P82  | Money Hoarder                      | edge      | horizon        | 3,623,444 | d38.00 |         13 |  $17,939 |      $0 |
| P83  | Perpetually Broke Shopper          | risky     | horizon        | 3,260,143 | d40.08 |         28 |   $3,982 |      $0 |
| P84  | Insurance-First Player             | common    | horizon        | 2,687,459 | d41.58 |         32 |  $14,707 |  $7,600 |
| P85  | Insurance Too Late                 | risky     | horizon        | 4,268,975 | d36.83 |         32 |  $13,443 |  $3,100 |
| P86  | Never Hospital                     | risky     | horizon        | 3,633,986 | d38.33 |         32 |  $18,925 |      $0 |
| P87  | Immediate Hospital                 | edge      | horizon        | 3,356,219 | d40.08 |         32 |   $8,646 | $13,250 |
| P88  | Hospital Only When Health Below 15 | risky     | horizon        | 2,593,089 | d40.33 |         30 |  $13,603 |      $0 |
| P89  | Painkiller Reliant                 | common    | horizon        | 3,436,675 | d36.58 |         32 |   $3,162 | $15,150 |
| P90  | Medical Debt Panic                 | common    | horizon        | 2,827,732 | d40.50 |         32 |  $13,146 |      $0 |
| P91  | Financial Ruin Validator           | edge      | financial_ruin |   515,557 | d34.33 |         32 | $-20,024 | $21,024 |
| P92  | Stream Whenever Possible           | risky     | death          |     1,282 | Missed |          0 |      $47 |      $0 |
| P93  | Healthy-Only Streamer              | common    | horizon        | 2,786,399 | d45.33 |         31 |  $15,786 |      $0 |
| P94  | Early Grind, Late Coast            | optimizer | horizon        | 3,406,686 | d41.92 |         32 |  $17,650 |      $0 |
| P95  | Late Grind                         | optimizer | horizon        | 1,607,601 | d52.08 |         26 |  $25,709 |      $0 |
| P96  | Book-and-Game Collector            | edge      | horizon        | 2,151,583 | d41.08 |         30 |  $16,194 |      $0 |
| P97  | Room Buff Maxer                    | optimizer | horizon        | 2,721,788 | d45.08 |         32 |  $18,907 |      $0 |
| P98  | Minimalist No-Luxury Run           | common    | horizon        | 2,432,230 | d39.25 |         31 |  $14,123 |      $0 |
| P99  | Chaotic Item User                  | edge      | horizon        | 2,641,918 | d40.42 |         21 |   $1,210 |      $0 |
| P100 | Quit Streaming Boundary Validator  | edge      | quit_streaming |       100 | Missed |         32 |      $60 |      $0 |

## Behavior-axis comparisons

### Cadence model

| Group          | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| -------------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| local_times    |    3 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |          48,794 |               0.0 |               $-49 |        $16,431 |
| day_pattern    |    3 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |             988 |               0.0 |               $526 |             $0 |
| gap_pattern    |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |           7,780 |               0.0 |             $2,380 |             $0 |
| fixed_interval |   41 |       32 (78.0%) |        30 (73.2%) | 32 (78.0%) |       2,641,918 |              28.0 |            $14,123 |        $60,124 |
| phase_schedule |    2 |       2 (100.0%) |        2 (100.0%) | 2 (100.0%) |       2,507,144 |              29.0 |            $21,680 |             $0 |

### Care philosophy

| Group           | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| --------------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| worst_only      |    3 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |           7,780 |               0.0 |             $2,380 |            $49 |
| threshold       |   38 |       29 (76.3%) |        27 (71.1%) | 29 (76.3%) |       2,617,504 |              28.0 |            $13,523 |        $76,506 |
| priority        |    3 |        2 (66.7%) |         2 (66.7%) |  2 (66.7%) |       1,256,847 |              24.0 |            $23,174 |             $0 |
| health_reactive |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |       2,126,448 |              16.0 |            $30,098 |             $0 |
| critical_only   |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |           1,447 |               0.0 |             $5,123 |             $0 |
| top_up          |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |       2,779,999 |              31.0 |            $15,683 |             $0 |
| minimal         |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |           6,815 |               0.0 |               $693 |             $0 |
| rescue_learner  |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |           1,530 |               0.0 |               $606 |             $0 |
| rescue_exploit  |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |       3,352,221 |              14.0 |            $14,795 |             $0 |

### Nutrition knowledge

| Group            | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| ---------------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| ignore           |   44 |       29 (65.9%) |        27 (61.4%) | 29 (65.9%) |       2,203,659 |              24.5 |            $11,533 |        $76,555 |
| preference_first |    2 |        1 (50.0%) |         1 (50.0%) |  1 (50.0%) |       2,381,978 |              12.5 |             $9,129 |             $0 |
| protein_counter  |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |       4,250,065 |              31.0 |            $19,300 |             $0 |
| warning_hydrator |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |       4,017,855 |              32.0 |            $34,001 |             $0 |
| risk_minimizer   |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |       5,160,375 |              32.0 |            $27,259 |             $0 |
| cheap_food       |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |       3,267,859 |              31.0 |            $14,216 |             $0 |

### Spending intensity

| Group   | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| ------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| normal  |   37 |       23 (62.2%) |        22 (59.5%) | 23 (62.2%) |       2,126,448 |              25.0 |            $11,664 |        $47,931 |
| high    |    9 |        7 (77.8%) |         6 (66.7%) |  7 (77.8%) |       2,458,510 |              28.0 |             $3,982 |        $21,024 |
| minimal |    4 |       4 (100.0%) |        4 (100.0%) | 4 (100.0%) |       2,757,596 |              31.5 |            $14,415 |         $7,600 |

### Career strategy

| Group                | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| -------------------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| healthy_only         |    3 |        1 (33.3%) |         1 (33.3%) |  1 (33.3%) |             568 |               0.0 |               $245 |            $49 |
| casual               |   39 |       29 (74.4%) |        27 (69.2%) | 29 (74.4%) |       2,515,696 |              28.0 |            $13,443 |        $76,506 |
| stream_when_possible |    6 |        2 (33.3%) |         2 (33.3%) |  2 (33.3%) |           1,365 |               0.0 |             $2,825 |             $0 |
| early_grind          |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |       3,406,686 |              32.0 |            $17,650 |             $0 |
| late_grind           |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |       1,607,601 |              26.0 |            $25,709 |             $0 |

### Hospital strategy

| Group              | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| ------------------ | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| delayed_hospital   |    2 |        1 (50.0%) |         1 (50.0%) |  1 (50.0%) |       1,344,014 |              16.0 |             $7,329 |         $7,649 |
| painkiller         |    2 |        1 (50.0%) |         1 (50.0%) |  1 (50.0%) |       1,787,373 |              16.0 |             $1,526 |        $31,532 |
| hydrate            |   39 |       25 (64.1%) |        24 (61.5%) | 25 (64.1%) |       2,151,583 |              21.0 |            $13,146 |             $0 |
| wait               |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |       2,515,696 |              25.0 |            $18,376 |             $0 |
| critical_hospital  |    2 |       2 (100.0%) |        2 (100.0%) | 2 (100.0%) |       3,876,732 |              31.0 |            $20,431 |             $0 |
| immediate_hospital |    3 |       3 (100.0%) |         2 (66.7%) | 3 (100.0%) |       3,356,219 |              32.0 |             $8,646 |        $37,374 |
| never_hospital     |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |       3,633,986 |              32.0 |            $18,925 |             $0 |

### Rescue awareness

| Group                   | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| ----------------------- | ---: | ---------------: | ----------------: | ---------: | --------------: | ----------------: | -----------------: | -------------: |
| normal                  |   48 |       33 (68.8%) |        31 (64.6%) | 33 (68.8%) |       2,445,370 |              26.0 |            $13,295 |        $76,555 |
| relies_on_rescue        |    1 |         0 (0.0%) |          0 (0.0%) |   0 (0.0%) |           1,530 |               0.0 |               $606 |             $0 |
| tries_to_exploit_rescue |    1 |       1 (100.0%) |        1 (100.0%) | 1 (100.0%) |       3,352,221 |              14.0 |            $14,795 |             $0 |

## Physical survival, completion, recovery, and pressure

| Damage source                      | Raw need damage | Applied Health damage | Terminal cause appearances |
| ---------------------------------- | --------------: | --------------------: | -------------------------: |
| starving                           |           3,912 |                 3,912 |                         13 |
| sleep_deprived                     |           1,952 |                 1,952 |                         18 |
| kidney_stone                       |               0 |                 1,042 |                          1 |
| three_month_old_rotisserie_chicken |               0 |                   552 |                          2 |
| depressed                          |             209 |                   189 |                          4 |
| stood_up_too_fast                  |               0 |                    30 |                          0 |

| Status         | Exposure hours |
| -------------- | -------------: |
| hungry         |       54738.63 |
| sleep_deprived |       27933.15 |
| creative_block |       27711.13 |
| low_energy     |       19720.67 |
| starving       |       13840.70 |
| kidney_stone   |       13470.05 |
| dizzy_spell    |        9969.10 |
| depressed      |        5873.35 |
| overstimulated |        1096.22 |
| full           |         315.00 |
| lonely         |          74.00 |
| annoyed        |           3.00 |

16/50 profiles reached Health 8 or lower. 33/50 remained physically alive after receiving at least 20 points of cumulative Health recovery. Median time at Health 8 or lower was 0.00 hours.

## Care and visit behavior

The extension recorded 11,063 Food actions,
2,610 Rest actions, 1,615 Mood
actions, and 1,148 Bond actions. There were
924 attended
visits with no care action and
151 successful retry sessions.

## Nutrition counterplay

| ID  | Profile                     | Type      | Outcome |  Audience | Target | Min Health |    Cash | Debt |
| --- | --------------------------- | --------- | ------- | --------: | ------ | ---------: | ------: | ---: |
| P74 | Dr Pepper Main              | risky     | death   |       844 | Missed |          0 |    $436 |   $0 |
| P75 | Sugar-Blind Player          | common    | horizon | 1,993,722 | d37.92 |         26 | $11,401 |   $0 |
| P76 | Protein Counterplayer       | optimizer | horizon | 4,250,065 | d40.75 |         31 | $19,300 |   $0 |
| P77 | Salt-Blind Player           | common    | horizon | 2,515,696 | d41.42 |         25 | $18,376 |   $0 |
| P78 | Warning-Responsive Hydrator | common    | horizon | 4,017,855 | d36.50 |         32 | $34,001 |   $0 |
| P79 | Nutrition Min-Maxer         | optimizer | horizon | 5,160,375 | d40.92 |         32 | $27,259 |   $0 |

Across the heterogeneous profiles, the engine produced
377
Sugar Crash warnings,
352
actual crashes,
94
protein cancellations, and
106
Kidney Stone onsets.

## Rescue reliance and ordinary autonomy

| ID  | Profile                     | Type      | Outcome |  Audience | Target | Min Health |    Cash | Debt |
| --- | --------------------------- | --------- | ------- | --------: | ------ | ---------: | ------: | ---: |
| P69 | Rescue Learner              | edge      | death   |     1,530 | Missed |          0 |    $606 |   $0 |
| P70 | Rescue Exploiter            | edge      | horizon | 3,352,221 | d38.00 |         14 | $14,795 |   $0 |
| P71 | Empty Pantry Procrastinator | risky     | death   |    87,358 | Missed |          0 |  $4,259 |   $0 |
| P96 | Book-and-Game Collector     | edge      | horizon | 2,151,583 | d41.08 |         30 | $16,194 |   $0 |
| P97 | Room Buff Maxer             | optimizer | horizon | 2,721,788 | d45.08 |         32 | $18,907 |   $0 |
| P98 | Minimalist No-Luxury Run    | common    | horizon | 2,432,230 | d39.25 |         31 | $14,123 |   $0 |

Food rescues totaled
783 and Rest rescues
totaled 613. Player
actions reset 772
Food locks and
600
Rest locks. The result contract records physical survival for 12/24 hours after rescue;
that is a timing measure, not a causal claim that the rescue prevented death.

## Hospital and medical economy

| ID  | Profile                            | Type   | Outcome        |  Audience | Target | Min Health |     Cash |    Debt |
| --- | ---------------------------------- | ------ | -------------- | --------: | ------ | ---------: | -------: | ------: |
| P84 | Insurance-First Player             | common | horizon        | 2,687,459 | d41.58 |         32 |  $14,707 |  $7,600 |
| P85 | Insurance Too Late                 | risky  | horizon        | 4,268,975 | d36.83 |         32 |  $13,443 |  $3,100 |
| P86 | Never Hospital                     | risky  | horizon        | 3,633,986 | d38.33 |         32 |  $18,925 |      $0 |
| P87 | Immediate Hospital                 | edge   | horizon        | 3,356,219 | d40.08 |         32 |   $8,646 | $13,250 |
| P88 | Hospital Only When Health Below 15 | risky  | horizon        | 2,593,089 | d40.33 |         30 |  $13,603 |      $0 |
| P89 | Painkiller Reliant                 | common | horizon        | 3,436,675 | d36.58 |         32 |   $3,162 | $15,150 |
| P90 | Medical Debt Panic                 | common | horizon        | 2,827,732 | d40.50 |         32 |  $13,146 |      $0 |
| P91 | Financial Ruin Validator           | edge   | financial_ruin |   515,557 | d34.33 |         32 | $-20,024 | $21,024 |

The extension created
17 bills, made
206
scheduled payments and
0 discounted
full payments, ending with
$56,372 in
explicit principal.

| Source                    |      Total |
| ------------------------- | ---------: |
| Income: stream            |   $641,466 |
| Income: donations         |   $701,202 |
| Income: subscriberRevenue |   $256,379 |
| Income: offStreamSupport  |   $206,731 |
| Income: appearances       |    $39,500 |
| Income: commissions       |         $0 |
| Income: projects          |     $2,035 |
| Income: lifeEvents        |   $122,979 |
| Income: lineOfCredit      |         $0 |
| Income: other             |         $0 |
| Expense: shop             |  −$276,791 |
| Expense: hospital         |  −$120,543 |
| Expense: lifeEvents       |   −$42,727 |
| Expense: lineOfCredit     |        −$0 |
| Expense: other            |        −$0 |
| Combined starting cash    |     $6,000 |
| Combined ending cash      | $1,536,231 |

### Debt and Line of Credit diagnostics

| Financial diagnostic                        |        Result |
| ------------------------------------------- | ------------: |
| Runs entering In Debt                       |             8 |
| Median peak total debt (all runs)           |            $0 |
| Median peak total debt (debt-positive runs) |       $10,000 |
| Median peak total debt (In Debt runs)       |          $373 |
| Maximum peak total debt                     |       $26,050 |
| Total In Debt exposure                      | 1336.75 hours |
| Crossed $10,000 total debt                  |       17 runs |
| Crossed $15,000 total debt                  |        8 runs |
| Crossed $20,000 total debt                  |        4 runs |
| LOC uptake                                  |        0 runs |
| LOC repayment units purchased               |             0 |
| LOC remaining closure cost                  |            $0 |

| Credit spending category | Amount financed into negative cash |
| ------------------------ | ---------------------------------: |
| reusable                 |                            $17,519 |
| decoration               |                             $8,220 |
| upgrade                  |                             $5,280 |
| food                     |                             $1,616 |
| care                     |                               $942 |
| medicine                 |                               $133 |

### VTuber-life events

| Life event            | Resolutions | Net metric effects | Net cash | Net subscribers | Outcomes                      |
| --------------------- | ----------: | ------------------ | -------: | --------------: | ----------------------------- |
| rain                  |         243 | mood -241          |        0 |               0 | —                             |
| personal_purchase     |         130 | mood +127          |   -5,989 |               0 | —                             |
| algorithm_boost       |         105 | —                  |        0 |               0 | —                             |
| sponsored_stream_deal |         105 | —                  | +122,979 |               0 | —                             |
| equipment_failure     |          56 | —                  |  -14,832 |               0 | —                             |
| tax_bill              |          44 | —                  |  -21,906 |               0 | —                             |
| twitter_cancellation  |          35 | —                  |        0 |        -267,923 | minor×24, moderate×9, major×2 |
| agency_invitation     |           1 | —                  |        0 |        +100,000 | —                             |

| Metric     | Additions | Losses |
| ---------- | --------: | -----: |
| food       |        +0 |     −0 |
| health     |        +0 |     −0 |
| mood       |      +127 |   −241 |
| rest       |        +0 |     −0 |
| bond       |        +0 |     −0 |
| creativity |        +0 |     −0 |

Cash additions were $122,979;
cash subtractions were $42,727.
Subscriber additions were 100,000;
Subscriber losses were 267,923.
The study observed 106
temporary natural-discovery boosts across
2667.25 exposure-hours.

### Life-event scheduler counters

| Scheduler diagnostic           |   Total |
| ------------------------------ | ------: |
| 30-minute boundaries processed | 237,280 |
| Multi-success boundaries       |       1 |
| Suppressed repeat Agency rolls |       0 |

| Successful life-event roll | Count |
| -------------------------- | ----: |
| rain                       |   243 |
| personal_purchase          |   130 |
| algorithm_boost            |   105 |
| sponsored_stream_deal      |   105 |
| equipment_failure          |    56 |
| tax_bill                   |    44 |
| twitter_cancellation       |    35 |
| agency_invitation          |     1 |

### Rotisserie Chicken exposure and outcomes

| Rotisserie Chicken diagnostic                   | Total |
| ----------------------------------------------- | ----: |
| Runs with a Shop appearance                     |    93 |
| Runs with a purchase                            |    69 |
| Shop appearances                                |   225 |
| Purchase events                                 |    69 |
| Purchased units                                 |    69 |
| Manual uses                                     |    65 |
| Automatic stream-snack uses                     |     4 |
| Attributed Health damage                        |   552 |
| Lethal uses                                     |     2 |
| Deaths within 24 hours of any use (correlation) |     2 |

## Career aggression

| ID  | Profile                  | Type      | Outcome |  Audience | Target | Min Health |    Cash | Debt |
| --- | ------------------------ | --------- | ------- | --------: | ------ | ---------: | ------: | ---: |
| P92 | Stream Whenever Possible | risky     | death   |     1,282 | Missed |          0 |     $47 |   $0 |
| P93 | Healthy-Only Streamer    | common    | horizon | 2,786,399 | d45.33 |         31 | $15,786 |   $0 |
| P94 | Early Grind, Late Coast  | optimizer | horizon | 3,406,686 | d41.92 |         32 | $17,650 |   $0 |
| P95 | Late Grind               | optimizer | horizon | 1,607,601 | d52.08 |         26 | $25,709 |   $0 |

## Balance-question analysis

1. **Max Health:** common-profile physical survival is 65.0% and risky-profile physical survival is 46.7%. This baseline alone does not authorize lowering Health; use the paired 30 HP run for causality.
2. **Recovery:** 33 physically alive profiles recovered at least 20 Health cumulatively; inspect their minimum Health and critical-hours fields before attributing survival to the cap.
3. **Rescue strength:** 1/3 rescue-stress profiles completed 60 days, with 141 successful rescues.
4. **Positive autonomy:** P96/P97/P98 provide collector, room, and minimalist outcomes in the comparison table; autonomous Mood, injury, movement, and side-gig fields remain available per run.
5. **Hospital viability:** 5/6 Hospital-oriented profiles completed 60 days and ended with $24,950 principal.
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
