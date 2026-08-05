import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ShieldPlus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/aegis/page-header";
import { StatusBadge } from "@/components/aegis/status-badge";
import { TransactionProgressModal } from "@/components/aegis/tx-progress-modal";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { contractService } from "@/lib/aegis/contract-service";
import { formatDate, formatPrice, formatUsd } from "@/lib/aegis/format";
import type { ContractStatus, ProtectionCard } from "@/lib/aegis/types";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Protections — Aegis Markets" },
      {
        name: "description",
        content:
          "Track active, claimable, expired and claimed protections for your connected wallet, with daily settlement status.",
      },
      { property: "og:title", content: "My Protections — Aegis Markets" },
      {
        property: "og:description",
        content: "Settlement due, claimable payouts and coverage progress in one place.",
      },
    ],
  }),
  component: Dashboard,
});

type Filter = "ALL" | ContractStatus | "DUE";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "ACTIVE", label: "Active" },
  { id: "DUE", label: "Settlement due" },
  { id: "CLAIMABLE", label: "Claimable" },
  { id: "EXPIRED", label: "Expired" },
  { id: "CLAIMED", label: "Claimed" },
];

function Dashboard() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [txOpen, setTxOpen] = useState(false);
  const [txTitle, setTxTitle] = useState("Settling today");

  const summary = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => contractService.get_my_dashboard_summary(),
  });
  const protections = useQuery({
    queryKey: ["my-protections"],
    queryFn: () => contractService.get_my_protections(),
  });

  const list = (protections.data ?? []).filter((p) =>
    filter === "ALL" ? true : filter === "DUE" ? p.settlementDue : p.status === filter,
  );

  const runTx = (title: string) => {
    setTxTitle(title);
    setTxOpen(true);
  };

  return (
    <>
      <PageHeader
        eyebrow="Wallet 0x4c19…9d02"
        title="My protections"
        description="Everything covering your wallet, with the earliest unresolved settlement always surfaced first."
        actions={
          <Button asChild size="lg">
            <Link to="/protection/new">
              <ShieldPlus className="size-4" /> New protection
            </Link>
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {/* Summary metrics */}
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Total", value: summary.data?.total },
            { label: "Active", value: summary.data?.active },
            { label: "Settlement due", value: summary.data?.settlementDue },
            { label: "Claimable", value: summary.data?.claimable },
            { label: "Expired", value: summary.data?.expired },
            { label: "Claimed", value: summary.data?.claimed },
          ].map((s) => (
            <div key={s.label} className="bg-card px-5 py-6">
              <dt className="text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
                {s.label}
              </dt>
              <dd className="display mt-2 text-3xl">
                {summary.isLoading ? <Skeleton className="h-7 w-10" /> : (s.value ?? 0)}
              </dd>
            </div>
          ))}
        </dl>

        {/* Filters */}
        <div className="mt-10 overflow-x-auto">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              {FILTERS.map((f) => (
                <TabsTrigger key={f.id} value={f.id}>
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* List */}
        <div className="mt-6 space-y-4">
          {protections.isLoading &&
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-52 w-full rounded-xl" />)}

          {!protections.isLoading && list.length === 0 && (
            <div className="surface-card flex flex-col items-center px-6 py-16 text-center">
              <h3 className="display text-2xl">Nothing here yet</h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                No protections match this filter. Set up cover on any of the five supported markets.
              </p>
              <Button asChild className="mt-6">
                <Link to="/protection/new">
                  Get Protection <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          )}

          {list.map((p) => (
            <ProtectionRow key={p.id} p={p} onAction={runTx} />
          ))}
        </div>
      </div>

      <TransactionProgressModal
        open={txOpen}
        onOpenChange={setTxOpen}
        title={txTitle}
        completedHref={() => {
          setTxOpen(false);
          toast.success("Transaction confirmed by validator consensus");
        }}
      />
    </>
  );
}

function ProtectionRow({
  p,
  onAction,
}: {
  p: ProtectionCard;
  onAction: (title: string) => void;
}) {
  const progress = Math.round((p.daysElapsed / p.duration) * 100);

  return (
    <article className="surface-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="display text-2xl">{p.symbol}</h3>
            <StatusBadge status={p.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {p.direction === "DOWN" ? "Downward move" : "Upward move"} · {p.threshold}% ·{" "}
            {p.duration} days · <span className="numeric">{p.id}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Fixed payout</p>
          <p className="numeric text-xl text-brass-foreground">{formatUsd(p.fixedPayout)}</p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Field label="Reference price" value={formatPrice(p.referencePrice, p.symbol)} />
        <Field label="Trigger price" value={formatPrice(p.triggerPrice, p.symbol)} />
        <Field
          label="Coverage"
          value={`${formatDate(p.coverageStart)} → ${formatDate(p.coverageEnd)}`}
          mono={false}
        />
        <Field
          label="Next settlement"
          value={p.nextSettlementDate ? formatDate(p.nextSettlementDate) : "None remaining"}
          mono={false}
        />
      </dl>

      <div className="mt-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Day {Math.min(p.daysElapsed, p.duration)} of {p.duration}
          </span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="mt-2 h-1.5" />
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
        {p.status === "CLAIMABLE" ? (
          <Button onClick={() => onAction("Claiming payout")}>Claim Payout</Button>
        ) : p.settlementDue ? (
          <Button onClick={() => onAction("Settling today")}>Settle Today</Button>
        ) : p.status === "ACTIVE" ? (
          <Button disabled title="Next settlement not yet eligible">
            Settle Today
          </Button>
        ) : null}

        <Button asChild variant="outline">
          <Link to="/protection/$id" params={{ id: p.id }}>
            {p.status === "CLAIMED" || p.status === "EXPIRED" ? "View Receipt" : "View Details"}
          </Link>
        </Button>
      </div>
    </article>
  );
}

function Field({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-sm ${mono ? "numeric" : ""}`}>{value}</dd>
    </div>
  );
}
