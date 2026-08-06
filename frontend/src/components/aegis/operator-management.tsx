import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAddress, isAddress, type Address } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWalletState } from "@/hooks/use-wallet-state";
import { getSettlementOperatorCount, getSettlementOperators } from "@/lib/aegis/contract-reads";
import { addSettlementOperator, removeSettlementOperator } from "@/lib/aegis/contract-writes";
import { normalizeAegisError, publicReadErrorMessage } from "@/lib/aegis/errors";
import { aegisConfig } from "@/lib/aegis/contract-config";
import { aegisKeys } from "@/lib/aegis/query-keys";
import { useTransactionManager } from "@/lib/aegis/transaction-context";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function OperatorManagement() {
  const wallet = useWalletState();
  const queryClient = useQueryClient();
  const transaction = useTransactionManager();
  const [input, setInput] = useState("");
  const [working, setWorking] = useState<Address | "add" | null>(null);
  const [formError, setFormError] = useState("");
  const isContractOwner = Boolean(
    wallet.address && wallet.address.toLowerCase() === aegisConfig.ownerAddress.toLowerCase(),
  );
  const count = useQuery({
    queryKey: aegisKeys.operatorCount,
    queryFn: getSettlementOperatorCount,
    enabled: isContractOwner,
  });
  const operators = useQuery({
    queryKey: aegisKeys.operators,
    queryFn: getSettlementOperators,
    enabled: isContractOwner,
  });

  if (!wallet.isConnected || !isContractOwner) return null;

  const normalizedInput = isAddress(input) ? getAddress(input) : null;
  const isOwnerAddress = Boolean(
    normalizedInput &&
    wallet.address &&
    normalizedInput.toLowerCase() === wallet.address.toLowerCase(),
  );
  const isDuplicate = Boolean(
    normalizedInput &&
    operators.data?.some((operator) => operator.toLowerCase() === normalizedInput.toLowerCase()),
  );
  const addDisabled =
    working !== null ||
    count.data === undefined ||
    count.data >= 5 ||
    !normalizedInput ||
    normalizedInput.toLowerCase() === ZERO_ADDRESS ||
    isOwnerAddress ||
    isDuplicate ||
    wallet.isWrongNetwork;
  const readError = count.error ?? operators.error;

  async function add() {
    if (!normalizedInput || addDisabled) return;
    setFormError("");
    setWorking("add");
    transaction.begin("Adding settlement operator");
    try {
      await addSettlementOperator({
        context: wallet.getWriteContext(),
        operator: normalizedInput,
        onProgress: transaction.onProgress,
        queryClient,
      });
      setInput("");
    } catch (error) {
      setFormError(normalizeAegisError(error).message);
      transaction.fail(error);
    } finally {
      setWorking(null);
    }
  }

  async function remove(operator: Address) {
    setFormError("");
    setWorking(operator);
    transaction.begin("Removing settlement operator");
    try {
      await removeSettlementOperator({
        context: wallet.getWriteContext(),
        operator,
        onProgress: transaction.onProgress,
        queryClient,
      });
    } catch (error) {
      setFormError(normalizeAegisError(error).message);
      transaction.fail(error);
    } finally {
      setWorking(null);
    }
  }

  return (
    <section className="surface-card mt-8 p-6 sm:p-7" aria-labelledby="operator-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Owner controls</p>
          <h2 id="operator-heading" className="mt-2 text-xl font-medium">
            Settlement operators
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Approved operators can settle any active protection. Up to five can be active at once.
          </p>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-sm">
          {count.data ?? "—"} / 5 active
        </span>
      </div>

      {readError ? (
        <p className="mt-4 text-sm text-destructive">{publicReadErrorMessage(readError)}</p>
      ) : null}
      <div className="mt-5 space-y-2">
        {(operators.data ?? []).map((operator) => (
          <div
            key={operator}
            className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/30 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="numeric break-all text-sm">{operator}</span>
            <Button
              type="button"
              variant="outline"
              disabled={working !== null || wallet.isWrongNetwork}
              onClick={() => void remove(operator)}
            >
              {working === operator ? "Removing…" : "Remove"}
            </Button>
          </div>
        ))}
        {operators.data?.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            No settlement operators are approved.
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Input
          aria-label="Settlement operator address"
          value={input}
          onChange={(event) => {
            setInput(event.target.value.trim());
            setFormError("");
          }}
          placeholder="0x… operator address"
          spellCheck={false}
        />
        <Button type="button" disabled={addDisabled} onClick={() => void add()}>
          {working === "add" ? "Adding…" : "Add operator"}
        </Button>
      </div>
      {input && !normalizedInput ? (
        <p className="mt-2 text-sm text-destructive">Enter a valid EVM address.</p>
      ) : isOwnerAddress ? (
        <p className="mt-2 text-sm text-destructive">
          The owner wallet cannot be added as an operator.
        </p>
      ) : isDuplicate ? (
        <p className="mt-2 text-sm text-destructive">
          This address is already an approved settlement operator.
        </p>
      ) : count.data === 5 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          The five-operator limit has been reached.
        </p>
      ) : null}
      {formError ? <p className="mt-2 text-sm text-destructive">{formError}</p> : null}
    </section>
  );
}
