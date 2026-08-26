# 60-Day Balance Diagnosis: Economy Appendix

Date: 2026-08-24

This appendix extends the 50-run
[balance diagnosis](./60_DAY_BALANCE_DIAGNOSIS.md) with the complete money
ledger. No production values were changed.

## Capture method

The simulator recorded starting and ending balance, every purchase, Hospital
charge, Subscriber Revenue payment, off-stream support payment, donation, and
career appearance award.

Base stream income was reconstructed exactly from the balance identity:

```text
total income = ending balance - starting $20 + purchases + Hospital charges
stream income = total income - donations - Subscriber Revenue
                - off-stream support - appearance awards
```

These profiles never bought a Rigging Tablet or performed commission work, so
there was no additional unclassified income source.

## Complete 50-run ledger

| Source or expense            |        Total | Share of income |
| ---------------------------- | -----------: | --------------: |
| Donations                    |     $208,760 |          49.67% |
| Base stream income           |     $104,714 |          24.92% |
| Subscriber Revenue           |      $74,121 |          17.64% |
| Off-stream support           |      $17,687 |           4.21% |
| Convention appearance awards |      $15,000 |           3.57% |
| **Total earned income**      | **$420,282** |        **100%** |
| Shop purchases               |     −$75,404 |               — |
| Hospital charges             |    −$132,000 |               — |
| Combined ending balances     |     $213,878 |               — |

Hospital charges were 1.75 times all ordinary Shop spending across the study.
The ten runs ending in debt were exactly the ten non-neglect runs that used
Hospital, and all ten later died.

## Median economy by profile

Medians are calculated per run, so source medians do not necessarily sum to the
median total.

| Profile           | Ending balance | Total income | Stream income | Donations | Subscriber Revenue | Off-stream support | Appearance | Purchases | Hospital | Ended in debt |
| ----------------- | -------------: | -----------: | ------------: | --------: | -----------------: | -----------------: | ---------: | --------: | -------: | ------------: |
| Casual            |         $2,388 |       $4,208 |        $1,572 |    $1,485 |             $1,140 |               $478 |       $500 |    $2,031 |       $0 |          6/18 |
| Focused           |         $4,038 |       $6,875 |        $1,960 |    $1,319 |             $1,525 |               $448 |       $500 |    $2,046 |       $0 |          4/12 |
| Optimal           |        $23,888 |      $25,275 |        $6,239 |   $15,652 |             $3,802 |               $525 |       $500 |    $2,885 |       $0 |          0/10 |
| Exact 50%-neglect |            $65 |         $111 |            $0 |        $0 |                $64 |                $40 |         $0 |       $63 |       $0 |          0/10 |

The median Hospital column is zero because Hospital use was concentrated in a
minority. Actual Hospital users paid between $500 and $30,500.

## Interpretation

- Money is adequate for surviving non-Hospital Casual and Focused players.
  Their median ending balances were positive after roughly $2,000 of purchases.
- Donations dominate Optimal income and are highly variable. Subscriber
  Revenue is meaningful but not the primary source once streams succeed.
- Off-stream support averages about $500 over a surviving run. It helps early
  liquidity but cannot counter a $10,000 Hospital bill.
- Hospital is the decisive economic failure. Repeat stones can consume
  insurance, re-trigger immediately from the unchanged feed window, and create
  bills far larger than all normal earnings.
- Increasing ordinary income globally would make successful Optimal runs even
  richer while only partially masking the Hospital loop. Hospital/risk-window
  behavior should be diagnosed separately from routine income rates.

## Required capture for future studies

Every future balance run should record:

- starting and ending balance;
- income by base stream pay, donations, Subscriber Revenue, off-stream support,
  appearances, commissions, projects, and other authored sources;
- purchases by category and item, including rejected purchases;
- Hospital charges, insurance consumption, and repeat visits;
- time spent in debt, maximum debt, and debt-recovery penalties;
- milestone time alongside income-multiplier changes;
- an accounting reconciliation proving that starting cash plus income minus
  expenses equals ending cash.
