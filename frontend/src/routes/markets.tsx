import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Coins, Landmark, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/aegis/page-header";
import { Button } from "@/components/ui/button";
import { SUPPORTED_MARKETS } from "@/lib/aegis/mock-data";
import { formatPrice } from "@/lib/aegis/format";

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
  return (
    <>
      <PageHeader
        eyebrow="Markets"
        title="Five markets, each with fixed terms"
        description="Every market covers one direction of movement. The direction is set by the product, not chosen by you, so terms stay comparable across every protection."
        actions={
          <Button asChild size="lg">
            <Link to="/protection/new">
              Get Protection <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-5 md:grid-cols-2">
          {SUPPORTED_MARKETS.map((m) => (
            <article key={m.symbol} className="surface-card flex flex-col p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {m.category === "Metal" ? (
                      <Coins className="size-3.5 text-brass" />
                    ) : (
                      <Landmark className="size-3.5 text-primary" />
                    )}
                    {m.category}
                  </span>
                  <h2 className="display mt-2.5 text-3xl">{m.symbol}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{m.name}</p>
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

              <p className="mt-5 text-sm leading-relaxed text-foreground/80">{m.protectedAgainst}</p>

              <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
                <Cell label="Reference price" value={formatPrice(m.referencePrice, m.symbol)} />
                <Cell label="Quoted in" value={m.unit} mono={false} />
                <Cell label="Thresholds" value={m.thresholds.map((t) => `${t}%`).join(" · ")} />
                <Cell label="Durations" value={m.durations.map((d) => `${d}d`).join(" · ")} />
              </dl>

              <div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-5">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Fixed payout up to{" "}
                  <span className="font-medium text-brass-foreground">
                    {m.payoutMultiple.toFixed(1)}×
                  </span>{" "}
                  the premium, set by the contract at purchase.
                </p>
                <Button asChild size="sm" className="shrink-0">
                  <Link to="/protection/new" search={{ market: m.symbol }}>
                    Protect
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
