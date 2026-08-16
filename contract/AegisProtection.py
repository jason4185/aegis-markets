# { "Depends":"py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from dataclasses import dataclass
import json
from genlayer import *
VERSION = '1.0.0'
GEN = 10 ** 18
PRICE_SCALE = 10 ** 8
RATE_SCALE = 10 ** 12
BPS_SCALE = 10000
DAY_SECONDS = 86400
MAX_REFERENCE_AGE = 900
MAX_FUTURE_SKEW = 300
LATEST_EQ_TIMESTAMP_WINDOW = 90
LATEST_EQ_PRICE_TOLERANCE_BPS = 5
MAX_BODY_BYTES = 200000
MAX_PRICE = 10 ** 30
MAX_PAGE_SIZE = 50
TERMINAL_GRACE_DAYS = 3
LATEST_URL = 'https://api.fxratesapi.com/latest?base=USD&currencies=GBP,JPY,TRY,XAU,XAG&resolution=1m&format=json'
FX_HISTORICAL_PREFIX = 'https://api.fxratesapi.com/historical?date='
FX_HISTORICAL_SUFFIX = '&base=USD&currencies=GBP,JPY,TRY,XAU,XAG&resolution=1d&format=json'
FAWAZ_JSDELIVR_PREFIX = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@'
FAWAZ_JSDELIVR_SUFFIX = '/v1/currencies/usd.min.json'
FAWAZ_PAGES_SUFFIX = '.currency-api.pages.dev/v1/currencies/usd.min.json'
EXPECTED = '[EXPECTED] '
EXTERNAL = '[EXTERNAL] '
TRANSIENT = '[TRANSIENT] '
E_INVALID_MARKET = EXPECTED + 'INVALID_MARKET'
E_INVALID_DURATION = EXPECTED + 'INVALID_DURATION'
E_INVALID_EVENT = EXPECTED + 'INVALID_EVENT_LEVEL'
E_INVALID_PREMIUM = EXPECTED + 'INVALID_PREMIUM'
E_NO_LIQUIDITY = EXPECTED + 'INSUFFICIENT_AVAILABLE_LIQUIDITY'
E_PAUSED = EXPECTED + 'PURCHASES_PAUSED'
E_UNAUTHORIZED = EXPECTED + 'UNAUTHORIZED_CALLER'
E_INVALID_DATE = EXPECTED + 'INVALID_SETTLEMENT_DATE'
E_SETTLEMENT_EXISTS = EXPECTED + 'MARKET_SETTLEMENT_ALREADY_FINALIZED'
E_SETTLEMENT_MISSING = EXPECTED + 'MARKET_SETTLEMENT_MISSING'
E_NOT_ACTIVE = EXPECTED + 'PROTECTION_NOT_ACTIVE'
E_NOT_FOUND = EXPECTED + 'PROTECTION_NOT_FOUND'
E_NOT_CLAIMABLE = EXPECTED + 'PROTECTION_NOT_CLAIMABLE'
E_ALREADY_CLAIMED = EXPECTED + 'PAYOUT_ALREADY_CLAIMED'
E_RESERVE_RELEASED = EXPECTED + 'RESERVE_ALREADY_RELEASED'
E_NO_UNRESERVED = EXPECTED + 'INSUFFICIENT_UNRESERVED_LIQUIDITY'
E_ZERO_AMOUNT = EXPECTED + 'INVALID_AMOUNT'
E_BAD_PAGE = EXPECTED + 'INVALID_PAGE'
E_BAD_TX_TIME = EXPECTED + 'INVALID_TRANSACTION_TIME'
E_INVARIANT = EXPECTED + 'ACCOUNTING_INVARIANT'
E_OPERATOR_EXISTS = EXPECTED + 'SETTLEMENT_OPERATOR_ALREADY_APPROVED'
E_OPERATOR_MISSING = EXPECTED + 'SETTLEMENT_OPERATOR_NOT_FOUND'
E_OPERATOR_LIMIT = EXPECTED + 'SETTLEMENT_OPERATOR_LIMIT_REACHED'
E_INVALID_OPERATOR = EXPECTED + 'INVALID_SETTLEMENT_OPERATOR'
E_INVALID_OPERATOR_INDEX = EXPECTED + 'INVALID_SETTLEMENT_OPERATOR_INDEX'
E_INVALID_ADDRESS = EXPECTED + 'INVALID_ADDRESS'
E_TERMINAL_NOT_READY = EXPECTED + 'TERMINAL_CANCELLATION_NOT_READY'
X_MALFORMED = EXTERNAL + 'MALFORMED_SOURCE_RESPONSE'
X_MISSING_RATE = EXTERNAL + 'MISSING_SOURCE_RATE'
X_BAD_TIMESTAMP = EXTERNAL + 'INVALID_SOURCE_TIMESTAMP'
X_STALE = EXTERNAL + 'STALE_PURCHASE_REFERENCE'
X_SOURCE_UNAVAILABLE = EXTERNAL + 'EXTERNAL_SOURCE_UNAVAILABLE'
T_SOURCE_UNAVAILABLE = TRANSIENT + 'EXTERNAL_SOURCE_UNAVAILABLE'
@allow_storage
@dataclass
class Protection:
    owner:Address
    market_id:str
    event_bps:u16
    duration_days:u16
    premium:u256
    payout:u256
    reference_price:u256
    trigger_price:u256
    source_timestamp:u64
    purchased_at:u64
    first_settlement_day:u64
    last_settlement_day:u64
    expires_at:u64
    status:str
    breach_date:str
    processed_dates:u16
    inconclusive_dates:u16
    reserve_released:bool
    claimed:bool
    cancellation_timestamp:u64
    cancellation_settlement_date:str
    cancellation_reason:str
@allow_storage
@dataclass
class MarketSettlement:
    market_id:str
    settlement_date:str
    settlement_day:u64
    fxratesapi_price:u256
    fawaz_price:u256
    source_a:str
    source_b:str
    source_a_date:str
    source_b_date:str
    status:str
    finalized:bool
    created_at:u64
def _user_error(code):
    raise gl.vm.UserError(code)
def _address(v,reject_zero=True)->Address:
    if not isinstance(v,str) or len(v) != 42 or not v.startswith('0x'):
        _user_error(E_INVALID_ADDRESS)
    try:
        int(v[2:],16)
        r = Address(v)
    except Exception:
        _user_error(E_INVALID_ADDRESS)
    if reject_zero and int(r.as_hex,16) == 0:
        _user_error(E_INVALID_ADDRESS)
    return r
def _market(m)->tuple:
    if m == 'GBP_USD':
        return ('GBP/USD','CURRENCY','DOWN','GBP',True)
    if m == 'USD_JPY':
        return ('USD/JPY','CURRENCY','UP','JPY',False)
    if m == 'USD_TRY':
        return ('USD/TRY','CURRENCY','UP','TRY',False)
    if m == 'XAU_USD':
        return ('XAU/USD','METAL','DOWN','XAU',True)
    if m == 'XAG_USD':
        return ('XAG/USD','METAL','DOWN','XAG',True)
    _user_error(E_INVALID_MARKET)
def _terms(days,event_bps)->tuple:
    if event_bps not in (200,300,400):
        _user_error(E_INVALID_EVENT)
    if days == 7:
        return GEN,event_bps // 100 * GEN
    if days not in (14,30):
        _user_error(E_INVALID_DURATION)
    premium = (2 if days == 14 else 3) * GEN
    if event_bps == 200:
        multiple = 4 if days == 14 else 6
    elif event_bps == 300:
        multiple = 5 if days == 14 else 8
    else:
        multiple = 6 if days == 14 else 10
    return (premium,multiple * GEN)
def _event_bps_from_percent(event_percent):
    if event_percent not in (2,3,4):
        _user_error(E_INVALID_EVENT)
    return event_percent * 100
def _is_leap(year):
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
def _date_day(v,error_code)->int:
    if len(v) != 10 or v[4] != '-' or v[7] != '-':
        _user_error(error_code)
    try:
        year = int(v[0:4])
        month = int(v[5:7])
        day = int(v[8:10])
    except ValueError:
        _user_error(error_code)
    if not 1970 <= year <= 9999 or not 1 <= month <= 12:
        _user_error(error_code)
    limit = 31
    if month == 2:
        limit = 29 if _is_leap(year) else 28
    elif month in (4,6,9,11):
        limit = 30
    if not 1 <= day <= limit:
        _user_error(error_code)
    adjusted = year - (1 if month <= 2 else 0)
    era = adjusted // 400
    yoe = adjusted - era * 400
    shifted = month + (-3 if month > 2 else 9)
    doy = (153 * shifted + 2) // 5 + day - 1
    return era * 146097 + yoe * 365 + yoe // 4 - yoe // 100 + doy - 719468
def _day_date(n):
    z = n + 719468
    era = z // 146097
    doe = z - era * 146097
    yoe = (doe - doe // 1460 + doe // 36524 - doe // 146096) // 365
    year = yoe + era * 400
    doy = doe - (365 * yoe + yoe // 4 - yoe // 100)
    mp = (5 * doy + 2) // 153
    day = doy - (153 * mp + 2) // 5 + 1
    month = mp + (3 if mp < 10 else -9)
    year += 1 if month <= 2 else 0
    return str(year).zfill(4) + '-' + str(month).zfill(2) + '-' + str(day).zfill(2)
def _iso_timestamp(v,error_code)->int:
    if len(v) < 20 or v[10] != 'T' or v[13] != ':' or v[16] != ':':
        _user_error(error_code)
    suffix = v[19:]
    if suffix.endswith('Z'):
        fraction = suffix[:-1]
    elif suffix.endswith('+00:00'):
        fraction = suffix[:-6]
    else:
        _user_error(error_code)
    if fraction != '' and (not fraction.startswith('.') or len(fraction) < 2 or len(fraction) > 10 or (not fraction[1:].isdigit())):
        _user_error(error_code)
    day_number = _date_day(v[0:10],error_code)
    try:
        hour = int(v[11:13])
        minute = int(v[14:16])
        second = int(v[17:19])
    except ValueError:
        _user_error(error_code)
    if not 0 <= hour <= 23 or not 0 <= minute <= 59 or not 0 <= second <= 59:
        _user_error(error_code)
    return day_number * DAY_SECONDS + hour * 3600 + minute * 60 + second
def _source_calendar_date(raw,error_code)->str:
    if not isinstance(raw,str):
        _user_error(error_code)
    v = raw.strip()
    if len(v) != 10:
        _iso_timestamp(v,error_code)
        v = v[0:10]
    _date_day(v,error_code)
    return v
def _transaction_time():
    return _iso_timestamp(gl.message_raw['datetime'],E_BAD_TX_TIME)
def _source_timestamp(raw)->int:
    if isinstance(raw,bool):
        _user_error(X_BAD_TIMESTAMP)
    if isinstance(raw,int):
        r = raw
    elif isinstance(raw,str):
        clean = raw.strip()
        if clean.isdigit():
            if len(clean) > 12:
                _user_error(X_BAD_TIMESTAMP)
            r = int(clean)
        else:
            r = _iso_timestamp(clean,X_BAD_TIMESTAMP)
    else:
        _user_error(X_BAD_TIMESTAMP)
    if r <= 0:
        _user_error(X_BAD_TIMESTAMP)
    return r
def _decimal_scaled(raw,scale)->int:
    if isinstance(raw,bool):
        _user_error(X_MALFORMED)
    text = str(raw).strip()
    if len(text) == 0 or len(text) > 80 or text[0] == '-':
        _user_error(X_MALFORMED)
    if text[0:1] == '+':
        text = text[1:]
    lower = text.lower()
    exponent = 0
    if 'e' in lower:
        if lower.count('e') != 1:
            _user_error(X_MALFORMED)
        (coefficient,exponent_text) = lower.split('e')
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
    if coefficient.count('.') > 1:
        _user_error(X_MALFORMED)
    if '.' in coefficient:
        (whole,fraction) = coefficient.split('.')
    else:
        (whole,fraction) = (coefficient,'')
    if whole == '':
        whole = '0'
    digits = whole + fraction
    if len(digits) == 0 or len(digits) > 40 or (not digits.isdigit()):
        _user_error(X_MALFORMED)
    significant = int(digits)
    power = exponent - len(fraction)
    if power >= 0:
        r = significant * 10 ** power * scale
    else:
        r = significant * scale // 10 ** (-power)
    if r <= 0:
        _user_error(X_MALFORMED)
    return r
def _normalize_rate(m,raw):
    (_,_,_,_,reciprocal) = _market(m)
    rate = _decimal_scaled(raw,RATE_SCALE)
    if reciprocal:
        r = RATE_SCALE * PRICE_SCALE // rate
    else:
        r = rate * PRICE_SCALE // RATE_SCALE
    if not 0 < r <= MAX_PRICE:
        _user_error(X_MALFORMED)
    return r
def _decode_json(body)->dict:
    if body is None or len(body) == 0 or len(body) > MAX_BODY_BYTES:
        raise gl.vm.UserError(X_MALFORMED)
    try:
        decoded = json.loads(body.decode('utf-8'),parse_float=str,parse_int=str)
    except (ValueError,TypeError,UnicodeError):
        _user_error(X_MALFORMED)
    if not isinstance(decoded,dict):
        _user_error(X_MALFORMED)
    return decoded
def _transient(status):
    return status >= 500 or status <= 0
def _checked_response(url):
    response = gl.nondet.web.get(url)
    if _transient(response.status):
        _user_error(T_SOURCE_UNAVAILABLE)
    if response.status != 200:
        _user_error(X_SOURCE_UNAVAILABLE)
    return _decode_json(response.body)
def _fx_rate(data,m)->int:
    if data.get('success') is False or str(data.get('base','')).upper() != 'USD':
        _user_error(X_MALFORMED)
    rates = data.get('rates')
    if not isinstance(rates,dict):
        _user_error(X_MALFORMED)
    currency = _market(m)[3]
    if currency not in rates:
        _user_error(X_MISSING_RATE)
    return _normalize_rate(m,rates[currency])
def _purchase_result(m,t):
    data = _checked_response(LATEST_URL)
    price = _fx_rate(data,m)
    if 'timestamp' not in data:
        _user_error(X_BAD_TIMESTAMP)
    src_time = _source_timestamp(data['timestamp'])
    src_date = _source_calendar_date(data.get('date'),X_BAD_TIMESTAMP)
    source_day = _date_day(src_date,X_BAD_TIMESTAMP)
    if src_time // DAY_SECONDS != source_day:
        _user_error(X_BAD_TIMESTAMP)
    if src_time > t + MAX_FUTURE_SKEW:
        _user_error(X_BAD_TIMESTAMP)
    if t - src_time > MAX_REFERENCE_AGE:
        _user_error(X_STALE)
    return {'source':'FXRATESAPI_LATEST','market':m,'price':price,'timestamp':src_time,'date':src_date,'status':'VALID'}
def _valid_int(v):
    return isinstance(v,int) and not isinstance(v,bool)
def _valid_price(v):
    return _valid_int(v) and 0 < v <= MAX_PRICE
def _purchase_results_equivalent(leader,validator,t):
    if not isinstance(leader,dict) or not isinstance(validator,dict):
        return False
    for field in ('source','market','status'):
        if leader.get(field) != validator.get(field):
            return False
    if leader.get('source') != 'FXRATESAPI_LATEST' or leader.get('status') != 'VALID':
        return False
    leader_price = leader.get('price')
    validator_price = validator.get('price')
    leader_time = leader.get('timestamp')
    validator_time = validator.get('timestamp')
    if not _valid_price(leader_price) or not _valid_price(validator_price) or not _valid_int(leader_time) or not _valid_int(validator_time):
        return False
    if not isinstance(leader_time,int) or not isinstance(validator_time,int):
        return False
    leader_date = leader.get('date')
    validator_date = validator.get('date')
    if not isinstance(leader_date,str) or not isinstance(validator_date,str):
        return False
    if leader_time // DAY_SECONDS != _date_day(leader_date,X_BAD_TIMESTAMP):
        return False
    if validator_time // DAY_SECONDS != _date_day(validator_date,X_BAD_TIMESTAMP):
        return False
    for src_time in (leader_time,validator_time):
        if not isinstance(src_time,int):
            return False
        if src_time > t + MAX_FUTURE_SKEW:
            return False
        if t - src_time > MAX_REFERENCE_AGE:
            return False
    if abs(int(leader_time) - int(validator_time)) > LATEST_EQ_TIMESTAMP_WINDOW:
        return False
    price_difference = abs(int(leader_price) - int(validator_price))
    lower_price = min(int(leader_price),int(validator_price))
    return price_difference * BPS_SCALE <= lower_price * LATEST_EQ_PRICE_TOLERANCE_BPS
def _historical_fx_result(m,d,today)->dict:
    url = FX_HISTORICAL_PREFIX + d + FX_HISTORICAL_SUFFIX
    response = gl.nondet.web.get(url)
    if _transient(response.status):
        _user_error(T_SOURCE_UNAVAILABLE)
    if response.status != 200:
        if _date_day(d,X_MALFORMED) == today:
            _user_error(T_SOURCE_UNAVAILABLE)
        _user_error(X_SOURCE_UNAVAILABLE)
    data = _decode_json(response.body)
    src_date = _source_calendar_date(data.get('date'),X_MALFORMED)
    if src_date != d:
        _user_error(X_MALFORMED)
    return {'price':_fx_rate(data,m),'date':src_date,'source':'FXRATESAPI_HISTORICAL'}
def _parse_fawaz(data,m,d):
    src_date = _source_calendar_date(data.get('date'),X_MALFORMED)
    if src_date != d:
        _user_error(X_MALFORMED)
    rates = data.get('usd')
    if not isinstance(rates,dict):
        _user_error(X_MALFORMED)
    currency = _market(m)[3].lower()
    if currency not in rates:
        _user_error(X_MISSING_RATE)
    return {'price':_normalize_rate(m,rates[currency]),'date':src_date}
def _fawaz_result(m,d,today)->dict:
    primary_url = FAWAZ_JSDELIVR_PREFIX + d + FAWAZ_JSDELIVR_SUFFIX
    fallback_url = 'https://' + d + FAWAZ_PAGES_SUFFIX
    primary = gl.nondet.web.get(primary_url)
    primary_transient = _transient(primary.status)
    if primary.status == 200:
        try:
            parsed = _parse_fawaz(_decode_json(primary.body),m,d)
            parsed['source'] = 'FAWAZ'
            parsed['delivery'] = 'JSDELIVR'
            return parsed
        except gl.vm.UserError:
            pass
    fallback = gl.nondet.web.get(fallback_url)
    if fallback.status == 200:
        parsed = _parse_fawaz(_decode_json(fallback.body),m,d)
        parsed['source'] = 'FAWAZ'
        parsed['delivery'] = 'PAGES_FALLBACK'
        return parsed
    if primary_transient or _transient(fallback.status):
        _user_error(T_SOURCE_UNAVAILABLE)
    if _date_day(d,X_MALFORMED) == today:
        _user_error(T_SOURCE_UNAVAILABLE)
    _user_error(X_SOURCE_UNAVAILABLE)
def _market_settlement_result(m,d,today):
    source_a = _historical_fx_result(m,d,today)
    source_b = _fawaz_result(m,d,today)
    return {'market':m,'settlement_date':d,'source_a_price':source_a['price'],'source_b_price':source_b['price'],'source_a':source_a['source'],'source_b':source_b['source'],'source_a_date':source_a['date'],'source_b_date':source_b['date'],'status':'VALID'}
def _error_equivalent(leader,operation):
    leader_message = getattr(leader,'message','')
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
def _purchase_consensus(m,t):
    def leader():
        return _purchase_result(m,t)
    def validator(lead):
        if not isinstance(lead,gl.vm.Return):
            return _error_equivalent(lead,leader)
        try:
            fetched = leader()
            return _purchase_results_equivalent(lead.calldata,fetched,t)
        except gl.vm.UserError:
            return False
    return gl.vm.run_nondet_unsafe(leader,validator)
def _market_settlement_consensus(m,d,today):
    def leader():
        return _market_settlement_result(m,d,today)
    def validator(lead):
        if not isinstance(lead,gl.vm.Return):
            return _error_equivalent(lead,leader)
        try:
            fetched = leader()
        except gl.vm.UserError:
            return False
        return fetched == lead.calldata
    return gl.vm.run_nondet_unsafe(leader,validator)
def _trigger(reference_price,event_bps,direction):
    if not 0 < reference_price <= MAX_PRICE:
        _user_error(X_MALFORMED)
    if event_bps not in (200,300,400):
        _user_error(E_INVALID_EVENT)
    if direction == 'DOWN':
        return reference_price * (BPS_SCALE - event_bps) // BPS_SCALE
    return reference_price * (BPS_SCALE + event_bps) // BPS_SCALE
def _market_settlement_key(m,d):
    return m + '|' + d
def _protection_settlement_key(i,d):
    return str(i) + '|' + d
def _versioned_settlement_key(k,v):
    return k if v <= 1 else k + '|v' + str(v)
class AegisProtection(gl.Contract):
    owner:Address
    pool_balance:u256
    reserved_liability:u256
    protection_count:u256
    paused:bool
    protections:TreeMap[u256,Protection]
    owner_counts:TreeMap[Address,u256]
    owner_protection_ids:TreeMap[str,u256]
    market_settlements:TreeMap[str,MarketSettlement]
    protection_settlement_results:TreeMap[str,str]
    settlement_versions:TreeMap[str,u16]
    settlement_retryable:TreeMap[str,bool]
    protection_settlement_versions:TreeMap[str,u16]
    active_protections:u256
    claimable_protections:u256
    expired_protections:u256
    claimed_protections:u256
    total_premiums_collected:u256
    total_payouts_paid:u256
    owner_active_counts:TreeMap[Address,u256]
    owner_claimable_counts:TreeMap[Address,u256]
    owner_expired_counts:TreeMap[Address,u256]
    owner_claimed_counts:TreeMap[Address,u256]
    owner_premiums_paid:TreeMap[Address,u256]
    owner_claimable_payouts:TreeMap[Address,u256]
    owner_payouts_received:TreeMap[Address,u256]
    settlement_operators:TreeMap[Address,bool]
    settlement_operator_addresses:TreeMap[u32,Address]
    settlement_operator_indexes:TreeMap[Address,u16]
    settlement_operator_count:u16
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
        self.settlement_operator_count = u16(0)
    def _available(self):
        if int(self.reserved_liability) > int(self.pool_balance):
            _user_error(E_INVARIANT)
        return int(self.pool_balance) - int(self.reserved_liability)
    def _only_owner(self):
        if gl.message.sender_address != self.owner:
            _user_error(E_UNAUTHORIZED)
    def _authorized(self,protection_owner):
        caller = gl.message.sender_address
        return caller == self.owner or caller == protection_owner or self.settlement_operators.get(caller,False)
    def _protection(self,pid):
        p = self.protections.get(u256(pid))
        if p is None:
            raise gl.vm.UserError(E_NOT_FOUND)
        return p
    def _current_market_settlement(self,base_key):
        ver = int(self.settlement_versions.get(base_key,u16(0)))
        if ver == 0 and self.market_settlements.get(base_key) is not None:
            ver = 1
        return (self.market_settlements.get(_versioned_settlement_key(base_key,ver)),ver)
    def _next_unresolved_date(self,pid,p):
        for offset in range(int(p.duration_days)):
            date = _day_date(int(p.first_settlement_day) + offset)
            v = self.protection_settlement_results.get(_protection_settlement_key(int(pid),date),'UNPROCESSED')
            if v == 'UNPROCESSED' or v == 'INCONCLUSIVE':
                return date
        return ''
    def _protection_card(self,pid,p):
        (symbol,category,direction,_,_) = _market(p.market_id)
        processed = int(p.processed_dates)
        dur = int(p.duration_days)
        return {'id':pid,'owner':p.owner.as_hex,'market_id':p.market_id,'symbol':symbol,'category':category,'direction':direction,'status':p.status,'duration_days':dur,'event_percent':int(p.event_bps) // 100,'event_bps':int(p.event_bps),'premium':int(p.premium),'payout':int(p.payout),'reference_price':int(p.reference_price),'trigger_price':int(p.trigger_price),'source_timestamp':int(p.source_timestamp),'purchased_at':int(p.purchased_at),'first_settlement_day':int(p.first_settlement_day),'last_settlement_day':int(p.last_settlement_day),'expires_at':int(p.expires_at),'processed_dates':processed,'inconclusive_dates':int(p.inconclusive_dates),'remaining_dates':max(dur - processed,0) if p.status == 'ACTIVE' else 0,'breach_date':p.breach_date,'claimable':p.status == 'CLAIMABLE','claimed':p.claimed,'reserve_released':p.reserve_released,'cancellation_timestamp':int(p.cancellation_timestamp),'cancellation_settlement_date':p.cancellation_settlement_date,'cancellation_reason':p.cancellation_reason}
    def _mark_claimable(self,p,date):
        active = int(self.active_protections)
        owner_active = int(self.owner_active_counts.get(p.owner,u256(0)))
        if p.status != 'ACTIVE' or active <= 0 or owner_active <= 0:
            _user_error(E_INVARIANT)
        payout = int(p.payout)
        self.active_protections = u256(active - 1)
        self.claimable_protections = u256(int(self.claimable_protections) + 1)
        self.owner_active_counts[p.owner] = u256(owner_active - 1)
        self.owner_claimable_counts[p.owner] = u256(int(self.owner_claimable_counts.get(p.owner,u256(0))) + 1)
        self.owner_claimable_payouts[p.owner] = u256(int(self.owner_claimable_payouts.get(p.owner,u256(0))) + payout)
        p.status = 'CLAIMABLE'
        p.breach_date = date
    def _release_expired(self,p):
        if p.reserve_released:
            _user_error(E_RESERVE_RELEASED)
        payout = int(p.payout)
        active = int(self.active_protections)
        owner_active = int(self.owner_active_counts.get(p.owner,u256(0)))
        if p.status != 'ACTIVE' or payout > int(self.reserved_liability) or active <= 0 or (owner_active <= 0):
            _user_error(E_INVARIANT)
        self.reserved_liability = u256(int(self.reserved_liability) - payout)
        self.active_protections = u256(active - 1)
        self.expired_protections = u256(int(self.expired_protections) + 1)
        self.owner_active_counts[p.owner] = u256(owner_active - 1)
        self.owner_expired_counts[p.owner] = u256(int(self.owner_expired_counts.get(p.owner,u256(0))) + 1)
        p.reserve_released = True
        p.status = 'EXPIRED'
    def _expire_if_complete(self,p):
        if p.status == 'ACTIVE' and int(p.processed_dates) == int(p.duration_days) and (int(p.inconclusive_dates) == 0):
            self._release_expired(p)
    def _terminal_cancellation_readiness(self,pid,p,today):
        unresolved = self._next_unresolved_date(pid,p)
        settlement_day = _date_day(unresolved,E_INVALID_DATE) if unresolved else 0
        eligible = p.status == 'ACTIVE' and unresolved != '' and today > settlement_day + TERMINAL_GRACE_DAYS
        if p.status != 'ACTIVE':
            reason = 'PROTECTION_NOT_ACTIVE'
        elif unresolved == '':
            reason = 'NO_UNRESOLVED_DATE'
        elif not eligible:
            reason = 'GRACE_PERIOD_ACTIVE'
        else:
            reason = 'READY'
        return {'protection_id':pid,'eligible':eligible,'reason_code':reason,'earliest_unresolved_date':unresolved,'terminal_grace_days':TERMINAL_GRACE_DAYS,'terminal_eligible_date':_day_date(settlement_day + TERMINAL_GRACE_DAYS + 1) if unresolved else '','current_utc_day':today,'protection_status':p.status}
    @gl.public.view
    def get_config(self) -> dict:
        return {'contract':'AegisProtection','version':VERSION,'price_scale':PRICE_SCALE,'gen_unit':GEN,'max_payout':10 * GEN,'purchase_reference':'FXRatesAPI','settlement_sources':'FXRatesAPI+Fawaz','max_reference_age_seconds':MAX_REFERENCE_AGE,'latest_consensus_timestamp_window_seconds':LATEST_EQ_TIMESTAMP_WINDOW,'latest_consensus_price_tolerance_bps':LATEST_EQ_PRICE_TOLERANCE_BPS,'stale_reference_behavior':'PURCHASE_UNAVAILABLE','purchase_reference_statement':'Reference price fetched from FXRatesAPI and independently confirmed by GenLayer validators.'}
    @gl.public.view
    def get_supported_markets(self) -> list[dict]:
        out = []
        for market_id in ('GBP_USD','USD_JPY','USD_TRY','XAU_USD','XAG_USD'):
            (symbol,category,direction,_,_) = _market(market_id)
            out.append({'market_id':market_id,'symbol':symbol,'category':category,'direction':direction})
        return out
    @gl.public.view
    def get_market(self,market_id:str) -> dict:
        (symbol,category,direction,currency,reciprocal) = _market(market_id)
        return {'market_id':market_id,'symbol':symbol,'category':category,'direction':direction,'usd_base_currency':currency,'reciprocal':reciprocal}
    @gl.public.view
    def get_product_terms(self) -> list[dict]:
        out = []
        for dur in (7,14,30):
            for event_percent in (2,3,4):
                event_bps = event_percent * 100
                (premium,payout) = _terms(dur,event_bps)
                out.append({'duration_days':dur,'event_percent':event_percent,'event_bps':event_bps,'premium':premium,'payout':payout})
        return out
    @gl.public.view
    def quote_protection(self,duration_days:u16,event_percent:u16) -> dict:
        event_bps = _event_bps_from_percent(int(event_percent))
        (premium,payout) = _terms(int(duration_days),event_bps)
        return {'premium':premium,'payout':payout}
    @gl.public.view
    def preview_trigger(self,market_id:str,event_percent:u16,normalized_reference:u256) -> u256:
        direction = _market(market_id)[2]
        event_bps = _event_bps_from_percent(int(event_percent))
        return u256(_trigger(int(normalized_reference),event_bps,direction))
    @gl.public.view
    def get_pool_state(self) -> dict:
        return self._pool_state()
    def _pool_state(self):
        return {'pool_balance':int(self.pool_balance),'reserved_liability':int(self.reserved_liability),'available_liquidity':self._available()}
    @gl.public.view
    def available_liquidity(self) -> u256:
        return u256(self._available())
    @gl.public.view
    def get_protocol_stats(self) -> dict:
        out = self._pool_state()
        out.update({'total_protections':int(self.protection_count),'active_protections':int(self.active_protections),'claimable_protections':int(self.claimable_protections),'expired_protections':int(self.expired_protections),'claimed_protections':int(self.claimed_protections),'total_premiums_collected':int(self.total_premiums_collected),'total_payouts_paid':int(self.total_payouts_paid),'purchases_paused':self.paused})
        return out
    @gl.public.view
    def get_my_dashboard_summary(self,account_hex:str) -> dict:
        account = _address(account_hex)
        return {'account':account.as_hex,'total_protections':int(self.owner_counts.get(account,u256(0))),'active_count':int(self.owner_active_counts.get(account,u256(0))),'claimable_count':int(self.owner_claimable_counts.get(account,u256(0))),'expired_count':int(self.owner_expired_counts.get(account,u256(0))),'claimed_count':int(self.owner_claimed_counts.get(account,u256(0))),'total_premiums_paid':int(self.owner_premiums_paid.get(account,u256(0))),'total_claimable_payout':int(self.owner_claimable_payouts.get(account,u256(0))),'total_payouts_received':int(self.owner_payouts_received.get(account,u256(0)))}
    @gl.public.view
    def get_protection(self,protection_id:u256) -> dict:
        protection_number = int(protection_id)
        return self._protection_card(protection_number,self._protection(protection_number))
    @gl.public.view
    def get_protection_count(self) -> u256:
        return self.protection_count
    @gl.public.view
    def get_owned_protection_count(self,account_hex:str) -> u256:
        account = _address(account_hex)
        return self.owner_counts.get(account,u256(0))
    def _owned_protection_ids(self,account:Address,start:u256,limit:u16) -> list[u256]:
        count = int(self.owner_counts.get(account,u256(0)))
        first = int(start)
        size = int(limit)
        if size <= 0 or size > MAX_PAGE_SIZE or first > count:
            _user_error(E_BAD_PAGE)
        end = min(first + size,count)
        prefix = account.as_hex + '|'
        out = []
        for index in range(first,end):
            out.append(self.owner_protection_ids[prefix + str(index)])
        return out
    @gl.public.view
    def get_owned_protection_ids(self,account_hex:str,start:u256,limit:u16) -> list[u256]:
        return self._owned_protection_ids(_address(account_hex),start,limit)
    @gl.public.view
    def get_my_protections(self,account_hex:str,start:u256,limit:u16) -> list[dict]:
        account = _address(account_hex)
        out = []
        for stored_id in self._owned_protection_ids(account,start,limit):
            protection_id = int(stored_id)
            out.append(self._protection_card(protection_id,self._protection(protection_id)))
        return out
    @gl.public.view
    def get_market_settlement(self,market_id:str,settlement_date:str) -> dict:
        _market(market_id)
        _date_day(settlement_date,E_INVALID_DATE)
        key = _market_settlement_key(market_id,settlement_date)
        (s,ver) = self._current_market_settlement(key)
        if s is None:
            raise gl.vm.UserError(E_SETTLEMENT_MISSING)
        return {'market_id':s.market_id,'settlement_date':s.settlement_date,'settlement_day':int(s.settlement_day),'fxratesapi_price':int(s.fxratesapi_price),'fawaz_price':int(s.fawaz_price),'source_a':s.source_a,'source_b':s.source_b,'source_a_date':s.source_a_date,'source_b_date':s.source_b_date,'status':s.status,'finalized':s.finalized,'created_at':int(s.created_at),'version':ver,'retryable':self.settlement_retryable.get(key,False)}
    @gl.public.view
    def get_protection_settlement_result(self,protection_id:u256,settlement_date:str) -> str:
        self._protection(int(protection_id))
        return self.protection_settlement_results.get(_protection_settlement_key(int(protection_id),settlement_date),'UNPROCESSED')
    @gl.public.view
    def get_protection_settlement_version(self,protection_id:u256,settlement_date:str) -> u16:
        self._protection(int(protection_id))
        return self.protection_settlement_versions.get(_protection_settlement_key(int(protection_id),settlement_date),u16(0))
    @gl.public.view
    def get_protection_details(self,protection_id:u256) -> dict:
        pid = int(protection_id)
        p = self._protection(pid)
        out = self._protection_card(pid,p)
        (latest,ver,unresolved) = ('UNPROCESSED',0,'')
        for offset in range(int(p.duration_days)):
            date = _day_date(int(p.first_settlement_day) + offset)
            key = _protection_settlement_key(pid,date)
            v = self.protection_settlement_results.get(key,'UNPROCESSED')
            if v != 'UNPROCESSED':
                latest = v
                ver = int(self.protection_settlement_versions.get(key,u16(0)))
            if p.status == 'ACTIVE' and unresolved == '' and (v in ('UNPROCESSED','INCONCLUSIVE')):
                unresolved = date
        out.update({'first_settlement_date':_day_date(int(p.first_settlement_day)),'last_settlement_date':_day_date(int(p.last_settlement_day)),'next_unresolved_settlement_date':unresolved,'latest_settlement_result':latest,'latest_market_settlement_version_used':ver,'can_claim':p.status == 'CLAIMABLE' and (not p.claimed),'expired':p.status == 'EXPIRED','reserve_status':'RELEASED' if p.reserve_released else 'RESERVED'})
        return out
    @gl.public.view
    def get_settlement_readiness(self,protection_id:u256,settlement_date:str) -> dict:
        pid = int(protection_id)
        p = self._protection(pid)
        today = _transaction_time() // DAY_SECONDS
        valid = True
        try:
            day = _date_day(settlement_date,E_INVALID_DATE)
        except gl.vm.UserError:
            day = 0
            valid = False
        rkey = _protection_settlement_key(pid,settlement_date)
        previous = self.protection_settlement_results.get(rkey,'UNPROCESSED')
        key = _market_settlement_key(p.market_id,settlement_date)
        (s,ver) = self._current_market_settlement(key)
        future = valid and day > today
        completed = valid and day < today
        inside = valid and (day >= int(p.first_settlement_day) and day <= int(p.last_settlement_day))
        earliest = self._next_unresolved_date(pid,p) if valid and inside else ''
        retryable = self.settlement_retryable.get(key,False)
        ready = False
        if not valid:
            reason = 'INVALID_SETTLEMENT_DATE'
        elif not completed:
            reason = 'SETTLEMENT_DAY_NOT_COMPLETE'
        elif not inside:
            reason = 'INVALID_SETTLEMENT_DATE'
        elif previous == 'BREACHED' or previous == 'NOT_BREACHED':
            reason = 'DATE_ALREADY_SETTLED'
        elif p.status == 'CLAIMABLE':
            reason = 'PROTECTION_CLAIMABLE'
        elif p.status == 'EXPIRED':
            reason = 'PROTECTION_EXPIRED'
        elif p.status != 'ACTIVE':
            reason = 'PROTECTION_NOT_ACTIVE'
        elif earliest != settlement_date:
            reason = 'SETTLEMENT_ORDER'
        elif previous == 'INCONCLUSIVE' and retryable:
            ready = True
            reason = 'MARKET_SETTLEMENT_RETRYABLE'
        elif s is not None and s.finalized:
            ready = True
            reason = 'MARKET_SETTLEMENT_AVAILABLE'
        else:
            ready = True
            reason = 'READY'
        return {'protection_id':pid,'market_id':p.market_id,'settlement_date':settlement_date,'settlement_day':day,'current_utc_day':today,'inside_protection_window':inside,'is_future_date':future,'protection_status':p.status,'previous_result':previous,'market_settlement_exists':s is not None,'market_settlement_finalized':s is not None and s.finalized,'market_settlement_version':ver,'retryable':retryable,'ready':ready,'reason_code':reason}
    @gl.public.view
    def get_terminal_cancellation_readiness(self,protection_id:u256) -> dict:
        pid = int(protection_id)
        p = self._protection(pid)
        return self._terminal_cancellation_readiness(pid,p,_transaction_time() // DAY_SECONDS)
    @gl.public.view
    def get_settlement_history(self,protection_id:u256,start:u256,limit:u16) -> list[dict]:
        pid = int(protection_id)
        p = self._protection(pid)
        (dur,first,size) = (int(p.duration_days),int(start),int(limit))
        if size <= 0 or size > MAX_PAGE_SIZE or first > dur:
            _user_error(E_BAD_PAGE)
        out = []
        for offset in range(first,min(first + size,dur)):
            date = _day_date(int(p.first_settlement_day) + offset)
            rkey = _protection_settlement_key(pid,date)
            v = self.protection_settlement_results.get(rkey,'UNPROCESSED')
            used = int(self.protection_settlement_versions.get(rkey,u16(0)))
            key = _market_settlement_key(p.market_id,date)
            ver = used
            s = self.market_settlements.get(_versioned_settlement_key(key,ver)) if ver > 0 else None
            out.append({'protection_id':pid,'market_id':p.market_id,'settlement_date':date,'result':v,'processed':v != 'UNPROCESSED','market_settlement_exists':s is not None,'market_settlement_version':ver,'fxratesapi_price':int(s.fxratesapi_price) if s else 0,'fawaz_price':int(s.fawaz_price) if s else 0,'trigger_price':int(p.trigger_price),'source_a_date':s.source_a_date if s else '','source_b_date':s.source_b_date if s else '','settled_at':int(s.created_at) if s else 0,'retryable':self.settlement_retryable.get(key,False)})
        return out
    @gl.public.view
    def is_settlement_operator(self,operator_hex:str) -> bool:
        operator = _address(operator_hex)
        return self.settlement_operators.get(operator,False)
    @gl.public.view
    def get_settlement_operator_count(self) -> u16:
        return self.settlement_operator_count
    @gl.public.view
    def get_settlement_operator_at(self,index:u16) -> str:
        i = int(index)
        if i < 0 or i >= int(self.settlement_operator_count):
            _user_error(E_INVALID_OPERATOR_INDEX)
        return self.settlement_operator_addresses[u32(i)].as_hex
    @gl.public.view
    def get_settlement_operators(self) -> list[str]:
        return [self.settlement_operator_addresses[u32(i)].as_hex for i in range(int(self.settlement_operator_count))]
    @gl.public.view
    def can_settle_protection(self,caller_hex:str,protection_id:u256) -> dict:
        caller = _address(caller_hex)
        p = self._protection(int(protection_id))
        owner = caller == self.owner
        operator = self.settlement_operators.get(caller,False)
        protection_owner = caller == p.owner
        return {'authorized':owner or operator or protection_owner,'is_contract_owner':owner,'is_operator':operator,'is_protection_owner':protection_owner}
    @gl.public.view
    def purchases_paused(self) -> bool:
        return self.paused
    @gl.public.write.payable
    def add_pool_funds(self) -> None:
        self._only_owner()
        amount = int(gl.message.value)
        if amount <= 0:
            _user_error(E_ZERO_AMOUNT)
        self.pool_balance = u256(int(self.pool_balance) + amount)
    @gl.public.write
    def withdraw_unreserved_gen(self,amount_gen:u256) -> None:
        self._only_owner()
        whole_gen = int(amount_gen)
        if whole_gen <= 0:
            _user_error(E_ZERO_AMOUNT)
        if whole_gen > (2 ** 256 - 1) // GEN:
            _user_error(E_ZERO_AMOUNT)
        amount_native = whole_gen * GEN
        if amount_native > self._available():
            _user_error(E_NO_UNRESERVED)
        self.pool_balance = u256(int(self.pool_balance) - amount_native)
        gl.get_contract_at(self.owner).emit_transfer(value=u256(amount_native),on='finalized')
    @gl.public.write
    def add_settlement_operator(self,operator_hex:str) -> None:
        self._only_owner()
        operator = _address(operator_hex,False)
        if int(operator.as_hex,16) == 0 or operator == self.owner:
            _user_error(E_INVALID_OPERATOR)
        if self.settlement_operators.get(operator,False):
            _user_error(E_OPERATOR_EXISTS)
        count = int(self.settlement_operator_count)
        if count >= 5:
            _user_error(E_OPERATOR_LIMIT)
        self.settlement_operator_addresses[u32(count)] = operator
        self.settlement_operator_indexes[operator] = u16(count + 1)
        self.settlement_operators[operator] = True
        self.settlement_operator_count = u16(count + 1)
    @gl.public.write
    def remove_settlement_operator(self,operator_hex:str) -> None:
        self._only_owner()
        operator = _address(operator_hex,False)
        if not self.settlement_operators.get(operator,False):
            _user_error(E_OPERATOR_MISSING)
        count = int(self.settlement_operator_count)
        position = int(self.settlement_operator_indexes.get(operator,u16(0))) - 1
        last = count - 1
        if position < 0 or position > last:
            _user_error(E_INVARIANT)
        if position != last:
            moved = self.settlement_operator_addresses[u32(last)]
            self.settlement_operator_addresses[u32(position)] = moved
            self.settlement_operator_indexes[moved] = u16(position + 1)
        del self.settlement_operator_addresses[u32(last)]
        del self.settlement_operator_indexes[operator]
        del self.settlement_operators[operator]
        self.settlement_operator_count = u16(last)
    @gl.public.write.payable
    def purchase_protection(self,market_id:str,duration_days:u16,event_percent:u16) -> u256:
        if self.paused:
            _user_error(E_PAUSED)
        direction = _market(market_id)[2]
        dur = int(duration_days)
        event = _event_bps_from_percent(int(event_percent))
        (premium,payout) = _terms(dur,event)
        if int(gl.message.value) != premium:
            _user_error(E_INVALID_PREMIUM)
        if self._available() + premium < payout:
            _user_error(E_NO_LIQUIDITY)
        now = _transaction_time()
        reference = _purchase_consensus(market_id,now)
        reference_price = int(reference['price'])
        trigger_price = _trigger(reference_price,event,direction)
        purchase_day = now // DAY_SECONDS
        first_day = purchase_day + 1
        last_day = purchase_day + dur
        expires_at = (last_day + 1) * DAY_SECONDS
        protection_id = int(self.protection_count)
        buyer = gl.message.sender_address
        self.protections[u256(protection_id)] = Protection(owner=buyer,market_id=market_id,event_bps=u16(event),duration_days=u16(dur),premium=u256(premium),payout=u256(payout),reference_price=u256(reference_price),trigger_price=u256(trigger_price),source_timestamp=u64(int(reference['timestamp'])),purchased_at=u64(now),first_settlement_day=u64(first_day),last_settlement_day=u64(last_day),expires_at=u64(expires_at),status='ACTIVE',breach_date='',processed_dates=u16(0),inconclusive_dates=u16(0),reserve_released=False,claimed=False,cancellation_timestamp=u64(0),cancellation_settlement_date='',cancellation_reason='')
        owner_index = int(self.owner_counts.get(buyer,u256(0)))
        self.owner_protection_ids[buyer.as_hex + '|' + str(owner_index)] = u256(protection_id)
        self.owner_counts[buyer] = u256(owner_index + 1)
        self.protection_count = u256(protection_id + 1)
        self.active_protections = u256(int(self.active_protections) + 1)
        self.total_premiums_collected = u256(int(self.total_premiums_collected) + premium)
        self.owner_active_counts[buyer] = u256(int(self.owner_active_counts.get(buyer,u256(0))) + 1)
        self.owner_premiums_paid[buyer] = u256(int(self.owner_premiums_paid.get(buyer,u256(0))) + premium)
        self.pool_balance = u256(int(self.pool_balance) + premium)
        self.reserved_liability = u256(int(self.reserved_liability) + payout)
        if int(self.reserved_liability) > int(self.pool_balance):
            _user_error(E_INVARIANT)
        return u256(protection_id)
    @gl.public.write
    def terminal_cancel_protection(self,protection_id:u256) -> None:
        pid = int(protection_id)
        p = self._protection(pid)
        if not self._authorized(p.owner):
            _user_error(E_UNAUTHORIZED)
        if p.status != 'ACTIVE':
            _user_error(E_NOT_ACTIVE)
        now = _transaction_time()
        readiness = self._terminal_cancellation_readiness(pid,p,now // DAY_SECONDS)
        if not readiness['eligible']:
            _user_error(E_TERMINAL_NOT_READY)
        payout = int(p.payout)
        premium = int(p.premium)
        active = int(self.active_protections)
        owner_active = int(self.owner_active_counts.get(p.owner,u256(0)))
        if p.reserve_released or payout > int(self.reserved_liability) or premium > int(self.pool_balance) or active <= 0 or owner_active <= 0:
            _user_error(E_INVARIANT)
        self.reserved_liability = u256(int(self.reserved_liability) - payout)
        self.pool_balance = u256(int(self.pool_balance) - premium)
        self.active_protections = u256(active - 1)
        self.owner_active_counts[p.owner] = u256(owner_active - 1)
        p.reserve_released = True
        p.status = 'CANCELLED'
        p.cancellation_timestamp = u64(now)
        p.cancellation_settlement_date = readiness['earliest_unresolved_date']
        p.cancellation_reason = 'DATA_UNAVAILABLE_OR_CONFLICTING'
        if int(self.reserved_liability) > int(self.pool_balance):
            _user_error(E_INVARIANT)
        gl.get_contract_at(p.owner).emit_transfer(value=u256(premium),on='finalized')
    @gl.public.write
    def settle_protection(self,protection_id:u256,settlement_date:str) -> str:
        pid = int(protection_id)
        p = self._protection(pid)
        if not self._authorized(p.owner):
            _user_error(E_UNAUTHORIZED)
        now = _transaction_time()
        settlement_day = _date_day(settlement_date,E_INVALID_DATE)
        if settlement_day >= now // DAY_SECONDS:
            _user_error(E_INVALID_DATE)
        if settlement_day < int(p.first_settlement_day) or settlement_day > int(p.last_settlement_day):
            _user_error(E_INVALID_DATE)
        rkey = _protection_settlement_key(pid,settlement_date)
        previous = self.protection_settlement_results.get(rkey)
        if previous == 'BREACHED':
            return previous
        if previous == 'NOT_BREACHED':
            self._expire_if_complete(p)
            return previous
        if p.status != 'ACTIVE':
            _user_error(E_NOT_ACTIVE)
        if self._next_unresolved_date(pid,p) != settlement_date:
            _user_error(E_INVALID_DATE)
        skey = _market_settlement_key(p.market_id,settlement_date)
        (settlement,ver) = self._current_market_settlement(skey)
        prior_version = int(self.protection_settlement_versions.get(rkey,u16(0)))
        create_version = settlement is None
        if previous == 'INCONCLUSIVE' and ver <= prior_version:
            if not self.settlement_retryable.get(skey,False):
                return previous
            create_version = True
        if create_version:
            if ver >= 65535:
                _user_error(E_SETTLEMENT_EXISTS)
            ver += 1
            consensus = _market_settlement_consensus(p.market_id,settlement_date,now // DAY_SECONDS)
            settlement = MarketSettlement(market_id=p.market_id,settlement_date=settlement_date,settlement_day=u64(settlement_day),fxratesapi_price=u256(int(consensus['source_a_price'])),fawaz_price=u256(int(consensus['source_b_price'])),source_a=str(consensus['source_a']),source_b=str(consensus['source_b']),source_a_date=str(consensus['source_a_date']),source_b_date=str(consensus['source_b_date']),status='FINALIZED',finalized=True,created_at=u64(now))
            self.market_settlements[_versioned_settlement_key(skey,ver)] = settlement
            self.settlement_versions[skey] = u16(ver)
            self.settlement_retryable[skey] = False
        if settlement is None or not settlement.finalized:
            raise gl.vm.UserError(E_SETTLEMENT_MISSING)
        trigger_price = int(p.trigger_price)
        direction = _market(p.market_id)[2]
        price_a = int(settlement.fxratesapi_price)
        price_b = int(settlement.fawaz_price)
        if direction == 'DOWN':
            breached_a = price_a <= trigger_price
            breached_b = price_b <= trigger_price
        else:
            breached_a = price_a >= trigger_price
            breached_b = price_b >= trigger_price
        if breached_a and breached_b:
            outcome = 'BREACHED'
        elif not breached_a and (not breached_b):
            outcome = 'NOT_BREACHED'
        else:
            outcome = 'INCONCLUSIVE'
        was_inconclusive = previous == 'INCONCLUSIVE'
        if was_inconclusive and outcome != 'INCONCLUSIVE':
            if int(p.inconclusive_dates) <= 0:
                _user_error(E_INVARIANT)
            p.inconclusive_dates = u16(int(p.inconclusive_dates) - 1)
        if outcome == 'INCONCLUSIVE':
            if not was_inconclusive:
                p.inconclusive_dates = u16(int(p.inconclusive_dates) + 1)
            self.settlement_retryable[skey] = True
        elif outcome == 'BREACHED':
            self._mark_claimable(p,settlement_date)
        else:
            p.processed_dates = u16(int(p.processed_dates) + 1)
        self.protection_settlement_results[rkey] = outcome
        self.protection_settlement_versions[rkey] = u16(ver)
        self._expire_if_complete(p)
        return outcome
    @gl.public.write
    def claim_payout(self,protection_id:u256) -> None:
        p = self._protection(int(protection_id))
        if gl.message.sender_address != p.owner:
            _user_error(E_UNAUTHORIZED)
        if p.claimed:
            _user_error(E_ALREADY_CLAIMED)
        if p.status != 'CLAIMABLE':
            _user_error(E_NOT_CLAIMABLE)
        if p.reserve_released:
            _user_error(E_RESERVE_RELEASED)
        payout = int(p.payout)
        claimable = int(self.claimable_protections)
        owner_claimable = int(self.owner_claimable_counts.get(p.owner,u256(0)))
        owner_claimable_payout = int(self.owner_claimable_payouts.get(p.owner,u256(0)))
        if payout > int(self.pool_balance) or payout > int(self.reserved_liability) or payout > owner_claimable_payout or (claimable <= 0) or (owner_claimable <= 0):
            _user_error(E_INVARIANT)
        p.claimed = True
        p.reserve_released = True
        p.status = 'CLAIMED'
        self.pool_balance = u256(int(self.pool_balance) - payout)
        self.reserved_liability = u256(int(self.reserved_liability) - payout)
        self.claimable_protections = u256(claimable - 1)
        self.claimed_protections = u256(int(self.claimed_protections) + 1)
        self.total_payouts_paid = u256(int(self.total_payouts_paid) + payout)
        self.owner_claimable_counts[p.owner] = u256(owner_claimable - 1)
        self.owner_claimed_counts[p.owner] = u256(int(self.owner_claimed_counts.get(p.owner,u256(0))) + 1)
        self.owner_claimable_payouts[p.owner] = u256(owner_claimable_payout - payout)
        self.owner_payouts_received[p.owner] = u256(int(self.owner_payouts_received.get(p.owner,u256(0))) + payout)
        gl.get_contract_at(p.owner).emit_transfer(value=u256(payout),on='finalized')
    @gl.public.write
    def pause_purchases(self) -> None:
        self._only_owner()
        self.paused = True
    @gl.public.write
    def unpause_purchases(self) -> None:
        self._only_owner()
        self.paused = False
