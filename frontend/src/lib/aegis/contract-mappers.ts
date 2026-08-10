import { isAddress, type Address } from "viem";
import type {
  AegisContractConfig,
  ContractStatus,
  DashboardSummary,
  Duration,
  MarketCategory,
  MarketDetails,
  MarketId,
  MarketSettlement,
  MarketSymbol,
  PoolState,
  ProductTerm,
  ProtectedDirection,
  ProtectionCard,
  ProtectionDetails,
  ProtocolStats,
  SettlementHistoryEntry,
  SettlementAuthorization,
  SettlementReadiness,
  SettlementReadinessCode,
  SettlementResult,
  SupportedMarket,
  Threshold,
} from "./types";

type ContractField =
  | "contract"
  | "version"
  | "price_scale"
  | "gen_unit"
  | "max_payout"
  | "purchase_reference"
  | "settlement_sources"
  | "max_reference_age_seconds"
  | "latest_consensus_timestamp_window_seconds"
  | "latest_consensus_price_tolerance_bps"
  | "stale_reference_behavior"
  | "purchase_reference_statement"
  | "market_id"
  | "symbol"
  | "category"
  | "direction"
  | "usd_base_currency"
  | "reciprocal"
  | "duration_days"
  | "event_percent"
  | "event_bps"
  | "premium"
  | "payout"
  | "pool_balance"
  | "reserved_liability"
  | "available_liquidity"
  | "total_protections"
  | "active_protections"
  | "claimable_protections"
  | "expired_protections"
  | "claimed_protections"
  | "total_premiums_collected"
  | "total_payouts_paid"
  | "purchases_paused"
  | "account"
  | "active_count"
  | "claimable_count"
  | "expired_count"
  | "claimed_count"
  | "total_premiums_paid"
  | "total_claimable_payout"
  | "total_payouts_received"
  | "id"
  | "owner"
  | "status"
  | "reference_price"
  | "trigger_price"
  | "source_timestamp"
  | "purchased_at"
  | "first_settlement_day"
  | "last_settlement_day"
  | "expires_at"
  | "processed_dates"
  | "inconclusive_dates"
  | "remaining_dates"
  | "breach_date"
  | "claimable"
  | "claimed"
  | "reserve_released"
  | "first_settlement_date"
  | "last_settlement_date"
  | "next_unresolved_settlement_date"
  | "latest_settlement_result"
  | "latest_market_settlement_version_used"
  | "can_claim"
  | "expired"
  | "reserve_status"
  | "protection_id"
  | "settlement_date"
  | "settlement_day"
  | "current_utc_day"
  | "inside_protection_window"
  | "is_future_date"
  | "protection_status"
  | "previous_result"
  | "market_settlement_exists"
  | "market_settlement_finalized"
  | "market_settlement_version"
  | "retryable"
  | "ready"
  | "reason_code"
  | "result"
  | "processed"
  | "fxratesapi_price"
  | "fawaz_price"
  | "source_a_date"
  | "source_b_date"
  | "settled_at"
  | "source_a"
  | "source_b"
  | "finalized"
  | "created_at"
  | "authorized"
  | "is_contract_owner"
  | "is_operator"
  | "is_protection_owner";

type ContractRecord = Record<string, unknown> & Partial<Record<ContractField, unknown>>;

function record(value: unknown, label: string): ContractRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`CONTRACT_RESPONSE_PARSE_FAILED: ${label} is not an object.`);
  }
  return value as ContractRecord;
}

function string(value: unknown, label: string) {
  if (typeof value !== "string") {
    throw new Error(`CONTRACT_RESPONSE_PARSE_FAILED: ${label} is not a string.`);
  }
  return value;
}

function boolean(value: unknown, label: string) {
  if (typeof value !== "boolean") {
    throw new Error(`CONTRACT_RESPONSE_PARSE_FAILED: ${label} is not a boolean.`);
  }
  return value;
}

export function contractBigInt(value: unknown, label = "contract integer"): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return BigInt(value.trim());
  throw new Error(`CONTRACT_RESPONSE_PARSE_FAILED: ${label} is not an exact integer.`);
}

function literal<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  const parsed = string(value, label) as T;
  if (!allowed.includes(parsed)) {
    throw new Error(`CONTRACT_RESPONSE_PARSE_FAILED: unsupported ${label} ${parsed}.`);
  }
  return parsed;
}

function address(value: unknown, label: string): Address {
  const parsed = string(value, label);
  if (!isAddress(parsed)) {
    throw new Error(`CONTRACT_RESPONSE_PARSE_FAILED: ${label} is not an address.`);
  }
  return parsed;
}

const MARKET_IDS = ["GBP_USD", "USD_JPY", "USD_TRY", "XAU_USD", "XAG_USD"] as const;
const SYMBOLS = ["GBP/USD", "USD/JPY", "USD/TRY", "XAU/USD", "XAG/USD"] as const;
const CATEGORIES = ["CURRENCY", "METAL"] as const;
const DIRECTIONS = ["DOWN", "UP"] as const;
const DURATIONS = [7n, 14n, 30n] as const;
const THRESHOLDS = [2n, 3n, 4n] as const;
const STATUSES = ["ACTIVE", "CLAIMABLE", "EXPIRED", "CLAIMED"] as const;
const RESULTS = ["UNPROCESSED", "BREACHED", "NOT_BREACHED", "INCONCLUSIVE"] as const;
const READINESS_CODES = [
  "INVALID_SETTLEMENT_DATE",
  "FUTURE_SETTLEMENT_DATE",
  "SETTLEMENT_DAY_NOT_COMPLETE",
  "SETTLEMENT_ORDER",
  "DATE_ALREADY_SETTLED",
  "PROTECTION_CLAIMABLE",
  "PROTECTION_EXPIRED",
  "PROTECTION_NOT_ACTIVE",
  "MARKET_SETTLEMENT_RETRYABLE",
  "MARKET_SETTLEMENT_AVAILABLE",
  "READY",
] as const;

function duration(value: unknown): Duration {
  const parsed = contractBigInt(value, "duration_days");
  if (!DURATIONS.includes(parsed as (typeof DURATIONS)[number]))
    throw new Error("INVALID_DURATION");
  return Number(parsed) as Duration;
}

function threshold(value: unknown): Threshold {
  const parsed = contractBigInt(value, "event_percent");
  if (!THRESHOLDS.includes(parsed as (typeof THRESHOLDS)[number]))
    throw new Error("INVALID_EVENT_LEVEL");
  return Number(parsed) as Threshold;
}

export function mapContractConfig(value: unknown): AegisContractConfig {
  const item = record(value, "config");
  const contract = literal(item.contract, ["AegisProtection"] as const, "contract name");
  return {
    contract,
    version: string(item.version, "version"),
    price_scale: contractBigInt(item.price_scale, "price_scale"),
    gen_unit: contractBigInt(item.gen_unit, "gen_unit"),
    max_payout: contractBigInt(item.max_payout, "max_payout"),
    purchase_reference: string(item.purchase_reference, "purchase_reference"),
    settlement_sources: string(item.settlement_sources, "settlement_sources"),
    max_reference_age_seconds: contractBigInt(
      item.max_reference_age_seconds,
      "max_reference_age_seconds",
    ),
    latest_consensus_timestamp_window_seconds: contractBigInt(
      item.latest_consensus_timestamp_window_seconds,
      "latest_consensus_timestamp_window_seconds",
    ),
    latest_consensus_price_tolerance_bps: contractBigInt(
      item.latest_consensus_price_tolerance_bps,
      "latest_consensus_price_tolerance_bps",
    ),
    stale_reference_behavior: string(item.stale_reference_behavior, "stale_reference_behavior"),
    purchase_reference_statement: string(
      item.purchase_reference_statement,
      "purchase_reference_statement",
    ),
  };
}

export function mapMarket(value: unknown): SupportedMarket {
  const item = record(value, "market");
  return {
    market_id: literal(item.market_id, MARKET_IDS, "market_id") as MarketId,
    symbol: literal(item.symbol, SYMBOLS, "symbol") as MarketSymbol,
    category: literal(item.category, CATEGORIES, "category") as MarketCategory,
    direction: literal(item.direction, DIRECTIONS, "direction") as ProtectedDirection,
  };
}

export function mapMarketDetails(value: unknown): MarketDetails {
  const item = record(value, "market details");
  return {
    ...mapMarket(item),
    usd_base_currency: string(item.usd_base_currency, "usd_base_currency"),
    reciprocal: boolean(item.reciprocal, "reciprocal"),
  };
}

export function mapMarkets(value: unknown): SupportedMarket[] {
  if (!Array.isArray(value))
    throw new Error("CONTRACT_RESPONSE_PARSE_FAILED: markets is not a list.");
  return value.map(mapMarket);
}

export function mapProductTerm(value: unknown): ProductTerm {
  const item = record(value, "product term");
  return {
    duration_days: duration(item.duration_days),
    event_percent: threshold(item.event_percent),
    event_bps: contractBigInt(item.event_bps, "event_bps"),
    premium: contractBigInt(item.premium, "premium"),
    payout: contractBigInt(item.payout, "payout"),
  };
}

export function mapProductTerms(value: unknown): ProductTerm[] {
  if (!Array.isArray(value))
    throw new Error("CONTRACT_RESPONSE_PARSE_FAILED: terms is not a list.");
  return value.map(mapProductTerm);
}

export function mapPoolState(value: unknown): PoolState {
  const item = record(value, "pool state");
  return {
    pool_balance: contractBigInt(item.pool_balance, "pool_balance"),
    reserved_liability: contractBigInt(item.reserved_liability, "reserved_liability"),
    available_liquidity: contractBigInt(item.available_liquidity, "available_liquidity"),
  };
}

export function mapProtocolStats(value: unknown): ProtocolStats {
  const item = record(value, "protocol stats");
  return {
    ...mapPoolState(item),
    total_protections: contractBigInt(item.total_protections, "total_protections"),
    active_protections: contractBigInt(item.active_protections, "active_protections"),
    claimable_protections: contractBigInt(item.claimable_protections, "claimable_protections"),
    expired_protections: contractBigInt(item.expired_protections, "expired_protections"),
    claimed_protections: contractBigInt(item.claimed_protections, "claimed_protections"),
    total_premiums_collected: contractBigInt(
      item.total_premiums_collected,
      "total_premiums_collected",
    ),
    total_payouts_paid: contractBigInt(item.total_payouts_paid, "total_payouts_paid"),
    purchases_paused: boolean(item.purchases_paused, "purchases_paused"),
  };
}

export function mapDashboardSummary(value: unknown): DashboardSummary {
  const item = record(value, "dashboard summary");
  return {
    account: address(item.account, "account"),
    total_protections: contractBigInt(item.total_protections, "total_protections"),
    active_count: contractBigInt(item.active_count, "active_count"),
    claimable_count: contractBigInt(item.claimable_count, "claimable_count"),
    expired_count: contractBigInt(item.expired_count, "expired_count"),
    claimed_count: contractBigInt(item.claimed_count, "claimed_count"),
    total_premiums_paid: contractBigInt(item.total_premiums_paid, "total_premiums_paid"),
    total_claimable_payout: contractBigInt(item.total_claimable_payout, "total_claimable_payout"),
    total_payouts_received: contractBigInt(item.total_payouts_received, "total_payouts_received"),
  };
}

export function mapProtectionCard(value: unknown): ProtectionCard {
  const item = record(value, "protection");
  return {
    id: contractBigInt(item.id, "id"),
    owner: address(item.owner, "owner"),
    market_id: literal(item.market_id, MARKET_IDS, "market_id") as MarketId,
    symbol: literal(item.symbol, SYMBOLS, "symbol") as MarketSymbol,
    category: literal(item.category, CATEGORIES, "category") as MarketCategory,
    direction: literal(item.direction, DIRECTIONS, "direction") as ProtectedDirection,
    status: literal(item.status, STATUSES, "status") as ContractStatus,
    duration_days: duration(item.duration_days),
    event_percent: threshold(item.event_percent),
    event_bps: contractBigInt(item.event_bps, "event_bps"),
    premium: contractBigInt(item.premium, "premium"),
    payout: contractBigInt(item.payout, "payout"),
    reference_price: contractBigInt(item.reference_price, "reference_price"),
    trigger_price: contractBigInt(item.trigger_price, "trigger_price"),
    source_timestamp: contractBigInt(item.source_timestamp, "source_timestamp"),
    purchased_at: contractBigInt(item.purchased_at, "purchased_at"),
    first_settlement_day: contractBigInt(item.first_settlement_day, "first_settlement_day"),
    last_settlement_day: contractBigInt(item.last_settlement_day, "last_settlement_day"),
    expires_at: contractBigInt(item.expires_at, "expires_at"),
    processed_dates: contractBigInt(item.processed_dates, "processed_dates"),
    inconclusive_dates: contractBigInt(item.inconclusive_dates, "inconclusive_dates"),
    remaining_dates: contractBigInt(item.remaining_dates, "remaining_dates"),
    breach_date: string(item.breach_date, "breach_date"),
    claimable: boolean(item.claimable, "claimable"),
    claimed: boolean(item.claimed, "claimed"),
    reserve_released: boolean(item.reserve_released, "reserve_released"),
  };
}

export function mapProtectionDetails(value: unknown): ProtectionDetails {
  const item = record(value, "protection details");
  return {
    ...mapProtectionCard(item),
    first_settlement_date: string(item.first_settlement_date, "first_settlement_date"),
    last_settlement_date: string(item.last_settlement_date, "last_settlement_date"),
    next_unresolved_settlement_date: string(
      item.next_unresolved_settlement_date,
      "next_unresolved_settlement_date",
    ),
    latest_settlement_result: literal(
      item.latest_settlement_result,
      RESULTS,
      "latest_settlement_result",
    ) as SettlementResult,
    latest_market_settlement_version_used: contractBigInt(
      item.latest_market_settlement_version_used,
      "latest_market_settlement_version_used",
    ),
    can_claim: boolean(item.can_claim, "can_claim"),
    expired: boolean(item.expired, "expired"),
    reserve_status: literal(
      item.reserve_status,
      ["RESERVED", "RELEASED"] as const,
      "reserve_status",
    ),
  };
}

export function mapProtections(value: unknown): ProtectionCard[] {
  if (!Array.isArray(value))
    throw new Error("CONTRACT_RESPONSE_PARSE_FAILED: protections is not a list.");
  return value.map(mapProtectionCard);
}

export function mapSettlementReadiness(value: unknown): SettlementReadiness {
  const item = record(value, "settlement readiness");
  return {
    protection_id: contractBigInt(item.protection_id, "protection_id"),
    market_id: literal(item.market_id, MARKET_IDS, "market_id") as MarketId,
    settlement_date: string(item.settlement_date, "settlement_date"),
    settlement_day: contractBigInt(item.settlement_day, "settlement_day"),
    current_utc_day: contractBigInt(item.current_utc_day, "current_utc_day"),
    inside_protection_window: boolean(item.inside_protection_window, "inside_protection_window"),
    is_future_date: boolean(item.is_future_date, "is_future_date"),
    protection_status: literal(item.protection_status, STATUSES, "protection_status"),
    previous_result: literal(item.previous_result, RESULTS, "previous_result"),
    market_settlement_exists: boolean(item.market_settlement_exists, "market_settlement_exists"),
    market_settlement_finalized: boolean(
      item.market_settlement_finalized,
      "market_settlement_finalized",
    ),
    market_settlement_version: contractBigInt(
      item.market_settlement_version,
      "market_settlement_version",
    ),
    retryable: boolean(item.retryable, "retryable"),
    ready: boolean(item.ready, "ready"),
    reason_code: literal(
      item.reason_code,
      READINESS_CODES,
      "reason_code",
    ) as SettlementReadinessCode,
  };
}

export function mapSettlementAuthorization(value: unknown): SettlementAuthorization {
  const item = record(value, "settlement authorization");
  return {
    authorized: boolean(item.authorized, "authorized"),
    is_contract_owner: boolean(item.is_contract_owner, "is_contract_owner"),
    is_operator: boolean(item.is_operator, "is_operator"),
    is_protection_owner: boolean(item.is_protection_owner, "is_protection_owner"),
  };
}

export function mapSettlementHistory(value: unknown): SettlementHistoryEntry[] {
  if (!Array.isArray(value))
    throw new Error("CONTRACT_RESPONSE_PARSE_FAILED: settlement history is not a list.");
  return value.map((raw) => {
    const item = record(raw, "settlement history item");
    return {
      protection_id: contractBigInt(item.protection_id, "protection_id"),
      market_id: literal(item.market_id, MARKET_IDS, "market_id") as MarketId,
      settlement_date: string(item.settlement_date, "settlement_date"),
      result: literal(item.result, RESULTS, "result") as SettlementResult,
      processed: boolean(item.processed, "processed"),
      market_settlement_exists: boolean(item.market_settlement_exists, "market_settlement_exists"),
      market_settlement_version: contractBigInt(
        item.market_settlement_version,
        "market_settlement_version",
      ),
      fxratesapi_price: contractBigInt(item.fxratesapi_price, "fxratesapi_price"),
      fawaz_price: contractBigInt(item.fawaz_price, "fawaz_price"),
      trigger_price: contractBigInt(item.trigger_price, "trigger_price"),
      source_a_date: string(item.source_a_date, "source_a_date"),
      source_b_date: string(item.source_b_date, "source_b_date"),
      settled_at: contractBigInt(item.settled_at, "settled_at"),
      retryable: boolean(item.retryable, "retryable"),
    };
  });
}

export function mapMarketSettlement(value: unknown): MarketSettlement {
  const item = record(value, "market settlement");
  return {
    market_id: literal(item.market_id, MARKET_IDS, "market_id") as MarketId,
    settlement_date: string(item.settlement_date, "settlement_date"),
    settlement_day: contractBigInt(item.settlement_day, "settlement_day"),
    fxratesapi_price: contractBigInt(item.fxratesapi_price, "fxratesapi_price"),
    fawaz_price: contractBigInt(item.fawaz_price, "fawaz_price"),
    source_a: string(item.source_a, "source_a"),
    source_b: string(item.source_b, "source_b"),
    source_a_date: string(item.source_a_date, "source_a_date"),
    source_b_date: string(item.source_b_date, "source_b_date"),
    status: string(item.status, "status"),
    finalized: boolean(item.finalized, "finalized"),
    created_at: contractBigInt(item.created_at, "created_at"),
    version: contractBigInt(item.version, "version"),
    retryable: boolean(item.retryable, "retryable"),
  };
}
