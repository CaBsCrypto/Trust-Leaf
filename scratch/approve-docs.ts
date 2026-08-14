import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

async function approveDocs() {
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

  // 1. Approve Doctor doc-req-1780643359231
  const docId = 'doc-req-1780643359231';
  const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/doctorApplications/${docId}`;
  
  try {
    // We fetch first to get the existing fields
    const getRes = await fetch(docUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (getRes.ok) {
      const docData = await getRes.json();
      const fields = docData.fields;
      fields.status = { stringValue: 'approved' };
      fields.reviewedAt = { stringValue: new Date().toISOString() };
      
      const updateRes = await fetch(docUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: docData.name,
          fields: fields
        })
      });

      if (updateRes.ok) {
        console.log(`🎉 Doctor ${docId} approved successfully in Firestore!`);
      } else {
        console.error(`❌ Failed to approve doctor ${docId}:`, updateRes.status, await updateRes.text());
      }
    } else {
      console.error(`❌ Doctor ${docId} not found in Firestore:`, getRes.status, await getRes.text());
    }
  } catch (err) {
    console.error(err);
  }

  // 2. Approve Dispensary disp-req-1780643612001
  const dispId = 'disp-req-1780643612001';
  const dispUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/dispensaryApplications/${dispId}`;
  
  try {
    const getRes = await fetch(dispUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (getRes.ok) {
      const docData = await getRes.json();
      const fields = docData.fields;
      fields.status = { stringValue: 'approved' };
      fields.reviewedAt = { stringValue: new Date().toISOString() };
      
      const updateRes = await fetch(dispUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: docData.name,
          fields: fields
        })
      });

      if (updateRes.ok) {
        console.log(`🎉 Dispensary ${dispId} approved successfully in Firestore!`);
      } else {
        console.error(`❌ Failed to approve dispensary ${dispId}:`, updateRes.status, await updateRes.text());
      }
    } else {
      console.error(`❌ Dispensary ${dispId} not found in Firestore:`, getRes.status, await getRes.text());
    }
  } catch (err) {
    console.error(err);
  }
}

approveDocs();
