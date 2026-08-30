# Project agent rules

## Git prohibition

- Agents must not run Git commands or perform Git operations in this
  repository. This prohibition includes read-only inspection as well as
  staging, committing, amending, branching, switching branches, merging,
  rebasing, pulling, fetching, pushing, resetting, restoring, tagging, or
  changing remotes.
- Do not use GitHub CLI, hosting APIs, deployment workflows, or other tools to
  create or modify commits, branches, pull requests, releases, or remote
  repository state.
- Leave all version-control and repository deployment actions to the user.

## Simulation boundaries

- Status alignment logic belongs in `src/lib/status-rules.ts`. Do not add new
  status names, durations, expiry behavior, or status metric penalties to the
  item resolver.
- Statuses are persistent simulation state. Do not add short wall-clock timers;
  clear them through explicit user actions/items or documented metric-condition
  reconciliation rules.
- Seeded randomness belongs in `src/lib/seeded-rng.ts`. Simulation outcomes
  must use the seed, state version, and action ID; do not call `Math.random()`
  in gameplay code.
- Rule constants and structural limits belong in
  `src/lib/game-constants.ts`. Keep configurable rule values in JSON under
  `src/lib/data/` so those files can seed a future database.
- Item prices, effect ranges, preferences, contextual modifiers, and status
  hooks belong in JSON data, not hardcoded frontend branches.

## File size and documentation

- Treat 300 lines as a split point. Before adding to a file at or above that
  size, extract a cohesive domain module and import it.
- Keep the rule/file inventory in `docs/RULES_AND_FILES.md` current when adding
  or moving simulation modules.
- Keep the user-facing rule reference in `docs/GAME_RULES.md` aligned with the
  JSON data and resolver behavior.
