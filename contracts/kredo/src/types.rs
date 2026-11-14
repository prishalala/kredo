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
    // PRIVACY: keyed HMAC of the document number, computed off-chain. The prototype uses
    // SYNTHETIC hashes only. No real document numbers, names, photos or biometrics may ever go on-chain.
    pub doc_hash: BytesN<32>,
    pub level: u32,  // 1 = vouched, 2 = ID + org confirmed, 3 = passport chip
    pub method: u32, // 1 = passport chip + selfie (simulated), 2 = in-person doc check by bonded org, 3 = vouched
    pub revoked: bool,
    pub issued_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VerifyResult {
    pub verified: bool, // exists AND not revoked
    pub level: u32,
    pub method: u32,
    pub issuer: Address,
    pub issuer_bond: i128,
    pub issuer_active: bool,
    pub revoked: bool,
    pub dispute_open: bool,
    pub issued_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Dispute {
    pub holder: Address,
    pub opened_by: Address,
    pub votes_negligence: u32,
    pub votes_deception: u32,
    pub votes_valid: u32,
    pub voted: Vec<Address>,
    pub resolved: bool,
    pub outcome: u32, // 0 = still open, 1-3 = an Outcome value, 4 = INCONCLUSIVE (no 2-vote majority)
    pub slashed: i128, // stroops slashed from the issuer (0 unless IssuerNegligence)
}

/// Dispute.outcome when every eligible reviewer voted but no outcome got 2 votes.
/// Nothing changes; the dispute closes so a new one can be opened (escalation path).
pub const INCONCLUSIVE: u32 = 4;

/// What the panel decides. 2 votes for the same outcome resolve the dispute.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Outcome {
    IssuerNegligence = 1, // issuer was careless -> revoke + slash bond
    PersonDeception = 2,  // person fooled a careful issuer -> revoke, NO slash
    Valid = 3,            // credential is fine -> close, no change
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

#[contractevent(topics = ["dispute", "resolved"], data_format = "vec")]
pub struct DisputeResolved { pub holder: Address, pub outcome: u32, pub slashed: i128 }
