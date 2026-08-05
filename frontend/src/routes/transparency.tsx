import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  CalendarClock,
  KeyRound,
  Layers,
  LockKeyhole,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/aegis/page-header";
import { Button } from "@/components/ui/button";
import { PRODUCT_TERMS } from "@/lib/aegis/mock-data";

export const Route = createFileRoute("/transparency")({
  head: () => ({
    meta: [
      { title: "How Settlement Works — Aegis Markets" },
      {
        name: "description",
        content:
          "How Aegis locks the reference price, reads two independent settlement sources, reaches validator consensus and keeps claims owner-only.",
      },
      { property: "og:title", content: "How Settlement Works — Aegis Markets" },
      {
        property: "og:description",
        content:
          "Locked reference price, two independent sources, validator consensus, permissionless settlement, fixed terms.",
      },
    ],
  }),
  component: Transparency,
});

const SECTIONS = [
  {
    icon: LockKeyhole,
    title: "The reference price is locked at purchase",
    body: "When you buy, Aegis fetches the live price for your market and writes it into the contract. That number becomes the reference for the whole period, so the trigger price is known the moment you are covered and never moves afterwards.",
  },
  {
    icon: Layers,
    title: "Two independent sources decide each day",
    body: "Every settlement reads two separate market data providers. If both agree, the day is recorded as breached or not breached. If they disagree beyond tolerance, the day is recorded as inconclusive rather than guessed.",
  },
  {
    icon: Users,
    title: "Validators reach consensus before anything is written",
    body: "The result is only accepted once independent GenLayer validators reach agreement on it. No single operator, including Aegis, can push through a result on their own. Consensus can take a little longer than a plain transaction — that is the point.",
  },
  {
    icon: CalendarClock,
    title: "Settlement is permissionless",
    body: "Any wallet may trigger the daily settlement for any protection. The caller never supplies a price and never chooses the outcome; they simply pay to run the check. This means your cover does not depend on us being online.",
  },
  {
    icon: BadgeCheck,
    title: "Terms are fixed",
    body: "Premium and payout are set by the contract at purchase and cannot be renegotiated, reduced or reassessed. If the protected move is confirmed, the payout is the full fixed amount — no partial assessment, no loss adjustment.",
  },
  {
    icon: KeyRound,
    title: "Claims are owner-only",
    body: "Only the wallet that owns a protection can claim its payout. Anyone can help settle a day, but nobody else can move your funds.",
  },
];

function Transparency() {
  return (
    <>
      <PageHeader
        eyebrow="Transparency"
        title="How Aegis decides, in plain language"
        description="Protection is only useful if the rules are legible. Here is exactly what happens from the moment you buy to the moment you claim."
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-5 md:grid-cols-2">
          {SECTIONS.map((s) => (
            <section key={s.title} className="surface-card p-6 sm:p-7">
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/8 text-primary">
                <s.icon className="size-4.5" strokeWidth={1.75} />
              </span>
              <h2 className="mt-4 text-xl font-medium">{s.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="surface-card mt-8 overflow-hidden">
          <div className="border-b border-border px-6 py-5">
            <p className="eyebrow">Current product terms</p>
          </div>
          <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            <Term label="Movement thresholds" value={PRODUCT_TERMS.thresholds.map((t) => `${t}%`).join(" · ")} />
            <Term label="Durations" value={PRODUCT_TERMS.durations.map((d) => `${d} days`).join(" · ")} />
            <Term label="Settlement cadence" value={PRODUCT_TERMS.settlementCadence} />
            <Term label="Reference source" value={PRODUCT_TERMS.referenceSource} />
            <Term label="Settlement source A" value={PRODUCT_TERMS.settlementSources[0]} />
            <Term label="Settlement source B" value={PRODUCT_TERMS.settlementSources[1]} />
          </dl>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card/60 px-6 py-6">
          <p className="max-w-lg text-sm text-muted-foreground">
            Ready to cover a move? Pick a market, a threshold and a duration — the contract quotes
            the rest.
          </p>
          <Button asChild size="lg">
            <Link to="/protection/new">Get Protection</Link>
          </Button>
        </div>
      </div>
    </>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-6 py-5">
      <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="mt-2 text-sm leading-relaxed">{value}</dd>
    </div>
  );
}
