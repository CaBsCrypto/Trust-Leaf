import { Keypair } from '@stellar/stellar-sdk';

export interface PasskeyAccount {
  publicKey: string;
  credentialId: string;
  username: string;
  createdAt: number;
}

class PasskeyService {
  private STORAGE_KEYS = {
    ACCOUNTS: 'gp_passkey_accounts',
    SECRET_PREFIX: 'gp_passkey_sec_',
  };

  /**
   * Extrae el RP ID óptimo y válido según el entorno de ejecución actual.
   */
  private getRpId(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    const hostname = window.location.hostname;

    // Si es una dirección IP (v4), evitamos fijar RP ID para prevenir
    // que el navegador tire una excepción de dominio no válido.
    const ipPattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (ipPattern.test(hostname)) {
      return undefined;
    }

    // Para localhost
    if (hostname === 'localhost') {
      return 'localhost';
    }

    // Limpieza estándar de prefijo 'www.' para compatibilidad cruzada de subdominios
    if (hostname.startsWith('www.')) {
      return hostname.substring(4);
    }

    // Mantener dominios de Vercel intactos
    if (hostname.endsWith('.vercel.app')) {
      return hostname;
    }

    // Devolver eTLD+1 para otros subdominios genéricos
    const parts = hostname.split('.');
    if (parts.length > 2) {
      return parts.slice(-2).join('.');
    }

    return hostname;
  }

  /**
   * Verifica soporte de WebAuthn / Passkeys en el navegador actual.
   */
  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.PublicKeyCredential !== 'undefined'
    );
  }

  /**
   * Registro: Genera credencial biométrica y crea un par de llaves blockchain mapeado.
   */
  public async register(
    username: string,
    existingSecretKey?: string,
    attachment?: 'platform' | 'cross-platform'
  ): Promise<PasskeyAccount> {
    if (!this.isSupported()) {
      throw new Error('WebAuthn/Passkeys no están soportadas en este navegador.');
    }

    // 1. Opciones nativas de creación de credencial
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    const rpId = this.getRpId();

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'Trust Leaf Network',
        ...(rpId ? { id: rpId } : {}),
      },
      user: {
        id: userId,
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [
        {
          type: 'public-key',
          alg: -7, // ES256 (secp256r1) - Algoritmo estándar para TouchID/FaceID
        },
        {
          type: 'public-key',
          alg: -257, // RS256 - Soporte adicional para compatibilidad con Windows Hello
        },
      ],
      authenticatorSelection: {
        ...(attachment ? { authenticatorAttachment: attachment } : { authenticatorAttachment: 'platform' }),
        userVerification: 'required',
        residentKey: 'required', // Esencial para Windows Hello/Passkeys nativas
        requireResidentKey: true,
      },
      timeout: 60000,
    };

    // 2. Disparar Prompt Biométrico del Sistema Operativo
    let credential;
    try {
      credential = (await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      })) as PublicKeyCredential;
    } catch (err) {
      console.error('Error al registrar credencial:', err);
      throw new Error('El registro biométrico fue cancelado o expiró.');
    }

    if (!credential) {
      throw new Error('No se pudo crear la credencial biométrica.');
    }

    // 3. Crear o importar par de llaves Web3/Blockchain
    let keypair;
    if (existingSecretKey) {
      keypair = Keypair.fromSecret(existingSecretKey);
    } else {
      keypair = Keypair.random();
    }

    const publicKey = keypair.publicKey();
    const secretKey = keypair.secret();
    
    // Convertir ID de credencial de Uint8Array a Base64 string para serializarlo en JSON
    const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));

    // Opcional: Solicitar fondeo de cuenta (para Testnet)
    try {
      fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(publicKey)}`);
    } catch {}

    // 4. Guardar mapeos en LocalStorage de forma segura
    const accounts = this.getRegisteredAccounts();
    const newAccount: PasskeyAccount = {
      publicKey,
      credentialId,
      username,
      createdAt: Date.now(),
    };
    accounts.push(newAccount);
    localStorage.setItem(this.STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
    localStorage.setItem(`${this.STORAGE_KEYS.SECRET_PREFIX}${publicKey}`, secretKey);

    return newAccount;
  }

  /**
   * Login: Dispara validación biométrica para desbloquear y recuperar la cuenta.
   */
  public async login(): Promise<PasskeyAccount> {
    if (!this.isSupported()) {
      throw new Error('WebAuthn/Passkeys no están soportadas en este navegador.');
    }

    const accounts = this.getRegisteredAccounts();
    if (accounts.length === 0) {
      throw new Error('No se encontraron cuentas de passkeys registradas en este dispositivo.');
    }

    // 1. Preparar retos y configurar credenciales conocidas
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const allowCredentials = accounts.map((acc) => {
      const rawId = new Uint8Array(
        atob(acc.credentialId)
          .split('')
          .map((c) => c.charCodeAt(0))
      );
      return {
        type: 'public-key' as const,
        id: rawId,
      };
    });

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      allowCredentials,
      userVerification: 'required',
      timeout: 60000,
    };

    // 2. Disparar Prompt Biométrico para validación
    let assertion;
    try {
      assertion = (await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      })) as PublicKeyCredential;
    } catch (err) {
      throw new Error('Autenticación biométrica cancelada o fallida.');
    }

    if (!assertion) {
      throw new Error('La autenticación biométrica falló.');
    }

    // 3. Emparejar el ID binario verificado con nuestras cuentas guardadas
    const matchedCredentialId = btoa(String.fromCharCode(...new Uint8Array(assertion.rawId)));
    const matchedAccount = accounts.find((acc) => acc.credentialId === matchedCredentialId);

    if (!matchedAccount) {
      throw new Error('Validación biométrica exitosa, pero no se encontró ninguna cuenta local correspondiente.');
    }

    return matchedAccount;
  }

  public getRegisteredAccounts(): PasskeyAccount[] {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem(this.STORAGE_KEYS.ACCOUNTS);
    return saved ? JSON.parse(saved) : [];
  }

  public getSecretKey(publicKey: string): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(`${this.STORAGE_KEYS.SECRET_PREFIX}${publicKey}`);
  }

  public removeAccount(publicKey: string): void {
    if (typeof window === 'undefined') return;
    let accounts = this.getRegisteredAccounts();
    accounts = accounts.filter((acc) => acc.publicKey !== publicKey);
    localStorage.setItem(this.STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
    localStorage.removeItem(`${this.STORAGE_KEYS.SECRET_PREFIX}${publicKey}`);
  }

  public clearAll(): void {
    if (typeof window === 'undefined') return;
    const accounts = this.getRegisteredAccounts();
    for (const acc of accounts) {
      localStorage.removeItem(`${this.STORAGE_KEYS.SECRET_PREFIX}${acc.publicKey}`);
    }
    localStorage.removeItem(this.STORAGE_KEYS.ACCOUNTS);
  }

  public isPasskeyAccount(publicKey: string): boolean {
    return this.getRegisteredAccounts().some((acc) => acc.publicKey === publicKey);
  }
}

export const passkeyService = new PasskeyService();
