# Migracion Windows de Trust Leaf

Estado: preparacion, no recuperacion completada. Fecha: 2026-10-07.

## Base
PR #70 integrado en main: `0de35ce1e61288ce628e99044176ceec980bdff3`.
CI posterior a la fusion en curso al registrar esta evidencia:
https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/37567030438
Ultimo main con CI comprobado: `0d56f3d21de61f324a31eb8ed4415a92890159aa`.
No atribuir el nuevo SHA al dominio oficial sin evidencia del despliegue.
PR #62 permanece borrador; no publicar aviso de privacidad.

## Conservacion
El inventario adjunto registra 74 directorios Git, 54 HEAD sin alcance comprobado desde referencias origin y cinco checkouts con cambios locales. Esto no demuestra que todos sean trabajo exclusivo: falta contrastar squash y ramas no asociadas a worktrees.
No eliminar, fusionar ni subir esas ramas automaticamente. Revisar cambios e historial por secretos antes de cualquier push.
El borrador mensual sigue fuera de Git y no se aplica.
Los checkouts enlazados dependen de metadatos comunes: no trasladar solo wt-main-release como si fuera un clon independiente.
El equipo anterior es el resguardo provisional, no un respaldo portable verificado.

## Nuevo equipo
Instalar Git y Node 22. Autenticar nuevamente GitHub; no copiar credenciales del Windows anterior.
Desde PowerShell, tras crear C:\Projects:
```powershell
git clone https://github.com/CaBsCrypto/Trust-Leaf.git C:\Projects\trust-leaf
Set-Location C:\Projects\trust-leaf
git switch main
git pull --ff-only
git rev-parse HEAD
npm ci
npm ci --prefix tests/sql --ignore-scripts
npm run lint
npm run build
npm run test:operations-pilot
npm run test:shared-patient-read
npm run test:local-demo
npm run demo:local
```
Abrir solo este repositorio como workspace. Crear ramas desde main actualizado.
No ejecutar migraciones ni conectar QA a produccion. PostgreSQL/WSL y navegadores de QA requieren instalacion separada; seguir las instrucciones de las suites del repositorio antes de probar concurrencia.
La demo se limita a loopback y usa registros temporales: reconstruir su escenario desde el guion, no copiar sus datos como datos de produccion.

## Accesos por recuperar
| Servicio | Uso | Recuperacion / estado |
|---|---|---|
| GitHub / Git | codigo, PR, CI | login nuevo y segundo factor; pendiente de prueba en PC nuevo |
| Vercel | despliegue, configuracion | login nuevo; comprobar proyecto, entorno y SHA sin desplegar automaticamente |
| Supabase | base y CLI | login nuevo; comprobar proyecto; no aplicar migraciones |
| Privy | identidad | login del dashboard; comprobar configuracion autorizada |
| Resend | invitaciones | login nuevo; no enviar mensajes para comprobarlo |
| Google / Calendar | agenda | login y autorizaciones necesarios; no copiar sesiones ni probar llamadas |
| Dominio y correo | DNS y buzones | confirmar proveedor, titular y acceso; comprobar admin@trustleaf.org por separado |
| Firebase / Stellar | legado | conservar inventario; recuperar solo lo necesario, sin reactivar lecturas retiradas |

La declaracion de acceso por correo/2FA no sustituye una comprobacion por servicio.
No registrar contrasenas, tokens, claves, codigos de recuperacion ni datos personales en esta guia.

## Configuracion y archivos fuera de Git
Inventariar existencia y finalidad, nunca contenido sensible: .env*, .vercel, scratch, logs, capturas, respaldos y claves heredadas.
node_modules, caches npm y dist se reconstruyen; no son respaldo del trabajo.
Recuperar secretos desde fuentes autorizadas de los proveedores. Si faltan, registrar bloqueo; no rotar produccion automaticamente.
No copiar cookies, perfiles de navegador ni almacenes completos de credenciales.

Los respaldos de aplicacion en el equipo anterior usan DPAPI CurrentUser. Copiarlos no garantiza descifrarlos en otro Windows.
Su verificacion de restauracion no cubre Auth, Storage, Vault ni configuracion de plataforma.
Un traslado portable necesita canal seguro independiente de GitHub y verificacion aislada; sigue pendiente.
No ejecutar exportaciones sensibles como parte de esta entrega documental.

## Puertas de cierre
- [ ] Inventariar ramas locales no asociadas a worktrees y comprobar equivalencias.
- [ ] Revisar y resguardar trabajo local no integrado, sin secretos.
- [ ] Revisar y aprobar CI del ultimo commit documental antes de fusionar.
- [ ] Identificar SHA y estado del despliegue oficial por separado.
- [ ] Clon, dependencias, tipos, compilacion y QA aprobados en nuevo PC.
- [ ] Logins y configuracion reconstruidos por servicio.
- [ ] Archivos locales importantes y respaldos recuperables comprobados.
- [ ] Lecturas oficiales autorizadas, sin escrituras de negocio.
- [ ] Confirmacion del usuario antes de retirar el equipo anterior.

Matriz final: recuperado / reproducible / conservado en equipo anterior / bloqueado.
B, Browns, historiales y privacidad pendiente no cambian. La migracion no habilita operacion clinica o comercial real.

