# Study Design

## Profile contract

Every ordinary profile pursues all user-stated goals, commonly survival and
career progression. Vary execution quality rather than removing a goal.

- Casual: the user's expected check cadence, obvious care, ordinary shopping,
  and visible progression purchases. Allow imperfect timing and decisions.
- Focused: stronger progression priority and planning, but not perfect
  foresight or risk avoidance.
- Optimal: frequent observation, complete rule knowledge, proactive reserves,
  efficient progression, and rational condition response.
- Neglect: retains both goals when present but skips an exact requested share
  of check-ins. Do not substitute one short period of total abandonment unless
  that is the question.
- Abuse: deliberately exploits or stresses one mechanic. Keep it distinct from
  Casual, random, and neglect profiles.

Record both scheduled check-ins and effective sessions. A player checking while
a stream or other activity is active still checked; report it as busy rather
than silently reducing cadence.

## Cohort construction

- Use fixed, named seeds and enough runs to expose variance. Default to 25–50.
- Spread check cadence, food choices, career decisions, and condition responses
  within the bounds of each profile.
- If a skip fraction must be at least 50%, enforce it exactly or conservatively;
  a 50% Bernoulli probability is not evidence that the realized cohort skipped
  50%.
- Stop each run at an Ending or the declared horizon. Never encode a product-lifetime
  assumption as a permanent game rule merely because it is the study horizon.

## Real-engine harness

Use the actual command dispatcher, time reconciliation, game definition, and
seeded gameplay RNG. A disposable harness may use its own deterministic PRNG to
model human variation, but it must not replace gameplay outcomes.

Avoid distorting results through instrumentation. If persistent Journey or
command receipts cause quadratic copying, archive events incrementally and keep
only the recent engine window after confirming old entries are not gameplay
inputs. Preserve all archived events for analysis.

## Event and status analysis

Capture:

- weighted opportunity count and selected candidate;
- configured weight and dynamic eligibility;
- visible event rate per run-day;
- metric, money, subscriber, inventory, and activity impacts;
- non-pool effects and status onset/clear/recurrence counts;
- exact status exposure hours and damage sources;
- stream candidates versus actual starts, completions, interruptions, and
  elapsed hours.

Compare these outputs with supplied human logs. Repetition in logs can reveal a
frequency problem even when individual event weights are modest.

## Condition response cohorts

For an opaque condition such as Kidney Stone, include realistic response modes:

- unaware: ordinary care without status-specific knowledge;
- instinctive: behavior such as hydration without understanding the hidden
  rule;
- wait: symptom management and natural clearance;
- delayed discovery: status-specific care only after a plausible delay;
- Hospital: immediate or threshold-based medical treatment;
- informed optimal prevention and treatment.

Do not force an onset into the baseline cohort. If natural incidence is too low
for response comparison, add a separately labeled controlled condition cohort.

## Counterfactuals

Choose levers from measured failure modes. Examples include early versus late
progression rates, active boost caps, decay probability, risk thresholds,
clearance timing, and Hospital behavior. Keep baseline and counterfactual seeds
and policies aligned when possible.

Never present a simple proportional estimate as an engine result. It may still
be useful when explicitly labeled as inference.
