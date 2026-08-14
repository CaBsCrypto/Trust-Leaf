import React, { useState, useEffect } from 'react';
import { Plus, Minus, ArrowRight, User, ShoppingBag, Package, FileText, Database, Star, CheckCircle, Search, ShieldCheck } from 'lucide-react';
import { collection, addDoc, getDocs, query, where, doc, setDoc } from 'firebase/firestore';
import { trustDataStore } from '../lib/trustData';

interface DispensaryDashboardProps {
  currentUserWallet: string;
  realDispensaries: any[];
  realDoctors: any[];
  activePickups: any[];
  setActivePickups: React.Dispatch<React.SetStateAction<any[]>>;
  dispensaryCredentialMetrics: any[];
  showTechnicalDetails: boolean;
  dispensaryCredentialAddress: string;
  signingMethod: 'managed' | 'freighter';
  setSigningMethod: React.Dispatch<React.SetStateAction<'managed' | 'freighter'>>;
  freighterInstalled: boolean;
  dispensePrescriptionId: string;
  setDispensePrescriptionId: React.Dispatch<React.SetStateAction<string>>;
  validatePrescriptionOnTestnet: (overrideId?: number) => Promise<any>;
  prescriptionValidationBusy: boolean;
  prescriptionValidation: any;
  prescriptionValidationError: string | null;
  setSelectedQrPermission: React.Dispatch<React.SetStateAction<any>>;
  dispensaryValidation: any;
  lockPeriodDays: number;
  setLockPeriodDays: React.Dispatch<React.SetStateAction<number>>;
  handleReleasePrescription: () => Promise<void>;
  handleRetainPrescription: () => Promise<void>;
  retainReleaseBusy: boolean;
  retainReleaseError: string | null;
  retainReleaseSuccess: string | null;
  prescriptionRemainingGrams: number;
  cartGrams: number;
  previousPrescriptionPickups: any[];
  dispensarySignerReady: boolean;
  setSelectedDispensary: React.Dispatch<React.SetStateAction<any>>;
  setDispensaryStep: React.Dispatch<React.SetStateAction<any>>;
  openDrawer: (key: any) => void;
  cart: any[];
  setCart: React.Dispatch<React.SetStateAction<any[]>>;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  openPickupTraceability: (pickup: any) => void;
  shortenAddress: (address: string, chars?: number) => string;
  shortenHash: (hash: string, chars?: number) => string;
  makeDemoHash: (text: string) => string;
  buildOperatorDispensary: () => any;
  prepareInventoryDispense: (product: any) => void;
  DEMO_PRESCRIPTION_ID: string;
  auth: any;
  db: any;
}

export default function DispensaryDashboard({
  currentUserWallet,
  realDispensaries,
  realDoctors,
  activePickups,
  setActivePickups,
  dispensaryCredentialMetrics,
  showTechnicalDetails,
  dispensaryCredentialAddress,
  signingMethod,
  setSigningMethod,
  freighterInstalled,
  dispensePrescriptionId,
  setDispensePrescriptionId,
  validatePrescriptionOnTestnet,
  prescriptionValidationBusy,
  prescriptionValidation,
  prescriptionValidationError,
  setSelectedQrPermission,
  dispensaryValidation,
  lockPeriodDays,
  setLockPeriodDays,
  handleReleasePrescription,
  handleRetainPrescription,
  retainReleaseBusy,
  retainReleaseError,
  retainReleaseSuccess,
  prescriptionRemainingGrams,
  cartGrams,
  previousPrescriptionPickups,
  dispensarySignerReady,
  setSelectedDispensary,
  setDispensaryStep,
  openDrawer,
  cart,
  setCart,
  showToast,
  openPickupTraceability,
  shortenAddress,
  shortenHash,
  makeDemoHash,
  buildOperatorDispensary,
  prepareInventoryDispense,
  DEMO_PRESCRIPTION_ID,
  auth,
  db,
}: DispensaryDashboardProps) {
  const [dispensaryTab, setDispensaryTab] = useState<'operation' | 'inventory' | 'members' | 'history'>('operation');
  const [dispensaryInventory, setDispensaryInventory] = useState<any[]>([]);
  const [dispensaryMembers, setDispensaryMembers] = useState<any[]>([]);
  const [dispensaryHistory, setDispensaryHistory] = useState<any[]>([]);
  
  const [inventoryForm, setInventoryForm] = useState({
    name: 'CBD Balance 10:10',
    type: 'Aceite sublingual',
    batch: `TL-${new Date().getFullYear()}-001`,
    stockGrams: 10,
    thc: '10%',
    cbd: '10%',
    lab: 'Trust Leaf QC',
    origin: 'Cultivo certificado',
  });

  const [memberForm, setMemberForm] = useState({
    name: '',
    role: 'Operador',
    email: '',
    wallet: '',
  });

  const getDispId = () => {
    const currentDisp = realDispensaries.find(d => d.wallet === currentUserWallet);
    return currentDisp?.id || 'demo-dispensary';
  };

  const loadData = async () => {
    const dispId = getDispId();
    const inv = await trustDataStore.loadDispensaryInventory(dispId);
    setDispensaryInventory(inv);
    
    const mems = await trustDataStore.loadDispensaryMembers(dispId);
    setDispensaryMembers(mems);
    
    const hist = await trustDataStore.loadDispensaryPickupHistory(dispId);
    setDispensaryHistory(hist);
  };

  useEffect(() => {
    loadData();
  }, [currentUserWallet, realDispensaries]);

  // Hook to reload inventory/history when pickups change
  useEffect(() => {
    const dispId = getDispId();
    trustDataStore.loadDispensaryPickupHistory(dispId).then(setDispensaryHistory);
    trustDataStore.loadDispensaryInventory(dispId).then(setDispensaryInventory);
  }, [activePickups]);

  const handleAddMember = async () => {
    if (!memberForm.name.trim() || !memberForm.email.trim()) {
      showToast("Por favor complete los campos obligatorios del miembro.", "error");
      return;
    }
    const dispId = getDispId();
    const newMember = {
      id: `mem-${Date.now()}`,
      name: memberForm.name.trim(),
      role: memberForm.role,
      email: memberForm.email.trim(),
      wallet: memberForm.wallet.trim() || `GD${Math.random().toString(36).substring(2, 12).toUpperCase()}...LEAF`,
    };
    await trustDataStore.addDispensaryMember(dispId, newMember);
    setDispensaryMembers(prev => [...prev, newMember]);
    setMemberForm({ name: '', role: 'Operador', email: '', wallet: '' });
    showToast("Miembro agregado exitosamente.", "success");
  };

  const handleAddProduct = async () => {
    const stockGrams = Math.max(0, Number(inventoryForm.stockGrams) || 0);
    if (!inventoryForm.name.trim() || !inventoryForm.batch.trim() || stockGrams <= 0) {
      showToast("Complete los campos obligatorios del producto.", "error");
      return;
    }
    const dispId = getDispId();
    const newProduct = {
      id: `inv-${Date.now()}`,
      batchId: inventoryForm.batch.trim(),
      strainName: inventoryForm.name.trim(),
      quantityGrams: stockGrams,
      thcRatio: Number(inventoryForm.thc.replace(/[^0-9]/g, '')) || 10,
      cbdRatio: Number(inventoryForm.cbd.replace(/[^0-9]/g, '')) || 10,
      name: inventoryForm.name.trim(),
      type: inventoryForm.type.trim() || 'Producto medicinal',
      batch: inventoryForm.batch.trim(),
      stockGrams,
      thc: inventoryForm.thc.trim() || '10%',
      cbd: inventoryForm.cbd.trim() || '10%',
      lab: inventoryForm.lab.trim() || 'Trust Leaf QC',
      origin: inventoryForm.origin.trim() || 'Cultivo certificado',
    };
    await trustDataStore.addInventoryProduct(dispId, newProduct);
    setDispensaryInventory(prev => [newProduct, ...prev]);
    setInventoryForm(prev => ({
      ...prev,
      batch: `TL-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`,
      stockGrams: 10,
    }));
    showToast("Producto agregado al catálogo persistente.", "success");
  };

  const updateInventoryStock = async (productId: string, delta: number) => {
    const dispId = getDispId();
    setDispensaryInventory(prev => prev.map(product => {
      if (product.id !== productId) {
        return product;
      }
      const newStock = Math.max(0, Number(product.stockGrams ?? product.quantityGrams ?? 0) + delta);
      void trustDataStore.deductInventoryStock(dispId, product.batchId || product.batch || product.id, -delta);
      return {
        ...product,
        stockGrams: newStock,
        quantityGrams: newStock,
      };
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top operational badge */}
      <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">Credencial operativa</p>
            <h3 className="mt-1 text-2xl font-serif text-brand-green-deep">Dispensario autorizado en Trust Leaf</h3>
            <p className="mt-2 text-sm leading-relaxed text-brand-green-mid/70">
              Módulo integral de autogestión: administra tu catálogo clínico, coordina tu personal de farmacia y audita las dispensaciones.
            </p>
          </div>
          <div className="grid min-w-full grid-cols-1 gap-2 sm:grid-cols-3 xl:min-w-[520px]">
            {dispensaryCredentialMetrics.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-brand-green-deep/10 bg-[#fbf7ef] p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">{label}</p>
                <p className="mt-1 text-lg font-bold text-brand-green-deep">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-brand-green-deep/10 overflow-x-auto gap-2 py-1 scrollbar-none">
        {[
          { id: 'operation', label: 'Cola de Operación', count: activePickups.filter((p: any) => p.status === 'pending').length },
          { id: 'inventory', label: 'Inventario & Catálogo', count: dispensaryInventory.length },
          { id: 'members', label: 'Equipo / Miembros', count: dispensaryMembers.length },
          { id: 'history', label: 'Historial de Dispensas', count: dispensaryHistory.length }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setDispensaryTab(tab.id as any)}
            className={`px-5 py-3 rounded-t-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 border-t border-x ${
              dispensaryTab === tab.id
                ? 'bg-[#fbf7ef] border-brand-green-deep/10 text-brand-green-deep font-bold border-b-2 border-b-brand-gold'
                : 'bg-white/40 border-transparent text-brand-green-mid/50 hover:bg-white hover:text-brand-green-deep'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                tab.id === 'operation' ? 'bg-brand-gold text-brand-green-deep' : 'bg-brand-green-deep/10 text-brand-green-deep'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab contents */}
      {dispensaryTab === 'operation' && (
        <div className="space-y-6">
          <div className="rounded-[32px] border border-brand-green-deep/10 bg-[#fbf7ef] p-5 md:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-gold">Operación diaria</p>
                <h3 className="mt-2 text-2xl md:text-3xl font-serif text-brand-green-deep">Inventario, QR y fraccionamiento.</h3>
                <p className="mt-3 text-sm leading-relaxed text-brand-green-mid/70">
                  Valida las recetas de tus pacientes en Stellar mediante escaneo o ingreso manual. Fracciona la dosis requerida descontando stock directamente del lote seleccionado.
                </p>
              </div>
              <div className="grid min-w-full grid-cols-1 gap-2 sm:grid-cols-3 xl:min-w-[420px]">
                {[
                  ['1', 'Escanear QR', 'Receta y permiso temporal'],
                  ['2', 'Validar saldo', 'Vigencia, formatos y gramos'],
                  ['3', 'Registrar entrega', 'Lote, cantidad y firma'],
                ].map(([step, title, desc]) => (
                  <div key={step} className="rounded-2xl border border-brand-green-deep/10 bg-white/75 p-3">
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-brand-green-deep text-xs font-bold text-brand-ivory">
                      {step}
                    </div>
                    <p className="text-sm font-bold text-brand-green-deep">{title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-brand-green-mid/60">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
              <button
                type="button"
                onClick={() => openDrawer('dispensary-qr')}
                className="rounded-2xl bg-brand-green-deep px-4 py-3 text-sm font-bold text-brand-ivory transition-colors hover:bg-brand-green-mid"
              >
                Escanear QR / validar receta
              </button>
              <button
                type="button"
                onClick={() => openDrawer('dispensary-qr')}
                className="rounded-2xl border border-brand-green-deep/10 bg-white px-4 py-3 text-sm font-bold text-brand-green-deep transition-colors hover:bg-brand-neutral"
              >
                Ingresar número de receta
              </button>
              <button
                type="button"
                onClick={() => setDispensaryTab('inventory')}
                className="rounded-2xl border border-brand-gold/30 bg-white px-4 py-3 text-sm font-bold text-brand-green-deep transition-colors hover:bg-brand-gold/10"
              >
                Preparar desde catálogo
              </button>
            </div>
          </div>

          {activePickups.filter((p: any) => p.status === 'pending').length > 0 ? (
            <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-5 md:p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-gold animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-brand-gold" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">Cola de Dispensación en Tiempo Real (Firestore)</p>
                  <h3 className="mt-1 text-2xl font-serif text-brand-green-deep">Retiros pendientes por entregar</h3>
                </div>
              </div>
              <div className="mt-4 divide-y divide-brand-green-deep/5">
                {activePickups.filter((p: any) => p.status === 'pending').map((pickup: any) => (
                  <div key={pickup.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 first:pt-0 last:pb-0 gap-4">
                    <div>
                      <p className="font-bold text-brand-green-deep">{pickup.strain?.name || 'Medicina personalizada'}</p>
                      <p className="text-xs text-brand-green-mid/70">
                        Cantidad: <span className="font-bold text-brand-green-deep">{pickup.quantity}g</span> • Paciente ID: <span className="font-mono text-brand-gold">{pickup.patientId?.slice(-6)}</span> • Token: <span className="font-mono text-brand-green-deep">{pickup.token}</span>
                      </p>
                      {pickup.prescriptionId && (
                        <p className="text-[10px] text-brand-green-mid/45 mt-0.5">
                          Vinculado a Receta Soroban: #{pickup.prescriptionId}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const rxIdStr = String(pickup.prescriptionId || 1);
                        setDispensePrescriptionId(rxIdStr);
                        setSelectedDispensary(buildOperatorDispensary());
                        setCart([{ strain: pickup.strain, quantity: pickup.quantity }]);
                        await validatePrescriptionOnTestnet(Number(rxIdStr));
                        openDrawer('dispensary-dispense');
                      }}
                      className="rounded-xl bg-brand-gold/10 hover:bg-brand-gold px-4 py-2.5 text-xs font-bold text-brand-green-deep transition-all duration-200 border border-brand-gold/25 hover:text-brand-green-deep active:scale-95"
                    >
                      ⚡ Procesar y Dispensar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-brand-green-deep/10 bg-white/50 p-6 text-center shadow-sm">
              <p className="text-sm text-brand-green-mid/60">No hay retiros pendientes en cola de espera.</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-5 md:p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">Mesa de validación</p>
                  <h3 className="mt-2 text-2xl font-serif text-brand-green-deep">Recibir paciente con receta</h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-green-mid/65">
                    El operador puede escanear QR o ingresar el número de receta. Trust Leaf muestra vigencia, saldo y permiso mínimo antes de preparar el retiro.
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                  dispensaryValidation
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {dispensaryValidation ? 'QR válido' : 'Sin QR'}
                </span>
              </div>

              <div className="mt-4 border-t border-brand-green-deep/5 pt-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold font-bold">Firma de Transacciones</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSigningMethod('managed')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      signingMethod === 'managed'
                        ? 'bg-brand-green-deep text-brand-ivory shadow-sm'
                        : 'bg-white border border-brand-green-deep/10 text-brand-green-deep hover:bg-brand-neutral'
                    }`}
                  >
                    🔑 Custodial
                  </button>
                  <button
                    type="button"
                    onClick={() => setSigningMethod('freighter')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                      signingMethod === 'freighter'
                        ? 'bg-brand-green-deep text-brand-ivory shadow-sm'
                        : 'bg-white border border-brand-green-deep/10 text-brand-green-deep hover:bg-brand-neutral'
                    }`}
                  >
                    ⚓ Freighter
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">Número de receta</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={dispensePrescriptionId}
                    onChange={(event) => setDispensePrescriptionId(event.target.value.replace(/[^\d]/g, ''))}
                    placeholder={`Ej: ${DEMO_PRESCRIPTION_ID}`}
                    className="mt-2 w-full rounded-xl border border-brand-green-deep/10 bg-brand-neutral px-4 py-3 text-sm font-mono text-brand-green-deep outline-none focus:ring-2 focus:ring-brand-gold/40"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => validatePrescriptionOnTestnet()}
                  disabled={prescriptionValidationBusy}
                  className="self-end rounded-xl bg-brand-green-deep px-5 py-3 text-sm font-bold text-brand-ivory transition-colors hover:bg-brand-green-mid"
                >
                  {prescriptionValidationBusy ? 'Validando...' : 'Validar receta'}
                </button>
              </div>

              {(prescriptionValidation || prescriptionValidationError) && (
                <div className={`mt-4 rounded-2xl border p-4 text-sm ${
                  prescriptionValidation?.validation.canDispense
                    ? 'border-green-100 bg-green-50 text-green-800'
                    : 'border-amber-100 bg-amber-50 text-amber-800'
                }`}>
                  {prescriptionValidation ? (
                    <>
                      <p className="font-bold">
                        {prescriptionValidation.validation.canDispense
                          ? 'Receta vigente y dispensable'
                          : 'Receta no dispensable'}
                      </p>
                      <p className="mt-1 leading-relaxed">{prescriptionValidation.validation.reason}</p>
                      <p className="mt-2 font-mono text-xs">
                        Paciente {shortenAddress(prescriptionValidation.prescription.patient, 8)} · Doctor {shortenAddress(prescriptionValidation.prescription.doctor, 8)}
                      </p>
                    </>
                  ) : (
                    <p>{prescriptionValidationError}</p>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-blue-100 bg-blue-50 p-5 md:p-6 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-700/70">Privacidad del paciente</p>
              <h3 className="mt-2 text-2xl font-serif text-brand-green-deep">Solo lo necesario para dispensar</h3>
              <div className="mt-5 space-y-3">
                {[
                  ['Visible', 'Receta, vigencia, formatos autorizados y saldo.'],
                  ['Oculto', 'Diagnóstico, notas clínicas y expediente completo.'],
                  ['Auditable', 'Lote, cantidad, dispensario y prueba de retiro.'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-blue-100 bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/55">{label}</p>
                    <p className="mt-1 text-sm leading-relaxed text-brand-green-mid/70">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {dispensaryTab === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 bg-[#fbf7ef] border border-brand-green-deep/10 rounded-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-green-mid/50 mb-2">Productos en catálogo</p>
              <p className="text-2xl font-serif text-brand-green-deep font-bold">{dispensaryInventory.length}</p>
            </div>
            <div className="p-4 bg-[#fbf7ef] border border-brand-green-deep/10 rounded-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-green-mid/50 mb-2">Volumen de Stock</p>
              <p className="text-2xl font-serif text-brand-green-deep font-bold">
                {dispensaryInventory.reduce((total, p) => total + Number(p.stockGrams ?? p.quantityGrams ?? 0), 0)}g
              </p>
            </div>
            <div className="p-4 bg-[#fbf7ef] border border-brand-green-deep/10 rounded-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-green-mid/50 mb-2">Bajo stock (menor a 10g)</p>
              <p className="text-2xl font-serif text-brand-green-deep font-bold text-orange-700">
                {dispensaryInventory.filter((p) => Number(p.stockGrams ?? p.quantityGrams ?? 0) <= 10).length}
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-5 md:p-6 shadow-sm">
            <h3 className="text-xl font-serif text-brand-green-deep mb-4">Cargar Nuevo Preparado Magistral (Persistente)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs text-brand-green-mid/70 font-semibold">Nombre del producto</span>
                <input
                  value={inventoryForm.name}
                  onChange={(e) => setInventoryForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre del producto"
                  className="mt-1 w-full px-4 py-2.5 bg-brand-neutral rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-brand-gold"
                />
              </label>
              <label className="block">
                <span className="text-xs text-brand-green-mid/70 font-semibold">Tipo o Formato</span>
                <input
                  value={inventoryForm.type}
                  onChange={(e) => setInventoryForm(prev => ({ ...prev, type: e.target.value }))}
                  placeholder="Ej. Flores secas, Aceite sublingual"
                  className="mt-1 w-full px-4 py-2.5 bg-brand-neutral rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-brand-gold"
                />
              </label>
              <label className="block">
                <span className="text-xs text-brand-green-mid/70 font-semibold">Lote único trazable</span>
                <input
                  value={inventoryForm.batch}
                  onChange={(e) => setInventoryForm(prev => ({ ...prev, batch: e.target.value }))}
                  placeholder="Lote"
                  className="mt-1 w-full px-4 py-2.5 bg-brand-neutral rounded-xl text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand-gold"
                />
              </label>
              <label className="block">
                <span className="text-xs text-brand-green-mid/70 font-semibold">Gramos iniciales</span>
                <input
                  type="number"
                  min="1"
                  value={inventoryForm.stockGrams}
                  onChange={(e) => setInventoryForm(prev => ({ ...prev, stockGrams: Number(e.target.value) }))}
                  placeholder="Cantidad"
                  className="mt-1 w-full px-4 py-2.5 bg-brand-neutral rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-brand-gold"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs text-brand-green-mid/70 font-semibold">THC (%)</span>
                  <input
                    value={inventoryForm.thc}
                    onChange={(e) => setInventoryForm(prev => ({ ...prev, thc: e.target.value }))}
                    placeholder="10%"
                    className="mt-1 w-full px-3 py-2.5 bg-brand-neutral rounded-xl text-xs focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-brand-green-mid/70 font-semibold">CBD (%)</span>
                  <input
                    value={inventoryForm.cbd}
                    onChange={(e) => setInventoryForm(prev => ({ ...prev, cbd: e.target.value }))}
                    placeholder="10%"
                    className="mt-1 w-full px-3 py-2.5 bg-brand-neutral rounded-xl text-xs focus:outline-none"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-brand-green-mid/70 font-semibold">Laboratorio y Control de Calidad</span>
                <input
                  value={inventoryForm.lab}
                  onChange={(e) => setInventoryForm(prev => ({ ...prev, lab: e.target.value }))}
                  placeholder="Trust Leaf QC"
                  className="mt-1 w-full px-4 py-2.5 bg-brand-neutral rounded-xl text-sm focus:outline-none"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleAddProduct}
              className="mt-4 inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-green-deep text-brand-ivory rounded-xl text-sm font-bold hover:bg-brand-green-mid transition-all active:scale-95"
            >
              <Plus size={16} />
              Cargar al Catálogo de Firestore
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dispensaryInventory.map((product) => {
              const stock = Number(product.stockGrams ?? product.quantityGrams ?? 0);
              const isLowStock = stock <= 10;
              return (
                <div key={product.id} className="p-5 bg-white border border-brand-green-deep/10 rounded-2xl shadow-sm">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="font-bold text-brand-green-deep text-lg">{product.name || product.strainName}</h4>
                        <span className="text-[9px] bg-brand-green-deep text-white px-2 py-0.5 rounded-full font-bold uppercase">
                          {product.type || 'Fórmula'}
                        </span>
                      </div>
                      <p className="text-xs text-brand-green-mid/60 font-mono">Lote: {product.batchId || product.batch}</p>
                    </div>
                    <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${isLowStock ? 'bg-orange-100 text-orange-700 animate-pulse' : 'bg-green-100 text-green-700'}`}>
                      {isLowStock ? 'Bajo stock' : 'Disponible'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                    <div className="p-2 rounded-xl bg-brand-neutral/50">
                      <span className="text-[9px] uppercase text-brand-green-mid/50 font-bold block">Stock</span>
                      <p className="font-bold text-brand-green-deep text-sm">{stock}g</p>
                    </div>
                    <div className="p-2 rounded-xl bg-brand-neutral/50">
                      <span className="text-[9px] uppercase text-brand-green-mid/50 font-bold block">THC / CBD</span>
                      <p className="font-bold text-brand-green-deep text-sm">
                        {product.thcRatio !== undefined ? `THC ${product.thcRatio}% / CBD ${product.cbdRatio}%` : `THC ${product.thc} / CBD ${product.cbd}`}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-brand-neutral/50">
                      <span className="text-[9px] uppercase text-brand-green-mid/50 font-bold block">Control Calidad</span>
                      <p className="font-bold text-brand-green-deep truncate">{product.lab || 'Certificado'}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-brand-neutral/50">
                      <span className="text-[9px] uppercase text-brand-green-mid/50 font-bold block">Procedencia</span>
                      <p className="font-bold text-brand-green-deep truncate">{product.origin || 'Chile'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateInventoryStock(product.id, -1)}
                        className="w-9 h-9 rounded-xl border border-brand-green-deep/10 flex items-center justify-center text-brand-green-deep hover:bg-brand-neutral"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-mono text-xs font-bold">{stock}g</span>
                      <button
                        type="button"
                        onClick={() => updateInventoryStock(product.id, 1)}
                        className="w-9 h-9 rounded-xl border border-brand-green-deep/10 flex items-center justify-center text-brand-green-deep hover:bg-brand-neutral"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const strainAdapter = {
                          id: product.id,
                          name: product.name || product.strainName,
                          batch: product.batchId || product.batch,
                          type: product.type || 'Fórmula',
                          thc: product.thc || `${product.thcRatio}%`,
                          cbd: product.cbd || `${product.cbdRatio}%`,
                          lab: product.lab || 'QC Passed',
                          origin: product.origin || 'Chile',
                        };
                        prepareInventoryDispense(strainAdapter);
                        openDrawer('dispensary-dispense');
                      }}
                      disabled={stock <= 0}
                      className="px-4 py-2 bg-brand-green-deep hover:bg-brand-green-mid text-brand-ivory font-bold text-xs rounded-xl transition-all disabled:opacity-40"
                    >
                      Preparar Dispensa
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {dispensaryTab === 'members' && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-5 md:p-6 shadow-sm">
            <h3 className="text-xl font-serif text-brand-green-deep">Miembros Autorizados y Personal Clínico</h3>
            <p className="mt-1 text-sm text-brand-green-mid/70 leading-relaxed">
              Controla qué operadores de tu farmacia o dispensario tienen credenciales operativas en Trust Leaf. Asigna roles de control para auditoría criptográfica.
            </p>
          </div>

          <div className="rounded-[28px] border border-brand-green-deep/10 bg-[#fbf7ef] p-5 md:p-6 shadow-sm">
            <h4 className="font-serif text-brand-green-deep text-lg mb-3">Registrar y Dar de Alta Personal</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <label className="block">
                <span className="text-xs text-brand-green-mid/70 font-bold block mb-1">Nombre Completo</span>
                <input
                  value={memberForm.name}
                  onChange={(e) => setMemberForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre del operador"
                  className="w-full px-3 py-2 bg-white border border-brand-green-deep/10 rounded-xl text-sm focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-brand-green-mid/70 font-bold block mb-1">Rol Operativo</span>
                <select
                  value={memberForm.role}
                  onChange={(e) => setMemberForm(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-brand-green-deep/10 rounded-xl text-sm font-bold text-brand-green-deep focus:outline-none"
                >
                  <option value="Administrador">Administrador</option>
                  <option value="Farmacéutico">Farmacéutico Clínico</option>
                  <option value="Operador">Operador de Caja</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-brand-green-mid/70 font-bold block mb-1">Correo Electrónico</span>
                <input
                  type="email"
                  value={memberForm.email}
                  onChange={(e) => setMemberForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="correo@sucursal.com"
                  className="w-full px-3 py-2 bg-white border border-brand-green-deep/10 rounded-xl text-sm focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-brand-green-mid/70 font-bold block mb-1">Wallet Stellar (Opcional)</span>
                <input
                  value={memberForm.wallet}
                  onChange={(e) => setMemberForm(prev => ({ ...prev, wallet: e.target.value }))}
                  placeholder="GD... (Clave Pública)"
                  className="w-full px-3 py-2 bg-white border border-brand-green-deep/10 rounded-xl text-sm font-mono focus:outline-none"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleAddMember}
              className="mt-4 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-green-deep text-brand-ivory rounded-xl text-xs font-bold hover:bg-brand-green-mid"
            >
              <Plus size={14} /> Registrar Miembro
            </button>
          </div>

          <div className="bg-white border border-brand-green-deep/10 rounded-2xl overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-brand-green-deep/5 text-left text-sm">
              <thead className="bg-[#fbf7ef] text-[10px] font-bold uppercase tracking-wider text-brand-green-mid/60">
                <tr>
                  <th className="px-6 py-3">Nombre</th>
                  <th className="px-6 py-3">Rol</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Firma Stellar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-green-deep/5 text-brand-green-deep font-medium">
                {dispensaryMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-brand-neutral/20 transition-colors">
                    <td className="px-6 py-4">{m.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        m.role === 'Administrador' ? 'bg-purple-100 text-purple-700' :
                        m.role === 'Farmacéutico' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {m.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{m.email}</td>
                    <td className="px-6 py-4 font-mono text-xs text-brand-green-mid/60">{shortenAddress(m.wallet, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dispensaryTab === 'history' && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-5 md:p-6 shadow-sm">
            <h3 className="text-xl font-serif text-brand-green-deep">Historial Completo de Entregas y Auditoría</h3>
            <p className="mt-1 text-sm text-brand-green-mid/70 leading-relaxed">
              Registro inalterable y auditable de todos los retiros procesados en esta sucursal. Los registros están coordinados tanto a nivel local (Firestore) como on-chain (Stellar ledger hashes).
            </p>
          </div>

          {dispensaryHistory.length > 0 ? (
            <div className="bg-white border border-brand-green-deep/10 rounded-2xl overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-brand-green-deep/5 text-left text-sm">
                <thead className="bg-[#fbf7ef] text-[10px] font-bold uppercase tracking-wider text-brand-green-mid/60">
                  <tr>
                    <th className="px-6 py-3">Variedad / Producto</th>
                    <th className="px-6 py-3">Cantidad</th>
                    <th className="px-6 py-3">Token de Receta</th>
                    <th className="px-6 py-3">Estado</th>
                    <th className="px-6 py-3">Fecha</th>
                    <th className="px-6 py-3">Auditoría / TX</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-green-deep/5 text-brand-green-deep font-semibold">
                  {dispensaryHistory.map((pickup) => (
                    <tr key={pickup.id} className="hover:bg-brand-neutral/20 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold">{pickup.strain?.name || 'Fórmula Medicinal'}</p>
                        <p className="text-[10px] text-brand-green-mid/50 font-mono">Lote: {pickup.strain?.batch || 'LOTE-QC'}</p>
                      </td>
                      <td className="px-6 py-4 font-bold">{pickup.quantity}g</td>
                      <td className="px-6 py-4 font-mono text-xs text-brand-gold">{pickup.token?.slice(0, 18)}...</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${
                          pickup.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {pickup.status === 'completed' ? 'Entregado' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-brand-green-mid/70">
                        {pickup.createdAt ? new Date(pickup.createdAt).toLocaleString('es-CL') : 'Hace poco'}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => openPickupTraceability(pickup)}
                          className="px-3 py-1 text-[10px] font-bold border border-brand-green-deep/10 bg-white rounded-lg hover:bg-brand-green-deep hover:text-white transition-colors"
                        >
                          Ver Trazabilidad
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-brand-green-deep/10 bg-white/50 p-8 text-center shadow-sm">
              <p className="text-sm text-brand-green-mid/60">No se han registrado entregas previas en este dispensario.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
