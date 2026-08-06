import { defineChain } from "viem";
import { aegisConfig } from "@/lib/aegis/contract-config";

export const genLayerBradbury = defineChain({
  id: aegisConfig.chainId,
  name: aegisConfig.networkName,
  nativeCurrency: {
    name: "GEN",
    symbol: "GEN",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [aegisConfig.rpcUrl] },
    public: { http: [aegisConfig.rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: "GenLayer Bradbury Explorer",
      url: aegisConfig.explorerUrl,
    },
  },
  testnet: true,
});

export function explorerTransactionUrl(hash: string) {
  return `${aegisConfig.explorerUrl.replace(/\/$/, "")}/tx/${hash}`;
}

export function explorerAddressUrl(address: string) {
  return `${aegisConfig.explorerUrl.replace(/\/$/, "")}/address/${address}`;
}
