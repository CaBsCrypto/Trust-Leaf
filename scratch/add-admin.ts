import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

async function main() {
  const args = process.argv.slice(2);
  const emailToAuthorize = args[0]?.trim() || 'cabscryptocontacto@gmail.com';

  console.log(`🤖 Iniciando búsqueda y registro de administrador para: ${emailToAuthorize}`);

  // 1. Cargar las credenciales de Firebase CLI desde el archivo de configuración
  let tokens: any = null;
  try {
    process.stdout.write('🔑 Leyendo credenciales de Firebase CLI... ');
    const configPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
    const content = readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(content);
    tokens = parsed.tokens;
    
    if (!tokens || !tokens.access_token) {
      throw new Error('No se encontraron tokens válidos. Intenta iniciar sesión con "npx firebase login".');
    }
    console.log('✅ OK');
  } catch (error) {
    console.log('❌ FALLÓ');
    console.error('\nError al leer las credenciales:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const accessToken = tokens.access_token;
  const projectId = firebaseConfig.projectId;

  // 2. Buscar el UID del correo usando la API REST de Identity Toolkit (Firebase Auth)
  let adminUid = '';
  try {
    process.stdout.write(`🔎 Buscando UID de Firebase para ${emailToAuthorize}... `);
    const authLookupUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`;
    
    const lookupResponse = await fetch(authLookupUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: [emailToAuthorize],
      }),
    });

    if (!lookupResponse.ok) {
      throw new Error(`Lookup falló (${lookupResponse.status}): ${await lookupResponse.text()}`);
    }

    const lookupResult = await lookupResponse.json();
    if (!lookupResult.users || lookupResult.users.length === 0) {
      throw new Error(`El usuario con correo ${emailToAuthorize} no existe en Firebase Authentication. Recuerda ingresar a la web y registrarte primero.`);
    }

    adminUid = lookupResult.users[0].localId;
    console.log(`✅ UID Encontrado: ${adminUid}`);
  } catch (error) {
    console.log('❌ FALLÓ');
    console.error('\nError al buscar el usuario:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // 3. Construir la consulta REST para Firestore
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/appAdministrators/${adminUid}`;

  const payload = {
    name: `projects/${projectId}/databases/${databaseId}/documents/appAdministrators/${adminUid}`,
    fields: {
      role: { stringValue: 'admin' },
      createdAt: { stringValue: new Date().toISOString() },
    },
  };

  // 4. Realizar la petición HTTP PATCH para guardar el documento
  try {
    process.stdout.write('📤 Escribiendo registro de admin en Firestore... ');
    const response = await fetch(`${url}?currentDocument.exists=false`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Intentar sin la condición currentDocument.exists por si ya existe el documento
      const retryResponse = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!retryResponse.ok) {
        throw new Error(`Error en Firestore REST API (${retryResponse.status}): ${await retryResponse.text()}`);
      }
    }

    console.log('✅ ¡DOCUMENTO DE ADMINISTRADOR CREADO CON ÉXITO!');
    console.log(`\nFelicidades, la cuenta "${emailToAuthorize}" con el UID "${adminUid}" ahora tiene permisos de administrador real en la red.`);
  } catch (error) {
    console.log('❌ FALLÓ');
    console.error('\nError al escribir en Firestore:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
