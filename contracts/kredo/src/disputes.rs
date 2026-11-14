//! Person 2 — open_dispute, vote (2-of-3 panel), release_bond.
use crate::errors::Error;
use crate::storage::*;
use crate::types::*;
use soroban_sdk::{token, Address, Env, Vec};

pub fn open_dispute(e: &Env, caller: Address, holder: Address) -> Result<(), Error> {
    caller.require_auth();
    match load_credential(e, &holder) {
        Some(c) if !c.revoked => {}
        _ => return Err(Error::NotFound),
    }
    if let Some(d) = load_dispute(e, &holder) {
        if !d.resolved {
            return Err(Error::DisputeOpen);
        }
    }
    save_dispute(
        e,
        &Dispute { holder: holder.clone(), opened_by: caller.clone(), votes_fake: 0, votes_real: 0, voted: Vec::new(e), resolved: false },
    );
    bump_instance(e);
    DisputeOpened { holder, opened_by: caller }.publish(e);
    Ok(())
}

pub fn vote(e: &Env, panelist: Address, holder: Address, is_fake: bool) -> Result<(), Error> {
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
    if is_fake {
        d.votes_fake += 1;
    } else {
        d.votes_real += 1;
    }

    if d.votes_fake >= 2 {
        // Fake verification = issuer negligence: revoke + slash bond.
        let mut iss = load_issuer(e, &cred.issuer).ok_or(Error::NotIssuer)?;
        let slashed = iss.bond * cfg.slash_percent as i128 / 100;
        if slashed > 0 {
            token::Client::new(e, &cfg.token).transfer(&e.current_contract_address(), &cfg.admin, &slashed);
        }
        iss.bond -= slashed;
        iss.active_vouches -= 1;
        cred.revoked = true;
        d.resolved = true;
        save_issuer(e, &iss);
        save_credential(e, &cred);
        CredRevoked { holder, issuer: cred.issuer, slashed_amount: slashed }.publish(e);
    } else if d.votes_real >= 2 {
        // Person is real (any later misuse is the holder's own problem): issuer is NOT penalized.
        d.resolved = true;
    }
    save_dispute(e, &d);
    bump_instance(e);
    Ok(())
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
