/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Valida un RUT chileno (con o sin puntos/guión) analizando matemáticamente su dígito verificador (Módulo 11).
 */
export function validateRut(rut: string): boolean {
  if (!rut || typeof rut !== 'string') return false;

  // Limpiar caracteres
  const cleanRut = rut.replace(/[^0-9kK]/g, '');
  if (cleanRut.length < 8) return false;

  const body = cleanRut.slice(0, -1);
  const dv = cleanRut.slice(-1).toUpperCase();

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const expectedDvNumber = 11 - (sum % 11);
  let expectedDv = '';
  if (expectedDvNumber === 11) {
    expectedDv = '0';
  } else if (expectedDvNumber === 10) {
    expectedDv = 'K';
  } else {
    expectedDv = String(expectedDvNumber);
  }

  return dv === expectedDv;
}

/**
 * Formatea un RUT a su representación visual estándar: XX.XXX.XXX-X
 */
export function formatRut(rut: string): string {
  if (!rut) return '';
  const clean = rut.replace(/[^0-9kK]/g, '');
  if (clean.length < 2) return clean;

  const dv = clean.slice(-1);
  const body = clean.slice(0, -1);

  // Añadir puntos al cuerpo del RUT
  let formattedBody = '';
  let count = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    formattedBody = body[i] + formattedBody;
    count++;
    if (count === 3 && i > 0) {
      formattedBody = '.' + formattedBody;
      count = 0;
    }
  }

  return `${formattedBody}-${dv.toUpperCase()}`;
}

/**
 * Listado simplificado y oficial de Regiones de Chile para el módulo de Autocultivo.
 */
export const CHILEAN_REGIONS = [
  { id: '15', name: 'Arica y Parinacota' },
  { id: '01', name: 'Tarapacá' },
  { id: '02', name: 'Antofagasta' },
  { id: '03', name: 'Atacama' },
  { id: '04', name: 'Coquimbo' },
  { id: '05', name: 'Valparaíso' },
  { id: 'RM', name: 'Metropolitana de Santiago' },
  { id: '06', name: 'Libertador General Bernardo O\'Higgins' },
  { id: '07', name: 'Maule' },
  { id: '16', name: 'Ñuble' },
  { id: '08', name: 'Biobío' },
  { id: '09', name: 'Araucanía' },
  { id: '14', name: 'Los Ríos' },
  { id: '10', name: 'Los Lagos' },
  { id: '11', name: 'Aysén del General Carlos Ibáñez del Campo' },
  { id: '12', name: 'Magallanes y de la Antártica Chilena' }
];
