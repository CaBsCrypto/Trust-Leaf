# Sprint S1: cerrar la experiencia publicada del dispensario

Actualizado: 2026-10-01. Sprint de una semana de referencia, sin fecha final
comprometida hasta disponer de ambos participantes. Sin ejecucion automatica.
Fuente de estado: este tablero, enlazado desde el plan maestro y mapa de producto.

## Demo y adopcion: 30/09/2026

Actualizacion de correcciones: PR60 integrado en `9657c63`, CI main 36949993027
PASS. `fix/bootstrap-safe-diagnostics` aborda exclusivamente DEM-PRIV-04;
marcador baseline FALLA / candidato PASS, log limitado y respuestas conservadas.
[Metodo y limites](evidence/bootstrap-safe-diagnostics/README.md). Integracion y
publicacion requieren revision/checks del ultimo candidato, no solo CI de base.
DEM-PRIV-03/05, investigacion de revocacion/503 y privacidad operativa separados.

Actualizacion privacidad 01/10: main `86e2016`, PR59 integrado, CI main
36941802547 PASS (PG17), deployment 6797663287 success y alias Vercel oficiales
comprobados. Auditoria de seis agentes en `audit/pilot-privacy-readiness`.
Decision PO: primera demo sin videollamada, aviso interno inicialmente borrador.
[Inventario](PILOT_PRIVACY_READINESS.md), [aviso](PILOT_PRIVACY_NOTICE_DRAFT.md),
[procedimiento](PILOT_PRIVACY_PROCEDURE.md) y
[evidencia](evidence/pilot-privacy-readiness/README.md). Ninguna invitacion externa
habilitada por esta auditoria; faltan responsable, canal, politica de conservacion,
condiciones de proveedores, revision/aprobacion y publicacion del aviso.
Diagnosticos con marcadores sinteticos y error upstream reproducidos se separan
en siguientes ramas fix. No se afirma exposicion real ni se corrige producto aqui.
Evaluacion humana/teclado fisico sin nueva evidencia permanece pendiente.

Actualizacion 01/10, sprint de concurrencia desde main 2071c40: PR58 integrado,
CI main 36828485700 PASS, despliegue documentado separado del candidato.
Tres suites completas locales PostgreSQL independiente PASS; ocho carreras
nuevas en ambos ordenes, incluyendo comprobante previo, journal/audit, versiones,
stock/cupo y limpieza del operador retirado. Sin defecto del producto reproducido
ni cambios funcionales. Entrega ahora integrada por PR59, revision/checks del
candidato aprobados; CI main 36941802547 PASS incluye PG17, distinto de local PG18.
[Evidencia y limites](evidence/dispensing-access-concurrency/README.md).
No se escribe en B/Browns ni se renueva permiso. Privacidad/Meet, contacto y
tareas humanas siguen como siguientes puertas; no habilita incorporacion por si sola.

Actualizacion de ciclo 01/10 02:33-02:43 Santiago: usuario confirma permiso B por
24 horas para 4119236d; guardado y recarga paciente muestran vigencia hasta 02/10
02:33. Operador oficial: busqueda, saldo 30/20/10, revision 1 g sin confirmacion,
saldo hipotetico 9 g, descarte cancelado, retorno, Inventario 60 g y recibo
3150a49a coincidente. Filtros/limpieza, Gestion segun rol y recarga contrastados.
Fecha funciona por control accesible; selector nativo externo sigue pendiente.
PR57 integrado en 95a1b2b, solo documental; CI main 36820406618 PASS y despliegue/
alias oficiales comprobados. [Evidencia del ciclo y limites](evidence/patient-dispensary-cycle-20261001/README.md).
Actualizacion encargado B 01/10 03:41-03:47 Santiago: identidad/rol, saldo
30/20/10, revision 1 g/9 g hipoteticos sin entrega, descarte cancelado y busqueda
conservada comprobados. Inventario 60 g y comprobante 3150a49a persisten tras
recarga. Recepcion/ajuste abren inicialmente plegados sin guardar; Catalogo,
Proveedores, Recepciones y Equipo consultados sin cambios. Admin 03:51-03:54:
identidad/recarga, organizaciones separadas, membresias B y estados de invitaciones/
solicitudes comprobados; Browns Aprobada, sin decidir ni enviar. Pendientes humanos: autonomia, teclado/celular fisico,
selector nativo externo y privacidad previa a incorporar. Unica escritura de
negocio en el ciclo completo: permiso B; ninguna en el recorrido encargado.

Actualizacion 01/10: PR56 integra DEM-SEC-01 en `199e1ae`, arbol identico al
candidato dfca5ad revisado independientemente, CI 36817670803 PASS y preview
aprobada. Migracion exclusiva aplicada tras revisar historial/hash y restaurar
respaldo cifrado de 49 tablas/262 filas. Historial posterior: 34 versiones,
nueva version una sola vez y mensual ausente. Despliegue/alias oficiales
contrastados; CI main 36818824045 PASS comprobado por separado. No cambios de
contratos, acciones ni datos de negocio. Baseline 14 PASS/5 negativos; candidato
19/19 y PostgreSQL independiente PASS. Recibos propios/politica medica conservados.
[Evidencia de seis misiones, respaldo y publicacion](evidence/shared-patient-read/README.md).
Paciente oficial conserva 30/20/10 y comprobante 3150a49a tras actualizar datos.
B sin grant activo visible. No autorizacion, entrega ni invitacion en esta fase.
DEM-SEC-01 cerrado/publicado; no acredita cierre de los otros escenarios.

DEM-SEC-02 cerrado y publicado mediante [PR54](https://github.com/CaBsCrypto/Trust-Leaf/pull/54),
main `65aaeb8e703c13e97cc5707dff1ebfb22e4e01a4`. Candidato `2b6abed` aprobado por
revision independiente, CI 36681425847 PASS y preview Ready. Deployment GitHub
6753696128 success vincula ese main con Vercel dpl_5Fvrs9YCcXXLvNgFidWiEVX6URD8
Ready y alias www.trustleaf.org. Lecturas oficiales 30/09: 410/405/no-store en
ambas rutas con IDs sinteticos; cuatro entradas HTML 200, cuatro APIs privadas
401 sin sesion. No prueba autenticada ni exposicion previa de datos reales.
[Reproduccion, revisiones, publicacion y limites](evidence/legacy-private-route-block/README.md).
La correccion compartida no habilita automaticamente invitaciones o renovacion
B: confirmacion del paciente y privacidad previa a la incorporacion se comprueban
por separado. El cierre del PR52 ya no esta pendiente; los parrafos siguientes
conservan la trazabilidad de esa entrega.

La matriz siguiente es el corte vigente; las tablas fechadas posteriores son
evidencia historica, no nuevas aprobaciones. Auditoria inicial en `audit/demo-adoption-readiness`,
desde `origin/main` actualizado: `f1c8f0e1e2e3a3f6318a34283b2b82324f312965`
(PR51 documental, contenido funcional PR50). Calidad confirmo main remoto, PR51
fusionado, CI 36634542805 PASS sobre candidato aafe1aa y equivalencia funcional
entre candidato, PR50 y main. GitHub deployment 6746262879 success asocia el SHA
f1c8f0e a trustleaf-hwykbnsc1-cabscryptocontacto-6028s-projects.vercel.app.
Vercel dpl_SaHyDmeSLDPMJA8k5ce7iYh2jxeL Ready y www.trustleaf.org apuntan a esa
misma URL. La asociacion al SHA viene de GitHub, no de Vercel inspect por si solo.

Actualizacion de base revisada: PR53 integrado como
`6671c5e0214e2270e50dc080d01f43471d30ff4a`, sin cambios funcionales del producto.
Su arbol es identico al candidato `10e019420317571f48428701f4821f2133999233`,
con [CI 36672712861 PASS](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/36672712861)
y preview Ready. El [CI de main](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/36673338483)
es una ejecucion distinta; no atribuirle el resultado del candidato.
GitHub deployment 6752220115 success asocia 6671c5e a
trustleaf-3m9fryuc4-cabscryptocontacto-6028s-projects.vercel.app; Vercel
dpl_3oJ67NP4XSZY3dEtsct9nrye1G2w Ready y www.trustleaf.org contrastados.
PR52 se actualiza desde esa base y conserva diferencia exclusivamente documental;
su integracion y checks del ultimo head se consultan en
[PR52](https://github.com/CaBsCrypto/Trust-Leaf/pull/52).

[Guion, ocho misiones, sprints y limites](DEMO_ADOPTION_RUNBOOK.md).
Decision de corte: LISTO CON LIMITACIONES para retomar el ciclo acompanado,
DEM-SEC-01/02 cerrados. La autorizacion B fue confirmada y persiste hasta 02/10
02:33; no se renueva automaticamente. Incorporacion externa pendiente de privacidad minima, contacto
compatible y acompanamiento. DEM-SEC-02 cerrado; no validacion integral ni
habilitacion real. La presentacion interna puede explicar registros ficticios.
Maximo una correccion funcional en curso; esta entrega documental no agrega fixes y las
revisiones no escriben en produccion.

| ID / responsable | Estado | Evidencia actual | Pendiente / siguiente accion |
| --- | --- | --- | --- |
| DEM-00 / coordinador + calidad | Cerrado, base revisada | PR59 integrado en 86e2016, CI main 36941802547 PASS; deployment 6797663287/Vercel Ready y alias oficiales contrastados. PR59 solo pruebas/documentacion | Candidato de privacidad requiere sus propios checks; no hereda aprobacion del main; tareas humanas mantienen piloto abierto |
| DEM-01 / Admin-incorporacion | Lecturas publicadas comprobadas, alta externa pendiente | Admin oficial 01/10: identidad/recarga, organizaciones A/B/Browns separadas, membresias B, invitacion pendiente y aceptada, solicitud Browns aprobada leidas sin cambios. Casos aislados 19/19 reutilizados: enlaces/identidad, versiones, rollback y bloqueo de conversion antigua | Alta externa acompanada, privacidad minima y compatibilidad del primer contacto; lectura de aprobacion no sustituye acceso efectivo; no se envia ninguna invitacion en este cierre |
| DEM-02 / Medico | Revision tecnica aprobada | Oficial 29/09: filtros 4/0/3/2/9, reserva f1e7b1d6/Meet, nota v2, tratamiento 4119236d 30/20/10 y recibo 3150a49a persistentes. Nuevo fixture: participar y comenzar explicitamente PASS; guard de notas reutilizado mismo codigo | Alta completa Privy/revision de cuenta nueva no repetida; no receta legal ni autonomia |
| DEM-03 / Paciente | Recorrido tecnico aprobado, humano pendiente | 01/10: consentimiento B, permiso hasta 02/10 02:33 persistente tras recarga; 30/20/10 y recibo 3150a49a coinciden con operador | Autonomia/teclado fisico; medico inactivo sigue como politica separada |
| DEM-04 / Dispensario | Ambos roles comprobados tecnicamente, humano pendiente | 01/10 operador y encargado B: revision 1 g/9 g hipoteticos sin entrega, descarte/retorno, 60 g stock, recibo, filtros, Gestion segun rol y recarga; encargado abre recepcion/ajuste sin guardar y consulta Equipo; regresiones anteriores conservadas | Tareas humanas en computador/celular real, teclado y selector nativo externo; no integracion comercial->entrega repetida |
| DEM-05 / Seguridad | DEM-SEC-01/02 y concurrencia cerrados tecnicamente | PR56 preserva recibos propios y retira proyeccion no autorizada; PR59 ocho carreras ambos ordenes, PG18 local y PG17 CI PASS | Diagnosticos DEM-PRIV-03/04/07 y retencion UI DEM-PRIV-06 separados; doctor-active y DEM-LEG-01 pendientes. Sin exposicion real declarada |
| DEM-06 / UX | Validacion | Nueva QA ambos roles 390/1440: carga, foco, Escape, descarte y recuperacion conservan datos/borrador; cero POST. Responsive anterior cinco anchos reutilizado | DEM-UX-01 mensaje confuso de lectura; tareas humanas/teclado real pendientes |
| DEM-07 / Calidad | Revision tecnica aprobada | Referencia/publicacion confirmadas. CI tipos, builds off/on, browser y PostgreSQL independiente PASS; PostgREST usa service_role aislado | No acredita gateway real por si solo. Main sin proteccion de rama: riesgo de proceso, propuesta separada, sin cambiar permisos |
| DEM-08 / Regulatorio | Investigacion documental, revision profesional pendiente | Fuentes oficiales 01/10: vigencia general Ley21.719 01/12/2026; expedientes legal/privacidad, no certificacion | Primera demo excluye llamadas/eventos; Meet OPEN sin cambio ni prueba remota. Responsable/contacto, conservacion, contratos y revision juridica/clinica pendientes |
| DEM-09 / PO + coordinador | Preparado | Decision: reutilizar B/Browns y aislar escrituras; validar alta medica actual | Presentacion humana, privacidad minima y primer destinatario antes de invitar |
| DEM-QA-01 / coordinador + seis agentes | Cerrado, pruebas | PR53 integrado; causa reproducida en fixture, tres suites Chromium consecutivas y revision independiente; CI/preview del candidato aprobados | No corrige DEM-SEC-01/02 ni acredita autonomia o celular real; continuar seguridad en ramas separadas |
| DEM-CON-01 / coordinador + seis agentes | Cerrado, integrado | PR59 / 86e2016; ocho precedencias, tres suites independientes PG18 PASS, revision/CI/preview y PG17 CI main PASS; recibos/replay conservados | No sustituye evaluacion humana ni privacidad minima; [evidencia](evidence/dispensing-access-concurrency/README.md) |
| DEM-SEC-02 / Seguridad + coordinador | Cerrado, publicado | PR54 / 65aaeb8; 198 + 325 casos locales y revision independiente; CI/preview 2b6abed PASS; retirada oficial 410/405/no-store contrastada | No implica cierre de DEM-SEC-01, autonomia o aprobacion de la UI Stellar heredada |
| DEM-SEC-01 / coordinador + seis agentes | Cerrado, publicado | PR56 / 199e1ae; 19/19, cinco negativos baseline, PostgreSQL independiente, CI/preview/revision exacta y CI main PASS. Respaldo restaurado, migracion exclusiva, fuentes/ACLs y lectura paciente comprobados | No aprueba autonomia, telefono real ni incorporacion externa; carreras y politica medica siguen separadas |
| DEM-LEG-01 / Medico + Paciente | Preparado, legado | MockupPortal convierte fallos de validacion en exito sintetico y conserva cache de dashboard no segmentada; reproduccion aislada, no fuga ni entrega publicada demostradas | Revision/fix independiente; no habilitar ni demostrar UI heredada como elegibilidad clinica; piloto conectado Supabase separado |
| DEM-PRIV-01 / PO + privacidad | Bloqueado para externos | Inventario y borrador de aviso sin responsable/canal/plazos/condiciones aprobadas; Footer sin aviso operativo | Definir y probar canal, revisar finalidades/proveedores/conservacion, aprobar y publicar en otra entrega; sin invitaciones |
| DEM-PRIV-02 / PO + Admin + privacidad | Preparado, decision pendiente | consent_at de participacion, version de formulario; sin aviso versionado aceptado. Copias de perfil en journal privado | Definir evidencia necesaria y retencion con revision profesional; no atribuir borrador a consentimientos previos |
| DEM-PRIV-03 / Seguridad | Validacion de correccion, P2 diagnostico | fix/express-safe-json-errors desde fbee6ea: negativo confirmado, cinco regresiones parser/registro/HTTP prod-dev PASS; tipos/build y bloqueos heredados PASS. Nueve categorias fijas, cero diagnosticos/red externa | Revision, CI/preview del ultimo commit y publicacion; [evidencia](evidence/express-safe-json-errors/README.md). No saneamiento global de logs ni fuga hosted afirmada |
| DEM-PRIV-04 / Seguridad | Validacion de correccion, P2 diagnostico | fix/bootstrap-safe-diagnostics desde9657c63: allowlist exacta y mismo marcador ahoraPASS, cliente y categorias conservados; nueva regresion CI | Revision/checks candidato y correspondencia publicada antes de cerrar; no se ejecuta bootstrap real ni se inspeccionan logs privados |
| DEM-PRIV-05 / calidad + Admin | Preparado, P2 funcional | Dos reproducciones: JSON invalido de SQL/Privy devuelve400 en onboarding; expectativa503 falla sin exposicion de payload | Rama fix independiente para distinguir input de fallo upstream; reproduccion negativa fuera del suite verde, no cierre por tests privacidad |
| DEM-PRIV-06 / Paciente + seguridad | Cerrado tecnicamente y publicado | PR63 ea4afdd, revision independiente, CI36964636874 PASS, preview Ready; merge fbee6ea, production6801411840 success, aliases oficiales/asset contrastados. 30 revocaciones ambos roles/cinco anchos, borradores e ID preservados | [Evidencia](evidence/express-safe-json-errors/README.md#previous-correction-release). No autonomia, telefono real, cierre de privacidad externa ni proteccion de intenciones al abandonar Equipo |
| DEM-PRIV-07 / Seguridad + Admin | Preparado, P2 condicionado; entrada sintetica reproducida | Export real readiness con verificador real/reader sintetico: string/objeto/array en code alcanza log y HTTP503; cero red/store. No se ha constatado procedencia de ese error del SDK real | Acotar categorias en PR separado y revisar procedencia SDK; DEM-PRIV-04 solo sanea diagnostico del store |
| DEM-QA-02 / medico + calidad | Preparado, fixture | google-calendar-setup.test.ts falla por target de renovacion ausente; otras pruebas Calendar reutilizadas | Revisar/corregir fixture en entrega separada; no modifica Meet ni prueba configuracion remota |

### Recuperacion de CI: primera entrega del sprint 1

PR52 head inicial 0f0cef0 tenia preview aprobada y CI 36666468947 fallido.
El fallo manager/390 era una carrera del runner: respuesta A con lote B aun
renderizado, seguida del remonte de A con `Gestionar lote` cerrado. Se reprodujo
el mismo timeout mediante una respuesta HTTP sintetica controlada, sin cambiar
React ni usar produccion. La validacion tambien detecto una respuesta GET anterior
capturada por el waiter mientras el producto mostraba correctamente el scope nuevo.

`fix/inventory-qa-sync` conserva todas las aserciones y escenarios. Captura el
scope/rol esperado, espera lote/cantidad/estado renderizados y localiza controles
dentro del lote. Sin pausas fijas, clics forzados ni aumentos de timeout. Una
correccion auxiliar del selector de submit mantiene su prueba negativa original.
Tres ejecuciones normales consecutivas PASS: encargado/operador en
360/390/768/1024/1440, Node 22.23.2, Playwright 1.58.2, Chromium 145.0.7632.6.
Cada una: 70 POST interceptados, 40 efectos de journal simulado, cero trafico externo.
Estos contadores no son movimientos durables de inventario.

Seis misiones: seguridad (Planck, revision independiente apta), medico (Lovelace,
regresion local diez casos), paciente (Singer, identidad/unitarias sin red),
dispensario (Huygens, SQL operaciones/comercio PASS), Admin (Popper, pendientes
sin decisiones/envios) y calidad/UX (Hooke, reproduccion y unico editor del runner).
Coordinador: tipos/builds off/on PASS, revision de logs/hash, Git y publicacion.
CI del candidato repitio regresiones compartidas, medicas, inventario y comercio,
ademas de PostgreSQL independiente/PostgREST. No confundir Windows local con Ubuntu
CI ni viewports con telefono fisico. Servidor QA 4342 detenido.

[Causa, capturas y limites](evidence/inventory-qa-sync/README.md).
La preview fue Ready; las lecturas sin sesion redirigen a proteccion Vercel, no
constituyen una prueba de navegacion autenticada. No se cambio esa proteccion.
B, Browns, datos e historial no se tocaron; draft mensual fuera de los commits,
SHA256 BDDBAAC808C90B672D5EE72A0F260B8BA23BEA21C2ECA12A2C226728B486BEC8.
Siguiente entrega: DEM-SEC-02, frontera de rutas heredadas; despues DEM-SEC-01,
lectura compartida revisada. Invitaciones externas y renovacion de B siguen pausadas.

El 29/09, recargar medico/paciente conserva autenticacion pero vuelve al acceso
Cuenta autorizada -> Continuar. Se observo ese paso; no se declaro cierre de
sesion ni defecto. Abrir el enlace de Meet no se repitio: solo se contrasto el
mismo enlace en ambas reservas. Lecturas nuevas no crearon consultas o entregas.
Lectura publicada 30/09 00:40 America/Santiago: paciente conectado, tratamiento
4119236d con 30/20/10 y B ofrece Autorizar 24 horas, sin grant activo mostrado.
No se pulso autorizar; no se cambiaron perfil, notas ni comprobantes.

Salida de Sprint 0: baseline y matriz reconciliadas. Sprint 1: evidencia tecnica
consolidada y lecturas faltantes. Sprint 2: evaluacion humana y correcciones.
Sprint 3: presentacion/incorporacion acompanada. Sprint 4: dictamen independiente
para actividad real. Los cuatro ultimos no se cierran por terminar esta auditoria.

El estado vigente de proteccion de borradores es Publicado (PR49/50); las
observaciones anteriores de AUD-03/04 no vuelven a ser defectos abiertos. Browns
ya tiene acceso y recepcion comprobados; cuentas propias de operador/paciente se
aplazaron y no bloquean la presentacion de los dos escenarios separados.

Informes: Popper (Admin 19/19), Lovelace (medico), Singer (paciente y reproduccion
de DEM-SEC-01), Huygens (dispensario), Planck (contraste de seguridad), Kuhn (UX),
Hooke (calidad) y Beauvoir (fuentes regulatorias). Los servidores sinteticos de
medico, comercio y UX en 4341/4342/4344 quedaron detenidos. No editaron codigo
publicado ni datos de produccion. Tipos/build del contenido funcional se reutilizan
del CI; no afirmar que esos checks corrieron sobre un nuevo commit documental.

Evidencia visual sintetica de esta ronda: [consulta explicita](evidence/demo-readiness/doctor-explicit-consultation.png),
[error con borrador conservado](evidence/demo-readiness/error-390-manager.png) y
[lista vacia de operador](evidence/demo-readiness/empty-390-operator.png).
Son capturas de QA; 390 px representa simulacion de viewport, no telefono fisico.
La prueba adicional Admin se ejecuto desde un archivo desechable fuera del repo;
no constituye una nueva regresion permanente de CI.
[Procedencia, limites y JSON de reproduccion](evidence/demo-readiness/README.md).

### Hallazgos originales de auditoria

DEM-SEC-01 / P1 / lectura compartida: Singer reprodujo ocho variantes aisladas.
Planck confirmo independientemente cuatro defectos de paciente suspendido,
revocado, expired o valid_until vencido; las cuatro variantes de medico son
comportamiento reproducido, no otros cuatro P1 contra un contrato explicito.
Con grant vigente, dispensario recibe tratamiento e historial de otra
organizacion, aunque entregar y el acceso del propio actor inactivo se rechazan.
Con medico inactivo tambien se proyectan contactos ficticios del paciente.
Fuentes: `20260909010000_operations_pilot.sql:202,208` y
`20260915020000_pilot_patient_profiles.sql:61`. No se probo en produccion.
Contraste independiente completado: mismo baseline, 35 hashes de fuentes iguales,
fixture distinto con operador y dos organizaciones; no reutilizo el script Singer.
La exigencia de paciente activo consta en el contrato documental de perfiles.
Exigir tambien medico activo para toda lectura compartida es una alineacion
propuesta con la entrega, no una clausula explicita ya localizada. No confundir
el estado de la cuenta con vencimiento del tratamiento ni borrar recibos propios.
Reproduccion y regresion roja conservadas fuera del repo en
`review-artifacts/agente3-paciente-actor-read-coherence-20260930`; ocho casos
sinteticos, sin red, con recibo ajeno y control separado de recibo propio.
Los estados HTTP del informe se derivan del mapper; no son observacion HTTP
alojada. La regresion aun no forma parte de CI.
Al corregir, conservar comprobantes propios del paciente e historial operativo
de la propia organizacion; retirar solo proyeccion compartida no autorizada.
Puede requerir migracion incremental, no edicion de migraciones previas. Su
publicacion exige revision, historial remoto y respaldo restaurable verificado;
no aplicar ninguna migracion como parte de esta rama documental.

DEM-SEC-02 / P1 en codigo / frontera heredada: los exports serverless de
`api/stellar/patient/[address]/dashboard.ts:11` y
`api/stellar/dispensary/[action].ts:21` leen por direccion/ID sin auth ni
autorizacion de objeto. Planck ejecuto handlers reales con adaptador Stellar
falso, red bloqueada, y obtuvo 200 anonimo en flags off/on/production. No
se comprobo disponibilidad de esas rutas ni datos reales devueltos en el
despliegue; no afirmar fuga publicada. El middleware Express no prueba los
exports de Vercel. Resolver su frontera efectiva o retirarlos de distribucion
en una entrega `fix/...` separada, manteniendo mutaciones apagadas.
Errores upstream sin sanear y falta de no-store en esos handlers: P2 relacionado,
sin filtracion de secretos ni cache CDN efectiva comprobadas.
Actualizacion: PR54 retira estas dos lecturas y cierra DEM-SEC-02, con 410/405 y
no-store oficiales. Los hechos del parrafo anterior describen la reproduccion
original, no el comportamiento publicado actual; DEM-LEG-01 queda separado.

Hallazgos no convertidos en defectos: replay de operacion antigua por operador
retirado devuelve solo UUID/replayed y no agrega entrega (P3, politica pendiente).
Las carreras revocacion/cuarentena/retirada frente a entrega con dos conexiones
PG aun no se probaron; los negativos secuenciales y locks no sustituyen esa
evidencia. No se encontro servidor PG aislado disponible localmente.
Informe de seguridad y reproductores conservados fuera de Git en
`scratch/trustleaf-agent5-security-f1c8f0e`; ninguna escritura publicada.

DEM-UX-01 / P2 / claridad de error: GET de actualizacion responde 503 y muestra
"No fue posible confirmar la operacion. Puedes reintentar." sin POST ni comando
pendiente. Agente 6 Kuhn lo reprodujo en ambos roles a 390/1440; el lote y
borrador se conservan, guardado queda deshabilitado y recuperacion mantiene
texto. No evidencia de perdida ni escritura involuntaria. Fuente:
`src/features/operations/OperationsWorkspace.tsx:154`.
Recomendacion: separar mensaje de lectura de escritura incierta en una rama
`fix/operations-read-error-message`, con regresion GET 503/recuperacion y POST
incierto/idempotencia. No se presenta como defecto critico de datos ni se
modifica codigo funcional en este PR documental.

## Objetivo, responsables y reglas

### Sprint de proteccion de borradores: 27/09

Base de trabajo: `a9ddc67` (PR48). Rama inicial `fix/medical-note-guard`.
Coordinador integra; cuatro agentes revisan flujo medico, inventario, UX y calidad.
Una correccion funcional en curso; inventario se integra despues de medicina.
Pruebas sinteticas aisladas, sin escrituras de negocio publicadas.

| Trabajo | Estado | Evidencia / siguiente accion |
| --- | --- | --- |
| AUD-03 nota medica | Publicado | PR49 integrado en ab2f4b3; CI 36365590291 PASS, deployment 6700540461 success. Regresion aislada repetida: diez casos PASS |
| AUD-04 formularios de inventario | Publicado | PR50 a3656eb; candidato 4f37b1f, CI 36633030614 y preview PASS. Deployment 6745997363 success y alias oficial contrastado. Diez combinaciones rol/ancho y suites compartidas aprobadas |
| UX y calidad | Revision tecnica aprobada | Cuatro agentes, hallazgos y regresiones consolidados; conservar pruebas humanas pendientes |
| Admin oficial | Comprobado tecnicamente | Sesion Admin: invitacion aceptada, solicitud Browns aprobada y organizacion visibles; recarga conserva acceso. Sin envios ni decisiones nuevas |

La lectura de Admin anterior sustituye el pendiente historico de sesion de la
auditoria de abajo. No acredita autonomia humana ni incorporacion del primer cliente.
Detalle de reproduccion y gates: [Proteccion de notas](MEDICAL_NOTE_GUARD.md).
Inventario y matriz actual por actor: [Proteccion de inventario](INVENTORY_DRAFT_GUARD.md).

### Auditoria coordinada con cuatro agentes: 27/09

Base: `2e014430455cffe2c3a8cfef01c1182a2540bb6f` (PR44 integrado).
CI main `36307001486` success. GitHub deployment `6690086452` asocia ese SHA a
`trustleaf-o253jym0p-cabscryptocontacto-6028s-projects.vercel.app`; misma URL que
Vercel `dpl_9a9Ue1ApQMYKUYBSyUUTBQyqFEfL`, production Ready y alias oficial.
Solo documentacion cambio desde el baseline funcional `668d84f` hasta esa base.

Primera ronda: cuatro agentes independientes, solo lectura y pruebas sinteticas.
Coordinador: version, lecturas Browns, consolidacion y revision de resultados.
No se enviaron invitaciones ni se modificaron permisos o registros publicados.
No se afirma preparacion clinica, legal ni operacion autonoma.

#### Matriz unica de decision

Actualizacion de cierre tecnico: PR45 documental integrado (`0fe2758`).
AUD-01 corregido por PR46 (`7ccb908`), CI PR `36308719527` PASS.
Deployment GitHub `6690456559` success y Vercel `dpl_4FZRiVYqXBrE7VNA4kcYwTte7dm3`
Ready, URL `trustleaf-fjdloa0a9-cabscryptocontacto-6028s-projects.vercel.app`,
alias oficial comprobado. AUD-02 corregido por PR47 (`9291f2e`), CI PR
`36309391166` PASS y preview aprobado. Deployment `6690567724` success,
Vercel `dpl_Hf7waVNxgfC1UjgMS57gAHucdvet` Ready y alias oficial coinciden con
`trustleaf-9d2qgh6oj-cabscryptocontacto-6028s-projects.vercel.app`.
No interpretar los hallazgos historicos de abajo como correcciones pendientes
de codigo para AUD-01/02. No hay cambios de APIs, migraciones o datos publicados.

| Area / responsable | Evidencia actual | Resultado / limite | Siguiente accion |
| --- | --- | --- | --- |
| Incorporacion / Hume + coordinador | API 5/5, invitaciones 12/12, SQL, 15 pruebas de captura y navegador 390/1440 PASS; lectura Admin posterior comprobada | AUD-01 corregido y publicado por PR46 | Esperar destinatario y acompanar primera incorporacion |
| Medico-paciente / Pasteur | Operaciones 8/8, agenda 6/6 y SQL sintetico PASS | AUD-03 nota sin guardar; evidencia alojada anterior reutilizada, no sesion medica hoy | Reproduccion y correccion acotada; no prometer recorrido clinico cerrado |
| Dispensario / Locke + coordinador | AUD-02 reproducido en navegador antes del fix; ambos roles/cinco anchos PASS despues; CI PR47 PASS | Correccion publicada y alias contrastado. AUD-04 estatico | Mantener pendientes humanos separados |
| Calidad / McClintock | SHA/CI oficial comprobados, PostgreSQL independiente y PostgREST aprobados | Carreras revocacion/cuarentena vs entrega no cubiertas de forma independiente | Backlog de pruebas aisladas; no afirmar fallo sin reproduccion |
| Browns / coordinador | Lectura 27/09 05:52-05:53: encargado, lote 100 g, proveedor vacio sin error, formulario abierto/cerrado sin guardar | Persistencia y lectura comprobadas; ninguna escritura en esta auditoria | Mantener ensayo separado de B |
| Humano movil / PO | Recepcion 100 g encontrada en telefono fisico con indicaciones | Guiado parcial, no autonomia ni teclado completo | Evaluar tareas sin instrucciones y registrar dispositivo |
| Admin publicado / coordinador + PO | Sesion Admin, invitacion aceptada, solicitud Browns aprobada y organizacion; recarga conserva acceso | Comprobacion tecnica de lectura, sin nueva invitacion ni decision | Verificar destinatario antes de la incorporacion externa |
| Primer/segundo equipo / PO | No hay contactos suministrados | Pendiente, no defecto | Primero un encargado; segundo despues de observar su incorporacion |

#### Hallazgos y entregas separadas

- AUD-01 / P2 / entrada de encargado: `src/features/operations/team-api.ts:29`
  recupera invitacion de trabajador guardada y `src/App.tsx:657` la prioriza
  frente al enlace nuevo de encargado. Reproducido con funciones reales y
  almacenamiento sintetico, no navegador publicado. Mitigacion de ensayo:
  salir de invitacion anterior y reabrir enlace; no es correccion definitiva.
  Rama propuesta `fix/onboarding-invitation-entry`, prioridad primera.
- AUD-02 / P2 / borrador de entrega: `DispensaryAttention.tsx:67,83` no espera
  `mayLeave()`. Manejador de tratamiento reproducido con promesa pendiente y
  luego false: cambia seleccion antes de decidir. Paciente comparte patron
  por inspeccion; UI extremo a extremo pendiente. No evidencia de entrega
  involuntaria ni stock corrupto. Rama propuesta `fix/dispensary-draft-guard`.
- AUD-03 / P2 / borrador medico: `OperationsWorkspace.tsx:249` separa guardar
  nota y finalizar; cierre no envia texto sin guardar. Hallazgo de fuente,
  reproduccion navegador aislado pendiente: el agente termino por limite de uso,
  sin resultado de esa comprobacion. No se considera defecto UI reproducido.
  Antes de ensayo: guardar y
  verificar borrador antes de cerrar. Rama propuesta `fix/medical-note-guard`.
- AUD-04 / P2 / borrador de inventario: `OperationsWorkspace.tsx:287,370`
  formularios no registran dirty para guardia de navegacion. Hallazgo estatico
  pendiente de reproduccion, no defecto de persistencia guardada confirmado.
  Rama propuesta, solo tras reproducir: `fix/inventory-draft-guard`.

Decision inicial de la ronda, anterior a PR46/47: LISTO CON LIMITACIONES para presentacion y ensayo
acompanados, NO aprobacion incondicional para incorporar externamente. Antes
del envio externo: cerrar AUD-01, verificar sesion Admin y destinatario.
Decision especifica de incorporacion externa: BLOQUEADA hasta completar esas
tres condiciones. Responsable tecnico: coordinador para AUD-01 y lectura Admin;
Product Owner para iniciar sesion y confirmar destinatario. No se enviara correo
como parte de esta auditoria.
AUD-02/03 excluyen declarar jornada completa validada; requieren regresiones y
correcciones propias. Ningun critico de aislamiento o escalamiento demostrado.
No confundir ausencia de hallazgo con garantia de seguridad completa.
Correcciones no se incluyen en este PR documental; una rama funcional a la vez,
tipos/build/regresion/CI/preview antes de integrar y revalidar.

#### Decision historica de auditoria (27/09)

Este bloque conserva la decision previa a las reproducciones y PR49/50.
El estado vigente de AUD-03/04 y Admin es el tablero de proteccion de borradores
al inicio; no leer los pendientes historicos siguientes como defectos actuales.

LISTO CON LIMITACIONES para presentar el nucleo y preparar incorporacion
acompanada con datos ficticios. El envio externo queda retenido hasta comprobar
Admin autenticado y destinatario compatible. Version oficial de PR47 comprobada.
Responsable tecnico: coordinador; inicio de sesion y destinatario: Product Owner.
No se enviaron invitaciones durante la auditoria.

AUD-03 y AUD-04 permanecen como hallazgos de fuente pendientes de reproduccion;
no afirmar perdida de datos guardados. En cualquier ensayo medico, guardar y
verificar nota antes de finalizar. No ofrecer recorrido clinico completo como
validado. Pruebas humanas de autonomia, teclado movil y carreras concurrentes
faltantes continuan abiertas. No hay defecto critico confirmado de aislamiento.

Evidencia detallada: [AUD-01](INVITATION_ENTRY_FIX.md) y
[AUD-02](DISPENSARY_DRAFT_GUARD_FIX.md). Brownsonchain sigue como encargado de
Browns en lectura 27/09 06:27, 100 g visibles. No se cambio la sesion a Admin.

### Estado vigente: 27/09, Browns preparado

P-01 cerrado para el ensayo propio: Browns/Encargado comprobados tras ingreso
y recarga. P-02 en Validacion: producto DEMO-BRW-001, lote BRW-DEMO-001, una
recepcion y movimiento de 100 g persistentes, sin entrega. El usuario confirmo
en celular fisico que encontro el movimiento de 100 g tras indicaciones del
agente: evidencia guiada parcial de J05/J06, no autonomia ni todos los casos U2.
No se conoce modelo de telefono/navegador; no inferirlos del viewport interno.
Se reutiliza evidencia de B, sin exigir cuentas nuevas para este bloque.
Pendientes: autonomia, resto de escenarios en dispositivo real, Admin actual
y correos de los dos encargados externos. S1 no cerrado.
Detalle del ensayo: [Browns](BROWNS_DEMO_READINESS.md). La matriz vigente se mantiene
en este tablero. Las entradas fechadas de abajo
son historicas, no el estado actual de acceso de Browns.

### Evidencia historica: 26/09, preparacion de presentacion

Esta entrada sustituye los bloqueos historicos de navegacion indicados abajo.
El usuario navego manualmente por Inventario, Historial y Gestion/Equipo como
operador de B; el agente contrasto las pantallas. NAV-01 no es un defecto del
producto confirmado ni una correccion publicada: causa del control automatizado
sin determinar. Los clics de cierre de sesion tampoco cambiaron la vista en esta
sesion; se solicito accion manual, sin declarar al usuario desconectado.

- Inventario: lote Piloto-B-20260908, 60 g disponibles. Historial por lote conserva
  filtro; entregas de 20 g, 10 g y 10 g, movimientos +100/-20/-10/-10 g.
- Comprobante existente 3150a49a-a8b2-4e19-a46b-a453adb7c15f recuperado, sin entrega.
- Alternar movimientos y limpiar filtros funciono manualmente. No se atribuye
  cobertura completa a todas las combinaciones de busqueda y fecha.
- Operador: Catalogo/Recepciones consultables, sin Proveedores ni creacion;
  Equipo muestra encargado y operador sin controles de administracion.
- Recarga conserva identidad y membresia, vuelve a Pacientes. El usuario necesito
  indicaciones para volver a Gestion: oportunidad de continuidad, no autonomia.
- A las 02:36 Chile, operador de B y cero pacientes con permiso vigente. No se
  renovo permiso ni se releyo stock en esa comprobacion.

U1-U4 siguen pendientes de autonomia y celular real. J05/J06/J07 tienen evidencia
guiada parcial del operador, no aprobacion de uso independiente ni prueba de
escrituras denegadas. B no recibio entregas, ajustes ni cambios de equipo.

Decision del usuario: Browns es ensayo propio, no el primer dispensario externo.
P-01 pasa a En curso: verificar su encargado con una sesion real. P-02 preparado
como guion en [Browns: ensayo y presentacion](BROWNS_DEMO_READINESS.md); ejecucion
depende de P-01, cuentas separadas, datos y prueba fisica. No se cierra S1.

PR #40 fusionado como 58d1dd3 tras verify/Vercel aprobados en 43581f7. Solo docs.

### Estado del cierre: 26/09, 01:10 Chile

Operador autenticado de B confirmado tras recarga; panel muestra un paciente con
10 g disponibles y permiso vigente en ese momento. No se renovo el permiso.
No se comprobó stock de nuevo en esta sesion: 60 g sigue siendo evidencia del 25/09.

NAV-01 (fallo de flujo observado, causa pendiente): al pulsar Inventario,
Historial o Gestion desde Pacientes, permanece Pacientes seleccionado. Repetido
tras recargar y con locator semantico del navegador. No hay error visible ni
errores de consola capturados. No se ha demostrado si es fallo de aplicacion,
sesion o automatizacion; se solicito contraste manual al usuario antes de
proponer un cambio funcional. Responsable: facilitador tecnico. J05/J06/J08
del operador permanecen pendientes; no inferir denegacion del servidor.

Evidencia adicional del 25/09, operador: revision de 10 g sin confirmar, volver
con lote/cantidad conservados, cancelar descarte manteniendo preparacion y foco,
descartar y regresar al listado con 10 g disponibles. Inventario mostraba 60 g
sin controles de recepcion/ajuste. Estas observaciones no sustituyen permisos
directos ni autonomia humana. No se realizaron nuevas entregas.

Cierre NO aprobado. Pendientes: contraste NAV-01, filtros/historial/Gestion del
operador, celular real, autonomia y acceso de Browns. No ampliar el alcance ni
forzar datos para completar casos. Si se reproduce un defecto de codigo,
correccion separada con regresion, CI y preview antes de publicar.

### Evidencia incremental: 25/09, 02:09 Chile

Comprobacion del agente en navegador interno sobre version publicada d101469;
no acredita autonomia humana ni telefono fisico. Sustituye el bloqueo inicial B1
solo para encargado. Operador y evaluaciones U1-U4 permanecen pendientes.

- Encargado B autenticado; Jornada confirma 60 g, dos miembros y un paciente
  autorizado. Tras recarga conserva organizacion/rol, valores y cero entregas hoy.
- Paciente: tratamiento de prueba 4119236d con 30 g asignados, 20 g retirados y
  10 g disponibles. Con confirmacion explicita del usuario se concedio permiso
  a B hasta 26/09 02:02 Chile. No se modificaron tratamiento, saldo o stock.
- Atenciones: seleccion explicita y revision de 10 g desde Piloto-B-20260908;
  saldo hipotetico 0 g, SIN confirmar entrega. Luego se observo listado limpio.
- Busqueda por referencia, apertura y retorno conservan texto y foco en paciente.
- Inventario -> historial aplica filtro de lote y muestra comprobante existente
  3150a49a-a8b2-4e19-a46b-a453adb7c15f de 10 g. Responsable se muestra por UUID:
  oportunidad de legibilidad, sin afirmar identidad nominal desde esa referencia.
- Gestion: Catalogo y Proveedores terminan carga con pagina vacia, no error;
  formularios no abiertos. Equipo muestra un encargado y un operador, dos
  invitaciones aceptadas historicas no equivalen a dos membresias activas.
- No se enviaron invitaciones, retiraron miembros ni guardaron operaciones.
  Descarte/cancelacion de preparacion fue guiado al usuario: falta evidencia
  detallada para dar por aprobados todos los pasos J04.
- Pendiente: filtros combinados/movimientos J06, operador, dispositivo fisico y
  autonomia. El permiso es temporal; comprobar nuevamente antes de otra sesion.

Objetivo de uso, no resultado aprobado: encargado y operador encuentran paciente, explican saldo, localizan lote y
recuperan comprobante desde computador y celular, sin ayuda de navegacion.

- Product Owner (usuario): prioridad, aprobacion y coordinacion del dispensario.
- Facilitador tecnico (agente, funcion Scrum Master): tablero, bloqueos,
  implementacion, evidencias y revision; no sustituye evaluacion humana.
- Encargado y operador: realizan tareas y contrastan su operacion real.
- Flujo: Backlog -> Preparado -> En curso -> Validacion -> Cerrado. Bloqueado
  es una condicion explicita, no cierre. Maximo una entrega funcional En curso.
- Inicio de sesion: objetivo/bloqueos; cierre: evidencia, pendientes y siguiente
  accion. Revision y retrospectiva al terminar el sprint, no solo al publicar.
- Prioridad: seguridad/datos, fallo de flujo, friccion frecuente, visual, oportunidades.

## Fases y puertas de salida

| Fase | Salida requerida | Estado |
| --- | --- | --- |
| 0 Consolidar | Version, evidencia y pendientes coherentes | Cerrado en esta documentacion |
| 1 Validar jornada | Ambos roles recorren tareas; ayuda y defectos registrados | Validacion; bloqueada por sesiones |
| 2 Resolver fricciones | Defectos relevantes corregidos y tareas repetidas | Backlog; depende de observaciones |
| 3 Presentacion | Acceso primer encargado, datos separados y feedback registrado | Backlog |
| 4 Ampliar suite | Objetivo y reglas aprobados por modulo | Backlog; no construir por suposicion |

## Base historica PR42 y limites del recorrido original

- Producto: https://www.trustleaf.org/dispensario; laboratorio local 4330 excluido.
- Main `d101469e51888f6a33bc8c007267beba265d81a3`, PR #42 fusionado.
- CI https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/36072522968 aprobado
  sobre `668d84f41f9f20aebca3b394670e2630755735c8`; preview aprobada.
- Vercel `dpl_d6Amae2MsKf8prLTEYno8ix2Ah9R`, production Ready y alias oficial
  reconfirmados el 25/09. Capturas sinteticas: `docs/evidence/desk-connected`.
- Ambos roles y 360/390/768/1024/1440 px probados tecnicamente. No equivale a
  dispositivo fisico, teclado movil ni usuario trabajando sin ayuda.
- Sesion oficial observada: Admin, sin acceso de dispensario. No es un defecto
  demostrado. Cuenta de encargado/operador, stock, saldo y permiso: sin comprobar.
- No confirmar entregas, recepciones, ajustes, cuarentenas, invitaciones ni retiro
  de miembros en este recorrido. No reiniciar saldos ni modificar tratamientos.
- Sin APIs, contratos, permisos o migraciones nuevas. B, Browns y borrador mensual
  intactos. Autenticacion real; contenido clinico/inventario exclusivamente ficticio.

## Tablero unico

| ID / actor | Problema y resultado esperado | Estado / responsable | Aceptacion, dependencia y evidencia |
| --- | --- | --- | --- |
| S1-01 / todos | Docs decian pendiente aunque PR42 publicado; base univoca | Cerrado / facilitador | Version/CI/Vercel contrastados; base anterior y E7 en mapa |
| S1-02 / ambos roles | Falta evaluar uso real del nuevo marco | Validacion, BLOQUEADO / facilitador + participantes | Todos los casos siguientes sin ayuda; requiere sesiones y permiso; evidencia humana pendiente |
| S1-03 / ambos roles | Fricciones aun no observadas; resolver solo hallazgos | Backlog / facilitador | Hallazgo reproducible, regresion, CI/preview y repeticion humana; depende S1-02 |
| S1-04 / encargado | Gestion conserva funciones pero falta evaluar claridad | Preparado / facilitador + encargado | Encontrar catalogo, proveedores/equipo y volver, sin guardar; sesion requerida |
| S1-05 / PO | Falta decision de cierre y siguiente prioridad | Backlog / PO + facilitador | Revision con resultados, bloqueos y retrospectiva; depende S1-02/03/04 |
| P-01 / encargado de ensayo | Acceso de Browns | Cerrado / PO + encargado | Ingreso y recarga del 27/09, Browns/Encargado; sin mover miembros de B |
| P-02 / dispensario | Preparar presentacion basada en funciones disponibles | Validacion / PO + facilitador | Browns con 100 g, movil guiado; autonomia y escenarios restantes pendientes |
| SEP-01 / equipo | Negativos de invitaciones y otros pendientes historicos | Backlog separado / facilitador | Reconciliar evidencia por caso antes de pruebas; S1 no los declara cerrados |

Bloqueo B1 historico (superado para Browns encargado): se necesitaba sesion de encargado u operador. Usar perfiles o dispositivos
separados; dos pestanas comunes no aislan identidad. Solicitud de acceso enviada
al usuario el 25/09, sin pedir contrasenas ni codigos. No cerrar Admin sin indicacion.
Bloqueo B2 condicional: permiso/tratamiento no aptos. Solo el paciente renueva
explicitamente si puede; de lo contrario detener ese caso y seguir lecturas permitidas.

## Protocolo de prueba y evidencia

Primero enunciar la tarea, sin indicar botones. El participante ejecuta; el agente
puede verificar tecnicamente despues, pero no adjudicarse autonomia humana.
Registrar ayuda literalmente. Con ayuda, el caso queda observado y requiere
revision/repeticion, no aprobado por autonomia.

| Caso | Tarea / resultado esperado |
| --- | --- |
| J01 | Identificar cuenta, rol, organizacion y piloto; leer saldo/stock actuales sin asumir valores |
| J02 | Encontrar paciente por nombre/referencia, elegir tratamiento y explicar disponible, asignado y retirado |
| J03 | Identificar lote utilizable y por que uno bloqueado no permite seleccion; revisar cantidad valida SIN confirmar |
| J04 | Volver, cancelar descarte y conservar preparacion; descartarla explicitamente; conservar busqueda al regresar |
| J05 | Encontrar lote en Inventario, abrir su historial y recuperar comprobante existente; explicar producto, cantidad y responsable |
| J06 | Alternar entregas/movimientos, combinar/limpiar filtros; error de lectura nunca se interpreta como cero |
| J07 | Recargar, volver a entrar y comprobar datos/permisos; operador sin gestion administrativa; no probar escrituras denegadas en vivo |
| J08 | Encargado localiza Gestion/catalogo/proveedores/equipo; formularios inicialmente plegados, abrir/cerrar sin guardar |

J01-J07: cada rol en escritorio y celular real. J08: encargado en ambos.
Casos sin datos de ejemplo quedan pendientes; no generar movimientos para cubrirlos.
Errores y revocaciones provocadas se reproducen en entorno aislado; no retirar
permisos publicados solo para obtener evidencia. Comprobar foco y teclado movil.

| Sesion | Rol / dispositivo | Casos | Resultado |
| --- | --- | --- | --- |
| U1 | Encargado / escritorio | J01-J08 | Acceso y pruebas del agente observados; autonomia pendiente |
| U2 | Encargado / celular real | J01-J08 | Recepcion 100 g encontrada con guia; resto y autonomia pendientes |
| U3 | Operador / escritorio | J01-J07 | B con evidencia guiada; autonomia pendiente |
| U4 | Operador / celular real | J01-J07 | Pendiente |

Por caso registrar: fecha, version, rol, dispositivo/navegador/ancho, esperado,
observado, ayuda, resultado (aprobado/fallido/pendiente), evidencia y defecto ID.
No incluir tokens, contactos o capturas clinicas reales. Referencias completas
solo cuando sean de prueba y necesarias; capturas sanitizadas.

## Defectos, oportunidades y cierre

No hay un defecto nuevo confirmado por esta consolidacion. Registro inicial:

| ID | Problema / actor | Frecuencia | Beneficio | Riesgo / esfuerzo | Decision |
| --- | --- | --- | --- | --- | --- |
| O1 Gestion | Posible dificultad para encontrar herramientas / encargado | Por medir | Menos ayuda | UI compartida / por estimar | Observar S1-04 |
| O2 Compras | Pedidos/recepciones parciales / encargado | Por confirmar | Pendientes trazables | Stock/concurrencia / alto preliminar | Descubrimiento con dispensario |
| O3 Documento/Caja | Cobro opcional y conciliacion / ambos | Por confirmar | Separar entrega y cobro | Dinero/roles / alto preliminar | Confirmar venta/aporte/membresia |
| O4 Conteos | Diferencias fisicas / encargado | Por confirmar | Ajustes explicables | Bloqueos/stock / alto preliminar | Acordar excepciones |
| O5 Reportes | Informacion para decisiones / encargado | Por confirmar | Control diario | Privacidad/datos faltantes / por estimar | Depende de modulos y preguntas reales |

Defecto nuevo: ID, caso, severidad, reproduccion, evidencia, responsable y prueba
de regresion. Critico de seguridad/datos detiene escenario; una desactivacion de
capacidad requiere procedimiento seguro, nunca borrar historial ni volver a Firebase.
Toda correccion: tipos, build, regresiones, CI/preview y verificacion posterior.

Presentacion inicial: preparar -> localizar autorizado -> explicar saldo -> revisar
sin ejecutar -> encontrar lote y comprobante -> explicar equipo. No presentar
Compras/Caja/Conteos como operativos. Preguntar herramientas actuales, tareas
frecuentes, excepciones, roles, formatos y modelo economico; no asumir respuestas.

Revision actual: consolidacion tecnica completada; sesiones de ambos roles
observadas, prueba humana pendiente. Ninguna funcion nueva ni entrega registrada.
Siguiente accion: contrastar NAV-01 y completar lecturas del operador; luego
evaluacion humana sin tutorial inicial. El unico cambio de acceso fue el permiso
temporal del paciente, autorizado explicitamente y documentado el 25/09.
Cierre S1 solo con ambas evaluaciones, defectos relevantes resueltos, evidencia
actualizada y siguiente prioridad aprobada. Retrospectiva: que funciono, donde
hubo ayuda y un cambio concreto al proceso para la proxima iteracion.
