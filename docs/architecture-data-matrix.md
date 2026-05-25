# Trust Leaf Data Architecture Matrix

Trust Leaf usa una arquitectura hibrida. La base de datos privada guarda la
operacion y los datos sensibles; Stellar/Soroban guarda pruebas verificables,
autorizaciones y eventos auditables. Blockchain no reemplaza la base de datos.

## Principios

- El paciente controla su informacion clinica.
- Los datos clinicos completos nunca van on-chain.
- Medicos y dispensarios requieren aprobacion admin.
- La red publica solo lo minimo: wallet autorizada, estado, hash y evento.
- Cada permiso sensible debe ser temporal, auditable y revocable.
- La DB privada debe asumir riesgo de filtracion: datos clinicos y documentos
  se guardan cifrados, con llaves separadas del almacenamiento.
- Blockchain se usa para integridad, consentimiento, saldo y trazabilidad; no
  como repositorio de secretos.

## Clasificacion de datos

| Dato | DB privada | Compartible | On-chain | Razon |
| --- | --- | --- | --- | --- |
| Perfil paciente | Si | Solo con consentimiento | No | Identidad y contacto son sensibles. |
| Historial clinico | Si | Medico con consentimiento | No | Diagnostico y notas nunca deben publicarse. |
| Examenes e imagenes | Si | Medico con consentimiento | Hash opcional | El archivo queda privado; el hash prueba integridad. |
| Solicitud medico | Si | Admin | Hash opcional | Licencia/documentos se validan off-chain. |
| Medico aprobado | Si | Publico en red | Wallet + metadata hash | La autorizacion debe ser verificable. |
| Solicitud dispensario | Si | Admin | Hash opcional | Documentacion legal queda privada. |
| Dispensario aprobado | Si | Publico en red | Wallet + metadata hash | Permite validar entregas. |
| Receta completa | Si | Paciente/medico/dispensario limitado | No | El detalle clinico queda off-chain. |
| Receta verificable | Si | Red autorizada | Paciente, medico, hash, vigencia, estado | La prueba publica no revela diagnostico. |
| Saldo de receta | Si | Dispensario autorizado | Cantidad autorizada, retirada y restante | Permite evitar doble retiro sin revelar diagnostico. |
| Retiros previos por receta | Si | Dispensario autorizado | Receta, dispensario, lote hash, cantidad | El dispensario ve consumo acumulado de esa receta, no ficha completa. |
| Entrega parcial | Si | Paciente/dispensario/admin | Receta, dispensario, lote hash, cantidad | Registra cumplimiento y trazabilidad. |
| Inventario/precios | Si | Dispensario/admin/paciente limitado | No | Es operacion comercial variable. |
| Permiso 402 | Si | Actor autorizado | Hash/estado opcional | Prueba que hubo consentimiento sin abrir datos. |

## Modelo de amenazas

### Si la DB se filtra

El atacante no deberia obtener datos clinicos legibles. Los campos sensibles
deben guardarse cifrados por paciente, documento o registro. La DB puede
contener metadata operativa minima, pero no llaves capaces de descifrar todo el
historial.

### Si se lee la blockchain

La blockchain debe mostrar solo pruebas: hashes, wallets autorizadas, vigencia,
estado de receta, cantidad autorizada, cantidad retirada, saldo restante y
eventos de entrega. Nadie deberia reconstruir diagnostico, notas medicas,
imagenes ni documentos desde datos on-chain.

### Si una autoridad exige informacion

Trust Leaf debe poder entregar o permitir revelar documentos especificos bajo
un proceso legal/controlado. El hash anclado on-chain sirve para demostrar que
el documento revelado corresponde al registro original y no fue alterado.

### Si un actor autorizado se ve comprometido

Los permisos 402 deben ser temporales y revocables. Un medico o dispensario
comprometido no debe conservar acceso indefinido al historial del paciente.

## Entidades base

### `patients`

DB privada. Guarda identidad, wallet, metodos de acceso y preferencias. No debe
guardar secretos de wallet ni seed phrases.

### `doctorApplications`

DB privada. Guarda solicitud de alta, licencia, especialidad, contacto, wallet,
estado admin y `onchainStatus`.

Estados:

- `pending`: solicitud nueva;
- `needs_review`: admin pide correccion o respaldo adicional;
- `approved`: medico validado por admin;
- `rejected`: solicitud no valida;
- `onchainStatus`: `pending`, `registered` o `failed`.

### `approvedDoctors`

Vista derivada desde `doctorApplications` aprobadas. En blockchain debe quedar
la wallet autorizada y un hash de metadata, no documentos completos.

### `dispensaryApplications`

DB privada. Guarda solicitud de dispensario, registro legal, direccion
operativa, contacto, wallet, estado admin y `onchainStatus`.

### `approvedDispensaries`

Vista derivada desde `dispensaryApplications` aprobadas. En blockchain debe
quedar la wallet autorizada y un hash de metadata; inventario, precios y
documentos legales quedan off-chain.

### `clinicalRecords`

DB privada. Sintomas, examenes, notas, tratamientos previos y archivos del
paciente. Acceso por consentimiento temporal.

### `consents`

DB privada. Relaciona paciente, actor autorizado, alcance, vencimiento y estado.
Puede anclar un hash de permiso o evento si el caso de uso lo requiere.

### `prescriptions`

Hibrida. El detalle clinico vive en DB privada; el contrato guarda paciente,
medico, `medication_hash`, vigencia y estado verificable.

Debe evolucionar para guardar o derivar saldo terapeutico: cantidad total
autorizada, cantidad retirada, cantidad disponible y periodo de vigencia.

### `dispenseRecords`

Hibrida. DB privada guarda contexto operacional; contrato guarda prueba de
entrega, lote/producto hasheado, dispensario, receta y cantidad.

Los dispensarios autorizados pueden consultar retiros previos vinculados a la
misma receta para calcular saldo restante. No deben consultar diagnostico,
notas clinicas ni historial general del paciente.

## Provider inicial

Firebase queda como proveedor soportado por velocidad y porque el repo ya
contiene configuracion, blueprint y reglas. Supabase queda preparado como
proveedor recomendado para la siguiente etapa de MVP porque ofrece Postgres,
SQL, RLS y un camino mas claro para reportes regulatorios.

La aplicacion accede a datos mediante una capa `trustDataStore`, para poder
mover la UI entre Supabase, Firebase o un backend propio sin reescribir los
paneles. El esquema inicial de Supabase vive en
[`supabase-mvp-schema.sql`](./supabase-mvp-schema.sql) y solo cubre onboarding
de actores; no debe usarse para ficha clinica completa sin cifrado y auth real.

## Pendientes antes de produccion real

- Auth real para pacientes, medicos, dispensarios y admin.
- Custom claims o coleccion segura de admins.
- Storage cifrado para documentos y examenes.
- Gestion de llaves separada de la DB: KMS, wallet/passkey o envelope
  encryption segun proveedor elegido.
- Firma wallet/passkey por medico, no firma custodial desde servidor.
- Contratos con saldo parcial por gramos o periodo.
- Auditoria de reglas de DB y smart contracts.
