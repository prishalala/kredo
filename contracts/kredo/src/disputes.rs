//! Person 2 — open_dispute, vote (2-of-3 panel, three outcomes), release_bond.
use crate::errors::Error;
use crate::storage::*;
use crate::types::*;
use soroban_sdk::{token, Address, Env, Vec};

pub fn open_dispute(e: &Env, caller: Address, holder: Address) -> Result<(), Error> {
    caller.require_auth();
    let cred = match load_credential(e, &holder) {
        Some(c) if !c.revoked => c,
        _ => return Err(Error::NotFound),
    };
    if let Some(d) = load_dispute(e, &holder) {
        if !d.resolved {
            return Err(Error::DisputeOpen);
        }
    }
    // 2-of-3 must stay reachable: need at least 2 panelists who are neither the issuer nor the opener.
    if eligible_voters(&config(e).panel, &cred.issuer, &caller) < 2 {
        return Err(Error::NotEnoughReviewers);
    }
    save_dispute(
        e,
        &Dispute {
            holder: holder.clone(),
            opened_by: caller.clone(),
            votes_negligence: 0,
            votes_deception: 0,
            votes_valid: 0,
            voted: Vec::new(e),
            resolved: false,
            outcome: 0,
            slashed: 0,
        },
    );
    bump_instance(e);
    DisputeOpened { holder, opened_by: caller }.publish(e);
    Ok(())
}

pub fn vote(e: &Env, panelist: Address, holder: Address, outcome: Outcome) -> Result<(), Error> {
    panelist.require_auth();
    let cfg = config(e);
    let mut d = match load_dispute(e, &holder) {
        Some(d) if !d.resolved => d,
        _ => return Err(Error::NotFound),
    };
    let mut cred = load_credential(e, &holder).ok_or(Error::NotFound)?;
    if !cfg.panel.contains(&panelist) {
        return Err(Error::NotPanelist);
    }
    // Independence: the vouching issuer and the dispute opener can't judge it.
    if panelist == cred.issuer || panelist == d.opened_by {
        return Err(Error::ConflictOfInterest);
    }
    if d.voted.contains(&panelist) {
        return Err(Error::AlreadyVoted);
    }
    d.voted.push_back(panelist);
    let count = match outcome {
        Outcome::IssuerNegligence => { d.votes_negligence += 1; d.votes_negligence }
        Outcome::PersonDeception => { d.votes_deception += 1; d.votes_deception }
        Outcome::Valid => { d.votes_valid += 1; d.votes_valid }
    };

    // 2 votes for the same outcome decide it.
    if count >= 2 {
        let result = outcome;
        let mut slashed: i128 = 0;
        if result != Outcome::Valid {
            let mut iss = load_issuer(e, &cred.issuer).ok_or(Error::NotIssuer)?;
            if result == Outcome::IssuerNegligence {
                // Issuer was careless: slash part of its bond (sent to admin).
                slashed = iss.bond * cfg.slash_percent as i128 / 100;
                if slashed > 0 {
                    token::Client::new(e, &cfg.token).transfer(&e.current_contract_address(), &cfg.admin, &slashed);
                }
                iss.bond -= slashed;
            }
            // Both IssuerNegligence and PersonDeception revoke; only negligence costs the issuer money.
            iss.active_vouches -= 1;
            cred.revoked = true;
            save_issuer(e, &iss);
            save_credential(e, &cred);
            CredRevoked { holder: holder.clone(), issuer: cred.issuer.clone(), slashed_amount: slashed }.publish(e);
        }
        d.resolved = true;
        d.outcome = result as u32;
        d.slashed = slashed;
        DisputeResolved { holder, outcome: result as u32, slashed }.publish(e);
    } else if d.voted.len() >= eligible_voters(&cfg.panel, &cred.issuer, &d.opened_by) {
        // Everyone eligible voted, no 2-vote majority (e.g. 1-1-1): INCONCLUSIVE.
        // No revoke, no slash. The dispute closes so it can't lock the holder forever;
        // anyone can open a new dispute (e.g. with new evidence) to escalate.
        d.resolved = true;
        d.outcome = INCONCLUSIVE;
        DisputeResolved { holder, outcome: INCONCLUSIVE, slashed: 0 }.publish(e);
    }
    save_dispute(e, &d);
    bump_instance(e);
    Ok(())
}

/// Panelists allowed to vote on this dispute (not the issuer, not the opener).
fn eligible_voters(panel: &Vec<Address>, issuer: &Address, opened_by: &Address) -> u32 {
    panel.iter().filter(|p| p != issuer && p != opened_by).count() as u32
}

pub fn release_bond(e: &Env, org: Address) -> Result<(), Error> {
    org.require_auth();
    let cfg = config(e);
    let mut iss = match load_issuer(e, &org) {
        Some(i) if i.active => i,
        _ => return Err(Error::NotIssuer),
    };
    if iss.active_vouches > 0 {
        return Err(Error::StillBacking);
    }
    if iss.bond > 0 {
        token::Client::new(e, &cfg.token).transfer(&e.current_contract_address(), &org, &iss.bond);
    }
    iss.bond = 0;
    iss.active = false;
    save_issuer(e, &iss);
    bump_instance(e);
    Ok(())
}
