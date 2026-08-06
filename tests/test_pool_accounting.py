from tests.test_aegis_protection import (
    ALICE, BOB, C, GEN, OWNER, assert_error, deploy, fund, mock_latest,
    purchase, set_context,
)


def test_owner_only_pool_funding():
    contract = deploy()
    fund(contract, 12 * GEN, OWNER)
    assert contract.get_pool_state() == {
        "pool_balance": 12 * GEN,
        "reserved_liability": 0,
        "available_liquidity": 12 * GEN,
    }


def test_zero_pool_funding_rejected():
    contract = deploy()
    set_context(OWNER, 0)
    assert_error(C.E_ZERO_AMOUNT, contract.add_pool_funds)


def test_non_owner_cannot_fund_pool():
    contract = deploy()
    set_context(BOB, GEN)
    assert_error(C.E_UNAUTHORIZED, contract.add_pool_funds)
    assert contract.get_pool_state()["pool_balance"] == 0


def test_purchase_premium_enters_pool_and_payout_is_reserved():
    contract = deploy()
    fund(contract, 10 * GEN)
    protection_id = purchase(contract, duration=14, event=3)
    assert protection_id == 0
    state = contract.get_pool_state()
    assert state["pool_balance"] == 12 * GEN
    assert state["reserved_liability"] == 5 * GEN
    assert state["available_liquidity"] == 7 * GEN


def test_insufficient_available_liquidity_rejected_without_state_change():
    contract = deploy()
    set_context(ALICE, 3 * GEN)
    mock_latest()
    assert_error(
        C.E_NO_LIQUIDITY,
        lambda: contract.purchase_protection("XAU_USD", 30, 4),
    )
    assert contract.get_pool_state()["pool_balance"] == 0
    assert contract.get_protection_count() == 0


def test_exact_premium_payment_validation():
    contract = deploy()
    fund(contract)
    set_context(ALICE, GEN - 1)
    mock_latest()
    assert_error(
        C.E_INVALID_PREMIUM,
        lambda: contract.purchase_protection("GBP_USD", 7, 2),
    )
    set_context(ALICE, GEN + 1)
    assert_error(
        C.E_INVALID_PREMIUM,
        lambda: contract.purchase_protection("GBP_USD", 7, 2),
    )


def test_owner_withdrawal_is_limited_to_unreserved_liquidity():
    contract = deploy()
    fund(contract, 10 * GEN)
    purchase(contract, duration=30, event=4)
    set_context(OWNER)
    assert contract.available_liquidity() == 3 * GEN
    assert_error(C.E_NO_UNRESERVED, lambda: contract.withdraw_unreserved_gen(4))
    contract.withdraw_unreserved_gen(3)
    assert contract.get_pool_state() == {
        "pool_balance": 10 * GEN,
        "reserved_liability": 10 * GEN,
        "available_liquidity": 0,
    }
    assert contract_module_transfer(contract) == (OWNER.lower(), 3 * GEN, "finalized")


def contract_module_transfer(contract):
    del contract
    from tests.test_aegis_protection import gl
    return gl.transfers[-1]


def test_non_owner_cannot_withdraw():
    contract = deploy()
    fund(contract)
    set_context(ALICE)
    assert_error(C.E_UNAUTHORIZED, lambda: contract.withdraw_unreserved_gen(1))


def test_withdrawal_accepts_whole_gen_and_transfers_native_units():
    for amount_gen in (1, 2, 3):
        contract = deploy()
        fund(contract, 6 * GEN)
        set_context(OWNER)
        contract.withdraw_unreserved_gen(amount_gen)
        assert contract.get_pool_state()["pool_balance"] == (6 - amount_gen) * GEN
        assert contract_module_transfer(contract) == (
            OWNER.lower(), amount_gen * GEN, "finalized"
        )


def test_zero_and_unsafe_whole_gen_withdrawals_are_rejected():
    contract = deploy()
    fund(contract)
    set_context(OWNER)
    assert_error(C.E_ZERO_AMOUNT, lambda: contract.withdraw_unreserved_gen(0))
    unsafe_amount = (2**256 - 1) // GEN + 1
    assert_error(
        C.E_ZERO_AMOUNT, lambda: contract.withdraw_unreserved_gen(unsafe_amount)
    )


def test_multiple_markets_share_one_pool_and_liability_total():
    contract = deploy()
    fund(contract, 30 * GEN)
    purchase(contract, "GBP_USD", 7, 2, ALICE)
    purchase(contract, "USD_JPY", 14, 4, BOB)
    state = contract.get_pool_state()
    assert state["pool_balance"] == 33 * GEN
    assert state["reserved_liability"] == 8 * GEN
    assert state["available_liquidity"] == 25 * GEN
