# Backlog por gates para el flujo clínico demo

Cada tarea es cerrada y verificable. Ninguna autoriza producción, datos reales, emisión clínica, dispensación real, configuración de Supabase/Firebase productivo ni blockchain.

## P0 — Contratos seguros de dominio (primer lote para programación)

| ID | Tipo | Tarea cerrada | Evidencia de aceptación |
|---|---|---|---|
| P0-01 | M | Definir tipos neutrales para identidad demo, rol, alcance, consentimiento, cita, episodio y propuesta | tests de transiciones y serialización; sin PII real ni proveedor DB |
| P0-02 | M | Implementar máquina de estados sintética de propuesta/dispensación | tabla completa de transiciones permitidas/rechazadas, expiración, revocación y parcialidad |
| P0-03 | M | Crear puerto en memoria para agenda con hold y confirmación | tests de solape, expiración, doble reserva e idempotencia |
| P0-04 | M | Crear policy gate puro y fail-closed | matriz positiva/negativa para paciente, médico, dispensario y admin; deny por defecto |
| P0-05 | M | Definir contrato de token QR opaco | tests TTL, un solo uso, rotación, replay, versión y respuesta mínima; QR no contiene contenido clínico |
| P0-06 | M | Separar fixtures de dispensario, aprobación demo e inventario mock | UI y pruebas muestran etiquetas independientes y nunca infieren stock/compatibilidad |
| P0-07 | M | Actualizar auditor de capacidades para exigir evidencia por contrato | comando único falla si UI declara disponible una capacidad sin guard y test correspondiente |

## P1 — Flujos sintéticos integrados

| ID | Tipo | Tarea cerrada | Evidencia de aceptación |
|---|---|---|---|
| P1-01 | M | Onboarding médico-demo con revisión administrativa y revocación | E2E sintético: pendiente, rechazado, aprobado-demo, revocado; acceso bloqueado fuera de alcance |
| P1-02 | M | Consentimiento versionado y reserva sintética | E2E: rechazo sin consentimiento, consentimiento revocado, slot concurrente y confirmación persistida |
| P1-03 | M | Episodio, nota versionada y seguimiento sintético | corrección append-only, historial preservado, relación explícita paciente-médico |
| P1-04 | M | Verificador QR y dispensación sintética | E2E parcial/total, segundo uso rechazado, revocada/expirada rechazadas, dato mínimo |
| P1-05 | M | Renovación como nueva propuesta | evidencia de nueva identidad off-chain y referencia interna sin editar la anterior |

## P2 — Infraestructura no productiva

| ID | Tipo | Tarea cerrada | Evidencia de aceptación |
|---|---|---|---|
| P2-01 | I | Elegir repositorio mediante ADR, sin migración | comparación Firebase/Supabase/Postgres y plan reversible aprobado |
| P2-02 | I | Adaptador de emulador para auth/RBAC y persistencia | suite multiusuario autorizada/no autorizada, reglas deny-by-default, cero nube real |
| P2-03 | I | Modelo de cifrado y referencias a payload | threat model, separación metadata/payload, rotación y borrado verificable |
| P2-04 | I | Auditoría append-only con retención | pruebas de integridad, acceso, redacción, reloj y exportación controlada |
| P2-05 | I | Observabilidad sin contenido clínico | pruebas que logs/traces no contienen fixtures sensibles ni tokens completos |

## P3 — Gates antes de piloto con personas

| ID | Tipo | Decisión requerida | Evidencia mínima |
|---|---|---|---|
| P3-01 | G legal | base jurídica, consentimiento, derechos, retención y transferencias | informe de abogado chileno y matriz requisito-control |
| P3-02 | G clínico | workflow, responsabilidad, contenido y firma de propuesta/receta | aprobación de director médico y protocolo de incidentes |
| P3-03 | G farmacéutico | verificación, parcialidad, sustitución, revocación y conservación | aprobación de químico farmacéutico y escenarios de rechazo |
| P3-04 | G seguridad | identidad, cifrado, KMS, auditoría, backups y respuesta | threat model, pentest, restore drill y revisión de accesos |
| P3-05 | G privacidad | minimización, DPIA y nueva Ley 21.719 desde 1-dic-2026 | revisión jurídica vigente y plan operacional comprobable |

## Secuencia recomendada

1. Programar únicamente P0-01 a P0-07 en adaptadores neutrales y memoria.
2. Integrar P1 solo cuando cada contrato P0 tenga pruebas negativas.
3. Decidir repositorio en un ADR independiente; no presentar Firebase o Supabase como clínica definitiva antes de P2.
4. No incorporar usuarios reales hasta cerrar todos los gates P3.
5. Mantener C (QR off-chain) como arquitectura demo; cualquier cambio a blockchain requiere ADR, threat model y aprobación separada.

## Definition of Done de toda tarea

- Datos exclusivamente sintéticos y claramente etiquetados.
- Pruebas positivas, negativas, replay/concurrencia cuando corresponda.
- Sin fallback silencioso que muestre éxito tras un error de persistencia.
- Sin PII/PHI, secretos o identificadores correlacionables en logs, QR o cadena.
- Documento de limitaciones actualizado; no afirmar validez clínica, cumplimiento ni producción.
- `audit:medical-flow`, typecheck y preflight sin regresiones funcionales; fallos ambientales separados.
