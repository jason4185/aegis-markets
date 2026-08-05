/**
 * Aegis contract configuration.
 *
 * The GenLayer contract is not deployed yet — this single placeholder is the
 * only place a real address needs to be added later.
 */
export const AEGIS_CONTRACT_ADDRESS: string | null = null;

export const AEGIS_NETWORK = {
  name: "GenLayer Studionet",
  explorerBaseUrl: "https://studio.genlayer.com/tx/",
} as const;

export const REFERENCE_SOURCE = "Aegis price oracle (locked at purchase)";
export const SETTLEMENT_SOURCES: [string, string] = [
  "Independent Source A — institutional FX & metals feed",
  "Independent Source B — public market data feed",
];
