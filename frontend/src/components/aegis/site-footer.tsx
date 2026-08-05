import { Link } from "@tanstack/react-router";
import { AegisLogo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 ink-panel">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2.5">
              <span className="display text-2xl text-ink-foreground">Aegis</span>
              <span className="text-[0.62rem] font-medium uppercase tracking-[0.2em] text-ink-foreground/60">
                Protection
              </span>
            </span>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-foreground/65">
              Fixed-payout protection for currencies and metals, settled daily by GenLayer
              validator consensus.
            </p>
          </div>
          <FooterCol
            title="Product"
            links={[
              { to: "/markets", label: "Markets" },
              { to: "/protection/new", label: "Get Protection" },
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
            <p className="mt-4 flex items-center gap-2 text-sm text-ink-foreground/75">
              <span className="size-2 rounded-full bg-brass" />
              Validators online
            </p>
            <p className="mt-2 text-sm text-ink-foreground/55">Contract address: pending deploy</p>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-ink-foreground/12 pt-6 text-xs text-ink-foreground/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Aegis Markets. Prototype interface.</p>
          <div className="hidden sm:block">
            <AegisLogo showWordmark={false} />
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string }[];
}) {
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
