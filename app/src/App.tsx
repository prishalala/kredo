import { useRef, useState } from "react";
import Home from "./screens/Home";
import IssuerPortal from "./screens/IssuerPortal";
import BankChecker from "./screens/BankChecker";
import DisputePanel from "./screens/DisputePanel";
import { connectWallet, short } from "./wallet";
import { CONTRACT_ID, EXPLORER, USE_MOCK } from "./config";
import { KredoError } from "./kredo/types";
import { PEOPLE } from "./personas";
import { KredoMark } from "./icons";

// Used as the organization before a wallet is connected (demo mode only).
const DEMO_AGENCY = "GAGENCYDEMOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const REPO = "https://github.com/prishalala/kredo";

export type Tab = "home" | "issuer" | "bank" | "dispute";
export type StepKey = "register" | "issue" | "duplicate" | "verify" | "dispute" | "revoke";

export const STEPS: { key: StepKey; label: string; tab: Tab }[] = [
  { key: "register", label: "Lock bond", tab: "issuer" },
  { key: "issue", label: "Issue", tab: "issuer" },
  { key: "duplicate", label: "Block duplicate", tab: "issuer" },
  { key: "verify", label: "Bank check", tab: "bank" },
  { key: "dispute", label: "Panel vote", tab: "dispute" },
  { key: "revoke", label: "Revoked", tab: "bank" },
];

type ToastKind = "success" | "error" | "info";
interface Toast { id: number; kind: ToastKind; msg: string }

export interface ScreenProps {
  me: string;
  wallet: string;
  notify: (msg: string, kind?: ToastKind) => void;
  run: (fn: () => Promise<void>, busyLabel?: string) => Promise<void>;
  busy: boolean;
  mark: (step: StepKey) => void;
  done: Record<StepKey, boolean>;
  holder: string;
  setHolder: (h: string) => void;
  go: (t: Tab) => void;
}

const NO_STEPS: Record<StepKey, boolean> = {
  register: false, issue: false, duplicate: false, verify: false, dispute: false, revoke: false,
};

const NAV: [Tab, string][] = [["home", "Overview"], ["issuer", "Issuer portal"], ["bank", "Bank checker"], ["dispute", "Dispute panel"]];

const PAGE: Record<Exclude<Tab, "home">, { n: string; label: string; title: string; text: string }> = {
  issuer: { n: "01", label: "ISSUER PORTAL", title: "Verify once, and stand behind it", text: "A settlement agency locks a bond, checks a person's identity, and issues a reusable credential." },
  bank: { n: "02", label: "BANK CHECKER", title: "Check a credential in seconds", text: "Instead of re-verifying from scratch, a bank reads the credential and the bond behind it. Yes/no facts only." },
  dispute: { n: "03", label: "DISPUTE PANEL", title: "Accountability, built in", text: "Three bonded organizations review a disputed credential. Two matching votes decide the outcome." },
};

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [wallet, setWallet] = useState("");
  const [busyLabel, setBusyLabel] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [done, setDone] = useState(NO_STEPS);
  const [holder, setHolder] = useState(PEOPLE[0].address);
  const nextId = useRef(1);

  const me = wallet || (USE_MOCK ? DEMO_AGENCY : "");
  const busy = busyLabel !== "";

  const notify = (msg: string, kind: ToastKind = "success") => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-1), { id, kind, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  };
  const mark = (step: StepKey) => setDone((d) => ({ ...d, [step]: true }));

  const run = async (fn: () => Promise<void>, label = "Sending to Stellar…") => {
    if (!me) { notify("Connect your Freighter wallet first.", "error"); return; }
    setBusyLabel(label);
    try {
      await fn();
    } catch (e) {
      if (e instanceof KredoError && e.code === 5) mark("duplicate");
      notify(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setBusyLabel("");
    }
  };

  const onConnect = async () => {
    setBusyLabel("Waiting for Freighter…");
    try {
      const addr = await connectWallet();
      setWallet(addr);
      notify(`Wallet connected: ${short(addr)}`);
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setBusyLabel("");
    }
  };

  const go = (t: Tab) => { setTab(t); window.scrollTo({ top: 0 }); };
  const props: ScreenProps = { me, wallet, notify, run, busy, mark, done, holder, setHolder, go };
  const page = tab !== "home" ? PAGE[tab] : null;

  return (
    <div className="app">
      <header className="nav">
        <button className="brand" onClick={() => go("home")} aria-label="Kredo home">
          <span className="mark"><KredoMark size={18} /></span>
          <span className="name">Kredo<span className="dot">.</span></span>
        </button>
        <nav className="links" aria-label="Screens">
          {NAV.map(([t, label]) => (
            <button key={t} className={tab === t ? "active" : ""} aria-current={tab === t ? "page" : undefined} onClick={() => go(t)}>{label}</button>
          ))}
        </nav>
        <div className="nav-right">
          <span className="status mono"><span className="led" aria-hidden="true" />Stellar Testnet{USE_MOCK ? " · demo mode" : ""}</span>
          <button className="btn dark sm" onClick={onConnect} disabled={busy}>
            {wallet ? short(wallet) : "Connect wallet"}
          </button>
        </div>
      </header>

      {tab === "home" ? (
        <Home {...props} />
      ) : (
        <main className="container page">
          <div className="page-head">
            <p className="mono eyebrow">{page!.n} // {page!.label}</p>
            <h1 className="serif">{page!.title}</h1>
            <p className="muted">{page!.text}</p>
          </div>

          <div className="stepper-row">
            <ol className="stepper mono" aria-label="Demo progress">
              {STEPS.map((s, i) => (
                <li key={s.key} className={done[s.key] ? "done" : ""}>
                  <button onClick={() => go(s.tab)}>
                    <span className="num">{done[s.key] ? "✓" : String(i + 1).padStart(2, "0")}</span>
                    {s.label}
                  </button>
                </li>
              ))}
            </ol>
            {Object.values(done).some(Boolean) && (
              <button className="link mono" onClick={() => setDone(NO_STEPS)}>Reset</button>
            )}
          </div>

          {tab === "issuer" && <IssuerPortal {...props} />}
          {tab === "bank" && <BankChecker {...props} />}
          {tab === "dispute" && <DisputePanel {...props} />}
        </main>
      )}

      <footer className="footer mono">
        <div className="container foot-row">
          <span><span className="led" aria-hidden="true" />Stellar Testnet <span className="sep">|</span> Contract:{" "}
            <a href={`${EXPLORER}/contract/${CONTRACT_ID}`} target="_blank" rel="noreferrer">{short(CONTRACT_ID)}</a>
          </span>
          <span className="foot-links">
            <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
            <span>Velocity × Stellar Innovation Challenge 2026</span>
          </span>
        </div>
      </footer>

      {busy && (
        <div className="busy mono" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" /> {busyLabel}</div>
      )}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span className="tdot" aria-hidden="true" />{t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
