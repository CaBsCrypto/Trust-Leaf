import { spawn } from 'node:child_process';
import { once } from 'node:events';
const server = spawn(process.execPath, ['--import', 'tsx', 'tests/local-demo/server.mjs', '0'], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
let output = '', stderr = '';
server.stderr.on('data', data => { stderr += data; });
try {
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Local demo startup failed: ' + stderr)), 90000);
    server.once('exit', code => { clearTimeout(timer); reject(new Error('Local demo exited ' + code)); });
    server.stdout.on('data', data => { output += data; const match = output.match(/LOCAL_DEMO_READY (http:\/\/127\.0\.0\.1:\d+\/#[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
  });
  for (const script of ['journey.browser.mjs', 'boundaries.browser.mjs']) {
    const runner = spawn(process.execPath, ['tests/local-demo/' + script], { stdio: 'inherit', env: { ...process.env, LOCAL_DEMO_URL: url } });
    const [code] = await once(runner, 'exit'); process.exitCode = code ?? 1;
    if (process.exitCode !== 0) break;
  }
} finally {
  if (server.exitCode === null) { server.send('close'); await once(server, 'exit'); }
}
