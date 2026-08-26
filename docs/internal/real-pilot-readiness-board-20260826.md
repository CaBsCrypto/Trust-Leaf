# Tablero gobernado de preparación para piloto real

**Corte:** 2026-08-26. **Estado global:** NO-GO para personas/datos reales, práctica clínica, dispensación real y Testnet V2.
El Scrum Master integra sólo artefactos con Definition of Done completa; “documentado” no equivale a “implementado”.

## Definition of Done común

Cada frente exige: alcance cerrado; fixtures sin PHI/PII; pruebas positivas y negativas; typecheck/build proporcional; revisión independiente; evidencia enlazada; límites/rollback documentados; rama limpia. Un frente que dependa de infraestructura o aprobación humana permanece bloqueado y no entra a la candidata.

## Dependencias técnicas

| Entregable | Estado | Responsable/rama | Dependencia y evidencia |
|---|---|---|---|
| UX E2E sintética por roles | HECHO para revisión local | Scrum / `integration/testnet-v2-readonly-durable-20260825` | preflight + QA Browser previos; no persistencia real |
| Lector V1 Testnet read-only | HECHO acotado | Scrum / candidata técnica | smoke bounded; V2 no desplegado |
| ADR/puertos/baseline Supabase | HECHO LOCAL | Scrum / `analysis/supabase-clinical-platform-readiness-20260826` | commit `176fe83`; `qa:supabase-readiness` verde; no aplicado |
| Inspección MCP + lint/dry-run remoto | BLOQUEADO EN ESTA SESIÓN | Scrum / misma rama | MCP habilitado, pero herramientas no expuestas a la tarea preexistente; aplicación prohibida |
| RLS/Auth/KMS/restore reales | BLOQUEADO | Seguridad + plataforma | requiere proyecto, región/plan, IdP y KMS aprobados |
| TrustRegistry + ReceiptLedgerV2 | BLOQUEADO para deploy | Contratos | ceremonia/secretos/autorización Testnet separada |

## Dependencias operativas

| Entregable | Estado | Responsable/rama | Gate |
|---|---|---|---|
| Onboarding synthetic-first por rol | EN CURSO | Operaciones / rama aislada del frente | estados, runbook, evidencias y handoff |
| Verificación operacional médico/dispensario | BLOQUEADO real | Operaciones + responsables externos | fuente, cadencia, suspensión, apelación y evidencia aprobadas |
| Incident response/backup/continuidad | BLOQUEADO | Seguridad/operaciones | owners, RTO/RPO, restore e incidente ensayados |
| Soporte y escalamiento | BLOQUEADO | Producto/operaciones | canales, SLA y responsables designados |

## Dependencias clínico-regulatorias

| Entregable | Estado | Responsable/rama | Gate |
|---|---|---|---|
| Matriz Chile base | HECHO documental | Legal-readiness / `analysis/chile-real-pilot-regulatory-gate-20260825` | no constituye dictamen |
| Conversión de gaps a P0 técnico | EN CURSO | Frente Chile P0 / rama aislada | DoD por control/prueba/responsable |
| Consentimiento, ficha, retención | BLOQUEADO real | Abogado + médico + privacidad | textos, flujo, firma, acceso, rectificación y retención aprobados |
| Receta/SNRE/FEA y farmacia/QF | BLOQUEADO real | Abogado + médico + QF | integración boundary y operación autorizadas |
| Cannabis medicinal/dispensación | BLOQUEADO real | Abogado + médico + QF/ISP | criterio y workflow formalizados |

## Dependencias externas

| Decisión | Estado | Responsable | Efecto |
|---|---|---|---|
| Proyecto Supabase dev vacío + OAuth MCP | HECHO EXTERNO MÍNIMO | Usuario | no implica schema, migración ni autorización de datos |
| Supabase región/plan/DPA | BLOQUEADO | Usuario + legal/seguridad | requisito previo a cualquier evaluación con datos reales |
| KMS/HSM e IdP/JWKS | BLOQUEADO | Usuario + seguridad | habilita adapter durable y auth real |
| Revisores abogado/médico/QF | BLOQUEADO | Usuario | requisito para siquiera evaluar piloto real |
| Deploy Testnet V2 | BLOQUEADO | Usuario + ceremonia técnica | requiere autorización específica posterior |

## Camino crítico y regla de integración

1. Cerrar UX sintética y ADR Supabase con pruebas/revisión.
2. Aprobar plataforma/region/KMS/IdP sólo para entorno sintético.
3. Convertir matriz Chile en controles P0 verificables y obtener revisión externa formal.
4. Ejecutar onboarding synthetic-first, RLS multirol, cifrado, auditoría, restore e incidente.
5. Reevaluar GO/NO-GO. Ningún paso previo autoriza pacientes reales.

La candidata técnica permanece intacta hasta que cada paquete candidato tenga commit, evidencia y revisión independiente verde.
