import ts from 'typescript';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }).trim();
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const tracked = new Set(git(['ls-files']).split('\n').map(f => path.resolve(f).toLowerCase()));
const originals = new Map(git(['diff', '--name-only', 'HEAD']).split('\n').filter(f => /\.(ts|tsx)$/.test(f))
  .map(f => [path.resolve(f).toLowerCase(), git(['show', `HEAD:${f}`])]));
const host = ts.createCompilerHost(parsed.options), read = host.readFile;
host.readFile = f => originals.get(path.resolve(f).toLowerCase()) ?? read(f);
const baseline = ts.getPreEmitDiagnostics(ts.createProgram(parsed.fileNames.filter(f => tracked.has(path.resolve(f).toLowerCase())), parsed.options, host));
const current = ts.getPreEmitDiagnostics(ts.createProgram(parsed.fileNames, parsed.options));
const key = d => `${d.file ? path.relative(process.cwd(), d.file.fileName) : 'config'}|${d.code}|${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`;
const remaining = new Map();
for (const d of baseline) remaining.set(key(d), (remaining.get(key(d)) ?? 0) + 1);
const added = current.filter(d => { const n = remaining.get(key(d)) ?? 0; if (n) { remaining.set(key(d), n - 1); return false; } return true; });
console.log(JSON.stringify({ baselineDiagnostics: baseline.length, currentDiagnostics: current.length, addedDiagnostics: added.length }, null, 2));
if (added.length) { console.error(ts.formatDiagnosticsWithColorAndContext(added, { getCurrentDirectory: () => process.cwd(), getCanonicalFileName: f => f, getNewLine: () => '\n' })); process.exitCode = 1; }
console.log('This comparison does not replace a clean npm run lint; baseline diagnostics remain release blockers.');
