#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

#[test]
fn admin_can_manage_doctors() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let doctor = Address::generate(&env);

    let contract_id = env.register(RegistryContract, ());
    let client = RegistryContractClient::new(&env, &contract_id);

    client.init(&admin);
    assert_eq!(client.get_admin(), admin);

    client.add_doctor(&admin, &doctor);
    assert!(client.is_authorized(&doctor));

    client.remove_doctor(&admin, &doctor);
    assert!(!client.is_authorized(&doctor));
}

#[test]
#[should_panic]
fn registry_double_initialization_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    let contract_id = env.register(RegistryContract, ());
    let client = RegistryContractClient::new(&env, &contract_id);

    client.init(&admin);
    client.init(&admin);
}

#[test]
#[should_panic]
fn unauthorized_cannot_add_doctor() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let unauthorized_user = Address::generate(&env);
    let doctor = Address::generate(&env);

    let contract_id = env.register(RegistryContract, ());
    let client = RegistryContractClient::new(&env, &contract_id);

    client.init(&admin);
    client.add_doctor(&unauthorized_user, &doctor);
}

#[test]
#[should_panic]
fn unauthorized_cannot_remove_doctor() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let unauthorized_user = Address::generate(&env);
    let doctor = Address::generate(&env);

    let contract_id = env.register(RegistryContract, ());
    let client = RegistryContractClient::new(&env, &contract_id);

    client.init(&admin);
    client.add_doctor(&admin, &doctor);
    client.remove_doctor(&unauthorized_user, &doctor);
}

