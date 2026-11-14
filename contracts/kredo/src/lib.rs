//! Kredo — bonded, reusable identity credentials on Stellar.
//! Public interface = CONTRACT.md. Person 1 code: issuer.rs. Person 2 code: disputes.rs.
#![no_std]

mod disputes;
mod errors;
mod issuer;
mod storage;
mod types;

#[cfg(test)]
mod test;

pub use errors::Error;
pub use types::*;

use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Vec};

#[contract]
pub struct Kredo;

#[contractimpl]
impl Kredo {
    // ----- Person 1 -----
    pub fn initialize(
        e: Env,
        admin: Address,
        token: Address,
        panel: Vec<Address>,
        min_bond: i128,
        max_vouches: u32,
        slash_percent: u32,
    ) -> Result<(), Error> {
        issuer::initialize(&e, admin, token, panel, min_bond, max_vouches, slash_percent)
    }

    pub fn register_issuer(e: Env, org: Address, bond: i128) -> Result<(), Error> {
        issuer::register_issuer(&e, org, bond)
    }

    /// `doc_hash` must be a keyed hash (synthetic in the prototype) — never a real document number.
    pub fn issue_credential(e: Env, issuer: Address, holder: Address, doc_hash: BytesN<32>, level: u32, method: u32) -> Result<(), Error> {
        issuer::issue_credential(&e, issuer, holder, doc_hash, level, method)
    }

    pub fn verify(e: Env, holder: Address) -> VerifyResult {
        issuer::verify(&e, holder)
    }

    pub fn get_issuer(e: Env, org: Address) -> Result<Issuer, Error> {
        storage::load_issuer(&e, &org).ok_or(Error::NotIssuer)
    }

    pub fn get_config(e: Env) -> Config {
        storage::config(&e)
    }

    // ----- Person 2 -----
    pub fn open_dispute(e: Env, caller: Address, holder: Address) -> Result<(), Error> {
        disputes::open_dispute(&e, caller, holder)
    }

    pub fn vote(e: Env, panelist: Address, holder: Address, outcome: Outcome) -> Result<(), Error> {
        disputes::vote(&e, panelist, holder, outcome)
    }

    pub fn release_bond(e: Env, org: Address) -> Result<(), Error> {
        disputes::release_bond(&e, org)
    }

    pub fn get_dispute(e: Env, holder: Address) -> Result<Dispute, Error> {
        storage::load_dispute(&e, &holder).ok_or(Error::NotFound)
    }
}
