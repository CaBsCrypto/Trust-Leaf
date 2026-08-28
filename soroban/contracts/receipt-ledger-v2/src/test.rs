#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{Address, BytesN, Env};
use trust_registry::{
    CredentialKind, CredentialState, TrustRegistryContract, TrustRegistryContractClient,
};

struct Fixture<'a> {
    registry: TrustRegistryContractClient<'a>,
    ledger: ReceiptLedgerV2ContractClient<'a>,
    admin: Address,
    doctor: Address,
    dispensary: Address,
    doctor_credential_id: BytesN<32>,
    dispensary_credential_id: BytesN<32>,
    eligibility_credential_id: BytesN<32>,
}

fn id(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

fn fixture(env: &Env) -> Fixture<'_> {
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);
    let admin = Address::generate(env);
    let doctor = Address::generate(env);
    let dispensary = Address::generate(env);
    let registry_id = env.register(TrustRegistryContract, ());
    let registry = TrustRegistryContractClient::new(env, &registry_id);
    registry.init(&admin);
    let doctor_credential_id = id(env, 1);
    let dispensary_credential_id = id(env, 2);
    let eligibility_credential_id = id(env, 3);
    registry.issue_actor(
        &admin,
        &doctor_credential_id,
        &doctor,
        &CredentialKind::Doctor,
        &10_000,
        &id(env, 101),
    );
    registry.issue_actor(
        &admin,
        &dispensary_credential_id,
        &dispensary,
        &CredentialKind::Dispensary,
        &10_000,
        &id(env, 102),
    );
    registry.issue_eligibility(
        &doctor,
        &doctor_credential_id,
        &eligibility_credential_id,
        &5_000,
        &id(env, 103),
    );

    let ledger_id = env.register(ReceiptLedgerV2Contract, ());
    let ledger = ReceiptLedgerV2ContractClient::new(env, &ledger_id);
    ledger.init(&admin, &registry_id);
    Fixture {
        registry,
        ledger,
        admin,
        doctor,
        dispensary,
        doctor_credential_id,
        dispensary_credential_id,
        eligibility_credential_id,
    }
}

fn issue(f: &Fixture<'_>, env: &Env) -> Receipt {
    f.ledger.issue(
        &f.doctor,
        &f.doctor_credential_id,
        &f.eligibility_credential_id,
        &id(env, 10),
        &id(env, 20),
        &id(env, 110),
    )
}

fn grant(f: &Fixture<'_>, env: &Env) {
    f.ledger.set_grant(
        &f.doctor,
        &f.doctor_credential_id,
        &id(env, 10),
        &1,
        &f.dispensary,
        &f.dispensary_credential_id,
        &true,
        &id(env, 111),
    );
}

#[test]
fn end_to_end_chain_requires_all_three_active_credentials() {
    let env = Env::default();
    let f = fixture(&env);
    let issued = issue(&f, &env);
    assert_eq!(issued.version, 1);
    grant(&f, &env);
    let active = f.ledger.activate(
        &f.doctor,
        &f.doctor_credential_id,
        &id(&env, 10),
        &1,
        &id(&env, 21),
        &id(&env, 112),
    );
    let partial = f.ledger.record_partial(
        &f.dispensary,
        &f.dispensary_credential_id,
        &id(&env, 10),
        &active.version,
        &id(&env, 22),
        &id(&env, 113),
    );
    let dispensed = f.ledger.mark_dispensed(
        &f.dispensary,
        &f.dispensary_credential_id,
        &id(&env, 10),
        &partial.version,
        &id(&env, 23),
        &id(&env, 114),
    );
    assert_eq!(dispensed.state, ReceiptState::Dispensed);
    assert_eq!(dispensed.version, 4);
    let chain = f
        .ledger
        .authorization_chain(&id(&env, 10), &Some(f.dispensary.clone()));
    assert!(chain.doctor_active);
    assert!(chain.eligibility_active);
    assert!(chain.dispensary_active);
    assert!(chain.grant_enabled);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn suspended_doctor_blocks_receipt_activation() {
    let env = Env::default();
    let f = fixture(&env);
    issue(&f, &env);
    f.registry.set_state(
        &f.admin,
        &f.doctor_credential_id,
        &1,
        &CredentialState::Suspended,
        &id(&env, 120),
    );
    f.ledger.activate(
        &f.doctor,
        &f.doctor_credential_id,
        &id(&env, 10),
        &1,
        &id(&env, 21),
        &id(&env, 121),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn revoked_eligibility_blocks_dispensary_action() {
    let env = Env::default();
    let f = fixture(&env);
    issue(&f, &env);
    grant(&f, &env);
    f.ledger.activate(
        &f.doctor,
        &f.doctor_credential_id,
        &id(&env, 10),
        &1,
        &id(&env, 21),
        &id(&env, 112),
    );
    f.registry.set_state(
        &f.doctor,
        &f.eligibility_credential_id,
        &1,
        &CredentialState::Revoked,
        &id(&env, 122),
    );
    f.ledger.record_partial(
        &f.dispensary,
        &f.dispensary_credential_id,
        &id(&env, 10),
        &2,
        &id(&env, 22),
        &id(&env, 123),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn expired_dispensary_credential_blocks_partial() {
    let env = Env::default();
    let f = fixture(&env);
    issue(&f, &env);
    grant(&f, &env);
    f.ledger.activate(
        &f.doctor,
        &f.doctor_credential_id,
        &id(&env, 10),
        &1,
        &id(&env, 21),
        &id(&env, 112),
    );
    env.ledger().set_timestamp(10_001);
    f.ledger.record_partial(
        &f.dispensary,
        &f.dispensary_credential_id,
        &id(&env, 10),
        &2,
        &id(&env, 22),
        &id(&env, 123),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn wrong_doctor_credential_reference_is_rejected() {
    let env = Env::default();
    let f = fixture(&env);
    issue(&f, &env);
    f.ledger.activate(
        &f.doctor,
        &id(&env, 99),
        &id(&env, 10),
        &1,
        &id(&env, 21),
        &id(&env, 124),
    );
}

#[test]
fn exact_replay_returns_original_transition_result() {
    let env = Env::default();
    let f = fixture(&env);
    issue(&f, &env);
    let active = f.ledger.activate(
        &f.doctor,
        &f.doctor_credential_id,
        &id(&env, 10),
        &1,
        &id(&env, 21),
        &id(&env, 125),
    );
    let replay = f.ledger.activate(
        &f.doctor,
        &f.doctor_credential_id,
        &id(&env, 10),
        &1,
        &id(&env, 21),
        &id(&env, 125),
    );
    assert_eq!(active, replay);
    assert_eq!(f.ledger.get_receipt(&id(&env, 10)).version, 2);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn operation_replay_with_changed_commitment_is_rejected() {
    let env = Env::default();
    let f = fixture(&env);
    issue(&f, &env);
    f.ledger.activate(
        &f.doctor,
        &f.doctor_credential_id,
        &id(&env, 10),
        &1,
        &id(&env, 21),
        &id(&env, 125),
    );
    f.ledger.activate(
        &f.doctor,
        &f.doctor_credential_id,
        &id(&env, 10),
        &1,
        &id(&env, 22),
        &id(&env, 125),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn stale_cas_blocks_concurrent_transition() {
    let env = Env::default();
    let f = fixture(&env);
    issue(&f, &env);
    f.ledger.activate(
        &f.doctor,
        &f.doctor_credential_id,
        &id(&env, 10),
        &1,
        &id(&env, 21),
        &id(&env, 125),
    );
    f.ledger.revoke(
        &f.doctor,
        &f.doctor_credential_id,
        &id(&env, 10),
        &1,
        &id(&env, 22),
        &id(&env, 126),
    );
}

#[test]
fn admin_safety_expiry_remains_available_when_chain_is_inactive() {
    let env = Env::default();
    let f = fixture(&env);
    issue(&f, &env);
    f.registry.set_state(
        &f.admin,
        &f.doctor_credential_id,
        &1,
        &CredentialState::Suspended,
        &id(&env, 130),
    );
    let expired = f
        .ledger
        .expire(&f.admin, &id(&env, 10), &1, &id(&env, 30), &id(&env, 131));
    assert_eq!(expired.state, ReceiptState::Expired);
}

#[test]
fn chain_query_fails_closed_when_eligibility_is_revoked() {
    let env = Env::default();
    let f = fixture(&env);
    issue(&f, &env);
    grant(&f, &env);
    f.registry.set_state(
        &f.doctor,
        &f.eligibility_credential_id,
        &1,
        &CredentialState::Revoked,
        &id(&env, 140),
    );
    let chain = f
        .ledger
        .authorization_chain(&id(&env, 10), &Some(f.dispensary.clone()));
    assert!(chain.doctor_active);
    assert!(!chain.eligibility_active);
    assert!(chain.dispensary_active);
    assert!(chain.grant_enabled);
}

#[test]
fn delayed_grant_replay_returns_original_receipt_snapshot() {
    let env = Env::default();
    let f = fixture(&env);
    let issued = issue(&f, &env);
    grant(&f, &env);
    f.ledger.activate(
        &f.doctor,
        &f.doctor_credential_id,
        &id(&env, 10),
        &1,
        &id(&env, 21),
        &id(&env, 112),
    );
    let replay = f.ledger.set_grant(
        &f.doctor,
        &f.doctor_credential_id,
        &id(&env, 10),
        &1,
        &f.dispensary,
        &f.dispensary_credential_id,
        &true,
        &id(&env, 111),
    );
    assert_eq!(replay, issued);
    assert_eq!(f.ledger.get_receipt(&id(&env, 10)).version, 2);
}
