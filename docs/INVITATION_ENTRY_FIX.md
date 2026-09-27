# AUD-01: entrada de invitaciones

Rama: `fix/onboarding-invitation-entry`, desde `2e01443`.
Auditoria documental separada: PR45.

La captura unica distingue encargado y trabajador antes de limpiar el fragmento.
El enlace explicito prevalece sobre el almacenamiento anterior. Un fragmento
invalido o ambiguo no recupera tokens guardados. Una invitacion antigua unica
sigue disponible; dos invitaciones antiguas requieren reabrir el enlace.
La captura persiste antes de limpiar la URL; si falla almacenamiento conserva
el fragmento para la recarga. Al cambiar el fragmento React monta una nueva
pantalla y descarta el estado de la invitacion anterior.

Verificacion local 27/09:
- 15 pruebas nuevas de captura, almacenamiento, recarga, ambiguedad y salida PASS.
- Tipos completos (`npm run lint`) PASS.
- Incorporacion: API 5/5 y SQL PGlite PASS.
- Equipo: API 12/12 y SQL PGlite PASS.
- Compilacion producto (`npm run build`) PASS, 3m 7s; advertencias de
  anotaciones de dependencias y chunks grandes, sin error de compilacion.

- Navegador aislado 390/1440: encargado/trabajador, tokens anteriores, recarga,
  hashchange, reinicio de consentimiento y enlace invalido PASS. Solicitudes
  externas bloqueadas y ninguna escritura; identidad sintetica, no Privy real.
- Regresion navegador de incorporacion: invitacion, borrador, cambios sin
  guardar al recuperar foco, recarga, correcciones, aprobacion y encargado
  persistente PASS; cinco anchos. Datos SQL aislados.

Pendiente: revision del diff, CI y preview del ultimo commit. No publicado ni
bloqueo cerrado. Admin autenticado en produccion sigue pendiente.
No hubo correos ni escrituras a produccion. Sin API, migracion ni permisos nuevos.
