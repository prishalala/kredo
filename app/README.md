# Kredo app (frontend)

React + TypeScript (Vite) app for Kredo: Issuer portal, Bank checker and Dispute panel, connected to the Kredo Soroban contract on Stellar Testnet (`CBYTIURKLFULMQVYT37NCAU3F7PJ6NM6RCUDS3LMXWDLTQTLM3TKS6BU`).

## Run it

You need [Node.js](https://nodejs.org) (LTS).

```bash
npm install
npm run dev
```

Open the link it prints (usually http://localhost:5173).

## Demo mode vs real contract

- **Default:** calls the deployed contract on Stellar Testnet, signed with the [Freighter](https://www.freighter.app) wallet (set to **Testnet**).
- **Practice mode:** copy `.env.example` to `.env` and set `VITE_USE_MOCK=true`. A simulated contract runs in the browser with the same rules as `CONTRACT.md`. No wallet is needed, and it resets on reload.

The app follows account switches in Freighter automatically, so you can move between the agency, bank and panel accounts without reconnecting. Before signing it checks that Freighter is on Testnet, and after every transaction it shows a **View on stellar.expert** link (the latest one also stays in the footer).

### Real-contract demo accounts (Freighter)

| Step | Account to have connected in Freighter |
|---|---|
| Register + issue | `agency2` from `deployments/testnet.json` (created and funded by `deploy.ps1`), or any new funded account with 100+ XLM. Not `agency`: the CLI demo already registered it |
| Bank check | None needed (read-only, free) |
| Open dispute | Any funded account |
| Vote | One of the 3 panel accounts in `deployments/testnet.json` (import their secret keys into Freighter) |

## Demo flow

0. Click **Reset demo** first. The contract allows one credential per person, ever, so each run gets fresh addresses for Amara, Daniel and Mei.
1. **Issuer portal:** lock a 100 XLM bond and register.
2. Pick Amara, choose a verification method, keep the generated test document number (never a real one), **Check identity**, **Issue credential**.
3. Pick Daniel and try the **same document number** → duplicate blocked.
4. **Bank checker:** check Amara → verification receipt, backed by 100 XLM.
5. **Dispute panel:** open a dispute; two panelists vote **Negligence**.
6. **Bank checker** again → revoked, issuer bond now 50 XLM.
7. Optional: **Issuer portal** → issuing is blocked below the 100 XLM minimum until you **Top up bond**.

**Privacy:** the document number is turned into a keyed hash (HMAC-SHA256) in the browser. Only the hash goes on-chain. In this prototype the hash secret ships in the browser code, so use only the generated `TEST…` numbers, never a real document. In production the issuer's server computes the hash and keeps the secret. The ID check is simulated; no real documents or biometrics are processed.
