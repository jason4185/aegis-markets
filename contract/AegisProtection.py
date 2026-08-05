# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from dataclasses import dataclass
import json
from genlayer import *


VERSION="1.0.0"
GEN=10**18
PRICE_SCALE=10**8
RATE_SCALE=10**12
BPS_SCALE=10_000
DAY_SECONDS=86_400
MAX_REFERENCE_AGE=900
MAX_FUTURE_SKEW=300
LATEST_EQ_TIMESTAMP_WINDOW=90
LATEST_EQ_PRICE_TOLERANCE_BPS=5
MAX_BODY_BYTES=200_000
MAX_PRICE=10**30
MAX_PAGE_SIZE=50

LATEST_URL="https://api.fxratesapi.com/latest?base=USD&currencies=GBP,JPY,TRY,XAU,XAG&resolution=1m&format=json"
FX_HISTORICAL_PREFIX="https://api.fxratesapi.com/historical?date="
FX_HISTORICAL_SUFFIX="&base=USD&currencies=GBP,JPY,TRY,XAU,XAG&resolution=1d&format=json"
FAWAZ_JSDELIVR_PREFIX="https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@"
FAWAZ_JSDELIVR_SUFFIX="/v1/currencies/usd.min.json"
FAWAZ_PAGES_SUFFIX=".currency-api.pages.dev/v1/currencies/usd.min.json"

EXPECTED="[EXPECTED] "
EXTERNAL="[EXTERNAL] "
TRANSIENT="[TRANSIENT] "

E_INVALID_MARKET=EXPECTED + "INVALID_MARKET"
E_INVALID_DURATION=EXPECTED + "INVALID_DURATION"
E_INVALID_EVENT=EXPECTED + "INVALID_EVENT_LEVEL"
E_INVALID_PREMIUM=EXPECTED + "INVALID_PREMIUM"
E_NO_LIQUIDITY=EXPECTED + "INSUFFICIENT_AVAILABLE_LIQUIDITY"
E_PAUSED=EXPECTED + "PURCHASES_PAUSED"
E_UNAUTHORIZED=EXPECTED + "UNAUTHORIZED_CALLER"
E_INVALID_DATE=EXPECTED + "INVALID_SETTLEMENT_DATE"
E_SETTLEMENT_EXISTS=EXPECTED + "MARKET_SETTLEMENT_ALREADY_FINALIZED"
E_SETTLEMENT_MISSING=EXPECTED + "MARKET_SETTLEMENT_MISSING"
E_NOT_ACTIVE=EXPECTED + "PROTECTION_NOT_ACTIVE"
E_NOT_FOUND=EXPECTED + "PROTECTION_NOT_FOUND"
E_NOT_CLAIMABLE=EXPECTED + "PROTECTION_NOT_CLAIMABLE"
E_ALREADY_CLAIMED=EXPECTED + "PAYOUT_ALREADY_CLAIMED"
E_RESERVE_RELEASED=EXPECTED + "RESERVE_ALREADY_RELEASED"
E_NO_UNRESERVED=EXPECTED + "INSUFFICIENT_UNRESERVED_LIQUIDITY"
E_ZERO_AMOUNT=EXPECTED + "INVALID_AMOUNT"
E_TOO_EARLY=EXPECTED + "PROTECTION_NOT_EXPIRED"
E_INCOMPLETE=EXPECTED + "SETTLEMENTS_INCOMPLETE"
E_BAD_PAGE=EXPECTED + "INVALID_PAGE"
E_BAD_TX_TIME=EXPECTED + "INVALID_TRANSACTION_TIME"
E_INVARIANT=EXPECTED + "ACCOUNTING_INVARIANT"

X_MALFORMED=EXTERNAL + "MALFORMED_SOURCE_RESPONSE"
X_MISSING_RATE=EXTERNAL + "MISSING_SOURCE_RATE"
X_BAD_TIMESTAMP=EXTERNAL + "INVALID_SOURCE_TIMESTAMP"
X_STALE=EXTERNAL + "STALE_PURCHASE_REFERENCE"
X_SOURCE_UNAVAILABLE=EXTERNAL + "EXTERNAL_SOURCE_UNAVAILABLE"
T_SOURCE_UNAVAILABLE=TRANSIENT + "EXTERNAL_SOURCE_UNAVAILABLE"


@allow_storage
@dataclass
class Protection:
    owner: Address
    market_id: str
    event_bps: u16
    duration_days: u16
    premium: u256
    payout: u256
    reference_price: u256
    trigger_price: u256
    source_timestamp: u64
    purchased_at: u64
    first_settlement_day: u64
    last_settlement_day: u64
    expires_at: u64
    status: str
    breach_date: str
    processed_dates: u16
    inconclusive_dates: u16
    reserve_released: bool
    claimed: bool


@allow_storage
@dataclass
class MarketSettlement:
    market_id: str
    settlement_date: str
    settlement_day: u64
    fxratesapi_price: u256
    fawaz_price: u256
    source_a: str
    source_b: str
    source_a_date: str
    source_b_date: str
    status: str
    finalized: bool
    created_at: u64


def _user_error(code):
    raise gl.vm.UserError(code)


def _market(market_id):
    if market_id == "GBP_USD":
        return ("GBP/USD", "CURRENCY", "DOWN", "GBP", True)
    if market_id == "USD_JPY":
        return ("USD/JPY", "CURRENCY", "UP", "JPY", False)
    if market_id == "USD_TRY":
        return ("USD/TRY", "CURRENCY", "UP", "TRY", False)
    if market_id == "XAU_USD":
        return ("XAU/USD", "METAL", "DOWN", "XAU", True)
    if market_id == "XAG_USD":
        return ("XAG/USD", "METAL", "DOWN", "XAG", True)
    _user_error(E_INVALID_MARKET)
    return ("", "", "", "", False)


def _terms(duration_days, event_bps):
    if event_bps != 200 and event_bps != 300 and event_bps != 400:
        _user_error(E_INVALID_EVENT)
    if duration_days == 7:
        return (GEN, (event_bps // 100) * GEN)
    if duration_days == 14:
        if event_bps == 200:
            return (2 * GEN, 4 * GEN)
        if event_bps == 300:
            return (2 * GEN, 5 * GEN)
        return (2 * GEN, 6 * GEN)
    if duration_days == 30:
        if event_bps == 200:
            return (3 * GEN, 6 * GEN)
        if event_bps == 300:
            return (3 * GEN, 8 * GEN)
        return (3 * GEN, 10 * GEN)
    _user_error(E_INVALID_DURATION)
    return (0, 0)


def _event_bps_from_percent(event_percent):
    if event_percent != 2 and event_percent != 3 and event_percent != 4:
        _user_error(E_INVALID_EVENT)
    return event_percent * 100


def _is_leap(year):
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def _date_day(value, error_code):
    if len(value) != 10 or value[4] != "-" or value[7] != "-":
        _user_error(error_code)
    try:
        year = int(value[0:4])
        month = int(value[5:7])
        day = int(value[8:10])
    except ValueError:
        _user_error(error_code)
        return 0
    if year < 1970 or year > 9999 or month < 1 or month > 12:
        _user_error(error_code)
    limit = 31
    if month == 2:
        limit = 29 if _is_leap(year) else 28
    elif month == 4 or month == 6 or month == 9 or month == 11:
        limit = 30
    if day < 1 or day > limit:
        _user_error(error_code)
    adjusted = year - (1 if month <= 2 else 0)
    era = adjusted // 400
    yoe = adjusted - era * 400
    shifted = month + (-3 if month > 2 else 9)
    doy = (153 * shifted + 2) // 5 + day - 1
    return era * 146097 + yoe * 365 + yoe // 4 - yoe // 100 + doy - 719468


def _day_date(number):
    z = number + 719468
    era = z // 146097
    doe = z - era * 146097
    yoe = (doe - doe // 1460 + doe // 36524 - doe // 146096) // 365
    year = yoe + era * 400
    doy = doe - (365 * yoe + yoe // 4 - yoe // 100)
    mp = (5 * doy + 2) // 153
    day = doy - (153 * mp + 2) // 5 + 1
    month = mp + (3 if mp < 10 else -9)
    year += 1 if month <= 2 else 0
    return str(year).zfill(4) + "-" + str(month).zfill(2) + "-" + str(day).zfill(2)


def _iso_timestamp(value, error_code):
    if len(value) < 20 or value[10] != "T" or value[13] != ":" or value[16] != ":":
        _user_error(error_code)
    suffix = value[19:]
    if suffix.endswith("Z"):
        fraction = suffix[:-1]
    elif suffix.endswith("+00:00"):
        fraction = suffix[:-6]
    else:
        _user_error(error_code)
        return 0
    if fraction != "" and (
        not fraction.startswith(".")
        or len(fraction) < 2
        or len(fraction) > 10
        or not fraction[1:].isdigit()
    ):
        _user_error(error_code)
    day_number = _date_day(value[0:10], error_code)
    try:
        hour = int(value[11:13])
        minute = int(value[14:16])
        second = int(value[17:19])
    except ValueError:
        _user_error(error_code)
        return 0
    if hour < 0 or hour > 23 or minute < 0 or minute > 59 or second < 0 or second > 59:
        _user_error(error_code)
    return day_number * DAY_SECONDS + hour * 3600 + minute * 60 + second


def _source_calendar_date(raw, error_code):
    if not isinstance(raw, str):
        _user_error(error_code)
    value = raw.strip()
    if len(value) == 10:
        _date_day(value, error_code)
        return value
    _iso_timestamp(value, error_code)
    calendar_date = value[0:10]
    _date_day(calendar_date, error_code)
    return calendar_date


def _transaction_time(): return _iso_timestamp(gl.message_raw["datetime"], E_BAD_TX_TIME)


def _source_timestamp(raw):
    if isinstance(raw, bool):
        _user_error(X_BAD_TIMESTAMP)
    if isinstance(raw, int):
        result = raw
    elif isinstance(raw, str):
        clean = raw.strip()
        if clean.isdigit():
            if len(clean) > 12:
                _user_error(X_BAD_TIMESTAMP)
            result = int(clean)
        else:
            result = _iso_timestamp(clean, X_BAD_TIMESTAMP)
    else:
        _user_error(X_BAD_TIMESTAMP)
        return 0
    if result <= 0:
        _user_error(X_BAD_TIMESTAMP)
    return result


def _decimal_scaled(raw, scale):
    if isinstance(raw, bool):
        _user_error(X_MALFORMED)
    text = str(raw).strip()
    if len(text) == 0 or len(text) > 80 or text[0] == "-":
        _user_error(X_MALFORMED)
    if text[0:1] == "+":
        text = text[1:]
    lower = text.lower()
    exponent = 0
    if "e" in lower:
        if lower.count("e") != 1:
            _user_error(X_MALFORMED)
        coefficient, exponent_text = lower.split("e")
        if len(exponent_text) == 0 or len(exponent_text) > 4:
            _user_error(X_MALFORMED)
        try:
            exponent = int(exponent_text)
        except ValueError:
            _user_error(X_MALFORMED)
        if exponent < -30 or exponent > 30:
            _user_error(X_MALFORMED)
    else:
        coefficient = lower
    if coefficient.count(".") > 1:
        _user_error(X_MALFORMED)
    if "." in coefficient:
        whole, fraction = coefficient.split(".")
    else:
        whole, fraction = coefficient, ""
    if whole == "":
        whole = "0"
    digits = whole + fraction
    if len(digits) == 0 or len(digits) > 40 or not digits.isdigit():
        _user_error(X_MALFORMED)
    significant = int(digits)
    power = exponent - len(fraction)
    if power >= 0:
        result = significant * (10**power) * scale
    else:
        result = significant * scale // (10 ** (-power))
    if result <= 0:
        _user_error(X_MALFORMED)
    return result


def _normalize_rate(market_id, raw):
    _, _, _, _, reciprocal = _market(market_id)
    rate = _decimal_scaled(raw, RATE_SCALE)
    if reciprocal:
        result = RATE_SCALE * PRICE_SCALE // rate
    else:
        result = rate * PRICE_SCALE // RATE_SCALE
    if result <= 0 or result > MAX_PRICE:
        _user_error(X_MALFORMED)
    return result


def _decode_json(body):
    if body is None or len(body) == 0 or len(body) > MAX_BODY_BYTES:
        raise gl.vm.UserError(X_MALFORMED)
    try:
        decoded = json.loads(
            body.decode("utf-8"), parse_float=str, parse_int=str
        )
    except (ValueError, TypeError, UnicodeError):
        _user_error(X_MALFORMED)
        return {}
    if not isinstance(decoded, dict):
        _user_error(X_MALFORMED)
    return decoded


def _checked_response(url):
    response = gl.nondet.web.get(url)
    if response.status >= 500 or response.status <= 0:
        _user_error(T_SOURCE_UNAVAILABLE)
    if response.status != 200:
        _user_error(X_SOURCE_UNAVAILABLE)
    return _decode_json(response.body)


def _fx_rate(data, market_id):
    if data.get("success") is False or str(data.get("base", "")).upper() != "USD":
        _user_error(X_MALFORMED)
    rates = data.get("rates")
    if not isinstance(rates, dict):
        _user_error(X_MALFORMED)
    currency = _market(market_id)[3]
    if currency not in rates:
        _user_error(X_MISSING_RATE)
    return _normalize_rate(market_id, rates[currency])


def _purchase_result(market_id, transaction_time):
    data = _checked_response(LATEST_URL)
    price = _fx_rate(data, market_id)
    if "timestamp" not in data:
        _user_error(X_BAD_TIMESTAMP)
    source_time = _source_timestamp(data["timestamp"])
    source_date = _source_calendar_date(data.get("date"), X_BAD_TIMESTAMP)
    source_day = _date_day(source_date, X_BAD_TIMESTAMP)
    if source_time // DAY_SECONDS != source_day:
        _user_error(X_BAD_TIMESTAMP)
    if source_time > transaction_time + MAX_FUTURE_SKEW:
        _user_error(X_BAD_TIMESTAMP)
    if transaction_time - source_time > MAX_REFERENCE_AGE:
        _user_error(X_STALE)
    return {
        "source": "FXRATESAPI_LATEST",
        "market": market_id,
        "price": price,
        "timestamp": source_time,
        "date": source_date,
        "status": "VALID",
    }


def _purchase_results_equivalent(leader_result, validator_result, transaction_time):
    if not isinstance(leader_result, dict) or not isinstance(validator_result, dict):
        return False
    for field in ("source", "market", "status"):
        if leader_result.get(field) != validator_result.get(field):
            return False
    if (
        leader_result.get("source") != "FXRATESAPI_LATEST"
        or leader_result.get("status") != "VALID"
    ):
        return False
    leader_price = leader_result.get("price")
    validator_price = validator_result.get("price")
    leader_time = leader_result.get("timestamp")
    validator_time = validator_result.get("timestamp")
    if (
        isinstance(leader_price, bool)
        or isinstance(validator_price, bool)
        or isinstance(leader_time, bool)
        or isinstance(validator_time, bool)
        or not isinstance(leader_price, int)
        or not isinstance(validator_price, int)
        or not isinstance(leader_time, int)
        or not isinstance(validator_time, int)
        or leader_price <= 0
        or validator_price <= 0
        or leader_price > MAX_PRICE
        or validator_price > MAX_PRICE
    ):
        return False
    leader_date = leader_result.get("date")
    validator_date = validator_result.get("date")
    if not isinstance(leader_date, str) or not isinstance(validator_date, str):
        return False
    if leader_time // DAY_SECONDS != _date_day(leader_date, X_BAD_TIMESTAMP):
        return False
    if validator_time // DAY_SECONDS != _date_day(validator_date, X_BAD_TIMESTAMP):
        return False
    for source_time in (leader_time, validator_time):
        if source_time > transaction_time + MAX_FUTURE_SKEW:
            return False
        if transaction_time - source_time > MAX_REFERENCE_AGE:
            return False
    if abs(leader_time - validator_time) > LATEST_EQ_TIMESTAMP_WINDOW:
        return False
    price_difference = abs(leader_price - validator_price)
    lower_price = min(leader_price, validator_price)
    return (
        price_difference * BPS_SCALE
        <= lower_price * LATEST_EQ_PRICE_TOLERANCE_BPS
    )


def _historical_fx_result(market_id, settlement_date, current_day):
    url = FX_HISTORICAL_PREFIX + settlement_date + FX_HISTORICAL_SUFFIX
    response = gl.nondet.web.get(url)
    if response.status >= 500 or response.status <= 0:
        _user_error(T_SOURCE_UNAVAILABLE)
    if response.status != 200:
        if _date_day(settlement_date, X_MALFORMED) == current_day:
            _user_error(T_SOURCE_UNAVAILABLE)
        _user_error(X_SOURCE_UNAVAILABLE)
    data = _decode_json(response.body)
    source_date = _source_calendar_date(data.get("date"), X_MALFORMED)
    if source_date != settlement_date:
        _user_error(X_MALFORMED)
    return {
        "price": _fx_rate(data, market_id),
        "date": source_date,
        "source": "FXRATESAPI_HISTORICAL",
    }


def _parse_fawaz(data, market_id, settlement_date):
    source_date = _source_calendar_date(data.get("date"), X_MALFORMED)
    if source_date != settlement_date:
        _user_error(X_MALFORMED)
    rates = data.get("usd")
    if not isinstance(rates, dict):
        _user_error(X_MALFORMED)
    currency = _market(market_id)[3].lower()
    if currency not in rates:
        _user_error(X_MISSING_RATE)
    return {
        "price": _normalize_rate(market_id, rates[currency]),
        "date": source_date,
    }


def _fawaz_result(market_id, settlement_date, current_day):
    primary_url = (
        FAWAZ_JSDELIVR_PREFIX + settlement_date + FAWAZ_JSDELIVR_SUFFIX
    )
    fallback_url = "https://" + settlement_date + FAWAZ_PAGES_SUFFIX
    primary = gl.nondet.web.get(primary_url)
    primary_transient = primary.status >= 500 or primary.status <= 0
    if primary.status == 200:
        try:
            parsed = _parse_fawaz(
                _decode_json(primary.body), market_id, settlement_date
            )
            parsed["source"] = "FAWAZ"
            parsed["delivery"] = "JSDELIVR"
            return parsed
        except gl.vm.UserError:
            pass
    fallback = gl.nondet.web.get(fallback_url)
    if fallback.status == 200:
        parsed = _parse_fawaz(
            _decode_json(fallback.body), market_id, settlement_date
        )
        parsed["source"] = "FAWAZ"
        parsed["delivery"] = "PAGES_FALLBACK"
        return parsed
    if primary_transient or fallback.status >= 500 or fallback.status <= 0:
        _user_error(T_SOURCE_UNAVAILABLE)
    if _date_day(settlement_date, X_MALFORMED) == current_day:
        _user_error(T_SOURCE_UNAVAILABLE)
    _user_error(X_SOURCE_UNAVAILABLE)
    return {}


def _market_settlement_result(market_id, settlement_date, current_day):
    source_a = _historical_fx_result(market_id, settlement_date, current_day)
    source_b = _fawaz_result(market_id, settlement_date, current_day)
    return {
        "market": market_id,
        "settlement_date": settlement_date,
        "source_a_price": source_a["price"],
        "source_b_price": source_b["price"],
        "source_a": source_a["source"],
        "source_b": source_b["source"],
        "source_a_date": source_a["date"],
        "source_b_date": source_b["date"],
        "status": "VALID",
    }


def _error_equivalent(leader_result, operation) -> bool:
    leader_message = getattr(leader_result, "message", "")
    try:
        operation()
        return False
    except gl.vm.UserError as validator_error:
        validator_message = validator_error.message
        if validator_message.startswith(EXPECTED) or validator_message.startswith(EXTERNAL):
            return validator_message == leader_message
        if validator_message.startswith(TRANSIENT) and leader_message.startswith(TRANSIENT):
            return True
        return False


def _purchase_consensus(market_id, transaction_time):
    def leader():
        return _purchase_result(market_id, transaction_time)

    def validator(leader_result) -> bool:
        if not isinstance(leader_result, gl.vm.Return):
            return _error_equivalent(leader_result, leader)
        try:
            independently_fetched = leader()
            return _purchase_results_equivalent(
                leader_result.calldata, independently_fetched, transaction_time
            )
        except gl.vm.UserError:
            return False

    return gl.vm.run_nondet_unsafe(leader, validator)


def _market_settlement_consensus(market_id, settlement_date, current_day):
    def leader():
        return _market_settlement_result(market_id, settlement_date, current_day)

    def validator(leader_result) -> bool:
        if not isinstance(leader_result, gl.vm.Return):
            return _error_equivalent(leader_result, leader)
        try:
            independently_fetched = leader()
        except gl.vm.UserError:
            return False
        return independently_fetched == leader_result.calldata

    return gl.vm.run_nondet_unsafe(leader, validator)


def _trigger(reference_price, event_bps, direction):
    if reference_price <= 0 or reference_price > MAX_PRICE:
        _user_error(X_MALFORMED)
    if event_bps != 200 and event_bps != 300 and event_bps != 400:
        _user_error(E_INVALID_EVENT)
    if direction == "DOWN":
        return reference_price * (BPS_SCALE - event_bps) // BPS_SCALE
    return reference_price * (BPS_SCALE + event_bps) // BPS_SCALE


def _market_settlement_key(m,d): return m+"|"+d


def _protection_settlement_key(i,d): return str(i)+"|"+d


def _versioned_settlement_key(k,v):
    return k if v<=1 else k+"|v"+str(v)


class AegisProtection(gl.Contract):
    owner: Address
    pool_balance: u256
    reserved_liability: u256
    protection_count: u256
    paused: bool
    protections: TreeMap[u256, Protection]
    owner_counts: TreeMap[Address, u256]
    owner_protection_ids: TreeMap[str, u256]
    market_settlements: TreeMap[str, MarketSettlement]
    protection_settlement_results: TreeMap[str, str]
    settlement_versions: TreeMap[str, u16]
    settlement_retryable: TreeMap[str, bool]
    protection_settlement_versions: TreeMap[str, u16]
    active_protections: u256
    claimable_protections: u256
    expired_protections: u256
    claimed_protections: u256
    total_premiums_collected: u256
    total_payouts_paid: u256
    owner_active_counts: TreeMap[Address, u256]
    owner_claimable_counts: TreeMap[Address, u256]
    owner_expired_counts: TreeMap[Address, u256]
    owner_claimed_counts: TreeMap[Address, u256]
    owner_premiums_paid: TreeMap[Address, u256]
    owner_claimable_payouts: TreeMap[Address, u256]
    owner_payouts_received: TreeMap[Address, u256]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.pool_balance = u256(0)
        self.reserved_liability = u256(0)
        self.protection_count = u256(0)
        self.paused = False
        self.active_protections = u256(0)
        self.claimable_protections = u256(0)
        self.expired_protections = u256(0)
        self.claimed_protections = u256(0)
        self.total_premiums_collected = u256(0)
        self.total_payouts_paid = u256(0)

    def _available(self):
        if int(self.reserved_liability) > int(self.pool_balance):
            _user_error(E_INVARIANT)
        return int(self.pool_balance) - int(self.reserved_liability)

    def _only_owner(self):
        if gl.message.sender_address != self.owner:
            _user_error(E_UNAUTHORIZED)

    def _protection(self, protection_id):
        item = self.protections.get(u256(protection_id))
        if item is None:
            raise gl.vm.UserError(E_NOT_FOUND)
        return item

    def _current_market_settlement(self, base_key):
        version = int(self.settlement_versions.get(base_key, u16(0)))
        if version == 0 and self.market_settlements.get(base_key) is not None:
            version = 1
        return (
            self.market_settlements.get(
                _versioned_settlement_key(base_key, version)
            ),
            version,
        )

    def _protection_card(self, protection_id, item):
        symbol, category, direction, _, _ = _market(item.market_id)
        processed = int(item.processed_dates)
        duration = int(item.duration_days)
        return {
            "id": protection_id, "owner": item.owner.as_hex,
            "market_id": item.market_id, "symbol": symbol,
            "category": category, "direction": direction,
            "status": item.status, "duration_days": duration,
            "event_percent": int(item.event_bps) // 100,
            "event_bps": int(item.event_bps), "premium": int(item.premium),
            "payout": int(item.payout),
            "reference_price": int(item.reference_price),
            "trigger_price": int(item.trigger_price),
            "source_timestamp": int(item.source_timestamp),
            "purchased_at": int(item.purchased_at),
            "first_settlement_day": int(item.first_settlement_day),
            "last_settlement_day": int(item.last_settlement_day),
            "expires_at": int(item.expires_at), "processed_dates": processed,
            "inconclusive_dates": int(item.inconclusive_dates),
            "remaining_dates": max(duration-processed,0) if item.status=="ACTIVE" else 0,
            "breach_date": item.breach_date,
            "claimable": item.status == "CLAIMABLE", "claimed": item.claimed,
            "reserve_released": item.reserve_released,
        }

    def _mark_claimable(self, item, settlement_date):
        active = int(self.active_protections)
        owner_active = int(self.owner_active_counts.get(item.owner, u256(0)))
        if item.status != "ACTIVE" or active <= 0 or owner_active <= 0:
            _user_error(E_INVARIANT)
        payout = int(item.payout)
        self.active_protections = u256(active - 1)
        self.claimable_protections = u256(int(self.claimable_protections) + 1)
        self.owner_active_counts[item.owner] = u256(owner_active - 1)
        self.owner_claimable_counts[item.owner] = u256(
            int(self.owner_claimable_counts.get(item.owner, u256(0))) + 1
        )
        self.owner_claimable_payouts[item.owner] = u256(
            int(self.owner_claimable_payouts.get(item.owner, u256(0))) + payout
        )
        item.status = "CLAIMABLE"
        item.breach_date = settlement_date

    def _release_expired(self, item):
        if item.reserve_released:
            _user_error(E_RESERVE_RELEASED)
        payout = int(item.payout)
        active = int(self.active_protections)
        owner_active = int(self.owner_active_counts.get(item.owner, u256(0)))
        if (
            item.status != "ACTIVE"
            or payout > int(self.reserved_liability)
            or active <= 0
            or owner_active <= 0
        ):
            _user_error(E_INVARIANT)
        self.reserved_liability = u256(int(self.reserved_liability) - payout)
        self.active_protections = u256(active - 1)
        self.expired_protections = u256(int(self.expired_protections) + 1)
        self.owner_active_counts[item.owner] = u256(owner_active - 1)
        self.owner_expired_counts[item.owner] = u256(
            int(self.owner_expired_counts.get(item.owner, u256(0))) + 1
        )
        item.reserve_released = True
        item.status = "EXPIRED"

    def _expire_if_complete(self,item,now):
        if (item.status=="ACTIVE" and now>=int(item.expires_at)
            and int(item.processed_dates)==int(item.duration_days)
            and int(item.inconclusive_dates)==0):
            self._release_expired(item)

    @gl.public.view
    def get_config(self) -> dict:
        return {
            "contract": "AegisProtection",
            "version": VERSION,
            "price_scale": PRICE_SCALE,
            "gen_unit": GEN,
            "max_payout": 10 * GEN,
            "purchase_reference": "FXRatesAPI",
            "settlement_sources": "FXRatesAPI+Fawaz",
            "max_reference_age_seconds": MAX_REFERENCE_AGE,
            "latest_consensus_timestamp_window_seconds": LATEST_EQ_TIMESTAMP_WINDOW,
            "latest_consensus_price_tolerance_bps": LATEST_EQ_PRICE_TOLERANCE_BPS,
            "stale_reference_behavior": "PURCHASE_UNAVAILABLE",
            "purchase_reference_statement": (
                "Reference price fetched from FXRatesAPI and independently "
                "confirmed by GenLayer validators."
            ),
        }

    @gl.public.view
    def get_supported_markets(self) -> list[dict]:
        result = []
        for market_id in ("GBP_USD", "USD_JPY", "USD_TRY", "XAU_USD", "XAG_USD"):
            symbol, category, direction, _, _ = _market(market_id)
            result.append({
                "market_id": market_id,
                "symbol": symbol,
                "category": category,
                "direction": direction,
            })
        return result

    @gl.public.view
    def get_market(self, market_id: str) -> dict:
        symbol, category, direction, currency, reciprocal = _market(market_id)
        return {
            "market_id": market_id,
            "symbol": symbol,
            "category": category,
            "direction": direction,
            "usd_base_currency": currency,
            "reciprocal": reciprocal,
        }

    @gl.public.view
    def get_product_terms(self) -> list[dict]:
        result = []
        for duration in (7, 14, 30):
            for event_percent in (2, 3, 4):
                event_bps = event_percent * 100
                premium, payout = _terms(duration, event_bps)
                result.append({
                    "duration_days": duration,
                    "event_percent": event_percent,
                    "event_bps": event_bps,
                    "premium": premium,
                    "payout": payout,
                })
        return result

    @gl.public.view
    def quote_protection(self, duration_days: u16, event_percent: u16) -> dict:
        event_bps = _event_bps_from_percent(int(event_percent))
        premium, payout = _terms(int(duration_days), event_bps)
        return {"premium": premium, "payout": payout}

    @gl.public.view
    def preview_trigger(
        self, market_id: str, event_percent: u16, normalized_reference: u256
    ) -> u256:
        direction = _market(market_id)[2]
        event_bps = _event_bps_from_percent(int(event_percent))
        return u256(_trigger(int(normalized_reference), event_bps, direction))

    @gl.public.view
    def get_pool_state(self) -> dict:
        return {
            "pool_balance": int(self.pool_balance),
            "reserved_liability": int(self.reserved_liability),
            "available_liquidity": self._available(),
        }

    @gl.public.view
    def available_liquidity(self) -> u256:
        return u256(self._available())

    @gl.public.view
    def get_protocol_stats(self) -> dict:
        return {
            "pool_balance": int(self.pool_balance),
            "reserved_liability": int(self.reserved_liability),
            "available_liquidity": self._available(),
            "total_protections": int(self.protection_count),
            "active_protections": int(self.active_protections),
            "claimable_protections": int(self.claimable_protections),
            "expired_protections": int(self.expired_protections),
            "claimed_protections": int(self.claimed_protections),
            "total_premiums_collected": int(self.total_premiums_collected),
            "total_payouts_paid": int(self.total_payouts_paid),
            "purchases_paused": self.paused,
        }

    @gl.public.view
    def get_my_dashboard_summary(self, account: Address) -> dict:
        return {
            "account": account.as_hex,
            "total_protections": int(self.owner_counts.get(account, u256(0))),
            "active_count": int(self.owner_active_counts.get(account, u256(0))),
            "claimable_count": int(self.owner_claimable_counts.get(account, u256(0))),
            "expired_count": int(self.owner_expired_counts.get(account, u256(0))),
            "claimed_count": int(self.owner_claimed_counts.get(account, u256(0))),
            "total_premiums_paid": int(self.owner_premiums_paid.get(account, u256(0))),
            "total_claimable_payout": int(self.owner_claimable_payouts.get(account, u256(0))),
            "total_payouts_received": int(self.owner_payouts_received.get(account, u256(0))),
        }

    @gl.public.view
    def get_protection(self, protection_id: u256) -> dict:
        protection_number = int(protection_id)
        return self._protection_card(
            protection_number, self._protection(protection_number)
        )

    @gl.public.view
    def get_protection_count(self) -> u256:
        return self.protection_count

    @gl.public.view
    def get_owned_protection_count(self, account: Address) -> u256:
        return self.owner_counts.get(account, u256(0))

    @gl.public.view
    def get_owned_protection_ids(
        self, account: Address, start: u256, limit: u16
    ) -> list[u256]:
        count = int(self.owner_counts.get(account, u256(0)))
        first = int(start)
        size = int(limit)
        if size <= 0 or size > MAX_PAGE_SIZE or first > count:
            _user_error(E_BAD_PAGE)
        end = min(first + size, count)
        prefix = account.as_hex + "|"
        result = []
        for index in range(first, end):
            result.append(self.owner_protection_ids[prefix + str(index)])
        return result

    @gl.public.view
    def get_my_protections(
        self, account: Address, start: u256, limit: u16
    ) -> list[dict]:
        result = []
        for stored_id in self.get_owned_protection_ids(account, start, limit):
            protection_id = int(stored_id)
            result.append(
                self._protection_card(
                    protection_id, self._protection(protection_id)
                )
            )
        return result

    @gl.public.view
    def get_market_settlement(
        self, market_id: str, settlement_date: str
    ) -> dict:
        _market(market_id)
        _date_day(settlement_date, E_INVALID_DATE)
        key = _market_settlement_key(market_id, settlement_date)
        item, version = self._current_market_settlement(key)
        if item is None:
            raise gl.vm.UserError(E_SETTLEMENT_MISSING)
        return {
            "market_id": item.market_id, "settlement_date": item.settlement_date,
            "settlement_day": int(item.settlement_day),
            "fxratesapi_price": int(item.fxratesapi_price),
            "fawaz_price": int(item.fawaz_price), "source_a": item.source_a,
            "source_b": item.source_b, "source_a_date": item.source_a_date,
            "source_b_date": item.source_b_date, "status": item.status,
            "finalized": item.finalized, "created_at": int(item.created_at),
            "version": version,
            "retryable": self.settlement_retryable.get(key, False),
        }

    @gl.public.view
    def get_protection_settlement_result(
        self, protection_id: u256, settlement_date: str
    ) -> str:
        self._protection(int(protection_id))
        return self.protection_settlement_results.get(
            _protection_settlement_key(int(protection_id), settlement_date), "UNPROCESSED"
        )

    @gl.public.view
    def get_protection_settlement_version(
        self, protection_id: u256, settlement_date: str
    ) -> u16:
        self._protection(int(protection_id))
        return self.protection_settlement_versions.get(
            _protection_settlement_key(int(protection_id), settlement_date), u16(0)
        )

    @gl.public.view
    def get_protection_details(self, protection_id: u256) -> dict:
        number = int(protection_id)
        item = self._protection(number)
        result = self._protection_card(number, item)
        latest, version, unresolved = "UNPROCESSED", 0, ""
        for offset in range(int(item.duration_days)):
            date = _day_date(int(item.first_settlement_day) + offset)
            key = _protection_settlement_key(number, date)
            value = self.protection_settlement_results.get(key, "UNPROCESSED")
            if value != "UNPROCESSED":
                latest = value
                version = int(self.protection_settlement_versions.get(key, u16(0)))
            if item.status=="ACTIVE" and unresolved=="" and value in ("UNPROCESSED", "INCONCLUSIVE"):
                unresolved = date
        result.update({
            "first_settlement_date": _day_date(int(item.first_settlement_day)),
            "last_settlement_date": _day_date(int(item.last_settlement_day)),
            "next_unresolved_settlement_date": unresolved,
            "latest_settlement_result": latest,
            "latest_market_settlement_version_used": version,
            "can_claim": item.status == "CLAIMABLE" and not item.claimed,
            "expired": item.status == "EXPIRED",
            "reserve_status": "RELEASED" if item.reserve_released else "RESERVED",
        })
        return result

    @gl.public.view
    def get_settlement_readiness(
        self, protection_id: u256, settlement_date: str
    ) -> dict:
        number = int(protection_id)
        item = self._protection(number)
        today = _transaction_time() // DAY_SECONDS
        valid = True
        try:
            day = _date_day(settlement_date, E_INVALID_DATE)
        except gl.vm.UserError:
            day = 0
            valid = False
        rkey = _protection_settlement_key(number, settlement_date)
        previous = self.protection_settlement_results.get(rkey, "UNPROCESSED")
        key = _market_settlement_key(item.market_id, settlement_date)
        stored, version = self._current_market_settlement(key)
        future = valid and day > today
        inside = valid and (
            day >= int(item.first_settlement_day)
            and day <= int(item.last_settlement_day)
        )
        retryable = self.settlement_retryable.get(key, False)
        ready = False
        if not valid:
            reason = "INVALID_SETTLEMENT_DATE"
        elif future:
            reason = "FUTURE_SETTLEMENT_DATE"
        elif not inside:
            reason = "INVALID_SETTLEMENT_DATE"
        elif previous == "BREACHED" or previous == "NOT_BREACHED":
            reason = "DATE_ALREADY_SETTLED"
        elif item.status == "CLAIMABLE":
            reason = "PROTECTION_CLAIMABLE"
        elif item.status == "EXPIRED":
            reason = "PROTECTION_EXPIRED"
        elif item.status != "ACTIVE":
            reason = "PROTECTION_NOT_ACTIVE"
        elif previous == "INCONCLUSIVE" and retryable:
            ready = True
            reason = "MARKET_SETTLEMENT_RETRYABLE"
        elif stored is not None and stored.finalized:
            ready = True
            reason = "MARKET_SETTLEMENT_AVAILABLE"
        else:
            ready = True
            reason = "READY"
        return {
            "protection_id": number, "market_id": item.market_id,
            "settlement_date": settlement_date, "settlement_day": day,
            "current_utc_day": today, "inside_protection_window": inside,
            "is_future_date": future, "protection_status": item.status,
            "previous_result": previous,
            "market_settlement_exists": stored is not None,
            "market_settlement_finalized": stored is not None and stored.finalized,
            "market_settlement_version": version, "retryable": retryable,
            "ready": ready, "reason_code": reason,
        }

    @gl.public.view
    def get_settlement_history(
        self, protection_id: u256, start: u256, limit: u16
    ) -> list[dict]:
        number = int(protection_id)
        item = self._protection(number)
        duration, first, size = int(item.duration_days), int(start), int(limit)
        if size <= 0 or size > MAX_PAGE_SIZE or first > duration:
            _user_error(E_BAD_PAGE)
        result = []
        for offset in range(first, min(first + size, duration)):
            date = _day_date(int(item.first_settlement_day) + offset)
            rkey = _protection_settlement_key(number, date)
            value = self.protection_settlement_results.get(rkey, "UNPROCESSED")
            used = int(self.protection_settlement_versions.get(rkey, u16(0)))
            key = _market_settlement_key(item.market_id, date)
            _, current = self._current_market_settlement(key)
            version = used if used > 0 else current
            stored = self.market_settlements.get(
                _versioned_settlement_key(key, version)
            ) if version > 0 else None
            result.append({
                "protection_id": number, "market_id": item.market_id,
                "settlement_date": date, "result": value,
                "processed": value != "UNPROCESSED",
                "market_settlement_exists": stored is not None,
                "market_settlement_version": version,
                "fxratesapi_price": int(stored.fxratesapi_price) if stored else 0,
                "fawaz_price": int(stored.fawaz_price) if stored else 0,
                "trigger_price": int(item.trigger_price),
                "source_a_date": stored.source_a_date if stored else "",
                "source_b_date": stored.source_b_date if stored else "",
                "settled_at": int(stored.created_at) if stored else 0,
                "retryable": self.settlement_retryable.get(key, False),
            })
        return result

    @gl.public.view
    def purchases_paused(self) -> bool:
        return self.paused

    @gl.public.write.payable
    def add_pool_funds(self) -> None:
        amount = int(gl.message.value)
        if amount <= 0:
            _user_error(E_ZERO_AMOUNT)
        self.pool_balance = u256(int(self.pool_balance) + amount)

    @gl.public.write
    def withdraw_unreserved_gen(self, amount_gen: u256) -> None:
        self._only_owner()
        whole_gen = int(amount_gen)
        if whole_gen <= 0:
            _user_error(E_ZERO_AMOUNT)
        if whole_gen > (2**256 - 1) // GEN:
            _user_error(E_ZERO_AMOUNT)
        amount_native = whole_gen * GEN
        if amount_native > self._available():
            _user_error(E_NO_UNRESERVED)
        self.pool_balance = u256(int(self.pool_balance) - amount_native)
        gl.get_contract_at(self.owner).emit_transfer(
            value=u256(amount_native), on="finalized"
        )

    @gl.public.write.payable
    def purchase_protection(
        self, market_id: str, duration_days: u16, event_percent: u16
    ) -> u256:
        if self.paused:
            _user_error(E_PAUSED)
        direction = _market(market_id)[2]
        duration = int(duration_days)
        event = _event_bps_from_percent(int(event_percent))
        premium, payout = _terms(duration, event)
        if int(gl.message.value) != premium:
            _user_error(E_INVALID_PREMIUM)
        if self._available() + premium < payout:
            _user_error(E_NO_LIQUIDITY)
        now = _transaction_time()
        reference = _purchase_consensus(market_id, now)
        reference_price = int(reference["price"])
        trigger_price = _trigger(reference_price, event, direction)
        purchase_day = now // DAY_SECONDS
        first_day = purchase_day + 1
        last_day = purchase_day + duration
        expires_at = (last_day + 1) * DAY_SECONDS
        protection_id = int(self.protection_count)
        buyer = gl.message.sender_address
        self.protections[u256(protection_id)] = Protection(
            owner=buyer, market_id=market_id,
            event_bps=u16(event), duration_days=u16(duration),
            premium=u256(premium), payout=u256(payout),
            reference_price=u256(reference_price), trigger_price=u256(trigger_price),
            source_timestamp=u64(int(reference["timestamp"])),
            purchased_at=u64(now), first_settlement_day=u64(first_day),
            last_settlement_day=u64(last_day), expires_at=u64(expires_at),
            status="ACTIVE", breach_date="", processed_dates=u16(0),
            inconclusive_dates=u16(0), reserve_released=False, claimed=False,
        )
        owner_index = int(self.owner_counts.get(buyer, u256(0)))
        self.owner_protection_ids[buyer.as_hex + "|" + str(owner_index)] = u256(
            protection_id
        )
        self.owner_counts[buyer] = u256(owner_index + 1)
        self.protection_count = u256(protection_id + 1)
        self.active_protections = u256(int(self.active_protections) + 1)
        self.total_premiums_collected = u256(
            int(self.total_premiums_collected) + premium
        )
        self.owner_active_counts[buyer] = u256(
            int(self.owner_active_counts.get(buyer, u256(0))) + 1
        )
        self.owner_premiums_paid[buyer] = u256(
            int(self.owner_premiums_paid.get(buyer, u256(0))) + premium
        )
        self.pool_balance = u256(int(self.pool_balance) + premium)
        self.reserved_liability = u256(int(self.reserved_liability) + payout)
        if int(self.reserved_liability) > int(self.pool_balance):
            _user_error(E_INVARIANT)
        return u256(protection_id)

    @gl.public.write
    def settle_protection(
        self, protection_id: u256, settlement_date: str
    ) -> str:
        number = int(protection_id)
        item = self._protection(number)
        now = _transaction_time()
        settlement_day = _date_day(settlement_date, E_INVALID_DATE)
        if settlement_day > now // DAY_SECONDS:
            _user_error(E_INVALID_DATE)
        if (
            settlement_day < int(item.first_settlement_day)
            or settlement_day > int(item.last_settlement_day)
        ):
            _user_error(E_INVALID_DATE)
        rkey = _protection_settlement_key(number, settlement_date)
        previous = self.protection_settlement_results.get(rkey)
        if previous == "BREACHED":
            return previous
        if previous == "NOT_BREACHED":
            self._expire_if_complete(item,now)
            return previous
        if item.status != "ACTIVE":
            _user_error(E_NOT_ACTIVE)
        skey = _market_settlement_key(
            item.market_id, settlement_date
        )
        settlement, version = (
            self._current_market_settlement(skey)
        )
        prior_version = int(self.protection_settlement_versions.get(rkey, u16(0)))
        create_version = settlement is None
        if previous == "INCONCLUSIVE" and version <= prior_version:
            if not self.settlement_retryable.get(skey, False):
                return previous
            create_version = True
        if create_version:
            if version >= 65_535:
                _user_error(E_SETTLEMENT_EXISTS)
            version += 1
            consensus = _market_settlement_consensus(
                item.market_id, settlement_date, now // DAY_SECONDS
            )
            settlement = MarketSettlement(
                market_id=item.market_id, settlement_date=settlement_date,
                settlement_day=u64(settlement_day),
                fxratesapi_price=u256(int(consensus["source_a_price"])),
                fawaz_price=u256(int(consensus["source_b_price"])),
                source_a=str(consensus["source_a"]), source_b=str(consensus["source_b"]),
                source_a_date=str(consensus["source_a_date"]),
                source_b_date=str(consensus["source_b_date"]), status="FINALIZED",
                finalized=True, created_at=u64(now),
            )
            self.market_settlements[
                _versioned_settlement_key(skey, version)
            ] = settlement
            self.settlement_versions[skey] = u16(version)
            self.settlement_retryable[skey] = False
        if settlement is None or not settlement.finalized:
            raise gl.vm.UserError(E_SETTLEMENT_MISSING)
        trigger_price = int(item.trigger_price)
        direction = _market(item.market_id)[2]
        price_a = int(settlement.fxratesapi_price)
        price_b = int(settlement.fawaz_price)
        if direction == "DOWN":
            breached_a = price_a <= trigger_price
            breached_b = price_b <= trigger_price
        else:
            breached_a = price_a >= trigger_price
            breached_b = price_b >= trigger_price
        if breached_a and breached_b:
            outcome = "BREACHED"
        elif not breached_a and not breached_b:
            outcome = "NOT_BREACHED"
        else:
            outcome = "INCONCLUSIVE"
        was_inconclusive = previous == "INCONCLUSIVE"
        if outcome == "INCONCLUSIVE":
            if not was_inconclusive:
                item.inconclusive_dates = u16(int(item.inconclusive_dates) + 1)
            self.settlement_retryable[skey] = True
        elif outcome == "BREACHED":
            if was_inconclusive:
                if int(item.inconclusive_dates) <= 0:
                    _user_error(E_INVARIANT)
                item.inconclusive_dates = u16(int(item.inconclusive_dates) - 1)
            self._mark_claimable(item, settlement_date)
        else:
            if was_inconclusive:
                if int(item.inconclusive_dates) <= 0:
                    _user_error(E_INVARIANT)
                item.inconclusive_dates = u16(int(item.inconclusive_dates) - 1)
            item.processed_dates = u16(int(item.processed_dates) + 1)
        self.protection_settlement_results[rkey] = outcome
        self.protection_settlement_versions[rkey] = u16(version)
        self._expire_if_complete(item,now)
        return outcome

    @gl.public.write
    def finalize_expired_protection(self, protection_id: u256) -> None:
        item = self._protection(int(protection_id))
        if item.reserve_released:
            _user_error(E_RESERVE_RELEASED)
        if item.status != "ACTIVE":
            _user_error(E_NOT_ACTIVE)
        if _transaction_time() < int(item.expires_at):
            _user_error(E_TOO_EARLY)
        if int(item.processed_dates) != int(item.duration_days):
            _user_error(E_INCOMPLETE)
        if int(item.inconclusive_dates) != 0:
            _user_error(E_INCOMPLETE)
        self._release_expired(item)

    @gl.public.write
    def claim_payout(self, protection_id: u256) -> None:
        item = self._protection(int(protection_id))
        if gl.message.sender_address != item.owner:
            _user_error(E_UNAUTHORIZED)
        if item.claimed:
            _user_error(E_ALREADY_CLAIMED)
        if item.status != "CLAIMABLE":
            _user_error(E_NOT_CLAIMABLE)
        if item.reserve_released:
            _user_error(E_RESERVE_RELEASED)
        payout = int(item.payout)
        claimable = int(self.claimable_protections)
        owner_claimable = int(
            self.owner_claimable_counts.get(item.owner, u256(0))
        )
        owner_claimable_payout = int(
            self.owner_claimable_payouts.get(item.owner, u256(0))
        )
        if (
            payout > int(self.pool_balance)
            or payout > int(self.reserved_liability)
            or payout > owner_claimable_payout
            or claimable <= 0
            or owner_claimable <= 0
        ):
            _user_error(E_INVARIANT)
        item.claimed = True
        item.reserve_released = True
        item.status = "CLAIMED"
        self.pool_balance = u256(int(self.pool_balance) - payout)
        self.reserved_liability = u256(int(self.reserved_liability) - payout)
        self.claimable_protections = u256(claimable - 1)
        self.claimed_protections = u256(int(self.claimed_protections) + 1)
        self.total_payouts_paid = u256(int(self.total_payouts_paid) + payout)
        self.owner_claimable_counts[item.owner] = u256(owner_claimable - 1)
        self.owner_claimed_counts[item.owner] = u256(
            int(self.owner_claimed_counts.get(item.owner, u256(0))) + 1
        )
        self.owner_claimable_payouts[item.owner] = u256(
            owner_claimable_payout - payout
        )
        self.owner_payouts_received[item.owner] = u256(
            int(self.owner_payouts_received.get(item.owner, u256(0))) + payout
        )
        gl.get_contract_at(item.owner).emit_transfer(
            value=u256(payout), on="finalized"
        )

    @gl.public.write
    def pause_purchases(self) -> None:
        self._only_owner()
        self.paused = True

    @gl.public.write
    def unpause_purchases(self) -> None:
        self._only_owner()
        self.paused = False
