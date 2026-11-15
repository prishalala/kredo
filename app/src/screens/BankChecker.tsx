import { useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import { verify } from "../kredo";
import type { VerifyResult } from "../kredo/types";
import { LEVEL_LABELS, METHODS } from "../kredo/types";
import { EXPLORER } from "../config";
import { PEOPLE, personaFor } from "../personas";
import { short } from "../wallet";
import type { ScreenProps } from "../App";
import { ArrowIcon } from "../icons";

const date = (s: number) => (s ? new Date(s * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");

export default function BankChecker({ run, busy, mark, notify, holder, setHolder, go }: ScreenProps) {
  const [r, setR] = useState<VerifyResult | null>(null);
  const [checked, setChecked] = useState("");
  const person = personaFor(checked);

  const onCheck = () => {
    if (!StrKey.isValidEd25519PublicKey(holder.trim())) {
      notify("That isn't a valid Stellar address. It starts with G and is 56 characters long.", "error");
      return;
    }
    return run(async () => {
      const res = await verify(holder.trim());
      setR(res);
      setChecked(holder);
      if (res.verified) { mark("verify"); notify("Credential verified"); }
      else if (res.revoked) { mark("revoke"); notify("This credential has been revoked", "info"); }
      else notify("No Kredo credential found", "info");
    }, "Reading credential from Stellar…", false); // read-only: no wallet needed
  };

  const status = !r ? null : r.verified ? (r.disputeOpen ? "review" : "ok") : r.revoked ? "revoked" : "none";

  return (
    <div className="grid2">
      <section className="card">
        <p className="mono label">A // Customer</p>
        <h2>Onboard a customer</h2>
        <p className="muted">Credit union · account opening. Instead of paying $5–30 to verify someone again, read their Kredo credential.</p>
        <fieldset className="people">
          <legend>Customer</legend>
          {PEOPLE.map((p) => (
            <label key={p.address} className={`person ${holder === p.address ? "sel" : ""}`}>
              <input type="radio" name="cust" checked={holder === p.address} onChange={() => { setHolder(p.address); setR(null); }} />
              <span className="avatar">{p.initial}</span>
              <span className="grow"><strong>{p.name}</strong><span className="muted small block">{p.role}</span></span>
              <span className="mono tiny muted">{short(p.address)}</span>
            </label>
          ))}
        </fieldset>
        <details>
          <summary className="small muted">Check a different Stellar address</summary>
          <input aria-label="Customer's Stellar address" value={holder} onChange={(e) => { setHolder(e.target.value); setR(null); }} placeholder="G…" />
        </details>
        <button className="btn dark" disabled={busy || !holder} onClick={onCheck}>Check credential</button>
        <p className="hint">A free, read-only call. No transaction, no fee.</p>
      </section>

      <section className="card receipt" aria-live="polite">
        <div className="rc-head">
          <span className="hc-icon blue" aria-hidden="true">✓</span>
          <span className="grow"><strong>Verification receipt</strong><span className="mono tiny block muted">{checked ? `Holder ${short(checked)}` : "Waiting for a check"}</span></span>
          {status === "ok" && <span className="chip green mono">✓ Verified</span>}
          {status === "review" && <span className="chip gold mono">Under review</span>}
          {status === "revoked" && <span className="chip clay mono">✗ Revoked</span>}
          {status === "none" && <span className="chip dim mono">No credential</span>}
        </div>

        {!r && <div className="empty"><p className="muted">Pick a customer and check their credential.</p></div>}

        {r && (
          <>
            {person && (
              <div className="who">
                <span className="avatar lg">{person.initial}</span>
                <span><strong className="serif big-name">{person.name}</strong><span className="muted small block">{person.role}</span></span>
              </div>
            )}
            <dl className="rows">
              <div><dt>Verified</dt><dd className={r.verified ? "ok-text" : "clay-text"}>{r.verified ? "✓ Yes" : "✗ No"}</dd></div>
              <div><dt>Trust level</dt><dd>{r.level ? LEVEL_LABELS[r.level] : "—"}</dd></div>
              <div><dt>Method</dt><dd>{r.method ? METHODS[r.method].label : "—"}</dd></div>
              <div><dt>Issued by</dt><dd className="mono">{r.issuer ? <a href={`${EXPLORER}/account/${r.issuer}`} target="_blank" rel="noreferrer">{short(r.issuer)}</a> : "—"}</dd></div>
              <div><dt>Issued on</dt><dd>{date(r.issuedAt)}</dd></div>
              <div><dt>Backed by</dt><dd className="mono gold-text">{r.issuer ? `${r.issuerBond} XLM bond` : "—"}</dd></div>
              <div><dt>Issuer active</dt><dd>{r.issuer ? (r.issuerActive ? "Yes" : "No") : "—"}</dd></div>
              <div><dt>Open dispute</dt><dd>{r.disputeOpen ? "Yes, under review" : "No"}</dd></div>
              <div><dt>Documents shared</dt><dd><span className="chip green mono">0</span></dd></div>
            </dl>

            {r.revoked && (
              <div className="alert clay">
                <strong>Do not rely on this credential.</strong>
                <span className="small">A bonded panel revoked it after a dispute.</span>
              </div>
            )}
            {r.verified && !r.disputeOpen && (
              <button className="link mono" onClick={() => go("dispute")}>Something looks wrong? Open a dispute <ArrowIcon /></button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
