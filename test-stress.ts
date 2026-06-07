import * as StellarSdk from '@stellar/stellar-sdk';
import { performance } from 'perf_hooks';

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const RPC_URL = "https://soroban-testnet.stellar.org";

async function runLatencyTest() {
  console.log("================================================================");
  console.log("⚡ PRUEBA DE LATENCIA Y ESTADO DE RED: STELLAR TESTNET");
  console.log("================================================================\n");

  const horizonServer = new StellarSdk.Horizon.Server(HORIZON_URL);
  const rpcServer = new StellarSdk.rpc.Server(RPC_URL);

  console.log("👉 1. Midiendo tiempos de respuesta individuales (Ping)...");
  
  // Test Horizon Ping
  const t0 = performance.now();
  try {
    await horizonServer.ledgers().limit(1).call();
    const t1 = performance.now();
    console.log(`   ✅ Horizon Testnet Ping:  ${(t1 - t0).toFixed(2)} ms`);
  } catch (err: any) {
    console.log(`   ❌ Horizon Testnet Falló: ${err.message}`);
  }

  // Test Soroban RPC Ping
  const t2 = performance.now();
  try {
    await rpcServer.getLatestLedger();
    const t3 = performance.now();
    console.log(`   ✅ Soroban RPC Ping:      ${(t3 - t2).toFixed(2)} ms`);
  } catch (err: any) {
    console.log(`   ❌ Soroban RPC Falló:     ${err.message}`);
  }
}

async function runConcurrentReadStressTest(requestsCount = 20) {
  console.log("\n================================================================");
  console.log(`🔥 PRUEBA DE ESTRÉS CONCURRENTE: LECTURA EN RPC (N=${requestsCount})`);
  console.log("================================================================\n");

  const rpcServer = new StellarSdk.rpc.Server(RPC_URL);
  console.log(`👉 Enviando ${requestsCount} consultas consecutivas de Ledger para estresar la conexión...`);
  
  const start = performance.now();
  const promises = [];
  
  for (let i = 0; i < requestsCount; i++) {
    promises.push(rpcServer.getLatestLedger());
  }

  try {
    const results = await Promise.all(promises);
    const end = performance.now();
    const totalTime = end - start;
    const avgTime = totalTime / requestsCount;
    
    console.log(`   ✅ Completado con éxito!`);
    console.log(`   - Tiempo Total Acumulado:   ${totalTime.toFixed(2)} ms`);
    console.log(`   - Latencia Promedio por Req: ${avgTime.toFixed(2)} ms`);
    console.log(`   - Última secuencia Ledger:  ${results[results.length - 1].sequence}`);
  } catch (err: any) {
    console.log(`   ❌ Error en ráfaga de estrés concurrente:`, err.message);
  }
}

async function runLocalRateLimiterStress() {
  console.log("\n================================================================");
  console.log("🛡️ PRUEBA DE ESTRÉS EN LÍMITES DE FRECUENCIA LOCAL (RATE LIMITER)");
  console.log("================================================================\n");

  console.log("👉 Simulando ráfaga de 10 peticiones rápidas a la API local...");
  
  const localUrl = "http://localhost:3000/api/stellar/faucet";
  const dummyPayload = { role: "patient", address: "GB2PFKB24QPIEB3VIKYTIEG7M4KRH5I4KBPV26LUC6KOE2YAWSCPXKZ6" };
  
  let rateLimitedCount = 0;
  let successCount = 0;

  for (let i = 0; i < 10; i++) {
    try {
      const response = await fetch(localUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dummyPayload),
      });

      if (response.status === 429) {
        rateLimitedCount++;
      } else if (response.ok) {
        successCount++;
      }
    } catch (err) {
      // Server might not be running locally in this exact script context
    }
  }

  console.log(`   📊 Resultado de la Simulación Local:`);
  console.log(`   - Intentos Realizados:          10`);
  console.log(`   - Solicitudes Aceptadas (200):   ${successCount}`);
  console.log(`   - Rechazadas por Rate Limit (429): ${rateLimitedCount}`);
  console.log(`     (Nota: El servidor debe estar corriendo localmente para ver resultados de rechazo 429).`);
}

async function main() {
  await runLatencyTest();
  await runConcurrentReadStressTest();
  await runLocalRateLimiterStress();
  
  console.log("\n================================================================");
  console.log("🎉 PRUEBAS DE LATENCIA Y ESTRÉS COMPLETADAS");
  console.log("================================================================");
}

main().catch((err) => {
  console.error("Fallo general en las pruebas de latencia:", err);
});
