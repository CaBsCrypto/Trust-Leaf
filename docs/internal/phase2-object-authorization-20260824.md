# Fase 2 — autorización por objeto y anti-replay legacy

Rama: `phase2/object-authorization-20260822`. Alcance local con fixtures sintéticos; no habilita Testnet ni producción.

## Implementado y verificado

- Puerto server-side `LegacyObjectAuthorizationPort` para resolver `subject → actor`, `actor → cuenta técnica` y `receipt → médico/paciente/dispensarios autorizados`.
- Adaptador local in-memory acepta exclusivamente configuración marcada `synthetic-fixture`. Ausencia o configuración inválida responde fail-closed.
- El principal JWT/RBAC de Fase 1 se cruza con el rol persistido del actor. Un rol de token que no coincide con el vínculo server-side se rechaza.
- Acceso a receipts exige propiedad/asignación por objeto: médico emisor, paciente titular, dispensario asignado o admin autorizado. Se rechazan receipts de otro actor aun cuando el rol y scope sean válidos.
- Los handlers conectados en `server.ts` obtienen cuentas de médico, paciente, dispensario y admin desde `res.locals.objectAuthorization`, nunca de email o dirección enviada por el cliente.
- Los campos de identidad o firma controlados por el cliente (`email`, direcciones de actor, `subject`, roles y XDR) se rechazan antes del handler.
- Emisión y operaciones de receipt exigen una clave idempotente opaca. El puerto reserva la operación de forma atómica y rechaza replay o reutilización con payload distinto.
- Los endpoints de submission XDR, passkey send y custodia DeFindex responden deshabilitados. Ambos kill-switches siguen en `false`.

## Handlers conectados

- Stellar Express legacy: faucet técnico, wallet derivada, dashboard propio, emisión/build médico, validar/build/dispensar/retener/liberar por dispensario, registro/revocación admin, lectura passport propia y verificación de receipt autorizada.
- Passkey Express legacy: lectura del contrato limitada al `keyId` vinculado; `send` está deshabilitado.
- DeFindex Express legacy: balance propio y builders usan la cuenta vinculada server-side; submit y firma custodial están deshabilitados.

## Evidencia reproducible

- `npm run test:legacy-object-auth`: propiedad positiva, médico/dispensario/paciente cruzado, target manipulado, dirección/email/XDR de cliente, keyId ajeno, idempotencia, replay y configuración ausente.
- `npm run test:legacy-route-auth`: JWT, roles, scopes y clasificación de rutas de Fase 1.
- `npm run test:pilot-safety`: submission y mutaciones continúan cerradas.
- `npm run lint`, `npm run build` y `npm run preflight` validan integración completa cuando el entorno local dispone de dependencias.

## Límites y gates restantes

- El puerto define la semántica durable y CAS requerida, pero el único adaptador habilitado es in-memory sintético. Antes de cualquier piloto se necesita un repositorio durable cifrado, transaccional y auditado, revisado por seguridad.
- Los handlers serverless bajo `api/stellar/*` no comparten todavía la cadena middleware Express de Fases 1–2. No deben exponerse como superficie operacional hasta instalar el mismo adaptador de JWT y objetos o retirarlos.
- La verificación SIS legacy que recibe RUN/RUT queda efectivamente bloqueada por el rechazo de identificadores del cliente. Requiere un flujo administrativo documental separado y auditado; no se considera conectada en esta fase.
- El ledger idempotente actual no guarda una respuesta recuperable; rechaza el segundo uso. Una implementación durable debe definir retención, estado `in_progress/completed/failed` y recuperación segura tras timeout.
- La emisión/dispensación firmada necesita custodia KMS/HSM y autorización de comando server-side; no se acepta XDR del cliente.
- No se configuraron IdP, JWKS, Postgres/Supabase, KMS/HSM, cuentas externas ni datos reales. No se ejecutaron transacciones ni se evaluó validez clínica/legal.
