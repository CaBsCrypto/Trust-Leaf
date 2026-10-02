# Evidencia: diagnostico seguro del bootstrap

Base `9657c63`, PR60 integrado; CI main 36949993027 PASS. Rama
`fix/bootstrap-safe-diagnostics`. Primera correccion del sprint de privacidad,
DEM-PRIV-04. No es una validacion de alta externa ni de uso humano.

## Defecto y cambio

El codigo upstream era registrado si tenia tipo string, sin limite de contenido.
Reproduccion sintetica sobre la base: HTTP500 con `code: PII_DEMO`, resultado
503 saneado pero marcador visible en console.error. No demuestra que Supabase
haya emitido informacion personal ni que exista una fuga publicada.

La correccion permite en el campo de log solamente `42501`, `PGRST202`, `42883`,
los codigos exactos usados por la clasificacion existente; cualquier otro valor
es `unknown`. Se conservan status, categorias de error, verificacion de identidad,
roles, endpoint, payload RPC y ausencia de reintento automatico.

Unico archivo funcional: `api/_lib/privy-supabase-rbac.ts`, dos lineas de
presentacion de diagnostico. Sin APIs nuevas, migracion, permiso ni datos nuevos.
No se ejecuta bootstrap real: eso podria crear el primer Admin y queda fuera.

## Reproduccion y regresiones

```powershell
node --test --test-name-pattern='manual negative: bootstrap' --experimental-strip-types tests/repro/privacy-diagnostics.mjs
node --experimental-strip-types tests/bootstrap-safe-diagnostics.test.ts
npm run test:privy-supabase-rbac
```

La primera orden usa el mismo marcador/assertion, FALLA en la base y PASS tras
el cambio. La prueba del parser Express no se ejecuta por ese filtro: no se
declara corregido DEM-PRIV-03. JSON upstream DEM-PRIV-05 sigue separado.
Pruebas permanentes de diagnostico y RBAC agregadas explicitamente al CI.
Datos/llaves `SYNTHETIC`, URLs example.test, respuestas inyectadas y red bloqueada.

Tipos/build locales PASS; warnings previos de PURE y chunks grandes conservados.
Regresiones locales contrastadas por agentes con fixtures, no con sesiones o
proveedores publicados: diagnosticos 58/58; identidad 2/2; RBAC 4/4; agenda
6/6; operaciones 8/8 y SQL; comercio 5/5 y SQL; incorporacion 20 pruebas y SQL;
privacidad de incorporacion 19/19. No equivalen a concurrencia PostgreSQL
independiente ni validacion humana. Revision final y CI/preview se registran en
el PR; los checks de la base no se atribuyen automaticamente a la correccion.

## Investigaciones separadas

DEM-PRIV-06: Pauli reprodujo en scratch aislado 12 escenarios (encargado y
operador, 390/1440 px, revocacion de permiso/tratamiento/actor) y tres controles.
GET503 mantiene la proyeccion antes autorizada y la etiqueta Permiso vigente;
SQL ya la retira, deniega entrega y conserva solo historial propio permitido.
UI bloquea entrega, cero POST; GET200/401/403 retira datos. Sin notas clinicas,
sin nueva lectura SQL ajena ni exposicion publicada demostrada. Capturas,
reporte y harness permanecen en `scratch/privacy-revocation` (ignorado, local);
`node scratch/privacy-revocation/run.mjs` usa solo loopback y SQL efimero, con
APIs interceptadas/red externa bloqueada. Servidor/browser/SQL cerrados.
Fixture permanente, politica y correccion requieren otra entrega.

DEM-PRIV-07: Seguridad/Admin advierten un catch de readiness que copia
code/statusCode del error. Bernoulli invoco el export real con adaptadores de
imports, verificador real y reader sintetico: codigo string/objeto/array llega a
log y respuesta503, cero red/store. Procedencia de errores del SDK real no
comprobada; riesgo condicionado separado. No hay exposicion real declarada.
Este PR no sanea todo readiness ni cierra PRIV03, PRIV05, PRIV06 o PRIV07.

Revision independiente: Bernoulli no encuentra bloqueos para esta correccion
del store; 58/58 diagnosticos, 4/4 RBAC y tipos PASS en su ejecucion. No es
aprobacion humana de uso ni certificacion completa de privacidad.

## Coordinacion y limites

Seis misiones: Bernoulli seguridad/revision, Nietzsche medico, Pauli paciente
(investigacion de revocacion/503 separada), Anscombe dispensario, Noether Admin
y Leibniz calidad (unico editor del nuevo test). Coordinador implementa source,
integra evidencia, CI y Git; no hay edicion simultanea del mismo archivo.

CI/preview y revision del ultimo candidato obligatorios antes de integrar.
Despues, contrastar SHA y alias oficiales mediante metadatos y lecturas sin
sesion; no invocar bootstrap ni crear registros para demostrar el despliegue.
La evaluacion humana/teclado fisico y el aviso aprobado permanecen pendientes.

B, Browns, historial y saldos no se consultaron/modificaron en esta correccion.
Borrador mensual fuera del commit, SHA256
`BDDBAAC808C90B672D5EE72A0F260B8BA23BEA21C2ECA12A2C226728B486BEC8`.
Invitaciones externas pausadas. Responsable/contacto, conservacion, condiciones
de proveedores y publicacion del aviso son puertas distintas a este hardening.
Fuente de estado: [tablero](../../DISPENSARY_CLOSEOUT_SPRINT.md).
