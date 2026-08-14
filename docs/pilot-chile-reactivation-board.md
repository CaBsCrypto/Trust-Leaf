# TrustLeaf — tablero de reactivación para piloto clínico en Chile

Fecha de inicio: 2026-08-13  
Rama de integración: `reactivate/pilot-chile-integration-20260813`  
Regla de seguridad: `main`, producción, transacciones reales y datos personales clínicos quedan fuera de alcance sin autorización explícita.

## Objetivo de la iteración

Preparar la ruta más corta y segura hacia un piloto controlado con un médico en Chile, mejorando el flujo de recetas y el dashboard médico sin presentar la capa blockchain como parte de la experiencia clínica.

## Frentes y entregables

| Frente | Responsable / revisión | Estado | Rama | Entregable |
| --- | --- | --- | --- | --- |
| Legal y regulación chilena | Agente Legal Chile; revisión final Scrum Master | En investigación | Solo lectura sobre integración | Fuentes oficiales, límites, checklist abogado/socio clínico y bloqueadores |
| Producto clínico | Agente Producto Clínico; integración Scrum Master | En auditoría | Solo lectura sobre integración | Flujo del primer médico, dashboard y brechas del producto |
| Arquitectura y seguridad | Agente Arquitectura/Seguridad; integración Scrum Master | En auditoría | Solo lectura sobre integración | Riesgos priorizados, separación de datos, roles, auditoría y entorno seguro |
| Refactorización e implementación | Líder técnico / Scrum Master | Pendiente de auditorías | `reactivate/pilot-chile-integration-20260813` | Mejoras seguras y verificables de alto valor |
| QA y piloto | Líder técnico con revisión independiente | Pendiente | `reactivate/pilot-chile-integration-20260813` | Pruebas reproducibles sin datos reales, onboarding y criterios de entrada/salida |

## Puertas de decisión

1. No declarar aptitud para producción clínica sin revisión legal y clínica documentada.
2. No almacenar datos reales hasta validar controles de acceso, persistencia, trazabilidad, retención y respuesta a incidentes.
3. No emitir recetas reales ni activar transacciones reales durante las pruebas.
4. Todo cambio debe pasar lint/build y pruebas proporcionales antes de integrarse.
5. Push remoto, despliegue y piloto requieren autorización explícita del usuario.

## Backlog inicial

- P0: comprobar autenticación, autorización por rol, persistencia y exposición de secretos.
- P0: definir qué datos permanecen fuera de cadena y qué comprobantes no sensibles podrían anclarse.
- P0: delimitar legalmente la emisión de recetas y sustancias sujetas a control.
- P1: hacer accionable el dashboard del médico con agenda, consentimiento, consulta, nota, receta y seguimiento.
- P1: crear un modo demostración/piloto con datos sintéticos y estados reproducibles.
- P1: añadir trazabilidad visible y soporte operativo.
- P2: preparar onboarding, guion de sesión y métricas de adopción del primer médico.

## Definición de terminado

- Hallazgos legales y técnicos documentados, con riesgos residuales explícitos.
- Flujo médico usable de extremo a extremo con datos sintéticos.
- Pruebas/lint/build en verde o excepciones justificadas.
- Checklist de piloto con responsables, criterios de entrada/salida y decisiones reservadas al usuario.
- Ningún cambio en `main`, producción o servicios con datos reales.
