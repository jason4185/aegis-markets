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
import { formatGen } from "@/lib/aegis/format";
import type { ProtectionQuote } from "@/lib/aegis/types";
import { aegisConfig } from "@/lib/aegis/contract-config";
import { shortenAddress } from "@/lib/web3/wallet";

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
  walletAddress,
  canConfirm,
  confirmMessage,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  quote: ProtectionQuote | null;
  walletAddress?: string | undefined;
  canConfirm: boolean;
  confirmMessage?: string | undefined;
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
            {quote.symbol} · {quote.event_percent}% · {quote.duration_days} days
          </DialogTitle>
          <DialogDescription>
            Confirm the current onchain terms before requesting the payable transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-border rounded-lg border border-border bg-secondary/40 px-4">
          <div className="py-1">
            <Row
              label="Connected wallet"
              value={walletAddress ? shortenAddress(walletAddress) : "Not connected"}
            />
            <Row label="Network" value={`${aegisConfig.networkName} (${aegisConfig.chainId})`} />
            <Row
              label="Contract"
              value={
                <span className="numeric text-xs">
                  {shortenAddress(aegisConfig.contractAddress)}
                </span>
              }
            />
          </div>
          <div className="py-1">
            <Row label="Market" value={`${quote.symbol} (${quote.market_id})`} />
            <Row label="Protected direction" value={direction} />
            <Row label="Movement threshold" value={`${quote.event_percent}%`} />
            <Row label="Protection period" value={`${quote.duration_days} days`} />
          </div>
          <div className="py-1">
            <Row
              label="Premium"
              value={<span className="numeric">{formatGen(quote.premium)}</span>}
            />
            <Row
              label="Fixed payout"
              value={
                <span className="numeric text-brass-foreground">{formatGen(quote.payout)}</span>
              }
            />
            <Row label="Reference price" value="Locked during purchase" />
            <Row label="Trigger price" value="Calculated after purchase" />
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Your wallet will ask you to confirm this purchase and pay the fixed premium in native GEN.
        </p>
        {confirmMessage ? <p className="text-sm text-destructive">{confirmMessage}</p> : null}

        <Separator />
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button onClick={onConfirm} disabled={!canConfirm}>
            Confirm purchase
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
