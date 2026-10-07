# Game mechanics overview

A short guide for game designers. For the full rules, read `docs/GAME_RULES.md`.

## The run

- You care for one companion who is a streamer.
- Each run is one life. The run does not save, restart, or reset.
- A run ends permanently with one Ending.
- All chance uses a seed. The same seed and the same actions give the same result.

## Metrics

| Metric     | Range | Start |
| ---------- | ----: | ----: |
| Health     |  0–30 |    24 |
| Food       |  0–10 |     6 |
| Mood       |  0–10 |     6 |
| Rest       |  0–10 |     7 |
| Bond       |  0–10 |     4 |
| Creativity |  0–10 |     3 |

- All values stay in their range.
- A critical condition is Health 1–8, or Food, Rest, or Mood at 0–2.
- Bond and Creativity are never critical.
- Start money: $60.
- Start Subscribers: 100.
- Start items: 1 Water, 1 Uncrustables, 1 Pretzel, 1 Five Plain Tortillas.

## Endings

| Ending         | Cause                                        |
| -------------- | -------------------------------------------- |
| Death          | Health gets to 0                             |
| Quit Streaming | Mood stays at 0 for 72 hours without a break |
| Financial Ruin | Balance falls to −$20,000 or lower           |
| Made It        | Subscribers get to 3,000,000                 |

- The game warns about Quit Streaming at 0, 24, and 48 hours.
- Mood above 0 stops the Quit Streaming count.
- Financial Ruin has no warning. Unpaid bills do not count toward it.
- If Death and another Ending occur together, Death wins.

## Time

- **Realtime mode:** game time follows real time. The game calculates missed time when you come back.
- **Streaming mode:** time moves only with timed actions or Advance Time.
- Advance Time choices: Random, 1, 3, 6, or 12 hours.
- Random wait: 1–12 hours. If the companion is already critical, 1–2 hours.
- A wait stops early when a new critical condition starts.
- The first new critical condition during a wait cannot kill the companion.
- If the companion is already critical, there is no protection.

## Needs decay (every 2 hours)

- Food: −1 at 90% chance when awake. −1 at 67.5% chance during Rest.
- Rest: −1 when awake. This includes streams, Hospital, and Commission Work.
- Bond: −1 after 48 hours with no Bond gain.
- Socialize and Play stop Food, Rest, and Bond decay.

## Health (every 2 hours)

- Rest, Socialize, Play, and Hospital stop the Health check.
- Streams and Commission Work do not stop it.

**Recovery:** add the points above 5 for Food, Rest, and Mood.

| Recovery score | Health |
| -------------: | -----: |
|            0–3 |      0 |
|            4–6 |     +1 |
|           7–15 |     +2 |

**Damage:**

- Food, Rest, or Mood at 0–2: −1 Health each.
- Maximum damage is −2 each check.
- Money and debt do not change Health.

**Low Health penalty:**

- At Health 1–8, a change to Food, Rest, Bond, or Creativity can also give Mood −1.
- This penalty occurs one time each 12 hours maximum.

## Statuses

Statuses stay until a metric, item, or action clears them.

| Status         | Starts at           | Onset effect  | Clears at        |
| -------------- | ------------------- | ------------- | ---------------- |
| Starving       | Food 0–2            | —             | Food 5           |
| Hungry         | Food 3–4            | —             | Food 5           |
| Sleep Deprived | Rest 0–2            | —             | Rest 5           |
| Depressed      | Mood 0–2            | —             | Mood 5           |
| Lonely         | Bond 0–2            | Mood −1       | Bond 5           |
| Creative Block | Creativity 0–2      | Mood −1       | Creativity 5     |
| Low Energy     | Food + Rest below 6 | Creativity −1 | Food + Rest is 8 |
| Full           | Food 9–10           | —             | Food 7           |

- Lonely and Creative Block give Mood −1 again each 12 hours while the metric is 0–2.

### Sick

- Cause: eat while Full. 35% chance.
- While Full, food gives no Food gain. Other effects stay.
- Onset: Health −1, Mood −2.
- Effect: +25 percentage points to food refusal chance.
- Clears when:
  - Rest ends with Food 5 or less and Health 5 or more.
  - Hospital completes.
  - 48 hours pass.

### Kidney Stone

- Cause: high salt and low water in the last 10 foods (salt 10 or more, water 2 or less). 5% chance each feed.
- Warning at salt 6 or more with water 2 or less.
- Onset: Mood −1, Health −1, Rest −2.
- Each 12 hours: Health −1, Rest −1.
- Each 48 hours: 50% chance to pass. A pass gives Mood +1.
- Hospital clears it.
- Painkillers ($7) stop the 12-hour damage for 12 hours. They do not clear the stone.

### Dizzy Spell

- Cannot start in the first 24 hours.
- Cause: low salt (0–3). 35% chance at each Health check.
- Onset: Rest −1, Mood −1.
- Clears at salt 5 or more and water 4 or more.

### Lost Voice

- Cause: a stream longer than 8 hours ends. 25% chance.
- Effect: stops streams.
- Clears when:
  - Any Rest ends.
  - The companion eats Honey or drinks Tea.
  - 24–48 hours pass.

### Overstimulated

- Cause: a Mood gain when Mood is 9–10.
- Effect: the Mood gain changes to Mood −4.
- Clears after 2 hours with no interaction, at the end of Rest, or with Headphones.

### Annoyed

- Cause: 3–5 refusals in a row. Each run selects the number secretly.
- The game warns one refusal before onset.
- Onset: Mood −2.
- Effect: +50 percentage points to Socialize and Play refusal.
- Clears after 3 hours with no interaction, or with the Giant Plushie.

### Sugar Crash

- Effective sugar is sugar minus protein in the last 6 hours.
- Effective sugar 4 or more starts a crash 2 hours later.
- Protein can cancel the crash.
- Crash: Mood −2, Rest −1.
- Rest clears it.

### Other timed effects

- **Caffeine** (score 2 or more): the next Rest loss occurs 2 hours later.
- **Hyperfocus** (Limited-Edition Dr Pepper): Creativity is 10 for 6 hours. At the end: Creativity −2, Rest −2.

## Companion actions

- The companion can refuse an action.
- An action stops if a new critical condition starts. An interrupted action gives no completion reward.

### Rest

| Start Rest | Duration                     |
| ---------: | ---------------------------- |
|        0–2 | 7–9 hours                    |
|        3–5 | 6–8 hours                    |
|        6–7 | 4–6 hours                    |
|          8 | 80% refusal, else 4–6 hours  |
|          9 | 90% refusal, else 4–6 hours  |
|         10 | Always refused               |

- Gain: Rest +1 each hour.
- Gain: Mood +1 for each 6 Rest recovered.

### Socialize and Play

| Action    | Duration      | Reward               |
| --------- | ------------- | -------------------- |
| Socialize | 15–60 minutes | Bond +1, Creativity +1 |
| Play      | 1–3 hours     | Bond +1, Mood +1       |

- 25% chance of a strong result: the second reward is +2.
- Refusal chance:
  - +20 percentage points at Mood 0–2.
  - +20 percentage points at Rest 0–2.
  - +50 percentage points when Annoyed.
  - Maximum 90%.
- The same action two times in a row gives only Bond +1.

### Hospital

- Available when Sick or Kidney Stone is active.
- Duration: 12 hours.
- Result: clears Sick and Kidney Stone. Health +4, Food +3, Rest +3.
- Cost with an Insurance Card: $500, paid at $25 each day.
- Cost without a card: $10,000, paid at $150 each day.
- Daily payments do not take the Balance below $0.
- Pay all medical debt at one time: 85% of the remainder.

### Commission Work

- Needs the Rigging Tablet and Creativity 4 or more.
- Not available when Sleep Deprived or Depressed.
- One time each day.
- Duration: 6 hours.
- Pay: $40 + $15 × Creativity.
- Cost: Rest −2, Creativity −1, Mood −1 or 0.

## Food

- Liked food: Mood +1 minimum.
- Disliked food: has a refusal chance and a Mood penalty.
- Refused food: 50% chance to be wasted.
- Water: Food +1, Health +1.
- Cravings: the companion wants one Liked food. Eating it gives Bond +1. A craving ends after 24 hours.
- Emergency: at Food or Rest 0–2, the companion can eat a Liked food or start Rest without the player.

## Random events (every 2 hours)

| Event                | Weight | Effect                               |
| -------------------- | -----: | ------------------------------------ |
| Nothing              |    100 | —                                    |
| Low money stress     |     20 | Below $10                            |
| Food craving         |     20 | —                                    |
| Creative inspiration |     15 | Creativity +1                        |
| Socks (the cat)      |    15+ | Mood −1 or +1                        |
| Room event           |     10 | —                                    |
| Self-entertainment   |      5 | Mood +1                              |
| Stood up too fast    |      3 | None, Rest −1, or Health −1          |
| Full-body commission |      5 | $400–$800 after 3 days               |
| Mom's Care Package   |      5 | 2 Liked foods, Mood +1               |
| Offline donation     |     10 | $5–$40                               |
| Autonomous stream    | varies | See Streaming                        |

- Items can add more events. Examples:
  - Drawing Tablet side gig: $20–$60.
  - Merch Sample: $15–$50.
  - Can Opener accident: 90% Mood +1, 9% Health −1, 1% Health −2.

## Streaming

- The player cannot start a stream. The companion starts streams randomly.
- Starving, Sleep Deprived, Sick, Kidney Stone, Depressed, and Lost Voice stop streams.
- Higher Mood and Creativity make streams more likely.
- If there is no stream for 12 hours, the chance increases each hour. The increase stops at 62 hours.

**Time of day:**

| Time        | Stream chance |
| ----------- | ------------: |
| 04:00–08:59 |          ×0.5 |
| 13:00–19:59 |          ×1.5 |
| Other       |            ×1 |

- June 29 and November 14: stream chance ×2.

**Duration:**

- 1–12 hours, minus (10 − Rest).
- A stream stops at midnight.
- During a stream, Food does not go below 2.

**Income:** hourly rate × hours × (0.5 + Creativity ÷ 10).

| Creativity | Income multiplier |
| ---------: | ----------------: |
|          0 |              ×0.5 |
|          5 |                ×1 |
|         10 |              ×1.5 |

**End of stream:** Creativity −1, Rest −1, Mood −1, 0, or +1.

### Donations

- One roll each hour of stream.
- Chance: 2% + 0.5% × Creativity.
- June 29 and November 14: chance ×3.

| Donation        | Weight |      Amount | Subscribers |
| --------------- | -----: | ----------: | ----------: |
| Kind supporter  |     58 |     $10–$40 |          +5 |
| Raid windfall   |     30 |    $60–$200 |          +5 |
| Major donor     |     10 | $400–$1,000 |         +30 |
| Legendary donor |      2 | $2,000–$5,000 |       +30 |

- Legendary needs Creativity 10.

## Subscribers

- Subscribers grow every 2 hours.
- Growth = career tier rate + stream bonus.
- Each stream adds a bonus for 7 days: tier rate × (1 + Creativity × 0.02).
- The 4 oldest stream bonuses count ×1. More bonuses count ×0.25.
- **Clippers** ($29): +50 × tier number × stacks each day for 3 days.
- **Peak Subscribers** never go down. Rewards use the peak.

### Career ladder

| Peak    | Tier                  | Growth per 2 h | Revenue | Reward                          |
| ------: | --------------------- | -------------: | ------: | ------------------------------- |
|     100 | Debut                 |             +1 |      ×1 | Start                           |
|     150 | First Model           |             +2 |      ×1 | Model 1 unlocked                |
|   1,000 | 1K                    |            +10 |      ×1 | Stream rate $9–$16, Mood +2     |
|   5,000 | Model Redesign        |            +20 |      ×1 | Model 2 unlocked                |
|  10,000 | Twitch Partner        |            +60 |      ×1 | Stream rate $12–$20             |
|  30,000 | 30K                   |            +80 |    ×1.5 | —                               |
|  40,000 | Tournament Appearance |           +100 |    ×1.5 | Model 3, 8-hour stream (donations ×3) |
|  50,000 | 50K                   |           +150 |      ×2 | —                               |
|  75,000 | Convention Guest      |           +200 |      ×2 | $500, Convention Guest Set      |
| 100,000 | 100K                  |           +300 |      ×3 | —                               |
| 150,000 | 3D Ready              |           +400 |      ×3 | Model 4 unlocked                |
| 200,000 | 200K                  |           +500 |      ×4 | —                               |
| 250,000 | 250K                  |         +1,000 |      ×5 | —                               |
| 500,000 | 500K                  |         +2,000 |      ×7 | —                               |
| 1,000,000 | 1M                  |         +2,000 |     ×10 | —                               |

- Start stream rate: $6–$12 each hour.

### Subscriber Revenue

- Paid every 2 hours. Always active.
- Amount: $1 × Revenue multiplier.
- Minimum: $2 below 30K, $3 at 30K or more.

### New Model Commission

- Cost: $3,500. One for each unlocked model tier.
- Completes after 3 days.
- Reward: Mood +3, Creativity +2, Subscribers +50, new look, 4-hour debut stream.
- Model 4 (3D Debut): donation chance +1 percentage point permanently.
- 3D model commissions ($10,000, $17,500, $25,000) use the same rules for now.

### Merch runs

| Merch run | Cost   | Payout          |
| --------- | -----: | --------------: |
| Small     | $3,000 | ×1.2–1.4 of cost |
| Standard  | $5,500 | ×1.3–1.6 of cost |
| Full      | $8,000 | ×1.4–1.8 of cost |

- Paid in equal parts each midnight for 60 days.
- 15% chance to flop: payout ×0.5 and Mood −1.
- One merch run at a time.

### Convention appearances

| Convention | Cost   | Subscribers                 |
| ---------- | -----: | --------------------------- |
| Local      | $2,000 | +3% of peak, minimum +100   |
| Regional   | $3,000 | +5% of peak, minimum +200   |
| Major      | $4,000 | +8% of peak, minimum +400   |

- Needs the Convention Guest tier.
- Each convention one time each run. One trip at a time.
- Completes at the next midnight: Mood +2, Rest −2.

## Money and debt

- **In Debt** shows when Balance is below $0. It has no penalty.
- Shop rule: if Balance is $0 or more, you cannot spend below $0.
- If Balance is already below $0, you can buy more.
- **Line of Credit** (one time): costs $50, gives $10,000. Repay with 20 payments of $600. Total net cost: $2,050.

### Life events (checked every 30 minutes)

| Event                | Effect                                  |
| -------------------- | --------------------------------------- |
| Tax bill             | −$100 to −$1,000. Only at Balance $0+   |
| Equipment Failure    | −$30 to −$500. Only at Balance $0+      |
| Twitter cancellation | Subscribers −1%, −2%, or −3%            |
| Rain                 | Mood −1                                 |
| Personal purchase    | Buys one affordable item, Mood +1       |
| Sponsored stream     | +$250 to +$1,500                        |
| Agency debut (once)  | Subscribers +100,000, growth ×1.5 for 7 days |
| Algorithm boost      | Growth ×1.5 for 1 day                   |

- Agency and Algorithm boosts together: growth ×2.25.

## Shop and room

- 258 items: 140 Food, 2 Medicine, 2 Care, 74 Reusable, 18 Upgrade, 22 Decoration.
- The shop changes each day at midnight: 24 items.
  - 12 Food.
  - 2 Medicine or Care.
  - 4 Reusable.
  - 3 Upgrade.
  - 3 Decoration.
- Each shop always has Water, one cheap food, and one hydration item.
- Stock: 1–5 of each item.
- Items with actions are used up after one use.
- Placed room furniture stays and can give permanent effects.
- Removing furniture removes its effect.
- The room's furniture art comes in 8 sets, one per Subscriber Revenue step (×1 is set 1, ×10 is set 8).
- Posters ($200 each: Umi, Selfcest, Booger, Wife, RVB, Glee, Socks) go in the Poster spot and change the wall poster. No stat effect.
- Bunny Pixie ($3,500, unlocks at Model Redesign) goes in the Avatar spot and switches the room avatar. No stat effect.

## Companion speech

- The companion can say a quote on tap, each hour, or after events.
- The companion is silent during Rest, Hospital, and after the run ends.
- Quotes do not change the game.
