---
name: game-balance-simulation
description: Run reproducible, goal-directed game-balance studies against the real simulation engine. Use when diagnosing survival, progression, economy, random-event frequency, status pressure, or milestone pacing; do not use for ordinary unit tests or when the user only wants a code change.
---

# Game Balance Simulation

Use this skill to answer a balance question with evidence from human-like play
profiles. A profile must pursue the player's stated goals; do not call a
survival-only policy “Casual” when progression is also a goal.

## Scope

- Diagnosis does not authorize production balance changes. Keep rule
  counterfactuals in memory or in clearly named disposable files unless the
  user separately asks for implementation.
- Run the real engine and bundled data. Do not replace engine behavior with a
  spreadsheet approximation when a seeded engine run is possible.
- Obey repository instructions about seeded randomness, rule ownership, file
  size, and documentation.

## Study workflow

For the project's maintained 50-run regression, read
[references/canonical-50-run-study.md](references/canonical-50-run-study.md) and run
its permanent script. Do not rebuild that harness or substitute a reduced
policy. The generated report is part of the runner's output.

For the maintained 100-run behavioral-coverage study, keep that controlled 50
unchanged and run:

```bash
node .agents/skills/game-balance-simulation/scripts/run-expanded-study.mjs
```

The extension adds the configuration-driven P51–P100 policies under
`data/expanded-profiles-*.json`. Character-specific preferences belong in
profile data; runner filenames, functions, seeds, environment variables, and
report infrastructure remain generic. The maintained runner uses four isolated
25-profile processes, validates each batch result, and then combines the
summaries into the existing 100-run result and report. Do not collapse the
batches into one process; full simulation histories exhaust memory before the
combined report is written.

P91 and P100 are targeted non-death Ending validators. P91 reaches Financial
Ruin through its ordinary debt-indifferent policy. P100 is explicitly a
controlled boundary profile at the completed 72-hour zero-Mood countdown; do
not cite it as evidence of natural Quit Streaming incidence. Their configured
`expectedOutcome` is asserted by the maintained study test so Ending coverage
cannot silently regress into another outcome.

1. State the question, horizon, requested endpoints, and stopping conditions.
2. Read current rule data, engine seams, user logs, and existing rule
   documentation before defining policies.
3. Read [references/study-design.md](references/study-design.md) and define
   goal-directed profiles with explicit check cadence, competence, risk, and
   neglect behavior.
4. Use 25–50 baseline runs unless the user gives another number. Use fixed
   seeds and deterministic policy variation. Separate policy randomness from
   gameplay randomness.
5. Model a check-in as a human session: several legal instant actions may occur
   before one timed activity. Record scheduled, attended, busy, and skipped
   checks.
6. Capture the full result contract in
   [references/result-contract.md](references/result-contract.md). Money
   reconciliation is mandatory, not optional.
7. Report configured event weights beside observed selection frequency and
   direct impact. Include non-pool recurring effects such as decay, status
   recurrence, and Sugar Crash.
8. Record every occurrence of the condition under investigation. For Kidney
   Stone this includes the risk window, trigger feed, onset, response, pain
   relief, recurrences, clearance, Hospital cost, re-onset, and Ending state.
9. Run narrow counterfactuals only after the baseline identifies a plausible
   lever. Change one coherent rule family at a time and label tested results
   separately from inference.
10. Validate the result JSON:

```bash
node .agents/skills/game-balance-simulation/scripts/validate-balance-results.mjs <results.json>
```

11. Write a Markdown report with cohort summaries, per-run exceptions, money,
    event patterns, condition-specific findings, and tested versus inferred
    recommendations. Link large appendices rather than exceeding repository
    file-size guidance.
12. Remove ad hoc runners and viewers after capturing findings. Never remove
    the maintained canonical runner; it is a reusable skill resource.

## Interpretation requirements

- Separate progression failure, physical death, non-death Endings, and Horizon
  Completion. Report all-run and completion medians together.
- Do not infer that a global rate is too low when successful runs overshoot and
  dead runs pull down the median.
- Distinguish configured probability from exposure frequency. Report both
  eligible opportunities and observed hits.
- Treat debt, Hospital charges, purchase access, and income timing as gameplay
  state, not background metadata.
- Say when a recommendation is an engine-tested counterfactual versus an
  extrapolation from measured runs.
