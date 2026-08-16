# Aegis Markets

> **Aegis Markets gives traders simple, fixed-payout protection against major moves in currencies and precious metals. Choose what you want to protect, select the size and duration of the move, pay a fixed GEN premium, and claim a predefined payout when independent market data confirms the trigger.**

> **No leverage. No liquidations. Clear terms before purchase.**

| Deployment       | Current value                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Network          | GenLayer Bradbury                                                                                                                         |
| Contract         | [`0x50C0073170f9de34e57227739441A153af2f5f84`](https://explorer-bradbury.genlayer.com/address/0x50C0073170f9de34e57227739441A153af2f5f84) |
| Wallets          | Installed EVM-compatible browser wallets                                                                                                  |
| Contract version | `1.0.0`                                                                                                                                   |

## Live Application

[Launch Aegis Markets](https://aegis-markets-phi.vercel.app/)

Connect an EVM-compatible browser wallet on GenLayer Bradbury to explore supported markets,
purchase protection, view wallet-owned protections, settle eligible dates, and claim confirmed
payouts. Purchases still require native GEN, an available pool, and the Bradbury network.

## Vision

Market protection should be understandable before a user pays for it and verifiable when a
payout decision is made.

Aegis Markets was built for traders who want protection against a defined currency or
precious-metals move without opening a leveraged position or managing liquidation risk. Each
protection has fixed terms: a known premium, a known trigger, a fixed duration, and a predefined
payout.

The broader vision is to make externally settled financial agreements transparent enough for
users to understand and independently verifiable enough to operate without a traditional claims
desk. GenLayer validators confirm the market data used by the contract, while deterministic
contract rules decide what happens to funds and protection state.

## What Aegis Does

A buyer chooses one of five supported markets, a `2%`, `3%`, or `4%` movement threshold,
and a protection period of `7`, `14`, or `30` days. The contract returns the fixed premium
and fixed payout for that combination. The premium is paid in native GEN.

During purchase, the contract obtains and stores a live reference price. It then calculates
the trigger price from that reference and the market's fixed direction. These prices are
supposed to differ: for downward `2%` protection, the trigger is the reference price minus
`2%`; for upward `2%` protection, it is the reference price plus `2%`.

Eligible dates can then be settled against historical market data. A confirmed breach makes
the protection claimable, and only its owner can claim the predefined payout.

## Key Innovations

### Fixed terms before purchase

The contract defines the market, movement threshold, duration, premium, and payout before a
purchase is submitted. Users can understand the cost, trigger conditions, and possible payout
without supplying arbitrary terms.

### Validator-confirmed purchase reference

The purchase reference comes from a live market-data read through GenLayer's nondeterministic
execution path. Validators independently fetch and check the result against bounded timestamp
and price-tolerance rules before it affects contract state.

### Dual-source daily settlement

Each settlement checks FXRatesAPI historical data and Fawaz currency data. The contract compares
both normalized results against the stored trigger; agreement confirms a qualifying move or a
non-qualifying move, while disagreement remains inconclusive rather than forcing an outcome.

### Deterministic financial state after consensus

Once a result is accepted, the contract deterministically applies premium accounting, payout
reservation, liquidity checks, lifecycle counters, reserve release, and payout transfers. External
evidence is kept separate from the financial state mutation it authorizes.

### Controlled settlement with owner participation

Protection owners can settle their own eligible protections, while the contract owner and
approved operators can settle any protection. Only the protection owner can claim a payout,
separating the ability to keep a protection moving from the right to receive its funds.

### Retryable inconclusive dates and terminal cancellation

When the two settlement sources disagree, the date remains unresolved and can be retried under
the contract's versioning rules instead of being finalized from unsupported evidence.

Reusable validator-approved settlement evidence is stored by market and date. A retryable
inconclusive case may create a newer settlement version, while each protection remains tied to
the version it used. A conclusive protection/date result remains final.

Historical source corrections do not retroactively alter a protection/date that has already
reached a conclusive BREACHED or NOT_BREACHED result. Revised source evidence may only be
considered while that protection/date remains unresolved or INCONCLUSIVE.

If the earliest unresolved settlement date remains unresolved beyond the 3-day terminal grace
period, an authorized caller may terminally cancel the ACTIVE protection. The payout reserve is
released and the original premium is refunded to the protection owner. This deterministic escape
path does not fetch market data again.

Terminal cancellation is available to the protection owner, contract owner, or approved
settlement operator only after `current_utc_day > settlement_day + 3`. The stored
`DATA_UNAVAILABLE_OR_CONFLICTING` value is an umbrella terminal-resolution reason meaning that
the earliest required settlement date remained unresolved through the grace period; it does not
prove whether the cause was a specific source failure, source disagreement, or no settlement
attempt. Cancellation releases the reserved payout and refunds the original premium, but does
not pay the payout.

## Technical Pillars

### Consensus-gated external data

Live and historical market data enters through GenLayer nondeterministic execution and
independent validator checks. Structured results, freshness windows, price tolerances, and
classified source failures are validated before a result can affect protection state.

### Deterministic fixed-point calculations

GEN amounts and normalized market prices use integer units. Triggers, premiums, payouts,
reserves, counters, and date handling avoid floating-point arithmetic so the same accepted
result produces the same state transition.

### Reserved-liability accounting

Pool balance, reserved liability, and available liquidity are tracked separately. A protection is
created only when available liquidity plus its incoming premium covers the predefined payout;
reserved funds are released on expiry or paid when the owner claims.

### Explicit protection lifecycle

The implemented lifecycle is `Active → Payout available → Paid` for a confirmed breach,
`Active → Ended` when all required dates complete without one, or `Active → Cancelled` when
the earliest unresolved date remains unresolved through the 3-day terminal grace period. An
inconclusive date stays unresolved until a later settlement attempt succeeds or authorized
terminal cancellation is used.

### Wallet-scoped frontend and transparent reads

The frontend connects to installed EVM-compatible browser wallets, validates the selected
account and Bradbury chain, and reads wallet-owned protections directly from the deployed
contract. Public wallet addresses cross the ABI boundary as full hexadecimal strings, while the
contract retains typed `Address` values internally; there is no private application database.

## How It Works

1. Choose a market.
2. Select a movement threshold.
3. Select a protection period.
4. Review the fixed premium and payout returned by the contract.
5. Confirm the purchase in an injected browser wallet.
6. Settle eligible dates as they become ready.
7. Claim the fixed payout if the trigger is confirmed.

Settlement is user-initiated: the contract does not wake itself up or submit daily
transactions. A protection owner can settle their own protection. The contract owner and up
to five approved operators can settle any protection. If several dates were missed, the
oldest unresolved date must be handled first, one date at a time.

### Settlement timing

A settlement date represents the UTC market day being evaluated. Daily settlement availability
is determined in UTC, after that day has closed. For example, a protection purchased on 6 Aug
has 7 Aug as its first stored settlement date; 7 Aug data becomes available to settle after
00:00 UTC on 8 Aug, and 8 Aug data becomes available after 00:00 UTC on 9 Aug. The frontend
prevents same-day attempts while the historical daily market data is still being finalized, and
the contract independently enforces that the requested date is strictly earlier than the current
UTC day. The frontend presents the contract's readiness, keeps blocked actions disabled, and
submits the exact date; it cannot choose settlement prices or outcomes.

If a date is missed, it remains unresolved rather than being skipped. The oldest unresolved date
stays next in line, so later dates are handled one at a time in chronological order; processing
and any resulting payout decision may simply be delayed. This ordering is enforced by
`settle_protection`, including when reusable market/date evidence is already cached.

When the oldest unresolved date has passed the terminal grace period, the protection detail page
also reports whether terminal cancellation is ready. Only the protection owner, contract owner,
or an approved settlement operator can initiate it. The original premium is refunded; the
released payout reserve is not money paid to the user.

## UI Tour

### Explore supported markets

View the currency and precious-metal markets currently supported by the deployed Aegis
contract, including each market’s fixed protected direction.

![Aegis Markets supported market overview](docs/images/aegis-markets.png)

### Configure protection

Choose a market, movement threshold, and protection period. Premium, fixed payout, and
available liquidity are read directly from the deployed contract.

![Configure fixed-payout protection in Aegis Markets](docs/images/aegis-create-protection.png)

### Review the purchase

Review the selected market, direction, threshold, duration, premium, payout, connected wallet,
network, and deployed contract before confirming the purchase.

![Review an Aegis Markets protection purchase](docs/images/aegis-review-protection.png)

### Track protections

The dashboard summarizes the connected wallet’s active, claimable, claimed, and expired
protections using live contract data.

![Aegis Markets wallet dashboard](docs/images/aegis-dashboard.png)

### Settle or claim

The protection detail page shows the locked reference price, calculated trigger price,
settlement history, next unresolved date, and the action currently available to the owner.

![Aegis protection details, settlement, and claim view](docs/images/aegis-protection-details.png)

## Why Aegis Uses GenLayer

The outcome depends on facts that exist outside the contract. A purchase needs a current
market reference, while settlement needs historical prices for a specific date. A normal
deterministic contract cannot independently fetch and verify those facts.

GenLayer validators execute the configured web reads independently and check the evidence
before it changes contract state. Purchase references come from the live FXRatesAPI feed.
Settlement checks FXRatesAPI historical data and the independently published Fawaz Currency
API dataset. Users cannot submit reference prices, trigger prices, source prices, or outcomes.
The contract applies the stored direction and trigger after validator agreement.

## Architecture

The system keeps public reads separate from wallet-authorized writes. External data is fetched
inside GenLayer execution, while the contract remains the authority for terms, protection
state, pool accounting, settlement outcomes, and payout rights.

```mermaid
flowchart LR
    U[User]
    W[Injected browser wallet]
    F[Aegis frontend]
    RW[RainbowKit and Wagmi]
    R[Read-only GenLayer client]
    X[Validated write service]
    C[AegisProtection contract]
    V[GenLayer validators]
    L[FXRatesAPI latest]
    H[FXRatesAPI historical]
    Z[Fawaz Currency API]
    P[GEN protection pool]
    S[Protection and settlement storage]
    O[Contract owner]
    K[Approved settlement operators]

    U -->|Browse and select| F
    F -->|Public read path| R
    R --> C

    U --> W
    W --> RW
    RW -->|Current account and provider| X
    F -->|Prepare write| X
    X -->|Purchase path: selection and premium| C
    X -->|Settlement path: protection and date| C
    X -->|Claim path: protection ID| C

    C -->|Consensus execution| V
    V -->|Purchase reference| L
    V -->|Settlement source A| H
    V -->|Settlement source B| Z

    C --> P
    C --> S
    C -->|Claimed GEN| W

    O -->|Administration and settlement| W
    K -->|Authorized settlement| W
```

The intelligent contract is [one auditable Python source](contract/AegisProtection.py).
Supporting design notes cover the
[architecture](docs/architecture.md), [economics](docs/economics.md),
[settlement model](docs/settlement-model.md), and [security model](docs/security.md).

## Protection Lifecycle

```mermaid
stateDiagram-v2
    [*] --> ACTIVE: Purchase accepted
    ACTIVE --> ACTIVE: NOT_BREACHED before final date
    ACTIVE --> ACTIVE: INCONCLUSIVE
    ACTIVE --> CLAIMABLE: BREACHED
    ACTIVE --> EXPIRED: Final NOT_BREACHED
    ACTIVE --> CANCELLED: Unresolved through terminal grace period
    CLAIMABLE --> CLAIMED: Owner claims payout
```

- `ACTIVE`: the protection still has unresolved dates.
- `CLAIMABLE`: the trigger was confirmed and the payout remains reserved.
- `CLAIMED`: the protection owner received the payout.
- `EXPIRED`: every required date completed without a breach.
- `CANCELLED`: the earliest unresolved date remained unresolved through the 3-day terminal grace
  period; the payout reserve was released and the original premium was refunded.
- `INCONCLUSIVE`: the sources disagreed for a date, so that date can be retried.

## Settlement and Verification

Purchase and settlement use different evidence because they answer different questions.

### Purchase verification

FXRatesAPI latest supplies the reference observation. It must be no more than `900` seconds
old. Validators independently refetch it, require timestamps within `90` seconds of one
another, and allow at most `5` basis points of normalized price difference. The accepted
reference is stored, and the contract calculates the trigger.

### Settlement verification

Source A is FXRatesAPI historical. Source B is the Fawaz Currency API, using its jsDelivr path
first and its Pages path as a delivery fallback. Both source dates must exactly match the
requested settlement date. Validators independently reproduce the structured result, and the
contract tests both returned prices against the protection's stored trigger.

| Stage               | Source                | Result                                        |
| ------------------- | --------------------- | --------------------------------------------- |
| Purchase            | FXRatesAPI latest     | Reference price                               |
| Settlement source A | FXRatesAPI historical | Historical price                              |
| Settlement source B | Fawaz Currency API    | Independent historical price                  |
| Reconciliation      | Both sources          | `BREACHED`, `NOT_BREACHED`, or `INCONCLUSIVE` |

Both sources confirming the trigger produces `BREACHED`; both rejecting it produces
`NOT_BREACHED`; disagreement produces `INCONCLUSIVE`. The two prices do not need to be
numerically identical. They must agree on whether the stored trigger was crossed.

## Permissions and Liveness

| Action                     | Who can call it                     |
| -------------------------- | ----------------------------------- |
| Fund pool                  | Contract owner                      |
| Withdraw unreserved GEN    | Contract owner                      |
| Pause new purchases        | Contract owner                      |
| Resume new purchases       | Contract owner                      |
| Add settlement operator    | Contract owner                      |
| Remove settlement operator | Contract owner                      |
| Purchase protection        | Any wallet                          |
| Settle any protection      | Contract owner or approved operator |
| Settle personal protection | Protection owner                    |
| Terminal-cancel protection  | Protection owner, contract owner, or approved operator |
| Claim payout               | Protection owner                    |

> Settlement can be initiated by the contract owner, an approved operator, or the owner of
> the individual protection.

At most five approved operators can be active, and the owner does not consume an operator
slot. Removing an operator immediately removes its access. Unrelated wallets cannot settle.
Authorization is checked before any external web request, avoiding unnecessary validator and
source work for rejected callers.

The purchase pause affects new purchases only. It does not block settlement or claims. Users
retain a self-settlement path for their own protections, but someone must initiate each
settlement transaction.

Terminal cancellation is also caller-triggered. Once the earliest unresolved date is more than
three UTC days old, the protection owner, contract owner, or approved settlement operator may
call `terminal_cancel_protection(protection_id)`. The contract derives the date internally,
releases the payout reserve, and refunds the original premium.

## Supported Markets

| Market  | Category | Protected direction |
| ------- | -------- | ------------------- |
| GBP/USD | Currency | Down                |
| USD/JPY | Currency | Up                  |
| USD/TRY | Currency | Up                  |
| XAU/USD | Metal    | Down                |
| XAG/USD | Metal    | Down                |

Direction is fixed by contract version `1.0.0`; users cannot choose both directions for a
market.

## Protection Terms

| Period  | 2% movement                  | 3% movement   | 4% movement    |
| ------- | ---------------------------- | ------------- | -------------- |
| 7 days  | 1 GEN premium / 2 GEN payout | 1 GEN / 3 GEN | 1 GEN / 4 GEN  |
| 14 days | 2 GEN / 4 GEN                | 2 GEN / 5 GEN | 2 GEN / 6 GEN  |
| 30 days | 3 GEN / 6 GEN                | 3 GEN / 8 GEN | 3 GEN / 10 GEN |

Premium and payout are fixed for each combination. The contract derives and enforces them;
the frontend cannot set them, and users cannot submit arbitrary terms.

## Pool and Payout Safety

The protection pool is owner-funded. Only the contract owner can add GEN or withdraw
unreserved GEN. Funds reserved for existing payouts cannot be withdrawn.

A purchase succeeds only when:

```text
available liquidity + incoming premium >= fixed payout
```

The full payout is reserved when protection is purchased. A breached payout stays reserved
until the owner claims it. If every required date finishes without a breach, the protection
expires immediately and releases that reserve. Accounting checks prevent reserved liability
from exceeding the pool balance. The pool is not an investment product and has no depositor
shares or yield.

`total_premiums_collected` and `owner_premiums_paid` are gross cumulative metrics. Terminal
refunds reduce `pool_balance` by the refunded premium but do not decrement those historical gross
totals. Cancelled protections currently have no separate global or owner cancellation counter,
so the status counters are not intended to partition `total_protections`.

## Contract Interface

The current contract schema exposes `38` public methods: `28` views and `10` writes.

| Group                     | Methods                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Configuration and markets | `get_config`, `get_supported_markets`, `get_market`, `get_product_terms`, `quote_protection`, `preview_trigger`                                                                |
| Pool and protocol         | `get_pool_state`, `available_liquidity`, `get_protocol_stats`, `purchases_paused`                                                                                              |
| Protection reads          | `get_protection`, `get_protection_count`, `get_owned_protection_count`, `get_owned_protection_ids`, `get_my_dashboard_summary`, `get_my_protections`, `get_protection_details` |
| Settlement reads          | `get_market_settlement`, `get_protection_settlement_result`, `get_protection_settlement_version`, `get_settlement_history`, `get_settlement_readiness`, `get_terminal_cancellation_readiness` |
| Operator reads            | `is_settlement_operator`, `get_settlement_operator_count`, `get_settlement_operator_at`, `get_settlement_operators`, `can_settle_protection`                                   |
| User writes               | `purchase_protection`, `settle_protection`, `terminal_cancel_protection`, `claim_payout`                                                                                       |
| Owner writes              | `add_pool_funds`, `withdraw_unreserved_gen`, `add_settlement_operator`, `remove_settlement_operator`, `pause_purchases`, `unpause_purchases`                                   |

## Frontend and Wallet Architecture

The [frontend](frontend/) uses React, TypeScript, RainbowKit, Wagmi, GenLayerJS, and TanStack
Query. It targets Bradbury only and discovers installed browser wallets through the injected
Wagmi connector and EIP-6963 where supported. There is no WalletConnect connector, project ID,
QR-code connection path, or production mock-data fallback.

Public pages use a read-only GenLayer client and do not require a wallet. Before every write,
the centralized service asks the active connector for its current EIP-1193 provider, calls
`eth_accounts`, matches the provider account to Wagmi's selected account, and checks
`eth_chainId` against `4221`. React route components do not own raw providers or submit direct
RPC writes.

TanStack Query keys contract data by the Aegis namespace, Bradbury chain ID, current contract
address, subject, wallet address, protection ID, and settlement date. Successful writes invalidate
the relevant scoped cached reads. The transaction lifecycle treats a structured GenLayer
`ACCEPTED` status as completed immediately, provided execution succeeded and did not revert. It
does not wait for a later `FINALIZED` status.

## Testing and Validation

The following results were reproduced against the current working tree.

| Check                                        | Result                                        |
| -------------------------------------------- | --------------------------------------------- |
| Contract test suite                          | `165 passed`, `0 failed`, `0 skipped`         |
| Frontend test suite                          | `60 passed`, `0 failed`                       |
| GenVM lint and semantic validation           | Passed                                        |
| GenVM schema/ABI extraction                  | Passed: `38` methods (`28` views, `10` writes) |
| GenVM contract typecheck                     | Passed with no type errors                    |
| Security and access-control coverage         | Passed within the contract suite              |
| Lifecycle and settlement-permission coverage | Passed within the contract suite              |
| Pool and payout accounting coverage          | Passed within the contract suite              |
| Pickling and storage round trips             | Passed within the contract suite              |
| Current contract source size                 | `51,358` bytes (UTF-8 source only; not payload) |

Tests use deterministic source mocks where external market-data behavior must be reproduced.
They cover source validation, permission checks, operator swap-and-pop storage, settlement
retries, duplicate-call safety, lifecycle counters, and reserve accounting.

## Deployment

| Item             | Value                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Network          | GenLayer Bradbury                                                                                                                         |
| Chain ID         | `4221`                                                                                                                                    |
| Contract         | [`0x50C0073170f9de34e57227739441A153af2f5f84`](https://explorer-bradbury.genlayer.com/address/0x50C0073170f9de34e57227739441A153af2f5f84) |
| RPC              | [https://rpc-bradbury.genlayer.com](https://rpc-bradbury.genlayer.com)                                                                    |
| Explorer         | [https://explorer-bradbury.genlayer.com](https://explorer-bradbury.genlayer.com)                                                          |
| Contract version | `1.0.0`                                                                                                                                   |

The current production deployment is the contract address listed above. Its terminal-cancellation
behavior and 38-method schema are present at that production address.

## Local Development

```bash
git clone https://github.com/jason4185/aegis-markets.git
cd aegis-markets/frontend
bun install
cp .env.example .env
bun run dev
```

Required public frontend variables:

```text
VITE_GENLAYER_RPC_URL
VITE_GENLAYER_CHAIN_ID
VITE_AEGIS_CONTRACT_ADDRESS
VITE_GENLAYER_EXPLORER_URL
```

These values are public network configuration, not secrets. Never add private keys, wallet
credentials, or seed phrases. Connecting for writes requires an injected EVM-compatible
browser wallet configured for GenLayer Bradbury.

## Current Status

- The contract is deployed on GenLayer Bradbury and serves contract-backed public reads.
- The frontend supports injected-wallet connection, real purchases, a wallet dashboard,
  protection details, owner self-settlement, approved-operator settlement, and owner-only
  claims.
- The shared pool is owner-funded, and the owner can manage up to five settlement operators.
- Fixed markets and protection terms are enforced by the contract.
- A final conclusive non-breach expires protection automatically; a breach becomes claimable.
- Owner operator-management controls are available in the transparency interface.
- Successful frontend transactions complete when GenLayer returns a validated `ACCEPTED`
  execution result.

## Limitations

- Settlement requires the contract owner, an approved operator, or the protection owner.
- Each settlement transaction handles one protection and one date; missed dates are cleared in
  chronological order.
- The contract does not wake itself up, run a keeper, or batch settlements.
- The contract owner funds the pool; there are no liquidity-provider shares.
- Markets, directions, thresholds, durations, premiums, and payouts are fixed in version
  `1.0.0`.
- A definitive settlement needs both sources to agree on the trigger outcome. An
  `INCONCLUSIVE` date may need another attempt.
- New purchases depend on sufficient available pool liquidity.
- Bradbury is the only configured network, and wallet connection is injected-only.

## License

No license terms are currently specified in this repository. The tracked `LICENSE` file is
empty, so do not assume permission beyond rights granted separately by the repository owner.
