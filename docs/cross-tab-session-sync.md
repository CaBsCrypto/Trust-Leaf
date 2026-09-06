# Sincronizacion de identidad entre pestanas

Estado: implementacion local; pendiente build remoto y prueba Privy real.
Rama: `feat/cross-tab-session-sync`. Parte de F1 del plan maestro.

## Problema observado

En produccion, despues de entrar como paciente, una pestana medica abierta
conservaba correo y estado autorizado del medico hasta recargar. Tras recargar,
el servidor denegaba correctamente el acceso al paciente. El cambio anterior
descartaba estado cuando el SDK notificaba otra identidad, pero no forzaba a las
otras pestanas a leer la sesion persistida del proveedor.

## Cambio

- Una transicion de identidad ya inicializada publica solo un UUID aleatorio.
  No se publican correos, DID, roles, tokens ni informacion clinica.
- BroadcastChannel y un evento de localStorage notifican a pestanas del mismo
  origen. Focus/visibility comprueban la revision para una pestana suspendida.
- Al recibir una revision nueva se invalidan los tokens en vuelo, se oculta la
  identidad local y se recarga la pagina para restaurar y verificar con Privy.
- Cada receptor actua una vez por ciclo; la restauracion inicial no publica
  mensajes. La senal nunca concede permisos ni sustituye la autorizacion SQL/API.
- La recarga puede descartar un formulario sin enviar; es intencional al cambiar
  de identidad. No revierte una operacion que el servidor ya haya recibido.

## Alcance y limites

Sincronizacion de **sesion**, no suscripcion en vivo a reservas o inventario.
Funciona entre pestanas del mismo origen/perfil; no sincroniza dos dispositivos,
dos perfiles de navegador ni www frente a otro origen. Si almacenamiento y canal
estan bloqueados simultaneamente, sigue siendo necesaria la recarga manual.
No interpreta ni depende de claves internas de almacenamiento del SDK.

## Pruebas

`tests/ui/cross-tab-session-browser.mjs` utiliza el hook de produccion con
identidades ficticias en dos paginas reales de Edge. Comprueba cambio de cuenta,
logout, revision sin identidad, una recarga por cambio y fallback de transporte.
Incluye recuperacion por focus simulando notificaciones storage ausentes.
El fixture no contiene credenciales y no consulta Supabase.

Resultado local 2026-09-06: cuatro variantes browser PASS (ambos transportes,
storage, canal y focus), runner sintetico 12/12 PASS y agenda browser PASS.

Ejecutar Vite en `tests/ui` con `--config vite-session.config.mjs` (loopback 4318)
y el script con PLAYWRIGHT_MODULE/PLAYWRIGHT_CHANNEL segun runtime disponible.
Repetir regresiones de agenda y coordinacion de tokens antes de PR.

Prueba real pendiente: dos pestanas de trustleaf.org, medico y admin/paciente;
cambiar cuenta en una y verificar que la otra descarte inmediatamente sus datos,
restaure la cuenta actual y no muestre privilegios anteriores. No modificar la
reserva existente para esta comprobacion.
