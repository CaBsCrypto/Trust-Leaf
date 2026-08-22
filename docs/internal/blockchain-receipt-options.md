# Opciones de comprobante blockchain (análisis, no implementación)

No se autoriza construir contratos ni operar con datos reales. La fuente de verdad clínica es off-chain. Está prohibido publicar PII/PHI, RUT, diagnóstico, receta, dirección, wallet asociable al paciente o cualquier identificador estable/correlacionable. Un hash de un dato de baja entropía también puede revelar información por diccionario; los commitments deben usar nonces aleatorios y claves/pepper administrados fuera de cadena.

## Opciones

### A. Asset/NFT no transferible con metadata mutable

Representa un comprobante como asset y actualiza metadata para reflejar estado.

- Privacidad: riesgo alto de correlación por tenencia, issuer y actividad.
- Revocación: posible mediante autoridad/clawback o metadata, pero introduce custodia y semántica compleja.
- Parcialidad: metadata mutable puede perder historia o generar carreras.
- Replay: el NFT por sí solo no evita reutilizar un QR o una respuesta cacheada.
- Costos/operación: cuentas, trustlines/reservas, lifecycle de asset y gestión de claves.
- Stellar: assets nativos son transferibles salvo controles/arquitectura adicional; “soulbound” no es una garantía automática.
- Trazabilidad: alta visibilidad pública, pero no equivale a auditoría clínica.
- Límite legal: no aporta por sí solo validez a una receta.

No recomendada para piloto. La metadata mutable nunca debe ser fuente clínica ni revelar revocación, dispensación u otra acción clínica.

### B. Receipt no transferible con eventos versionados

Un contrato o servicio publica eventos para versiones de un receipt opaco.

- Privacidad: mejor que A si usa commitments rotativos, pero frecuencia y patrón temporal siguen siendo correlacionables.
- Revocación/parcialidad: modelables como eventos append-only y saldo versionado.
- Replay: requiere nonce, versión, idempotency key y validación off-chain atómica; la cadena sola no basta.
- Costos/operación: mayor complejidad, contrato, upgrades, simulación, auditoría y gestión de claves.
- Stellar: Soroban puede representar estado/eventos, sujeto a costos, límites y madurez que deben verificarse antes del piloto.
- Trazabilidad: clara para eventos técnicos, sin permitir reconstruir acciones clínicas.
- Límite legal: receipt técnico, no receta ni prueba suficiente de cumplimiento.

Posible etapa futura solo después de threat model, revisión de correlación, auditoría del contrato y necesidad demostrada.

### C. Sin NFT; commitments firmados y QR off-chain

El sistema clínico cifra y versiona todo off-chain. El QR contiene un token opaco de un solo propósito. Opcionalmente se ancla un commitment agregado/no correlacionable en testnet.

- Privacidad: mejor minimización y capacidad de rotación; aún exige tokens de alta entropía y logs protegidos.
- Revocación/parcialidad: estado transaccional off-chain con compare-and-set y ledger de auditoría.
- Replay: token rotativo/uso único, TTL, nonce, idempotency key y consumo atómico.
- Costos/operación: menor complejidad; permite validar el flujo antes de comprometer una arquitectura on-chain.
- Stellar: firma verificable y anclaje opcional sin asset clínico; para la demo puede omitirse por completo.
- Trazabilidad: auditoría completa off-chain; commitment solo demuestra coincidencia de una versión sin explicar su contenido.
- Límite legal: sigue siendo un comprobante técnico, no otorga validez clínica o jurídica.

## Comparación

| Criterio | A: asset/NFT | B: receipt/eventos | C: commitment + QR off-chain |
|---|---|---|---|
| Minimización/correlación | Baja | Media | Alta |
| Revocación | Compleja | Versionable | Directa off-chain |
| Dispensación parcial | Frágil en metadata | Buena con eventos | Buena con transacción CAS |
| Defensa replay | Externa igualmente | Externa + versión | Externa + uso único |
| Complejidad/costo | Alta | Muy alta | Menor |
| Ajuste Stellar | Controles no automáticos | Soroban/auditoría requeridos | Firmas/anclaje opcional |
| Riesgo de confundir con receta | Alto | Medio | Menor |

## Recomendación

Elegir **C para el piloto demo**, inicialmente sin escritura blockchain: repositorio sintético off-chain, firmas de servicio de desarrollo, QR opaco, expiración, revocación, dispensación parcial y replay rejection reproducibles. Un anclaje agregado en Stellar testnet puede evaluarse después y nunca debe incluir un identificador por paciente o por receta públicamente correlacionable.

Considerar B únicamente si una necesidad verificable exige timestamping público o verificación entre organizaciones sin confianza compartida, y solo cuando existan: threat model aprobado; privacidad/correlación evaluada; contrato auditado; claves/KMS; recuperación y upgrades; presupuesto; observabilidad; pruebas de carga/reorg/error; y aprobación legal, clínica y farmacéutica. A no debe usarse salvo un caso no clínico distinto y revisado.
