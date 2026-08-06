import "@rainbow-me/rainbowkit/styles.css";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { genLayerBradbury } from "./chains";
import { wagmiConfig } from "./wagmi";

export function Web3Providers({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          appInfo={{ appName: "Aegis Markets" }}
          initialChain={genLayerBradbury}
          modalSize="compact"
          theme={lightTheme({
            accentColor: "#184f56",
            accentColorForeground: "#ffffff",
            borderRadius: "small",
            fontStack: "system",
            overlayBlur: "small",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
