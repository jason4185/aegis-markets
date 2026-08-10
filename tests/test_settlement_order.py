from tests.test_aegis_protection import (
    ALICE,
    C,
    assert_error,
    deploy,
    fund,
    mock_settlement,
    purchase,
    set_context,
)


def policy():
    contract = deploy()
    fund(contract)
    return contract, purchase(contract)


def settle(contract, protection_id, date, now="2026-06-10T12:00:00Z", **mocks):
    mock_settlement(date, **mocks)
    set_context(ALICE, 0, now)
    return contract.settle_protection(protection_id, date)


def test_same_day_settlement_fails_without_external_requests_or_state_change():
    contract, protection_id = policy()
    C.gl.nondet.web.clear()
    set_context(ALICE, 0, "2026-06-02T12:00:00Z")
    before = contract.get_pool_state()

    assert_error(C.E_INVALID_DATE, lambda: contract.settle_protection(protection_id, "2026-06-02"))

    assert contract.market_settlements == {}
    assert contract.get_protection(protection_id)["processed_dates"] == 0
    assert contract.get_protection(protection_id)["inconclusive_dates"] == 0
    assert contract.get_pool_state() == before
    assert C.gl.nondet.web.requests == []


def test_completed_previous_day_can_settle():
    contract, protection_id = policy()
    C.gl.nondet.web.clear()
    assert settle(contract, protection_id, "2026-06-02") == "NOT_BREACHED"
    assert contract.get_protection(protection_id)["processed_dates"] == 1


def test_future_date_fails():
    contract, protection_id = policy()
    C.gl.nondet.web.clear()
    set_context(ALICE, 0, "2026-06-03T12:00:00Z")
    assert_error(C.E_INVALID_DATE, lambda: contract.settle_protection(protection_id, "2026-06-04"))
    assert C.gl.nondet.web.requests == []


def test_out_of_order_next_date_fails_when_earlier_date_is_unresolved():
    contract, protection_id = policy()
    C.gl.nondet.web.clear()
    set_context(ALICE, 0, "2026-06-10T12:00:00Z")
    assert_error(C.E_INVALID_DATE, lambda: contract.settle_protection(protection_id, "2026-06-03"))
    assert_error(C.E_INVALID_DATE, lambda: contract.settle_protection(protection_id, "2026-06-04"))
    assert contract.get_protection(protection_id)["processed_dates"] == 0
    assert C.gl.nondet.web.requests == []


def test_earliest_unresolved_date_succeeds_then_next_date_advances():
    contract, protection_id = policy()
    C.gl.nondet.web.clear()
    assert settle(contract, protection_id, "2026-06-02") == "NOT_BREACHED"
    assert contract.get_protection_details(protection_id)["next_unresolved_settlement_date"] == "2026-06-03"
    assert settle(contract, protection_id, "2026-06-03") == "NOT_BREACHED"


def test_inconclusive_date_blocks_later_date_but_can_be_retried():
    contract, protection_id = policy()
    split_fx = {"GBP": "0.82", "JPY": "150", "TRY": "32", "XAU": "0.0005", "XAG": "0.04"}
    split_fawaz = {"gbp": "0.8", "jpy": "150", "try": "32", "xau": "0.0005", "xag": "0.04"}
    assert settle(contract, protection_id, "2026-06-02", fx_rates=split_fx, fawaz_rates=split_fawaz) == "INCONCLUSIVE"
    C.gl.nondet.web.clear()

    assert_error(C.E_INVALID_DATE, lambda: contract.settle_protection(protection_id, "2026-06-03"))
    assert C.gl.nondet.web.requests == []

    assert settle(contract, protection_id, "2026-06-02") == "NOT_BREACHED"
    assert contract.get_protection_details(protection_id)["next_unresolved_settlement_date"] == "2026-06-03"


def test_cached_later_market_settlement_cannot_bypass_ordering():
    contract, protection_id = policy()
    C.gl.nondet.web.clear()
    key = "GBP_USD|2026-06-04"
    settlement = C.MarketSettlement(
        market_id="GBP_USD",
        settlement_date="2026-06-04",
        settlement_day=C._date_day("2026-06-04", "error"),
        fxratesapi_price=1,
        fawaz_price=1,
        source_a="FXRATESAPI_HISTORICAL",
        source_b="FAWAZ",
        source_a_date="2026-06-04",
        source_b_date="2026-06-04",
        status="FINALIZED",
        finalized=True,
        created_at=0,
    )
    contract.market_settlements[C._versioned_settlement_key(key, 1)] = settlement
    contract.settlement_versions[key] = 1
    set_context(ALICE, 0, "2026-06-10T12:00:00Z")
    assert_error(C.E_INVALID_DATE, lambda: contract.settle_protection(protection_id, "2026-06-04"))
    assert contract.get_protection(protection_id)["processed_dates"] == 0
    assert C.gl.nondet.web.requests == []


def test_readiness_requires_completed_earliest_date_and_retryable_inconclusive():
    contract, protection_id = policy()
    set_context(ALICE, 0, "2026-06-02T12:00:00Z")
    same_day = contract.get_settlement_readiness(protection_id, "2026-06-02")
    assert same_day["ready"] is False
    assert same_day["reason_code"] == "SETTLEMENT_DAY_NOT_COMPLETE"

    set_context(ALICE, 0, "2026-06-10T12:00:00Z")
    later = contract.get_settlement_readiness(protection_id, "2026-06-03")
    assert later["ready"] is False
    assert later["reason_code"] == "SETTLEMENT_ORDER"

    split_fx = {"GBP": "0.82", "JPY": "150", "TRY": "32", "XAU": "0.0005", "XAG": "0.04"}
    split_fawaz = {"gbp": "0.8", "jpy": "150", "try": "32", "xau": "0.0005", "xag": "0.04"}
    mock_settlement("2026-06-02", fx_rates=split_fx, fawaz_rates=split_fawaz)
    set_context(ALICE, 0, "2026-06-10T12:00:00Z")
    assert contract.settle_protection(protection_id, "2026-06-02") == "INCONCLUSIVE"
    retry = contract.get_settlement_readiness(protection_id, "2026-06-02")
    later_retry = contract.get_settlement_readiness(protection_id, "2026-06-03")
    assert retry["ready"] is True and retry["reason_code"] == "MARKET_SETTLEMENT_RETRYABLE"
    assert later_retry["ready"] is False and later_retry["reason_code"] == "SETTLEMENT_ORDER"
