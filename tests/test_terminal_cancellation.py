import pytest

from tests.test_aegis_protection import (
    ALICE, BOB, C, GEN, OWNER, assert_error, deploy, fund, gl, mock_settlement,
    purchase, set_context,
)
from tests.test_protection_lifecycle import _complete_before_expiry, make_claimable


OPERATOR = "0x" + "44" * 20
SPLIT_FX = {"GBP": "0.82", "JPY": "150", "TRY": "32", "XAU": "0.0005", "XAG": "0.04"}
SPLIT_FAWAZ = {"gbp": "0.8", "jpy": "150", "try": "32", "xau": "0.0005", "xag": "0.04"}
BREACHED_FX = {"GBP": "0.82", "JPY": "150", "TRY": "32", "XAU": "0.0005", "XAG": "0.04"}
BREACHED_FAWAZ = {"gbp": "0.82", "jpy": "150", "try": "32", "xau": "0.0005", "xag": "0.04"}


def policy():
    contract = deploy()
    fund(contract)
    return contract, purchase(contract)


def cancel(contract, protection_id, caller=ALICE, now="2026-06-06T12:00:00Z"):
    set_context(caller, 0, now)
    contract.terminal_cancel_protection(protection_id)


def test_terminal_cancellation_before_grace_deadline_fails():
    contract, protection_id = policy()
    set_context(ALICE, 0, "2026-06-05T12:00:00Z")
    assert_error(C.E_TERMINAL_NOT_READY, lambda: contract.terminal_cancel_protection(protection_id))
    assert contract.get_protection(protection_id)["status"] == "ACTIVE"


def test_terminal_cancellation_becomes_available_after_exact_three_day_grace_period():
    contract, protection_id = policy()
    set_context(ALICE, 0, "2026-06-05T23:59:59Z")
    assert_error(C.E_TERMINAL_NOT_READY, lambda: contract.terminal_cancel_protection(protection_id))
    cancel(contract, protection_id, now="2026-06-06T00:00:00Z")
    assert contract.get_protection(protection_id)["status"] == "CANCELLED"


def test_readiness_reports_grace_period_active_before_deadline():
    contract, protection_id = policy()
    set_context(ALICE, 0, "2026-06-05T12:00:00Z")
    readiness = contract.get_terminal_cancellation_readiness(protection_id)
    assert readiness == {
        "protection_id": protection_id,
        "eligible": False,
        "reason_code": "GRACE_PERIOD_ACTIVE",
        "earliest_unresolved_date": "2026-06-02",
        "terminal_grace_days": 3,
        "terminal_eligible_date": "2026-06-06",
        "current_utc_day": C._date_day("2026-06-05", "error"),
        "protection_status": "ACTIVE",
    }


def test_readiness_reports_ready_after_deadline():
    contract, protection_id = policy()
    set_context(ALICE, 0, "2026-06-06T00:00:00Z")
    readiness = contract.get_terminal_cancellation_readiness(protection_id)
    assert readiness["eligible"] is True
    assert readiness["reason_code"] == "READY"
    assert readiness["terminal_eligible_date"] == "2026-06-06"


def test_only_earliest_unresolved_date_is_used_internally():
    contract, protection_id = policy()
    contract.protection_settlement_results["0|2026-06-03"] = "INCONCLUSIVE"
    set_context(ALICE, 0, "2026-06-06T12:00:00Z")
    readiness = contract.get_terminal_cancellation_readiness(protection_id)
    assert readiness["earliest_unresolved_date"] == "2026-06-02"
    assert readiness["terminal_eligible_date"] == "2026-06-06"
    cancel(contract, protection_id)
    assert contract.get_protection(protection_id)["cancellation_settlement_date"] == "2026-06-02"


def test_caller_cannot_supply_or_select_another_date():
    contract, protection_id = policy()
    with pytest.raises(TypeError):
        contract.terminal_cancel_protection(protection_id, "2026-06-08")


def test_protection_owner_can_terminal_cancel():
    contract, protection_id = policy()
    cancel(contract, protection_id, ALICE)
    assert contract.get_protection(protection_id)["status"] == "CANCELLED"


def test_approved_operator_can_terminal_cancel():
    contract, protection_id = policy()
    set_context(OWNER)
    contract.add_settlement_operator(OPERATOR)
    cancel(contract, protection_id, OPERATOR)
    assert contract.get_protection(protection_id)["status"] == "CANCELLED"


def test_contract_owner_can_terminal_cancel():
    contract, protection_id = policy()
    cancel(contract, protection_id, OWNER)
    assert contract.get_protection(protection_id)["status"] == "CANCELLED"


def test_random_caller_is_rejected():
    contract, protection_id = policy()
    set_context(BOB, 0, "2026-06-06T12:00:00Z")
    assert_error(C.E_UNAUTHORIZED, lambda: contract.terminal_cancel_protection(protection_id))


def test_cancelled_state_is_stored():
    contract, protection_id = policy()
    cancel(contract, protection_id)
    assert contract.get_protection(protection_id)["status"] == "CANCELLED"


def test_cancellation_reason_and_unresolved_date_are_stored():
    contract, protection_id = policy()
    cancel(contract, protection_id, now="2026-06-06T12:34:56Z")
    item = contract.get_protection(protection_id)
    assert item["cancellation_timestamp"] == C._iso_timestamp("2026-06-06T12:34:56Z", "error")
    assert item["cancellation_settlement_date"] == "2026-06-02"
    assert item["cancellation_reason"] == "DATA_UNAVAILABLE_OR_CONFLICTING"


def test_reserved_liability_decreases_by_exactly_reserved_payout():
    contract, protection_id = policy()
    before = contract.get_pool_state()
    cancel(contract, protection_id)
    after = contract.get_pool_state()
    assert before["reserved_liability"] - after["reserved_liability"] == 2 * GEN


def test_terminal_cancellation_does_not_transfer_payout():
    contract, protection_id = policy()
    cancel(contract, protection_id)
    assert gl.transfers == [(ALICE.lower(), GEN, "finalized")]
    assert all(value != 2 * GEN for _, value, _ in gl.transfers)


def test_original_premium_is_refunded_exactly_once():
    contract, protection_id = policy()
    cancel(contract, protection_id)
    assert gl.transfers == [(ALICE.lower(), GEN, "finalized")]
    set_context(ALICE, 0, "2026-06-07T12:00:00Z")
    assert_error(C.E_NOT_ACTIVE, lambda: contract.terminal_cancel_protection(protection_id))
    assert gl.transfers == [(ALICE.lower(), GEN, "finalized")]


def test_pool_balance_decreases_by_exactly_refunded_premium():
    contract, protection_id = policy()
    before = contract.get_pool_state()
    cancel(contract, protection_id)
    after = contract.get_pool_state()
    assert before["pool_balance"] - after["pool_balance"] == GEN


def test_reserved_liability_never_exceeds_pool_balance_after_cancellation():
    contract, protection_id = policy()
    cancel(contract, protection_id)
    state = contract.get_pool_state()
    assert state["reserved_liability"] <= state["pool_balance"]
    set_context(OWNER)
    contract.withdraw_unreserved_gen(state["available_liquidity"] // GEN)
    final_state = contract.get_pool_state()
    assert final_state["reserved_liability"] <= final_state["pool_balance"]


def test_repeat_terminal_cancellation_fails():
    contract, protection_id = policy()
    cancel(contract, protection_id)
    set_context(ALICE, 0, "2026-06-07T12:00:00Z")
    assert_error(C.E_NOT_ACTIVE, lambda: contract.terminal_cancel_protection(protection_id))


def test_settlement_after_terminal_cancellation_fails():
    contract, protection_id = policy()
    cancel(contract, protection_id)
    mock_settlement("2026-06-02")
    set_context(ALICE, 0, "2026-06-07T12:00:00Z")
    assert_error(C.E_NOT_ACTIVE, lambda: contract.settle_protection(protection_id, "2026-06-02"))


def test_claim_after_terminal_cancellation_fails():
    contract, protection_id = policy()
    cancel(contract, protection_id)
    set_context(ALICE)
    assert_error(C.E_NOT_CLAIMABLE, lambda: contract.claim_payout(protection_id))


def test_claimable_protection_cannot_terminal_cancel():
    contract, protection_id = make_claimable()
    set_context(ALICE, 0, "2026-06-06T12:00:00Z")
    assert_error(C.E_NOT_ACTIVE, lambda: contract.terminal_cancel_protection(protection_id))


def test_claimed_protection_cannot_terminal_cancel():
    contract, protection_id = make_claimable()
    set_context(ALICE)
    contract.claim_payout(protection_id)
    set_context(ALICE, 0, "2026-06-06T12:00:00Z")
    assert_error(C.E_NOT_ACTIVE, lambda: contract.terminal_cancel_protection(protection_id))


def test_expired_protection_cannot_terminal_cancel():
    contract, protection_id = _complete_before_expiry()
    set_context(ALICE, 0, "2026-06-12T12:00:00Z")
    assert_error(C.E_NOT_ACTIVE, lambda: contract.terminal_cancel_protection(protection_id))


def test_terminal_cancellation_performs_no_external_market_data_fetch():
    contract, protection_id = policy()
    gl.nondet.web.clear()
    cancel(contract, protection_id)
    assert gl.nondet.web.requests == []


def test_conclusive_not_breached_result_cannot_be_rewritten_by_revised_history():
    contract, protection_id = policy()
    mock_settlement("2026-06-02")
    set_context(ALICE, 0, "2026-06-03T12:00:00Z")
    assert contract.settle_protection(protection_id, "2026-06-02") == "NOT_BREACHED"
    gl.nondet.web.clear()
    mock_settlement("2026-06-02", fx_rates=BREACHED_FX, fawaz_rates=BREACHED_FAWAZ)
    set_context(ALICE, 0, "2026-06-04T12:00:00Z")
    assert contract.settle_protection(protection_id, "2026-06-02") == "NOT_BREACHED"
    assert gl.nondet.web.requests == []


def test_conclusive_breached_result_cannot_be_rewritten_by_revised_history():
    contract, protection_id = policy()
    mock_settlement("2026-06-02", fx_rates=BREACHED_FX, fawaz_rates=BREACHED_FAWAZ)
    set_context(ALICE, 0, "2026-06-03T12:00:00Z")
    assert contract.settle_protection(protection_id, "2026-06-02") == "BREACHED"
    gl.nondet.web.clear()
    mock_settlement("2026-06-02")
    set_context(ALICE, 0, "2026-06-04T12:00:00Z")
    assert contract.settle_protection(protection_id, "2026-06-02") == "BREACHED"
    assert gl.nondet.web.requests == []


def test_inconclusive_retry_uses_newer_evidence_version():
    contract, protection_id = policy()
    mock_settlement("2026-06-02", fx_rates=SPLIT_FX, fawaz_rates=SPLIT_FAWAZ)
    set_context(ALICE, 0, "2026-06-03T12:00:00Z")
    assert contract.settle_protection(protection_id, "2026-06-02") == "INCONCLUSIVE"
    gl.nondet.web.clear()
    mock_settlement("2026-06-02")
    set_context(ALICE, 0, "2026-06-04T12:00:00Z")
    assert contract.settle_protection(protection_id, "2026-06-02") == "NOT_BREACHED"
    assert contract.get_protection_settlement_version(protection_id, "2026-06-02") == 2


def test_inconclusive_retry_can_become_conclusive():
    contract, protection_id = policy()
    mock_settlement("2026-06-02", fx_rates=SPLIT_FX, fawaz_rates=SPLIT_FAWAZ)
    set_context(ALICE, 0, "2026-06-03T12:00:00Z")
    contract.settle_protection(protection_id, "2026-06-02")
    gl.nondet.web.clear()
    mock_settlement("2026-06-02", fx_rates=BREACHED_FX, fawaz_rates=BREACHED_FAWAZ)
    set_context(ALICE, 0, "2026-06-04T12:00:00Z")
    assert contract.settle_protection(protection_id, "2026-06-02") == "BREACHED"
    assert contract.get_protection(protection_id)["status"] == "CLAIMABLE"


def test_terminal_path_does_not_weaken_same_day_settlement_rejection():
    contract, protection_id = policy()
    gl.nondet.web.clear()
    set_context(ALICE, 0, "2026-06-02T12:00:00Z")
    assert_error(C.E_INVALID_DATE, lambda: contract.settle_protection(protection_id, "2026-06-02"))
    assert gl.nondet.web.requests == []


def test_terminal_path_does_not_weaken_earliest_unresolved_settlement_ordering():
    contract, protection_id = policy()
    gl.nondet.web.clear()
    set_context(ALICE, 0, "2026-06-10T12:00:00Z")
    assert_error(C.E_INVALID_DATE, lambda: contract.settle_protection(protection_id, "2026-06-03"))
    assert gl.nondet.web.requests == []
    cancel(contract, protection_id, now="2026-06-06T12:00:00Z")
    assert contract.get_protection(protection_id)["cancellation_settlement_date"] == "2026-06-02"
