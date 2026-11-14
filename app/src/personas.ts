// Demo people, so judges see names instead of long Stellar addresses.
// A credential holder doesn't need to sign, so random unfunded testnet addresses work
// with the real contract too.
//
// The contract allows ONE credential per holder, ever, and a revoke is permanent.
// So each demo run needs fresh addresses: "Reset demo" calls newDemoPeople().
// The current set is remembered in this browser so a page reload doesn't lose it.
import { Keypair } from "@stellar/stellar-sdk";

export interface Persona { name: string; role: string; address: string; initial: string }

const BASE = [
  { name: "Amara", role: "Newcomer from Nigeria", initial: "A" },
  { name: "Daniel", role: "Refugee claimant", initial: "D" },
  { name: "Mei", role: "International student", initial: "M" },
];

const STORE_KEY = "kredo.demoPeople.v1";

function saved(): string[] | null {
  try {
    const a = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null");
    return Array.isArray(a) && a.length === BASE.length && a.every((x) => typeof x === "string" && x.startsWith("G")) ? a : null;
  } catch {
    return null;
  }
}

function build(addrs: string[]): Persona[] {
  return BASE.map((p, i) => ({ ...p, address: addrs[i] }));
}

function freshAddresses(): string[] {
  const addrs = BASE.map(() => Keypair.random().publicKey());
  try { localStorage.setItem(STORE_KEY, JSON.stringify(addrs)); } catch { /* private window: fine */ }
  return addrs;
}

// Live binding: screens read PEOPLE at render time, so after newDemoPeople() they see the new set.
export let PEOPLE: Persona[] = build(saved() ?? freshAddresses());

/** New addresses for Amara, Daniel and Mei (use at the start of every demo run). */
export function newDemoPeople(): Persona[] {
  PEOPLE = build(freshAddresses());
  return PEOPLE;
}

export const PANEL_NAMES = ["Community legal clinic", "Partner credit union", "Newcomer services NGO"];

export const personaFor = (address: string) => PEOPLE.find((p) => p.address === address);

/** A made-up document number for the demo. Never type a real one. */
export const testDocNumber = () => `TEST${Math.floor(100000 + Math.random() * 900000)}`;
