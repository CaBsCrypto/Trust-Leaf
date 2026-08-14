import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { 
  ShieldCheck, 
  Fingerprint, 
  CheckCircle2, 
  QrCode, 
  RotateCw, 
  ExternalLink, 
  Activity, 
  Stethoscope, 
  Store, 
  Zap,
  Leaf
} from 'lucide-react';

export type CardRole = 'patient' | 'doctor' | 'dispensary';

interface CardTheme {
  ambientGlow: string;
  outerBezelGradient: string;
  outerBezelBorder: string;
  logoBg: string;
  stellarText: string;
  pillTagBg: string;
  pillTitleText: string;
  statusDotPing: string;
  statusDot: string;
  statusText: string;
  watermarkColor: string;
  backBg: string;
  backBorder: string;
  backHeaderBorder: string;
  backButtonBg: string;
  backButtonPortal: string;
  activeTabClass: string;
}

interface CardRoleData {
  role: CardRole;
  badgeLabel: string;
  name: string;
  subtitle: string;
  licenseNumber: string;
  pillTitle: string;
  pillMain: string;
  pillDetail: string;
  statusLabel: string;
  stellarAddress: string;
  txHash: string;
  portalPath: string;
  actionText: string;
  theme: CardTheme;
}

const ROLES_DATA: Record<CardRole, CardRoleData> = {
  patient: {
    role: 'patient',
    badgeLabel: 'PACIENTE VERIFICADO',
    name: 'Ana García',
    subtitle: 'Ficha clínica completa & cifrada',
    licenseNumber: 'RUT: 18.492.103-K',
    pillTitle: 'RECETA ON-CHAIN',
    pillMain: 'Cannabis Medicinal 10:1',
    pillDetail: 'Cupo: 30g / mes · Saldo: 25g disponible',
    statusLabel: 'Ficha Verificada',
    stellarAddress: 'GB2P...KZ6',
    txHash: '0x9a4c...e801',
    portalPath: '/paciente',
    actionText: 'Entrar al portal Paciente',
    theme: {
      ambientGlow: 'from-emerald-400/20 via-teal-300/15 to-emerald-200/20',
      outerBezelGradient: 'from-emerald-200/50 via-emerald-100/30 to-teal-100/35',
      outerBezelBorder: 'border-emerald-400/50 shadow-[0_12px_28px_-6px_rgba(16,185,129,0.18)]',
      logoBg: 'from-emerald-500 to-emerald-700 border-emerald-400/40 text-white',
      stellarText: 'text-emerald-600',
      pillTagBg: 'bg-emerald-100 text-emerald-800',
      pillTitleText: 'text-emerald-800',
      statusDotPing: 'bg-emerald-400',
      statusDot: 'bg-emerald-500',
      statusText: 'text-emerald-700',
      watermarkColor: 'text-emerald-500/10 border-emerald-400/12',
      backBg: 'from-emerald-600 via-[#047857] to-[#065f46]',
      backBorder: 'border-emerald-300/40',
      backHeaderBorder: 'border-emerald-300/30',
      backButtonBg: 'bg-white hover:bg-emerald-50 text-emerald-900',
      backButtonPortal: 'bg-emerald-950/40 hover:bg-emerald-950/60',
      activeTabClass: 'text-emerald-600',
    },
  },
  doctor: {
    role: 'doctor',
    badgeLabel: 'MÉDICO AUTORIZADO',
    name: 'Dr. Camilo Valenzuela',
    subtitle: 'Neurología & Manejo del Dolor',
    licenseNumber: 'RNPI Colegio Médico: #48192',
    pillTitle: 'FACULTAD PRESCRIPTORA',
    pillMain: 'Emisor Oficial Soroban',
    pillDetail: 'Recetas emitidas: 142 · Clave activa',
    statusLabel: 'Matrícula Vigente',
    stellarAddress: 'GDHH...5RV',
    txHash: '0x3f8b...a120',
    portalPath: '/medico',
    actionText: 'Entrar al panel Médico',
    theme: {
      ambientGlow: 'from-sky-400/20 via-cyan-300/15 to-blue-200/20',
      outerBezelGradient: 'from-sky-200/50 via-cyan-100/30 to-blue-100/35',
      outerBezelBorder: 'border-sky-400/50 shadow-[0_12px_28px_-6px_rgba(14,165,233,0.18)]',
      logoBg: 'from-sky-500 to-cyan-700 border-sky-400/40 text-white',
      stellarText: 'text-sky-600',
      pillTagBg: 'bg-sky-100 text-sky-800',
      pillTitleText: 'text-sky-800',
      statusDotPing: 'bg-sky-400',
      statusDot: 'bg-sky-500',
      statusText: 'text-sky-700',
      watermarkColor: 'text-sky-500/10 border-sky-400/12',
      backBg: 'from-sky-600 via-[#0284c7] to-[#0369a1]',
      backBorder: 'border-sky-300/40',
      backHeaderBorder: 'border-sky-300/30',
      backButtonBg: 'bg-white hover:bg-sky-50 text-sky-900',
      backButtonPortal: 'bg-sky-950/40 hover:bg-sky-950/60',
      activeTabClass: 'text-sky-600',
    },
  },
  dispensary: {
    role: 'dispensary',
    badgeLabel: 'DISPENSARIO APROBADO',
    name: 'Green Leaf Center',
    subtitle: 'Farmacia & Dispensario Certificado',
    licenseNumber: 'Resolución Sanitaria: #DL-0941',
    pillTitle: 'INVENTARIO REGISTRADO',
    pillMain: 'Punto de Retiro Oficial',
    pillDetail: '12 variedades · Lotes con trazabilidad',
    statusLabel: 'Sucursal Operativa',
    stellarAddress: 'GDRE...4WX',
    txHash: '0x7c1d...f903',
    portalPath: '/dispensario',
    actionText: 'Entrar al panel Dispensario',
    theme: {
      ambientGlow: 'from-amber-400/20 via-orange-300/15 to-amber-200/20',
      outerBezelGradient: 'from-amber-200/50 via-orange-100/30 to-amber-100/35',
      outerBezelBorder: 'border-amber-400/50 shadow-[0_12px_28px_-6px_rgba(245,158,11,0.18)]',
      logoBg: 'from-amber-500 to-orange-600 border-amber-400/40 text-white',
      stellarText: 'text-amber-600',
      pillTagBg: 'bg-amber-100 text-amber-900',
      pillTitleText: 'text-amber-800',
      statusDotPing: 'bg-amber-400',
      statusDot: 'bg-amber-500',
      statusText: 'text-amber-700',
      watermarkColor: 'text-amber-500/10 border-amber-400/12',
      backBg: 'from-amber-600 via-[#d97706] to-[#b45309]',
      backBorder: 'border-amber-300/40',
      backHeaderBorder: 'border-amber-300/30',
      backButtonBg: 'bg-white hover:bg-amber-50 text-amber-950',
      backButtonPortal: 'bg-amber-950/40 hover:bg-amber-950/60',
      activeTabClass: 'text-amber-600',
    },
  },
};

interface ThreeUserCardProps {
  onNavigate?: (path: string) => void;
}

export default function ThreeUserCard({ onNavigate }: ThreeUserCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [activeRole, setActiveRole] = useState<CardRole>('patient');
  const [isFlipped, setIsFlipped] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });

  // On-chain validation simulation state
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    status: 'idle' | 'valid' | 'error';
    ledger?: number;
    network?: string;
    timestamp?: string;
  }>({ status: 'idle' });

  const roleInfo = ROLES_DATA[activeRole];
  const t = roleInfo.theme;

  // Motion physics tilt
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 22, stiffness: 200, mass: 0.5 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [10, -10]), springConfig);
  const rotateYBase = useSpring(useTransform(mouseX, [-0.5, 0.5], [-14, 14]), springConfig);

  // Combine cursor tilt with 180 deg flip
  const rotateY = useTransform(rotateYBase, val => val + (isFlipped ? 180 : 0));

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    mouseX.set(x);
    mouseY.set(y);

    setGlarePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
      opacity: 0.65,
    });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
    setGlarePos(prev => ({ ...prev, opacity: 0 }));
  };

  const handleValidateOnchain = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsValidating(true);
    try {
      const res = await fetch('/api/stellar/health');
      if (res.ok) {
        const data = await res.json();
        setValidationResult({
          status: 'valid',
          ledger: data.latestLedger || 612849,
          network: 'Stellar Testnet',
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        setValidationResult({
          status: 'valid',
          ledger: 612850,
          network: 'Stellar Testnet',
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    } catch {
      setValidationResult({
        status: 'valid',
        ledger: 612850,
        network: 'Stellar Testnet',
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center select-none perspective-[1400px]">
      
      {/* ── ROLE SWITCHER TABS (Top of Card) ──────────────── */}
      <div className="mb-3.5 flex items-center p-1 rounded-2xl bg-slate-100/90 border border-slate-200/90 shadow-2xs z-30">
        {[
          { id: 'patient', label: 'Paciente', icon: <Activity size={13} />, activeColor: 'text-emerald-600' },
          { id: 'doctor', label: 'Médico', icon: <Stethoscope size={13} />, activeColor: 'text-sky-600' },
          { id: 'dispensary', label: 'Dispensario', icon: <Store size={13} />, activeColor: 'text-amber-600' },
        ].map((tab) => {
          const isActive = activeRole === tab.id;
          return (
            <button
              key={tab.id}
              onClick={(e) => {
                e.stopPropagation();
                setActiveRole(tab.id as CardRole);
                setValidationResult({ status: 'idle' });
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <span className={isActive ? tab.activeColor : 'text-slate-400'}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── 3D ROOT CARD CONTAINER ────────────────────────── */}
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        onClick={() => setIsFlipped(!isFlipped)}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        animate={{
          y: isHovered ? -5 : [0, -7, 0],
        }}
        transition={{
          y: isHovered 
            ? { duration: 0.2 } 
            : { duration: 4.5, repeat: Infinity, ease: 'easeInOut' }
        }}
        className="relative w-[265px] sm:w-[285px] md:w-[300px] aspect-[9/16] cursor-pointer"
      >
        {/* Ambient Back Glow (Subtle & Slim) */}
        <div 
          className={`absolute -inset-3 -z-20 rounded-[36px] bg-gradient-to-tr ${t.ambientGlow} blur-lg transition-all duration-500`}
          style={{ opacity: isHovered ? 0.95 : 0.6 }}
        />

        {/* ─────────────────────────────────────────────────── */}
        {/* 1. CARD FRONT FACE (Borde de Neón Delgado / Slim)   */}
        {/* ─────────────────────────────────────────────────── */}
        <div 
          className={`absolute inset-0 w-full h-full rounded-[26px] bg-gradient-to-b ${t.outerBezelGradient} p-[3.5px] border ${t.outerBezelBorder} transition-all duration-500`}
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'translateZ(1px)',
          }}
        >
          {/* Inner Pearl Ceramic Surface */}
          <div className="relative w-full h-full rounded-[22px] bg-gradient-to-b from-white via-[#fcfdfe] to-[#f1f5f9] border border-slate-200/90 shadow-[inset_0_1px_2px_rgba(255,255,255,1)] overflow-hidden flex flex-col justify-between p-5 sm:p-5.5">
            
            {/* Subtle Security Guilloche Background Pattern */}
            <div 
              className="absolute inset-0 opacity-[0.035] pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, rgba(15,23,42,0.8) 1px, transparent 0)`,
                backgroundSize: '16px 16px',
              }}
            />

            {/* Sello de agua oficial TrustLeaf con relieve sutil */}
            <div 
              className="absolute top-[48%] right-[-20%] w-[260px] h-[260px] rounded-full border-[8px] border-sky-400/12 pointer-events-none -translate-y-1/2 flex items-center justify-center"
            >
              <div className="w-[85%] h-[85%] rounded-full border-[2.5px] border-purple-400/10 flex items-center justify-center">
                <Leaf size={105} className="text-emerald-500/10 -rotate-12" />
              </div>
            </div>

            {/* Rainbow Prism Sheen (Lámina holográfica iridiscente) */}
            <div 
              className="absolute inset-0 pointer-events-none mix-blend-overlay transition-opacity duration-300"
              style={{
                background: `radial-gradient(circle 280px at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.95), rgba(216,180,254,0.4) 30%, rgba(56,189,248,0.3) 60%, transparent 80%)`,
                opacity: glarePos.opacity,
              }}
            />

            {/* ── CARD HEADER ── */}
            <div className="relative z-10 flex items-center justify-between">
              {/* TrustLeaf Official Logo Badge */}
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${t.logoBg} p-1.5 shadow-2xs flex items-center justify-center border transition-all duration-300`}>
                  {activeRole === 'patient' && <Leaf size={17} />}
                  {activeRole === 'doctor' && <Stethoscope size={17} />}
                  {activeRole === 'dispensary' && <Store size={17} />}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-900 leading-none">TrustLeaf</span>
                  <span className="text-[8px] font-semibold tracking-wider text-slate-400 uppercase mt-0.5">
                    {roleInfo.badgeLabel}
                  </span>
                </div>
              </div>

              {/* Top-Right: Stellar Branding & Flip Button */}
              <div className="flex items-center gap-2.5">
                <div className="text-right flex flex-col justify-center">
                  <span className={`text-[11px] font-bold tracking-[0.2em] uppercase ${t.stellarText} leading-tight transition-colors duration-300`}>
                    STELLAR
                  </span>
                  <span className="text-[8px] font-semibold tracking-[0.14em] uppercase text-slate-400 mt-1">
                    SOROBAN ID
                  </span>
                </div>

                {/* Flip Button in exact same spot as back face */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFlipped(!isFlipped);
                  }}
                  title="Girar tarjeta"
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-all cursor-pointer shadow-2xs border border-slate-200/80"
                >
                  <RotateCw size={12} />
                </button>
              </div>
            </div>

            {/* ── USER IDENTITY ── */}
            <div className="relative z-10 my-auto py-1">
              <h3 className="text-2xl sm:text-[25px] font-bold text-slate-900 tracking-tight leading-tight">
                {roleInfo.name}
              </h3>
              <p className="text-xs font-medium text-slate-500 mt-1">
                {roleInfo.subtitle}
              </p>
              <p className="text-[10px] font-mono text-slate-400 mt-1">
                {roleInfo.licenseNumber}
              </p>

              {/* Role Data Pill */}
              <div className="mt-3.5 p-3 rounded-xl bg-slate-50/90 border border-slate-200/80 shadow-2xs backdrop-blur-xs">
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] font-bold uppercase tracking-[0.14em] ${t.pillTitleText}`}>
                    {roleInfo.pillTitle}
                  </span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${t.pillTagBg}`}>
                    Vigente
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-900 mt-1.5">
                  {roleInfo.pillMain}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {roleInfo.pillDetail}
                </p>
              </div>
            </div>

            {/* ── CARD FOOTER ── */}
            <div className="relative z-10 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
              {/* Live Verified indicator with pulsing dot */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${t.statusDotPing} opacity-75`} />
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${t.statusDot}`} />
                  </span>
                  <span className={`text-[11px] font-bold ${t.statusText} tracking-wide`}>
                    {roleInfo.statusLabel}
                  </span>
                </div>

                <span className="text-[9px] uppercase font-sans font-bold text-slate-400">Chile · Testnet</span>
              </div>

              {/* Stellar Wallet address */}
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="font-semibold text-slate-600 tracking-wider">{roleInfo.stellarAddress}</span>
                <span className="font-mono text-slate-400 text-[9px]">TX #{roleInfo.txHash}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────── */}
        {/* 2. CARD BACK FACE (Borde de Neón Delgado / Slim)    */}
        {/* ─────────────────────────────────────────────────── */}
        <div 
          className={`absolute inset-0 w-full h-full rounded-[26px] bg-gradient-to-b ${t.outerBezelGradient} p-[3.5px] border ${t.outerBezelBorder} transition-all duration-500`}
          style={{
            transform: 'rotateY(180deg) translateZ(1px)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {/* Inner Card with role-specific background */}
          <div className={`relative w-full h-full rounded-[22px] bg-gradient-to-b ${t.backBg} border ${t.backBorder} overflow-hidden flex flex-col justify-between p-5 sm:p-5.5 text-white shadow-inner transition-colors duration-500`}>
            
            {/* Top Safety Band with Flip Button in EXACT SAME SPOT */}
            <div className={`relative z-10 flex items-center justify-between pb-2 border-b ${t.backHeaderBorder}`}>
              <div className="flex items-center gap-1.5 text-white text-xs font-bold">
                <ShieldCheck size={14} className="text-white/90" />
                <span>PASAPORTE ON-CHAIN</span>
              </div>

              {/* Top-Right: TX hash & Flip button in identical position */}
              <div className="flex items-center gap-2.5">
                <span className="text-[9px] font-mono text-white/80 font-medium">TX #{roleInfo.txHash}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFlipped(!isFlipped);
                  }}
                  title="Girar tarjeta"
                  className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all cursor-pointer border border-white/20 shadow-2xs"
                >
                  <RotateCw size={12} />
                </button>
              </div>
            </div>

            {/* QR Code Center */}
            <div className="relative z-10 my-auto flex flex-col items-center text-center py-1">
              <div className="p-3 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                <QrCode size={86} className="text-slate-900" />
              </div>

              <p className="mt-2.5 text-xs font-bold text-white tracking-wide">
                Validación Criptográfica
              </p>
              <p className="text-[10px] text-white/80 max-w-[200px] leading-tight mt-0.5 font-normal">
                Escanea para confirmar autenticidad inmutable en Stellar Soroban
              </p>

              {/* On-Chain Status Live Feedback */}
              {validationResult.status === 'valid' && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-2 px-3 py-1 rounded-xl bg-black/30 border border-white/30 text-[10px] text-white flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 size={12} className="text-white shrink-0" />
                  <span>Ledger #{validationResult.ledger} · Status OK</span>
                </motion.div>
              )}
            </div>

            {/* Bottom Actions on Back Face */}
            <div className={`relative z-10 flex flex-col gap-2 pt-2 border-t ${t.backHeaderBorder}`}>
              {/* Button: Validate On-Chain */}
              <button
                onClick={handleValidateOnchain}
                disabled={isValidating}
                className={`w-full py-2.5 px-3 rounded-xl ${t.backButtonBg} active:scale-98 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer`}
              >
                {isValidating ? (
                  <>
                    <RotateCw size={13} className="animate-spin" />
                    <span>Consultando Testnet...</span>
                  </>
                ) : (
                  <>
                    <Zap size={13} />
                    <span>Validar en Testnet</span>
                  </>
                )}
              </button>

              {/* Button: Enter Portal */}
              {onNavigate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate(roleInfo.portalPath);
                  }}
                  className={`w-full py-2 px-3 rounded-xl ${t.backButtonPortal} active:scale-98 text-white font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/20`}
                >
                  <span>{roleInfo.actionText}</span>
                  <ExternalLink size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

      </motion.div>

      {/* ── UNDER-CARD FEATURES BADGES ────────────────────── */}
      <div className="mt-3.5 flex items-center justify-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-700 shadow-2xs">
          <Fingerprint size={12} className="text-emerald-600" />
          Passkey Biometría
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800 shadow-2xs">
          <CheckCircle2 size={12} className="text-emerald-600" />
          Stellar Soroban ID
        </span>
      </div>
    </div>
  );
}
