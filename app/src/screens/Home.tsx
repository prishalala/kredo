import type { ScreenProps } from "../App";
import { CONTRACT_ID, EXPLORER } from "../config";
import { ArrowIcon, CheckIcon, IdIcon, LockIcon, ScaleIcon, ShieldIcon } from "../icons";

const STRIP = ["Soroban smart contracts", "Duplicate-ID blocking", "2-of-3 dispute panel", "Bond slashing", "Freighter wallet"];

export default function Home({ go }: ScreenProps) {
  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="tag mono"><span className="tdot gold" aria-hidden="true" />Prototype // Stellar Testnet</span>
            <h1 className="serif">Verify once.<br />Trusted everywhere.</h1>
            <p className="lead">
              Banks pay $5–30 to re-verify newcomers, creating delays and shutting people out. Kredo lets settlement
              agencies verify someone once, lock a bond on Stellar, and let financial institutions check yes/no facts
              for under a cent, with zero documents shared.
            </p>
            <div className="row">
              <button className="btn light" onClick={() => go("issuer")}>Start the demo <ArrowIcon /></button>
              <a className="btn outline-dark" href={`${EXPLORER}/contract/${CONTRACT_ID}`} target="_blank" rel="noreferrer">View contract on Stellar</a>
            </div>
            <dl className="meta mono">
              <div><dt>Network</dt><dd>Stellar Testnet</dd></div>
              <div><dt>Privacy</dt><dd>Keyed hash · yes/no facts</dd></div>
              <div><dt>Disputes</dt><dd className="gold">2-of-3 bonded panel</dd></div>
            </dl>
          </div>

          <div className="hero-cards" aria-hidden="true">
            <div className="hcard">
              <div className="hc-row">
                <span className="hc-icon">K</span>
                <span className="grow"><strong>Verified Newcomer ID</strong><span className="mono tiny block muted">Example · issued by a settlement agency</span></span>
                <span className="chip gold mono"><span className="tdot gold" />Bond: 100 XLM</span>
              </div>
              <div className="tiles">
                <div><span className="mono tiny muted">Doc hash</span><span className="mono">#8f42…3a91</span></div>
                <div><span className="mono tiny muted">Docs shared</span><span className="mono">0</span></div>
                <div><span className="mono tiny muted">Status</span><span className="mono ok-text">✓ Active</span></div>
              </div>
            </div>
            <span className="link-dot">↓</span>
            <div className="hcard">
              <div className="hc-row">
                <span className="hc-icon blue"><CheckIcon /></span>
                <span className="grow"><strong>Bank instant check</strong><span className="mono tiny block muted">Example · free read-only call to the contract</span></span>
                <span className="chip green mono">✓ Approved</span>
              </div>
              <dl className="rows">
                <div><dt>Identity status</dt><dd>Verified by bonded agency</dd></div>
                <div><dt>Personal data exposed</dt><dd><span className="chip green mono">0 documents</span></dd></div>
                <div><dt>Collateral backing</dt><dd className="mono gold-text">100 XLM bond active</dd></div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <div className="strip mono" aria-label="Features">
        {STRIP.map((s) => <span key={s}><span className="sdot" aria-hidden="true" />{s}</span>)}
      </div>

      <section className="four">
        <button onClick={() => go("issuer")}>
          <span className="four-top mono"><span>01 // Lock bond</span><LockIcon /></span>
          <strong>Staked guarantee</strong>
          <span className="muted">The verifier locks XLM in a smart contract as collateral.</span>
        </button>
        <button onClick={() => go("issuer")}>
          <span className="four-top mono"><span>02 // Verify ID</span><IdIcon /></span>
          <strong>Single verification</strong>
          <span className="muted">A settlement agency confirms identity once.</span>
        </button>
        <button onClick={() => go("bank")}>
          <span className="four-top mono"><span>03 // Check credential</span><ShieldIcon /></span>
          <strong>Instant bank lookup</strong>
          <span className="muted">Institutions check yes/no facts for under 1¢.</span>
        </button>
        <button onClick={() => go("dispute")}>
          <span className="four-top mono"><span>04 // Dispute panel</span><ScaleIcon /></span>
          <strong>Accountable by design</strong>
          <span className="muted">A 3-organization panel can revoke a credential and slash the bond.</span>
        </button>
      </section>

      <section className="container how">
        <div className="how-left">
          <span className="tag light mono">How it works</span>
          <h2 className="serif">How verification works</h2>
          <p className="muted">Bonded attestations instead of document sharing: portable identity for people who are usually shut out, without banks storing their records.</p>
          <a className="link mono" href="https://github.com/prishalala/kredo" target="_blank" rel="noreferrer">Read the code on GitHub <ArrowIcon /></a>
        </div>
        <ol className="how-list">
          <li>
            <span className="mono muted">01 / 03</span>
            <div><h3>One-time verification by a trusted organization</h3>
              <p className="muted">A settlement agency checks the person's ID (or vouches if they have none). Only a one-way hash of the document number goes on-chain, so the same ID can't be registered twice.</p></div>
          </li>
          <li>
            <span className="mono muted">02 / 03</span>
            <div><h3>Backed by a bond on Stellar</h3>
              <p className="muted">The agency locks XLM in a Soroban smart contract. If a panel finds it was negligent, 50% of the bond is slashed.</p></div>
          </li>
          <li>
            <span className="mono muted">03 / 03</span>
            <div><h3>Banks check it in seconds</h3>
              <p className="muted">Any bank reads the credential straight from the contract with a free read-only call. It sees yes/no facts and the bond behind them, never documents.</p></div>
          </li>
        </ol>
      </section>

      <section className="container">
        <div className="banner">
          <span className="b-icon" aria-hidden="true">↘</span>
          <div className="grow">
            <h2 className="serif">From $5–30 per check to under a cent</h2>
            <p className="muted">Verify a person once, and let every participating institution reuse it.</p>
          </div>
          <button className="btn dark" onClick={() => go("bank")}>Try the bank checker <ArrowIcon /></button>
        </div>
      </section>
    </main>
  );
}
