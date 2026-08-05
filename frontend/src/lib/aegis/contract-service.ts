import { AEGIS_CONTRACT_ADDRESS, REFERENCE_SOURCE, SETTLEMENT_SOURCES } from "./config";
import { addDays } from "./format";
import {
  MY_PROTECTIONS,
  PRODUCT_TERMS,
  PROTOCOL_STATS,
  SUPPORTED_MARKETS,
  dashboardSummary,
  marketBySymbol,
  triggerPriceFor,
} from "./mock-data";
import type {
  ContractStatus,
  DashboardSummary,
  Duration,
  MarketSymbol,
  ProductTerms,
  ProtectionCard,
  ProtectionDetails,
  ProtocolStats,
  Quote,
  SettlementEntry,
  SettlementReadiness,
  SupportedMarket,
  Threshold,
  TxResult,
} from "./types";

/**
 * Isolated contract service.
 *
 * Every method mirrors a future GenLayer contract read/write. Today they resolve
 * mocked data; when the contract is deployed only this module changes — set
 * AEGIS_CONTRACT_ADDRESS in ./config and swap the bodies for SDK calls.
 */

const latency = (ms = 320) => new Promise((r) => setTimeout(r, ms));

export const contractService = {
  isConnected(): boolean {
    return AEGIS_CONTRACT_ADDRESS !== null;
  },

  /** read: get_supported_markets() */
  async get_supported_markets(): Promise<SupportedMarket[]> {
    await latency(220);
    return SUPPORTED_MARKETS;
  },

  /** read: get_product_terms() */
  async get_product_terms(): Promise<ProductTerms> {
    await latency(160);
    return PRODUCT_TERMS;
  },

  /** read: quote_protection(symbol, threshold, duration) */
  async quote_protection(input: {
    symbol: MarketSymbol;
    threshold: Threshold;
    duration: Duration;
  }): Promise<Quote> {
    await latency(280);
    const market = marketBySymbol(input.symbol)!;
    const base = market.referencePrice;
    const riskFactor = (5 - input.threshold) * 0.9;
    const timeFactor = Math.sqrt(input.duration / 7);
    const premium = Math.round(60 * riskFactor * timeFactor * (market.category === "Metal" ? 1.12 : 1));
    const fixedPayout = Math.round(premium * market.payoutMultiple);
    const start = new Date().toISOString();
    return {
      symbol: input.symbol,
      direction: market.direction,
      threshold: input.threshold,
      duration: input.duration,
      referencePrice: base,
      triggerPrice: triggerPriceFor(base, market.direction, input.threshold),
      premium,
      fixedPayout,
      coverageStart: start,
      coverageEnd: addDays(start, input.duration),
      referenceSource: REFERENCE_SOURCE,
      settlementSources: SETTLEMENT_SOURCES,
    };
  },

  /** read: get_protocol_stats() */
  async get_protocol_stats(): Promise<ProtocolStats> {
    await latency(180);
    return PROTOCOL_STATS;
  },

  /** read: get_my_dashboard_summary(wallet) */
  async get_my_dashboard_summary(): Promise<DashboardSummary> {
    await latency(220);
    return dashboardSummary();
  },

  /** read: get_my_protections(wallet) */
  async get_my_protections(): Promise<ProtectionCard[]> {
    await latency(340);
    return MY_PROTECTIONS.map(({ timeline: _t, ...card }) => card);
  },

  /** read: get_protection_details(id) */
  async get_protection_details(id: string): Promise<ProtectionDetails | null> {
    await latency(320);
    return MY_PROTECTIONS.find((p) => p.id === id) ?? null;
  },

  /** read: get_settlement_readiness(id) */
  async get_settlement_readiness(id: string): Promise<SettlementReadiness> {
    await latency(180);
    const p = MY_PROTECTIONS.find((x) => x.id === id);
    const pending = p?.timeline.filter((d) => d.state === "READY") ?? [];
    return {
      protectionId: id,
      earliestEligibleDate: pending[0]?.date ?? null,
      isEligibleNow: pending.length > 0,
      pendingDays: pending.length,
      nextEligibleAt: p?.timeline.find((d) => d.state === "UPCOMING")?.date ?? null,
    };
  },

  /** read: get_settlement_history(id) */
  async get_settlement_history(id: string): Promise<SettlementEntry[]> {
    await latency(240);
    const p = MY_PROTECTIONS.find((x) => x.id === id);
    return (p?.timeline ?? []).filter((d) => d.result !== "UNPROCESSED").reverse();
  },

  /** read: get_market_settlement(symbol, date) */
  async get_market_settlement(symbol: MarketSymbol, date: string): Promise<SettlementEntry | null> {
    await latency(200);
    const p = MY_PROTECTIONS.find((x) => x.symbol === symbol);
    return p?.timeline.find((d) => d.date.slice(0, 10) === date.slice(0, 10)) ?? null;
  },

  /** write: purchase_protection(symbol, threshold, duration) */
  async purchase_protection(_quote: Quote): Promise<TxResult> {
    await latency(600);
    return { hash: "0xa71f93cc02de4418bb7710", protectionId: "AGS-1042" };
  },

  /** write: settle_protection(id, date) — permissionless */
  async settle_protection(_id: string, _date: string): Promise<TxResult> {
    await latency(600);
    return { hash: "0x55c1de770a9b2244ff10ac" };
  },

  /** write: claim_payout(id) — owner only */
  async claim_payout(_id: string): Promise<TxResult> {
    await latency(600);
    return { hash: "0x2be40917aa3c8f5510dd23" };
  },

  /** write: finalize_expired_protection(id) */
  async finalize_expired_protection(_id: string): Promise<TxResult> {
    await latency(600);
    return { hash: "0x77ff2c19bb04a6d3e91002" };
  },
};

export type { ContractStatus };
