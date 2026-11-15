# Kredo — Contract Menu (shared interface)

This is the agreement between the **contract pair** and the **app pair**.
Don't change a function name, input or output without telling the other pair.

- Contract: Soroban (Rust), deployed on **Stellar Testnet**
- Bond token: **testnet XLM** (native asset contract)
- Contract ID (current): `CBYTIURKLFULMQVYT37NCAU3F7PJ6NM6RCUDS3LMXWDLTQTLM3TKS6BU`
- Contract ID (v3, before the minimum-bond check, don't use): `CBDATTO6MSWR6OIEKNVPR6K53EMRDOZ6J2R52F3EPB3RDZIVMBSNIPG3`
- Contract ID (v2, before the dispute fixes, don't use): `CBRP3IODWPCHB5T7Q4EUOJTZXN7S2GN4IZN4FJASMKR4N6EYTB6IAZN4`
- Contract ID (v1, old interface, still live): `CAX4DIVMIOS4XXPG3HBVUVKSEHJLEETO52L4ZD7S4Z5NGCO2PL64GONI`
- XLM token contract ID: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` ← from `stellar contract id asset --asset native --network testnet`

> **Privacy rule:** the prototype uses **synthetic** `doc_hash` values only. No real document
> numbers, names, photos or biometrics may ever go on-chain — only the keyed hash.

---

## Changes for app pair (v2)

Everything below is already reflected in the rest of this file. Function names are unchanged.

| What | Before (v1) | Now (v2) | App impact |
|------|-------------|----------|------------|
| `issue_credential` input | `(issuer, holder, doc_hash, level)` | `(issuer, holder, doc_hash, level, method)` | Pass `method` (1–3), see **Methods** below |
| `vote` input | `(panelist, holder, is_fake: bool)` | `(panelist, holder, outcome: Outcome)` | 3 buttons instead of Fake/Real |
| `Credential` | — | `+ method: u32` | — |
| `VerifyResult` | `verified, level, issuer, issuer_bond, revoked` | `+ method, issuer_active, issued_at, dispute_open` | Everything for the **Verification Receipt** comes from one `verify` call |
| `Dispute` | `votes_fake, votes_real` | `votes_negligence, votes_deception, votes_valid, outcome, slashed` | Show the 3 tallies and the final outcome |
| Errors | 1–15 | `+ BadMethod = 16`, `+ NotEnoughReviewers = 17` | Show "Invalid verification method" / "Not enough independent reviewers for this dispute" |
| Split vote | — | No 2-vote majority → `outcome = 4` (Inconclusive): nothing changes, dispute closes, a new one can be opened | Show "Inconclusive — no penalty, can be re-disputed" |
| Events | — | `+ ("dispute", "resolved") → (holder, outcome, slashed)` | Optional activity feed |
| Contract ID | `CAX4…GONI` | `CBYTIURKLFULMQVYT37NCAU3F7PJ6NM6RCUDS3LMXWDLTQTLM3TKS6BU` | The app reads the interface from testnet; just update `CONTRACT_ID` in `app/src/config.ts` |
| New function | — | `top_up_bond(org, amount)` | "Top up bond" in the Issuer portal |
| `issue_credential` rule | — | Issuer's bond must be ≥ `min_bond`, else `BondTooLow (1)` | Show "top up to keep issuing" |

Regenerate the client:
`stellar contract bindings typescript --network testnet --contract-id CBYTIURKLFULMQVYT37NCAU3F7PJ6NM6RCUDS3LMXWDLTQTLM3TKS6BU --output-dir app/kredo-client`

---

## Data types

```rust
pub struct Issuer {
    pub org: Address,          // organization's Stellar account
    pub bond: i128,            // XLM locked (in stroops: 1 XLM = 10_000_000)
    pub active_vouches: u32,   // credentials currently backed
    pub active: bool,
}

pub struct Credential {
    pub holder: Address,       // person's Stellar account
    pub issuer: Address,       // who verified them
    pub doc_hash: BytesN<32>,  // keyed hash of document number (never the number itself; synthetic in prototype)
    pub level: u32,            // 1 = vouched, 2 = ID + org confirmed, 3 = passport chip
    pub method: u32,           // NEW — how they were verified (see Methods)
    pub revoked: bool,
    pub issued_at: u64,        // ledger timestamp (seconds)
}

pub struct VerifyResult {
    pub verified: bool,        // exists AND not revoked
    pub level: u32,            // 0 if no credential
    pub method: u32,           // NEW — 0 if no credential
    pub issuer: Address,       // contract's own address if no credential (placeholder)
    pub issuer_bond: i128,     // issuer's current bond, stroops
    pub issuer_active: bool,   // NEW — issuer still registered with a bond
    pub revoked: bool,
    pub dispute_open: bool,    // NEW — an unresolved dispute exists for this holder
    pub issued_at: u64,        // NEW — 0 if no credential
}

pub struct Dispute {
    pub holder: Address,
    pub opened_by: Address,
    pub votes_negligence: u32, // NEW (replaces votes_fake)
    pub votes_deception: u32,  // NEW
    pub votes_valid: u32,      // NEW (replaces votes_real)
    pub voted: Vec<Address>,   // panelists who already voted
    pub resolved: bool,
    pub outcome: u32,          // NEW — 0 = still open, 1–3 = Outcome value, 4 = Inconclusive
    pub slashed: i128,         // NEW — stroops slashed from the issuer (0 unless IssuerNegligence)
}

pub enum Outcome {             // NEW — number enum (TS: enum, CLI: --outcome 1)
    IssuerNegligence = 1,      // issuer was careless → revoke + slash
    PersonDeception = 2,       // person fooled a careful issuer → revoke, NO slash
    Valid = 3,                 // credential is fine → close, no change
}
// Dispute.outcome = 4 (INCONCLUSIVE) is a result only, not a vote option.
```

### Methods (`method`)

| Value | Meaning |
|-------|---------|
| 1 | Passport chip + live selfie (**simulated** in prototype) |
| 2 | In-person document check by a bonded organization |
| 3 | Vouched by a bonded organization |

One credential per holder. Credentials, issuers and disputes are stored by `holder` / `org` address.

### Verification Receipt — where each field comes from

| Receipt line | Source |
|--------------|--------|
| Verified ✓ / ✗ | `verify.verified` |
| Trust level | `verify.level` |
| Method | `verify.method` |
| Issued by | `verify.issuer` |
| Issued on | `verify.issued_at` |
| Backed by N XLM | `verify.issuer_bond / 10_000_000` |
| Issuer active | `verify.issuer_active` |
| Revoked | `verify.revoked` |
| Under dispute | `verify.dispute_open` (details: `get_dispute(holder)`) |

---

## Functions

| # | Function | Inputs | Returns | Who calls it | Owner |
|---|----------|--------|---------|--------------|-------|
| 1 | `initialize` | `admin: Address, token: Address, panel: Vec<Address>, min_bond: i128, max_vouches: u32, slash_percent: u32` | — | Admin, once after deploy | Person 1 |
| 2 | `register_issuer` | `org: Address, bond: i128` | — | Organization | Person 1 |
| 2b | `top_up_bond` | `org: Address, amount: i128` | — | Organization (adds to its bond) | Person 1 |
| 3 | `issue_credential` | `issuer: Address, holder: Address, doc_hash: BytesN<32>, level: u32, method: u32` | — | Organization | Person 1 |
| 4 | `verify` | `holder: Address` | `VerifyResult` | Bank (read-only, free) | Person 1 |
| 5 | `get_issuer` | `org: Address` | `Issuer` | Anyone (read-only) | Person 1 |
| 6 | `open_dispute` | `caller: Address, holder: Address` | — | Anyone bonded, or a bank | Person 2 |
| 7 | `vote` | `panelist: Address, holder: Address, outcome: Outcome` | — | Panel member | Person 2 |
| 8 | `release_bond` | `org: Address` | — | Organization | Person 2 |
| 9 | `get_dispute` | `holder: Address` | `Dispute` | Anyone (read-only) | Person 2 |
| — | `get_config` | — | `Config` | Anyone (read-only) | Person 1 |

### Rules each function must enforce

**`register_issuer`**
- `org.require_auth()`
- `bond >= min_bond`, else `Error::BondTooLow`
- Transfer `bond` XLM from `org` to the contract
- Not already registered, else `Error::AlreadyRegistered`

**`issue_credential`**
- `issuer.require_auth()`
- Issuer is registered and active, else `Error::NotIssuer`
- Issuer's bond ≥ `min_bond` (a slashed issuer must top up first), else `Error::BondTooLow`
- `active_vouches < max_vouches`, else `Error::VouchLimitReached`
- `doc_hash` never used before, else `Error::DuplicateId`  ← the duplicate check (stays blocked even after a revoke)
- Holder has no credential yet, else `Error::AlreadyHasCredential`
- `level` is 1–3, else `Error::BadLevel`
- `method` is 1–3, else `Error::BadMethod`
- Save credential, save `doc_hash` as used, `active_vouches += 1`

**`verify`**
- No auth (read-only)
- No credential → `verified: false`, `level: 0`, `method: 0`, `issued_at: 0`
- Revoked → `verified: false, revoked: true`

**`open_dispute`**
- `caller.require_auth()`
- Credential exists and isn't revoked, else `Error::NotFound`
- No open dispute for this holder, else `Error::DisputeOpen`
- At least **2 panelists who are neither the credential's issuer nor the caller**, else `Error::NotEnoughReviewers` (keeps 2-of-3 reachable)

**`vote`**
- `panelist.require_auth()`
- Dispute is open, else `Error::NotFound`
- Panelist is on the panel, else `Error::NotPanelist`
- **Panelist is not the issuer of this credential** (and not the dispute opener), else `Error::ConflictOfInterest`
- Hasn't voted yet, else `Error::AlreadyVoted`
- **2 votes for the same outcome resolve it:**
  - `IssuerNegligence` → **revoke** credential, **slash** `slash_percent` of issuer's bond (sent to admin), `active_vouches -= 1`
  - `PersonDeception` → **revoke** credential, **no slash**, `active_vouches -= 1`
  - `Valid` → close dispute, nothing else changes
- No 2-vote majority after every eligible panelist has voted (1-1-1, or 1-1 with two eligible) → **Inconclusive** (`outcome = 4`): no revoke, no slash, **not** Valid. The dispute closes so the holder isn't locked forever; anyone can open a new dispute (e.g. with new evidence) to escalate
- On resolve: `resolved = true`, `outcome` set, `slashed` set

**`top_up_bond`**
- `org.require_auth()`
- Issuer is registered and active, else `Error::NotIssuer`
- `amount > 0`, else `Error::BondTooLow`
- Transfer `amount` XLM from `org` to the contract, `bond += amount`

**`release_bond`**
- `org.require_auth()`
- `active_vouches == 0`, else `Error::StillBacking`
- Transfer remaining bond back to `org`, set `active = false`

### Errors

```rust
pub enum Error {
    BondTooLow = 1,
    AlreadyRegistered = 2,
    NotIssuer = 3,
    VouchLimitReached = 4,
    DuplicateId = 5,
    AlreadyHasCredential = 6,
    BadLevel = 7,
    NotFound = 8,
    DisputeOpen = 9,
    NotPanelist = 10,
    ConflictOfInterest = 11,
    AlreadyVoted = 12,
    StillBacking = 13,
    AlreadyInitialized = 14,
    BadConfig = 15,
    BadMethod = 16,          // NEW
    NotEnoughReviewers = 17, // NEW
}
```

### Events (so the app can show activity)

- `("issuer", "registered")` → `(org, bond)`
- `("issuer", "topped_up")` → `(org, amount, bond)`
- `("cred", "issued")` → `(holder, issuer, level)`
- `("cred", "revoked")` → `(holder, issuer, slashed_amount)` — `slashed_amount` is 0 for `PersonDeception`
- `("dispute", "opened")` → `(holder, opened_by)`
- `("dispute", "resolved")` → `(holder, outcome, slashed)` — NEW

---

## Demo settings (use these in `initialize`)

| Setting | Value |
|---------|-------|
| `min_bond` | 100 XLM = `1_000_000_000` stroops |
| `max_vouches` | 5 |
| `slash_percent` | 50 |
| `panel` | 3 testnet accounts (create with `stellar keys generate panel1 --network testnet --fund`, etc.) |

---

## App side: the keyed hash (done off-chain, never on-chain)

The app turns a document number into `doc_hash` **before** calling `issue_credential`:

```ts
// doc_hash = HMAC-SHA256(KREDO_SECRET, country + ":" + documentNumber)
import { createHmac } from "crypto";
const docHash = createHmac("sha256", process.env.KREDO_SECRET!)
  .update(`${country}:${documentNumber.toUpperCase().trim()}`)
  .digest(); // 32 bytes → pass as BytesN<32>
```

Same document → same hash → contract blocks the duplicate. The number itself never leaves the app.
**Prototype: use synthetic (random) test values only, never a real document number.**

---

## Placeholder data for the app pair

```ts
export const mockVerify = (holder: string) => ({
  verified: true,
  level: 2,
  method: 2,              // in-person document check
  issuer: "GAGENCY...",
  issuerBond: 100,        // XLM
  issuerActive: true,
  revoked: false,
  disputeOpen: false,
  issuedAt: 1763150400,   // unix seconds
});

export const mockIssuer = {
  org: "GAGENCY...",
  bond: 100,
  activeVouches: 1,
  active: true,
};

export const mockDispute = {
  holder: "GHOLDER...",
  openedBy: "GBANK...",
  votesNegligence: 2,
  votesDeception: 0,
  votesValid: 0,
  voted: ["GPANEL1...", "GPANEL2..."],
  resolved: true,
  outcome: 1,             // 1 = IssuerNegligence, 2 = PersonDeception, 3 = Valid, 0 = open, 4 = Inconclusive
  slashed: 50,            // XLM
};
```

Swap these for the generated client:
`stellar contract bindings typescript --network testnet --contract-id <ID> --output-dir app/kredo-client`

---

## Screens → functions

| Screen | Calls |
|--------|-------|
| Issuer portal | `register_issuer`, `issue_credential`, `get_issuer` |
| Bank checker (+ Verification Receipt) | `verify` (+ `get_dispute` if `dispute_open`) |
| Dispute panel | `open_dispute`, `vote`, `get_dispute` |

---

## Demo flow (= 1-minute video, test it in this order)

1. Agency calls `register_issuer` with 100 XLM → bond locked
2. Agency clicks "Verify ID" (simulated) → `issue_credential(level = 2, method = 2)`
3. Try the same ID again → **`DuplicateId`** error
4. Bank calls `verify` → receipt: "Verified ✓, Level 2, in-person check, backed by 100 XLM"
5. Bank calls `open_dispute`; 2 panelists `vote(outcome = IssuerNegligence)`
6. Bank calls `verify` again → "Revoked ✗"; `get_issuer` shows bond now 50 XLM

(Alternative ending: 2 panelists vote `PersonDeception` → "Revoked ✗", bond stays 100 XLM — the careful issuer isn't punished.)

## Not built (show on trifold / say in pitch)

Passport NFC chip + selfie match (simulated), passkey fingerprint wallet, PIN card, limits growing over time, bond reward on release.
