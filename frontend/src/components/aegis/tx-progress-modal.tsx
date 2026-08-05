import { useEffect, useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TxStepId = "preparing" | "wallet" | "consensus" | "confirming" | "completed";

const STEPS: { id: TxStepId; label: string; hint: string; ms: number }[] = [
  { id: "preparing", label: "Preparing", hint: "Building the protection transaction", ms: 1100 },
  { id: "wallet", label: "Awaiting Wallet", hint: "Approve the request in your wallet", ms: 1500 },
  {
    id: "consensus",
    label: "Validator Consensus",
    hint: "Independent validators are agreeing on the locked reference price. This step can take a little longer.",
    ms: 2600,
  },
  { id: "confirming", label: "Confirming", hint: "Writing the protection onchain", ms: 1400 },
  { id: "completed", label: "Completed", hint: "Your protection is active", ms: 0 },
];

export function TransactionProgressModal({
  open,
  onOpenChange,
  title = "Purchasing protection",
  onCompleted,
  completedHref,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  onCompleted?: () => void;
  completedHref?: () => void;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setIndex(0);
      return;
    }
    if (index >= STEPS.length - 1) {
      onCompleted?.();
      return;
    }
    const t = setTimeout(() => setIndex((i) => i + 1), STEPS[index]?.ms ?? 1200);
    return () => clearTimeout(t);
  }, [open, index, onCompleted]);

  const done = index >= STEPS.length - 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (done) onOpenChange(v);
      }}
    >
      <DialogContent
        className={cn("sm:max-w-md", !done && "[&>button:last-child]:hidden")}
        onEscapeKeyDown={(e) => !done && e.preventDefault()}
        onInteractOutside={(e) => !done && e.preventDefault()}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="flex flex-col items-center pt-2 text-center">
          <div
            className={cn(
              "flex size-14 items-center justify-center rounded-2xl transition-colors",
              done ? "bg-success/12 text-success" : "bg-primary/8 text-primary",
            )}
          >
            {done ? <ShieldCheck className="size-7" /> : <Loader2 className="size-6 animate-spin" />}
          </div>
          <h2 className="display mt-4 text-2xl">{done ? "Protection is live" : title}</h2>
          <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
            {done
              ? "Daily settlement begins tomorrow and runs for every day of cover."
              : "Keep this window open until all steps complete."}
          </p>
        </div>

        <ol className="mt-6 space-y-1">
          {STEPS.map((step, i) => {
            const state = i < index ? "done" : i === index ? "current" : "todo";
            return (
              <li
                key={step.id}
                className={cn(
                  "flex gap-3 rounded-lg px-3 py-3 transition-colors",
                  state === "current" && "bg-secondary",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.6rem]",
                    state === "done" && "border-success bg-success text-success-foreground",
                    state === "current" && "border-primary text-primary",
                    state === "todo" && "border-border text-muted-foreground",
                  )}
                >
                  {state === "done" ? (
                    <Check className="size-3" />
                  ) : state === "current" ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-sm font-medium",
                      state === "todo" ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                  {state === "current" && (
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {step.hint}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>

        {done && (
          <div className="mt-4 flex flex-col gap-2">
            <Button onClick={() => completedHref?.()}>View in dashboard</Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
