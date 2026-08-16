import { isAddress, type Address } from "viem";

export const BRADBURY_CHAIN_ID = 4221;
export const BRADBURY_RPC_URL = "https://rpc-bradbury.genlayer.com";
export const BRADBURY_EXPLORER_URL = "https://explorer-bradbury.genlayer.com";
export const AEGIS_PROTECTION_ADDRESS = "0x50C0073170f9de34e57227739441A153af2f5f84" as Address;
export const AEGIS_OWNER_ADDRESS = "0xC8Ba5DA455b011863F2ECa76a6fa21E62Cc91B87" as Address;

type AegisConfig = {
  contractAddress: Address;
  ownerAddress: Address;
  networkName: "GenLayer Bradbury";
  chainId: 4221;
  rpcUrl: string;
  explorerUrl: string;
};

function parseUrl(value: unknown, name: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
    return parsed.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`APPLICATION_CONFIG_ERROR: ${name} must be a valid HTTP(S) URL.`);
  }
}

export function parseAegisConfig(env: Record<string, unknown>): AegisConfig {
  const contractRaw = String(env["VITE_AEGIS_CONTRACT_ADDRESS"] || AEGIS_PROTECTION_ADDRESS).trim();
  if (!isAddress(contractRaw)) {
    throw new Error(
      "APPLICATION_CONFIG_ERROR: VITE_AEGIS_CONTRACT_ADDRESS must be a valid 0x address.",
    );
  }

  const ownerRaw = String(env["VITE_AEGIS_OWNER_ADDRESS"] || AEGIS_OWNER_ADDRESS).trim();
  if (!isAddress(ownerRaw)) {
    throw new Error(
      "APPLICATION_CONFIG_ERROR: VITE_AEGIS_OWNER_ADDRESS must be a valid 0x address.",
    );
  }

  const chainRaw = String(env["VITE_GENLAYER_CHAIN_ID"] || BRADBURY_CHAIN_ID).trim();
  if (!/^\d+$/.test(chainRaw) || Number(chainRaw) !== BRADBURY_CHAIN_ID) {
    throw new Error("APPLICATION_CONFIG_ERROR: VITE_GENLAYER_CHAIN_ID must be 4221.");
  }

  return {
    contractAddress: contractRaw as Address,
    ownerAddress: ownerRaw as Address,
    networkName: "GenLayer Bradbury",
    chainId: BRADBURY_CHAIN_ID,
    rpcUrl: parseUrl(env["VITE_GENLAYER_RPC_URL"] || BRADBURY_RPC_URL, "VITE_GENLAYER_RPC_URL"),
    explorerUrl: parseUrl(
      env["VITE_GENLAYER_EXPLORER_URL"] || BRADBURY_EXPLORER_URL,
      "VITE_GENLAYER_EXPLORER_URL",
    ),
  };
}

export const aegisConfig = parseAegisConfig(import.meta.env);
