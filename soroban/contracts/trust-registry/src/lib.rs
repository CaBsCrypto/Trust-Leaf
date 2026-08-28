#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    BytesN, Env,
};

const INSTANCE_BUMP_AMOUNT: u32 = 30 * 17_280;
const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - 100;
const CREDENTIAL_BUMP_AMOUNT: u32 = 180 * 17_280;
const CREDENTIAL_LIFETIME_THRESHOLD: u32 = CREDENTIAL_BUMP_AMOUNT - 100;
const EVENT_SCHEMA_VERSION: u32 = 1;

#[contract]
pub struct TrustRegistryContract;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub enum CredentialKind {
    Doctor = 1,
    Dispensary = 2,
    PatientEligibility = 3,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub enum CredentialState {
    Active = 1,
    Suspended = 2,
    Revoked = 3,
    Expired = 4,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Credential {
    /// Random high-entropy identifier. It must not encode a person or clinical record.
    pub credential_id: BytesN<32>,
    /// Technical signer for this credential. Patient addresses are never stored.
    pub controller: Address,
    /// Admin for actor credentials, doctor for patient eligibility credentials.
    pub issuer: Address,
    /// Doctor credential authorizing a patient eligibility; self for actor credentials.
    pub authority_credential_id: BytesN<32>,
    pub kind: CredentialKind,
    pub state: CredentialState,
    /// Technical Unix expiry. The private system must avoid clinical meaning in this value.
    pub expires_at: u64,
    pub version: u32,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
enum OperationDomain {
    IssueActor = 1,
    IssueEligibility = 2,
    SetState = 3,
    Renew = 4,
    Expire = 5,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
struct OperationRecord {
    actor: Address,
    domain: OperationDomain,
    credential_id: BytesN<32>,
    expected_version: u32,
    parameter_u32: u32,
    parameter_u64: u64,
    parameter_address: Option<Address>,
    parameter_credential_id: Option<BytesN<32>>,
    result: Credential,
}

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Admin,
    Credential(BytesN<32>),
    Operation(BytesN<32>),
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
#[repr(u32)]
pub enum TrustRegistryError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    CredentialMissing = 4,
    CredentialAlreadyExists = 5,
    VersionConflict = 6,
    InvalidState = 7,
    OperationConflict = 8,
    InvalidExpiry = 9,
    InvalidKind = 10,
    CredentialInactive = 11,
}

#[contractevent(topics = ["CredentialIssued"], data_format = "vec")]
pub struct CredentialIssuedEvent {
    pub schema_version: u32,
    pub credential_id: BytesN<32>,
    pub kind: CredentialKind,
    pub state: CredentialState,
    pub version: u32,
    pub expires_at: u64,
    pub operation_id: BytesN<32>,
    pub actor: Address,
}

#[contractevent(topics = ["CredentialChanged"], data_format = "vec")]
pub struct CredentialChangedEvent {
    pub schema_version: u32,
    pub credential_id: BytesN<32>,
    pub kind: CredentialKind,
    pub state: CredentialState,
    pub version: u32,
    pub expires_at: u64,
    pub operation_id: BytesN<32>,
    pub actor: Address,
}

#[contractimpl]
impl TrustRegistryContract {
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, TrustRegistryError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        extend_instance_ttl(&env);
    }

    /// Admin issues opaque doctor or dispensary credentials only.
    pub fn issue_actor(
        env: Env,
        admin: Address,
        credential_id: BytesN<32>,
        controller: Address,
        kind: CredentialKind,
        expires_at: u64,
        operation_id: BytesN<32>,
    ) -> Credential {
        require_admin(&env, &admin);
        let request = OperationRecord {
            actor: admin.clone(),
            domain: OperationDomain::IssueActor,
            credential_id: credential_id.clone(),
            expected_version: 0,
            parameter_u32: kind as u32,
            parameter_u64: expires_at,
            parameter_address: Some(controller.clone()),
            parameter_credential_id: None,
            result: Credential {
                credential_id: credential_id.clone(),
                controller: controller.clone(),
                issuer: admin.clone(),
                authority_credential_id: credential_id.clone(),
                kind,
                state: CredentialState::Active,
                expires_at,
                version: 1,
            },
        };
        if let Some(existing) = load_operation(&env, &operation_id) {
            return replay_or_reject(&env, existing, request);
        }
        if kind == CredentialKind::PatientEligibility {
            panic_with_error!(&env, TrustRegistryError::InvalidKind);
        }
        require_future_expiry(&env, expires_at);
        issue_or_replay(&env, operation_id, request)
    }

    /// A currently active doctor issues an opaque patient eligibility reference.
    /// No patient address or clinical content is accepted by this ABI.
    pub fn issue_eligibility(
        env: Env,
        doctor: Address,
        doctor_credential_id: BytesN<32>,
        credential_id: BytesN<32>,
        expires_at: u64,
        operation_id: BytesN<32>,
    ) -> Credential {
        doctor.require_auth();
        let request = OperationRecord {
            actor: doctor.clone(),
            domain: OperationDomain::IssueEligibility,
            credential_id: credential_id.clone(),
            expected_version: 0,
            parameter_u32: CredentialKind::PatientEligibility as u32,
            parameter_u64: expires_at,
            parameter_address: None,
            parameter_credential_id: Some(doctor_credential_id.clone()),
            result: Credential {
                credential_id: credential_id.clone(),
                controller: doctor.clone(),
                issuer: doctor.clone(),
                authority_credential_id: doctor_credential_id.clone(),
                kind: CredentialKind::PatientEligibility,
                state: CredentialState::Active,
                expires_at,
                version: 1,
            },
        };
        if let Some(existing) = load_operation(&env, &operation_id) {
            return replay_or_reject(&env, existing, request);
        }
        require_active_internal(&env, &doctor_credential_id, &doctor, CredentialKind::Doctor);
        require_future_expiry(&env, expires_at);
        issue_or_replay(&env, operation_id, request)
    }

    pub fn set_state(
        env: Env,
        actor: Address,
        credential_id: BytesN<32>,
        expected_version: u32,
        target_state: CredentialState,
        operation_id: BytesN<32>,
    ) -> Credential {
        actor.require_auth();
        if target_state == CredentialState::Expired {
            panic_with_error!(&env, TrustRegistryError::InvalidState);
        }
        let replay_request = OperationRecord {
            actor: actor.clone(),
            domain: OperationDomain::SetState,
            credential_id: credential_id.clone(),
            expected_version,
            parameter_u32: target_state as u32,
            parameter_u64: 0,
            parameter_address: None,
            parameter_credential_id: None,
            result: placeholder_result(&credential_id, &actor),
        };
        if let Some(existing) = load_operation(&env, &operation_id) {
            return replay_or_reject(&env, existing, replay_request);
        }

        let current = load_credential(&env, &credential_id);
        require_credential_manager(
            &env,
            &actor,
            &current,
            target_state == CredentialState::Revoked,
        );
        if current.version != expected_version || expected_version == u32::MAX {
            panic_with_error!(&env, TrustRegistryError::VersionConflict);
        }
        if !is_state_transition_allowed(current.state, target_state) {
            panic_with_error!(&env, TrustRegistryError::InvalidState);
        }
        if target_state == CredentialState::Active {
            require_future_expiry(&env, current.expires_at);
            require_authority_active(&env, &current);
        }
        let updated = Credential {
            state: target_state,
            version: expected_version + 1,
            ..current
        };
        let stored = OperationRecord {
            result: updated.clone(),
            ..replay_request
        };
        save_credential_and_operation(&env, &updated, &operation_id, &stored);
        publish_changed(&env, &updated, operation_id, actor);
        updated
    }

    pub fn renew(
        env: Env,
        actor: Address,
        credential_id: BytesN<32>,
        expected_version: u32,
        new_expires_at: u64,
        operation_id: BytesN<32>,
    ) -> Credential {
        actor.require_auth();
        let replay_request = OperationRecord {
            actor: actor.clone(),
            domain: OperationDomain::Renew,
            credential_id: credential_id.clone(),
            expected_version,
            parameter_u32: 0,
            parameter_u64: new_expires_at,
            parameter_address: None,
            parameter_credential_id: None,
            result: placeholder_result(&credential_id, &actor),
        };
        if let Some(existing) = load_operation(&env, &operation_id) {
            return replay_or_reject(&env, existing, replay_request);
        }
        let current = load_credential(&env, &credential_id);
        require_credential_manager(&env, &actor, &current, false);
        require_authority_active(&env, &current);
        if current.version != expected_version || expected_version == u32::MAX {
            panic_with_error!(&env, TrustRegistryError::VersionConflict);
        }
        if current.state == CredentialState::Revoked || current.state == CredentialState::Expired {
            panic_with_error!(&env, TrustRegistryError::InvalidState);
        }
        if env.ledger().timestamp() >= current.expires_at {
            panic_with_error!(&env, TrustRegistryError::InvalidExpiry);
        }
        require_future_expiry(&env, new_expires_at);
        if new_expires_at <= current.expires_at {
            panic_with_error!(&env, TrustRegistryError::InvalidExpiry);
        }
        let updated = Credential {
            expires_at: new_expires_at,
            version: expected_version + 1,
            ..current
        };
        let stored = OperationRecord {
            result: updated.clone(),
            ..replay_request
        };
        save_credential_and_operation(&env, &updated, &operation_id, &stored);
        publish_changed(&env, &updated, operation_id, actor);
        updated
    }

    /// Materializes an already elapsed expiry. Derived `is_active` fails closed even before this call.
    pub fn expire(
        env: Env,
        actor: Address,
        credential_id: BytesN<32>,
        expected_version: u32,
        operation_id: BytesN<32>,
    ) -> Credential {
        actor.require_auth();
        let replay_request = OperationRecord {
            actor: actor.clone(),
            domain: OperationDomain::Expire,
            credential_id: credential_id.clone(),
            expected_version,
            parameter_u32: 0,
            parameter_u64: 0,
            parameter_address: None,
            parameter_credential_id: None,
            result: placeholder_result(&credential_id, &actor),
        };
        if let Some(existing) = load_operation(&env, &operation_id) {
            return replay_or_reject(&env, existing, replay_request);
        }
        let current = load_credential(&env, &credential_id);
        require_credential_manager(&env, &actor, &current, true);
        if current.version != expected_version || expected_version == u32::MAX {
            panic_with_error!(&env, TrustRegistryError::VersionConflict);
        }
        if current.state == CredentialState::Revoked || current.state == CredentialState::Expired {
            panic_with_error!(&env, TrustRegistryError::InvalidState);
        }
        if env.ledger().timestamp() < current.expires_at {
            panic_with_error!(&env, TrustRegistryError::InvalidExpiry);
        }
        let updated = Credential {
            state: CredentialState::Expired,
            version: expected_version + 1,
            ..current
        };
        let stored = OperationRecord {
            result: updated.clone(),
            ..replay_request
        };
        save_credential_and_operation(&env, &updated, &operation_id, &stored);
        publish_changed(&env, &updated, operation_id, actor);
        updated
    }

    pub fn get_credential(env: Env, credential_id: BytesN<32>) -> Credential {
        load_credential(&env, &credential_id)
    }

    /// Fail-closed primitive consumed cross-contract by ReceiptLedgerV2.
    pub fn is_active(env: Env, credential_id: BytesN<32>, controller: Address, kind: u32) -> bool {
        let expected_kind = match kind {
            1 => CredentialKind::Doctor,
            2 => CredentialKind::Dispensary,
            3 => CredentialKind::PatientEligibility,
            _ => return false,
        };
        is_active_internal(&env, &credential_id, &controller, expected_kind)
    }

    pub fn get_admin(env: Env) -> Address {
        extend_instance_ttl(&env);
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, TrustRegistryError::NotInitialized))
    }
}

fn issue_or_replay(env: &Env, operation_id: BytesN<32>, request: OperationRecord) -> Credential {
    if let Some(existing) = load_operation(env, &operation_id) {
        return replay_or_reject(env, existing, request);
    }
    if env
        .storage()
        .persistent()
        .has(&DataKey::Credential(request.credential_id.clone()))
    {
        panic_with_error!(env, TrustRegistryError::CredentialAlreadyExists);
    }
    let result = request.result.clone();
    save_credential_and_operation(env, &result, &operation_id, &request);
    CredentialIssuedEvent {
        schema_version: EVENT_SCHEMA_VERSION,
        credential_id: result.credential_id.clone(),
        kind: result.kind,
        state: result.state,
        version: result.version,
        expires_at: result.expires_at,
        operation_id,
        actor: request.actor,
    }
    .publish(env);
    result
}

fn placeholder_result(credential_id: &BytesN<32>, actor: &Address) -> Credential {
    Credential {
        credential_id: credential_id.clone(),
        controller: actor.clone(),
        issuer: actor.clone(),
        authority_credential_id: credential_id.clone(),
        kind: CredentialKind::Doctor,
        state: CredentialState::Active,
        expires_at: 0,
        version: 0,
    }
}

fn replay_or_reject(
    env: &Env,
    existing: OperationRecord,
    requested: OperationRecord,
) -> Credential {
    if existing.actor != requested.actor
        || existing.domain != requested.domain
        || existing.credential_id != requested.credential_id
        || existing.expected_version != requested.expected_version
        || existing.parameter_u32 != requested.parameter_u32
        || existing.parameter_u64 != requested.parameter_u64
        || existing.parameter_address != requested.parameter_address
        || existing.parameter_credential_id != requested.parameter_credential_id
    {
        panic_with_error!(env, TrustRegistryError::OperationConflict);
    }
    existing.result
}

fn require_admin(env: &Env, admin: &Address) {
    admin.require_auth();
    let stored: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| panic_with_error!(env, TrustRegistryError::NotInitialized));
    if stored != *admin {
        panic_with_error!(env, TrustRegistryError::Unauthorized);
    }
}

fn require_credential_manager(
    env: &Env,
    actor: &Address,
    credential: &Credential,
    safety_only: bool,
) {
    match credential.kind {
        CredentialKind::Doctor | CredentialKind::Dispensary => {
            let admin: Address = env
                .storage()
                .instance()
                .get(&DataKey::Admin)
                .unwrap_or_else(|| panic_with_error!(env, TrustRegistryError::NotInitialized));
            if *actor != admin {
                panic_with_error!(env, TrustRegistryError::Unauthorized);
            }
        }
        CredentialKind::PatientEligibility => {
            if *actor != credential.issuer
                || (!safety_only
                    && !is_active_internal(
                        env,
                        &credential.authority_credential_id,
                        actor,
                        CredentialKind::Doctor,
                    ))
            {
                panic_with_error!(env, TrustRegistryError::Unauthorized);
            }
        }
    }
}

fn require_authority_active(env: &Env, credential: &Credential) {
    if credential.kind == CredentialKind::PatientEligibility {
        require_active_internal(
            env,
            &credential.authority_credential_id,
            &credential.issuer,
            CredentialKind::Doctor,
        );
    }
}

fn require_active_internal(
    env: &Env,
    credential_id: &BytesN<32>,
    controller: &Address,
    kind: CredentialKind,
) {
    if !is_active_internal(env, credential_id, controller, kind) {
        panic_with_error!(env, TrustRegistryError::CredentialInactive);
    }
}

fn is_active_internal(
    env: &Env,
    credential_id: &BytesN<32>,
    controller: &Address,
    kind: CredentialKind,
) -> bool {
    let key = DataKey::Credential(credential_id.clone());
    let credential: Option<Credential> = env.storage().persistent().get(&key);
    if credential.is_some() {
        env.storage().persistent().extend_ttl(
            &key,
            CREDENTIAL_LIFETIME_THRESHOLD,
            CREDENTIAL_BUMP_AMOUNT,
        );
    }
    credential
        .map(|item| {
            item.controller == *controller
                && item.kind == kind
                && item.state == CredentialState::Active
                && env.ledger().timestamp() < item.expires_at
        })
        .unwrap_or(false)
}

fn is_state_transition_allowed(from: CredentialState, to: CredentialState) -> bool {
    match to {
        CredentialState::Active => from == CredentialState::Suspended,
        CredentialState::Suspended => from == CredentialState::Active,
        CredentialState::Revoked => {
            from == CredentialState::Active || from == CredentialState::Suspended
        }
        CredentialState::Expired => false,
    }
}

fn require_future_expiry(env: &Env, expires_at: u64) {
    if expires_at <= env.ledger().timestamp() {
        panic_with_error!(env, TrustRegistryError::InvalidExpiry);
    }
}

fn publish_changed(env: &Env, credential: &Credential, operation_id: BytesN<32>, actor: Address) {
    CredentialChangedEvent {
        schema_version: EVENT_SCHEMA_VERSION,
        credential_id: credential.credential_id.clone(),
        kind: credential.kind,
        state: credential.state,
        version: credential.version,
        expires_at: credential.expires_at,
        operation_id,
        actor,
    }
    .publish(env);
}

fn save_credential_and_operation(
    env: &Env,
    credential: &Credential,
    operation_id: &BytesN<32>,
    operation: &OperationRecord,
) {
    let credential_key = DataKey::Credential(credential.credential_id.clone());
    env.storage().persistent().set(&credential_key, credential);
    env.storage().persistent().extend_ttl(
        &credential_key,
        CREDENTIAL_LIFETIME_THRESHOLD,
        CREDENTIAL_BUMP_AMOUNT,
    );
    let operation_key = DataKey::Operation(operation_id.clone());
    env.storage().persistent().set(&operation_key, operation);
    env.storage().persistent().extend_ttl(
        &operation_key,
        CREDENTIAL_LIFETIME_THRESHOLD,
        CREDENTIAL_BUMP_AMOUNT,
    );
    extend_instance_ttl(env);
}

fn load_credential(env: &Env, credential_id: &BytesN<32>) -> Credential {
    let key = DataKey::Credential(credential_id.clone());
    let item = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| panic_with_error!(env, TrustRegistryError::CredentialMissing));
    env.storage().persistent().extend_ttl(
        &key,
        CREDENTIAL_LIFETIME_THRESHOLD,
        CREDENTIAL_BUMP_AMOUNT,
    );
    item
}

fn load_operation(env: &Env, operation_id: &BytesN<32>) -> Option<OperationRecord> {
    let key = DataKey::Operation(operation_id.clone());
    let item = env.storage().persistent().get(&key);
    if item.is_some() {
        env.storage().persistent().extend_ttl(
            &key,
            CREDENTIAL_LIFETIME_THRESHOLD,
            CREDENTIAL_BUMP_AMOUNT,
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
