import pytest

from tests.test_aegis_protection import (
    ALICE, BOB, C, Return, assert_error, deploy, fund, mock_settlement,
    purchase, set_context,
)


ALL_RATES = {"GBP": "0.8", "JPY": "150", "TRY": "32", "XAU": "0.0005", "XAG": "0.04"}
ALL_LOWER = {key.lower(): value for key, value in ALL_RATES.items()}


def settle(contract, protection_id, date="2026-06-02", now="2026-06-03T12:00:00Z", **mocks):
    mock_settlement(date, **mocks)
    set_context(ALICE, 0, now)
    return contract.settle_protection(protection_id, date)


def policy():
    contract = deploy()
    fund(contract)
    return contract, purchase(contract)


def test_protection_owner_creates_market_settlement_and_processes_result():
    contract, protection_id = policy()
    result = settle(
        contract, protection_id,
        fx_rates={**ALL_RATES, "GBP": "0.82"},
        fawaz_rates={**ALL_LOWER, "gbp": "0.81"},
    )
    assert result == "INCONCLUSIVE"
    item = contract.get_market_settlement("GBP_USD", "2026-06-02")
    assert item["fxratesapi_price"] == 121_951_219
    assert item["fawaz_price"] == 123_456_790
    assert item["source_a"] == "FXRATESAPI_HISTORICAL"
    assert item["source_b"] == "FAWAZ"
    assert item["version"] == 1 and item["finalized"] is True


def test_fawaz_delivery_fallback_has_canonical_identity():
    contract, protection_id = policy()
    settle(contract, protection_id, primary_status=404, fallback_status=200)
    item = contract.get_market_settlement("GBP_USD", "2026-06-02")
    assert item["source_b"] == "FAWAZ"
    assert item["source_b_date"] == "2026-06-02"


def test_malformed_primary_can_use_valid_fawaz_fallback():
    contract, protection_id = policy()
    settle(
        contract, protection_id, primary_body="not-json",
        fallback_body='{"date":"2026-06-02","usd":{"gbp":0.8,"jpy":150,"try":32,"xau":0.0005,"xag":0.04}}',
    )
    assert contract.get_market_settlement("GBP_USD", "2026-06-02")["source_b"] == "FAWAZ"


def test_fawaz_delivery_paths_are_consensus_equivalent():
    current_day = C._date_day("2026-06-03", "error")
    mock_settlement("2026-06-02", primary_status=200)
    primary = C._market_settlement_result("GBP_USD", "2026-06-02", current_day)
    C.gl.nondet.web.clear()
    mock_settlement("2026-06-02", primary_status=404, fallback_status=200)
    fallback = C._market_settlement_result("GBP_USD", "2026-06-02", current_day)
    assert primary == fallback
    assert fallback["source_b"] == "FAWAZ"


def test_consensus_reuses_transaction_derived_current_day(monkeypatch):
    current_day = C._date_day("2026-06-02", "error")
    seen = []
    result = {
        "market": "GBP_USD", "settlement_date": "2026-06-02",
        "source_a_price": 1, "source_b_price": 1,
        "source_a": "FXRATESAPI_HISTORICAL", "source_b": "FAWAZ",
        "source_a_date": "2026-06-02", "source_b_date": "2026-06-02",
        "status": "VALID",
    }

    def market_result(market_id, settlement_date, supplied_current_day):
        seen.append(supplied_current_day)
        return result

    def run_both(leader, validator):
        leader_result = leader()
        assert validator(Return(leader_result))
        return leader_result

    monkeypatch.setattr(C, "_market_settlement_result", market_result)
    monkeypatch.setattr(C.gl.vm, "run_nondet_unsafe", run_both)
    assert C._market_settlement_consensus("GBP_USD", "2026-06-02", current_day) == result
    assert seen == [current_day, current_day]


@pytest.mark.parametrize("raw_date", [
    "2026-06-02", "2026-06-02T00:00:00.000Z", "2026-06-02T00:00:00+00:00",
])
def test_historical_source_date_formats_are_normalized(raw_date):
    contract, protection_id = policy()
    from tests.test_aegis_protection import fawaz_json, rates_json
    fx_body = rates_json(raw_date, rates=ALL_RATES)
    fawaz_body = fawaz_json(raw_date, ALL_LOWER)
    assert settle(
        contract, protection_id, primary_body=fawaz_body,
        fallback_body=fawaz_body,
        fx_rates=ALL_RATES,
    ) == "NOT_BREACHED" if raw_date == "2026-06-02" else _settle_with_fx_body(
        contract, protection_id, raw_date, fx_body, fawaz_body
    )


def _settle_with_fx_body(contract, protection_id, raw_date, fx_body, fawaz_body):
    C.gl.nondet.web.clear()
    date = "2026-06-02"
    C.gl.nondet.web.mock(r"fxratesapi\.com/historical\?date=2026-06-02", 200, fx_body)
    C.gl.nondet.web.mock(r"currency-api@2026-06-02/v1/currencies/usd\.min\.json", 200, fawaz_body)
    C.gl.nondet.web.mock(r"2026-06-02\.currency-api\.pages\.dev", 200, fawaz_body)
    set_context(ALICE, 0, "2026-06-03T12:00:00Z")
    return contract.settle_protection(protection_id, date) == "NOT_BREACHED"


@pytest.mark.parametrize("bad_date", ["2026-06-01", "2026-06-02T00:00:00+01:00"])
def test_wrong_or_non_utc_source_date_is_rejected(bad_date):
    contract, protection_id = policy()
    from tests.test_aegis_protection import fawaz_json
    body = fawaz_json(bad_date, ALL_LOWER)
    assert_error(
        C.X_MALFORMED,
        lambda: settle(contract, protection_id, primary_body=body, fallback_body=body),
    )
    assert not contract.market_settlements


def test_missing_historical_rate_is_not_stored():
    contract, protection_id = policy()
    assert_error(
        C.X_MISSING_RATE,
        lambda: settle(contract, protection_id, fx_rates={key: value for key, value in ALL_RATES.items() if key != "GBP"}),
    )
    assert not contract.market_settlements


def test_http_500_is_transient_and_not_stored():
    contract, protection_id = policy()
    assert_error(
        C.T_SOURCE_UNAVAILABLE,
        lambda: settle(contract, protection_id, primary_status=500, fallback_status=500),
    )
    assert not contract.market_settlements


def test_current_day_missing_fawaz_writes_no_state_then_retries():
    contract, protection_id = policy()
    assert_error(
        C.T_SOURCE_UNAVAILABLE,
        lambda: settle(
            contract, protection_id, now="2026-06-02T12:00:00Z",
            primary_status=404, fallback_status=404,
        ),
    )
    key = "GBP_USD|2026-06-02"
    assert not contract.market_settlements
    assert contract.settlement_versions.get(key) is None
    assert contract.get_protection_settlement_result(protection_id, "2026-06-02") == "UNPROCESSED"
    C.gl.nondet.web.clear()
    assert settle(contract, protection_id, now="2026-06-02T18:00:00Z") == "NOT_BREACHED"
    assert contract.get_market_settlement("GBP_USD", "2026-06-02")["version"] == 1


def test_older_missing_fawaz_is_external():
    contract, protection_id = policy()
    assert_error(
        C.X_SOURCE_UNAVAILABLE,
        lambda: settle(contract, protection_id, primary_status=404, fallback_status=404),
    )
    assert not contract.market_settlements


def test_previous_day_data_cannot_settle_requested_current_day():
    contract, protection_id = policy()
    previous = '{"date":"2026-06-01","usd":{"gbp":0.8,"jpy":150,"try":32,"xau":0.0005,"xag":0.04}}'
    assert_error(
        C.X_MALFORMED,
        lambda: settle(
            contract, protection_id, now="2026-06-02T12:00:00Z",
            primary_body=previous, fallback_body=previous,
        ),
    )
    assert not contract.market_settlements


@pytest.mark.parametrize("fx_gbp,fawaz_gbp,expected", [
    ("0.82", "0.82", "BREACHED"),
    ("0.8", "0.8", "NOT_BREACHED"),
    ("0.82", "0.8", "INCONCLUSIVE"),
])
def test_two_source_outcomes(fx_gbp, fawaz_gbp, expected):
    contract, protection_id = policy()
    outcome = settle(
        contract, protection_id,
        fx_rates={**ALL_RATES, "GBP": fx_gbp},
        fawaz_rates={**ALL_LOWER, "gbp": fawaz_gbp},
    )
    assert outcome == expected
    item = contract.get_protection(protection_id)
    assert item["processed_dates"] == (1 if expected == "NOT_BREACHED" else 0)
    assert item["inconclusive_dates"] == (1 if expected == "INCONCLUSIVE" else 0)
    assert item["status"] == ("CLAIMABLE" if expected == "BREACHED" else "ACTIVE")
    assert contract.get_protection_settlement_version(protection_id, "2026-06-02") == 1


def test_repeated_conclusive_result_is_idempotent_and_does_not_refetch():
    contract, protection_id = policy()
    assert settle(contract, protection_id) == "NOT_BREACHED"
    request_count = len(C.gl.nondet.web.requests)
    C.gl.nondet.web.clear()
    set_context(ALICE, 0, "2026-06-04T12:00:00Z")
    assert contract.settle_protection(protection_id, "2026-06-02") == "NOT_BREACHED"
    assert C.gl.nondet.web.requests == []
    assert request_count > 0
    assert contract.get_protection(protection_id)["processed_dates"] == 1


def test_repeated_breached_is_idempotent_and_does_not_refetch():
    contract, protection_id = policy()
    breached = {**ALL_RATES, "GBP": "0.82"}
    lower = {**ALL_LOWER, "gbp": "0.82"}
    assert settle(contract, protection_id, fx_rates=breached, fawaz_rates=lower) == "BREACHED"
    stats = contract.get_protocol_stats()
    C.gl.nondet.web.clear()
    set_context(ALICE, 0, "2026-06-04T12:00:00Z")
    assert contract.settle_protection(protection_id, "2026-06-02") == "BREACHED"
    assert contract.get_protocol_stats() == stats
    assert C.gl.nondet.web.requests == []


def test_inconclusive_new_version_resolves_without_double_counting():
    contract, protection_id = policy()
    split_fx = {**ALL_RATES, "GBP": "0.82"}
    assert settle(contract, protection_id, fx_rates=split_fx) == "INCONCLUSIVE"
    assert contract.get_protection_settlement_version(protection_id, "2026-06-02") == 1
    C.gl.nondet.web.clear()
    assert settle(contract, protection_id) == "NOT_BREACHED"
    item = contract.get_protection(protection_id)
    assert item["processed_dates"] == 1 and item["inconclusive_dates"] == 0
    assert contract.get_protection_settlement_version(protection_id, "2026-06-02") == 2
    assert contract.get_market_settlement("GBP_USD", "2026-06-02")["version"] == 2


def test_newer_inconclusive_version_only_updates_version():
    contract, protection_id = policy()
    split_fx = {**ALL_RATES, "GBP": "0.82"}
    assert settle(contract, protection_id, fx_rates=split_fx) == "INCONCLUSIVE"
    C.gl.nondet.web.clear()
    assert settle(contract, protection_id, fx_rates=split_fx) == "INCONCLUSIVE"
    item = contract.get_protection(protection_id)
    assert item["processed_dates"] == 0 and item["inconclusive_dates"] == 1
    assert contract.get_protection_settlement_version(protection_id, "2026-06-02") == 2


def test_newer_version_resolves_inconclusive_to_breached():
    contract, protection_id = policy()
    assert settle(contract, protection_id, fx_rates={**ALL_RATES, "GBP": "0.82"}) == "INCONCLUSIVE"
    C.gl.nondet.web.clear()
    breached = {**ALL_RATES, "GBP": "0.82"}
    lower = {**ALL_LOWER, "gbp": "0.82"}
    assert settle(contract, protection_id, fx_rates=breached, fawaz_rates=lower) == "BREACHED"
    item = contract.get_protection(protection_id)
    assert item["status"] == "CLAIMABLE" and item["inconclusive_dates"] == 0


def test_market_settlement_reused_by_multiple_protections_without_refetch():
    contract = deploy()
    fund(contract)
    first = purchase(contract, event=2, buyer=ALICE)
    second = purchase(contract, event=4, buyer=BOB)
    assert settle(contract, first, fx_rates={**ALL_RATES, "GBP": "0.82"}, fawaz_rates={**ALL_LOWER, "gbp": "0.82"}) == "BREACHED"
    C.gl.nondet.web.clear()
    set_context(BOB, 0, "2026-06-03T12:00:00Z")
    assert contract.settle_protection(second, "2026-06-02") == "NOT_BREACHED"
    assert C.gl.nondet.web.requests == []
    assert len(contract.market_settlements) == 1


def test_purchase_day_future_day_and_window_bounds():
    contract, protection_id = policy()
    set_context(ALICE, 0, "2026-06-02T12:00:00Z")
    assert_error(C.E_INVALID_DATE, lambda: contract.settle_protection(protection_id, "2026-06-01"))
    assert_error(C.E_INVALID_DATE, lambda: contract.settle_protection(protection_id, "2026-06-03"))
    mock_settlement("2026-06-02")
    assert contract.settle_protection(protection_id, "2026-06-02") == "NOT_BREACHED"
    set_context(ALICE, 0, "2026-06-20T12:00:00Z")
    assert_error(C.E_INVALID_DATE, lambda: contract.settle_protection(protection_id, "2026-06-09"))


def test_weekend_and_late_historical_settlement_are_supported():
    contract = deploy()
    fund(contract)
    from tests.test_aegis_protection import mock_latest
    set_context(ALICE, C.GEN, "2026-06-05T12:00:00Z")
    mock_latest(timestamp=C._iso_timestamp("2026-06-05T12:00:00Z", "error"), date="2026-06-05")
    protection_id = contract.purchase_protection("GBP_USD", 7, 2)
    assert settle(contract, protection_id, "2026-06-06", "2026-06-20T12:00:00Z") == "NOT_BREACHED"
    assert any("date=2026-06-06" in url for url in C.gl.nondet.web.requests)


@pytest.mark.parametrize("market,fx_rates,fawaz_rates", [
    ("GBP_USD", {**ALL_RATES, "GBP": "0.82"}, {**ALL_LOWER, "gbp": "0.82"}),
    ("USD_JPY", {**ALL_RATES, "JPY": "154"}, {**ALL_LOWER, "jpy": "154"}),
    ("USD_TRY", {**ALL_RATES, "TRY": "33"}, {**ALL_LOWER, "try": "33"}),
    ("XAU_USD", {**ALL_RATES, "XAU": "0.00052"}, {**ALL_LOWER, "xau": "0.00052"}),
    ("XAG_USD", {**ALL_RATES, "XAG": "0.041"}, {**ALL_LOWER, "xag": "0.041"}),
])
def test_all_markets_use_production_normalization_and_direction(market, fx_rates, fawaz_rates):
    contract = deploy()
    fund(contract)
    protection_id = purchase(contract, market=market)
    assert settle(contract, protection_id, fx_rates=fx_rates, fawaz_rates=fawaz_rates) == "BREACHED"
