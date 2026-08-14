#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    BytesN, Env, IntoVal, Symbol,
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
    pub total_quantity: u64,
    pub dispensed_quantity: u64,
    pub is_used: bool,
    pub retained_by: Option<Address>,
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
    InvalidQuantity = 7,
    QuantityExceeded = 8,
    NotAuthorizedToRelease = 9,
}

#[contractevent(topics = ["PrescriptionIssued"], data_format = "vec")]
pub struct PrescriptionIssued {
    pub id: u64,
    pub patient: Address,
    pub doctor: Address,
}

#[contractevent(topics = ["PrescriptionPartiallyDispensed"], data_format = "vec")]
pub struct PrescriptionPartiallyDispensed {
    pub prescription_id: u64,
    pub dispensary: Address,
    pub quantity: u64,
    pub remaining_after: u64,
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
        total_quantity: u64,
    ) -> u64 {
        doctor.require_auth();

        if !is_authorized_doctor(&env, &doctor) {
            panic_with_error!(&env, PrescriptionError::UnauthorizedDoctor);
        }
        if total_quantity == 0 {
            panic_with_error!(&env, PrescriptionError::InvalidQuantity);
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
            total_quantity,
            dispensed_quantity: 0,
            is_used: false,
            retained_by: None,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Prescription(id), &prescription);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        extend_instance_ttl(&env);

        PrescriptionIssued {
            id,
            patient,
            doctor,
        }
        .publish(&env);

        id
    }

    pub fn retain_prescription(env: Env, dispensary: Address, prescription_id: u64) {
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

        prescription.retained_by = Some(dispensary);
        env.storage()
            .persistent()
            .set(&DataKey::Prescription(prescription_id), &prescription);
        extend_instance_ttl(&env);
    }

    pub fn release_prescription(env: Env, caller: Address, prescription_id: u64) {
        caller.require_auth();

        let mut prescription = get_prescription_internal(&env, prescription_id);

        let is_doctor = caller == prescription.doctor;
        let is_dispensary = Some(caller.clone()) == prescription.retained_by;

        if !is_doctor && !is_dispensary {
            panic_with_error!(&env, PrescriptionError::NotAuthorizedToRelease);
        }

        prescription.retained_by = None;
        env.storage()
            .persistent()
            .set(&DataKey::Prescription(prescription_id), &prescription);
        extend_instance_ttl(&env);
    }

    pub fn consume_prescription(env: Env, dispensary: Address, prescription_id: u64) {
        let prescription = get_prescription_internal(&env, prescription_id);
        let remaining = prescription
            .total_quantity
            .saturating_sub(prescription.dispensed_quantity);
        Self::record_partial_dispense(env, dispensary, prescription_id, remaining);
    }

    pub fn record_partial_dispense(
        env: Env,
        dispensary: Address,
        prescription_id: u64,
        quantity: u64,
    ) -> u64 {
        dispensary.require_auth();

        if !is_authorized_dispensary(&env, &dispensary) {
            panic_with_error!(&env, PrescriptionError::UnauthorizedDispensary);
        }
        if quantity == 0 {
            panic_with_error!(&env, PrescriptionError::InvalidQuantity);
        }

        let mut prescription = get_prescription_internal(&env, prescription_id);
        if prescription.is_used {
            panic_with_error!(&env, PrescriptionError::PrescriptionAlreadyUsed);
        }
        if env.ledger().timestamp() >= prescription.expires_at {
            panic_with_error!(&env, PrescriptionError::PrescriptionExpired);
        }

        if let Some(ref current_dispensary) = prescription.retained_by {
            if dispensary != *current_dispensary {
                panic_with_error!(&env, PrescriptionError::UnauthorizedDispensary);
            }
        }

        let remaining = prescription
            .total_quantity
            .saturating_sub(prescription.dispensed_quantity);
        if quantity > remaining {
            panic_with_error!(&env, PrescriptionError::QuantityExceeded);
        }

        prescription.dispensed_quantity = prescription.dispensed_quantity.saturating_add(quantity);
        let remaining_after = prescription
            .total_quantity
            .saturating_sub(prescription.dispensed_quantity);
        prescription.is_used = remaining_after == 0;
        env.storage()
            .persistent()
            .set(&DataKey::Prescription(prescription_id), &prescription);
        extend_instance_ttl(&env);

        PrescriptionPartiallyDispensed {
            prescription_id,
            dispensary,
            quantity,
            remaining_after,
        }
        .publish(&env);

        remaining_after
    }

    pub fn get_prescription(env: Env, id: u64) -> Prescription {
        get_prescription_internal(&env, id)
    }

    pub fn is_valid(env: Env, id: u64) -> bool {
        let prescription = get_prescription_internal(&env, id);
        !prescription.is_used
            && env.ledger().timestamp() < prescription.expires_at
            && prescription.dispensed_quantity < prescription.total_quantity
    }

    pub fn get_remaining_quantity(env: Env, id: u64) -> u64 {
        let prescription = get_prescription_internal(&env, id);
        prescription
            .total_quantity
            .saturating_sub(prescription.dispensed_quantity)
    }

    pub fn get_doctor_registry(env: Env) -> Address {
        extend_instance_ttl(&env);
        env.storage()
            .instance()
            .get(&DataKey::DoctorRegistry)
            .unwrap()
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
    env.storage()
        .instance()
        .get(&DataKey::NextId)
        .unwrap_or(0_u64)
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
