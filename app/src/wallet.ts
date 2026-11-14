// Freighter wallet connection.
// Install the Freighter browser extension and switch it to Testnet first.
import { isConnected, requestAccess, WatchWalletChanges } from "@stellar/freighter-api";

export async function connectWallet(): Promise<string> {
  const conn = await isConnected();
  if (!conn.isConnected) {
    throw new Error("Freighter isn't installed. Add the Freighter extension to Chrome, then reload.");
  }
  const res = await requestAccess();
  if (res.error) throw new Error(res.error.message ?? "Wallet connection was declined.");
  return res.address;
}

// The demo switches between several Freighter accounts (agency, bank, panelists).
// This tells the app when the user picks a different account, so it signs as the right one.
// Returns a function that stops watching.
export function watchAccount(onChange: (address: string) => void): () => void {
  const watcher = new WatchWalletChanges(1000);
  watcher.watch(({ address, error }) => {
    if (!error && address) onChange(address);
  });
  return () => watcher.stop();
}

export const short = (addr: string) => (addr ? `${addr.slice(0, 5)}…${addr.slice(-4)}` : "");
