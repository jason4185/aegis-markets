import type { MarketId, ProtectedDirection } from "./types";

export const MARKET_PRESENTATION: Record<MarketId, { name: string; protectedAgainst: string }> = {
  GBP_USD: {
    name: "British Pound / US Dollar",
    protectedAgainst: "Protected against a downward move",
  },
  USD_JPY: {
    name: "US Dollar / Japanese Yen",
    protectedAgainst: "Protected against an upward move",
  },
  USD_TRY: {
    name: "US Dollar / Turkish Lira",
    protectedAgainst: "Protected against an upward move",
  },
  XAU_USD: { name: "Gold / US Dollar", protectedAgainst: "Protected against a downward move" },
  XAG_USD: {
    name: "Silver / US Dollar",
    protectedAgainst: "Protected against a downward move",
  },
};

export function directionLabel(direction: ProtectedDirection) {
  return direction === "DOWN" ? "Downward move" : "Upward move";
}
