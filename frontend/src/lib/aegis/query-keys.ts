import type { Address } from "viem";
import type { Duration, MarketId, Threshold } from "./types";

export const aegisKeys = {
  config: ["aegis", "config"] as const,
  markets: ["aegis", "supported-markets"] as const,
  market: (marketId: MarketId) => ["aegis", "market", marketId] as const,
  terms: ["aegis", "product-terms"] as const,
  quote: (duration: Duration, event: Threshold) => ["aegis", "quote", duration, event] as const,
  pool: ["aegis", "pool-state"] as const,
  liquidity: ["aegis", "available-liquidity"] as const,
  stats: ["aegis", "protocol-stats"] as const,
  paused: ["aegis", "purchases-paused"] as const,
  dashboard: (address?: Address) => ["aegis", "dashboard", address?.toLowerCase()] as const,
  ownedCount: (address?: Address) => ["aegis", "owned-count", address?.toLowerCase()] as const,
  owned: (address?: Address, start = 0) =>
    ["aegis", "owned-protections", address?.toLowerCase(), start] as const,
  details: (id: bigint) => ["aegis", "protection-details", id.toString()] as const,
  readiness: (id: bigint, date: string) =>
    ["aegis", "settlement-readiness", id.toString(), date] as const,
  terminalReadiness: (id: bigint) =>
    ["aegis", "terminal-cancellation-readiness", id.toString()] as const,
  history: (id: bigint, start = 0) =>
    ["aegis", "settlement-history", id.toString(), start] as const,
  marketSettlement: (marketId: MarketId, date: string) =>
    ["aegis", "market-settlement", marketId, date] as const,
  settlementAuthorization: (id: bigint, address?: Address) =>
    ["aegis", "settlement-authorization", id.toString(), address?.toLowerCase()] as const,
  operatorCount: ["aegis", "settlement-operator-count"] as const,
  operators: ["aegis", "settlement-operators"] as const,
  operator: (address?: Address) =>
    ["aegis", "settlement-operator", address?.toLowerCase()] as const,
  transactions: ["aegis", "transactions"] as const,
};
