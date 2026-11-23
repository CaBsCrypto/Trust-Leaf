# TrustLeaf · mapa de la interfaz Cannabis

Este inventario corresponde al candidato local de la rama `redesign/cannabis-relieve-vivo`. Describe rutas que reconoce el cliente y las opciones que cada portal habilita según el perfil y la configuración.

## Inventario de rutas

| Grupo | Cantidad | Rutas y comportamiento |
| --- | ---: | --- |
| Landing | 1 | `/`. Portada Relieve Vivo, proceso, red de atención y accesos por perfil, con navegación y pie compartidos. |
| Paciente | 7 | `/paciente`, `/paciente/cuenta`, `/paciente/recetas`, `/paciente/dispensarios`, `/paciente/retiros`, `/paciente/historial`, `/paciente/viajero`. En modo piloto llevan al mismo panel. El portal anterior conserva su correspondencia por dirección. |
| Médico | 2 | `/medico` y `/medico/operacion`. La autorización y el modo del producto determinan el destino. |
| Dispensario | 4 | `/dispensario`, `/dispensario/operacion`, `/dispensario/historial`, `/dispensario/retiros`. La entrada procesa invitaciones de encargado u operador cuando corresponde. |
| Administración | 1 | `/admin`. Acceso protegido con la autorización existente. |
| Vistas técnicas | 4 | `/mvp`, `/demo/pilot-flow`, `/demo/receipt-pilot` y `/demo/trust-registry`. El acceso directo en un despliegue depende de sus reglas de navegación. |
| Verificación | 1 | `/verify/:token`. Un token opaco por comprobante, con estados de verificación. |

Total: **20 patrones** (19 fijos y uno dinámico). La portada incluye `#como-funciona`, `#red`, `#trazabilidad`, `#lista-de-espera` y `#profesionales`. Cada lista admite enlace directo por perfil. La demo de actores, el visor de diseño y el prototipo de landing técnica quedan fuera del total.

## Navegación de cada perfil

| Perfil | Inicio | Opciones principales | Vistas interiores |
| --- | --- | --- | --- |
| Paciente | Mi atención | Mi atención, Agenda, Tratamientos, Historial | Citas, notas finalizadas, permisos y comprobantes. |
| Médico | Consultas | Consultas, Agenda, Tratamientos, Historial | Filtros de consulta, notas, finalización y tratamiento simulado. |
| Encargado | Jornada | Jornada, Pacientes, Inventario, Historial y Equipo o Gestión | Preparación, lotes, movimientos, entregas y equipo. Comercio depende de la configuración. |
| Operador | Pacientes | Comparte el menú del dispensario cuando tiene equipo | Atención, autorización y entrega. Las acciones dependen del permiso y la pertenencia vigentes. |
| Administración | Solicitudes | Solicitudes, Directorio y Supervisión cuando el calendario o el piloto están activos | Actividad, Organizaciones, POV de prueba e Incorporaciones cuando está habilitada. Incorporaciones separa invitaciones y solicitudes. |

Son **15–16 opciones de primer nivel** entre las cuatro familias con el dispensario habilitado. Los cinco perfiles comparten componentes, y cada uno mantiene sus controles y datos autorizados. Los portales anteriores mantienen sus vistas permitidas según el rol.

## Componentes y secciones

- Portada pública con navegación, portada ilustrada, proceso, red, trazabilidad de dispensación, listas de espera por perfil, tarjetas de acceso y pie.
- Marco de acceso compartido por Privy para actores y administración, con estados de verificación, revisión, error y autorización.
- Marco operativo y navegación reutilizados por paciente, médico, dispensario y Supervisión. La agenda se comparte entre paciente y médico.
- Patrones de presentación comunes para acciones, tarjetas, avisos, filtros, tablas y formularios. Los paneles de gestión conservan su selección y confirmaciones.
- Tokens de TrustLeaf compartidos. Cannabis identifica el canal y Relieve Vivo expresa su apariencia. Las vistas técnicas usan el mismo lenguaje visual y mantienen sus etiquetas de demostración.

## Trazabilidad privada de dispensación

En el piloto sintético, cada entrega vincula el tratamiento y su período, el dispensario, el operador, el lote, la cantidad y la fecha con un comprobante. El tratamiento vincula la entrega con el paciente. Al confirmar, el piloto registra la entrega, descuenta la cantidad del stock del lote y del saldo del período y escribe una entrada de auditoría. Comprueba la pertenencia al dispensario, el permiso vigente, la validez del tratamiento, el estado del lote y el saldo disponible. [Registro y controles del piloto](../supabase/migrations/20260909010000_operations_pilot.sql)

La revisión de la entrega muestra el stock proyectado. El comprobante propio abre el movimiento exacto que descontó el stock y la ficha del lote en inventario. Cada movimiento nuevo guarda el stock que dejó en ese momento. La ficha muestra el stock actual y los movimientos anteriores a este cambio indican que falta el saldo histórico. El historial distingue las entregas propias de las compartidas y permite consultar comprobantes por fecha y lote. [Saldo por movimiento y enlace desde comprobantes](../supabase/migrations/20261122010000_pilot_movement_stock_after.sql)

| Perfil | Visibilidad en el piloto |
| --- | --- |
| Paciente | Sus entregas y comprobantes, que conserva aunque retire el permiso de acceso al dispensario. |
| Médico | Entregas de los tratamientos vinculados a su cuenta. |
| Encargado u operador | Entregas de su organización mientras mantenga la pertenencia. El comprobante muestra el nombre y la referencia del tratamiento mientras esté vigente el permiso para ese tratamiento. El historial compartido de otras organizaciones también exige ese permiso. |
| Administración | Conteos y auditoría operativa por acción, fecha y referencias internas. |
| QR público | Verificación minimizada de existencia, coincidencia y estado de evidencia de demostración. Identidad, receta, producto, cantidad, lote y detalle de la entrega quedan en las vistas privadas. |

Quedan pendientes las anulaciones con impacto en stock y saldo, la política de identidad mínima para pacientes reales y la definición de accesos y auditoría de lecturas para producción. [Autorización de lectura compartida](../supabase/migrations/20261001010000_shared_patient_read_authorization.sql) · [Contrato del QR de demostración](internal/qr-public-verification-spec.md)

## Revisión por recorridos

Abrir la [guía local de revisión](RELIEVE_VIVO_REVIEW.md) para comprobar portada, entrada, perfiles y QR. Revisar con cuentas sintéticas y hacer por separado la validación de Privy, del panel administrativo autorizado y de un teléfono físico.
