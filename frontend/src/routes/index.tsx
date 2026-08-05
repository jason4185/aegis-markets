import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Calendar, Coins, Landmark, LockKeyhole, ScrollText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUPPORTED_MARKETS, PROTOCOL_STATS } from "@/lib/aegis/mock-data";
import { formatPrice } from "@/lib/aegis/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aegis Markets — Fixed-Payout Cover for FX and Metals" },
      {
        name: "description",
        content:
          "Buy fixed-payout protection against adverse moves in GBP/USD, USD/JPY, USD/TRY, gold and silver. Daily settlement by GenLayer validator consensus.",
      },
      { property: "og:title", content: "Aegis Markets — Fixed-Payout Cover for FX and Metals" },
      {
        property: "og:description",
        content:
          "Fixed terms, locked reference price, two independent settlement sources, permissionless daily settlement.",
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
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border hairline-grid">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <div className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="eyebrow">Onchain protection · Currencies &amp; metals</p>
              <h1 className="display mt-5 text-[2.75rem] leading-[1.02] sm:text-6xl md:text-[4.25rem]">
                Protection with a
                <span className="block italic text-primary">payout you know</span>
                before you buy.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Aegis covers a defined adverse move in five markets. Choose the threshold and the
                duration; the contract sets the premium and a fixed payout that never changes.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/protection/new">
                    Get Protection <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/transparency">How It Works</Link>
                </Button>
              </div>
            </div>

            <div className="surface-card p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Sample terms</p>
                <span className="rounded-full border border-brass/45 bg-brass/15 px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.1em] text-brass-foreground">
                  Fixed payout
                </span>
              </div>
              <p className="display mt-4 text-3xl">XAU/USD</p>
              <p className="text-sm text-muted-foreground">
                Protected against a downward move in gold
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
                <Cell label="Threshold" value="3%" />
                <Cell label="Duration" value="14 days" />
                <Cell label="Premium" value="$204" />
                <Cell label="Fixed payout" value="$1,163" accent />
              </dl>
              <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                Reference price is fetched and locked during purchase. Settlement runs once per day
                for every day of cover.
              </p>
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
            <h2 className="display mt-3 text-3xl md:text-4xl">Five markets. Fixed terms on each.</h2>
          </div>
          <Button asChild variant="ghost">
            <Link to="/markets">
              View market details <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SUPPORTED_MARKETS.map((m) => (
            <Link
              key={m.symbol}
              to="/protection/new"
              search={{ market: m.symbol }}
              className="surface-card group flex flex-col p-6 transition-shadow hover:shadow-[var(--shadow-lift)]"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {m.category === "Metal" ? (
                    <Coins className="size-3.5 text-brass" />
                  ) : (
                    <Landmark className="size-3.5 text-primary" />
                  )}
                  {m.category}
                </span>
                <span className="text-xs text-muted-foreground">
                  {m.direction === "DOWN" ? "Downward" : "Upward"}
                </span>
              </div>
              <p className="display mt-4 text-2xl">{m.symbol}</p>
              <p className="mt-1 text-sm text-muted-foreground">{m.protectedAgainst}</p>
              <p className="numeric mt-6 text-sm text-foreground">
                {formatPrice(m.referencePrice, m.symbol)}
                <span className="ml-2 font-sans text-xs text-muted-foreground">{m.unit}</span>
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-card/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 md:py-24">
          <p className="eyebrow">How it works</p>
          <h2 className="display mt-3 max-w-2xl text-3xl md:text-4xl">
            Four steps, no negotiation, no discretion.
          </h2>
          <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
            {[
              {
                t: "Choose your cover",
                d: "Pick a market, a movement threshold of 2%, 3% or 4%, and a duration of 7, 14 or 30 days.",
              },
              {
                t: "Terms are locked",
                d: "The contract sets the premium and the fixed payout, and locks the reference price at purchase.",
              },
              {
                t: "Daily settlement",
                d: "Each day of cover is settled using two independent sources and validator consensus.",
              },
              {
                t: "Claim if breached",
                d: "If the protected move happens, the protection becomes claimable by its owner for the full fixed payout.",
              },
            ].map((s, i) => (
              <li key={s.t} className="bg-card p-6">
                <span className="numeric text-xs text-brass">0{i + 1}</span>
                <h3 className="mt-3 text-lg font-medium">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Settlement transparency */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 md:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow">Settlement transparency</p>
            <h2 className="display mt-3 text-3xl md:text-4xl">
              Nobody — including us — can choose the outcome.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              Settlement is permissionless: any wallet may trigger the daily check. The caller never
              supplies the price and never influences the result. Two independent sources are read,
              validators reach consensus, and the day is recorded as not breached, breached or
              inconclusive.
            </p>
            <Button asChild className="mt-8" variant="outline">
              <Link to="/transparency">
                Read the full explanation <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
            <Stat label="Protections issued" value={PROTOCOL_STATS.totalProtections.toLocaleString()} />
            <Stat label="Daily settlements" value={PROTOCOL_STATS.settlementsRun.toLocaleString()} />
            <Stat label="Validator nodes" value={String(PROTOCOL_STATS.validatorNodes)} />
            <Stat label="Markets covered" value={String(PROTOCOL_STATS.markets)} />
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
            Set up protection in under a minute. Fixed premium, fixed payout, daily settlement.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/protection/new">
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
