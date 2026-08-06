import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { LogoLockup } from "./logo-lockup";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { WalletControl } from "./wallet-control";

const NAV = [
  { to: "/markets", label: "Markets" },
  { to: "/protection/new", label: "Get Protection" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/transparency", label: "Transparency" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          aria-label="Aegis Markets home"
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <LogoLockup compactOnNarrow />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
              )}
              activeProps={{ className: "text-foreground bg-secondary" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <WalletControl compact />
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="px-4 pt-4">
                <LogoLockup />
              </div>
              <nav className="mt-6 flex flex-col gap-1 px-2">
                {NAV.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                    activeProps={{ className: "text-foreground bg-secondary" }}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-6 px-4">
                <WalletControl />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
