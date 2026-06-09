import { execSync } from 'child_process';
import 'dotenv/config';

const vars = [
  { key: 'STELLAR_REGISTRY_CONTRACT_ID', value: process.env.STELLAR_REGISTRY_CONTRACT_ID },
  { key: 'STELLAR_DISPENSARY_REGISTRY_CONTRACT_ID', value: process.env.STELLAR_DISPENSARY_REGISTRY_CONTRACT_ID },
  { key: 'STELLAR_PRESCRIPTION_CONTRACT_ID', value: process.env.STELLAR_PRESCRIPTION_CONTRACT_ID },
  { key: 'STELLAR_DISPENSE_RECORD_CONTRACT_ID', value: process.env.STELLAR_DISPENSE_RECORD_CONTRACT_ID },
  { key: 'STELLAR_ADMIN_ADDRESS', value: process.env.STELLAR_ADMIN_ADDRESS },
  { key: 'STELLAR_ADMIN_SECRET', value: process.env.STELLAR_ADMIN_SECRET },
  { key: 'STELLAR_DOCTOR_ADDRESS', value: process.env.STELLAR_DOCTOR_ADDRESS },
  { key: 'STELLAR_DOCTOR_SECRET', value: process.env.STELLAR_DOCTOR_SECRET },
  { key: 'STELLAR_DISPENSARY_ADDRESS', value: process.env.STELLAR_DISPENSARY_ADDRESS },
  { key: 'STELLAR_DISPENSARY_SECRET', value: process.env.STELLAR_DISPENSARY_SECRET },
  { key: 'STELLAR_DEMO_PATIENT_ADDRESS', value: process.env.STELLAR_DEMO_PATIENT_ADDRESS },
  { key: 'STELLAR_NETWORK', value: 'testnet' },
  { key: 'STELLAR_HORIZON_URL', value: 'https://horizon-testnet.stellar.org' },
  { key: 'STELLAR_RPC_URL', value: 'https://soroban-testnet.stellar.org' },
  { key: 'STELLAR_NETWORK_PASSPHRASE', value: 'Test SDF Network ; September 2015' }
];

console.log('🚀 CONFIGURANDO VARIABLES DE ENTORNO EN VERCEL (PRODUCTION)...');

for (const v of vars) {
  if (!v.value) {
    console.warn(`⚠️ Omitiendo ${v.key} porque no tiene valor en .env`);
    continue;
  }
  
  process.stdout.write(`👉 Configurando ${v.key}... `);
  try {
    const cmd = `vercel env add ${v.key} production --value "${v.value}" --yes --force`;
    execSync(cmd, { stdio: 'pipe' });
    console.log('✅ OK');
  } catch (error: any) {
    console.log('❌ FALLÓ');
    console.error(`Error al configurar ${v.key}:`, error.message);
  }
}

console.log('\n🎉 ¡CONFIGURACIÓN DE VARIABLES EN VERCEL COMPLETADA!');
