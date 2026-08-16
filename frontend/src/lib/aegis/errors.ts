export type AegisErrorKind = "wallet" | "network" | "contract" | "configuration" | "unknown";

export type NormalizedAegisError = {
  code: string;
  message: string;
  kind: AegisErrorKind;
};

const CONTRACT_MESSAGES: Record<string, string> = {
  INVALID_MARKET: "This market is not supported.",
  INVALID_DURATION: "Choose a supported protection duration.",
  INVALID_EVENT_LEVEL: "Choose a supported market-move level.",
  INVALID_PREMIUM:
    "The transaction value does not match the current premium. Refresh the quote and try again.",
  INSUFFICIENT_AVAILABLE_LIQUIDITY: "There is not enough available liquidity for this protection.",
  PURCHASES_PAUSED: "New protection purchases are temporarily paused.",
  SETTLEMENT_OPERATOR_ALREADY_APPROVED: "This address is already an approved settlement operator.",
  SETTLEMENT_OPERATOR_NOT_FOUND: "This address is not an approved settlement operator.",
  SETTLEMENT_OPERATOR_LIMIT_REACHED: "A maximum of five settlement operators is allowed.",
  INVALID_SETTLEMENT_OPERATOR_INDEX: "The requested operator entry does not exist.",
  INVALID_SETTLEMENT_OPERATOR: "Enter a valid operator address that is not the contract owner.",
  UNAUTHORIZED_CALLER: "This wallet is not permitted to perform this action.",
  INVALID_SETTLEMENT_DATE: "This date cannot be settled yet.",
  MARKET_SETTLEMENT_ALREADY_FINALIZED:
    "This market settlement cannot create another final version.",
  MARKET_SETTLEMENT_MISSING: "Verified market data for this date is not available.",
  PROTECTION_NOT_ACTIVE: "This protection is no longer active.",
  PROTECTION_NOT_FOUND: "This protection could not be found.",
  PROTECTION_NOT_CLAIMABLE: "No payout is currently available.",
  PAYOUT_ALREADY_CLAIMED: "This payout has already been claimed.",
  RESERVE_ALREADY_RELEASED: "The reserved payout has already been released.",
  ACCOUNTING_INVARIANT:
    "The contract rejected the transaction because its accounting checks did not pass.",
  STALE_PURCHASE_REFERENCE: "A fresh reference price was not available. Try the purchase again.",
  MALFORMED_SOURCE_RESPONSE: "A market-data source returned an invalid response.",
  MISSING_SOURCE_RATE: "A required market rate was missing from the source response.",
  INVALID_SOURCE_TIMESTAMP: "The purchase reference timestamp could not be verified.",
  INVALID_ADDRESS: "The wallet address is invalid.",
  SETTLEMENT_DATA_NOT_READY:
    "Daily market data is still being finalized. Try again after the next UTC day begins.",
  TERMINAL_CANCELLATION_NOT_READY:
    "Terminal cancellation is not available until the unresolved date's grace period ends.",
};

function errorText(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function normalizeAegisError(error: unknown): NormalizedAegisError {
  const raw = errorText(error);
  if (import.meta.env.DEV) console.error("[aegis] full error", error);

  if (/User rejected|User denied|ACTION_REJECTED|4001/i.test(raw)) {
    return { code: "WALLET_REJECTED", message: "Transaction rejected in wallet.", kind: "wallet" };
  }
  if (raw.includes("WALLET_ACCOUNT_MISMATCH")) {
    return {
      code: "WALLET_ACCOUNT_MISMATCH",
      message:
        "The selected wallet account does not match the active provider account. Reconnect your wallet.",
      kind: "wallet",
    };
  }
  if (raw.includes("WRONG_NETWORK")) {
    return {
      code: "WRONG_NETWORK",
      message: "Switch your wallet to GenLayer Bradbury.",
      kind: "wallet",
    };
  }
  if (raw.includes("WALLET_NOT_CONNECTED")) {
    return { code: "WALLET_NOT_CONNECTED", message: "Connect wallet", kind: "wallet" };
  }
  if (raw.includes("ACTIVE_CONNECTOR_UNAVAILABLE") || raw.includes("WALLET_PROVIDER_UNAVAILABLE")) {
    return {
      code: "WALLET_PROVIDER_UNAVAILABLE",
      message: "The active browser wallet could not be accessed. Reconnect your wallet.",
      kind: "wallet",
    };
  }
  if (raw.includes("APPLICATION_CONFIG_ERROR")) {
    return {
      code: "APPLICATION_CONFIG_ERROR",
      message: raw.split(": ").slice(1).join(": "),
      kind: "configuration",
    };
  }
  if (/\[TRANSIENT\][^A-Z_]*EXTERNAL_SOURCE_UNAVAILABLE/i.test(raw)) {
    return {
      code: "TRANSIENT_EXTERNAL_SOURCE_UNAVAILABLE",
      message: "Today’s market data is not available yet. Try again later.",
      kind: "contract",
    };
  }
  if (/\[EXTERNAL\][^A-Z_]*EXTERNAL_SOURCE_UNAVAILABLE/i.test(raw)) {
    return {
      code: "EXTERNAL_SOURCE_UNAVAILABLE",
      message: "Market data for this date could not be retrieved.",
      kind: "contract",
    };
  }
  for (const [code, message] of Object.entries(CONTRACT_MESSAGES)) {
    if (raw.includes(code)) return { code, message, kind: "contract" };
  }
  if (/fetch failed|Failed to fetch|network|ECONN|ENOTFOUND|timeout|RPC/i.test(raw)) {
    return {
      code: "RPC_UNAVAILABLE",
      message: "The GenLayer network could not be reached. Try again.",
      kind: "network",
    };
  }
  if (raw.includes("CONTRACT_RESPONSE_PARSE_FAILED") || raw.includes("FINISHED_WITH_ERROR")) {
    return {
      code: "CONTRACT_DATA_FAILED",
      message: "Contract data could not be loaded. Retry the request.",
      kind: "contract",
    };
  }
  return {
    code: "UNKNOWN_ERROR",
    message: "Contract data could not be loaded. Retry the request.",
    kind: "unknown",
  };
}

export function publicReadErrorMessage(error: unknown) {
  const normalized = normalizeAegisError(error);
  return normalized.kind === "network"
    ? "Aegis Markets could not reach the GenLayer network. Try again."
    : "Contract data could not be loaded. Retry the request.";
}
