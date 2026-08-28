# Inventario y gate de provisioning de claves — TrustLeaf

**Estado:** sólo diseño sanitizado; no se crearon, leyeron ni almacenaron
secretos. **Mutaciones Testnet:** deshabilitadas. **Fecha:** 2026-08-27.

Este documento enumera nombres y responsabilidades, no valores. No es una
solicitud para provisionar credenciales ni una autorización de firma.

## Invariantes fail-closed

- `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false`,
  `TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false` y
  `TRUSTLEAF_STELLAR_SIGNING_ENABLED=false` mientras no exista una ceremonia
  aprobada.
- Un valor vacío, duplicado, no allowlisted, versión desconocida, proveedor
  degradado o mismatch de public key produce bloqueo y cero firmas.
- Ningún secreto, seed, token, XDR, firma, digest, dirección o saldo aparece
  en frontend, repositorio, logs, QR, tickets o reportes.
- La única salida del inventario es presencia/estado booleano, versión aprobada,
  conteo y código de bloqueo. No se inspeccionan valores en esta fase.
- Firebase/Firestore y los secretos `STELLAR_*_SECRET` legacy no son ruta de
  custodia; deben permanecer vacíos y fuera del camino operativo.

## Inventario de variables y dueño

| Dominio | Variables (nombres exactos) | Sensibilidad/almacenamiento | Dueño y gate |
|---|---|---|---|
| Cliente Supabase | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_TRUSTLEAF_SUPABASE_AUTH_ENABLED` | públicas; bundle sólo con flag aprobado; nunca service key | frontend + seguridad; flag false por defecto |
| Servidor Supabase | `TRUSTLEAF_DATABASE_URL`, referencia de schema `trustleaf_private` | secreto de conexión sólo backend/KMS; no frontend | plataforma; TLS, allowlist, pool mínimo |
| Auth/JWKS | `TRUSTLEAF_AUTH_ISSUER`, `TRUSTLEAF_AUTH_AUDIENCE`, `TRUSTLEAF_AUTH_JWKS_URL`, `TRUSTLEAF_AUTH_JWKS_ALGORITHMS`, `TRUSTLEAF_AUTH_JWKS_CACHE_TTL_SECONDS` | configuración pública/servidor; JWKS remoto HTTPS; sin JWT almacenado | seguridad/IdP; issuer/audience/kid/alg rotables |
| KMS/HSM | `TRUSTLEAF_KMS_PROVIDER`, `TRUSTLEAF_KMS_KEY_ID`, `TRUSTLEAF_KMS_KEY_ALIAS`, `TRUSTLEAF_KMS_KEY_VERSION`, `TRUSTLEAF_KMS_WORKLOAD_IDENTITY`, `TRUSTLEAF_KMS_AUTH_REF`, `TRUSTLEAF_KMS_ENABLED`, `TRUSTLEAF_KMS_EXPORT_DISABLED` | referencias, nunca KEK/DEK; claves no exportables en proveedor | plataforma + privacidad; PoC sintético y IAM |
| Firma Stellar | `TRUSTLEAF_STELLAR_SIGNER_PROVIDER`, `TRUSTLEAF_SIGNER_PUBLIC_KEY`, `TRUSTLEAF_STELLAR_SIGNING_ENABLED`, `TRUSTLEAF_STELLAR_ADMIN_ALIAS`, `TRUSTLEAF_STELLAR_ADMIN_KEY_VERSION`, `TRUSTLEAF_STELLAR_DEPLOYER_ALIAS`, `TRUSTLEAF_STELLAR_DEPLOYER_KEY_VERSION`, `TRUSTLEAF_STELLAR_OPERATOR_ALIAS`, `TRUSTLEAF_STELLAR_OPERATOR_KEY_VERSION`, `TRUSTLEAF_STELLAR_DOCTOR_ALIAS`, `TRUSTLEAF_STELLAR_DOCTOR_KEY_VERSION`, `TRUSTLEAF_STELLAR_DISPENSARY_ALIAS`, `TRUSTLEAF_STELLAR_DISPENSARY_KEY_VERSION` | alias/ref y public key no secreta; privadas sólo KMS/HSM | custodia + quorum; roles separados y allowlist |
| Cuentas técnicas | `STELLAR_ADMIN_ADDRESS`, `STELLAR_DOCTOR_ADDRESS`, `STELLAR_DISPENSARY_ADDRESS` | referencias públicas de entorno, no identidad humana; owner verificado por canal restringido | release/seguridad; cuentas separadas |
| QR | `TRUSTLEAF_PUBLIC_QR_HMAC_KEY_REF`, `TRUSTLEAF_PUBLIC_QR_HMAC_KEY_VERSION`, `TRUSTLEAF_PUBLIC_QR_SIGNING_ENABLED`, `TRUSTLEAF_PUBLIC_QR_ROTATION_GRACE_SECONDS` | clave dedicada sólo servidor/KMS; QR lleva handle opaco | privacidad/QR; rotación con ventana y replay deny |
| Legacy bloqueado | `STELLAR_ADMIN_SECRET`, `STELLAR_DOCTOR_SECRET`, `STELLAR_DISPENSARY_SECRET`, `STELLAR_RELAYER_API_KEY`, `STELLAR_MERCURY_JWT`, `STELLAR_MERCURY_KEY` | no provisionar; si aparece valor, bloquear y retirar | seguridad/incidente |

## Separación de roles, aprobación y quorum

| Rol técnico | Puede hacer | No puede hacer | Aprobación mínima |
|---|---|---|---|
| `admin-quorum` | gobernar TrustRegistry/credenciales | desplegar, firmar receipts o dispensar | 2-de-3 custodios independientes |
| `deployer` | publicar WASM allowlisted en ventana | operar negocio o custodiar admin | owner técnico + seguridad |
| `submission-operator` | transportar envelope ya autorizado | elegir signer, cambiar payload/red | policy engine + auditoría |
| `doctor-service` | acciones de issuer/elegibilidad sintética | admin, dispensación, KMS | owner clínico-operacional |
| `dispensary-service` | parcial/dispensado sintético con grant | emitir/revocar credenciales | owner farmacia-operacional |
| `data-encryption-service` | wrap/unwrap DEK por contexto | firmar Stellar o QR | privacidad + plataforma |
| `qr-verifier-service` | firmar/verificar handle mínimo | leer ficha o firmar chain | seguridad/privacidad |

Ningún actor acumula aprobación y ejecución de su propia provisión. El paciente
no recibe signer ni clave. Un admin no sustituye decisión clínica.

## Rotación, revocación y recuperación

1. Pausar intenciones y mantener todos los flags cerrados.
2. Reconciliar `pending/unknown`; nunca re-firmar el mismo `operation_id`.
3. Aprobar nueva versión por quorum y validar public key/policy por canal
   restringido.
4. Ejecutar dry-run sintético, negativos de versión vieja y proveedor caído.
5. Activar nueva versión; mantener ventana de reversión sin exportar claves.
6. Ante compromiso, bloquear workload/alias, revocar con quorum, preservar
   evidencia y evaluar reemplazo de contrato Testnet.
7. Ante pérdida/indisponibilidad, esperar o abandonar de forma controlada; no
   caer a seed local, variable legacy ni signer de otro rol.

La retención de auditoría, backup/restore, RTO/RPO y crypto-erasure requieren
decisión de privacidad/legal antes de datos reales.

## Pruebas y checklist

Ya disponible con fixtures:

- `npm run test:key-custody-preflight`
- `npm run test:key-custody-gate`
- `npm run test:auth-custody-readiness`
- `npm run test:server-auth-custody`
- `npm run preflight:key-custody`

Antes de provisioning real:

- [ ] verificar que el repositorio no contiene valores de variables sensibles;
- [ ] confirmar flags false, allowlists exactas y `deployReady=false`;
- [ ] PoC del proveedor con firma Stellar compatible sin exportación;
- [ ] probar rotación, revocación, recuperación, outage, replay y logs redactados;
- [ ] validar IAM/workload identity y separación de duties con permisos efectivos;
- [ ] revisar QR HMAC versionado y ventana de replay;
- [ ] aprobar backup/retención/teardown y responsables de incidente;
- [ ] autorización separada para provisioning, firma y submission.

## Decisiones humanas mínimas

1. Elegir proveedor/región KMS/HSM y confirmar PoC (no se recomienda aún uno
   sin prueba de compatibilidad Stellar).
2. Elegir IdP único para la fase (Supabase Auth o Firebase); eliminar fallback
   silencioso y nombrar owner de JWKS/rotación.
3. Nombrar tres custodios admin, owners de cada workload y quorum 2-de-3.
4. Aprobar política de rotación/revocación, backup, retención y respuesta.
5. Autorizar por separado la ceremonia de provisioning y cualquier deploy o
   submission Testnet.

Hasta resolverlas, el estado es **NO-GO** para crear claves, leer aliases reales,
firmar, enviar transacciones o usar personas/datos clínicos.
