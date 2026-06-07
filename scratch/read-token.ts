import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

function main() {
  try {
    const configPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
    console.log(`Reading: ${configPath}`);
    const content = readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(content);
    
    console.log('Keys in JSON:', Object.keys(parsed));
    if (parsed.tokens) {
      console.log('Keys in tokens:', Object.keys(parsed.tokens));
    }
    if (parsed.user) {
      console.log('User email:', parsed.user.email);
    }
  } catch (error) {
    console.error('Error reading config:', error);
  }
}

main();
