import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";
import { useConnect, useConnectors } from "wagmi";
import { WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { shortenAddress } from "@/lib/web3/wallet";

type InjectedConnector = ReturnType<typeof useConnectors>[number];

export function WalletControl({ compact = false }: { compact?: boolean }) {
  const connectors = useConnectors();
  const { connect, isPending, error } = useConnect();
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState<InjectedConnector[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all(
      connectors
        .filter((connector) => connector.type === "injected")
        .map(async (connector) => {
          try {
            return (await connector.getProvider()) ? connector : null;
          } catch {
            return null;
          }
        }),
    ).then((values) => {
      if (!active) return;
      const unique = new Map(values.filter(Boolean).map((item) => [item!.uid, item!]));
      setInstalled([...unique.values()]);
    });
    return () => {
      active = false;
    };
  }, [connectors]);

  return (
    <>
      <ConnectButton.Custom>
        {({ account, chain, mounted, openAccountModal, openChainModal }) => {
          const ready = mounted;
          const connected = ready && account && chain;
          if (!connected) {
            return (
              <Button size={compact ? "sm" : "default"} onClick={() => setOpen(true)}>
                Connect wallet
              </Button>
            );
          }
          if (chain.unsupported) {
            return (
              <Button size={compact ? "sm" : "default"} onClick={openChainModal}>
                Switch to Bradbury
              </Button>
            );
          }
          return (
            <Button
              size={compact ? "sm" : "default"}
              variant="outline"
              onClick={openAccountModal}
              aria-label="Open wallet account menu"
            >
              <span className="hidden text-xs text-muted-foreground sm:inline">Bradbury</span>
              <span className="numeric">{shortenAddress(account.address)}</span>
            </Button>
          );
        }}
      </ConnectButton.Custom>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect an installed wallet</DialogTitle>
            <DialogDescription>
              Choose an EVM-compatible browser extension announced to this browser.
            </DialogDescription>
          </DialogHeader>
          {installed.length ? (
            <div className="grid gap-2">
              {installed.map((connector) => (
                <Button
                  key={connector.uid}
                  variant="outline"
                  className="h-auto justify-start gap-3 px-4 py-3"
                  disabled={isPending}
                  onClick={() =>
                    connect(
                      { connector },
                      {
                        onSuccess: () => setOpen(false),
                      },
                    )
                  }
                >
                  <WalletCards className="size-4 text-primary" />
                  {connector.name}
                </Button>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-secondary/50 p-4 text-sm leading-relaxed text-muted-foreground">
              No compatible browser wallet was detected. Install an EVM-compatible wallet extension
              and refresh the page.
            </p>
          )}
          {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
