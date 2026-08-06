import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, CalendarClock, KeyRound, Layers, LockKeyhole, Users } from "lucide-react";
import { PageHeader } from "@/components/aegis/page-header";
import { OperatorManagement } from "@/components/aegis/operator-management";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getConfig, getProductTerms } from "@/lib/aegis/contract-reads";
import { aegisKeys } from "@/lib/aegis/query-keys";
import { publicReadErrorMessage } from "@/lib/aegis/errors";

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
          "Locked reference price, two independent sources, validator consensus, authorized settlement, fixed terms.",
      },
    ],
  }),
  component: Transparency,
});

const SECTIONS = [
  {
    icon: LockKeyhole,
    title: "The reference price is locked during purchase",
    body: "When you purchase protection, the contract obtains the current market price from FXRatesAPI. GenLayer validators independently fetch and verify the result. The accepted price becomes the reference price for the full protection period.",
  },
  {
    icon: Layers,
    title: "Two independent sources provide each settlement price",
    body: "For every settlement date, the contract obtains one price from FXRatesAPI Historical and one from the Fawaz Currency API. Each price is checked independently against the stored trigger price.",
  },
  {
    icon: Users,
    title: "Validators verify the fetched result",
    body: "A transaction is accepted only after GenLayer validators independently repeat the required checks and reach consensus. No caller can submit a price or select the outcome.",
  },
  {
    icon: CalendarClock,
    title: "Authorized wallets can trigger settlement",
    body: "The contract owner and approved operators may settle any protection. A protection owner may settle their own protection. The caller cannot change the market, prices, trigger or result.",
  },
  {
    icon: BadgeCheck,
    title: "The purchase terms are fixed",
    body: "The market, movement threshold, protection period, premium, fixed payout, reference price and trigger price are stored when the purchase completes. They cannot be changed afterwards.",
  },
  {
    icon: KeyRound,
    title: "Only the owner can claim",
    body: "Settlement is limited to authorized wallets, and only the wallet that owns the protection can claim its payout.",
  },
];

function Transparency() {
  const config = useQuery({
    queryKey: aegisKeys.config,
    queryFn: getConfig,
    staleTime: 10 * 60_000,
  });
  const terms = useQuery({
    queryKey: aegisKeys.terms,
    queryFn: getProductTerms,
    staleTime: 5 * 60_000,
  });
  const thresholds = [...new Set(terms.data?.map((item) => item.event_percent) ?? [])];
  const durations = [...new Set(terms.data?.map((item) => item.duration_days) ?? [])];
  const error = config.error ?? terms.error;

  return (
    <>
      <PageHeader
        eyebrow="Transparency"
        title="How settlement works, in plain language"
        description="See how purchase terms are stored, how each eligible date is settled and who can claim a payout."
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        {error ? (
          <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {publicReadErrorMessage(error)}
          </div>
        ) : null}
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

        <section className="surface-card mt-8 p-6 sm:p-7">
          <h2 className="text-xl font-medium">How settlement results are determined</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Each source price is compared separately with the stored trigger price.
          </p>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>If both prices confirm the trigger, the result is Breached.</li>
            <li>If neither price confirms the trigger, the result is Not breached.</li>
            <li>If only one price confirms the trigger, the result is Inconclusive.</li>
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            An inconclusive result means the two sources produced different trigger outcomes. No
            payout decision is made for that date, and settlement can be tried again later.
          </p>
        </section>

        <div className="surface-card mt-8 overflow-hidden">
          <div className="border-b border-border px-6 py-5">
            <p className="eyebrow">Current product terms</p>
          </div>
          <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            <Term
              label="Movement thresholds"
              value={thresholds.map((threshold) => `${threshold}%`).join(" · ") || "—"}
            />
            <Term
              label="Protection periods"
              value={durations.map((duration) => `${duration} days`).join(" · ") || "—"}
            />
            <Term
              label="Settlement schedule"
              value="One eligible UTC date per day after purchase"
            />
            <Term
              label="Purchase reference source"
              value={config.data?.purchase_reference ?? "—"}
            />
            <Term label="Settlement sources" value={config.data?.settlement_sources ?? "—"} />
            <Term label="Contract version" value={config.data?.version ?? "—"} />
          </dl>
        </div>

        <OperatorManagement />

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card/60 px-6 py-6">
          <p className="max-w-lg text-sm text-muted-foreground">
            Choose a market, movement threshold and protection period. Review the fixed terms before
            you purchase.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" variant="outline">
              <Link to="/how-it-works">How It Works</Link>
            </Button>
            <Button asChild size="lg">
              <Link
                to="/protection/new"
                search={{ market: undefined, threshold: undefined, duration: undefined }}
              >
                Get Protection
              </Link>
            </Button>
          </div>
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
