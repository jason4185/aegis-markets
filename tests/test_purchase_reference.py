import pytest

from tests.test_aegis_protection import (
    ALICE, C, GEN, assert_error, deploy, fund, mock_latest, purchase,
    rates_json, set_context, source_timestamp,
)


@pytest.mark.parametrize("market,expected", [
    ("GBP_USD", 125_000_000),
    ("USD_JPY", 15_000_000_000),
    ("USD_TRY", 3_200_000_000),
    ("XAU_USD", 200_000_000_000),
    ("XAG_USD", 2_500_000_000),
])
def test_fxratesapi_purchase_reference_normalization(market, expected):
    contract = deploy()
    fund(contract)
    protection_id = purchase(contract, market)
    item = contract.get_protection(protection_id)
    assert item["reference_price"] == expected
    assert item["source_timestamp"] == source_timestamp()


def test_purchase_reference_statement_is_precise():
    contract = deploy()
    config = contract.get_config()
    assert config["purchase_reference_statement"] == (
        "Reference price fetched from FXRatesAPI and independently confirmed by "
        "GenLayer validators."
    )
    assert config["max_reference_age_seconds"] == C.MAX_REFERENCE_AGE
    assert config["stale_reference_behavior"] == "PURCHASE_UNAVAILABLE"


def test_latest_full_iso_date_field_is_canonicalized():
    contract = deploy()
    fund(contract)
    set_context(ALICE, GEN)
    mock_latest(date="2026-06-01T12:00:00.000Z")
    protection_id = contract.purchase_protection("GBP_USD", 7, 2)
    assert contract.get_protection(protection_id)["source_timestamp"] == source_timestamp()


def test_latest_plain_calendar_date_field_remains_supported():
    deploy()
    mock_latest(date="2026-06-01")
    result = C._purchase_result("GBP_USD", source_timestamp())
    assert result["date"] == "2026-06-01"


def _structured_purchase(price, timestamp, market="GBP_USD", date="2026-06-01"):
    return {
        "source": "FXRATESAPI_LATEST",
        "market": market,
        "price": price,
        "timestamp": timestamp,
        "date": date,
        "status": "VALID",
    }


def test_adjacent_one_minute_latest_observations_are_equivalent_within_bounds():
    now = source_timestamp() + 120
    leader = _structured_purchase(125_000_000, source_timestamp())
    validator = _structured_purchase(125_050_000, source_timestamp() + 60)
    assert C._purchase_results_equivalent(leader, validator, now) is True


def test_materially_different_validator_price_is_rejected():
    now = source_timestamp() + 120
    leader = _structured_purchase(125_000_000, source_timestamp())
    validator = _structured_purchase(125_750_000, source_timestamp() + 60)
    assert C._purchase_results_equivalent(leader, validator, now) is False


def test_validator_timestamp_outside_consensus_window_is_rejected():
    now = source_timestamp() + 180
    leader = _structured_purchase(125_000_000, source_timestamp())
    validator = _structured_purchase(
        125_000_000,
        source_timestamp() + C.LATEST_EQ_TIMESTAMP_WINDOW + 1,
    )
    assert C._purchase_results_equivalent(leader, validator, now) is False


def test_validator_cannot_confirm_a_different_market_observation():
    now = source_timestamp() + 60
    leader = _structured_purchase(125_000_000, source_timestamp())
    validator = _structured_purchase(
        125_000_000, source_timestamp() + 60, market="USD_JPY"
    )
    assert C._purchase_results_equivalent(leader, validator, now) is False


def test_stale_reference_rejected():
    contract = deploy()
    fund(contract)
    old = source_timestamp() - C.MAX_REFERENCE_AGE - 1
    set_context(ALICE, GEN)
    mock_latest(timestamp=old)
    assert_error(
        C.X_STALE,
        lambda: contract.purchase_protection("GBP_USD", 7, 2),
    )


def test_future_reference_timestamp_rejected():
    contract = deploy()
    fund(contract)
    future = source_timestamp() + C.MAX_FUTURE_SKEW + 1
    set_context(ALICE, GEN)
    mock_latest(timestamp=future)
    assert_error(
        C.X_BAD_TIMESTAMP,
        lambda: contract.purchase_protection("GBP_USD", 7, 2),
    )


@pytest.mark.parametrize("body,code", [
    ('{"success":true,"date":"2026-06-01","base":"USD","rates":{"JPY":150}}', C.X_MISSING_RATE),
    ('{"success":true,"timestamp":1780315200,"date":"2026-06-01","base":"EUR","rates":{"GBP":0.8}}', C.X_MALFORMED),
    ('not-json', C.X_MALFORMED),
])
def test_malformed_or_missing_latest_response(body, code):
    contract = deploy()
    fund(contract)
    set_context(ALICE, GEN)
    mock_latest(body=body)
    assert_error(code, lambda: contract.purchase_protection("GBP_USD", 7, 2))


def test_missing_source_timestamp_rejected():
    contract = deploy()
    fund(contract)
    set_context(ALICE, GEN)
    mock_latest(body=rates_json(timestamp=None))
    assert_error(
        C.X_BAD_TIMESTAMP,
        lambda: contract.purchase_protection("GBP_USD", 7, 2),
    )


def test_timestamp_date_mismatch_rejected():
    contract = deploy()
    fund(contract)
    set_context(ALICE, GEN)
    mock_latest(date="2026-05-31")
    assert_error(
        C.X_BAD_TIMESTAMP,
        lambda: contract.purchase_protection("GBP_USD", 7, 2),
    )


def test_locked_reference_and_trigger_are_immutable_values():
    contract = deploy()
    fund(contract)
    protection_id = purchase(contract, "GBP_USD", 14, 3)
    before = contract.get_protection(protection_id)
    mock_latest(rates={
        "GBP": "0.9", "JPY": "150", "TRY": "32", "XAU": "0.0005", "XAG": "0.04"
    })
    after = contract.get_protection(protection_id)
    assert after["reference_price"] == before["reference_price"]
    assert after["trigger_price"] == before["trigger_price"] == 121_250_000


def test_owner_index_is_storage_safe_and_bounded():
    contract = deploy()
    fund(contract)
    first = purchase(contract, buyer=ALICE)
    second = purchase(contract, market="USD_JPY", buyer=ALICE)
    assert contract.get_owned_protection_count(C.Address(ALICE)) == 2
    assert contract.get_owned_protection_ids(C.Address(ALICE), 0, 10) == [first, second]
    assert_error(C.E_BAD_PAGE, lambda: contract.get_owned_protection_ids(C.Address(ALICE), 0, 51))
