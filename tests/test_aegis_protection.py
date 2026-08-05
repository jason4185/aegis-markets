"""Direct, in-memory contract harness and core contract tests.

The published genlayer-test 0.1.2 package installed in this environment does
not expose the direct_vm/direct_deploy fixtures described by the GenLayer
skill.  This harness supplies the same leader-only, mocked-web semantics for
unit tests; GenVM storage/schema correctness is separately checked by the
official genvm-lint commands.
"""

from pathlib import Path
import json
import re
import subprocess
import sys
import types

import pytest


ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "contract" / "AegisProtection.py"
OWNER = "0x" + "11" * 20
ALICE = "0x" + "22" * 20
BOB = "0x" + "33" * 20


class UserError(Exception):
    def __init__(self, message):
        super().__init__(message)
        self.message = message


class Return:
    def __init__(self, calldata):
        self.calldata = calldata


class Address:
    def __init__(self, value):
        self.as_hex = value.lower()

    def __eq__(self, other):
        return isinstance(other, Address) and self.as_hex == other.as_hex

    def __hash__(self):
        return hash(self.as_hex)

    def __lt__(self, other):
        return self.as_hex < other.as_hex


class TreeMap(dict):
    pass


class Decorator:
    def __call__(self, function):
        return function

    @property
    def payable(self):
        return self


class Public:
    view = Decorator()
    write = Decorator()


class Response:
    def __init__(self, status, body):
        self.status = status
        self.headers = {}
        self.body = body.encode() if isinstance(body, str) else body


class FakeWeb:
    def __init__(self):
        self.routes = []
        self.requests = []

    def clear(self):
        self.routes.clear()
        self.requests.clear()

    def mock(self, pattern, status=200, body=""):
        self.routes.append((re.compile(pattern), Response(status, body)))

    def get(self, url):
        self.requests.append(url)
        for pattern, response in self.routes:
            if pattern.search(url):
                return response
        return Response(503, "")


class TransferProxy:
    def __init__(self, gl_object, address):
        self.gl_object = gl_object
        self.address = address

    def emit_transfer(self, value, on="finalized"):
        self.gl_object.transfers.append((self.address.as_hex, int(value), on))


def _make_fake_genlayer():
    module = types.ModuleType("genlayer")
    web = FakeWeb()
    message = types.SimpleNamespace(
        sender_address=Address(OWNER), value=0, contract_address=Address("0x" + "aa" * 20)
    )
    gl_object = types.SimpleNamespace()
    gl_object.Contract = type("Contract", (), {})
    gl_object.public = Public()
    gl_object.message = message
    gl_object.message_raw = {"datetime": "2026-06-01T12:00:00Z"}
    gl_object.nondet = types.SimpleNamespace(web=web)
    gl_object.transfers = []
    gl_object.vm = types.SimpleNamespace(
        UserError=UserError,
        Return=Return,
        run_nondet_unsafe=lambda leader, validator: leader(),
    )
    gl_object.get_contract_at = lambda address: TransferProxy(gl_object, address)
    module.gl = gl_object
    module.Address = Address
    module.TreeMap = TreeMap
    module.allow_storage = lambda cls: cls
    for name in (
        "u8", "u16", "u32", "u64", "u128", "u256", "i8", "i16", "i32", "i64", "i256"
    ):
        setattr(module, name, int)
    module.__all__ = [
        "gl", "Address", "TreeMap", "allow_storage", "u8", "u16", "u32", "u64",
        "u128", "u256", "i8", "i16", "i32", "i64", "i256",
    ]
    return module


fake_genlayer = _make_fake_genlayer()
sys.modules["genlayer"] = fake_genlayer
contract_module = types.ModuleType("aegis_contract_direct")
contract_module.__file__ = str(CONTRACT_PATH)
sys.modules[contract_module.__name__] = contract_module
exec(compile(CONTRACT_PATH.read_text(), str(CONTRACT_PATH), "exec"), contract_module.__dict__)
C = contract_module
gl = fake_genlayer.gl
GEN = C.GEN


def set_context(sender=OWNER, value=0, datetime_value="2026-06-01T12:00:00Z"):
    gl.message.sender_address = Address(sender)
    gl.message.value = value
    gl.message_raw["datetime"] = datetime_value


def deploy():
    gl.nondet.web.clear()
    gl.transfers.clear()
    set_context()
    contract = C.AegisProtection()
    contract.protections = TreeMap()
    contract.owner_counts = TreeMap()
    contract.owner_protection_ids = TreeMap()
    contract.market_settlements = TreeMap()
    contract.protection_settlement_results = TreeMap()
    contract.settlement_versions = TreeMap()
    contract.settlement_retryable = TreeMap()
    contract.protection_settlement_versions = TreeMap()
    contract.owner_active_counts = TreeMap()
    contract.owner_claimable_counts = TreeMap()
    contract.owner_expired_counts = TreeMap()
    contract.owner_claimed_counts = TreeMap()
    contract.owner_premiums_paid = TreeMap()
    contract.owner_claimable_payouts = TreeMap()
    contract.owner_payouts_received = TreeMap()
    return contract


def rates_json(date="2026-06-01", timestamp=None, rates=None, success=True):
    values = rates or {
        "GBP": "0.8", "JPY": "150", "TRY": "32", "XAU": "0.0005", "XAG": "0.04"
    }
    timestamp_field = "" if timestamp is None else f',"timestamp":{timestamp}'
    rate_fields = ",".join(f'"{key}":{value}' for key, value in values.items())
    success_text = "true" if success else "false"
    return (
        f'{{"success":{success_text}{timestamp_field},"date":"{date}",'
        f'"base":"USD","rates":{{{rate_fields}}}}}'
    )


def fawaz_json(date="2026-06-02", rates=None):
    values = rates or {
        "gbp": "0.8", "jpy": "150", "try": "32", "xau": "0.0005", "xag": "0.04"
    }
    rate_fields = ",".join(f'"{key}":{value}' for key, value in values.items())
    return f'{{"date":"{date}","usd":{{{rate_fields}}}}}'


def source_timestamp(datetime_value="2026-06-01T12:00:00Z"):
    return C._iso_timestamp(datetime_value, "error")


def mock_latest(timestamp=None, rates=None, date="2026-06-01", status=200, body=None):
    timestamp = source_timestamp() if timestamp is None else timestamp
    payload = body if body is not None else rates_json(date, timestamp, rates)
    gl.nondet.web.mock(r"api\.fxratesapi\.com/latest", status, payload)


def mock_settlement(
    settlement_date="2026-06-02",
    fx_rates=None,
    fawaz_rates=None,
    fx_status=200,
    primary_status=200,
    primary_body=None,
    fallback_status=200,
    fallback_body=None,
):
    gl.nondet.web.mock(
        rf"fxratesapi\.com/historical\?date={settlement_date}",
        fx_status,
        rates_json(settlement_date, rates=fx_rates),
    )
    primary_payload = (
        fawaz_json(settlement_date, fawaz_rates)
        if primary_body is None
        else primary_body
    )
    gl.nondet.web.mock(
        rf"currency-api@{settlement_date}/v1/currencies/usd\.min\.json",
        primary_status,
        primary_payload,
    )
    fallback_payload = (
        fawaz_json(settlement_date, fawaz_rates)
        if fallback_body is None
        else fallback_body
    )
    gl.nondet.web.mock(
        rf"{settlement_date}\.currency-api\.pages\.dev",
        fallback_status,
        fallback_payload,
    )


def fund(contract, amount=30 * GEN, sender=BOB):
    set_context(sender, amount)
    contract.add_pool_funds()


def purchase(contract, market="GBP_USD", duration=7, event=2, buyer=ALICE):
    premium, _ = C._terms(duration, event * 100)
    set_context(buyer, premium)
    mock_latest()
    return contract.purchase_protection(market, duration, event)


def assert_error(code, operation):
    with pytest.raises(UserError) as captured:
        operation()
    assert captured.value.message == code


def test_constructor_and_initial_state():
    contract = deploy()
    assert contract.owner == Address(OWNER)
    assert contract.get_pool_state() == {
        "pool_balance": 0, "reserved_liability": 0, "available_liquidity": 0
    }
    assert contract.get_protection_count() == 0
    assert contract.purchases_paused() is False


def test_every_supported_market_and_direction():
    contract = deploy()
    markets = {item["market_id"]: item for item in contract.get_supported_markets()}
    assert list(markets) == ["GBP_USD", "USD_JPY", "USD_TRY", "XAU_USD", "XAG_USD"]
    assert markets["GBP_USD"]["direction"] == "DOWN"
    assert markets["USD_JPY"]["direction"] == "UP"
    assert markets["USD_TRY"]["direction"] == "UP"
    assert markets["XAU_USD"]["category"] == "METAL"
    assert markets["XAG_USD"]["symbol"] == "XAG/USD"


def test_exact_product_economics_table():
    contract = deploy()
    expected = {
        (7, 200): (1, 2), (7, 300): (1, 3), (7, 400): (1, 4),
        (14, 200): (2, 4), (14, 300): (2, 5), (14, 400): (2, 6),
        (30, 200): (3, 6), (30, 300): (3, 8), (30, 400): (3, 10),
    }
    actual = {
        (row["duration_days"], row["event_bps"]):
        (row["premium"] // GEN, row["payout"] // GEN)
        for row in contract.get_product_terms()
    }
    assert actual == expected
    assert {
        (row["event_percent"], row["event_bps"])
        for row in contract.get_product_terms()
    } == {(2, 200), (3, 300), (4, 400)}


@pytest.mark.parametrize("duration,event,code", [
    (8, 2, C.E_INVALID_DURATION), (7, 5, C.E_INVALID_EVENT)
])
def test_invalid_product_terms(duration, event, code):
    contract = deploy()
    assert_error(code, lambda: contract.quote_protection(duration, event))


def test_fixed_point_reciprocal_precision():
    assert C._normalize_rate("GBP_USD", "0.8") == 125_000_000
    assert C._normalize_rate("XAU_USD", "0.0005") == 200_000_000_000
    assert C._normalize_rate("XAG_USD", "4e-2") == 2_500_000_000
    assert C._normalize_rate("USD_JPY", "150.123456789") == 15_012_345_678


@pytest.mark.parametrize("event_percent", [1, 5, 200])
def test_public_event_percent_rejects_unsupported_values(event_percent):
    contract = deploy()
    assert_error(
        C.E_INVALID_EVENT,
        lambda: contract.quote_protection(7, event_percent),
    )
    set_context(ALICE, GEN)
    assert_error(
        C.E_INVALID_EVENT,
        lambda: contract.purchase_protection("GBP_USD", 7, event_percent),
    )


@pytest.mark.parametrize("event_percent,event_bps", [(2, 200), (3, 300), (4, 400)])
def test_public_event_percent_is_stored_as_basis_points(event_percent, event_bps):
    contract = deploy()
    fund(contract)
    protection_id = purchase(contract, event=event_percent)
    stored = contract.get_protection(protection_id)
    assert stored["event_percent"] == event_percent
    assert stored["event_bps"] == event_bps


def test_quote_protection_accepts_plain_percentages():
    contract = deploy()
    assert contract.quote_protection(7, 2) == {"premium": GEN, "payout": 2 * GEN}
    assert contract.quote_protection(14, 3) == {
        "premium": 2 * GEN, "payout": 5 * GEN
    }
    assert contract.quote_protection(30, 4) == {
        "premium": 3 * GEN, "payout": 10 * GEN
    }


def test_trigger_previews_convert_percent_to_integer_basis_points():
    contract = deploy()
    assert contract.preview_trigger("GBP_USD", 2, 125_000_000) == 122_500_000
    assert contract.preview_trigger("GBP_USD", 3, 125_000_000) == 121_250_000
    assert contract.preview_trigger("USD_JPY", 4, 15_000_000_000) == 15_600_000_000


def test_contract_contains_no_dynamic_array_storage_and_is_under_limit():
    source = CONTRACT_PATH.read_text()
    forbidden = "Dyn" + "Array"
    assert forbidden not in source
    assert CONTRACT_PATH.stat().st_size < 50_000


def test_schema_extraction_and_abi_method_names():
    completed = subprocess.run(
        ["genvm-lint", "schema", str(CONTRACT_PATH), "--json"],
        check=True, capture_output=True, text=True,
    )
    schema = json.loads(completed.stdout)["schema"]
    methods = schema["methods"]
    assert len(methods) == 30
    assert methods["purchase_protection"]["payable"] is True
    assert methods["purchase_protection"]["params"][2][0] == "event_percent"
    assert methods["quote_protection"]["params"][1][0] == "event_percent"
    assert methods["preview_trigger"]["params"][1][0] == "event_percent"
    assert methods["get_protection"]["readonly"] is True
    assert "claim_payout" in methods
    assert "settle_protection" in methods
    assert "create_market_observation" not in methods
    assert "process_protection" not in methods
    assert "get_market_settlement" in methods
    assert "get_observation" not in methods
    assert "get_protection_settlement_result" in methods
    assert "get_protection_settlement_version" in methods
    assert "get_processing_result" not in methods
    assert "get_processing_settlement_version" not in methods
    assert all("processing" not in name.lower() for name in methods)
    assert all("observation" not in name.lower() for name in methods)
    writes = {name for name, item in methods.items() if not item["readonly"]}
    assert writes == {
        "add_pool_funds", "withdraw_unreserved_gen", "purchase_protection",
        "settle_protection", "finalize_expired_protection", "claim_payout",
        "pause_purchases", "unpause_purchases",
    }
    assert "withdraw_unreserved_gen" in methods
    assert "withdraw_unreserved" not in methods


def test_genvm_storage_validation():
    completed = subprocess.run(
        ["genvm-lint", "validate", str(CONTRACT_PATH), "--json"],
        capture_output=True, text=True,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
