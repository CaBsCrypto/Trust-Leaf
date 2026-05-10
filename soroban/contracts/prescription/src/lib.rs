#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, BytesN, Env,
    IntoVal, Symbol,
};

const INSTANCE_BUMP_AMOUNT: u32 = 30 * 17280;
const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - 100;

#[contract]
pub struct PrescriptionContract;

#[derive(Clone)]
#[contracttype]
pub struct Prescription {
    pub id: u64,
    pub patient: Address,
    pub doctor: Address,
    pub medication_hash: BytesN<32>,
    pub issued_at: u64,
    pub expires_at: u64,
    pub is_used: bool,
}

#[derive(Clone)]
#[contracttype]
enum DataKey {
    DoctorRegistry,
    DispensaryRegistry,
    NextId,
    Prescription(u64),
}

#[derive(Copy, Clone, Eq, PartialEq)]
#[contracterror]
#[repr(u32)]
pub enum PrescriptionError {
    AlreadyInitialized = 1,
    UnauthorizedDoctor = 2,
    UnauthorizedDispensary = 3,
    PrescriptionMissing = 4,
    PrescriptionAlreadyUsed = 5,
    PrescriptionExpired = 6,
}

#[contractimpl]
impl PrescriptionContract {
    pub fn init(env: Env, doctor_registry: Address, dispensary_registry: Address) {
        if env.storage().instance().has(&DataKey::DoctorRegistry) {
            panic_with_error!(&env, PrescriptionError::AlreadyInitialized);
        }

        env.storage()
            .instance()
            .set(&DataKey::DoctorRegistry, &doctor_registry);
        env.storage()
            .instance()
            .set(&DataKey::DispensaryRegistry, &dispensary_registry);
        env.storage().instance().set(&DataKey::NextId, &0_u64);
        extend_instance_ttl(&env);
    }

    pub fn issue_prescription(
        env: Env,
        doctor: Address,
        patient: Address,
        medication_hash: BytesN<32>,
        duration: u64,
    ) -> u64 {
        doctor.require_auth();

        if !is_authorized_doctor(&env, &doctor) {
            panic_with_error!(&env, PrescriptionError::UnauthorizedDoctor);
        }

        let id = next_id(&env);
        let issued_at = env.ledger().timestamp();
        let expires_at = env.ledger().timestamp().saturating_add(duration);
        let prescription = Prescription {
            id,
            patient: patient.clone(),
            doctor: doctor.clone(),
            medication_hash,
            issued_at,
            expires_at,
            is_used: false,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Prescription(id), &prescription);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        extend_instance_ttl(&env);

        env.events()
            .publish(("PrescriptionIssued",), (id, patient, doctor));

        id
    }

    pub fn consume_prescription(env: Env, dispensary: Address, prescription_id: u64) {
        dispensary.require_auth();

        if !is_authorized_dispensary(&env, &dispensary) {
            panic_with_error!(&env, PrescriptionError::UnauthorizedDispensary);
        }

        let mut prescription = get_prescription_internal(&env, prescription_id);
        if prescription.is_used {
            panic_with_error!(&env, PrescriptionError::PrescriptionAlreadyUsed);
        }
        if env.ledger().timestamp() >= prescription.expires_at {
            panic_with_error!(&env, PrescriptionError::PrescriptionExpired);
        }

        prescription.is_used = true;
        env.storage()
            .persistent()
            .set(&DataKey::Prescription(prescription_id), &prescription);
        extend_instance_ttl(&env);

        env.events()
            .publish(("PrescriptionConsumed",), (prescription_id, dispensary));
    }

    pub fn get_prescription(env: Env, id: u64) -> Prescription {
        get_prescription_internal(&env, id)
    }

    pub fn is_valid(env: Env, id: u64) -> bool {
        let prescription = get_prescription_internal(&env, id);
        !prescription.is_used && env.ledger().timestamp() < prescription.expires_at
    }

    pub fn get_doctor_registry(env: Env) -> Address {
        extend_instance_ttl(&env);
        env.storage().instance().get(&DataKey::DoctorRegistry).unwrap()
    }

    pub fn get_dispensary_registry(env: Env) -> Address {
        extend_instance_ttl(&env);
        env.storage()
            .instance()
            .get(&DataKey::DispensaryRegistry)
            .unwrap()
    }
}

fn next_id(env: &Env) -> u64 {
    env.storage().instance().get(&DataKey::NextId).unwrap_or(0_u64)
}

fn get_prescription_internal(env: &Env, id: u64) -> Prescription {
    extend_instance_ttl(env);
    env.storage()
        .persistent()
        .get(&DataKey::Prescription(id))
        .unwrap_or_else(|| panic_with_error!(env, PrescriptionError::PrescriptionMissing))
}

fn is_authorized_doctor(env: &Env, doctor: &Address) -> bool {
    env.invoke_contract::<bool>(
        &get_doctor_registry_address(env),
        &Symbol::new(env, "is_authorized"),
        (doctor.clone(),).into_val(env),
    )
}

fn is_authorized_dispensary(env: &Env, dispensary: &Address) -> bool {
    env.invoke_contract::<bool>(
        &get_dispensary_registry_address(env),
        &Symbol::new(env, "is_authorized"),
        (dispensary.clone(),).into_val(env),
    )
}

fn get_doctor_registry_address(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::DoctorRegistry)
        .unwrap()
}

fn get_dispensary_registry_address(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::DispensaryRegistry)
        .unwrap()
}

fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

mod test;
