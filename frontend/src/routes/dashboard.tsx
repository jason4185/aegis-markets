import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import { ArrowRight, ShieldPlus } from "lucide-react";
import { PageHeader } from "@/components/aegis/page-header";
import { StatusBadge } from "@/components/aegis/status-badge";
import { WalletControl } from "@/components/aegis/wallet-control";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getMyDashboardSummary,
  getMyProtections,
  getOwnedProtectionCount,
  getProtectionDetails,
  getSettlementReadiness,
} from "@/lib/aegis/contract-reads";
import { publicReadErrorMessage } from "@/lib/aegis/errors";
import { formatDate, formatGen, formatPrice, formatProtectionId } from "@/lib/aegis/format";
import { aegisKeys } from "@/lib/aegis/query-keys";
import type { ContractStatus, ProtectionCard } from "@/lib/aegis/types";
import { useWalletState } from "@/hooks/use-wallet-state";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "My Protections — Aegis Markets" }] }),
  component: Dashboard,
});

type Filter = "ALL" | ContractStatus | "READY";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "ACTIVE", label: "Active" },
  { id: "READY", label: "Settlement ready" },
  { id: "CLAIMABLE", label: "Claimable" },
  { id: "EXPIRED", label: "Expired" },
  { id: "CLAIMED", label: "Claimed" },
];

function Dashboard() {
  const wallet = useWalletState();
  const [filter, setFilter] = useState<Filter>("ALL");
  const address = wallet.address;
  const summary = useQuery({
    queryKey: aegisKeys.dashboard(address),
    queryFn: () => getMyDashboardSummary(address!),
    enabled: Boolean(address),
  });
  const count = useQuery({
    queryKey: aegisKeys.ownedCount(address),
    queryFn: () => getOwnedProtectionCount(address!),
    enabled: Boolean(address),
  });
  const protections = useInfiniteQuery({
    queryKey: aegisKeys.owned(address),
    queryFn: ({ pageParam }) => {
      const remaining = count.data! - pageParam;
      const limit = Number(remaining > 50n ? 50n : remaining);
      return getMyProtections(address!, pageParam, limit);
    },
    initialPageParam: 0n,
    enabled: Boolean(address && count.data && count.data > 0n),
    getNextPageParam: (_lastPage, pages) => {
      const loaded = BigInt(pages.reduce((total, page) => total + page.length, 0));
      return count.data && loaded < count.data ? loaded : undefined;
    },
  });
  const allProtections = useMemo(() => protections.data?.pages.flat() ?? [], [protections.data]);
  const detailQueries = useQueries({
    queries: allProtections.map((item) => ({
      queryKey: aegisKeys.details(item.id),
      queryFn: () => getProtectionDetails(item.id, address),
      enabled: Boolean(address),
    })),
  });
  const readinessQueries = useQueries({
    queries: detailQueries.map((details, index) => {
      const protectionId = allProtections[index]?.id ?? 0n;
      const date = details.data?.next_unresolved_settlement_date ?? "";
      return {
        queryKey: aegisKeys.readiness(protectionId, date),
        queryFn: () => getSettlementReadiness(protectionId, date, address),
        enabled: Boolean(address && date),
      };
    }),
  });
  const readyIds = new Set(
    readinessQueries.flatMap((query, index) =>
      query.data?.ready && allProtections[index] ? [allProtections[index].id.toString()] : [],
    ),
  );
  const filtered = allProtections.filter((item) =>
    filter === "ALL"
      ? true
      : filter === "READY"
        ? readyIds.has(item.id.toString())
        : item.status === filter,
  );
  const error =
    summary.error ?? count.error ?? protections.error ?? detailQueries.find((q) => q.error)?.error;

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="My protections"
        description="View the protections owned by the currently connected wallet."
        actions={
          <Button asChild size="lg">
            <Link
              to="/protection/new"
              search={{ market: undefined, threshold: undefined, duration: undefined }}
            >
              <ShieldPlus className="size-4" /> New protection
            </Link>
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {!wallet.isConnected ? (
          <div className="surface-card flex flex-col items-center px-6 py-16 text-center">
            <h2 className="display text-2xl">Connect your wallet to view your protections.</h2>
            <div className="mt-6">
              <WalletControl />
            </div>
          </div>
        ) : (
          <>
            {error ? (
              <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {publicReadErrorMessage(error)}
              </div>
            ) : null}
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3 lg:grid-cols-5">
              <Metric
                label="Total"
                value={summary.data?.total_protections}
                loading={summary.isLoading}
              />
              <Metric
                label="Active"
                value={summary.data?.active_count}
                loading={summary.isLoading}
              />
              <Metric
                label="Settlement ready"
                value={BigInt(readyIds.size)}
                loading={detailQueries.some((q) => q.isLoading)}
              />
              <Metric
                label="Claimable"
                value={summary.data?.claimable_count}
                loading={summary.isLoading}
              />
              <Metric
                label="Expired"
                value={summary.data?.expired_count}
                loading={summary.isLoading}
              />
              <Metric
                label="Claimed"
                value={summary.data?.claimed_count}
                loading={summary.isLoading}
              />
              <Metric
                label="Premiums paid"
                value={summary.data?.total_premiums_paid}
                loading={summary.isLoading}
                money
              />
              <Metric
                label="Claimable payout"
                value={summary.data?.total_claimable_payout}
                loading={summary.isLoading}
                money
              />
              <Metric
                label="Payouts received"
                value={summary.data?.total_payouts_received}
                loading={summary.isLoading}
                money
              />
            </dl>

            {count.data === 0n ? (
              <div className="surface-card mt-8 flex flex-col items-center px-6 py-16 text-center">
                <h3 className="display text-2xl">No protections found for this wallet.</h3>
                <Button asChild className="mt-6">
                  <Link
                    to="/protection/new"
                    search={{ market: undefined, threshold: undefined, duration: undefined }}
                  >
                    Get Protection <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="mt-10 overflow-x-auto">
                  <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
                    <TabsList>
                      {FILTERS.map((item) => (
                        <TabsTrigger key={item.id} value={item.id}>
                          {item.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
                <div className="mt-6 space-y-4">
                  {(count.isLoading || protections.isLoading) &&
                    [0, 1, 2].map((item) => (
                      <Skeleton key={item} className="h-52 w-full rounded-xl" />
                    ))}
                  {!protections.isLoading && filtered.length === 0 ? (
                    <div className="surface-card px-6 py-12 text-center text-sm text-muted-foreground">
                      No protections match this filter.
                    </div>
                  ) : null}
                  {filtered.map((item) => {
                    const details =
                      detailQueries[
                        allProtections.findIndex((candidate) => candidate.id === item.id)
                      ]?.data;
                    return (
                      <ProtectionRow
                        key={item.id.toString()}
                        protection={item}
                        nextDate={details?.next_unresolved_settlement_date ?? ""}
                        ready={readyIds.has(item.id.toString())}
                      />
                    );
                  })}
                </div>
                {protections.hasNextPage ? (
                  <div className="mt-6 flex justify-center">
                    <Button
                      variant="outline"
                      disabled={protections.isFetchingNextPage}
                      onClick={() => void protections.fetchNextPage()}
                    >
                      {protections.isFetchingNextPage ? "Loading…" : "Load more"}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  loading,
  money = false,
}: {
  label: string;
  value?: bigint | undefined;
  loading: boolean;
  money?: boolean;
}) {
  return (
    <div className="bg-card px-5 py-6">
      <dt className="text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="display mt-2 text-2xl">
        {loading ? (
          <Skeleton className="h-7 w-12" />
        ) : value === undefined ? (
          "—"
        ) : money ? (
          formatGen(value)
        ) : (
          value.toString()
        )}
      </dd>
    </div>
  );
}

function ProtectionRow({
  protection,
  nextDate,
  ready,
}: {
  protection: ProtectionCard;
  nextDate: string;
  ready: boolean;
}) {
  const progress = Math.round(
    (Number(protection.processed_dates) / protection.duration_days) * 100,
  );
  return (
    <article className="surface-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="display text-2xl">{protection.symbol}</h3>
            <StatusBadge status={protection.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {protection.direction === "DOWN" ? "Downward move" : "Upward move"} ·{" "}
            {protection.event_percent}% · {protection.duration_days} days ·{" "}
            <span className="numeric">{formatProtectionId(protection.id)}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Fixed payout</p>
          <p className="numeric text-xl text-brass-foreground">{formatGen(protection.payout)}</p>
        </div>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Field
          label="Reference price"
          value={formatPrice(protection.reference_price, protection.symbol)}
        />
        <Field
          label="Trigger price"
          value={formatPrice(protection.trigger_price, protection.symbol)}
        />
        <Field
          label="Purchased"
          value={new Date(Number(protection.purchased_at * 1000n)).toLocaleDateString("en-GB", {
            timeZone: "UTC",
          })}
        />
        <Field
          label="Next settlement"
          value={nextDate ? `${formatDate(nextDate)}${ready ? " · Ready" : ""}` : "None remaining"}
        />
      </dl>
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Settlement progress: {protection.processed_dates.toString()} of{" "}
            {protection.duration_days} dates completed
          </span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="mt-2 h-1.5" />
      </div>
      <div className="mt-6 border-t border-border pt-5">
        <Button asChild variant="outline">
          <Link to="/protection/$id" params={{ id: protection.id.toString() }}>
            View details
          </Link>
        </Button>
      </div>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="numeric mt-1 text-sm">{value}</dd>
    </div>
  );
}
