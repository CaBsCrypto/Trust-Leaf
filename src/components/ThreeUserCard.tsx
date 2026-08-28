import { useRef, useState, type MouseEvent } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { Activity, ArrowRight, CheckCircle2, Leaf, QrCode, RotateCw, ShieldCheck, Stethoscope, Store } from 'lucide-react';

type DemoCardRole = 'patient' | 'doctor' | 'dispensary';
const roles = {
  patient: { label: 'Paciente', title: 'Perfil demo 01', subtitle: 'Consentimiento y agenda sintéticos', path: '/paciente', icon: Activity, accent: 'emerald' },
  doctor: { label: 'Profesional', title: 'Perfil demo 02', subtitle: 'Panel profesional en modo seguro', path: '/medico', icon: Stethoscope, accent: 'sky' },
  dispensary: { label: 'Dispensario', title: 'Perfil demo 03', subtitle: 'Estados de entrega simulados', path: '/dispensario', icon: Store, accent: 'amber' },
} as const;
const theme = {
  emerald: { ring: 'border-emerald-300', badge: 'bg-emerald-100 text-emerald-800', back: 'from-emerald-700 to-teal-800' },
  sky: { ring: 'border-sky-300', badge: 'bg-sky-100 text-sky-800', back: 'from-sky-700 to-cyan-800' },
  amber: { ring: 'border-amber-300', badge: 'bg-amber-100 text-amber-900', back: 'from-amber-700 to-orange-800' },
};

export default function ThreeUserCard({ onNavigate }: { onNavigate: (path: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [roleKey, setRoleKey] = useState<DemoCardRole>('patient');
  const [flipped, setFlipped] = useState(false);
  const [complete, setComplete] = useState(false);
  const mouseX = useMotionValue(0); const mouseY = useMotionValue(0);
  const spring = { damping: 22, stiffness: 200, mass: 0.5 };
  const rotateX = useSpring(useTransform(mouseY, [-.5, .5], [9, -9]), spring);
  const rotateY = useTransform(useSpring(useTransform(mouseX, [-.5, .5], [-13, 13]), spring), value => value + (flipped ? 180 : 0));
  const role = roles[roleKey]; const colors = theme[role.accent]; const RoleIcon = role.icon;
  const move = (event: MouseEvent<HTMLDivElement>) => { if (!ref.current || reduceMotion) return; const rect = ref.current.getBoundingClientRect(); mouseX.set((event.clientX - rect.left) / rect.width - .5); mouseY.set((event.clientY - rect.top) / rect.height - .5); };
  const reset = () => { mouseX.set(0); mouseY.set(0); };
  return <div className="relative flex select-none flex-col items-center [perspective:1400px]" aria-label="Tarjeta interactiva de demostración">
    <div className="z-10 mb-4 flex rounded-2xl border border-slate-200 bg-slate-100/90 p-1 shadow-sm" aria-label="Seleccionar rol demo">{(Object.keys(roles) as DemoCardRole[]).map(key => { const item = roles[key]; const Icon = item.icon; return <button key={key} type="button" onClick={() => { setRoleKey(key); setFlipped(false); setComplete(false); }} aria-pressed={roleKey === key} className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-bold transition sm:px-3 ${roleKey === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}><Icon size={13}/>{item.label}</button>; })}</div>
    <div ref={ref} onMouseMove={move} onMouseLeave={reset} className="relative aspect-[9/16] w-[270px] sm:w-[290px] md:w-[305px]">
      <motion.div className="relative h-full w-full" style={{ transformStyle: 'preserve-3d', rotateX: reduceMotion ? 0 : rotateX, rotateY: reduceMotion ? (flipped ? 180 : 0) : rotateY }}>
        <section className={`absolute inset-0 flex flex-col overflow-hidden rounded-[26px] border ${colors.ring} bg-gradient-to-b from-white via-white to-slate-100 p-5 shadow-[0_26px_65px_-25px_rgba(15,23,42,.45)]`} style={{ backfaceVisibility: 'hidden' }} aria-label={`${role.label}: frente de tarjeta demo`}>
          <header className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="rounded-xl bg-slate-900 p-2 text-white"><Leaf size={17}/></span><span><b className="block text-xs text-slate-900">TrustLeaf</b><span className="block text-[8px] font-bold uppercase tracking-[.16em] text-slate-400">Experiencia demo</span></span></div><button type="button" onClick={() => setFlipped(true)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500" aria-label="Girar tarjeta"><RotateCw size={15}/></button></header>
          <div className="my-auto"><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-[.12em] ${colors.badge}`}><RoleIcon size={11}/>Rol sintético</span><h2 className="mt-4 text-2xl font-bold text-slate-950">{role.title}</h2><p className="mt-1 text-xs font-medium text-slate-500">{role.subtitle}</p><div className="mt-5 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-slate-400">Recorrido seguro</p><p className="mt-2 text-sm font-bold text-slate-900">Escenario demostrativo</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">Ejemplo ficticio · sin identidad, receta ni datos clínicos.</p></div></div>
          <footer className="border-t border-slate-200 pt-4 text-[10px]"><span className="font-bold text-slate-700">Escenario activo</span><span className="float-right font-bold uppercase tracking-wider text-slate-400">Sólo demo</span></footer>
        </section>
        <section className={`absolute inset-0 flex flex-col overflow-hidden rounded-[26px] border border-white/30 bg-gradient-to-br ${colors.back} p-5 text-white shadow-2xl`} style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }} aria-label={`${role.label}: reverso de tarjeta demo`}><header className="flex items-center justify-between border-b border-white/20 pb-4"><span className="flex gap-2 text-xs font-bold"><ShieldCheck size={16}/>Simulación local</span><button type="button" onClick={() => setFlipped(false)} className="rounded-xl border border-white/20 bg-white/10 p-2" aria-label="Volver al frente"><RotateCw size={15}/></button></header><div className="my-auto text-center"><div className="inline-block rounded-3xl bg-white p-4 text-slate-950"><QrCode size={96} aria-label="QR decorativo de demostración"/></div><p className="mt-5 text-sm font-bold">QR visual de demostración</p><p className="mt-2 text-[11px] text-white/75">No contiene identidad ni información clínica.</p>{complete && <p role="status" className="mt-4 text-[10px] font-bold"><CheckCircle2 className="mr-1 inline" size={13}/>Simulación completada</p>}</div><div className="space-y-2.5"><button type="button" onClick={() => setComplete(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-bold text-slate-900">Ejecutar simulación</button><button type="button" onClick={() => onNavigate(role.path)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-xs font-bold">Abrir vista demo <ArrowRight size={14}/></button></div></section>
      </motion.div>
    </div><p className="mt-4 max-w-[290px] text-center text-[10px] leading-relaxed text-slate-500">Mueve el cursor para inclinar · gira la tarjeta para explorar</p>
  </div>;
}
