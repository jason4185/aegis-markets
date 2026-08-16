import pickle
import pytest

from tests.test_aegis_protection import (
    ALICE, BOB, C, GEN, assert_error, deploy, fund, gl, mock_settlement,
    purchase, set_context,
)


def purchase_at(contract, datetime_value, duration):
    premium, _ = C._terms(duration, 200)
    set_context(ALICE, premium, datetime_value)
    timestamp = C._iso_timestamp(datetime_value, "error")
    from tests.test_aegis_protection import mock_latest
    mock_latest(timestamp=timestamp, date=datetime_value[0:10])
    return contract.purchase_protection("GBP_USD", duration, 2)


@pytest.mark.parametrize("duration", [7, 14, 30])
@pytest.mark.parametrize("purchase_time", [
    "2026-06-01T00:00:00Z",
    "2026-06-01T23:59:59Z",
])
def test_complete_daily_period_bounds_for_all_durations(duration, purchase_time):
    contract = deploy()
    fund(contract)
    protection_id = purchase_at(contract, purchase_time, duration)
    item = contract.get_protection(protection_id)
    purchase_day = C._date_day("2026-06-01", "error")
    assert item["first_settlement_day"] == purchase_day + 1
    assert item["last_settlement_day"] == purchase_day + duration
    assert item["expires_at"] == (purchase_day + duration + 1) * C.DAY_SECONDS


def test_expires_at_remains_informational_metadata():
    contract = deploy()
    fund(contract)
    protection_id = purchase(contract)
    item = contract.get_protection(protection_id)
    assert item["expires_at"] == (item["last_settlement_day"] + 1) * C.DAY_SECONDS
    assert not hasattr(contract, "finalize_expired_protection")
    assert contract.get_pool_state()["reserved_liability"] == 2 * GEN


def make_claimable():
    contract = deploy()
    fund(contract)
    protection_id = purchase(contract)
    mock_settlement(
        "2026-06-02",
        fx_rates={"GBP": "0.82", "JPY": "150", "TRY": "32", "XAU": "0.0005", "XAG": "0.04"},
        fawaz_rates={"gbp": "0.82", "jpy": "150", "try": "32", "xau": "0.0005", "xag": "0.04"},
    )
    set_context(ALICE, 0, "2026-06-03T12:00:00Z")
    contract.settle_protection(protection_id, "2026-06-02")
    return contract, protection_id


def test_breach_to_claimable_transition_retains_reserve():
    contract, protection_id = make_claimable()
    item = contract.get_protection(protection_id)
    assert item["status"] == "CLAIMABLE"
    assert item["breach_date"] == "2026-06-02"
    assert item["reserve_released"] is False
    assert contract.get_pool_state()["reserved_liability"] == 2 * GEN


def test_pull_claim_reduces_pool_and_reserved_liability():
    contract, protection_id = make_claimable()
    set_context(ALICE)
    contract.claim_payout(protection_id)
    item = contract.get_protection(protection_id)
    assert item["status"] == "CLAIMED"
    assert item["claimed"] is True and item["reserve_released"] is True
    assert contract.get_pool_state() == {
        "pool_balance": 29 * GEN,
        "reserved_liability": 0,
        "available_liquidity": 29 * GEN,
    }
    assert gl.transfers[-1] == (ALICE.lower(), 2 * GEN, "finalized")


def test_only_protection_owner_can_claim():
    contract, protection_id = make_claimable()
    set_context(BOB)
    assert_error(C.E_UNAUTHORIZED, lambda: contract.claim_payout(protection_id))


def test_double_claim_rejected():
    contract, protection_id = make_claimable()
    set_context(ALICE)
    contract.claim_payout(protection_id)
    assert_error(C.E_ALREADY_CLAIMED, lambda: contract.claim_payout(protection_id))
    assert len(gl.transfers) == 1


def _process_all_expiry_dates(inconclusive_date=""):
    contract = deploy()
    fund(contract)
    protection_id = purchase(contract)
    dates = (
        "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05",
        "2026-06-06", "2026-06-07", "2026-06-08",
    )
    set_context(ALICE, 0, "2026-06-10T12:00:00Z")
    for date in dates:
        fx_gbp = "0.82" if date == inconclusive_date else "0.8"
        mock_settlement(
            date,
            fx_rates={"GBP": fx_gbp, "JPY": "150", "TRY": "32", "XAU": "0.0005", "XAG": "0.04"},
            fawaz_rates={"gbp": "0.8", "jpy": "150", "try": "32", "xau": "0.0005", "xag": "0.04"},
        )
        contract.settle_protection(protection_id, date)
        if date == inconclusive_date:
            break
    return contract, protection_id


def _complete_before_expiry():
    contract = deploy()
    fund(contract)
    protection_id = purchase(contract)
    dates = (
        "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05",
        "2026-06-06", "2026-06-07", "2026-06-08",
    )
    set_context(ALICE, 0, "2026-06-09T12:00:00Z")
    for date in dates:
        mock_settlement(date)
        assert contract.settle_protection(protection_id, date) == "NOT_BREACHED"
    assert contract.get_protection(protection_id)["status"] == "EXPIRED"
    return contract, protection_id


def test_expiry_releases_reserved_liability_once():
    contract, protection_id = _process_all_expiry_dates()
    item = contract.get_protection(protection_id)
    assert item["status"] == "EXPIRED"
    assert item["processed_dates"] == 7
    assert item["reserve_released"] is True
    assert contract.get_pool_state()["reserved_liability"] == 0


def test_repeated_final_not_breached_auto_expires_once_without_refetch():
    contract, protection_id = _complete_before_expiry()
    before = contract.get_protocol_stats()
    owner_before = contract.get_my_dashboard_summary(ALICE)
    assert before["active_protections"] == 0 and before["expired_protections"] == 1
    assert owner_before["active_count"] == 0 and owner_before["expired_count"] == 1

    gl.nondet.web.clear()
    set_context(ALICE, 0, "2026-06-09T00:00:00Z")
    assert contract.settle_protection(protection_id, "2026-06-08") == "NOT_BREACHED"
    assert contract.get_protection(protection_id)["status"] == "EXPIRED"
    assert contract.get_protocol_stats() == before
    assert gl.nondet.web.requests == []
    assert contract.get_my_dashboard_summary(ALICE) == owner_before
    assert contract.get_pool_state()["reserved_liability"] == 0


def test_inconclusive_date_does_not_expire_policy_prematurely():
    contract = deploy()
    fund(contract)
    protection_id = purchase(contract)
    mock_settlement(
        "2026-06-02",
        fx_rates={"GBP": "0.82", "JPY": "150", "TRY": "32", "XAU": "0.0005", "XAG": "0.04"},
        fawaz_rates={"gbp": "0.8", "jpy": "150", "try": "32", "xau": "0.0005", "xag": "0.04"},
    )
    set_context(ALICE, 0, "2026-06-10T12:00:00Z")
    contract.settle_protection(protection_id, "2026-06-02")
    assert contract.get_protection(protection_id)["status"] == "ACTIVE"


def test_inconclusive_date_never_counts_toward_expiry():
    contract, protection_id = _process_all_expiry_dates("2026-06-02")
    item = contract.get_protection(protection_id)
    assert item["status"] == "ACTIVE"
    assert item["processed_dates"] == 0
    assert item["inconclusive_dates"] == 1
    assert item["reserve_released"] is False
    assert contract.get_pool_state()["reserved_liability"] == 2 * GEN


def test_resolving_the_last_inconclusive_date_allows_expiry():
    contract, protection_id = _process_all_expiry_dates("2026-06-02")
    C.gl.nondet.web.clear()
    mock_settlement("2026-06-02")
    set_context(ALICE, 0, "2026-06-11T12:00:00Z")
    assert contract.settle_protection(protection_id, "2026-06-02") == "NOT_BREACHED"
    for date in ("2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06", "2026-06-07", "2026-06-08"):
        mock_settlement(date)
        assert contract.settle_protection(protection_id, date) == "NOT_BREACHED"
    item = contract.get_protection(protection_id)
    assert item["status"] == "EXPIRED"
    assert item["processed_dates"] == 7
    assert item["inconclusive_dates"] == 0
    assert contract.get_pool_state()["reserved_liability"] == 0


def test_double_reserve_release_rejected():
    contract, protection_id = _process_all_expiry_dates()
    before = contract.get_pool_state()
    set_context(ALICE, 0, "2026-06-12T12:00:00Z")
    assert contract.settle_protection(protection_id, "2026-06-08") == "NOT_BREACHED"
    assert contract.get_pool_state() == before


def test_finalized_policy_cannot_settle_later_date():
    contract, protection_id = make_claimable()
    mock_settlement("2026-06-03")
    set_context(ALICE, 0, "2026-06-04T12:00:00Z")
    assert_error(
        C.E_NOT_ACTIVE,
        lambda: contract.settle_protection(protection_id, "2026-06-03"),
    )


def test_storage_records_pickle_round_trip():
    contract, protection_id = make_claimable()
    stored = contract.protections[protection_id]
    restored = pickle.loads(pickle.dumps(stored))
    assert restored.owner == stored.owner
    assert restored.market_id == "GBP_USD"
    assert restored.status == "CLAIMABLE"
    settlement = contract.market_settlements["GBP_USD|2026-06-02"]
    restored_settlement = pickle.loads(pickle.dumps(settlement))
    assert restored_settlement.fxratesapi_price == settlement.fxratesapi_price
    restored_versions = pickle.loads(pickle.dumps(contract.protection_settlement_versions))
    assert restored_versions["0|2026-06-02"] == 1


def test_protocol_and_owner_dashboard_counters_follow_claim_lifecycle():
    contract, protection_id = make_claimable()
    stats = contract.get_protocol_stats()
    assert stats["total_protections"] == 1
    assert stats["active_protections"] == 0
    assert stats["claimable_protections"] == 1
    assert stats["total_premiums_collected"] == GEN
    summary = contract.get_my_dashboard_summary(ALICE)
    assert summary["total_protections"] == 1
    assert summary["active_count"] == 0
    assert summary["claimable_count"] == 1
    assert summary["total_premiums_paid"] == GEN
    assert summary["total_claimable_payout"] == 2 * GEN
    set_context(ALICE)
    contract.claim_payout(protection_id)
    stats = contract.get_protocol_stats()
    assert stats["claimable_protections"] == 0
    assert stats["claimed_protections"] == 1
    assert stats["total_payouts_paid"] == 2 * GEN
    summary = contract.get_my_dashboard_summary(ALICE)
    assert summary["claimed_count"] == 1
    assert summary["total_claimable_payout"] == 0
    assert summary["total_payouts_received"] == 2 * GEN


def test_expiry_updates_dashboard_counters_exactly_once():
    contract, protection_id = _process_all_expiry_dates()
    stats = contract.get_protocol_stats()
    assert stats["active_protections"] == 0
    assert stats["expired_protections"] == 1
    summary = contract.get_my_dashboard_summary(ALICE)
    assert summary["active_count"] == 0 and summary["expired_count"] == 1
    set_context(ALICE, 0, "2026-06-12T12:00:00Z")
    assert contract.settle_protection(protection_id, "2026-06-08") == "NOT_BREACHED"
    assert contract.get_protocol_stats()["expired_protections"] == 1


def test_frontend_protection_cards_and_pagination():
    contract = deploy()
    fund(contract)
    first = purchase(contract, buyer=ALICE)
    second = purchase(contract, market="XAU_USD", event=3, buyer=ALICE)
    cards = contract.get_my_protections(ALICE, 0, 2)
    assert [card["id"] for card in cards] == [first, second]
    assert cards[0]["symbol"] == "GBP/USD"
    assert cards[0]["direction"] == "DOWN"
    assert cards[1]["symbol"] == "XAU/USD"
    assert cards[1]["category"] == "METAL"
    assert cards[1]["event_percent"] == 3
    assert_error(C.E_BAD_PAGE, lambda: contract.get_my_protections(ALICE, 0, 0))
    assert_error(C.E_BAD_PAGE, lambda: contract.get_my_protections(ALICE, 0, C.MAX_PAGE_SIZE + 1))


def test_protection_details_readiness_and_history_are_deterministic_reads():
    contract = deploy()
    fund(contract)
    protection_id = purchase(contract)
    C.gl.nondet.web.clear()
    set_context(BOB, 0, "2026-06-02T12:00:00Z")
    details = contract.get_protection_details(protection_id)
    assert details["first_settlement_date"] == "2026-06-02"
    assert details["last_settlement_date"] == "2026-06-08"
    assert details["next_unresolved_settlement_date"] == "2026-06-02"
    assert details["latest_settlement_result"] == "UNPROCESSED"
    ready = contract.get_settlement_readiness(protection_id, "2026-06-02")
    assert ready["ready"] is False and ready["reason_code"] == "SETTLEMENT_DAY_NOT_COMPLETE"
    future = contract.get_settlement_readiness(protection_id, "2026-06-03")
    assert future["ready"] is False and future["reason_code"] == "SETTLEMENT_DAY_NOT_COMPLETE"
    history = contract.get_settlement_history(protection_id, 0, 7)
    assert len(history) == 7
    assert history[0]["settlement_date"] == "2026-06-02"
    assert history[-1]["settlement_date"] == "2026-06-08"
    assert all(entry["result"] == "UNPROCESSED" for entry in history)
    assert C.gl.nondet.web.requests == []
    assert_error(C.E_BAD_PAGE, lambda: contract.get_settlement_history(protection_id, 0, 0))


def test_settlement_history_uses_exact_processed_version():
    contract, protection_id = make_claimable()
    history = contract.get_settlement_history(protection_id, 0, 2)
    assert history[0]["result"] == "BREACHED"
    assert history[0]["processed"] is True
    assert history[0]["market_settlement_version"] == 1
    assert history[0]["fxratesapi_price"] > 0
    assert history[1]["result"] == "UNPROCESSED"
    readiness = contract.get_settlement_readiness(protection_id, "2026-06-02")
    assert readiness["reason_code"] == "DATE_ALREADY_SETTLED"


def test_settlement_history_does_not_leak_shared_evidence_to_unprocessed_protection():
    contract = deploy()
    fund(contract)
    unprocessed_id = purchase(contract, buyer=ALICE)
    processed_id = purchase(contract, buyer=BOB)
    mock_settlement("2026-06-02")
    set_context(BOB, 0, "2026-06-03T12:00:00Z")
    assert contract.settle_protection(processed_id, "2026-06-02") == "NOT_BREACHED"

    unprocessed = contract.get_settlement_history(unprocessed_id, 0, 1)[0]
    assert unprocessed["result"] == "UNPROCESSED"
    assert unprocessed["processed"] is False
    assert unprocessed["market_settlement_version"] == 0
    assert unprocessed["market_settlement_exists"] is False
    assert unprocessed["fxratesapi_price"] == 0
    assert unprocessed["fawaz_price"] == 0
    assert unprocessed["source_a_date"] == ""
    assert unprocessed["source_b_date"] == ""
    assert unprocessed["settled_at"] == 0

    processed = contract.get_settlement_history(processed_id, 0, 1)[0]
    assert processed["result"] == "NOT_BREACHED"
    assert processed["processed"] is True
    assert processed["market_settlement_version"] == 1
    assert processed["market_settlement_exists"] is True
    assert processed["fxratesapi_price"] > 0
    assert processed["fawaz_price"] > 0


def test_settlement_history_inconclusive_uses_exact_used_version():
    contract = deploy()
    fund(contract)
    protection_id = purchase(contract)
    split_fx = {"GBP": "0.82", "JPY": "150", "TRY": "32", "XAU": "0.0005", "XAG": "0.04"}
    split_fawaz = {"gbp": "0.8", "jpy": "150", "try": "32", "xau": "0.0005", "xag": "0.04"}
    mock_settlement("2026-06-02", fx_rates=split_fx, fawaz_rates=split_fawaz)
    set_context(ALICE, 0, "2026-06-03T12:00:00Z")
    assert contract.settle_protection(protection_id, "2026-06-02") == "INCONCLUSIVE"

    history = contract.get_settlement_history(protection_id, 0, 1)[0]
    assert history["result"] == "INCONCLUSIVE"
    assert history["processed"] is True
    assert history["market_settlement_version"] == 1
    assert history["market_settlement_exists"] is True
    assert history["fxratesapi_price"] > 0
    assert history["fawaz_price"] > 0
