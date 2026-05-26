#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    Env,
};

const INSTANCE_BUMP_AMOUNT: u32 = 30 * 17280;
const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - 100;

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

#[contractevent(topics = ["doctor_added"], data_format = "vec")]
pub struct DoctorAdded {
    pub doctor: Address,
}

#[contractevent(topics = ["doctor_removed"], data_format = "vec")]
pub struct DoctorRemoved {
    pub doctor: Address,
}

#[contractimpl]
impl RegistryContract {
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, RegistryError::AlreadyInitialized);
        }

        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        extend_instance_ttl(&env);
    }

    pub fn add_doctor(env: Env, admin: Address, doctor: Address) {
        require_admin(&env, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::Doctor(doctor.clone()), &true);
        extend_instance_ttl(&env);
        DoctorAdded { doctor }.publish(&env);
    }

    pub fn remove_doctor(env: Env, admin: Address, doctor: Address) {
        require_admin(&env, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::Doctor(doctor.clone()), &false);
        extend_instance_ttl(&env);
        DoctorRemoved { doctor }.publish(&env);
    }

    pub fn is_authorized(env: Env, doctor: Address) -> bool {
        extend_instance_ttl(&env);
        env.storage()
            .persistent()
            .get(&DataKey::Doctor(doctor))
            .unwrap_or(false)
    }

    pub fn get_admin(env: Env) -> Address {
        extend_instance_ttl(&env);
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}

fn require_admin(env: &Env, admin: &Address) {
    admin.require_auth();
    let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    if stored_admin != *admin {
        panic_with_error!(env, RegistryError::Unauthorized);
    }
}

fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

mod test;
