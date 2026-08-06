import { useAccount, useBalance, useChainId, useDisconnect, useSwitchChain } from "wagmi";
import { BRADBURY_CHAIN_ID } from "@/lib/aegis/contract-config";
import type { WriteContext } from "@/lib/web3/wallet";

export function useWalletState() {
  const account = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const balance = useBalance({
    address: account.address,
    chainId: BRADBURY_CHAIN_ID,
    query: { enabled: Boolean(account.address) },
  });
  const isWrongNetwork = account.isConnected && chainId !== BRADBURY_CHAIN_ID;

  async function switchToBradbury() {
    await switchChainAsync({ chainId: BRADBURY_CHAIN_ID });
  }

  function getWriteContext(): WriteContext {
    return {
      address: account.address,
      chainId,
      activeConnector: account.connector,
    };
  }

  return {
    address: account.address,
    connector: account.connector,
    isConnected: account.isConnected,
    isConnecting: account.isConnecting,
    isWrongNetwork,
    chainId,
    balance: balance.data,
    balanceLoading: balance.isLoading,
    switching,
    disconnect,
    switchToBradbury,
    getWriteContext,
  };
}
