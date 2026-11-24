import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { jsPDF } from 'jspdf';

const commitmentDomain = Buffer.from('TrustLeaf/ClinicalLink/PDF/v1\0', 'ascii');

export function pdfCommitment(bytes: Uint8Array, nonce: Uint8Array) {
  if (nonce.length !== 32) throw new Error('Invalid commitment nonce');
  const digest = createHash('sha256').update(bytes).digest();
  return createHash('sha256').update(commitmentDomain).update(nonce).update(digest).digest('hex');
}

export function matchesPdfCommitment(bytes: Uint8Array, nonce: Uint8Array, commitment: unknown) {
  return typeof commitment === 'string' && /^[a-f0-9]{64}$/.test(commitment)
    && timingSafeEqual(Buffer.from(pdfCommitment(bytes, nonce), 'hex'), Buffer.from(commitment, 'hex'));
}

export function createSyntheticPrescription(resourceRef: string) {
  const pdf = new jsPDF({ compress: true });
  pdf.setProperties({ title: 'Receta sintetica piloto', author: 'TrustLeaf Cannabis' });
  pdf.setFontSize(20);
  pdf.text('TrustLeaf Cannabis', 20, 28);
  pdf.setFontSize(15);
  pdf.text('RECETA SINTETICA', 20, 46);
  pdf.setFontSize(11);
  pdf.text(['Documento de prueba sin validez clinica.', 'Este documento no incluye una indicacion de tratamiento.',
    `Referencia de prueba: ${resourceRef}`, 'Revision del documento: 1'], 20, 62);
  const bytes = Buffer.from(pdf.output('arraybuffer'));
  const nonce = randomBytes(32);
  return { pdfBase64: bytes.toString('base64'), nonce: nonce.toString('hex'), commitment: pdfCommitment(bytes, nonce) };
}
