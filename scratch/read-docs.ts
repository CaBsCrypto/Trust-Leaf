import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

async function main() {
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
  
  // 1. Leer solicitudes de Médicos
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/doctorApplications`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('--- SOLICITUDES DE MÉDICOS EN FIRESTORE ---');
      if (!data.documents || data.documents.length === 0) {
        console.log('No hay solicitudes de médicos en Firestore.');
      } else {
        data.documents.forEach((doc: any) => {
          const fields = doc.fields || {};
          console.log(`- ID: ${doc.name.split('/').pop()}`);
          console.log(`  Nombre: ${fields.name?.stringValue}`);
          console.log(`  Contacto: ${fields.contact?.stringValue}`);
          console.log(`  Status: ${fields.status?.stringValue}`);
          console.log(`  SubmittedAt: ${fields.submittedAt?.stringValue}`);
        });
      }
    } else {
      console.error('Error al leer de Firestore (Médicos):', response.status, await response.text());
    }
  } catch (err) {
    console.error('Error fetching doctors:', err);
  }

  // 2. Leer solicitudes de Dispensarios
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/dispensaryApplications`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n--- SOLICITUDES DE DISPENSARIOS EN FIRESTORE ---');
      if (!data.documents || data.documents.length === 0) {
        console.log('No hay solicitudes de dispensarios en Firestore.');
      } else {
        data.documents.forEach((doc: any) => {
          const fields = doc.fields || {};
          console.log(`- ID: ${doc.name.split('/').pop()}`);
          console.log(`  Nombre: ${fields.name?.stringValue}`);
          console.log(`  Contacto: ${fields.contact?.stringValue}`);
          console.log(`  Status: ${fields.status?.stringValue}`);
          console.log(`  SubmittedAt: ${fields.submittedAt?.stringValue}`);
        });
      }
    } else {
      console.error('Error al leer de Firestore (Dispensarios):', response.status, await response.text());
    }
  } catch (err) {
    console.error('Error fetching dispensaries:', err);
  }
}

main();
