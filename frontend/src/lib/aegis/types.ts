import type { Address } from "viem";
import type { Hash } from "genlayer-js/types";

export type MarketId = "GBP_USD" | "USD_JPY" | "USD_TRY" | "XAU_USD" | "XAG_USD";
export type MarketSymbol = "GBP/USD" | "USD/JPY" | "USD/TRY" | "XAU/USD" | "XAG/USD";
export type MarketCategory = "CURRENCY" | "METAL";
export type ProtectedDirection = "DOWN" | "UP";
export type Threshold = 2 | 3 | 4;
export type Duration = 7 | 14 | 30;
export type ContractStatus = "ACTIVE" | "CLAIMABLE" | "EXPIRED" | "CLAIMED";
export type SettlementResult = "UNPROCESSED" | "BREACHED" | "NOT_BREACHED" | "INCONCLUSIVE";
export type SettlementDayState =
  "UPCOMING" | "READY" | "SETTLING" | "NOT_BREACHED" | "BREACHED" | "INCONCLUSIVE";

export interface AegisContractConfig {
  contract: "AegisProtection";
  version: string;
  price_scale: bigint;
  gen_unit: bigint;
  max_payout: bigint;
  purchase_reference: string;
  settlement_sources: string;
  max_reference_age_seconds: bigint;
  latest_consensus_timestamp_window_seconds: bigint;
  latest_consensus_price_tolerance_bps: bigint;
  stale_reference_behavior: string;
  purchase_reference_statement: string;
}

export interface SupportedMarket {
  market_id: MarketId;
  symbol: MarketSymbol;
  category: MarketCategory;
  direction: ProtectedDirection;
}

export interface MarketDetails extends SupportedMarket {
  usd_base_currency: string;
  reciprocal: boolean;
}

export interface ProductTerm {
  duration_days: Duration;
  event_percent: Threshold;
  event_bps: bigint;
  premium: bigint;
  payout: bigint;
}

export interface ProtectionQuote {
  market_id: MarketId;
  symbol: MarketSymbol;
  direction: ProtectedDirection;
  duration_days: Duration;
  event_percent: Threshold;
  event_bps: bigint;
  premium: bigint;
  payout: bigint;
}

export interface PoolState {
  pool_balance: bigint;
  reserved_liability: bigint;
  available_liquidity: bigint;
}

export interface ProtocolStats extends PoolState {
  total_protections: bigint;
  active_protections: bigint;
  claimable_protections: bigint;
  expired_protections: bigint;
  claimed_protections: bigint;
  total_premiums_collected: bigint;
  total_payouts_paid: bigint;
  purchases_paused: boolean;
}

export interface DashboardSummary {
  account: Address;
  total_protections: bigint;
  active_count: bigint;
  claimable_count: bigint;
  expired_count: bigint;
  claimed_count: bigint;
  total_premiums_paid: bigint;
  total_claimable_payout: bigint;
  total_payouts_received: bigint;
}

export interface ProtectionCard {
  id: bigint;
  owner: Address;
  market_id: MarketId;
  symbol: MarketSymbol;
  category: MarketCategory;
  direction: ProtectedDirection;
  status: ContractStatus;
  duration_days: Duration;
  event_percent: Threshold;
  event_bps: bigint;
  premium: bigint;
  payout: bigint;
  reference_price: bigint;
  trigger_price: bigint;
  source_timestamp: bigint;
  purchased_at: bigint;
  first_settlement_day: bigint;
  last_settlement_day: bigint;
  expires_at: bigint;
  processed_dates: bigint;
  inconclusive_dates: bigint;
  remaining_dates: bigint;
  breach_date: string;
  claimable: boolean;
  claimed: boolean;
  reserve_released: boolean;
}

export interface ProtectionDetails extends ProtectionCard {
  first_settlement_date: string;
  last_settlement_date: string;
  next_unresolved_settlement_date: string;
  latest_settlement_result: SettlementResult;
  latest_market_settlement_version_used: bigint;
  can_claim: boolean;
  expired: boolean;
  reserve_status: "RESERVED" | "RELEASED";
}

export type SettlementReadinessCode =
  | "INVALID_SETTLEMENT_DATE"
  | "FUTURE_SETTLEMENT_DATE"
  | "DATE_ALREADY_SETTLED"
  | "PROTECTION_CLAIMABLE"
  | "PROTECTION_EXPIRED"
  | "PROTECTION_NOT_ACTIVE"
  | "MARKET_SETTLEMENT_RETRYABLE"
  | "MARKET_SETTLEMENT_AVAILABLE"
  | "READY";

export interface SettlementReadiness {
  protection_id: bigint;
  market_id: MarketId;
  settlement_date: string;
  settlement_day: bigint;
  current_utc_day: bigint;
  inside_protection_window: boolean;
  is_future_date: boolean;
  protection_status: ContractStatus;
  previous_result: SettlementResult;
  market_settlement_exists: boolean;
  market_settlement_finalized: boolean;
  market_settlement_version: bigint;
  retryable: boolean;
  ready: boolean;
  reason_code: SettlementReadinessCode;
}

export interface SettlementAuthorization {
  authorized: boolean;
  is_contract_owner: boolean;
  is_operator: boolean;
  is_protection_owner: boolean;
}

export interface SettlementHistoryEntry {
  protection_id: bigint;
  market_id: MarketId;
  settlement_date: string;
  result: SettlementResult;
  processed: boolean;
  market_settlement_exists: boolean;
  market_settlement_version: bigint;
  fxratesapi_price: bigint;
  fawaz_price: bigint;
  trigger_price: bigint;
  source_a_date: string;
  source_b_date: string;
  settled_at: bigint;
  retryable: boolean;
}

export interface MarketSettlement {
  market_id: MarketId;
  settlement_date: string;
  settlement_day: bigint;
  fxratesapi_price: bigint;
  fawaz_price: bigint;
  source_a: string;
  source_b: string;
  source_a_date: string;
  source_b_date: string;
  status: string;
  finalized: boolean;
  created_at: bigint;
  version: bigint;
  retryable: boolean;
}

export type TransactionStage =
  | "idle"
  | "preparing"
  | "awaiting_wallet"
  | "submitted"
  | "validator_consensus"
  | "completed"
  | "failed";

export interface TransactionProgress {
  stage: TransactionStage;
  method?: string | undefined;
  account?: Address | undefined;
  contractAddress?: Address | undefined;
  hash?: Hash | undefined;
  status?: string | undefined;
  explorerUrl?: string | undefined;
  error?: string | undefined;
  submittedAt?: string | undefined;
  updatedAt?: string | undefined;
}
