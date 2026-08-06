import type { TransactionProgress } from "./types";

export const PENDING_TRANSACTION_STORAGE_KEY = "aegis.pending-transaction.v1";

type PendingStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function persistTransactionProgress(storage: PendingStorage, next: TransactionProgress) {
  if (next.stage === "completed" || next.stage === "failed" || !next.hash) {
    storage.removeItem(PENDING_TRANSACTION_STORAGE_KEY);
  } else {
    storage.setItem(PENDING_TRANSACTION_STORAGE_KEY, JSON.stringify(next));
  }
}
