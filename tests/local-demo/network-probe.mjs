import assert from 'node:assert/strict';
import { blockedTransports, lockSubprocesses } from './network-guard.mjs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dns from 'node:dns';
import http2 from 'node:http2';
import child from 'node:child_process';
import dgram from 'node:dgram';
import workers from 'node:worker_threads';
await assert.rejects(fetch('https://example.test'), /LOCAL_NETWORK_DISABLED/);
for (const operation of [() => http.get('http://example.test'), () => https.get('https://example.test'),
  () => net.connect(80, 'example.test'), () => tls.connect(443, 'example.test'), () => dns.lookup('example.test', () => {}),
  () => http2.connect('https://example.test'), () => dgram.createSocket('udp4'), () => new dgram.Socket('udp4'),
  () => new dns.Resolver().resolve4('example.test'), () => new dns.promises.Resolver().resolve4('example.test')]) assert.throws(operation, /LOCAL_NETWORK_DISABLED/);
lockSubprocesses(); assert.throws(() => child.spawn('unused-synthetic-command'), /LOCAL_NETWORK_DISABLED/);
assert.throws(() => new workers.Worker('unused-synthetic-worker'), /LOCAL_NETWORK_DISABLED/);
assert.equal(blockedTransports.length, 13);
console.log('PASS thirteen explicit Node outbound/worker attempts rejected before transport. Not an OS sandbox claim.');
