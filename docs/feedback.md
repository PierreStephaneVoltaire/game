# Balance Requirements — 60-Day Fairness Pass (v2)

Status: DRAFT for owner review — pick one option per requirement unless marked "all".
Source data: 50-run seeded diagnosis (2026-08-24) + economy appendix.
No requirement here changes the core fantasy: neglect is dangerous, death is
permanent, care matters, min-maxing is not required to "win."

---

## 0. Design goals (acceptance criteria for the next 50-run batch)

These are the numbers the next simulation batch must hit. Every requirement
below exists to serve one of these rows.

| ID  | Goal                                       | Current             | Target                          |
| --- | ------------------------------------------ | ------------------- | ------------------------------- |
| G1  | Casual (3–6 check-ins/day) 60-day survival | 50%                 | ≥ 85%                           |
| G2  | Focused survival                           | 58%                 | ≥ 90%                           |
| G3  | 50%-neglect survival                       | 0% (median d5.39)   | ≤ 10%, median death ≥ day 12    |
| G4  | Full AFK (zero input) time-to-death        | ~1–2 days           | ~2.5–3 days                     |
| G5  | 1M subs reachable by Focused play          | 979K median (surv.) | ≥ 50% of Focused survivors ≥ 1M |
| G6  | Optimal overshoot                          | 7.8M median         | ≤ ~2.5M median                  |
| G7  | Hospital use is survivable                 | 0/14 survived       | Hospital users ≈ cohort average |
| G8  | Neglect stays punished                     | yes                 | unchanged (see G3)              |

> Note: G5 intentionally disagrees with the Codex report, which balanced
> toward 250K/500K/1M per profile. Owner goal is 1M with reasonable effort.

---

## P0 — Survival reliability (starvation & damage stacking)

Starvation caused 19/24 deaths. Depression 11, sleep deprivation 8 (overlap).
The failure mode is stacked −1/−2s per check, exactly as identified in the
brainstorm ("I'm stacking too many debuffs"). Fix the _stacking_, not the
individual rates.

### SURV-1: Cap combined periodic Health damage per unprotected check — **REQUIRED**

Cap the summed need damage (Food + Rest + Mood contributions) applied at any
single 2-hour Health check.

| Option | Cap                                                           | Full-AFK death (from start, H32) | Mid-run collapse (H40) | Notes                                                     |
| ------ | ------------------------------------------------------------- | -------------------------------- | ---------------------- | --------------------------------------------------------- |
| A ✅   | −2                                                            | ~hour 46–50                      | ~2.5 days              | Matches owner's stated "2 bad days, 3 for a terrible run" |
| B      | −3                                                            | ~hour 36                         | ~1.7 days              | Harsher; only if G3 fails with A                          |
| C      | Escalation: −1/check for first 24h a need sits at 0, −2 after | ~hour 60+                        | ~3 days                | More sim work; more "realistic" ramp                      |

- Kidney Stone recurrence, Sick, and onset damage stay **outside** the cap
  (they are event damage, not periodic-need damage). This keeps illness scary.
- Recovery still applies before clamping, unchanged.

### SURV-2: Reduce Food pressure — pick ONE

| Option | Change                                                                               | Effect                            | Notes                                                           |
| ------ | ------------------------------------------------------------------------------------ | --------------------------------- | --------------------------------------------------------------- |
| A ✅   | Food decay chance 0.75 → 0.65                                                        | 9 → 7.8 Food/day awake            | Codex-recommended; smallest blast radius; NOT yet engine-tested |
| B      | Food loses 1 every 2h at 60%, but never twice in a row (guaranteed skip after a hit) | ~7.5/day, lower variance          | Kills unlucky streaks that snowball Casual runs                 |
| C      | Keep 0.75; raise starting Food 6 → 8 and make cheap staples give +1 more Food        | Same steady-state, softer opening | Weakest option; day-20+ deaths unaffected                       |

### SURV-3: Autonomous emergency eating (parity with autonomous Rest)

Rest 0–2 already triggers autonomous Rest at weight 40. There is no food
equivalent, which is why a 3-visit/day Casual player can starve between
sessions while owning food.

- New autonomous candidate: **Autonomous Snack**, weight 40, eligible at
  Food 0–2 when a Liked or Variable food is owned and no activity is running.
- Uses all ordinary feed rules (salt/water window, Full, Sick, refusal).
- Does NOT trigger when inventory is empty → neglect runs (who don't shop)
  still starve. This is the mechanism that protects G3 while fixing G1.
- Option: gate behind a cheap Upgrade ("Snack Stash", ~$15) if you want it to
  be an earned safety net rather than a freebie.

### SURV-4: Remove the low-Health death-spiral amplifier — pick ONE

Current rule: at Health 1–8, any Food/Rest/Bond/Creativity change also costs
Mood −1. This converts "injured" into "injured and spiraling."

| Option                                                                                                          | Change                                                                       |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A                                                                                                               | Delete the rule entirely                                                     |
| B ✅                                                                                                            | Keep it, but at most once per 12 game-hours                                  |
| C (i like c but mood being 10 means it'll get maxed even when the other stats are up so b would be appropriate) | Invert it: at Health 1–8, care actions grant +1 extra Mood (comeback window) |

---

## P0 — Hospital & medical debt loop

Evidence: all 14 non-neglect Hospital users died; $132,000 total charges vs
$75,404 total shop spending; 8 post-Hospital re-onsets, 2 at the exact
completion timestamp. Both MED-1 and MED-2 are required; MED-2 offers flavors.

### MED-1: Hospital completion clears the ten-feed Kidney Stone risk window — **REQUIRED**

Directly removes the instant re-onset loop. Narratively trivial ("they put her
on IV fluids"). Codex recommendation #1 — accept as-is. (fine but elapsed time should still happen)

### MED-2: Fix the bill — pick ONE

| Option                          | Design                                                                                                                                          | Uninsured worst case  | Notes                                                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A ✅ Payment plan               | Bill converts to a daily auto-deduction of $150/day (insured: $25/day) until paid. No lump-sum debt, no recovery-score hit from the plan itself | $10,000 over ~67 days | Preserves the "medical debt hangs over you" theme without the death spiral. Missable flavor: skipping shows a nag Journey line, not damage |
| B Sliding scale                 | Charge = clamp($500, 25% of lifetime earnings, $10,000)                                                                                         | scales with run       | Early players pay ~$500–1,500; late players feel it. "Financial aid office" flavor                                                         |
| C Cheaper flat + real insurance | Uninsured $2,000; Insurance Card $150, **not consumed**, covers the whole run                                                                   | $2,000                | Simplest; makes the card an obvious must-buy (may be fine)                                                                                 |
| D Socialized medicine           | Flat $500 for everyone, remove Insurance Card                                                                                                   | $500                  | The Discord joke option; kills an item and a decision, but it _is_ Canadian                                                                |

### MED-3: Debt penalty ceiling

Keep the recovery-score reduction `floor(|balance|/2500)` but lower the cap
from 3 → **2**, so a deep-debt companion can still recover +0 to +2 Health
with excellent care instead of being hard-locked at 0 recovery.

> ⚠️ Consistency check: the Discord convo describes "Mood −1 per 2h at $10K
> debt," but the rules doc only specifies the recovery-score reduction. If the
> Mood drain still exists in code, **remove it** — the recovery-score version
> is the surviving design.

### MED-4 (optional): Financial Ruin ending

From the endings brainstorm (death / quitting / debt). If debt exceeds
$20,000 for 7 consecutive local days → non-death ending "Financial Ruin."
Gives debt a narrative ceiling instead of an unwinnable grind. Skip if you
want money to never be terminal.

---

## P1 — Kidney Stone tuning

The 5% roll is honest (measured 5.17%) — do not touch the probability.
Adjust exposure and duration.

| ID   | Change                                                                                                                          | Pick                                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| KS-1 | Salt threshold 8 → **10** (removes ~23% of observed onset windows; hydration still matters)                                     | ✅ recommended                                                                                                                           |
| KS-2 | Natural passage: 72h @ 50% → **48h @ 50%** (expected duration 144h → 96h)                                                       | ✅ recommended — makes "hydrate and wait" the intended path, which the data already shows works (1 stone across 7 non-neglect hydrators) |
| KS-3 | Salt threshold 12 instead (removes ~43%)                                                                                        | only if KS-1 + hydration UI still produce >0.5 stones/run                                                                                |
| KS-4 | Rolling-risk indicator: a qualitative UI hint ("her diet's been salty lately… maybe water?") when window salt ≥ 6 and water ≤ 2 | ✅ recommended — the trigger firing on Lettuce is invisible-rules frustration, not difficulty                                            |
| KS-5 | Painkillers surfaced in the stone-onset Journey line ("$7 painkillers would take the edge off")                                 | cheap win                                                                                                                                |

---

## P1 — Growth curve & the 1M target

Diagnosis: 99.79% of growth is natural tier-rate × stacked 7-day stream
boosts. Optimal carries ~9.3 simultaneous boosts vs 2.9/3.6 for Casual/Focused.
The overshoot is a _stacking_ problem. Fix stacking first, tiers second.

### GROW-1: Cap simultaneous 7-day stream contributions — pick ONE

| Option | Design                                                          | Est. effect                                                                                          |
| ------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A ✅   | Hard cap: only the **4 most recent** stream contributions count | Casual/Focused nearly untouched (2.9/3.6 median load); Optimal growth roughly halved → ~3M territory |
| B      | Soft cap: boosts 1–4 at 100%, every boost beyond at 25%         | Smoother, preserves "streaming more always helps a little"                                           |
| C      | Boost duration 7 → 4 days                                       | Hits Casual/Focused too (they rely on long tails between sessions) — not recommended                 |

### GROW-2: High-tier rate adjustment — SECOND experiment, only after GROW-1 is measured

Do **not** apply Codex's flat-500 (it drops Focused to 596K and fails G5).
If GROW-1 alone leaves Optimal > 2.5M:

| Option | 250K / 500K / 1M tier rates | Intent                                                    |
| ------ | --------------------------- | --------------------------------------------------------- |
| A ✅   | 1,000 / 1,200 / 1,200       | Gentle flattening; Focused keeps its late-game push to 1M |
| B      | 750 / 1,000 / 1,000         | If A still overshoots                                     |

### GROW-3: Clippers — make the $25 mean something (P2)

| Option | Design                                                                                     |
| ------ | ------------------------------------------------------------------------------------------ |
| A ✅   | `followersPerTierPerStack` 50 → **250** (Codex suggestion; still < 2% of natural growth)   |
| B      | Percentage-based: each stack pays 0.5% of current Followers per daily tick, cap 2,500/tick |
| C      | Leave decorative, reprice at $10, reframe as flavor                                        |

> Reminder: much of the "growth problem" was actually the death problem —
> half of Casual runs dying dragged the all-run median from 716K to 229K.
> Re-run growth measurements ONLY after P0 survival fixes land, or you will
> tune growth against corpses.

---

## P2 — Sugar Crash frequency

1,213 occurrences (~0.59/day) totaling Mood −2,426 / Rest −1,213 — the most
frequent harmful pattern in the logs, and a stream blocker feeder.

| Option | Change                                                                   |
| ------ | ------------------------------------------------------------------------ |
| A ✅   | Threshold 3 → 4 sugar servings per rolling 6h (Dr Pepper still counts 2) |
| B      | Keep threshold; severity Mood −2/Rest −1 → Mood −1/Rest −1               |
| C      | Protein 2–3 also cancels a _scheduled_ (not just active) crash           |

A + C together is fine; don't take all three.

---

## P2 — Neglect curve & alternative endings

With SURV-1..4 in place, re-measure the 50%-neglect cohort against G3
(median death ≥ day 12, survival ≤ 10%). Then optionally:

- **END-1 (from brainstorm): "She Quit Streaming"** — if Mood has been 0 for a
  cumulative 72 game-hours within any 7-day window, the run ends non-fatally.
  Bedrot ending. Replaces some depression _deaths_ with a softer failure while
  keeping the run terminal (still no restart/save).
- **END-2:** Financial Ruin (see MED-4).
- Death remains the ending for physical-need collapse. "Not every ending has
  to be death" — but every ending still ends the run.
  (i like this, bond 0 should have something where she cut you off from her life tho)
  Out of scope for this pass (backlog, do not implement now): tax-season event,
  credit card item, IRS/CRA raid ending, T4 minigame.

---

## P3 — Exploit guards (verify, likely already fine)

- **Sleeping Beauty** (rest-loop immortality): Rest at 8/9/10 already refuses
  at 80/90/100%. Verify autonomous Rest cannot chain-trigger above Rest 2.
- **Immortal coasting** (hoard money, minimal engagement): Subscriber Revenue
  at low tiers is $12/day — starvation-level income. Confirm post-SURV-3 that
  a coasting bot still trends toward Bond/Creativity collapse (Lonely and
  Creative Block Mood drains are the intended anti-coast pressure — keep them).

---

## Test plan for the next batch

1. Apply **P0 only** (SURV-1A, SURV-2A, SURV-3, SURV-4A, MED-1, MED-2 choice,
   MED-3). Run 50 seeds. Check G1–G4, G7, G8.
2. Apply **GROW-1A** on top. Run 50 seeds. Check G5, G6.
3. Apply GROW-2A only if G6 fails. Apply KS-1/2/4 alongside step 1 (they
   interact with survival, not growth).
4. Capture everything in the economy appendix's "required capture" list, plus:
   per-check damage before/after cap, autonomous-snack selections, payment-plan
   balances over time, and boost-count distribution over run time.
5. Re-run one 25-agent "hostile playtest" batch (the vibes check) — the sim
   proves numbers; the agents prove frustration.

## Changelog vs Codex report

| Codex recommendation                     | Verdict                                                                                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Clear feed window on Hospital completion | ✅ Accepted (MED-1)                                                                                                                     |
| Keep 5% stone roll                       | ✅ Accepted                                                                                                                             |
| Salt threshold 10                        | ✅ Accepted (KS-1)                                                                                                                      |
| Passage 48h @ 50%                        | ✅ Accepted (KS-2)                                                                                                                      |
| Food decay 0.65                          | ✅ Accepted as SURV-2A, but paired with damage cap (SURV-1) — rate change alone won't hit G4                                            |
| Flat-500 high tiers                      | ❌ Rejected — fails owner goal G5 (1M with reasonable effort). Replaced by boost cap first (GROW-1), gentler flattening second (GROW-2) |
| Boost cap 4                              | ✅ Accepted and promoted to the PRIMARY growth fix                                                                                      |
| Clippers 250/tier/stack                  | ✅ Accepted as P2                                                                                                                       |
| "Don't add more Health conditions"       | ✅ Strongly agreed — this pass adds zero new damage sources                                                                             |
