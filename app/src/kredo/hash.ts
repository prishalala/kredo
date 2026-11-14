import { KREDO_SECRET } from "../config";

// doc_hash = HMAC-SHA256(KREDO_SECRET, country + ":" + documentNumber)
// Runs in the browser with Web Crypto (Node's "crypto" module doesn't work in Vite).
// Same document → same hash → the contract blocks the duplicate.
// The document number itself never leaves this function.
export async function docHash(country: string, documentNumber: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(KREDO_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const msg = `${country.toUpperCase().trim()}:${documentNumber.toUpperCase().trim()}`;
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return new Uint8Array(sig); // 32 bytes → BytesN<32>
}

export const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
