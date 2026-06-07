import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

async function inspectDoc() {
  const configPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
  let accessToken = '';
  try {
    const content = readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(content);
    accessToken = parsed.tokens.access_token;
  } catch (err) {
    console.error('Error reading token:', err);
    process.exit(1);
  }

  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  
  // Inspect Doctor Document
  const docId = 'doc-req-1780814250091';
  const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/doctorApplications/${docId}`;
  try {
    const response = await fetch(docUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (response.ok) {
      console.log('--- DOCTOR DOC ---');
      console.log(JSON.stringify(await response.json(), null, 2));
    } else {
      console.log('--- DOCTOR DOC NOT FOUND ---');
    }
  } catch (err) {
    console.error(err);
  }

  // Inspect Dispensary Document
  const dispUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/dispensaryApplications/disp-req-1780643612001`;
  try {
    const response = await fetch(dispUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (response.ok) {
      console.log('--- DISPENSARY DOC ---');
      console.log(JSON.stringify(await response.json(), null, 2));
    } else {
      console.log('--- DISPENSARY DOC NOT FOUND ---');
    }
  } catch (err) {
    console.error(err);
  }
}

inspectDoc();
