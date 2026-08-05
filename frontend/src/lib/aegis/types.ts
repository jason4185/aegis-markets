export type MarketSymbol = "GBP/USD" | "USD/JPY" | "USD/TRY" | "XAU/USD" | "XAG/USD";

export type MarketCategory = "Currency" | "Metal";

/** Direction of the move the protection covers. Derived from the market, never user-chosen. */
export type ProtectedDirection = "DOWN" | "UP";

export type Threshold = 2 | 3 | 4;
export type Duration = 7 | 14 | 30;

export type ContractStatus = "ACTIVE" | "CLAIMABLE" | "EXPIRED" | "CLAIMED";

export type SettlementResult = "UNPROCESSED" | "BREACHED" | "NOT_BREACHED" | "INCONCLUSIVE";

export type SettlementDayState =
  | "UPCOMING"
  | "READY"
  | "SETTLING"
  | "NOT_BREACHED"
  | "BREACHED"
  | "INCONCLUSIVE";

export interface SupportedMarket {
  symbol: MarketSymbol;
  name: string;
  category: MarketCategory;
  direction: ProtectedDirection;
  /** Short plain-language description of what is protected. */
  protectedAgainst: string;
  referencePrice: number;
  priceDecimals: number;
  unit: string;
  thresholds: Threshold[];
  durations: Duration[];
  /** Indicative fixed payout per 100 units of premium, for positioning copy. */
  payoutMultiple: number;
}

export interface ProductTerms {
  thresholds: Threshold[];
  durations: Duration[];
  minPremium: number;
  maxPremium: number;
  referenceSource: string;
  settlementSources: [string, string];
  settlementCadence: string;
  claimWindowDays: number;
}

export interface Quote {
  symbol: MarketSymbol;
  direction: ProtectedDirection;
  threshold: Threshold;
  duration: Duration;
  referencePrice: number;
  triggerPrice: number;
  premium: number;
  fixedPayout: number;
  coverageStart: string;
  coverageEnd: string;
  referenceSource: string;
  settlementSources: [string, string];
}

export interface ProtectionCard {
  id: string;
  symbol: MarketSymbol;
  category: MarketCategory;
  direction: ProtectedDirection;
  status: ContractStatus;
  threshold: Threshold;
  duration: Duration;
  referencePrice: number;
  triggerPrice: number;
  currentPrice: number;
  premium: number;
  fixedPayout: number;
  coverageStart: string;
  coverageEnd: string;
  nextSettlementDate: string | null;
  settlementDue: boolean;
  daysElapsed: number;
}

export interface SettlementEntry {
  date: string;
  result: SettlementResult;
  state: SettlementDayState;
  sourceA: number | null;
  sourceB: number | null;
  consensusPrice: number | null;
  settledBy: string | null;
  txHash: string | null;
}

export interface ProtectionDetails extends ProtectionCard {
  owner: string;
  purchaseTx: string;
  purchasedAt: string;
  timeline: SettlementEntry[];
}

export interface SettlementReadiness {
  protectionId: string;
  /** Earliest unresolved eligible settlement date — the main action. */
  earliestEligibleDate: string | null;
  isEligibleNow: boolean;
  pendingDays: number;
  nextEligibleAt: string | null;
}

export interface ProtocolStats {
  totalProtections: number;
  activeProtections: number;
  settlementsRun: number;
  validatorNodes: number;
  markets: number;
  payoutsSettled: number;
}

export interface DashboardSummary {
  total: number;
  active: number;
  settlementDue: number;
  claimable: number;
  expired: number;
  claimed: number;
}

export interface TxResult {
  hash: string;
  protectionId?: string;
}
