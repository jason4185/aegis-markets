import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Database,
  Landmark,
  LockKeyhole,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";
import { PageHeader } from "@/components/aegis/page-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works — Aegis Markets" },
      {
        name: "description",
        content:
          "From fixed protection terms and a locked reference price to authorized settlement and owner-only claims.",
      },
      { property: "og:title", content: "How It Works — Aegis Markets" },
      {
        property: "og:description",
        content:
          "Understand how Aegis Markets protection moves from purchase to settlement and payout.",
      },
    ],
  }),
  component: HowItWorks,
});

function HowItWorks() {
  return (
    <>
      <PageHeader
        eyebrow="How it works"
        title="From purchase to payout"
        description="Aegis Markets provides fixed-payout protection for defined movements in selected currency and metals markets. The terms are known before purchase, and settlement results are determined from independently verified market data."
      />

      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-14 sm:px-6 md:py-20">
        <NumberedSection number="01" icon={SlidersHorizontal} title="Choose your protection">
          <p>
            Select one of the supported markets, then choose a movement threshold and protection
            period. The protected direction is fixed by the selected market.
          </p>
          <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
            <Detail
              label="Supported market"
              value="GBP/USD · USD/JPY · USD/TRY · XAU/USD · XAG/USD"
            />
            <Detail label="Protected direction" value="Upward or downward, fixed by market" />
            <Detail label="Movement threshold" value="2%, 3% or 4%" />
            <Detail label="Protection period" value="7, 14 or 30 days" />
          </dl>
        </NumberedSection>

        <NumberedSection number="02" icon={WalletCards} title="Review fixed terms">
          <p>
            The contract sets the premium and fixed payout from the selected terms. These amounts
            are shown before you confirm the purchase.
          </p>
          <CheckList
            items={[
              "Premiums and fixed payouts are denominated in GEN.",
              "You do not choose or negotiate the payout.",
              "The purchase terms cannot be changed after purchase.",
            ]}
          />
        </NumberedSection>

        <NumberedSection number="03" icon={LockKeyhole} title="Lock the reference price">
          <p>
            During purchase, the contract obtains the current market price from FXRatesAPI. GenLayer
            validators independently fetch and verify the result. The accepted price becomes the
            reference price for the full protection period.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <InfoCard
              title="Before purchase"
              body="The reference price is not yet known. The trigger price cannot be calculated until the purchase reference is accepted."
            />
            <InfoCard
              title="After purchase"
              body="The trigger price is calculated from the accepted reference price and selected threshold. Both values are stored with the protection."
            />
          </div>
        </NumberedSection>

        <NumberedSection number="04" icon={Database} title="Settle each eligible date">
          <p>
            Settlement begins on the UTC calendar day after purchase. The contract owner, an
            approved operator or the owner of that protection may trigger an eligible date.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <InfoCard title="Settlement source A" body="FXRatesAPI Historical" />
            <InfoCard title="Settlement source B" body="Fawaz Currency API" />
          </div>
          <CheckList
            items={[
              "The caller does not provide either source price.",
              "The caller cannot choose the settlement result.",
              "Unrelated wallets cannot submit settlement.",
              "Settlement is not automatic unless a user or bot submits the transaction.",
            ]}
          />
        </NumberedSection>

        <NumberedSection number="05" icon={Landmark} title="Understand the result">
          <div className="grid gap-4 md:grid-cols-3">
            <OutcomeCard
              label="Breached"
              body="Both source prices confirm that the stored trigger was reached."
            />
            <OutcomeCard
              label="Not breached"
              body="Neither source price confirms that the stored trigger was reached."
            />
            <OutcomeCard
              label="Inconclusive"
              body="Only one source price confirms the trigger. No payout decision is made for that date, and settlement may be tried again later."
            />
          </div>
        </NumberedSection>

        <NumberedSection number="06" icon={WalletCards} title="Claim the fixed payout">
          <p>
            After a Breached result, the protection becomes Claimable. The fixed payout is not sent
            automatically. Only the wallet that owns the protection can submit the claim.
          </p>
          <div
            className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
            aria-label="Protection state flow: Active to Claimable to Claimed"
          >
            <State label="Active" />
            <ArrowRight className="mx-auto size-4 rotate-90 text-brass sm:rotate-0" aria-hidden />
            <State label="Claimable" />
            <ArrowRight className="mx-auto size-4 rotate-90 text-brass sm:rotate-0" aria-hidden />
            <State label="Claimed" />
          </div>
          <p className="mt-6 rounded-lg border border-border bg-secondary/60 p-4 text-sm leading-relaxed text-muted-foreground">
            If no eligible date confirms the trigger and all settlement dates are completed, the
            protection expires automatically and the reserved payout is released.
          </p>
        </NumberedSection>

        <section className="surface-card overflow-hidden" aria-labelledby="timeline-heading">
          <div className="border-b border-border px-6 py-6 sm:px-8">
            <p className="eyebrow">Simple timeline example</p>
            <h2 id="timeline-heading" className="mt-3 text-3xl">
              XAU/USD · 14-day protection
            </h2>
          </div>
          <div className="grid lg:grid-cols-[0.75fr_1.25fr]">
            <dl className="grid gap-px border-b border-border bg-border sm:grid-cols-2 lg:grid-cols-1 lg:border-r lg:border-b-0">
              <Detail label="Market" value="XAU/USD" />
              <Detail label="Protected direction" value="Downward" />
              <Detail label="Movement threshold" value="3%" />
              <Detail label="Protection period" value="14 days" />
              <Detail label="Premium" value="2 GEN" />
              <Detail label="Fixed payout" value="5 GEN" />
            </dl>
            <ol className="space-y-0 px-6 py-2 sm:px-8">
              <TimelineItem
                label="Day 0"
                text="Purchase completes and the reference price is locked."
              />
              <TimelineItem label="Day 1" text="First eligible settlement date." />
              <TimelineItem label="Days 2–14" text="Each remaining eligible date may be settled." />
              <TimelineItem
                label="After a confirmed breach"
                text="The protection becomes claimable."
              />
              <TimelineItem
                label="After the final date"
                text="If no breach is confirmed and all dates are complete, the protection expires."
              />
            </ol>
          </div>
        </section>

        <section className="ink-panel rounded-2xl px-6 py-14 text-center sm:px-12">
          <p className="eyebrow text-ink-foreground/55">Ready to begin?</p>
          <h2 className="mt-3 text-3xl text-ink-foreground md:text-4xl">
            Choose your protection terms
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-ink-foreground text-ink hover:bg-ink-foreground/90"
            >
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
              variant="outline"
              className="border-ink-foreground/25 bg-transparent text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground"
            >
              <Link to="/markets">View Supported Markets</Link>
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}

function NumberedSection({
  number,
  icon: Icon,
  title,
  children,
}: {
  number: string;
  icon: typeof CalendarDays;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="surface-card p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="numeric text-xs text-brass">{number}</span>
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/8 text-primary">
          <Icon className="size-4.5" strokeWidth={1.75} aria-hidden />
        </span>
      </div>
      <h2 className="mt-5 text-3xl">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base [&>p]:max-w-3xl">
        {children}
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-5 py-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
          <Check className="mt-0.5 size-4 shrink-0 text-brass" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/45 p-5">
      <h3 className="font-sans text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function OutcomeCard({ label, body }: { label: string; body: string }) {
  return (
    <article className="rounded-lg border border-border bg-secondary/45 p-5">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-brass">
        Settlement result
      </p>
      <h3 className="mt-2 text-2xl">{label}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </article>
  );
}

function State({ label }: { label: string }) {
  return (
    <span className="numeric rounded-lg border border-primary/25 bg-primary/6 px-5 py-3 text-center text-sm uppercase tracking-[0.1em] text-primary">
      {label}
    </span>
  );
}

function TimelineItem({ label, text }: { label: string; text: string }) {
  return (
    <li className="grid gap-1 border-b border-border py-5 last:border-0 sm:grid-cols-[11rem_1fr] sm:gap-5">
      <h3 className="font-sans text-sm font-semibold text-foreground">{label}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
    </li>
  );
}
