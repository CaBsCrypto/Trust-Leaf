#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, BytesN, Env};

struct Fixture<'a> {
    client: ReceiptLedgerContractClient<'a>,
    admin: Address,
    doctor: Address,
    dispensary: Address,
}

fn id(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

fn fixture(env: &Env) -> Fixture<'_> {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let doctor = Address::generate(env);
    let dispensary = Address::generate(env);
    let contract_id = env.register(ReceiptLedgerContract, ());
    let client = ReceiptLedgerContractClient::new(env, &contract_id);
    client.init(&admin);
    client.set_doctor(&admin, &doctor, &true);
    client.set_dispensary(&admin, &dispensary, &true);
    Fixture {
        client,
        admin,
        doctor,
        dispensary,
    }
}

fn issue(f: &Fixture<'_>, env: &Env) -> Receipt {
    f.client
        .issue(&f.doctor, &id(env, 1), &id(env, 11), &id(env, 101))
}

#[test]
fn full_versioned_lifecycle_uses_only_opaque_values() {
    let env = Env::default();
    let f = fixture(&env);
    let issued = issue(&f, &env);
    assert_eq!(issued.state, ReceiptState::Issued);
    assert_eq!(issued.version, 1);

    let active = f
        .client
        .activate(&f.doctor, &id(&env, 1), &1, &id(&env, 12), &id(&env, 102));
    assert_eq!(active.state, ReceiptState::Active);
    assert_eq!(active.version, 2);

    let partial_1 = f.client.record_partial(
        &f.dispensary,
        &id(&env, 1),
        &2,
        &id(&env, 13),
        &id(&env, 103),
    );
    let partial_2 = f.client.record_partial(
        &f.dispensary,
        &id(&env, 1),
        &3,
        &id(&env, 14),
        &id(&env, 104),
    );
    assert_eq!(partial_1.state, ReceiptState::Partial);
    assert_eq!(partial_2.version, 4);

    let dispensed = f.client.mark_dispensed(
        &f.dispensary,
        &id(&env, 1),
        &4,
        &id(&env, 15),
        &id(&env, 105),
    );
    assert_eq!(dispensed.state, ReceiptState::Dispensed);
    assert_eq!(dispensed.version, 5);
    assert_eq!(f.client.get_receipt(&id(&env, 1)), dispensed);
}

#[test]
fn exact_operation_replay_is_idempotent() {
    let env = Env::default();
    let f = fixture(&env);
    let first = issue(&f, &env);
    let replay = issue(&f, &env);
    assert_eq!(first, replay);

    let active = f
        .client
        .activate(&f.doctor, &id(&env, 1), &1, &id(&env, 12), &id(&env, 102));
    let replayed = f
        .client
        .activate(&f.doctor, &id(&env, 1), &1, &id(&env, 12), &id(&env, 102));
    assert_eq!(active, replayed);
    assert_eq!(replayed.version, 2);
}

#[test]
fn delayed_replay_returns_original_operation_result() {
    let env = Env::default();
    let f = fixture(&env);
    let originally_issued = issue(&f, &env);
    f.client
        .activate(&f.doctor, &id(&env, 1), &1, &id(&env, 12), &id(&env, 102));

    let replayed_issue = issue(&f, &env);
    assert_eq!(replayed_issue, originally_issued);
    assert_eq!(replayed_issue.state, ReceiptState::Issued);
    assert_eq!(
        f.client.get_receipt(&id(&env, 1)).state,
        ReceiptState::Active
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn operation_id_reuse_with_changed_payload_fails() {
    let env = Env::default();
    let f = fixture(&env);
    issue(&f, &env);
    f.client
        .issue(&f.doctor, &id(&env, 2), &id(&env, 11), &id(&env, 101));
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn authorized_peer_cannot_reappropriate_operation_id() {
    let env = Env::default();
    let f = fixture(&env);
    let other_doctor = Address::generate(&env);
    f.client.set_doctor(&f.admin, &other_doctor, &true);
    issue(&f, &env);

    f.client
        .issue(&other_doctor, &id(&env, 1), &id(&env, 11), &id(&env, 101));
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn operation_id_cannot_cross_function_domain() {
    let env = Env::default();
    let f = fixture(&env);
    issue(&f, &env);
    f.client
        .activate(&f.doctor, &id(&env, 1), &1, &id(&env, 12), &id(&env, 102));

    f.client
        .revoke(&f.doctor, &id(&env, 1), &2, &id(&env, 13), &id(&env, 102));
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn stale_expected_version_blocks_concurrent_dispense() {
    let env = Env::default();
    let f = fixture(&env);
    issue(&f, &env);
    f.client
        .activate(&f.doctor, &id(&env, 1), &1, &id(&env, 12), &id(&env, 102));
    f.client.record_partial(
        &f.dispensary,
        &id(&env, 1),
        &2,
        &id(&env, 13),
        &id(&env, 103),
    );
    f.client.record_partial(
        &f.dispensary,
        &id(&env, 1),
        &2,
        &id(&env, 14),
        &id(&env, 104),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn terminal_state_cannot_transition() {
    let env = Env::default();
    let f = fixture(&env);
    issue(&f, &env);
    f.client
        .activate(&f.doctor, &id(&env, 1), &1, &id(&env, 12), &id(&env, 102));
    f.client.mark_dispensed(
        &f.dispensary,
        &id(&env, 1),
        &2,
        &id(&env, 13),
        &id(&env, 103),
    );
    f.client
        .revoke(&f.doctor, &id(&env, 1), &3, &id(&env, 14), &id(&env, 104));
}

#[test]
fn revoke_and_expire_are_separate_terminal_paths() {
    let env = Env::default();
    let f = fixture(&env);
    issue(&f, &env);
    let revoked = f
        .client
        .revoke(&f.doctor, &id(&env, 1), &1, &id(&env, 12), &id(&env, 102));
    assert_eq!(revoked.state, ReceiptState::Revoked);

    let issued_2 = f
        .client
        .issue(&f.doctor, &id(&env, 2), &id(&env, 21), &id(&env, 201));
    let expired = f.client.expire(
        &f.admin,
        &id(&env, 2),
        &issued_2.version,
        &id(&env, 22),
        &id(&env, 202),
    );
    assert_eq!(expired.state, ReceiptState::Expired);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn unauthorized_doctor_cannot_issue() {
    let env = Env::default();
    let f = fixture(&env);
    let stranger = Address::generate(&env);
    f.client
        .issue(&stranger, &id(&env, 1), &id(&env, 11), &id(&env, 101));
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn doctor_cannot_perform_dispensary_transition() {
    let env = Env::default();
    let f = fixture(&env);
    issue(&f, &env);
    f.client
        .activate(&f.doctor, &id(&env, 1), &1, &id(&env, 12), &id(&env, 102));
    f.client
        .record_partial(&f.doctor, &id(&env, 1), &2, &id(&env, 13), &id(&env, 103));
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn disabled_role_fails_closed() {
    let env = Env::default();
    let f = fixture(&env);
    f.client.set_doctor(&f.admin, &f.doctor, &false);
    f.client
        .issue(&f.doctor, &id(&env, 1), &id(&env, 11), &id(&env, 101));
}
