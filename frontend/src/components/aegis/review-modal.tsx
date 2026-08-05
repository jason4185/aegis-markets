import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatPrice, formatUsd } from "@/lib/aegis/format";
import type { Quote } from "@/lib/aegis/types";

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export function ReviewModal({
  open,
  onOpenChange,
  quote,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quote: Quote | null;
  onConfirm: () => void;
}) {
  if (!quote) return null;
  const direction = quote.direction === "DOWN" ? "Downward move" : "Upward move";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <p className="eyebrow">Review protection</p>
          <DialogTitle className="display text-2xl">
            {quote.symbol} · {quote.threshold}% · {quote.duration} days
          </DialogTitle>
          <DialogDescription>
            Confirm the terms below. Premium and fixed payout are set by the contract and cannot
            change after purchase.
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-border rounded-lg border border-border bg-secondary/40 px-4">
          <div className="py-1">
            <Row label="Market" value={quote.symbol} />
            <Row label="Protected direction" value={direction} />
            <Row label="Movement threshold" value={`${quote.threshold}%`} />
            <Row label="Duration" value={`${quote.duration} days`} />
          </div>
          <div className="py-1">
            <Row label="Premium" value={<span className="numeric">{formatUsd(quote.premium)}</span>} />
            <Row
              label="Fixed payout"
              value={
                <span className="numeric text-brass-foreground">{formatUsd(quote.fixedPayout)}</span>
              }
            />
            <Row
              label="Trigger price"
              value={
                <span className="numeric">{formatPrice(quote.triggerPrice, quote.symbol)}</span>
              }
            />
          </div>
          <div className="py-1">
            <Row label="Reference source" value={quote.referenceSource} />
            <Row
              label="Settlement sources"
              value={
                <span className="block max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
                  {quote.settlementSources[0]}
                  <br />
                  {quote.settlementSources[1]}
                </span>
              }
            />
          </div>
          <div className="py-1">
            <Row
              label="Expected coverage"
              value={`${formatDate(quote.coverageStart)} → ${formatDate(quote.coverageEnd)}`}
            />
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          The reference price is fetched and locked at the moment of purchase. Settlement runs once
          per day using two independent sources and validator consensus.
        </p>

        <Separator />

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button onClick={onConfirm}>Confirm Purchase</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
