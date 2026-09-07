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

- Preserve the light neo-brutalist aesthetic: flat fills, thick dark borders,
  and hard offset shadows. No gradients, blurred shadows, or glassmorphism.
  Corners are square except the landing console's requested 10px outer
  radius; do not spread that exception to other UI.
- Use `light_neo_brutalist_palette_v2.html` as the color reference, with the
  specific choices below taking precedence. It is not permission to copy its
  text, add UI, or change existing layouts, typography, or artwork.
- Keep the page background warm light grey (`cream`, `#ECE8E1`) and use white
  surfaces. Do not tint the whole page yellow. Gold/blonde and pink/rose are
  the dominant colorful areas; teal and green occupy less of the overall
  screen. Brown and ink support readable text, borders, and shadows.
- Colors may serve different roles when they complement or contrast each
  other. The old everyday/formal restrictions no longer apply: gold is
  allowed on everyday UI. Preserve the explicit assignments below unless
  requested otherwise, including rose shadows on the specified teal controls.
- `src/lib/data/theme.json` is the single source of palette tokens. Consume
  its `--theme-*` CSS variables, exposed by `src/routes/+layout.svelte` on
  every route, including direct loads. Do not scatter new hex colors across
  components. Apply tokens to native controls and metric bars too; preserve
  existing artwork colors.

  | Token         | Value     | Current use or variant                    |
  | ------------- | --------- | ----------------------------------------- |
  | `cream`       | `#ECE8E1` | Warm light grey page background           |
  | `white`       | `#FFFFFF` | White surfaces and console display        |
  | `pink`        | `#D6486F` | Rose fills and contrasting shadows        |
  | `pink-light`  | `#F6BCD0` | Light pink variant                        |
  | `pink-bold`   | `#D9678C` | Pink variant                              |
  | `gold`        | `#D4AF37` | Gold fills and contrasting shadows        |
  | `blonde`      | `#F3D681` | Light gold variant                        |
  | `teal`        | `#2FD1C0` | Teal accents and specified controls/cards |
  | `mint`        | `#BAF5E6` | Sparing light green accent                |
  | `sage`        | `#7EA36B` | Sparing green accent                      |
  | `coral`       | `#FFE7D3` | Pale warm variant                         |
  | `coral-light` | `#F3D4BD` | Light warm variant                        |
  | `brown`       | `#6B6259` | Warm neutral                              |
  | `ink`         | `#1B1512` | Dark text and borders                     |
  | `on-pink`     | `#000000` | Readable text on rose                     |
  | `maroon`      | `#8C1F35` | Deep warm accent                          |
  | `warm-white`  | `#F5E9DD` | Warm surface variant                      |

## Landing page UI

- About and Sign in have teal fills and rose hard shadows, including hover.
  The SESSION badge has a gold fill, rose shadow, and teal indicator square.
  The console's star and heart stickers both have teal fills and rose shadows.
- The console has a rose body, ink border, white display, and gold/rose hard
  shadows. Keep it slightly taller than wide: a 1:1.1 width-to-height ratio,
  with a maximum desktop width of 460px (460 by 506px). Preserve the 330px
  minimum height needed for narrow screens and the responsive width.
- Align all six console metric labels using the width of CREATIVITY,
  including its letter spacing, plus a three-character gap before each bar.
  Keep the shared label column and `3ch` gap; avoid oversized label columns.
  Labels and bars must remain visible at 320px viewport width.
- The six metric cards form two rows of three on desktop, in this order and
  with these fill/shadow pairs. Keep the existing single-column layout at
  widths of 440px and below.

  | Row | Card       | Fill | Hard shadow |
  | --- | ---------- | ---- | ----------- |
  | 1   | Food       | Gold | Rose        |
  | 1   | Rest       | Rose | Gold        |
  | 1   | Health     | Teal | Rose        |
  | 2   | Bond       | Teal | Gold        |
  | 2   | Mood       | Gold | Rose        |
  | 2   | Creativity | Rose | Teal        |

- Use SESSION instead of CARE ROOM. Keep the time-mode question as
  “How should time move in this session?” and game metadata description as
  “A session-only companion game.” Do not restore the removed care-mode or
  device ID labels on the console.
- Keep Mood's description “Make time for small moments of happiness.” and
  Creativity's “Keep ideas flowing with a little inspiration.” Preserve
  unrelated copy and the game title.

## Shop and Inventory UI

- Shop and Inventory open as separate full-screen native modal dialogs over
  the mounted game at `/game`. The game layout owns the open-dialog state;
  reuse `GameShop.svelte` with its mode and close callback. Opening either
  dialog must preserve the game and any activity in progress.
- Shop has only Shop and Cart tabs. Inventory shows its browser without
  tabs. Keep item details as nested dialogs, preserving the underlying list,
  filters, search, and pagination when details close.
- Use internal scrolling, contain keyboard focus, close the topmost dialog
  with Escape, and restore focus to its opener. The arrow is a close button.
  Scope shop styles to the dialog so they cannot restyle the underlying game.
- History's Shop and Inventory controls return to `/game` before opening the
  selected dialog. Do not recreate `/game/shop`, query-based tab navigation,
  redirects, or compatibility routes.
- Successful checkout stays on Cart and shows “Your cart is empty.” Failed
  checkout retains error feedback and cart contents. Purchases appear when
  Inventory opens. Preserve balance, payment controls, item actions, and
  placement behavior.

## Staging URL stability

- Keep the staging app URL and OAuth redirect URI stable across pull
  requests. Staging sign-in must not require manually registering a new
  provider redirect URI for every PR.

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
