# Economics

All monetary values use integer attoGEN. One GEN is `10^18` attoGEN. There are
no fractional tables, multipliers, category surcharges, dynamic prices, or
user-selected payout amounts.

| Duration | Public event input | Stored event level | Premium | Fixed payout |
|---:|---:|---:|---:|---:|
| 7 days | 2% (`2`) | 200 bps | 1 GEN | 2 GEN |
| 7 days | 3% (`3`) | 300 bps | 1 GEN | 3 GEN |
| 7 days | 4% (`4`) | 400 bps | 1 GEN | 4 GEN |
| 14 days | 2% (`2`) | 200 bps | 2 GEN | 4 GEN |
| 14 days | 3% (`3`) | 300 bps | 2 GEN | 5 GEN |
| 14 days | 4% (`4`) | 400 bps | 2 GEN | 6 GEN |
| 30 days | 2% (`2`) | 200 bps | 3 GEN | 6 GEN |
| 30 days | 3% (`3`) | 300 bps | 3 GEN | 8 GEN |
| 30 days | 4% (`4`) | 400 bps | 3 GEN | 10 GEN |

The ABI parameter is `event_percent` for `purchase_protection`,
`quote_protection`, and `preview_trigger`. Each method accepts only `2`, `3`,
or `4`, then computes `event_bps = event_percent * 100`. Product-term and
protection views expose both representations.

The maximum payout is 10 GEN.

## Shared pool

Every market uses one pool. Anyone may call the payable `add_pool_funds` method.
An exact purchase premium is added to `pool_balance`; the selected fixed payout
is added to `reserved_liability`. A purchase succeeds only when available
liquidity after receipt of its premium covers the new payout.

`available_liquidity = pool_balance - reserved_liability`

The contract rejects an accounting state where liability exceeds pool balance.
The owner can withdraw only available liquidity with
`withdraw_unreserved_gen(amount_gen)`. Its ABI argument is a whole-GEN amount,
so Studio inputs `1`, `2`, and `3` withdraw 1, 2, and 3 GEN respectively. The
contract safely converts that input to attoGEN before checking liquidity,
updating `pool_balance`, and sending the finalized transfer to the owner.

When both sources confirm a breach, the policy remains fully reserved while it
is `CLAIMABLE`. On claim, both pool balance and reserved liability decrease by
the fixed payout. An untriggered policy releases its reservation only after
expiry and after all eligible dates have a conclusive `NOT_BREACHED` result. Release
and claim flags prevent repeated accounting changes.

An `INCONCLUSIVE` result does not pay and cannot count toward expiry. Once
coverage has ended and every eligible date is conclusively `NOT_BREACHED`, the
protection expires and releases its reserve.
