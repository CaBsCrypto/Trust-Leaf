#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

#[test]
fn admin_can_manage_dispensaries() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let dispensary = Address::generate(&env);

    let contract_id = env.register(DispensaryRegistryContract, ());
    let client = DispensaryRegistryContractClient::new(&env, &contract_id);

    client.init(&admin);
    assert_eq!(client.get_admin(), admin);

    client.add_dispensary(&admin, &dispensary);
    assert!(client.is_authorized(&dispensary));

    client.remove_dispensary(&admin, &dispensary);
    assert!(!client.is_authorized(&dispensary));
}
