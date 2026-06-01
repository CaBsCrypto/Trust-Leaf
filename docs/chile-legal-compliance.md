# Marco de Cumplimiento Legal y Regulatorio: Ecosistema Chile

Este documento detalla cómo la arquitectura tecnológica y descentralizada de **Trust Leaf** se acopla, respeta y potencia el cumplimiento del marco legal y sanitario chileno en relación con el cannabis medicinal, abarcando las normativas de la **Superintendencia de Salud (SIS)**, el **Instituto de Salud Pública (ISP)**, el **Ministerio de Salud (MINSAL)**, la **Ley 20.000** y la reciente **Ley 21.575**.

---

## 🏗️ 1. Resumen de la Matriz de Cumplimiento

| Normativa Chilena | Exigencia Legal | Solución Tecnológica Trust Leaf |
| :--- | :--- | :--- |
| **Ley 21.575 (Modificación Ley 20.000)** | La receta médica es causa suficiente de justificación para el cultivo y posesión de cannabis medicinal, siempre que defina dosis y domicilio. | **Resguardo Digital de Autocultivo**: Anclaje criptográfico e inmutable en Stellar del certificado de autocultivo con geolocalización y límite de macetas. |
| **Ley 20.000 (Artículo 8)** | Exención penal para el cultivo exclusivo y próximo en el tiempo destinado al tratamiento médico personal. | **Firma Clínica No Custodial**: Recetas emitidas bajo firmas de médicos cirujanos plenamente habilitados que sirven de justificación ante fiscalías. |
| **Decreto 404 / 466 (MINSAL & ISP)** | Exige receta médica retenida para estupefacientes y preparados de Recetario Magistral, además del control de stock en libro oficial. | **Libro de Control de Estupefacientes**: Panel de trazabilidad para el dispensario que registra lote, gramaje exacto entregado, médico y paciente. |
| **Superintendencia de Salud (SIS)** | Únicamente los médicos cirujanos autorizados e inscritos en el Registro de Prestadores pueden emitir recetas válidas. | **Validación Profesional SIS**: Onboarding mandatorio de RUT y Registro SIS con validación administrativa previa a la habilitación on-chain. |
| **Ley 19.628 (Protección de Datos)** | Resguardo de datos personales sensibles (diagnósticos, síntomas y tratamientos médicos). | **Privacidad Criptográfica**: La historia clínica se encripta off-chain. La blockchain solo registra el hash clínico y metadatos mínimos para dispensar. |

---

## ⚖️ 2. Cumplimiento de la Ley 21.575 y Ley 20.000 (Artículo 8)

### El Problema Legal en Chile
Históricamente, los pacientes chilenos que cultivaban su medicina bajo la Ley 20.000 Art. 8 sufrían incautaciones y detenciones debido a la ambigüedad en la fiscalización. La **Ley 21.575** (publicada en 2023) vino a resolver esto al declarar explícitamente:
> *"La receta médica extendida por un médico cirujano tratante constituirá causa justificada y suficiente para excluir de la sanción penal [...] el cultivo personal de plantas de cannabis medicinal."*

### La Solución de Trust Leaf
Trust Leaf digitaliza e inmutablemente ancla esta causa de justificación en la blockchain de Stellar:
1. **Verificabilidad Instantánea**: El paciente posee un código QR en su Smart Wallet que resuelve a la URL de validación pública de Trust Leaf.
2. **Prueba de Inmutabilidad**: Al escanearse, se demuestra que la receta y el permiso de autocultivo fueron emitidos y firmados digitalmente por un médico real en una estampa de tiempo (Ledger) inalterable anterior a cualquier fiscalización, destruyendo cualquier sospecha de falsificación o emisión retroactiva.
3. **Metadatos Anclados**: El ledger Stellar resguarda la dirección exacta del cultivo, la comuna, la región y el límite máximo de plantas autorizadas por el médico clínico.

---

## 🩺 3. Acreditación Clínica ante la Superintendencia de Salud (SIS)

El ejercicio ilegal de la profesión médica es sancionado penalmente en Chile. Para blindar el ecosistema clínico, Trust Leaf opera bajo un riguroso flujo de alta:
1. **Ingreso del Registro SIS**: Durante el onboarding, el médico cirujano debe ingresar obligatoriamente su **RUT Profesional** y su **Número de Registro SIS** de prestadores individuales acreditados.
2. **Validación del RUT (Módulo 11)**: El frontend verifica matemáticamente que el RUT ingresado sea real y no contenga discrepancias de dígito verificador.
3. **Aprobación Multi-Firma**: El administrador de la red contrasta manualmente la credencial en el portal público de la Superintendencia de Salud antes de gatillar la transacción `add_doctor` en el contrato Soroban. Solo los médicos con estado `approved` y firmantes válidos on-chain pueden autorizar y emitir recetas.

---

## 💊 4. Regulación de Farmacopea Magistral (ISP & MINSAL)

Los medicamentos elaborados a base de cannabis en Chile no se comercializan como productos masivos estándar, sino como **Preparados Magistrales** elaborados bajo receta médica controlada en establecimientos debidamente autorizados por el **Instituto de Salud Pública (ISP)**.

### Experiencia del Médico (Recetario Magistral)
El creador de recetas de Trust Leaf guía al clínico a formular la medicina de forma personalizada:
* **Selección de Vehículo Farmacéutico**: Aceite sublingual, Flor vaporizada (cogollo seco), Crema emoliente tópica o Cápsulas magistrales.
* **Concentración de Cannabinoides**: Especificación obligatoria del porcentaje exacto (%) o mg/mL de **THC** y **CBD** según el perfil clínico del paciente.

### Experiencia del Dispensario (Libro de Control de Estupefacientes)
El Decreto 404 del MINSAL exige que toda farmacia autorizada lleve una bitácora trazable de stock para sustancias controladas. Trust Leaf implementa de forma nativa el **Libro de Control de Estupefacientes** en el Pov del dispensario:
1. **Resolución ISP**: El dispensario debe ingresar su número de autorización sanitaria durante el registro profesional.
2. **Bitácora Automatizada**: Cada entrega de preparados genera automáticamente una fila en el libro auditable detallando:
   * Estampa de tiempo precisa de la entrega.
   * RUT del Paciente (validado visualmente).
   * RUT y Registro SIS del médico responsable.
   * Lote del preparado farmacéutico (QC).
   * Gramajes exactos y saldo post-retiro deducido on-chain.
   * Token digital de verificación Soroban.

---

## 🔐 5. Seguridad de Datos Personales (Ley 19.628)

La ley chilena 19.628 cataloga los datos de salud como **datos sensibles**, los cuales requieren el consentimiento expreso del paciente para ser tratados y no pueden estar expuestos públicamente.

**Trust Leaf resuelve esto con una arquitectura híbrida de privacidad**:
* **Cero Datos de Salud en Blockchain**: El diagnóstico del paciente, los síntomas clínicos y las notas privadas del médico **nunca** viajan al ledger descentralizado.
* **Hash de Verificación**: La plataforma genera un hash criptográfico SHA-256 local que resume los parámetros clínicos. Este hash se registra en la blockchain como prueba científica de la autenticidad del tratamiento.
* **Acceso Compartido Temporal**: Solo el paciente tiene control criptográfico sobre su expediente a través de su wallet. Mediante códigos QR efímeros, el paciente puede autorizar de forma exclusiva al médico para revisar sus síntomas o al dispensario para leer el cupo disponible y los formatos válidos para el retiro.
