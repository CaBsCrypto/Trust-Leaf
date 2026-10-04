import { startDemo } from './server.mjs';
import { createRuntime } from './runtime.mjs';
// Trusted test injection, never a request parameter or published configuration.
const demo = await startDemo(0, generation => {
  if (generation !== 1) throw new Error('SYNTHETIC_RESET_FAILURE');
  return createRuntime(generation);
});
console.log(`LOCAL_DEMO_READY ${demo.url}`);
process.on('message', async message => { if (message === 'close') { await demo.close(); process.exit(0); } });
