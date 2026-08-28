# Checklist humana — provider de firma e IdP Testnet V2

Estado: **pendiente; no aprovisiona ni autoriza deploy**. Usar junto con
[ADR de custodia e identidad](adr-testnet-v2-custody-and-idp.md) y
[ceremonia seca V2](testnet-v2-dry-ceremony-and-readonly-audit.md).

## Paquete A — decisión de arquitectura

- [ ] Cloud conjunto seleccionado: `GCP KMS HSM + Firebase Auth` (recomendado)
      o alternativa documentada.
- [ ] Región/entorno exclusivamente Testnet, RTO/RPO y retención aprobados.
- [ ] Tres custodios admin distintos y owners separados para deployer,
      submission operator, doctor-service y dispensary-service.
- [ ] Riesgo residual de correlación pública y dependencia cloud aceptados.

Resultado: permite preparar PoC/provisión en una autorización posterior; no
permite crear claves, tenants, cuentas, contratos ni transacciones.

## Paquete B — PoC de custodia e identidad

Custodia:

- [ ] Ed25519 puro confirmado contra vectores Stellar y Soroban exactos.
- [ ] Claves no exportables, versiones fijadas y public keys cotejadas.
- [ ] Admin 2-de-3; dos firmas sobre la misma intención canónica.
- [ ] IAM niega rol cruzado, versión obsoleta, hash/contrato/red no allowlisted.
- [ ] Rotación, revocación, pérdida de un signer, timeout y outage fail-closed.
- [ ] Audit log sanitizado, alerta, cuota y kill switch comprobados.

IdP:

- [ ] Tipo de token para la API fijado; no se confunde ID token con access token.
- [ ] `alg`, `kid`, `iss`, `aud`, `sub`, `exp`, `iat` y revocación validados.
- [ ] Role/scope del token se intersecta con subject→actor→objeto durable.
- [ ] Alta, suspensión y baja fuerzan policy y sesión conforme al runbook.
- [ ] JWKS nuevo/viejo rota correctamente; unknown/outage deniega por defecto.
- [ ] Negativos de rol cruzado, replay y propiedad manipulada pasan.

Privacidad/observabilidad:

- [ ] Ningún log/reporte contiene token, firma, XDR, payload, email, PII o PHI.
- [ ] Sólo códigos, conteos, roles lógicos y estados mínimos salen del backend.

Resultado: permite solicitar el paquete de deploy; no lo autoriza.

## Paquete C — autorización futura deploy+init

- [ ] Commit, WASM, IDL, hashes, args, RPC/passphrase y contract links congelados.
- [ ] Preflight completo, Rust, TypeScript/build, E2E y QA visual verdes.
- [ ] Adapter RPC read-only y reconciliador durable verdes.
- [ ] Manifest de identidades contiene referencias/versiones, nunca secretos.
- [ ] Ventana, fee cap, responsables, rollback/teardown e incident commander.
- [ ] Aprobación explícita separada registrada.

Si una casilla es falsa, desconocida o no tiene responsable: **NO-GO**.
