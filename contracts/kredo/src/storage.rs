//! Storage helpers shared by Person 1 and Person 2.
use crate::types::*;
use soroban_sdk::{Address, BytesN, Env, IntoVal, Val};

const DAY: u32 = 17_280; // ledgers (~5 s each)
const BUMP_IF_BELOW: u32 = 7 * DAY;
const BUMP_TO: u32 = 30 * DAY;

pub fn bump_instance(e: &Env) {
    e.storage().instance().extend_ttl(BUMP_IF_BELOW, BUMP_TO);
}

fn get<V: soroban_sdk::TryFromVal<Env, Val>>(e: &Env, k: &DataKey) -> Option<V> {
    e.storage().persistent().get(k)
}
fn put<V: IntoVal<Env, Val>>(e: &Env, k: &DataKey, v: &V) {
    e.storage().persistent().set(k, v);
    e.storage().persistent().extend_ttl(k, BUMP_IF_BELOW, BUMP_TO);
}

pub fn has_config(e: &Env) -> bool {
    e.storage().instance().has(&DataKey::Config)
}
pub fn config(e: &Env) -> Config {
    e.storage().instance().get(&DataKey::Config).expect("not initialized")
}
pub fn set_config(e: &Env, c: &Config) {
    e.storage().instance().set(&DataKey::Config, c);
}

pub fn load_issuer(e: &Env, org: &Address) -> Option<Issuer> {
    get(e, &DataKey::Issuer(org.clone()))
}
pub fn save_issuer(e: &Env, i: &Issuer) {
    put(e, &DataKey::Issuer(i.org.clone()), i);
}

pub fn load_credential(e: &Env, holder: &Address) -> Option<Credential> {
    get(e, &DataKey::Credential(holder.clone()))
}
pub fn save_credential(e: &Env, c: &Credential) {
    put(e, &DataKey::Credential(c.holder.clone()), c);
}

pub fn doc_hash_used(e: &Env, h: &BytesN<32>) -> bool {
    e.storage().persistent().has(&DataKey::DocHash(h.clone()))
}
pub fn mark_doc_hash(e: &Env, h: &BytesN<32>) {
    put(e, &DataKey::DocHash(h.clone()), &true);
}

pub fn load_dispute(e: &Env, holder: &Address) -> Option<Dispute> {
    get(e, &DataKey::Dispute(holder.clone()))
}
pub fn save_dispute(e: &Env, d: &Dispute) {
    put(e, &DataKey::Dispute(d.holder.clone()), d);
}
