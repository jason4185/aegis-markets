import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Coins, Info, Landmark, Lock, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/aegis/page-header";
import { ReviewModal } from "@/components/aegis/review-modal";
import { WalletControl } from "@/components/aegis/wallet-control";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getAvailableLiquidity,
  getProductTerms,
  getPurchasesPaused,
  getSupportedMarkets,
  quoteProtection,
} from "@/lib/aegis/contract-reads";
import { purchaseProtection } from "@/lib/aegis/contract-writes";
import { publicReadErrorMessage } from "@/lib/aegis/errors";
import { formatGen } from "@/lib/aegis/format";
import { MARKET_PRESENTATION, directionLabel } from "@/lib/aegis/presentation";
import { aegisKeys } from "@/lib/aegis/query-keys";
import { useTransactionManager } from "@/lib/aegis/transaction-context";
import type { Duration, MarketId, ProtectionQuote, Threshold } from "@/lib/aegis/types";
import { useWalletState } from "@/hooks/use-wallet-state";
import { cn } from "@/lib/utils";

const MARKET_IDS: MarketId[] = ["GBP_USD", "USD_JPY", "USD_TRY", "XAU_USD", "XAG_USD"];
const THRESHOLDS: Threshold[] = [2, 3, 4];
const DURATIONS: Duration[] = [7, 14, 30];

export const Route = createFileRoute("/protection/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    market: MARKET_IDS.includes(search["market"] as MarketId)
      ? (search["market"] as MarketId)
      : undefined,
    threshold: THRESHOLDS.includes(Number(search["threshold"]) as Threshold)
      ? (Number(search["threshold"]) as Threshold)
      : undefined,
    duration: DURATIONS.includes(Number(search["duration"]) as Duration)
      ? (Number(search["duration"]) as Duration)
      : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Get Protection — Aegis Markets" },
      {
        name: "description",
        content: "Configure fixed-payout protection using the current market terms.",
      },
    ],
  }),
  component: NewProtection,
});

function NewProtection() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const wallet = useWalletState();
  const transaction = useTransactionManager();
  const [marketId, setMarketId] = useState<MarketId>(search.market ?? "GBP_USD");
  const [threshold, setThreshold] = useState<Threshold>(search.threshold ?? 3);
  const [duration, setDuration] = useState<Duration>(search.duration ?? 14);
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    if (search.market) setMarketId(search.market);
    if (search.threshold) setThreshold(search.threshold);
    if (search.duration) setDuration(search.duration);
  }, [search.duration, search.market, search.threshold]);

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
  const quote = useQuery({
    queryKey: aegisKeys.quote(duration, threshold),
    queryFn: () => quoteProtection(duration, threshold),
  });
  const paused = useQuery({ queryKey: aegisKeys.paused, queryFn: getPurchasesPaused });
  const liquidity = useQuery({ queryKey: aegisKeys.liquidity, queryFn: getAvailableLiquidity });
  const selectedMarket = markets.data?.find((market) => market.market_id === marketId);
  const selectedTerm = terms.data?.find(
    (term) => term.duration_days === duration && term.event_percent === threshold,
  );

  const protectionQuote = useMemo<ProtectionQuote | null>(() => {
    if (!selectedMarket || !quote.data || !selectedTerm) return null;
    return {
      market_id: selectedMarket.market_id,
      symbol: selectedMarket.symbol,
      direction: selectedMarket.direction,
      duration_days: duration,
      event_percent: threshold,
      event_bps: selectedTerm.event_bps,
      premium: quote.data.premium,
      payout: quote.data.payout,
    };
  }, [duration, quote.data, selectedMarket, selectedTerm, threshold]);

  const insufficientLiquidity = Boolean(
    protectionQuote &&
    liquidity.data !== undefined &&
    liquidity.data + protectionQuote.premium < protectionQuote.payout,
  );
  const readError = markets.error ?? terms.error ?? quote.error ?? paused.error ?? liquidity.error;
  const canConfirm = Boolean(
    wallet.isConnected &&
    !wallet.isWrongNetwork &&
    protectionQuote &&
    !paused.data &&
    !insufficientLiquidity,
  );
  const confirmMessage = !wallet.isConnected
    ? "Connect your wallet to confirm this purchase."
    : wallet.isWrongNetwork
      ? "Switch your wallet to GenLayer Bradbury."
      : paused.data
        ? "New protection purchases are temporarily paused."
        : insufficientLiquidity
          ? "The protocol does not currently have enough available liquidity for this payout."
          : undefined;

  async function submitPurchase() {
    if (!protectionQuote || !canConfirm) return;
    setReviewOpen(false);
    transaction.begin("Purchasing protection");
    try {
      const result = await purchaseProtection({
        context: wallet.getWriteContext(),
        marketId: protectionQuote.market_id,
        durationDays: protectionQuote.duration_days,
        eventPercent: protectionQuote.event_percent,
        quotedPremium: protectionQuote.premium,
        onProgress: transaction.onProgress,
        queryClient,
      });
      await navigate({ to: "/protection/$id", params: { id: result.protectionId.toString() } });
    } catch (error) {
      transaction.fail(error);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="New protection"
        title="Configure your protection"
        description="Direction, premium and fixed payout come from the current protection terms."
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        {readError ? (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {publicReadErrorMessage(readError)}
          </div>
        ) : null}
        {paused.data ? (
          <div className="mb-6 rounded-lg border border-brass/40 bg-brass/10 p-4 text-sm">
            New protection purchases are temporarily paused.
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[1.35fr_0.9fr] lg:items-start">
          <div className="min-w-0 space-y-6">
            <section className="surface-card p-6 sm:p-7">
              <SectionTitle step="01" title="Select market" />
              {markets.isLoading ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-24" />
                  ))}
                </div>
              ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {(markets.data ?? []).map((market) => {
                    const active = market.market_id === marketId;
                    return (
                      <button
                        key={market.market_id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setMarketId(market.market_id)}
                        className={cn(
                          "rounded-lg border p-4 text-left transition-colors",
                          active
                            ? "border-primary bg-primary/6"
                            : "border-border hover:bg-secondary",
                        )}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                            {market.category === "METAL" ? (
                              <Coins className="size-3.5 text-brass" />
                            ) : (
                              <Landmark className="size-3.5 text-primary" />
                            )}
                            {market.category === "METAL" ? "Metal" : "Currency"}
                          </span>
                          {active ? <Check className="size-4 text-primary" /> : null}
                        </span>
                        <span className="display mt-2 block text-xl">{market.symbol}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {MARKET_PRESENTATION[market.market_id].protectedAgainst}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="surface-card p-6 sm:p-7">
              <SectionTitle step="02" title="Choose movement threshold" />
              <div className="mt-5 grid grid-cols-3 gap-3">
                {THRESHOLDS.map((value) => (
                  <Choice
                    key={value}
                    active={threshold === value}
                    onClick={() => setThreshold(value)}
                  >
                    {value}%
                  </Choice>
                ))}
              </div>
            </section>

            <section className="surface-card p-6 sm:p-7">
              <SectionTitle step="03" title="Choose protection period" />
              <div className="mt-5 grid grid-cols-3 gap-3">
                {DURATIONS.map((value) => (
                  <Choice
                    key={value}
                    active={duration === value}
                    onClick={() => setDuration(value)}
                  >
                    {value} days
                  </Choice>
                ))}
              </div>
            </section>
          </div>

          <aside className="surface-card p-6 sm:p-7 lg:sticky lg:top-24">
            <p className="eyebrow">Live quote</p>
            {selectedMarket && protectionQuote ? (
              <>
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="display text-3xl">{selectedMarket.symbol}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {directionLabel(selectedMarket.direction)}
                    </p>
                  </div>
                  {selectedMarket.direction === "DOWN" ? (
                    <TrendingDown className="size-5 text-destructive" />
                  ) : (
                    <TrendingUp className="size-5 text-info" />
                  )}
                </div>
                <dl className="mt-6 divide-y divide-border rounded-lg border border-border px-4">
                  <QuoteRow label="Threshold" value={`${threshold}%`} />
                  <QuoteRow label="Protection period" value={`${duration} days`} />
                  <QuoteRow label="Premium" value={formatGen(protectionQuote.premium)} />
                  <QuoteRow label="Fixed payout" value={formatGen(protectionQuote.payout)} accent />
                  <QuoteRow label="Reference price" value="Locked during purchase" />
                  <QuoteRow label="Trigger price" value="Calculated after purchase" />
                  <QuoteRow
                    label="Available liquidity"
                    value={liquidity.data === undefined ? "—" : formatGen(liquidity.data)}
                  />
                </dl>
                {insufficientLiquidity ? (
                  <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    The protocol does not currently have enough available liquidity for this payout.
                  </p>
                ) : null}
                <div className="mt-5 flex items-start gap-2 rounded-lg bg-secondary/60 p-3 text-xs leading-relaxed text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  The premium is sent as native GEN. No token approval is required.
                </div>
                <Button className="mt-5 w-full" size="lg" onClick={() => setReviewOpen(true)}>
                  <Lock className="size-4" /> Review protection
                </Button>
                {!wallet.isConnected ? (
                  <div className="mt-3 flex justify-center">
                    <WalletControl />
                  </div>
                ) : null}
                {wallet.isWrongNetwork ? (
                  <Button
                    className="mt-3 w-full"
                    variant="outline"
                    onClick={() => void wallet.switchToBradbury()}
                  >
                    Switch to Bradbury
                  </Button>
                ) : null}
              </>
            ) : (
              <div className="mt-5 space-y-3">
                <Skeleton className="h-10" />
                <Skeleton className="h-64" />
              </div>
            )}
          </aside>
        </div>
      </div>

      <ReviewModal
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        quote={protectionQuote}
        walletAddress={wallet.address}
        canConfirm={canConfirm}
        confirmMessage={confirmMessage}
        onConfirm={() => void submitPurchase()}
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

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-3 text-sm font-medium",
        active ? "border-primary bg-primary/6 text-primary" : "border-border hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

function QuoteRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("numeric text-right text-sm", accent && "text-brass-foreground")}>
        {value}
      </dd>
    </div>
  );
}
