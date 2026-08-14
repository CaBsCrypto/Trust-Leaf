#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    BytesN, Env, IntoVal, Symbol,
};

const INSTANCE_BUMP_AMOUNT: u32 = 30 * 17280;
const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - 100;

#[contract]
pub struct DispenseRecordContract;

#[derive(Clone)]
#[contracttype]
pub struct DispenseRecord {
    pub id: u64,
    pub prescription_id: u64,
    pub patient: Address,
    pub doctor: Address,
    pub dispensary: Address,
    pub product_hash: BytesN<32>,
    pub batch_hash: BytesN<32>,
    pub quantity: u64,
    pub dispensed_at: u64,
}

#[derive(Clone)]
#[contracttype]
struct PrescriptionSnapshot {
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
    Admin,
    PrescriptionContract,
    DispensaryRegistry,
    NextId,
    Record(u64),
    LastRecordForPrescription(u64),
}

#[derive(Copy, Clone, Eq, PartialEq)]
#[contracterror]
#[repr(u32)]
pub enum DispenseRecordError {
    AlreadyInitialized = 1,
    UnauthorizedAdmin = 2,
    UnauthorizedDispensary = 3,
    PrescriptionInvalid = 4,
    RecordMissing = 5,
}

#[contractevent(topics = ["DispenseRecorded"], data_format = "vec")]
pub struct DispenseRecorded {
    pub id: u64,
    pub prescription_id: u64,
    pub patient: Address,
    pub dispensary: Address,
}

#[contractimpl]
impl DispenseRecordContract {
    pub fn init(
        env: Env,
        admin: Address,
        prescription_contract: Address,
        dispensary_registry: Address,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, DispenseRecordError::AlreadyInitialized);
        }

        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::PrescriptionContract, &prescription_contract);
        env.storage()
            .instance()
            .set(&DataKey::DispensaryRegistry, &dispensary_registry);
        env.storage().instance().set(&DataKey::NextId, &0_u64);
        extend_instance_ttl(&env);
    }

    pub fn record_dispense(
        env: Env,
        dispensary: Address,
        prescription_id: u64,
        product_hash: BytesN<32>,
        batch_hash: BytesN<32>,
        quantity: u64,
    ) -> u64 {
        dispensary.require_auth();

        if !is_authorized_dispensary(&env, &dispensary) {
            panic_with_error!(&env, DispenseRecordError::UnauthorizedDispensary);
        }

        if !is_prescription_valid(&env, prescription_id) {
            panic_with_error!(&env, DispenseRecordError::PrescriptionInvalid);
        }

        record_partial_dispense(&env, &dispensary, prescription_id, quantity);
        let prescription = get_prescription_snapshot(&env, prescription_id);
        let id = next_id(&env);
        let record = DispenseRecord {
            id,
            prescription_id,
            patient: prescription.patient,
            doctor: prescription.doctor,
            dispensary: dispensary.clone(),
            product_hash,
            batch_hash,
            quantity,
            dispensed_at: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Record(id), &record);
        env.storage().persistent().set(
            &DataKey::LastRecordForPrescription(prescription_id),
            &record,
        );
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        extend_instance_ttl(&env);

        DispenseRecorded {
            id,
            prescription_id,
            patient: record.patient.clone(),
            dispensary,
        }
        .publish(&env);

        id
    }

    pub fn get_record(env: Env, id: u64) -> DispenseRecord {
        get_record_internal(&env, id)
    }

    pub fn get_last_record_for_prescription(
        env: Env,
        prescription_id: u64,
    ) -> Option<DispenseRecord> {
        extend_instance_ttl(&env);
        env.storage()
            .persistent()
            .get(&DataKey::LastRecordForPrescription(prescription_id))
    }

    pub fn get_prescription_contract(env: Env) -> Address {
        extend_instance_ttl(&env);
        env.storage()
            .instance()
            .get(&DataKey::PrescriptionContract)
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

fn get_record_internal(env: &Env, id: u64) -> DispenseRecord {
    extend_instance_ttl(env);
    env.storage()
        .persistent()
        .get(&DataKey::Record(id))
        .unwrap_or_else(|| panic_with_error!(env, DispenseRecordError::RecordMissing))
}

fn get_prescription_snapshot(env: &Env, prescription_id: u64) -> PrescriptionSnapshot {
    env.invoke_contract::<PrescriptionSnapshot>(
        &get_prescription_contract_address(env),
        &Symbol::new(env, "get_prescription"),
        (prescription_id,).into_val(env),
    )
}

fn is_prescription_valid(env: &Env, prescription_id: u64) -> bool {
    env.invoke_contract::<bool>(
        &get_prescription_contract_address(env),
        &Symbol::new(env, "is_valid"),
        (prescription_id,).into_val(env),
    )
}

fn record_partial_dispense(
    env: &Env,
    dispensary: &Address,
    prescription_id: u64,
    quantity: u64,
) -> u64 {
    env.invoke_contract::<u64>(
        &get_prescription_contract_address(env),
        &Symbol::new(env, "record_partial_dispense"),
        (dispensary.clone(), prescription_id, quantity).into_val(env),
    )
}

fn is_authorized_dispensary(env: &Env, dispensary: &Address) -> bool {
    env.invoke_contract::<bool>(
        &get_dispensary_registry_address(env),
        &Symbol::new(env, "is_authorized"),
        (dispensary.clone(),).into_val(env),
    )
}

fn get_prescription_contract_address(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::PrescriptionContract)
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
