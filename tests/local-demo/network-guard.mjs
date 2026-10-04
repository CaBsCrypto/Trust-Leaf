import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
import dns from 'node:dns';
import dgram from 'node:dgram';
import workers from 'node:worker_threads';
import child from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

export const blockedTransports = [];
function deny(kind) { return () => { blockedTransports.push(kind); throw new Error('LOCAL_NETWORK_DISABLED'); }; }
globalThis.fetch = async () => { blockedTransports.push('fetch'); throw new Error('LOCAL_NETWORK_DISABLED'); };
net.Socket.prototype.connect = deny('tcp');
net.connect = net.createConnection = deny('tcp');
tls.connect = deny('tls');
http.request = http.get = deny('http');
https.request = https.get = deny('https');
http2.connect = deny('http2');
dgram.createSocket = deny('udp');
for (const key of ['bind', 'connect', 'send']) dgram.Socket.prototype[key] = deny('udp');
dgram.Socket = class { constructor() { deny('udp')(); } };
for (const api of [dns, dns.promises]) for (const key of Object.keys(api)) {
  if (/^(lookup|resolve|reverse)/.test(key) && typeof api[key] === 'function') api[key] = deny('dns');
}
for (const Resolver of [dns.Resolver, dns.promises.Resolver]) for (const key of Object.getOwnPropertyNames(Resolver.prototype)) {
  if (/^(resolve|reverse)/.test(key)) Resolver.prototype[key] = deny('dns-resolver');
}
// Node's listen implementation resolves even numeric addresses. No DNS request.
dns.lookup = (host, options, callback) => {
  if (host !== '127.0.0.1') return deny('dns')();
  const done = typeof options === 'function' ? options : callback;
  queueMicrotask(() => options?.all ? done(null, [{ address: host, family: 4 }]) : done(null, host, 4));
};
dns.promises.lookup = async host => {
  if (host !== '127.0.0.1') return deny('dns')();
  return { address: host, family: 4 };
};
syncBuiltinESMExports();
// Vite's bundled compiler may spawn only during the local build, before admission.
export function lockSubprocesses() {
  for (const key of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) child[key] = deny('subprocess');
  workers.Worker = class { constructor() { deny('worker')(); } };
  syncBuiltinESMExports();
}
