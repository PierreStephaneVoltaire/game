# Opinion on the 60-Day Fairness Feedback

## Overall opinion

The feedback is directionally strong. It correctly identifies that the game has
two different balance failures rather than one general difficulty problem:

1. ordinary, goal-directed players die too often from overlapping need damage;
2. players who survive and stream efficiently enter a follower-growth feedback
   loop that overshoots the intended career endpoint.

It is also right that Hospital is not merely expensive. Hospital currently
combines an unchanged Kidney Stone risk window, a potentially ruinous bill,
continued Food and Rest decay, and debt-suppressed recovery. That is a trap
presented as treatment. Fixing ordinary income would hide that defect while
making successful runs richer, so the feedback is right to isolate Hospital
from the rest of the economy.

My main criticism is that `feedback.md` calls itself a requirements document
while much of it is still a set of hypotheses, estimates, mutually exclusive
options, and untested interactions. It is a good decision memo, but it should
not become an implementation checklist without correcting its internal
inconsistencies and testing the combined effects against paired seeds.

## Corrections and cautions

### The Hospital denominator is incorrect

The diagnosis does not show 14 actual Hospital users. It defines 14 runs with a
Delayed Hospital or Immediate Hospital response strategy, but only ten of those
runs developed a stone and used Hospital. The economy appendix confirms that
the ten non-neglect Hospital users were exactly the ten runs that ended in debt,
and all ten died. The current result for G7 should therefore be written as
`0/10 actual Hospital users survived`, not `0/14`.

This does not weaken the conclusion. Zero survivors out of ten, the repeated
post-treatment onsets, and $132,000 in charges are more than enough evidence
that the treatment loop is broken. Correcting the denominator matters because
future comparisons should use actual treatment exposure, not assigned strategy.

### The proposed survival changes are not independent

SURV-1, SURV-2, SURV-3, and SURV-4 all improve the same collapse path. Applying
all four at once may hit the survival target, but it will not reveal which
change did the useful work or which one overcorrected. The combined result also
cannot be estimated reliably by adding the draft's individual estimates.

The same-seed baseline and counterfactual runs should be compared. At minimum,
the results should expose how many deaths each change prevented, time spent at
Food 0–2, damage removed by the cap, emergency snacks consumed, and the number
of recoveries from Health 1–8. A final combined run is still necessary, but the
changes should remain separable as balance levers.

### Autonomous Snack does not automatically preserve neglect

The claim that neglect runs “do not shop” and therefore remain unprotected is
too simple. Every run begins with Water and three foods. Mom's Care Package can
also add two Liked foods when Food is critical, including during a zero-input
run. Autonomous Snack could consume both starter inventory and care-package
inventory. Autonomous Rest is already protecting one other critical need.

That combination may be good for the companion's sense of agency, but it must
be measured against both G3 and G4. If full AFK becomes too safe, I would gate
emergency eating on recent player engagement rather than sell the behavior as
an upgrade. A companion taking basic care of herself should not be a mandatory
purchase, and an upgrade would become an early-game tax disguised as a choice.

The automatic action also needs the same explicit semantics as automatic stream
snacks: it should not advance Annoyed, should not create another autonomous
opportunity, and must produce clear Journey narration when it consumes owned
food. Its food selection policy matters because a “rescue” snack can contribute
to Sugar Crash or Kidney Stone risk.

### The test plan contradicts the selected SURV-4 option

SURV-4 marks B as recommended, and the owner's note also favors B, but the test
plan says to apply SURV-4A. I agree with B: keep the low-Health Mood penalty but
limit it to once per 12 game-hours. Deleting it removes emotional fragility from
the injured state, while inverting it into free Mood recovery is too generous
when Mood is already easy to clamp at 10. The cooldown retains the intended
fiction without allowing every stat change to deepen the spiral.

### Fifty total runs are weak as a pass/fail gate

The baseline's 50 runs are split across four profiles, leaving only 12 Focused
runs and ten runs in several other cohorts. Percentage targets such as 85% and
90% become coarse and noisy at those sample sizes. Deterministic seeds make the
results reproducible, but not necessarily representative.

I would preserve a fixed regression seed bank and report counts alongside
percentages. Paired seeds are especially important for Hospital: compare the
same onset with natural treatment, insured Hospital, and uninsured Hospital
rather than comparing different seeds that happened to choose different care.
The proposed hostile-agent batch remains useful for frustration and rule
legibility, but it should not replace the engine cohorts.

The diagnosis also refers to `docs/log.md`, which is not currently present in
`docs/`. Either restore that evidence or remove the reference so the report is
self-contained.

## My choices

### Survival

I would choose **SURV-1A**, a combined periodic need-damage cap of −2. It best
matches the desired two-to-three-day failure window and directly addresses the
observed stacking problem. Illness onset and recurrence should remain outside
the cap for now, as proposed.

The cost of this choice is that one need at 0 can deal the same periodic damage
as three critical needs. That reduces the mechanical distinction between a
single emergency and total collapse. I think this is acceptable for the first
experiment because the statuses, activity blockers, Mood pressure, and external
illness damage still make multi-need collapse worse. If neglect becomes too
safe, I would test a diminishing stack rule before simply reverting to uncapped
damage.

I would choose **SURV-2A**, Food decay chance 0.75 to 0.65. It is simple,
configurable, and easy to reason about. Option B's guaranteed skip after a decay
adds hidden memory to the rule and makes the apparent 60% chance conditional on
an invisible previous roll. It may reduce bad streaks, but it is less legible
than simply reducing the rate.

I support **SURV-3 as a free companion behavior**, not an upgrade, subject to
the AFK and care-package interaction above. The idea fits the companion fantasy
better than letting an owned meal sit untouched while she starves. I would not
assume weight 40 is sufficient until the actual selection rate and rescue rate
are measured.

I choose **SURV-4B**, at most one low-Health Mood penalty per 12 game-hours.

### Hospital and debt

I fully support **MED-1**. Hospital should still consume its documented 12 game
hours, continue Food and Rest decay, and grant its completion effects. Clearing
the ten-feed risk window at completion removes the nonsensical immediate
re-onset without turning Hospital into instant immunity.

I do not favor MED-2A as currently written. A $10,000 plan at $150 per day lasts
about 67 days, longer than the study horizon, so it is effectively permanent in
a 60-day run. It is also unclear whether an automatic deduction can create a
negative balance, what “skipping” a supposedly automatic payment means, and how
the plan interacts with two-hour Subscriber Revenue. If the plan does not count
as debt, it also makes MED-3 and the proposed Financial Ruin ending largely
irrelevant.

My preferred bill design combines the useful parts of B and C:

- uninsured charge: 25% of lifetime earned income, clamped from $500 to $5,000;
- Insurance Card: durable for the run rather than consumed, reducing each bill
  to 20% of the calculated charge with a $100 minimum;
- preserve ordinary debt if the player cannot cover the resulting bill;
- keep coverage locked when the 12-hour visit starts.

This makes early treatment survivable, lets treatment remain expensive for a
wealthy career, and keeps insurance valuable without making it mandatory. The
uninsured cap is deliberately lower than the draft's $10,000 because even the
Focused median total income is only $6,875. The exact cap is a test value, not a
sacred number.

I support **MED-3**, lowering the recovery-score penalty cap from 3 to 2, if
negative balances remain possible. Debt can slow recovery without hard-locking
excellent care at zero recovery.

I would reject **MED-4 for this pass**. A $20,000 debt ending is incompatible
with several proposed bill fixes and turns a defective medical economy into a
terminal narrative consequence. Financial Ruin could be interesting in a
larger economy with loans, optional spending, and meaningful ways to manage
debt. Hospital alone should not create it.

### Kidney Stone

I support **KS-1, KS-2, KS-4, and KS-5**. Keep the measured 5% probability,
raise the salt threshold to 10, test passage every 48 hours, expose the rolling
risk qualitatively, and mention Painkillers at onset.

KS-4 is more than polish. A stone appearing after Lettuce or another apparently
harmless feed is logically consistent with a rolling window but reads as
arbitrary punishment when the window is invisible. A difficult rule is fair
only when the player can form a correct mental model and respond before the
roll.

The natural-passage report should include tail length, not only expected
duration. A 50% roll can still produce exceptionally long episodes. If 48-hour
checks leave a frustrating long tail, I would add escalating passage odds or a
guaranteed clearance after the third failed passage check rather than lowering
the initial onset roll.

### Followers and career growth

The feedback is right not to apply the flat-500 counterfactual. The owner's goal
is one million Followers with reasonable Focused play, and Focused survivors
are already close: their median is 979,139 and three of seven survivors reached
one million. Survival changes alone may let more of those runs complete the late
growth curve. Career growth should therefore be remeasured after survival is
fixed and before lowering any tier rates.

For **GROW-1**, I prefer **B, the soft cap**, over four hard “most recent”
contributions. A hard cap creates an invisible cliff where a fifth stream can
evict an older contribution before its promised seven days end. A soft cap
preserves the intuitive rule that another stream always helps, while still
cutting the Optimal stacking loop. The proposed 25% value is a reasonable first
experiment, not a final answer.

If the soft cap still leaves Optimal above the desired range, I would then test
**GROW-2A**. The order matters: survival first, stacking second, high-tier rates
third. Otherwise the game will be tuned against dead Casual runs and an
uncontrolled stacking mechanic at the same time.

I am unconvinced that **GROW-3A** makes Clippers genuinely meaningful. Moving
from 50 to 250 per tier per stack is a fivefold increase, but the diagnosis
still expects Clippers to remain below 2% of growth. That may be visible in a
Journey line without being strategically relevant. I would test 250, but judge
it by milestone time saved and purchase behavior, not by the impressive-looking
multiplier. If it remains decorative, Clippers should affect a different axis,
such as stream momentum or drought protection, rather than adding another raw
growth stack to a system already suffering from stacking.

### Sugar Crash

I choose **A + C**: require four sugar servings and allow sufficient protein to
cancel a scheduled crash. I would also expose the two-hour warning as a visible
timed effect or clear Journey warning. Counterplay that is hidden until after
the penalty is not meaningful counterplay.

The nutrition research is appropriately careful about real-world sources and
null values, but balance should continue to use authored qualitative scores.
USDA values can support believable item behavior; they should not silently
derive gameplay severity or override the data-authored catalogue rules.

### Alternative endings

I like the idea that not every failed relationship ends in physical death, but
this is a larger product decision than a P2 balance tweak. `CONTEXT.md` and
`GAME_RULES.md` currently define a run as lasting until death. Non-death terminal
outcomes require a broader definition of a run, grave/history wording, and a
clear distinction between the companion dying, ending her career, and ending
the relationship.

“She Quit Streaming” fits persistent Mood collapse, but I would prefer a
consecutive warned period over 72 cumulative hours in a rolling week. The
cumulative version can terminate a run after several recovered episodes and
may feel like an invisible meter.

The Bond idea is stronger and more personal: if Bond remains at 0 for a long,
continuous period despite explicit warnings, the companion can end the
relationship with **“She Cut You Off.”** A genuine Bond gain should reset the
countdown. It should be framed as her agency, not as another name for death.
Both endings deserve their own design pass after survival balance is stable.

## Recommended decision set

If I were approving the draft today, my selected direction would be:

- SURV-1A, SURV-2A, free SURV-3 with explicit automatic-action semantics, and
  SURV-4B;
- MED-1, the sliding-scale/reusable-insurance hybrid above, and MED-3;
- KS-1, KS-2, KS-4, and KS-5;
- Sugar Crash A + C with a visible warning;
- survival remeasurement before growth changes;
- GROW-1B first, GROW-2A only if the measured overshoot remains, and GROW-3A
  only as a measured experiment;
- defer Financial Ruin, She Quit Streaming, and She Cut You Off to a separate
  endings design pass.

The core principle I would protect is not “make the game easier.” It is: make
care reliably matter, make neglect fail for reasons the player can understand,
and make successful play produce progress without exponential-feeling runaway
rewards. The feedback mostly moves in that direction; it needs corrected
evidence, fewer hidden rules, and cleaner separation between balance fixes and
new ending systems.
