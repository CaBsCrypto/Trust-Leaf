import { motion } from 'motion/react';
import { Database, FileDigit, Search, Stethoscope } from 'lucide-react';

export default function Process() {
  const steps = [
    {
      icon: <FileDigit size={24} />,
      title: 'Expediente privado',
      desc: 'El paciente porta sintomas, examenes y respaldos cifrados. Solo comparte acceso temporal cuando hace falta.'
    },
    {
      icon: <Stethoscope size={24} />,
      title: 'Receta con cupo',
      desc: 'El medico valida el caso, emite una receta on-chain y define gramos disponibles para retiros parciales.'
    },
    {
      icon: <Search size={24} />,
      title: 'Dispensa por lote',
      desc: 'El dispensario valida cupo, registra lote/cantidad y no quema el tratamiento completo.'
    },
    {
      icon: <Database size={24} />,
      title: 'Prueba verificable',
      desc: 'Stellar conserva hashes, estado y trazabilidad. Los datos clinicos siguen privados.'
    }
  ];

  return (
    <section className="py-20 md:py-24 bg-brand-green-deep text-brand-ivory relative overflow-hidden">
      <div className="container mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center mb-16 md:mb-20">
          <h2 className="text-3xl md:text-5xl font-serif mb-6">El flujo que vamos a grabar</h2>
          <p className="text-brand-ivory/60 max-w-2xl mx-auto text-sm md:text-base">Desde el historial privado del paciente hasta el retiro parcial en dispensario, cada paso queda separado por actor y verificable sin exponer informacion sensible.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8">
          {steps.map((step, i) => (
            <motion.div 
              key={`process-step-${i}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="relative p-6 md:p-8 bg-white/5 rounded-3xl md:rounded-2xl border border-white/10 group hover:bg-white/10 transition-all"
            >
              <div className="text-brand-gold mb-6 group-hover:scale-110 transition-transform">{step.icon}</div>
              <div className="absolute top-6 right-6 md:top-8 md:right-8 text-3xl md:text-4xl font-serif text-white/5 font-bold">0{i+1}</div>
              <h4 className="text-lg md:text-xl font-bold mb-3">{step.title}</h4>
              <p className="text-xs md:text-sm text-brand-ivory/70 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
      
      {/* Background patterns */}
      <div className="absolute top-0 right-0 w-full h-full opacity-5 pointer-events-none">
        <div className="absolute top-20 right-20 w-64 h-64 border-2 border-white rounded-full translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-40 left-10 w-96 h-96 border border-white rounded-full -translate-x-1/2 translate-y-1/2" />
      </div>
    </section>
  );
}
