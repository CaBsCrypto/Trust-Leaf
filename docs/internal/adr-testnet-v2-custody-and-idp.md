# ADR — custodia de firma e identidad para Testnet V2

- Estado: **propuesta para decisión humana; NO-GO de aprovisionamiento/deploy**.
- Fecha de corte de fuentes: **2026-08-25**.
- Alcance: TrustRegistry + ReceiptLedgerV2, exclusivamente Testnet y fixtures
  sintéticos. No autoriza datos reales, producción, mainnet, firma, fondeo ni
  submission.

## Contexto comprobado en el repositorio

- TrustRegistry y ReceiptLedgerV2 usan `Address.require_auth()`. Cuando la
  dirección es una cuenta Stellar, el host admite la multisig Stellar con umbral
  medio; por tanto el camino actual puede conservar cuentas `G...` y Ed25519 sin
  introducir un contract-account nuevo.
- `KeyCustodyProviderPort` sólo tiene hoy `local-mock-no-secret`; su prueba local
  declara `usableOnStellar: false`. No existe adapter AWS/GCP/Azure ni servicio
  custodial aprobado.
- El gate ya fija intención, rol, versión, `operationId`, digest, red,
  passphrase, RPC, contract ID y hash WASM, y exige quorum admin mínimo 2.
- El backend verifica JWT RS256/JWKS, `iss`, `aud`, `exp`, `sub`, roles, scopes y
  allowlist server-side. No hay IdP real ni prueba de revocación/sesión real.
- Los dos kill switches deben permanecer literalmente en `false` durante esta
  fase.

## Decisión recomendada

### Firma

Adoptar para el siguiente PoC **Google Cloud KMS con protección HSM,
`EC_SIGN_ED25519`**, una versión de clave por signer lógico y cuentas Stellar
separadas. La razón es técnica y acotada: la documentación oficial declara
PureEdDSA Ed25519 y que todos los propósitos están disponibles en protección HSM;
además TrustLeaf ya contiene superficie Firebase, lo que puede evitar un segundo
plano IAM si la organización decide permanecer en Google Cloud.

La recomendación queda condicionada a un PoC sintético que demuestre, sin
exportar material privado:

1. firma byte-a-byte del payload Stellar/Soroban esperado;
2. verificación con la public key Stellar derivada;
3. latencia, cuotas, timeout/unknown e idempotencia;
4. IAM por workload y versión exacta, audit logs y disable inmediato;
5. cero log de payload, firma, XDR, token o identificador sensible.

**AWS KMS `ECC_NIST_EDWARDS25519` + `ED25519_SHA_512`/`MessageType:RAW` es la
alternativa aprobable** si se elige AWS como runtime de workloads. Su soporte
oficial actual es compatible en principio con Ed25519 puro, pero requiere el
mismo PoC exacto. No elegir cloud por este ADR sin confirmar región, cuota,
precio, residencia y federación de workload.

AWS CloudHSM dedicado no es la primera opción: su CLI oficial documenta
`ed25519ph` (HashEdDSA), mientras Stellar necesita la firma compatible con el
payload de la cuenta; no debe suponerse equivalencia con Ed25519 puro. Azure Key
Vault/Managed HSM publica RSA, curvas P-256/P-256K/P-384/P-521, no Ed25519, por
lo que **no es compatible directamente con las cuentas Stellar actuales**. Usar
Azure exigiría un signer especializado o rediseñar hacia contract-account y
nueva auditoría/IDL; queda fuera del camino mínimo.

No se recomienda aún un custodio especializado: no hay adapter, contrato de
servicio, modelo de recuperación ni evidencia de compatibilidad en el repo. Un
proveedor especializado sólo entra al shortlist si ofrece Ed25519 puro no
exportable, Stellar/Soroban explícito, IAM por workload, quorum o policy,
rotación, recuperación y logs exportables; después debe pasar el mismo harness.

### Multisig y separación de funciones

Patrón mínimo propuesto:

| Cuenta/rol | Firmantes | Umbral/política | No puede |
|---|---:|---|---|
| admin TrustRegistry/Ledger | 3 signers de custodios separados | Stellar 2-de-3, umbral medio; los tres KMS keys con owners distintos | operar receipts diarios o deployar |
| deployer | 1 workload temporal separado | sólo hashes/ventana allowlisted; retirar permiso tras init | quedar como admin |
| submission operator | sin autoridad de negocio propia | transporta envelope ya autorizado; kill switch e idempotencia | escoger payload/signer |
| doctor service | 1 cuenta por servicio/entorno | métodos médicos allowlisted; cuota y actor durable | administrar/dispensar |
| dispensary service | 1 cuenta por servicio/entorno | métodos dispensario allowlisted; cuota y actor durable | emitir/revocar como médico |

Para admin, cada firma debe cubrir la misma intención canónica. No se satisface
el quorum con dos aliases controlados por la misma identidad humana, workload,
proyecto o permiso de administración. El paciente no recibe signer Stellar.

### Identidad

Usar **Firebase Authentication como IdP inicial de los participantes técnicos
Testnet**, no como autorización clínica ni repositorio de roles. Es la opción de
menor cambio de cliente porque Firebase ya está presente. El backend mantiene
como fuente de autorización el vínculo durable `subject → actor → roles/scopes →
objeto`; email y claims enviados por el cliente nunca conceden acceso.

Antes de conectar Firebase real se debe reemplazar/encapsular el verificador
genérico actual por un adapter Firebase revisado (preferentemente Firebase Admin
SDK) que valide token ID RS256, `kid`, `iss`, `aud`, `sub`, `exp`, `iat`,
`auth_time` y revocación. El endpoint de certificados/JWKS y su cache deben seguir
la metadata oficial; una falla de refresh, issuer/audience desconocido o estado
de revocación no comprobable debe fallar cerrado. Roles/scopes mínimos pueden
viajar como custom claims, pero siempre se intersectan con la policy durable
server-side y nunca contienen PII/PHI.

Firebase no se declara elección de identidad para producción/paciente real. Esa
decisión requiere privacidad, MFA/recovery, residencia, soporte, DPA y revisión
legal separada.

## Comparación de custodia

| Opción | Ed25519 para cuentas actuales | Separación/auditoría | Veredicto Testnet V2 |
|---|---|---|---|
| GCP Cloud KMS/HSM | Sí: `EC_SIGN_ED25519`, PureEdDSA; HSM soporta todos los propósitos publicados | IAM, versiones, disable y audit logs; validar con PoC | **recomendada, condicionada** |
| AWS KMS | Sí: `ECC_NIST_EDWARDS25519`, `ED25519_SHA_512` con `RAW` | policies/conditions, versión/key ID y audit; validar región/PoC | **alternativa aprobable** |
| AWS CloudHSM | documentación revisada muestra `ed25519ph`; no asumir Ed25519 puro | mayor control y operación de cluster/CU | no elegir sin PoC que pruebe compatibilidad exacta |
| Azure Key Vault/Managed HSM | no aparece Ed25519 en curvas publicadas | RBAC/attestation/rotación robustos | **NO-GO directo** con `Address::Account` actual |
| custodio especializado | posible, no demostrado en repo | depende de contrato, policy, recovery y export de logs | diferido; RFI + adapter + threat review |
| secreto/CLI/archivo local | técnicamente firma, pero exportable y operador único | separación insuficiente | rechazado |

## Comparación de IdP/JWKS

| Opción | Encaje con verifier/policy | Ventaja | Brecha antes de usar |
|---|---|---|---|
| Firebase Auth | RS256, issuer/audience definidos y client existente; adapter específico requerido | menor cambio UI y mismo plano cloud si se elige GCP | Admin SDK/JWKS, revocación, claims y MFA/recovery; durable policy sigue externa |
| Auth0 | JWKS RS256 y access tokens para API/scopes | buen modelo resource-server y rotación JWKS | tenant nuevo; normalizar roles namespaced y aprobar Actions/config |
| Microsoft Entra ID | OIDC/JWKS; `roles`/`scp` para API | fuerte para workforce/admin y app roles | tenant/issuer y External ID para actores externos; normalizador de claims |
| Amazon Cognito | JWKS, custom scopes y resource server | consolida con AWS si ése es el runtime | UI migration; `cognito:groups`/scopes requieren normalización |
| Clerk | JWKS, audience y `authorizedParties` | integración UI rápida | dependencia/tenant nuevo; session/organization claims no sustituyen policy durable |

No aceptar ID tokens donde corresponde access token de API sin una decisión
explícita del adapter. No usar `email`, nombre, origen del frontend o rol de UI
como propiedad del objeto.

## Contrato mínimo de configuración no secreta

Todos los valores se suministran server-side y se validan como conjunto. Aquí se
documentan nombres/tipos, no valores reales:

```text
CUSTODY_PROVIDER_KIND = gcp-kms-hsm-ed25519 | aws-kms-ed25519
CUSTODY_REGION = identificador allowlisted
CUSTODY_KEY_VERSION_BY_ALIAS = mapa alias lógico -> resource/version fija
CUSTODY_PUBLIC_KEY_BY_ALIAS = mapa alias lógico -> public key Stellar esperada
CUSTODY_WORKLOAD_BY_ROLE = mapa rol -> identidad de workload
CUSTODY_ADMIN_QUORUM = 2
CUSTODY_ADMIN_SIGNER_COUNT = 3
CUSTODY_AUDIT_SINK_ID = referencia opaca allowlisted

TRUSTLEAF_AUTH_PROVIDER_KIND = firebase
TRUSTLEAF_AUTH_ISSUER = HTTPS exacto
TRUSTLEAF_AUTH_AUDIENCE = resource/project exacto
TRUSTLEAF_AUTH_JWKS_URL = HTTPS exacto aprobado por discovery
TRUSTLEAF_AUTH_SUBJECT_ALLOWLIST_REF = referencia server-side, no JSON en cliente
TRUSTLEAF_AUTH_MAX_TOKEN_AGE_SECONDS = entero revisado
TRUSTLEAF_AUTH_CLOCK_SKEW_SECONDS = entero mínimo revisado
```

Continúan obligatorios:

```text
TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false
TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false
```

## Rotación, recuperación y outage

- Cada alias fija versión. Rotar crea una versión nueva deshabilitada, prueba su
  public key con fixture, actualiza account signer/threshold sólo durante una
  ceremonia aprobada y revoca la versión anterior después de reconciliar.
- Nunca eliminar la última vía de quorum admin. El drill demuestra pérdida de un
  signer, compromiso de uno y caída del provider sin reducir 2-de-3.
- Un KMS/JWKS no disponible no habilita fallback local. Se bloquea firma o acceso,
  se conserva `operationId`, se reconcilia read-only y se emite sólo código
  sanitizado.
- Break-glass requiere dos aprobadores fuera del operador, tiempo limitado,
  ticket, alerta independiente y revisión posterior; no contiene secretos.
- La baja de un usuario invalida la policy durable inmediatamente y revoca
  sesiones/tokens según el IdP; no espera sólo a expiración natural.

## Gates de aceptación

1. ADR humana elige GCP o AWS, región no productiva y owners nominados.
2. PoC Ed25519 puro firma y verifica vectores Stellar/Soroban exactos.
3. Admin 2-de-3, IAM por rol y separación efectiva pasan prueba negativa.
4. Rotación, pérdida de un signer, revocación y provider outage pasan fail-closed.
5. Adapter IdP verifica token válido y rechaza issuer/audience/kid/alg/exp/iat,
   subject no allowlisted, role/scope cruzado, revocado y JWKS caído.
6. Logs y respuestas pasan scan: sin token, firma, XDR, payload, PII/PHI o IDs.
7. Auditor independiente coteja public keys, versión, manifest y kill switches.

Faltar un gate implica **NO-GO**.

## Decisiones humanas mínimas

Una sola decisión de arquitectura puede cerrar el diseño, sin autorizar recursos:

1. confirmar **GCP KMS HSM + Firebase Auth** o elegir la alternativa conjunta
   **AWS KMS + Cognito/Auth0**;
2. nombrar tres custodios admin y owners distintos para deployer, operator,
   doctor-service y dispensary-service;
3. aprobar región Testnet, RTO/RPO, retención de auditoría y responsable de
   incidentes.

Después se requiere una autorización separada para aprovisionar/PoC y otra para
deploy+init. Ninguna se infiere de este ADR.

## Fuentes oficiales consultadas

Consulta: 2026-08-25. Las capacidades deben reconfirmarse al ejecutar el PoC.

- Stellar, autorización Soroban y multisig de cuenta:
  <https://developers.stellar.org/docs/learn/fundamentals/contract-development/authorization>
- AWS KMS, key specs Ed25519 y modo RAW:
  <https://docs.aws.amazon.com/kms/latest/developerguide/symm-asymm-choose-key-spec.html>
- AWS CloudHSM CLI, mecanismo `ed25519ph`:
  <https://docs.aws.amazon.com/cloudhsm/latest/userguide/cloudhsm_cli-reference.html>
- Google Cloud KMS, `EC_SIGN_ED25519` y protection levels:
  <https://docs.cloud.google.com/kms/docs/algorithms>
- Azure Managed HSM, curvas soportadas:
  <https://learn.microsoft.com/en-us/azure/key-vault/managed-hsm/about-keys>
- Firebase, verificación server-side de ID tokens:
  <https://firebase.google.com/docs/auth/admin/verify-id-tokens>
- Firebase, custom claims:
  <https://firebase.google.com/docs/auth/admin/custom-claims>
- Auth0, access/ID tokens y JWKS:
  <https://auth0.com/docs/secure/tokens>
  y <https://auth0.com/docs/secure/tokens/json-web-tokens/json-web-key-sets>
- Microsoft Entra, scopes/OIDC:
  <https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc>
- Amazon Cognito, resource servers y scopes:
  <https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-define-resource-servers.html>
- Clerk, verificación backend/JWKS:
  <https://clerk.com/docs/reference/backend/verify-token>

