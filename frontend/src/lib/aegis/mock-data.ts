import { REFERENCE_SOURCE, SETTLEMENT_SOURCES } from "./config";
import { addDays } from "./format";
import type {
  DashboardSummary,
  ProductTerms,
  ProtectionCard,
  ProtectionDetails,
  ProtocolStats,
  SettlementEntry,
  SettlementResult,
  SupportedMarket,
} from "./types";

export const SUPPORTED_MARKETS: SupportedMarket[] = [
  {
    symbol: "GBP/USD",
    name: "British Pound / US Dollar",
    category: "Currency",
    direction: "DOWN",
    protectedAgainst: "Protected against a downward move in the pound",
    referencePrice: 1.2684,
    priceDecimals: 4,
    unit: "USD per GBP",
    thresholds: [2, 3, 4],
    durations: [7, 14, 30],
    payoutMultiple: 6.4,
  },
  {
    symbol: "USD/JPY",
    name: "US Dollar / Japanese Yen",
    category: "Currency",
    direction: "UP",
    protectedAgainst: "Protected against an upward move in the dollar",
    referencePrice: 152.418,
    priceDecimals: 3,
    unit: "JPY per USD",
    thresholds: [2, 3, 4],
    durations: [7, 14, 30],
    payoutMultiple: 6.1,
  },
  {
    symbol: "USD/TRY",
    name: "US Dollar / Turkish Lira",
    category: "Currency",
    direction: "UP",
    protectedAgainst: "Protected against an upward move in the dollar",
    referencePrice: 34.216,
    priceDecimals: 3,
    unit: "TRY per USD",
    thresholds: [2, 3, 4],
    durations: [7, 14, 30],
    payoutMultiple: 4.8,
  },
  {
    symbol: "XAU/USD",
    name: "Gold / US Dollar",
    category: "Metal",
    direction: "DOWN",
    protectedAgainst: "Protected against a downward move in gold",
    referencePrice: 2384.55,
    priceDecimals: 2,
    unit: "USD per troy ounce",
    thresholds: [2, 3, 4],
    durations: [7, 14, 30],
    payoutMultiple: 5.7,
  },
  {
    symbol: "XAG/USD",
    name: "Silver / US Dollar",
    category: "Metal",
    direction: "DOWN",
    protectedAgainst: "Protected against a downward move in silver",
    referencePrice: 28.412,
    priceDecimals: 3,
    unit: "USD per troy ounce",
    thresholds: [2, 3, 4],
    durations: [7, 14, 30],
    payoutMultiple: 5.2,
  },
];

export const PRODUCT_TERMS: ProductTerms = {
  thresholds: [2, 3, 4],
  durations: [7, 14, 30],
  minPremium: 25,
  maxPremium: 5000,
  referenceSource: REFERENCE_SOURCE,
  settlementSources: SETTLEMENT_SOURCES,
  settlementCadence: "Once per calendar day, for every day of cover",
  claimWindowDays: 14,
};

export const PROTOCOL_STATS: ProtocolStats = {
  totalProtections: 4128,
  activeProtections: 619,
  settlementsRun: 38914,
  validatorNodes: 12,
  markets: SUPPORTED_MARKETS.length,
  payoutsSettled: 1_942_500,
};

export function marketBySymbol(symbol: string) {
  return SUPPORTED_MARKETS.find((m) => m.symbol === symbol);
}

/** Trigger price for a market + threshold, derived from the protected direction. */
export function triggerPriceFor(reference: number, direction: "UP" | "DOWN", threshold: number) {
  const factor = direction === "DOWN" ? 1 - threshold / 100 : 1 + threshold / 100;
  return Number((reference * factor).toFixed(6));
}

const NOW = new Date();
NOW.setUTCHours(0, 0, 0, 0);
const TODAY = NOW.toISOString();

function timeline(
  start: string,
  days: number,
  resolved: SettlementResult[],
  settlingIndex?: number,
): SettlementEntry[] {
  const entries: SettlementEntry[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i + 1);
    const result = resolved[i] ?? "UNPROCESSED";
    const past = new Date(date).getTime() <= new Date(TODAY).getTime();
    let state: SettlementEntry["state"];
    if (result === "BREACHED") state = "BREACHED";
    else if (result === "NOT_BREACHED") state = "NOT_BREACHED";
    else if (result === "INCONCLUSIVE") state = "INCONCLUSIVE";
    else if (settlingIndex === i) state = "SETTLING";
    else state = past ? "READY" : "UPCOMING";

    const resolvedDay = result !== "UNPROCESSED";
    entries.push({
      date,
      result,
      state,
      sourceA: resolvedDay ? 1 : null,
      sourceB: resolvedDay ? 1 : null,
      consensusPrice: resolvedDay ? 1 : null,
      settledBy: resolvedDay ? "0x8f2c…41ab" : null,
      txHash: resolvedDay ? `0x${(i + 7).toString(16).padStart(4, "0")}c4d9a17f3e88b2` : null,
    });
  }
  return entries;
}

function withPrices(entries: SettlementEntry[], base: number, drift: number): SettlementEntry[] {
  return entries.map((e, i) => {
    if (e.consensusPrice === null) return e;
    const p = base * (1 + drift * (i + 1));
    return {
      ...e,
      sourceA: Number((p * 1.0002).toFixed(6)),
      sourceB: Number((p * 0.9998).toFixed(6)),
      consensusPrice: Number(p.toFixed(6)),
    };
  });
}

function build(
  card: Omit<ProtectionCard, "triggerPrice" | "daysElapsed"> & { drift: number },
  resolved: SettlementResult[],
  settlingIndex?: number,
): ProtectionDetails {
  const { drift, ...rest } = card;
  const triggerPrice = triggerPriceFor(rest.referencePrice, rest.direction, rest.threshold);
  const entries = withPrices(
    timeline(rest.coverageStart, rest.duration, resolved, settlingIndex),
    rest.referencePrice,
    drift,
  );
  const daysElapsed = Math.min(
    rest.duration,
    Math.max(0, Math.round((Date.now() - new Date(rest.coverageStart).getTime()) / 86_400_000)),
  );
  return {
    ...rest,
    triggerPrice,
    daysElapsed,
    owner: "0x4c19…9d02",
    purchaseTx: "0x91ab34cd77ef2210aa5b9c",
    purchasedAt: rest.coverageStart,
    timeline: entries,
  };
}

export const MY_PROTECTIONS: ProtectionDetails[] = [
  build(
    {
      id: "AGS-1042",
      symbol: "GBP/USD",
      category: "Currency",
      direction: "DOWN",
      status: "ACTIVE",
      threshold: 3,
      duration: 14,
      referencePrice: 1.2684,
      currentPrice: 1.2551,
      premium: 180,
      fixedPayout: 1150,
      coverageStart: addDays(TODAY, -5),
      coverageEnd: addDays(TODAY, 9),
      nextSettlementDate: addDays(TODAY, -1),
      settlementDue: true,
      drift: -0.0016,
    },
    ["NOT_BREACHED", "NOT_BREACHED", "NOT_BREACHED", "NOT_BREACHED"],
  ),
  build(
    {
      id: "AGS-1039",
      symbol: "XAU/USD",
      category: "Metal",
      direction: "DOWN",
      status: "CLAIMABLE",
      threshold: 2,
      duration: 7,
      referencePrice: 2384.55,
      currentPrice: 2298.1,
      premium: 240,
      fixedPayout: 1360,
      coverageStart: addDays(TODAY, -6),
      coverageEnd: addDays(TODAY, 1),
      nextSettlementDate: null,
      settlementDue: false,
      drift: -0.0062,
    },
    ["NOT_BREACHED", "NOT_BREACHED", "NOT_BREACHED", "NOT_BREACHED", "BREACHED"],
  ),
  build(
    {
      id: "AGS-1027",
      symbol: "USD/TRY",
      category: "Currency",
      direction: "UP",
      status: "ACTIVE",
      threshold: 4,
      duration: 30,
      referencePrice: 34.216,
      currentPrice: 34.902,
      premium: 320,
      fixedPayout: 1540,
      coverageStart: addDays(TODAY, -12),
      coverageEnd: addDays(TODAY, 18),
      nextSettlementDate: addDays(TODAY, 1),
      settlementDue: false,
      drift: 0.0014,
    },
    Array<SettlementResult>(10).fill("NOT_BREACHED").concat(["INCONCLUSIVE", "NOT_BREACHED"]),
    12,
  ),
  build(
    {
      id: "AGS-0994",
      symbol: "USD/JPY",
      category: "Currency",
      direction: "UP",
      status: "EXPIRED",
      threshold: 2,
      duration: 7,
      referencePrice: 149.82,
      currentPrice: 151.05,
      premium: 140,
      fixedPayout: 860,
      coverageStart: addDays(TODAY, -21),
      coverageEnd: addDays(TODAY, -14),
      nextSettlementDate: null,
      settlementDue: false,
      drift: 0.0009,
    },
    Array<SettlementResult>(7).fill("NOT_BREACHED"),
  ),
  build(
    {
      id: "AGS-0961",
      symbol: "XAG/USD",
      category: "Metal",
      direction: "DOWN",
      status: "CLAIMED",
      threshold: 3,
      duration: 14,
      referencePrice: 29.104,
      currentPrice: 27.88,
      premium: 210,
      fixedPayout: 1240,
      coverageStart: addDays(TODAY, -40),
      coverageEnd: addDays(TODAY, -26),
      nextSettlementDate: null,
      settlementDue: false,
      drift: -0.0031,
    },
    Array<SettlementResult>(8)
      .fill("NOT_BREACHED")
      .concat(["BREACHED"]),
  ),
];

export function dashboardSummary(): DashboardSummary {
  const p = MY_PROTECTIONS;
  return {
    total: p.length,
    active: p.filter((x) => x.status === "ACTIVE").length,
    settlementDue: p.filter((x) => x.settlementDue).length,
    claimable: p.filter((x) => x.status === "CLAIMABLE").length,
    expired: p.filter((x) => x.status === "EXPIRED").length,
    claimed: p.filter((x) => x.status === "CLAIMED").length,
  };
}
