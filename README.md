# Kredo — Reusable, Bonded Identity on Stellar

> Get verified once, reuse it anywhere, and have the verifier put real money behind it.

Banks and credit unions verify the same person from scratch every time, which makes underserved people (newcomers, refugees, people without standard ID) expensive to serve or shuts them out entirely. With Kredo, a **bonded organization** such as a settlement agency verifies a person once and locks an XLM bond behind that verification in a Soroban smart contract. Any bank can then check the credential on Stellar in seconds for under a cent. If a verification turns out to be fake, an independent panel revokes the credential and **slashes the issuer's bond**.

Built for the **UW Velocity × Stellar Blockchain Innovation Challenge 2026** (Problem Space 2: Verification Infrastructure for the Next Billion Customers).

---

## Live on Stellar Testnet

| | |
|---|---|
| **Kredo contract** | [`CBYTIURKLFULMQVYT37NCAU3F7PJ6NM6RCUDS3LMXWDLTQTLM3TKS6BU`](https://stellar.expert/explorer/testnet/contract/CBYTIURKLFULMQVYT37NCAU3F7PJ6NM6RCUDS3LMXWDLTQTLM3TKS6BU) |
| **Previous contract (v3, before the minimum-bond check)** | `CBDATTO6MSWR6OIEKNVPR6K53EMRDOZ6J2R52F3EPB3RDZIVMBSNIPG3` |
| **Previous contract (v2, before the dispute fixes)** | `CBRP3IODWPCHB5T7Q4EUOJTZXN7S2GN4IZN4FJASMKR4N6EYTB6IAZN4` |
| **Previous contract (v1, `is_fake` voting)** | `CAX4DIVMIOS4XXPG3HBVUVKSEHJLEETO52L4ZD7S4Z5NGCO2PL64GONI` |
| **Bond token (native XLM SAC)** | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| **Network** | Testnet · RPC `https://soroban-testnet.stellar.org` |
| **Live app** | _TODO (Person 4): add the URL_ |
| **Demo video** | _TODO: add the YouTube/Loom link_ |

Every address and setting is in [`deployments/testnet.json`](deployments/testnet.json).

### End-to-end demo, already run on testnet

Run with `scripts\demo.ps1` on the current contract (`CBYTIURK…`). The doc hash is synthetic (random bytes).

| # | Step | Transaction |
|---|---|---|
| 1 | Agency registers and locks a 100 XLM bond (real transfer) | [e05f122…](https://stellar.expert/explorer/testnet/tx/e05f1228f62a03a8b6c5cc18a86f1663cb70ec02a9c50495a80aaa3ea4bab9b1) |
| 2 | Simulated ID check, then a level-2 credential is issued (method 2 = in-person document check) | [9c1f5ba…](https://stellar.expert/explorer/testnet/tx/9c1f5baa6f9f627ea7db603a5e97135fb164f0870d79b8058815893042532092) |
| 3 | Bank verifies (receipt): `verified: true, level 2, method 2, bond 100 XLM, issuer active, no open dispute` | read-only (free) |
| 4 | The same ID is issued again and **rejected** with `DuplicateId (#5)` | rejected in simulation |
| 5 | Bank opens a dispute | [4618aea…](https://stellar.expert/explorer/testnet/tx/4618aeaeffb020d392615f3ee4609d60ae97cdc3b22f4cb5ddde64e25f717e51) |
| 6 | Panelist 1 votes `IssuerNegligence` | [c58a9a8…](https://stellar.expert/explorer/testnet/tx/c58a9a806a6853dd037ae5ffa814e4102f4f0a26123bf881ba9fbeb18237a36d) |
| 7 | Panelist 2 votes `IssuerNegligence`, so the credential is **revoked** and **50 XLM is slashed** (`outcome: 1, slashed: 50 XLM`) | [ed78aa1…](https://stellar.expert/explorer/testnet/tx/ed78aa13097dcb858a5e697591c04b4e880e7e034474b182d6502b9da1a27d22) |
| 8 | Bank verifies again: `verified: false, revoked: true`, issuer bond 50 XLM | read-only |
| 9 | The slashed issuer (50 XLM, below the 100 XLM minimum) tries to issue again and is **rejected** with `BondTooLow (#1)` | rejected in simulation |
| 10 | The issuer tops its bond back up by 50 XLM (back to 100 XLM, real transfer) | [7243e2a…](https://stellar.expert/explorer/testnet/tx/7243e2a5a42d7c24cec104462a58612316a77b997cd8ae9a7eff0def18625d87) |

---

## How it works

```
 Organization A (issuer)        Organization B (bank)          Review panel (3 orgs)
        │ Freighter                    │ Freighter                     │ Freighter
        ▼                              ▼                               ▼
 ┌──────────────────────── React + TypeScript app ─────────────────────────────┐
 │  Issuer portal           Bank checker              Dispute panel            │
 │  · register / top up     · verify(holder)          · open_dispute / vote    │
 │  · Verify ID (SIMULATED) │                         │                        │
 │  · issue_credential      └─ one Stellar SDK client (reads the interface ────┘
 │                             straight from testnet at runtime)               │
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

Because `doc_hash` is keyed, nobody without the secret can recover or guess the document number from the chain. The contract only checks that the same hash isn't used twice. **In the prototype the hash is computed in the browser with a demo secret that ships in the app's code, so only synthetic `TEST…` numbers are used.** In production the issuer's server computes the HMAC and the secret never reaches a browser.

### Trust levels
`1` = vouched by a bonded organization · `2` = ID checked and confirmed by the organization · `3` = passport chip (NFC). Each credential stores its level. Automatic limit growth is not implemented.

---

## Smart contract

The contract is written in Rust with `soroban-sdk 29`. The full interface is in [`CONTRACT.md`](CONTRACT.md) and the design is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

| Function | Signer | What it does |
|---|---|---|
| `initialize(admin, token, panel, min_bond, max_vouches, slash_percent)` | admin | One-time setup with 3 distinct panelists |
| `register_issuer(org, bond)` | org | Moves `bond` XLM from org to the contract (must be ≥ `min_bond`) |
| `top_up_bond(org, amount)` | org | Adds more XLM to an existing issuer's bond (real transfer), e.g. after a slash |
| `issue_credential(issuer, holder, doc_hash, level, method)` | issuer | Checks that the issuer is active, still holds at least `min_bond`, is under its vouching cap, the doc_hash is unused, the holder has no credential yet, and level and method are 1–3 (method: 1 = chip + selfie (simulated), 2 = in-person document check, 3 = vouched) |
| `verify(holder)` → `VerifyResult` | — | Read-only Verification Receipt: verified, level, method, issuer, issuer bond, issuer active, revoked, dispute open, issued at |
| `open_dispute(caller, holder)` | caller | Opens a dispute against a non-revoked credential (one open dispute per holder). Rejected if fewer than 2 independent panelists could vote |
| `vote(panelist, holder, outcome)` | panelist | 2 votes for the same outcome decide: `1 IssuerNegligence` revokes + slashes the bond, `2 PersonDeception` revokes with no slash, `3 Valid` closes with no change. No majority (e.g. 1-1-1) = **Inconclusive**: no penalty, can be re-disputed |
| `release_bond(org)` | org | Returns the remaining bond once the org backs no active credentials |
| `get_issuer` / `get_dispute` / `get_config` | — | Read-only |

**Security rules the contract enforces**
- Every state change calls `require_auth()` on the acting address, and that address signs the transaction.
- Bonds are **real XLM transfers** through the Stellar Asset Contract, not internal balances.
- A document hash can only be used once, and each holder can hold only one credential.
- Each organization has a vouching cap (`max_vouches`).
- A panelist can't vote on a credential they issued, can't vote on a dispute they opened, and can only vote once.
- Fair penalties: only an `IssuerNegligence` verdict slashes the bond. If a person deceived a careful issuer (`PersonDeception`), the credential is revoked but the issuer keeps its bond.
- A revoked credential fails every later `verify`.
- An issuer can't withdraw its bond while it still backs active credentials.
- A slashed issuer whose bond falls below `min_bond` can't issue new credentials until it tops the bond back up.

**Tests:** 28 unit tests in `contracts/kredo/src/test.rs`. They cover the full happy path (with the Verification Receipt fields), duplicates, unauthorized and unsigned issuance, invalid levels and methods, the vouching cap, dispute rules, double voting, conflicts of interest, negligence (revoke + slash, checked against real token balances), deception (revoke, no slash), split votes (Inconclusive), disputes without enough independent reviewers, the minimum-bond check after a slash, bond top-ups, and bond release (including that it needs the org's signature).

---

## Setup and running

### Prerequisites
- [Rust](https://rustup.rs) plus the WASM target: `rustup target add wasm32v1-none`
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli) v25.2 or newer: `cargo install --locked stellar-cli`
- Node.js 18+ (for the app)
- [Freighter](https://freighter.app) browser wallet, set to **Testnet**

### Contract
```bash
cargo test                 # 28 tests
stellar contract build     # → target/wasm32v1-none/release/kredo.wasm
```

Deploy your own copy (optional; the deployed contract above already works). The scripts are PowerShell, so on Windows run:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1   # creates and funds test keys, deploys, initializes, writes deployments\testnet.json
powershell -ExecutionPolicy Bypass -File scripts\demo.ps1     # runs the 10-step demo above
```
Settings: `min_bond` = 100 XLM (`1_000_000_000` stroops), `max_vouches` = 5, `slash_percent` = 50.

Try a read-only call against the live contract:
```bash
stellar contract invoke --network testnet --source-account <any-funded-key> --send no \
  --contract-id CBYTIURKLFULMQVYT37NCAU3F7PJ6NM6RCUDS3LMXWDLTQTLM3TKS6BU \
  -- verify --holder GCOWMXHIHNN3Z4EGX36RTFWA7LAUVVB6JK7I2KFNTGKBORNV2JJ3EYEF
```

### App
React + TypeScript (Vite). It reads the contract's interface straight from testnet with the Stellar SDK, so no generated bindings are needed.
```bash
cd app
npm install
npm run dev        # http://localhost:5173
```
By default the app talks to the **real contract on testnet** and signs with Freighter (set to Testnet).
For practice without a wallet, copy `app/.env.example` to `app/.env` and set `VITE_USE_MOCK=true` (a pretend contract in the browser with the same rules).
Freighter accounts for a real run: the agency (use `agency2`, created by `deploy.ps1`; `agency` is already registered by the CLI demo), the bank (any funded account), and 2 of the 3 panel accounts from `deployments/testnet.json`. The app follows account switches in Freighter automatically, checks that Freighter is on Testnet before signing, and shows a **View on stellar.expert** link for every transaction.

### Demo walkthrough (app)
0. Click **Reset demo** at the start of every run. Each person can hold only one credential ever, so every run needs fresh addresses for Amara, Daniel and Mei.
1. In **Issuer portal**, connect Freighter as `agency2`, then **Register** with a 100 XLM bond. Every write shows a stellar.expert link.
2. Pick Amara and a method, keep the generated test document number, click **Check identity** (simulated), then **Issue credential**.
3. Pick Daniel, keep the **same** document number, and issue. It is blocked: "This ID document is already registered".
4. In **Bank checker**, check Amara (no wallet needed): "Verified ✓, Level 2, backed by 100 XLM".
5. In **Dispute panel**, switch Freighter to the bank and open a dispute, then switch to panelist 1 and panelist 2 and vote **Negligence**.
6. In **Bank checker** again: "Revoked ✗", issuer bond is now 50 XLM.
7. Optional: back in **Issuer portal**, issuing is blocked until you **Top up bond** by 50 XLM.

---

## Simulated in this prototype

These parts are not built. They're presented on the trifold and in the pitch:
- Passport NFC chip reading and live selfie match. The "Verify ID" button is **simulated** and always succeeds.
- The keyed-hash service (the demo uses synthetic hashes).
- Passkey wallet (the demo uses Freighter), PIN card for people without a phone.
- Trust limits that grow over time, and a reward to the voucher when the bond is released.

## Known limitations (prototype)

- **Holder control isn't proven.** `verify(holder)` checks an address, but nothing proves the customer at the bank controls it. Production would have the holder sign a challenge (SEP-10 style) before the bank checks.
- **Anyone can open a dispute.** It costs only a transaction fee, and a dispute can be reopened after a Valid or Inconclusive result. Production would require the opener to be bonded or to post a deposit.
- **The hash secret is in the browser** (see above). Fine for synthetic test numbers, not for real documents.
- **Storage lifetime.** Contract records last about 30 days without activity; production would extend or archive them.

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
