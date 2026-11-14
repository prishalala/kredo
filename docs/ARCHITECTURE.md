# Kredo — Shared Architecture

`CONTRACT.md` is the source of truth for the interface. This page covers how the four roles fit together.

## 1. System

```
Freighter (signs) ──► app/ (React + TS)  ──►  app/lib/kredo.ts  ──►  generated client (app/kredo-client)
                                                                         │  Soroban RPC (testnet)
                                                                         ▼
                                    Kredo contract (Rust/Soroban)  ──►  native XLM SAC (real bond transfers)
Off-chain only: simulated "Verify ID", keyed HMAC of the document number (secure service), all personal data.
On-chain only: addresses, a 32-byte doc_hash, level, revoked flag, bond amounts, votes.
```

## 2. Contract (Persons 1 + 2): one crate, `contracts/kredo`

| File | Owner | Contents |
|---|---|---|
| `lib.rs` | shared, **frozen** | public interface (thin wrappers) |
| `types.rs` / `errors.rs` / `storage.rs` | shared | structs, error codes, events, storage keys |
| `issuer.rs` | Person 1 | initialize, register_issuer, issue_credential, verify |
| `disputes.rs` | Person 2 | open_dispute, vote, release_bond |
| `test.rs` | Person 2 | 18 tests |

**Storage.** Config lives in instance storage. Persistent storage holds `Issuer(org)`, `Credential(holder)`, `DocHash(hash)` (the set of used hashes) and `Dispute(holder)`. Every write extends the entry's TTL to 30 days.

**Authorization.** Every function that changes state calls `require_auth()` on exactly one address, and that address is the transaction signer. The frontend therefore only ever needs one Freighter signature.

| Function | Signer | Extra checks |
|---|---|---|
| initialize | admin | once only; exactly 3 distinct panelists; slash ≤ 100 |
| register_issuer | org | bond ≥ min_bond; transfers XLM from org to the contract |
| issue_credential | issuer | registered and active; vouches < max; new doc_hash; holder has no credential; level 1–3 |
| open_dispute | caller | credential exists and isn't revoked; no open dispute |
| vote | panelist | on the panel; is neither the issuer nor the dispute opener; hasn't voted yet |
| release_bond | org | active; active_vouches == 0 |
| verify / get_* | none | read-only, so no fee (simulation only) |

**Bond mechanics.** All amounts are real testnet XLM moved through the native Stellar Asset Contract:
- Deposit: org → contract.
- Penalty: when 2 panelists vote fake, `slash_percent` of the current bond goes contract → admin (treasury).
- Release: the remaining bond goes contract → org, and the issuer becomes inactive.

**Dispute outcomes.**
- 2 "fake" votes: issuer negligence. The credential is revoked, the bond is slashed and `active_vouches` drops by 1.
- 2 "real" votes: no penalty. Holder misuse never slashes the issuer.
- Each holder has one dispute slot. Once a dispute is resolved, a new one can be opened.

**Additions beyond CONTRACT.md (flag these to the app pair).**
- Two new error codes: `AlreadyInitialized = 14` and `BadConfig = 15`.
- A new read-only function, `get_config()`, which the dispute panel can use to list the panelists.
- Slashed XLM goes to the admin address.
- When a holder has no credential, `verify` returns `issuer` = the contract address and `level` = 0.

## 3. Frontend (Persons 3 + 4): one app, one integration layer

```
app/
  kredo-client/        generated, never hand-edited (Person 4 regenerates it)
  lib/kredo.ts         Person 4: Client factory, Freighter signing, error mapping   ← only file that touches the SDK
  lib/hash.ts          Person 3: calls the off-chain hash service (synthetic in the demo)
  components/          Person 4: layout, WalletButton
  screens/issuer/      Person 3: register + bond, simulated Verify ID, issue
  screens/bank/        Person 3: verify
  screens/dispute/     Person 4: open dispute, panel voting
```

### How the frontend calls the contract

```ts
import { Client, networks } from "kredo-client";
import { signTransaction } from "@stellar/freighter-api";
import cfg from "../../deployments/testnet.json";

const kredo = (publicKey?: string) =>
  new Client({ contractId: cfg.contractId, networkPassphrase: cfg.networkPassphrase,
               rpcUrl: cfg.rpcUrl, publicKey });

// write: simulate -> Freighter signs -> submit -> wait
const tx = await kredo(me).register_issuer({ org: me, bond: 1_000_000_000n });
await tx.signAndSend({ signTransaction });

// read: simulation only, no wallet needed
const { result } = await kredo().verify({ holder });
```

Contract errors arrive as `Error(Contract, #N)`. `lib/kredo.ts` maps N to a message using the `Errors` table in the generated client, e.g. 5 → "This ID is already registered".

## 4. Dependencies between roles

1. P1 + P2 freeze `lib.rs`, `types.rs` and `errors.rs` (**done**).
2. P1 deploys and publishes `deployments/testnet.json` → P4 generates bindings → P3 and P4 swap their mocks for real calls.
3. P4's `lib/kredo.ts` and wallet hook must exist before P3 can wire screens. Until then P3 builds the UI against the mocks in CONTRACT.md.
4. The dispute panel (P4) needs a holder with an issued credential, which comes from P3's issue screen or `scripts/demo.ps1`.

## 5. Git

- Branches: `main` (protected) ← `contracts` (P1 + P2) and `app` (P3 + P4). Optional per-person sub-branches: `contracts/disputes`, `app/issuer-bank`, `app/dispute-shell`.
- Files are split per owner, so nobody edits someone else's file. Changes to `lib.rs`, `types.rs` or `errors.rs` need a PR reviewed by both contract people and a note to the app pair.
- Commit `deployments/testnet.json`. Never commit secret keys: they live in the Stellar CLI keystore and are excluded by `.gitignore`.

## 6. Order

1. Contract and tests (done)
2. `deploy.ps1` → contract ID
3. `demo.ps1` proves the 8-step flow on testnet
4. Generate bindings
5. `lib/kredo.ts` + Freighter
6. Wire the screens
7. README, video
