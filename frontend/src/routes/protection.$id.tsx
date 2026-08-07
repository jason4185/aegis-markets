import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/aegis/page-header";
import { StatusBadge } from "@/components/aegis/status-badge";
import { WalletControl } from "@/components/aegis/wallet-control";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getMarketSettlement,
  canSettleProtection,
  getProtectionDetails,
  getSettlementHistory,
  getSettlementReadiness,
} from "@/lib/aegis/contract-reads";
import { claimPayout, settleProtection } from "@/lib/aegis/contract-writes";
import { normalizeAegisError, publicReadErrorMessage } from "@/lib/aegis/errors";
import {
  formatDate,
  formatGen,
  formatPrice,
  reserveStatusLabel,
  settlementResultLabel,
  formatUnixDate,
  formatUnixDateTime,
} from "@/lib/aegis/format";
import { aegisKeys } from "@/lib/aegis/query-keys";
import { useTransactionManager } from "@/lib/aegis/transaction-context";
import { useWalletState } from "@/hooks/use-wallet-state";
import { shortenAddress } from "@/lib/web3/wallet";
import { aegisConfig } from "@/lib/aegis/contract-config";
import {
  isDailySettlementProcessable,
  settlementAvailabilityMessage,
} from "@/lib/aegis/settlement-time";

export const Route = createFileRoute("/protection/$id")({
  head: () => ({ meta: [{ title: "Protection details — Aegis Markets" }] }),
  component: ProtectionPage,
});

function parseProtectionId(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null;
  try {
    const parsed = BigInt(value);
    return parsed >= 0n ? parsed : null;
  } catch {
    return null;
  }
}

const READINESS_MESSAGES: Record<string, string> = {
  READY: "This settlement date is ready.",
  MARKET_SETTLEMENT_AVAILABLE: "Verified market data is available for this date.",
  MARKET_SETTLEMENT_RETRYABLE:
    "The previous result was inconclusive. Try this settlement date again later.",
  FUTURE_SETTLEMENT_DATE: "This settlement date is not eligible yet.",
  DATE_ALREADY_SETTLED: "This settlement date is already complete.",
  PROTECTION_CLAIMABLE: "Protection is now claimable.",
  PROTECTION_EXPIRED: "This protection has expired.",
  PROTECTION_NOT_ACTIVE: "This protection is no longer active.",
  INVALID_SETTLEMENT_DATE: "This settlement date is not eligible.",
};

function ProtectionPage() {
  const { id: routeId } = Route.useParams();
  const protectionId = parseProtectionId(routeId);
  const wallet = useWalletState();
  const queryClient = useQueryClient();
  const transaction = useTransactionManager();
  const [now, setNow] = useState(() => new Date());
  const details = useQuery({
    queryKey:
      protectionId === null ? ["aegis", "invalid-protection"] : aegisKeys.details(protectionId),
    queryFn: () => getProtectionDetails(protectionId!, wallet.address),
    enabled: protectionId !== null,
  });
  const history = useQuery({
    queryKey:
      protectionId === null ? ["aegis", "invalid-history"] : aegisKeys.history(protectionId),
    queryFn: () =>
      getSettlementHistory(protectionId!, 0n, details.data!.duration_days, wallet.address),
    enabled: protectionId !== null && Boolean(details.data),
  });
  const nextDate = details.data?.next_unresolved_settlement_date ?? "";
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const readiness = useQuery({
    queryKey:
      protectionId === null
        ? ["aegis", "invalid-readiness"]
        : aegisKeys.readiness(protectionId, nextDate),
    queryFn: () => getSettlementReadiness(protectionId!, nextDate, wallet.address),
    enabled: protectionId !== null && Boolean(nextDate),
    refetchInterval: nextDate ? 60_000 : false,
  });
  const authorization = useQuery({
    queryKey:
      protectionId === null
        ? ["aegis", "invalid-settlement-authorization"]
        : aegisKeys.settlementAuthorization(protectionId, wallet.address),
    queryFn: () => canSettleProtection(wallet.address!, protectionId!),
    enabled:
      protectionId !== null &&
      Boolean(wallet.address && details.data?.status === "ACTIVE" && nextDate),
  });
  const marketSettlement = useQuery({
    queryKey:
      details.data && nextDate
        ? aegisKeys.marketSettlement(details.data.market_id, nextDate)
        : ["aegis", "inactive-market-settlement"],
    queryFn: () => getMarketSettlement(details.data!.market_id, nextDate, wallet.address),
    enabled: Boolean(readiness.data?.market_settlement_exists && details.data && nextDate),
  });
  const error = details.error ?? history.error ?? readiness.error ?? authorization.error;
  const isOwner = Boolean(
    wallet.address && details.data?.owner.toLowerCase() === wallet.address.toLowerCase(),
  );
  const canClaim = Boolean(
    details.data?.status === "CLAIMABLE" &&
    details.data.can_claim &&
    !details.data.claimed &&
    isOwner,
  );
  const dailyDataComplete = isDailySettlementProcessable(nextDate, now);
  const canSubmitSettlement = Boolean(
    readiness.data?.ready &&
    dailyDataComplete &&
    authorization.data?.authorized &&
    details.data?.status === "ACTIVE" &&
    wallet.isConnected &&
    !wallet.isWrongNetwork,
  );

  async function runAction(kind: "settle" | "claim") {
    if (protectionId === null) return;
    transaction.begin(kind === "settle" ? "Settling protection" : "Claiming payout");
    try {
      if (kind === "settle") {
        await settleProtection({
          context: wallet.getWriteContext(),
          protectionId,
          onProgress: transaction.onProgress,
          queryClient,
        });
      } else {
        await claimPayout({
          context: wallet.getWriteContext(),
          protectionId,
          onProgress: transaction.onProgress,
          queryClient,
        });
      }
    } catch (actionError) {
      transaction.fail(actionError);
    }
  }

  if (protectionId === null) {
    return (
      <MessagePage
        title="Protection link unavailable"
        body="This protection link is not available. Return to your dashboard to continue."
      />
    );
  }

  return (
    <>
      <PageHeader
        title={details.data ? `${details.data.symbol} protection` : "Protection details"}
        description="Your protection terms, settlement history and available actions."
        actions={
          <Button asChild variant="outline">
            <Link to="/dashboard">
              <ArrowLeft className="size-4" /> Dashboard
            </Link>
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {publicReadErrorMessage(error)}
          </div>
        ) : null}
        {details.isLoading ? <Skeleton className="h-96 w-full rounded-xl" /> : null}
        {details.data ? (
          <>
            <section className="surface-card p-6 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="display text-3xl">{details.data.symbol}</h2>
                    <StatusBadge status={details.data.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {details.data.direction === "DOWN" ? "Downward move" : "Upward move"} ·{" "}
                    {details.data.event_percent}% · {details.data.duration_days} days
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Fixed payout</p>
                  <p className="numeric text-2xl text-brass-foreground">
                    {formatGen(details.data.payout)}
                  </p>
                </div>
              </div>
              <dl className="mt-7 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="Owner"
                  value={isOwner ? "Your wallet" : shortenAddress(details.data.owner)}
                />
                <Field label="Premium" value={formatGen(details.data.premium)} />
                <Field label="Payout" value={formatGen(details.data.payout)} />
                <Field
                  label="Reference price"
                  value={formatPrice(details.data.reference_price, details.data.symbol)}
                />
                <Field
                  label="Trigger price"
                  value={formatPrice(details.data.trigger_price, details.data.symbol)}
                />
                <Field
                  label="Price checked at"
                  value={formatUnixDateTime(details.data.source_timestamp)}
                />
                <Field label="Purchased at" value={formatUnixDateTime(details.data.purchased_at)} />
                <Field
                  label="First settlement date"
                  value={formatDate(details.data.first_settlement_date)}
                />
                <Field
                  label="Final settlement date"
                  value={formatDate(details.data.last_settlement_date)}
                />
                <Field
                  label="Protection ends"
                  value={formatUnixDateTime(details.data.expires_at)}
                />
                <Field
                  label="Breach date"
                  value={details.data.breach_date ? formatDate(details.data.breach_date) : "—"}
                />
                <Field
                  label="Settlement days completed"
                  value={details.data.processed_dates.toString()}
                />
                {details.data.inconclusive_dates > 0n ? (
                  <Field
                    label="Days awaiting confirmation"
                    value={details.data.inconclusive_dates.toString()}
                  />
                ) : null}
                <Field
                  label="Settlement days remaining"
                  value={details.data.remaining_dates.toString()}
                />
                <Field
                  label="Latest result"
                  value={settlementResultLabel(details.data.latest_settlement_result)}
                />
                <Field label="Next settlement date" value={nextDate ? formatDate(nextDate) : "—"} />
                <Field
                  label="Payout funds"
                  value={reserveStatusLabel(details.data.reserve_status)}
                />
                <Field label="Payout available" value={details.data.claimable ? "Yes" : "No"} />
                <Field label="Payout received" value={details.data.claimed ? "Yes" : "No"} />
              </dl>
            </section>

            <section className="surface-card mt-6 p-6 sm:p-7">
              <h2 className="text-xl font-medium">Available actions</h2>
              {nextDate && readiness.data ? (
                <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-4">
                  <p className="text-sm font-medium">
                    Next settlement date: {formatDate(nextDate)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {dailyDataComplete
                      ? (READINESS_MESSAGES[readiness.data.reason_code] ?? "Status unavailable")
                      : (settlementAvailabilityMessage(nextDate, now) ??
                        "This settlement date is not eligible yet.")}
                  </p>
                  {marketSettlement.data ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Verified market data is available for this date.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {!wallet.isConnected ? (
                <div className="mt-5">
                  <WalletControl />
                </div>
              ) : null}
              {wallet.isWrongNetwork ? (
                <div className="mt-5">
                  <Button variant="outline" onClick={() => void wallet.switchToBradbury()}>
                    Switch to Bradbury
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    If automatic switching is unsupported, open your wallet and select the GenLayer
                    Bradbury network.
                  </p>
                </div>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-3">
                {canSubmitSettlement ? (
                  <Button onClick={() => void runAction("settle")}>
                    Settle {formatDate(nextDate)}
                  </Button>
                ) : wallet.isConnected &&
                  !wallet.isWrongNetwork &&
                  details.data.status === "ACTIVE" &&
                  Boolean(nextDate) &&
                  readiness.data?.ready &&
                  authorization.data?.authorized &&
                  !dailyDataComplete ? (
                  <Button disabled>Available after daily close</Button>
                ) : null}
                {canClaim && !wallet.isWrongNetwork ? (
                  <Button onClick={() => void runAction("claim")}>
                    Claim {formatGen(details.data.payout)}
                  </Button>
                ) : null}
              </div>
              {wallet.isConnected &&
              details.data.status === "ACTIVE" &&
              nextDate &&
              dailyDataComplete &&
              authorization.data &&
              !authorization.data.authorized ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  You are not authorized to settle this protection.
                </p>
              ) : null}
              {details.data.status === "CLAIMABLE" && !isOwner ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Only the wallet that owns this protection can claim the payout.
                </p>
              ) : null}
              {details.data.status === "EXPIRED" ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  This protection ended automatically after its final required no-move settlement,
                  and its reserved payout was released by the contract.
                </p>
              ) : null}
              {details.data.latest_settlement_result === "BREACHED" ? (
                <p className="mt-4 text-sm text-success">Protection is now claimable.</p>
              ) : details.data.latest_settlement_result === "NOT_BREACHED" ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  The trigger was not confirmed for this date.
                </p>
              ) : details.data.latest_settlement_result === "INCONCLUSIVE" ? (
                <p className="mt-4 text-sm text-warning-foreground">
                  The two sources produced different trigger outcomes. Try this settlement date
                  again later.
                </p>
              ) : null}
            </section>

            <section className="surface-card mt-6 overflow-hidden">
              <div className="border-b border-border px-6 py-5">
                <h2 className="text-xl font-medium">Settlement history</h2>
              </div>
              <div className="divide-y divide-border">
                {(history.data ?? []).map((entry) => (
                  <article
                    key={entry.settlement_date}
                    className="grid gap-3 px-6 py-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center"
                  >
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="mt-1 text-sm">{formatDate(entry.settlement_date)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Result</p>
                      <p className="mt-1 text-sm">{settlementResultLabel(entry.result)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Source prices</p>
                      <p className="numeric mt-1 text-sm">
                        {entry.market_settlement_exists
                          ? `${formatPrice(entry.fxratesapi_price, details.data.symbol)} · ${formatPrice(entry.fawaz_price, details.data.symbol)}`
                          : "Not available"}
                      </p>
                    </div>
                  </article>
                ))}
                {history.data?.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-muted-foreground">
                    No settlement dates have been processed.
                  </p>
                ) : null}
              </div>
            </section>

            <a
              className="mt-6 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              href={`${aegisConfig.explorerUrl}/address/${aegisConfig.contractAddress}`}
              target="_blank"
              rel="noreferrer"
            >
              View contract in explorer <ExternalLink className="size-3.5" />
            </a>
          </>
        ) : null}
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-card px-4 py-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="numeric mt-1 break-words text-sm">{value}</dd>
    </div>
  );
}

function MessagePage({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="display text-3xl">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
      <Button asChild className="mt-6">
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
