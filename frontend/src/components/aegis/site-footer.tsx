import { Link } from "@tanstack/react-router";
import { LogoLockup } from "./logo-lockup";
import { LogoMark } from "./logo-mark";
import { aegisConfig } from "@/lib/aegis/contract-config";
import { explorerAddressUrl } from "@/lib/web3/chains";
import { shortenAddress } from "@/lib/web3/wallet";

export function SiteFooter() {
  return (
    <footer className="mt-24 ink-panel">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <LogoLockup variant="reversed" markClassName="size-9" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-foreground/65">
              Fixed-payout protection for selected currency and metals markets, verified through
              GenLayer consensus.
            </p>
          </div>
          <FooterCol
            title="Product"
            links={[
              { to: "/markets", label: "Markets" },
              { to: "/protection/new", label: "Get Protection" },
              { to: "/how-it-works", label: "How It Works" },
              { to: "/dashboard", label: "Dashboard" },
            ]}
          />
          <FooterCol
            title="Protocol"
            links={[
              { to: "/transparency", label: "Transparency" },
              { to: "/transparency", label: "Settlement" },
              { to: "/transparency", label: "Fixed terms" },
            ]}
          />
          <div>
            <h4 className="text-[0.62rem] font-medium uppercase tracking-[0.18em] text-ink-foreground/50">
              Status
            </h4>
            <p className="mt-4 text-sm text-ink-foreground/75">Contract connection</p>
            <p className="mt-2 text-sm text-ink-foreground/55">{aegisConfig.networkName}</p>
            <a
              className="mt-2 block text-sm text-ink-foreground/75 hover:text-ink-foreground"
              href={explorerAddressUrl(aegisConfig.contractAddress)}
              target="_blank"
              rel="noreferrer"
            >
              {shortenAddress(aegisConfig.contractAddress)}
            </a>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-ink-foreground/12 pt-6 text-xs text-ink-foreground/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Aegis Markets.</p>
          <div className="hidden sm:block">
            <LogoMark variant="reversed" className="size-6" />
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h4 className="text-[0.62rem] font-medium uppercase tracking-[0.18em] text-ink-foreground/50">
        {title}
      </h4>
      <ul className="mt-4 space-y-2.5">
        {links.map((l, i) => (
          <li key={`${l.to}-${i}`}>
            <Link to={l.to} className="text-sm text-ink-foreground/75 hover:text-ink-foreground">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
