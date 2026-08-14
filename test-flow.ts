import * as StellarSdk from '@stellar/stellar-sdk';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

// Import our actual backend functions
import {
  fundTestnetAccount,
  registerDoctorOnTestnet,
  registerDispensaryOnTestnet,
  issuePrescriptionForPatient,
  dispensePrescriptionForPatient,
  validatePrescriptionForDispensary,
  getPatientDashboard,
  retainPrescriptionForDispensary,
  releasePrescriptionToPatient,
} from './api/_lib/stellar.ts';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('================================================================');
  console.log('🚀 INICIANDO PRUEBA DE INTEGRACIÓN DE FLUJO COMPLETO EN STELLAR');
  console.log('================================================================\n');

  // Paso 1: Generación de Cuentas Efímeras
  console.log('👉 Paso 1: Generando pares de claves efímeras para la prueba...');
  const adminKeypair = StellarSdk.Keypair.random();
  const doctorKeypair = StellarSdk.Keypair.random();
  const dispensaryKeypair = StellarSdk.Keypair.random();
  const patientKeypair = StellarSdk.Keypair.random();

  console.log(`   - ADMIN (Emisor):      ${adminKeypair.publicKey()}`);
  console.log(`   - MÉDICO:              ${doctorKeypair.publicKey()}`);
  console.log(`   - DISPENSARIO:         ${dispensaryKeypair.publicKey()}`);
  console.log(`   - PACIENTE:            ${patientKeypair.publicKey()}\n`);

  // Paso 2: Fondeo de Cuentas con Friendbot
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
  console.log('   (Espera técnica de 3 segundos para propagación del Ledger...)\n');
  await sleep(3000);

  // Paso 3: Despliegue de los Smart Contracts usando stellar-cli
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

  // Configurar las variables de entorno del proceso para que las use api/_lib/stellar.ts
  process.env.STELLAR_ADMIN_SECRET = adminKeypair.secret();
  process.env.STELLAR_DOCTOR_SECRET = doctorKeypair.secret();
  process.env.STELLAR_DISPENSARY_SECRET = dispensaryKeypair.secret();
  process.env.STELLAR_DEMO_PATIENT_ADDRESS = patientKeypair.publicKey();
  process.env.STELLAR_REGISTRY_CONTRACT_ID = doctorRegistryId;
  process.env.STELLAR_DISPENSARY_REGISTRY_CONTRACT_ID = dispensaryRegistryId;
  process.env.STELLAR_PRESCRIPTION_CONTRACT_ID = prescriptionContractId;
  process.env.STELLAR_DISPENSE_RECORD_CONTRACT_ID = dispenseRecordContractId;

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

    // Esperar confirmación
    let completed = null;
    for (let i = 0; i < 10; i++) {
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

  // init registry
  process.stdout.write('   - Inicializando Doctor Registry... ');
  await invokeInit(doctorRegistryId, 'init', [StellarSdk.Address.fromString(adminKeypair.publicKey()).toScVal()]);
  console.log('✅ OK');

  // init dispensary registry
  process.stdout.write('   - Inicializando Dispensary Registry... ');
  await invokeInit(dispensaryRegistryId, 'init', [StellarSdk.Address.fromString(adminKeypair.publicKey()).toScVal()]);
  console.log('✅ OK');

  // init prescription
  process.stdout.write('   - Inicializando Prescription Contract... ');
  await invokeInit(prescriptionContractId, 'init', [
    StellarSdk.Address.fromString(doctorRegistryId).toScVal(),
    StellarSdk.Address.fromString(dispensaryRegistryId).toScVal(),
  ]);
  console.log('✅ OK');

  // init dispense record
  process.stdout.write('   - Inicializando Dispense Record... ');
  await invokeInit(dispenseRecordContractId, 'init', [
    StellarSdk.Address.fromString(adminKeypair.publicKey()).toScVal(),
    StellarSdk.Address.fromString(prescriptionContractId).toScVal(),
    StellarSdk.Address.fromString(dispensaryRegistryId).toScVal(),
  ]);
  console.log('✅ OK\n');

  // Paso 5: Registrar y autorizar al Médico y al Dispensario
  console.log('👉 Paso 5: Registrando y autorizando al Médico y al Dispensario en gobernanza...');
  process.stdout.write('   - Autorizando Médico en el Doctor Registry... ');
  const docRegResult = await registerDoctorOnTestnet({ doctorAddress: doctorKeypair.publicKey() });
  console.log(`✅ (Tx: ${docRegResult.txHash})`);

  process.stdout.write('   - Autorizando Dispensario en el Dispensary Registry... ');
  const dispRegResult = await registerDispensaryOnTestnet({ dispensaryAddress: dispensaryKeypair.publicKey() });
  console.log(`✅ (Tx: ${dispRegResult.txHash})\n`);

  // Paso 6: Emisión de la Receta Digital (Creación del NFT)
  console.log('👉 Paso 6: El médico emite una receta digital al paciente (NFT temporal)...');
  const prescriptionResult = await issuePrescriptionForPatient({
    patientAddress: patientKeypair.publicKey(),
    treatment: 'Tratamiento terapéutico de prueba',
    dosage: '2 gramos diarios',
    notes: 'Uso de prueba sandbox',
    durationDays: 180, // 6 meses
    totalQuantity: 30, // 30 unidades totales
  });

  const prescriptionId = prescriptionResult.issuedId!;
  const assetCode = `RX${prescriptionId}`;
  console.log(`   - Receta emitida en Soroban ID: ${prescriptionId}`);
  console.log(`   - Hash clínico (SHA-256):       ${prescriptionResult.medicationHash}`);
  console.log(`   - Transacción Soroban Hash:      ${prescriptionResult.txHash}`);
  console.log(`   - Asset NFT clásico creado:      ${assetCode}`);
  console.log(`     🔗 Auditoría: https://stellar.expert/explorer/testnet/tx/${prescriptionResult.txHash}\n`);

  // Paso 7: Verificar existencia del Claimable Balance (NFT)
  console.log('👉 Paso 7: Verificando la existencia del NFT en Horizon a nombre del paciente...');
  const horizonServer = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
  let claimableBalanceId = '';

  const balances = await horizonServer
    .claimableBalances()
    .claimant(patientKeypair.publicKey())
    .asset(new StellarSdk.Asset(assetCode, doctorKeypair.publicKey()))
    .call();

  if (balances.records.length > 0) {
    claimableBalanceId = balances.records[0].id;
    console.log(`   ✅ NFT ENCONTRADO! Balance Reclamable ID: ${claimableBalanceId}`);
    console.log(`   - Predicados de Expiración del Paciente en Horizon:`, JSON.stringify(balances.records[0].claimants, null, 2));
  } else {
    throw new Error('No se pudo encontrar el Claimable Balance del NFT de la receta.');
  }
  console.log('');

  // Paso 7.5: Retener Receta con Bloqueo de Permanencia en el Dispensario
  console.log('👉 Paso 7.5: Probando Retención Criptográfica con bloqueo de permanencia (90 días)...');
  const retainResult = await retainPrescriptionForDispensary({
    prescriptionId,
    dispensaryAddress: dispensaryKeypair.publicKey(),
    lockPeriodDays: 90,
  });
  console.log(`   ✅ Retención exitosa en Stellar! Tx: ${retainResult.txHash}`);

  // Verificar que el Claimable Balance retenido tenga los predicados correctos en Horizon
  console.log('   - Verificando los predicados condicionales del balance retenido en Horizon...');
  const retainedBalances = await horizonServer
    .claimableBalances()
    .asset(new StellarSdk.Asset(assetCode, doctorKeypair.publicKey()))
    .call();
  
  if (retainedBalances.records.length > 0) {
    const record = retainedBalances.records[0];
    console.log(`   ✅ NFT Retenido Encontrado en Horizon! ID: ${record.id}`);
    console.log(`   Claimants en Ledger:`, JSON.stringify(record.claimants, null, 2));
    
    if (record.claimants.length < 2) {
      throw new Error('El balance retenido debería tener al menos 2 reclamantes (Dispensario y Paciente).');
    }
  } else {
    throw new Error('No se encontró el Claimable Balance retenido.');
  }
  console.log('');

  // Paso 7.6: Devolver el NFT al paciente mediante el flujo de Liberación (Release) de vuelta incondicional
  console.log('👉 Paso 7.6: Liberando la receta de vuelta al paciente...');
  const releaseResult = await releasePrescriptionToPatient({ prescriptionId });
  console.log(`   ✅ Receta liberada con éxito! Tx: ${releaseResult.txHash}`);
  
  // Re-obtener el claimable balance del paciente para continuar con los retiros normales
  console.log('   - Re-obteniendo el balance del paciente posterior a la liberación...');
  const reBalances = await horizonServer
    .claimableBalances()
    .claimant(patientKeypair.publicKey())
    .asset(new StellarSdk.Asset(assetCode, doctorKeypair.publicKey()))
    .call();
  if (reBalances.records.length > 0) {
    console.log(`   ✅ NFT del paciente recuperado para retiros normales! ID: ${reBalances.records[0].id}`);
  } else {
    throw new Error('No se pudo recuperar el Claimable Balance del paciente tras la liberación.');
  }
  console.log('');

  // Paso 8: Retiro Parcial y Aserción
  console.log('👉 Paso 8: Paciente realiza un RETIRO PARCIAL de 10 unidades en el dispensario...');
  console.log('   (El dispensario valida la receta on-chain y ejecuta el retiro parcial)');
  
  const partialDispenseResult = await dispensePrescriptionForPatient({
    prescriptionId,
    productLabel: 'Medicamento Test 10g',
    batchLabel: 'LOTE-TEST-P8',
    quantity: 10,
  });

  console.log(`   - Retiro registrado con éxito! Comprobante ID: ${partialDispenseResult.recordId}`);
  console.log(`   - Transacción Soroban Hash: ${partialDispenseResult.txHash}`);

  // Verificar si el NFT se preservó (porque quedan 20 unidades)
  process.stdout.write('   - Validando que el NFT NO haya sido quemado de forma anticipada... ');
  const balanceCheckPartial = await horizonServer
    .claimableBalances()
    .claimant(patientKeypair.publicKey())
    .asset(new StellarSdk.Asset(assetCode, doctorKeypair.publicKey()))
    .call();

  if (balanceCheckPartial.records.length > 0) {
    console.log('✅ EXITOSO (El paciente conserva su NFT para retirar sus otras 20 unidades).');
  } else {
    throw new Error('¡ERROR DE FLUJO! El NFT fue destruido de forma prematura durante un retiro parcial.');
  }
  console.log('');

  // Paso 9: Retiro Final y Quema (Clawback)
  console.log('👉 Paso 9: Paciente realiza el RETIRO FINAL de las 20 unidades restantes...');
  console.log('   (El dispensario procesa la entrega final del saldo restante)');
  
  const finalDispenseResult = await dispensePrescriptionForPatient({
    prescriptionId,
    productLabel: 'Medicamento Test 20g',
    batchLabel: 'LOTE-TEST-P9',
    quantity: 20,
  });

  console.log(`   - Retiro registrado con éxito! Comprobante ID: ${finalDispenseResult.recordId}`);
  console.log(`   - Transacción Soroban Hash: ${finalDispenseResult.txHash}`);
  console.log(`   - Transacción Clawback (Quema) Hash: ${finalDispenseResult.clawbackTxHash || 'OMITIDA'}`);

  // Verificar que el NFT se haya quemado con éxito
  process.stdout.write('   - Validando que el NFT HAYA SIDO QUEMADO (Clawback) del Ledger... ');
  const balanceCheckFinal = await horizonServer
    .claimableBalances()
    .claimant(patientKeypair.publicKey())
    .asset(new StellarSdk.Asset(assetCode, doctorKeypair.publicKey()))
    .call();

  if (balanceCheckFinal.records.length === 0) {
    console.log('✅ EXITOSO (El NFT desapareció permanentemente de Horizon).');
  } else {
    throw new Error('¡ERROR DE FLUJO! El NFT sigue existiendo en testnet a pesar de agotar el saldo.');
  }
  console.log('');

  // Paso 10: Validación del Historial
  console.log('👉 Paso 10: Validando acceso al historial del paciente en Testnet...');
  const validationResult = await validatePrescriptionForDispensary({ prescriptionId });
  console.log(`   - Receta ID ${prescriptionId} Estado Final:  ${validationResult.prescription.status.toUpperCase()}`);
  console.log(`   - Unidades Totales Autorizadas:           ${validationResult.prescription.totalQuantity}`);
  console.log(`   - Unidades Retiradas (Dispensadas):       ${validationResult.prescription.dispensedQuantity}`);
  console.log(`   - Unidades Disponibles:                   ${validationResult.prescription.remainingQuantity}`);
  console.log(`   - Habilitado para más dispensación:        ${validationResult.validation.canDispense ? 'SÍ' : 'NO'}`);
  console.log(`   - Motivo del estado:                      ${validationResult.validation.reason}`);
  console.log(`   ✅ HISTORIAL TOTALMENTE ACCESIBLE A PESAR DE LA QUEMA DEL NFT`);
  
  console.log('\n================================================================');
  console.log('🎉 ¡TODAS LAS PRUEBAS DE FLUJO PASARON CON EXCELENCIA (100%)!');
  console.log('================================================================');
}

main().catch((error) => {
  console.error('\n❌ ERROR EN LA EJECUCIÓN DEL FLUJO DE PRUEBA:', error);
  process.exit(1);
});
