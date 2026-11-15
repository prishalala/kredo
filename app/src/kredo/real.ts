// The REAL Kredo contract on Stellar Testnet.
// Uses the Stellar SDK's contract client, which reads the contract's interface
// straight from the network (no generated bindings needed), and Freighter to sign.
import { Buffer } from "buffer";
import { contract } from "@stellar/stellar-sdk";
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL, stroopsToXlm, xlmToStroops } from "../config";
import { getNetworkDetails, signTransaction } from "@stellar/freighter-api";
import { KredoError } from "./types";
import type { Dispute, Issuer, VerifyResult } from "./types";

// Methods we call on the contract (names and inputs from CONTRACT.md).
interface KredoMethods {
  register_issuer(a: { org: string; bond: bigint }): Promise<contract.AssembledTransaction<unknown>>;
  top_up_bond(a: { org: string; amount: bigint }): Promise<contract.AssembledTransaction<unknown>>;
  issue_credential(a: { issuer: string; holder: string; doc_hash: Buffer; level: number; method: number }): Promise<contract.AssembledTransaction<unknown>>;
  verify(a: { holder: string }): Promise<contract.AssembledTransaction<RawVerify>>;
  get_issuer(a: { org: string }): Promise<contract.AssembledTransaction<unknown>>;
  open_dispute(a: { caller: string; holder: string }): Promise<contract.AssembledTransaction<unknown>>;
  vote(a: { panelist: string; holder: string; outcome: number }): Promise<contract.AssembledTransaction<unknown>>;
  release_bond(a: { org: string }): Promise<contract.AssembledTransaction<unknown>>;
  get_dispute(a: { holder: string }): Promise<contract.AssembledTransaction<unknown>>;
}
interface RawVerify {
  verified: boolean; level: number; method: number; issuer: string; issuer_bond: bigint;
  issuer_active: boolean; revoked: boolean; dispute_open: boolean; issued_at: bigint;
}
interface RawIssuer { org: string; bond: bigint; active_vouches: number; active: boolean }
interface RawDispute {
  holder: string; opened_by: string; votes_negligence: number; votes_deception: number; votes_valid: number;
  voted: string[]; resolved: boolean; outcome: number; slashed: bigint;
}

// One client per signer address (reads use a client with no signer).
const clients = new Map<string, Promise<contract.Client & KredoMethods>>();
function client(publicKey?: string) {
  const key = publicKey ?? "read";
  if (!clients.has(key)) {
    clients.set(key, contract.Client.from({
      contractId: CONTRACT_ID,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: RPC_URL,
      publicKey,
      signTransaction: publicKey
        ? async (xdr: string, opts?: { networkPassphrase?: string; address?: string }) => {
            const res = await signTransaction(xdr, { networkPassphrase: opts?.networkPassphrase ?? NETWORK_PASSPHRASE, address: publicKey });
            if (res.error) throw new Error(res.error.message ?? "Signing was declined in Freighter.");
            return { signedTxXdr: res.signedTxXdr, signerAddress: res.signerAddress };
          }
        : undefined,
    }) as Promise<contract.Client & KredoMethods>);
  }
  return clients.get(key)!;
}

// Turns "Error(Contract, #5)" from the network into a friendly KredoError.
function friendly(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.match(/Error\(Contract, #(\d+)\)/);
  if (m) throw new KredoError(Number(m[1]));
  throw e instanceof Error ? e : new Error(msg);
}

// Functions returning Result<T, Error> come back as Ok/Err objects.
function unwrap<T>(r: unknown): T | null {
  const res = r as { isErr?: () => boolean; unwrap?: () => T };
  if (res && typeof res.isErr === "function") return res.isErr() ? null : res.unwrap!();
  return r as T;
}

// The app shows a "View on stellar.expert" link for every transaction it sends.
type TxListener = (hash: string) => void;
let txListener: TxListener | null = null;
export function onTransaction(listener: TxListener | null) { txListener = listener; }

// Signing on the wrong network fails with an unclear error, so check Freighter first.
async function requireTestnet() {
  const net = await getNetworkDetails();
  if (net.error) throw new Error(net.error.message ?? "Couldn't read Freighter's network.");
  if (net.networkPassphrase !== NETWORK_PASSPHRASE) {
    throw new Error(`Freighter is on ${net.network || "another network"}. Switch it to Testnet, then try again.`);
  }
}

async function write(signer: string, call: (c: KredoMethods) => Promise<contract.AssembledTransaction<unknown>>) {
  try {
    await requireTestnet();
    const tx = await call(await client(signer));
    const sent = await tx.signAndSend();
    const hash = sent.sendTransactionResponse?.hash;
    if (hash) txListener?.(hash);
    const r = sent.result as { isErr?: () => boolean; unwrapErr?: () => { code?: number } };
    if (r && typeof r.isErr === "function" && r.isErr()) {
      const code = r.unwrapErr?.().code;
      if (code) throw new KredoError(code);
    }
  } catch (e) {
    if (e instanceof KredoError) throw e;
    friendly(e);
  }
}

export async function registerIssuer(org: string, bondXlm: number) {
  await write(org, (c) => c.register_issuer({ org, bond: xlmToStroops(bondXlm) }));
}

export async function topUpBond(org: string, amountXlm: number) {
  await write(org, (c) => c.top_up_bond({ org, amount: xlmToStroops(amountXlm) }));
}

export async function issueCredential(issuer: string, holder: string, hash: Uint8Array, level: number, method: number) {
  await write(issuer, (c) => c.issue_credential({ issuer, holder, doc_hash: Buffer.from(hash), level, method }));
}

export async function verify(holder: string): Promise<VerifyResult> {
  try {
    const r = (await (await client()).verify({ holder })).result;
    return {
      verified: r.verified, level: Number(r.level), method: Number(r.method),
      issuer: r.verified || r.revoked ? r.issuer : "", issuerBond: stroopsToXlm(r.issuer_bond),
      issuerActive: r.issuer_active, revoked: r.revoked, disputeOpen: r.dispute_open, issuedAt: Number(r.issued_at),
    };
  } catch (e) { friendly(e); }
}

export async function getIssuer(org: string): Promise<Issuer | null> {
  try {
    const i = unwrap<RawIssuer>((await (await client()).get_issuer({ org })).result);
    return i ? { org: i.org, bond: stroopsToXlm(i.bond), activeVouches: Number(i.active_vouches), active: i.active } : null;
  } catch (e) { friendly(e); } // network/RPC failure: show it instead of pretending "not registered"
}

export async function openDispute(caller: string, holder: string) {
  await write(caller, (c) => c.open_dispute({ caller, holder }));
}

export async function vote(panelist: string, holder: string, outcome: number) {
  await write(panelist, (c) => c.vote({ panelist, holder, outcome }));
}

export async function getDispute(holder: string): Promise<Dispute | null> {
  try {
    const d = unwrap<RawDispute>((await (await client()).get_dispute({ holder })).result);
    return d ? {
      holder: d.holder, openedBy: d.opened_by, votesNegligence: Number(d.votes_negligence),
      votesDeception: Number(d.votes_deception), votesValid: Number(d.votes_valid), voted: [...d.voted],
      resolved: d.resolved, outcome: Number(d.outcome), slashed: stroopsToXlm(d.slashed),
    } : null;
  } catch (e) { friendly(e); } // network/RPC failure: show it instead of pretending "no dispute"
}

export async function releaseBond(org: string) {
  await write(org, (c) => c.release_bond({ org }));
}
