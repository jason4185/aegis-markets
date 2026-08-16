import type { Address } from "viem";
import type { Duration, MarketId, Threshold } from "./types";
import { aegisConfig } from "./contract-config";

const AEGIS_QUERY_SCOPE = [
  "aegis",
  aegisConfig.chainId,
  aegisConfig.contractAddress.toLowerCase(),
] as const;

function key(...parts: readonly unknown[]) {
  return [...AEGIS_QUERY_SCOPE, ...parts] as const;
}

export const aegisKeys = {
  scope: AEGIS_QUERY_SCOPE,
  invalid: (name: string) => key("invalid", name),
  config: key("config"),
  markets: key("supported-markets"),
  market: (marketId: MarketId) => key("market", marketId),
  terms: key("product-terms"),
  quote: (duration: Duration, event: Threshold) => key("quote", duration, event),
  pool: key("pool-state"),
  liquidity: key("available-liquidity"),
  stats: key("protocol-stats"),
  paused: key("purchases-paused"),
  dashboard: (address?: Address) => key("dashboard", address?.toLowerCase()),
  ownedCount: (address?: Address) => key("owned-count", address?.toLowerCase()),
  owned: (address?: Address, start = 0) => key("owned-protections", address?.toLowerCase(), start),
  details: (id: bigint) => key("protection-details", id.toString()),
  readiness: (id: bigint, date: string) => key("settlement-readiness", id.toString(), date),
  terminalReadiness: (id: bigint) => key("terminal-cancellation-readiness", id.toString()),
  history: (id: bigint, start = 0) => key("settlement-history", id.toString(), start),
  marketSettlement: (marketId: MarketId, date: string) => key("market-settlement", marketId, date),
  settlementAuthorization: (id: bigint, address?: Address) =>
    key("settlement-authorization", id.toString(), address?.toLowerCase()),
  settlementAuthorizationRoot: key("settlement-authorization"),
  operatorCount: key("settlement-operator-count"),
  operators: key("settlement-operators"),
  operator: (address?: Address) => key("settlement-operator", address?.toLowerCase()),
  transactions: key("transactions"),
};
