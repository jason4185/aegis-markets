# Settlement model

## Purchase reference

FXRatesAPI is the sole purchase-reference source:

`https://api.fxratesapi.com/latest?base=USD&currencies=GBP,JPY,TRY,XAU,XAG&resolution=1m&format=json`

The contract requires a successful USD-base response, selected currency,
positive numeric rate, parseable timestamp and matching source date. The source
timestamp may be at most 900 seconds old relative to the GenLayer transaction
datetime and no more than 300 seconds in the future. Validators independently
fetch the moving feed and apply the configured timestamp-window and narrow
price-difference rules. The leader's validated normalized price and timestamp
become immutable protection data. No midpoint is calculated.

Accurate wording: “Reference price fetched from FXRatesAPI and independently
confirmed by GenLayer validators.” Validators confirm consistent fetching and
interpretation of the configured source; they do not prove universal market
truth.

## Normalization and trigger

All arithmetic is integer fixed-point with price scale `10^8` and raw parsing
scale `10^12`. The source is USD-base:

- `GBP/USD = 1 / GBP`
- `USD/JPY = JPY`
- `USD/TRY = TRY`
- `XAU/USD = 1 / XAU`
- `XAG/USD = 1 / XAG`

Decimal and scientific-notation JSON numbers are parsed without binary
floating-point arithmetic. Reciprocals use integer division. Public entry
points accept `event_percent` as `2`, `3`, or `4`, then multiply it by 100.
Internal settlement remains basis-point based. DOWN triggers are
`reference × (10000 - event_bps) / 10000`; UP triggers are
`reference × (10000 + event_bps) / 10000`.

## Dated market settlements

Source A is FXRatesAPI historical:

`https://api.fxratesapi.com/historical?date=YYYY-MM-DD&base=USD&currencies=GBP,JPY,TRY,XAU,XAG&resolution=1d&format=json`

Source B is the Fawaz dated dataset, delivered primarily through jsDelivr:

`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@YYYY-MM-DD/v1/currencies/usd.min.json`

If that delivery fails or is malformed, the same dated Fawaz dataset is fetched
through:

`https://YYYY-MM-DD.currency-api.pages.dev/v1/currencies/usd.min.json`

The fallback is not treated as an independent third source. Required source
dates must exactly equal the requested date. A missing, malformed, or
unavailable required source causes an external/transient error and no market
settlement is stored, so an authorized caller can retry. A current-day 404
is transient because that day's value may be published later; an older missing
date remains an external failure.

The first successful `settle_protection` call for a market/date stores
validator-approved evidence that other eligible protections can reuse. It
contains prices, not a universal breach result, because protections can have
different triggers. A retryable inconclusive case may create a newer
market-settlement version without overwriting previously finalized evidence;
each protection/date records the version it used.

## Date eligibility and expiry

Time comes only from `gl.message_raw["datetime"]` and is converted to UTC epoch
seconds with integer calendar arithmetic. Caller-supplied current time is never
accepted.

The purchase reference is fixed at purchase. The first eligible settlement is
the next UTC calendar date. The last is purchase calendar day plus the selected
duration, giving exactly 7, 14, or 30 complete eligible dates. `expires_at` is
stored as `(last_settlement_day + 1) × 86,400` for informational metadata only.
The final required `NOT_BREACHED` result expires the protection immediately;
there is no manual expiry method. Weekends are eligible. Historical settlement
may occur later, but must use the originally requested eligible date.

Settlement requires a completed UTC market day: `settlement_day` must be
strictly earlier than the current transaction UTC day. A protection must also
settle its earliest unresolved date, so a later date cannot bypass an earlier
unprocessed or `INCONCLUSIVE` date, even when later market/date evidence is
cached. These guards run inside `settle_protection` before external web calls
or settlement-state mutation. A 7 Aug market day therefore becomes processable
after 00:00 UTC on 8 Aug. Both sources must already return the exact requested
date, so no previous-day value can substitute for an unpublished current-day
value. Daily values are “dated daily reference prices published for the
settlement date,” not guaranteed universal official closes.

## Two-source outcome

For DOWN markets, each price at or below the trigger is breached. For UP
markets, each price at or above the trigger is breached.

- both breached: `BREACHED` and policy becomes `CLAIMABLE`;
- both not breached: `NOT_BREACHED`, with the final required date expiring immediately;
- split: `INCONCLUSIVE`, remaining unresolved and blocking later dates until retry;
- unavailable/malformed required evidence: retryable failure before storage.

Prices are not averaged and no tolerance affects payout. Validator consensus
cannot turn a source split into a breach. One inconclusive market/date does not
prevent other market settlements or protections from being settled.

Once a protection/date receives a conclusive `BREACHED` or `NOT_BREACHED`
result, that protection/date result is final. New market-settlement versions are
used only to retry protection/date results that were previously `INCONCLUSIVE`.
The stored protection-settlement version identifies the exact evidence used.
Repeated conclusive calls do not refetch or change counters.

Historical source corrections do not retroactively alter a protection/date that
has already reached a conclusive BREACHED or NOT_BREACHED result. Revised source
evidence may only be considered while that protection/date remains unresolved or
INCONCLUSIVE. A retry of an INCONCLUSIVE date may bind that protection/date to a
newer evidence version; once the retry is conclusive, that result is immutable.

If the earliest unresolved settlement date remains unresolved beyond the 3-day
terminal grace period, an authorized caller may terminally cancel the ACTIVE
protection. The payout reserve is released and the original premium is refunded
to the protection owner. The eligibility condition is
`current_utc_day > settlement_day + 3`. The stored
`DATA_UNAVAILABLE_OR_CONFLICTING` value is an umbrella terminal-resolution reason meaning that
the earliest required settlement date remained unresolved through the grace period; it does not
prove a specific source failure, source disagreement, or lack of settlement attempt. The
cancellation path is deterministic and does not fetch either settlement source again.
