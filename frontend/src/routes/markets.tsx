import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Coins, Landmark, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/aegis/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { getProductTerms, getSupportedMarkets } from "@/lib/aegis/contract-reads";
import { aegisKeys } from "@/lib/aegis/query-keys";
import { MARKET_PRESENTATION } from "@/lib/aegis/presentation";
import { formatGen } from "@/lib/aegis/format";
import { publicReadErrorMessage } from "@/lib/aegis/errors";

export const Route = createFileRoute("/markets")({
  head: () => ({
    meta: [
      { title: "Supported Markets — Aegis Markets" },
      {
        name: "description",
        content:
          "Five protected markets: GBP/USD, USD/JPY, USD/TRY, gold and silver. See protected direction, thresholds and durations.",
      },
      { property: "og:title", content: "Supported Markets — Aegis Markets" },
      {
        property: "og:description",
        content: "Protected direction, thresholds and durations for all five Aegis markets.",
      },
    ],
  }),
  component: MarketsPage,
});

function MarketsPage() {
  const markets = useQuery({
    queryKey: aegisKeys.markets,
    queryFn: getSupportedMarkets,
    staleTime: 5 * 60_000,
  });
  const terms = useQuery({
    queryKey: aegisKeys.terms,
    queryFn: getProductTerms,
    staleTime: 5 * 60_000,
  });
  const thresholds = [...new Set(terms.data?.map((item) => item.event_percent) ?? [])];
  const durations = [...new Set(terms.data?.map((item) => item.duration_days) ?? [])];
  const premiums = terms.data?.map((item) => item.premium) ?? [];
  const payouts = terms.data?.map((item) => item.payout) ?? [];
  const premiumRange = premiums.length
    ? `${formatGen(premiums.reduce((a, b) => (a < b ? a : b)))}–${formatGen(premiums.reduce((a, b) => (a > b ? a : b)))}`
    : "—";
  const payoutRange = payouts.length
    ? `${formatGen(payouts.reduce((a, b) => (a < b ? a : b)))}–${formatGen(payouts.reduce((a, b) => (a > b ? a : b)))}`
    : "—";
  const error = markets.error ?? terms.error;

  return (
    <>
      <PageHeader
        eyebrow="Markets"
        title="Five markets, each with fixed terms"
        description="Each market has one protected direction. The contract defines that direction, so it cannot be changed during purchase."
        actions={
          <Button asChild size="lg">
            <Link
              to="/protection/new"
              search={{ market: undefined, threshold: undefined, duration: undefined }}
            >
              Get Protection <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        {error ? (
          <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {publicReadErrorMessage(error)}
          </div>
        ) : null}
        <div className="grid gap-5 md:grid-cols-2">
          {markets.isLoading || terms.isLoading
            ? Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-[505px] md:h-[434px]" />
              ))
            : (markets.data ?? []).map((m) => (
                <article key={m.market_id} className="surface-card flex flex-col p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        {m.category === "METAL" ? (
                          <Coins className="size-3.5 text-brass" />
                        ) : (
                          <Landmark className="size-3.5 text-primary" />
                        )}
                        {m.category === "METAL" ? "Metal" : "Currency"}
                      </span>
                      <h2 className="display mt-2.5 text-3xl">{m.symbol}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {MARKET_PRESENTATION[m.market_id].name}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium">
                      {m.direction === "DOWN" ? (
                        <TrendingDown className="size-3.5 text-destructive" />
                      ) : (
                        <TrendingUp className="size-3.5 text-info" />
                      )}
                      {m.direction === "DOWN" ? "Downward move" : "Upward move"}
                    </span>
                  </div>

                  <p className="mt-5 text-sm leading-relaxed text-foreground/80">
                    {MARKET_PRESENTATION[m.market_id].protectedAgainst}
                  </p>

                  <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
                    <Cell
                      label="Movement thresholds"
                      value={thresholds.map((threshold) => `${threshold}%`).join(" · ") || "—"}
                    />
                    <Cell
                      label="Protection periods"
                      value={durations.map((duration) => `${duration} days`).join(" · ") || "—"}
                      mono={false}
                    />
                    <Cell label="Premium range" value={premiumRange} />
                    <Cell label="Fixed payout range" value={payoutRange} />
                  </dl>

                  <div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-5">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      The contract sets the premium and fixed payout from the selected threshold and
                      protection period.
                    </p>
                    <Button asChild size="sm" className="shrink-0">
                      <Link
                        to="/protection/new"
                        search={{ market: m.market_id, threshold: undefined, duration: undefined }}
                      >
                        Get protection
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}
        </div>
      </div>
    </>
  );
}

function Cell({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-sm ${mono ? "numeric" : ""}`}>{value}</dd>
    </div>
  );
}
