import { motion } from 'motion/react';
import { Database, FileDigit, Search, Stethoscope } from 'lucide-react';

export default function Process() {
  const steps = [
    {
      icon: <FileDigit size={22} />,
      title: 'Expediente privado',
      desc: 'El paciente porta síntomas, exámenes y respaldos cifrados. Solo comparte acceso temporal cuando hace falta.'
    },
    {
      icon: <Stethoscope size={22} />,
      title: 'Receta con cupo',
      desc: 'El médico valida el caso, emite una receta on-chain y define gramos disponibles para retiros parciales.'
    },
    {
      icon: <Search size={22} />,
      title: 'Dispensa por lote',
      desc: 'El dispensario valida cupo, registra lote/cantidad y no quema el tratamiento completo.'
    },
    {
      icon: <Database size={22} />,
      title: 'Prueba verificable',
      desc: 'Stellar conserva hashes, estado y trazabilidad. Los datos clínicos siguen privados.'
    }
  ];

  return (
    <section className="relative py-12 md:py-16 overflow-hidden bg-white">
      {/* Background */}
      <div className="absolute inset-0 bg-white" />
      <div className="absolute inset-0 bg-radial-neon-center" />

      <div className="container relative z-10 mx-auto px-6 md:px-12">
        <div className="text-center mb-8 md:mb-10">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700 mb-2"
          >
            Cómo funciona
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-light text-slate-950 mb-3"
          >
            Flujo trazable en 4 pasos
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-slate-600 max-w-2xl mx-auto text-sm md:text-base font-normal"
          >
            Desde el historial privado del paciente hasta el retiro parcial en dispensario, cada paso queda separado por actor y verificable sin exponer información sensible.
          </motion.p>
        </div>

        {/* Timeline line (desktop) */}
        <div className="hidden md:block absolute top-[58%] left-[12%] right-[12%] neon-line" />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 md:gap-6">
          {steps.map((step, i) => (
            <motion.div 
              key={`process-step-${i}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="relative p-6 md:p-7 bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all duration-300 group"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                  {step.icon}
                </div>
                <span className="text-2xl font-bold text-slate-300 tabular-nums">0{i+1}</span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h4>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
