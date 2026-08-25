#![no_std]
#![allow(clippy::too_many_arguments)]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    BytesN, Env, IntoVal, Symbol,
};

const INSTANCE_BUMP_AMOUNT: u32 = 30 * 17_280;
const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - 100;
const RECEIPT_BUMP_AMOUNT: u32 = 180 * 17_280;
const RECEIPT_LIFETIME_THRESHOLD: u32 = RECEIPT_BUMP_AMOUNT - 100;
const EVENT_SCHEMA_VERSION: u32 = 2;
const DOCTOR_KIND: u32 = 1;
const DISPENSARY_KIND: u32 = 2;
const ELIGIBILITY_KIND: u32 = 3;

#[contract]
pub struct ReceiptLedgerV2Contract;

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
    pub receipt_id: BytesN<32>,
    pub commitment: BytesN<32>,
    pub issuer: Address,
    pub doctor_credential_id: BytesN<32>,
    pub eligibility_credential_id: BytesN<32>,
    pub state: ReceiptState,
    pub version: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct AuthorizationChain {
    pub registry: Address,
    pub doctor_credential_id: BytesN<32>,
    pub doctor_active: bool,
    pub eligibility_credential_id: BytesN<32>,
    pub eligibility_active: bool,
    pub dispensary_credential_id: Option<BytesN<32>>,
    pub dispensary_active: bool,
    pub grant_enabled: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
struct Grant {
    dispensary: Address,
    dispensary_credential_id: BytesN<32>,
    enabled: bool,
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

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
struct OperationRecord {
    actor: Address,
    actor_credential_id: Option<BytesN<32>>,
    domain: OperationDomain,
    receipt_id: BytesN<32>,
    expected_version: u32,
    commitment: BytesN<32>,
    eligibility_credential_id: Option<BytesN<32>>,
    grantee: Option<Address>,
    grantee_credential_id: Option<BytesN<32>>,
    enabled: bool,
    result: Receipt,
}

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Admin,
    Registry,
    Receipt(BytesN<32>),
    Operation(BytesN<32>),
    Grant(BytesN<32>, Address),
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
#[repr(u32)]
pub enum ReceiptV2Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    ReceiptMissing = 4,
    ReceiptAlreadyExists = 5,
    VersionConflict = 6,
    InvalidTransition = 7,
    OperationConflict = 8,
    CredentialInactive = 9,
    GrantMissing = 10,
}

#[contractevent(topics = ["ReceiptChanged"], data_format = "vec")]
pub struct ReceiptChangedEvent {
    pub schema_version: u32,
    pub receipt_id: BytesN<32>,
    pub state: ReceiptState,
    pub version: u32,
    pub commitment: BytesN<32>,
    pub doctor_credential_id: BytesN<32>,
    pub eligibility_credential_id: BytesN<32>,
    pub operation_id: BytesN<32>,
    pub actor: Address,
}

#[contractevent(topics = ["GrantChanged"], data_format = "vec")]
pub struct GrantChangedEvent {
    pub schema_version: u32,
    pub receipt_id: BytesN<32>,
    pub dispensary_credential_id: BytesN<32>,
    pub enabled: bool,
    pub operation_id: BytesN<32>,
    pub actor: Address,
}

#[contractimpl]
impl ReceiptLedgerV2Contract {
    pub fn init(env: Env, admin: Address, registry: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, ReceiptV2Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Registry, &registry);
        extend_instance_ttl(&env);
    }

    pub fn issue(
        env: Env,
        doctor: Address,
        doctor_credential_id: BytesN<32>,
        eligibility_credential_id: BytesN<32>,
        receipt_id: BytesN<32>,
        commitment: BytesN<32>,
        operation_id: BytesN<32>,
    ) -> Receipt {
        doctor.require_auth();
        let result = Receipt {
            receipt_id: receipt_id.clone(),
            commitment: commitment.clone(),
            issuer: doctor.clone(),
            doctor_credential_id: doctor_credential_id.clone(),
            eligibility_credential_id: eligibility_credential_id.clone(),
            state: ReceiptState::Issued,
            version: 1,
        };
        let request = OperationRecord {
            actor: doctor.clone(),
            actor_credential_id: Some(doctor_credential_id),
            domain: OperationDomain::Issue,
            receipt_id: receipt_id.clone(),
            expected_version: 0,
            commitment,
            eligibility_credential_id: Some(eligibility_credential_id),
            grantee: None,
            grantee_credential_id: None,
            enabled: false,
            result: result.clone(),
        };
        if let Some(existing) = load_operation(&env, &operation_id) {
            return replay_or_reject(&env, existing, request);
        }
        require_receipt_chain_active(&env, &result);
        if env
            .storage()
            .persistent()
            .has(&DataKey::Receipt(receipt_id))
        {
            panic_with_error!(&env, ReceiptV2Error::ReceiptAlreadyExists);
        }
        save_receipt_and_operation(&env, &result, &operation_id, &request);
        publish_receipt_changed(&env, &result, operation_id, doctor);
        result
    }

    pub fn activate(
        env: Env,
        doctor: Address,
        doctor_credential_id: BytesN<32>,
        receipt_id: BytesN<32>,
        expected_version: u32,
        commitment: BytesN<32>,
        operation_id: BytesN<32>,
    ) -> Receipt {
        transition(
            &env,
            doctor,
            doctor_credential_id,
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
        dispensary_credential_id: BytesN<32>,
        receipt_id: BytesN<32>,
        expected_version: u32,
        commitment: BytesN<32>,
        operation_id: BytesN<32>,
    ) -> Receipt {
        transition(
            &env,
            dispensary,
            dispensary_credential_id,
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
        dispensary_credential_id: BytesN<32>,
        receipt_id: BytesN<32>,
        expected_version: u32,
        commitment: BytesN<32>,
        operation_id: BytesN<32>,
    ) -> Receipt {
        transition(
            &env,
            dispensary,
            dispensary_credential_id,
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
        doctor_credential_id: BytesN<32>,
        receipt_id: BytesN<32>,
        expected_version: u32,
        commitment: BytesN<32>,
        operation_id: BytesN<32>,
    ) -> Receipt {
        transition(
            &env,
            doctor,
            doctor_credential_id,
            OperationDomain::Revoke,
            receipt_id,
            expected_version,
            commitment,
            operation_id,
            ReceiptState::Revoked,
        )
    }

    /// Safety terminal transition. Admin auth is required; inactive credentials cannot enable activity.
    pub fn expire(
        env: Env,
        admin: Address,
        receipt_id: BytesN<32>,
        expected_version: u32,
        commitment: BytesN<32>,
        operation_id: BytesN<32>,
    ) -> Receipt {
        require_admin(&env, &admin);
        transition_without_credentials(
            &env,
            admin,
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
        doctor: Address,
        doctor_credential_id: BytesN<32>,
        receipt_id: BytesN<32>,
        expected_version: u32,
        dispensary: Address,
        dispensary_credential_id: BytesN<32>,
        enabled: bool,
        operation_id: BytesN<32>,
    ) -> Receipt {
        doctor.require_auth();
        let receipt = load_receipt(&env, &receipt_id);
        let domain = if enabled {
            OperationDomain::Grant
        } else {
            OperationDomain::RevokeGrant
        };
        let request = OperationRecord {
            actor: doctor.clone(),
            actor_credential_id: Some(doctor_credential_id.clone()),
            domain,
            receipt_id: receipt_id.clone(),
            expected_version,
            commitment: receipt.commitment.clone(),
            eligibility_credential_id: Some(receipt.eligibility_credential_id.clone()),
            grantee: Some(dispensary.clone()),
            grantee_credential_id: Some(dispensary_credential_id.clone()),
            enabled,
            result: receipt.clone(),
        };
        if let Some(existing) = load_operation(&env, &operation_id) {
            return replay_or_reject(&env, existing, request);
        }
        if doctor != receipt.issuer || doctor_credential_id != receipt.doctor_credential_id {
            panic_with_error!(&env, ReceiptV2Error::Unauthorized);
        }
        if receipt.version != expected_version {
            panic_with_error!(&env, ReceiptV2Error::VersionConflict);
        }
        require_receipt_chain_active(&env, &receipt);
        require_active_credential(
            &env,
            &dispensary_credential_id,
            &dispensary,
            DISPENSARY_KIND,
        );
        let key = DataKey::Grant(receipt_id.clone(), dispensary.clone());
        let grant = Grant {
            dispensary,
            dispensary_credential_id: dispensary_credential_id.clone(),
            enabled,
        };
        env.storage().persistent().set(&key, &grant);
        env.storage().persistent().extend_ttl(
            &key,
            RECEIPT_LIFETIME_THRESHOLD,
            RECEIPT_BUMP_AMOUNT,
        );
        save_operation(&env, &operation_id, &request);
        GrantChangedEvent {
            schema_version: EVENT_SCHEMA_VERSION,
            receipt_id,
            dispensary_credential_id,
            enabled,
            operation_id,
            actor: doctor,
        }
        .publish(&env);
        receipt
    }

    pub fn get_receipt(env: Env, receipt_id: BytesN<32>) -> Receipt {
        load_receipt(&env, &receipt_id)
    }

    pub fn authorization_chain(
        env: Env,
        receipt_id: BytesN<32>,
        dispensary: Option<Address>,
    ) -> AuthorizationChain {
        let receipt = load_receipt(&env, &receipt_id);
        let doctor_active = is_active_credential(
            &env,
            &receipt.doctor_credential_id,
            &receipt.issuer,
            DOCTOR_KIND,
        );
        let eligibility_active = is_active_credential(
            &env,
            &receipt.eligibility_credential_id,
            &receipt.issuer,
            ELIGIBILITY_KIND,
        );
        let mut dispensary_credential_id = None;
        let mut dispensary_active = false;
        let mut grant_enabled = false;
        if let Some(account) = dispensary {
            if let Some(grant) = load_grant_optional(&env, &receipt_id, &account) {
                dispensary_active = is_active_credential(
                    &env,
                    &grant.dispensary_credential_id,
                    &account,
                    DISPENSARY_KIND,
                );
                grant_enabled = grant.enabled;
                dispensary_credential_id = Some(grant.dispensary_credential_id);
            }
        }
        AuthorizationChain {
            registry: registry_address(&env),
            doctor_credential_id: receipt.doctor_credential_id,
            doctor_active,
            eligibility_credential_id: receipt.eligibility_credential_id,
            eligibility_active,
            dispensary_credential_id,
            dispensary_active,
            grant_enabled,
        }
    }

    pub fn get_registry(env: Env) -> Address {
        registry_address(&env)
    }
}

fn transition(
    env: &Env,
    actor: Address,
    actor_credential_id: BytesN<32>,
    domain: OperationDomain,
    receipt_id: BytesN<32>,
    expected_version: u32,
    commitment: BytesN<32>,
    operation_id: BytesN<32>,
    target_state: ReceiptState,
) -> Receipt {
    actor.require_auth();
    let current = load_receipt(env, &receipt_id);
    let result = Receipt {
        commitment: commitment.clone(),
        state: target_state,
        version: expected_version.saturating_add(1),
        ..current.clone()
    };
    let request = OperationRecord {
        actor: actor.clone(),
        actor_credential_id: Some(actor_credential_id.clone()),
        domain,
        receipt_id: receipt_id.clone(),
        expected_version,
        commitment,
        eligibility_credential_id: Some(current.eligibility_credential_id.clone()),
        grantee: None,
        grantee_credential_id: None,
        enabled: false,
        result: result.clone(),
    };
    if let Some(existing) = load_operation(env, &operation_id) {
        return replay_or_reject(env, existing, request);
    }
    if current.version != expected_version || expected_version == u32::MAX {
        panic_with_error!(env, ReceiptV2Error::VersionConflict);
    }
    if !is_transition_allowed(current.state, target_state) {
        panic_with_error!(env, ReceiptV2Error::InvalidTransition);
    }
    require_receipt_chain_active(env, &current);
    match domain {
        OperationDomain::Activate | OperationDomain::Revoke => {
            if actor != current.issuer || actor_credential_id != current.doctor_credential_id {
                panic_with_error!(env, ReceiptV2Error::Unauthorized);
            }
        }
        OperationDomain::Partial | OperationDomain::Dispense => {
            require_granted_dispensary(env, &actor, &actor_credential_id, &receipt_id);
        }
        _ => panic_with_error!(env, ReceiptV2Error::InvalidTransition),
    }
    save_receipt_and_operation(env, &result, &operation_id, &request);
    publish_receipt_changed(env, &result, operation_id, actor);
    result
}

fn transition_without_credentials(
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
    let result = Receipt {
        commitment: commitment.clone(),
        state: target_state,
        version: expected_version.saturating_add(1),
        ..current.clone()
    };
    let request = OperationRecord {
        actor: actor.clone(),
        actor_credential_id: None,
        domain,
        receipt_id: receipt_id.clone(),
        expected_version,
        commitment,
        eligibility_credential_id: Some(current.eligibility_credential_id.clone()),
        grantee: None,
        grantee_credential_id: None,
        enabled: false,
        result: result.clone(),
    };
    if let Some(existing) = load_operation(env, &operation_id) {
        return replay_or_reject(env, existing, request);
    }
    if current.version != expected_version || expected_version == u32::MAX {
        panic_with_error!(env, ReceiptV2Error::VersionConflict);
    }
    if !is_transition_allowed(current.state, target_state) {
        panic_with_error!(env, ReceiptV2Error::InvalidTransition);
    }
    save_receipt_and_operation(env, &result, &operation_id, &request);
    publish_receipt_changed(env, &result, operation_id, actor);
    result
}

fn require_receipt_chain_active(env: &Env, receipt: &Receipt) {
    require_active_credential(
        env,
        &receipt.doctor_credential_id,
        &receipt.issuer,
        DOCTOR_KIND,
    );
    require_active_credential(
        env,
        &receipt.eligibility_credential_id,
        &receipt.issuer,
        ELIGIBILITY_KIND,
    );
}

fn require_active_credential(
    env: &Env,
    credential_id: &BytesN<32>,
    controller: &Address,
    kind: u32,
) {
    if !is_active_credential(env, credential_id, controller, kind) {
        panic_with_error!(env, ReceiptV2Error::CredentialInactive);
    }
}

fn is_active_credential(
    env: &Env,
    credential_id: &BytesN<32>,
    controller: &Address,
    kind: u32,
) -> bool {
    env.invoke_contract::<bool>(
        &registry_address(env),
        &Symbol::new(env, "is_active"),
        (credential_id.clone(), controller.clone(), kind).into_val(env),
    )
}

fn require_granted_dispensary(
    env: &Env,
    dispensary: &Address,
    credential_id: &BytesN<32>,
    receipt_id: &BytesN<32>,
) {
    require_active_credential(env, credential_id, dispensary, DISPENSARY_KIND);
    let grant = load_grant_optional(env, receipt_id, dispensary)
        .unwrap_or_else(|| panic_with_error!(env, ReceiptV2Error::GrantMissing));
    if !grant.enabled || grant.dispensary_credential_id != *credential_id {
        panic_with_error!(env, ReceiptV2Error::Unauthorized);
    }
}

fn is_transition_allowed(from: ReceiptState, to: ReceiptState) -> bool {
    match to {
        ReceiptState::Active => from == ReceiptState::Issued,
        ReceiptState::Partial => from == ReceiptState::Active || from == ReceiptState::Partial,
        ReceiptState::Dispensed => from == ReceiptState::Active || from == ReceiptState::Partial,
        ReceiptState::Revoked | ReceiptState::Expired => {
            from == ReceiptState::Issued
                || from == ReceiptState::Active
                || from == ReceiptState::Partial
        }
        ReceiptState::Issued => false,
    }
}

fn replay_or_reject(env: &Env, existing: OperationRecord, requested: OperationRecord) -> Receipt {
    let commitment_must_match = requested.domain != OperationDomain::Grant
        && requested.domain != OperationDomain::RevokeGrant;
    let eligibility_must_match = requested.domain == OperationDomain::Issue;
    if existing.actor != requested.actor
        || existing.actor_credential_id != requested.actor_credential_id
        || existing.domain != requested.domain
        || existing.receipt_id != requested.receipt_id
        || existing.expected_version != requested.expected_version
        || (commitment_must_match && existing.commitment != requested.commitment)
        || (eligibility_must_match
            && existing.eligibility_credential_id != requested.eligibility_credential_id)
        || existing.grantee != requested.grantee
        || existing.grantee_credential_id != requested.grantee_credential_id
        || existing.enabled != requested.enabled
    {
        panic_with_error!(env, ReceiptV2Error::OperationConflict);
    }
    existing.result
}

fn require_admin(env: &Env, admin: &Address) {
    admin.require_auth();
    let stored: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| panic_with_error!(env, ReceiptV2Error::NotInitialized));
    if stored != *admin {
        panic_with_error!(env, ReceiptV2Error::Unauthorized);
    }
}

fn registry_address(env: &Env) -> Address {
    extend_instance_ttl(env);
    env.storage()
        .instance()
        .get(&DataKey::Registry)
        .unwrap_or_else(|| panic_with_error!(env, ReceiptV2Error::NotInitialized))
}

fn publish_receipt_changed(env: &Env, receipt: &Receipt, operation_id: BytesN<32>, actor: Address) {
    ReceiptChangedEvent {
        schema_version: EVENT_SCHEMA_VERSION,
        receipt_id: receipt.receipt_id.clone(),
        state: receipt.state,
        version: receipt.version,
        commitment: receipt.commitment.clone(),
        doctor_credential_id: receipt.doctor_credential_id.clone(),
        eligibility_credential_id: receipt.eligibility_credential_id.clone(),
        operation_id,
        actor,
    }
    .publish(env);
}

fn save_receipt_and_operation(
    env: &Env,
    receipt: &Receipt,
    operation_id: &BytesN<32>,
    operation: &OperationRecord,
) {
    let key = DataKey::Receipt(receipt.receipt_id.clone());
    env.storage().persistent().set(&key, receipt);
    env.storage()
        .persistent()
        .extend_ttl(&key, RECEIPT_LIFETIME_THRESHOLD, RECEIPT_BUMP_AMOUNT);
    save_operation(env, operation_id, operation);
    extend_instance_ttl(env);
}

fn save_operation(env: &Env, operation_id: &BytesN<32>, operation: &OperationRecord) {
    let key = DataKey::Operation(operation_id.clone());
    env.storage().persistent().set(&key, operation);
    env.storage()
        .persistent()
        .extend_ttl(&key, RECEIPT_LIFETIME_THRESHOLD, RECEIPT_BUMP_AMOUNT);
}

fn load_receipt(env: &Env, receipt_id: &BytesN<32>) -> Receipt {
    let key = DataKey::Receipt(receipt_id.clone());
    let receipt = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| panic_with_error!(env, ReceiptV2Error::ReceiptMissing));
    env.storage()
        .persistent()
        .extend_ttl(&key, RECEIPT_LIFETIME_THRESHOLD, RECEIPT_BUMP_AMOUNT);
    receipt
}

fn load_operation(env: &Env, operation_id: &BytesN<32>) -> Option<OperationRecord> {
    let key = DataKey::Operation(operation_id.clone());
    let item = env.storage().persistent().get(&key);
    if item.is_some() {
        env.storage().persistent().extend_ttl(
            &key,
            RECEIPT_LIFETIME_THRESHOLD,
            RECEIPT_BUMP_AMOUNT,
        );
    }
    item
}

fn load_grant_optional(env: &Env, receipt_id: &BytesN<32>, dispensary: &Address) -> Option<Grant> {
    let key = DataKey::Grant(receipt_id.clone(), dispensary.clone());
    let item = env.storage().persistent().get(&key);
    if item.is_some() {
        env.storage().persistent().extend_ttl(
            &key,
            RECEIPT_LIFETIME_THRESHOLD,
            RECEIPT_BUMP_AMOUNT,
        );
    }
    item
}

fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

mod test;
