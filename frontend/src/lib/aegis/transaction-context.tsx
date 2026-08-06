import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TransactionProgressModal } from "@/components/aegis/tx-progress-modal";
import { createAegisReadClient } from "./contract-client";
import { waitForAcceptedExecution } from "./contract-writes";
import { normalizeAegisError } from "./errors";
import { PENDING_TRANSACTION_STORAGE_KEY, persistTransactionProgress } from "./transaction-storage";
import type { TransactionProgress } from "./types";

type TransactionContextValue = {
  progress: TransactionProgress;
  open: boolean;
  setOpen: (open: boolean) => void;
  onProgress: (progress: TransactionProgress) => void;
  fail: (error: unknown) => void;
  begin: (title: string) => void;
  checkAgain: () => void;
  checking: boolean;
  title: string;
};

const TransactionContext = createContext<TransactionContextValue | null>(null);

const TRANSACTION_STAGES: ReadonlySet<string> = new Set([
  "idle",
  "preparing",
  "awaiting_wallet",
  "submitted",
  "validator_consensus",
  "completed",
  "failed",
]);

function isTransactionProgress(value: unknown): value is TransactionProgress {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  if (typeof item["stage"] !== "string") return false;
  if (!TRANSACTION_STAGES.has(item["stage"])) return false;
  return [
    "method",
    "account",
    "contractAddress",
    "hash",
    "status",
    "explorerUrl",
    "error",
    "submittedAt",
    "updatedAt",
  ].every((key) => item[key] === undefined || typeof item[key] === "string");
}

function loadProgress(): TransactionProgress {
  if (typeof window === "undefined") return { stage: "idle" };
  try {
    const stored = window.sessionStorage.getItem(PENDING_TRANSACTION_STORAGE_KEY);
    if (!stored) return { stage: "idle" };
    const parsed: unknown = JSON.parse(stored);
    return isTransactionProgress(parsed) ? parsed : { stage: "idle" };
  } catch {
    return { stage: "idle" };
  }
}

export function TransactionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<TransactionProgress>({ stage: "idle" });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Transaction");
  const [checking, setChecking] = useState(false);
  const polling = useRef(false);
  const processed = useRef(new Set<string>());

  const onProgress = useCallback((next: TransactionProgress) => {
    setProgress(next);
    if (typeof window !== "undefined") {
      persistTransactionProgress(window.sessionStorage, next);
    }
  }, []);

  const fail = useCallback((error: unknown) => {
    const raw = error instanceof Error ? error.message : String(error);
    const normalized = normalizeAegisError(error);
    setProgress((current) => {
      if (raw.includes("TRANSACTION_STILL_PENDING")) {
        const pending: TransactionProgress = {
          ...current,
          error: "The transaction is still pending on GenLayer. Check the explorer for updates.",
          updatedAt: new Date().toISOString(),
        };
        if (typeof window !== "undefined") {
          persistTransactionProgress(window.sessionStorage, pending);
        }
        return pending;
      }
      const next: TransactionProgress = {
        ...current,
        stage: "failed",
        error: normalized.message,
        updatedAt: new Date().toISOString(),
      };
      if (typeof window !== "undefined") {
        persistTransactionProgress(window.sessionStorage, next);
      }
      return next;
    });
  }, []);

  const begin = useCallback((nextTitle: string) => {
    setTitle(nextTitle);
    setProgress({ stage: "preparing", updatedAt: new Date().toISOString() });
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(PENDING_TRANSACTION_STORAGE_KEY);
    }
    setOpen(true);
  }, []);

  const pollPending = useCallback(
    async (pending: TransactionProgress) => {
      if (!pending.hash || !pending.account || !pending.method || polling.current) return;
      polling.current = true;
      setChecking(true);
      setProgress((current) =>
        current.hash === pending.hash ? { ...current, error: undefined } : current,
      );
      try {
        await waitForAcceptedExecution({
          client: createAegisReadClient(),
          hash: pending.hash,
          method: pending.method,
          account: pending.account,
          onProgress,
        });
        if (processed.current.has(pending.hash)) return;
        processed.current.add(pending.hash);
        await queryClient.invalidateQueries({ queryKey: ["aegis"] });
      } catch (error) {
        fail(error);
      } finally {
        polling.current = false;
        setChecking(false);
      }
    },
    [fail, onProgress, queryClient],
  );

  useEffect(() => {
    const stored = loadProgress();
    if (stored.stage === "idle" || stored.stage === "completed" || stored.stage === "failed") {
      if (typeof window !== "undefined") {
        persistTransactionProgress(window.sessionStorage, stored);
      }
      return;
    }
    setProgress(stored);
    void pollPending(stored);
  }, [pollPending]);

  const checkAgain = useCallback(() => {
    void pollPending(progress);
  }, [pollPending, progress]);

  const value = useMemo(
    () => ({ progress, open, setOpen, onProgress, fail, begin, checkAgain, checking, title }),
    [begin, checkAgain, checking, fail, onProgress, open, progress, title],
  );

  return (
    <TransactionContext.Provider value={value}>
      {children}
      <TransactionProgressModal
        open={open}
        onOpenChange={setOpen}
        progress={progress}
        title={title}
        checking={checking}
        onCheckAgain={checkAgain}
      />
    </TransactionContext.Provider>
  );
}

export function useTransactionManager() {
  const context = useContext(TransactionContext);
  if (!context) throw new Error("TransactionProvider is missing.");
  return context;
}
