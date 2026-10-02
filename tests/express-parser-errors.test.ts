import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import express from 'express';
import ts from 'typescript';
import { handleExpressParserError } from '../api/_lib/express-parser-errors.ts';

const marker = 'SYNTHETIC_PRIVATE_BODY_DO_NOT_LOG';
const pairs = [
  ['entity.parse.failed', 400, 'REQUEST_BODY_INVALID'],
  ['request.aborted', 400, 'REQUEST_BODY_INVALID'],
  ['request.size.invalid', 400, 'REQUEST_BODY_INVALID'],
  ['entity.verify.failed', 403, 'REQUEST_BODY_REJECTED'],
  ['entity.too.large', 413, 'REQUEST_BODY_TOO_LARGE'],
  ['encoding.unsupported', 415, 'REQUEST_BODY_UNSUPPORTED'],
  ['charset.unsupported', 415, 'REQUEST_BODY_UNSUPPORTED'],
  ['stream.encoding.set', 500, 'REQUEST_BODY_UNAVAILABLE'],
  ['stream.not.readable', 500, 'REQUEST_BODY_UNAVAILABLE'],
] as const;

test('known parser categories never propagate diagnostics or arbitrary status', () => {
  assert.equal(handleExpressParserError.length, 4);
  for (const [type, status, code] of pairs) {
    const output: Record<string, unknown> = {};
    const res: any = {
      setHeader(k: string, v: string) { output[k] = v; },
      status(value: number) { output.status = value; return this; },
      json(value: unknown) { output.body = value; },
    };
    handleExpressParserError({ type, status: 201, statusCode: 418, body: marker,
      message: marker, stack: marker, headers: { secret: marker } }, {} as any, res,
    () => assert.fail('known parser error reached downstream handler'));
    assert.deepEqual(output, { 'Cache-Control': 'no-store, private', status, body: { code } });
    assert.equal(JSON.stringify(output).includes(marker), false);
  }
});

test('unknown errors retain identity; failed transports consume known errors safely', () => {
  for (const error of [new SyntaxError(marker), { type: marker }, { type: '__proto__' }, null, marker]) {
    let forwarded: unknown = false;
    handleExpressParserError(error, {} as any, {} as any, value => { forwarded = value; });
    assert.equal(forwarded, error);
  }
  for (const state of [{ destroyed: true }, { writableEnded: true }, { socket: { destroyed: true } }, { headersSent: true }]) {
    const destroyed: unknown[] = [];
    handleExpressParserError({ type: 'entity.parse.failed', body: marker }, {} as any,
      { ...state, destroy(...args: unknown[]) { destroyed.push(args); },
        setHeader() { assert.fail('headers on failed transport'); },
        end() { assert.fail('must not normally finish a partial success response'); } } as any,
      () => assert.fail('original private error reached finalhandler'));
    assert.deepEqual(destroyed, 'headersSent' in state ? [[]] : []);
  }
});

const source = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('server.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const start = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'startServer') as ts.FunctionDeclaration;
const statements = [...start.body!.statements];
const jsonIndex = statements.findIndex(node => node.getText(ast) === 'app.use(express.json());');
const guardIndex = statements.findIndex(node => node.getText(ast) === 'app.use(handleExpressParserError);');
const rawIndex = statements.findIndex(node => node.getText(ast).startsWith("app.post('/api/team-mail-webhook',"));

test('actual server mounts the four-argument guard at the parser boundary', () => {
  assert.ok(jsonIndex >= 0);
  assert.equal(guardIndex, jsonIndex + 1);
  assert.ok(rawIndex >= 0 && rawIndex < jsonIndex);
  const retired = statements.filter(node => /app\.all\('\/api\/stellar\/(patient\/:address\/dashboard|dispensary\/validate-prescription)'/.test(node.getText(ast)));
  assert.equal(retired.length, 2);
  assert.ok(retired.every(node => statements.indexOf(node) < rawIndex));
  const imports = ast.statements.filter(node => ts.isImportDeclaration(node)
    && /express-parser-errors/.test(node.moduleSpecifier.getText(ast)));
  assert.equal(imports.length, 1);
});

for (const env of ['production', 'development']) {
  test(`actual JSON/raw parsers: bounded responses and zero private diagnostics in ${env}`, async () => {
    const app = express(); app.set('env', env);
    let businessCalls = 0, rawCalls = 0, rawBody: Buffer | undefined;
    const rawCall = (statements[rawIndex] as ts.ExpressionStatement).expression as ts.CallExpression;
    const rawParser = new Function('express', `return ${ts.transpileModule(rawCall.arguments[1].getText(ast), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText.replace(/;\s*$/, '')}`)(express);
    app.post('/api/team-mail-webhook', rawParser, (req, res) => {
      rawCalls++; rawBody = req.body; res.json({ bytes: req.body.length });
    });
    // Execute the actual parser registrations, without server startup or dotenv.
    const code = ts.transpileModule(statements.slice(jsonIndex, guardIndex + 1).map(node => node.getText(ast)).join('\n'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText;
    new Function('app', 'express', 'handleExpressParserError', code)(app, express, handleExpressParserError);
    app.post('/api/operations-pilot', (req, res) => { businessCalls++; res.json({ value: req.body }); });
    const server = http.createServer(app);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as net.AddressInfo).port;
    const originalConnect = net.Socket.prototype.connect, originalFetch = globalThis.fetch;
    const originalStderr = process.stderr.write, originals = new Map<string, any>();
    let diagnostics = '', outbound = 0;
    net.Socket.prototype.connect = function(...args: any[]) {
      const options = Array.isArray(args[0]) ? args[0][0] : args[0];
      if (!options || typeof options !== 'object' || Number(options.port) !== port || options.host !== '127.0.0.1') {
        outbound++; throw new Error('EXTERNAL_NETWORK_BLOCKED');
      }
      return originalConnect.apply(this, args as any);
    } as any;
    globalThis.fetch = async () => { outbound++; throw new Error('FETCH_BLOCKED'); };
    process.stderr.write = function(chunk: any, ...args: any[]) {
      diagnostics += String(chunk); args.find(arg => typeof arg === 'function')?.(); return true;
    } as any;
    for (const name of ['debug', 'info', 'log', 'warn', 'error']) {
      originals.set(name, (console as any)[name]);
      (console as any)[name] = (...args: unknown[]) => { diagnostics += JSON.stringify(args); };
    }
    async function request(body: string | Buffer, headers: Record<string, string> = {}, path = '/api/operations-pilot', chunked = false) {
      return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }>((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port, path, method: 'POST', headers: {
          'content-type': 'application/json', ...(chunked ? {} : { 'content-length': String(Buffer.byteLength(body)) }), ...headers,
        } }, res => {
          let text = ''; res.setEncoding('utf8'); res.on('data', value => { text += value; });
          res.on('end', () => { try { resolve({ status: res.statusCode!, headers: res.headers, body: JSON.parse(text) }); } catch (error) { reject(error); } });
        });
        req.on('error', reject); req.setTimeout(5000, () => req.destroy(new Error('SYNTHETIC_LOOPBACK_TIMEOUT')));
        if (chunked) req.write(body); req.end(chunked ? undefined : body);
      });
    }
    async function denied(body: string | Buffer, status: number, code: string, headers = {}, path?: string, chunked = false) {
      const before = businessCalls, beforeRaw = rawCalls;
      const result = await request(body, headers, path, chunked);
      assert.equal(result.status, status); assert.deepEqual(result.body, { code });
      assert.equal(result.headers['cache-control'], 'no-store, private');
      assert.match(String(result.headers['content-type']), /^application\/json/);
      assert.equal(businessCalls, before); assert.equal(rawCalls, beforeRaw);
    }
    try {
      await denied(`{"private":${marker}}`, 400, 'REQUEST_BODY_INVALID');
      await denied(`"${marker}"`, 400, 'REQUEST_BODY_INVALID');
      await denied('{}', 415, 'REQUEST_BODY_UNSUPPORTED', { 'content-type': 'application/json; charset=iso-8859-1' });
      await denied(marker, 415, 'REQUEST_BODY_UNSUPPORTED', { 'content-encoding': 'synthetic-unsupported' });
      const boundary = (size: number) => `"${'x'.repeat(size - 2)}"`;
      // JSON objects at the exact default limit, then declared/chunked oversize.
      const jsonBody = (size: number) => `{"x":"${'x'.repeat(size - 8)}"}`;
      assert.equal(Buffer.byteLength(jsonBody(102400)), 102400);
      assert.equal((await request(jsonBody(102400))).status, 200);
      await denied(jsonBody(102401), 413, 'REQUEST_BODY_TOO_LARGE');
      await denied(jsonBody(102401), 413, 'REQUEST_BODY_TOO_LARGE', {}, undefined, true);
      for (const body of ['{}', '[]', '']) assert.equal((await request(body)).status, 200);
      assert.deepEqual((await request(gzipSync('{"ok":true}'), { 'content-encoding': 'gzip' })).body, { value: { ok: true } });
      const raw = Buffer.from(` {\r\n"utf8":"\u00e1", "broken":${marker}}\r\n`);
      assert.equal((await request(raw, {}, '/api/team-mail-webhook')).status, 200);
      assert.deepEqual(rawBody, raw, 'raw bytes bypass JSON parsing unchanged');
      assert.equal((await request(boundary(65536), {}, '/api/team-mail-webhook')).status, 200);
      await denied(boundary(65537), 413, 'REQUEST_BODY_TOO_LARGE', {}, '/api/team-mail-webhook');
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(diagnostics, '', 'parser errors must not reach any logger');
      assert.equal(outbound, 0);
    } finally {
      net.Socket.prototype.connect = originalConnect; globalThis.fetch = originalFetch;
      process.stderr.write = originalStderr;
      for (const [name, original] of originals) (console as any)[name] = original;
      server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
}
