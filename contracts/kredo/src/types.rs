//! Shared data types — must match CONTRACT.md exactly (the app's TS bindings are generated from these).
use soroban_sdk::{contracttype, Address, BytesN, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Issuer {
    pub org: Address,        // organization's Stellar account
    pub bond: i128,          // XLM locked, in stroops (1 XLM = 10_000_000)
    pub active_vouches: u32, // credentials currently backed
    pub active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Credential {
    pub holder: Address,
    pub issuer: Address,
    pub doc_hash: BytesN<32>, // keyed HMAC of document number, computed off-chain
    pub level: u32,           // 1 = vouched, 2 = ID + org confirmed, 3 = passport chip
    pub revoked: bool,
    pub issued_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VerifyResult {
    pub verified: bool, // exists AND not revoked
    pub level: u32,
    pub issuer: Address,
    pub issuer_bond: i128,
    pub revoked: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Dispute {
    pub holder: Address,
    pub opened_by: Address,
    pub votes_fake: u32,
    pub votes_real: u32,
    pub voted: Vec<Address>,
    pub resolved: bool,
}

/// Settings passed to `initialize` (internal; exposed read-only via get_config).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address, // also receives slashed bond
    pub token: Address, // native XLM SAC
    pub panel: Vec<Address>,
    pub min_bond: i128,
    pub max_vouches: u32,
    pub slash_percent: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Config,
    Issuer(Address),     // by org
    Credential(Address), // by holder (one credential per holder)
    DocHash(BytesN<32>), // used doc hashes (duplicate check)
    Dispute(Address),    // by holder
}

// ----- Events (CONTRACT.md "Events"); data is a vec, e.g. (org, bond) -----
use soroban_sdk::contractevent;

#[contractevent(topics = ["issuer", "registered"], data_format = "vec")]
pub struct IssuerRegistered { pub org: Address, pub bond: i128 }

#[contractevent(topics = ["cred", "issued"], data_format = "vec")]
pub struct CredIssued { pub holder: Address, pub issuer: Address, pub level: u32 }

#[contractevent(topics = ["cred", "revoked"], data_format = "vec")]
pub struct CredRevoked { pub holder: Address, pub issuer: Address, pub slashed_amount: i128 }

#[contractevent(topics = ["dispute", "opened"], data_format = "vec")]
pub struct DisputeOpened { pub holder: Address, pub opened_by: Address }
