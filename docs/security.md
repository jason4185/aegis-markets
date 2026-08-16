# Security model

## Access control and pause

The deployer is the owner. Only the owner may fund the pool, pause/unpause
purchases, withdraw unreserved GEN, and manage at most five settlement
operators. The owner and approved operators may settle every protection; the
stored protection owner may settle only that protection. Unrelated wallets
cannot settle. The owner, approved operators, and stored protection owner may
terminally cancel that protection after the deterministic grace period. Only
the stored protection owner may claim its payout.

Pause is intentionally purchase-only. It does not block settlement,
expiration, claims, or pool reads.

## Settlement guards

`settle_protection` is the security boundary for settlement timing and order.
The requested date must be strictly earlier than the current UTC day and must
match the protection's earliest unresolved date. An `INCONCLUSIVE` date remains
unresolved, blocks later dates, and can be retried. These checks run before
cached market evidence, external web requests, or settlement-state mutation,
so direct contract callers cannot bypass the frontend's readiness safeguards.

## Consensus and source validation

Web operations use a custom comparative validator. Validators independently
fetch and normalize the configured source and compare consensus-critical fields
exactly. Raw API bodies, unrelated metadata, and prose are excluded. Mutable
latest-price disagreement causes validator disagreement; the contract does not
silently choose one price. Dated URLs and exact date checks reduce settlement
variability.

Responses are size-bounded and must be valid objects with expected USD-base
structure, selected currency, positive representable rate, and required date or
timestamp. Numeric conversion is integer-only and range checked. Division by
zero, nonpositive values, excessively large normalized prices, stale data, and
future timestamps are rejected.

Expected business errors use `[EXPECTED]`, stable external data/4xx failures
use `[EXTERNAL]`, and network/5xx-style failures use `[TRANSIENT]`. Validators
require exact agreement for expected/external errors and category agreement for
transient failures. Unknown validator failures cause disagreement/rotation.

## Lifecycle and accounting guards

The contract checks pool liability never exceeds pool balance. A policy stores
`claimed` and `reserve_released` guards. Claim state and pool accounting change
before the finalized native transfer is emitted. The final required
`NOT_BREACHED` settlement expires immediately and releases a reserve once only.
A claimable, claimed, or expired protection cannot settle later dates.
Repeated conclusive settlement of the same protection/date is idempotent and
does not refetch sources or increment counters again.

Historical source corrections do not retroactively alter a protection/date that
has already reached a conclusive BREACHED or NOT_BREACHED result. Revised source
evidence may only be considered while that protection/date remains unresolved
or INCONCLUSIVE.

The owner cannot withdraw reserved funds. Settlement is evidence caching plus a
single-policy state transition; it never pushes a batch of payouts. Claims are
pull-based.

## Known operational behavior

Expiration requires all eligible protection dates to have a conclusive
`NOT_BREACHED` result and does not wait for informational `expires_at`. This
prevents a caller from expiring protection while an
unresolved eligible date might contain a breach. If the earliest unresolved
settlement date remains unresolved beyond the 3-day terminal grace period, an
authorized caller may terminally cancel the ACTIVE protection. The payout reserve
is released and the original premium is refunded to the protection owner.
Terminal cancellation derives the earliest unresolved date internally, performs
no market-data fetch, stores the cancellation time, date, and
`DATA_UNAVAILABLE_OR_CONFLICTING` umbrella reason, meaning the earliest required settlement date
remained unresolved through the grace period. It does not prove a specific source failure, source
disagreement, or lack of settlement attempt. Cancellation cannot be repeated. Authorized
callers still cannot choose prices or outcomes. The refund decreases
`pool_balance` by exactly the stored premium; cumulative gross premium counters
are not rewritten.

Native claims and withdrawals use GenLayer finalized `emit_transfer`. The
contract does not implement arbitrary callback execution or synchronous payout
loops.
