import { useEffect, useState } from "react";
import { getIssuer, issueCredential, registerIssuer, releaseBond } from "../kredo";
import { docHash, toHex } from "../kredo/hash";
import type { Issuer } from "../kredo/types";
import { LEVEL_LABELS, METHODS } from "../kredo/types";
import { MIN_BOND_XLM, MAX_VOUCHES, SLASH_PERCENT } from "../config";
import { PEOPLE, personaFor } from "../personas";
import { short } from "../wallet";
import type { ScreenProps } from "../App";
import { ArrowIcon, LockIcon } from "../icons";

export default function IssuerPortal({ me, notify, run, busy, mark, holder, setHolder, go }: ScreenProps) {
  const [bond, setBond] = useState(MIN_BOND_XLM);
  const [issuer, setIssuer] = useState<Issuer | null>(null);

  const [method, setMethod] = useState(1);
  const [country, setCountry] = useState("NGA");
  const [docNumber, setDocNumber] = useState("");
  const [checkStep, setCheckStep] = useState(-1); // -1 not started, 0–2 running, 3 passed
  const [lastHash, setLastHash] = useState("");
  const [justIssued, setJustIssued] = useState("");

  const m = METHODS[method];
  const person = personaFor(holder);

  useEffect(() => { if (me) getIssuer(me).then(setIssuer); }, [me]);
  useEffect(() => { setCheckStep(-1); setJustIssued(""); }, [holder, docNumber, method]);

  const refresh = async () => setIssuer(await getIssuer(me));

  const onRegister = () =>
    run(async () => {
      await registerIssuer(me, bond);
      await refresh();
      mark("register");
      notify(`Bond locked: ${bond} XLM now backs your verifications`);
    }, `Locking ${bond} XLM on Stellar…`);

  const onCheckId = async () => {
    // Simulated in the prototype (no real document or biometric data is processed).
    for (let i = 0; i < m.checks.length; i++) {
      setCheckStep(i);
      await new Promise((r) => setTimeout(r, 650));
    }
    setCheckStep(3);
  };

  const onIssue = () =>
    run(async () => {
      const hash = await docHash(country, docNumber);
      setLastHash(toHex(hash));
      await issueCredential(me, holder, hash, m.level, method);
      await refresh();
      mark("issue");
      setJustIssued(holder);
      notify(`Credential issued to ${person?.name ?? short(holder)}`);
    }, "Issuing credential on Stellar…");

  const onRelease = () =>
    run(async () => {
      await releaseBond(me);
      await refresh();
      notify("Bond released back to your organization");
    }, "Releasing bond…");

  const registered = !!issuer?.active;
  const used = issuer?.activeVouches ?? 0;

  return (
    <div className="grid2">
      <div className="stack">
        <section className="dark-card" aria-label="Your bond">
          <div className="dc-top mono">
            <span><LockIcon /> Total bond locked</span>
            <span className={`chip mono ${registered ? "gold" : "dim"}`}>{registered ? "Active issuer" : "Not registered"}</span>
          </div>
          <div className="dc-amount">{registered ? issuer!.bond.toFixed(2) : "0.00"}<span className="mono"> XLM</span></div>
          <div className="dc-foot mono">
            <span>{me ? short(me) : "No wallet"} · settlement agency (demo)</span>
            <span>{used}/{MAX_VOUCHES} backed</span>
          </div>
          <div className="meter on-dark" role="progressbar" aria-label="People backed" aria-valuenow={used} aria-valuemin={0} aria-valuemax={MAX_VOUCHES}>
            <span style={{ width: `${(used / MAX_VOUCHES) * 100}%` }} />
          </div>
        </section>

        <section className="card">
          <p className="mono label">A // Register</p>
          {!registered ? (
            <>
              <h2>Register your organization</h2>
              <p className="muted">Lock a bond to stand behind every identity you verify. If a panel finds you negligent, {SLASH_PERCENT}% is slashed.</p>
              <label htmlFor="bond">Bond amount (XLM)</label>
              <input id="bond" type="number" min={0} value={bond} onChange={(e) => setBond(Number(e.target.value))} />
              <p className="hint">Minimum {MIN_BOND_XLM} XLM</p>
              <button className="btn dark" disabled={busy} onClick={onRegister}>Lock bond &amp; register</button>
            </>
          ) : (
            <>
              <h2>You're a bonded issuer</h2>
              <p className="muted">Every credential you issue is backed by your bond.</p>
              <button className="btn ghost" disabled={busy || used > 0} onClick={onRelease}>Release bond</button>
              {used > 0 && <p className="hint">Release unlocks once you're no longer backing anyone.</p>}
            </>
          )}
        </section>
      </div>

      <section className={`card ${registered ? "" : "locked"}`}>
        <p className="mono label">B // Verify &amp; issue</p>
        <h2>Verify a person</h2>
        {!registered && <p className="muted">Register your organization first.</p>}

        <fieldset className="people" disabled={!registered}>
          <legend>Who are you verifying?</legend>
          {PEOPLE.map((p) => (
            <label key={p.address} className={`person ${holder === p.address ? "sel" : ""}`}>
              <input type="radio" name="person" checked={holder === p.address} onChange={() => setHolder(p.address)} />
              <span className="avatar">{p.initial}</span>
              <span className="grow"><strong>{p.name}</strong><span className="muted small block">{p.role}</span></span>
              <span className="mono tiny muted">{short(p.address)}</span>
            </label>
          ))}
        </fieldset>

        <label htmlFor="method">Verification method</label>
        <select id="method" value={method} disabled={!registered} onChange={(e) => setMethod(Number(e.target.value))}>
          {[1, 2, 3].map((k) => <option key={k} value={k}>{METHODS[k].label}</option>)}
        </select>
        <p className="hint">Gives <strong>{LEVEL_LABELS[m.level]}</strong></p>

        <div className="row">
          <div className="col narrow">
            <label htmlFor="country">Country</label>
            <input id="country" value={country} disabled={!registered} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <div className="col">
            <label htmlFor="doc">{m.docLabel}</label>
            <input id="doc" value={docNumber} disabled={!registered} placeholder="e.g. A12345678" onChange={(e) => setDocNumber(e.target.value)} />
          </div>
        </div>

        {checkStep >= 0 && (
          <ul className="checks mono" aria-live="polite">
            {m.checks.map((c, i) => (
              <li key={c} className={checkStep > i ? "ok" : checkStep === i ? "run" : ""}>
                <span aria-hidden="true">{checkStep > i ? "✓" : checkStep === i ? "…" : "○"}</span> {c}
              </li>
            ))}
            <li className="tiny muted">Simulated in this prototype</li>
          </ul>
        )}

        <div className="row">
          <button className="btn ghost" disabled={!registered || busy || !docNumber || (checkStep >= 0 && checkStep < 3)} onClick={onCheckId}>
            {checkStep === 3 ? "✓ Identity checked" : "Check identity"}
          </button>
          <button className="btn dark" disabled={!registered || busy || checkStep !== 3} onClick={onIssue}>Issue credential</button>
        </div>

        {lastHash && (
          <div className="note">
            <span className="mono tiny muted">ON-CHAIN DOC HASH</span>
            <code className="mono">{lastHash.slice(0, 24)}…</code>
            <span className="small muted">A one-way keyed hash. The document number never left this page, and the same document can't be registered twice.</span>
          </div>
        )}

        {justIssued && (
          <div className="next">
            <span className="small">Issued. Try the <strong>same document number</strong> for another person, or see what a bank sees.</span>
            <button className="btn dark sm" onClick={() => go("bank")}>Bank view <ArrowIcon /></button>
          </div>
        )}
      </section>
    </div>
  );
}
