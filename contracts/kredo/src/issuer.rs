//! Person 1 — initialize, register_issuer, issue_credential, verify.
use crate::errors::Error;
use crate::storage::*;
use crate::types::*;
use soroban_sdk::{token, Address, BytesN, Env, Vec};

pub fn initialize(
    e: &Env,
    admin: Address,
    token: Address,
    panel: Vec<Address>,
    min_bond: i128,
    max_vouches: u32,
    slash_percent: u32,
) -> Result<(), Error> {
    if has_config(e) {
        return Err(Error::AlreadyInitialized);
    }
    admin.require_auth();
    // Exactly 3 distinct panelists, sane numbers.
    let distinct = panel.len() == 3
        && panel.get_unchecked(0) != panel.get_unchecked(1)
        && panel.get_unchecked(0) != panel.get_unchecked(2)
        && panel.get_unchecked(1) != panel.get_unchecked(2);
    if !distinct || min_bond <= 0 || max_vouches == 0 || slash_percent > 100 {
        return Err(Error::BadConfig);
    }
    set_config(e, &Config { admin, token, panel, min_bond, max_vouches, slash_percent });
    bump_instance(e);
    Ok(())
}

pub fn register_issuer(e: &Env, org: Address, bond: i128) -> Result<(), Error> {
    org.require_auth();
    let cfg = config(e);
    if load_issuer(e, &org).is_some() {
        return Err(Error::AlreadyRegistered);
    }
    if bond < cfg.min_bond {
        return Err(Error::BondTooLow);
    }
    // Real XLM transfer: org -> this contract.
    token::Client::new(e, &cfg.token).transfer(&org, &e.current_contract_address(), &bond);

    save_issuer(e, &Issuer { org: org.clone(), bond, active_vouches: 0, active: true });
    bump_instance(e);
    IssuerRegistered { org, bond }.publish(e);
    Ok(())
}

pub fn issue_credential(e: &Env, issuer: Address, holder: Address, doc_hash: BytesN<32>, level: u32, method: u32) -> Result<(), Error> {
    issuer.require_auth();
    let cfg = config(e);
    let mut iss = match load_issuer(e, &issuer) {
        Some(i) if i.active => i,
        _ => return Err(Error::NotIssuer),
    };
    if iss.active_vouches >= cfg.max_vouches {
        return Err(Error::VouchLimitReached);
    }
    if doc_hash_used(e, &doc_hash) {
        return Err(Error::DuplicateId);
    }
    if load_credential(e, &holder).is_some() {
        return Err(Error::AlreadyHasCredential);
    }
    if !(1..=3).contains(&level) {
        return Err(Error::BadLevel);
    }
    if !(1..=3).contains(&method) {
        return Err(Error::BadMethod);
    }

    save_credential(
        e,
        &Credential {
            holder: holder.clone(),
            issuer: issuer.clone(),
            doc_hash: doc_hash.clone(),
            level,
            method,
            revoked: false,
            issued_at: e.ledger().timestamp(),
        },
    );
    mark_doc_hash(e, &doc_hash);
    iss.active_vouches += 1;
    save_issuer(e, &iss);
    bump_instance(e);
    CredIssued { holder, issuer, level }.publish(e);
    Ok(())
}

pub fn verify(e: &Env, holder: Address) -> VerifyResult {
    match load_credential(e, &holder) {
        Some(c) => {
            let (bond, active) = load_issuer(e, &c.issuer).map(|i| (i.bond, i.active)).unwrap_or((0, false));
            let dispute_open = load_dispute(e, &holder).map(|d| !d.resolved).unwrap_or(false);
            VerifyResult {
                verified: !c.revoked,
                level: c.level,
                method: c.method,
                issuer: c.issuer,
                issuer_bond: bond,
                issuer_active: active,
                revoked: c.revoked,
                dispute_open,
                issued_at: c.issued_at,
            }
        }
        // No credential: verified=false, issuer = this contract's address as a placeholder.
        None => VerifyResult {
            verified: false,
            level: 0,
            method: 0,
            issuer: e.current_contract_address(),
            issuer_bond: 0,
            issuer_active: false,
            revoked: false,
            dispute_open: false,
            issued_at: 0,
        },
    }
}
