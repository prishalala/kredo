import { useEffect, useState } from "react";
import { getDispute, openDispute, vote } from "../kredo";
import type { Dispute } from "../kredo/types";
import { OUTCOME_INFO, Outcome } from "../kredo/types";
import { PANEL, SLASH_PERCENT, USE_MOCK } from "../config";
import { PEOPLE, PANEL_NAMES, personaFor } from "../personas";
import { short } from "../wallet";
import type { ScreenProps } from "../App";
import { ArrowIcon } from "../icons";

const VOTES: { o: number; label: string; cls: string }[] = [
  { o: Outcome.IssuerNegligence, label: "Negligence", cls: "danger" },
  { o: Outcome.PersonDeception, label: "Deception", cls: "ghost" },
  { o: Outcome.Valid, label: "Valid", cls: "ghost" },
];

export default function DisputePanel({ me, wallet, notify, run, busy, mark, holder, setHolder, go }: ScreenProps) {
  const [d, setD] = useState<Dispute | null>(null);
  const person = personaFor(holder);
  const myPanelIndex = PANEL.indexOf(wallet);

  useEffect(() => { getDispute(holder).then(setD); }, [holder]);

  const onOpen = () =>
    run(async () => {
      await openDispute(me, holder);
      setD(await getDispute(holder));
      notify("Dispute opened. The panel can now vote.", "info");
    }, "Opening dispute on Stellar…");

  const onVote = (panelist: string, o: number) =>
    run(async () => {
      await vote(panelist, holder, o);
      const nd = await getDispute(holder);
      setD(nd);
      if (nd?.resolved) {
        if (nd.outcome === 1 || nd.outcome === 2) mark("dispute");
        notify(`Resolved: ${OUTCOME_INFO[nd.outcome].result}`, "info");
      } else notify("Vote recorded");
    }, "Recording vote on Stellar…");

  const top = d ? Math.max(d.votesNegligence, d.votesDeception, d.votesValid) : 0;
  const revoked = d?.resolved && (d.outcome === 1 || d.outcome === 2);

  return (
    <div className="grid2">
      <section className="card">
        <p className="mono label">A // Raise</p>
        <h2>Dispute a verification</h2>
        <p className="muted">If a credential looks wrong, three bonded organizations review it. The panelist who issued it, or who raised the dispute, can't vote.</p>
        <fieldset className="people">
          <legend>Credential being disputed</legend>
          {PEOPLE.map((p) => (
            <label key={p.address} className={`person ${holder === p.address ? "sel" : ""}`}>
              <input type="radio" name="disp" checked={holder === p.address} onChange={() => setHolder(p.address)} />
              <span className="avatar">{p.initial}</span>
              <span className="grow"><strong>{p.name}</strong><span className="muted small block">{p.role}</span></span>
            </label>
          ))}
        </fieldset>
        <button className="btn dark" disabled={busy || !holder || (!!d && !d.resolved)} onClick={onOpen}>
          {d && !d.resolved ? "Dispute open" : "Open dispute"}
        </button>

        <div className="outcomes">
          <p className="mono label">Possible outcomes</p>
          {[1, 2, 3, 4].map((o) => (
            <div key={o} className="outcome">
              <strong className="small">{OUTCOME_INFO[o].short}</strong>
              <span className="small muted">{o === 1 ? OUTCOME_INFO[1].detail.replace("part of", `${SLASH_PERCENT}% of`) : OUTCOME_INFO[o].detail}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={`card ${revoked ? "bad-border" : ""}`} aria-live="polite">
        <p className="mono label">B // Panel vote</p>
        <h2>{person ? `${person.name}'s credential` : "Panel vote"}</h2>

        {!d && <div className="empty"><p className="muted">No dispute open for {person?.name ?? "this person"}.</p></div>}

        {d && (
          <>
            <div className="tallies mono">
              <div><span>Negligence</span><strong>{d.votesNegligence}</strong></div>
              <div><span>Deception</span><strong>{d.votesDeception}</strong></div>
              <div><span>Valid</span><strong>{d.votesValid}</strong></div>
            </div>
            <div>
              <div className="meter-label mono tiny"><span className="muted">Matching votes needed</span><span>{Math.min(top, 2)} / 2</span></div>
              <div className="meter" role="progressbar" aria-valuenow={Math.min(top, 2)} aria-valuemin={0} aria-valuemax={2}>
                <span style={{ width: `${Math.min(top, 2) * 50}%` }} />
              </div>
            </div>

            <ul className="panel">
              {PANEL.map((p, i) => {
                const voted = d.voted.includes(p);
                const canVoteHere = USE_MOCK || p === wallet;
                return (
                  <li key={p}>
                    <span className="avatar sm">{i + 1}</span>
                    <span className="grow"><strong className="small">{PANEL_NAMES[i]}</strong><span className="mono tiny block muted">{short(p)}</span></span>
                    {voted ? <span className="chip dim mono">Voted</span> : d.resolved ? null : canVoteHere ? (
                      <span className="vote-btns">
                        {VOTES.map((v) => (
                          <button key={v.o} className={`btn xs ${v.cls}`} disabled={busy} onClick={() => onVote(p, v.o)}>{v.label}</button>
                        ))}
                      </span>
                    ) : <span className="mono tiny muted">Waiting</span>}
                  </li>
                );
              })}
            </ul>

            {!USE_MOCK && !d.resolved && myPanelIndex < 0 && (
              <p className="hint">To vote, switch Freighter to one of the panel accounts and reconnect.</p>
            )}

            {d.resolved && (
              <div className={`alert ${revoked ? "clay" : d.outcome === 3 ? "green" : "gold"}`}>
                <strong>{OUTCOME_INFO[d.outcome].result}</strong>
                <span className="small">
                  {OUTCOME_INFO[d.outcome].detail}
                  {d.outcome === 1 && d.slashed ? ` ${d.slashed} XLM was slashed.` : ""}
                </span>
              </div>
            )}
            {revoked && <button className="btn dark" onClick={() => go("bank")}>See what the bank sees now <ArrowIcon /></button>}
          </>
        )}
      </section>
    </div>
  );
}
