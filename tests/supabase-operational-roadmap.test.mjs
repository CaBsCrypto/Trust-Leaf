import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const roadmap = (await readFile(
  new URL('../docs/internal/supabase-operational-continuation-roadmap-20260826.md', import.meta.url),
  'utf8',
)).toLowerCase();

for (const expected of [
  'aplicado en supabase',
  '7 tablas',
  'rls enable+force 7/7',
  'cero policies',
  'preparado localmente',
  'legacy detectado',
  'firebase/firestore',
  'pendiente de autorización',
  'definition of done',
  'npm run qa:supabase-readiness',
  'no-go',
  'datos reales',
]) assert.match(roadmap, new RegExp(expected.replace(/[+/]/g, '\\$&')));

assert.doesNotMatch(roadmap, /cumplimiento (garantizado|asegurado)|listo para pacientes reales|go para producción/);
console.log('supabase operational continuation roadmap: verified/applied/local/pending states and resume gates passed');
