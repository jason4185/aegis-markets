import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Coins, Info, Landmark, Lock, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/aegis/page-header";
import { ReviewModal } from "@/components/aegis/review-modal";
import { TransactionProgressModal } from "@/components/aegis/tx-progress-modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { contractService } from "@/lib/aegis/contract-service";
import { SUPPORTED_MARKETS } from "@/lib/aegis/mock-data";
import { formatDate, formatPrice, formatUsd } from "@/lib/aegis/format";
import type { Duration, MarketSymbol, Threshold } from "@/lib/aegis/types";
import { cn } from "@/lib/utils";

const SYMBOLS = SUPPORTED_MARKETS.map((m) => m.symbol);

export const Route = createFileRoute("/protection/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    market: SYMBOLS.includes(search["market"] as MarketSymbol)
      ? (search["market"] as MarketSymbol)
      : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Get Protection — Aegis Markets" },
      {
        name: "description",
        content:
          "Configure fixed-payout protection: choose a market, a movement threshold and a duration. Premium and payout are set by the contract.",
      },
      { property: "og:title", content: "Get Protection — Aegis Markets" },
      {
        property: "og:description",
        content: "Choose market, threshold and duration. See premium and fixed payout instantly.",
      },
    ],
  }),
  component: NewProtection,
});

function NewProtection() {
  const { market } = Route.useSearch();
  const navigate = useNavigate();

  const [symbol, setSymbol] = useState<MarketSymbol>(market ?? "GBP/USD");
  const [threshold, setThreshold] = useState<Threshold>(3);
  const [duration, setDuration] = useState<Duration>(14);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);

  useEffect(() => {
    if (market) setSymbol(market);
  }, [market]);

  const selected = useMemo(() => SUPPORTED_MARKETS.find((m) => m.symbol === symbol)!, [symbol]);

  const { data: quote, isFetching } = useQuery({
    queryKey: ["quote", symbol, threshold, duration],
    queryFn: () => contractService.quote_protection({ symbol, threshold, duration }),
  });

  return (
    <>
      <PageHeader
        eyebrow="New protection"
        title="Configure your protection"
        description="Direction is set by the market you choose. Premium and fixed payout come straight from the contract."
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1.35fr_0.9fr] lg:items-start">
          {/* Left: configuration */}
          <div className="space-y-6">
            <section className="surface-card p-6 sm:p-7">
              <SectionTitle step="01" title="Select market" />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {SUPPORTED_MARKETS.map((m) => {
                  const active = m.symbol === symbol;
                  return (
                    <button
                      key={m.symbol}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setSymbol(m.symbol);
                        navigate({ to: ".", search: { market: m.symbol } });
                      }}
                      className={cn(
                        "flex items-start justify-between gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:bg-secondary",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
                          {m.category === "Metal" ? (
                            <Coins className="size-3" />
                          ) : (
                            <Landmark className="size-3" />
                          )}
                          {m.category}
                        </span>
                        <span className="mt-1.5 block text-base font-medium">{m.symbol}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          {m.direction === "DOWN" ? (
                            <TrendingDown className="size-3" />
                          ) : (
                            <TrendingUp className="size-3" />
                          )}
                          {m.direction === "DOWN" ? "Downward move" : "Upward move"}
                        </span>
                      </span>
                      {active && (
                        <span className="mt-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                The protected direction is fixed per market — {selected.protectedAgainst.toLowerCase()}.
              </p>
            </section>

            <section className="surface-card p-6 sm:p-7">
              <SectionTitle step="02" title="Movement threshold" />
              <p className="mt-2 text-sm text-muted-foreground">
                How far the market must move against you before the protection pays.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {selected.thresholds.map((t) => (
                  <OptionTile
                    key={t}
                    active={t === threshold}
                    onClick={() => setThreshold(t)}
                    label={`${t}%`}
                    sub={t === 2 ? "Most sensitive" : t === 3 ? "Balanced" : "Lowest premium"}
                  />
                ))}
              </div>
            </section>

            <section className="surface-card p-6 sm:p-7">
              <SectionTitle step="03" title="Duration" />
              <p className="mt-2 text-sm text-muted-foreground">
                Cover runs for every day in the period and is settled daily.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {selected.durations.map((d) => (
                  <OptionTile
                    key={d}
                    active={d === duration}
                    onClick={() => setDuration(d)}
                    label={`${d} days`}
                    sub={`${d} settlements`}
                  />
                ))}
              </div>
            </section>
          </div>

          {/* Right: sticky overview */}
          <aside className="lg:sticky lg:top-24">
            <div className="surface-card overflow-hidden">
              <div className="ink-panel px-6 py-5">
                <p className="text-[0.62rem] uppercase tracking-[0.18em] text-ink-foreground/60">
                  Live overview
                </p>
                <p className="display mt-2 text-2xl text-ink-foreground">{selected.symbol}</p>
                <p className="text-sm text-ink-foreground/65">
                  {selected.direction === "DOWN" ? "Downward move" : "Upward move"} ·{" "}
                  {selected.category}
                </p>
              </div>

              <dl className="divide-y divide-border px-6">
                <Row label="Movement threshold" value={`${threshold}%`} />
                <Row label="Duration" value={`${duration} days`} />
                <Row
                  label="Premium"
                  loading={isFetching}
                  value={quote ? formatUsd(quote.premium) : "—"}
                />
                <Row
                  label="Fixed payout"
                  loading={isFetching}
                  emphasis
                  value={quote ? formatUsd(quote.fixedPayout) : "—"}
                />
                <Row
                  label="Trigger price"
                  loading={isFetching}
                  value={quote ? formatPrice(quote.triggerPrice, symbol) : "—"}
                />
                <Row
                  label="Expected coverage"
                  loading={isFetching}
                  mono={false}
                  value={
                    quote ? `${formatDate(quote.coverageStart)} → ${formatDate(quote.coverageEnd)}` : "—"
                  }
                />
                <div className="flex items-start justify-between gap-4 py-3.5">
                  <dt className="text-sm text-muted-foreground">Reference price</dt>
                  <dd className="inline-flex items-center gap-1.5 text-sm font-medium">
                    <Lock className="size-3.5 text-brass" />
                    Locked during purchase
                  </dd>
                </div>
              </dl>

              <div className="border-t border-border p-6">
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!quote || isFetching}
                  onClick={() => setReviewOpen(true)}
                >
                  Review Protection
                </Button>
                <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
                  Terms are final once purchased. Settlement uses two independent sources and
                  validator consensus.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <ReviewModal
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        quote={quote ?? null}
        onConfirm={() => {
          setReviewOpen(false);
          setTxOpen(true);
        }}
      />
      <TransactionProgressModal
        open={txOpen}
        onOpenChange={setTxOpen}
        completedHref={() => {
          setTxOpen(false);
          navigate({ to: "/dashboard" });
        }}
      />
    </>
  );
}

function SectionTitle({ step, title }: { step: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="numeric text-xs text-brass">{step}</span>
      <h2 className="text-lg font-medium">{title}</h2>
    </div>
  );
}

function OptionTile({
  active,
  label,
  sub,
  onClick,
}: {
  active: boolean;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-4 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-secondary",
      )}
    >
      <span className="numeric block text-lg">{label}</span>
      <span className="mt-1 block text-[0.7rem] text-muted-foreground">{sub}</span>
    </button>
  );
}

function Row({
  label,
  value,
  loading,
  emphasis,
  mono = true,
}: {
  label: string;
  value: string;
  loading?: boolean;
  emphasis?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right text-sm font-medium",
          mono && "numeric",
          emphasis && "text-brass-foreground",
        )}
      >
        {loading ? <Skeleton className="h-4 w-24" /> : value}
      </dd>
    </div>
  );
}
