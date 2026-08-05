import type { MarketSymbol, SupportedMarket } from "./types";

export function formatPrice(value: number, symbol: MarketSymbol | undefined, decimals = 4) {
  const d = symbol ? priceDecimals(symbol) : decimals;
  return value.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function priceDecimals(symbol: MarketSymbol) {
  switch (symbol) {
    case "USD/JPY":
      return 3;
    case "USD/TRY":
      return 3;
    case "XAU/USD":
      return 2;
    case "XAG/USD":
      return 3;
    default:
      return 4;
  }
}

export function formatUsd(value: number, fractionDigits = 2) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

export function truncateHash(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export function directionLabel(market: Pick<SupportedMarket, "direction">) {
  return market.direction === "DOWN" ? "Downward move" : "Upward move";
}
