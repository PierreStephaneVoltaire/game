# Project agent rules

## Git prohibition

- Agents must not modify git history or repository state: no staging,
  committing, amending, merging, rebasing, resetting, restoring, tagging,
  creating/switching/deleting branches, or changing remotes. Do not push,
  pull, or fetch.
- Do not use Git CLI, GitHub CLI, hosting APIs, or deployment workflows to
  create or modify commits, branches, pull requests, releases, or remote
  repository state.
- Read-only git inspection (status, log, diff, blame, etc.) is fine.
- Editing repository secrets, rerunning CI pipelines/workflow runs, and
  inspecting CI logs or run results to diagnose a failure are all allowed.
- Leave all version-control history changes to the user.

## Scope discipline

- Do exactly what the current instruction asks, and nothing else. Do not
  rename, restyle, refactor, "clean up", or otherwise touch files, code, or
  copy the instruction didn't ask about, even if the change looks like an
  obvious improvement.
- Do not add UI elements, screens, navigation entries, or features beyond
  what was explicitly requested. A request for one page or one button is a
  request for exactly that. Do not add an About button, link, or entry to any
  screen that wasn't named.
- Do not change the game title, item names, item descriptions, flavor text,
  or any other player-facing copy unless the instruction explicitly asks for
  that copy to change.
- If finishing the task well seems to require a change outside its stated
  scope, stop and ask, or name the extra change and wait for approval, rather
  than making it silently.
- Before presenting finished work, list every file touched and one line
  tying each one back to the instruction. Revert anything without a clear
  line back before presenting.
- When scope is ambiguous, ask. Don't default to adding something.

## Plan fidelity

- A requested plan is the whole deliverable for that step. Producing a plan
  does not authorize any file changes.
- Once a plan is approved, implement exactly what it describes. Adding
  steps, dropping steps, reordering them, or substituting a different
  approach is a deviation, not an implementation of the plan.
- If something in an approved plan turns out to be wrong or incomplete
  during implementation, stop and say so explicitly before changing course.
  Do not make the change quietly and then report that the plan was followed.

## Comment discipline

- Do not write comments that explain what code does. Code should read
  clearly from naming and structure alone.
- The only comments allowed: a short pointer to the specific rule in
  `docs/GAME_RULES.md` that a non-obvious calculation implements, and a
  warning about a real gotcha that can't be recovered by reading the code
  (an ordering dependency enforced elsewhere, a unit mismatch, etc.).
- No file-header banners, no restating a function's name in a comment above
  it, no per-line commentary, no comment blocks summarizing a section that's
  already readable. If it isn't clearly one of the two allowed cases, leave
  it out.

## Terminology

- The companion is a person, not a pet. Do not use `pet` (or `Pet`, `PET`) as
  a variable, type, prop, file, or identifier name anywhere in the codebase,
  in comments, or in player-facing copy. Use `companion` instead.
- If existing code already uses `pet` as an identifier, treat the rename as
  one explicit, scoped task: convert every occurrence in a single pass rather
  than mixing old and new names or only using `companion` in new code.

## Visual identity

- The established look is neo-brutalist: flat fills, thick dark borders,
  hard offset shadows, no gradients, no soft/rounded-soft corners, no
  glassmorphism. A task is not an invitation to restyle components, swap the
  palette, or introduce a different design system, even partially, unless
  explicitly asked.
- The palette is anchored to the companion's canon appearance across her
  design eras, split into two families below. Hue and relative role (primary,
  accent, neutral, etc.) are locked; exact lightness/saturation can be
  pushed brighter or darker to read well as flat color. Do not introduce a
  hue outside these families (no new blues, purples, or corporate neutrals)
  without being asked.

  Everyday family (default across most screens):

  | Role            | Anchor    | Notes                                                            |
  | --------------- | --------- | ---------------------------------------------------------------- |
  | Primary pink    | `#E86C93` | Main brand/accent pink, pastel-to-bold range `#F6BFD0`–`#FF4F8B` |
  | Secondary coral | `#E39581` | Hair/skin warm tone, ranges toward light blonde `#F3D4BD`        |
  | Mint accent     | `#7FE0C4` | Sparing pop accent, not a primary surface color                  |
  | Sage accent     | `#7C9473` | Minor secondary accent                                           |
  | Warm brown      | `#7C4E39` | Ears, shoes, small warm details                                  |
  | Cream base      | `#FDF3E7` | Off-white background, not pure white                             |
  | Ink             | `#1A1A1A` | Borders, text, outlines                                          |

  Formal/milestone family (reserved for special or high-tier moments, used
  sparingly, not as the default palette):

  | Role        | Anchor    | Notes                                    |
  | ----------- | --------- | ---------------------------------------- |
  | Deep maroon | `#8C1F35` | Special-occasion or high-tier accent     |
  | Gold        | `#D8B855` | Reserved highlight, not everyday buttons |
  | Teal accent | `#2E7C8C` | Very sparing use only                    |
  | Warm white  | `#F5E9DD` | Fur/trim base for this family            |

- Store these as tokens in one JSON file under `src/lib/data/` (per the JSON
  convention below), not scattered across components. If that file doesn't
  exist yet, creating it is part of the first task that needs a color and
  should be flagged, not silently invented.

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
- Do not create new markdown files, READMEs, changelogs, or design-doc files.
  The only docs to write to are the two named above, and only when a change
  actually adds or moves rules or simulation modules — not to summarize or
  explain a task.
