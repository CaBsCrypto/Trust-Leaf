# Validacion Sintetica De Actores

Fecha: 2026-09-05. Ejecucion: `npm run qa:synthetic-actors`.

## Resultado

Ocho suites pasaron localmente. El runner utiliza Node y las pruebas existentes;
no necesita credenciales ni crea usuarios en Privy o Supabase.

Identidades nuevas de la matriz: admin, doctor, dispensary y patient con correos
ficticios bajo `trustleaf.example`. Son fixtures de prueba, no buzones ni cuentas
con acceso al sitio. El verificador de identidad y la respuesta RPC estan
simulados; el autorizador y el adaptador de resolucion son los del proyecto.

| Suite | Evidencia | Limite |
| --- | --- | --- |
| Cuatro roles | Cada rol accede a su permiso; los otros tres se rechazan. Pending, suspended, revoked y expired bloqueados; vencimiento temporal comprobado. | Identidad y respuesta de DB simuladas. |
| Adaptador Privy/RBAC | Resolucion activa y rechazo de vinculo ausente. | No verifica tokens reales. |
| Agenda | Permisos, doble reserva, reintento idempotente y reutilizacion del repositorio. | Repositorio en memoria, no persistencia remota. |
| Receta compartida | Emision, retiro parcial, revocacion, vencimiento y proyeccion publica minima. | Ledger sintetico. |
| Recorrido demo | Diez transiciones y casos negativos de rol, consentimiento y QR. | Maquina de estados y comprobaciones de codigo; no navegador. |
| Migracion base | Esquema privado, RLS, grants y auditoria en archivos SQL. | Comprobacion estatica. |
| Migracion RBAC | Aislamiento, escritura por RPC e idempotencia en SQL. | Comprobacion estatica. |
| Migracion agenda | Controles de concurrencia y auditoria en SQL. | Comprobacion estatica. |

## Pendiente para aceptar el flujo real

- Alta profesional, reenvio, listado y aprobacion contra las RPC desplegadas:
  estas pruebas NO reproducen el error historico de solicitud invisible en admin.
- Login Google/OTP, firma y validacion real del token Privy.
- Cambio de cuenta, recuperacion de sesion y pantallas desktop/mobile.
- Permisos y revocacion de ficha clinica real, almacenamiento y cifrado.
- Persistencia entre dispositivos y concurrencia real en Supabase.
- Firma por actor, transacciones y reconciliacion de saldo en Stellar Testnet.

Pasar estas suites permite avanzar con menos regresiones, pero no declara que
el ciclo real este completo. No se agrego ningun bypass de autenticacion ni
cuentas administrativas de prueba en produccion.
