//! Person 2 — tests for the full flow, incl. duplicate, auth, caps, disputes, revoke, slash, release.
#![cfg(test)]
extern crate std;

use crate::{Error, Kredo, KredoClient};
use soroban_sdk::{
    testutils::{Address as _, Events as _},
    token::{StellarAssetClient, TokenClient},
    vec, Address, BytesN, Env,
};

const XLM: i128 = 10_000_000;
const MIN_BOND: i128 = 100 * XLM;

struct T<'a> {
    e: Env,
    c: KredoClient<'a>,
    xlm: TokenClient<'a>,
    admin: Address,
    org: Address,
    bank: Address,
    p: [Address; 3],
}

fn fund(t: &T, who: &Address, amt: i128) {
    StellarAssetClient::new(&t.e, &t.xlm.address).mint(who, &amt);
}

fn setup<'a>(max_vouches: u32) -> T<'a> {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(admin.clone());
    let id = e.register(Kredo, ());
    let c = KredoClient::new(&e, &id);
    let p = [Address::generate(&e), Address::generate(&e), Address::generate(&e)];
    c.initialize(&admin, &sac.address(), &vec![&e, p[0].clone(), p[1].clone(), p[2].clone()], &MIN_BOND, &max_vouches, &50);
    let t = T { xlm: TokenClient::new(&e, &sac.address()), org: Address::generate(&e), bank: Address::generate(&e), e, c, admin, p };
    fund(&t, &t.org, 1000 * XLM);
    t
}

fn h(e: &Env, n: u8) -> BytesN<32> {
    BytesN::from_array(e, &[n; 32])
}

/// Org registered with 100 XLM, one level-2 credential issued to `holder`.
fn issued<'a>() -> (T<'a>, Address) {
    let t = setup(5);
    t.c.register_issuer(&t.org, &MIN_BOND);
    let holder = Address::generate(&t.e);
    t.c.issue_credential(&t.org, &holder, &h(&t.e, 1), &2);
    (t, holder)
}

// ---------- initialize ----------

#[test]
fn initialize_only_once_and_validates() {
    let t = setup(5);
    let panel = vec![&t.e, t.p[0].clone(), t.p[1].clone(), t.p[2].clone()];
    assert_eq!(t.c.try_initialize(&t.admin, &t.xlm.address, &panel, &MIN_BOND, &5, &50), Err(Ok(Error::AlreadyInitialized)));

    let e = Env::default();
    e.mock_all_auths();
    let c = KredoClient::new(&e, &e.register(Kredo, ()));
    let a = Address::generate(&e);
    let dup = vec![&e, a.clone(), a.clone(), a.clone()];
    assert_eq!(c.try_initialize(&a, &a, &dup, &MIN_BOND, &5, &50), Err(Ok(Error::BadConfig)));
}

// ---------- register_issuer ----------

#[test]
fn register_locks_real_xlm() {
    let t = setup(5);
    t.c.register_issuer(&t.org, &MIN_BOND);
    assert_eq!(t.xlm.balance(&t.c.address), MIN_BOND);
    assert_eq!(t.xlm.balance(&t.org), 900 * XLM);
    let i = t.c.get_issuer(&t.org);
    assert!(i.active && i.bond == MIN_BOND && i.active_vouches == 0);
}

#[test]
fn register_rejects_low_bond_and_duplicate() {
    let t = setup(5);
    assert_eq!(t.c.try_register_issuer(&t.org, &(MIN_BOND - 1)), Err(Ok(Error::BondTooLow)));
    t.c.register_issuer(&t.org, &MIN_BOND);
    assert_eq!(t.c.try_register_issuer(&t.org, &MIN_BOND), Err(Ok(Error::AlreadyRegistered)));
}

// ---------- issue_credential / verify ----------

#[test]
fn issue_then_verify_success() {
    let (t, holder) = issued();
    assert!(!t.e.events().all().events().is_empty());
    let v = t.c.verify(&holder);
    assert!(v.verified && !v.revoked);
    assert_eq!((v.level, v.issuer, v.issuer_bond), (2, t.org.clone(), MIN_BOND));
    assert_eq!(t.c.get_issuer(&t.org).active_vouches, 1);
}

#[test]
fn verify_unknown_holder_is_not_verified() {
    let t = setup(5);
    let v = t.c.verify(&Address::generate(&t.e));
    assert!(!v.verified && !v.revoked && v.level == 0);
}

#[test]
fn duplicate_doc_hash_rejected() {
    let (t, _) = issued();
    let other = Address::generate(&t.e);
    assert_eq!(t.c.try_issue_credential(&t.org, &other, &h(&t.e, 1), &2), Err(Ok(Error::DuplicateId)));
}

#[test]
fn holder_cannot_get_second_credential() {
    let (t, holder) = issued();
    assert_eq!(t.c.try_issue_credential(&t.org, &holder, &h(&t.e, 2), &2), Err(Ok(Error::AlreadyHasCredential)));
}

#[test]
fn unregistered_issuer_rejected() {
    let t = setup(5);
    let rogue = Address::generate(&t.e);
    assert_eq!(t.c.try_issue_credential(&rogue, &t.bank, &h(&t.e, 1), &2), Err(Ok(Error::NotIssuer)));
}

#[test]
#[should_panic]
fn issue_without_issuer_signature_fails() {
    let t = setup(5);
    t.c.register_issuer(&t.org, &MIN_BOND);
    t.e.set_auths(&[]); // stop mocking: no signature from org
    t.c.issue_credential(&t.org, &t.bank, &h(&t.e, 1), &2);
}

#[test]
fn bad_level_rejected() {
    let t = setup(5);
    t.c.register_issuer(&t.org, &MIN_BOND);
    let x = Address::generate(&t.e);
    assert_eq!(t.c.try_issue_credential(&t.org, &x, &h(&t.e, 1), &0), Err(Ok(Error::BadLevel)));
    assert_eq!(t.c.try_issue_credential(&t.org, &x, &h(&t.e, 1), &4), Err(Ok(Error::BadLevel)));
}

#[test]
fn vouch_cap_enforced() {
    let t = setup(2);
    t.c.register_issuer(&t.org, &MIN_BOND);
    for n in 1..=2u8 {
        t.c.issue_credential(&t.org, &Address::generate(&t.e), &h(&t.e, n), &1);
    }
    assert_eq!(
        t.c.try_issue_credential(&t.org, &Address::generate(&t.e), &h(&t.e, 3), &1),
        Err(Ok(Error::VouchLimitReached))
    );
}

// ---------- disputes ----------

#[test]
fn dispute_open_rules() {
    let (t, holder) = issued();
    assert_eq!(t.c.try_open_dispute(&t.bank, &Address::generate(&t.e)), Err(Ok(Error::NotFound)));
    t.c.open_dispute(&t.bank, &holder);
    assert_eq!(t.c.try_open_dispute(&t.bank, &holder), Err(Ok(Error::DisputeOpen)));
    let d = t.c.get_dispute(&holder);
    assert!(!d.resolved && d.opened_by == t.bank);
}

#[test]
fn two_fake_votes_revoke_and_slash() {
    let (t, holder) = issued();
    t.c.open_dispute(&t.bank, &holder);
    t.c.vote(&t.p[0], &holder, &true);
    assert!(t.c.verify(&holder).verified); // 1 vote isn't enough
    t.c.vote(&t.p[1], &holder, &true);

    let v = t.c.verify(&holder);
    assert!(!v.verified && v.revoked);
    assert_eq!(v.issuer_bond, 50 * XLM);
    assert_eq!(t.xlm.balance(&t.admin), 50 * XLM); // slashed XLM really moved
    assert_eq!(t.xlm.balance(&t.c.address), 50 * XLM);
    assert_eq!(t.c.get_issuer(&t.org).active_vouches, 0);
    assert!(t.c.get_dispute(&holder).resolved);
    // resolved: no more votes, can't re-dispute a revoked credential
    assert_eq!(t.c.try_vote(&t.p[2], &holder, &true), Err(Ok(Error::NotFound)));
    assert_eq!(t.c.try_open_dispute(&t.bank, &holder), Err(Ok(Error::NotFound)));
}

#[test]
fn two_real_votes_no_penalty() {
    // Real person (incl. holder misuse) never slashes the issuer.
    let (t, holder) = issued();
    t.c.open_dispute(&t.bank, &holder);
    t.c.vote(&t.p[0], &holder, &false);
    t.c.vote(&t.p[1], &holder, &true);
    t.c.vote(&t.p[2], &holder, &false);
    assert!(t.c.verify(&holder).verified);
    assert_eq!(t.c.get_issuer(&t.org).bond, MIN_BOND);
    assert_eq!(t.xlm.balance(&t.admin), 0);
    assert!(t.c.get_dispute(&holder).resolved);
    t.c.open_dispute(&t.bank, &holder); // a new dispute may be opened later
}

#[test]
fn double_vote_and_non_panelist_rejected() {
    let (t, holder) = issued();
    t.c.open_dispute(&t.bank, &holder);
    t.c.vote(&t.p[0], &holder, &true);
    assert_eq!(t.c.try_vote(&t.p[0], &holder, &true), Err(Ok(Error::AlreadyVoted)));
    assert_eq!(t.c.try_vote(&t.bank, &holder, &true), Err(Ok(Error::NotPanelist)));
}

#[test]
fn issuer_and_opener_cannot_vote() {
    let t = setup(5);
    let panel_org = t.p[0].clone(); // a panelist who is also an issuer
    fund(&t, &panel_org, MIN_BOND);
    t.c.register_issuer(&panel_org, &MIN_BOND);
    let holder = Address::generate(&t.e);
    t.c.issue_credential(&panel_org, &holder, &h(&t.e, 1), &2);
    t.c.open_dispute(&t.p[1], &holder);
    assert_eq!(t.c.try_vote(&panel_org, &holder, &true), Err(Ok(Error::ConflictOfInterest)));
    assert_eq!(t.c.try_vote(&t.p[1], &holder, &true), Err(Ok(Error::ConflictOfInterest)));
}

// ---------- release_bond ----------

#[test]
fn release_blocked_while_backing() {
    let (t, _) = issued();
    assert_eq!(t.c.try_release_bond(&t.org), Err(Ok(Error::StillBacking)));
}

#[test]
fn release_returns_remaining_bond() {
    let (t, holder) = issued();
    t.c.open_dispute(&t.bank, &holder);
    t.c.vote(&t.p[0], &holder, &true);
    t.c.vote(&t.p[1], &holder, &true); // slashed to 50, vouches -> 0
    let before = t.xlm.balance(&t.org);
    t.c.release_bond(&t.org);
    assert_eq!(t.xlm.balance(&t.org), before + 50 * XLM);
    assert_eq!(t.xlm.balance(&t.c.address), 0);
    let i = t.c.get_issuer(&t.org);
    assert!(!i.active && i.bond == 0);
    assert_eq!(t.c.try_release_bond(&t.org), Err(Ok(Error::NotIssuer)));
    assert_eq!(t.c.try_issue_credential(&t.org, &t.bank, &h(&t.e, 7), &1), Err(Ok(Error::NotIssuer)));
}
