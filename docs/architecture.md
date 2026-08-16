# Architecture

## Components and trust boundary

`AegisProtection` is a single-file Intelligent Contract. It contains all five
market definitions, directions, durations, event levels, fixed economics,
source URLs, normalization rules, and lifecycle rules. It does not read a
registry and does not trust prices supplied by a caller or frontend. The
public purchase, quote, and trigger-preview methods accept `event_percent` as
`2`, `3`, or `4`; the contract converts it to 200, 300, or 400 basis points
before entering the existing internal pricing, storage, and trigger paths.

External sources publish raw data. GenLayer validators independently fetch and
normalize the configured source response inside a custom Equivalence Principle.
They compare only compact structured fields. Contract state changes occur after
consensus and are deterministic.

For the mutable latest purchase endpoint, validators require the same source,
market, and validation status, plus fresh timestamps within the configured
window and normalized prices within the configured narrow tolerance. Prices
are never averaged; the leader's validated reference is stored. For dated
settlement URLs, validators require exact agreement on market, settlement date,
both normalized source prices, source identifiers/dates, and validation status.

No LLM is used. Numeric extraction, decimal conversion, reciprocal conversion,
trigger calculation, source comparisons, and lifecycle transitions are code.

## Storage

The contract deliberately uses no dynamic-array storage. Persistent state uses
primitive fields, compact storage dataclasses, and `TreeMap` indexes:

- protections keyed by monotonically increasing integer ID;
- per-owner counts and `owner|index` keys for bounded pagination;
- versioned market settlements keyed by market and date;
- protection/date outcomes keyed by `protection_id|YYYY-MM-DD`;
- the exact market-settlement version used by each protection/date outcome;
- a five-entry settlement-operator index with authorization and reverse maps.

Raw response bodies are never stored. A protection stores only ownership,
terms, reference/trigger prices, timestamps and eligible-day bounds, status,
settlement counters, breach date, claim/reserve guards, and terminal-cancellation
metadata when applicable. A market settlement stores the two normalized prices,
source identifiers, source dates, status, and finalization metadata.

## Write flow

Purchase is payable. The contract validates market and fixed terms, requires
the exact premium, checks pool capacity, obtains the validator-confirmed latest
FXRatesAPI reference, derives the trigger, then stores the protection and
reserves its complete payout.

`settle_protection` handles one protection/date pair in a single write. The
contract owner and approved operators may settle any protection; a protection
owner may settle only their own. It validates authorization before external
work, requires a completed UTC day and the protection's earliest unresolved
date, then reuses existing market/date evidence or obtains two-source consensus
and stores a new market-settlement version. These ordering guards run before
cached evidence or external web requests are used. It then compares each price
independently with the protection trigger. A confirmed breach moves the
protection to `CLAIMABLE`; otherwise the result is `NOT_BREACHED` or
`INCONCLUSIVE`.

Once a protection/date receives a conclusive `BREACHED` or `NOT_BREACHED`
result, that protection/date result is final. New market-settlement versions
are used only to retry results that were previously `INCONCLUSIVE`. A newer
version updates the stored evidence version and adjusts counters only if it
resolves the split. An `INCONCLUSIVE` date remains unresolved and blocks later
dates until it is retried successfully.

The final required `NOT_BREACHED` result expires an active protection and
releases its reserve immediately. `expires_at` remains informational metadata;
there is no manual expiry write. `INCONCLUSIVE` dates remain active until retried.

If the earliest unresolved date remains unresolved beyond the 3-day terminal
grace period, the protection owner, contract owner, or approved settlement
operator may call `terminal_cancel_protection(protection_id)`. The contract
derives the date internally, releases the reserved payout, refunds exactly the
stored premium to the protection owner through the finalized transfer pattern,
and stores the timestamp, unresolved date, and
`DATA_UNAVAILABLE_OR_CONFLICTING` reason. The reason is an umbrella terminal-resolution reason:
the earliest required settlement date remained unresolved through the grace period. It does not
prove a specific source failure, source disagreement, or lack of settlement attempt. It performs
no source fetch.

Historical source corrections do not retroactively alter a protection/date that
has already reached a conclusive BREACHED or NOT_BREACHED result. Revised source
evidence may only be considered while that protection/date remains unresolved or
INCONCLUSIVE.

Claims are pull-based and owner-only. Accounting and lifecycle flags change
before a finalized native-token transfer is emitted. Settlement never loops
over or pays a collection of policies.

## Views and bounded work

Market and product-term loops have fixed sizes. Owner policy lookup is paged
with a maximum of 50 IDs. Writes settle one protection/date and contain no
unbounded iteration. This keeps work predictable for Studio and Bradbury.
