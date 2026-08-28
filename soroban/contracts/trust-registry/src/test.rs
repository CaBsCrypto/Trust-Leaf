#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{Address, BytesN, Env};

struct Fixture<'a> {
    client: TrustRegistryContractClient<'a>,
    admin: Address,
    doctor: Address,
    dispensary: Address,
    doctor_credential_id: BytesN<32>,
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
    let contract_id = env.register(TrustRegistryContract, ());
    let client = TrustRegistryContractClient::new(env, &contract_id);
    client.init(&admin);
    let doctor_credential_id = id(env, 1);
    client.issue_actor(
        &admin,
        &doctor_credential_id,
        &doctor,
        &CredentialKind::Doctor,
        &10_000,
        &id(env, 101),
    );
    client.issue_actor(
        &admin,
        &id(env, 2),
        &dispensary,
        &CredentialKind::Dispensary,
        &10_000,
        &id(env, 102),
    );
    Fixture {
        client,
        admin,
        doctor,
        dispensary,
        doctor_credential_id,
    }
}

#[test]
fn admin_and_doctor_issue_only_opaque_credentials() {
    let env = Env::default();
    let f = fixture(&env);
    let eligibility = f.client.issue_eligibility(
        &f.doctor,
        &f.doctor_credential_id,
        &id(&env, 3),
        &5_000,
        &id(&env, 103),
    );
    assert_eq!(eligibility.kind, CredentialKind::PatientEligibility);
    assert_eq!(eligibility.controller, f.doctor);
    assert_eq!(eligibility.authority_credential_id, f.doctor_credential_id);
    assert!(f.client.is_active(&id(&env, 3), &f.doctor, &3));
    assert!(!f.client.is_active(&id(&env, 3), &f.dispensary, &3));
    assert!(!f.client.is_active(&id(&env, 3), &f.doctor, &99));
}

#[test]
fn suspend_resume_revoke_and_cas_are_versioned() {
    let env = Env::default();
    let f = fixture(&env);
    let suspended = f.client.set_state(
        &f.admin,
        &f.doctor_credential_id,
        &1,
        &CredentialState::Suspended,
        &id(&env, 110),
    );
    assert_eq!(suspended.version, 2);
    assert!(!f.client.is_active(&f.doctor_credential_id, &f.doctor, &1));
    let resumed = f.client.set_state(
        &f.admin,
        &f.doctor_credential_id,
        &2,
        &CredentialState::Active,
        &id(&env, 111),
    );
    assert_eq!(resumed.version, 3);
    let revoked = f.client.set_state(
        &f.admin,
        &f.doctor_credential_id,
        &3,
        &CredentialState::Revoked,
        &id(&env, 112),
    );
    assert_eq!(revoked.version, 4);
    assert!(!f.client.is_active(&f.doctor_credential_id, &f.doctor, &1));
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn stale_version_fails_closed() {
    let env = Env::default();
    let f = fixture(&env);
    f.client.set_state(
        &f.admin,
        &f.doctor_credential_id,
        &1,
        &CredentialState::Suspended,
        &id(&env, 110),
    );
    f.client.set_state(
        &f.admin,
        &f.doctor_credential_id,
        &1,
        &CredentialState::Revoked,
        &id(&env, 111),
    );
}

#[test]
fn exact_replay_is_idempotent_even_after_later_state() {
    let env = Env::default();
    let f = fixture(&env);
    let first = f.client.set_state(
        &f.admin,
        &f.doctor_credential_id,
        &1,
        &CredentialState::Suspended,
        &id(&env, 110),
    );
    f.client.set_state(
        &f.admin,
        &f.doctor_credential_id,
        &2,
        &CredentialState::Active,
        &id(&env, 111),
    );
    let replay = f.client.set_state(
        &f.admin,
        &f.doctor_credential_id,
        &1,
        &CredentialState::Suspended,
        &id(&env, 110),
    );
    assert_eq!(replay, first);
    assert_eq!(f.client.get_credential(&f.doctor_credential_id).version, 3);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn operation_id_payload_change_is_rejected() {
    let env = Env::default();
    let f = fixture(&env);
    f.client.set_state(
        &f.admin,
        &f.doctor_credential_id,
        &1,
        &CredentialState::Suspended,
        &id(&env, 110),
    );
    f.client.set_state(
        &f.admin,
        &f.doctor_credential_id,
        &1,
        &CredentialState::Revoked,
        &id(&env, 110),
    );
}

#[test]
fn expiry_is_fail_closed_before_materialization() {
    let env = Env::default();
    let f = fixture(&env);
    env.ledger().set_timestamp(10_001);
    assert!(!f.client.is_active(&f.doctor_credential_id, &f.doctor, &1));
    let expired = f
        .client
        .expire(&f.admin, &f.doctor_credential_id, &1, &id(&env, 120));
    assert_eq!(expired.state, CredentialState::Expired);
    assert_eq!(expired.version, 2);
}

#[test]
fn renew_extends_expiry_with_cas() {
    let env = Env::default();
    let f = fixture(&env);
    let renewed = f.client.renew(
        &f.admin,
        &f.doctor_credential_id,
        &1,
        &20_000,
        &id(&env, 121),
    );
    assert_eq!(renewed.expires_at, 20_000);
    assert_eq!(renewed.version, 2);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn elapsed_credential_cannot_be_resurrected_by_renew() {
    let env = Env::default();
    let f = fixture(&env);
    env.ledger().set_timestamp(10_001);
    f.client.renew(
        &f.admin,
        &f.doctor_credential_id,
        &1,
        &20_000,
        &id(&env, 122),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn suspended_doctor_cannot_issue_eligibility() {
    let env = Env::default();
    let f = fixture(&env);
    f.client.set_state(
        &f.admin,
        &f.doctor_credential_id,
        &1,
        &CredentialState::Suspended,
        &id(&env, 130),
    );
    f.client.issue_eligibility(
        &f.doctor,
        &f.doctor_credential_id,
        &id(&env, 3),
        &5_000,
        &id(&env, 131),
    );
}

#[test]
fn suspended_doctor_can_only_revoke_existing_eligibility() {
    let env = Env::default();
    let f = fixture(&env);
    f.client.issue_eligibility(
        &f.doctor,
        &f.doctor_credential_id,
        &id(&env, 3),
        &5_000,
        &id(&env, 140),
    );
    f.client.set_state(
        &f.admin,
        &f.doctor_credential_id,
        &1,
        &CredentialState::Suspended,
        &id(&env, 141),
    );
    let revoked = f.client.set_state(
        &f.doctor,
        &id(&env, 3),
        &1,
        &CredentialState::Revoked,
        &id(&env, 142),
    );
    assert_eq!(revoked.state, CredentialState::Revoked);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn admin_cannot_issue_patient_eligibility() {
    let env = Env::default();
    let f = fixture(&env);
    f.client.issue_actor(
        &f.admin,
        &id(&env, 4),
        &f.doctor,
        &CredentialKind::PatientEligibility,
        &5_000,
        &id(&env, 150),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn admin_cannot_change_patient_eligibility_state() {
    let env = Env::default();
    let f = fixture(&env);
    f.client.issue_eligibility(
        &f.doctor,
        &f.doctor_credential_id,
        &id(&env, 3),
        &5_000,
        &id(&env, 160),
    );
    f.client.set_state(
        &f.admin,
        &id(&env, 3),
        &1,
        &CredentialState::Revoked,
        &id(&env, 161),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn doctor_cannot_change_actor_credential_state() {
    let env = Env::default();
    let f = fixture(&env);
    f.client.set_state(
        &f.doctor,
        &f.doctor_credential_id,
        &1,
        &CredentialState::Suspended,
        &id(&env, 170),
    );
}
