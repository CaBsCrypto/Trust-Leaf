import { motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  Fingerprint,
  ShieldCheck,
  Wallet,
  Laptop,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { ReactNode } from 'react';
import { getStoredPasskeyWallet } from '../lib/stellar/passkeys';

type PrimaryMethod = 'passkey' | 'freighter' | 'demo' | null;

export interface WalletSetupState {
  primaryMethod: PrimaryMethod;
  hasFreighterBackup: boolean;
  walletLabel: string;
  contractAccount: string;
  networkLabel?: string;
  passkeyId?: string;
  freighterAddress?: string;
}

interface WalletOnboardingProps {
  title: string;
  eyebrow: string;
  description: string;
  primaryMethod: PrimaryMethod;
  hasFreighterBackup: boolean;
  walletLabel: string;
  contractAccount: string;
  passkeyTitle: string;
  passkeyDescription: string;
  passkeyAction: string;
  freighterTitle: string;
  freighterDescription: string;
  freighterAction: string;
  demoTitle: string;
  demoDescription: string;
  demoAction: string;
  linkedLabel: string;
  backupTitle: string;
  backupDescription: string;
  backupAction: string;
  statusTitle: string;
  statusPrimary: string;
  statusBackup: string;
  statusAccount: string;
  statusNetwork: string;
  networkValue: string;
  primaryPasskeyValue: string;
  primaryFreighterValue: string;
  primaryDemoValue: string;
  primaryEmptyValue: string;
  backupConnectedValue: string;
  backupEmptyValue: string;
  continueAction: string;
  statusHint?: string | null;
  statusError?: string | null;
  passkeyBusy?: boolean;
  freighterBusy?: boolean;
  backupBusy?: boolean;
  onConnectPasskey: (attachment?: 'platform' | 'cross-platform') => void | Promise<void>;
  onConnectFreighter: () => void | Promise<void>;
  onConnectDemo: () => void | Promise<void>;
  onLinkFreighterBackup: () => void | Promise<void>;
  onContinue: () => void;
  onResetWallet?: () => void | Promise<void>;
}

export default function WalletOnboarding({
  title,
  eyebrow,
  description,
  primaryMethod,
  hasFreighterBackup,
  walletLabel,
  contractAccount,
  passkeyTitle,
  passkeyDescription,
  passkeyAction,
  freighterTitle,
  freighterDescription,
  freighterAction,
  demoTitle,
  demoDescription,
  demoAction,
  linkedLabel,
  backupTitle,
  backupDescription,
  backupAction,
  statusTitle,
  statusPrimary,
  statusBackup,
  statusAccount,
  statusNetwork,
  networkValue,
  primaryPasskeyValue,
  primaryFreighterValue,
  primaryDemoValue,
  primaryEmptyValue,
  backupConnectedValue,
  backupEmptyValue,
  continueAction,
  statusHint,
  statusError,
  passkeyBusy = false,
  freighterBusy = false,
  backupBusy = false,
  onConnectPasskey,
  onConnectFreighter,
  onConnectDemo,
  onLinkFreighterBackup,
  onContinue,
  onResetWallet,
}: WalletOnboardingProps) {
  const onboardingComplete = primaryMethod !== null;
  const canAddBackup = primaryMethod === 'passkey' && !hasFreighterBackup;

  const primaryValue =
    primaryMethod === 'passkey'
      ? primaryPasskeyValue
      : primaryMethod === 'freighter'
        ? primaryFreighterValue
        : primaryMethod === 'demo'
          ? primaryDemoValue
          : primaryEmptyValue;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-[40px] bg-brand-green-deep p-8 md:p-10 text-brand-ivory shadow-2xl border border-brand-gold/20 overflow-hidden relative"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-brand-gold/10 blur-3xl" />
          <div className="absolute left-1/2 top-10 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <span className="h-px w-8 bg-brand-gold" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-gold">
                {eyebrow}
              </span>
            </div>

            <div className="space-y-3">
              <h4 className="text-3xl md:text-5xl font-serif leading-tight">{title}</h4>
              <p className="max-w-xl text-sm md:text-base leading-relaxed text-brand-ivory/70">
                {description}
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {/* Passkey Custom Card */}
              <div
                className={`rounded-[28px] border p-5 text-left transition-all ${
                  primaryMethod === 'passkey'
                    ? 'border-brand-gold bg-brand-gold/10 shadow-[0_12px_30px_rgba(197,164,126,0.12)]'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className={`rounded-2xl p-3 ${primaryMethod === 'passkey' ? 'bg-brand-gold text-brand-green-deep' : 'bg-white/10 text-brand-ivory'}`}>
                    <Fingerprint size={22} />
                  </div>
                  {primaryMethod === 'passkey' && <CheckCircle2 size={18} className="text-brand-gold" />}
                </div>

                <p className="mt-5 text-lg font-bold text-brand-ivory">{passkeyTitle}</p>
                <p className="mt-2 text-sm leading-relaxed text-brand-ivory/60">{passkeyDescription}</p>

                {primaryMethod === 'passkey' ? (
                  <div className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-gold">
                    {linkedLabel}
                    <ArrowRight size={14} />
                  </div>
                ) : passkeyBusy ? (
                  <div className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-gold animate-pulse">
                    Conectando...
                    <ArrowRight size={14} className="animate-spin" />
                  </div>
                ) : (() => {
                  const hasWallet = getStoredPasskeyWallet() !== null;
                  if (hasWallet) {
                    return (
                      <button
                        onClick={() => onConnectPasskey()}
                        disabled={passkeyBusy || freighterBusy || backupBusy}
                        className="mt-5 w-full flex items-center justify-center gap-2 rounded-2xl bg-brand-gold px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-brand-green-deep transition-all hover:bg-brand-gold/95 active:scale-95 disabled:opacity-40"
                      >
                        Iniciar Sesión con Passkey
                        <ArrowRight size={14} />
                      </button>
                    );
                  }

                  return (
                    <div className="mt-5 space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gold/80">
                        Selecciona cómo registrarte:
                      </p>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => onConnectPasskey('platform')}
                          disabled={passkeyBusy || freighterBusy || backupBusy}
                          className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-xs font-semibold text-brand-ivory transition-all hover:bg-brand-gold/15 hover:border-brand-gold/40 active:scale-[0.98] disabled:opacity-30 cursor-pointer"
                        >
                          <Laptop size={14} className="text-brand-gold shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold">Este PC / Dispositivo</p>
                            <p className="text-[10px] text-brand-ivory/40 truncate">Windows Hello o TouchID</p>
                          </div>
                          <ArrowRight size={12} className="text-brand-gold/60 shrink-0" />
                        </button>

                        <button
                          onClick={() => onConnectPasskey('cross-platform')}
                          disabled={passkeyBusy || freighterBusy || backupBusy}
                          className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-xs font-semibold text-brand-ivory transition-all hover:bg-brand-gold/15 hover:border-brand-gold/40 active:scale-[0.98] disabled:opacity-30 cursor-pointer"
                        >
                          <Smartphone size={14} className="text-brand-gold shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold">Llave Física o Celular</p>
                            <p className="text-[10px] text-brand-ivory/40 truncate">Yubikey, iPhone o Android QR</p>
                          </div>
                          <ArrowRight size={12} className="text-brand-gold/60 shrink-0" />
                        </button>

                        <button
                          onClick={() => onConnectPasskey(undefined)}
                          disabled={passkeyBusy || freighterBusy || backupBusy}
                          className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-xs font-semibold text-brand-ivory transition-all hover:bg-brand-gold/15 hover:border-brand-gold/40 active:scale-[0.98] disabled:opacity-30 cursor-pointer"
                        >
                          <Sparkles size={14} className="text-brand-gold shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold">Autodetectar</p>
                            <p className="text-[10px] text-brand-ivory/40 truncate">Preferencia del navegador</p>
                          </div>
                          <ArrowRight size={12} className="text-brand-gold/60 shrink-0" />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <WalletMethodCard
                icon={<Wallet size={22} />}
                title={freighterTitle}
                description={freighterDescription}
                actionLabel={primaryMethod === 'freighter' ? linkedLabel : freighterBusy ? 'Conectando' : freighterAction}
                active={primaryMethod === 'freighter'}
                disabled={passkeyBusy || freighterBusy || backupBusy}
                onClick={onConnectFreighter}
              />

              <WalletMethodCard
                icon={<Database size={22} />}
                title={demoTitle}
                description={demoDescription}
                actionLabel={primaryMethod === 'demo' ? linkedLabel : demoAction}
                active={primaryMethod === 'demo'}
                disabled={passkeyBusy || freighterBusy || backupBusy}
                onClick={onConnectDemo}
              />
            </div>

            {canAddBackup && (
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-brand-ivory">{backupTitle}</p>
                    <p className="mt-1 text-xs leading-relaxed text-brand-ivory/60">
                      {backupDescription}
                    </p>
                  </div>
                  <ShieldCheck className="shrink-0 text-brand-gold" size={20} />
                </div>

                <button
                  onClick={onLinkFreighterBackup}
                  disabled={passkeyBusy || freighterBusy || backupBusy}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-brand-gold px-5 py-3 text-sm font-bold text-brand-green-deep transition-all active:scale-95"
                >
                  {backupBusy ? 'Vinculando' : backupAction}
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-brand-gold/15 p-3 text-brand-gold">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">
                  {statusTitle}
                </p>
                <p className="text-lg font-bold">{walletLabel}</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <StatusRow label={statusPrimary} value={primaryValue} />
              <StatusRow
                label={statusBackup}
                value={hasFreighterBackup ? backupConnectedValue : backupEmptyValue}
              />
              <StatusRow
                label={statusAccount}
                value={contractAccount}
                mono
              />
              <StatusRow label={statusNetwork} value={networkValue} />
            </div>

            <div className="mt-6 rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-brand-ivory/40">
                Smart Wallet
              </p>
              <p className="mt-2 text-sm leading-relaxed text-brand-ivory/65">
                {primaryMethod === 'demo'
                  ? 'Acceso de prueba Testnet activo: ideal para revisar el flujo completo mientras se habilitan passkeys y wallet real.'
                  : onboardingComplete
                    ? 'Tu acceso diario queda optimizado para passkey y puedes sumar Freighter como respaldo cuando quieras.'
                    : 'Elige Passkey, Freighter o acceso de prueba para continuar sin bloquear el registro.'}
              </p>
            </div>

            {statusHint && (
              <div className="mt-4 rounded-[20px] border border-brand-gold/20 bg-brand-gold/10 p-4 text-xs leading-relaxed text-brand-ivory/80">
                {statusHint}
              </div>
            )}

            {statusError && (
              <div className="mt-4 rounded-[20px] border border-red-300/20 bg-red-500/10 p-4 text-xs leading-relaxed text-red-100">
                {statusError}
              </div>
            )}

            <button
              onClick={onContinue}
              disabled={!onboardingComplete}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-[24px] bg-brand-ivory px-5 py-4 text-sm font-bold text-brand-green-deep transition-all disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99] cursor-pointer"
            >
              {continueAction}
              <CheckCircle2 size={18} />
            </button>

            {onboardingComplete && onResetWallet && (
              <button
                onClick={onResetWallet}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-[24px] border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-200/70 hover:text-red-100 transition-all cursor-pointer"
              >
                Eliminar Billetera y Reiniciar
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function WalletMethodCard({
  icon,
  title,
  description,
  actionLabel,
  active,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-[28px] border p-5 text-left transition-all ${
        active
          ? 'border-brand-gold bg-brand-gold/10 shadow-[0_12px_30px_rgba(197,164,126,0.12)]'
          : 'border-white/10 bg-white/5 hover:bg-white/8'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`rounded-2xl p-3 ${active ? 'bg-brand-gold text-brand-green-deep' : 'bg-white/10 text-brand-ivory'}`}>
          {icon}
        </div>
        {active && <CheckCircle2 size={18} className="text-brand-gold" />}
      </div>

      <p className="mt-5 text-lg font-bold text-brand-ivory">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-brand-ivory/60">{description}</p>
      <div className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-gold">
        {actionLabel}
        <ArrowRight size={14} />
      </div>
    </button>
  );
}

function StatusRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-ivory/40">
        {label}
      </p>
      <p className={`text-right text-sm font-bold text-brand-ivory ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </p>
    </div>
  );
}
