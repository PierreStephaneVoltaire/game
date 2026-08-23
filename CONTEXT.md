# Virtual Pet Context

The game models one memory-only life with a configurable companion. Its
language separates clock behavior, care, autonomous behavior, and career
progress so rules and player-facing narration describe the same world.

## Run and time

**Run**:
One in-memory companion life from sign-in until death. A new sign-in or reload
starts a separate run with no inherited state.
_Avoid_: Save, account

**Game time**:
The timestamp used by needs, activities, statuses, projects, events, and the
run-local calendar.
_Avoid_: Wall-clock timer

**Realtime mode**:
A clock mode in which game time catches up to the browser clock when the game
is entered, becomes visible, or receives a command.

**Streaming mode**:
A clock mode in which game time advances only through timed commands. It is
unrelated to whether the companion is performing a stream.
_Avoid_: Stream activity

## Care and simulation

**Companion attempt**:
Feed, Rest, Socialize, Play, or an item-detail interaction directed at the
companion.
_Avoid_: Shop action, navigation

**Genuine refusal**:
An eligible companion attempt the companion actively declines. Blocked,
invalid, unavailable, stale, automatic, and Rest-at-10 attempts are not genuine
refusals.

**Activity**:
A span of game time occupied by Rest, Socialize, Play, streaming, Hospital, or
Commission Work.

**Status**:
A persistent simulation condition cleared by care, an item, or its documented
metric or natural-resolution rule.
_Avoid_: Timed effect

**Timed effect**:
A scheduled temporary rule such as Hyperfocus, Pain Relief, or a deferred Rest
loss. It is displayed separately from persistent statuses.

**Critical condition**:
Health, Food, Rest, or Mood at 0 through 2. Bond and Creativity are never
critical conditions.

**Autonomous opportunity**:
One seeded weighted draw that may produce narration, a stat event, an
autonomous activity, a project, or no visible event.

**Journey**:
The natural player-facing story projected from the complete internal event
history.
_Avoid_: Audit log, offline recap

## Economy and career

**Medical debt**:
A negative balance created by Hospital care. It limits shopping and reduces
periodic Health recovery without directly damaging Health.

**Followers**:
A nondecreasing audience measure earned through completed streams, donations,
and model projects.

**Career tier**:
The highest ordered follower milestone the run has earned.
_Avoid_: Level

**Project**:
Nonblocking commission work that completes at its third run-local midnight.

**Queued event stream**:
A Tournament Appearance or model-debut stream waiting for its eligible prime-time
opportunity.

**Appearance**:
The companion sprite selected by completed model work. Companion identity and
appearance are configurable profile data.
