# Evidencia: privacidad y preparacion de la demo

Fecha: 2026-10-01. Base de producto `86e2016`, Node 22.20.0, Windows local.
Auditoria en `audit/pilot-privacy-readiness`; no modificaciones de producto.
No contiene contactos, credenciales, payloads ni capturas autenticadas reales.
Estado/puertas en [tablero](../../DISPENSARY_CLOSEOUT_SPRINT.md).

## Version y proveedores: solo lectura

- PR59 integrado. [CI de main 36941802547 PASS](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/36941802547), PostgreSQL17 independiente incluido.
- GitHub deployment 6797663287 success para SHA completo
  `86e2016f1e7f7fe9a13386be5bb2505abfc22a4c` y URL
  `trustleaf-55m7bmi0l-cabscryptocontacto-6028s-projects.vercel.app`.
  `vercel inspect https://www.trustleaf.org`: Ready,
  `dpl_8X4BVrQPz6vseBdq38sHWPbuCcJH`, alias oficiales; funciones observadas iad1.
- `supabase projects list --output json`: proyecto configurado ACTIVE_HEALTHY,
  region primaria us-east-1. Solo se conservaron status/region, no credenciales.
  CLI aviso de falta de link local no impidio el listado; no se ejecuto link.
- Esto no prueba contrato, residencia de todos los servicios, retencion de
  logs, ubicacion de identidades ni restauracion integral de proveedores.

## Regresiones ejecutadas

| Comando/escenario | Resultado y alcance |
| --- | --- |
| `npm run test:dispensary-onboarding` | PASS: 15 entrada + 5 API + SQL PGlite; borrador, identidad, correcciones, rechazo, aprobacion y replay sinteticos |
| `node --experimental-strip-types tests/dispensary-onboarding-privacy.test.ts` | 19/19 PASS; mocks de exports reales, fetch no delega a red, HTTP/logs sin marcadores privados, identidad, no-store/Vary, cifrado/hash y reintento explicito. Dos casos prueban que el matcher no trunca evidencia |
| `npm run test:team-invitations` | 12/12 API + SQL PASS; email actual, limites, cola, webhook firmado, retirada y roles. No envia correo real |
| `npm run test:shared-patient-read` | 19/19 PASS; revocacion/vencimiento/inactividad/retirada retiran compartido, conservan recibos propios. PGlite, no gateway hosted |
| `npm run qa:operations-pilot` | API8/8 + SQL + presupuesto Vercel12 funciones PASS; errores seguros, permisos, notas, saldo/stock y replay |
| Comercio: `tests/dispensary-commerce.test.ts` y `tests/sql/dispensary-commerce.mjs` | API5/5 + SQL PASS; organizacion, costos segun rol, recepcion/replay; base funcional sin cambio |
| `npm run lint`, `npm run build` | PASS; build conserva warnings existentes de anotaciones PURE de dependencias y chunks grandes, no corregidos aqui |
| `tests/ui/session-boundary-browser.mjs` | PASS sintetico: respuesta tardia de identidad previa y logout retirados; no audita almacenamiento completo del SDK |
| `tests/ui/cross-tab-session-browser.mjs` | PASS cuatro modos: ambos transportes, storage-only, channel-only, focus-recovery; marca opaca, sin bucle de reload |
| `tests/ui/dispensary-onboarding.browser.mjs` | PASS con fixture SQL local nueva y guard de egress HTTP: cero intentos HTTP externos; flujo Admin/encargado persistente, correcciones, foco/borrador y cinco viewports |

El guard HTTP no constituye una auditoria general de WebSocket/SDK en produccion.
Navegador local Playwright con Chrome headless; anchos 360/390/768/1024/1440.
No son cinco dispositivos fisicos ni autonomia del usuario. Servidores loopback
4345 y 4318 detenidos al terminar. Primer intento browser timeout en estado
inicial vacio antes de mutar; causa no establecida, siguiente ejecucion misma
prueba y ejecucion con guard PASS. No pausas artificiales ni timeouts aumentados.
La instalacion local necesito permiso para procesos/navegador, no acceso real.

El nuevo comando privacidad se incorpora explicitamente a CI. Estos PASS
locales no son los checks del futuro commit; revision y CI/preview del ultimo
candidato se consultaran en su PR antes de integrar. PG17 de PR59 se reutiliza,
no se ejecutaron nuevas carreras ni se aplico una migracion en esta auditoria.

## Negativos conservados: no aprobados ni ocultados

Fuera de scripts verdes/CI, en `tests/repro`, para proximas ramas funcionales.
No se cambiaron expectativas ni se corrigio producto para cerrar esta auditoria.

```powershell
node --experimental-strip-types tests/repro/privacy-diagnostics.mjs
node --experimental-strip-types tests/repro/onboarding-upstream-json.mjs
```

- Diagnosticos: 2 FAIL esperados contra baseline. Express production loopback
  HTTP400/handler no alcanzado/respuesta sin marcador, pero stderr conserva
  fragmento JSON sintetico. Bootstrap mockHTTP500 registra codigo string
  `PII_DEMO` arbitrario; error al cliente permanece saneado. Red fuera de
  loopback bloqueada/mocks; no se inspecciono una filtracion real en Vercel.
- JSON upstream: 2 FAIL, recibido400/esperado503 para SQL mutation y Privy.
  Headers y ausencia de datos privados pasan; falla clasificacion, no se
  demuestra exposicion. Una respuesta perdida solo genera otro intento por
  accion explicita con el mismo intent, sin retry automatico.
- Agent medico ejecuto modulos Calendar/Meet aislados: 14 casos API y dos
  comprobaciones adicionales PASS; fixture setup FALLA por target renovacion
  ausente. No se afirma suite Calendar completa verde, ni llamada probada.
- Snapshot tras revocacion + GET503: inspeccion y riesgo pendiente de fixture,
  no se presenta como defecto confirmado o bypass de la lectura SQL.

## Revisiones y limites humanos

Seis misiones: Ptolemy seguridad, Galileo medico, Planck paciente, Rawls
dispensario, Ohm Admin, Mendel calidad/UX. Calidad unico editor de la suite
privacidad; coordinador docs, egress y reproduccion diagnostica. Seguridad
revision independiente detecto truncamiento del matcher, corregido con dos
regresiones. Admin contrasta inventario, consentimiento y puertas antes del PR.

Sin nuevo ejercicio humano en computador/celular fisico reportado en esta
ronda. La recepcion Browns100g previa en telefono sigue siendo prueba guiada.
Teclado, autonomia de ambos roles y selector nativo en navegador externo quedan
pendientes; no se exige crear datos publicados para acreditar esos escenarios.

Sin invitaciones, aprobaciones, cambios de acceso, perfil, stock, notas, consultas,
llamadas o grants en produccion. B/Browns intactos. Borrador mensual excluido,
SHA256 `BDDBAAC808C90B672D5EE72A0F260B8BA23BEA21C2ECA12A2C226728B486BEC8`.
El aviso es borrador revisable, procedimiento propuesto, no publicacion operativa.
[Inventario, fuentes y decision](../../PILOT_PRIVACY_READINESS.md).
