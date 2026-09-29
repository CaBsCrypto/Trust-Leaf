# Inventario: proteccion del trabajo sin guardar

Actualizado: 2026-09-29. Rama `fix/inventory-draft-guard`.
Base: `ab2f4b3e18eaa93d7151c3b158bb877f9e273a56` (PR49).

## Defecto y alcance

La reproduccion aislada anterior mostro perdida de recepciones y ajustes al
navegar o filtrar, y valores antiguos tras un ajuste guardado. El formulario
conserva ahora sus valores en memoria por organizacion, hasta guardar o aceptar
su descarte. Una lectura fallida no confirma cambios. No hay guardado automatico.

El ajuste conserva la version inicial. Adoptar existencias mas recientes requiere
una accion explicita. Las respuestas inciertas conservan comando e identificador;
otra operacion no puede reemplazarlos. El reintento queda bloqueado si cambian
organizacion o permisos. La perdida de acceso elimina datos protegidos.

La revision independiente detecto dos casos adicionales alrededor de cuarentena:
descarte antes de rechazar una navegacion bloqueada, y recuperacion visible tras
democion de encargado. Se incorporaron guardas y su regresion ampliada paso en
los cinco anchos. Tambien se comprobo beforeunload con una operacion de estado
pendiente y sin borradores. No se demostro un bypass de permisos del servidor.

## Evidencia y puertas de salida

- Regresion final ampliada: encargado y operador, 360/390/768/1024/1440 px, PASS;
  70 POST interceptados, 40 movimientos sinteticos, cero solicitudes externas.
- Medico: diez casos de notas, cierres y recuperacion autorizada, PASS aislado.
- Operaciones API y SQL aislado: PASS. PGlite no acredita concurrencia real.
- Tipos y regresion visual de navegacion: PASS sobre candidato final.
- Build local: PASS, con avisos existentes de paquetes Privy y tamano de chunks.
  Revision final, CI y preview: pendientes. No publicado este ajuste.
- Revision de calidad reprodujo una regresion en recuperacion de crear organizacion:
  la respuesta perdida seguida de lectura con nueva membresia ocultaba el reintento.
  La excepcion queda limitada a crear organizacion desde contexto sin organizacion;
  recepciones, ajustes y estado de lote conservan el aislamiento estricto. Repetir
  la regresion compartida antes de integrar PR50.
- Capturas: `scratch/inventory-draft-guard`, incluidas en artefactos CI.
- Celular fisico, teclado real y autonomia: pendientes; viewport no los sustituye.

Sin cambios de APIs, migraciones, permisos ni datos de B/Browns. El borrador
mensual queda fuera de la entrega.

## Ciclo de cuatro actores

| Actor | Evidencia reutilizable | Comprobacion actual pendiente |
| --- | --- | --- |
| Medico | Notas y flujo de consulta, regresion aislada | Sesion oficial: reserva, nota y tratamiento |
| Paciente | Evidencia historica de saldo y comprobante | Identidad, reserva y saldo actuales; no asumir vigencia |
| Dispensario | Inventario aislado y evidencia historica B/Browns | Lecturas oficiales y revision sin confirmar |
| Admin | Lectura oficial 29/09: identidad admin, B con encargado y operador, Browns con encargado; incorporacion Browns aprobada | Repetir lectura despues de publicar el candidato |

No se efectuaron escrituras de negocio publicadas para esta correccion. Renovar
un permiso requiere accion explicita del paciente. La incorporacion externa y
las pruebas humanas siguen separadas del cierre tecnico.
La lectura actual muestra tambien una invitacion pendiente creada fuera de esta
auditoria. No se reenvio, cancelo ni considero completada.
