#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    BytesN, Env,
};

const INSTANCE_BUMP_AMOUNT: u32 = 30 * 17_280;
const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - 100;
const RECEIPT_BUMP_AMOUNT: u32 = 120 * 17_280;
const RECEIPT_LIFETIME_THRESHOLD: u32 = RECEIPT_BUMP_AMOUNT - 100;

#[contract]
pub struct ReceiptLedgerContract;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ReceiptState {
    Issued = 1,
    Active = 2,
    Partial = 3,
    Dispensed = 4,
    Revoked = 5,
    Expired = 6,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Receipt {
    /// Random, high-entropy identifier generated off-chain. It is not a patient identifier.
    pub receipt_id: BytesN<32>,
    /// Opaque commitment produced off-chain. No clinical fields are stored separately.
    pub commitment: BytesN<32>,
    pub state: ReceiptState,
    pub version: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
struct OperationRecord {
    receipt_id: BytesN<32>,
    expected_version: u32,
    resulting_version: u32,
    target_state: ReceiptState,
    commitment: BytesN<32>,
}

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Admin,
    Doctor(Address),
    Dispensary(Address),
    Receipt(BytesN<32>),
    Operation(BytesN<32>),
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
#[repr(u32)]
pub enum ReceiptError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    ReceiptMissing = 4,
    ReceiptAlreadyExists = 5,
    VersionConflict = 6,
    InvalidTransition = 7,
    OperationConflict = 8,
}

#[contractevent(topics = ["Issued"], data_format = "vec")]
pub struct IssuedEvent {
    pub receipt_id: BytesN<32>,
    pub version: u32,
    pub commitment: BytesN<32>,
}

#[contractevent(topics = ["Active"], data_format = "vec")]
pub struct ActiveEvent {
    pub receipt_id: BytesN<32>,
    pub version: u32,
    pub commitment: BytesN<32>,
}

#[contractevent(topics = ["Partial"], data_format = "vec")]
pub struct PartialEvent {
    pub receipt_id: BytesN<32>,
    pub version: u32,
    pub commitment: BytesN<32>,
}

#[contractevent(topics = ["Dispensed"], data_format = "vec")]
pub struct DispensedEvent {
    pub receipt_id: BytesN<32>,
    pub version: u32,
    pub commitment: BytesN<32>,
}

#[contractevent(topics = ["Revoked"], data_format = "vec")]
pub struct RevokedEvent {
    pub receipt_id: BytesN<32>,
    pub version: u32,
    pub commitment: BytesN<32>,
}

#[contractevent(topics = ["Expired"], data_format = "vec")]
pub struct ExpiredEvent {
    pub receipt_id: BytesN<32>,
    pub version: u32,
    pub commitment: BytesN<32>,
}

#[contractimpl]
impl ReceiptLedgerContract {
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, ReceiptError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        extend_instance_ttl(&env);
    }

    pub fn set_doctor(env: Env, admin: Address, account: Address, enabled: bool) {
        require_admin(&env, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::Doctor(account), &enabled);
        extend_instance_ttl(&env);
    }

    pub fn set_dispensary(env: Env, admin: Address, account: Address, enabled: bool) {
        require_admin(&env, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::Dispensary(account), &enabled);
        extend_instance_ttl(&env);
    }

    pub fn issue(
        env: Env,
        doctor: Address,
        receipt_id: BytesN<32>,
        commitment: BytesN<32>,
        operation_id: BytesN<32>,
    ) -> Receipt {
        require_doctor(&env, &doctor);

        let requested = OperationRecord {
            receipt_id: receipt_id.clone(),
            expected_version: 0,
            resulting_version: 1,
            target_state: ReceiptState::Issued,
            commitment: commitment.clone(),
        };
        if let Some(existing) = load_operation(&env, &operation_id) {
            return replay_or_reject(&env, existing, requested);
        }
        if env
            .storage()
            .persistent()
            .has(&DataKey::Receipt(receipt_id.clone()))
        {
            panic_with_error!(&env, ReceiptError::ReceiptAlreadyExists);
        }

        let receipt = Receipt {
            receipt_id: receipt_id.clone(),
            commitment: commitment.clone(),
            state: ReceiptState::Issued,
            version: 1,
        };
        save_receipt_and_operation(&env, &receipt, &operation_id, &requested);
        IssuedEvent {
            receipt_id,
            version: 1,
            commitment,
        }
        .publish(&env);
        receipt
    }

    pub fn activate(
        env: Env,
        doctor: Address,
        receipt_id: BytesN<32>,
        expected_version: u32,
        commitment: BytesN<32>,
        operation_id: BytesN<32>,
    ) -> Receipt {
        require_doctor(&env, &doctor);
        transition(
            &env,
            receipt_id,
            expected_version,
            commitment,
            operation_id,
            ReceiptState::Active,
        )
    }

    pub fn record_partial(
        env: Env,
        dispensary: Address,
        receipt_id: BytesN<32>,
        expected_version: u32,
        commitment: BytesN<32>,
        operation_id: BytesN<32>,
    ) -> Receipt {
        require_dispensary(&env, &dispensary);
        transition(
            &env,
            receipt_id,
            expected_version,
            commitment,
            operation_id,
            ReceiptState::Partial,
        )
    }

    pub fn mark_dispensed(
        env: Env,
        dispensary: Address,
        receipt_id: BytesN<32>,
        expected_version: u32,
        commitment: BytesN<32>,
        operation_id: BytesN<32>,
    ) -> Receipt {
        require_dispensary(&env, &dispensary);
        transition(
            &env,
            receipt_id,
            expected_version,
            commitment,
            operation_id,
            ReceiptState::Dispensed,
        )
    }

    pub fn revoke(
        env: Env,
        doctor: Address,
        receipt_id: BytesN<32>,
        expected_version: u32,
        commitment: BytesN<32>,
        operation_id: BytesN<32>,
    ) -> Receipt {
        require_doctor(&env, &doctor);
        transition(
            &env,
            receipt_id,
            expected_version,
            commitment,
            operation_id,
            ReceiptState::Revoked,
        )
    }

    /// Expiration is materialized by the admin after the private system's policy check.
    /// No clinical duration or expiration timestamp is written to the ledger.
    pub fn expire(
        env: Env,
        admin: Address,
        receipt_id: BytesN<32>,
        expected_version: u32,
        commitment: BytesN<32>,
        operation_id: BytesN<32>,
    ) -> Receipt {
        require_admin(&env, &admin);
        transition(
            &env,
            receipt_id,
            expected_version,
            commitment,
            operation_id,
            ReceiptState::Expired,
        )
    }

    pub fn get_receipt(env: Env, receipt_id: BytesN<32>) -> Receipt {
        load_receipt(&env, &receipt_id)
    }
}

fn transition(
    env: &Env,
    receipt_id: BytesN<32>,
    expected_version: u32,
    commitment: BytesN<32>,
    operation_id: BytesN<32>,
    target_state: ReceiptState,
) -> Receipt {
    if expected_version == u32::MAX {
        panic_with_error!(env, ReceiptError::VersionConflict);
    }
    let resulting_version = expected_version.saturating_add(1);
    let requested = OperationRecord {
        receipt_id: receipt_id.clone(),
        expected_version,
        resulting_version,
        target_state,
        commitment: commitment.clone(),
    };
    if let Some(existing) = load_operation(env, &operation_id) {
        return replay_or_reject(env, existing, requested);
    }

    let current = load_receipt(env, &receipt_id);
    if current.version != expected_version {
        panic_with_error!(env, ReceiptError::VersionConflict);
    }
    if !is_transition_allowed(current.state, target_state) {
        panic_with_error!(env, ReceiptError::InvalidTransition);
    }

    let updated = Receipt {
        receipt_id: receipt_id.clone(),
        commitment: commitment.clone(),
        state: target_state,
        version: resulting_version,
    };
    save_receipt_and_operation(env, &updated, &operation_id, &requested);
    publish_transition(env, target_state, receipt_id, resulting_version, commitment);
    updated
}

fn is_transition_allowed(from: ReceiptState, to: ReceiptState) -> bool {
    match to {
        ReceiptState::Active => from == ReceiptState::Issued,
        ReceiptState::Partial => from == ReceiptState::Active || from == ReceiptState::Partial,
        ReceiptState::Dispensed => from == ReceiptState::Active || from == ReceiptState::Partial,
        ReceiptState::Revoked => {
            from == ReceiptState::Issued
                || from == ReceiptState::Active
                || from == ReceiptState::Partial
        }
        ReceiptState::Expired => {
            from == ReceiptState::Issued
                || from == ReceiptState::Active
                || from == ReceiptState::Partial
        }
        ReceiptState::Issued => false,
    }
}

fn publish_transition(
    env: &Env,
    state: ReceiptState,
    receipt_id: BytesN<32>,
    version: u32,
    commitment: BytesN<32>,
) {
    match state {
        ReceiptState::Active => ActiveEvent {
            receipt_id,
            version,
            commitment,
        }
        .publish(env),
        ReceiptState::Partial => PartialEvent {
            receipt_id,
            version,
            commitment,
        }
        .publish(env),
        ReceiptState::Dispensed => DispensedEvent {
            receipt_id,
            version,
            commitment,
        }
        .publish(env),
        ReceiptState::Revoked => RevokedEvent {
            receipt_id,
            version,
            commitment,
        }
        .publish(env),
        ReceiptState::Expired => ExpiredEvent {
            receipt_id,
            version,
            commitment,
        }
        .publish(env),
        ReceiptState::Issued => panic_with_error!(env, ReceiptError::InvalidTransition),
    }
}

fn replay_or_reject(env: &Env, existing: OperationRecord, requested: OperationRecord) -> Receipt {
    if existing != requested {
        panic_with_error!(env, ReceiptError::OperationConflict);
    }
    Receipt {
        receipt_id: existing.receipt_id,
        commitment: existing.commitment,
        state: existing.target_state,
        version: existing.resulting_version,
    }
}

fn save_receipt_and_operation(
    env: &Env,
    receipt: &Receipt,
    operation_id: &BytesN<32>,
    operation: &OperationRecord,
) {
    let receipt_key = DataKey::Receipt(receipt.receipt_id.clone());
    let operation_key = DataKey::Operation(operation_id.clone());
    env.storage().persistent().set(&receipt_key, receipt);
    env.storage().persistent().set(&operation_key, operation);
    env.storage().persistent().extend_ttl(
        &receipt_key,
        RECEIPT_LIFETIME_THRESHOLD,
        RECEIPT_BUMP_AMOUNT,
    );
    env.storage().persistent().extend_ttl(
        &operation_key,
        RECEIPT_LIFETIME_THRESHOLD,
        RECEIPT_BUMP_AMOUNT,
    );
    extend_instance_ttl(env);
}

fn load_receipt(env: &Env, receipt_id: &BytesN<32>) -> Receipt {
    let key = DataKey::Receipt(receipt_id.clone());
    let receipt = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| panic_with_error!(env, ReceiptError::ReceiptMissing));
    env.storage()
        .persistent()
        .extend_ttl(&key, RECEIPT_LIFETIME_THRESHOLD, RECEIPT_BUMP_AMOUNT);
    receipt
}

fn load_operation(env: &Env, operation_id: &BytesN<32>) -> Option<OperationRecord> {
    let key = DataKey::Operation(operation_id.clone());
    let operation = env.storage().persistent().get(&key);
    if operation.is_some() {
        env.storage().persistent().extend_ttl(
            &key,
            RECEIPT_LIFETIME_THRESHOLD,
            RECEIPT_BUMP_AMOUNT,
        );
    }
    operation
}

fn require_admin(env: &Env, admin: &Address) {
    admin.require_auth();
    let stored: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| panic_with_error!(env, ReceiptError::NotInitialized));
    if stored != *admin {
        panic_with_error!(env, ReceiptError::Unauthorized);
    }
}

fn require_doctor(env: &Env, account: &Address) {
    account.require_auth();
    if !env
        .storage()
        .persistent()
        .get(&DataKey::Doctor(account.clone()))
        .unwrap_or(false)
    {
        panic_with_error!(env, ReceiptError::Unauthorized);
    }
}

fn require_dispensary(env: &Env, account: &Address) {
    account.require_auth();
    if !env
        .storage()
        .persistent()
        .get(&DataKey::Dispensary(account.clone()))
        .unwrap_or(false)
    {
        panic_with_error!(env, ReceiptError::Unauthorized);
    }
}

fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

mod test;
