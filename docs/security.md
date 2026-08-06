# Security model

## Access control and pause

The deployer is the owner. Only the owner may fund the pool, pause/unpause
purchases, withdraw unreserved GEN, and manage at most five settlement
operators. The owner and approved operators may settle every protection; the
stored protection owner may settle only that protection. Unrelated wallets
cannot settle. Only the stored protection owner may claim its payout.

Pause is intentionally purchase-only. It does not block settlement,
expiration, claims, or pool reads.

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

The owner cannot withdraw reserved funds. Settlement is evidence caching plus a
single-policy state transition; it never pushes a batch of payouts. Claims are
pull-based.

## Known operational behavior

Expiration requires all eligible protection dates to have a conclusive
`NOT_BREACHED` result and does not wait for informational `expires_at`. This
prevents a caller from expiring protection while an
unresolved eligible date might contain a breach. If a required dated dataset remains
permanently unavailable, the policy remains active and reserved because the
contract has no administrative oracle or outcome override. Authorized callers
still cannot choose prices or outcomes.

Native claims and withdrawals use GenLayer finalized `emit_transfer`. The
contract does not implement arbitrary callback execution or synchronous payout
loops.
