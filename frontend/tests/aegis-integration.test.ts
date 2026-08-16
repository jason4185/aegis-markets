import { describe, expect, it } from "bun:test";
import { file } from "bun";
import type { Address } from "viem";
import {
  AEGIS_PROTECTION_ADDRESS,
  AEGIS_OWNER_ADDRESS,
  BRADBURY_CHAIN_ID,
  BRADBURY_EXPLORER_URL,
  BRADBURY_RPC_URL,
  aegisConfig,
  parseAegisConfig,
} from "../src/lib/aegis/contract-config";
import {
  contractBigInt,
  mapMarkets,
  mapProductTerms,
  mapSettlementAuthorization,
  mapSettlementReadiness,
  mapTerminalCancellationReadiness,
} from "../src/lib/aegis/contract-mappers";
import {
  contractStatusLabel,
  formatGen,
  formatGenUnits,
  formatPrice,
  formatScaled,
  reserveStatusLabel,
  settlementResultLabel,
} from "../src/lib/aegis/format";
import {
  isEip1193Provider,
  parseProviderChainId,
  prepareAegisWriteClient,
  waitForAcceptedExecution,
  writeAegisContract,
} from "../src/lib/aegis/contract-writes";
import {
  PENDING_TRANSACTION_STORAGE_KEY,
  persistTransactionProgress,
} from "../src/lib/aegis/transaction-storage";
import { normalizeAegisError } from "../src/lib/aegis/errors";
import { AEGIS_METHODS } from "../src/lib/aegis/contract-schema";
import { aegisKeys } from "../src/lib/aegis/query-keys";
import {
  isDailySettlementProcessable,
  settlementAvailabilityMessage,
  settlementDateAvailability,
} from "../src/lib/aegis/settlement-time";

const ACCOUNT = "0x1111111111111111111111111111111111111111" as Address;
const OTHER = "0x2222222222222222222222222222222222222222" as Address;
const HASH = "0xabcdef" as const;

async function source(path: string) {
  return file(new URL(path, import.meta.url)).text();
}

function provider(accounts: string[] = [ACCOUNT], chainId: unknown = "0x107d") {
  const methods: string[] = [];
  return {
    methods,
    request: async ({ method }: { method: string }) => {
      methods.push(method);
      if (method === "eth_accounts") return accounts;
      if (method === "eth_chainId") return chainId;
      throw new Error(`Unexpected method ${method}`);
    },
  };
}

describe("Bradbury configuration", () => {
  it("uses only the verified Bradbury deployment", () => {
    expect(BRADBURY_CHAIN_ID).toBe(4221);
    expect(BRADBURY_RPC_URL).toBe("https://rpc-bradbury.genlayer.com");
    expect(BRADBURY_EXPLORER_URL).toBe("https://explorer-bradbury.genlayer.com");
    expect(AEGIS_PROTECTION_ADDRESS).toBe("0x50C0073170f9de34e57227739441A153af2f5f84");
    expect(AEGIS_OWNER_ADDRESS).toBe("0xC8Ba5DA455b011863F2ECa76a6fa21E62Cc91B87");
    expect(aegisConfig.networkName).toBe("GenLayer Bradbury");
  });

  it("validates address, chain and URLs", () => {
    expect(() => parseAegisConfig({ VITE_AEGIS_CONTRACT_ADDRESS: "bad" })).toThrow(
      "VITE_AEGIS_CONTRACT_ADDRESS",
    );
    expect(() => parseAegisConfig({ VITE_AEGIS_OWNER_ADDRESS: "bad" })).toThrow(
      "VITE_AEGIS_OWNER_ADDRESS",
    );
    expect(() => parseAegisConfig({ VITE_GENLAYER_CHAIN_ID: "1" })).toThrow(
      "VITE_GENLAYER_CHAIN_ID",
    );
    expect(() => parseAegisConfig({ VITE_GENLAYER_RPC_URL: "ftp://invalid" })).toThrow(
      "VITE_GENLAYER_RPC_URL",
    );
  });

  it("passes public address parameters as complete strings", async () => {
    const reads = await source("../src/lib/aegis/contract-reads.ts");
    const writes = await source("../src/lib/aegis/contract-writes.ts");
    expect(reads).not.toContain("CalldataAddress");
    expect(reads).not.toContain("toCalldataAddress");
    expect(reads).toContain("[account]");
    expect(reads).toContain("[operator]");
    expect(reads).toContain("[caller, protectionId]");
    expect(writes).not.toContain("toCalldataAddress");
    expect(writes).toContain("args: [operator]");
  });

  it("configures an injected connector only", async () => {
    const wagmi = await source("../src/lib/web3/wagmi.ts");
    const env = await source("../.env.example");
    expect(wagmi).toContain("injected({");
    expect(wagmi).toContain("multiInjectedProviderDiscovery: true");
    expect(wagmi).not.toContain("walletConnect(");
    expect(wagmi).not.toContain("projectId");
    expect(env.toLowerCase()).not.toContain("walletconnect");
  });

  it("contains the current production address", async () => {
    const config = await source("../src/lib/aegis/contract-config.ts");
    const env = await source("../.env.example");
    expect(`${config}\n${env}`).toContain(AEGIS_PROTECTION_ADDRESS);
  });

  it("matches the deployed operator schema and omits manual expiry", () => {
    expect(AEGIS_METHODS.addSettlementOperator).toBe("add_settlement_operator");
    expect(AEGIS_METHODS.removeSettlementOperator).toBe("remove_settlement_operator");
    expect(AEGIS_METHODS.isSettlementOperator).toBe("is_settlement_operator");
    expect(AEGIS_METHODS.getSettlementOperatorCount).toBe("get_settlement_operator_count");
    expect(AEGIS_METHODS.getSettlementOperatorAt).toBe("get_settlement_operator_at");
    expect(AEGIS_METHODS.getSettlementOperators).toBe("get_settlement_operators");
    expect(AEGIS_METHODS.canSettleProtection).toBe("can_settle_protection");
    expect(AEGIS_METHODS.getTerminalCancellationReadiness).toBe(
      "get_terminal_cancellation_readiness",
    );
    expect(AEGIS_METHODS.terminalCancelProtection).toBe("terminal_cancel_protection");
    expect(Object.values(AEGIS_METHODS)).not.toContain(
      ["finalize", "expired", "protection"].join("_"),
    );
  });

  it("scopes contract query data by chain and deployment address", () => {
    const scope = ["aegis", BRADBURY_CHAIN_ID, AEGIS_PROTECTION_ADDRESS.toLowerCase()];
    expect(aegisKeys.scope).toEqual(scope);
    expect(aegisKeys.dashboard(ACCOUNT)).toEqual([...scope, "dashboard", ACCOUNT.toLowerCase()]);
    expect(aegisKeys.owned(ACCOUNT)).toEqual([
      ...scope,
      "owned-protections",
      ACCOUNT.toLowerCase(),
      0,
    ]);
    expect(aegisKeys.dashboard(ACCOUNT)).not.toEqual(["aegis", "dashboard", ACCOUNT.toLowerCase()]);
  });
});

describe("fresh active-provider validation", () => {
  it("retrieves the active provider and checks accounts then chain", async () => {
    const active = provider();
    const result = await prepareAegisWriteClient(
      {
        address: ACCOUNT,
        chainId: 4221,
        activeConnector: { getProvider: async () => active },
      },
      ((input: unknown) => input) as never,
    );
    expect(result.account).toBe(ACCOUNT);
    expect(result.providerChainId).toBe(4221);
    expect(active.methods).toEqual(["eth_accounts", "eth_chainId"]);
  });

  it("recognizes EIP-1193 providers and parses exact chain IDs", () => {
    expect(isEip1193Provider(provider())).toBe(true);
    expect(isEip1193Provider({})).toBe(false);
    expect(parseProviderChainId("0x107d")).toBe(4221);
    expect(parseProviderChainId("4221")).toBe(4221);
    expect(parseProviderChainId(4221n)).toBe(4221);
  });

  it("rejects provider/account mismatch", async () => {
    await expect(
      prepareAegisWriteClient(
        {
          address: ACCOUNT,
          chainId: 4221,
          activeConnector: { getProvider: () => provider([OTHER]) },
        },
        ((input: unknown) => input) as never,
      ),
    ).rejects.toThrow("WALLET_ACCOUNT_MISMATCH");
  });

  it("rejects the wrong provider chain", async () => {
    await expect(
      prepareAegisWriteClient(
        {
          address: ACCOUNT,
          chainId: 4221,
          activeConnector: { getProvider: () => provider([ACCOUNT], "0x1") },
        },
        ((input: unknown) => input) as never,
      ),
    ).rejects.toThrow("WRONG_NETWORK");
  });
});

describe("bigint-safe contract mapping", () => {
  it("formats GEN and PRICE_SCALE without floating point", () => {
    expect(formatGenUnits(1_234_500_000_000_000_000n)).toBe("1.2345");
    expect(formatGen(10_000_000_000_000_000_000n)).toBe("10 GEN");
    expect(formatPrice(123_456_780n)).toBe("1.2345678");
    expect(formatScaled(1n, 8)).toBe("0.00000001");
  });

  it("rejects imprecise numeric contract values", () => {
    expect(contractBigInt("1000000000000000000")).toBe(1_000_000_000_000_000_000n);
    expect(() => contractBigInt(1_000_000_000_000_000_000)).toThrow("not an exact integer");
  });

  it("maps contract market IDs and all term fields", () => {
    const markets = mapMarkets([
      { market_id: "GBP_USD", symbol: "GBP/USD", category: "CURRENCY", direction: "DOWN" },
    ]);
    expect(markets[0].market_id).toBe("GBP_USD");
    const terms = mapProductTerms([
      {
        duration_days: 14,
        event_percent: 3,
        event_bps: 300,
        premium: "2000000000000000000",
        payout: "5000000000000000000",
      },
    ]);
    expect(terms[0]).toEqual({
      duration_days: 14,
      event_percent: 3,
      event_bps: 300n,
      premium: 2_000_000_000_000_000_000n,
      payout: 5_000_000_000_000_000_000n,
    });
  });

  it("maps live readiness reason codes", () => {
    const readiness = mapSettlementReadiness({
      protection_id: 0,
      market_id: "GBP_USD",
      settlement_date: "2026-08-06",
      settlement_day: 1,
      current_utc_day: 1,
      inside_protection_window: true,
      is_future_date: false,
      protection_status: "ACTIVE",
      previous_result: "UNPROCESSED",
      market_settlement_exists: false,
      market_settlement_finalized: false,
      market_settlement_version: 0,
      retryable: false,
      ready: true,
      reason_code: "READY",
    });
    expect(readiness.ready).toBe(true);
    expect(readiness.reason_code).toBe("READY");
  });

  it("maps blocked settlement-day and settlement-order readiness states", () => {
    const base = {
      protection_id: 0,
      market_id: "GBP_USD",
      settlement_date: "2026-08-07",
      settlement_day: 1,
      current_utc_day: 1,
      inside_protection_window: true,
      is_future_date: false,
      protection_status: "ACTIVE",
      previous_result: "UNPROCESSED",
      market_settlement_exists: false,
      market_settlement_finalized: false,
      market_settlement_version: 0,
      retryable: false,
      ready: false,
    };
    expect(
      mapSettlementReadiness({ ...base, reason_code: "SETTLEMENT_DAY_NOT_COMPLETE" }),
    ).toMatchObject({ ready: false, reason_code: "SETTLEMENT_DAY_NOT_COMPLETE" });
    expect(mapSettlementReadiness({ ...base, reason_code: "SETTLEMENT_ORDER" })).toMatchObject({
      ready: false,
      reason_code: "SETTLEMENT_ORDER",
    });
  });

  it("preserves enabled readiness states", () => {
    const base = {
      protection_id: 0,
      market_id: "GBP_USD",
      settlement_date: "2026-08-07",
      settlement_day: 1,
      current_utc_day: 2,
      inside_protection_window: true,
      is_future_date: false,
      protection_status: "ACTIVE",
      previous_result: "UNPROCESSED",
      market_settlement_exists: true,
      market_settlement_finalized: true,
      market_settlement_version: 1,
      retryable: false,
      ready: true,
    };
    for (const reason_code of [
      "READY",
      "MARKET_SETTLEMENT_AVAILABLE",
      "MARKET_SETTLEMENT_RETRYABLE",
    ] as const) {
      expect(mapSettlementReadiness({ ...base, reason_code })).toMatchObject({
        ready: true,
        reason_code,
      });
    }
  });

  it("rejects unknown settlement readiness reason codes", () => {
    expect(() =>
      mapSettlementReadiness({
        protection_id: 0,
        market_id: "GBP_USD",
        settlement_date: "2026-08-07",
        settlement_day: 1,
        current_utc_day: 1,
        inside_protection_window: true,
        is_future_date: false,
        protection_status: "ACTIVE",
        previous_result: "UNPROCESSED",
        market_settlement_exists: false,
        market_settlement_finalized: false,
        market_settlement_version: 0,
        retryable: false,
        ready: false,
        reason_code: "UNKNOWN_REASON",
      }),
    ).toThrow("reason_code");
  });

  it("maps owner, operator, protection-owner and unrelated authorization results", () => {
    expect(
      mapSettlementAuthorization({
        authorized: true,
        is_contract_owner: true,
        is_operator: false,
        is_protection_owner: false,
      }),
    ).toMatchObject({ authorized: true, is_contract_owner: true });
    expect(
      mapSettlementAuthorization({
        authorized: true,
        is_contract_owner: false,
        is_operator: true,
        is_protection_owner: false,
      }),
    ).toMatchObject({ authorized: true, is_operator: true });
    expect(
      mapSettlementAuthorization({
        authorized: true,
        is_contract_owner: false,
        is_operator: false,
        is_protection_owner: true,
      }),
    ).toMatchObject({ authorized: true, is_protection_owner: true });
    expect(
      mapSettlementAuthorization({
        authorized: false,
        is_contract_owner: false,
        is_operator: false,
        is_protection_owner: false,
      }).authorized,
    ).toBe(false);
  });

  it("maps deterministic terminal-cancellation readiness and stable reason codes", () => {
    expect(
      mapTerminalCancellationReadiness({
        protection_id: 0,
        eligible: true,
        reason_code: "READY",
        earliest_unresolved_date: "2026-08-15",
        terminal_grace_days: 3,
        terminal_eligible_date: "2026-08-19",
        current_utc_day: 10,
        protection_status: "ACTIVE",
      }),
    ).toEqual({
      protection_id: 0n,
      eligible: true,
      reason_code: "READY",
      earliest_unresolved_date: "2026-08-15",
      terminal_grace_days: 3n,
      terminal_eligible_date: "2026-08-19",
      current_utc_day: 10n,
      protection_status: "ACTIVE",
    });
    expect(() =>
      mapTerminalCancellationReadiness({
        protection_id: 0,
        eligible: false,
        reason_code: "UNKNOWN_REASON",
        earliest_unresolved_date: "2026-08-15",
        terminal_grace_days: 3,
        terminal_eligible_date: "2026-08-19",
        current_utc_day: 10,
        protection_status: "ACTIVE",
      }),
    ).toThrow("reason_code");
  });
});

describe("write architecture and lifecycle", () => {
  it("submits the exact supplied base-unit value and completes at ACCEPTED", async () => {
    const active = provider();
    const writes: unknown[] = [];
    const stages: string[] = [];
    let polls = 0;
    const mockClient = {
      writeContract: async (input: unknown) => {
        writes.push(input);
        return HASH;
      },
      getTransaction: async () => {
        polls += 1;
        return {
          statusName: "ACCEPTED",
          txExecutionResultName: "FINISHED_WITH_RETURN",
        };
      },
    };
    await writeAegisContract({
      context: {
        address: ACCOUNT,
        chainId: 4221,
        activeConnector: { getProvider: () => active },
      },
      functionName: AEGIS_METHODS.purchaseProtection,
      args: ["GBP_USD", 14, 3],
      value: 2_000_000_000_000_000_000n,
      onProgress: (progress) => stages.push(progress.stage),
      factory: (() => mockClient) as never,
    });
    expect(writes).toEqual([
      {
        address: AEGIS_PROTECTION_ADDRESS,
        functionName: "purchase_protection",
        args: ["GBP_USD", 14, 3],
        value: 2_000_000_000_000_000_000n,
      },
    ]);
    expect(stages).toEqual(["preparing", "awaiting_wallet", "submitted", "completed"]);
    expect(polls).toBe(1);
  });

  it("continues genuine pending states, then stops polling at ACCEPTED", async () => {
    const receipts = [
      { statusName: "PENDING" },
      { statusName: "PROPOSING" },
      { statusName: "ACCEPTED", txExecutionResultName: "FINISHED_WITH_RETURN" },
      { statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN" },
    ];
    const stages: string[] = [];
    let polls = 0;
    const result = await waitForAcceptedExecution({
      client: {
        getTransaction: async () => {
          const receipt = receipts[polls];
          polls += 1;
          return receipt;
        },
      } as never,
      hash: HASH,
      method: "settle_protection",
      account: ACCOUNT,
      onProgress: (progress) => stages.push(progress.stage),
      wait: async () => undefined,
    });
    expect(result.statusName).toBe("ACCEPTED");
    expect(polls).toBe(3);
    expect(stages).toEqual(["submitted", "validator_consensus", "completed"]);
  });

  it("tolerates FINALIZED but does not require it", async () => {
    const stages: string[] = [];
    const result = await waitForAcceptedExecution({
      client: {
        getTransaction: async () => ({
          statusName: "FINALIZED",
          txExecutionResultName: "FINISHED_WITH_RETURN",
        }),
      } as never,
      hash: HASH,
      method: "claim_payout",
      account: ACCOUNT,
      onProgress: (progress) => stages.push(progress.stage),
      wait: async () => undefined,
    });
    expect(result.statusName).toBe("FINALIZED");
    expect(stages).toEqual(["completed"]);
  });

  it("rejects terminal status and accepted execution failures", async () => {
    const run = (receipt: Record<string, unknown>) =>
      waitForAcceptedExecution({
        client: { getTransaction: async () => receipt } as never,
        hash: HASH,
        method: "settle_protection",
        account: ACCOUNT,
        maxAttempts: 1,
        wait: async () => undefined,
      });
    await expect(run({ statusName: "REJECTED" })).rejects.toThrow("TRANSACTION_REJECTED");
    await expect(
      run({ statusName: "ACCEPTED", txExecutionResultName: "FINISHED_WITH_ERROR" }),
    ).rejects.toThrow("FINISHED_WITH_ERROR");
    await expect(
      run({
        statusName: "ACCEPTED",
        txExecutionResultName: "FINISHED_WITH_RETURN",
        resultName: "FAILURE",
      }),
    ).rejects.toThrow("TRANSACTION_RESULT_FAILURE");
  });

  it("does not use a serialized ACCEPTED substring as success", async () => {
    await expect(
      waitForAcceptedExecution({
        client: {
          getTransaction: async () => ({ statusName: "PENDING", note: "ACCEPTED" }),
        } as never,
        hash: HASH,
        method: "purchase_protection",
        account: ACCOUNT,
        maxAttempts: 1,
        wait: async () => undefined,
      }),
    ).rejects.toThrow("TRANSACTION_STILL_PENDING");
  });

  it("keeps polling timeout pending and never emits completed", async () => {
    const stages: string[] = [];
    let polls = 0;
    await expect(
      waitForAcceptedExecution({
        client: {
          getTransaction: async () => {
            polls += 1;
            return { statusName: "PENDING" };
          },
        } as never,
        hash: HASH,
        method: "purchase_protection",
        account: ACCOUNT,
        maxAttempts: 2,
        onProgress: (progress) => stages.push(progress.stage),
        wait: async () => undefined,
      }),
    ).rejects.toThrow("TRANSACTION_STILL_PENDING");
    expect(polls).toBe(2);
    expect(stages).toEqual(["submitted", "submitted"]);
  });

  it("clears persisted pending state exactly when ACCEPTED maps to completed", async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    persistTransactionProgress(storage, {
      stage: "submitted",
      hash: HASH,
      method: "purchase_protection",
      account: ACCOUNT,
      status: "PENDING",
    });
    expect(values.has(PENDING_TRANSACTION_STORAGE_KEY)).toBe(true);
    const completed: string[] = [];
    await waitForAcceptedExecution({
      client: {
        getTransaction: async () => ({
          statusName: "ACCEPTED",
          txExecutionResultName: "FINISHED_WITH_RETURN",
        }),
      } as never,
      hash: HASH,
      method: "purchase_protection",
      account: ACCOUNT,
      onProgress: (progress) => {
        persistTransactionProgress(storage, progress);
        if (progress.stage === "completed") completed.push(progress.stage);
      },
      wait: async () => undefined,
    });
    expect(values.has(PENDING_TRANSACTION_STORAGE_KEY)).toBe(false);
    expect(completed).toEqual(["completed"]);
  });

  it("runs post-acceptance invalidation and purchase ID discovery in order", async () => {
    const writes = await source("../src/lib/aegis/contract-writes.ts");
    const purchase = writes.slice(
      writes.indexOf("export async function purchaseProtection"),
      writes.indexOf("export async function settleProtection"),
    );
    expect(purchase.indexOf("await writeAegisContract")).toBeLessThan(
      purchase.indexOf("await invalidate"),
    );
    expect(purchase.indexOf("await invalidate")).toBeLessThan(
      purchase.indexOf("const afterIds = await ownerIds"),
    );
    expect(purchase).toContain("for (const delay of [0, 1000, 2000, 3000])");
    const recovery = await source("../src/lib/aegis/transaction-context.tsx");
    expect(recovery).toContain("waitForAcceptedExecution");
    expect(recovery).toContain('invalidateQueries({ queryKey: ["aegis"] })');
    expect(recovery).toContain("processed.current.has(pending.hash)");
  });

  it("uses one accepted-terminal helper for every exposed write", async () => {
    const writes = await source("../src/lib/aegis/contract-writes.ts");
    for (const method of [
      "purchaseProtection",
      "settleProtection",
      "terminalCancelProtection",
      "claimPayout",
      "addSettlementOperator",
      "removeSettlementOperator",
    ]) {
      const start = writes.indexOf(`export async function ${method}`);
      expect(start).toBeGreaterThan(-1);
      expect(writes.slice(start, writes.indexOf("\nexport ", start + 1))).toContain(
        "writeAegisContract",
      );
    }
  });

  it("removes Confirming and finalization copy from the transaction modal", async () => {
    const modal = await source("../src/components/aegis/tx-progress-modal.tsx");
    const types = await source("../src/lib/aegis/types.ts");
    const recovery = await source("../src/lib/aegis/transaction-context.tsx");
    expect(modal).not.toContain("Confirming");
    expect(modal).not.toContain("being finalized");
    expect(modal).not.toContain("waiting for finalization");
    expect(modal).toContain('id: "validator_consensus"');
    expect(types).toContain('| "validator_consensus"');
    expect(types).not.toContain('| "consensus"');
    expect(recovery).toContain('"validator_consensus"');
    expect(recovery).not.toContain('"confirming"');
    expect(modal).toContain("done && index <= currentIndex");
    expect(modal).not.toContain("Validator consensus");
    expect(modal).not.toContain("The transaction was accepted by GenLayer.");
    expect(modal).toContain("Your protection has been created successfully.");
    expect(modal).toContain("Settlement completed successfully.");
    expect(modal).toContain("Your payout was received successfully.");
    expect(modal).toContain("Protection cancelled and original premium refunded.");
    expect(modal).toContain("The operator update was completed successfully.");
    expect(modal).toContain("Transaction details");
    expect(modal).not.toContain("{progress.method}");
  });

  it("keeps purchase review copy user-facing", async () => {
    const review = await source("../src/components/aegis/review-modal.tsx");
    expect(review).toContain(
      "Your wallet will ask you to confirm this purchase and pay the fixed premium in native",
    );
    expect(review).not.toContain("The transaction calls purchase_protection");
    expect(review).not.toContain("base units of native");
  });

  it("requires live authorization and locks settlement to the earliest unresolved date", async () => {
    const writes = await source("../src/lib/aegis/contract-writes.ts");
    const settleSection = writes.slice(
      writes.indexOf("export async function settleProtection"),
      writes.indexOf("export async function claimPayout"),
    );
    expect(settleSection).toContain("next_unresolved_settlement_date");
    expect(settleSection).toContain("getSettlementReadiness");
    expect(settleSection).toContain("canSettleProtection");
    expect(settleSection).toContain("authorization.authorized");
    expect(settleSection).toContain('throw new Error("UNAUTHORIZED_CALLER")');
    expect(settleSection).toContain("isDailySettlementProcessable");
    expect(settleSection).toContain('throw new Error("SETTLEMENT_DATA_NOT_READY")');
    expect(settleSection).toContain("args: [protectionId, settlementDate]");
    expect(settleSection).toContain("readiness.ready");
    expect(settleSection).toContain("aegisKeys.dashboard(details.owner)");
  });

  it("exposes terminal cancellation only after deterministic readiness and authorization", async () => {
    const reads = await source("../src/lib/aegis/contract-reads.ts");
    const writes = await source("../src/lib/aegis/contract-writes.ts");
    const details = await source("../src/routes/protection.$id.tsx");
    expect(reads).toContain("getTerminalCancellationReadiness");
    expect(writes).toContain("getTerminalCancellationReadiness");
    expect(writes).toContain("TERMINAL_CANCELLATION_NOT_READY");
    expect(writes).toContain("args: [protectionId]");
    expect(details).toContain("terminalReadiness.data?.eligible");
    expect(details).toContain("Cancel protection and refund premium");
    expect(details).toContain("released payout");
    expect(details).toContain("was not paid to the user");
  });

  it("does not show retry guidance for a cancelled inconclusive protection", async () => {
    const details = await source("../src/routes/protection.$id.tsx");
    expect(details).toContain(
      "Settlement data remained unresolved through the terminal grace period.",
    );
    const cancellationGuard = details.indexOf('details.data.status !== "CANCELLED"');
    const retryGuidance = details.lastIndexOf(
      "The two sources produced different trigger outcomes.",
    );
    expect(cancellationGuard).toBeGreaterThan(-1);
    expect(cancellationGuard).toBeLessThan(retryGuidance);
    expect(details).toContain("The two sources produced different trigger outcomes.");
  });

  it("has no manual-expiry write and leaves automatic expiry to settlement", async () => {
    const writes = await source("../src/lib/aegis/contract-writes.ts");
    const details = await source("../src/routes/protection.$id.tsx");
    const removed = ["finalize", "expired", "protection"].join("_");
    expect(writes).not.toContain(removed);
    expect(details).not.toContain(["Finalize", "expiry"].join(" "));
    expect(details).toContain("ended automatically after its final required no-move");
    expect(details).toContain("and its reserved payout was released by the contract");
  });

  it("translates contract status and settlement values for product screens", () => {
    expect(contractStatusLabel("ACTIVE")).toBe("Active");
    expect(contractStatusLabel("CLAIMABLE")).toBe("Payout available");
    expect(contractStatusLabel("EXPIRED")).toBe("Ended");
    expect(contractStatusLabel("CLAIMED")).toBe("Paid");
    expect(contractStatusLabel("CANCELLED")).toBe("Cancelled");
    expect(settlementResultLabel("UNPROCESSED")).toBe("Not checked yet");
    expect(settlementResultLabel("INCONCLUSIVE")).toBe("Awaiting confirmation");
    expect(settlementResultLabel("NOT_BREACHED")).toBe("No qualifying move");
    expect(settlementResultLabel("BREACHED")).toBe("Qualifying move confirmed");
    expect(reserveStatusLabel("RESERVED")).toBe("Secured");
    expect(reserveStatusLabel("RELEASED")).toBe("Released");
    expect(contractStatusLabel("unexpected")).toBe("Status unavailable");
    expect(settlementResultLabel("unexpected")).toBe("Status unavailable");
    expect(reserveStatusLabel("unexpected")).toBe("Status unavailable");
  });

  it("contains no approval flow and invalidates contract-backed queries after writes", async () => {
    const writes = await source("../src/lib/aegis/contract-writes.ts");
    expect(writes).not.toMatch(/\.approve\(|allowance|erc-?20/i);
    expect(writes).toContain("invalidateQueries");
    expect(writes).toContain("aegisKeys.stats");
    expect(writes).toContain("aegisKeys.pool");
    expect(writes).toContain("aegisKeys.dashboard");
  });
});

describe("UTC settlement availability", () => {
  it("processes only dates strictly before the current UTC calendar date", () => {
    const midday = new Date("2026-08-07T12:00:00.000Z");
    expect(isDailySettlementProcessable("2026-08-06", midday)).toBe(true);
    expect(isDailySettlementProcessable("2026-08-07", midday)).toBe(false);
    expect(isDailySettlementProcessable("2026-08-08", midday)).toBe(false);
  });

  it("uses UTC rather than the browser's local timezone near midnight", () => {
    expect(isDailySettlementProcessable("2026-08-07", new Date("2026-08-08T04:59:59.999Z"))).toBe(
      true,
    );
    expect(isDailySettlementProcessable("2026-08-08", new Date("2026-08-08T00:00:00.000Z"))).toBe(
      false,
    );
    expect(isDailySettlementProcessable("2026-08-07", new Date("2026-08-08T00:00:00.000Z"))).toBe(
      true,
    );
    expect(isDailySettlementProcessable("2026-08-07", new Date("2026-08-07T23:59:59.999Z"))).toBe(
      false,
    );
  });

  it("rejects malformed and empty settlement dates", () => {
    const now = new Date("2026-08-07T12:00:00.000Z");
    expect(isDailySettlementProcessable("", now)).toBe(false);
    expect(isDailySettlementProcessable("2026-8-07", now)).toBe(false);
    expect(isDailySettlementProcessable("2026-02-30", now)).toBe(false);
    expect(settlementDateAvailability("", now)).toBe("invalid");
  });

  it("explains when today's daily data becomes processable", () => {
    const now = new Date("2026-08-07T12:00:00.000Z");
    expect(settlementAvailabilityMessage("2026-08-07", now)).toBe(
      "Daily market data is still being finalized. Available to settle after 00:00 UTC on 2026-08-08.",
    );
    expect(settlementAvailabilityMessage("2026-08-06", now)).toBeNull();
    expect(settlementAvailabilityMessage("2026-08-08", now)).toBeNull();
  });
});

describe("route states and production data", () => {
  it("has the required disconnected and zero-protection dashboard states", async () => {
    const dashboard = await source("../src/routes/dashboard.tsx");
    expect(dashboard).toContain("Connect your wallet to view your protections.");
    expect(dashboard).toContain("No protections found for this wallet.");
    expect(dashboard).toContain("currentCount === 0n");
    expect(dashboard).toContain("remaining > 50n ? 50n : remaining");
  });

  it("does not render cached dashboard values after a current read fails", async () => {
    const dashboard = await source("../src/routes/dashboard.tsx");
    expect(dashboard).toContain(
      "const currentSummary = summary.isError ? undefined : summary.data",
    );
    expect(dashboard).toContain("const currentCount = count.isError ? undefined : count.data");
    expect(dashboard).toContain("protections.isError ? []");
    expect(dashboard).toContain("currentCount !== undefined && !protections.isError");
  });

  it("keeps internal protection IDs out of ordinary product copy", async () => {
    const dashboard = await source("../src/routes/dashboard.tsx");
    const details = await source("../src/routes/protection.$id.tsx");
    const review = await source("../src/components/aegis/review-modal.tsx");
    expect(dashboard).not.toContain("formatProtectionId");
    expect(dashboard).not.toContain("Protection #");
    expect(details).not.toContain("PROTECTION #");
    expect(details).not.toContain("Market ID");
    expect(details).not.toContain("value={details.data.reserve_status}");
    expect(details).not.toContain("value={details.data.latest_settlement_result}");
    expect(details).not.toContain('label="Inconclusive dates"');
    expect(details).not.toContain('label="Processed dates"');
    expect(details).toContain("Your wallet");
    expect(review).not.toContain("quote.market_id");
  });

  it("shows settlement only after readiness and contract authorization", async () => {
    const details = await source("../src/routes/protection.$id.tsx");
    expect(details).toContain("authorization.data?.authorized");
    expect(details).toContain("dailyDataComplete");
    expect(details).toContain("Available after daily close");
    expect(details).toContain("settlementAvailabilityMessage");
    expect(details).toContain("You are not authorized to settle this protection.");
    expect(details).toContain("next_unresolved_settlement_date");
    expect(details).toContain("SETTLEMENT_DAY_NOT_COMPLETE");
    expect(details).toContain("SETTLEMENT_ORDER");
    expect(details).toContain("Daily market data is still being finalized.");
    expect(details).toContain("An earlier settlement date must be completed first.");
    expect(details).toContain("readiness.data?.ready");
    expect(details).not.toContain('type="date"');
  });

  it("keeps operator management owner-only and bounded to five", async () => {
    const panel = await source("../src/components/aegis/operator-management.tsx");
    const writes = await source("../src/lib/aegis/contract-writes.ts");
    expect(panel).toContain("aegisConfig.ownerAddress");
    expect(panel).toContain("!isContractOwner");
    expect(panel).toContain("count.data >= 5");
    expect(panel).toContain("isDuplicate");
    expect(panel).toContain("isOwnerAddress");
    expect(panel).toContain("ZERO_ADDRESS");
    expect(writes).toContain("aegisKeys.operatorCount");
    expect(writes).toContain("aegisKeys.operators");
    expect(writes).toContain("aegisKeys.settlementAuthorizationRoot");
  });

  it("contains no production mock service or fabricated transaction timer", async () => {
    const purchase = await source("../src/routes/protection.new.tsx");
    const modal = await source("../src/components/aegis/tx-progress-modal.tsx");
    expect(purchase).not.toMatch(/mock-data|contract-service|parseEther|\.approve\(/i);
    expect(modal).not.toContain("setTimeout");
    expect(modal).toContain("progress.stage");
  });
});

describe("normalized errors", () => {
  it.each([
    ["INVALID_MARKET", "This market is not supported."],
    ["INVALID_PREMIUM", "The transaction value does not match the current premium."],
    ["INSUFFICIENT_AVAILABLE_LIQUIDITY", "enough available liquidity"],
    ["WALLET_ACCOUNT_MISMATCH", "does not match the active provider account"],
    ["WRONG_NETWORK", "GenLayer Bradbury"],
    ["SETTLEMENT_OPERATOR_ALREADY_APPROVED", "already an approved settlement operator"],
    ["SETTLEMENT_OPERATOR_NOT_FOUND", "not an approved settlement operator"],
    ["SETTLEMENT_OPERATOR_LIMIT_REACHED", "maximum of five"],
    ["INVALID_SETTLEMENT_OPERATOR", "valid operator address"],
    ["INVALID_SETTLEMENT_OPERATOR_INDEX", "operator entry does not exist"],
    ["INVALID_ADDRESS", "wallet address is invalid"],
  ])("maps %s", (code, expected) => {
    expect(normalizeAegisError(new Error(code)).message).toContain(expected);
  });

  it("strips source prefixes from user-facing errors", () => {
    const transient = normalizeAegisError(
      new Error("[TRANSIENT] EXTERNAL_SOURCE_UNAVAILABLE"),
    ).message;
    const external = normalizeAegisError(
      new Error("[EXTERNAL] EXTERNAL_SOURCE_UNAVAILABLE"),
    ).message;
    expect(transient).not.toContain("[TRANSIENT]");
    expect(external).not.toContain("[EXTERNAL]");
  });
});
