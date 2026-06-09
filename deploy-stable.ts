import 'dotenv/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('================================================================');
  console.log('🚀 INICIANDO DESPLIEGUE ESTABLE DE CONTRATOS EN STELLAR TESTNET');
  console.log('================================================================\n');

  // Paso 1: Cargar claves secretas desde .env
  console.log('👉 Paso 1: Cargando credenciales del archivo .env...');
  
  const adminSecret = process.env.STELLAR_ADMIN_SECRET?.trim();
  const doctorSecret = process.env.STELLAR_DOCTOR_SECRET?.trim();
  const dispensarySecret = process.env.STELLAR_DISPENSARY_SECRET?.trim();
  const patientAddress = process.env.STELLAR_DEMO_PATIENT_ADDRESS?.trim();

  if (!adminSecret || !doctorSecret || !dispensarySecret || !patientAddress) {
    throw new Error(
      'Faltan variables obligatorias en el archivo .env (se necesitan ADMIN_SECRET, DOCTOR_SECRET, DISPENSARY_SECRET y DEMO_PATIENT_ADDRESS).'
    );
  }

  const adminKeypair = StellarSdk.Keypair.fromSecret(adminSecret);
  const doctorKeypair = StellarSdk.Keypair.fromSecret(doctorSecret);
  const dispensaryKeypair = StellarSdk.Keypair.fromSecret(dispensarySecret);

  console.log(`   - ADMIN (Emisor):      ${adminKeypair.publicKey()}`);
  console.log(`   - MÉDICO:              ${doctorKeypair.publicKey()}`);
  console.log(`   - DISPENSARIO:         ${dispensaryKeypair.publicKey()}`);
  console.log(`   - PACIENTE (Demo):     ${patientAddress}\n`);

  // Paso 2: Asegurar Fondeo con Friendbot
  console.log('👉 Paso 2: Asegurando fondos de prueba en Testnet (Friendbot)...');
  const accountsToFund = [
    { name: 'ADMIN', address: adminKeypair.publicKey() },
    { name: 'MÉDICO', address: doctorKeypair.publicKey() },
    { name: 'DISPENSARIO', address: dispensaryKeypair.publicKey() },
    { name: 'PACIENTE', address: patientAddress },
  ];

  for (const account of accountsToFund) {
    process.stdout.write(`   - Solicitando fondos para ${account.name}... `);
    try {
      const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(account.address)}`);
      if (response.ok) {
        console.log('✅ COMPLETADO');
      } else {
        console.log('ℹ️ YA FONDEADO / OK');
      }
    } catch {
      console.log('ℹ️ OK (Saltado)');
    }
  }
  console.log('   (Esperando 4 segundos para propagación del Ledger...)\n');
  await sleep(4000);

  // Paso 3: Despliegue de los Smart Contracts usando la CLI de Stellar
  console.log('👉 Paso 3: Desplegando Smart Contracts en Testnet...');
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
  const doctorRegistryId = deployContract('./soroban/target/wasm32v1-none/release/registry.wasm', adminSecret);
  console.log(`✅ ID: ${doctorRegistryId}`);

  process.stdout.write('   - Desplegando Dispensary Registry... ');
  const dispensaryRegistryId = deployContract('./soroban/target/wasm32v1-none/release/dispensary_registry.wasm', adminSecret);
  console.log(`✅ ID: ${dispensaryRegistryId}`);

  process.stdout.write('   - Desplegando Prescription Contract... ');
  const prescriptionContractId = deployContract('./soroban/target/wasm32v1-none/release/prescription.wasm', adminSecret);
  console.log(`✅ ID: ${prescriptionContractId}`);

  process.stdout.write('   - Desplegando Dispense Record... ');
  const dispenseRecordContractId = deployContract('./soroban/target/wasm32v1-none/release/dispense_record.wasm', adminSecret);
  console.log(`✅ ID: ${dispenseRecordContractId}\n`);

  // Paso 4: Inicialización de los contratos
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

  // Paso 5: Registrar actores en gobernanza
  console.log('👉 Paso 5: Registrando Médico y Dispensario en la gobernanza...');
  
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

  // Paso 6: Actualizar archivo .env con las nuevas direcciones
  console.log('👉 Paso 6: Guardando nuevos IDs en el archivo `.env`...');
  
  let envFile = readFileSync('.env', 'utf-8');

  // Reemplazar contratos en el archivo conservando los secretos e IPs
  const replacements = [
    { key: 'STELLAR_REGISTRY_CONTRACT_ID', value: doctorRegistryId },
    { key: 'STELLAR_DISPENSARY_REGISTRY_CONTRACT_ID', value: dispensaryRegistryId },
    { key: 'STELLAR_PRESCRIPTION_CONTRACT_ID', value: prescriptionContractId },
    { key: 'STELLAR_DISPENSE_RECORD_CONTRACT_ID', value: dispenseRecordContractId },
  ];

  for (const r of replacements) {
    const regex = new RegExp(`^${r.key}=.*$`, 'm');
    if (regex.test(envFile)) {
      envFile = envFile.replace(regex, `${r.key}=${r.value}`);
    } else {
      envFile += `\n${r.key}=${r.value}`;
    }
  }

  writeFileSync('.env', envFile, 'utf-8');
  console.log('✅ ¡Archivo `.env` actualizado de forma exitosa!');
  
  console.log('\n================================================================');
  console.log('🎉 ¡CONTRATOS ESTABLES DESPLEGADOS E INICIALIZADOS EN TESTNET!');
  console.log('================================================================');
}

main().catch((error) => {
  console.error('\n❌ ERROR EN EL DESPLIEGUE:', error);
  process.exit(1);
});
