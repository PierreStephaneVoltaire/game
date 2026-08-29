# Canonical 50-run study

Run the maintained study from the repository root:

```bash
node .agents/skills/game-balance-simulation/scripts/run-canonical-study.mjs
```

It writes and validates:

- `docs/ECONOMY_EVENTS_BALANCE_RESULTS.json` — complete per-run result contract.
- `docs/ECONOMY_EVENTS_BALANCE_REPORT.md` — generated diagnosis with the same major
  sections as the original 60-day report.

## Stable contract

- 60 game-days or any Run Ending.
- 18 Casual with 250K target and 3–6 scheduled checks/day.
- 12 Focused with 500K target and 4–6 scheduled checks/day.
- 10 Optimal with 1M target and two-hour checks.
- 10 Neglect with 250K target and exactly every second visit skipped.
- Fixed `canonical-balance-v2-*` seeds.
- Policy version 2, recorded in the JSON and report. Version 2 removed the
  sample character's name from deterministic identifiers and therefore uses a
  new seed family instead of mislabeling earlier outcomes.

Profiles include authored progression purchases, food inventory reserves,
several Kidney Stone response modes, exact attendance, status/damage exposure,
Sugar Crash, event selection/direct impact, rescue diagnostics, milestones,
follower sources, streams, medical obligations, and reconciled economy.

Do not silently alter targets, seeds, profile counts, response allocation, or
policy behavior. An intentional policy change increments `policyVersion` and
must be called out in the report so results remain comparable.
