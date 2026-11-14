# Kredo — Reusable, Bonded Identity on Stellar

> Get verified once, reuse it anywhere, and have the verifier put real money behind it.

Banks and credit unions verify the same person from scratch every time, which makes underserved people (newcomers, refugees, people without standard ID) expensive to serve or shuts them out entirely. With Kredo, a **bonded organization** such as a settlement agency verifies a person once and locks an XLM bond behind that verification in a Soroban smart contract. Any bank can then check the credential on Stellar in seconds for under a cent. If a verification turns out to be fake, an independent panel revokes the credential and **slashes the issuer's bond**.

Built for the **UW Velocity × Stellar Blockchain Innovation Challenge 2026** (Problem Space 2: Verification Infrastructure for the Next Billion Customers).

---

## Live on Stellar Testnet

| | |
|---|---|
| **Kredo contract** | [`CAX4DIVMIOS4XXPG3HBVUVKSEHJLEETO52L4ZD7S4Z5NGCO2PL64GONI`](https://stellar.expert/explorer/testnet/contract/CAX4DIVMIOS4XXPG3HBVUVKSEHJLEETO52L4ZD7S4Z5NGCO2PL64GONI) |
| **Bond token (native XLM SAC)** | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| **Network** | Testnet · RPC `https://soroban-testnet.stellar.org` |
| **Live app** | _TODO (Person 4): add the URL_ |
| **Demo video** | _TODO: add the YouTube/Loom link_ |

Every address and setting is in [`deployments/testnet.json`](deployments/testnet.json).

### End-to-end demo, already run on testnet

| # | Step | Transaction |
|---|---|---|
| 1 | Agency registers and locks a 100 XLM bond (real transfer) | [8e218dd…](https://stellar.expert/explorer/testnet/tx/8e218ddf2a8ee4bb6cfe14ed1bb2d00ccacc680e53543802cc3b101917dac6c4) |
| 2 | Simulated ID check, then a level-2 credential is issued | [d2c6a2b…](https://stellar.expert/explorer/testnet/tx/d2c6a2b1e9682a111a46f4f8cd83e4a277664da287e4ba9c80a29120fe4d0d5c) |
| 3 | Bank verifies: `verified: true, level 2, bond 100 XLM` | read-only (free) |
| 4 | The same ID is issued again and **rejected** with `DuplicateId (#5)` | rejected in simulation |
| 5 | Bank opens a dispute | [e1e3016…](https://stellar.expert/explorer/testnet/tx/e1e3016bb22141387f78f11f4a2104d2c7aff6dcaec18a8e5c11235effd5a95c) |
| 6 | Panelist 1 votes "fake" | [cc32726…](https://stellar.expert/explorer/testnet/tx/cc3272675886e5978d3a58d2dbc0d462851c2a802761103acf0d3a4802ff4956) |
| 7 | Panelist 2 votes "fake", so the credential is **revoked** and **50 XLM is slashed** | [309a323…](https://stellar.expert/explorer/testnet/tx/309a32322e06efca03220b33ea06050a454a282075f4ba4d9d99663b04e11e94) |
| 8 | Bank verifies again: `verified: false, revoked: true`, issuer bond 50 XLM | read-only |

---

## How it works

```
 Organization A (issuer)        Organization B (bank)          Review panel (3 orgs)
        │ Freighter                    │ Freighter                     │ Freighter
        ▼                              ▼                               ▼
 ┌──────────────────────── React + TypeScript app ─────────────────────────────┐
 │  Issuer portal           Bank checker              Dispute panel            │
 │  · register + bond       · verify(holder)          · open_dispute / vote    │
 │  · Verify ID (SIMULATED) │                         │                        │
 │  · issue_credential      └──── one shared client (generated TS bindings) ───┘
 └──────────────────────────────────────┬──────────────────────────────────────┘
                                        │ Soroban RPC (testnet)
                       ┌────────────────▼────────────────┐
                       │      Kredo Soroban contract     │──► native XLM asset contract
                       │  issuers · credentials · disputes│    (bond deposit / slash / release)
                       └─────────────────────────────────┘
```

### What goes on-chain and what stays off-chain

| On-chain (public) | Off-chain (never on-chain) |
|---|---|
| Wallet addresses, trust level (1–3), revoked flag | Names, photos, documents, biometrics |
| `doc_hash`: a **keyed** HMAC-SHA256 of the document number | The document number itself, and the HMAC secret |
| Bond amounts, panel votes, events | Full KYC records (kept by the issuer, shared only when legally required) |

Because `doc_hash` is keyed, nobody can recover or guess the document number from the chain. The contract only checks that the same hash isn't used twice. The **prototype uses synthetic random hashes**; in production the HMAC is computed by a secure off-chain service, never in browser code.

### Trust levels
`1` = vouched by a bonded organization · `2` = ID checked and confirmed by the organization · `3` = passport chip (NFC). Each credential stores its level. Automatic limit growth is not implemented.

---

## Smart contract

The contract is written in Rust with `soroban-sdk 29`. The full interface is in [`CONTRACT.md`](CONTRACT.md) and the design is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

| Function | Signer | What it does |
|---|---|---|
| `initialize(admin, token, panel, min_bond, max_vouches, slash_percent)` | admin | One-time setup with 3 distinct panelists |
| `register_issuer(org, bond)` | org | Moves `bond` XLM from org to the contract (must be ≥ `min_bond`) |
| `issue_credential(issuer, holder, doc_hash, level)` | issuer | Checks that the issuer is active, under its vouching cap, the doc_hash is unused, the holder has no credential yet, and the level is 1–3 |
| `verify(holder)` → `VerifyResult` | — | Read-only: verified, level, issuer, issuer bond, revoked |
| `open_dispute(caller, holder)` | caller | Opens a dispute against a non-revoked credential (one open dispute per holder) |
| `vote(panelist, holder, is_fake)` | panelist | 2 of 3 "fake" votes revoke the credential and slash the bond; 2 "real" votes close the dispute with no penalty |
| `release_bond(org)` | org | Returns the remaining bond once the org backs no active credentials |
| `get_issuer` / `get_dispute` / `get_config` | — | Read-only |

**Security rules the contract enforces**
- Every state change calls `require_auth()` on the acting address, and that address signs the transaction.
- Bonds are **real XLM transfers** through the Stellar Asset Contract, not internal balances.
- A document hash can only be used once, and each holder can hold only one credential.
- Each organization has a vouching cap (`max_vouches`).
- A panelist can't vote on a credential they issued, can't vote on a dispute they opened, and can only vote once.
- Holder misuse (a "real" verdict) never penalizes the issuer. Only a "fake" verdict (issuer negligence) slashes the bond.
- A revoked credential fails every later `verify`.
- An issuer can't withdraw its bond while it still backs active credentials.

**Tests:** 18 unit tests in `contracts/kredo/src/test.rs`. They cover verification, duplicates, unauthorized and unsigned issuance, invalid levels, the vouching cap, dispute rules, double voting, conflicts of interest, revocation, slashing (checked against real token balances) and bond release.

---

## Setup and running

### Prerequisites
- [Rust](https://rustup.rs) plus the WASM target: `rustup target add wasm32v1-none`
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli) v25.2 or newer: `cargo install --locked stellar-cli`
- Node.js 18+ (for the app)
- [Freighter](https://freighter.app) browser wallet, set to **Testnet**

### Contract
```bash
cargo test                 # 18 tests
stellar contract build     # → target/wasm32v1-none/release/kredo.wasm
```

Deploy your own copy (optional; the deployed contract above already works). The scripts are PowerShell, so on Windows run:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1   # creates and funds test keys, deploys, initializes, writes deployments\testnet.json
powershell -ExecutionPolicy Bypass -File scripts\demo.ps1     # runs the 8-step demo above
```
Settings: `min_bond` = 100 XLM (`1_000_000_000` stroops), `max_vouches` = 5, `slash_percent` = 50.

Try a read-only call against the live contract:
```bash
stellar contract invoke --network testnet --source-account <any-funded-key> --send no \
  --contract-id CAX4DIVMIOS4XXPG3HBVUVKSEHJLEETO52L4ZD7S4Z5NGCO2PL64GONI \
  -- verify --holder GCOWMXHIHNN3Z4EGX36RTFWA7LAUVVB6JK7I2KFNTGKBORNV2JJ3EYEF
```

### App
_TODO (Person 4): add the install and run commands._
```bash
stellar contract bindings typescript --network testnet \
  --contract-id CAX4DIVMIOS4XXPG3HBVUVKSEHJLEETO52L4ZD7S4Z5NGCO2PL64GONI --output-dir app/kredo-client
cd app && npm install && npm run dev
```

### Demo walkthrough (app)
1. In **Issuer portal**, connect Freighter as the agency, then **Register** with a 100 XLM bond.
2. Click **Verify ID** (simulated), then **Issue credential** at level 2 to the holder's address.
3. Issue the same ID again. The app shows "This ID is already registered".
4. In **Bank checker**, look up the holder: "Verified ✓, Level 2, backed by 100 XLM".
5. In **Dispute panel**, the bank opens a dispute, then panelist 1 and panelist 2 vote **Fake**.
6. In **Bank checker** again: "Revoked ✗", issuer bond is now 50 XLM.

---

## Simulated in this prototype

These parts are not built. They're presented on the trifold and in the pitch:
- Passport NFC chip reading and live selfie match. The "Verify ID" button is **simulated** and always succeeds.
- The keyed-hash service (the demo uses synthetic hashes).
- Passkey wallet (the demo uses Freighter), PIN card for people without a phone.
- Trust limits that grow over time, and a reward to the voucher when the bond is released.

## Repo layout
```
contracts/kredo/src/   lib.rs (interface) · issuer.rs · disputes.rs · types.rs · errors.rs · storage.rs · test.rs
scripts/               deploy.ps1 · demo.ps1
deployments/           testnet.json (public IDs and addresses only; no secret keys)
docs/ARCHITECTURE.md   shared design for the 4-person team
CONTRACT.md            interface agreed between contract and app
app/                   React + TypeScript frontend
```

## Team
_TODO: names and roles._ Contract core · Disputes and tests · Issuer and bank screens · Dispute panel and integration.
