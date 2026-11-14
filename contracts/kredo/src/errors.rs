//! Error codes — 1..13 are from CONTRACT.md; 14..15 are additions (flagged to app pair).
use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    BondTooLow = 1,
    AlreadyRegistered = 2,
    NotIssuer = 3,
    VouchLimitReached = 4,
    DuplicateId = 5,
    AlreadyHasCredential = 6,
    BadLevel = 7,
    NotFound = 8,
    DisputeOpen = 9,
    NotPanelist = 10,
    ConflictOfInterest = 11,
    AlreadyVoted = 12,
    StillBacking = 13,
    AlreadyInitialized = 14,
    BadConfig = 15,
}
