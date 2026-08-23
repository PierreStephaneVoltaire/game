# Autonomous stream drought

## Reproduction

A deterministic public-engine test was used with a healthy, idle Bri at the
48-hour mark. Across ordinary seeded autonomous opportunities, at least one
seed still produced no `stream_candidate`. The focused test failed with
`expected false to be true`, confirming that the current rules do not enforce
a maximum gap between eligible streams.

No stream behavior was changed as part of this investigation.

## Cause findings

1. `src/lib/stream-rules.ts` calculates a fresh random stream weight for every
   opportunity. There is no run-history field for the last stream, no drought
   counter, and no rule that forces or increases the chance of a stream after
   a time limit. A sufficiently unlucky run can therefore miss streams
   indefinitely.
2. The stream candidate competes with a weight-100 `none` candidate plus all
   other eligible autonomous events. Even a healthy Bri does not receive a
   stream attempt on every two-hour boundary.
3. Stream eligibility is narrow. Any active activity blocks it, as do Hungry,
   Starving, Sleep Deprived, Sick, Kidney Stone, Depressed, Low Energy,
   Overstimulated, and Dizzy Spell. Food and Rest decay on the same two-hour
   timeline, so long random droughts make later opportunities increasingly
   likely to be blocked.
4. A selected ordinary stream subtracts missing Rest from its sampled duration
   and is capped at local midnight. A late-night selection can therefore
   produce only a fraction of an hour, as in the 11:11 PM to midnight example.
   This is a real stream, but it is not a reliable earning window.
5. Repeated Rest-at-10 refusals each create a separate attempt-owned autonomous
   opportunity, but those opportunities still use the same weighted pool.
   Repeating Rest can generate many refusal lines without guaranteeing a
   stream.

## Design decision still needed

The scheduler needs an explicit product rule for a stream drought: what counts
as a qualifying earning stream, which blockers may postpone the guarantee, and
whether the guarantee starts a stream immediately or reserves the next viable
time window. That flow is intentionally deferred.
