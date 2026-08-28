#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    BytesN, Env,
};

const INSTANCE_BUMP_AMOUNT: u32 = 30 * 17_280;
const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - 100;
const RECEIPT_BUMP_AMOUNT: u32 = 120 * 17_280;
const RECEIPT_LIFETIME_THRESHOLD: u32 = RECEIPT_BUMP_AMOUNT - 100;
/// Version of the public event payload schema. Increment only for a breaking
/// event shape or semantic change; this is independent from `Receipt::version`.
const EVENT_SCHEMA_VERSION: u32 = 1;

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
    /// Pseudonymous technical issuer account. It must never be derived from clinical identity.
    pub issuer: Address,
    pub state: ReceiptState,
    pub version: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
struct OperationRecord {
    actor: Address,
    domain: OperationDomain,
    receipt_id: BytesN<32>,
    expected_version: u32,
    resulting_version: u32,
    target_state: ReceiptState,
    commitment: BytesN<32>,
    issuer: Address,
    grantee: Option<Address>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
enum OperationDomain {
    Issue = 1,
    Activate = 2,
    Partial = 3,
    Dispense = 4,
    Revoke = 5,
    Expire = 6,
    Grant = 7,
    RevokeGrant = 8,
}

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Admin,
    Doctor(Address),
    Dispensary(Address),
    Receipt(BytesN<32>),
    Operation(BytesN<32>),
    Grant(BytesN<32>, Address),
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
    pub schema_version: u32,
    pub receipt_id: BytesN<32>,
    pub version: u32,
    pub commitment: BytesN<32>,
    pub operation_id: BytesN<32>,
    pub actor: Address,
}

#[contractevent(topics = ["Active"], data_format = "vec")]
pub struct ActiveEvent {
    pub schema_version: u32,
    pub receipt_id: BytesN<32>,
    pub version: u32,
    pub commitment: BytesN<32>,
    pub operation_id: BytesN<32>,
    pub actor: Address,
}

#[contractevent(topics = ["Partial"], data_format = "vec")]
pub struct PartialEvent {
    pub schema_version: u32,
    pub receipt_id: BytesN<32>,
    pub version: u32,
    pub commitment: BytesN<32>,
    pub operation_id: BytesN<32>,
    pub actor: Address,
}

#[contractevent(topics = ["Dispensed"], data_format = "vec")]
pub struct DispensedEvent {
    pub schema_version: u32,
    pub receipt_id: BytesN<32>,
    pub version: u32,
    pub commitment: BytesN<32>,
    pub operation_id: BytesN<32>,
    pub actor: Address,
}

#[contractevent(topics = ["Revoked"], data_format = "vec")]
pub struct RevokedEvent {
    pub schema_version: u32,
    pub receipt_id: BytesN<32>,
    pub version: u32,
    pub commitment: BytesN<32>,
    pub operation_id: BytesN<32>,
    pub actor: Address,
}

#[contractevent(topics = ["Expired"], data_format = "vec")]
pub struct ExpiredEvent {
    pub schema_version: u32,
    pub receipt_id: BytesN<32>,
    pub version: u32,
    pub commitment: BytesN<32>,
    pub operation_id: BytesN<32>,
    pub actor: Address,
}

#[contractevent(topics = ["GrantChanged"], data_format = "vec")]
pub struct GrantChangedEvent {
    pub schema_version: u32,
    pub receipt_id: BytesN<32>,
    pub dispensary: Address,
    pub enabled: bool,
    pub operation_id: BytesN<32>,
    pub actor: Address,
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
            actor: doctor.clone(),
            domain: OperationDomain::Issue,
            receipt_id: receipt_id.clone(),
            expected_version: 0,
            resulting_version: 1,
            target_state: ReceiptState::Issued,
            commitment: commitment.clone(),
            issuer: doctor.clone(),
            grantee: None,
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
            issuer: doctor.clone(),
            state: ReceiptState::Issued,
            version: 1,
        };
        save_receipt_and_operation(&env, &receipt, &operation_id, &requested);
        IssuedEvent {
            schema_version: EVENT_SCHEMA_VERSION,
            receipt_id,
            version: 1,
            commitment,
            operation_id,
            actor: doctor,
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
        transition(
            &env,
            doctor,
            OperationDomain::Activate,
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
        transition(
            &env,
            dispensary,
            OperationDomain::Partial,
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
        transition(
            &env,
            dispensary,
            OperationDomain::Dispense,
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
        transition(
            &env,
            doctor,
            OperationDomain::Revoke,
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
        actor: Address,
        receipt_id: BytesN<32>,
        expected_version: u32,
        commitment: BytesN<32>,
        operation_id: BytesN<32>,
    ) -> Receipt {
        transition(
            &env,
            actor,
            OperationDomain::Expire,
            receipt_id,
            expected_version,
            commitment,
            operation_id,
            ReceiptState::Expired,
        )
    }

    pub fn set_grant(
        env: Env,
        actor: Address,
        receipt_id: BytesN<32>,
        dispensary: Address,
        enabled: bool,
        operation_id: BytesN<32>,
    ) -> Receipt {
        let receipt = load_receipt(&env, &receipt_id);
        require_controller(&env, &actor, &receipt.issuer);
        let domain = if enabled {
            OperationDomain::Grant
        } else {
            OperationDomain::RevokeGrant
        };
        if let Some(existing) = load_operation(&env, &operation_id) {
            if existing.actor != actor
                || existing.domain != domain
                || existing.receipt_id != receipt_id
                || existing.issuer != receipt.issuer
                || existing.grantee != Some(dispensary)
            {
                panic_with_error!(&env, ReceiptError::OperationConflict);
            }
            return receipt_from_operation(existing);
        }
        let grantee = dispensary.clone();
        if enabled && !is_enabled_dispensary(&env, &grantee) {
            panic_with_error!(&env, ReceiptError::Unauthorized);
        }

        let requested = OperationRecord {
            actor: actor.clone(),
            domain,
            receipt_id: receipt_id.clone(),
            expected_version: receipt.version,
            resulting_version: receipt.version,
            target_state: receipt.state,
            commitment: receipt.commitment.clone(),
            issuer: receipt.issuer.clone(),
            grantee: Some(grantee),
        };

        let grant_key = DataKey::Grant(receipt_id.clone(), dispensary.clone());
        env.storage().persistent().set(&grant_key, &enabled);
        env.storage().persistent().extend_ttl(
            &grant_key,
            RECEIPT_LIFETIME_THRESHOLD,
            RECEIPT_BUMP_AMOUNT,
        );
        save_operation(&env, &operation_id, &requested);
        GrantChangedEvent {
            schema_version: EVENT_SCHEMA_VERSION,
            receipt_id,
            dispensary,
            enabled,
            operation_id,
            actor,
        }
        .publish(&env);
        receipt
    }

    pub fn get_receipt(env: Env, receipt_id: BytesN<32>) -> Receipt {
        load_receipt(&env, &receipt_id)
    }
}

fn transition(
    env: &Env,
    actor: Address,
    domain: OperationDomain,
    receipt_id: BytesN<32>,
    expected_version: u32,
    commitment: BytesN<32>,
    operation_id: BytesN<32>,
    target_state: ReceiptState,
) -> Receipt {
    let current = load_receipt(env, &receipt_id);
    match domain {
        OperationDomain::Activate | OperationDomain::Revoke | OperationDomain::Expire => {
            require_controller(env, &actor, &current.issuer)
        }
        OperationDomain::Partial | OperationDomain::Dispense => {
            require_granted_dispensary(env, &actor, &receipt_id)
        }
        OperationDomain::Issue | OperationDomain::Grant | OperationDomain::RevokeGrant => {
            panic_with_error!(env, ReceiptError::InvalidTransition)
        }
    }
    if expected_version == u32::MAX {
        panic_with_error!(env, ReceiptError::VersionConflict);
    }
    let resulting_version = expected_version.saturating_add(1);
    let requested = OperationRecord {
        actor: actor.clone(),
        domain,
        receipt_id: receipt_id.clone(),
        expected_version,
        resulting_version,
        target_state,
        commitment: commitment.clone(),
        issuer: current.issuer.clone(),
        grantee: None,
    };
    if let Some(existing) = load_operation(env, &operation_id) {
        return replay_or_reject(env, existing, requested);
    }

    if current.version != expected_version {
        panic_with_error!(env, ReceiptError::VersionConflict);
    }
    if !is_transition_allowed(current.state, target_state) {
        panic_with_error!(env, ReceiptError::InvalidTransition);
    }

    let updated = Receipt {
        receipt_id: receipt_id.clone(),
        commitment: commitment.clone(),
        issuer: current.issuer,
        state: target_state,
        version: resulting_version,
    };
    save_receipt_and_operation(env, &updated, &operation_id, &requested);
    publish_transition(
        env,
        target_state,
        receipt_id,
        resulting_version,
        commitment,
        operation_id,
        actor,
    );
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
    operation_id: BytesN<32>,
    actor: Address,
) {
    match state {
        ReceiptState::Active => ActiveEvent {
            schema_version: EVENT_SCHEMA_VERSION,
            receipt_id,
            version,
            commitment,
            operation_id,
            actor,
        }
        .publish(env),
        ReceiptState::Partial => PartialEvent {
            schema_version: EVENT_SCHEMA_VERSION,
            receipt_id,
            version,
            commitment,
            operation_id,
            actor,
        }
        .publish(env),
        ReceiptState::Dispensed => DispensedEvent {
            schema_version: EVENT_SCHEMA_VERSION,
            receipt_id,
            version,
            commitment,
            operation_id,
            actor,
        }
        .publish(env),
        ReceiptState::Revoked => RevokedEvent {
            schema_version: EVENT_SCHEMA_VERSION,
            receipt_id,
            version,
            commitment,
            operation_id,
            actor,
        }
        .publish(env),
        ReceiptState::Expired => ExpiredEvent {
            schema_version: EVENT_SCHEMA_VERSION,
            receipt_id,
            version,
            commitment,
            operation_id,
            actor,
        }
        .publish(env),
        ReceiptState::Issued => panic_with_error!(env, ReceiptError::InvalidTransition),
    }
}

fn replay_or_reject(env: &Env, existing: OperationRecord, requested: OperationRecord) -> Receipt {
    if existing != requested {
        panic_with_error!(env, ReceiptError::OperationConflict);
    }
    receipt_from_operation(existing)
}

fn receipt_from_operation(existing: OperationRecord) -> Receipt {
    Receipt {
        receipt_id: existing.receipt_id,
        commitment: existing.commitment,
        issuer: existing.issuer,
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
    env.storage().persistent().set(&receipt_key, receipt);
    env.storage().persistent().extend_ttl(
        &receipt_key,
        RECEIPT_LIFETIME_THRESHOLD,
        RECEIPT_BUMP_AMOUNT,
    );
    save_operation(env, operation_id, operation);
    extend_instance_ttl(env);
}

fn save_operation(env: &Env, operation_id: &BytesN<32>, operation: &OperationRecord) {
    let operation_key = DataKey::Operation(operation_id.clone());
    env.storage().persistent().set(&operation_key, operation);
    env.storage().persistent().extend_ttl(
        &operation_key,
        RECEIPT_LIFETIME_THRESHOLD,
        RECEIPT_BUMP_AMOUNT,
    );
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

fn is_enabled_dispensary(env: &Env, account: &Address) -> bool {
    env.storage()
        .persistent()
        .get(&DataKey::Dispensary(account.clone()))
        .unwrap_or(false)
}

fn require_controller(env: &Env, actor: &Address, issuer: &Address) {
    actor.require_auth();
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| panic_with_error!(env, ReceiptError::NotInitialized));
    if *actor == admin {
        return;
    }
    if *actor != *issuer
        || !env
            .storage()
            .persistent()
            .get(&DataKey::Doctor(actor.clone()))
            .unwrap_or(false)
    {
        panic_with_error!(env, ReceiptError::Unauthorized);
    }
}

fn require_granted_dispensary(env: &Env, account: &Address, receipt_id: &BytesN<32>) {
    require_dispensary(env, account);
    if !env
        .storage()
        .persistent()
        .get(&DataKey::Grant(receipt_id.clone(), account.clone()))
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
