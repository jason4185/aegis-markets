import type { QueryClient } from "@tanstack/react-query";
import {
  executionResultNumberToName,
  transactionsStatusNumberToName,
  type Hash,
} from "genlayer-js/types";
import { isAddress, type Address } from "viem";
import { BRADBURY_CHAIN_ID, aegisConfig } from "./contract-config";
import { createAegisWriteClient } from "./contract-client";
import {
  getAvailableLiquidity,
  canSettleProtection,
  getOwnedProtectionCount,
  getOwnedProtectionIds,
  getProtectionDetails,
  getPurchasesPaused,
  getSettlementOperatorCount,
  getSettlementReadiness,
  getTerminalCancellationReadiness,
  isSettlementOperator,
  quoteProtection,
} from "./contract-reads";
import { AEGIS_METHODS } from "./contract-schema";
import { aegisKeys } from "./query-keys";
import type { Duration, MarketId, Threshold, TransactionProgress } from "./types";
import type { ActiveWalletConnector, Eip1193Provider, WriteContext } from "@/lib/web3/wallet";
import { explorerTransactionUrl } from "@/lib/web3/chains";
import { isDailySettlementProcessable } from "./settlement-time";

type ContractArg = string | number | bigint | boolean;
type ProgressCallback = (progress: TransactionProgress) => void;
type AegisWriteClient = ReturnType<typeof createAegisWriteClient>;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeStringify(value: unknown) {
  return (
    JSON.stringify(value, (_key, child) =>
      typeof child === "bigint" ? child.toString() : child,
    ) ?? String(value)
  );
}

export function normalizeWalletAddress(value: unknown): string | null {
  return typeof value === "string" && isAddress(value) ? value.toLowerCase() : null;
}

export function parseProviderChainId(value: unknown): number {
  let parsed: number;
  if (typeof value === "number" && Number.isInteger(value)) parsed = value;
  else if (typeof value === "bigint" && value <= BigInt(Number.MAX_SAFE_INTEGER))
    parsed = Number(value);
  else if (typeof value === "string" && /^0x[\da-f]+$/i.test(value.trim()))
    parsed = Number.parseInt(value.trim(), 16);
  else if (typeof value === "string" && /^\d+$/.test(value.trim()))
    parsed = Number.parseInt(value.trim(), 10);
  else throw new Error(`WALLET_PROVIDER_CHAIN_UNAVAILABLE: ${safeStringify(value)}`);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`WALLET_PROVIDER_CHAIN_UNAVAILABLE: ${safeStringify(value)}`);
  }
  return parsed;
}

export function isEip1193Provider(value: unknown): value is Eip1193Provider {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { request?: unknown }).request === "function"
  );
}

export async function getActiveConnectorProvider(
  connector?: ActiveWalletConnector | null,
): Promise<Eip1193Provider> {
  if (!connector || typeof connector.getProvider !== "function") {
    throw new Error("ACTIVE_CONNECTOR_UNAVAILABLE");
  }
  const provider = await connector.getProvider();
  if (!isEip1193Provider(provider)) throw new Error("WALLET_PROVIDER_UNAVAILABLE");
  return provider;
}

async function getProviderAccounts(provider: Eip1193Provider) {
  const raw = await provider.request({ method: "eth_accounts" });
  if (!Array.isArray(raw)) {
    throw new Error("WALLET_PROVIDER_UNAVAILABLE: invalid eth_accounts response");
  }
  return raw.map((item) => {
    const normalized = normalizeWalletAddress(item);
    if (!normalized) throw new Error("WALLET_PROVIDER_UNAVAILABLE: invalid provider account");
    return normalized;
  });
}

export async function prepareAegisWriteClient(
  context: WriteContext,
  factory = createAegisWriteClient,
) {
  const normalized = normalizeWalletAddress(context.address);
  if (!context.address || !normalized) throw new Error("WALLET_NOT_CONNECTED");
  const provider = await getActiveConnectorProvider(context.activeConnector);
  const providerAccounts = await getProviderAccounts(provider);
  if (!providerAccounts.includes(normalized)) throw new Error("WALLET_ACCOUNT_MISMATCH");
  const providerChainId = parseProviderChainId(await provider.request({ method: "eth_chainId" }));
  if (providerChainId !== BRADBURY_CHAIN_ID) {
    throw new Error(`WRONG_NETWORK: expected ${BRADBURY_CHAIN_ID}, received ${providerChainId}`);
  }
  if (context.chainId !== undefined && context.chainId !== BRADBURY_CHAIN_ID) {
    throw new Error(`WRONG_NETWORK: wagmi selected ${context.chainId}`);
  }
  return {
    account: context.address as Address,
    provider,
    providerAccounts,
    providerChainId,
    client: factory({ account: context.address as Address, provider }),
  };
}

export function extractTransactionHash(value: unknown): Hash {
  if (typeof value === "string" && /^0x[\da-f]+$/i.test(value)) return value as Hash;
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    for (const key of [
      "hash",
      "txHash",
      "transactionHash",
      "txId",
      "transactionId",
      "transaction_hash",
    ]) {
      const candidate = item[key];
      if (typeof candidate === "string" && /^0x[\da-f]+$/i.test(candidate)) {
        return candidate as Hash;
      }
    }
  }
  throw new Error(`TRANSACTION_HASH_MISSING: ${safeStringify(value)}`);
}

export function transactionStatusName(receipt: Record<string, unknown>) {
  if (typeof receipt["statusName"] === "string") return receipt["statusName"];
  if (typeof receipt["status"] === "string") {
    return (
      transactionsStatusNumberToName[
        receipt["status"] as keyof typeof transactionsStatusNumberToName
      ] ?? receipt["status"]
    );
  }
  if (typeof receipt["status"] === "number") {
    return transactionsStatusNumberToName[
      String(receipt["status"]) as keyof typeof transactionsStatusNumberToName
    ];
  }
  return undefined;
}

export function assertExecutionSucceeded(receipt: Record<string, unknown>) {
  const result =
    typeof receipt["txExecutionResultName"] === "string"
      ? receipt["txExecutionResultName"]
      : typeof receipt["txExecutionResult"] === "number"
        ? executionResultNumberToName[
            String(receipt["txExecutionResult"]) as keyof typeof executionResultNumberToName
          ]
        : undefined;
  if (result === "FINISHED_WITH_ERROR") {
    throw new Error(`FINISHED_WITH_ERROR: ${safeStringify(receipt)}`);
  }
  if (result !== "FINISHED_WITH_RETURN") {
    throw new Error(`TRANSACTION_EXECUTION_RESULT_MISSING: ${safeStringify(receipt)}`);
  }

  const consensusResult = receipt["resultName"];
  if (
    typeof consensusResult === "string" &&
    [
      "FAILURE",
      "REJECTED",
      "FAILED",
      "DISAGREE",
      "MAJORITY_DISAGREE",
      "NO_MAJORITY",
      "DETERMINISTIC_VIOLATION",
      "TIMEOUT",
    ].includes(consensusResult)
  ) {
    throw new Error(`TRANSACTION_RESULT_${consensusResult}: ${safeStringify(receipt)}`);
  }
}

const TERMINAL_FAILURE_STATUSES = new Set([
  "CANCELED",
  "CANCELLED",
  "REJECTED",
  "FAILED",
  "UNDETERMINED",
  "VALIDATORS_TIMEOUT",
  "LEADER_TIMEOUT",
]);

const CONSENSUS_STATUSES = new Set([
  "PROPOSING",
  "COMMITTING",
  "REVEALING",
  "APPEAL_REVEALING",
  "APPEAL_COMMITTING",
  "READY_TO_FINALIZE",
]);

export async function waitForAcceptedExecution({
  client,
  hash,
  method,
  account,
  onProgress,
  maxAttempts = 100,
  pollIntervalMs = 3000,
  wait = sleep,
}: {
  client: Pick<AegisWriteClient, "getTransaction">;
  hash: Hash;
  method: string;
  account: Address;
  onProgress?: ProgressCallback | undefined;
  maxAttempts?: number | undefined;
  pollIntervalMs?: number | undefined;
  wait?: ((milliseconds: number) => Promise<unknown>) | undefined;
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let receipt: Record<string, unknown>;
    try {
      receipt = (await client.getTransaction({ hash })) as unknown as Record<string, unknown>;
    } catch (error) {
      if (attempt >= maxAttempts - 1) {
        throw new Error(`TRANSACTION_STILL_PENDING: ${hash}`, { cause: error });
      }
      onProgress?.({
        stage: "submitted",
        method,
        account,
        contractAddress: aegisConfig.contractAddress,
        hash,
        status: "PROPAGATING",
        explorerUrl: explorerTransactionUrl(hash),
        updatedAt: new Date().toISOString(),
      });
      await wait(pollIntervalMs);
      continue;
    }
    const status = transactionStatusName(receipt);
    const base = {
      method,
      account,
      contractAddress: aegisConfig.contractAddress,
      hash,
      status,
      explorerUrl: explorerTransactionUrl(hash),
      updatedAt: new Date().toISOString(),
    };
    if (TERMINAL_FAILURE_STATUSES.has(status ?? "")) {
      throw new Error(`TRANSACTION_${status}: ${hash}`);
    }
    if (status === "ACCEPTED" || status === "FINALIZED") {
      assertExecutionSucceeded(receipt);
      onProgress?.({ ...base, stage: "completed" });
      return receipt;
    }
    if (CONSENSUS_STATUSES.has(status ?? "")) {
      onProgress?.({ ...base, stage: "validator_consensus" });
    } else {
      onProgress?.({ ...base, stage: "submitted" });
    }
    await wait(pollIntervalMs);
  }
  throw new Error(`TRANSACTION_STILL_PENDING: ${hash}`);
}

export async function writeAegisContract({
  context,
  functionName,
  args = [],
  value = 0n,
  onProgress,
  factory,
}: {
  context: WriteContext;
  functionName: string;
  args?: ContractArg[];
  value?: bigint;
  onProgress?: ProgressCallback | undefined;
  factory?: typeof createAegisWriteClient | undefined;
}) {
  onProgress?.({
    stage: "preparing",
    method: functionName,
    contractAddress: aegisConfig.contractAddress,
    account: context.address,
    updatedAt: new Date().toISOString(),
  });
  const { account, client } = await prepareAegisWriteClient(context, factory);
  onProgress?.({
    stage: "awaiting_wallet",
    method: functionName,
    account,
    contractAddress: aegisConfig.contractAddress,
    updatedAt: new Date().toISOString(),
  });
  const raw = await client.writeContract({
    address: aegisConfig.contractAddress,
    functionName,
    args,
    value,
  });
  const hash = extractTransactionHash(raw);
  const submittedAt = new Date().toISOString();
  onProgress?.({
    stage: "submitted",
    method: functionName,
    account,
    contractAddress: aegisConfig.contractAddress,
    hash,
    status: "SUBMITTED",
    explorerUrl: explorerTransactionUrl(hash),
    submittedAt,
    updatedAt: submittedAt,
  });
  const receipt = await waitForAcceptedExecution({
    client,
    hash,
    method: functionName,
    account,
    onProgress,
  });
  return { hash, receipt, account };
}

async function invalidate(
  queryClient: QueryClient | undefined,
  keys: readonly (readonly unknown[])[],
) {
  if (!queryClient) return;
  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

async function ownerIds(account: Address) {
  const count = await getOwnedProtectionCount(account);
  if (count === 0n) return [];
  const limit = Number(count > 50n ? 50n : count);
  return getOwnedProtectionIds(account, count > 50n ? count - 50n : 0n, limit);
}

export async function purchaseProtection({
  context,
  marketId,
  durationDays,
  eventPercent,
  quotedPremium,
  onProgress,
  queryClient,
}: {
  context: WriteContext;
  marketId: MarketId;
  durationDays: Duration;
  eventPercent: Threshold;
  quotedPremium: bigint;
  onProgress?: ProgressCallback | undefined;
  queryClient?: QueryClient | undefined;
}) {
  if (!context.address) throw new Error("WALLET_NOT_CONNECTED");
  const [paused, quote, liquidity, beforeIds] = await Promise.all([
    getPurchasesPaused(),
    quoteProtection(durationDays, eventPercent),
    getAvailableLiquidity(),
    ownerIds(context.address),
  ]);
  if (paused) throw new Error("PURCHASES_PAUSED");
  if (quote.premium !== quotedPremium) throw new Error("INVALID_PREMIUM");
  if (liquidity + quote.premium < quote.payout) {
    throw new Error("INSUFFICIENT_AVAILABLE_LIQUIDITY");
  }
  const transaction = await writeAegisContract({
    context,
    functionName: AEGIS_METHODS.purchaseProtection,
    args: [marketId, durationDays, eventPercent],
    value: quote.premium,
    onProgress,
  });
  await invalidate(queryClient, [
    aegisKeys.stats,
    aegisKeys.pool,
    aegisKeys.liquidity,
    aegisKeys.dashboard(context.address),
    aegisKeys.ownedCount(context.address),
    aegisKeys.owned(context.address),
  ]);
  let protectionId: bigint | null = null;
  for (const delay of [0, 1000, 2000, 3000]) {
    if (delay) await sleep(delay);
    const afterIds = await ownerIds(context.address);
    const before = new Set(beforeIds.map(String));
    const added = afterIds.filter((id) => !before.has(String(id)));
    if (added.length === 1) {
      protectionId = added[0]!;
      break;
    }
  }
  if (protectionId === null) throw new Error("PROTECTION_ID_NOT_CONFIRMED");
  return { ...transaction, protectionId, quote };
}

export async function settleProtection({
  context,
  protectionId,
  onProgress,
  queryClient,
}: {
  context: WriteContext;
  protectionId: bigint;
  onProgress?: ProgressCallback | undefined;
  queryClient?: QueryClient | undefined;
}) {
  if (!context.address) throw new Error("WALLET_NOT_CONNECTED");
  const details = await getProtectionDetails(protectionId, context.address);
  const settlementDate = details.next_unresolved_settlement_date;
  if (!settlementDate) throw new Error("INVALID_SETTLEMENT_DATE");
  if (!isDailySettlementProcessable(settlementDate)) {
    throw new Error("SETTLEMENT_DATA_NOT_READY");
  }
  const [readiness, authorization] = await Promise.all([
    getSettlementReadiness(protectionId, settlementDate, context.address),
    canSettleProtection(context.address, protectionId),
  ]);
  if (!authorization.authorized) throw new Error("UNAUTHORIZED_CALLER");
  if (!readiness.ready || readiness.settlement_date !== settlementDate) {
    throw new Error("INVALID_SETTLEMENT_DATE");
  }
  if (!isDailySettlementProcessable(settlementDate)) {
    throw new Error("SETTLEMENT_DATA_NOT_READY");
  }
  const transaction = await writeAegisContract({
    context,
    functionName: AEGIS_METHODS.settleProtection,
    args: [protectionId, settlementDate],
    onProgress,
  });
  await invalidate(queryClient, [
    aegisKeys.details(protectionId),
    aegisKeys.history(protectionId),
    aegisKeys.readiness(protectionId, settlementDate),
    aegisKeys.settlementAuthorization(protectionId, context.address),
    aegisKeys.marketSettlement(details.market_id, settlementDate),
    aegisKeys.dashboard(context.address),
    aegisKeys.owned(context.address),
    aegisKeys.dashboard(details.owner),
    aegisKeys.ownedCount(details.owner),
    aegisKeys.owned(details.owner),
    aegisKeys.stats,
  ]);
  return { ...transaction, settlementDate };
}

export async function terminalCancelProtection({
  context,
  protectionId,
  onProgress,
  queryClient,
}: {
  context: WriteContext;
  protectionId: bigint;
  onProgress?: ProgressCallback | undefined;
  queryClient?: QueryClient | undefined;
}) {
  if (!context.address) throw new Error("WALLET_NOT_CONNECTED");
  const details = await getProtectionDetails(protectionId, context.address);
  const [readiness, authorization] = await Promise.all([
    getTerminalCancellationReadiness(protectionId, context.address),
    canSettleProtection(context.address, protectionId),
  ]);
  if (!authorization.authorized) throw new Error("UNAUTHORIZED_CALLER");
  if (!readiness.eligible) throw new Error("TERMINAL_CANCELLATION_NOT_READY");
  const transaction = await writeAegisContract({
    context,
    functionName: AEGIS_METHODS.terminalCancelProtection,
    args: [protectionId],
    onProgress,
  });
  await invalidate(queryClient, [
    aegisKeys.details(protectionId),
    aegisKeys.history(protectionId),
    aegisKeys.terminalReadiness(protectionId),
    aegisKeys.readiness(protectionId, readiness.earliest_unresolved_date),
    aegisKeys.settlementAuthorization(protectionId, context.address),
    aegisKeys.dashboard(context.address),
    aegisKeys.owned(context.address),
    aegisKeys.dashboard(details.owner),
    aegisKeys.ownedCount(details.owner),
    aegisKeys.owned(details.owner),
    aegisKeys.stats,
    aegisKeys.pool,
  ]);
  return transaction;
}

export async function addSettlementOperator({
  context,
  operator,
  onProgress,
  queryClient,
}: {
  context: WriteContext;
  operator: Address;
  onProgress?: ProgressCallback | undefined;
  queryClient?: QueryClient | undefined;
}) {
  const zero = "0x0000000000000000000000000000000000000000";
  if (!isAddress(operator) || operator.toLowerCase() === zero) {
    throw new Error("INVALID_SETTLEMENT_OPERATOR");
  }
  const [count, approved] = await Promise.all([
    getSettlementOperatorCount(),
    isSettlementOperator(operator),
  ]);
  if (approved) throw new Error("SETTLEMENT_OPERATOR_ALREADY_APPROVED");
  if (count >= 5) throw new Error("SETTLEMENT_OPERATOR_LIMIT_REACHED");
  const transaction = await writeAegisContract({
    context,
    functionName: AEGIS_METHODS.addSettlementOperator,
    args: [operator],
    onProgress,
  });
  await invalidate(queryClient, [
    aegisKeys.operatorCount,
    aegisKeys.operators,
    aegisKeys.operator(operator),
    ["aegis", "settlement-authorization"],
  ]);
  return transaction;
}

export async function removeSettlementOperator({
  context,
  operator,
  onProgress,
  queryClient,
}: {
  context: WriteContext;
  operator: Address;
  onProgress?: ProgressCallback | undefined;
  queryClient?: QueryClient | undefined;
}) {
  if (!isAddress(operator) || !(await isSettlementOperator(operator))) {
    throw new Error("SETTLEMENT_OPERATOR_NOT_FOUND");
  }
  const transaction = await writeAegisContract({
    context,
    functionName: AEGIS_METHODS.removeSettlementOperator,
    args: [operator],
    onProgress,
  });
  await invalidate(queryClient, [
    aegisKeys.operatorCount,
    aegisKeys.operators,
    aegisKeys.operator(operator),
    ["aegis", "settlement-authorization"],
  ]);
  return transaction;
}

export async function claimPayout({
  context,
  protectionId,
  onProgress,
  queryClient,
}: {
  context: WriteContext;
  protectionId: bigint;
  onProgress?: ProgressCallback | undefined;
  queryClient?: QueryClient | undefined;
}) {
  if (!context.address) throw new Error("WALLET_NOT_CONNECTED");
  const details = await getProtectionDetails(protectionId, context.address);
  if (details.owner.toLowerCase() !== context.address.toLowerCase()) {
    throw new Error("UNAUTHORIZED_CALLER");
  }
  if (details.status !== "CLAIMABLE" || !details.can_claim || details.claimed) {
    throw new Error("PROTECTION_NOT_CLAIMABLE");
  }
  const transaction = await writeAegisContract({
    context,
    functionName: AEGIS_METHODS.claimPayout,
    args: [protectionId],
    onProgress,
  });
  await invalidate(queryClient, [
    aegisKeys.details(protectionId),
    aegisKeys.dashboard(context.address),
    aegisKeys.owned(context.address),
    aegisKeys.stats,
    aegisKeys.pool,
    ["balance"],
  ]);
  return { ...transaction, payout: details.payout };
}
