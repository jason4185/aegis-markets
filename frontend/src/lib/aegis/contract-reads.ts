import { isAddress, type Address } from "viem";
import { aegisConfig } from "./contract-config";
import { createAegisReadClient } from "./contract-client";
import {
  contractBigInt,
  mapContractConfig,
  mapDashboardSummary,
  mapMarketDetails,
  mapMarketSettlement,
  mapMarkets,
  mapPoolState,
  mapProductTerms,
  mapProtectionCard,
  mapProtectionDetails,
  mapProtections,
  mapProtocolStats,
  mapSettlementHistory,
  mapSettlementAuthorization,
  mapSettlementReadiness,
} from "./contract-mappers";
import { AEGIS_METHODS } from "./contract-schema";
import type { Duration, MarketId, SettlementResult, Threshold } from "./types";

type ContractArg = string | number | bigint | boolean;

export async function readAegisContract(
  functionName: string,
  args: ContractArg[] = [],
  account?: Address,
) {
  return createAegisReadClient(account).readContract({
    address: aegisConfig.contractAddress,
    functionName,
    args,
  });
}

export async function getConfig() {
  return mapContractConfig(await readAegisContract(AEGIS_METHODS.getConfig));
}

export async function getSupportedMarkets() {
  return mapMarkets(await readAegisContract(AEGIS_METHODS.getSupportedMarkets));
}

export async function getMarket(marketId: MarketId) {
  return mapMarketDetails(await readAegisContract(AEGIS_METHODS.getMarket, [marketId]));
}

export async function getProductTerms() {
  return mapProductTerms(await readAegisContract(AEGIS_METHODS.getProductTerms));
}

export async function quoteProtection(duration: Duration, eventPercent: Threshold) {
  const raw = (await readAegisContract(AEGIS_METHODS.quoteProtection, [
    duration,
    eventPercent,
  ])) as Record<string, unknown>;
  return {
    premium: contractBigInt(raw["premium"], "premium"),
    payout: contractBigInt(raw["payout"], "payout"),
  };
}

export async function previewTrigger(
  marketId: MarketId,
  eventPercent: Threshold,
  normalizedReference: bigint,
) {
  return contractBigInt(
    await readAegisContract(AEGIS_METHODS.previewTrigger, [
      marketId,
      eventPercent,
      normalizedReference,
    ]),
    "trigger price",
  );
}

export async function getPoolState() {
  return mapPoolState(await readAegisContract(AEGIS_METHODS.getPoolState));
}

export async function getAvailableLiquidity() {
  return contractBigInt(
    await readAegisContract(AEGIS_METHODS.availableLiquidity),
    "available liquidity",
  );
}

export async function getProtocolStats() {
  return mapProtocolStats(await readAegisContract(AEGIS_METHODS.getProtocolStats));
}

export async function getPurchasesPaused() {
  return Boolean(await readAegisContract(AEGIS_METHODS.purchasesPaused));
}

export async function getProtectionCount() {
  return contractBigInt(await readAegisContract(AEGIS_METHODS.getProtectionCount));
}

export async function getProtection(protectionId: bigint, account?: Address) {
  return mapProtectionCard(
    await readAegisContract(AEGIS_METHODS.getProtection, [protectionId], account),
  );
}

export async function getMyDashboardSummary(account: Address) {
  return mapDashboardSummary(
    await readAegisContract(AEGIS_METHODS.getMyDashboardSummary, [account], account),
  );
}

export async function getOwnedProtectionCount(account: Address) {
  return contractBigInt(
    await readAegisContract(AEGIS_METHODS.getOwnedProtectionCount, [account], account),
  );
}

export async function getOwnedProtectionIds(account: Address, start: bigint, limit: number) {
  if (limit < 1 || limit > 50) throw new Error("INVALID_PAGE");
  const raw = await readAegisContract(
    AEGIS_METHODS.getOwnedProtectionIds,
    [account, start, limit],
    account,
  );
  if (!Array.isArray(raw)) throw new Error("CONTRACT_RESPONSE_PARSE_FAILED: IDs is not a list.");
  return raw.map((value) => contractBigInt(value, "protection ID"));
}

export async function getMyProtections(account: Address, start: bigint, limit: number) {
  if (limit < 1 || limit > 50) throw new Error("INVALID_PAGE");
  return mapProtections(
    await readAegisContract(AEGIS_METHODS.getMyProtections, [account, start, limit], account),
  );
}

export async function getProtectionDetails(protectionId: bigint, account?: Address) {
  return mapProtectionDetails(
    await readAegisContract(AEGIS_METHODS.getProtectionDetails, [protectionId], account),
  );
}

export async function getProtectionSettlementResult(
  protectionId: bigint,
  settlementDate: string,
  account?: Address,
): Promise<SettlementResult> {
  const result = String(
    await readAegisContract(
      AEGIS_METHODS.getProtectionSettlementResult,
      [protectionId, settlementDate],
      account,
    ),
  );
  if (!["UNPROCESSED", "BREACHED", "NOT_BREACHED", "INCONCLUSIVE"].includes(result)) {
    throw new Error(`CONTRACT_RESPONSE_PARSE_FAILED: unsupported settlement result ${result}.`);
  }
  return result as SettlementResult;
}

export async function getProtectionSettlementVersion(
  protectionId: bigint,
  settlementDate: string,
  account?: Address,
) {
  return contractBigInt(
    await readAegisContract(
      AEGIS_METHODS.getProtectionSettlementVersion,
      [protectionId, settlementDate],
      account,
    ),
    "protection settlement version",
  );
}

export async function getSettlementReadiness(
  protectionId: bigint,
  settlementDate: string,
  account?: Address,
) {
  return mapSettlementReadiness(
    await readAegisContract(
      AEGIS_METHODS.getSettlementReadiness,
      [protectionId, settlementDate],
      account,
    ),
  );
}

export async function getSettlementHistory(
  protectionId: bigint,
  start = 0n,
  limit = 30,
  account?: Address,
) {
  if (limit < 1 || limit > 50) throw new Error("INVALID_PAGE");
  return mapSettlementHistory(
    await readAegisContract(
      AEGIS_METHODS.getSettlementHistory,
      [protectionId, start, limit],
      account,
    ),
  );
}

export async function getMarketSettlement(
  marketId: MarketId,
  settlementDate: string,
  account?: Address,
) {
  return mapMarketSettlement(
    await readAegisContract(AEGIS_METHODS.getMarketSettlement, [marketId, settlementDate], account),
  );
}

function contractAddress(value: unknown, field: string): Address {
  const result = String(value);
  if (!isAddress(result)) {
    throw new Error(`CONTRACT_RESPONSE_PARSE_FAILED: ${field} is not an address.`);
  }
  return result as Address;
}

export async function isSettlementOperator(operator: Address) {
  return Boolean(await readAegisContract(AEGIS_METHODS.isSettlementOperator, [operator]));
}

export async function getSettlementOperatorCount() {
  const count = contractBigInt(
    await readAegisContract(AEGIS_METHODS.getSettlementOperatorCount),
    "settlement operator count",
  );
  if (count < 0n || count > 5n) {
    throw new Error("CONTRACT_RESPONSE_PARSE_FAILED: settlement operator count is outside 0..5.");
  }
  return Number(count);
}

export async function getSettlementOperatorAt(index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= 5) {
    throw new Error("INVALID_SETTLEMENT_OPERATOR_INDEX");
  }
  return contractAddress(
    await readAegisContract(AEGIS_METHODS.getSettlementOperatorAt, [index]),
    "settlement operator",
  );
}

export async function getSettlementOperators() {
  const raw = await readAegisContract(AEGIS_METHODS.getSettlementOperators);
  if (!Array.isArray(raw) || raw.length > 5) {
    throw new Error("CONTRACT_RESPONSE_PARSE_FAILED: operators is not a bounded list.");
  }
  return raw.map((operator, index) => contractAddress(operator, `operator ${index}`));
}

export async function canSettleProtection(caller: Address, protectionId: bigint) {
  return mapSettlementAuthorization(
    await readAegisContract(AEGIS_METHODS.canSettleProtection, [caller, protectionId], caller),
  );
}
