#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, BytesN, Env};

mod registry_contract {
    use soroban_sdk::{
        contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env,
    };

    #[contract]
    pub struct RegistryContract;

    #[derive(Clone)]
    #[contracttype]
    enum DataKey {
        Admin,
        Doctor(Address),
    }

    #[derive(Copy, Clone, Eq, PartialEq)]
    #[contracterror]
    #[repr(u32)]
    pub enum RegistryError {
        AlreadyInitialized = 1,
        Unauthorized = 2,
    }

    #[contractimpl]
    impl RegistryContract {
        pub fn init(env: Env, admin: Address) {
            if env.storage().instance().has(&DataKey::Admin) {
                panic_with_error!(&env, RegistryError::AlreadyInitialized);
            }

            admin.require_auth();
            env.storage().instance().set(&DataKey::Admin, &admin);
        }

        pub fn add_doctor(env: Env, admin: Address, doctor: Address) {
            admin.require_auth();
            let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
            if stored_admin != admin {
                panic_with_error!(&env, RegistryError::Unauthorized);
            }
            env.storage()
                .persistent()
                .set(&DataKey::Doctor(doctor), &true);
        }

        pub fn is_authorized(env: Env, doctor: Address) -> bool {
            env.storage()
                .persistent()
                .get(&DataKey::Doctor(doctor))
                .unwrap_or(false)
        }
    }
}

mod dispensary_registry_contract {
    use soroban_sdk::{
        contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env,
    };

    #[contract]
    pub struct DispensaryRegistryContract;

    #[derive(Clone)]
    #[contracttype]
    enum DataKey {
        Admin,
        Dispensary(Address),
    }

    #[derive(Copy, Clone, Eq, PartialEq)]
    #[contracterror]
    #[repr(u32)]
    pub enum DispensaryRegistryError {
        AlreadyInitialized = 1,
        Unauthorized = 2,
    }

    #[contractimpl]
    impl DispensaryRegistryContract {
        pub fn init(env: Env, admin: Address) {
            if env.storage().instance().has(&DataKey::Admin) {
                panic_with_error!(&env, DispensaryRegistryError::AlreadyInitialized);
            }

            admin.require_auth();
            env.storage().instance().set(&DataKey::Admin, &admin);
        }

        pub fn add_dispensary(env: Env, admin: Address, dispensary: Address) {
            admin.require_auth();
            let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
            if stored_admin != admin {
                panic_with_error!(&env, DispensaryRegistryError::Unauthorized);
            }
            env.storage()
                .persistent()
                .set(&DataKey::Dispensary(dispensary), &true);
        }

        pub fn is_authorized(env: Env, dispensary: Address) -> bool {
            env.storage()
                .persistent()
                .get(&DataKey::Dispensary(dispensary))
                .unwrap_or(false)
        }
    }
}

#[test]
fn doctor_can_issue_and_dispensary_can_consume() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let doctor = Address::generate(&env);
    let patient = Address::generate(&env);
    let dispensary = Address::generate(&env);

    let doctor_registry_id = env.register(registry_contract::RegistryContract, ());
    let doctor_registry_client =
        registry_contract::RegistryContractClient::new(&env, &doctor_registry_id);
    doctor_registry_client.init(&admin);
    doctor_registry_client.add_doctor(&admin, &doctor);

    let dispensary_registry_id =
        env.register(dispensary_registry_contract::DispensaryRegistryContract, ());
    let dispensary_registry_client =
        dispensary_registry_contract::DispensaryRegistryContractClient::new(
            &env,
            &dispensary_registry_id,
        );
    dispensary_registry_client.init(&admin);
    dispensary_registry_client.add_dispensary(&admin, &dispensary);

    let prescription_id = env.register(PrescriptionContract, ());
    let prescription_client = PrescriptionContractClient::new(&env, &prescription_id);
    prescription_client.init(&doctor_registry_id, &dispensary_registry_id);

    let medication_hash = BytesN::from_array(&env, &[7; 32]);
    let issued_id = prescription_client.issue_prescription(
        &doctor,
        &patient,
        &medication_hash,
        &3600_u64,
        &30_u64,
    );

    let issued = prescription_client.get_prescription(&issued_id);
    assert_eq!(issued.id, 0);
    assert_eq!(issued.patient, patient);
    assert_eq!(issued.doctor, doctor);
    assert_eq!(issued.medication_hash, medication_hash);
    assert!(issued.issued_at <= issued.expires_at);
    assert_eq!(issued.total_quantity, 30);
    assert_eq!(issued.dispensed_quantity, 0);
    assert_eq!(prescription_client.get_remaining_quantity(&issued_id), 30);
    assert!(!issued.is_used);
    assert!(prescription_client.is_valid(&issued_id));
    assert_eq!(
        prescription_client.get_doctor_registry(),
        doctor_registry_id
    );
    assert_eq!(
        prescription_client.get_dispensary_registry(),
        dispensary_registry_id
    );

    let remaining_after_first =
        prescription_client.record_partial_dispense(&dispensary, &issued_id, &5_u64);
    let partial = prescription_client.get_prescription(&issued_id);
    assert_eq!(remaining_after_first, 25);
    assert_eq!(partial.dispensed_quantity, 5);
    assert!(!partial.is_used);
    assert!(prescription_client.is_valid(&issued_id));
    assert_eq!(prescription_client.get_remaining_quantity(&issued_id), 25);

    prescription_client.consume_prescription(&dispensary, &issued_id);
    let consumed = prescription_client.get_prescription(&issued_id);
    assert_eq!(consumed.dispensed_quantity, 30);
    assert!(consumed.is_used);
    assert!(!prescription_client.is_valid(&issued_id));
    assert_eq!(prescription_client.get_remaining_quantity(&issued_id), 0);
}

#[test]
#[should_panic]
fn unauthorized_doctor_cannot_issue_prescription() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let doctor = Address::generate(&env);
    let patient = Address::generate(&env);

    let doctor_registry_id = env.register(registry_contract::RegistryContract, ());
    let doctor_registry_client =
        registry_contract::RegistryContractClient::new(&env, &doctor_registry_id);
    doctor_registry_client.init(&admin);

    let dispensary_registry_id =
        env.register(dispensary_registry_contract::DispensaryRegistryContract, ());
    let dispensary_registry_client =
        dispensary_registry_contract::DispensaryRegistryContractClient::new(
            &env,
            &dispensary_registry_id,
        );
    dispensary_registry_client.init(&admin);

    let prescription_id = env.register(PrescriptionContract, ());
    let prescription_client = PrescriptionContractClient::new(&env, &prescription_id);
    prescription_client.init(&doctor_registry_id, &dispensary_registry_id);

    let medication_hash = BytesN::from_array(&env, &[7; 32]);
    prescription_client.issue_prescription(&doctor, &patient, &medication_hash, &3600_u64, &30_u64);
}

#[test]
#[should_panic]
fn unauthorized_dispensary_cannot_dispense() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let doctor = Address::generate(&env);
    let patient = Address::generate(&env);
    let dispensary = Address::generate(&env);

    let doctor_registry_id = env.register(registry_contract::RegistryContract, ());
    let doctor_registry_client =
        registry_contract::RegistryContractClient::new(&env, &doctor_registry_id);
    doctor_registry_client.init(&admin);
    doctor_registry_client.add_doctor(&admin, &doctor);

    let dispensary_registry_id =
        env.register(dispensary_registry_contract::DispensaryRegistryContract, ());
    let dispensary_registry_client =
        dispensary_registry_contract::DispensaryRegistryContractClient::new(
            &env,
            &dispensary_registry_id,
        );
    dispensary_registry_client.init(&admin);

    let prescription_id = env.register(PrescriptionContract, ());
    let prescription_client = PrescriptionContractClient::new(&env, &prescription_id);
    prescription_client.init(&doctor_registry_id, &dispensary_registry_id);

    let medication_hash = BytesN::from_array(&env, &[7; 32]);
    let issued_id = prescription_client.issue_prescription(
        &doctor,
        &patient,
        &medication_hash,
        &3600_u64,
        &30_u64,
    );

    prescription_client.record_partial_dispense(&dispensary, &issued_id, &1_u64);
}

#[test]
#[should_panic]
fn dispense_cannot_exceed_remaining_quantity() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let doctor = Address::generate(&env);
    let patient = Address::generate(&env);
    let dispensary = Address::generate(&env);

    let doctor_registry_id = env.register(registry_contract::RegistryContract, ());
    let doctor_registry_client =
        registry_contract::RegistryContractClient::new(&env, &doctor_registry_id);
    doctor_registry_client.init(&admin);
    doctor_registry_client.add_doctor(&admin, &doctor);

    let dispensary_registry_id =
        env.register(dispensary_registry_contract::DispensaryRegistryContract, ());
    let dispensary_registry_client =
        dispensary_registry_contract::DispensaryRegistryContractClient::new(
            &env,
            &dispensary_registry_id,
        );
    dispensary_registry_client.init(&admin);
    dispensary_registry_client.add_dispensary(&admin, &dispensary);

    let prescription_id = env.register(PrescriptionContract, ());
    let prescription_client = PrescriptionContractClient::new(&env, &prescription_id);
    prescription_client.init(&doctor_registry_id, &dispensary_registry_id);

    let medication_hash = BytesN::from_array(&env, &[7; 32]);
    let issued_id = prescription_client.issue_prescription(
        &doctor,
        &patient,
        &medication_hash,
        &3600_u64,
        &30_u64,
    );

    prescription_client.record_partial_dispense(&dispensary, &issued_id, &31_u64);
}

#[test]
fn dispensary_can_retain_prescription_and_only_retaining_dispensary_can_dispense() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let doctor = Address::generate(&env);
    let patient = Address::generate(&env);
    let dispensary = Address::generate(&env);

    let doctor_registry_id = env.register(registry_contract::RegistryContract, ());
    let doctor_registry_client =
        registry_contract::RegistryContractClient::new(&env, &doctor_registry_id);
    doctor_registry_client.init(&admin);
    doctor_registry_client.add_doctor(&admin, &doctor);

    let dispensary_registry_id =
        env.register(dispensary_registry_contract::DispensaryRegistryContract, ());
    let dispensary_registry_client =
        dispensary_registry_contract::DispensaryRegistryContractClient::new(
            &env,
            &dispensary_registry_id,
        );
    dispensary_registry_client.init(&admin);
    dispensary_registry_client.add_dispensary(&admin, &dispensary);

    let prescription_id = env.register(PrescriptionContract, ());
    let prescription_client = PrescriptionContractClient::new(&env, &prescription_id);
    prescription_client.init(&doctor_registry_id, &dispensary_registry_id);

    let medication_hash = BytesN::from_array(&env, &[7; 32]);
    let issued_id = prescription_client.issue_prescription(
        &doctor,
        &patient,
        &medication_hash,
        &3600_u64,
        &30_u64,
    );

    // Initial state: not retained
    let p = prescription_client.get_prescription(&issued_id);
    assert!(p.retained_by.is_none());

    // Retain prescription by dispensary
    prescription_client.retain_prescription(&dispensary, &issued_id);
    let p = prescription_client.get_prescription(&issued_id);
    assert_eq!(p.retained_by, Some(dispensary.clone()));

    // Retaining dispensary can dispense
    prescription_client.record_partial_dispense(&dispensary, &issued_id, &5_u64);
    let p = prescription_client.get_prescription(&issued_id);
    assert_eq!(p.dispensed_quantity, 5);
}

#[test]
fn doctor_or_dispensary_can_release_prescription() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let doctor = Address::generate(&env);
    let patient = Address::generate(&env);
    let dispensary = Address::generate(&env);

    let doctor_registry_id = env.register(registry_contract::RegistryContract, ());
    let doctor_registry_client =
        registry_contract::RegistryContractClient::new(&env, &doctor_registry_id);
    doctor_registry_client.init(&admin);
    doctor_registry_client.add_doctor(&admin, &doctor);

    let dispensary_registry_id =
        env.register(dispensary_registry_contract::DispensaryRegistryContract, ());
    let dispensary_registry_client =
        dispensary_registry_contract::DispensaryRegistryContractClient::new(
            &env,
            &dispensary_registry_id,
        );
    dispensary_registry_client.init(&admin);
    dispensary_registry_client.add_dispensary(&admin, &dispensary);

    let prescription_id = env.register(PrescriptionContract, ());
    let prescription_client = PrescriptionContractClient::new(&env, &prescription_id);
    prescription_client.init(&doctor_registry_id, &dispensary_registry_id);

    let medication_hash = BytesN::from_array(&env, &[7; 32]);
    let issued_id = prescription_client.issue_prescription(
        &doctor,
        &patient,
        &medication_hash,
        &3600_u64,
        &30_u64,
    );

    // Retain
    prescription_client.retain_prescription(&dispensary, &issued_id);
    assert!(prescription_client.get_prescription(&issued_id).retained_by.is_some());

    // Release by doctor
    prescription_client.release_prescription(&doctor, &issued_id);
    assert!(prescription_client.get_prescription(&issued_id).retained_by.is_none());

    // Retain again
    prescription_client.retain_prescription(&dispensary, &issued_id);
    assert!(prescription_client.get_prescription(&issued_id).retained_by.is_some());

    // Release by dispensary
    prescription_client.release_prescription(&dispensary, &issued_id);
    assert!(prescription_client.get_prescription(&issued_id).retained_by.is_none());
}

#[test]
#[should_panic]
fn other_dispensary_cannot_dispense_retained() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let doctor = Address::generate(&env);
    let patient = Address::generate(&env);
    let dispensary = Address::generate(&env);
    let other_dispensary = Address::generate(&env);

    let doctor_registry_id = env.register(registry_contract::RegistryContract, ());
    let doctor_registry_client =
        registry_contract::RegistryContractClient::new(&env, &doctor_registry_id);
    doctor_registry_client.init(&admin);
    doctor_registry_client.add_doctor(&admin, &doctor);

    let dispensary_registry_id =
        env.register(dispensary_registry_contract::DispensaryRegistryContract, ());
    let dispensary_registry_client =
        dispensary_registry_contract::DispensaryRegistryContractClient::new(
            &env,
            &dispensary_registry_id,
        );
    dispensary_registry_client.init(&admin);
    dispensary_registry_client.add_dispensary(&admin, &dispensary);
    dispensary_registry_client.add_dispensary(&admin, &other_dispensary);

    let prescription_id = env.register(PrescriptionContract, ());
    let prescription_client = PrescriptionContractClient::new(&env, &prescription_id);
    prescription_client.init(&doctor_registry_id, &dispensary_registry_id);

    let medication_hash = BytesN::from_array(&env, &[7; 32]);
    let issued_id = prescription_client.issue_prescription(
        &doctor,
        &patient,
        &medication_hash,
        &3600_u64,
        &30_u64,
    );

    prescription_client.retain_prescription(&dispensary, &issued_id);
    prescription_client.record_partial_dispense(&other_dispensary, &issued_id, &5_u64);
}
