// Freighter wallet connection.
// Install the Freighter browser extension and switch it to Testnet first.
import { isConnected, requestAccess, signTransaction } from "@stellar/freighter-api";
import { NETWORK_PASSPHRASE } from "./config";

export async function connectWallet(): Promise<string> {
  const conn = await isConnected();
  if (!conn.isConnected) {
    throw new Error("Freighter isn't installed. Add the Freighter extension to Chrome, then reload.");
  }
  const res = await requestAccess();
  if (res.error) throw new Error(res.error.message ?? "Wallet connection was declined.");
  return res.address;
}

// Used on Sunday when calling the real contract: the generated client builds a
// transaction, Freighter signs it.
export async function signWithFreighter(xdr: string, address: string): Promise<string> {
  const res = await signTransaction(xdr, { networkPassphrase: NETWORK_PASSPHRASE, address });
  if (res.error) throw new Error(res.error.message ?? "Signing was declined.");
  return res.signedTxXdr;
}

export const short = (addr: string) => (addr ? `${addr.slice(0, 5)}…${addr.slice(-4)}` : "");
