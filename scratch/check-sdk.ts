import * as StellarSdk from '@stellar/stellar-sdk';

console.log('Keys in StellarSdk:', Object.keys(StellarSdk).filter(k => k.match(/^[A-Z]/)));
