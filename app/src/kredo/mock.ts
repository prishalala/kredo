// A pretend Kredo contract that runs in the browser.
// It enforces the SAME rules as CONTRACT.md, so the full demo works without a wallet.
import { MAX_VOUCHES, MIN_BOND_XLM, PANEL, SLASH_PERCENT } from "../config";
import { toHex } from "./hash";
import { INCONCLUSIVE, KredoError, Outcome } from "./types";
import type { Dispute, Issuer, VerifyResult } from "./types";

interface Cred { holder: string; issuer: string; level: number; method: number; revoked: boolean; issuedAt: number }

const issuers = new Map<string, Issuer>();
const creds = new Map<string, Cred>();
const usedHashes = new Set<string>();
const disputes = new Map<string, Dispute>();

const wait = () => new Promise((r) => setTimeout(r, 600));

export async function registerIssuer(org: string, bondXlm: number) {
  await wait();
  if (bondXlm < MIN_BOND_XLM) throw new KredoError(1);
  if (issuers.get(org)?.active) throw new KredoError(2);
  issuers.set(org, { org, bond: bondXlm, activeVouches: 0, active: true });
}

export async function issueCredential(issuer: string, holder: string, hash: Uint8Array, level: number, method: number) {
  await wait();
  const iss = issuers.get(issuer);
  if (!iss || !iss.active) throw new KredoError(3);
  if (iss.activeVouches >= MAX_VOUCHES) throw new KredoError(4);
  const hex = toHex(hash);
  if (usedHashes.has(hex)) throw new KredoError(5);
  if (creds.has(holder)) throw new KredoError(6);
  if (level < 1 || level > 3) throw new KredoError(7);
  if (method < 1 || method > 3) throw new KredoError(16);
  creds.set(holder, { holder, issuer, level, method, revoked: false, issuedAt: Math.floor(Date.now() / 1000) });
  usedHashes.add(hex);
  iss.activeVouches += 1;
}

export async function verify(holder: string): Promise<VerifyResult> {
  await wait();
  const c = creds.get(holder);
  const d = disputes.get(holder);
  if (!c) return { verified: false, level: 0, method: 0, issuer: "", issuerBond: 0, issuerActive: false, revoked: false, disputeOpen: false, issuedAt: 0 };
  const iss = issuers.get(c.issuer);
  return {
    verified: !c.revoked, level: c.level, method: c.method, issuer: c.issuer,
    issuerBond: iss?.bond ?? 0, issuerActive: !!iss?.active, revoked: c.revoked,
    disputeOpen: !!d && !d.resolved, issuedAt: c.issuedAt,
  };
}

export async function getIssuer(org: string): Promise<Issuer | null> {
  await wait();
  const i = issuers.get(org);
  return i ? { ...i } : null;
}

const eligible = (c: Cred, caller: string) => PANEL.filter((p) => p !== c.issuer && p !== caller);

export async function openDispute(caller: string, holder: string) {
  await wait();
  const c = creds.get(holder);
  if (!c || c.revoked) throw new KredoError(8);
  const d = disputes.get(holder);
  if (d && !d.resolved) throw new KredoError(9);
  if (eligible(c, caller).length < 2) throw new KredoError(17);
  disputes.set(holder, {
    holder, openedBy: caller, votesNegligence: 0, votesDeception: 0, votesValid: 0,
    voted: [], resolved: false, outcome: 0, slashed: 0,
  });
}

export async function vote(panelist: string, holder: string, outcome: number) {
  await wait();
  if (!PANEL.includes(panelist)) throw new KredoError(10);
  const c = creds.get(holder);
  const d = disputes.get(holder);
  if (!c || !d || d.resolved) throw new KredoError(8);
  if (panelist === c.issuer || panelist === d.openedBy) throw new KredoError(11);
  if (d.voted.includes(panelist)) throw new KredoError(12);
  d.voted.push(panelist);
  if (outcome === Outcome.IssuerNegligence) d.votesNegligence += 1;
  else if (outcome === Outcome.PersonDeception) d.votesDeception += 1;
  else d.votesValid += 1;

  const iss = issuers.get(c.issuer);
  const resolve = (o: number) => { d.resolved = true; d.outcome = o; };
  if (d.votesNegligence >= 2) {
    c.revoked = true;
    if (iss) {
      const cut = iss.bond * (SLASH_PERCENT / 100);
      iss.bond -= cut;
      d.slashed = cut;
      iss.activeVouches = Math.max(0, iss.activeVouches - 1);
    }
    resolve(Outcome.IssuerNegligence);
  } else if (d.votesDeception >= 2) {
    c.revoked = true;
    if (iss) iss.activeVouches = Math.max(0, iss.activeVouches - 1);
    resolve(Outcome.PersonDeception);
  } else if (d.votesValid >= 2) {
    resolve(Outcome.Valid);
  } else if (d.voted.length >= eligible(c, d.openedBy).length) {
    resolve(INCONCLUSIVE);
  }
}

export async function getDispute(holder: string): Promise<Dispute | null> {
  await wait();
  const d = disputes.get(holder);
  return d ? { ...d, voted: [...d.voted] } : null;
}

export async function releaseBond(org: string) {
  await wait();
  const iss = issuers.get(org);
  if (!iss || !iss.active) throw new KredoError(3);
  if (iss.activeVouches > 0) throw new KredoError(13);
  iss.active = false;
  iss.bond = 0;
}
