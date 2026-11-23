import { PackageCheck, ReceiptText, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import './dispensary-traceability.css';

const copy = {
  es: {
    title: 'Trazabilidad para dispensarios',
    intro: 'Sigue cada entrega desde el lote recibido hasta el comprobante privado.',
    steps: [
      ['Comprueba el permiso', 'El nombre del paciente y el saldo del tratamiento se muestran mientras su permiso esté vigente.'],
      ['Confirma la entrega', 'Revisa el lote, el stock y el saldo disponible antes de confirmar la cantidad que vas a entregar.'],
      ['Consulta el comprobante', 'En el historial privado, cada comprobante propio enlaza al movimiento de stock y a la ficha del lote en inventario.'],
    ],
    example: 'Ejemplo ilustrativo de un lote',
    movements: ['Recepción del lote', 'Entrega confirmada', 'Stock después de la entrega'],
    history: 'El historial conserva los 90 g de ese momento. El inventario muestra el stock actual del lote, con sus movimientos posteriores.',
    privacy: 'Si el paciente revoca el permiso, el dispensario conserva el comprobante propio y pierde acceso al nombre y al saldo.',
  },
  en: {
    title: 'Traceability for dispensaries',
    intro: 'Follow each delivery from the batch received to the private receipt.',
    steps: [
      ['Check permission', 'The patient’s name and remaining treatment allowance are visible while their permission is active.'],
      ['Confirm the delivery', 'Check the batch, stock, and remaining allowance before confirming the quantity you will dispense.'],
      ['Review the receipt', 'In the private history, each receipt from your dispensary links to the stock movement and the batch in inventory.'],
    ],
    example: 'Illustrative batch example',
    movements: ['Stock received', 'Delivery confirmed', 'Stock after delivery'],
    history: 'The history records the 90 g at the time of delivery. Inventory shows the current batch stock after any later movements.',
    privacy: 'If the patient revokes permission, the dispensary keeps its own receipt and loses access to the patient’s name and remaining allowance.',
  },
};

const stepIcons = [ShieldCheck, PackageCheck, ReceiptText];
const quantities = ['+100 g', '−10 g', '90 g'];

export default function DispensaryTraceability() {
  const { language } = useLanguage();
  const text = copy[language];

  return (
    <section id="trazabilidad" className="tl-relieve-container tl-dispensary-trace" aria-labelledby="tl-dispensary-trace-title" tabIndex={-1}>
      <div className="tl-dispensary-trace__layout">
        <div>
          <h2 id="tl-dispensary-trace-title">{text.title}</h2>
          <p className="tl-dispensary-trace__intro">{text.intro}</p>
          <ol className="tl-dispensary-trace__steps" role="list">
            {text.steps.map(([title, description], index) => {
              const Icon = stepIcons[index];
              return (
                <li key={title}>
                  <span className="tl-relieve-icon"><Icon size={22} aria-hidden="true" /></span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        <figure className="tl-dispensary-trace__example">
          <figcaption>{text.example}</figcaption>
          <dl>
            {text.movements.map((label, index) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{quantities[index]}</dd>
              </div>
            ))}
          </dl>
          <p>{text.history}</p>
        </figure>
      </div>
      <p className="tl-dispensary-trace__privacy">{text.privacy}</p>
    </section>
  );
}
