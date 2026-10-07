# Migraciones y recuperacion de Trust Leaf

Punto de entrada para retomar el proyecto en otro PC o entregar contexto a un
colaborador. Fecha de referencia: 2026-10-07. No contiene credenciales.

Este documento trata la mudanza del entorno de desarrollo, no la ejecucion de
migraciones SQL. Clonar el proyecto no autoriza modificar la base remota.

## Leer primero

1. [Guia Windows y recuperacion de accesos](docs/WINDOWS_MIGRATION_RUNBOOK.md).
2. [Inventario de checkouts conservados](docs/evidence/windows-migration/README.md).
3. [Plan maestro](docs/TRUSTLEAF_MASTER_PLAN.md).
4. [Tablero de cierre y pendientes](docs/DISPENSARY_CLOSEOUT_SPRINT.md).
5. [Guion de demo](docs/DEMO_ADOPTION_RUNBOOK.md) y
   [arranque local](tests/local-demo/README.md).

El tablero conserva el estado del producto; este indice no reemplaza esa fuente
ni convierte evidencias historicas en aprobaciones actuales.

## Carpeta y base de trabajo

- Repositorio: https://github.com/CaBsCrypto/Trust-Leaf
- Raiz actual del proyecto: `D:\00 CODEX - OPENIA\projects\trust-leaf`.
- Checkout usado para preparar esta entrega: `wt-main-release`, dentro de esa raiz.
- Destino recomendado: `C:\Projects\trust-leaf`, mediante un clon nuevo.
- Abrir solo el clon como workspace, no la carpeta que agrupa otros proyectos.

Los directorios `wt-*` son checkouts vinculados: no trasladar uno aislado como
si contuviera todo el repositorio. `research-monorepo` es un repositorio separado.

PR #70 y #71 estan integrados. Base de esta entrega:
`84d3e7280bf36fd9659b6d9689bf0db193ffb207`.
Antes de empezar, volver a comprobar origin/main, CI y despliegue por separado.
Un SHA de GitHub no acredita por si solo el estado de Vercel o accesos privados.

## Primera sesion en el nuevo Windows

1. Instalar Git y Node 22; iniciar sesion nuevamente en GitHub.
2. Clonar siguiendo la guia Windows, instalar desde los lockfiles y comprobar SHA.
3. Instalar tambien dependencias de `tests/ui` para QA de navegador, como indica
   el README de la demo. PostgreSQL/WSL se prepara aparte para concurrencia aislada.
4. Ejecutar tipos, compilacion y regresiones; anotar comando, SHA y resultado.
5. Recuperar configuracion desde proveedores autorizados, nunca desde este indice.
6. Arrancar la demo solo en loopback y usar la URL que imprima el servidor.

La demo usa SQL temporal e identidades simuladas. Reiniciar su servidor requiere
reconstruir el ensayo desde el guion; no hay datos durables que trasladar.
No ejecutar migraciones remotas ni escrituras de negocio para probar la mudanza.

## Accesos y resguardos

Revalidar GitHub, Vercel, Supabase, Privy, Resend, Google/Calendar y dominio/correo.
La matriz detallada esta en la guia Windows. No copiar sesiones, cookies o
almacenes de credenciales. No registrar tokens, .env, claves ni datos personales.

El inventario encontro trabajo local que necesita revision y respaldo separado.
No fusionar ramas historicas para resolverlo ni borrar carpetas. El borrador
mensual permanece fuera de esta entrega y no se aplica.

Los respaldos DPAPI requieren recuperacion comprobada: copiarlos a otro Windows
no garantiza descifrarlos. GitHub no sustituye un canal seguro para archivos
sensibles. Conservar el PC anterior hasta cerrar estos pendientes.

## Nota para quien retoma

Al comenzar una sesion, registrar:

```text
Workspace:
Rama / SHA:
Cambios locales (solo nombres, sin contenido sensible):
CI del candidato:
Despliegue oficial comprobado o pendiente:
Objetivo de la sesion:
Bloqueos y siguiente accion:
```

Trabajar siempre en rama -> pruebas -> PR -> revision -> integracion.
Una correccion funcional activa a la vez. No revertir cambios ajenos.
Consultar las instrucciones del repositorio antes de editar.

## Cierre de la mudanza

Registrar por elemento: recuperado, reproducible, conservado en equipo anterior
o bloqueado. Solo retirar/formatear el PC anterior tras comprobar codigo,
trabajo pendiente, archivos importantes, accesos, configuracion, QA y respaldos,
y obtener confirmacion explicita del propietario.

PR #62 y privacidad siguen pendientes; no publicar avisos o enviar invitaciones
por completar esta mudanza. B, Browns y sus historiales permanecen intactos.
El piloto no habilita atencion, prescripcion, dispensacion ni cobros reales.
