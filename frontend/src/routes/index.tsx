import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Calendar,
  Coins,
  Landmark,
  LockKeyhole,
  ScrollText,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getProductTerms, getProtocolStats, getSupportedMarkets } from "@/lib/aegis/contract-reads";
import { aegisKeys } from "@/lib/aegis/query-keys";
import { MARKET_PRESENTATION } from "@/lib/aegis/presentation";
import { formatGen } from "@/lib/aegis/format";
import { publicReadErrorMessage } from "@/lib/aegis/errors";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aegis Markets — Fixed-Payout Protection for FX and Metals" },
      {
        name: "description",
        content:
          "Buy fixed-payout protection against adverse moves in GBP/USD, USD/JPY, USD/TRY, gold and silver. Daily settlement by GenLayer validator consensus.",
      },
      {
        property: "og:title",
        content: "Aegis Markets — Fixed-Payout Protection for FX and Metals",
      },
      {
        property: "og:description",
        content:
          "Fixed terms, locked reference price, two independent settlement sources, authorized daily settlement.",
      },
    ],
  }),
  component: Landing,
});

const PROOF = [
  { icon: Users, label: "GenLayer Consensus" },
  { icon: ScrollText, label: "Two Independent Price Sources" },
  { icon: LockKeyhole, label: "Fixed Payout Terms" },
  { icon: Calendar, label: "Permissionless Daily Settlement" },
];

function Landing() {
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
  const stats = useQuery({ queryKey: aegisKeys.stats, queryFn: getProtocolStats });
  const featuredMarket = markets.data?.find((item) => item.market_id === "XAU_USD");
  const featuredTerm = terms.data?.find(
    (item) => item.duration_days === 14 && item.event_percent === 3,
  );
  const readError = markets.error ?? terms.error ?? stats.error;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border hairline-grid">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <div className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="eyebrow">Protection · Currencies &amp; metals</p>
              <h1 className="display mt-5 text-[2.75rem] leading-[1.02] sm:text-6xl md:text-[4.25rem]">
                Protection with a<span className="block italic text-primary">payout you know</span>
                before you buy.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Choose a currency or metals market, a movement threshold and a protection period.
                The contract sets the premium and fixed payout before you confirm the purchase.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link
                    to="/protection/new"
                    search={{ market: undefined, threshold: undefined, duration: undefined }}
                  >
                    Get Protection <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/how-it-works">How It Works</Link>
                </Button>
              </div>
            </div>

            <div className="surface-card p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Live contract terms</p>
                <span className="rounded-full border border-brass/45 bg-brass/15 px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.1em] text-brass-foreground">
                  Fixed payout
                </span>
              </div>
              <p className="display mt-4 text-3xl">{featuredMarket?.symbol ?? "Loading…"}</p>
              <p className="text-sm text-muted-foreground">
                {featuredMarket
                  ? MARKET_PRESENTATION[featuredMarket.market_id].protectedAgainst
                  : "Reading the deployed AegisProtection contract"}
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
                <Cell
                  label="Protected direction"
                  value={
                    featuredMarket
                      ? featuredMarket.direction === "DOWN"
                        ? "Downward"
                        : "Upward"
                      : "—"
                  }
                />
                <Cell
                  label="Movement threshold"
                  value={featuredTerm ? `${featuredTerm.event_percent}%` : "—"}
                />
                <Cell
                  label="Protection period"
                  value={featuredTerm ? `${featuredTerm.duration_days} days` : "—"}
                />
                <Cell
                  label="Premium"
                  value={featuredTerm ? formatGen(featuredTerm.premium) : "—"}
                />
                <Cell
                  label="Fixed payout"
                  value={featuredTerm ? formatGen(featuredTerm.payout) : "—"}
                  accent
                />
                <Cell label="Reference price" value="Locked during purchase" />
              </dl>
              <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                Each eligible date can be settled once using two independent market-data sources.
              </p>
              {readError ? (
                <p className="mt-3 text-sm text-destructive">{publicReadErrorMessage(readError)}</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Proof strip */}
      <section className="border-b border-border bg-card/60">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {PROOF.map((p) => (
            <div key={p.label} className="flex items-center gap-3 bg-card px-5 py-6">
              <p.icon className="size-4 shrink-0 text-brass" strokeWidth={1.75} />
              <span className="text-sm font-medium">{p.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Markets */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 md:py-24">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <p className="eyebrow">Supported markets</p>
            <h2 className="display mt-3 text-3xl md:text-4xl">
              Five markets. Fixed terms on each.
            </h2>
          </div>
          <Button asChild variant="ghost">
            <Link to="/markets">
              View market details <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(markets.data ?? []).map((m) => (
            <Link
              key={m.market_id}
              to="/protection/new"
              search={{ market: m.market_id, threshold: undefined, duration: undefined }}
              className="surface-card group flex flex-col p-6 transition-shadow hover:shadow-[var(--shadow-lift)]"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {m.category === "METAL" ? (
                    <Coins className="size-3.5 text-brass" />
                  ) : (
                    <Landmark className="size-3.5 text-primary" />
                  )}
                  {m.category === "METAL" ? "Metal" : "Currency"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {m.direction === "DOWN" ? "Downward" : "Upward"}
                </span>
              </div>
              <p className="display mt-4 text-2xl">{m.symbol}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {MARKET_PRESENTATION[m.market_id].protectedAgainst}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works preview */}
      <section className="border-y border-border bg-card/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 md:py-24">
          <p className="eyebrow">How it works</p>
          <h2 className="display mt-3 max-w-2xl text-3xl md:text-4xl">How Aegis Markets works</h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
            Choose fixed terms, lock a reference price, settle each eligible date and claim if both
            sources confirm the trigger.
          </p>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Choose protection",
              "Confirm fixed terms",
              "Settle eligible dates",
              "Claim after a confirmed breach",
            ].map((step, i) => (
              <li key={step} className="bg-card p-6">
                <span className="numeric text-xs text-brass">0{i + 1}</span>
                <h3 className="mt-3 text-lg font-medium">{step}</h3>
              </li>
            ))}
          </ol>
          <Button asChild className="mt-8" variant="outline">
            <Link to="/how-it-works">
              See how it works <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Settlement transparency */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 md:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow">Settlement transparency</p>
            <h2 className="display mt-3 text-3xl md:text-4xl">
              The settlement caller cannot choose the outcome.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              Any wallet can trigger settlement for an eligible date. Each source price is compared
              separately with the stored trigger price. Both prices must confirm the trigger for the
              protection to become claimable. A split result is inconclusive and can be tried again.
            </p>
            <Button asChild className="mt-8" variant="outline">
              <Link to="/how-it-works">
                Read the full explanation <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
            <Stat label="Markets supported" value={String(markets.data?.length ?? "—")} />
            <Stat label="Settlement sources" value="2" />
            <Stat
              label="Protections purchased"
              value={stats.data?.total_protections.toString() ?? "—"}
            />
            <Stat
              label="Available liquidity"
              value={stats.data ? formatGen(stats.data.available_liquidity) : "—"}
            />
          </dl>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="ink-panel relative overflow-hidden rounded-2xl px-6 py-16 text-center sm:px-12">
          <h2 className="display mx-auto max-w-2xl text-3xl leading-tight text-ink-foreground md:text-5xl">
            Know your payout before the market moves.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-base text-ink-foreground/70">
            Choose the terms, review the fixed premium and payout, then confirm the purchase.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link
                to="/protection/new"
                search={{ market: undefined, threshold: undefined, duration: undefined }}
              >
                Get Protection <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground"
            >
              <Link to="/markets">Browse markets</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-card px-4 py-3.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`numeric mt-1 text-base ${accent ? "text-brass-foreground" : ""}`}>{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-6 py-8">
      <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="display mt-2 text-3xl">{value}</dd>
    </div>
  );
}
