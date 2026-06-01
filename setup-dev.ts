import * as StellarSdk from '@stellar/stellar-sdk';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('================================================================');
  console.log('🚀 CONFIGURANDO ENTORNO REAL DE DESARROLLO EN STELLAR TESTNET');
  console.log('================================================================\n');

  console.log('👉 Paso 1: Generando pares de claves para desarrollo...');
  const adminKeypair = StellarSdk.Keypair.random();
  const doctorKeypair = StellarSdk.Keypair.random();
  const dispensaryKeypair = StellarSdk.Keypair.random();
  const patientKeypair = StellarSdk.Keypair.random();

  console.log(`   - ADMIN (Emisor):      ${adminKeypair.publicKey()}`);
  console.log(`   - MÉDICO:              ${doctorKeypair.publicKey()}`);
  console.log(`   - DISPENSARIO:         ${dispensaryKeypair.publicKey()}`);
  console.log(`   - PACIENTE (Demo):     ${patientKeypair.publicKey()}\n`);

  console.log('👉 Paso 2: Fondeando cuentas en Stellar Testnet usando Friendbot...');
  const accountsToFund = [
    { name: 'ADMIN', address: adminKeypair.publicKey() },
    { name: 'MÉDICO', address: doctorKeypair.publicKey() },
    { name: 'DISPENSARIO', address: dispensaryKeypair.publicKey() },
    { name: 'PACIENTE', address: patientKeypair.publicKey() },
  ];

  for (const account of accountsToFund) {
    process.stdout.write(`   - Fondeando ${account.name}... `);
    const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(account.address)}`);
    if (!response.ok) {
      console.log('❌ FALLÓ');
      throw new Error(`Friendbot no pudo fondear la cuenta ${account.name}.`);
    }
    console.log('✅ COMPLETADO');
  }
  console.log('   (Esperando 4 segundos para propagación del Ledger...)\n');
  await sleep(4000);

  console.log('👉 Paso 3: Desplegando nuevos Smart Contracts de Soroban en Testnet...');
  const networkArgs = '--rpc-url https://soroban-testnet.stellar.org --network-passphrase "Test SDF Network ; September 2015"';

  const deployContract = (wasmPath: string, sourceSecret: string): string => {
    try {
      const command = `stellar contract deploy --wasm ${wasmPath} --source ${sourceSecret} ${networkArgs}`;
      const contractId = execSync(command).toString().trim();
      return contractId;
    } catch (error) {
      console.error(`❌ Error al desplegar ${wasmPath}:`, error instanceof Error ? error.message : error);
      throw error;
    }
  };

  process.stdout.write('   - Desplegando Doctor Registry... ');
  const doctorRegistryId = deployContract('./soroban/target/wasm32v1-none/release/registry.wasm', adminKeypair.secret());
  console.log(`✅ ID: ${doctorRegistryId}`);

  process.stdout.write('   - Desplegando Dispensary Registry... ');
  const dispensaryRegistryId = deployContract('./soroban/target/wasm32v1-none/release/dispensary_registry.wasm', adminKeypair.secret());
  console.log(`✅ ID: ${dispensaryRegistryId}`);

  process.stdout.write('   - Desplegando Prescription Contract... ');
  const prescriptionContractId = deployContract('./soroban/target/wasm32v1-none/release/prescription.wasm', adminKeypair.secret());
  console.log(`✅ ID: ${prescriptionContractId}`);

  process.stdout.write('   - Desplegando Dispense Record... ');
  const dispenseRecordContractId = deployContract('./soroban/target/wasm32v1-none/release/dispense_record.wasm', adminKeypair.secret());
  console.log(`✅ ID: ${dispenseRecordContractId}\n`);

  console.log('👉 Paso 4: Inicializando contratos inteligentes con sus gobernanzas...');
  const server = new StellarSdk.rpc.Server('https://soroban-testnet.stellar.org');

  const invokeInit = async (contractId: string, method: string, args: StellarSdk.xdr.ScVal[]) => {
    const contract = new StellarSdk.Contract(contractId);
    const sourceAccount = await server.getAccount(adminKeypair.publicKey());
    let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    transaction = await server.prepareTransaction(transaction);
    transaction.sign(adminKeypair);

    const sendResult = await server.sendTransaction(transaction);
    const txHash = sendResult.hash;

    let completed = null;
    for (let i = 0; i < 15; i++) {
      completed = await server.getTransaction(txHash);
      if (completed.status !== StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND) {
        break;
      }
      await sleep(1500);
    }

    if (!completed || completed.status !== StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
      throw new Error(`Fallo al inicializar ${method} en el contrato ${contractId}`);
    }
  };

  process.stdout.write('   - Inicializando Doctor Registry... ');
  await invokeInit(doctorRegistryId, 'init', [StellarSdk.Address.fromString(adminKeypair.publicKey()).toScVal()]);
  console.log('✅ OK');

  process.stdout.write('   - Inicializando Dispensary Registry... ');
  await invokeInit(dispensaryRegistryId, 'init', [StellarSdk.Address.fromString(adminKeypair.publicKey()).toScVal()]);
  console.log('✅ OK');

  process.stdout.write('   - Inicializando Prescription Contract... ');
  await invokeInit(prescriptionContractId, 'init', [
    StellarSdk.Address.fromString(doctorRegistryId).toScVal(),
    StellarSdk.Address.fromString(dispensaryRegistryId).toScVal(),
  ]);
  console.log('✅ OK');

  process.stdout.write('   - Inicializando Dispense Record... ');
  await invokeInit(dispenseRecordContractId, 'init', [
    StellarSdk.Address.fromString(adminKeypair.publicKey()).toScVal(),
    StellarSdk.Address.fromString(prescriptionContractId).toScVal(),
    StellarSdk.Address.fromString(dispensaryRegistryId).toScVal(),
  ]);
  console.log('✅ OK\n');

  console.log('👉 Paso 5: Registrando Médico y Dispensario en gobernanza...');
  
  // Utilizar funciones dinámicas para registrar médico
  const registerActor = async (registryId: string, actorAddress: string, role: string) => {
    const contract = new StellarSdk.Contract(registryId);
    const sourceAccount = await server.getAccount(adminKeypair.publicKey());
    let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
      .addOperation(contract.call(role === 'doctor' ? 'add_doctor' : 'add_dispensary', 
        StellarSdk.Address.fromString(adminKeypair.publicKey()).toScVal(),
        StellarSdk.Address.fromString(actorAddress).toScVal()
      ))
      .setTimeout(30)
      .build();

    transaction = await server.prepareTransaction(transaction);
    transaction.sign(adminKeypair);

    const sendResult = await server.sendTransaction(transaction);
    const txHash = sendResult.hash;

    let completed = null;
    for (let i = 0; i < 15; i++) {
      completed = await server.getTransaction(txHash);
      if (completed.status !== StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND) {
        break;
      }
      await sleep(1500);
    }

    if (!completed || completed.status !== StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
      throw new Error(`Fallo al registrar actor en el contrato ${registryId}`);
    }
  };

  process.stdout.write('   - Registrando Médico... ');
  await registerActor(doctorRegistryId, doctorKeypair.publicKey(), 'doctor');
  console.log('✅ OK');

  process.stdout.write('   - Registrando Dispensario... ');
  await registerActor(dispensaryRegistryId, dispensaryKeypair.publicKey(), 'dispensary');
  console.log('✅ OK\n');

  console.log('👉 Paso 6: Guardando variables de entorno en el archivo `.env`...');
  const envContent = `# Stellar Configuration
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Contratos Inteligentes Desplegados
STELLAR_REGISTRY_CONTRACT_ID=${doctorRegistryId}
STELLAR_DISPENSARY_REGISTRY_CONTRACT_ID=${dispensaryRegistryId}
STELLAR_PRESCRIPTION_CONTRACT_ID=${prescriptionContractId}
STELLAR_DISPENSE_RECORD_CONTRACT_ID=${dispenseRecordContractId}

# Cuentas e Identidades Reales de Prueba
STELLAR_ADMIN_ADDRESS=${adminKeypair.publicKey()}
STELLAR_ADMIN_SECRET=${adminKeypair.secret()}

STELLAR_DOCTOR_ADDRESS=${doctorKeypair.publicKey()}
STELLAR_DOCTOR_SECRET=${doctorKeypair.secret()}

STELLAR_DISPENSARY_ADDRESS=${dispensaryKeypair.publicKey()}
STELLAR_DISPENSARY_SECRET=${dispensaryKeypair.secret()}

STELLAR_DEMO_PATIENT_ADDRESS=${patientKeypair.publicKey()}

# Public Vite client configuration for Passkeys on Testnet
VITE_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
VITE_STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
`;

  writeFileSync('.env', envContent, 'utf-8');
  console.log('✅ ¡Archivo `.env` guardado con éxito!');
  
  console.log('\n================================================================');
  console.log('🎉 ¡ENTORNO INICIALIZADO DE FORMA EXITOSA EN TESTNET!');
  console.log('================================================================');
}

main().catch((error) => {
  console.error('\n❌ ERROR EN LA INICIALIZACIÓN:', error);
  process.exit(1);
});
