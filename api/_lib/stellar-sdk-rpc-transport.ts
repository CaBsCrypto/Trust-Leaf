// @ts-nocheck -- see stellar.ts: Vercel's api typecheck resolves incompatible legacy SDK declarations.
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import * as StellarSdkRuntime from '@stellar/stellar-sdk';
import type * as LegacyStellarSdk from 'stellar-sdk';
const StellarSdk = StellarSdkRuntime as unknown as typeof LegacyStellarSdk;
import type { ConfirmationResult, OpaqueContractInvocation, SignedEnvelope, StellarRpcTransport } from './stellar-testnet-rpc-adapter.ts';
import { assertTestnetMutationEnabled } from './pilot-safety.js';

type RpcServer = InstanceType<typeof StellarSdk.rpc.Server>;

export function createStellarSdkRpcTransport(input: {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
  sourcePublicKey: string;
  baseFee?: string;
  server?: RpcServer;
}): StellarRpcTransport {
  const server = input.server ?? new StellarSdk.rpc.Server(input.rpcUrl, { allowHttp: false });
  const contract = new StellarSdk.Contract(input.contractId);
  return {
    kind: 'stellar-rpc',
    async simulate(invocation) {
      try {
        const account = await server.getAccount(input.sourcePublicKey);
        const transaction = new StellarSdk.TransactionBuilder(account, {
          fee: input.baseFee ?? StellarSdk.BASE_FEE,
          networkPassphrase: input.networkPassphrase,
        }).addOperation(contract.call(invocation.functionName, ...contractArgs(invocation)))
          .setTimeout(60)
          .build();
        const simulation = await server.simulateTransaction(transaction);
        if (StellarSdk.rpc.Api.isSimulationError(simulation)) return { status: 'failed', errorCode: 'SIMULATION_REJECTED' };
        const prepared = StellarSdk.rpc.assembleTransaction(transaction, simulation).build();
        return { status: 'ready', envelope: { xdr: prepared.toXDR(), transactionHash: prepared.hash().toString('hex') } };
      } catch { return { status: 'failed', errorCode: 'RPC_SIMULATION_FAILED' }; }
    },
    async submit(envelope: SignedEnvelope) {
      try {
        assertTestnetMutationEnabled();
        const transaction = StellarSdk.TransactionBuilder.fromXDR(envelope.signedXdr, input.networkPassphrase);
        const result = await server.sendTransaction(transaction);
        if (result.hash.toLowerCase() !== envelope.transactionHash.toLowerCase()) return { status: 'failed', transactionHash: envelope.transactionHash, errorCode: 'TX_HASH_MISMATCH' };
        if (result.status === 'ERROR') return { status: 'failed', transactionHash: result.hash, errorCode: 'SUBMISSION_REJECTED' };
        return { status: 'submitted', transactionHash: result.hash };
      } catch { return { status: 'failed', transactionHash: envelope.transactionHash, errorCode: 'RPC_SUBMISSION_FAILED' }; }
    },
    async confirm(transactionHash) {
      try {
        const result = await server.getTransaction(transactionHash);
        if (result.status === 'SUCCESS') return { status: 'confirmed', transactionHash, ledgerSequence: result.ledger };
        if (result.status === 'FAILED') return { status: 'failed', transactionHash, ledgerSequence: result.ledger, errorCode: 'TRANSACTION_FAILED' };
        return { status: result.status === 'NOT_FOUND' ? 'not_found' : 'pending', transactionHash };
      } catch { return { status: 'not_found', transactionHash, errorCode: 'RPC_CONFIRMATION_UNKNOWN' } as ConfirmationResult; }
    },
  };
}

function bytes32(value: string) {
  const hex = /^[a-f0-9]{64}$/i.test(value) ? value : createHash('sha256').update(value).digest('hex');
  return StellarSdk.nativeToScVal(Buffer.from(hex, 'hex'), { type: 'bytes' });
}

function contractArgs(value: OpaqueContractInvocation) {
  const common = [
    StellarSdk.nativeToScVal(value.actor, { type: 'address' }),
    bytes32(value.receiptHandle),
  ];
  if (value.functionName === 'issue') return [...common, bytes32(value.commitment), bytes32(value.operationId)];
  return [...common, StellarSdk.nativeToScVal(value.expectedVersion, { type: 'u32' }), bytes32(value.commitment), bytes32(value.operationId)];
}
