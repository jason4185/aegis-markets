import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { DayStateBadge, StatusBadge, resultLabel } from "@/components/aegis/status-badge";
import { TransactionProgressModal } from "@/components/aegis/tx-progress-modal";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { contractService } from "@/lib/aegis/contract-service";
import { formatDate, formatPrice, formatShortDate, formatUsd, truncateHash } from "@/lib/aegis/format";
import { PRODUCT_TERMS } from "@/lib/aegis/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/protection/$id")({
  head: () => ({
    meta: [
      { title: "Protection Details — Aegis Markets" },
      {
        name: "description",
        content:
          "Contract terms, reference and trigger prices, daily settlement timeline and full settlement history for a single protection.",
      },
      { property: "og:title", content: "Protection Details — Aegis Markets" },
      {
        property: "og:description",
        content: "Every settled day, every source, every result — for one protection.",
      },
    ],
  }),
  component: ProtectionDetail,
});

function ProtectionDetail() {
  const { id } = Route.useParams();
  const [txOpen, setTxOpen] = useState(false);
  const [txTitle, setTxTitle] = useState("Settling today");

  const details = useQuery({
    queryKey: ["protection", id],
    queryFn: () => contractService.get_protection_details(id),
  });
  const readiness = useQuery({
    queryKey: ["readiness", id],
    queryFn: () => contractService.get_settlement_readiness(id),
  });

  if (details.isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-16 sm:px-6">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const p = details.data;
  if (!p) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-24 text-center sm:px-6">
        <h1 className="display text-3xl">Protection not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          We couldn&apos;t find a protection with the id {id}.
        </p>
        <Button asChild className="mt-8">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  const progress = Math.round((p.daysElapsed / p.duration) * 100);
  const history = p.timeline.filter((d) => d.result !== "UNPROCESSED").slice().reverse();

  const primaryAction = () => {
    if (p.status === "CLAIMABLE")
      return { label: "Claim Payout", title: "Claiming payout", disabled: false };
    if (p.status === "ACTIVE" && readiness.data?.isEligibleNow)
      return { label: "Settle Today", title: "Settling today", disabled: false };
    if (p.status === "ACTIVE")
      return { label: "Settle Today", title: "Settling today", disabled: true };
    if (p.status === "EXPIRED")
      return { label: "Finalize Protection", title: "Finalizing protection", disabled: false };
    return { label: "Payout claimed", title: "", disabled: true };
  };
  const action = primaryAction();

  return (
    <>
      {/* Header */}
      <div className="border-b border-border bg-card/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 md:py-14">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> My protections
          </Link>
          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow numeric">{p.id}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="display text-4xl md:text-5xl">{p.symbol}</h1>
                <StatusBadge status={p.status} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {p.direction === "DOWN" ? "Downward move" : "Upward move"} · {p.threshold}% over{" "}
                {p.duration} days · {formatDate(p.coverageStart)} → {formatDate(p.coverageEnd)}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                disabled={action.disabled}
                onClick={() => {
                  setTxTitle(action.title);
                  setTxOpen(true);
                }}
              >
                {action.label}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.85fr] lg:items-start">
          <div className="space-y-6">
            {/* Overview */}
            <section className="surface-card p-6 sm:p-7">
              <h2 className="text-lg font-medium">Overview</h2>
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                <Field label="Reference price" value={formatPrice(p.referencePrice, p.symbol)} />
                <Field label="Trigger price" value={formatPrice(p.triggerPrice, p.symbol)} />
                <Field label="Latest price" value={formatPrice(p.currentPrice, p.symbol)} />
                <Field label="Fixed payout" value={formatUsd(p.fixedPayout)} accent />
              </dl>
              <div className="mt-7">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Day {Math.min(p.daysElapsed, p.duration)} of {p.duration}
                  </span>
                  <span>
                    {readiness.data?.pendingDays
                      ? `${readiness.data.pendingDays} day(s) awaiting settlement`
                      : "No settlement pending"}
                  </span>
                </div>
                <Progress value={progress} className="mt-2 h-1.5" />
              </div>
            </section>

            {/* Settlement calendar */}
            <section className="surface-card p-6 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-medium">Settlement timeline</h2>
                {readiness.data?.earliestEligibleDate && (
                  <p className="text-xs text-muted-foreground">
                    Earliest unresolved day:{" "}
                    <span className="font-medium text-foreground">
                      {formatDate(readiness.data.earliestEligibleDate)}
                    </span>
                  </p>
                )}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {p.timeline.map((d, i) => (
                  <div
                    key={d.date}
                    className={cn(
                      "rounded-lg border p-3",
                      d.state === "READY"
                        ? "border-brass/45 bg-brass/8"
                        : "border-border bg-secondary/40",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="numeric text-xs text-muted-foreground">
                        Day {i + 1} · {formatShortDate(d.date)}
                      </span>
                    </div>
                    <div className="mt-2">
                      <DayStateBadge state={d.state} />
                    </div>
                    {d.consensusPrice !== null && (
                      <p className="numeric mt-2 text-xs text-muted-foreground">
                        {formatPrice(d.consensusPrice, p.symbol)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* History */}
            <section className="surface-card overflow-hidden">
              <div className="border-b border-border px-6 py-5">
                <h2 className="text-lg font-medium">Settlement history</h2>
              </div>
              {history.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                  No days settled yet. The first settlement becomes available one day after cover
                  starts.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Source A</TableHead>
                        <TableHead>Source B</TableHead>
                        <TableHead>Consensus</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead className="text-right">Tx</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((d) => (
                        <TableRow key={d.date}>
                          <TableCell className="numeric">{formatDate(d.date)}</TableCell>
                          <TableCell className="numeric">
                            {d.sourceA !== null ? formatPrice(d.sourceA, p.symbol) : "—"}
                          </TableCell>
                          <TableCell className="numeric">
                            {d.sourceB !== null ? formatPrice(d.sourceB, p.symbol) : "—"}
                          </TableCell>
                          <TableCell className="numeric">
                            {d.consensusPrice !== null
                              ? formatPrice(d.consensusPrice, p.symbol)
                              : "—"}
                          </TableCell>
                          <TableCell>{resultLabel(d.result)}</TableCell>
                          <TableCell className="numeric text-right text-muted-foreground">
                            {d.txHash ? (
                              <span className="inline-flex items-center gap-1">
                                {truncateHash(d.txHash)}
                                <ExternalLink className="size-3" />
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </div>

          {/* Terms */}
          <aside className="lg:sticky lg:top-24">
            <div className="surface-card overflow-hidden">
              <div className="border-b border-border px-6 py-5">
                <p className="eyebrow">Contract terms</p>
              </div>
              <dl className="divide-y divide-border px-6">
                <Row label="Market" value={p.symbol} />
                <Row
                  label="Protected direction"
                  value={p.direction === "DOWN" ? "Downward move" : "Upward move"}
                />
                <Row label="Threshold" value={`${p.threshold}%`} />
                <Row label="Duration" value={`${p.duration} days`} />
                <Row label="Premium" value={formatUsd(p.premium)} />
                <Row label="Fixed payout" value={formatUsd(p.fixedPayout)} />
                <Row label="Owner" value={p.owner} />
                <Row label="Purchase tx" value={truncateHash(p.purchaseTx)} />
              </dl>
              <div className="border-t border-border px-6 py-5">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Settled daily using {PRODUCT_TERMS.settlementSources[0]} and{" "}
                  {PRODUCT_TERMS.settlementSources[1]}, confirmed by validator consensus. Claims are
                  owner-only.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <TransactionProgressModal
        open={txOpen}
        onOpenChange={setTxOpen}
        title={txTitle}
        completedHref={() => {
          setTxOpen(false);
          toast.success("Confirmed by validator consensus");
        }}
      />
    </>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("numeric mt-1 text-base", accent && "text-brass-foreground")}>{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="numeric text-sm font-medium">{value}</dd>
    </div>
  );
}
