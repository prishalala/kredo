// These mirror CONTRACT.md in the team repo (contract CBDATT…IPG3).
// Amounts here are in XLM; the real client converts to/from stroops.

export interface Issuer {
  org: string;
  bond: number; // XLM
  activeVouches: number;
  active: boolean;
}

export interface VerifyResult {
  verified: boolean;
  level: number;
  method: number;
  issuer: string;
  issuerBond: number; // XLM
  issuerActive: boolean;
  revoked: boolean;
  disputeOpen: boolean;
  issuedAt: number; // seconds
}

export interface Dispute {
  holder: string;
  openedBy: string;
  votesNegligence: number;
  votesDeception: number;
  votesValid: number;
  voted: string[];
  resolved: boolean;
  outcome: number; // 0 open, 1 negligence, 2 deception, 3 valid, 4 inconclusive
  slashed: number; // XLM
}

export const Outcome = { IssuerNegligence: 1, PersonDeception: 2, Valid: 3 } as const;
export const INCONCLUSIVE = 4;

export const OUTCOME_INFO: Record<number, { short: string; result: string; detail: string }> = {
  1: { short: "Issuer negligence", result: "Revoked · bond slashed", detail: "The issuer was careless. The credential is revoked and part of the issuer's bond is cut." },
  2: { short: "Person deception", result: "Revoked · no slash", detail: "The person fooled a careful issuer. The credential is revoked, but the issuer isn't penalized." },
  3: { short: "Valid", result: "Upheld", detail: "The credential is fine. Nothing changes." },
  4: { short: "Inconclusive", result: "Inconclusive", detail: "No two votes agreed. Nothing changes, and a new dispute can be opened with new evidence." },
};

export const METHODS: Record<number, { label: string; level: number; checks: string[]; docLabel: string }> = {
  1: {
    label: "Passport chip + live selfie",
    level: 3,
    checks: ["Reading passport chip", "Checking government signature", "Matching live selfie"],
    docLabel: "Passport number",
  },
  2: {
    label: "In-person document check",
    level: 2,
    checks: ["Document inspected by staff", "Security features checked", "Details matched to applicant"],
    docLabel: "Document number",
  },
  3: {
    label: "Vouched by a bonded organization",
    level: 1,
    checks: ["Voucher identity confirmed", "Relationship to person confirmed", "Bond backing confirmed"],
    docLabel: "Agency file / reference number",
  },
};

export const LEVEL_LABELS: Record<number, string> = {
  1: "Level 1 · Vouched",
  2: "Level 2 · ID + organization confirmed",
  3: "Level 3 · Passport chip",
};

// Same names and numbers as the contract's Error enum.
export const ERRORS: Record<number, string> = {
  1: "The bond is below the 100 XLM minimum. Top it up to keep issuing.",
  2: "This organization is already registered.",
  3: "Only a registered, bonded organization can do this.",
  4: "This organization has reached its vouching limit.",
  5: "This ID document is already registered. Duplicate blocked.",
  6: "This person already has a credential.",
  7: "Invalid trust level.",
  8: "No active credential found for this person.",
  9: "A dispute is already open for this person.",
  10: "Only panel members can vote. Switch to a panel account in Freighter.",
  11: "This panelist can't vote on this dispute (conflict of interest).",
  12: "This panelist has already voted.",
  13: "The bond can't be released while it still backs credentials.",
  14: "The contract is already initialized.",
  15: "Invalid contract configuration.",
  16: "Invalid verification method.",
  17: "Not enough independent reviewers for this dispute.",
};

export class KredoError extends Error {
  code: number;
  constructor(code: number) {
    super(ERRORS[code] ?? `Contract error #${code}`);
    this.code = code;
  }
}
