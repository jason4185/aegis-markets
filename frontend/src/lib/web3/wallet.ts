import type { Address } from "viem";

export type Eip1193Provider = {
  request: (args: {
    method: string;
    params?: unknown[] | Record<string, unknown>;
  }) => Promise<unknown>;
};

export type ActiveWalletConnector = {
  id?: string;
  name?: string;
  type?: string;
  getProvider?: () => Promise<unknown> | unknown;
};

export type WriteContext = {
  address?: Address | undefined;
  chainId?: number | undefined;
  activeConnector?: ActiveWalletConnector | null | undefined;
};

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
