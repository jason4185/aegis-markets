import type { ContractStatus, MarketSymbol, SettlementResult } from "./types";

export const GEN_UNIT = 10n ** 18n;
export const PRICE_SCALE = 10n ** 8n;

export function formatScaled(value: bigint, scaleDecimals: number, maxDecimals = scaleDecimals) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const scale = 10n ** BigInt(scaleDecimals);
  const whole = absolute / scale;
  const fraction = absolute % scale;
  if (fraction === 0n || maxDecimals === 0) return `${negative ? "-" : ""}${whole}`;
  const digits = fraction
    .toString()
    .padStart(scaleDecimals, "0")
    .slice(0, maxDecimals)
    .replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${digits ? `.${digits}` : ""}`;
}

export function formatGenUnits(value: bigint, maxDecimals = 6) {
  return formatScaled(value, 18, maxDecimals);
}

export function formatGen(value: bigint, maxDecimals = 6) {
  return `${formatGenUnits(value, maxDecimals)} GEN`;
}

export function formatPrice(value: bigint, _symbol?: MarketSymbol) {
  return formatScaled(value, 8, 8);
}

export function formatUnixDate(value: bigint) {
  if (value <= 0n) return "—";
  return new Date(Number(value * 1000n)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatUnixDateTime(value: bigint) {
  if (value <= 0n) return "—";
  return new Date(Number(value * 1000n)).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export function formatDate(value: string) {
  if (!value) return "—";
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function truncateHash(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

const STATUS_LABELS: Record<ContractStatus, string> = {
  ACTIVE: "Active",
  CLAIMABLE: "Payout available",
  EXPIRED: "Ended",
  CLAIMED: "Paid",
};

export function contractStatusLabel(status: ContractStatus | string) {
  return STATUS_LABELS[status as ContractStatus] ?? "Status unavailable";
}

const SETTLEMENT_RESULT_LABELS: Record<SettlementResult, string> = {
  UNPROCESSED: "Not checked yet",
  BREACHED: "Qualifying move confirmed",
  NOT_BREACHED: "No qualifying move",
  INCONCLUSIVE: "Awaiting confirmation",
};

export function settlementResultLabel(result: SettlementResult | string) {
  return SETTLEMENT_RESULT_LABELS[result as SettlementResult] ?? "Status unavailable";
}

export function reserveStatusLabel(status: "RESERVED" | "RELEASED" | string) {
  if (status === "RESERVED") return "Secured";
  if (status === "RELEASED") return "Released";
  return "Status unavailable";
}
