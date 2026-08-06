import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import type { Address } from "viem";
import { aegisConfig } from "./contract-config";
import type { Eip1193Provider } from "@/lib/web3/wallet";

const bradburyClientChain = {
  ...testnetBradbury,
  blockExplorers: testnetBradbury.blockExplorers!,
};

export function createAegisReadClient(account?: Address) {
  return createClient({
    chain: bradburyClientChain,
    endpoint: aegisConfig.rpcUrl,
    ...(account ? { account } : {}),
  });
}

export function createAegisWriteClient({
  account,
  provider,
}: {
  account: Address;
  provider: Eip1193Provider;
}) {
  return createClient({
    chain: bradburyClientChain,
    endpoint: aegisConfig.rpcUrl,
    account,
    provider,
  });
}
