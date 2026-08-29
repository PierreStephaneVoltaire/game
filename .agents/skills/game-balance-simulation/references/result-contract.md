# Result Contract

Every run must expose: identity and fixed seed; profile and check cadence;
elapsed days, exact outcome and Ending evidence, Health, current and peak
Subscribers, Made It unlock state, target,
and milestone times; streams
started/completed/interrupted and exact hours; scheduled/attended/busy/skipped
checks plus explicit retries; event selections and impacts; status exposure; health damage; every
relevant condition episode; and a complete economy ledger.

Heterogeneous-profile runs additionally expose their archetype and overlays;
care attempts and pre-care metrics; spending categories and low-cash time;
nutrition warnings/responses/composition; rescue resets and return-to-care
timing; Hospital decisions; and ordinary autonomous Mood, reading, item,
side-gig, injury, and movement events.

## Run outcome object

Every run exposes these unambiguous fields:

```json
{
  "outcome": "horizon | death | quit_streaming | financial_ruin",
  "ending": null,
  "reachedHorizon": true,
  "physicallyAlive": true
}
```

`ending` is null only for `horizon`; otherwise it is the engine's discriminated
Ending record and its `kind` matches `outcome`. `reachedHorizon` reports study
completion. `physicallyAlive` is false only for Death. Do not add a binary
`survived` field because it conflates those two questions.

## Economy object

```json
{
  "economy": {
    "startingBalance": 20,
    "endingBalance": 100,
    "income": {
      "stream": 500,
      "donations": 200,
      "subscriberRevenue": 100,
      "offStreamSupport": 50,
      "appearances": 0,
      "commissions": 0,
      "projects": 0,
      "other": 0
    },
    "expenses": { "shop": 270, "hospital": 500, "other": 0 },
    "maximumDebt": 400,
    "hoursInDebt": 12
  }
}
```

For every run:

```text
startingBalance + sum(income) - sum(expenses) = endingBalance
```

Do not leave stream pay hidden inside an unexplained balance delta. If an engine
event lacks an amount, derive the source from activity state and elapsed time or
record a named residual and explain it. Capture rejected purchases separately
when access or affordability is part of the question.

Also record Hospital insurance consumption, repeat charges, milestone-driven
income multiplier changes, peak total debt across negative cash and explicit
obligations, first In Debt entry, time in debt, crossing transaction, credit
spending by category, LOC uptake/repayment, and any debt-related health
recovery penalty. Life-event counts must separate positive/negative
metric, cash, and Subscriber totals and temporary-discovery exposure.

## Reporting minimums

Report per profile:

- run count, every Ending count including zero categories, physical-survival
  rate, horizon-completion rate, target-hit rate, all-run median, completion
  median, and median target day;
- streams started/completed/interrupted and stream-hours;
- median and total income by source, spending, Hospital charges, ending balance,
  and debt incidence;
- event selections per run-day with weights and direct impacts;
- exact outcome, Death causes, status exposure, and damage totals;
- every relevant condition episode and response outcome.
