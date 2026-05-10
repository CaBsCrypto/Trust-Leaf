#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env};

const INSTANCE_BUMP_AMOUNT: u32 = 30 * 17280;
const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - 100;

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
        extend_instance_ttl(&env);
    }

    pub fn add_dispensary(env: Env, admin: Address, dispensary: Address) {
        require_admin(&env, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::Dispensary(dispensary.clone()), &true);
        extend_instance_ttl(&env);
        env.events()
            .publish(("dispensary_added",), (dispensary,));
    }

    pub fn remove_dispensary(env: Env, admin: Address, dispensary: Address) {
        require_admin(&env, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::Dispensary(dispensary.clone()), &false);
        extend_instance_ttl(&env);
        env.events()
            .publish(("dispensary_removed",), (dispensary,));
    }

    pub fn is_authorized(env: Env, dispensary: Address) -> bool {
        extend_instance_ttl(&env);
        env.storage()
            .persistent()
            .get(&DataKey::Dispensary(dispensary))
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
        panic_with_error!(env, DispensaryRegistryError::Unauthorized);
    }
}

fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

mod test;
