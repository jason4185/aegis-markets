from tests.test_aegis_protection import (
    ALICE, BOB, C, GEN, OWNER, assert_error, deploy, fund, mock_latest,
    mock_settlement, purchase, set_context,
)
from tests.test_protection_lifecycle import make_claimable


def test_owner_can_pause_and_unpause_purchases():
    contract = deploy()
    set_context(OWNER)
    contract.pause_purchases()
    assert contract.purchases_paused() is True
    contract.unpause_purchases()
    assert contract.purchases_paused() is False


def test_non_owner_cannot_pause_or_unpause():
    contract = deploy()
    set_context(ALICE)
    assert_error(C.E_UNAUTHORIZED, contract.pause_purchases)
    set_context(OWNER)
    contract.pause_purchases()
    set_context(BOB)
    assert_error(C.E_UNAUTHORIZED, contract.unpause_purchases)


def test_pause_blocks_only_new_purchases():
    contract = deploy()
    fund(contract)
    set_context(OWNER)
    contract.pause_purchases()
    set_context(ALICE, GEN)
    mock_latest()
    assert_error(
        C.E_PAUSED,
        lambda: contract.purchase_protection("GBP_USD", 7, 2),
    )


def test_claim_remains_available_while_purchases_paused():
    contract, protection_id = make_claimable()
    set_context(OWNER)
    contract.pause_purchases()
    set_context(ALICE)
    contract.claim_payout(protection_id)
    assert contract.get_protection(protection_id)["status"] == "CLAIMED"


def test_settlement_remains_available_while_paused():
    contract = deploy()
    fund(contract)
    protection_id = purchase(contract)
    set_context(OWNER)
    contract.pause_purchases()
    mock_settlement("2026-06-02")
    set_context(BOB, 0, "2026-06-03T12:00:00Z")
    assert contract.settle_protection(protection_id, "2026-06-02") == "NOT_BREACHED"


def test_pool_reads_remain_available_while_paused():
    contract = deploy()
    fund(contract, 5 * GEN)
    set_context(OWNER)
    contract.pause_purchases()
    assert contract.available_liquidity() == 5 * GEN
    assert contract.get_pool_state()["reserved_liability"] == 0


def test_unsupported_market_rejected_everywhere():
    contract = deploy()
    assert_error(C.E_INVALID_MARKET, lambda: contract.get_market("EUR_USD"))
    fund(contract)
    set_context(ALICE, GEN)
    assert_error(
        C.E_INVALID_MARKET,
        lambda: contract.purchase_protection("EUR_USD", 7, 2),
    )


def test_settlement_allows_today_and_rejects_future_date():
    contract = deploy()
    fund(contract)
    protection_id = purchase(contract)
    mock_settlement("2026-06-02")
    set_context(BOB, 0, "2026-06-02T12:00:00Z")
    assert contract.settle_protection(protection_id, "2026-06-02") == "NOT_BREACHED"
    assert_error(
        C.E_INVALID_DATE,
        lambda: contract.settle_protection(protection_id, "2026-06-03"),
    )
