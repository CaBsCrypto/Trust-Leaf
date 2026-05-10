#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, BytesN, Env};

mod prescription_contract {
    use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env};

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
        Prescription(u64),
        Valid(u64),
    }

    #[contractimpl]
    impl PrescriptionContract {
        pub fn seed_prescription(env: Env, prescription: Prescription, valid: bool) {
            env.storage()
                .persistent()
                .set(&DataKey::Prescription(prescription.id), &prescription.clone());
            env.storage()
                .persistent()
                .set(&DataKey::Valid(prescription.id), &valid);
        }

        pub fn get_prescription(env: Env, id: u64) -> Prescription {
            env.storage()
                .persistent()
                .get(&DataKey::Prescription(id))
                .unwrap()
        }

        pub fn is_valid(env: Env, id: u64) -> bool {
            env.storage()
                .persistent()
                .get(&DataKey::Valid(id))
                .unwrap_or(false)
        }
    }
}

mod dispensary_registry_contract {
    use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

    #[contract]
    pub struct DispensaryRegistryContract;

    #[derive(Clone)]
    #[contracttype]
    enum DataKey {
        Dispensary(Address),
    }

    #[contractimpl]
    impl DispensaryRegistryContract {
        pub fn set_authorized(env: Env, dispensary: Address, authorized: bool) {
            env.storage()
                .persistent()
                .set(&DataKey::Dispensary(dispensary), &authorized);
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
fn dispensary_can_record_dispense_for_valid_prescription() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let patient = Address::generate(&env);
    let doctor = Address::generate(&env);
    let dispensary = Address::generate(&env);

    let prescription_contract_id = env.register(prescription_contract::PrescriptionContract, ());
    let prescription_client =
        prescription_contract::PrescriptionContractClient::new(&env, &prescription_contract_id);

    let dispensary_registry_id =
        env.register(dispensary_registry_contract::DispensaryRegistryContract, ());
    let dispensary_registry_client =
        dispensary_registry_contract::DispensaryRegistryContractClient::new(
            &env,
            &dispensary_registry_id,
        );
    dispensary_registry_client.set_authorized(&dispensary, &true);

    let medication_hash = BytesN::from_array(&env, &[7; 32]);
    prescription_client.seed_prescription(
        &prescription_contract::Prescription {
            id: 0,
            patient: patient.clone(),
            doctor: doctor.clone(),
            medication_hash,
            issued_at: 100,
            expires_at: 3_700,
            is_used: false,
        },
        &true,
    );

    let contract_id = env.register(DispenseRecordContract, ());
    let client = DispenseRecordContractClient::new(&env, &contract_id);
    client.init(&admin, &prescription_contract_id, &dispensary_registry_id);

    let product_hash = BytesN::from_array(&env, &[9; 32]);
    let batch_hash = BytesN::from_array(&env, &[3; 32]);
    let record_id =
        client.record_dispense(&dispensary, &0_u64, &product_hash, &batch_hash, &2_u64);

    let record = client.get_record(&record_id);
    assert_eq!(record.id, 0);
    assert_eq!(record.prescription_id, 0);
    assert_eq!(record.patient, patient);
    assert_eq!(record.doctor, doctor);
    assert_eq!(record.dispensary, dispensary);
    assert_eq!(record.product_hash, product_hash);
    assert_eq!(record.batch_hash, batch_hash);
    assert_eq!(record.quantity, 2);

    let last_record = client.get_last_record_for_prescription(&0_u64).unwrap();
    assert_eq!(last_record.id, record_id);
    assert_eq!(client.get_prescription_contract(), prescription_contract_id);
    assert_eq!(client.get_dispensary_registry(), dispensary_registry_id);
}
