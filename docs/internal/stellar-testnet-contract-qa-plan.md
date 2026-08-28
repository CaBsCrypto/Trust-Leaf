# Plan de QA y evidencia — receipt trazable en Stellar Testnet

Estado: diseño interno; no describe una receta clínica válida ni una capacidad disponible. No autoriza mainnet, producción, pagos, datos reales o dispensación farmacéutica.

## Decisión de prueba

El contrato `prescription` existente no es candidato para el piloto: registra direcciones estables de paciente/médico/dispensario, `medication_hash` y cantidades. Eso permite correlación y puede revelar información clínica por inferencia. La prueba debe usar un receipt nuevo y separado, con identificadores aleatorios y compromisos opacos.

Stellar será evidencia técnica de una secuencia autorizada y ordenada, no fuente de verdad clínica ni prueba de legalidad. La información clínica sintética vive fuera de cadena; el contrato no puede comprobar aritmética de cantidades ocultas sin una prueba criptográfica adicional. En la primera demostración, un servicio de política autorizado calcula el saldo sintético y firma la transición; el contrato solo valida firma/rol, versión esperada, unicidad y encadenamiento.

## Invariantes verificables

1. Cada receipt usa `receipt_id` aleatorio de 32 bytes y nunca contiene identificadores de personas.
2. Cada transición incluye `operation_id` aleatorio, `expected_version`, `previous_event_hash`, nuevo `state_commitment` y sello temporal de ledger.
3. `operation_id` solo puede consumirse una vez. Una repetición exacta devuelve el resultado ya conocido o un error determinista; nunca crea otro evento.
4. Dos transiciones concurrentes sobre la misma versión: exactamente una puede confirmar.
5. El evento `Partial` solo expresa estado y un compromiso opaco; no publica cantidad, dosis, saldo ni producto.
6. `Dispensed`, `Revoked` y `Expired` son terminales. Renovar crea otro receipt sin vínculo público; el vínculo, si corresponde, queda cifrado fuera de cadena.
7. Emisión/activación requiere rol médico sintético; parcial/dispensado, rol dispensario; revocación, médico o administrador según política; expiración se deriva del tiempo y puede materializarse idempotentemente.
8. Paciente no firma ni necesita una cuenta Stellar. Consulta mediante token QR opaco, de vida corta y con alcance mínimo.
9. Ningún evento incluye PII/PHI, RUT, diagnóstico, medicamento, dosis, cantidad, PDF, dirección, wallet del paciente, texto libre o identificador clínico correlacionable.

## Matriz mínima de pruebas

| Área | Caso positivo | Caso de rechazo |
|---|---|---|
| Emisión | médico autorizado crea v1/Active | rol incorrecto, receipt repetido, compromiso mal formado |
| Parcial | dispensario autorizado cambia vN a vN+1 | versión vieja, `operation_id` usado, receipt terminal |
| Doble dispensación | una de dos solicitudes concurrentes gana | la segunda falla por compare-and-set |
| Dispensado | compromiso final y estado terminal | nueva parcial o revocación posterior rechazada |
| Revocación | actor autorizado termina receipt activo/parcial | actor no autorizado o estado terminal |
| Expiración | timestamp de ledger supera vigencia sintética | reloj cliente no altera el resultado |
| Renovación | nuevo receipt independiente | no se publica vínculo entre ambos receipts |
| Encadenamiento | cada evento referencia hash anterior | hash anterior o número de versión incorrecto |
| QR | token válido muestra estado mínimo | expirado, manipulado, repetido o fuera de alcance |
| Privacidad | scan ABI/eventos no encuentra campos prohibidos | fixture con campo prohibido bloquea CI |

Además deben probarse límites, serialización canónica, reinicio del servicio, reintentos de RPC, reorganización/confirmación de ledger simulada, rate limiting del verificador y separación estricta entre logs operativos y datos sintéticos.

## Evidencia de la demostración Testnet

La corrida con médico, paciente y dispensario usa únicamente personajes y contenido sintéticos. El paquete de evidencia debe guardar: commit exacto, hash del WASM, network passphrase Testnet, contract ID, ledger/event IDs, resultados de pruebas, configuración de feature flags y capturas sin secretos. La correlación completa queda en un apéndice de auditoría cifrado y append-only; los logs públicos solo usan `trace_id` efímero distinto del `receipt_id`.

Se considera aprobada la demostración mínima si se observa: emisión autorizada; verificación QR mínima; dos dispensaciones parciales secuenciales; rechazo reproducible de replay y carrera; estado final; revocación en un segundo receipt; expiración controlada; y consulta por rol sin exponer el payload sintético. Esto prueba funcionamiento técnico en Testnet, no identidad profesional, consentimiento válido, indicación clínica, validez de receta ni autorización de farmacia.

## Gates antes de escribir o desplegar

- ABI y threat model revisados con lista negativa de campos.
- Política de roles, custodia y rotación de claves aprobada; secretos fuera del repositorio y navegador.
- Mutaciones Testnet deshabilitadas por defecto y habilitables solo en entorno aislado.
- Adaptador off-chain neutral; Firestore/Supabase no se declaran base clínica definitiva.
- Tests unitarios y de propiedades locales antes de cualquier deploy Testnet.
- Revisión humana del contrato y plan de rollback/pausa.
- Gates jurídico, clínico y farmacéutico separados para cualquier uso no sintético.
