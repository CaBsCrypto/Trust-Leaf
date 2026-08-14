const MUTATION_FLAG = 'TRUSTLEAF_ALLOW_TESTNET_MUTATIONS';
const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const ALLOWED_RPC_URL = 'https://soroban-testnet.stellar.org';
const ALLOWED_HORIZON_URL = 'https://horizon-testnet.stellar.org';

type PilotEnvironment = Record<string, string | undefined>;

export function getPilotMutationSafety(env: PilotEnvironment = process.env) {
  const relayerUrl = env.STELLAR_RELAYER_URL?.trim();
  let relayerIsLocal = !relayerUrl;
  try {
    relayerIsLocal = !relayerUrl || ['localhost', '127.0.0.1', '::1'].includes(new URL(relayerUrl).hostname);
  } catch {
    relayerIsLocal = false;
  }
  const reasons = [
    env[MUTATION_FLAG] !== 'true' && `${MUTATION_FLAG} no esta habilitado`,
    env.TRUSTLEAF_PILOT_RUNTIME !== 'local-synthetic' && 'TRUSTLEAF_PILOT_RUNTIME debe ser local-synthetic',
    env.NODE_ENV === 'production' && 'NODE_ENV=production nunca permite mutaciones piloto',
    (env.STELLAR_NETWORK || 'testnet').toLowerCase() !== 'testnet' && 'STELLAR_NETWORK debe ser testnet',
    (env.STELLAR_NETWORK_PASSPHRASE || TESTNET_PASSPHRASE) !== TESTNET_PASSPHRASE && 'passphrase no corresponde a Stellar Testnet',
    (env.STELLAR_RPC_URL || ALLOWED_RPC_URL) !== ALLOWED_RPC_URL && 'RPC fuera de la allowlist testnet',
    (env.STELLAR_HORIZON_URL || ALLOWED_HORIZON_URL) !== ALLOWED_HORIZON_URL && 'Horizon fuera de la allowlist testnet',
    !relayerIsLocal && 'el relayer debe ejecutarse en localhost durante el piloto sintetico',
  ].filter(Boolean) as string[];

  return { enabled: reasons.length === 0, reasons };
}

export function assertTestnetMutationEnabled() {
  const safety = getPilotMutationSafety();

  if (!safety.enabled) {
    const error = new Error(
      `Mutaciones deshabilitadas por seguridad: ${safety.reasons.join('; ')}.`,
    ) as Error & { statusCode?: number; code?: string };
    error.statusCode = 503;
    error.code = 'TESTNET_MUTATIONS_DISABLED';
    throw error;
  }
}

export function sendPilotSafetyError(res: any, error: unknown, fallback: string) {
  const candidate = error as { statusCode?: number; code?: string; message?: string };
  res.status(candidate?.statusCode ?? 500).json({
    code: candidate?.code ?? 'INTERNAL_ERROR',
    message: candidate?.message ?? fallback,
  });
}
