// ─── Kredo app settings ───────────────────────────────────────────────
// Default: the REAL Kredo contract on Stellar Testnet, signed with Freighter.
// Practice mode: set VITE_USE_MOCK=true in app/.env to use a pretend contract in the
// browser with the same rules (no wallet needed, resets on reload).
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

// From deployments/testnet.json in the team repo.
export const CONTRACT_ID = "CBDATTO6MSWR6OIEKNVPR6K53EMRDOZ6J2R52F3EPB3RDZIVMBSNIPG3";
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const PANEL = [
  "GA6FE76F33XFE45AHOYTMS3XD7IHKOQI2645AIWM57YHBW36URCGKKUM",
  "GBDFEYXAEWLUUKIYEM3E4ZXU76CCIDPPW4WZ2NB7JXKX7KVIIOIRISCU",
  "GBCBN4QV4FPU22IQJIRSLGRLFIURK7UEE6MJSVXEELSSGYASDMSBQADW",
];
export const EXPLORER = "https://stellar.expert/explorer/testnet";

// Demo settings, matching what the contract was initialized with.
export const MIN_BOND_XLM = 100;
export const MAX_VOUCHES = 5;
export const SLASH_PERCENT = 50;

export const xlmToStroops = (xlm: number) => BigInt(Math.round(xlm * 1e7));
export const stroopsToXlm = (s: bigint | number) => Number(s) / 1e7;

// Secret used to turn a document number into a keyed hash.
// For the demo it can be set in a .env file (VITE_KREDO_SECRET). In a real product
// it would stay on the issuer's server, never in the browser.
export const KREDO_SECRET =
  (import.meta.env.VITE_KREDO_SECRET as string | undefined) ?? "kredo-demo-secret";
