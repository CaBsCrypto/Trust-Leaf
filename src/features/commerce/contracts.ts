export type CommercePage<T> = { items: T[]; nextOffset: number | null; synthetic: true };
export type Product = {
  product_ref: string; code: string; name: string; presentation: string;
  reference_price_clp: number | null; reorder_mg: number; archived: boolean; version: number;
};
export type Supplier = {
  supplier_ref: string; name: string; internal_reference: string;
  contact: string | null; archived: boolean; version: number;
};
export type CommercialReceipt = {
  receipt_ref: string; batch_ref: string; product_ref: string; supplier_ref: string | null;
  quantity_mg: number; cost_clp?: number | null; created_at: string;
};
type Mutation = { operationId: string };
export type CommerceCommand =
  | { action: 'products' | 'suppliers' | 'receipts'; input: { offset?: number; limit?: number } }
  | { action: 'save-product'; input: Mutation & { resourceRef?: string; version?: number;
      code: string; name: string; presentation: string; referencePriceClp: number | null;
      reorderMg: number; archived: boolean } }
  | { action: 'save-supplier'; input: Mutation & { resourceRef?: string; version?: number;
      name: string; internalReference: string; contact: string | null; archived: boolean } }
  | { action: 'receive'; input: Mutation & { productRef: string; supplierRef: string | null;
      lotCode: string; sourceReference: string; expiresAt: string; quantityMg: number; costClp: number | null } }
  | { action: 'link-batch'; input: Mutation & { resourceRef: string; version: number;
      productRef: string; supplierRef: string | null } };
export type CommerceMutationResult = { resourceRef: string; batchRef?: string; synthetic: true; replayed: boolean };
