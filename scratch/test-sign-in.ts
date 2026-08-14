import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

async function verifyAdminDoc() {
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
  const adminUid = '1TIe7Y2o0fcXOHEi3RrQxN6peKU2';

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/appAdministrators/${adminUid}`;
  
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('🎉 Admin document found in Firestore!');
      console.log('Document fields:', JSON.stringify(data.fields, null, 2));
    } else {
      console.error('❌ Admin document NOT found or error:', response.status, await response.text());
    }
  } catch (err) {
    console.error(err);
  }
}

verifyAdminDoc();
