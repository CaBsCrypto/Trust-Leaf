export const patients = [
  { id: 'P-104', name: 'Camila Torres', assigned: 30000, used: 20000, permission: 'Hasta 24 sep, 18:00', initials: 'CT' },
  { id: 'P-218', name: 'Camila Torres', assigned: 30000, used: 10000, permission: 'Hasta 25 sep, 09:00', initials: 'CT' },
  { id: 'P-307', name: 'Perfil de prueba pendiente', assigned: 30000, used: 0, permission: 'Hasta 24 sep, 12:00', initials: 'P' },
] as const;
export const lots = [
  { id: 'ALB-024', product: 'Flor Cordillera', stock: 60000, state: 'Disponible', expires: '15 dic 2026' },
  { id: 'NOR-018', product: 'Flor Norte', stock: 25000, state: 'Cuarentena', expires: '30 oct 2026' },
  { id: 'SUR-009', product: 'Flor Sur', stock: 12000, state: 'Vencido', expires: '20 sep 2026' },
] as const;
export const receipts = [
  { id: 'REC-001', lot: 'ALB-024', quantity: 10000, date: '23 sep 2026, 09:15', operator: 'Operador de prueba 01', patient: 'P-104' },
  { id: 'REC-002', lot: 'ALB-024', quantity: 10000, date: '22 sep 2026, 16:40', operator: 'Encargado de prueba 01', patient: 'P-104' },
] as const;
export const grams = (mg: number) => `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3 }).format(mg / 1000)} g`;
export function parseQuantity(value: string): number | null {
  if (!/^\d{1,6}([.,]\d{1,3})?$/.test(value)) return null;
  const [whole, decimal = ''] = value.replace(',', '.').split('.');
  const result = Number(whole) * 1000 + Number(decimal.padEnd(3, '0'));
  return result > 0 ? result : null;
}
