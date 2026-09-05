# Trust Leaf: Plan De Cierre Del MVP

Fecha: 2026-09-05.

## Objetivo inmediato

Cerrar un ciclo completo con datos sinteticos y prueba verificable en Stellar
Testnet: alta, aprobacion, reserva, consulta autorizada, receta, retiro parcial
e historial. Una compilacion exitosa no equivale a validacion funcional.
El uso con pacientes reales requiere un cierre adicional de privacidad y operacion.

## Evidencia actual

- La limpieza del panel admin esta fusionada; Vercel confirma produccion Ready
  en trustleaf.org y www.trustleaf.org.
- El repositorio contiene Privy, vinculacion de roles, cola de aprobacion y
  perfiles profesionales simulados para medico y dispensario.
- La migracion de perfiles simulados fue aplicada en la sesion anterior.
- El ciclo manual con identidades separadas sigue pendiente de aceptacion.
- Agenda, contratos y adaptadores tienen codigo y pruebas; su existencia no
  acredita que esten conectados de punta a punta con la identidad actual.

## Orden de ejecucion

1. Acceso y aprobacion. Probar medico y dispensario con cuentas distintas de
   admin: ingresar, completar perfil simulado, enviar, ver pendiente en admin,
   aprobar y volver al portal. Probar rechazo, reintento sin duplicado, cambio
   de cuenta, recarga y segundo dispositivo. Paciente se activa directamente.
   Salida: los estados coinciden en UI y servidor; una cuenta pendiente no
   puede operar ni elevar su rol llamando directamente a la API.
2. Agenda persistente. Verificar que la identidad Privy se resuelva al mismo
   actor en disponibilidad y reservas. Medico publica horario, paciente reserva
   y ambos ven la misma cita tras recargar. Salida: no hay doble reserva; un
   paciente no puede modificar la cita de otro; cancelacion libera el horario.
3. Consulta y permiso. Vincular cita, paciente y medico; autorizar un alcance
   temporal, iniciar consulta y guardar resumen sintetico privado. Salida:
   revocacion y expiracion bloquean nuevas lecturas en servidor; solo la
   consulta correspondiente permite preparar receta.
4. Receta y retiro. Conectar emision, QR, inventario por lote, saldo y comprobante.
   Salida: receta sintetica de 30 g, retiro de 5 g, saldo de 25 g e historial
   coincidente para paciente y dispensario. Reintentos no duplican retiros;
   concurrencia, exceso de saldo y expiracion se rechazan. Una receta vencida
   permanece en historial privado, sin habilitar nuevos retiros.
5. Prueba Stellar Testnet. Auditar que contratos y adaptadores desplegados
   correspondan al flujo vigente antes de reutilizarlos. Verificar firma y
   autorizacion por actor, emision y retiro confirmados, y reconciliacion con
   Supabase ante errores. Salida: evidencia de transacciones confirmadas y
   saldo consistente, sin presentar simulaciones como confirmaciones on-chain.
6. Cierre de demo. Ejecutar el recorrido en desktop y mobile, documentar fallos
   con pasos reproducibles, corregir bloqueantes y grabar el ciclo completo.
   Salida: recorrido repetible con datos sinteticos y sin ajustes manuales en DB.

## Trabajo paralelo permitido

- Recuperar instalacion reproducible para lint y build y ejecutar la bateria
  existente de Privy, RBAC, agenda y contratos segun cada cambio.
- Revisar contratos, wallets y configuracion Testnet mientras se valida el alta.
- Actualizar rutas y hallazgos; retirar dependencias Firebase solo cuando sus
  consumidores tengan reemplazo probado. Ocultar paneles no elimina el legado.
- Evitar redisenar toda la interfaz antes de cerrar el ciclo funcional.

## Metodo de entrega

Cambios acotados en rama, pruebas pertinentes, preview y revision, integracion
en staging, promocion a main y comprobacion del dominio oficial. Configurar un
origen estable de staging autorizado en Privy para reducir dependencia de
produccion en las pruebas de login. No cambiar a Stellar Mainnet.

Cada bloque se cierra con evidencia, no con una estimacion ni con un estado
Ready de Vercel. Registrar pendiente, probado o bloqueado y la causa concreta.
Reestimar el calendario al terminar el primer ciclo de aprobacion; no hay una
fecha fiable de cierre antes de comprobar las integraciones restantes.

## Antes de datos reales

Cerrar solicitudes profesionales reales, revision de credenciales, cifrado y
gestion de claves, permisos por alcance, auditoria, recuperacion de backups,
retencion y revision legal aplicable. No declarar cumplimiento por usar Supabase.
No publicar datos clinicos ni historiales personales vinculables en QR o cadena.
