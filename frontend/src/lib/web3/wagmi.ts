import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { genLayerBradbury } from "./chains";

// RainbowKit renders a custom installed-wallet experience over this connector.
// Wagmi's EIP-6963 discovery creates one injected connector per announced wallet.
export const wagmiConfig = createConfig({
  chains: [genLayerBradbury],
  connectors: [
    injected({
      shimDisconnect: true,
    }),
  ],
  multiInjectedProviderDiscovery: true,
  ssr: true,
  transports: {
    [genLayerBradbury.id]: http(genLayerBradbury.rpcUrls.default.http[0]),
  },
});

export const walletConnectorPolicy = {
  injectedOnly: true,
  eip6963Discovery: true,
  qrCodes: false,
  connectorKinds: ["injected"] as const,
};
