# Kredo — Contract Menu (shared interface)

This is the agreement between the **contract pair** and the **app pair**.
Don't change a function name, input or output without telling the other pair.

- Contract: Soroban (Rust), deployed on **Stellar Testnet**
- Bond token: **testnet XLM** (native asset contract)
- Contract ID: `CAX4DIVMIOS4XXPG3HBVUVKSEHJLEETO52L4ZD7S4Z5NGCO2PL64GONI`  ← fill in after deploy
- XLM token contract ID: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` ← from `stellar contract id asset --asset native --network testnet`

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
    pub doc_hash: BytesN<32>,  // keyed hash of document number (never the number itself)
    pub level: u32,            // 1 = vouched, 2 = ID + org confirmed, 3 = passport chip
    pub revoked: bool,
    pub issued_at: u64,        // ledger timestamp
}

pub struct VerifyResult {
    pub verified: bool,        // exists AND not revoked
    pub level: u32,
    pub issuer: Address,
    pub issuer_bond: i128,
    pub revoked: bool,
}

pub struct Dispute {
    pub holder: Address,
    pub opened_by: Address,
    pub votes_fake: u32,
    pub votes_real: u32,
    pub voted: Vec<Address>,   // panelists who already voted
    pub resolved: bool,
}
```

One credential per holder. Credentials, issuers and disputes are stored by `holder` / `org` address.

---

## Functions

| # | Function | Inputs | Returns | Who calls it | Owner |
|---|----------|--------|---------|--------------|-------|
| 1 | `initialize` | `admin: Address, token: Address, panel: Vec<Address>, min_bond: i128, max_vouches: u32, slash_percent: u32` | — | Admin, once after deploy | Person 1 |
| 2 | `register_issuer` | `org: Address, bond: i128` | — | Organization | Person 1 |
| 3 | `issue_credential` | `issuer: Address, holder: Address, doc_hash: BytesN<32>, level: u32` | — | Organization | Person 1 |
| 4 | `verify` | `holder: Address` | `VerifyResult` | Bank (read-only, free) | Person 1 |
| 5 | `get_issuer` | `org: Address` | `Issuer` | Anyone (read-only) | Person 1 |
| 6 | `open_dispute` | `caller: Address, holder: Address` | — | Anyone bonded, or a bank | Person 2 |
| 7 | `vote` | `panelist: Address, holder: Address, is_fake: bool` | — | Panel member | Person 2 |
| 8 | `release_bond` | `org: Address` | — | Organization | Person 2 |
| 9 | `get_dispute` | `holder: Address` | `Dispute` | Anyone (read-only) | Person 2 |

### Rules each function must enforce

**`register_issuer`**
- `org.require_auth()`
- `bond >= min_bond`, else `Error::BondTooLow`
- Transfer `bond` XLM from `org` to the contract
- Not already registered, else `Error::AlreadyRegistered`

**`issue_credential`**
- `issuer.require_auth()`
- Issuer is registered and active, else `Error::NotIssuer`
- `active_vouches < max_vouches`, else `Error::VouchLimitReached`
- `doc_hash` never used before, else `Error::DuplicateId`  ← the duplicate check
- Holder has no credential yet, else `Error::AlreadyHasCredential`
- `level` is 1–3, else `Error::BadLevel`
- Save credential, save `doc_hash` as used, `active_vouches += 1`

**`verify`**
- No auth (read-only)
- No credential → return `verified: false`
- Revoked → return `verified: false, revoked: true`

**`open_dispute`**
- `caller.require_auth()`
- Credential exists and isn't revoked, else `Error::NotFound`
- No open dispute for this holder, else `Error::DisputeOpen`

**`vote`**
- `panelist.require_auth()`
- Panelist is on the panel, else `Error::NotPanelist`
- **Panelist is not the issuer of this credential**, else `Error::ConflictOfInterest`
- Hasn't voted yet, else `Error::AlreadyVoted`
- When `votes_fake == 2` → **revoke** credential, **slash** `slash_percent` of issuer's bond, `active_vouches -= 1`, mark resolved
- When `votes_real == 2` → mark resolved, nothing else changes

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
}
```

### Events (so the app can show activity)

- `("issuer", "registered")` → `(org, bond)`
- `("cred", "issued")` → `(holder, issuer, level)`
- `("cred", "revoked")` → `(holder, issuer, slashed_amount)`
- `("dispute", "opened")` → `(holder, opened_by)`

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

---

## Placeholder data for the app pair (until Sunday)

```ts
export const mockVerify = (holder: string) => ({
  verified: true,
  level: 2,
  issuer: "GAGENCY...",
  issuerBond: 100,      // XLM
  revoked: false,
});

export const mockIssuer = {
  org: "GAGENCY...",
  bond: 100,
  activeVouches: 1,
  active: true,
};
```

Swap these for the generated client on Sunday:
`stellar contract bindings typescript --network testnet --contract-id <ID> --output-dir app/kredo-client`

---

## Screens → functions

| Screen | Calls |
|--------|-------|
| Issuer portal | `register_issuer`, `issue_credential`, `get_issuer` |
| Bank checker | `verify` |
| Dispute panel | `open_dispute`, `vote`, `get_dispute` |

---

## Demo flow (= 1-minute video, test it in this order)

1. Agency calls `register_issuer` with 100 XLM → bond locked
2. Agency clicks "Verify ID" (simulated) → `issue_credential(level = 2)`
3. Try the same ID again → **`DuplicateId`** error
4. Bank calls `verify` → "Verified ✓, Level 2, backed by 100 XLM"
5. Bank calls `open_dispute`; 2 panelists `vote(is_fake = true)`
6. Bank calls `verify` again → "Revoked ✗"; `get_issuer` shows bond now 50 XLM

## Not built (show on trifold / say in pitch)

Passport NFC chip + selfie match (simulated), passkey fingerprint wallet, PIN card, limits growing over time, bond reward on release.
