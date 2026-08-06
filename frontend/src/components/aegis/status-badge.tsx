import { cn } from "@/lib/utils";
import type { ContractStatus, SettlementDayState } from "@/lib/aegis/types";
import { contractStatusLabel } from "@/lib/aegis/format";

const STATUS_STYLES: Record<ContractStatus, string> = {
  ACTIVE: "bg-info/10 text-info border-info/25",
  CLAIMABLE: "bg-brass/15 text-brass-foreground border-brass/45",
  EXPIRED: "bg-muted text-muted-foreground border-border",
  CLAIMED: "bg-success/12 text-success border-success/30",
};

export function StatusBadge({ status, className }: { status: ContractStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.1em]",
        STATUS_STYLES[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {contractStatusLabel(status)}
    </span>
  );
}

const DAY_STYLES: Record<SettlementDayState, string> = {
  UPCOMING: "bg-muted text-muted-foreground border-border",
  READY: "bg-brass/15 text-brass-foreground border-brass/45",
  SETTLING: "bg-info/10 text-info border-info/25",
  NOT_BREACHED: "bg-success/12 text-success border-success/30",
  BREACHED: "bg-destructive/10 text-destructive border-destructive/30",
  INCONCLUSIVE: "bg-warning/15 text-warning-foreground border-warning/40",
};

export const DAY_LABEL: Record<SettlementDayState, string> = {
  UPCOMING: "Upcoming",
  READY: "Ready",
  SETTLING: "Settling",
  NOT_BREACHED: "No qualifying move",
  BREACHED: "Qualifying move confirmed",
  INCONCLUSIVE: "Awaiting confirmation",
};

export function DayStateBadge({
  state,
  className,
}: {
  state: SettlementDayState;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.68rem] font-medium",
        DAY_STYLES[state],
        className,
      )}
    >
      {DAY_LABEL[state]}
    </span>
  );
}
