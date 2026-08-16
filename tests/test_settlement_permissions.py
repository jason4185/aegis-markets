import pickle

from tests.test_aegis_protection import (
    ALICE, BOB, C, OWNER, Address, assert_error, deploy, fund, gl,
    mock_settlement, purchase, set_context,
)


ZERO = "0x" + "00" * 20
OPERATORS = ["0x" + f"{value:040x}" for value in range(4, 10)]


def add(contract, operator):
    set_context(OWNER)
    contract.add_settlement_operator(operator)


def policy(owner=ALICE):
    contract = deploy()
    fund(contract)
    return contract, purchase(contract, buyer=owner)


def settle_as(contract, protection_id, caller):
    mock_settlement("2026-06-02")
    set_context(caller, 0, "2026-06-03T12:00:00Z")
    return contract.settle_protection(protection_id, "2026-06-02")


def test_owner_adds_operator_and_all_reads_are_consistent():
    contract = deploy()
    add(contract, OPERATORS[0])
    operator = Address(OPERATORS[0])
    assert contract.get_settlement_operator_count() == 1
    assert contract.is_settlement_operator(OPERATORS[0]) is True
    assert contract.get_settlement_operator_at(0) == OPERATORS[0]
    assert contract.get_settlement_operators() == [OPERATORS[0]]
    assert contract.settlement_operator_indexes[operator] == 1


def test_public_address_inputs_are_strings_and_normalized_internally():
    contract = deploy()
    checksum = "0xC8Ba5DA455b011863F2ECa76a6Fa21E62Cc91B87"
    assert contract.get_my_dashboard_summary(checksum)["account"] == checksum.lower()
    assert contract.get_owned_protection_count(checksum) == 0
    assert contract.is_settlement_operator(checksum) is False
    for invalid in ("0x1234", "", "not-an-address", "0x" + "zz" * 20, ZERO):
        assert_error(C.E_INVALID_ADDRESS, lambda value=invalid: contract.get_owned_protection_count(value))


def test_only_owner_can_add_and_invalid_addresses_are_rejected():
    contract = deploy()
    set_context(ALICE)
    assert_error(C.E_UNAUTHORIZED, lambda: contract.add_settlement_operator(OPERATORS[0]))
    set_context(OWNER)
    assert_error(C.E_INVALID_OPERATOR, lambda: contract.add_settlement_operator(ZERO))
    assert_error(C.E_INVALID_OPERATOR, lambda: contract.add_settlement_operator(OWNER))


def test_duplicate_and_sixth_operator_are_rejected_and_count_never_exceeds_five():
    contract = deploy()
    add(contract, OPERATORS[0])
    set_context(OWNER)
    assert_error(C.E_OPERATOR_EXISTS, lambda: contract.add_settlement_operator(OPERATORS[0]))
    for expected, operator in enumerate(OPERATORS[1:5], 2):
        contract.add_settlement_operator(operator)
        assert contract.get_settlement_operator_count() == expected
    assert_error(C.E_OPERATOR_LIMIT, lambda: contract.add_settlement_operator(OPERATORS[5]))
    assert contract.get_settlement_operator_count() == 5
    assert contract.get_settlement_operators() == OPERATORS[:5]


def test_invalid_operator_index_reverts():
    contract = deploy()
    add(contract, OPERATORS[0])
    assert_error(C.E_INVALID_OPERATOR_INDEX, lambda: contract.get_settlement_operator_at(1))


def test_only_owner_removes_known_operator():
    contract = deploy()
    add(contract, OPERATORS[0])
    set_context(ALICE)
    assert_error(C.E_UNAUTHORIZED, lambda: contract.remove_settlement_operator(OPERATORS[0]))
    set_context(OWNER)
    assert_error(C.E_OPERATOR_MISSING, lambda: contract.remove_settlement_operator(OPERATORS[1]))
    contract.remove_settlement_operator(OPERATORS[0])
    assert contract.get_settlement_operator_count() == 0
    assert contract.is_settlement_operator(OPERATORS[0]) is False
    assert contract.get_settlement_operators() == []


def test_swap_and_pop_updates_reverse_index_and_reuses_slot():
    contract = deploy()
    for operator in OPERATORS[:5]:
        add(contract, operator)
    removed = OPERATORS[1]
    moved = Address(OPERATORS[4])
    set_context(OWNER)
    contract.remove_settlement_operator(removed)
    assert contract.get_settlement_operator_count() == 4
    assert contract.is_settlement_operator(removed) is False
    assert OPERATORS[1] not in contract.get_settlement_operators()
    assert contract.get_settlement_operator_at(1) == OPERATORS[4]
    assert contract.settlement_operator_indexes[moved] == 2
    contract.add_settlement_operator(OPERATORS[5])
    assert contract.get_settlement_operator_at(4) == OPERATORS[5]
    assert len(set(contract.get_settlement_operators())) == 5


def test_owner_operator_and_protection_owner_can_settle():
    for caller, operator in ((OWNER, None), (OPERATORS[0], OPERATORS[0]), (ALICE, None)):
        contract, protection_id = policy()
        if operator:
            add(contract, operator)
        assert settle_as(contract, protection_id, caller) == "NOT_BREACHED"


def test_protection_owner_cannot_settle_another_policy_unless_approved():
    contract, protection_id = policy(BOB)
    gl.nondet.web.clear()
    set_context(ALICE, 0, "2026-06-03T12:00:00Z")
    assert_error(C.E_UNAUTHORIZED, lambda: contract.settle_protection(protection_id, "2026-06-02"))
    assert gl.nondet.web.requests == []
    add(contract, ALICE)
    assert settle_as(contract, protection_id, ALICE) == "NOT_BREACHED"


def test_unrelated_and_removed_operators_fail_before_web_requests():
    contract, protection_id = policy()
    operator = OPERATORS[0]
    add(contract, OPERATORS[0])
    set_context(OWNER)
    contract.remove_settlement_operator(operator)
    gl.nondet.web.clear()
    set_context(OPERATORS[0], 0, "2026-06-03T12:00:00Z")
    assert_error(C.E_UNAUTHORIZED, lambda: contract.settle_protection(protection_id, "2026-06-02"))
    set_context(OPERATORS[1], 0, "2026-06-03T12:00:00Z")
    assert_error(C.E_UNAUTHORIZED, lambda: contract.settle_protection(protection_id, "2026-06-02"))
    assert gl.nondet.web.requests == []


def test_can_settle_protection_reports_each_role_and_missing_policy():
    contract, protection_id = policy()
    add(contract, OPERATORS[0])
    owner = contract.can_settle_protection(OWNER, protection_id)
    operator = contract.can_settle_protection(OPERATORS[0], protection_id)
    protection_owner = contract.can_settle_protection(ALICE, protection_id)
    unrelated = contract.can_settle_protection(OPERATORS[1], protection_id)
    assert owner == {"authorized": True, "is_contract_owner": True, "is_operator": False, "is_protection_owner": False}
    assert operator == {"authorized": True, "is_contract_owner": False, "is_operator": True, "is_protection_owner": False}
    assert protection_owner == {"authorized": True, "is_contract_owner": False, "is_operator": False, "is_protection_owner": True}
    assert unrelated["authorized"] is False
    assert_error(C.E_NOT_FOUND, lambda: contract.can_settle_protection(OWNER, 999))


def test_operator_storage_survives_pickle_reload_after_swap_and_pop():
    contract = deploy()
    for operator in OPERATORS[:3]:
        add(contract, operator)
    set_context(OWNER)
    contract.remove_settlement_operator(OPERATORS[1])
    restored = pickle.loads(pickle.dumps({
        "authorized": contract.settlement_operators,
        "addresses": contract.settlement_operator_addresses,
        "indexes": contract.settlement_operator_indexes,
        "count": contract.settlement_operator_count,
    }))
    assert restored["count"] == 2
    assert restored["addresses"][1] == Address(OPERATORS[2])
    assert restored["indexes"][Address(OPERATORS[2])] == 2
    assert Address(OPERATORS[1]) not in restored["authorized"]


def test_storage_layout_appends_operator_fields_and_preserves_records():
    assert list(C.Protection.__annotations__) == [
        "owner", "market_id", "event_bps", "duration_days", "premium", "payout",
        "reference_price", "trigger_price", "source_timestamp", "purchased_at",
        "first_settlement_day", "last_settlement_day", "expires_at", "status",
        "breach_date", "processed_dates", "inconclusive_dates", "reserve_released", "claimed",
        "cancellation_timestamp", "cancellation_settlement_date", "cancellation_reason",
    ]
    assert list(C.AegisProtection.__annotations__)[-4:] == [
        "settlement_operators", "settlement_operator_addresses",
        "settlement_operator_indexes", "settlement_operator_count",
    ]
