# Auditoría reproducible del flujo médico–paciente

Estado auditado: `main` en `506417a`. Esta auditoría es estática y usa únicamente código, rutas, reglas y pruebas del repositorio. No inicia sesiones, no escribe datos y no ejecuta acciones clínicas o financieras.

## Comando único

```bash
npm run audit:medical-flow
```

El comando falla cuando una capacidad incluida en la matriz no tiene la ruta, pantalla/control o implementación de estado/persistencia que su declaración presupone. Una capacidad solo podría declararse `available` si también tiene reglas de persistencia y una prueba reproducible; actualmente ninguna se declara así.

## Interpretación de estados

- `partial` / `partial-demo`: existe UI parcial; no hay flujo cerrado.
- `demo-ui` / `demo-local`: funciona como demostración en navegador; la nube no está probada o está bloqueada.
- `synthetic` / `derived-demo`: datos ficticios o estado calculado desde fixtures/permisos.
- `demo-testnet`: combina vista previa sintética con lecturas/operaciones testnet; no implica validez clínica.
- `experimental-demo`: prototipo técnico que no debe recibir datos reales.

## Límites explícitos

No cubre identidad profesional real, E2E multiusuario, reglas Firebase dinámicas, cifrado/KMS productivo, auditoría clínica, exactitud médica, normativa, farmacia, receta válida, disponibilidad real, notificaciones entregadas ni producción. El build y preflight prueban compilación y gates básicos; no convierten estas capacidades en clínicas o productivas.

## Hallazgos de consistencia

1. Reserva y agenda muestran confirmación e intentan Firestore, pero `main` no permite colecciones `agenda` ni `notifications`; la UI puede aparentar éxito con escritura rechazada.
2. La nota clínica guarda una forma distinta a la requerida por `firestore.rules` (`recordType` y `privatePayloadRef`), por lo que el almacenamiento local funciona mientras la nube falla cerrada.
3. Pacientes en seguimiento no es un registro longitudinal: deriva de permisos y fixtures demo.
4. El directorio mezcla fixtures de dispensarios con solicitudes aprobadas; no representa disponibilidad, compatibilidad ni stock reales.
5. La UI tiene más estados de receta que las pruebas de flujo médico; la rama candidata `feature/synthetic-prescription-lifecycle-20260813` añade un modelo y puertos sintéticos, pero no está integrada en `main`.
6. La rama `release/final-readiness-20260813` y `swarm/auth-rbac-20260813` endurecen auth/reglas, pero siguen fuera de `main` y no cierran agenda, reservas o ficha clínica E2E.
