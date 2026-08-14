# Arquitectura y seguridad — estado de preparación

## Bloqueadores P0

- Endpoints firmantes carecen de autenticación y RBAC. La barrera añadida en esta rama los mantiene cerrados por defecto; no sustituye identidad ni autorización.
- Agenda, ficha, consentimiento y notas viven mayormente en estado local/demo, sin backend clínico, cifrado/KMS, retención, respaldo o restauración.
- Reglas Firestore actuales no representan el flujo clínico: el paciente puede crear su receta, mientras médico no puede consumir consentimiento ni ficha.
- Datos on-chain permiten correlacionar paciente, médico, cantidades y tiempos; el hash clínico determinista puede confirmarse por diccionario.
- No hay auditoría clínica off-chain, pruebas API/RBAC/reglas ni respuesta a incidentes.

## Arquitectura objetivo mínima

- Identidad server-side y claims por rol; vínculo aprobado UID ↔ profesional ↔ credencial; deny-by-default y separación de funciones.
- Almacén clínico privado cifrado por registro con llaves gestionadas, versiones/adendas, retención, backup/restore y acceso de mínimo privilegio.
- Consentimiento server-side evaluado en cada lectura, con propósito, alcance, vencimiento y revocación efectiva.
- Auditoría append-only de login, acceso, consentimiento, cambios, firma, dispensación, exportación y errores.
- Cadena pública limitada a compromisos no confirmables y datos mínimos después de DPIA y rediseño contractual; nunca RUT, diagnóstico, receta o notas.
- Proyecto testnet y base de datos separados, datos sintéticos, secretos ausentes hasta superar controles.

## Próximo incremento técnico

Implementar autenticación/RBAC y pruebas 401/403 antes de volver a habilitar mutaciones; luego persistencia privada y consentimiento efectivo, reglas probadas en emulador, auditoría y recuperación. Solo después corresponde revisión independiente de seguridad y decisión legal/clínica.
