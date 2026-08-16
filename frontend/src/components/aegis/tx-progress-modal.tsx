import { Check, CircleAlert, ExternalLink, Loader2 } from "lucide-react";
import { LogoMark } from "./logo-mark";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TransactionProgress, TransactionStage } from "@/lib/aegis/types";

const STEPS: { id: TransactionStage; label: string; hint: string }[] = [
  {
    id: "preparing",
    label: "Preparing",
    hint: "Checking your wallet and preparing the request.",
  },
  {
    id: "awaiting_wallet",
    label: "Awaiting wallet",
    hint: "Review and approve the transaction in your wallet.",
  },
  { id: "submitted", label: "Submitted", hint: "The transaction was submitted." },
  {
    id: "validator_consensus",
    label: "Processing",
    hint: "The network is processing the transaction.",
  },
  {
    id: "completed",
    label: "Completed",
    hint: "Your request was completed successfully.",
  },
];

const ORDER: TransactionStage[] = STEPS.map((step) => step.id);

export function TransactionProgressModal({
  open,
  onOpenChange,
  progress,
  title,
  checking = false,
  onCheckAgain,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  progress: TransactionProgress;
  title: string;
  checking?: boolean | undefined;
  onCheckAgain?: (() => void) | undefined;
}) {
  const failed = progress.stage === "failed";
  const done = progress.stage === "completed";
  const currentIndex = failed
    ? Math.max(
        0,
        ORDER.findIndex((stage) => stage === "submitted"),
      )
    : Math.max(0, ORDER.indexOf(progress.stage));
  const canClose = Boolean(progress.hash) || done || failed;

  return (
    <>
      {!open && progress.hash && !done && !failed ? (
        <Button
          type="button"
          size="sm"
          className="fixed bottom-4 right-4 z-50 shadow-lg"
          onClick={() => onOpenChange(true)}
        >
          <Loader2 className="size-4 animate-spin" /> Transaction pending
        </Button>
      ) : null}
      <Dialog open={open} onOpenChange={(value) => canClose && onOpenChange(value)}>
        <DialogContent
          className={cn("sm:max-w-md", !canClose && "[&>button:last-child]:hidden")}
          onEscapeKeyDown={(event) => !canClose && event.preventDefault()}
          onInteractOutside={(event) => !canClose && event.preventDefault()}
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <div className="flex flex-col items-center pt-2 text-center">
            <div
              className={cn(
                "flex size-14 items-center justify-center rounded-2xl",
                done
                  ? "bg-success/12 text-success"
                  : failed
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/8 text-primary",
              )}
            >
              {done ? (
                <LogoMark className="size-8" />
              ) : failed ? (
                <CircleAlert className="size-6" />
              ) : (
                <Loader2 className="size-6 animate-spin" />
              )}
            </div>
            <h2 className="display mt-4 text-2xl">
              {done ? "Completed" : failed ? "Transaction failed" : title}
            </h2>
            <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
              {failed
                ? progress.error
                : progress.error
                  ? progress.error
                  : canClose && !done
                    ? "You can close this window and return to the pending transaction from the indicator."
                    : done
                      ? completionMessage(progress.method)
                      : "Keep this window open until the transaction is submitted."}
            </p>
          </div>

          <ol className="mt-6 space-y-1">
            {STEPS.map((step, index) => {
              const state =
                done && index <= currentIndex
                  ? "done"
                  : index < currentIndex
                    ? "done"
                    : index === currentIndex
                      ? "current"
                      : "todo";
              return (
                <li
                  key={step.id}
                  className={cn(
                    "flex gap-3 rounded-lg px-3 py-3",
                    state === "current" && "bg-secondary",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.6rem]",
                      state === "done" && "border-success bg-success text-success-foreground",
                      state === "current" && !failed && "border-primary text-primary",
                      state === "current" && failed && "border-destructive text-destructive",
                      state === "todo" && "border-border text-muted-foreground",
                    )}
                  >
                    {state === "done" ? (
                      <Check className="size-3" />
                    ) : state === "current" && !failed ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-sm font-medium",
                        state === "todo" && "text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </span>
                    {state === "current" && !failed ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {step.hint}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>

          {progress.hash ? (
            <details className="rounded-lg border border-border bg-secondary/40 p-3 text-xs">
              <summary className="cursor-pointer font-medium">Transaction details</summary>
              <p className="numeric mt-2 break-all text-muted-foreground">{progress.hash}</p>
              {progress.explorerUrl ? (
                <a
                  className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
                  href={progress.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View in explorer <ExternalLink className="size-3" />
                </a>
              ) : null}
            </details>
          ) : null}

          {canClose ? (
            <div className="flex gap-2">
              {!done && !failed && progress.error && onCheckAgain ? (
                <Button
                  className="flex-1"
                  variant="outline"
                  disabled={checking}
                  onClick={onCheckAgain}
                >
                  {checking ? <Loader2 className="size-4 animate-spin" /> : null}
                  Check again
                </Button>
              ) : null}
              <Button
                className="flex-1"
                variant={done ? "default" : "ghost"}
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function completionMessage(method?: string) {
  if (method === "purchase_protection") {
    return "Your protection has been created successfully.";
  }
  if (method === "settle_protection") {
    return "Settlement completed successfully.";
  }
  if (method === "claim_payout") {
    return "Your payout was received successfully.";
  }
  if (method === "terminal_cancel_protection") {
    return "Protection cancelled and original premium refunded.";
  }
  if (method === "add_settlement_operator" || method === "remove_settlement_operator") {
    return "The operator update was completed successfully.";
  }
  return "Transaction completed successfully.";
}
